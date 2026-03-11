'use client'

/**
 * FuelAnomalyDialog — Dialog for generating fuel anomaly report.
 *
 * Select month and year → downloads Excel file with color-coded anomalies:
 * - Red: vehicle not in fleet / not active
 * - Orange: monthly quantity exceeded
 * - Green: OK
 *
 * Calls /api/fleet/fuel-anomaly-export Route Handler.
 */

import { useState } from 'react'
import { AlertTriangle, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { HEBREW_MONTHS } from '@/lib/fleet/fuel-types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const YEAR_RANGE = Array.from({ length: 7 }, (_, i) => 2024 + i)

export function FuelAnomalyDialog({ open, onOpenChange }: Props) {
  const now = new Date()
  // Default to previous month
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth() // 1-based
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      })

      const res = await fetch(`/api/fleet/fuel-anomaly-export?${params}`)

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Export failed')
      }

      // Download the file
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fuel_anomalies_${year}_${String(month).padStart(2, '0')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const monthName = HEBREW_MONTHS[month] ?? String(month)
      toast.success(`דוח חריגים הופק: ${monthName} ${year}`)
      onOpenChange(false)
    } catch (err) {
      console.error('[fuel-anomaly-export]', err)
      toast.error('שגיאה בהפקת דוח החריגים')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            דוח חריגים דלק
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* ── Month ── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">חודש</Label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {Object.entries(HEBREW_MONTHS).map(([num, name]) => (
                <option key={num} value={num}>{name}</option>
              ))}
            </select>
          </div>

          {/* ── Year ── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">שנה</Label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {YEAR_RANGE.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* ── Legend ── */}
          <div className="rounded-md border border-border p-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="font-medium text-foreground text-sm">מקרא צבעים:</div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded bg-red-500" />
              <span>רכב לא מוכר בצי / לא פעיל</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded bg-orange-300" />
              <span>חריגת כמות מהמכסה החודשית</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded bg-green-200" />
              <span>תקין</span>
            </div>
          </div>

          {/* ── Export button ── */}
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-medium"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                מייצר דוח חריגים...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 ml-2" />
                הפקת דוח חריגים
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
