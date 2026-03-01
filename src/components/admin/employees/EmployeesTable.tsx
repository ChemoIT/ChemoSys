'use client'

/**
 * EmployeesTable — employee data table with multi-filter toolbar.
 *
 * Uses TanStack Table directly (not DataTable.tsx) because the employee table
 * needs a custom multi-filter toolbar: text search + company + department + status
 * dropdowns — DataTable only supports a single text filter.
 *
 * Features:
 *   - Sorting on all data columns
 *   - Text search filter on employee name
 *   - Company, department, and status dropdown filters
 *   - Status Badge: active=green, suspended=yellow, inactive=gray
 *   - Role tag Badges in each row
 *   - Edit opens EmployeeForm in edit mode
 *   - Suspend via suspendEmployee action with inline confirmation
 *   - Delete via DeleteConfirmDialog + softDeleteEmployee
 *   - RTL-safe Tailwind (text-start, pe-*, ms-*)
 */

import * as React from 'react'
import { useState, useTransition } from 'react'
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Pencil, Trash2, Ban, Plus, ArrowUpDown } from 'lucide-react'
import type { Company, Department, Employee, RoleTag } from '@/types/entities'
import { softDeleteEmployee, suspendEmployee } from '@/actions/employees'
import { EmployeeForm } from './EmployeeForm'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmployeeWithJoins = Employee & {
  companies?: { name: string } | null
  departments?: { name: string } | null
  sub_departments?: { name: string } | null
  employee_role_tags?: { role_tags: { name: string } | null }[]
  role_tags?: { role_tag_id: string }[]
}

interface EmployeesTableProps {
  employees: EmployeeWithJoins[]
  companies: Company[]
  departments: Department[]
  roleTags: RoleTag[]
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">פעיל</Badge>
  }
  if (status === 'suspended') {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">מושהה</Badge>
  }
  return <Badge variant="secondary">לא פעיל</Badge>
}

// ---------------------------------------------------------------------------
// EmployeesTable
// ---------------------------------------------------------------------------

export function EmployeesTable({
  employees,
  companies,
  departments,
  roleTags,
}: EmployeesTableProps) {
  // ---------------------------------------------------------------------------
  // Dialog state
  // ---------------------------------------------------------------------------
  const [formOpen,       setFormOpen]       = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithJoins | undefined>()
  const [deleteTarget,   setDeleteTarget]   = useState<EmployeeWithJoins | undefined>()
  const [deleting,       setDeleting]       = useState(false)

  // ---------------------------------------------------------------------------
  // Filter state (multi-filter toolbar)
  // ---------------------------------------------------------------------------
  const [nameFilter,       setNameFilter]       = useState('')
  const [companyFilter,    setCompanyFilter]    = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter,     setStatusFilter]     = useState('all')

  // Suspend
  const [, startSuspendTransition] = useTransition()

  // ---------------------------------------------------------------------------
  // TanStack Table state
  // ---------------------------------------------------------------------------
  const [sorting,       setSorting]       = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function openCreate() {
    setEditingEmployee(undefined)
    setFormOpen(true)
  }

  function openEdit(emp: EmployeeWithJoins) {
    setEditingEmployee(emp)
    setFormOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await softDeleteEmployee(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(undefined)
  }

  function handleSuspend(emp: EmployeeWithJoins) {
    startSuspendTransition(async () => {
      await suspendEmployee(emp.id)
    })
  }

  // ---------------------------------------------------------------------------
  // Filtered data (applied before TanStack table)
  // ---------------------------------------------------------------------------
  const filteredData = employees.filter((emp) => {
    // Name filter
    if (nameFilter) {
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
      if (!fullName.includes(nameFilter.toLowerCase())) return false
    }
    // Company filter
    if (companyFilter !== 'all' && emp.company_id !== companyFilter) return false
    // Department filter
    if (departmentFilter !== 'all' && emp.department_id !== departmentFilter) return false
    // Status filter
    if (statusFilter !== 'all' && emp.status !== statusFilter) return false
    return true
  })

  // ---------------------------------------------------------------------------
  // Department options scoped to company filter
  // ---------------------------------------------------------------------------
  const departmentOptions =
    companyFilter === 'all'
      ? departments
      : departments.filter((d) => d.company_id === companyFilter)

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------
  const columns: ColumnDef<EmployeeWithJoins>[] = [
    {
      id: 'employee_number',
      accessorKey: 'employee_number',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ms-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          מספר עובד
          <ArrowUpDown className="ms-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      id: 'full_name',
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ms-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          שם מלא
          <ArrowUpDown className="ms-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      id: 'company',
      accessorFn: (row) => row.companies?.name ?? '—',
      header: 'חברה',
    },
    {
      id: 'department',
      accessorFn: (row) => row.departments?.name ?? '—',
      header: 'מחלקה',
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'סטטוס',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'role_tags',
      header: 'תגיות',
      cell: ({ row }) => {
        const tags = row.original.employee_role_tags ?? []
        if (tags.length === 0) return <span className="text-muted-foreground text-sm">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((t, i) =>
              t.role_tags ? (
                <Badge key={i} variant="outline" className="text-xs">
                  {t.role_tags.name}
                </Badge>
              ) : null
            )}
          </div>
        )
      },
    },
    {
      id: 'mobile_phone',
      accessorKey: 'mobile_phone',
      header: 'טלפון',
      cell: ({ row }) => row.original.mobile_phone ?? '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const emp = row.original
        return (
          <div className="flex items-center gap-1 justify-end">
            {/* Edit */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="עריכה"
              onClick={() => openEdit(emp)}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            {/* Suspend — only if not already suspended */}
            {emp.status !== 'suspended' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-yellow-600 hover:text-yellow-700"
                title="השהיה"
                onClick={() => handleSuspend(emp)}
              >
                <Ban className="h-4 w-4" />
              </Button>
            )}

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="מחיקה"
              onClick={() => setDeleteTarget(emp)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  // ---------------------------------------------------------------------------
  // Table instance
  // ---------------------------------------------------------------------------
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Top bar — add button + filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Add employee button */}
        <Button onClick={openCreate} size="sm">
          <Plus className="me-2 h-4 w-4" />
          הוספת עובד
        </Button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Text search */}
        <Input
          placeholder="חיפוש לפי שם..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="max-w-xs"
        />

        {/* Company filter */}
        <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setDepartmentFilter('all') }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="כל החברות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל החברות</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Department filter — scoped to company */}
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="כל המחלקות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המחלקות</SelectItem>
            {departmentOptions.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="כל הסטטוסים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="suspended">מושהה</SelectItem>
            <SelectItem value="inactive">לא פעיל</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  לא נמצאו עובדים
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* EmployeeForm dialog */}
      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingEmployee}
        companies={companies}
        departments={departments}
        roleTags={roleTags}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(undefined) }}
        onConfirm={handleDelete}
        loading={deleting}
        title="מחיקת עובד"
        description={
          deleteTarget
            ? `האם למחוק את ${deleteTarget.first_name} ${deleteTarget.last_name}? פעולה זו ניתנת לשחזור.`
            : undefined
        }
      />
    </div>
  )
}
