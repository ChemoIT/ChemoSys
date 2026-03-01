'use client'

/**
 * DepartmentsTable — data table for Department management.
 * Columns: מספר מחלקה, שם מחלקה, הערות, פעולות
 * Search by department name.
 */

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { Department } from '@/types/entities'
import { softDeleteDepartment } from '@/actions/departments'
import { DataTable } from '@/components/shared/DataTable'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { DepartmentForm } from '@/components/admin/departments/DepartmentForm'
import { Button } from '@/components/ui/button'

interface DepartmentsTableProps {
  departments: Department[]
}

export function DepartmentsTable({ departments }: DepartmentsTableProps) {
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingDept, setEditingDept] = React.useState<Department | undefined>()
  const [deleteTarget, setDeleteTarget] = React.useState<Department | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  function openCreate() {
    setEditingDept(undefined)
    setFormOpen(true)
  }

  function openEdit(dept: Department) {
    setEditingDept(dept)
    setFormOpen(true)
  }

  function openDelete(dept: Department) {
    setDeleteTarget(dept)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await softDeleteDepartment(deleteTarget.id)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const columns: ColumnDef<Department>[] = [
    {
      accessorKey: 'dept_number',
      header: 'מספר מחלקה',
    },
    {
      accessorKey: 'name',
      header: 'שם מחלקה',
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
          הוסף מחלקה +
        </Button>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={departments}
        searchKey="name"
        searchPlaceholder="חיפוש לפי שם מחלקה..."
      />

      {/* Create / Edit form dialog */}
      <DepartmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        department={editingDept}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="מחיקת מחלקה"
        description={`האם אתה בטוח שברצונך למחוק את המחלקה "${deleteTarget?.name}"? הרשומה תוסתר מהרשימה אך לא תימחק מהמסד.`}
      />
    </div>
  )
}
