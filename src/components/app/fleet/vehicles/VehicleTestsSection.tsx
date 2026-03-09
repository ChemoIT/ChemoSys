'use client'

/**
 * VehicleTestsSection — Simplified licensing (tests) sub-section.
 *
 * Shows test records list + add/edit/delete with file upload.
 * Stripped fields: test_date, passed, test_station, cost (removed per contract tab redesign).
 * Remaining: expiry_date + alert toggle + file upload + notes.
 */

import { useState, useTransition, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Plus, Trash2,
  Bell, Pencil, Save, ClipboardCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import {
  addVehicleTest,
  deleteVehicleTest,
  updateVehicleTest,
} from '@/actions/fleet/vehicles'
import { daysUntil } from '@/lib/format'
import { FleetDateInput } from '../shared/FleetDateInput'
import { AlertToggle } from '../shared/AlertToggle'
import { ExpiryIndicator } from '../shared/ExpiryIndicator'
import { FleetUploadZone } from '../shared/FleetUploadZone'
import type { VehicleTest } from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type Props = {
  vehicleId: string
  tests: VehicleTest[]
  docYellowDays: number
  isLocked?: boolean
  onEditingChange?: (isDirty: boolean) => void
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleTestsSection({ vehicleId, tests: initialTests, docYellowDays, isLocked = false, onEditingChange }: Props) {
  const [tests, setTests] = useState<VehicleTest[]>(initialTests)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state (simplified — only expiry, alert, file, notes)
  const [expiryDate, setExpiryDate] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [isAdding, startAddTransition] = useTransition()
  const [isSaving, startSaveTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Dirty tracking
  const isFormDirty = (() => {
    if (showAddForm) return expiryDate !== '' || fileUrl !== '' || notes !== ''
    if (editingId) {
      const orig = tests.find((t) => t.id === editingId)
      if (!orig) return false
      return (
        expiryDate !== (orig.expiryDate ?? '') ||
        fileUrl !== (orig.fileUrl ?? '') ||
        alertEnabled !== orig.alertEnabled ||
        notes !== (orig.notes ?? '')
      )
    }
    return false
  })()

  useEffect(() => {
    onEditingChange?.(isFormDirty)
  }, [isFormDirty, onEditingChange])

  // ─────────────────────────────────────────────────────────
  // File upload
  // ─────────────────────────────────────────────────────────

  async function uploadFile(file: File): Promise<string | null> {
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const ext = file.name.split('.').pop() ?? 'pdf'
      const fileName = `${vehicleId}_test_${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('fleet-vehicle-documents')
        .upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data: signedData, error: signedError } = await supabase.storage
        .from('fleet-vehicle-documents')
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

  // ─────────────────────────────────────────────────────────
  // Form helpers
  // ─────────────────────────────────────────────────────────

  function resetForm() {
    setExpiryDate('')
    setFileUrl('')
    setAlertEnabled(true)
    setNotes('')
  }

  function startEdit(test: VehicleTest) {
    setEditingId(test.id)
    setExpiryDate(test.expiryDate)
    setFileUrl(test.fileUrl ?? '')
    setAlertEnabled(test.alertEnabled)
    setNotes(test.notes ?? '')
    setShowAddForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
    resetForm()
  }

  // ─────────────────────────────────────────────────────────
  // Quick expiry helper
  // ─────────────────────────────────────────────────────────

  function setQuickExpiry(months: number) {
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setExpiryDate(`${yyyy}-${mm}-${dd}`)
  }

  // ─────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────

  function handleAdd() {
    if (!expiryDate) {
      toast.error('יש לבחור תאריך תפוגה')
      return
    }
    startAddTransition(async () => {
      // Pass today as testDate (required by DB) and defaults for stripped fields
      const today = new Date().toISOString().slice(0, 10)
      const result = await addVehicleTest({
        vehicleId,
        testDate: today,
        expiryDate,
        passed: true,
        testStation: null,
        cost: null,
        notes: notes || null,
        fileUrl: fileUrl || null,
        alertEnabled,
      })
      if (result.success && result.id) {
        const newTest: VehicleTest = {
          id: result.id,
          vehicleId,
          testDate: today,
          expiryDate,
          passed: true,
          testStation: null,
          cost: null,
          notes: notes || null,
          fileUrl: fileUrl || null,
          alertEnabled,
          createdAt: new Date().toISOString(),
        }
        setTests((prev) => [newTest, ...prev])
        resetForm()
        setShowAddForm(false)
        toast.success('הרישוי נוסף')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleUpdate() {
    if (!editingId || !expiryDate) return
    startSaveTransition(async () => {
      const orig = tests.find((t) => t.id === editingId)
      const result = await updateVehicleTest({
        testId: editingId,
        vehicleId,
        testDate: orig?.testDate ?? new Date().toISOString().slice(0, 10),
        expiryDate,
        passed: orig?.passed ?? true,
        testStation: orig?.testStation ?? null,
        cost: orig?.cost ?? null,
        notes: notes || null,
        fileUrl: fileUrl || null,
        alertEnabled,
      })
      if (result.success) {
        setTests((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? { ...t, expiryDate, notes: notes || null, fileUrl: fileUrl || null, alertEnabled }
              : t
          )
        )
        setEditingId(null)
        resetForm()
        toast.success('הרישוי עודכן')
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handleDelete(testId: string) {
    if (!confirm('למחוק את הרישוי?')) return
    setDeletingId(testId)
    const result = await deleteVehicleTest(testId, vehicleId)
    if (result.success) {
      setTests((prev) => prev.filter((t) => t.id !== testId))
      if (editingId === testId) {
        setEditingId(null)
        resetForm()
      }
      toast.success('הרישוי נמחק')
    } else {
      toast.error(result.error)
    }
    setDeletingId(null)
  }

  // ─────────────────────────────────────────────────────────
  // Form render
  // ─────────────────────────────────────────────────────────

  function renderForm(mode: 'add' | 'edit') {
    const isBusy = mode === 'add' ? isAdding : isSaving

    return (
      <div className="border rounded-xl p-4 space-y-4 bg-muted/20">

        {/* תאריך תפוגה */}
        <div className="space-y-2">
          <Label>תאריך תפוגה *</Label>
          <div className="flex items-center gap-4 flex-wrap">
            <FleetDateInput value={expiryDate} onChange={setExpiryDate} />
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
                onClick={() => setQuickExpiry(months)}
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

        {/* File upload */}
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

        {/* הערות */}
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
            onClick={() => {
              if (mode === 'add') {
                resetForm()
                setShowAddForm(false)
              } else {
                cancelEdit()
              }
            }}
          >
            ביטול
          </Button>
          <Button
            size="sm"
            onClick={mode === 'add' ? handleAdd : handleUpdate}
            disabled={isBusy || !expiryDate}
          >
            {isBusy && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
            {mode === 'add' ? (
              <>
                <Plus className="h-4 w-4 ms-1" />
                הוסף רישוי
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

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Empty state */}
      {tests.length === 0 && !showAddForm && (
        <div className="text-center py-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: '#F0F5FB', border: '1px solid #E2EBF4' }}
          >
            <ClipboardCheck className="h-6 w-6 text-muted-foreground/35" />
          </div>
          <p className="text-sm text-muted-foreground">אין רשומות רישוי עבור רכב זה</p>
        </div>
      )}

      {/* Test list */}
      {tests.length > 0 && (
        <div className="space-y-2">
          {tests.map((test) => {
            const isEditing = editingId === test.id
            if (isEditing) return <div key={test.id}>{renderForm('edit')}</div>

            return (
              <div
                key={test.id}
                className={`flex items-start justify-between gap-3 p-3 border rounded-lg transition-colors group ${isLocked ? '' : 'hover:bg-muted/20 cursor-pointer'}`}
                onClick={isLocked ? undefined : () => startEdit(test)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">רישוי</span>
                      {test.alertEnabled && (
                        <Bell className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="התראה פעילה" />
                      )}
                    </div>
                    <ExpiryIndicator expiryDate={test.expiryDate} yellowDays={docYellowDays} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {test.fileUrl && (
                    <a
                      href={test.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      פתח קובץ
                    </a>
                  )}
                  {!isLocked && (
                    <>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(test.id) }}
                        disabled={deletingId === test.id}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="מחק"
                      >
                        {deletingId === test.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      {showAddForm && renderForm('add')}

      {/* Add button — hidden when vehicle is locked */}
      {!showAddForm && !editingId && !isLocked && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => { setShowAddForm(true); resetForm() }}
        >
          <Plus className="h-4 w-4" />
          הוסף רישוי
        </Button>
      )}
    </div>
  )
}
