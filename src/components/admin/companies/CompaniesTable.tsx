'use client'

/**
 * CompaniesTable — data table for Company management.
 *
 * Wraps the reusable DataTable component with company-specific columns.
 * Handles edit (opens CompanyForm) and soft-delete (opens DeleteConfirmDialog).
 *
 * Props:
 *   companies — fetched server-side (active only, no deleted_at)
 */

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type { Company } from '@/types/entities'
import { softDeleteCompany } from '@/actions/companies'
import { DataTable } from '@/components/shared/DataTable'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { CompanyForm } from '@/components/admin/companies/CompanyForm'
import { Button } from '@/components/ui/button'

interface CompaniesTableProps {
  companies: Company[]
}

export function CompaniesTable({ companies }: CompaniesTableProps) {
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingCompany, setEditingCompany] = React.useState<Company | undefined>()
  const [deleteTarget, setDeleteTarget] = React.useState<Company | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  function openCreate() {
    setEditingCompany(undefined)
    setFormOpen(true)
  }

  function openEdit(company: Company) {
    setEditingCompany(company)
    setFormOpen(true)
  }

  function openDelete(company: Company) {
    setDeleteTarget(company)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await softDeleteCompany(deleteTarget.id)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const columns: ColumnDef<Company>[] = [
    {
      accessorKey: 'name',
      header: 'שם חברה',
    },
    {
      accessorKey: 'internal_number',
      header: 'מספר פנימי',
    },
    {
      accessorKey: 'company_reg_number',
      header: 'ח.פ.',
      cell: ({ row }) => row.original.company_reg_number ?? '---',
    },
    {
      accessorKey: 'contact_name',
      header: 'אחראי',
      cell: ({ row }) => row.original.contact_name ?? '---',
    },
    {
      accessorKey: 'contact_email',
      header: 'מייל',
      cell: ({ row }) => row.original.contact_email ?? '---',
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
          הוסף חברה +
        </Button>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={companies}
        searchKey="name"
        searchPlaceholder="חיפוש לפי שם חברה..."
      />

      {/* Create / Edit form dialog */}
      <CompanyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        company={editingCompany}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="מחיקת חברה"
        description={`האם אתה בטוח שברצונך למחוק את החברה "${deleteTarget?.name}"? הרשומה תוסתר מהרשימה אך לא תימחק מהמסד.`}
      />
    </div>
  )
}
