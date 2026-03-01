'use client'

/**
 * DepartmentsTable — data table for Department management.
 *
 * Columns: מספר מחלקה, שם מחלקה, חברה (name), מחלקת-אב (name or "---"), פעולות
 * Search by department name.
 *
 * Props:
 *   departments — fetched with companies join: Department & { companies: { name: string } | null }
 *   companies   — for the create/edit form company dropdown
 *   allDepts    — all active departments (for parent dropdown in form)
 */

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { Company, Department } from '@/types/entities'
import { softDeleteDepartment } from '@/actions/departments'
import { DataTable } from '@/components/shared/DataTable'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { DepartmentForm } from '@/components/admin/departments/DepartmentForm'
import { Button } from '@/components/ui/button'

// Extended type: departments fetched with company join
export type DepartmentWithCompany = Department & {
  companies: { name: string } | null
}

interface DepartmentsTableProps {
  departments: DepartmentWithCompany[]
  companies: Pick<Company, 'id' | 'name'>[]
  allDepts: Pick<Department, 'id' | 'name' | 'dept_number' | 'company_id'>[]
}

export function DepartmentsTable({
  departments,
  companies,
  allDepts,
}: DepartmentsTableProps) {
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingDept, setEditingDept] = React.useState<Department | undefined>()
  const [deleteTarget, setDeleteTarget] = React.useState<DepartmentWithCompany | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Build a lookup map: id -> name for parent department resolution
  const deptNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    allDepts.forEach((d) => map.set(d.id, d.name))
    return map
  }, [allDepts])

  function openCreate() {
    setEditingDept(undefined)
    setFormOpen(true)
  }

  function openEdit(dept: DepartmentWithCompany) {
    // Pass the base Department type (without join) to the form
    setEditingDept(dept as Department)
    setFormOpen(true)
  }

  function openDelete(dept: DepartmentWithCompany) {
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

  const columns: ColumnDef<DepartmentWithCompany>[] = [
    {
      accessorKey: 'dept_number',
      header: 'מספר מחלקה',
    },
    {
      accessorKey: 'name',
      header: 'שם מחלקה',
    },
    {
      id: 'company_name',
      header: 'חברה',
      cell: ({ row }) => row.original.companies?.name ?? '---',
    },
    {
      id: 'parent_name',
      header: 'מחלקת-אב',
      cell: ({ row }) => {
        const parentId = row.original.parent_dept_id
        if (!parentId) return '---'
        return deptNameMap.get(parentId) ?? '---'
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
        companies={companies}
        departments={allDepts}
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
