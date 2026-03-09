'use client'

/**
 * FuelFilters — filter bar for fuel records page.
 * Matches VehicleList SegmentButton design pattern.
 */

import { Search } from 'lucide-react'
import {
  FUEL_SUPPLIER_LABELS,
  FUEL_TYPE_LABELS,
  HEBREW_MONTHS,
} from '@/lib/fleet/fuel-types'
import { VEHICLE_TYPE_LABELS } from '@/lib/fleet/vehicle-types'
import type { FuelFilters as FuelFiltersType, ProjectOptionForFilter } from '@/lib/fleet/fuel-types'

type Props = {
  filters: FuelFiltersType
  projects: ProjectOptionForFilter[]
  onChange: (partial: Partial<FuelFiltersType>) => void
  isPending: boolean
}

// ── Segment button helper (same as VehicleList) ──────────

function SegmentButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none flex items-center gap-1.5 data-[active=true]:bg-white data-[active=true]:shadow-sm data-[active=true]:text-foreground text-muted-foreground hover:text-foreground whitespace-nowrap"
      style={active ? { boxShadow: '0 1px 3px rgb(21 45 60 / 0.12)' } : {}}
    >
      {label}
    </button>
  )
}

// ── Year range for dropdowns ─────────────────────────────

const YEAR_RANGE = Array.from({ length: 7 }, (_, i) => 2024 + i) // 2024-2030

export function FuelFilters({ filters, projects, onChange, isPending }: Props) {
  return (
    <div
      className="flex flex-wrap gap-2 items-center"
      style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 200ms' }}
    >
      {/* ── Period: from month/year ── */}
      <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-full px-2 py-0.5">
        <span className="text-xs text-muted-foreground font-medium pr-1">מ:</span>
        <select
          value={filters.fromMonth}
          onChange={(e) => onChange({ fromMonth: Number(e.target.value) })}
          className="bg-transparent text-xs font-medium py-1.5 focus:outline-none cursor-pointer text-foreground"
        >
          {Object.entries(HEBREW_MONTHS).map(([num, name]) => (
            <option key={num} value={num}>{name}</option>
          ))}
        </select>
        <select
          value={filters.fromYear}
          onChange={(e) => onChange({ fromYear: Number(e.target.value) })}
          className="bg-transparent text-xs font-medium py-1.5 focus:outline-none cursor-pointer text-foreground"
        >
          {YEAR_RANGE.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* ── Period: to month/year ── */}
      <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-full px-2 py-0.5">
        <span className="text-xs text-muted-foreground font-medium pr-1">עד:</span>
        <select
          value={filters.toMonth}
          onChange={(e) => onChange({ toMonth: Number(e.target.value) })}
          className="bg-transparent text-xs font-medium py-1.5 focus:outline-none cursor-pointer text-foreground"
        >
          {Object.entries(HEBREW_MONTHS).map(([num, name]) => (
            <option key={num} value={num}>{name}</option>
          ))}
        </select>
        <select
          value={filters.toYear}
          onChange={(e) => onChange({ toYear: Number(e.target.value) })}
          className="bg-transparent text-xs font-medium py-1.5 focus:outline-none cursor-pointer text-foreground"
        >
          {YEAR_RANGE.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* ── Fuel supplier ── */}
      <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-full p-0.5">
        <SegmentButton
          label="כל הספקים"
          active={filters.supplier === null}
          onClick={() => onChange({ supplier: null })}
        />
        {Object.entries(FUEL_SUPPLIER_LABELS).map(([key, label]) => (
          <SegmentButton
            key={key}
            label={label}
            active={filters.supplier === key}
            onClick={() => onChange({ supplier: key })}
          />
        ))}
      </div>

      {/* ── Fuel type ── */}
      <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-full p-0.5">
        <SegmentButton
          label="כל הדלקים"
          active={filters.fuelType === null}
          onClick={() => onChange({ fuelType: null })}
        />
        {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
          <SegmentButton
            key={key}
            label={label}
            active={filters.fuelType === key}
            onClick={() => onChange({ fuelType: key })}
          />
        ))}
      </div>

      {/* ── Vehicle type ── */}
      <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-full p-0.5">
        <SegmentButton
          label="כל הסוגים"
          active={filters.vehicleType === null}
          onClick={() => onChange({ vehicleType: null })}
        />
        {Object.entries(VEHICLE_TYPE_LABELS).map(([key, label]) => (
          <SegmentButton
            key={key}
            label={label}
            active={filters.vehicleType === key}
            onClick={() => onChange({ vehicleType: key })}
          />
        ))}
      </div>

      {/* ── License plate search ── */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          value={filters.licensePlateSearch ?? ''}
          onChange={(e) => onChange({ licensePlateSearch: e.target.value || null })}
          placeholder="חיפוש מספר רישוי..."
          className="border border-border rounded-full pr-9 pl-3 py-2 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 w-full sm:w-48 shadow-sm"
          style={{ transition: 'box-shadow 150ms, border-color 150ms' }}
        />
      </div>

      {/* ── Project filter ── */}
      <select
        value={filters.projectId ?? 'all'}
        onChange={(e) => onChange({ projectId: e.target.value === 'all' ? null : e.target.value })}
        className="border border-border rounded-full px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm cursor-pointer text-muted-foreground font-medium"
      >
        <option value="all">כל הפרויקטים</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  )
}
