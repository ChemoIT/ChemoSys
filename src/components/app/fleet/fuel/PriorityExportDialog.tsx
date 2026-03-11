'use client'

/**
 * PriorityExportDialog — Dialog for generating Priority ERP fuel report.
 *
 * Select month, year, and supplier → downloads Excel file.
 * Calls /api/fleet/priority-export Route Handler.
 */

import { useState } from 'react'
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  FUEL_SUPPLIER_LABELS,
  HEBREW_MONTHS,
} from '@/lib/fleet/fuel-types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const YEAR_RANGE = Array.from({ length: 7 }, (_, i) => 2024 + i)
const SUPPLIERS = Object.entries(FUEL_SUPPLIER_LABELS) // [['delek','דלק'], ...]

export function PriorityExportDialog({ open, onOpenChange }: Props) {
  const now = new Date()
  // Default to previous month
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth() // 1-based
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)
  const [supplier, setSupplier] = useState('dalkal')
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
        supplier,
      })

      const res = await fetch(`/api/fleet/priority-export?${params}`)

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Export failed')
      }

      // Download the file
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `priority_${supplier}_${year}_${String(month).padStart(2, '0')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const supplierName = FUEL_SUPPLIER_LABELS[supplier] ?? supplier
      const monthName = HEBREW_MONTHS[month] ?? String(month)
      toast.success(`דוח פריוריטי הופק: ${supplierName} — ${monthName} ${year}`)
      onOpenChange(false)
    } catch (err) {
      console.error('[priority-export]', err)
      toast.error('שגיאה בהפקת הדוח')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            ייצוא דוח לפריוריטי
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

          {/* ── Supplier ── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">ספק</Label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {SUPPLIERS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* ── Export button ── */}
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-medium"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                מייצר דוח...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 ml-2" />
                הפקת דוח Excel
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
