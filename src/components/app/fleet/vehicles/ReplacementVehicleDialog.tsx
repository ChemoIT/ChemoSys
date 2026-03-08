'use client'

/**
 * ReplacementVehicleDialog — Dialog for managing replacement vehicles.
 *
 * Two views:
 *   list — shows all replacement records for a vehicle
 *   add  — form for adding a new replacement record
 *   edit — form for editing an existing record (with fuel cards sub-list)
 *
 * Business rules:
 *   - Only one active replacement per vehicle (enforced in server action)
 *   - After adding a new record → auto-switch to edit mode to enable fuel cards
 *   - Fuel cards: digits-only, hard-delete on remove
 *   - Closing dialog always triggers router.refresh() (vehicle_status may have changed)
 */

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, ChevronRight, Loader2, X, Car, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { FleetDateInput } from '@/components/app/fleet/shared/FleetDateInput'
import {
  getVehicleReplacementRecords,
  addVehicleReplacementRecord,
  updateVehicleReplacementRecord,
  addVehicleFuelCard,
  deleteVehicleFuelCard,
} from '@/actions/fleet/vehicle-replacement'
import {
  REPLACEMENT_REASON_LABELS,
  type VehicleReplacementRecord,
  type VehicleFuelCard,
} from '@/lib/fleet/vehicle-types'
import { lookupVehicleFromMot } from '@/actions/fleet/mot-sync'
import { formatDate } from '@/lib/format'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type DialogView = 'list' | 'add' | 'edit'

type Props = {
  vehicleId: string
  open: boolean
  onClose: () => void
}

// ─────────────────────────────────────────────────────────────
// FuelCardsList — internal sub-component for managing fuel cards
// ─────────────────────────────────────────────────────────────

function FuelCardsList({
  recordId,
  vehicleId,
  cards,
  onCardsChange,
}: {
  recordId: string
  vehicleId: string
  cards: VehicleFuelCard[]
  onCardsChange: () => void
}) {
  const [newCard, setNewCard] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  async function handleAdd() {
    const trimmed = newCard.trim()
    if (!/^\d+$/.test(trimmed)) {
      toast.error('מספר כרטיס חייב להכיל ספרות בלבד')
      return
    }
    setIsAdding(true)
    const result = await addVehicleFuelCard(recordId, trimmed)
    if (result.success) {
      setNewCard('')
      onCardsChange()
    } else {
      toast.error(result.error ?? 'שגיאה בהוספת הכרטיס')
    }
    setIsAdding(false)
  }

  async function handleRemove(cardId: string) {
    const result = await deleteVehicleFuelCard(cardId)
    if (result.success) {
      onCardsChange()
    } else {
      toast.error(result.error ?? 'שגיאה בהסרת הכרטיס')
    }
  }

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <Label>כרטיסי דלק</Label>

      {/* רשימת כרטיסים קיימים */}
      {cards.length > 0 ? (
        <div className="space-y-1">
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between px-3 py-1.5 bg-muted/40 rounded-lg text-sm"
            >
              <span className="font-mono" dir="ltr">
                {card.cardNumber}
              </span>
              <button
                onClick={() => void handleRemove(card.id)}
                className="text-muted-foreground hover:text-red-500 transition-colors"
                title="הסר כרטיס"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">אין כרטיסי דלק</p>
      )}

      {/* הוספת כרטיס חדש */}
      <div className="flex gap-2">
        <Input
          value={newCard}
          onChange={(e) => setNewCard(e.target.value.replace(/\D/g, ''))}
          placeholder="מספר כרטיס (ספרות בלבד)"
          dir="ltr"
          className="font-mono text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleAdd()
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void handleAdd()}
          disabled={!newCard || isAdding}
        >
          {isAdding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ReplacementRecordForm — internal form for add/edit
// ─────────────────────────────────────────────────────────────

function ReplacementRecordForm({
  vehicleId,
  record,
  onSave,
  onCancel,
}: {
  vehicleId: string
  record: VehicleReplacementRecord | null
  onSave: (newRecordId?: string) => void
  onCancel: () => void
}) {
  const isEdit = !!record

  // Form state — pre-filled in edit mode
  const [plate, setPlate] = useState(record?.licensePlate ?? '')
  const [entryDate, setEntryDate] = useState(record?.entryDate ?? '')
  const [entryKm, setEntryKm] = useState(record?.entryKm?.toString() ?? '')
  const [returnDate, setReturnDate] = useState(record?.returnDate ?? '')
  const [returnKm, setReturnKm] = useState(record?.returnKm?.toString() ?? '')
  const [reason, setReason] = useState<'maintenance' | 'test' | 'accident' | 'other'>(
    record?.reason ?? 'maintenance'
  )
  const [reasonOther, setReasonOther] = useState(record?.reasonOther ?? '')
  const [notes, setNotes] = useState(record?.notes ?? '')
  const [motInfo, setMotInfo] = useState<string | null>(null)
  const [fuelCards, setFuelCards] = useState<VehicleFuelCard[]>(record?.fuelCards ?? [])

  const [isSaving, startSaving] = useTransition()
  const [isLooking, startLookup] = useTransition()

  // חישוב תקופת שהייה (client-side)
  const stayDays =
    entryDate && returnDate
      ? Math.round(
          (new Date(returnDate).getTime() - new Date(entryDate).getTime()) / 86400000
        )
      : null

  // חישוב ק"מ (client-side)
  const kmTotal =
    entryKm && returnKm
      ? Math.max(0, parseInt(returnKm) - parseInt(entryKm))
      : null

  // MOT lookup לרכב החלופי
  function handleMotLookup() {
    if (!plate.trim()) return
    startLookup(async () => {
      const result = await lookupVehicleFromMot(plate)
      if (result.success && result.data) {
        const d = result.data as Record<string, unknown>
        setMotInfo(
          `${(d.tozeret_nm as string) ?? ''} ${(d.degem_nm as string) ?? ''} (${(d.shnat_yitzur as number) ?? ''})`
        )
      } else {
        toast.warning('לא נמצאו נתוני MOT לרכב זה')
        setMotInfo(null)
      }
    })
  }

  function handleSave() {
    if (!plate.trim()) {
      toast.error('נדרש מספר רישוי לרכב החלופי')
      return
    }
    if (!entryDate) {
      toast.error('נדרש תאריך כניסה')
      return
    }
    if (reason === 'other' && !reasonOther.trim()) {
      toast.error('נדרש הסבר לסיבה "אחר"')
      return
    }

    startSaving(async () => {
      if (isEdit && record) {
        // עדכון רשומה קיימת
        const result = await updateVehicleReplacementRecord({
          recordId: record.id,
          vehicleId,
          licensePlate: plate.trim(),
          entryDate,
          entryKm: entryKm ? parseInt(entryKm) : null,
          returnDate: returnDate || null,
          returnKm: returnKm ? parseInt(returnKm) : null,
          reason,
          reasonOther: reason === 'other' ? reasonOther.trim() : null,
          notes: notes.trim() || null,
        })
        if (result.success) {
          toast.success('הרשומה עודכנה')
          onSave()
        } else {
          toast.error(result.error ?? 'שגיאה בשמירה')
        }
      } else {
        // הוספת רשומה חדשה
        const result = await addVehicleReplacementRecord({
          vehicleId,
          licensePlate: plate.trim(),
          entryDate,
          entryKm: entryKm ? parseInt(entryKm) : null,
          reason,
          reasonOther: reason === 'other' ? reasonOther.trim() : null,
          notes: notes.trim() || null,
        })
        if (result.success && result.id) {
          toast.success('רכב חלופי נוסף — כעת ניתן להוסיף כרטיסי דלק')
          onSave(result.id) // מעביר recordId החדש לדיאלוג לעבור למצב עריכה
        } else {
          toast.error(result.error ?? 'שגיאה בשמירה')
        }
      }
    })
  }

  // רענון כרטיסי דלק ממסד הנתונים
  async function refreshFuelCards() {
    if (!record) return
    const records = await getVehicleReplacementRecords(vehicleId)
    const current = records.find((r) => r.id === record.id)
    setFuelCards(current?.fuelCards ?? [])
  }

  const selectClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right appearance-none cursor-pointer'

  return (
    <div className="space-y-4">
      {/* כותרת עם כפתור חזרה */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors"
          type="button"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <h3 className="font-semibold text-sm">
          {isEdit ? 'עריכת רכב חלופי' : 'הוספת רכב חלופי'}
        </h3>
      </div>

      {/* לוחית רישוי + MOT lookup */}
      <div className="space-y-1.5">
        <Label>מספר רישוי רכב חלופי</Label>
        <div className="flex gap-2">
          <Input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="לדוגמה: 12-345-67"
            dir="ltr"
            className="font-mono flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleMotLookup}
            disabled={!plate.trim() || isLooking}
            title="בדוק ב-MOT"
          >
            {isLooking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {motInfo && (
          <p className="text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded">
            {motInfo}
          </p>
        )}
      </div>

      {/* תאריכים וק"מ — 2 עמודות */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>
            תאריך כניסה <span className="text-red-500">*</span>
          </Label>
          <FleetDateInput value={entryDate} onChange={setEntryDate} minYear={2000} />
        </div>
        <div className="space-y-1.5">
          <Label>ק"מ כניסה</Label>
          <Input
            value={entryKm}
            onChange={(e) => setEntryKm(e.target.value.replace(/\D/g, ''))}
            placeholder="קילומטרז' בכניסה"
            dir="ltr"
            type="text"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5">
          <Label>תאריך החזרה</Label>
          <FleetDateInput value={returnDate} onChange={setReturnDate} minYear={2000} />
        </div>
        <div className="space-y-1.5">
          <Label>ק"מ החזרה</Label>
          <Input
            value={returnKm}
            onChange={(e) => setReturnKm(e.target.value.replace(/\D/g, ''))}
            placeholder="קילומטרז' בהחזרה"
            dir="ltr"
            type="text"
            inputMode="numeric"
          />
        </div>
      </div>

      {/* חישובים אוטומטיים */}
      {(stayDays !== null || kmTotal !== null) && (
        <div className="flex gap-4 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
          {stayDays !== null && (
            <span>
              תקופת שהייה: <strong>{stayDays} ימים</strong>
            </span>
          )}
          {kmTotal !== null && (
            <span>
              סה&quot;כ ק&quot;מ: <strong>{kmTotal.toLocaleString()}</strong>
            </span>
          )}
        </div>
      )}

      {/* סיבה */}
      <div className="space-y-1.5">
        <Label>
          סיבה <span className="text-red-500">*</span>
        </Label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as typeof reason)}
          className={selectClass}
        >
          {Object.entries(REPLACEMENT_REASON_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* הסבר לסיבה "אחר" */}
      {reason === 'other' && (
        <div className="space-y-1.5">
          <Label>
            הסבר <span className="text-red-500">*</span>
          </Label>
          <Input
            value={reasonOther}
            onChange={(e) => setReasonOther(e.target.value)}
            placeholder="פרט את הסיבה..."
          />
        </div>
      )}

      {/* הערות */}
      <div className="space-y-1.5">
        <Label>הערות</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות נוספות..."
          rows={2}
          className="w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      {/* כרטיסי דלק — רק במצב עריכה (לאחר שמירה ראשונה) */}
      {isEdit && record ? (
        <FuelCardsList
          recordId={record.id}
          vehicleId={vehicleId}
          cards={fuelCards}
          onCardsChange={() => void refreshFuelCards()}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          שמור קודם כדי להוסיף כרטיסי דלק
        </p>
      )}

      {/* כפתורי פעולה */}
      <div className="flex justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          ביטול
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          {isEdit ? 'שמור שינויים' : 'הוסף רכב חלופי'}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ReplacementVehicleDialog — main exported component
// ─────────────────────────────────────────────────────────────

export function ReplacementVehicleDialog({ vehicleId, open, onClose }: Props) {
  const router = useRouter()
  const [view, setView] = useState<DialogView>('list')
  const [editingRecord, setEditingRecord] = useState<VehicleReplacementRecord | null>(null)
  const [records, setRecords] = useState<VehicleReplacementRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // טעינת רשומות מהשרת
  async function loadRecords() {
    setIsLoading(true)
    const data = await getVehicleReplacementRecords(vehicleId)
    setRecords(data)
    setIsLoading(false)
  }

  // טען בפתיחת הדיאלוג
  useEffect(() => {
    if (open) {
      setView('list')
      setEditingRecord(null)
      void loadRecords()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicleId])

  // לאחר שמירת רשומה
  function handleSaveRecord(newRecordId?: string) {
    if (newRecordId) {
      // רשומה חדשה — עבור למצב עריכה כדי לאפשר הוספת כרטיסי דלק
      void getVehicleReplacementRecords(vehicleId).then((data) => {
        const newRecord = data.find((r) => r.id === newRecordId) ?? null
        setRecords(data)
        setEditingRecord(newRecord)
        setView('edit')
      })
    } else {
      // עדכון — חזור לרשימה ורענן
      void loadRecords()
      setView('list')
      router.refresh() // מרענן VehicleDetailsSection עם vehicleStatus מעודכן
    }
  }

  // סגירת הדיאלוג
  function handleClose() {
    router.refresh() // תמיד רענן — vehicle_status עשוי להשתנות
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            ניהול רכב חלופי
          </DialogTitle>
        </DialogHeader>

        {/* תצוגת רשימה */}
        {view === 'list' && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : records.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                אין רכבים חלופיים מתועדים
              </p>
            ) : (
              <div className="space-y-2">
                {records.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => {
                      setEditingRecord(rec)
                      setView('edit')
                    }}
                    className="w-full text-right border border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors space-y-1"
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          rec.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {rec.status === 'active' ? 'פעיל' : 'הוחזר'}
                      </span>
                      <span className="font-mono font-bold text-sm" dir="ltr">
                        {rec.licensePlate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{REPLACEMENT_REASON_LABELS[rec.reason]}</span>
                      <span>
                        {formatDate(rec.entryDate)}
                        {rec.returnDate && ` — ${formatDate(rec.returnDate)}`}
                      </span>
                    </div>
                    {rec.fuelCards.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {rec.fuelCards.length} כרטיסי דלק
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* כפתור הוסף */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setEditingRecord(null)
                setView('add')
              }}
            >
              <Plus className="h-4 w-4 ms-2" />
              הוסף רכב חלופי
            </Button>
          </div>
        )}

        {/* תצוגת טופס הוספה/עריכה */}
        {(view === 'add' || view === 'edit') && (
          <ReplacementRecordForm
            vehicleId={vehicleId}
            record={view === 'edit' ? editingRecord : null}
            onSave={handleSaveRecord}
            onCancel={() => setView('list')}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
