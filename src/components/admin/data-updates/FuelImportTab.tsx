'use client'

/**
 * FuelImportTab — Monthly fuel import from supplier CSV/XLSX files.
 *
 * Supports: Delek (CSV) and Dalkal/Gnergy (XLSX + CSV).
 * Auto-detects supplier, encoding, and column mapping from file headers.
 *
 * Flow: upload → preview (dry-run) → importing → complete
 */

import { useState, useRef, useTransition } from 'react'
import {
  Upload, Loader2, CheckCircle, AlertCircle, FileText,
  ChevronDown, ChevronUp, Fuel, Gauge, CalendarRange, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatDate, formatLicensePlate } from '@/lib/format'
import {
  FUEL_SUPPLIER_LABELS,
  FUEL_TYPE_LABELS,
  type SupplierDryRunReport,
  type SupplierImportResult,
} from '@/lib/fleet/fuel-types'
import {
  dryRunSupplierImportAction,
  executeSupplierImportAction,
} from '@/actions/fleet/import-fuel-supplier'

export function FuelImportTab() {
  const [phase, setPhase] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [report, setReport] = useState<SupplierDryRunReport | null>(null)
  const [result, setResult] = useState<SupplierImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [progress, setProgress] = useState(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showUnmatched, setShowUnmatched] = useState(false)
  const [showParseErrors, setShowParseErrors] = useState(false)

  // ── Handlers ──────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setError(null)
  }

  function handleDryRun() {
    if (!selectedFile) return
    setError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const res = await dryRunSupplierImportAction(formData)

      if (!res.success || !res.report) {
        setError(res.error ?? 'שגיאה לא ידועה')
        return
      }
      setReport(res.report)
      setPhase('preview')
    })
  }

  function handleImport() {
    if (!selectedFile || !report) return

    setPhase('importing')
    setProgress(0)
    const total = report.fuelRecords + report.kmRecords
    const step = total > 0 ? 90 / Math.ceil(total / 200) : 90
    let current = 0
    progressIntervalRef.current = setInterval(() => {
      current = Math.min(current + step, 90)
      setProgress(current)
    }, 500)

    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const res = await executeSupplierImportAction(formData)

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setProgress(100)
      setResult(res)
      setPhase('complete')
    })
  }

  function handleReset() {
    setPhase('upload')
    setSelectedFile(null)
    setReport(null)
    setResult(null)
    setError(null)
    setProgress(0)
    setShowUnmatched(false)
    setShowParseErrors(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-4">
      {/* ── Upload ── */}
      {phase === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5" />
              ייבוא קובץ ספק דלק
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                בחר קובץ CSV או XLSX מספק הדלק
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-base file:ml-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary-foreground"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              המערכת תזהה אוטומטית את הספק (דלק / דלקל) ואת הקידוד מתוך כותרות הקובץ.
              ניתן לייבא את אותו קובץ שוב — רשומות קיימות יעודכנו אוטומטית.
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              onClick={handleDryRun}
              disabled={!selectedFile || isPending}
              className="min-h-[44px] min-w-[120px]"
            >
              {isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  בודק...
                </>
              ) : (
                <>
                  <FileText className="ml-2 h-4 w-4" />
                  בדיקה ללא ייבוא
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              לייבוא נתוני עבר מקבצי CarLog.top, עבור ל:{' '}
              <a href="/admin/fleet/import-carlog" className="text-primary underline underline-offset-4 hover:text-primary/80">
                ייבוא CarLog.top
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Preview ── */}
      {phase === 'preview' && report && (
        <>
          {/* Supplier & encoding detection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                סיכום בדיקה — {report.fileName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className="text-sm">
                  ספק: {FUEL_SUPPLIER_LABELS[report.detectedSupplier] ?? report.detectedSupplier}
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  קידוד: {report.detectedEncoding}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox label="סה״כ שורות" value={report.totalRows} />
                <StatBox label="תדלוקים" value={report.fuelRecords} icon={<Fuel className="h-4 w-4" />} variant="success" />
                <StatBox label='דיווחי ק"מ' value={report.kmRecords} icon={<Gauge className="h-4 w-4" />} variant="info" />
                <StatBox label="דולגו" value={report.skippedRows} variant="muted" />
              </div>

              {/* New vs Update breakdown */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox label="תדלוקים חדשים" value={report.newFuelRecords} variant="success" />
                <StatBox label="תדלוקים לעדכון" value={report.updatedFuelRecords} variant="warning" />
                {report.kmRecords > 0 && (
                  <>
                    <StatBox label='ק"מ חדשים' value={report.newKmRecords} variant="success" />
                    <StatBox label='ק"מ לעדכון' value={report.updatedKmRecords} variant="warning" />
                  </>
                )}
              </div>

              {/* Date range */}
              {report.dateRange && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarRange className="h-4 w-4" />
                  <span>טווח תאריכים: {formatDate(report.dateRange.from)} — {formatDate(report.dateRange.to)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer warnings */}
          {report.customerWarnings > 0 && (
            <Card className="border-yellow-300 bg-yellow-50/50">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    {report.customerWarnings} שורות ללא &quot;חמו אהרון&quot; בשדה לקוח
                  </p>
                  <p className="text-xs text-yellow-600">
                    ייתכן שמדובר ברשומות של לקוח אחר. הרשומות ייובאו אך כדאי לבדוק.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">התאמה לרכבים בצי</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatBox label="רשומות מותאמות" value={report.matchedPlates} variant="success" />
                <StatBox
                  label="לא מותאמות (חריגים)"
                  value={report.unmatchedPlates}
                  variant={report.unmatchedPlates > 0 ? 'warning' : 'muted'}
                />
                <StatBox
                  label="לוחות ייחודיים לא מותאמים"
                  value={report.unmatchedDetails.length}
                  variant={report.unmatchedDetails.length > 0 ? 'warning' : 'muted'}
                />
              </div>

              {report.unmatchedDetails.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowUnmatched(!showUnmatched)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showUnmatched ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    הצג {report.unmatchedDetails.length} לוחות לא מותאמים
                  </button>
                  {showUnmatched && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 text-sm">
                      {report.unmatchedDetails.map((u, i) => (
                        <div key={i} className="flex justify-between border-b border-border/50 py-1 last:border-0">
                          <span className="font-mono">{formatLicensePlate(u.licensePlate)}</span>
                          <Badge variant="secondary">{u.count} רשומות</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fuel type breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">פירוט סוגי דלק</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.fuelTypeBreakdown.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{FUEL_TYPE_LABELS[f.fuelType] ?? f.fuelType}</span>
                    <Badge variant="outline">{f.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Parse errors */}
          {report.parseErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  שגיאות פירסור
                  <button
                    onClick={() => setShowParseErrors(!showParseErrors)}
                    className="text-sm font-normal text-muted-foreground hover:text-foreground"
                  >
                    {showParseErrors ? 'הסתר' : 'הצג'} ({report.parseErrors.length})
                  </button>
                </CardTitle>
              </CardHeader>
              {showParseErrors && (
                <CardContent>
                  <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 text-sm font-mono">
                    {report.parseErrors.map((err, i) => (
                      <div key={i} className="py-0.5 text-destructive/80">{err}</div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={(report.fuelRecords + report.kmRecords) === 0 || isPending}
              className="min-h-[44px] min-w-[160px]"
            >
              {isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מייבא...
                </>
              ) : (
                <>
                  <Upload className="ml-2 h-4 w-4" />
                  אישור ייבוא ({report.newFuelRecords} חדשים{report.updatedFuelRecords > 0 ? ` + ${report.updatedFuelRecords} עדכונים` : ''}{report.kmRecords > 0 ? ` + ${report.kmRecords} ק״מ` : ''})
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleReset} className="min-h-[44px]">
              ביטול
            </Button>
          </div>
        </>
      )}

      {/* ── Importing ── */}
      {phase === 'importing' && (
        <Card>
          <CardContent className="space-y-4 py-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-lg font-medium">
                מייבא {report ? report.fuelRecords + report.kmRecords : 0} רשומות...
              </p>
              <p className="text-sm text-muted-foreground">
                אנא המתן, התהליך עשוי להימשך מספר דקות
              </p>
            </div>
            <Progress value={progress} className="mx-auto max-w-md" />
            <div className="text-center">
              <Button variant="outline" onClick={handleReset} className="min-h-[44px]">
                ביטול
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Complete ── */}
      {phase === 'complete' && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              {result.success ? 'ייבוא הושלם בהצלחה' : 'ייבוא הושלם עם שגיאות'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatBox label="תדלוקים יובאו" value={result.fuelInserted} variant="success" />
              <StatBox label='דיווחי ק"מ יובאו' value={result.kmInserted} variant="info" />
              <StatBox label="רשומות עודכנו" value={result.recordsUpdated} variant="warning" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatBox label="רכבים מותאמים" value={result.matchedCount} variant="success" />
              <StatBox
                label="לא מותאמים (חריגים)"
                value={result.unmatchedCount}
                variant={result.unmatchedCount > 0 ? 'warning' : 'muted'}
              />
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <div className="mb-1 text-sm font-medium text-destructive">
                  {result.errors.length} שגיאות:
                </div>
                <div className="max-h-48 overflow-y-auto text-sm text-destructive/80">
                  {result.errors.map((err, i) => (
                    <div key={i} className="py-0.5">{err}</div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleReset} variant="outline" className="min-h-[44px]">
              ייבוא קובץ נוסף
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// StatBox helper
// ─────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  variant = 'default',
  icon,
}: {
  label: string
  value: number
  variant?: 'default' | 'success' | 'warning' | 'info' | 'muted'
  icon?: React.ReactNode
}) {
  const colors = {
    default: 'bg-background text-foreground',
    success: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
    warning: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    muted: 'bg-muted text-muted-foreground',
  }

  return (
    <div className={`rounded-lg border p-3 text-center ${colors[variant]}`}>
      {icon && <div className="flex justify-center mb-1">{icon}</div>}
      <div className="text-2xl font-bold">{value.toLocaleString('he-IL')}</div>
      <div className="text-xs">{label}</div>
    </div>
  )
}
