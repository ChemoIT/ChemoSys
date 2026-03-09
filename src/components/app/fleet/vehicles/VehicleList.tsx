'use client'

/**
 * VehicleList — displays the list of all vehicle cards with per-column filters,
 * wider layout matching VehicleCard, and new columns:
 *   כשירות | מספר רישוי | יצרן/דגם | שנה | קטגורית רכב | שם פרויקט | נהג | סטטוס
 *
 * Default filter: status = active + suspended (פעיל + מושבת זמני).
 * Camp vehicles (vehicleCategory='camp') do NOT display a driver name.
 * RTL layout: dir="rtl" applied by parent page or root html.
 */

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Car, Plus, ChevronLeft, Search, Users, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  VehicleFitnessLight,
  computeVehicleFitnessStatus,
} from '@/components/app/fleet/shared/VehicleFitnessLight'
import { AddVehicleDialog } from '@/components/app/fleet/vehicles/AddVehicleDialog'
import { formatLicensePlate } from '@/lib/format'
import { VEHICLE_TYPE_LABELS, VEHICLE_STATUS_LABELS, isVehicleLocked } from '@/lib/fleet/vehicle-types'
import type { VehicleListItem } from '@/lib/fleet/vehicle-types'

type Props = {
  vehicles: VehicleListItem[]
  yellowDays: number
}

type FitnessFilter = 'all' | 'red' | 'yellow' | 'green'

// ─────────────────────────────────────────────────────────────
// Segment button helper (DRY)
// ─────────────────────────────────────────────────────────────

function SegmentButton({
  label,
  active,
  onClick,
  dot,
}: {
  label: string
  active: boolean
  onClick: () => void
  dot?: string // tailwind color class for dot
}) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none flex items-center gap-1.5 data-[active=true]:bg-white data-[active=true]:shadow-sm data-[active=true]:text-foreground text-muted-foreground hover:text-foreground whitespace-nowrap"
      style={active ? { boxShadow: '0 1px 3px rgb(21 45 60 / 0.12)' } : {}}
    >
      {dot && <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${dot}`} />}
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Status badge renderer
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; border: string; label: string }> = {
    active:         { bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0', label: 'פעיל' },
    suspended:      { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A', label: 'מושבת זמני' },
    returned:       { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0', label: 'הוחזר' },
    sold:           { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0', label: 'נמכר' },
    decommissioned: { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA', label: 'מושבת' },
  }
  const c = config[status] ?? config.active
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {c.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleList({ vehicles, yellowDays }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)

  // -- Filters --
  const [search, setSearch] = useState('')
  const [fitnessFilter, setFitnessFilter] = useState<FitnessFilter>('all')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('all')
  // Default: show active + suspended
  const [statusFilter, setStatusFilter] = useState<string>('active_suspended')
  const [projectFilter, setProjectFilter] = useState<string>('all')

  // -- Unique project names for filter --
  const projectNames = useMemo(() => {
    const names = new Set<string>()
    vehicles.forEach((v) => { if (v.activeProjectName) names.add(v.activeProjectName) })
    return Array.from(names).sort()
  }, [vehicles])

  // -- Apply filters --
  // When search is active — bypass ALL other filters and search across the entire fleet.
  const filtered = vehicles.filter((v) => {
    if (search) {
      const q = search.toLowerCase()
      return (
        v.licensePlate.toLowerCase().includes(q) ||
        (v.assignedDriverName?.toLowerCase().includes(q) ?? false) ||
        (v.assignedDriverEmployeeNumber?.toLowerCase().includes(q) ?? false)
      )
    }

    // Status filter
    if (statusFilter === 'active_suspended') {
      if (v.vehicleStatus !== 'active' && v.vehicleStatus !== 'suspended') return false
    } else if (statusFilter !== 'all') {
      if (v.vehicleStatus !== statusFilter) return false
    }

    // Fitness filter
    if (fitnessFilter !== 'all') {
      const fitness = computeVehicleFitnessStatus(
        v.testExpiryDate,
        v.insuranceMinExpiry,
        v.documentMinExpiry,
        yellowDays
      )
      if (fitness !== fitnessFilter) return false
    }

    // Vehicle type filter
    if (vehicleTypeFilter !== 'all') {
      if ((v.vehicleType ?? '') !== vehicleTypeFilter) return false
    }

    // Project filter
    if (projectFilter === 'none') {
      if (v.activeProjectName) return false
    } else if (projectFilter !== 'all') {
      if (v.activeProjectName !== projectFilter) return false
    }

    return true
  })

  const counts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.vehicleStatus === 'active').length,
    suspended: vehicles.filter((v) => v.vehicleStatus === 'suspended').length,
    inactive: vehicles.filter((v) => v.vehicleStatus !== 'active' && v.vehicleStatus !== 'suspended').length,
  }

  return (
    <div className="max-w-[calc(100%-6cm)] mx-auto w-full space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">כרטיסי רכב</h1>
          {/* Stat chips */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{counts.total} רכבים</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-medium text-green-700">{counts.active} פעילים</span>
            </div>
            {counts.suspended > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
                <span className="text-xs font-medium text-amber-700">{counts.suspended} מושבתים זמנית</span>
              </div>
            )}
            {counts.inactive > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border">
                <span className="text-xs font-medium text-muted-foreground">{counts.inactive} לא פעילים</span>
              </div>
            )}
          </div>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          size="sm"
          className="gap-1.5 shrink-0 shadow-sm"
          style={{
            background: 'linear-gradient(135deg, #4ECDC4 0%, #3ABFB6 100%)',
            border: 'none',
          }}
        >
          <Car className="h-4 w-4" />
          <Plus className="h-3.5 w-3.5" />
          רכב חדש
        </Button>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="מספר רישוי / שם נהג / מספר עובד..."
            className="border border-border rounded-full pr-9 pl-3 py-2 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 w-full sm:w-64 shadow-sm"
            style={{ transition: 'box-shadow 150ms, border-color 150ms' }}
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-full p-0.5">
          <SegmentButton label="כולם" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          <SegmentButton label="פעיל+מושבת" active={statusFilter === 'active_suspended'} onClick={() => setStatusFilter('active_suspended')} />
          {Object.entries(VEHICLE_STATUS_LABELS).map(([key, label]) => (
            <SegmentButton key={key} label={label} active={statusFilter === key} onClick={() => setStatusFilter(key)} />
          ))}
        </div>

        {/* Fitness filter */}
        <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-full p-0.5">
          <SegmentButton label="כל הכשירויות" active={fitnessFilter === 'all'} onClick={() => setFitnessFilter('all')} />
          <SegmentButton label="כשיר" active={fitnessFilter === 'green'} onClick={() => setFitnessFilter('green')} dot="bg-green-500" />
          <SegmentButton label="טעון בדיקה" active={fitnessFilter === 'yellow'} onClick={() => setFitnessFilter('yellow')} dot="bg-yellow-400" />
          <SegmentButton label="לא כשיר" active={fitnessFilter === 'red'} onClick={() => setFitnessFilter('red')} dot="bg-red-500" />
        </div>

        {/* Vehicle type filter */}
        <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-full p-0.5">
          <SegmentButton label="כל הסוגים" active={vehicleTypeFilter === 'all'} onClick={() => setVehicleTypeFilter('all')} />
          {Object.entries(VEHICLE_TYPE_LABELS).map(([key, label]) => (
            <SegmentButton key={key} label={label} active={vehicleTypeFilter === key} onClick={() => setVehicleTypeFilter(key)} />
          ))}
        </div>

        {/* Project filter — dropdown style (too many options for segment) */}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="border border-border rounded-full px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm cursor-pointer text-muted-foreground font-medium"
        >
          <option value="all">כל הפרויקטים</option>
          <option value="none">ללא פרויקט</option>
          {projectNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* ── Table / Empty state ───────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-2xl border border-border"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <Car className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium">לא נמצאו רכבים</p>
          <p className="text-xs mt-1 text-muted-foreground/60">נסה לשנות את הפילטרים</p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-x-auto bg-white border border-border"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-right border-b"
                style={{ background: '#F8FAFC', borderColor: '#E8EEF4' }}
              >
                <th className="px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-14">
                  כשירות
                </th>
                <th className="px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                  מספר רישוי
                </th>
                <th className="px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                  יצרן / דגם
                </th>
                <th className="px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-16 hidden md:table-cell">
                  שנה
                </th>
                <th className="px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  קטגוריה
                </th>
                <th className="px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                  פרויקט
                </th>
                <th className="px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                  נהג
                </th>
                <th className="px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-24">
                  סטטוס
                </th>
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((vehicle, idx) => (
                <tr
                  key={vehicle.id}
                  className="cursor-pointer transition-colors duration-100 hover:bg-accent/40"
                  style={{
                    borderBottom: idx < filtered.length - 1 ? '1px solid #EEF3F9' : 'none',
                    minHeight: '44px',
                  }}
                  onClick={() => router.push(`/app/fleet/vehicle-card/${vehicle.id}`)}
                >
                  {/* Fitness light */}
                  <td className="px-3 py-3.5">
                    <VehicleFitnessLight
                      testExpiryDate={vehicle.testExpiryDate}
                      insuranceMinExpiry={vehicle.insuranceMinExpiry}
                      documentMinExpiry={vehicle.documentMinExpiry}
                      yellowDays={yellowDays}
                      isInactive={isVehicleLocked(vehicle.vehicleStatus)}
                    />
                  </td>

                  {/* License plate */}
                  <td className="px-3 py-3.5">
                    <span className="font-mono font-semibold text-foreground" dir="ltr">
                      {formatLicensePlate(vehicle.licensePlate)}
                    </span>
                  </td>

                  {/* Manufacturer / model */}
                  <td className="px-3 py-3.5 text-muted-foreground">
                    {[vehicle.tozeret, vehicle.degem].filter(Boolean).join(' / ') || '—'}
                  </td>

                  {/* Year */}
                  <td className="px-3 py-3.5 text-muted-foreground hidden md:table-cell">
                    {vehicle.shnatYitzur ?? '—'}
                  </td>

                  {/* Vehicle type (קטגוריה) */}
                  <td className="px-3 py-3.5 text-muted-foreground hidden md:table-cell">
                    {vehicle.vehicleType ? (VEHICLE_TYPE_LABELS[vehicle.vehicleType] ?? vehicle.vehicleType) : '—'}
                  </td>

                  {/* Active project */}
                  <td className="px-3 py-3.5 text-muted-foreground hidden lg:table-cell">
                    {vehicle.activeProjectName ?? '—'}
                  </td>

                  {/* Driver — hide for camp vehicles */}
                  <td className="px-3 py-3.5 text-muted-foreground hidden lg:table-cell">
                    {vehicle.vehicleCategory === 'camp' ? '—' : (vehicle.assignedDriverName ?? '—')}
                  </td>

                  {/* Status badge */}
                  <td className="px-3 py-3.5">
                    <StatusBadge status={vehicle.vehicleStatus} />
                  </td>

                  {/* Chevron */}
                  <td className="px-3 py-3.5">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/8 transition-colors">
                      <ChevronLeft className="h-4 w-4" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div
            className="px-4 py-2.5 text-xs text-muted-foreground/60 border-t text-left"
            style={{ background: '#FAFCFE', borderColor: '#EEF3F9' }}
          >
            מציג {filtered.length} מתוך {counts.total} רכבים
          </div>
        </div>
      )}

      {/* Add vehicle dialog */}
      <AddVehicleDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
