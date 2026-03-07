'use client'

/**
 * DriversImportPage — Temporary UI for importing drivers from Drivers.top files.
 *
 * Flow:
 *   1. Upload .top file → dry-run (no writes)
 *   2. Review summary: matched/unmatched/insert/update counts
 *   3. Confirm → execute import with progress
 *   4. Show results
 *
 * Will be removed after development phase is complete.
 */

import { useState, useRef, useTransition } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  dryRunDriverImportAction,
  executeDriverImportAction,
  type DryRunReport,
  type ImportResult,
} from '@/actions/fleet/import-drivers'

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DriversImportPage() {
  const [phase, setPhase] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [report, setReport] = useState<DryRunReport | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [progress, setProgress] = useState(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Expand/collapse sections
  const [showUnmatched, setShowUnmatched] = useState(false)
  const [showDataQuality, setShowDataQuality] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)

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
      const res = await dryRunDriverImportAction(formData)

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

    // Start progress animation
    setPhase('importing')
    setProgress(0)
    const total = report.matched.total
    const step = total > 0 ? 90 / total : 90
    let current = 0
    progressIntervalRef.current = setInterval(() => {
      current = Math.min(current + step, 90)
      setProgress(current)
    }, 150)

    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const res = await executeDriverImportAction(formData)

      // Stop progress animation
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-4" dir="rtl">
      {/* ── Step 1: Upload ── */}
      {phase === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5" />
              העלאת קובץ Drivers.top
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                בחר קובץ .top מתוך מערכת CarList
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".top"
                onChange={handleFileChange}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-base file:ml-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary-foreground"
              />
            </div>

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
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Preview ── */}
      {phase === 'preview' && report && (
        <>
          {/* Summary card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">סיכום בדיקה</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox label="סה״כ שורות" value={report.totalRows} />
                <StatBox label="תקינות" value={report.validRows} />
                <StatBox label="דולגו" value={report.totalRows - report.validRows} variant="muted" />
                <StatBox label="ציוד מכני" value={report.equipmentOperators} variant="muted" />
              </div>
            </CardContent>
          </Card>

          {/* Match results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">התאמה לעובדים</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox label="הותאמו" value={report.matched.total} variant="success" />
                <StatBox label="חדשים (insert)" value={report.matched.toInsert} variant="success" />
                <StatBox label="לעדכון (update)" value={report.matched.toUpdate} variant="info" />
                <StatBox label="לא הותאמו" value={report.unmatched.total} variant={report.unmatched.total > 0 ? 'warning' : 'muted'} />
              </div>

              {/* Unmatched details */}
              {report.unmatched.total > 0 && (
                <div>
                  <button
                    onClick={() => setShowUnmatched(!showUnmatched)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showUnmatched ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    הצג {report.unmatched.total} לא מותאמים
                  </button>
                  {showUnmatched && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 text-sm">
                      {report.unmatched.details.map((u, i) => (
                        <div key={i} className="border-b border-border/50 py-1 last:border-0">
                          <span className="font-medium">#{u.empNum}</span> {u.name}
                          <span className="text-muted-foreground"> — {u.company} — {u.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Licenses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">רישיונות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="עם מספר רישיון" value={report.licensesSummary.withNumber} />
                <StatBox label="עם קטגוריות" value={report.licensesSummary.withCategories} />
                <StatBox label="עם תוקף" value={report.licensesSummary.withExpiryDate} />
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                מסמכים
                <button
                  onClick={() => setShowDocuments(!showDocuments)}
                  className="text-sm font-normal text-muted-foreground hover:text-foreground"
                >
                  {showDocuments ? 'הסתר' : 'הצג'} פירוט
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="סה״כ" value={report.documents.totalDocuments} />
                <StatBox label="פעילים" value={report.documents.activeDocuments} variant="success" />
                <StatBox label="לא פעילים" value={report.documents.inactiveDocuments} variant="muted" />
              </div>
              {showDocuments && report.documents.uniqueNames.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 text-sm">
                  {report.documents.uniqueNames.map((d, i) => (
                    <div key={i} className="flex justify-between border-b border-border/50 py-1 last:border-0">
                      <span>{d.name}</span>
                      <Badge variant="secondary">{d.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data quality */}
          {(report.dataQuality.invalidDates.length > 0 ||
            report.dataQuality.unknownCategories.length > 0 ||
            report.dataQuality.phonesToImport.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  איכות נתונים
                  <button
                    onClick={() => setShowDataQuality(!showDataQuality)}
                    className="text-sm font-normal text-muted-foreground hover:text-foreground"
                  >
                    {showDataQuality ? 'הסתר' : 'הצג'} פירוט
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="תאריכים שגויים" value={report.dataQuality.invalidDates.length} variant={report.dataQuality.invalidDates.length > 0 ? 'warning' : 'muted'} />
                  <StatBox label="קטגוריות לא מוכרות" value={report.dataQuality.unknownCategories.length} variant={report.dataQuality.unknownCategories.length > 0 ? 'warning' : 'muted'} />
                  <StatBox label="טלפונים לייבוא" value={report.dataQuality.phonesToImport.length} variant="info" />
                </div>
                {showDataQuality && (
                  <div className="mt-3 space-y-2 text-sm">
                    {report.dataQuality.invalidDates.length > 0 && (
                      <div className="rounded-md border bg-muted/30 p-2">
                        <div className="mb-1 font-medium">תאריכים שגויים:</div>
                        {report.dataQuality.invalidDates.map((d, i) => (
                          <div key={i}>#{d.empNum} — {d.field}: {d.rawValue}</div>
                        ))}
                      </div>
                    )}
                    {report.dataQuality.unknownCategories.length > 0 && (
                      <div className="rounded-md border bg-muted/30 p-2">
                        <div className="mb-1 font-medium">קטגוריות לא מוכרות:</div>
                        {report.dataQuality.unknownCategories.map((c, i) => (
                          <div key={i}>#{c.empNum} — {c.grade}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={report.matched.total === 0 || isPending}
              className="min-h-[44px] min-w-[140px]"
            >
              {isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מייבא...
                </>
              ) : (
                <>
                  <Upload className="ml-2 h-4 w-4" />
                  אישור ייבוא ({report.matched.total} נהגים)
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleReset} className="min-h-[44px]">
              ביטול
            </Button>
          </div>
        </>
      )}

      {/* ── Step 2.5: Importing ── */}
      {phase === 'importing' && (
        <Card>
          <CardContent className="space-y-4 py-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-lg font-medium">
                מייבא {report?.matched.total ?? 0} נהגים...
              </p>
              <p className="text-sm text-muted-foreground">
                אנא המתן, התהליך עשוי להימשך מספר דקות
              </p>
            </div>
            <Progress value={progress} className="mx-auto max-w-md" />
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Complete ── */}
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="נהגים חדשים" value={result.driversCreated} variant="success" />
              <StatBox label="נהגים עודכנו" value={result.driversUpdated} variant="info" />
              <StatBox label="רישיונות" value={result.licensesCreated + result.licensesUpdated} />
              <StatBox label="מסמכים" value={result.documentsCreated + result.documentsUpdated} />
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
              ייבוא נוסף
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
}: {
  label: string
  value: number
  variant?: 'default' | 'success' | 'warning' | 'info' | 'muted'
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
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  )
}
