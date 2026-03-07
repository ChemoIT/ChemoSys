'use client'

/**
 * VehicleTestsSection — Tab 2 of VehicleCard.
 *
 * Shows vehicle test history + add/edit/delete with file upload.
 * Mirrors DriverDocumentsSection pattern.
 *
 * Features:
 *   - List: test_date, expiry_date (ExpiryIndicator), passed badge, station, cost, file, alert bell
 *   - Add/Edit form: FleetDateInput, passed checkbox, station, cost, FleetUploadZone, AlertToggle, notes
 *   - Quick expiry buttons: 3m / 1y / 2y
 *   - Delete: confirm dialog-less (using window.confirm for simplicity)
 *   - Dirty tracking via onEditingChange prop
 */

import { useState, useTransition, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Plus, Trash2, CheckCircle2, XCircle,
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
import { formatDate, daysUntil } from '@/lib/format'
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
  onEditingChange?: (isDirty: boolean) => void
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleTestsSection({ vehicleId, tests: initialTests, docYellowDays, onEditingChange }: Props) {
  const [tests, setTests] = useState<VehicleTest[]>(initialTests)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [testDate, setTestDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [passed, setPassed] = useState(true)
  const [testStation, setTestStation] = useState('')
  const [cost, setCost] = useState('')
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
    if (showAddForm) return testDate !== '' || expiryDate !== '' || testStation !== '' || cost !== '' || fileUrl !== '' || notes !== ''
    if (editingId) {
      const orig = tests.find((t) => t.id === editingId)
      if (!orig) return false
      return (
        testDate !== (orig.testDate ?? '') ||
        expiryDate !== (orig.expiryDate ?? '') ||
        passed !== orig.passed ||
        testStation !== (orig.testStation ?? '') ||
        cost !== (orig.cost?.toString() ?? '') ||
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
    setTestDate('')
    setExpiryDate('')
    setPassed(true)
    setTestStation('')
    setCost('')
    setFileUrl('')
    setAlertEnabled(true)
    setNotes('')
  }

  function startEdit(test: VehicleTest) {
    setEditingId(test.id)
    setTestDate(test.testDate)
    setExpiryDate(test.expiryDate)
    setPassed(test.passed)
    setTestStation(test.testStation ?? '')
    setCost(test.cost?.toString() ?? '')
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
  // CRUD
  // ─────────────────────────────────────────────────────────

  function handleAdd() {
    if (!testDate || !expiryDate) {
      toast.error('יש לבחור תאריך טסט ותאריך תפוגה')
      return
    }
    startAddTransition(async () => {
      const result = await addVehicleTest({
        vehicleId,
        testDate,
        expiryDate,
        passed,
        testStation: testStation || null,
        cost: cost ? parseFloat(cost) : null,
        notes: notes || null,
        fileUrl: fileUrl || null,
        alertEnabled,
      })
      if (result.success && result.id) {
        const newTest: VehicleTest = {
          id: result.id,
          vehicleId,
          testDate,
          expiryDate,
          passed,
          testStation: testStation || null,
          cost: cost ? parseFloat(cost) : null,
          notes: notes || null,
          fileUrl: fileUrl || null,
          alertEnabled,
          createdAt: new Date().toISOString(),
        }
        setTests((prev) => [newTest, ...prev])
        resetForm()
        setShowAddForm(false)
        toast.success('הטסט נוסף')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleUpdate() {
    if (!editingId || !testDate || !expiryDate) return
    startSaveTransition(async () => {
      const result = await updateVehicleTest({
        testId: editingId,
        vehicleId,
        testDate,
        expiryDate,
        passed,
        testStation: testStation || null,
        cost: cost ? parseFloat(cost) : null,
        notes: notes || null,
        fileUrl: fileUrl || null,
        alertEnabled,
      })
      if (result.success) {
        setTests((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  testDate,
                  expiryDate,
                  passed,
                  testStation: testStation || null,
                  cost: cost ? parseFloat(cost) : null,
                  notes: notes || null,
                  fileUrl: fileUrl || null,
                  alertEnabled,
                }
              : t
          )
        )
        setEditingId(null)
        resetForm()
        toast.success('הטסט עודכן')
      } else {
        toast.error(result.error)
      }
    })
  }

  async function handleDelete(testId: string) {
    if (!confirm('למחוק את הטסט?')) return
    setDeletingId(testId)
    const result = await deleteVehicleTest(testId, vehicleId)
    if (result.success) {
      setTests((prev) => prev.filter((t) => t.id !== testId))
      if (editingId === testId) {
        setEditingId(null)
        resetForm()
      }
      toast.success('הטסט נמחק')
    } else {
      toast.error(result.error)
    }
    setDeletingId(null)
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
  // Form render
  // ─────────────────────────────────────────────────────────

  function renderForm(mode: 'add' | 'edit') {
    const isBusy = mode === 'add' ? isAdding : isSaving

    return (
      <div className="border rounded-xl p-4 space-y-4 bg-muted/20">

        {/* תאריך טסט */}
        <div className="space-y-1.5">
          <Label>תאריך טסט *</Label>
          <FleetDateInput
            value={testDate}
            onChange={setTestDate}
            minYear={2000}
          />
        </div>

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

        {/* עבר / נכשל */}
        <div className="flex items-center justify-end gap-3">
          <Label>הטסט עבר</Label>
          <button
            type="button"
            onClick={() => setPassed((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              passed
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-red-300 bg-red-50 text-red-700'
            }`}
          >
            {passed
              ? <><CheckCircle2 className="h-4 w-4" /> עבר</>
              : <><XCircle className="h-4 w-4" /> נכשל</>
            }
          </button>
        </div>

        {/* תחנת טסט */}
        <div className="space-y-1.5">
          <Label>תחנת טסט</Label>
          <input
            type="text"
            value={testStation}
            onChange={(e) => setTestStation(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
            placeholder="שם התחנה..."
          />
        </div>

        {/* עלות */}
        <div className="space-y-1.5">
          <Label>עלות (₪)</Label>
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
            placeholder="0"
            min="0"
          />
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
            disabled={isBusy || !testDate || !expiryDate}
          >
            {isBusy && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
            {mode === 'add' ? (
              <>
                <Plus className="h-4 w-4 ms-1" />
                הוסף טסט
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
          <p className="text-sm text-muted-foreground">אין רשומות טסט עבור רכב זה</p>
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
                className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:bg-muted/20 transition-colors cursor-pointer group"
                onClick={() => startEdit(test)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    {test.passed
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        טסט {formatDate(test.testDate)}
                      </span>
                      {test.alertEnabled && (
                        <Bell className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="התראה פעילה" />
                      )}
                      {test.passed
                        ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">עבר</span>
                        : <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">נכשל</span>
                      }
                      {test.cost != null && (
                        <span className="text-xs text-muted-foreground">₪{test.cost.toLocaleString()}</span>
                      )}
                    </div>
                    <ExpiryIndicator expiryDate={test.expiryDate} yellowDays={docYellowDays} />
                    {test.testStation && (
                      <p className="text-xs text-muted-foreground mt-0.5">{test.testStation}</p>
                    )}
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
          הוסף טסט
        </Button>
      )}
    </div>
  )
}
