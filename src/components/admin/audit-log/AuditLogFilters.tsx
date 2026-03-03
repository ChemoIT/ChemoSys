'use client'

/**
 * AuditLogFilters — Filter bar for the audit log viewer.
 *
 * Controls: entity type dropdown, action type dropdown, free-text search (debounced),
 * date range picker (react-day-picker + shadcn Popover), clear button.
 *
 * All filter changes push new URL search params → triggers Server Component re-fetch.
 * Page always resets to 1 on filter change.
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { he } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ---------------------------------------------------------------------------
// Hebrew action labels
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'יצירה',
  UPDATE: 'עדכון',
  DELETE: 'מחיקה',
  LOGIN: 'כניסה',
  LOGOUT: 'יציאה',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Filters = {
  entity?: string
  action?: string
  search?: string
  from?: string
  to?: string
}

type Props = {
  entityTypes: string[]
  actionTypes: string[]
  currentFilters: Filters
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogFilters({ entityTypes, actionTypes, currentFilters }: Props) {
  const router = useRouter()

  // Local state initialized from server-side filter values
  const [entity, setEntity] = useState(currentFilters.entity ?? '')
  const [action, setAction] = useState(currentFilters.action ?? '')
  const [search, setSearch] = useState(currentFilters.search ?? '')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (currentFilters.from || currentFilters.to) {
      return {
        from: currentFilters.from ? parseISO(currentFilters.from) : undefined,
        to: currentFilters.to ? parseISO(currentFilters.to) : undefined,
      }
    }
    return undefined
  })

  // Debounce ref for search input
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------------------------------------------------------------------------
  // Push filters to URL — always resets to page 1
  // ---------------------------------------------------------------------------

  function pushFilters(overrides: Partial<Filters & { search: string }>) {
    const merged = {
      entity,
      action,
      search,
      from: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
      to: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '',
      ...overrides,
    }

    const params = new URLSearchParams()
    if (merged.entity)  params.set('entity', merged.entity)
    if (merged.action)  params.set('action', merged.action)
    if (merged.search)  params.set('search', merged.search)
    if (merged.from)    params.set('from', merged.from)
    if (merged.to)      params.set('to', merged.to)
    // Always reset to page 1 on filter change

    router.push('/admin/audit-log' + (params.toString() ? '?' + params.toString() : ''))
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleEntityChange(value: string) {
    const newEntity = value === '__all__' ? '' : value
    setEntity(newEntity)
    pushFilters({ entity: newEntity })
  }

  function handleActionChange(value: string) {
    const newAction = value === '__all__' ? '' : value
    setAction(newAction)
    pushFilters({ action: newAction })
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSearch(value)
    // Debounce: push to URL 300ms after user stops typing
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      pushFilters({ search: value })
    }, 300)
  }

  function handleDateRangeChange(range: DateRange | undefined) {
    setDateRange(range)
    const from = range?.from ? format(range.from, 'yyyy-MM-dd') : ''
    const to = range?.to ? format(range.to, 'yyyy-MM-dd') : ''
    pushFilters({ from, to })
  }

  function handleClear() {
    setEntity('')
    setAction('')
    setSearch('')
    setDateRange(undefined)
    router.push('/admin/audit-log')
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

  // Check if any filters are active (for showing the clear button)
  const hasActiveFilters = !!(entity || action || search || dateRange?.from || dateRange?.to)

  // ---------------------------------------------------------------------------
  // Date range display label
  // ---------------------------------------------------------------------------

  function dateRangeLabel(): string {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'dd/MM/yyyy')} — ${format(dateRange.to, 'dd/MM/yyyy')}`
    }
    if (dateRange?.from) {
      return `${format(dateRange.from, 'dd/MM/yyyy')} — ...`
    }
    return 'טווח תאריכים'
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Entity type dropdown */}
      <Select value={entity || '__all__'} onValueChange={handleEntityChange}>
        <SelectTrigger className="h-9 w-[160px] text-sm">
          <SelectValue placeholder="כל הסוגים" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">כל הסוגים</SelectItem>
          {entityTypes.map((et) => (
            <SelectItem key={et} value={et}>
              {et}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Action type dropdown */}
      <Select value={action || '__all__'} onValueChange={handleActionChange}>
        <SelectTrigger className="h-9 w-[140px] text-sm">
          <SelectValue placeholder="כל הפעולות" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">כל הפעולות</SelectItem>
          {actionTypes.map((at) => (
            <SelectItem key={at} value={at}>
              {ACTION_LABELS[at] ?? at}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Free-text search */}
      <Input
        value={search}
        onChange={handleSearchChange}
        placeholder="חיפוש..."
        className="h-9 w-[180px] text-sm"
      />

      {/* Date range picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-sm font-normal"
          >
            <CalendarIcon className="h-4 w-4" />
            {dateRangeLabel()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleDateRangeChange}
            locale={he}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      {/* Clear filters button — only shown when filters are active */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-9 gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          נקה סינון
        </Button>
      )}
    </div>
  )
}
