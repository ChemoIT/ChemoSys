'use client'

/**
 * DriverViolationsSection — manages traffic violations (תרבות נהיגה).
 *
 * Features:
 *   - Click row to edit existing violation (inline form)
 *   - PDF preview (styled card — iframes blocked by signed URL CSP)
 *   - Upload with icon buttons (upload + camera)
 *   - dd/mm/yyyy date picker
 *   - Soft-delete via RPC
 */

import { useState, useTransition, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Plus, Trash2, Upload, FileText, X, Camera, Eye,
  Pencil, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import {
  addDriverViolation,
  deleteDriverViolation,
  updateDriverViolation,
  type DriverViolation,
} from '@/actions/fleet/drivers'
import { formatDate } from '@/lib/format'
import { FleetDateInput } from './FleetDateInput'

type Props = {
  driverId: string
  violations: DriverViolation[]
  onEditingChange?: (isEditing: boolean) => void
}

// formatDate — imported from @/lib/format

const VIOLATION_TYPE_LABELS: Record<string, string> = {
  traffic: 'עבירת תנועה',
  parking: 'חניה',
  accident: 'תאונה',
  other: 'אחר',
}

const VIOLATION_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  traffic: 'secondary',
  parking: 'secondary',
  accident: 'destructive',
  other: 'secondary',
}

// ── File Preview ─────────────────────────────────────────────────────────────

function FilePreview({ url, onClear }: { url: string; onClear: () => void }) {
  const isPdf = url.toLowerCase().includes('.pdf')

  return (
    <div className="relative border rounded-xl overflow-hidden bg-muted/10">
      {isPdf ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
          >
            <FileText className="h-7 w-7 text-red-500" />
          </div>
          <span className="text-xs text-muted-foreground">PDF הועלה בהצלחה</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/8 hover:bg-primary/15 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            פתח לצפייה
          </a>
        </div>
      ) : (
        <img src={url} alt="תצוגה מקדימה" className="w-full h-56 object-contain" />
      )}
      <div className="absolute top-2 left-2 flex gap-1.5">
        {!isPdf && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-background/90 backdrop-blur-sm rounded-full p-1.5 hover:bg-background shadow-sm transition-colors"
            title="פתח בחלון חדש"
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
          </a>
        )}
        <button
          onClick={onClear}
          className="bg-background/90 backdrop-blur-sm rounded-full p-1.5 hover:bg-background shadow-sm transition-colors"
          title="הסר קובץ"
        >
          <X className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DriverViolationsSection({ driverId, violations: initialViolations, onEditingChange }: Props) {
  const [violations, setViolations] = useState<DriverViolation[]>(initialViolations)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state (shared for add + edit)
  const [violationNumber, setViolationNumber] = useState('')
  const [violationDate, setViolationDate] = useState('')
  const [violationType, setViolationType] = useState<'traffic' | 'parking' | 'accident' | 'other'>('traffic')
  const [otherType, setOtherType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [location, setLocation] = useState('')
  const [points, setPoints] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [isAdding, startAddTransition] = useTransition()
  const [isSaving, startSaveTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Notify parent of REAL dirty state (actual content changes)
  const isFormDirty = (() => {
    if (showAddForm) {
      return violationNumber !== '' || violationDate !== '' || vehicleNumber !== '' ||
        location !== '' || points !== '' || amount !== '' || description !== '' ||
        notes !== '' || fileUrl !== ''
    }
    if (editingId) {
      const orig = violations.find((v) => v.id === editingId)
      if (!orig) return false
      return violationNumber !== (orig.violationNumber ?? '') ||
        violationDate !== (orig.violationDate ?? '') ||
        vehicleNumber !== (orig.vehicleNumber ?? '') ||
        location !== (orig.location ?? '') ||
        points !== (orig.points ? String(orig.points) : '') ||
        amount !== (orig.amount ? String(orig.amount) : '') ||
        description !== (orig.description ?? '') ||
        notes !== (orig.notes ?? '') ||
        fileUrl !== (orig.fileUrl ?? '')
    }
    return false
  })()
  useEffect(() => {
    onEditingChange?.(isFormDirty)
  }, [isFormDirty, onEditingChange])

  async function uploadFile(file: File): Promise<string | null> {
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const ext = file.name.split('.').pop() ?? 'pdf'
      const fileName = `${driverId}_violation_${crypto.randomUUID()}.${ext}`
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

  function resetForm() {
    setViolationNumber(''); setViolationDate(''); setViolationType('traffic')
    setOtherType(''); setVehicleNumber(''); setLocation(''); setPoints(''); setAmount('')
    setDescription(''); setNotes(''); setFileUrl('')
  }

  function startEdit(v: DriverViolation) {
    setEditingId(v.id)
    setViolationNumber(v.violationNumber ?? '')
    setViolationDate(v.violationDate ?? '')
    setViolationType((v.violationType ?? 'traffic') as 'traffic' | 'parking' | 'accident')
    setOtherType('')
    setVehicleNumber(v.vehicleNumber ?? '')
    setLocation(v.location ?? '')
    setPoints(v.points ? String(v.points) : '')
    setAmount(v.amount ? String(v.amount) : '')
    setDescription(v.description ?? '')
    setNotes(v.notes ?? '')
    setFileUrl(v.fileUrl ?? '')
    setShowAddForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
    resetForm()
  }

  function handleAdd() {
    startAddTransition(async () => {
      const effectiveDescription = violationType === 'other' && otherType
        ? `${otherType}${description ? ' — ' + description : ''}`
        : description || undefined
      const result = await addDriverViolation({
        driverId,
        violationNumber: violationNumber || undefined,
        violationDate: violationDate || undefined,
        violationType: violationType === 'other' ? 'traffic' : violationType,
        vehicleNumber: vehicleNumber || undefined,
        location: location || undefined,
        points: points ? parseInt(points, 10) : 0,
        amount: amount ? parseFloat(amount) : undefined,
        description: effectiveDescription,
        notes: notes || undefined,
        fileUrl: fileUrl || null,
      })
      if (result.success && result.id) {
        const newV: DriverViolation = {
          id: result.id,
          driverId,
          violationNumber: violationNumber || null,
          violationDate: violationDate || null,
          violationType: (violationType === 'other' ? 'traffic' : violationType) as 'traffic' | 'parking' | 'accident',
          vehicleNumber: vehicleNumber || null,
          location: location || null,
          points: points ? parseInt(points, 10) : 0,
          amount: amount ? parseFloat(amount) : null,
          description: description || null,
          notes: notes || null,
          fileUrl: fileUrl || null,
          createdAt: new Date().toISOString(),
        }
        setViolations((prev) => [newV, ...prev])
        resetForm()
        setShowAddForm(false)
        toast.success('הדוח נוסף')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleUpdate() {
    if (!editingId) return
    startSaveTransition(async () => {
      const result = await updateDriverViolation({
        violationId: editingId,
        driverId,
        violationNumber: violationNumber || undefined,
        violationDate: violationDate || undefined,
        violationType: violationType === 'other' ? 'traffic' : violationType,
        vehicleNumber: vehicleNumber || undefined,
        location: location || undefined,
        points: points ? parseInt(points, 10) : 0,
        amount: amount ? parseFloat(amount) : undefined,
        description: description || undefined,
        notes: notes || undefined,
        fileUrl: fileUrl || null,
      })
      if (result.success) {
        setViolations((prev) =>
          prev.map((v) =>
            v.id === editingId
              ? {
                  ...v,
                  violationNumber: violationNumber || null,
                  violationDate: violationDate || null,
                  violationType: (violationType === 'other' ? 'traffic' : violationType) as 'traffic' | 'parking' | 'accident',
                  vehicleNumber: vehicleNumber || null,
                  location: location || null,
                  points: points ? parseInt(points, 10) : 0,
                  amount: amount ? parseFloat(amount) : null,
                  description: description || null,
                  notes: notes || null,
                  fileUrl: fileUrl || null,
                }
              : v
          )
        )
        setEditingId(null)
        resetForm()
        toast.success('הדוח עודכן')
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק את הדוח?')) return
    setDeletingId(id)
    const result = await deleteDriverViolation(id, driverId)
    if (result.success) {
      setViolations((prev) => prev.filter((v) => v.id !== id))
      if (editingId === id) {
        setEditingId(null)
        resetForm()
      }
      toast.success('הדוח נמחק')
    } else {
      toast.error(result.error)
    }
    setDeletingId(null)
  }

  const totalPoints = violations.reduce((sum, v) => sum + (v.points ?? 0), 0)
  const totalAmount = violations.reduce((sum, v) => sum + (v.amount ?? 0), 0)

  // ── Form (shared for add + edit) ──────────────────────────────────────────

  function renderForm(mode: 'add' | 'edit') {
    const isBusy = mode === 'add' ? isAdding : isSaving

    return (
      <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>מספר דוח</Label>
            <Input value={violationNumber} onChange={(e) => setViolationNumber(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>תאריך</Label>
            <FleetDateInput value={violationDate} onChange={setViolationDate} minYear={2015} />
          </div>
          <div className="space-y-1.5">
            <Label>סוג עבירה</Label>
            <select
              value={violationType}
              onChange={(e) => setViolationType(e.target.value as 'traffic' | 'parking' | 'accident' | 'other')}
              className="w-full border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="traffic">עבירת תנועה</option>
              <option value="parking">חניה</option>
              <option value="accident">תאונה</option>
              <option value="other">אחר</option>
            </select>
            {violationType === 'other' && (
              <input
                value={otherType}
                onChange={(e) => setOtherType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-ring mt-1"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>מספר רכב מעורב</Label>
            <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>נקודות תנועה</Label>
            <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} dir="ltr" min={0} max={20} />
          </div>
          <div className="space-y-1.5">
            <Label>סכום לתשלום (₪)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" min={0} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>מיקום</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>תיאור העבירה</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>הערות</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {/* File upload with preview */}
        <div className="space-y-1.5">
          <Label>העלאת הדוח (PDF/תמונה)</Label>
          {fileUrl ? (
            <FilePreview url={fileUrl} onClear={() => setFileUrl('')} />
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={async (e) => {
                e.preventDefault(); setDragging(false)
                const file = e.dataTransfer.files?.[0]
                if (file) { const url = await uploadFile(file); if (url) setFileUrl(url) }
              }}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <FileText className="h-6 w-6" />
                    <span className="text-xs">{dragging ? 'שחרר כאן...' : 'גרור קובץ לכאן'}</span>
                  </>
                )}
              </div>
              {!uploading && (
                <div className="flex justify-center gap-3 mt-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center h-10 w-10 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                    title="העלה מהמחשב"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center h-10 w-10 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                    title="סרוק / צלם"
                  >
                    <Camera className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return
            const url = await uploadFile(file); if (url) { setFileUrl(url); e.target.value = '' }
          }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return
            const url = await uploadFile(file); if (url) { setFileUrl(url); e.target.value = '' }
          }} />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { mode === 'add' ? (resetForm(), setShowAddForm(false)) : cancelEdit() }}
          >
            ביטול
          </Button>
          <Button size="sm" onClick={mode === 'add' ? handleAdd : handleUpdate} disabled={isBusy}>
            {isBusy && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
            {mode === 'add' ? (
              <>
                <Plus className="h-4 w-4 ms-1" />
                הוסף דוח
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
      {/* Summary strip */}
      {violations.length > 0 && (
        <div className="flex items-center gap-6 px-3 py-2 bg-muted/40 rounded-lg text-sm">
          <span className="text-muted-foreground">{violations.length} דוחות</span>
          {totalPoints > 0 && (
            <span className="text-muted-foreground">נקודות צבורות: <strong className="text-foreground">{totalPoints}</strong></span>
          )}
          {totalAmount > 0 && (
            <span className="text-muted-foreground">סה&quot;כ לתשלום: <strong className="text-foreground">₪{totalAmount.toLocaleString()}</strong></span>
          )}
        </div>
      )}

      {/* Violations list */}
      {violations.length === 0 && !showAddForm && (
        <p className="text-sm text-muted-foreground text-center py-4">אין דוחות רשומים</p>
      )}

      {violations.map((v) => {
        if (editingId === v.id) {
          return <div key={v.id}>{renderForm('edit')}</div>
        }

        return (
          <div
            key={v.id}
            className="border rounded-lg overflow-hidden cursor-pointer hover:bg-muted/20 transition-colors group"
            onClick={() => startEdit(v)}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 flex items-center gap-3">
                <Badge variant={VIOLATION_TYPE_VARIANT[v.violationType ?? 'traffic'] ?? 'secondary'}>
                  {VIOLATION_TYPE_LABELS[v.violationType ?? ''] ?? '—'}
                </Badge>
                <span className="text-sm font-medium flex-1">
                  {formatDate(v.violationDate)}
                  {v.violationNumber && <span className="text-muted-foreground ms-2">מ׳ {v.violationNumber}</span>}
                </span>
                {v.points > 0 && <span className="text-xs text-muted-foreground">{v.points} נק׳</span>}
                {v.amount && <span className="text-xs text-muted-foreground">₪{Number(v.amount).toLocaleString()}</span>}
              </div>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(v.id) }}
                disabled={deletingId === v.id}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="מחק"
              >
                {deletingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
            {/* Info row under header */}
            {(v.vehicleNumber || v.location || v.description) && (
              <div className="px-4 pb-2.5 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                {v.vehicleNumber && <span>רכב: {v.vehicleNumber}</span>}
                {v.location && <span>מיקום: {v.location}</span>}
                {v.description && <span className="truncate max-w-[200px]">{v.description}</span>}
              </div>
            )}
          </div>
        )
      })}

      {/* Add form */}
      {showAddForm && renderForm('add')}

      {/* Add button */}
      {!showAddForm && !editingId && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setShowAddForm(true); resetForm() }}>
          <Plus className="h-4 w-4" />
          הוסף דוח
        </Button>
      )}
    </div>
  )
}
