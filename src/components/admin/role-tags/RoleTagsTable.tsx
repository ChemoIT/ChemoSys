'use client'

/**
 * RoleTagsTable — data table for Role Tag management.
 *
 * Columns: שם תגית, תיאור, פעולות
 * Search by tag name.
 *
 * Props:
 *   roleTags — fetched server-side (active only)
 */

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { RoleTag } from '@/types/entities'
import { softDeleteRoleTag } from '@/actions/role-tags'
import { DataTable } from '@/components/shared/DataTable'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { RoleTagForm } from '@/components/admin/role-tags/RoleTagForm'
import { Button } from '@/components/ui/button'

interface RoleTagsTableProps {
  roleTags: RoleTag[]
}

export function RoleTagsTable({ roleTags }: RoleTagsTableProps) {
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingTag, setEditingTag] = React.useState<RoleTag | undefined>()
  const [deleteTarget, setDeleteTarget] = React.useState<RoleTag | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  function openCreate() {
    setEditingTag(undefined)
    setFormOpen(true)
  }

  function openEdit(tag: RoleTag) {
    setEditingTag(tag)
    setFormOpen(true)
  }

  function openDelete(tag: RoleTag) {
    setDeleteTarget(tag)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await softDeleteRoleTag(deleteTarget.id)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const columns: ColumnDef<RoleTag>[] = [
    {
      accessorKey: 'name',
      header: 'שם תגית',
    },
    {
      accessorKey: 'description',
      header: 'תיאור',
      cell: ({ row }) => row.original.description ?? '---',
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
          הוסף תגית +
        </Button>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={roleTags}
        searchKey="name"
        searchPlaceholder="חיפוש לפי שם תגית..."
        onRowClick={openEdit}
      />

      {/* Create / Edit form dialog */}
      <RoleTagForm
        open={formOpen}
        onOpenChange={setFormOpen}
        roleTag={editingTag}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="מחיקת תגית תפקיד"
        description={`האם אתה בטוח שברצונך למחוק את התגית "${deleteTarget?.name}"? הרשומה תוסתר מהרשימה אך לא תימחק מהמסד.`}
      />
    </div>
  )
}
