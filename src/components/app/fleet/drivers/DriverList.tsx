'use client'

/**
 * DriverList — displays the list of all driver cards with fitness light,
 * status filter, and navigation to individual driver cards.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus, ChevronLeft, Building2, Truck } from 'lucide-react'
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [fitnessFilter, setFitnessFilter] = useState<FitnessFilter>('all')
  const [search, setSearch] = useState('')

  const filtered = drivers.filter((d) => {
    if (statusFilter !== 'all' && d.computedStatus !== statusFilter) return false

    if (fitnessFilter !== 'all') {
      // Compute fitness status for filter
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
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">כרטיסי נהגים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.total} נהגים רשומים | {counts.active} פעילים
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          נהג חדש
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש שם / מ' עובד / חברה..."
          className="border rounded-lg px-3 py-2.5 text-base sm:text-sm sm:py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-52"
        />

        {/* Status filter */}
        <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 sm:py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'כולם' : s === 'active' ? 'פעילים' : 'לא פעילים'}
            </button>
          ))}
        </div>

        {/* Fitness filter */}
        <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
          {(['all', 'green', 'yellow', 'red'] as FitnessFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFitnessFilter(f)}
              className={`px-3 py-2 sm:py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                fitnessFilter === f
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f !== 'all' && (
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    f === 'red' ? 'bg-red-500' : f === 'yellow' ? 'bg-yellow-400' : 'bg-green-500'
                  }`}
                />
              )}
              {f === 'all' ? 'כל הכשירויות' : f === 'green' ? 'כשיר' : f === 'yellow' ? 'טעון בדיקה' : 'לא כשיר'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          לא נמצאו נהגים
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr className="text-right">
                <th className="px-4 py-3 font-medium text-muted-foreground w-10">כשירות</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">שם נהג</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">מ' עובד</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">חברה</th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">סוג</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-24">סטטוס</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((driver) => (
                <tr
                  key={driver.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/app/fleet/driver-card/${driver.id}`)}
                >
                  <td className="px-4 py-3">
                    <FitnessLight
                      licenseExpiryDate={driver.licenseExpiryDate}
                      documentMinExpiry={driver.documentMinExpiry}
                      yellowDays={yellowDays}
                      size="md"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{driver.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {driver.employeeNumber}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      {driver.companyName}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {driver.isOccasionalCampDriver && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Truck className="h-3 w-3" />
                          מחנה
                        </Badge>
                      )}
                      {driver.isEquipmentOperator && (
                        <Badge variant="secondary" className="text-xs">
                          צמ&quot;ה
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={driver.computedStatus === 'active' ? 'default' : 'secondary'}
                      className={
                        driver.computedStatus === 'active'
                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                          : ''
                      }
                    >
                      {driver.computedStatus === 'active' ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/fleet/driver-card/${driver.id}`}
                      className="flex items-center justify-center h-11 w-11 sm:h-8 sm:w-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="פתח כרטיס נהג"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddDriverDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
