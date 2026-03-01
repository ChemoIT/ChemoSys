'use client'

/**
 * EmployeeImport — multi-step Excel import wizard for the payroll import flow.
 *
 * Step 1 — Company selection + file upload:
 *   Admin picks a company (payroll file has no company column) and uploads an XLSX.
 *   Submits with action='preview' — no DB writes, just count analysis.
 *
 * Step 2 — Preview summary:
 *   Shows total rows found, new vs update breakdown, and any skipped-row warnings.
 *   Admin clicks "אישור ייבוא" to confirm — re-submits the same file with action='confirm'.
 *   "ביטול" resets back to Step 1.
 *
 * Step 3 — Import complete:
 *   Shows final counts and any per-row errors. Link back to employees list.
 *
 * State management:
 *   - phase: 'upload' | 'preview' | 'complete' — drives which step renders
 *   - selectedFile: kept in React state so Step 2 can re-submit the same file
 *   - selectedCompanyId: kept in state alongside the hidden input for the confirm form
 *
 * Server Action: importEmployeesAction (employees.ts)
 *   Phase 1: action='preview' → returns counts, no writes
 *   Phase 2: action='confirm' → upserts via RPC, returns results
 */

import * as React from 'react'
import { useActionState, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Upload, Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { importEmployeesAction, type ImportActionState } from '@/actions/employees'
import type { Company } from '@/types/entities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmployeeImportProps {
  companies: Company[]
}

// ---------------------------------------------------------------------------
// EmployeeImport component
// ---------------------------------------------------------------------------

export function EmployeeImport({ companies }: EmployeeImportProps) {
  // ── Local state ──────────────────────────────────────────────────────────
  const [phase, setPhase]                   = useState<'upload' | 'preview' | 'complete'>('upload')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [selectedFile, setSelectedFile]     = useState<File | null>(null)
  const [isPending, startTransition]        = useTransition()

  // Ref for the hidden company_id input in the confirm form
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Server Action state ──────────────────────────────────────────────────
  const [actionState, dispatch] = useActionState<ImportActionState, FormData>(
    importEmployeesAction,
    null
  )

  // ── Derived state from action response ───────────────────────────────────
  // Move to preview step after a successful preview response
  React.useEffect(() => {
    if (!actionState) return
    if (actionState.success && actionState.phase === 'preview') {
      setPhase('preview')
    }
    if (actionState.success && actionState.phase === 'complete') {
      setPhase('complete')
    }
  }, [actionState])

  // ── Reset handler ─────────────────────────────────────────────────────────
  function handleReset() {
    setPhase('upload')
    setSelectedFile(null)
    setSelectedCompanyId('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // ── Confirm handler — re-submits the same file with action='confirm' ─────
  function handleConfirm() {
    if (!selectedFile || !selectedCompanyId) return

    const formData = new FormData()
    formData.append('company_id', selectedCompanyId)
    formData.append('action', 'confirm')
    formData.append('excel_file', selectedFile)

    startTransition(() => {
      dispatch(formData)
    })
  }

  // ── Preview form submission handler ─────────────────────────────────────
  function handlePreviewSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    // Capture the file for re-use in confirm step
    const file = formData.get('excel_file')
    if (file instanceof File && file.size > 0) {
      setSelectedFile(file)
    }
    startTransition(() => {
      dispatch(formData)
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">
          {phase === 'upload'   && 'בחירת חברה וקובץ'}
          {phase === 'preview'  && 'תצוגה מקדימה לפני ייבוא'}
          {phase === 'complete' && 'הייבוא הושלם'}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* ── STEP 1: Upload form ─────────────────────────────────────── */}
        {phase === 'upload' && (
          <form onSubmit={handlePreviewSubmit} className="space-y-5">
            {/* Company selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                חברה <span className="text-destructive">*</span>
              </label>
              <Select
                value={selectedCompanyId}
                onValueChange={setSelectedCompanyId}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="בחר חברה..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Hidden input so the server action can read company_id from FormData */}
              <input type="hidden" name="company_id" value={selectedCompanyId} />
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                קובץ Excel מהנהלת שכר <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  name="excel_file"
                  accept=".xlsx,.xls"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setSelectedFile(file)
                  }}
                  className="block w-full text-sm text-muted-foreground
                    file:me-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-medium
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90
                    cursor-pointer"
                />
              </div>
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  קובץ נבחר: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* Phase action hidden input */}
            <input type="hidden" name="action" value="preview" />

            {/* Error from server */}
            {actionState && !actionState.success && actionState.error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{actionState.error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending || !selectedCompanyId || !selectedFile}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  מעבד קובץ...
                </>
              ) : (
                <>
                  <Upload className="me-2 h-4 w-4" />
                  תצוגה מקדימה
                </>
              )}
            </Button>
          </form>
        )}

        {/* ── STEP 2: Preview summary ─────────────────────────────────── */}
        {phase === 'preview' && actionState?.success && actionState.preview && (
          <div className="space-y-5">
            {/* Summary stats */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">
                נמצאו{' '}
                <span className="text-foreground font-bold">
                  {actionState.preview.total}
                </span>{' '}
                עובדים בקובץ
              </p>

              <div className="flex flex-wrap gap-2">
                <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-white">
                  {actionState.preview.newCount} עובדים חדשים
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                  {actionState.preview.updateCount} עובדים קיימים יעודכנו
                </Badge>
              </div>

              {/* Warnings (skipped rows, etc.) */}
              {actionState.preview.errors.length > 0 && (
                <div className="space-y-1 pt-1">
                  {actionState.preview.errors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <p className="text-xs text-muted-foreground">
              לחץ &quot;אישור ייבוא&quot; להתחלת הייבוא. הפעולה תיצור עובדים חדשים ותעדכן קיימים.
              <br />
              אם מסד הנתונים מכיל עובדים שאינם בקובץ — הם לא יושפעו.
            </p>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    מייבא...
                  </>
                ) : (
                  'אישור ייבוא'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isPending}
              >
                ביטול
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Complete ────────────────────────────────────────── */}
        {phase === 'complete' && actionState?.success && actionState.result && (
          <div className="space-y-5">
            {/* Success header */}
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <p className="font-medium">הייבוא הושלם בהצלחה</p>
            </div>

            {/* Result stats */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-600 hover:bg-green-600 text-white">
                  {actionState.result.imported} עובדים נוספו
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                  {actionState.result.updated} עובדים עודכנו
                </Badge>
              </div>

              {/* Per-row errors (if any) */}
              {actionState.result.errors.length > 0 && (
                <div className="space-y-1 pt-2">
                  <p className="text-sm font-medium text-destructive">
                    {actionState.result.errors.length} שגיאות:
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {actionState.result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <Button asChild className="w-full">
              <Link href="/admin/employees" className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                חזרה לרשימת עובדים
              </Link>
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
  )
}
