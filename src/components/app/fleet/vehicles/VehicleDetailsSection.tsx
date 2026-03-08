'use client'

/**
 * VehicleDetailsSection -- Tab 1 of VehicleCard.
 *
 * Layout: two-column RTL grid
 *  Right column (first in RTL): MOT data (read-only, gray background)
 *  Left column: vehicle status + image gallery + inline replacement vehicles list
 *
 * Lock logic: returned/sold/decommissioned => all fields disabled except vehicle_status
 */

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Save, Lock, Plus, Trash2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { updateVehicleDetails } from '@/actions/fleet/vehicles'
import { syncVehicleFromMot } from '@/actions/fleet/mot-sync'
import {
  getVehicleReplacementRecords,
  deleteVehicleReplacementRecord,
} from '@/actions/fleet/vehicle-replacement'
import { formatLicensePlate, formatDate } from '@/lib/format'
import {
  VEHICLE_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  REPLACEMENT_REASON_LABELS,
  type VehicleFull,
  type VehicleReplacementRecord,
} from '@/lib/fleet/vehicle-types'
import { VehicleImageGallery } from './VehicleImageGallery'
import { ReplacementVehicleDialog } from './ReplacementVehicleDialog'

// ─────────────────────────────────────────────────────────────
// InfoRow -- read-only display row
// ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: '#EEF3F9' }}
    >
      <span className="text-sm text-muted-foreground w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-base flex-1 text-right font-medium text-foreground/80">
        {value ?? '—'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Status color helpers
// ─────────────────────────────────────────────────────────────

function getStatusStyle(status: string) {
  switch (status) {
    case 'active':
      return { bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' }
    case 'suspended':
      return { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' }
    default: // returned, sold, decommissioned
      return { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' }
  }
}

/** Calculate days between two dates (or from date to today) */
function daysBetween(start: string, end?: string | null): number {
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  return Math.max(0, Math.round((e - s) / 86400000))
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
// Props
// ─────────────────────────────────────────────────────────────

type Props = {
  vehicle: VehicleFull
  onEditingChange?: (isDirty: boolean) => void
}

// Statuses that lock the card (all fields disabled except vehicle_status)
const LOCKED_STATUSES = ['returned', 'sold', 'decommissioned'] as const
type LockedStatus = typeof LOCKED_STATUSES[number]

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleDetailsSection({ vehicle, onEditingChange }: Props) {
  const router = useRouter()

  // -- Editable form state --
  const [vehicleType, setVehicleType] = useState(vehicle.vehicleType ?? '')
  const [vehicleTypeNote, setVehicleTypeNote] = useState(vehicle.vehicleTypeNote ?? '')
  const [vehicleStatus, setVehicleStatus] = useState(vehicle.vehicleStatus ?? 'active')

  // -- Card lock state (returned/sold/decommissioned — user-set) --
  const isLocked = LOCKED_STATUSES.includes(vehicleStatus as LockedStatus)

  // -- Dialog state for add/edit replacement --
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRecordId, setEditRecordId] = useState<string | null>(null)

  // -- Replacement records (inline list) --
  const [records, setRecords] = useState<VehicleReplacementRecord[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // -- Derived: active replacement vehicle exists → auto-suspend --
  const hasActiveReplacement = !isLoadingRecords && records.some(r => r.status === 'active')

  // -- Effective display status (auto-suspended when replacement is active) --
  const effectiveStatus = hasActiveReplacement ? 'suspended' : vehicleStatus
  const statusStyle = getStatusStyle(effectiveStatus)

  // -- Transitions --
  const [isSaving, startSaveTransition] = useTransition()
  const [isSyncing, startSyncTransition] = useTransition()

  // -- Dirty tracking (based on actual vehicleStatus, not effectiveStatus) --
  const isDirty =
    vehicleStatus !== (vehicle.vehicleStatus ?? 'active') ||
    vehicleType !== (vehicle.vehicleType ?? '') ||
    vehicleTypeNote !== (vehicle.vehicleTypeNote ?? '')

  useEffect(() => {
    onEditingChange?.(isDirty)
  }, [isDirty, onEditingChange])

  // -- Load replacement records --
  async function loadRecords() {
    setIsLoadingRecords(true)
    const data = await getVehicleReplacementRecords(vehicle.id)
    setRecords(data)
    setIsLoadingRecords(false)
  }

  useEffect(() => {
    void loadRecords()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id])

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------

  function handleSave() {
    // Validate: when type is 'other', note is required
    if (vehicleType === 'other' && !vehicleTypeNote.trim()) {
      toast.error('יש להזין הערה כאשר סוג הרכב הוא "אחר"')
      return
    }
    startSaveTransition(async () => {
      const result = await updateVehicleDetails({
        vehicleId: vehicle.id,
        vehicleStatus,
        vehicleType: vehicleType || null,
        vehicleTypeNote: vehicleType === 'other' ? vehicleTypeNote : null,
      })
      if (result.success) {
        toast.success('פרטי הרכב נשמרו בהצלחה')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירה')
      }
    })
  }

  function handleMotSync() {
    startSyncTransition(async () => {
      const result = await syncVehicleFromMot(vehicle.id, vehicle.licensePlate)
      if (result.success) {
        toast.success('הנתונים עודכנו ממשרד הרישוי')
      } else {
        toast.error(result.error ?? 'שגיאה בסנכרון ממשרד הרישוי')
      }
    })
  }

  async function handleDeleteRecord(e: React.MouseEvent, recordId: string) {
    e.stopPropagation()
    setDeletingId(recordId)
    const result = await deleteVehicleReplacementRecord(recordId, vehicle.id)
    if (result.success) {
      toast.success('רכב חלופי נמחק')
      await loadRecords()
      router.refresh()
    } else {
      toast.error(result.error ?? 'שגיאה במחיקה')
    }
    setDeletingId(null)
  }

  function handleDialogClose() {
    setDialogOpen(false)
    setEditRecordId(null)
    void loadRecords()
    router.refresh()
  }

  function openAdd() {
    setEditRecordId(null)
    setDialogOpen(true)
  }

  function openEdit(recordId: string) {
    setEditRecordId(recordId)
    setDialogOpen(true)
  }

  // ----------------------------------------------------------
  // Shared styles
  // ----------------------------------------------------------

  const selectClass =
    'w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">

      {/* -- עמודה ימנית -- נתוני משרד הרישוי (קריאה בלבד) */}
      <div>
        <div
          className="rounded-xl p-3 mb-4"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <p className="text-sm text-muted-foreground font-semibold mb-3">נתוני משרד הרישוי</p>

          <InfoRow
            label="מספר רישוי"
            value={<span className="font-mono font-bold" dir="ltr">{formatLicensePlate(vehicle.licensePlate)}</span>}
          />
          <InfoRow label="יצרן" value={vehicle.tozoretNm} />
          <InfoRow label="דגם" value={vehicle.degemNm} />
          <InfoRow label="כינוי מסחרי" value={vehicle.kinuyMishari} />
          <InfoRow label="שנת ייצור" value={vehicle.shnatYitzur?.toString()} />
          <InfoRow label="צבע" value={vehicle.tzevaRechev} />
          <InfoRow label="סוג דלק" value={vehicle.sugDelekNm} />
          <InfoRow label="מסגרת (שלדה)" value={vehicle.misgeret} />
          <InfoRow label="דגם מנוע" value={vehicle.degemManoa} />
          <InfoRow label="רמת גימור" value={vehicle.ramatGimur} />
          <InfoRow label="קבוצת זיהום" value={vehicle.kvutzatZihum} />
          <InfoRow label="בעלות (רישוי)" value={vehicle.baalut} />
          <InfoRow
            label="עלייה לכביש"
            value={formatDate(vehicle.moedAliyaLakvish)}
          />

          {/* MOT sync row */}
          <div
            className="flex items-center justify-between py-2"
            style={{ borderTop: '1px solid #EEF3F9' }}
          >
            <button
              onClick={handleMotSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {isSyncing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />
              }
              עדכן ממשרד הרישוי
            </button>
            <span className="text-xs text-muted-foreground">
              {vehicle.motLastSyncAt
                ? `עודכן: ${formatDate(vehicle.motLastSyncAt.split('T')[0])}`
                : 'לא סונכרן'}
            </span>
          </div>
        </div>
      </div>

      {/* -- עמודה שמאלית -- שדות תפעוליים + רכבים חלופיים */}
      <div className="space-y-4">

        {/* ── סוג כלי הרכב ── */}
        <div
          className="rounded-xl p-4"
          style={{ background: '#F0F5FB', border: '1px solid #D4E0ED' }}
        >
          <Label className="text-sm font-semibold mb-2 block">סוג כלי הרכב</Label>
          <select
            value={vehicleType}
            onChange={(e) => {
              setVehicleType(e.target.value)
              if (e.target.value !== 'other') setVehicleTypeNote('')
            }}
            disabled={isLocked}
            className={selectClass}
          >
            <option value="">— בחר סוג —</option>
            {Object.entries(VEHICLE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {vehicleType === 'other' && (
            <div className="mt-2">
              <input
                type="text"
                value={vehicleTypeNote}
                onChange={(e) => setVehicleTypeNote(e.target.value)}
                placeholder="פרט את סוג הרכב (שדה חובה)"
                disabled={isLocked}
                className="w-full border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
                style={{ borderColor: vehicleTypeNote.trim() ? '#C8D5E2' : '#EF4444' }}
              />
              {!vehicleTypeNote.trim() && (
                <p className="text-xs text-red-500 mt-1">שדה חובה — יש לפרט את סוג הרכב</p>
              )}
            </div>
          )}
        </div>

        {/* תג נעילה — רכב חלופי פעיל */}
        {hasActiveReplacement && (
          <div className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5">
            <Lock className="h-4 w-4 shrink-0" />
            קיים רכב חלופי פעיל — הסטטוס ישוחרר אוטומטית עם החזרת הרכב החלופי
          </div>
        )}

        {/* תג נעילה — סטטוס הוחזר/נמכר/מושבת */}
        {isLocked && !hasActiveReplacement && (
          <div className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <Lock className="h-4 w-4 shrink-0" />
            הכרטיס נעול — שנה סטאטוס לפעיל כדי לערוך
          </div>
        )}

        {/* גלריית תמונות */}
        <div className="space-y-1.5">
          <VehicleImageGallery vehicleId={vehicle.id} isLocked={isLocked} />
        </div>

        {/* סטאטוס רכב — select צבעוני גדול (תא אחד בלבד) */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">סטאטוס רכב</Label>
          <select
            value={effectiveStatus}
            onChange={(e) => setVehicleStatus(e.target.value)}
            disabled={hasActiveReplacement || isLoadingRecords}
            className="w-full rounded-xl px-4 py-4 text-xl font-bold text-center border-2 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all disabled:cursor-not-allowed"
            style={{
              background: statusStyle.bg,
              color: statusStyle.color,
              borderColor: statusStyle.border,
              cursor: hasActiveReplacement ? 'not-allowed' : 'pointer',
              appearance: hasActiveReplacement ? 'none' : undefined,
            }}
          >
            {hasActiveReplacement ? (
              /* נעול — מציג מושבת זמני בלבד */
              <option value="suspended">מושבת זמני</option>
            ) : (
              /* זמין — כל הסטטוסים מלבד מושבת זמני */
              Object.entries(VEHICLE_STATUS_LABELS)
                .filter(([key]) => key !== 'suspended')
                .map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))
            )}
          </select>
          {hasActiveReplacement && (
            <p className="text-xs text-amber-600 text-center">
              הסטטוס משתנה אוטומטית — לא ניתן לעריכה ידנית
            </p>
          )}
        </div>

        {/* ──────────────────────────────────────────────── */}
        {/* רכבים חלופיים — רשימה inline                      */}
        {/* ──────────────────────────────────────────────── */}
        <div
          className="rounded-xl p-4"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground font-semibold">רכבים חלופיים</p>
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <Plus className="h-4 w-4" />
              הוסף
            </button>
          </div>

          {isLoadingRecords ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              אין רכבים חלופיים מתועדים
            </p>
          ) : (
            <div className="space-y-2">
              {records.map((rec) => {
                const days = daysBetween(rec.entryDate, rec.returnDate)
                const mot = motSummary(rec.motData as Record<string, unknown> | null)
                return (
                  <div
                    key={rec.id}
                    className="border border-border rounded-lg px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openEdit(rec.id)}
                  >
                    {/* שורה ראשונה: סטטוס + ימים | מספר רישוי + מחיקה */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            rec.status === 'active'
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'bg-gray-100 text-gray-600 border border-gray-300'
                          }`}
                        >
                          {rec.status === 'active' ? 'פעיל' : 'הוחזר'}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          {days} ימים{rec.status === 'active' ? ' בצי' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm" dir="ltr">
                          {rec.licensePlate}
                        </span>
                        <button
                          onClick={(e) => void handleDeleteRecord(e, rec.id)}
                          disabled={deletingId === rec.id}
                          className="text-muted-foreground hover:text-red-500 transition-colors p-0.5"
                          title="מחק רכב חלופי"
                          type="button"
                        >
                          {deletingId === rec.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* שורת MOT */}
                    {mot && (
                      <p className="text-xs text-muted-foreground mt-1">{mot}</p>
                    )}

                    {/* שורת פרטים: סיבה + תאריכים */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>{REPLACEMENT_REASON_LABELS[rec.reason]}</span>
                      <span>
                        {formatDate(rec.entryDate)}
                        {rec.returnDate && ` — ${formatDate(rec.returnDate)}`}
                      </span>
                    </div>
                    {rec.fuelCards.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rec.fuelCards.length} כרטיסי דלק
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {/* Save button — תחתית הטאב */}
        <div className="flex justify-start pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-base font-semibold transition-all"
            style={
              isDirty
                ? {
                    background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)',
                    color: '#fff',
                    border: '1px solid #3ABFB6',
                    boxShadow: '0 2px 8px rgb(78 205 196 / 0.4)',
                  }
                : {
                    background: '#F0F5FB',
                    color: '#637381',
                    border: '1px solid #C8D5E2',
                    cursor: 'not-allowed',
                  }
            }
          >
            {isSaving
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <Save className="h-5 w-5" />
            }
            שמור שינויים
          </button>
        </div>
      </div>

      {/* ReplacementVehicleDialog — for add/edit only */}
      <ReplacementVehicleDialog
        vehicleId={vehicle.id}
        open={dialogOpen}
        editRecordId={editRecordId}
        onClose={handleDialogClose}
      />
    </div>
  )
}
