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
      className="flex items-start gap-3 py-2 border-b last:border-0"
      style={{ borderColor: '#EEF3F9' }}
    >
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm flex-1 text-right font-medium text-foreground/80">
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
  const [vehicleStatus, setVehicleStatus] = useState(vehicle.vehicleStatus ?? 'active')

  // -- Lock state (derived from vehicleStatus) --
  const isLocked = LOCKED_STATUSES.includes(vehicleStatus as LockedStatus)

  // -- Dialog state for add/edit replacement --
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRecordId, setEditRecordId] = useState<string | null>(null)

  // -- Replacement records (inline list) --
  const [records, setRecords] = useState<VehicleReplacementRecord[]>([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // -- Transitions --
  const [isSaving, startSaveTransition] = useTransition()
  const [isSyncing, startSyncTransition] = useTransition()

  // -- Dirty tracking --
  const isDirty = vehicleStatus !== (vehicle.vehicleStatus ?? 'active')

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
    startSaveTransition(async () => {
      const result = await updateVehicleDetails({
        vehicleId: vehicle.id,
        vehicleStatus,
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

  const statusStyle = getStatusStyle(vehicleStatus)

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
          <p className="text-xs text-muted-foreground font-semibold mb-2">נתוני משרד הרישוי</p>

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

        {/* תג נעילה -- מוצג רק כשנעול */}
        {isLocked && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Lock className="h-3.5 w-3.5" />
            הכרטיס נעול — שנה סטאטוס לפעיל/מושבת זמני כדי לערוך
          </div>
        )}

        {/* גלריית תמונות */}
        <div className="space-y-1.5">
          <VehicleImageGallery vehicleId={vehicle.id} isLocked={isLocked} />
        </div>

        {/* סטאטוס רכב — badge גדול ובולט + select */}
        <div className="space-y-2">
          <Label>סטאטוס רכב</Label>

          {/* Badge בולט */}
          <div
            className="flex items-center justify-center rounded-xl px-4 py-3 text-lg font-bold"
            style={{
              background: statusStyle.bg,
              color: statusStyle.color,
              border: `2px solid ${statusStyle.border}`,
            }}
          >
            {VEHICLE_STATUS_LABELS[vehicleStatus as keyof typeof VEHICLE_STATUS_LABELS] ?? vehicleStatus}
          </div>

          {/* select לשינוי */}
          <select
            value={vehicleStatus}
            onChange={(e) => setVehicleStatus(e.target.value)}
            className={selectClass}
          >
            {Object.entries(VEHICLE_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Save button */}
        <div className="flex justify-start">
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              isDirty
                ? {
                    background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)',
                    color: '#fff',
                    border: '1px solid #3ABFB6',
                    boxShadow: '0 2px 6px rgb(78 205 196 / 0.35)',
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
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            שמור שינויים
          </button>
        </div>

        {/* ──────────────────────────────────────────────── */}
        {/* רכבים חלופיים — רשימה inline                      */}
        {/* ──────────────────────────────────────────────── */}
        <div
          className="rounded-xl p-3"
          style={{ background: '#F7FAFD', border: '1px solid #E2EBF4' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground font-semibold">רכבים חלופיים</p>
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
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
