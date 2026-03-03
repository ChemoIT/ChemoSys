'use client'

/**
 * AuditLogExportButton — Export dropdown for audit log.
 *
 * Passes the currently active filters to /api/export-audit so the exported
 * file matches exactly what the user sees on screen.
 *
 * Download triggered via window.location.href (established Phase 4 pattern).
 */

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Filters = {
  entity?: string
  action?: string
  search?: string
  from?: string
  to?: string
}

type Props = {
  currentFilters: Filters
}

export function AuditLogExportButton({ currentFilters }: Props) {
  function buildExportUrl(format: 'xlsx' | 'csv'): string {
    const params = new URLSearchParams()
    params.set('format', format)

    // Only include non-empty filter params
    if (currentFilters.entity)  params.set('entity', currentFilters.entity)
    if (currentFilters.action)  params.set('action', currentFilters.action)
    if (currentFilters.search)  params.set('search', currentFilters.search)
    if (currentFilters.from)    params.set('from', currentFilters.from)
    if (currentFilters.to)      params.set('to', currentFilters.to)

    return `/api/export-audit?${params.toString()}`
  }

  function handleExport(format: 'xlsx' | 'csv') {
    window.location.href = buildExportUrl(format)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          ייצוא
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('xlsx')}>
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
