'use client'

/**
 * FuelImportTab — fuel data import interface.
 *
 * UI shell includes:
 *   1. Upload zone for Excel/CSV files
 *   2. Import parameters (month, year, supplier)
 *   3. Import button (placeholder — actual parsing built later)
 *   4. Import history table
 *
 * The actual Excel parsing logic (HEADER_MAP + detectColumns pattern)
 * will be implemented in a future session.
 */

import { useState, useRef } from 'react'
import { FileSpreadsheet, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'
import {
  FUEL_SUPPLIER_LABELS,
  HEBREW_MONTHS,
} from '@/lib/fleet/fuel-types'
import type { FuelImportBatch } from '@/lib/fleet/fuel-types'

type Props = {
  initialBatches: FuelImportBatch[]
}

const YEAR_RANGE = Array.from({ length: 7 }, (_, i) => 2024 + i)

export function FuelImportTab({ initialBatches }: Props) {
  const now = new Date()
  const [file, setFile] = useState<File | null>(null)
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [supplier, setSupplier] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canImport = file && supplier

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  const handleImport = () => {
    toast.info('ייבוא דלק עדיין לא מומש — יבנה בסשן הבא')
  }

  return (
    <div className="space-y-6">
      {/* ── Upload + Parameters Card ──────────────────── */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-5"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <h2 className="text-base font-semibold text-foreground">ייבוא גיליון תדלוקים</h2>

        {/* Upload zone */}
        <div
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/5"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                גרור קובץ Excel או CSV לכאן, או לחץ לבחירת קובץ
              </p>
              <p className="text-xs text-muted-foreground/60">
                פורמטים נתמכים: .xlsx, .xls, .csv
              </p>
            </div>
          )}
        </div>

        {/* Import parameters */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Month */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">חודש</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="block border border-border rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 w-32"
            >
              {Object.entries(HEBREW_MONTHS).map(([num, name]) => (
                <option key={num} value={num}>{name}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">שנה</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="block border border-border rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 w-28"
            >
              {YEAR_RANGE.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Supplier */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ספק דלק</label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="block border border-border rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 w-32"
            >
              <option value="">בחר ספק...</option>
              {Object.entries(FUEL_SUPPLIER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Import button */}
          <Button
            onClick={handleImport}
            disabled={!canImport}
            size="lg"
            className="gap-2 shrink-0 shadow-sm"
            style={canImport ? {
              background: 'linear-gradient(135deg, #4ECDC4 0%, #3ABFB6 100%)',
              border: 'none',
            } : {}}
          >
            <Upload className="h-4 w-4" />
            ייבוא
          </Button>
        </div>
      </div>

      {/* ── Import History ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="px-4 py-3 border-b" style={{ background: '#F8FAFC', borderColor: '#E8EEF4' }}>
          <h3 className="text-sm font-semibold text-muted-foreground">היסטוריית ייבואים</h3>
        </div>

        {initialBatches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p>טרם בוצעו ייבואים</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right border-b" style={{ background: '#F8FAFC', borderColor: '#E8EEF4' }}>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">תאריך ייבוא</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">ספק</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">חודש</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">שנה</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">רשומות</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">תואמים</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">לא תואמים</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {initialBatches.map((batch, idx) => (
                <tr
                  key={batch.id}
                  style={{ borderBottom: idx < initialBatches.length - 1 ? '1px solid #EEF3F9' : 'none' }}
                >
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(batch.createdAt)}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {FUEL_SUPPLIER_LABELS[batch.fuelSupplier] ?? batch.fuelSupplier}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {HEBREW_MONTHS[batch.importMonth] ?? batch.importMonth}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{batch.importYear}</td>
                  <td className="px-3 py-3 text-muted-foreground">{batch.recordCount ?? '—'}</td>
                  <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{batch.matchedCount ?? '—'}</td>
                  <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{batch.unmatchedCount ?? '—'}</td>
                  <td className="px-3 py-3">
                    <ImportStatusBadge status={batch.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ImportStatusBadge({ status }: { status: string | null }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
        הושלם
      </span>
    )
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        חלקי
      </span>
    )
  }
  return <span className="text-muted-foreground">—</span>
}
