'use client'

/**
 * DriversImportSection — Import drivers from legacy Drivers.top file.
 *
 * Two-phase flow:
 *   1. Upload .top file → dry-run (shows summary: new/update/unmatched)
 *   2. Approve → execute import with progress feedback
 *
 * Sits inside FleetSettings page.
 */

import { useState, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { Upload, FileCheck2, AlertTriangle, CheckCircle2, Loader2, X, Users, RefreshCw, Plus, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  dryRunDriverImportAction,
  executeDriverImportAction,
  type DryRunReport,
  type ImportResult,
} from '@/actions/fleet/import-drivers'

type Phase = 'idle' | 'checking' | 'reviewed' | 'importing' | 'done'

export function DriversImportSection() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [report, setReport] = useState<DryRunReport | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileDataRef = useRef<File | null>(null)

  const [isChecking, startCheckTransition] = useTransition()
  const [isImporting, startImportTransition] = useTransition()

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
      const result = await dryRunDriverImportAction(formData)
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

    startImportTransition(async () => {
      const formData = new FormData()
      formData.append('file', fileDataRef.current!)
      const result = await executeDriverImportAction(formData)
      setImportResult(result)
      setPhase('done')
      if (result.success) {
        toast.success('הייבוא הושלם בהצלחה')
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
          ייבוא נהגים מקובץ Drivers.top
        </h3>
        {phase !== 'idle' && phase !== 'checking' && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1">
            <X className="h-3.5 w-3.5" />
            התחל מחדש
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        ייבוא/עדכון כרטיסי נהגים מקובץ Legacy. הקובץ ייסרק ויוצג דו&quot;ח לפני ביצוע הייבוא.
      </p>

      {/* ── File upload ── */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="drivers-file"
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
          id="drivers-file"
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
          <span className="text-sm">סורק את הקובץ ומתאים לעובדים...</span>
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
              <Users className="h-3.5 w-3.5" />
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
            {report.unmatched.total > 0 && (
              <Badge variant="destructive" className="gap-1.5 py-1 px-2.5">
                <UserX className="h-3.5 w-3.5" />
                {report.unmatched.total} לא מותאמים
              </Badge>
            )}
          </div>

          <Separator />

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">סריקה</div>
              <div>סה&quot;כ שורות: {report.totalRows}</div>
              <div>דולגו: {report.skippedRows.skipFlag + report.skippedRows.templateRows + report.skippedRows.exPrefix + report.skippedRows.emptyNumber}</div>
              <div>תקינות: {report.validRows}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">רשיונות</div>
              <div>עם מספר רשיון: {report.licensesSummary.withNumber}</div>
              <div>עם קטגוריות: {report.licensesSummary.withCategories}</div>
              <div>עם תאריך תפוגה: {report.licensesSummary.withExpiryDate}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">מסמכים</div>
              <div>סה&quot;כ: {report.documents.totalDocuments} ({report.documents.activeDocuments} פעילים)</div>
              <div>שמות ייחודיים: {report.documents.uniqueNames.length}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">נוסף</div>
              <div>מפעילי ציוד: {report.equipmentOperators}</div>
              <div>טלפונים לייבוא: {report.dataQuality.phonesToImport.length}</div>
            </div>
          </div>

          {/* Unmatched details */}
          {report.unmatched.total > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-amber-600 hover:text-amber-700">
                {report.unmatched.total} נהגים לא מותאמים (לחץ לפרטים)
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 bg-amber-50 p-2 rounded border border-amber-200">
                {report.unmatched.details.map((u, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{u.empNum} — {u.name} ({u.company})</span>
                    <span className="text-muted-foreground">{u.reason}</span>
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
              בצע ייבוא ({report.matched.total} נהגים)
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
            <span className="text-sm font-medium">מייבא נהגים...</span>
          </div>
          <Progress value={undefined} className="h-2" />
          <p className="text-xs text-muted-foreground">אנא המתן — הייבוא עשוי לקחת כדקה.</p>
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
              <div className="text-lg font-bold text-green-700">{importResult.driversCreated}</div>
              <div className="text-muted-foreground">נהגים חדשים</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-blue-700">{importResult.driversUpdated}</div>
              <div className="text-muted-foreground">נהגים עודכנו</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.licensesCreated + importResult.licensesUpdated}</div>
              <div className="text-muted-foreground">רשיונות</div>
            </div>
            <div className="bg-white/80 rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-primary">{importResult.documentsCreated + importResult.documentsUpdated}</div>
              <div className="text-muted-foreground">מסמכים</div>
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
