'use client'

/**
 * CarLogImportSection — Import fuel records from legacy CarLog.top files.
 *
 * Two-phase flow:
 *   1. Upload .top file → dry-run (shows summary: fuel/km/matched/unmatched)
 *   2. Approve → execute import with progress feedback
 *
 * Sits inside FleetSettings page, alongside Drivers/Vehicles/Projects imports.
 */

import { useState, useRef, useTransition, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Upload, FileCheck2, AlertTriangle, CheckCircle2, Loader2, X, Fuel, Gauge, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatDate, formatLicensePlate } from '@/lib/format'
import {
  FUEL_SUPPLIER_LABELS,
  FUEL_TYPE_LABELS,
  type CarLogDryRunReport,
  type CarLogImportResult,
} from '@/lib/fleet/fuel-types'
import {
  dryRunCarLogImportAction,
  executeCarLogImportAction,
} from '@/actions/fleet/import-carlog'

type Phase = 'idle' | 'checking' | 'reviewed' | 'importing' | 'done'

export function CarLogImportSection() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [report, setReport] = useState<CarLogDryRunReport | null>(null)
  const [importResult, setImportResult] = useState<CarLogImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileDataRef = useRef<File | null>(null)

  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [isChecking, startCheckTransition] = useTransition()
  const [isImporting, startImportTransition] = useTransition()

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const startProgress = useCallback((totalItems: number) => {
    setProgress(0)
    const step = totalItems > 0 ? 90 / Math.ceil(totalItems / 200) : 45
    let current = 0
    intervalRef.current = setInterval(() => {
      current = Math.min(current + step, 92)
      setProgress(current)
    }, 400)
  }, [])

  const stopProgress = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setProgress(100)
  }, [])

  // ── File selection ──────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    fileDataRef.current = file
    setFileName(file.name)
    setError(null)
    setReport(null)
    setImportResult(null)
    setPhase('idle')
  }

  function clearFile() {
    if (fileRef.current) fileRef.current.value = ''
    fileDataRef.current = null
    setFileName(null)
    setError(null)
    setReport(null)
    setImportResult(null)
    setPhase('idle')
  }

  // ── Dry-run ──────────────────────────────────────────────

  function handleCheck() {
    if (!fileDataRef.current) return
    setPhase('checking')
    setError(null)

    startCheckTransition(async () => {
      const formData = new FormData()
      formData.append('file', fileDataRef.current!)
      const res = await dryRunCarLogImportAction(formData)

      if (!res.success || !res.report) {
        setError(res.error ?? 'שגיאה לא ידועה')
        setPhase('idle')
        return
      }
      setReport(res.report)
      setPhase('reviewed')
    })
  }

  // ── Execute ──────────────────────────────────────────────

  function handleImport() {
    if (!fileDataRef.current || !report) return
    const total = report.fuelRecords + report.kmRecords
    setPhase('importing')
    startProgress(total)

    startImportTransition(async () => {
      const formData = new FormData()
      formData.append('file', fileDataRef.current!)
      const res = await executeCarLogImportAction(formData)
      stopProgress()
      setImportResult(res)
      setPhase('done')

      if (res.success) {
        toast.success(`ייבוא הושלם: ${res.fuelInserted} תדלוקים, ${res.kmInserted} ק"מ`)
      } else {
        toast.warning(`ייבוא הושלם עם ${res.errors.length} שגיאות`)
      }
    })
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground border-b pb-1 flex items-center gap-2">
        <Fuel className="h-4 w-4" />
        ייבוא CarLog.top (תדלוקים + ק״מ)
        <Badge variant="outline" className="text-[10px] font-normal">זמני</Badge>
      </h3>
      <p className="text-xs text-muted-foreground">
        ייבוא נתוני תדלוקים ודיווחי ק״מ מקבצי CarLog.top (שנת 2018 ואילך).
        כפילויות מזוהות אוטומטית ונדלגות.
      </p>

      {/* File picker */}
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".top"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={isChecking || isImporting}
        >
          <Upload className="h-4 w-4 ms-2" />
          בחר קובץ .top
        </Button>

        {fileName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-muted-foreground">{fileName}</span>
            <button
              onClick={clearFile}
              className="text-muted-foreground hover:text-foreground"
              disabled={isChecking || isImporting}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Check button */}
      {phase === 'idle' && fileName && (
        <Button
          type="button"
          size="sm"
          onClick={handleCheck}
          disabled={isChecking}
        >
          {isChecking ? <Loader2 className="h-4 w-4 ms-2 animate-spin" /> : <FileCheck2 className="h-4 w-4 ms-2" />}
          בדיקה ללא ייבוא
        </Button>
      )}

      {/* Dry-run results */}
      {phase === 'reviewed' && report && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileCheck2 className="h-4 w-4 text-green-600" />
            תוצאות בדיקה — {report.fileName}
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
            <div className="rounded border bg-background p-2">
              <div className="text-lg font-bold">{report.totalLines}</div>
              <div className="text-[11px] text-muted-foreground">סה״כ שורות</div>
            </div>
            <div className="rounded border bg-green-50 p-2 text-green-700">
              <div className="text-lg font-bold flex items-center justify-center gap-1">
                <Fuel className="h-3.5 w-3.5" />{report.fuelRecords}
              </div>
              <div className="text-[11px]">תדלוקים</div>
            </div>
            <div className="rounded border bg-blue-50 p-2 text-blue-700">
              <div className="text-lg font-bold flex items-center justify-center gap-1">
                <Gauge className="h-3.5 w-3.5" />{report.kmRecords}
              </div>
              <div className="text-[11px]">דיווחי ק״מ</div>
            </div>
            <div className="rounded border bg-background p-2 text-muted-foreground">
              <div className="text-lg font-bold">{report.skippedLines}</div>
              <div className="text-[11px]">דולגו</div>
            </div>
          </div>

          {/* Matching */}
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <div className="rounded border bg-green-50 p-2 text-green-700">
              <div className="text-lg font-bold">{report.matchedPlates}</div>
              <div className="text-[11px]">רשומות מותאמות</div>
            </div>
            <div className={`rounded border p-2 ${report.unmatchedPlates > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-background text-muted-foreground'}`}>
              <div className="text-lg font-bold">{report.unmatchedPlates}</div>
              <div className="text-[11px]">חריגים (לא בצי)</div>
            </div>
          </div>

          {/* Date range */}
          {report.dateRange && (
            <div className="text-xs text-muted-foreground">
              טווח תאריכים: {formatDate(report.dateRange.from)} — {formatDate(report.dateRange.to)}
            </div>
          )}

          {/* Supplier breakdown */}
          {report.supplierBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.supplierBreakdown.map((s, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {FUEL_SUPPLIER_LABELS[s.supplier] ?? s.supplier}: {s.count}
                </Badge>
              ))}
              {report.fuelTypeBreakdown.map((f, i) => (
                <Badge key={`ft-${i}`} variant="secondary" className="text-xs">
                  {FUEL_TYPE_LABELS[f.fuelType] ?? f.fuelType}: {f.count}
                </Badge>
              ))}
            </div>
          )}

          {/* Unmatched plates */}
          {report.unmatchedDetails.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {report.unmatchedDetails.length} לוחות לא מותאמים
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto rounded border bg-background p-2 space-y-0.5">
                {report.unmatchedDetails.map((u, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="font-mono">{formatLicensePlate(u.licensePlate)}</span>
                    <span className="text-muted-foreground">{u.count} רשומות</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Parse errors */}
          {report.parseErrors.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-yellow-600">
                {report.parseErrors.length} שגיאות פירסור
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto rounded border bg-background p-2 font-mono text-destructive/70 space-y-0.5">
                {report.parseErrors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            </details>
          )}

          {/* Import button */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              disabled={isImporting || (report.fuelRecords + report.kmRecords) === 0}
            >
              <Upload className="h-4 w-4 ms-2" />
              אישור ייבוא ({report.fuelRecords} תדלוקים + {report.kmRecords} ק״מ)
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearFile}>
              ביטול
            </Button>
          </div>
        </div>
      )}

      {/* Importing progress */}
      {phase === 'importing' && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            מייבא {report ? report.fuelRecords + report.kmRecords : 0} רשומות...
          </div>
          <Progress value={progress} className="max-w-md" />
        </div>
      )}

      {/* Done */}
      {phase === 'done' && importResult && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            {importResult.success
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <AlertTriangle className="h-4 w-4 text-yellow-600" />
            }
            {importResult.success ? 'ייבוא הושלם בהצלחה' : 'ייבוא הושלם עם שגיאות'}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded border bg-green-50 p-2 text-green-700">
              <div className="text-lg font-bold">{importResult.fuelInserted}</div>
              <div className="text-[11px]">תדלוקים יובאו</div>
            </div>
            <div className="rounded border bg-blue-50 p-2 text-blue-700">
              <div className="text-lg font-bold">{importResult.kmInserted}</div>
              <div className="text-[11px]">ק״מ יובאו</div>
            </div>
            <div className="rounded border bg-background p-2 text-muted-foreground">
              <div className="text-lg font-bold">{importResult.duplicatesSkipped}</div>
              <div className="text-[11px]">כפילויות דולגו</div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-destructive">
                {importResult.errors.length} שגיאות
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto rounded border bg-background p-2 text-destructive/70 space-y-0.5">
                {importResult.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            </details>
          )}

          <Button type="button" variant="outline" size="sm" onClick={clearFile}>
            <RefreshCw className="h-4 w-4 ms-2" />
            ייבוא קובץ נוסף
          </Button>
        </div>
      )}
    </div>
  )
}
