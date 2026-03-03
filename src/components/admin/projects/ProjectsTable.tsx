'use client'

/**
 * ProjectsTable — data table for Project management.
 *
 * Uses TanStack Table directly (not DataTable.tsx) because it needs a custom
 * toolbar with status filter + text search — DataTable only supports a single
 * text filter.
 *
 * Features:
 *   - Status filter toolbar: כל הסטטוסים / פעיל / לא פעיל
 *   - Text search: filters by name or project_number
 *   - Click any data row → opens ProjectForm in edit mode
 *   - Edit button → opens ProjectForm in edit mode
 *   - Delete button → opens DeleteConfirmDialog → calls softDeleteProject RPC
 *   - Create button → opens ProjectForm in create mode
 *   - Pagination with Hebrew labels
 *   - RTL-safe Tailwind (text-start, pe-*, ms-*)
 *
 * Props:
 *   projects  — fetched server-side with pm/sm/cvc employee joins
 *   employees — active employees for ProjectForm selectors
 */

import * as React from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  type ColumnDef,
  type SortingState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type FilterFn,
} from '@tanstack/react-table'
import { Pencil, Trash2, Plus, ArrowUpDown, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react'
import type { Project } from '@/types/entities'
import { softDeleteProject } from '@/actions/projects'
import { ProjectForm, type ProjectWithManagers } from '@/components/admin/projects/ProjectForm'
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

/** Project row extended with employee join data */
type ProjectWithJoins = Project & {
  pm?: { id: string; first_name: string; last_name: string; employee_number: string } | null
  sm?: { id: string; first_name: string; last_name: string; employee_number: string } | null
  cvc?: { id: string; first_name: string; last_name: string; employee_number: string } | null
}

type EmployeeOption = {
  id: string
  first_name: string
  last_name: string
  employee_number: string
  email: string | null
  id_number: string | null
  companies: { name: string } | null
}

interface ProjectsTableProps {
  projects: ProjectWithJoins[]
  employees: EmployeeOption[]
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">פעיל</Badge>
  }
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">לא פעיל</Badge>
}

// ---------------------------------------------------------------------------
// Project type label helper
// ---------------------------------------------------------------------------

function projectTypeLabel(type: string | null | undefined): string {
  if (type === 'project') return 'פרויקט'
  if (type === 'staging_area') return 'שטח התארגנות'
  if (type === 'storage_area') return 'שטח אחסנה'
  return '---'
}

// ---------------------------------------------------------------------------
// Convert ProjectWithJoins → ProjectWithManagers for ProjectForm
// The form expects project_manager / site_manager / camp_vehicle_coordinator
// but the page query uses pm / sm / cvc aliases.
// ---------------------------------------------------------------------------

function toProjectWithManagers(project: ProjectWithJoins): ProjectWithManagers {
  return {
    ...project,
    project_manager: (project.pm as unknown as { id: string; first_name: string; last_name: string; employee_number: string } | null) ?? null,
    site_manager: (project.sm as unknown as { id: string; first_name: string; last_name: string; employee_number: string } | null) ?? null,
    camp_vehicle_coordinator: (project.cvc as unknown as { id: string; first_name: string; last_name: string; employee_number: string } | null) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Custom global filter — searches name and project_number
// ---------------------------------------------------------------------------

const projectSearchFilter: FilterFn<ProjectWithJoins> = (row, _columnId, filterValue: string) => {
  const q = filterValue.toLowerCase()
  const name = (row.original.name ?? '').toLowerCase()
  const num = (row.original.project_number ?? '').toLowerCase()
  return name.includes(q) || num.includes(q)
}

// ---------------------------------------------------------------------------
// ProjectsTable
// ---------------------------------------------------------------------------

export function ProjectsTable({ projects, employees }: ProjectsTableProps) {
  const router = useRouter()

  // ---------------------------------------------------------------------------
  // Dialog state
  // ---------------------------------------------------------------------------
  const [formOpen, setFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectWithManagers | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithJoins | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ---------------------------------------------------------------------------
  // Filter state
  // ---------------------------------------------------------------------------
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [globalFilter, setGlobalFilter] = useState('')

  // ---------------------------------------------------------------------------
  // TanStack Table state
  // ---------------------------------------------------------------------------
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 })

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function openCreate() {
    setEditingProject(undefined)
    setFormOpen(true)
  }

  function openEdit(project: ProjectWithJoins) {
    setEditingProject(toProjectWithManagers(project))
    setFormOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await softDeleteProject(deleteTarget.id)
      if (!result.success) {
        console.error('[ProjectsTable] handleDelete failed:', result.error)
        alert(`שגיאה במחיקה: ${result.error}`)
      }
      router.refresh()
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Filtered data — status filter applied before TanStack (same pattern as EmployeesTable)
  // globalFilter handled by TanStack's built-in filter
  // ---------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    if (statusFilter === 'all') return projects
    return projects.filter((p) => p.status === statusFilter)
  }, [projects, statusFilter])

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------
  const columns: ColumnDef<ProjectWithJoins>[] = [
    {
      id: 'project_number',
      accessorKey: 'project_number',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ms-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          מספר
          <ArrowUpDown className="ms-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span dir="ltr" className="font-mono text-sm">
          {row.original.project_number ?? '---'}
        </span>
      ),
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ms-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          שם פרויקט
          <ArrowUpDown className="ms-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      id: 'project_type',
      accessorKey: 'project_type',
      header: 'סוג',
      cell: ({ row }) => projectTypeLabel(row.original.project_type),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'סטטוס',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'pm',
      header: 'מנהל פרויקט',
      cell: ({ row }) => {
        const pm = row.original.pm as { first_name: string; last_name: string } | null | undefined
        if (!pm) return <span className="text-muted-foreground">---</span>
        return `${pm.first_name} ${pm.last_name}`
      },
    },
    {
      id: 'sm',
      header: 'מנהל עבודה',
      cell: ({ row }) => {
        const sm = row.original.sm as { first_name: string; last_name: string } | null | undefined
        if (!sm) return <span className="text-muted-foreground">---</span>
        return `${sm.first_name} ${sm.last_name}`
      },
    },
    {
      id: 'client',
      accessorKey: 'client',
      header: 'מזמין',
      cell: ({ row }) => row.original.client ?? <span className="text-muted-foreground">---</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const project = row.original
        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="עריכה"
              onClick={(e) => { e.stopPropagation(); openEdit(project) }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="מחיקה"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(project) }}
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
    globalFilterFn: projectSearchFilter,
    getCoreRowModel: coreRowModel,
    getSortedRowModel: sortedRowModel,
    getFilteredRowModel: filteredRowModel,
    getPaginationRowModel: paginationRowModel,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    state: { sorting, globalFilter, pagination },
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">

      {/* Toolbar — search + status filter + add button */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Text search */}
        <Input
          placeholder="חיפוש לפי שם או מספר פרויקט..."
          value={globalFilter}
          onChange={(e) => {
            setGlobalFilter(e.target.value)
            setPagination((p) => ({ ...p, pageIndex: 0 }))
          }}
          className="max-w-xs"
        />

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as 'all' | 'active' | 'inactive')
            setPagination((p) => ({ ...p, pageIndex: 0 }))
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="inactive">לא פעיל</SelectItem>
          </SelectContent>
        </Select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add button */}
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" />
          פרויקט חדש +
        </Button>
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
                      onClick={
                        cell.column.id === 'actions'
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
                  לא נמצאו פרויקטים
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          עמוד {table.getState().pagination.pageIndex + 1} מתוך{' '}
          {Math.max(table.getPageCount(), 1)} ({table.getFilteredRowModel().rows.length} רשומות)
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
            title="עמוד ראשון"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            title="הקודם"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            title="הבא"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
            title="עמוד אחרון"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create / Edit form dialog */}
      {formOpen && (
        <ProjectForm
          open={formOpen}
          onOpenChange={setFormOpen}
          project={editingProject}
          employees={employees}
        />
      )}

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onConfirm={handleDelete}
        loading={deleting}
        title="מחיקת פרויקט"
        description={
          deleteTarget
            ? `האם אתה בטוח שברצונך למחוק את הפרויקט "${deleteTarget.name}"? הרשומה תוסתר מהרשימה אך לא תימחק מהמסד.`
            : undefined
        }
      />
    </div>
  )
}
