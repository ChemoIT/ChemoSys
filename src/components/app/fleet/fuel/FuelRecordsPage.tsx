'use client'

/**
 * FuelRecordsPage — main client component for /app/fleet/fuel.
 * Displays fuel records in a table with server-side filtering and pagination.
 * Matches VehicleList design language (same width, colors, shadows).
 */

import { useState, useTransition } from 'react'
import { Fuel, Droplets, Receipt, Banknote, Loader2, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { FuelFilters } from './FuelFilters'
import { FuelTable } from './FuelTable'
import { PriorityExportDialog } from './PriorityExportDialog'
import { FuelAnomalyDialog } from './FuelAnomalyDialog'
import { getFuelRecords, getFuelStats } from '@/actions/fleet/fuel'
import { formatNumber, formatCurrency } from '@/lib/format'
import type {
  FuelRecord,
  FuelFilters as FuelFiltersType,
  FuelStats,
  FuelSortField,
  ProjectOptionForFilter,
} from '@/lib/fleet/fuel-types'

type Props = {
  initialRecords: FuelRecord[]
  initialTotal: number
  initialStats: FuelStats
  projects: ProjectOptionForFilter[]
  initialFilters: FuelFiltersType
}

export function FuelRecordsPage({
  initialRecords,
  initialTotal,
  initialStats,
  projects,
  initialFilters,
}: Props) {
  const [records, setRecords] = useState(initialRecords)
  const [total, setTotal] = useState(initialTotal)
  const [stats, setStats] = useState(initialStats)
  const [filters, setFilters] = useState(initialFilters)
  const [isPending, startTransition] = useTransition()
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false)
  const [anomalyDialogOpen, setAnomalyDialogOpen] = useState(false)

  const applyFilters = (newFilters: FuelFiltersType) => {
    setFilters(newFilters)
    startTransition(async () => {
      const [recordsResult, statsResult] = await Promise.all([
        getFuelRecords(newFilters),
        getFuelStats(newFilters),
      ])
      setRecords(recordsResult.records)
      setTotal(recordsResult.total)
      setStats(statsResult)
    })
  }

  const handleFilterChange = (partial: Partial<FuelFiltersType>) => {
    const newFilters = { ...filters, ...partial, page: 1 }
    applyFilters(newFilters)
  }

  const handlePageChange = (page: number) => {
    const newFilters = { ...filters, page }
    applyFilters(newFilters)
  }

  const handleSort = (field: FuelSortField) => {
    const newDir = filters.sortBy === field && filters.sortDir === 'desc' ? 'asc' : 'desc'
    applyFilters({ ...filters, sortBy: field, sortDir: newDir, page: 1 })
  }

  return (
    <div className="max-w-[calc(100%-6cm)] mx-auto w-full space-y-5">
      {/* ── Header ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">תדלוקים</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnomalyDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-xs font-medium hover:bg-orange-100 transition-colors cursor-pointer"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              דוח חריגים
            </button>
            <button
              onClick={() => setPriorityDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-700 text-xs font-medium hover:bg-teal-100 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              ייצוא לפריוריטי
            </button>
          </div>
        </div>
        {/* Stat chips */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatChip
            icon={<Receipt className="h-3.5 w-3.5" />}
            label={`${formatNumber(stats.totalRecords)} רשומות`}
            bgClass="bg-muted/60"
            borderClass="border-border"
            textClass="text-muted-foreground"
          />
          <StatChip
            icon={<Droplets className="h-3.5 w-3.5" />}
            label={`${formatNumber(stats.totalLiters, 1)} ליטר`}
            bgClass="bg-blue-50"
            borderClass="border-blue-200"
            textClass="text-blue-700"
          />
          <StatChip
            icon={<Banknote className="h-3.5 w-3.5" />}
            label={`${formatCurrency(stats.totalNetAmount)} נטו`}
            bgClass="bg-green-50"
            borderClass="border-green-200"
            textClass="text-green-700"
          />
          {stats.totalGrossAmount > 0 && stats.totalGrossAmount !== stats.totalNetAmount && (
            <StatChip
              icon={<Banknote className="h-3.5 w-3.5" />}
              label={`${formatCurrency(stats.totalGrossAmount)} ברוטו`}
              bgClass="bg-muted/40"
              borderClass="border-border"
              textClass="text-muted-foreground"
            />
          )}
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <FuelFilters
        filters={filters}
        projects={projects}
        onChange={handleFilterChange}
        isPending={isPending}
      />

      {/* ── Loading indicator ──────────────────────────── */}
      {isPending && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />
          <span className="text-sm text-muted-foreground">מעדכן נתונים...</span>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────── */}
      <FuelTable
        records={records}
        total={total}
        page={filters.page}
        onPageChange={handlePageChange}
        isPending={isPending}
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
        onSort={handleSort}
      />

      {/* ── Dialogs ─────────────────────────────────────────── */}
      <PriorityExportDialog
        open={priorityDialogOpen}
        onOpenChange={setPriorityDialogOpen}
      />
      <FuelAnomalyDialog
        open={anomalyDialogOpen}
        onOpenChange={setAnomalyDialogOpen}
      />
    </div>
  )
}

// ── Stat chip helper ──────────────────────────────────────

function StatChip({
  icon,
  label,
  bgClass,
  borderClass,
  textClass,
}: {
  icon: React.ReactNode
  label: string
  bgClass: string
  borderClass: string
  textClass: string
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${bgClass} ${borderClass}`}>
      <span className={textClass}>{icon}</span>
      <span className={`text-xs font-medium ${textClass}`}>{label}</span>
    </div>
  )
}
