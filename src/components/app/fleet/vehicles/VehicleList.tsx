'use client'

/**
 * VehicleList — displays the list of all vehicle cards with fitness light,
 * status filter, fitness filter, search, and navigation to individual vehicle cards.
 *
 * Mirrors DriverList.tsx pattern exactly.
 * RTL layout: dir="rtl" applied by parent page or root html.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Car, Plus, ChevronLeft, Building2, Search, Users, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  VehicleFitnessLight,
  computeVehicleFitnessStatus,
} from '@/components/app/fleet/shared/VehicleFitnessLight'
import { AddVehicleDialog } from '@/components/app/fleet/vehicles/AddVehicleDialog'
import { formatLicensePlate } from '@/lib/format'
import type { VehicleListItem } from '@/lib/fleet/vehicle-types'

type Props = {
  vehicles: VehicleListItem[]
  yellowDays: number
}

type StatusFilter = 'all' | 'active' | 'inactive'
type FitnessFilter = 'all' | 'red' | 'yellow' | 'green'

export function VehicleList({ vehicles, yellowDays }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [fitnessFilter, setFitnessFilter] = useState<FitnessFilter>('all')
  const [search, setSearch] = useState('')

  const filtered = vehicles.filter((v) => {
    // Status filter
    if (statusFilter !== 'all' && v.computedStatus !== statusFilter) return false

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

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      return (
        v.licensePlate.toLowerCase().includes(q) ||
        (v.tozeret?.toLowerCase().includes(q) ?? false) ||
        (v.degem?.toLowerCase().includes(q) ?? false) ||
        (v.companyName?.toLowerCase().includes(q) ?? false) ||
        (v.assignedDriverName?.toLowerCase().includes(q) ?? false)
      )
    }

    return true
  })

  const counts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.computedStatus === 'active').length,
    inactive: vehicles.filter((v) => v.computedStatus !== 'active').length,
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-5">
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
            placeholder="לוחית / יצרן / דגם / חברה..."
            className="border border-border rounded-full pr-9 pl-3 py-2 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 w-full sm:w-52 shadow-sm"
            style={{ transition: 'box-shadow 150ms, border-color 150ms' }}
          />
        </div>

        {/* Status segment control */}
        <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-full p-0.5">
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              data-active={statusFilter === s}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none data-[active=true]:bg-white data-[active=true]:shadow-sm data-[active=true]:text-foreground text-muted-foreground hover:text-foreground"
              style={statusFilter === s ? { boxShadow: '0 1px 3px rgb(21 45 60 / 0.12)' } : {}}
            >
              {s === 'all' ? 'כולם' : s === 'active' ? 'פעילים' : 'לא פעילים'}
            </button>
          ))}
        </div>

        {/* Fitness segment control */}
        <div className="flex items-center gap-0.5 bg-muted/50 border border-border rounded-full p-0.5">
          {(['all', 'green', 'yellow', 'red'] as FitnessFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFitnessFilter(f)}
              data-active={fitnessFilter === f}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none flex items-center gap-1.5 data-[active=true]:bg-white data-[active=true]:shadow-sm data-[active=true]:text-foreground text-muted-foreground hover:text-foreground"
              style={fitnessFilter === f ? { boxShadow: '0 1px 3px rgb(21 45 60 / 0.12)' } : {}}
            >
              {f !== 'all' && (
                <span
                  className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                    f === 'red' ? 'bg-red-500' : f === 'yellow' ? 'bg-yellow-400' : 'bg-green-500'
                  }`}
                />
              )}
              {f === 'all' ? 'כל הכשירויות' : f === 'green' ? 'כשיר' : f === 'yellow' ? 'טעון בדיקה' : 'לא כשיר'}
            </button>
          ))}
        </div>
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
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-14">
                  כשירות
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                  מספר רישוי
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                  יצרן / דגם
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  חברה
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden lg:table-cell w-16">
                  שנה
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                  נהג
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-20">
                  סטטוס
                </th>
                <th className="px-4 py-3 w-10" />
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
                  <td className="px-4 py-3.5">
                    <VehicleFitnessLight
                      testExpiryDate={vehicle.testExpiryDate}
                      insuranceMinExpiry={vehicle.insuranceMinExpiry}
                      documentMinExpiry={vehicle.documentMinExpiry}
                      yellowDays={yellowDays}
                    />
                  </td>

                  {/* License plate */}
                  <td className="px-4 py-3.5">
                    <span className="font-mono font-semibold text-foreground" dir="ltr">
                      {formatLicensePlate(vehicle.licensePlate)}
                    </span>
                  </td>

                  {/* Manufacturer / model */}
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {[vehicle.tozeret, vehicle.degem].filter(Boolean).join(' / ') || '—'}
                  </td>

                  {/* Company — hidden on mobile */}
                  <td className="px-4 py-3.5 text-muted-foreground hidden md:table-cell">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      {vehicle.companyName ?? '—'}
                    </span>
                  </td>

                  {/* Year — hidden on mobile + tablet */}
                  <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell">
                    {vehicle.shnatYitzur ?? '—'}
                  </td>

                  {/* Assigned driver — hidden on mobile + tablet */}
                  <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell">
                    {vehicle.assignedDriverName ?? '—'}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3.5">
                    {vehicle.computedStatus === 'active' ? (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}
                      >
                        פעיל
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
                      >
                        לא פעיל
                      </span>
                    )}
                  </td>

                  {/* Chevron */}
                  <td className="px-4 py-3.5">
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
