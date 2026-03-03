'use client'

/**
 * ProjectsTable — project data table with filter toolbar.
 *
 * Uses TanStack Table directly (not DataTable.tsx) because the projects table
 * needs a custom filter toolbar: text search + status filter — DataTable only
 * supports a single text filter.
 *
 * Features:
 *   - Text search filter on project name, project_number, client_name
 *   - 3-state status filter: active / view_only / inactive (plus 'all')
 *   - Active count badge computed from FULL projects list (not filtered)
 *   - Sorting on all data columns
 *   - Status Badge: green=פעיל, yellow=לצפייה בלבד, gray=לא פעיל
 *   - Project type label: פרויקט / שטח התארגנות / שטח אחסנה
 *   - PM / SM employee name from joined data
 *   - Edit opens ProjectForm in edit mode
 *   - Delete via DeleteConfirmDialog + softDeleteProject
 *   - Export to Excel and CSV via /api/export route
 *   - RTL-safe Tailwind (text-start, pe-*, ms-*)
 */

import * as React from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Pencil, Trash2, Plus, ArrowUpDown, FileSpreadsheet, FileText } from 'lucide-react'
import type { Project, Employee } from '@/types/entities'
import { softDeleteProject } from '@/actions/projects'
import { ProjectForm } from './ProjectForm'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Project row with joined employee names from the server component. */
type ProjectWithJoins = Project & {
  project_manager?: { first_name: string; last_name: string } | null
  site_manager?: { first_name: string; last_name: string } | null
}

/** Minimal employee info needed for ProjectForm dropdowns. */
type EmployeeOption = Pick<Employee, 'id' | 'first_name' | 'last_name' | 'email' | 'mobile_phone'>

interface ProjectsTableProps {
  /** All projects (not pre-filtered — table does its own filtering in JS). */
  projects: ProjectWithJoins[]
  /** Active employees for ProjectForm selectors. */
  employees: EmployeeOption[]
  /** Map of project_id → attendance clocks. Used when opening ProjectForm in edit mode. */
  clocks: Record<string, Array<{ clock_id: string }>>
}

// ---------------------------------------------------------------------------
// Status badge helper
// active=green, view_only=yellow, inactive=gray
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">פעיל</Badge>
  }
  if (status === 'view_only') {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">לצפייה בלבד</Badge>
  }
  return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">לא פעיל</Badge>
}

// ---------------------------------------------------------------------------
// Project type label helper
// ---------------------------------------------------------------------------

function ProjectTypeLabel({ type }: { type: string | null }) {
  if (type === 'project') return <span>פרויקט</span>
  if (type === 'staging_area') return <span>שטח התארגנות</span>
  if (type === 'storage_area') return <span>שטח אחסנה</span>
  return <span className="text-muted-foreground">—</span>
}

// ---------------------------------------------------------------------------
// ProjectsTable
// ---------------------------------------------------------------------------

export function ProjectsTable({ projects, employees, clocks }: ProjectsTableProps) {
  // ---------------------------------------------------------------------------
  // Dialog state
  // ---------------------------------------------------------------------------
  const [formOpen,       setFormOpen]      = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectWithJoins | undefined>()
  const [deleteTarget,   setDeleteTarget]  = useState<ProjectWithJoins | undefined>()
  const [deleting,       setDeleting]      = useState(false)

  // ---------------------------------------------------------------------------
  // Filter state
  // ---------------------------------------------------------------------------
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'view_only' | 'inactive'>('all')
  const [searchText,   setSearchText]   = useState('')

  // ---------------------------------------------------------------------------
  // TanStack Table state
  // ---------------------------------------------------------------------------
  const [sorting, setSorting] = React.useState<SortingState>([])

  const router = useRouter()

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function openCreate() {
    setEditingProject(undefined)
    setFormOpen(true)
  }

  function openEdit(project: ProjectWithJoins) {
    setEditingProject(project)
    setFormOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await softDeleteProject(deleteTarget.id)
    if (!result.success) {
      console.error('[handleDelete] Failed:', result.error)
      alert(`שגיאה במחיקה: ${result.error}`)
    }
    setDeleting(false)
    setDeleteTarget(undefined)
    router.refresh()
  }

  // ---------------------------------------------------------------------------
  // Active count — computed from FULL projects list, not filtered view
  // ---------------------------------------------------------------------------
  const activeCount = useMemo(
    () => projects.filter((p) => p.status === 'active').length,
    [projects]
  )

  // ---------------------------------------------------------------------------
  // Filtered data — memoized to prevent useReactTable re-render loop
  // ---------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    return projects.filter((p) => {
      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      // Text search — project name, project_number, client_name
      if (searchText) {
        const q = searchText.toLowerCase()
        const name = p.name.toLowerCase()
        const num = (p.project_number ?? '').toLowerCase()
        const client = (p.client_name ?? '').toLowerCase()
        if (!name.includes(q) && !num.includes(q) && !client.includes(q)) return false
      }
      return true
    })
  }, [projects, statusFilter, searchText])

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------
  const columns: ColumnDef<ProjectWithJoins>[] = [
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
      id: 'project_number',
      accessorKey: 'project_number',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ms-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          מספר פרויקט
          <ArrowUpDown className="ms-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span dir="ltr" className="font-mono text-sm">
          {row.original.project_number || '—'}
        </span>
      ),
    },
    {
      id: 'project_type',
      accessorKey: 'project_type',
      header: 'סיווג',
      cell: ({ row }) => <ProjectTypeLabel type={row.original.project_type} />,
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'סטטוס',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'project_manager',
      accessorFn: (row) =>
        row.project_manager
          ? `${row.project_manager.first_name} ${row.project_manager.last_name}`
          : '—',
      header: 'מנהל פרויקט',
    },
    {
      id: 'site_manager',
      accessorFn: (row) =>
        row.site_manager
          ? `${row.site_manager.first_name} ${row.site_manager.last_name}`
          : '—',
      header: 'מנהל עבודה',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const project = row.original
        return (
          <div className="flex items-center gap-1 justify-end">
            {/* Edit */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="עריכה"
              aria-label="עריכת פרויקט"
              onClick={(e) => { e.stopPropagation(); openEdit(project) }}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="מחיקה"
              aria-label="מחיקת פרויקט"
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
  // Table instance — sorting only (filtering done in JS above)
  // ---------------------------------------------------------------------------
  const coreRowModel   = useMemo(() => getCoreRowModel(), [])
  const sortedRowModel = useMemo(() => getSortedRowModel(), [])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: coreRowModel,
    getSortedRowModel: sortedRowModel,
    onSortingChange: setSorting,
    state: { sorting },
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">

      {/* Top bar — add button + export dropdown */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={openCreate} size="sm">
          <Plus className="me-2 h-4 w-4" />
          פרויקט חדש
        </Button>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="me-2 h-4 w-4" />
              ייצוא
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => { window.location.href = '/api/export?table=projects&format=xlsx' }}
            >
              <FileSpreadsheet className="me-2 h-4 w-4" />
              ייצוא Excel
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { window.location.href = '/api/export?table=projects&format=csv' }}
            >
              <FileText className="me-2 h-4 w-4" />
              ייצוא CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Active count badge */}
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 ms-auto">
          {activeCount} פעילים
        </Badge>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Text search */}
        <Input
          placeholder="חיפוש לפי שם פרויקט, מספר, שם מזמין..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="max-w-sm"
        />

        {/* Status filter — 3-state: all / active / view_only / inactive */}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="כל הסטטוסים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="view_only">לצפייה בלבד</SelectItem>
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

      {/* Row count */}
      <p className="text-sm text-muted-foreground">
        {filteredData.length} פרויקטים (מתוך {projects.length} סה&quot;כ)
      </p>

      {/* ProjectForm dialog */}
      {formOpen && (
        <ProjectForm
          open={formOpen}
          onOpenChange={setFormOpen}
          project={editingProject ?? null}
          employees={employees}
          clocks={editingProject ? (clocks[editingProject.id] ?? []) : []}
        />
      )}

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(undefined) }}
        onConfirm={handleDelete}
        loading={deleting}
        title="מחיקת פרויקט"
        description={
          deleteTarget
            ? `האם למחוק את הפרויקט "${deleteTarget.name}"? פעולה זו ניתנת לשחזור.`
            : undefined
        }
      />
    </div>
  )
}
