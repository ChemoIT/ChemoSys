'use client'

/**
 * FuelTable — data table for fuel records.
 * Matches VehicleList table styling (rounded-2xl, shadow-card, same colors).
 * Server-side pagination and sorting with page controls.
 */

import { Fuel, AlertTriangle, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { formatDate, formatTime, formatLicensePlate, formatCurrency, formatNumber } from '@/lib/format'
import { FUEL_SUPPLIER_LABELS, FUEL_TYPE_LABELS, FUELING_METHOD_LABELS, FUEL_RECORDS_PER_PAGE } from '@/lib/fleet/fuel-types'
import type { FuelRecord, FuelSortField } from '@/lib/fleet/fuel-types'

type Props = {
  records: FuelRecord[]
  total: number
  page: number
  onPageChange: (page: number) => void
  isPending: boolean
  sortBy: FuelSortField
  sortDir: 'asc' | 'desc'
  onSort: (field: FuelSortField) => void
}

export function FuelTable({ records, total, page, onPageChange, isPending, sortBy, sortDir, onSort }: Props) {
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
            <SortTh field="fueling_date" current={sortBy} dir={sortDir} onSort={onSort}>תאריך</SortTh>
            <SortTh field="fueling_time" current={sortBy} dir={sortDir} onSort={onSort} className="hidden sm:table-cell">שעה</SortTh>
            <SortTh field="license_plate" current={sortBy} dir={sortDir} onSort={onSort}>מספר רישוי</SortTh>
            <Th className="hidden md:table-cell">נהג</Th>
            <Th className="hidden md:table-cell">פרויקט</Th>
            <SortTh field="fuel_supplier" current={sortBy} dir={sortDir} onSort={onSort} className="hidden lg:table-cell">ספק</SortTh>
            <SortTh field="fuel_type" current={sortBy} dir={sortDir} onSort={onSort} className="hidden lg:table-cell">סוג דלק</SortTh>
            <SortTh field="fueling_method" current={sortBy} dir={sortDir} onSort={onSort} className="hidden xl:table-cell">אמצעי</SortTh>
            <SortTh field="quantity_liters" current={sortBy} dir={sortDir} onSort={onSort}>כמות (ליטר)</SortTh>
            <SortTh field="station_name" current={sortBy} dir={sortDir} onSort={onSort} className="hidden lg:table-cell">תחנה</SortTh>
            <SortTh field="net_amount" current={sortBy} dir={sortDir} onSort={onSort} className="hidden sm:table-cell">נטו ₪</SortTh>
            <SortTh field="odometer_km" current={sortBy} dir={sortDir} onSort={onSort} className="hidden xl:table-cell">מונה ק״מ</SortTh>
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
              {/* תאריך */}
              <Td>{formatDate(r.fuelingDate)}</Td>

              {/* שעה */}
              <Td className="hidden sm:table-cell">{formatTime(r.fuelingTime)}</Td>

              {/* מספר רישוי */}
              <Td>
                <span className="font-mono font-semibold text-foreground" dir="ltr">
                  {formatLicensePlate(r.licensePlate)}
                </span>
              </Td>

              {/* נהג (בזמן התדלוק) */}
              <Td className="hidden md:table-cell max-w-[120px] truncate">
                {r.driverName ?? '—'}
              </Td>

              {/* פרויקט (בזמן התדלוק) */}
              <Td className="hidden md:table-cell max-w-[140px] truncate">
                {r.projectName ?? '—'}
              </Td>

              {/* ספק */}
              <Td className="hidden lg:table-cell">
                {FUEL_SUPPLIER_LABELS[r.fuelSupplier] ?? r.fuelSupplier}
              </Td>

              {/* סוג דלק */}
              <Td className="hidden lg:table-cell">
                {FUEL_TYPE_LABELS[r.fuelType] ?? r.fuelType}
              </Td>

              {/* אמצעי */}
              <Td className="hidden xl:table-cell">
                {r.fuelingMethod === 'card' && r.fuelCardNumber
                  ? `${FUELING_METHOD_LABELS['card']} ${r.fuelCardNumber}`
                  : r.fuelingMethod ? (FUELING_METHOD_LABELS[r.fuelingMethod] ?? r.fuelingMethod) : '—'}
              </Td>

              {/* כמות */}
              <Td>{formatNumber(r.quantityLiters, 1)}</Td>

              {/* תחנה */}
              <Td className="hidden lg:table-cell max-w-[140px] truncate">
                {r.stationName ?? '—'}
              </Td>

              {/* עלות נטו */}
              <Td className="hidden sm:table-cell">{formatCurrency(r.netAmount)}</Td>

              {/* מונה ק"מ */}
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

function SortTh({
  field,
  current,
  dir,
  onSort,
  children,
  className = '',
}: {
  field: FuelSortField
  current: FuelSortField
  dir: 'asc' | 'desc'
  onSort: (field: FuelSortField) => void
  children: React.ReactNode
  className?: string
}) {
  const isActive = current === field
  return (
    <th
      className={`px-3 py-3 font-semibold text-xs uppercase tracking-wide select-none cursor-pointer hover:text-foreground transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground'} ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          dir === 'asc'
            ? <ArrowUp className="h-3 w-3" />
            : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3 opacity-0 group-hover:opacity-30" />
        )}
      </span>
    </th>
  )
}

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
