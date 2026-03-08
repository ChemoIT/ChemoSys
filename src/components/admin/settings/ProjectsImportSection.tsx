'use client'

/**
 * ProjectsImportSection — Import projects from legacy SystemProject.top file.
 *
 * Two-phase flow:
 *   1. Upload .top file → dry-run (shows summary: new/update/managers breakdown)
 *   2. Approve → execute import with progress feedback
 *
 * Sits inside FleetSettings page (alongside DriversImport and VehiclesImport).
 */

import { useState, useRef, useTransition, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Upload, FileCheck2, AlertTriangle, CheckCircle2, Loader2, X,
  FolderOpen, Plus, RefreshCw, UserX, Users, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  dryRunProjectImportAction,
  executeProjectImportAction,
  type ProjectDryRunReport,
  type ProjectImportResult,
} from '@/actions/import-projects'

type Phase = 'idle' | 'checking' | 'reviewed' | 'importing' | 'done'

export function ProjectsImportSection() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [report, setReport] = useState<ProjectDryRunReport | null>(null)
  const [importResult, setImportResult] = useState<ProjectImportResult | null>(null)
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
      const result = await dryRunProjectImportAction(formData)
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
    startProgress(report?.validRows ?? 100)

    startImportTransition(async () => {
      const formData = new FormData()
      formData.append('file', fileDataRef.current!)
      const result = await executeProjectImportAction(formData)
      stopProgress()
      setImportResult(result)
      setPhase('done')
      if (result.success) {
        toast.success('ייבוא הפרויקטים הושלם בהצלחה')
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
          ייבוא פרויקטים מקובץ SystemProject.top
        </h3>
        {phase !== 'idle' && phase !== 'checking' && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1">
            <X className="h-3.5 w-3.5" />
            התחל מחדש
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        ייבוא/עדכון פרויקטים מקובץ Legacy. הקובץ ייסרק ויוצג דו&quot;ח לפני ביצוע הייבוא.
        מנהלים מותאמים אוטומטית לעובדים — שאר המנהלים נכנסים כרישום חופשי.
      </p>

      {/* ── File upload ── */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="projects-file"
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
          id="projects-file"
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
          <span className="text-sm">סורק את הקובץ ומתאים מנהלים לעובדים...</span>
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
              <FolderOpen className="h-3.5 w-3.5" />
              {report.validRows} פרויקטים
            </Badge>
            <Badge variant="default" className="gap-1.5 py-1 px-2.5 bg-green-600">
              <Plus className="h-3.5 w-3.5" />
              {report.toInsert} חדשים
            </Badge>
            {report.existing > 0 && (
              <Badge variant="default" className="gap-1.5 py-1 px-2.5 bg-blue-600">
                <RefreshCw className="h-3.5 w-3.5" />
                {report.existing} לעדכון
              </Badge>
            )}
          </div>

          <Separator />

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">סריקה</div>
              <div>סה&quot;כ שורות: {report.totalRows}</div>
              <div>נדלגו: {report.skippedRows.deleted} מחוקים, {report.skippedRows.noNumber + report.skippedRows.endMarker} אחר</div>
              <div>תקינות: {report.validRows}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">סטטוס</div>
              <div>פעילים: {report.statusBreakdown.active}</div>
              <div>לא פעילים: {report.statusBreakdown.inactive}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">סיווג</div>
              <div>פרויקט: {report.typeBreakdown.project}</div>
              <div>שטח התארגנות: {report.typeBreakdown.staging_area}</div>
              <div>שטח אחסנה: {report.typeBreakdown.storage_area}</div>
              {report.typeBreakdown.none > 0 && <div>ללא סיווג: {report.typeBreakdown.none}</div>}
            </div>
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">שעוני נוכחות</div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {report.clocksTotal} שעונים ב-{report.projectsWithClocks} פרויקטים
              </div>
            </div>
          </div>

          <Separator />

          {/* Manager breakdown */}
          <div className="space-y-2 text-xs">
            <div className="font-medium text-muted-foreground">מנהלים</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="font-medium">מנהל פרויקט (PM)</div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-green-600" />
                  {report.pm.employee} מעובדים
                </div>
                {report.pm.freeText > 0 && (
                  <div className="flex items-center gap-1">
                    <UserX className="h-3 w-3 text-amber-600" />
                    {report.pm.freeText} רישום חופשי
                  </div>
                )}
                {report.pm.empty > 0 && <div className="text-muted-foreground">{report.pm.empty} ריק</div>}
              </div>
              <div className="space-y-1">
                <div className="font-medium">מנהל עבודה (SM)</div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-green-600" />
                  {report.sm.employee} מעובדים
                </div>
                {report.sm.freeText > 0 && (
                  <div className="flex items-center gap-1">
                    <UserX className="h-3 w-3 text-amber-600" />
                    {report.sm.freeText} רישום חופשי
                  </div>
                )}
                {report.sm.empty > 0 && <div className="text-muted-foreground">{report.sm.empty} ריק</div>}
              </div>
              <div className="space-y-1">
                <div className="font-medium">אחראי רכב (CVC)</div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-green-600" />
                  {report.cvc.employee} מעובדים
                </div>
                {report.cvc.freeText > 0 && (
                  <div className="flex items-center gap-1">
                    <UserX className="h-3 w-3 text-amber-600" />
                    {report.cvc.freeText} רישום חופשי
                  </div>
                )}
                {report.cvc.empty > 0 && <div className="text-muted-foreground">{report.cvc.empty} ריק</div>}
              </div>
            </div>
          </div>

          {/* PM free-text details */}
          {report.pm.freeTextDetails.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-amber-600 hover:text-amber-700">
                {report.pm.freeTextDetails.length} מנהלי פרויקט ברישום חופשי (לחץ לפרטים)
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 bg-amber-50 p-2 rounded border border-amber-200">
                {report.pm.freeTextDetails.map((d, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{d.name}</span>
                    <span className="text-muted-foreground">{d.email || '—'} | {d.phone || '—'}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* SM free-text details */}
          {report.sm.freeTextDetails.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-amber-600 hover:text-amber-700">
                {report.sm.freeTextDetails.length} מנהלי עבודה ברישום חופשי (לחץ לפרטים)
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 bg-amber-50 p-2 rounded border border-amber-200">
                {report.sm.freeTextDetails.map((d, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{d.name}</span>
                    <span className="text-muted-foreground">{d.email || '—'} | {d.phone || '—'}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <Separator />

          {/* Execute button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleExecuteImport} disabled={isImporting} className="gap-1.5">
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              בצע ייבוא ({report.validRows} פרויקטים)
            </Button>
            <span className="text-xs text-muted-foreground">
              {report.toInsert > 0 && `${report.toInsert} חדשים`}
              {report.toInsert > 0 && report.existing > 0 && ' + '}
              {report.existing > 0 && `${report.existing} עדכונים`}
            </span>
          </div>
        </div>
      )}

      {/* ── Importing progress ── */}
      {phase === 'importing' && (
        <div className="space-y-3 p-4 bg-accent/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">מייבא פרויקטים...</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>אנא המתן — הייבוא עשוי לקחת עד דקה.</span>
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
              <div className="text-lg font-bold text-green-700">{importResult.inserted}</div>
              <div className="text-muted-foreground">פרויקטים חדשים</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-blue-700">{importResult.updated}</div>
              <div className="text-muted-foreground">פרויקטים עודכנו</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.clocksInserted}</div>
              <div className="text-muted-foreground">שעוני נוכחות</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.inserted + importResult.updated}</div>
              <div className="text-muted-foreground">סה&quot;כ</div>
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
