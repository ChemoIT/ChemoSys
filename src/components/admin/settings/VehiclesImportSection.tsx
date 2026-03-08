'use client'

/**
 * VehiclesImportSection — Import vehicles from legacy CarList.top file.
 *
 * Two-phase flow:
 *   1. Upload .top file → dry-run (shows summary: new/update/owners/SplitStr stats)
 *   2. Approve → execute import with progress feedback
 *
 * Sits inside FleetSettings page, below DriversImportSection.
 */

import { useState, useRef, useTransition, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Upload, FileCheck2, AlertTriangle, CheckCircle2, Loader2, X, Car, RefreshCw, Plus, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  dryRunVehicleImportAction,
  executeVehicleImportAction,
  type VehicleDryRunReport,
  type VehicleImportResult,
} from '@/actions/fleet/import-vehicles'

type Phase = 'idle' | 'checking' | 'reviewed' | 'importing' | 'done'

export function VehiclesImportSection() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [report, setReport] = useState<VehicleDryRunReport | null>(null)
  const [importResult, setImportResult] = useState<VehicleImportResult | null>(null)
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
    if (intervalRef.current) clearInterval(intervalRef.current)
    const stepSize = 90 / Math.max(totalItems, 1)
    const intervalMs = Math.max(150, Math.min(500, (totalItems * 150) / 90 * (90 / totalItems)))
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 90
        }
        return Math.min(prev + stepSize, 90)
      })
    }, intervalMs)
  }, [])

  const stopProgress = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setProgress(100)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    fileDataRef.current = file
    setReport(null)
    setImportResult(null)
    setError(null)
    setPhase('idle')
  }

  function handleDryRun() {
    if (!fileDataRef.current) return
    setError(null)
    setPhase('checking')

    startCheckTransition(async () => {
      const formData = new FormData()
      formData.append('file', fileDataRef.current!)
      const result = await dryRunVehicleImportAction(formData)
      if (result.success && result.report) {
        setReport(result.report)
        setPhase('reviewed')
      } else {
        setError(result.error ?? 'שגיאה לא ידועה')
        setPhase('idle')
      }
    })
  }

  function handleExecuteImport() {
    if (!fileDataRef.current) return
    setPhase('importing')
    startProgress(report?.matched.total ?? 100)

    startImportTransition(async () => {
      const formData = new FormData()
      formData.append('file', fileDataRef.current!)
      const result = await executeVehicleImportAction(formData)
      stopProgress()
      setImportResult(result)
      setPhase('done')
      if (result.success) {
        toast.success('ייבוא הרכבים הושלם בהצלחה')
      } else {
        toast.error(`הייבוא הסתיים עם ${result.errors.length} שגיאות`)
      }
    })
  }

  function handleReset() {
    setPhase('idle')
    setFileName(null)
    setReport(null)
    setImportResult(null)
    setError(null)
    fileDataRef.current = null
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground border-b pb-1 flex-1">
          ייבוא רכבים מקובץ CarList.top
        </h3>
        {phase !== 'idle' && phase !== 'checking' && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1">
            <X className="h-3.5 w-3.5" />
            התחל מחדש
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        ייבוא/עדכון כרטיסי רכב מקובץ Legacy. הקובץ ייסרק ויוצג דו&quot;ח לפני ביצוע הייבוא.
        <br />
        <strong>שים לב:</strong> מיגרציות 00030 + 00031 חייבות לרוץ ב-Supabase לפני הייבוא.
      </p>

      {/* ── File upload ── */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="vehicles-file"
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-border rounded-lg
                     cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors text-sm"
        >
          <Upload className="h-4 w-4 text-muted-foreground" />
          {fileName ? (
            <span className="font-medium">{fileName}</span>
          ) : (
            <span className="text-muted-foreground">בחר קובץ .top...</span>
          )}
        </label>
        <input
          ref={fileRef}
          id="vehicles-file"
          type="file"
          accept=".top"
          onChange={handleFileChange}
          className="hidden"
        />

        {fileName && phase === 'idle' && (
          <Button size="sm" onClick={handleDryRun} disabled={isChecking} className="gap-1.5">
            {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
            בדיקה
          </Button>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Checking spinner ── */}
      {phase === 'checking' && (
        <div className="flex items-center gap-3 p-4 bg-accent/30 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">סורק את הקובץ ומתאים לנתונים קיימים...</span>
        </div>
      )}

      {/* ── Dry-run report ── */}
      {report && phase === 'reviewed' && (
        <div className="space-y-4 p-4 bg-card rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck2 className="h-4 w-4 text-primary" />
            תוצאות סריקה
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1.5 py-1 px-2.5">
              <Car className="h-3.5 w-3.5" />
              {report.validRows} שורות תקינות
            </Badge>
            <Badge variant="default" className="gap-1.5 py-1 px-2.5 bg-green-600">
              <Plus className="h-3.5 w-3.5" />
              {report.matched.toInsert} חדשים
            </Badge>
            <Badge variant="default" className="gap-1.5 py-1 px-2.5 bg-blue-600">
              <RefreshCw className="h-3.5 w-3.5" />
              {report.matched.toUpdate} לעדכון
            </Badge>
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
              {report.matched.activeVehicles} פעילים / {report.matched.inactiveVehicles} לא פעילים
            </Badge>
          </div>

          <Separator />

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">סריקה</div>
              <div>סה&quot;כ שורות: {report.totalRows}</div>
              <div>דולגו (מחוקות): {report.skippedRows.deletedFlag}</div>
              <div>דולגו (header/סוף): {report.skippedRows.headerRow}</div>
              <div>תקינות: {report.validRows}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">ספקים (בעלות)</div>
              <div>ספקים ייחודיים: {report.owners.uniqueOwners.length}</div>
              <div>קיימים ב-DB: {report.owners.existingInDb}</div>
              <div>ייווצרו חדשים: {report.owners.toCreate}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">נתוני היסטוריה</div>
              <div>עלויות חודשיות: {report.dataRichness.withMonthlyCosts}</div>
              <div>היסטוריית נהגים: {report.dataRichness.withDriverHistory}</div>
              <div>שיוך פרויקטים: {report.dataRichness.withProjectAssignments}</div>
              <div>רכבי חילוף: {report.dataRichness.withReplacementVehicles}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">נתונים נוספים</div>
              <div>מסמכים: {report.dataRichness.withDocuments}</div>
              <div>הערות: {report.dataRichness.withNotes}</div>
              <div>אשרות כביש: {report.dataRichness.withRoadPermissions}</div>
              <div>פסקל: {report.dataRichness.withPascal}</div>
              <div>מגבלת דלק: {report.dataRichness.withFuelLimit}</div>
            </div>
          </div>

          {/* Data quality issues */}
          {(report.dataQuality.invalidDates.length > 0 || report.dataQuality.duplicatePlateContracts > 0) && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-amber-600 hover:text-amber-700">
                בעיות איכות נתונים (לחץ לפרטים)
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 bg-amber-50 p-2 rounded border border-amber-200">
                {report.dataQuality.duplicatePlateContracts > 0 && (
                  <div>{report.dataQuality.duplicatePlateContracts} כפילויות לוחית+חוזה (דולגו)</div>
                )}
                {report.dataQuality.invalidDates.map((d, i) => (
                  <div key={i}>
                    {d.plate} — {d.field}: ערך לא תקין &quot;{d.rawValue}&quot;
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Owner list */}
          {report.owners.toCreate > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-700">
                <Database className="h-3 w-3 inline ml-1" />
                {report.owners.toCreate} ספקים חדשים שייווצרו (לחץ לפרטים)
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 bg-blue-50 p-2 rounded border border-blue-200">
                {report.owners.uniqueOwners.map((name, i) => (
                  <div key={i}>{name}</div>
                ))}
              </div>
            </details>
          )}

          <Separator />

          {/* Execute button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleExecuteImport} disabled={isImporting} className="gap-1.5">
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              בצע ייבוא ({report.matched.total} רכבים)
            </Button>
            <span className="text-xs text-muted-foreground">
              {report.matched.toInsert > 0 && `${report.matched.toInsert} חדשים`}
              {report.matched.toInsert > 0 && report.matched.toUpdate > 0 && ' + '}
              {report.matched.toUpdate > 0 && `${report.matched.toUpdate} עדכונים`}
            </span>
          </div>
        </div>
      )}

      {/* ── Importing progress ── */}
      {phase === 'importing' && (
        <div className="space-y-3 p-4 bg-accent/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">מייבא רכבים...</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>אנא המתן — הייבוא עשוי לקחת מספר דקות (כולל היסטוריה, מסמכים ורכבי חילוף).</span>
            <span dir="ltr" className="font-mono">{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {/* ── Import result ── */}
      {importResult && phase === 'done' && (
        <div className={`space-y-3 p-4 rounded-xl border shadow-sm ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {importResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            {importResult.success ? 'הייבוא הושלם בהצלחה' : 'הייבוא הסתיים עם שגיאות'}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-green-700">{importResult.vehiclesCreated}</div>
              <div className="text-muted-foreground">רכבים חדשים</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-blue-700">{importResult.vehiclesUpdated}</div>
              <div className="text-muted-foreground">רכבים עודכנו</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.monthlyCostsCreated}</div>
              <div className="text-muted-foreground">עלויות חודשיות</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.replacementsCreated}</div>
              <div className="text-muted-foreground">רכבי חילוף</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.driverJournalCreated}</div>
              <div className="text-muted-foreground">שיוכי נהגים</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.projectJournalCreated}</div>
              <div className="text-muted-foreground">שיוכי פרויקטים</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.documentsCreated}</div>
              <div className="text-muted-foreground">מסמכים</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.suppliersCreated}</div>
              <div className="text-muted-foreground">ספקים חדשים</div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-red-600 hover:text-red-700">
                {importResult.errors.length} שגיאות (לחץ לפרטים)
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 bg-white p-2 rounded border border-red-200">
                {importResult.errors.map((err, i) => (
                  <div key={i} className="text-red-600">{err}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
