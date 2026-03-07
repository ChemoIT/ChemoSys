'use client'

/**
 * UsersTable — data table for system user management.
 *
 * Shows all active users with their linked employee details, status (blocked/active),
 * and permission summary. Provides actions: permissions, block/unblock, delete.
 *
 * Props:
 *   users             — fetched server-side (active users with employee + permissions joins)
 *   employees         — all active employees (for UserForm create dialog)
 *   linkedEmployeeIds — employees already linked to active users
 *   templates         — role templates (for UserForm + UserPermissionMatrix)
 */

import * as React from 'react'
import { useTransition } from 'react'
import { Shield, Ban, CheckCircle, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { softDeleteUser, blockUser, unblockUser } from '@/actions/users'
import type { ActionWarning } from '@/lib/action-types'
import { ErrorDetailDialog } from '@/components/ui/error-detail-dialog'
import { UserForm } from '@/components/admin/users/UserForm'
import { UserEditDialog } from '@/components/admin/users/UserEditDialog'
import { UserPermissionMatrix } from '@/components/admin/users/UserPermissionMatrix'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PermissionRow = {
  module_key: string
  level: number
  is_override: boolean
  template_id: string | null
}

type UserWithDetails = {
  id: string
  auth_user_id: string
  is_blocked: boolean
  employee_id: string
  created_at: string
  deleted_at: string | null
  auth_email: string | null
  employees: {
    first_name: string
    last_name: string
    employee_number: string
    email: string | null
  } | null
  user_permissions: PermissionRow[]
}

interface UsersTableProps {
  users: UserWithDetails[]
  employees: Array<{
    id: string
    first_name: string
    last_name: string
    employee_number: string
    email: string | null
    id_number: string | null
    companies: { name: string } | null
  }>
  linkedEmployeeIds: string[]
  templates: Array<{ id: string; name: string }>
}

// ---------------------------------------------------------------------------
// Helper: permission summary
// ---------------------------------------------------------------------------

function permissionSummary(permissions: PermissionRow[]): string {
  const withAccess = permissions.filter((p) => p.level > 0 && !p.module_key.startsWith('app_'))
  if (withAccess.length === 0) return 'ללא הרשאות'
  return `${withAccess.length} מודולים`
}

function appModuleBadges(permissions: PermissionRow[]): Array<{ key: string; label: string }> {
  const badges: Array<{ key: string; label: string }> = []
  if (permissions.some(p => p.module_key === 'app_fleet' && p.level >= 1)) badges.push({ key: 'app_fleet', label: 'צי רכב' })
  if (permissions.some(p => p.module_key === 'app_equipment' && p.level >= 1)) badges.push({ key: 'app_equipment', label: 'צמ"ה' })
  return badges
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsersTable({ users, employees, linkedEmployeeIds, templates }: UsersTableProps) {
  const [formOpen, setFormOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<UserWithDetails | null>(null)
  const [permissionsTarget, setPermissionsTarget] = React.useState<UserWithDetails | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<UserWithDetails | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [blockTarget, setBlockTarget] = React.useState<UserWithDetails | null>(null)
  const [blocking, setBlocking] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [pendingWarnings, setPendingWarnings] = React.useState<{ label: string; warnings: ActionWarning[] } | null>(null)
  const [, startTransition] = useTransition()

  // Client-side search filter
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery.trim()) return users
    const q = searchQuery.trim().toLowerCase()
    return users.filter((u) => {
      const name = u.employees
        ? `${u.employees.first_name} ${u.employees.last_name}`.toLowerCase()
        : ''
      const num = u.employees?.employee_number?.toLowerCase() ?? ''
      const email = (u.auth_email ?? u.employees?.email ?? '').toLowerCase()
      return name.includes(q) || num.includes(q) || email.includes(q)
    })
  }, [users, searchQuery])

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await softDeleteUser(deleteTarget.id)
      if (result.success) {
        toast.success('היוזר נמחק בהצלחה')
        if (result.warnings?.length) {
          setPendingWarnings({ label: 'מחיקת יוזר', warnings: result.warnings })
        }
      } else {
        toast.error(result.error ?? 'שגיאה במחיקת יוזר')
      }
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Block / Unblock
  // ---------------------------------------------------------------------------

  async function handleBlock() {
    if (!blockTarget) return
    setBlocking(true)
    try {
      const isCurrentlyBlocked = blockTarget.is_blocked
      const result = isCurrentlyBlocked
        ? await unblockUser(blockTarget.id)
        : await blockUser(blockTarget.id)

      if (result.success) {
        toast.success(isCurrentlyBlocked ? 'היוזר בוטל חסימה' : 'היוזר נחסם')
      } else {
        toast.error(result.error ?? 'שגיאה בעדכון סטטוס יוזר')
      }
    } finally {
      setBlocking(false)
      setBlockTarget(null)
    }
  }

  const userName = (u: UserWithDetails) =>
    u.employees ? `${u.employees.first_name} ${u.employees.last_name}` : 'לא ידוע'

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <Input
          className="max-w-sm"
          placeholder="חיפוש לפי שם, מספר עובד, מייל..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          הוספת יוזר
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">שם עובד</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">מספר עובד</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">מייל</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">הרשאות</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">ChemoSys</th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground">
                  {searchQuery ? 'לא נמצאו יוזרים התואמים לחיפוש' : 'אין יוזרים עדיין'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, index) => (
                <tr
                  key={user.id}
                  className={`cursor-pointer hover:bg-muted/40 transition-colors ${
                    index % 2 === 0
                      ? 'border-b last:border-0'
                      : 'bg-muted/20 border-b last:border-0'
                  }`}
                  onClick={() => setEditTarget(user)}
                >
                  {/* Name */}
                  <td className="px-4 py-3 font-medium">{userName(user)}</td>

                  {/* Employee number */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.employees?.employee_number ?? '---'}
                  </td>

                  {/* Email (auth — used for login) */}
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                    {user.auth_email ?? user.employees?.email ?? '---'}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    <Badge
                      variant={user.is_blocked ? 'destructive' : 'default'}
                      className={user.is_blocked ? '' : 'bg-green-600 hover:bg-green-700'}
                    >
                      {user.is_blocked ? 'חסום' : 'פעיל'}
                    </Badge>
                  </td>

                  {/* Permissions summary */}
                  <td className="px-4 py-3 text-muted-foreground">
                    {permissionSummary(user.user_permissions)}
                  </td>

                  {/* ChemoSys modules */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {appModuleBadges(user.user_permissions).map((b) => (
                        <Badge key={b.key} variant="outline" className="text-xs font-normal">
                          {b.label}
                        </Badge>
                      ))}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {/* Permissions */}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="ניהול הרשאות"
                        onClick={() => setPermissionsTarget(user)}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>

                      {/* Block / Unblock */}
                      <Button
                        variant="ghost"
                        size="icon"
                        title={user.is_blocked ? 'בטל חסימה' : 'חסום יוזר'}
                        onClick={() => setBlockTarget(user)}
                        className={
                          user.is_blocked
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-amber-600 hover:text-amber-700'
                        }
                      >
                        {user.is_blocked ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="מחיקת יוזר"
                        onClick={() => setDeleteTarget(user)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialogs */}
      <UserForm
        open={formOpen}
        onOpenChange={setFormOpen}
        employees={employees}
        linkedEmployeeIds={linkedEmployeeIds}
        templates={templates}
      />

      {editTarget && (
        <UserEditDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          userId={editTarget.id}
          userName={userName(editTarget)}
          authEmail={editTarget.auth_email}
          currentPermissions={editTarget.user_permissions}
        />
      )}

      {permissionsTarget && (
        <UserPermissionMatrix
          open={!!permissionsTarget}
          onOpenChange={(open) => !open && setPermissionsTarget(null)}
          userId={permissionsTarget.id}
          userName={userName(permissionsTarget)}
          currentPermissions={permissionsTarget.user_permissions}
          templates={templates}
        />
      )}

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="מחיקת יוזר"
        description={`האם למחוק את יוזר "${deleteTarget ? userName(deleteTarget) : ''}"? החשבון יוסר מהרשימה וחשבון האימות יימחק לצמיתות (ניתן ליצור מחדש).`}
      />

      {/* Block / Unblock confirmation */}
      <DeleteConfirmDialog
        open={!!blockTarget}
        onOpenChange={(open) => !open && setBlockTarget(null)}
        onConfirm={handleBlock}
        loading={blocking}
        title={blockTarget?.is_blocked ? 'ביטול חסימת יוזר' : 'חסימת יוזר'}
        description={
          blockTarget?.is_blocked
            ? `האם לבטל את חסימת "${blockTarget ? userName(blockTarget) : ''}"? היוזר יוכל להתחבר מחדש.`
            : `האם לחסום את "${blockTarget ? userName(blockTarget) : ''}"? היוזר לא יוכל להתחבר למערכת.`
        }
      />

      {/* Warnings dialog — surfaces non-fatal side-effect failures */}
      <ErrorDetailDialog
        open={!!pendingWarnings}
        onOpenChange={(open) => { if (!open) setPendingWarnings(null) }}
        actionLabel={pendingWarnings?.label ?? ''}
        warnings={pendingWarnings?.warnings ?? []}
      />
    </div>
  )
}
