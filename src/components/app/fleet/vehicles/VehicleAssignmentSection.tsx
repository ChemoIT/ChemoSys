'use client'

/**
 * VehicleAssignmentSection — Tab 4: צמידות (Vehicle Assignment).
 *
 * Two-column RTL grid (mirrors VehicleContractSection layout):
 *   Right column:
 *     1. Vehicle category selector (מחנה / צמוד נהג) — auto-save on change
 *     2. Camp responsible sub-form — shown only when vehicleCategory === 'camp'
 *     3. Driver activity journal — history table + inline assign/end form
 *   Left column:
 *     4. Project activity journal — history table + inline assign/end form
 *
 * Design rules:
 *  - dir="rtl" on outermost div
 *  - FleetDateInput for all date fields (NO native date input)
 *  - formatDate() + formatPhone() for all display output
 *  - Teal gradient save button when dirty, gray when clean
 *  - Inline forms (collapse/expand) — NOT Dialog
 */

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Shuffle,
  Users,
  FolderKanban,
  Loader2,
  ChevronDown,
  ChevronUp,
  Phone,
  User,
  Search,
  Check,
  ChevronsUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { FleetDateInput } from '@/components/app/fleet/shared/FleetDateInput'
import {
  getActiveDriversForAssignment,
  updateVehicleDetails,
  assignDriverJournal,
  endDriverJournal,
  assignProjectJournal,
  endProjectJournal,
  getActiveProjectsForSelect,
} from '@/actions/fleet/vehicles'
import { formatDate, formatPhone } from '@/lib/format'
import type {
  VehicleFull,
  VehicleDriverJournal,
  VehicleProjectJournal,
  DriverOptionForAssignment,
} from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ProjectOption = {
  id: string
  name: string
  projectNumber: string
}

type Props = {
  vehicleId: string
  vehicle: VehicleFull
  driverJournal: VehicleDriverJournal[]
  projectJournal: VehicleProjectJournal[]
  isLocked?: boolean
  onEditingChange?: (isEditing: boolean) => void
}

// ─────────────────────────────────────────────────────────────
// Helper — "נוכחי" / "אחרון" badge
// ─────────────────────────────────────────────────────────────

function CurrentBadge({ isLast }: { isLast?: boolean }) {
  if (isLast) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #D1D5DB' }}
      >
        אחרון
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}
    >
      נוכחי
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────

const sectionCard = 'bg-[#F0F5FB] border border-[#C8D5E2] rounded-xl p-4'
const sectionHeader = 'text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2'
const selectClass =
  'flex-1 min-w-[180px] border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right'
const inputClass =
  'w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right'

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleAssignmentSection({
  vehicleId,
  vehicle,
  driverJournal,
  projectJournal,
  isLocked = false,
  onEditingChange,
}: Props) {
  const router = useRouter()

  // ── Category selector ──
  const [category, setCategory] = useState<'camp' | 'assigned' | null>(
    vehicle.vehicleCategory ?? null,
  )
  const [isSavingCategory, startCategoryTransition] = useTransition()

  // ── Camp sub-form state ──
  const [campType, setCampType] = useState<'project_manager' | 'other'>(
    vehicle.campResponsibleType ?? 'project_manager',
  )
  const [campName, setCampName] = useState(vehicle.campResponsibleName ?? '')
  const [campPhone, setCampPhone] = useState(vehicle.campResponsiblePhone ?? '')
  const [isSavingCamp, startCampTransition] = useTransition()

  // Track original camp values to detect dirty state
  const origCampType  = vehicle.campResponsibleType  ?? 'project_manager'
  const origCampName  = vehicle.campResponsibleName  ?? ''
  const origCampPhone = vehicle.campResponsiblePhone ?? ''

  const campDirty =
    campType  !== origCampType  ||
    campName  !== origCampName  ||
    campPhone !== origCampPhone

  // Report dirty state up to VehicleCard
  useEffect(() => {
    onEditingChange?.(category === 'camp' ? campDirty : false)
  }, [campDirty, category, onEditingChange])

  // ── Driver journal — inline form ──
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [drivers, setDrivers] = useState<DriverOptionForAssignment[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [driverPopoverOpen, setDriverPopoverOpen] = useState(false)
  const [driverStartDate, setDriverStartDate] = useState('')
  const [isAssigningDriver, startAssignDriverTransition] = useTransition()
  const [isEndingDriver, startEndDriverTransition] = useTransition()

  const activeDriverEntry = driverJournal.find((e) => e.endDate === null)
  const selectedDriverLabel = useMemo(() => {
    if (!selectedDriverId) return null
    return drivers.find((d) => d.id === selectedDriverId)
  }, [selectedDriverId, drivers])

  // Load drivers when form opens
  const openDriverForm = useCallback(() => {
    setShowDriverForm(true)
    if (drivers.length === 0) {
      setLoadingDrivers(true)
      void getActiveDriversForAssignment()
        .then((list) => { setDrivers(list); setLoadingDrivers(false) })
        .catch(() => setLoadingDrivers(false))
    }
  }, [drivers.length])

  // ── Project journal — inline form ──
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectStartDate, setProjectStartDate] = useState('')
  const [isAssigningProject, startAssignProjectTransition] = useTransition()
  const [isEndingProject, startEndProjectTransition] = useTransition()

  const activeProjectEntry = projectJournal.find((e) => e.endDate === null)

  const openProjectForm = useCallback(() => {
    setShowProjectForm(true)
    if (projects.length === 0) {
      setLoadingProjects(true)
      void getActiveProjectsForSelect()
        .then((list) => { setProjects(list as ProjectOption[]); setLoadingProjects(false) })
        .catch(() => setLoadingProjects(false))
    }
  }, [projects.length])

  // ─────────────────────────────────────────────────────────
  // Handlers — category
  // ─────────────────────────────────────────────────────────

  function handleCategoryChange(newCat: 'camp' | 'assigned') {
    if (newCat === category) return
    setCategory(newCat)
    startCategoryTransition(async () => {
      const result = await updateVehicleDetails({ vehicleId, vehicleCategory: newCat })
      if (result.success) {
        toast.success('קטגוריית הרכב עודכנה')
        router.refresh()
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת הקטגוריה')
        setCategory(vehicle.vehicleCategory ?? null)
      }
    })
  }

  // ─────────────────────────────────────────────────────────
  // Handlers — camp sub-form
  // ─────────────────────────────────────────────────────────

  function handleSaveCamp() {
    startCampTransition(async () => {
      const result = await updateVehicleDetails({
        vehicleId,
        campResponsibleType:  campType,
        campResponsibleName:  campType === 'other' ? campName.trim()  : null,
        campResponsiblePhone: campType === 'other' ? campPhone.trim() : null,
      })
      if (result.success) {
        toast.success('הפרטים נשמרו')
        router.refresh()
      } else {
        toast.error(result.error ?? 'שגיאה בשמירה')
      }
    })
  }

  // ─────────────────────────────────────────────────────────
  // Handlers — driver journal
  // ─────────────────────────────────────────────────────────

  function handleAssignDriver() {
    if (!selectedDriverId) { toast.error('יש לבחור נהג'); return }
    if (!driverStartDate)  { toast.error('יש לבחור תאריך התחלה'); return }
    startAssignDriverTransition(async () => {
      const result = await assignDriverJournal(vehicleId, selectedDriverId, driverStartDate)
      if (result.success) {
        toast.success('הנהג שויך בהצלחה')
        setShowDriverForm(false)
        setSelectedDriverId('')
        setDriverStartDate('')
        router.refresh()
      } else {
        toast.error(result.error ?? 'שגיאה בשיוך הנהג')
      }
    })
  }

  function handleEndDriver() {
    startEndDriverTransition(async () => {
      const result = await endDriverJournal(vehicleId)
      if (result.success) {
        toast.success('שיוך הנהג הסתיים')
        setShowDriverForm(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'שגיאה בסיום השיוך')
      }
    })
  }

  // ─────────────────────────────────────────────────────────
  // Handlers — project journal
  // ─────────────────────────────────────────────────────────

  function handleAssignProject() {
    if (!selectedProjectId) { toast.error('יש לבחור פרויקט'); return }
    if (!projectStartDate)  { toast.error('יש לבחור תאריך התחלה'); return }
    startAssignProjectTransition(async () => {
      const result = await assignProjectJournal(vehicleId, selectedProjectId, projectStartDate)
      if (result.success) {
        toast.success('הפרויקט שויך בהצלחה')
        setShowProjectForm(false)
        setSelectedProjectId('')
        setProjectStartDate('')
        router.refresh()
      } else {
        toast.error(result.error ?? 'שגיאה בשיוך הפרויקט')
      }
    })
  }

  function handleEndProject() {
    startEndProjectTransition(async () => {
      const result = await endProjectJournal(vehicleId)
      if (result.success) {
        toast.success('שיוך הפרויקט הסתיים')
        setShowProjectForm(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'שגיאה בסיום השיוך')
      }
    })
  }

  // ─────────────────────────────────────────────────────────
  // Render — two-column grid like VehicleContractSection
  // ─────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* RIGHT COLUMN — Category + Camp Responsible + Drivers   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div dir="rtl" className="space-y-6">

        {/* ══ 1. Vehicle Category Selector ══════════════════════ */}
        <div>
          <h3 className={sectionHeader}>
            <Shuffle className="h-4 w-4" />
            קטגוריית רכב
          </h3>

          <div className="flex gap-3 flex-wrap">
            {(['camp', 'assigned'] as const).map((cat) => {
              const label = cat === 'camp' ? 'רכב מחנה' : 'רכב צמוד נהג'
              const active = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  disabled={isSavingCategory || isLocked}
                  onClick={() => handleCategoryChange(cat)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
                  style={{
                    background: active ? 'linear-gradient(135deg, #4ECDC4, #3ABFB6)' : '#F8FAFB',
                    borderColor: active ? '#3ABFB6' : '#C8D5E2',
                    color: active ? '#fff' : '#374151',
                    boxShadow: active ? '0 2px 8px rgba(78,205,196,0.3)' : 'none',
                  }}
                >
                  {isSavingCategory && category === cat ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                  {label}
                </button>
              )
            })}

            {!category && (
              <p className="text-xs text-muted-foreground self-center">
                לא הוגדרה קטגוריה — בחר אחת מהאפשרויות לעיל
              </p>
            )}
          </div>
        </div>

        {/* ══ 2. Camp Responsible Sub-form ═══════════════════════ */}
        {category === 'camp' && (
          <div className={sectionCard}>
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              אחראי רכב
            </h3>

            {/* Camp type radio */}
            <div className="flex flex-col gap-3 mb-4">
              {(
                [
                  { value: 'project_manager', label: 'אחראי כללי של הפרויקט' },
                  { value: 'other',           label: 'אחראי רכב אחר' },
                ] as { value: 'project_manager' | 'other'; label: string }[]
              ).map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name="campType"
                    value={value}
                    checked={campType === value}
                    onChange={() => setCampType(value)}
                    disabled={isLocked}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>

            {/* Show PM name from active project when project_manager selected */}
            {campType === 'project_manager' && activeProjectEntry && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg border mb-4"
                style={{ background: '#F8FAFB', borderColor: '#E2EBF4' }}
              >
                <User className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">אחראי פרויקט {activeProjectEntry.projectName}:</p>
                  <p className="text-sm font-semibold text-foreground">
                    {activeProjectEntry.projectManagerName ?? 'לא הוגדר אחראי'}
                  </p>
                </div>
              </div>
            )}

            {/* "Other" fields */}
            {campType === 'other' && (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">שם האחראי</label>
                  <input
                    type="text"
                    value={campName}
                    onChange={(e) => setCampName(e.target.value)}
                    placeholder="שם מלא..."
                    disabled={isLocked}
                    className={inputClass}
                    style={{ borderColor: '#C8D5E2' }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    טלפון נייד
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={campPhone}
                    onChange={(e) => setCampPhone(e.target.value)}
                    placeholder="05x-xxxxxxx"
                    disabled={isLocked}
                    className={inputClass}
                    style={{ borderColor: '#C8D5E2' }}
                    dir="ltr"
                  />
                  {campPhone && formatPhone(campPhone) && (
                    <p className="text-xs text-muted-foreground mt-0.5 text-left" dir="ltr">
                      {formatPhone(campPhone)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Save button */}
            <Button
              onClick={handleSaveCamp}
              disabled={!campDirty || isSavingCamp || isLocked}
              className="gap-2"
              style={{
                background: campDirty
                  ? 'linear-gradient(135deg, #4ECDC4, #3ABFB6)'
                  : undefined,
                border: 'none',
              }}
            >
              {isSavingCamp ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              שמור
            </Button>
          </div>
        )}

        {/* ══ 3. Driver Activity Journal ═════════════════════════ */}
        <div>
          <h3 className={sectionHeader}>
            <Users className="h-4 w-4" />
            {isLocked ? 'יומן נהגים (כרטיס נעול)' : 'יומן נהגים'}
          </h3>

          {/* Current driver card — prominent display */}
          {activeDriverEntry ? (
            <div
              className="rounded-xl border mb-3 overflow-hidden"
              style={{ borderColor: '#C8D5E2' }}
            >
              <div
                className="px-4 py-4"
                style={{ background: 'linear-gradient(135deg, #152D3C, #1E3D50)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-white/15">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-bold text-white truncate">
                        {activeDriverEntry.driverName ?? 'נהג לא ידוע'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-white/70 text-sm">
                        {activeDriverEntry.driverCompanyName && (
                          <span>{activeDriverEntry.driverCompanyName}</span>
                        )}
                        {activeDriverEntry.driverEmployeeNumber && (
                          <span>עובד #{activeDriverEntry.driverEmployeeNumber}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <CurrentBadge isLast={isLocked} />
                </div>
              </div>
              <div className="px-4 py-2.5" style={{ background: '#F0F5FB' }}>
                <p className="text-xs text-muted-foreground">
                  {isLocked ? 'שויך מ-' : 'משויך מ-'}{formatDate(activeDriverEntry.startDate)}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="p-3 rounded-xl border mb-3 text-center"
              style={{ borderColor: '#E2EBF4', borderStyle: 'dashed' }}
            >
              <p className="text-sm text-muted-foreground">
                {isLocked ? 'לא היה נהג משויך' : 'אין נהג משויך כרגע'}
              </p>
            </div>
          )}

          {/* Open/close inline form — hidden when locked */}
          {!isLocked && (
            <button
              type="button"
              onClick={() => showDriverForm ? setShowDriverForm(false) : openDriverForm()}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-3"
            >
              {showDriverForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              שינוי נהג
            </button>
          )}

          {/* Inline driver form */}
          {showDriverForm && (
            <div
              className="rounded-xl border p-4 mb-3 space-y-3"
              style={{ background: '#FAFCFF', borderColor: '#C8D5E2' }}
            >
              {loadingDrivers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  טוען נהגים...
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">בחר נהג</label>
                    <Popover open={driverPopoverOpen} onOpenChange={setDriverPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={isAssigningDriver}
                          className="flex items-center justify-between w-full min-w-[180px] border rounded-lg px-3 py-2 text-sm bg-background text-right hover:bg-accent/50 transition-colors disabled:opacity-50"
                          style={{ borderColor: '#C8D5E2' }}
                        >
                          {selectedDriverLabel ? (
                            <span className="truncate">{selectedDriverLabel.fullName}</span>
                          ) : (
                            <span className="text-muted-foreground">חפש נהג...</span>
                          )}
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 mr-2" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[340px] p-0"
                        align="start"
                        dir="rtl"
                      >
                        <Command dir="rtl">
                          <CommandInput placeholder="חפש לפי שם, ת.ז., מספר עובד..." className="text-right" />
                          <CommandList>
                            <CommandEmpty>לא נמצאו נהגים</CommandEmpty>
                            <CommandGroup>
                              {drivers.map((d) => (
                                <CommandItem
                                  key={d.id}
                                  value={d.id}
                                  keywords={[
                                    d.fullName,
                                    d.idNumber ?? '',
                                    d.employeeNumber ?? '',
                                    d.companyName ?? '',
                                  ]}
                                  onSelect={() => {
                                    setSelectedDriverId(d.id)
                                    setDriverPopoverOpen(false)
                                  }}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Check
                                    className={`h-4 w-4 shrink-0 ${
                                      selectedDriverId === d.id ? 'opacity-100' : 'opacity-0'
                                    }`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{d.fullName}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {[
                                        d.employeeNumber && `עובד #${d.employeeNumber}`,
                                        d.companyName,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ') || '\u00A0'}
                                    </p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">תאריך התחלה</label>
                    <FleetDateInput
                      value={driverStartDate}
                      onChange={setDriverStartDate}
                      maxYear={new Date().getFullYear() + 1}
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      onClick={handleAssignDriver}
                      disabled={isAssigningDriver || !selectedDriverId || !driverStartDate}
                      size="sm"
                      className="gap-1.5"
                      style={{
                        background: selectedDriverId && driverStartDate
                          ? 'linear-gradient(135deg, #4ECDC4, #3ABFB6)'
                          : undefined,
                        border: 'none',
                      }}
                    >
                      {isAssigningDriver ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Users className="h-3.5 w-3.5" />
                      )}
                      שייך
                    </Button>

                    {activeDriverEntry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEndDriver}
                        disabled={isEndingDriver}
                        className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                      >
                        {isEndingDriver ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        סיים שיוך
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Driver journal table */}
          {driverJournal.length > 0 ? (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#C8D5E2' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground" style={{ background: '#F8FAFB', borderColor: '#E2EBF4' }}>
                    <th className="px-3 py-2 text-right font-semibold">שם נהג</th>
                    <th className="px-3 py-2 text-right font-semibold">תאריך התחלה</th>
                    <th className="px-3 py-2 text-right font-semibold">תאריך סיום</th>
                  </tr>
                </thead>
                <tbody>
                  {driverJournal.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className="border-b last:border-b-0"
                      style={{ borderColor: '#F0F5FB', background: idx % 2 === 0 ? '#fff' : '#FAFCFF' }}
                    >
                      <td className="px-3 py-2 font-medium">
                        {entry.driverName ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDate(entry.startDate)}
                      </td>
                      <td className="px-3 py-2">
                        {entry.endDate ? (
                          <span className="text-muted-foreground">{formatDate(entry.endDate)}</span>
                        ) : (
                          <CurrentBadge isLast={isLocked} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className="p-4 rounded-xl border text-center"
              style={{ borderColor: '#E2EBF4', borderStyle: 'dashed' }}
            >
              <p className="text-sm text-muted-foreground">אין שיוכי נהגים</p>
            </div>
          )}
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* LEFT COLUMN — Project Journal                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div dir="rtl" className="space-y-6">

        {/* ══ 4. Project Activity Journal ═══════════════════════ */}
        <div>
          <h3 className={sectionHeader}>
            <FolderKanban className="h-4 w-4" />
            {isLocked ? 'יומן פרויקטים' : 'יומן פרויקטים'}
          </h3>

          {/* Current project card — prominent display */}
          {activeProjectEntry ? (
            <div
              className="rounded-xl border mb-3 overflow-hidden"
              style={{ borderColor: '#C8D5E2' }}
            >
              <div
                className="px-4 py-4"
                style={{ background: 'linear-gradient(135deg, #152D3C, #1E3D50)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-white/15">
                      <FolderKanban className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-bold text-white truncate">
                        {activeProjectEntry.projectName}
                      </p>
                      <p className="text-sm text-white/70 mt-1">
                        פרויקט {activeProjectEntry.projectNumber}
                      </p>
                    </div>
                  </div>
                  <CurrentBadge isLast={isLocked} />
                </div>
              </div>
              <div className="px-4 py-2.5" style={{ background: '#F0F5FB' }}>
                <p className="text-xs text-muted-foreground">
                  {activeProjectEntry.projectManagerName && (
                    <span>מנהל: {activeProjectEntry.projectManagerName} · </span>
                  )}
                  {isLocked ? 'שויך מ-' : 'משויך מ-'}{formatDate(activeProjectEntry.startDate)}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="p-3 rounded-xl border mb-3 text-center"
              style={{ borderColor: '#E2EBF4', borderStyle: 'dashed' }}
            >
              <p className="text-sm text-muted-foreground">
                {isLocked ? 'לא היה פרויקט משויך' : 'אין פרויקט משויך כרגע'}
              </p>
            </div>
          )}

          {/* Open/close inline form — hidden when locked */}
          {!isLocked && (
            <button
              type="button"
              onClick={() => showProjectForm ? setShowProjectForm(false) : openProjectForm()}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-3"
            >
              {showProjectForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              שייך פרויקט
            </button>
          )}

          {/* Inline project form */}
          {showProjectForm && (
            <div
              className="rounded-xl border p-4 mb-3 space-y-3"
              style={{ background: '#FAFCFF', borderColor: '#C8D5E2' }}
            >
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  טוען פרויקטים...
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">בחר פרויקט</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className={selectClass}
                      style={{ borderColor: '#C8D5E2' }}
                      disabled={isAssigningProject}
                    >
                      <option value="">בחר פרויקט...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.projectNumber} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">תאריך התחלה</label>
                    <FleetDateInput
                      value={projectStartDate}
                      onChange={setProjectStartDate}
                      maxYear={new Date().getFullYear() + 1}
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      onClick={handleAssignProject}
                      disabled={isAssigningProject || !selectedProjectId || !projectStartDate}
                      size="sm"
                      className="gap-1.5"
                      style={{
                        background: selectedProjectId && projectStartDate
                          ? 'linear-gradient(135deg, #4ECDC4, #3ABFB6)'
                          : undefined,
                        border: 'none',
                      }}
                    >
                      {isAssigningProject ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FolderKanban className="h-3.5 w-3.5" />
                      )}
                      שייך
                    </Button>

                    {activeProjectEntry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEndProject}
                        disabled={isEndingProject}
                        className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                      >
                        {isEndingProject ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        סיים שיוך
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Project journal table */}
          {projectJournal.length > 0 ? (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#C8D5E2' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground" style={{ background: '#F8FAFB', borderColor: '#E2EBF4' }}>
                    <th className="px-3 py-2 text-right font-semibold">שם פרויקט</th>
                    <th className="px-3 py-2 text-right font-semibold">מספר פרויקט</th>
                    <th className="px-3 py-2 text-right font-semibold">תאריך התחלה</th>
                    <th className="px-3 py-2 text-right font-semibold">תאריך סיום</th>
                  </tr>
                </thead>
                <tbody>
                  {projectJournal.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className="border-b last:border-b-0"
                      style={{ borderColor: '#F0F5FB', background: idx % 2 === 0 ? '#fff' : '#FAFCFF' }}
                    >
                      <td className="px-3 py-2 font-medium">{entry.projectName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.projectNumber}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDate(entry.startDate)}
                      </td>
                      <td className="px-3 py-2">
                        {entry.endDate ? (
                          <span className="text-muted-foreground">{formatDate(entry.endDate)}</span>
                        ) : (
                          <CurrentBadge isLast={isLocked} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className="p-4 rounded-xl border text-center"
              style={{ borderColor: '#E2EBF4', borderStyle: 'dashed' }}
            >
              <p className="text-sm text-muted-foreground">אין שיוכי פרויקטים</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
