'use client'

/**
 * DriverViolationsSection — manages traffic violations (תרבות נהיגה).
 *
 * Fields per violation:
 *   מספר דוח | תאריך | סוג (תנועה/חניה/תאונה) | רכב | מיקום |
 *   נקודות | סכום | תיאור | הערות | קובץ
 */

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Upload, ChevronDown, ChevronUp, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import {
  addDriverViolation,
  deleteDriverViolation,
  type DriverViolation,
} from '@/actions/fleet/drivers'

type Props = {
  driverId: string
  violations: DriverViolation[]
}

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

export function DriverViolationsSection({ driverId, violations: initialViolations }: Props) {
  const [violations, setViolations] = useState<DriverViolation[]>(initialViolations)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Add form
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
  const [isAdding, startAddTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
      const { data } = supabase.storage.from('fleet-documents').getPublicUrl(fileName)
      return data.publicUrl
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

  function handleAdd() {
    startAddTransition(async () => {
      const effectiveDescription = violationType === 'other' && otherType
        ? `${otherType}${description ? ' — ' + description : ''}`
        : description || undefined
      const result = await addDriverViolation({
        driverId,
        violationNumber: violationNumber || undefined,
        violationDate: violationDate || undefined,
        violationType: violationType === 'other' ? 'traffic' : violationType, // DB fallback for 'other'
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

  async function handleDelete(id: string) {
    if (!confirm('למחוק את הדוח?')) return
    setDeletingId(id)
    const result = await deleteDriverViolation(id, driverId)
    if (result.success) {
      setViolations((prev) => prev.filter((v) => v.id !== id))
      toast.success('הדוח נמחק')
    } else {
      toast.error(result.error)
    }
    setDeletingId(null)
  }

  const totalPoints = violations.reduce((sum, v) => sum + (v.points ?? 0), 0)
  const totalAmount = violations.reduce((sum, v) => sum + (v.amount ?? 0), 0)

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
        const isExpanded = expandedId === v.id
        return (
          <div key={v.id} className="border rounded-lg overflow-hidden">
            {/* Row header — always visible */}
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
              <button
                onClick={() => setExpandedId(isExpanded ? null : v.id)}
                className="flex-1 flex items-center gap-3 text-right"
              >
                <Badge variant={VIOLATION_TYPE_VARIANT[v.violationType ?? 'traffic'] ?? 'secondary'}>
                  {VIOLATION_TYPE_LABELS[v.violationType ?? ''] ?? '—'}
                </Badge>
                <span className="text-sm font-medium flex-1">
                  {v.violationDate ? new Date(v.violationDate).toLocaleDateString('he-IL') : '—'}
                  {v.violationNumber && <span className="text-muted-foreground ms-2">מ' {v.violationNumber}</span>}
                </span>
                {v.points > 0 && <span className="text-xs text-muted-foreground">{v.points} נק'</span>}
                {v.amount && <span className="text-xs text-muted-foreground">₪{Number(v.amount).toLocaleString()}</span>}
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              <button
                onClick={() => handleDelete(v.id)}
                disabled={deletingId === v.id}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="מחק"
              >
                {deletingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t bg-muted/10 grid grid-cols-2 gap-3 text-sm">
                {v.vehicleNumber && <div><span className="text-xs text-muted-foreground">מספר רכב: </span>{v.vehicleNumber}</div>}
                {v.location && <div><span className="text-xs text-muted-foreground">מיקום: </span>{v.location}</div>}
                {v.description && <div className="col-span-2"><span className="text-xs text-muted-foreground">תיאור: </span>{v.description}</div>}
                {v.notes && <div className="col-span-2"><span className="text-xs text-muted-foreground">הערות: </span>{v.notes}</div>}
                {v.fileUrl && (
                  <div className="col-span-2">
                    <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline text-xs">
                      <FileText className="h-3.5 w-3.5" />
                      פתח קובץ דוח
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add form */}
      {showAddForm && (
        <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>מספר דוח</Label>
              <Input value={violationNumber} onChange={(e) => setViolationNumber(e.target.value)} dir="ltr" placeholder="12345678" />
            </div>
            <div className="space-y-1.5">
              <Label>תאריך</Label>
              <Input type="date" value={violationDate} onChange={(e) => setViolationDate(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>סוג עבירה</Label>
              <select
                value={violationType}
                onChange={(e) => setViolationType(e.target.value as 'traffic' | 'parking' | 'accident' | 'other')}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
                  placeholder="תאר את סוג העבירה..."
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring mt-1"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>מספר רכב מעורב</Label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} dir="ltr" placeholder="12-345-67" />
            </div>
            <div className="space-y-1.5">
              <Label>נקודות תנועה</Label>
              <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} dir="ltr" placeholder="4" min={0} max={20} />
            </div>
            <div className="space-y-1.5">
              <Label>סכום לתשלום (₪)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" placeholder="250" min={0} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>מיקום</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="כביש 1 קרבת רמת גן..." />
          </div>
          <div className="space-y-1.5">
            <Label>תיאור העבירה</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="עבר אור אדום בצומת..." />
          </div>
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות נוספות..." />
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label>העלאת הדוח (PDF/תמונה)</Label>
            {fileUrl ? (
              <div className="flex items-center gap-2">
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">קובץ הועלה ✓</a>
                <button onClick={() => setFileUrl('')} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-3 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border'}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault(); setDragging(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) { const url = await uploadFile(file); if (url) setFileUrl(url) }
                }}
              >
                <p className="text-xs text-center text-muted-foreground mb-2">{dragging ? 'שחרר כאן...' : 'גרור קובץ לכאן'}</p>
                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'מעלה...' : 'בחר קובץ'}
                </Button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return
              const url = await uploadFile(file); if (url) { setFileUrl(url); e.target.value = '' }
            }} />
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleAdd} disabled={isAdding}>
              {isAdding && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
              הוסף דוח
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowAddForm(false) }}>ביטול</Button>
          </div>
        </div>
      )}

      {!showAddForm && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" />
          הוסף דוח
        </Button>
      )}
    </div>
  )
}
