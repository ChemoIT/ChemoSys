'use client'

import { useState, useEffect } from 'react'

/**
 * FleetDateInput — three-select date picker in dd/mm/yyyy order.
 *
 * Shared component — used by driver sections (documents, license, violations)
 * and will be used by vehicle sections in Phase 14+.
 *
 * Props:
 *   value    — yyyy-mm-dd string (DB format) or ''
 *   onChange  — emits yyyy-mm-dd when all three fields are filled, '' when cleared
 *   minYear  — earliest selectable year (default 2010)
 *   maxYear  — latest selectable year (default current + 20)
 *   className — optional wrapper class
 */

type FleetDateInputProps = {
  value: string
  onChange: (value: string) => void
  minYear?: number
  maxYear?: number
  className?: string
}

export function FleetDateInput({
  value,
  onChange,
  minYear = 2010,
  maxYear,
  className,
}: FleetDateInputProps) {
  const currentYear = new Date().getFullYear()
  const maxY = maxYear ?? currentYear + 20

  // Internal state for partial selections
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')

  // Sync internal state from external value changes (e.g. quick-expiry buttons)
  useEffect(() => {
    if (value) {
      const parts = value.split('-')
      if (parts.length === 3) {
        setYear(parts[0])
        setMonth(parts[1])
        setDay(parts[2])
      }
    } else {
      setDay('')
      setMonth('')
      setYear('')
    }
  }, [value])

  function emit(d: string, m: string, y: string) {
    if (d && m && y) {
      onChange(`${y}-${m}-${d}`)
    } else if (!d && !m && !y) {
      onChange('')
    }
    // Partial selection — don't emit yet, keep local state
  }

  /** True if at least one field is selected */
  function hasPartial(): boolean {
    return day !== '' || month !== '' || year !== ''
  }

  const selectClass =
    'border border-border rounded-lg px-2 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-center appearance-none cursor-pointer'

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`} dir="ltr">
      <select
        value={day}
        onChange={(e) => { setDay(e.target.value); emit(e.target.value, month, year) }}
        className={`${selectClass} w-[4.5rem]`}
      >
        <option value="">יום</option>
        {Array.from({ length: 31 }, (_, i) => {
          const v = String(i + 1).padStart(2, '0')
          return (
            <option key={v} value={v}>
              {i + 1}
            </option>
          )
        })}
      </select>
      <span className="text-muted-foreground font-medium">/</span>
      <select
        value={month}
        onChange={(e) => { setMonth(e.target.value); emit(day, e.target.value, year) }}
        className={`${selectClass} w-[4.5rem]`}
      >
        <option value="">חודש</option>
        {Array.from({ length: 12 }, (_, i) => {
          const v = String(i + 1).padStart(2, '0')
          return (
            <option key={v} value={v}>
              {i + 1}
            </option>
          )
        })}
      </select>
      <span className="text-muted-foreground font-medium">/</span>
      <select
        value={year}
        onChange={(e) => { setYear(e.target.value); emit(day, month, e.target.value) }}
        className={`${selectClass} w-[5.5rem]`}
      >
        <option value="">שנה</option>
        {Array.from({ length: maxY - minYear + 1 }, (_, i) => {
          const y = maxY - i
          return (
            <option key={y} value={String(y)}>
              {y}
            </option>
          )
        })}
      </select>
    </div>
  )
}
