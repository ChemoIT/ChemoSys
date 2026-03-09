'use client'

/**
 * FuelTable — data table for fuel records.
 * Matches VehicleList table styling (rounded-2xl, shadow-card, same colors).
 * Server-side pagination with page controls.
 */

import { Fuel, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, formatTime, formatLicensePlate, formatCurrency, formatNumber } from '@/lib/format'
import { FUEL_SUPPLIER_LABELS, FUEL_TYPE_LABELS, FUELING_METHOD_LABELS, FUEL_RECORDS_PER_PAGE } from '@/lib/fleet/fuel-types'
import type { FuelRecord } from '@/lib/fleet/fuel-types'

type Props = {
  records: FuelRecord[]
  total: number
  page: number
  onPageChange: (page: number) => void
  isPending: boolean
}

export function FuelTable({ records, total, page, onPageChange, isPending }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / FUEL_RECORDS_PER_PAGE))
  const from = (page - 1) * FUEL_RECORDS_PER_PAGE + 1
  const to = Math.min(page * FUEL_RECORDS_PER_PAGE, total)

  if (records.length === 0) {
    return (
      <div
        className="text-center py-16 text-muted-foreground text-sm bg-white rounded-2xl border border-border"
        style={{ boxShadow: 'var(--shadow-card)', opacity: isPending ? 0.6 : 1 }}
      >
        <Fuel className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="font-medium">אין רשומות תדלוק</p>
        <p className="text-xs mt-1 text-muted-foreground/60">נסה לשנות את הפילטרים או לבחור תקופה אחרת</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-x-auto bg-white border border-border"
      style={{ boxShadow: 'var(--shadow-card)', opacity: isPending ? 0.6 : 1, transition: 'opacity 200ms' }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-right border-b"
            style={{ background: '#F8FAFC', borderColor: '#E8EEF4' }}
          >
            <Th>תאריך</Th>
            <Th className="hidden sm:table-cell">שעה</Th>
            <Th>מספר רישוי</Th>
            <Th className="hidden md:table-cell">ספק</Th>
            <Th className="hidden md:table-cell">סוג דלק</Th>
            <Th className="hidden lg:table-cell">אמצעי</Th>
            <Th>כמות (ליטר)</Th>
            <Th className="hidden lg:table-cell">תחנה</Th>
            <Th className="hidden sm:table-cell">ברוטו ₪</Th>
            <Th>נטו ₪</Th>
            <Th className="hidden xl:table-cell">מונה ק״מ</Th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, idx) => (
            <tr
              key={r.id}
              className="transition-colors duration-100 hover:bg-accent/40"
              style={{
                borderBottom: idx < records.length - 1 ? '1px solid #EEF3F9' : 'none',
                minHeight: '44px',
              }}
            >
              {/* Date */}
              <Td>{formatDate(r.fuelingDate)}</Td>

              {/* Time */}
              <Td className="hidden sm:table-cell">{formatTime(r.fuelingTime)}</Td>

              {/* License plate */}
              <Td>
                <span className="font-mono font-semibold text-foreground" dir="ltr">
                  {formatLicensePlate(r.licensePlate)}
                </span>
              </Td>

              {/* Supplier */}
              <Td className="hidden md:table-cell">
                {FUEL_SUPPLIER_LABELS[r.fuelSupplier] ?? r.fuelSupplier}
              </Td>

              {/* Fuel type */}
              <Td className="hidden md:table-cell">
                {FUEL_TYPE_LABELS[r.fuelType] ?? r.fuelType}
              </Td>

              {/* Fueling method */}
              <Td className="hidden lg:table-cell">
                {r.fuelingMethod ? (FUELING_METHOD_LABELS[r.fuelingMethod] ?? r.fuelingMethod) : '—'}
              </Td>

              {/* Quantity */}
              <Td>{formatNumber(r.quantityLiters, 1)}</Td>

              {/* Station */}
              <Td className="hidden lg:table-cell max-w-[140px] truncate">
                {r.stationName ?? '—'}
              </Td>

              {/* Gross amount */}
              <Td className="hidden sm:table-cell">{formatCurrency(r.grossAmount)}</Td>

              {/* Net amount */}
              <Td>{formatCurrency(r.netAmount)}</Td>

              {/* Odometer */}
              <Td className="hidden xl:table-cell">
                {r.odometerKm != null ? (
                  <span className="flex items-center gap-1">
                    {formatNumber(r.odometerKm)}
                    {(r.odometerKm <= 0) && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    )}
                  </span>
                ) : '—'}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer with pagination */}
      <div
        className="px-4 py-2.5 flex items-center justify-between border-t"
        style={{ background: '#FAFCFE', borderColor: '#EEF3F9' }}
      >
        <span className="text-xs text-muted-foreground/60">
          מציג {from}–{to} מתוך {total} רשומות
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <PaginationButton
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isPending}
              aria-label="עמוד קודם"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </PaginationButton>

            <span className="text-xs font-medium text-muted-foreground px-2">
              {page} / {totalPages}
            </span>

            <PaginationButton
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isPending}
              aria-label="עמוד הבא"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </PaginationButton>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Table cell helpers ───────────────────────────────────

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-3.5 text-muted-foreground ${className}`}>
      {children}
    </td>
  )
}

function PaginationButton({
  children,
  onClick,
  disabled,
  ...rest
}: {
  children: React.ReactNode
  onClick: () => void
  disabled: boolean
  [key: string]: unknown
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center h-7 w-7 rounded-lg border border-border bg-white text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      {...rest}
    >
      {children}
    </button>
  )
}
