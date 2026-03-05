'use client'

/**
 * DriverDocumentsSection — manages driver's supporting documents.
 *
 * Features:
 *   - Freetext document name with autocomplete (from driver_document_names)
 *   - PDF/image upload via fleet-documents bucket
 *   - Expiry date with days-remaining indicator
 *   - Soft-delete
 */

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Upload, FileText, X, AlertCircle, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import {
  addDriverDocument,
  deleteDriverDocument,
  getDocumentNameSuggestions,
  type DriverDocument,
} from '@/actions/fleet/drivers'

type Props = {
  driverId: string
  documents: DriverDocument[]
  docYellowDays: number
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)
}

function ExpiryIndicator({ expiryDate, yellowDays }: { expiryDate: string | null; yellowDays: number }) {
  if (!expiryDate) return <span className="text-muted-foreground text-xs">ללא תוקף</span>
  const days = daysUntil(expiryDate)
  if (days === null) return null
  const dateStr = new Date(expiryDate).toLocaleDateString('he-IL')
  const color = days < 0 ? 'text-red-600' : days <= yellowDays ? 'text-yellow-600' : 'text-green-600'
  return (
    <div className={`text-xs ${color}`}>
      {dateStr}
      <span className="ms-1">
        ({days < 0 ? `פג לפני ${Math.abs(days)} ימים` : `${days} ימים`})
      </span>
    </div>
  )
}

export function DriverDocumentsSection({ driverId, documents: initialDocs, docYellowDays }: Props) {
  const [docs, setDocs] = useState<DriverDocument[]>(initialDocs)
  const [showAddForm, setShowAddForm] = useState(false)

  // Add form state
  const [docName, setDocName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const [isAdding, startAddTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
      const { data } = supabase.storage.from('fleet-documents').getPublicUrl(fileName)
      return data.publicUrl
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
    setShowSuggestions(false)
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
        notes: notes || null,
      })
      if (result.success && result.id) {
        const newDoc: DriverDocument = {
          id: result.id,
          driverId,
          documentName: docName.trim(),
          fileUrl: fileUrl || null,
          expiryDate: expiryDate || null,
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

  async function handleDelete(docId: string) {
    if (!confirm('למחוק את המסמך?')) return
    setDeletingId(docId)
    const result = await deleteDriverDocument(docId, driverId)
    if (result.success) {
      setDocs((prev) => prev.filter((d) => d.id !== docId))
      toast.success('המסמך נמחק')
    } else {
      toast.error(result.error)
    }
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Document list */}
      {docs.length === 0 && !showAddForm && (
        <p className="text-sm text-muted-foreground text-center py-4">אין מסמכים נלווים</p>
      )}

      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{doc.documentName}</span>
                    {doc.expiryDate && daysUntil(doc.expiryDate)! <= docYellowDays && (
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    )}
                  </div>
                  <ExpiryIndicator expiryDate={doc.expiryDate} yellowDays={docYellowDays} />
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
                  >
                    פתח קובץ
                  </a>
                )}
                <button
                  onClick={() => handleDelete(doc.id)}
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
          ))}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
          {/* Document name with autocomplete */}
          <div className="space-y-1.5 relative">
            <Label>שם המסמך</Label>
            <Input
              value={docName}
              onChange={(e) => { setDocName(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="לדוגמה: כשירות רפואית, אישור נהיגה בגובה..."
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Expiry date */}
            <div className="space-y-1.5">
              <Label>תוקף (אופציונלי)</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                dir="ltr"
              />
            </div>

            {/* File upload */}
            <div className="space-y-1.5">
              <Label>קובץ (PDF/תמונה)</Label>
              {fileUrl ? (
                <div className="flex items-center gap-2">
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                    קובץ הועלה ✓
                  </a>
                  <button onClick={() => setFileUrl('')}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-lg p-3 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <p className="text-xs text-center text-muted-foreground mb-2">
                    {dragging ? 'שחרר כאן...' : 'גרור קובץ לכאן'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploading ? 'מעלה...' : 'מחשב'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      סרוק
                    </Button>
                  </div>
                </div>
              )}
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
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>הערות (אופציונלי)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות נוספות..."
            />
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleAdd} disabled={isAdding || !docName.trim()}>
              {isAdding && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
              הוסף מסמך
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowAddForm(false) }}>
              ביטול
            </Button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showAddForm && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-4 w-4" />
          הוסף מסמך
        </Button>
      )}
    </div>
  )
}
