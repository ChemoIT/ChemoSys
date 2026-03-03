'use client'

/**
 * UserPermissionMatrix — per-user permission editor with template assignment.
 *
 * Features:
 *   - Template assignment selector at the top: choose template + "החל תבנית" button
 *   - 9-module × 3-level permission matrix (same as PermissionMatrixEditor)
 *   - Visual indicator for override permissions (is_override=true)
 *   - Save button: calls saveUserPermissions with the current matrix
 *
 * Uses native <input type="radio"> (same pattern as PermissionMatrixEditor in Plan 03-01)
 * so values write to FormData automatically.
 *
 * Uses startTransition for non-form actions (template assignment).
 *
 * Props:
 *   open               — dialog visibility
 *   onOpenChange       — toggle handler
 *   userId             — the user being edited
 *   userName           — display name for dialog title
 *   currentPermissions — array of current user_permissions rows
 *   templates          — available role templates
 */

import * as React from 'react'
import { useTransition } from 'react'
import { Loader2, Pencil, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { assignTemplate, saveUserPermissions } from '@/actions/users'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Module definitions (same as PermissionMatrixEditor)
// ---------------------------------------------------------------------------

const MODULE_KEYS = [
  'dashboard',
  'companies',
  'departments',
  'role_tags',
  'employees',
  'users',
  'templates',
  'projects',
  'settings',
] as const

type ModuleKey = (typeof MODULE_KEYS)[number]

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'דשבורד',
  companies: 'חברות',
  departments: 'מחלקות',
  role_tags: 'תגיות תפקיד',
  employees: 'עובדים',
  users: 'יוזרים',
  templates: 'תבניות הרשאות',
  projects: 'פרויקטים',
  settings: 'הגדרות',
}

const LEVELS: Array<{ value: 0 | 1 | 2; label: string }> = [
  { value: 0, label: 'אין גישה' },
  { value: 1, label: 'קריאה' },
  { value: 2, label: 'קריאה + כתיבה' },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PermissionRow = {
  module_key: string
  level: number
  is_override: boolean
  template_id: string | null
}

interface UserPermissionMatrixProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  currentPermissions: PermissionRow[]
  templates: Array<{ id: string; name: string }>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserPermissionMatrix({
  open,
  onOpenChange,
  userId,
  userName,
  currentPermissions,
  templates,
}: UserPermissionMatrixProps) {
  const [isPendingTemplate, startTemplateTransition] = useTransition()
  const [isPendingSave, startSaveTransition] = useTransition()
  const [selectedTemplateId, setSelectedTemplateId] = React.useState('')

  // Build initial levels from currentPermissions
  const initialLevels = React.useMemo(() => {
    const map: Record<ModuleKey, 0 | 1 | 2> = {} as Record<ModuleKey, 0 | 1 | 2>
    for (const key of MODULE_KEYS) {
      map[key] = 0
    }
    for (const perm of currentPermissions) {
      const key = perm.module_key as ModuleKey
      if (MODULE_KEYS.includes(key)) {
        map[key] = (perm.level === 1 || perm.level === 2 ? perm.level : 0) as 0 | 1 | 2
      }
    }
    return map
  }, [currentPermissions])

  const [levels, setLevels] = React.useState<Record<ModuleKey, 0 | 1 | 2>>(initialLevels)

  // Build override set from currentPermissions
  const overrideKeys = React.useMemo(() => {
    const set = new Set<string>()
    for (const perm of currentPermissions) {
      if (perm.is_override) set.add(perm.module_key)
    }
    return set
  }, [currentPermissions])

  // Track which keys have been changed locally (making them pending overrides)
  const [changedKeys, setChangedKeys] = React.useState<Set<string>>(new Set())

  // Reset when dialog opens with new data
  React.useEffect(() => {
    if (open) {
      setLevels(initialLevels)
      setChangedKeys(new Set())
      setSelectedTemplateId('')
    }
  }, [open, initialLevels])

  function handleLevelChange(key: ModuleKey, value: 0 | 1 | 2) {
    setLevels((prev) => ({ ...prev, [key]: value }))
    setChangedKeys((prev) => new Set(prev).add(key))
  }

  function handleApplyTemplate() {
    if (!selectedTemplateId) return
    startTemplateTransition(async () => {
      const result = await assignTemplate(userId, selectedTemplateId)
      if (result.success) {
        toast.success('תבנית הוחלה בהצלחה — טוען נתונים...')
        onOpenChange(false)
      } else {
        toast.error(result.error ?? 'שגיאה בהחלת תבנית')
      }
    })
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startSaveTransition(async () => {
      const result = await saveUserPermissions(userId, formData)
      if (result.success) {
        toast.success('הרשאות נשמרו בהצלחה')
        onOpenChange(false)
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת הרשאות')
      }
    })
  }

  const isLoading = isPendingTemplate || isPendingSave

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            הרשאות — {userName}
          </DialogTitle>
        </DialogHeader>

        {/* ----------------------------------------------------------------
            Template assignment section
          ---------------------------------------------------------------- */}
        {templates.length > 0 && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
            <select
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={isLoading}
            >
              <option value="">— בחר תבנית להחלה —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleApplyTemplate}
              disabled={!selectedTemplateId || isLoading}
            >
              {isPendingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'החל תבנית'
              )}
            </Button>
          </div>
        )}

        {/* ----------------------------------------------------------------
            Permission matrix form
          ---------------------------------------------------------------- */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto min-h-0 space-y-4">
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground w-1/4">
                    מודול
                  </th>
                  {LEVELS.map((lvl) => (
                    <th
                      key={lvl.value}
                      className="text-center px-4 py-3 font-medium text-muted-foreground"
                    >
                      {lvl.label}
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground w-10">
                    <span className="sr-only">סטטוס</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {MODULE_KEYS.map((key, index) => {
                  const isOverride = overrideKeys.has(key) || changedKeys.has(key)
                  return (
                    <tr
                      key={key}
                      className={
                        index % 2 === 0
                          ? 'bg-background border-b last:border-0'
                          : 'bg-muted/20 border-b last:border-0'
                      }
                    >
                      {/* Module label */}
                      <td className="px-4 py-3 font-medium">{MODULE_LABELS[key]}</td>

                      {/* Radio buttons — one per level */}
                      {LEVELS.map((lvl) => (
                        <td key={lvl.value} className="px-4 py-3 text-center">
                          <input
                            type="radio"
                            name={`perm_${key}`}
                            value={String(lvl.value)}
                            checked={levels[key] === lvl.value}
                            onChange={() => handleLevelChange(key, lvl.value)}
                            className="h-4 w-4 cursor-pointer accent-primary"
                            aria-label={`${MODULE_LABELS[key]} - ${lvl.label}`}
                            disabled={isLoading}
                          />
                        </td>
                      ))}

                      {/* Override indicator */}
                      <td className="px-3 py-3 text-center">
                        {isOverride && (
                          <Pencil
                            className="h-3.5 w-3.5 text-amber-500 inline"
                            aria-label="הרשאה מותאמת אישית"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Pencil className="h-3.5 w-3.5 text-amber-500" />
            <span>הרשאה מותאמת אישית (override) — עוקפת את התבנית</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <Badge variant="outline" className="text-xs font-normal">
              {currentPermissions.length} הרשאות פעילות
            </Badge>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isPendingSave ? (
                  <>
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                    שומר...
                  </>
                ) : (
                  'שמור הרשאות'
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
