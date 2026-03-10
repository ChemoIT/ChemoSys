'use client'

/**
 * ReplacementVehicleDialog — Dialog for adding/editing a replacement vehicle record.
 *
 * The LIST view is now inline in VehicleDetailsSection.
 * This dialog handles only the ADD and EDIT forms.
 *
 * Props:
 *   - editRecordId: if provided, opens in edit mode for that record; else opens in add mode
 *   - onClose: called when dialog closes (parent should refresh records list)
 */

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { ChevronRight, Loader2, X, Plus, RefreshCw } from 'lucide-react'
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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Format today as yyyy-mm-dd */
function todayStr(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** Extract MOT summary string from motData JSONB */
function motSummary(motData: Record<string, unknown> | null): string | null {
  if (!motData) return null
  const parts = [
    motData.tozeret_nm as string,
    motData.degem_nm as string,
    motData.shnat_yitzur ? `(${motData.shnat_yitzur})` : null,
    motData.tzeva_rechev as string,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type Props = {
  vehicleId: string
  open: boolean
  editRecordId?: string | null
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
    if (!/^\d{6}$/.test(trimmed)) {
      toast.error('מספר כרטיס חייב להיות בדיוק 6 ספרות')
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
// ReplacementRecordForm — add/edit form
// ─────────────────────────────────────────────────────────────

function ReplacementRecordForm({
  vehicleId,
  record,
  onSave,
}: {
  vehicleId: string
  record: VehicleReplacementRecord | null
  onSave: (newRecordId?: string) => void
}) {
  const isEdit = !!record

  const [plate, setPlate] = useState(record?.licensePlate ?? '')
  const [entryDate, setEntryDate] = useState(record?.entryDate ?? (isEdit ? '' : todayStr()))
  const [entryKm, setEntryKm] = useState(record?.entryKm?.toString() ?? '')
  const [returnDate, setReturnDate] = useState(record?.returnDate ?? '')
  const [returnKm, setReturnKm] = useState(record?.returnKm?.toString() ?? '')
  const [reason, setReason] = useState<'maintenance' | 'test' | 'accident' | 'other'>(
    record?.reason ?? 'maintenance'
  )
  const [reasonOther, setReasonOther] = useState(record?.reasonOther ?? '')
  const [notes, setNotes] = useState(record?.notes ?? '')
  const [motData, setMotData] = useState<Record<string, unknown> | null>(record?.motData ?? null)
  const [motInfo, setMotInfo] = useState<string | null>(
    record?.motData ? motSummary(record.motData as Record<string, unknown>) : null
  )
  const [fuelCards, setFuelCards] = useState<VehicleFuelCard[]>(record?.fuelCards ?? [])

  const [isSaving, startSaving] = useTransition()
  const [isLooking, startLookup] = useTransition()

  const stayDays =
    entryDate && returnDate
      ? Math.round(
          (new Date(returnDate).getTime() - new Date(entryDate).getTime()) / 86400000
        )
      : null

  const kmTotal =
    entryKm && returnKm
      ? Math.max(0, parseInt(returnKm) - parseInt(entryKm))
      : null

  const computedStatus = returnDate ? 'returned' : 'active'

  function handleMotLookup() {
    if (!plate.trim()) return
    startLookup(async () => {
      const result = await lookupVehicleFromMot(plate)
      if (result.success && result.data) {
        const d = result.data as Record<string, unknown>
        setMotData(d)
        setMotInfo(motSummary(d))
      } else {
        toast.warning('לא נמצאו נתוני MOT לרכב זה')
        setMotData(null)
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
          motData,
        })
        if (result.success) {
          toast.success('הרשומה עודכנה')
          onSave()
        } else {
          toast.error(result.error ?? 'שגיאה בשמירה')
        }
      } else {
        const result = await addVehicleReplacementRecord({
          vehicleId,
          licensePlate: plate.trim(),
          entryDate,
          entryKm: entryKm ? parseInt(entryKm) : null,
          reason,
          reasonOther: reason === 'other' ? reasonOther.trim() : null,
          notes: notes.trim() || null,
          motData,
        })
        if (result.success && result.id) {
          toast.success('רכב חלופי נוסף — כעת ניתן להוסיף כרטיסי דלק')
          onSave(result.id)
        } else {
          toast.error(result.error ?? 'שגיאה בשמירה')
        }
      }
    })
  }

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
      {/* כותרת + סטטוס badge */}
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-sm flex-1">
          {isEdit ? 'עריכת רכב חלופי' : 'הוספת רכב חלופי'}
        </h3>
        {isEdit && (
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              computedStatus === 'active'
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300'
            }`}
          >
            {computedStatus === 'active' ? 'פעיל' : 'הוחזר'}
          </span>
        )}
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

      {/* תאריכים וק"מ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>
            תאריך כניסה <span className="text-red-500">*</span>
          </Label>
          <FleetDateInput value={entryDate} onChange={setEntryDate} minYear={2000} />
        </div>
        <div className="space-y-1.5">
          <Label>ק&quot;מ כניסה</Label>
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
          <Label>ק&quot;מ החזרה</Label>
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

      {/* כרטיסי דלק — רק במצב עריכה */}
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

      {/* כפתור שמירה */}
      <div className="flex justify-end pt-2">
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

export function ReplacementVehicleDialog({ vehicleId, open, editRecordId, onClose }: Props) {
  const [record, setRecord] = useState<VehicleReplacementRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const isEdit = !!editRecordId

  // Load the record to edit (if editRecordId is provided)
  useEffect(() => {
    if (open && editRecordId) {
      setIsLoading(true)
      void getVehicleReplacementRecords(vehicleId).then((data) => {
        const found = data.find((r) => r.id === editRecordId) ?? null
        setRecord(found)
        setIsLoading(false)
      })
    } else if (open && !editRecordId) {
      setRecord(null)
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editRecordId, vehicleId])

  function handleSave(newRecordId?: string) {
    if (newRecordId) {
      // New record created — reload as edit to allow fuel cards
      setIsLoading(true)
      void getVehicleReplacementRecords(vehicleId).then((data) => {
        const newRec = data.find((r) => r.id === newRecordId) ?? null
        setRecord(newRec)
        setIsLoading(false)
      })
    } else {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'עריכת רכב חלופי' : 'הוספת רכב חלופי'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ReplacementRecordForm
            vehicleId={vehicleId}
            record={record}
            onSave={handleSave}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
