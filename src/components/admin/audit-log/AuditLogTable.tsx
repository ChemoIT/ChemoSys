'use client'

/**
 * AuditLogTable — TanStack Table with expandable rows for audit log viewer.
 *
 * NOT reusing DataTable.tsx — DataTable lacks expandable row support.
 * Server-side pagination via router.push (URL search params).
 *
 * Features:
 *   - Expandable rows: click row → shows AuditDiffView with old/new data
 *   - Columns: expander, date/time, user, action (Hebrew badge), entity type, entity ID
 *   - Pagination: server-side (Previous/Next using URL params)
 *   - Filters: rendered above table via AuditLogFilters
 *   - Export: rendered in header via AuditLogExportButton
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type ExpandedState,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AuditDiffView } from './AuditDiffView'
import { AuditLogFilters } from './AuditLogFilters'
import { AuditLogExportButton } from './AuditLogExportButton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditRow = {
  id: string
  created_at: string
  action: string
  entity_type: string
  entity_id: string
  user_id: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  userName: string
  entityName: string // resolved server-side per entity_type lookup
}

type Filters = {
  entity?: string
  action?: string
  search?: string
  from?: string
  to?: string
}

type Props = {
  rows: AuditRow[]
  totalCount: number
  pageSize: number
  currentPage: number
  entityTypes: string[]
  actionTypes: string[]
  currentFilters: Filters
}

// ---------------------------------------------------------------------------
// Hebrew action badge config
// ---------------------------------------------------------------------------

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const ACTION_CONFIG: Record<
  string,
  { label: string; variant: BadgeVariant; className: string }
> = {
  INSERT: { label: 'יצירה',  variant: 'default',     className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200' },
  UPDATE: { label: 'עדכון',  variant: 'default',     className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200' },
  DELETE: { label: 'מחיקה', variant: 'destructive',  className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200' },
  LOGIN:  { label: 'כניסה',  variant: 'secondary',   className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200' },
  LOGOUT: { label: 'יציאה',  variant: 'secondary',   className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200' },
}

// ---------------------------------------------------------------------------
// Hebrew entity type names
// ---------------------------------------------------------------------------

const ENTITY_LABELS: Record<string, string> = {
  employees:       'עובד',
  companies:       'חברה',
  departments:     'מחלקה',
  role_tags:       'תגית תפקיד',
  role_templates:  'תבנית הרשאות',
  users:           'יוזר',
  projects:        'פרויקט',
  employee_import: 'יבוא עובדים',
  attendance_clocks: 'שעון נוכחות',
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function buildColumns(): ColumnDef<AuditRow>[] {
  return [
    // Expander column
    {
      id: 'expander',
      header: '',
      size: 40,
      cell: ({ row }) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            row.getToggleExpandedHandler()()
          }}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-muted/60 transition-colors"
          aria-label={row.getIsExpanded() ? 'קפל שורה' : 'הרחב שורה'}
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      ),
    },
    // Date/time
    {
      id: 'created_at',
      header: 'תאריך ושעה',
      accessorKey: 'created_at',
      cell: ({ getValue }) => {
        const raw = getValue() as string
        try {
          return (
            <span className="text-sm tabular-nums">
              {format(new Date(raw), 'dd/MM/yyyy HH:mm', { locale: he })}
            </span>
          )
        } catch {
          return <span className="text-sm">{raw}</span>
        }
      },
    },
    // User display name
    {
      id: 'userName',
      header: 'משתמש',
      accessorKey: 'userName',
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue() as string}</span>
      ),
    },
    // Action badge
    {
      id: 'action',
      header: 'פעולה',
      accessorKey: 'action',
      cell: ({ getValue }) => {
        const action = getValue() as string
        const config = ACTION_CONFIG[action]
        if (!config) {
          return <Badge variant="outline" className="text-xs">{action}</Badge>
        }
        return (
          <Badge
            variant="outline"
            className={`text-xs border ${config.className}`}
          >
            {config.label}
          </Badge>
        )
      },
    },
    // Entity type (Hebrew label)
    {
      id: 'entity_type',
      header: 'סוג ישות',
      accessorKey: 'entity_type',
      cell: ({ getValue }) => {
        const et = getValue() as string
        return (
          <span className="text-sm">{ENTITY_LABELS[et] ?? et}</span>
        )
      },
    },
    // Entity name (human-readable, raw UUID as tooltip for debugging)
    {
      id: 'entity_id',
      header: 'ישות',
      accessorKey: 'entityName',
      cell: ({ row }) => {
        const name = row.original.entityName
        const id = row.original.entity_id
        return (
          <span
            className="text-sm"
            title={id}  // full UUID as tooltip for debugging
          >
            {name || `${id?.substring(0, 8) ?? '—'}…`}
          </span>
        )
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AuditLogTable({
  rows,
  totalCount,
  pageSize,
  currentPage,
  entityTypes,
  actionTypes,
  currentFilters,
}: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const columns = buildColumns()
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const table = useReactTable({
    data: rows,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    // Server-side pagination — do NOT use getPaginationRowModel()
    manualPagination: true,
    pageCount: totalPages,
  })

  // ---------------------------------------------------------------------------
  // Pagination navigation
  // ---------------------------------------------------------------------------

  function navigateToPage(page: number) {
    const params = new URLSearchParams()
    if (currentFilters.entity)  params.set('entity', currentFilters.entity)
    if (currentFilters.action)  params.set('action', currentFilters.action)
    if (currentFilters.search)  params.set('search', currentFilters.search)
    if (currentFilters.from)    params.set('from', currentFilters.from)
    if (currentFilters.to)      params.set('to', currentFilters.to)
    params.set('page', String(page))
    router.push('/admin/audit-log?' + params.toString())
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header row: filters + export button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AuditLogFilters
          entityTypes={entityTypes}
          actionTypes={actionTypes}
          currentFilters={currentFilters}
        />
        <AuditLogExportButton currentFilters={currentFilters} />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-start font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <>
                  {/* Main data row */}
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => row.toggleExpanded()}
                    data-state={row.getIsExpanded() ? 'expanded' : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Expanded detail row */}
                  {row.getIsExpanded() && (
                    <TableRow key={`${row.id}-expanded`} className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={columns.length} className="p-0">
                        <div className="border-t border-muted">
                          <AuditDiffView
                            oldData={row.original.old_data}
                            newData={row.original.new_data}
                            action={row.original.action}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  לא נמצאו רשומות ביומן הפעולות
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {totalCount.toLocaleString('he-IL')} רשומות סה&quot;כ · עמוד {currentPage} מתוך {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            title="עמוד קודם"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="עמוד הבא"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
