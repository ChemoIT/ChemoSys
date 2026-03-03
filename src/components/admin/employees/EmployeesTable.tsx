'use client'

/**
 * EmployeesTable — employee data table with multi-filter toolbar.
 *
 * Uses TanStack Table directly (not DataTable.tsx) because the employee table
 * needs a custom multi-filter toolbar: text search + company + department + status
 * dropdowns — DataTable only supports a single text filter.
 *
 * Features:
 *   - Click any data row to open employee edit form
 *   - Sorting on all data columns
 *   - Text search filter on name, employee number, ID, phone
 *   - Company, department, and status dropdown filters
 *   - Status Badge: active=green, suspended(notice period)=yellow, inactive=red
 *   - Role tag Badges in each row
 *   - Edit opens EmployeeForm in edit mode
 *   - Delete via DeleteConfirmDialog + softDeleteEmployee
 *   - Bulk delete with progress bar
 *   - Israeli ID padded to 9 digits in display
 *   - RTL-safe Tailwind (text-start, pe-*, ms-*)
 */

import * as React from 'react'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Pencil, Trash2, Plus, ArrowUpDown, CheckCircle2, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react'
import type { Company, Department, Employee, RoleTag } from '@/types/entities'
import { softDeleteEmployee, bulkSoftDeleteEmployees } from '@/actions/employees'
import { EmployeeForm } from './EmployeeForm'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

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
// active=green, suspended=yellow (הודעה מוקדמת), inactive=red
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">פעיל</Badge>
  }
  if (status === 'suspended') {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">הודעה מוקדמת</Badge>
  }
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">לא פעיל</Badge>
}

/**
 * formatIdNumber — pad Israeli ID to 9 digits for display.
 * Only pads purely numeric IDs shorter than 9 digits.
 */
function formatIdNumber(id: string | null | undefined): string {
  if (!id) return '—'
  if (/^\d+$/.test(id) && id.length < 9) return id.padStart(9, '0')
  return id
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
  const [formOpen,        setFormOpen]       = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithJoins | undefined>()
  const [deleteTarget,    setDeleteTarget]   = useState<EmployeeWithJoins | undefined>()
  const [deleting,        setDeleting]       = useState(false)

  // Row selection for bulk operations
  const [rowSelection,   setRowSelection]   = useState<RowSelectionState>({})
  const [bulkDeleting,   setBulkDeleting]   = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkProgress,   setBulkProgress]   = useState(0)
  const [bulkPhase,      setBulkPhase]      = useState<'confirm' | 'deleting' | 'done'>('confirm')
  const [bulkResult,     setBulkResult]     = useState(0)
  const bulkCancelledRef = React.useRef(false)
  const bulkProgressRef  = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------------------------------------------------------------------------
  // Filter state (multi-filter toolbar)
  // ---------------------------------------------------------------------------
  const [nameFilter,       setNameFilter]       = useState('')
  const [companyFilter,    setCompanyFilter]    = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter,     setStatusFilter]     = useState('all')

  // Router for refreshing data after mutations
  const router = useRouter()

  // ---------------------------------------------------------------------------
  // TanStack Table state
  // ---------------------------------------------------------------------------
  const [sorting,       setSorting]       = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [pagination,    setPagination]    = React.useState<PaginationState>({ pageIndex: 0, pageSize: 50 })

  // Unused transition kept for API compatibility
  const [, startTransition] = useTransition()
  void startTransition

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
    const result = await softDeleteEmployee(deleteTarget.id)
    if (!result.success) {
      console.error('[handleDelete] Failed:', result.error)
      alert(`שגיאה במחיקה: ${result.error}`)
    }
    setDeleting(false)
    setDeleteTarget(undefined)
    router.refresh()
  }

  // Open bulk delete dialog — reset state
  function openBulkDelete() {
    setBulkPhase('confirm')
    setBulkProgress(0)
    setBulkResult(0)
    bulkCancelledRef.current = false
    setShowBulkDelete(true)
  }

  // Bulk delete — single batch query via server action
  async function handleBulkDelete() {
    const selectedRows = table.getSelectedRowModel().rows
    if (selectedRows.length === 0) return

    setBulkPhase('deleting')
    setBulkDeleting(true)
    setBulkProgress(0)

    const estimatedMs = Math.max(selectedRows.length * 3, 500)
    const steps = 30
    const intervalMs = estimatedMs / steps
    let current = 0
    bulkProgressRef.current = setInterval(() => {
      current += 90 / steps
      if (current >= 90) {
        current = 90
        if (bulkProgressRef.current) clearInterval(bulkProgressRef.current)
      }
      setBulkProgress(Math.round(current))
    }, intervalMs)

    const ids = selectedRows.map((r) => r.original.id)
    const result = await bulkSoftDeleteEmployees(ids)

    if (bulkProgressRef.current) clearInterval(bulkProgressRef.current)
    setBulkProgress(100)
    setBulkDeleting(false)

    if (bulkCancelledRef.current) return

    if (!result.success) {
      console.error('[handleBulkDelete] Failed:', result.error)
      setBulkDeleting(false)
      setShowBulkDelete(false)
      alert(`שגיאה במחיקה: ${result.error}`)
      router.refresh()
      return
    }

    setBulkResult(result.deleted)
    setBulkPhase('done')
    setRowSelection({})

    setTimeout(() => {
      setShowBulkDelete(false)
      router.refresh()
    }, 1500)
  }

  function handleBulkCancel() {
    bulkCancelledRef.current = true
    if (bulkProgressRef.current) clearInterval(bulkProgressRef.current)
    setBulkDeleting(false)
    setShowBulkDelete(false)
  }

  const selectedCount = Object.keys(rowSelection).length

  // ---------------------------------------------------------------------------
  // Filtered data — MUST be memoized to prevent useReactTable re-render loop
  // ---------------------------------------------------------------------------
  const filteredData = useMemo(() => employees.filter((emp) => {
    if (nameFilter) {
      const q = nameFilter.toLowerCase()
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
      const empNum = (emp.employee_number ?? '').toLowerCase()
      const idNum = (emp.id_number ?? '').toLowerCase()
      const phone = (emp.mobile_phone ?? '').toLowerCase()
      if (!fullName.includes(q) && !empNum.includes(q) && !idNum.includes(q) && !phone.includes(q)) return false
    }
    if (companyFilter !== 'all' && emp.company_id !== companyFilter) return false
    if (departmentFilter !== 'all' && emp.department_id !== departmentFilter) return false
    if (statusFilter !== 'all' && emp.status !== statusFilter) return false
    return true
  }), [employees, nameFilter, companyFilter, departmentFilter, statusFilter])

  // ---------------------------------------------------------------------------
  // Department options — departments are global (not per-company), show all
  // ---------------------------------------------------------------------------
  const departmentOptions = departments

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------
  const columns: ColumnDef<EmployeeWithJoins>[] = [
    {
      id: 'select',
      header: ({ table: t }) => (
        <Checkbox
          checked={t.getIsAllPageRowsSelected() || (t.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(value) => t.toggleAllPageRowsSelected(!!value)}
          aria-label="בחר הכל"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="בחר שורה"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
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
      id: 'id_number',
      accessorKey: 'id_number',
      header: 'ת.ז.',
      cell: ({ row }) => (
        <span dir="ltr" className="font-mono text-sm">
          {formatIdNumber(row.original.id_number)}
        </span>
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
              onClick={(e) => { e.stopPropagation(); openEdit(emp) }}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="מחיקה"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(emp) }}
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
  const coreRowModel       = useMemo(() => getCoreRowModel(), [])
  const sortedRowModel     = useMemo(() => getSortedRowModel(), [])
  const filteredRowModel   = useMemo(() => getFilteredRowModel(), [])
  const paginationRowModel = useMemo(() => getPaginationRowModel(), [])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: coreRowModel,
    getSortedRowModel: sortedRowModel,
    getFilteredRowModel: filteredRowModel,
    getPaginationRowModel: paginationRowModel,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    enableRowSelection: true,
    state: { sorting, columnFilters, rowSelection, pagination },
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Top bar — add button + bulk actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={openCreate} size="sm">
          <Plus className="me-2 h-4 w-4" />
          הוספת עובד
        </Button>

        {selectedCount > 0 && (
          <>
            <div className="h-6 w-px bg-border" />
            <span className="text-sm font-medium text-brand-dark">
              {selectedCount} נבחרו
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={openBulkDelete}
            >
              <Trash2 className="me-2 h-4 w-4" />
              מחק נבחרים
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline cursor-pointer"
              onClick={() => setRowSelection({})}
            >
              בטל בחירה
            </button>
          </>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="חיפוש לפי שם, מס' עובד, ת.ז., טלפון..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="max-w-xs"
        />

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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="כל הסטטוסים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="suspended">הודעה מוקדמת</SelectItem>
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openEdit(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      // Prevent row click when interacting with checkbox or action buttons
                      onClick={
                        cell.column.id === 'select' || cell.column.id === 'actions'
                          ? (e: React.MouseEvent) => e.stopPropagation()
                          : undefined
                      }
                    >
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

      {/* Pagination controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            עמוד {table.getState().pagination.pageIndex + 1} מתוך{' '}
            {table.getPageCount()} ({filteredData.length} רשומות)
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">שורות בעמוד:</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(v) => { setPagination({ pageIndex: 0, pageSize: Number(v) }) }}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()} title="עמוד ראשון">
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} title="הקודם">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} title="הבא">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()} title="עמוד אחרון">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* EmployeeForm dialog — only mount when open */}
      {formOpen && (
        <EmployeeForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={() => router.refresh()}
          employee={editingEmployee}
          companies={companies}
          departments={departments}
          roleTags={roleTags}
        />
      )}

      {/* Delete confirmation dialog — single */}
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

      {/* Bulk delete dialog with progress bar */}
      <Dialog open={showBulkDelete} onOpenChange={(open) => { if (!open && !bulkDeleting) setShowBulkDelete(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>מחיקת עובדים</DialogTitle>
            <DialogDescription>
              {bulkPhase === 'confirm'  && `האם למחוק ${selectedCount} עובדים? פעולה זו ניתנת לשחזור.`}
              {bulkPhase === 'deleting' && `מוחק ${selectedCount} עובדים...`}
              {bulkPhase === 'done'     && `${bulkResult} עובדים נמחקו בהצלחה.`}
            </DialogDescription>
          </DialogHeader>

          {(bulkPhase === 'deleting' || bulkPhase === 'done') && (
            <div className="space-y-2">
              <Progress value={bulkProgress} className="h-3" />
              <p className="text-sm text-muted-foreground text-center">
                {bulkPhase === 'deleting' && `${bulkProgress}%`}
                {bulkPhase === 'done' && (
                  <span className="flex items-center justify-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    הושלם
                  </span>
                )}
              </p>
            </div>
          )}

          <DialogFooter className="flex gap-2 justify-end">
            {bulkPhase === 'confirm' && (
              <>
                <Button variant="outline" onClick={() => setShowBulkDelete(false)}>ביטול</Button>
                <Button variant="destructive" onClick={handleBulkDelete}>מחק</Button>
              </>
            )}
            {bulkPhase === 'deleting' && (
              <Button variant="outline" onClick={handleBulkCancel}>ביטול מחיקה</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
