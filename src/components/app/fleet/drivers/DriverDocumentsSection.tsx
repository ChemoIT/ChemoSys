'use client'

/**
 * DriverDocumentsSection — manages driver's supporting documents.
 *
 * Features:
 *   - Freetext document name with autocomplete (from driver_document_names)
 *   - PDF/image upload via fleet-documents bucket
 *   - Expiry date (dd/mm/yyyy) with days-remaining + alert toggle
 *   - File preview (image inline, PDF opens in new tab)
 *   - Click row to edit existing document
 *   - Soft-delete via RPC
 */

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Plus, Trash2, FileText, AlertCircle,
  Bell, Pencil, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import {
  addDriverDocument,
  deleteDriverDocument,
  updateDriverDocument,
  getDocumentNameSuggestions,
  type DriverDocument,
} from '@/actions/fleet/drivers'
import { daysUntil } from '@/lib/format'
import { FleetDateInput } from '../shared/FleetDateInput'
import { AlertToggle } from '../shared/AlertToggle'
import { ExpiryIndicator } from '../shared/ExpiryIndicator'
import { FleetUploadZone } from '../shared/FleetUploadZone'

type Props = {
  driverId: string
  documents: DriverDocument[]
  docYellowDays: number
  onEditingChange?: (isEditing: boolean) => void
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DriverDocumentsSection({ driverId, documents: initialDocs, docYellowDays, onEditingChange }: Props) {
  const [docs, setDocs] = useState<DriverDocument[]>(initialDocs)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state (shared between add and edit)
  const [docName, setDocName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const [isAdding, startAddTransition] = useTransition()
  const [isSaving, startSaveTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Notify parent of REAL dirty state (actual content changes)
  const isFormDirty = (() => {
    if (showAddForm) return docName.trim() !== '' || expiryDate !== '' || notes !== '' || fileUrl !== ''
    if (editingId) {
      const orig = docs.find((d) => d.id === editingId)
      if (!orig) return false
      return docName !== orig.documentName ||
        expiryDate !== (orig.expiryDate ?? '') ||
        notes !== (orig.notes ?? '') ||
        fileUrl !== (orig.fileUrl ?? '')
    }
    return false
  })()
  useEffect(() => {
    onEditingChange?.(isFormDirty)
  }, [isFormDirty, onEditingChange])

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    const results = await getDocumentNameSuggestions(query)
    setSuggestions(results)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSuggestions(docName)
    }, 200)
    return () => clearTimeout(timer)
  }, [docName, fetchSuggestions])

  async function uploadFile(file: File): Promise<string | null> {
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const ext = file.name.split('.').pop() ?? 'pdf'
      const fileName = `${driverId}_doc_${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('fleet-documents')
        .upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data: signedData, error: signedError } = await supabase.storage
        .from('fleet-documents')
        .createSignedUrl(fileName, 31_536_000)
      if (signedError) throw signedError
      return signedData.signedUrl
    } catch (err) {
      toast.error(`שגיאה בהעלאת הקובץ: ${err instanceof Error ? err.message : 'Unknown'}`)
      return null
    } finally {
      setUploading(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadFile(file)
    if (url) setFileUrl(url)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    void uploadFile(file).then((url) => { if (url) setFileUrl(url) })
  }

  function resetForm() {
    setDocName('')
    setExpiryDate('')
    setNotes('')
    setFileUrl('')
    setAlertEnabled(false)
    setShowSuggestions(false)
  }

  function startEdit(doc: DriverDocument) {
    setEditingId(doc.id)
    setDocName(doc.documentName)
    setExpiryDate(doc.expiryDate ?? '')
    setNotes(doc.notes ?? '')
    setFileUrl(doc.fileUrl ?? '')
    setAlertEnabled(doc.alertEnabled ?? false)
    setShowAddForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
    resetForm()
  }

  function handleAdd() {
    if (!docName.trim()) {
      toast.error('יש להזין שם מסמך')
      return
    }
    startAddTransition(async () => {
      const result = await addDriverDocument({
        driverId,
        documentName: docName.trim(),
        fileUrl: fileUrl || null,
        expiryDate: expiryDate || null,
        alertEnabled,
        notes: notes || null,
      })
      if (result.success && result.id) {
        const newDoc: DriverDocument = {
          id: result.id,
          driverId,
          documentName: docName.trim(),
          fileUrl: fileUrl || null,
          expiryDate: expiryDate || null,
          alertEnabled,
          notes: notes || null,
          createdAt: new Date().toISOString(),
        }
        setDocs((prev) => [newDoc, ...prev])
        resetForm()
        setShowAddForm(false)
        toast.success('המסמך נוסף')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleUpdate() {
    if (!editingId || !docName.trim()) return
    startSaveTransition(async () => {
      const result = await updateDriverDocument({
        docId: editingId,
        driverId,
        documentName: docName.trim(),
        fileUrl: fileUrl || null,
        expiryDate: expiryDate || null,
        alertEnabled,
        notes: notes || null,
      })
      if (result.success) {
        setDocs((prev) =>
          prev.map((d) =>
            d.id === editingId
              ? { ...d, documentName: docName.trim(), fileUrl: fileUrl || null, expiryDate: expiryDate || null, alertEnabled, notes: notes || null }
              : d
          )
        )
        setEditingId(null)
        resetForm()
        toast.success('המסמך עודכן')
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handleDelete(docId: string) {
    if (!confirm('למחוק את המסמך?')) return
    setDeletingId(docId)
    const result = await deleteDriverDocument(docId, driverId)
    if (result.success) {
      setDocs((prev) => prev.filter((d) => d.id !== docId))
      if (editingId === docId) {
        setEditingId(null)
        resetForm()
      }
      toast.success('המסמך נמחק')
    } else {
      toast.error(result.error)
    }
    setDeletingId(null)
  }

  // ── Document Form (shared for add + edit) ─────────────────────────────────

  function renderForm(mode: 'add' | 'edit') {
    const isBusy = mode === 'add' ? isAdding : isSaving

    return (
      <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
        {/* Document name with autocomplete */}
        <div className="space-y-1.5 relative">
          <Label>שם המסמך</Label>
          <Input
            value={docName}
            onChange={(e) => { setDocName(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            autoFocus
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-background border rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setDocName(s); setShowSuggestions(false) }}
                  className="w-full text-right px-3 py-2 text-sm hover:bg-muted transition-colors block"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expiry date + quick buttons + alert toggle */}
        <div className="space-y-2">
          <Label>תוקף (אופציונלי)</Label>
          <div className="flex items-center gap-4 flex-wrap">
            <FleetDateInput value={expiryDate} onChange={(v) => setExpiryDate(v)} />
            <AlertToggle
              checked={alertEnabled}
              onChange={setAlertEnabled}
              label={alertEnabled ? `התראה פעילה (${docYellowDays} יום)` : 'התראת תפוגה'}
            />
          </div>
          {/* Quick expiry buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">תוקף מהיר:</span>
            {[
              { label: '3 חודשים', months: 3 },
              { label: 'שנה', months: 12 },
              { label: 'שנתיים', months: 24 },
            ].map(({ label, months }) => (
              <button
                key={months}
                type="button"
                onClick={() => {
                  const d = new Date()
                  d.setMonth(d.getMonth() + months)
                  const yyyy = d.getFullYear()
                  const mm = String(d.getMonth() + 1).padStart(2, '0')
                  const dd = String(d.getDate()).padStart(2, '0')
                  setExpiryDate(`${yyyy}-${mm}-${dd}`)
                }}
                className="px-2.5 py-1 rounded-md border text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
                style={{ borderColor: '#C8D5E2' }}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Days remaining indicator */}
          {expiryDate && (() => {
            const days = daysUntil(expiryDate)
            if (days === null) return null
            const color = days < 0 ? 'text-red-600 font-semibold' : days <= docYellowDays ? 'text-yellow-600 font-semibold' : 'text-green-600'
            return (
              <p className={`text-xs ${color}`}>
                {days < 0 ? `פג לפני ${Math.abs(days)} ימים` : `${days} ימים עד פקיעה`}
              </p>
            )
          })()}
        </div>

        {/* File upload with preview */}
        <div className="space-y-1.5">
          <Label>קובץ (PDF/תמונה)</Label>
          <FleetUploadZone
            fileUrl={fileUrl}
            uploading={uploading}
            dragging={dragging}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onFileClick={() => fileInputRef.current?.click()}
            onCameraClick={() => cameraInputRef.current?.click()}
            onClear={() => setFileUrl('')}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label>הערות (אופציונלי)</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { mode === 'add' ? (resetForm(), setShowAddForm(false)) : cancelEdit() }}
          >
            ביטול
          </Button>
          <Button
            size="sm"
            onClick={mode === 'add' ? handleAdd : handleUpdate}
            disabled={isBusy || !docName.trim()}
          >
            {isBusy && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
            {mode === 'add' ? (
              <>
                <Plus className="h-4 w-4 ms-1" />
                הוסף מסמך
              </>
            ) : (
              <>
                <Save className="h-4 w-4 ms-1" />
                שמור שינויים
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Document list */}
      {docs.length === 0 && !showAddForm && (
        <p className="text-sm text-muted-foreground text-center py-4">אין מסמכים נלווים</p>
      )}

      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc) => {
            const isEditing = editingId === doc.id

            if (isEditing) {
              return <div key={doc.id}>{renderForm('edit')}</div>
            }

            return (
              <div
                key={doc.id}
                className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:bg-muted/20 transition-colors cursor-pointer group"
                onClick={() => startEdit(doc)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{doc.documentName}</span>
                      {doc.alertEnabled && (
                        <Bell className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="התראת תפוגה פעילה" />
                      )}
                      {doc.expiryDate && daysUntil(doc.expiryDate)! <= docYellowDays && (
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                      )}
                    </div>
                    <ExpiryIndicator expiryDate={doc.expiryDate} yellowDays={docYellowDays} />
                    {/* Alert toggle — inline with expiry info */}
                    {doc.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.notes}</p>}
                  </div>
                </div>
              <div className="flex items-center gap-2 shrink-0">
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      פתח קובץ
                    </a>
                  )}
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                    disabled={deletingId === doc.id}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="מחק"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      {showAddForm && renderForm('add')}

      {/* Add button */}
      {!showAddForm && !editingId && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => { setShowAddForm(true); resetForm() }}
        >
          <Plus className="h-4 w-4" />
          הוסף מסמך
        </Button>
      )}
    </div>
  )
}
