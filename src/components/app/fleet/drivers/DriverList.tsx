'use client'

/**
 * DriverList — displays the list of all driver cards with fitness light,
 * status filter, and navigation to individual driver cards.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus, ChevronLeft, Building2, Truck, Search, Users, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FitnessLight } from './FitnessLight'
import { AddDriverDialog } from './AddDriverDialog'
import type { DriverListItem } from '@/actions/fleet/drivers'

type Props = {
  drivers: DriverListItem[]
  yellowDays: number
}

type StatusFilter = 'all' | 'active' | 'inactive'
type FitnessFilter = 'all' | 'red' | 'yellow' | 'green'

export function DriverList({ drivers, yellowDays }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [fitnessFilter, setFitnessFilter] = useState<FitnessFilter>('all')
  const [search, setSearch] = useState('')

  const filtered = drivers.filter((d) => {
    if (statusFilter !== 'all' && d.computedStatus !== statusFilter) return false

    if (fitnessFilter !== 'all') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      let fitness: 'red' | 'yellow' | 'green' = 'green'

      if (d.licenseExpiryDate) {
        const exp = new Date(d.licenseExpiryDate)
        exp.setHours(0, 0, 0, 0)
        if (exp <= today) fitness = 'red'
        else {
          const days = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)
          if (days <= yellowDays) fitness = 'yellow'
        }
      }
      if (fitness !== 'red' && d.documentMinExpiry) {
        const exp = new Date(d.documentMinExpiry)
        exp.setHours(0, 0, 0, 0)
        const days = Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)
        if (days <= yellowDays) fitness = 'yellow'
      }
      if (fitness !== fitnessFilter) return false
    }

    if (search) {
      const q = search.toLowerCase()
      return (
        d.fullName.toLowerCase().includes(q) ||
        d.employeeNumber.includes(q) ||
        d.companyName.toLowerCase().includes(q)
      )
    }
    return true
  })

  const counts = {
    total: drivers.length,
    active: drivers.filter((d) => d.computedStatus === 'active').length,
    inactive: drivers.filter((d) => d.computedStatus !== 'active').length,
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">כרטיסי נהגים</h1>
          {/* Stat chips */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{counts.total} נהגים</span>
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
            background: "linear-gradient(135deg, #4ECDC4 0%, #3ABFB6 100%)",
            border: "none",
          }}
        >
          <UserPlus className="h-4 w-4" />
          נהג חדש
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
            placeholder="שם / מ׳ עובד / חברה..."
            className="border border-border rounded-full pr-9 pl-3 py-2 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 w-full sm:w-52 shadow-sm"
            style={{ transition: "box-shadow 150ms, border-color 150ms" }}
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
              style={statusFilter === s ? { boxShadow: "0 1px 3px rgb(21 45 60 / 0.12)" } : {}}
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
              style={fitnessFilter === f ? { boxShadow: "0 1px 3px rgb(21 45 60 / 0.12)" } : {}}
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

      {/* ── Table ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-2xl border border-border card-shadow">
          <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium">לא נמצאו נהגים</p>
          <p className="text-xs mt-1 text-muted-foreground/60">נסה לשנות את הפילטרים</p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-x-auto bg-white border border-border"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-right border-b"
                style={{ background: "#F8FAFC", borderColor: "#E8EEF4" }}
              >
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-14">
                  כשירות
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                  שם נהג
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden sm:table-cell w-20">
                  מ׳ עובד
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  חברה
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide hidden lg:table-cell w-24">
                  סוג
                </th>
                <th className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-20">
                  סטטוס
                </th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((driver, idx) => (
                <tr
                  key={driver.id}
                  className="cursor-pointer transition-colors duration-100 hover:bg-accent/40"
                  style={{
                    borderBottom: idx < filtered.length - 1 ? "1px solid #EEF3F9" : "none",
                  }}
                  onClick={() => router.push(`/app/fleet/driver-card/${driver.id}`)}
                >
                  <td className="px-4 py-3.5">
                    <FitnessLight
                      licenseExpiryDate={driver.licenseExpiryDate}
                      documentMinExpiry={driver.documentMinExpiry}
                      yellowDays={yellowDays}
                      size="md"
                    />
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-foreground">{driver.fullName}</td>
                  <td className="px-4 py-3.5 text-muted-foreground hidden sm:table-cell font-mono text-xs">
                    {driver.employeeNumber}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground hidden md:table-cell">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      {driver.companyName}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {driver.isOccasionalCampDriver && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{ background: "#EFF9F8", color: "#0B7A74", border: "1px solid #C5EBE8" }}
                        >
                          <Truck className="h-3 w-3" />
                          מחנה
                        </span>
                      )}
                      {driver.isEquipmentOperator && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{ background: "#EEF2F8", color: "#3B5899", border: "1px solid #C8D5E8" }}
                        >
                          צמ&quot;ה
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {driver.computedStatus === 'active' ? (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: "#DCFCE7", color: "#16A34A", border: "1px solid #BBF7D0" }}
                      >
                        פעיל
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}
                      >
                        לא פעיל
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div
                      className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/8 transition-colors"
                    >
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
            style={{ background: "#FAFCFE", borderColor: "#EEF3F9" }}
          >
            מציג {filtered.length} מתוך {counts.total} נהגים
          </div>
        </div>
      )}

      <AddDriverDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
