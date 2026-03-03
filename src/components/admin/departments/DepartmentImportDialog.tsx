'use client'

/**
 * DepartmentImportDialog — two-phase PDF import dialog for departments.
 *
 * Phase 1 (preview): user uploads Michpal 2000 PDF →
 *   server parses PDF → shows table of (dept_number, name) with new / update badges.
 * Phase 2 (confirm): rows_json is passed to server (no re-upload needed) →
 *   server upserts all rows → shows success summary.
 *
 * No company selector — departments are global across all companies.
 * The server auto-assigns the first active company as required by the DB schema.
 */

import * as React from 'react'
import { useActionState, useTransition } from 'react'
import { FileUp, Loader2, CheckCircle2 } from 'lucide-react'
import { importDepartmentsFromPdf, type DeptImportActionState } from '@/actions/departments'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DepartmentImportDialogProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
}

export function DepartmentImportDialog({
  open,
  onOpenChange,
}: DepartmentImportDialogProps) {
  const [, startTransition] = useTransition()
  const [state, formAction, isPending] = useActionState<DeptImportActionState, FormData>(
    importDepartmentsFromPdf,
    null
  )

  const fileRef = React.useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = React.useState('')

  function handleClose() {
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
    onOpenChange(false)
  }

  // Phase 1: parse PDF → preview
  function handlePreviewSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('action', 'preview')
    startTransition(() => formAction(fd))
  }

  // Phase 2: confirm using rows_json (no file re-upload required)
  function handleConfirm() {
    if (!state?.preview) return
    const fd = new FormData()
    fd.set('action',    'confirm')
    fd.set('rows_json', JSON.stringify(
      state.preview.rows.map((r) => ({ deptNumber: r.deptNumber, name: r.name }))
    ))
    startTransition(() => formAction(fd))
  }

  const isPreview  = state?.success && state.phase === 'preview'
  const isComplete = state?.success && state.phase === 'complete'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>ייבוא מחלקות מ-PDF מיכפל</DialogTitle>
        </DialogHeader>

        {/* ── Success screen ── */}
        {isComplete && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-lg font-semibold text-green-700">הייבוא הושלם בהצלחה!</p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>מחלקות חדשות: <strong className="text-foreground">{state.result?.imported}</strong></span>
              <span>עודכנו: <strong className="text-foreground">{state.result?.updated}</strong></span>
            </div>
            <Button onClick={handleClose}>סגור</Button>
          </div>
        )}

        {/* ── Phase 1: Upload form ── */}
        {!isComplete && !isPreview && (
          <form onSubmit={handlePreviewSubmit} className="space-y-4 py-2">
            {/* File picker */}
            <div className="space-y-1">
              <label className="text-sm font-medium">קובץ PDF (רשימת מחלקות מיכפל)</label>
              <div
                className="flex items-center gap-3 rounded-md border border-dashed border-brand-primary/40 px-4 py-3 cursor-pointer hover:border-brand-primary transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {fileName || 'לחץ לבחירת קובץ PDF'}
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                name="pdf_file"
                accept="application/pdf,.pdf"
                required
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>ביטול</Button>
              <Button type="submit" disabled={isPending || !fileName}>
                {isPending
                  ? <><Loader2 className="ms-2 h-4 w-4 animate-spin" />מנתח PDF...</>
                  : 'המשך לתצוגה מקדימה'
                }
              </Button>
            </div>
          </form>
        )}

        {/* ── Phase 2: Preview table + confirm ── */}
        {isPreview && (
          <div className="flex flex-col gap-4 min-h-0 py-2">
            {/* Summary */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                נמצאו <strong>{state.preview?.rows.length}</strong> מחלקות:
              </span>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                {state.preview?.newCount} חדשות
              </Badge>
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                {state.preview?.updateCount} קיימות (יעודכנו)
              </Badge>
            </div>

            {/* Scrollable preview table */}
            <div className="overflow-y-auto border rounded-md flex-1 max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 border-b">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium w-28">מספר מחלקה</th>
                    <th className="px-3 py-2 text-start font-medium">שם מחלקה</th>
                    <th className="px-3 py-2 text-start font-medium w-24">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {state.preview?.rows.map((row) => (
                    <tr key={row.deptNumber} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-mono text-xs">{row.deptNumber}</td>
                      <td className="px-3 py-1.5">
                        {row.name || (
                          <span className="text-muted-foreground italic text-xs">ללא שם</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {row.isNew ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs font-normal">חדשה</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs font-normal">עדכון</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>ביטול</Button>
              <Button onClick={handleConfirm} disabled={isPending}>
                {isPending
                  ? <><Loader2 className="ms-2 h-4 w-4 animate-spin" />מייבא...</>
                  : `אשר ויבא ${state.preview?.rows.length} מחלקות`
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
