'use client'

/**
 * TemplatesTable — data table for Role Template management.
 *
 * Wraps the reusable DataTable component with template-specific columns.
 * Shows a compact permission summary (count of modules with access).
 * Handles edit (opens TemplateForm) and soft-delete (opens DeleteConfirmDialog).
 *
 * Props:
 *   templates — fetched server-side (active only, with template_permissions join)
 */

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { RoleTemplate, TemplatePermission } from '@/types/entities'
import { softDeleteTemplate } from '@/actions/templates'
import { DataTable } from '@/components/shared/DataTable'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { TemplateForm } from '@/components/admin/templates/TemplateForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateWithPermissions = RoleTemplate & {
  template_permissions?: Pick<TemplatePermission, 'module_key' | 'level'>[]
}

interface TemplatesTableProps {
  templates: TemplateWithPermissions[]
}

// ---------------------------------------------------------------------------
// Level labels for permission summary badges
// ---------------------------------------------------------------------------
const LEVEL_LABELS: Record<number, string> = {
  1: 'קריאה',
  2: 'ק+כ',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplatesTable({ templates }: TemplatesTableProps) {
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<
    TemplateWithPermissions | undefined
  >()
  const [deleteTarget, setDeleteTarget] = React.useState<TemplateWithPermissions | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  function openCreate() {
    setEditingTemplate(undefined)
    setFormOpen(true)
  }

  function openEdit(template: TemplateWithPermissions) {
    setEditingTemplate(template)
    setFormOpen(true)
  }

  function openDelete(template: TemplateWithPermissions) {
    setDeleteTarget(template)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await softDeleteTemplate(deleteTarget.id)
      if (!result.success) {
        toast.error(result.error ?? 'שגיאה במחיקת התבנית')
      } else {
        toast.success(`התבנית "${deleteTarget.name}" נמחקה`)
      }
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const columns: ColumnDef<TemplateWithPermissions>[] = [
    {
      accessorKey: 'name',
      header: 'שם תבנית',
    },
    {
      accessorKey: 'description',
      header: 'תיאור',
      cell: ({ row }) => {
        const desc = row.original.description
        if (!desc) return <span className="text-muted-foreground">---</span>
        if (desc.length > 60) return `${desc.slice(0, 60)}...`
        return desc
      },
    },
    {
      id: 'permissions',
      header: 'הרשאות',
      cell: ({ row }) => {
        const perms = row.original.template_permissions ?? []
        const active = perms.filter((p) => p.level > 0)
        if (active.length === 0) {
          return <span className="text-muted-foreground text-sm">אין הרשאות</span>
        }
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {active.length} מודולים
            </span>
            {active.slice(0, 3).map((p) => (
              <Badge key={p.module_key} variant="secondary" className="text-xs">
                {LEVEL_LABELS[p.level] ?? p.level}
              </Badge>
            ))}
            {active.length > 3 && (
              <span className="text-xs text-muted-foreground">+{active.length - 3}</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'פעולות',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            title="עריכה"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDelete(row.original)}
            title="מחיקה"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-start">
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" />
          הוסף תבנית +
        </Button>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={templates}
        searchKey="name"
        searchPlaceholder="חיפוש לפי שם תבנית..."
        onRowClick={openEdit}
      />

      {/* Create / Edit form dialog — key forces remount on each open to reset useActionState */}
      <TemplateForm
        key={editingTemplate?.id ?? 'new'}
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editingTemplate}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="מחיקת תבנית הרשאות"
        description={`האם אתה בטוח שברצונך למחוק את התבנית "${deleteTarget?.name}"? הרשומה תוסתר מהרשימה אך לא תימחק מהמסד.`}
      />
    </div>
  )
}
