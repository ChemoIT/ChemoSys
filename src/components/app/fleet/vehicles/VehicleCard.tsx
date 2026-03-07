'use client'

/**
 * VehicleCard — tabs layout for the vehicle card page.
 * Tabs: פרטי הרכב | טסטים | ביטוח | שיוך נהג | עלויות | מסמכים | הערות | ק"מ
 *
 * Mirrors DriverCard.tsx pattern:
 *  - Header: avatar (plate chars), license plate, vehicle info, status badge, fitness light
 *  - Action buttons: Back + Delete (with admin password Dialog)
 *  - No PDF, No SMS (vehicles don't have phone numbers)
 *  - Controlled Tabs with dirty tracking + unsaved changes Dialog
 *  - dir="rtl" on TabsList AND every TabsContent wrapper
 *  - Tabs 4-8: placeholders (populated in Plan 14-02)
 */

import { useState, useTransition, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Trash2,
  ArrowRight,
  Car,
  ClipboardCheck,
  Shield,
  User,
  DollarSign,
  Paperclip,
  FileText,
  Gauge,
  Loader2,
  ChevronLeft,
  X,
  Lock,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { VehicleFitnessLight } from '@/components/app/fleet/shared/VehicleFitnessLight'
import { VehicleDetailsSection } from './VehicleDetailsSection'
import { VehicleTestsSection } from './VehicleTestsSection'
import { VehicleInsuranceSection } from './VehicleInsuranceSection'
import { deleteVehicleWithPassword } from '@/actions/fleet/vehicles'
import { formatLicensePlate } from '@/lib/format'
import type {
  VehicleFull,
  VehicleTest,
  VehicleInsurance,
  VehicleDocument,
} from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type VehicleCardProps = {
  vehicle: VehicleFull
  tests: VehicleTest[]
  insurance: VehicleInsurance[]
  documents: VehicleDocument[]
  companies: { id: string; name: string }[]
  yellowDays: number
  docYellowDays: number
  testExpiryDate: string | null
  insuranceMinExpiry: string | null
  documentMinExpiry: string | null
}

// ─────────────────────────────────────────────────────────────
// PlaceholderTab — for tabs 4-8 (populated in Plan 14-02)
// ─────────────────────────────────────────────────────────────

function PlaceholderTab({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="bg-white border-x border-b rounded-b-2xl py-12 text-center" style={{ borderColor: '#E2EBF4' }}>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
        style={{ background: '#F0F5FB', border: '1px solid #E2EBF4' }}
      >
        <Icon className="h-6 w-6 text-muted-foreground/35" />
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/50 mt-0.5">פיתוח עתידי</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleCard({
  vehicle,
  tests,
  insurance,
  documents,
  companies,
  yellowDays,
  docYellowDays,
  testExpiryDate,
  insuranceMinExpiry,
  documentMinExpiry,
}: VehicleCardProps) {
  const router = useRouter()

  // ── Active tab (controlled) ──
  const [activeTab, setActiveTab] = useState('details')

  // ── Sub-tab dirty state (reported by child components) ──
  const dirtyStates = useRef<Record<string, boolean>>({})

  const onDetailsEditingChange = useCallback((dirty: boolean) => {
    dirtyStates.current.details = dirty
  }, [])
  const onTestsEditingChange = useCallback((dirty: boolean) => {
    dirtyStates.current.tests = dirty
  }, [])
  const onInsuranceEditingChange = useCallback((dirty: boolean) => {
    dirtyStates.current.insurance = dirty
  }, [])
  const onDocumentsEditingChange = useCallback((dirty: boolean) => {
    dirtyStates.current.documents = dirty
  }, [])
  const onNotesEditingChange = useCallback((dirty: boolean) => {
    dirtyStates.current.notes = dirty
  }, [])

  const TAB_LABELS: Record<string, string> = {
    details:    'פרטי הרכב',
    tests:      'טסטים',
    insurance:  'ביטוח',
    assignment: 'שיוך נהג',
    costs:      'עלויות',
    documents:  'מסמכים',
    notes:      'הערות',
    km:         'ק"מ',
  }

  /** Check if the current tab has unsaved changes */
  function isCurrentTabDirty(tab: string): boolean {
    return dirtyStates.current[tab] ?? false
  }

  // ── Unsaved changes dialog state ──
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  function handleTabChange(newTab: string) {
    if (newTab === activeTab) return
    if (isCurrentTabDirty(activeTab)) {
      setPendingTab(newTab)
      setUnsavedDialogOpen(true)
      return
    }
    setActiveTab(newTab)
  }

  function handleDiscardAndSwitch() {
    setUnsavedDialogOpen(false)
    if (pendingTab) setActiveTab(pendingTab)
    setPendingTab(null)
    // Reset dirty state for the tab we're leaving
    dirtyStates.current[activeTab] = false
  }

  function handleCancelSwitch() {
    setUnsavedDialogOpen(false)
    setPendingTab(null)
  }

  // ── Transitions ──
  const [isDeleting, startDeleteTransition] = useTransition()

  // ── Delete dialog state ──
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')

  // ─────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────

  function handleOpenDelete() {
    setDeletePassword('')
    setDeleteError('')
    setDeleteOpen(true)
  }

  function handleDelete() {
    if (!deletePassword) {
      setDeleteError('יש להזין סיסמה')
      return
    }
    setDeleteError('')
    startDeleteTransition(async () => {
      const result = await deleteVehicleWithPassword(vehicle.id, deletePassword)
      if (result.success) {
        toast.success('כרטיס הרכב נמחק')
        setDeleteOpen(false)
        router.push('/app/fleet/vehicle-card')
      } else {
        setDeleteError(result.error ?? 'שגיאה במחיקה')
      }
    })
  }

  // Avatar: first 2 chars of license plate (digits only)
  const plateChars = vehicle.licensePlate.replace(/[^0-9א-ת]/g, '').slice(0, 2)

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto w-full">

      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4 justify-end">
        <span className="text-foreground font-semibold" dir="ltr">{formatLicensePlate(vehicle.licensePlate)}</span>
        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/40 rotate-180" />
        <Link href="/app/fleet/vehicle-card" className="hover:text-primary transition-colors">
          כרטיסי רכב
        </Link>
      </nav>

      {/* ── Card header ─────────────────────────────────────── */}
      <div
        className="bg-white rounded-t-2xl overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card)', border: '1px solid #E2EBF4', borderBottom: 'none' }}
      >
        {/* Accent bar */}
        <div
          className="h-1"
          style={{ background: 'linear-gradient(to right, #4ECDC4, #3BBFB6, #2DAAA1, #4ECDC4)' }}
        />

        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          {/* Action buttons — right side */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">

            {/* Back button */}
            <Link
              href="/app/fleet/vehicle-card"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
              חזור
            </Link>

            {/* Delete */}
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all"
              onClick={handleOpenDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              מחק
            </button>
          </div>

          {/* Identity — left side */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 text-right">
              <div className="flex items-center gap-2 justify-end flex-wrap">
                {vehicle.isActive ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}
                  >
                    פעיל
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
                  >
                    לא פעיל
                  </span>
                )}
                <h1 className="text-2xl font-black text-foreground leading-tight tracking-tight" dir="ltr">
                  {formatLicensePlate(vehicle.licensePlate)}
                </h1>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {vehicle.companyName && (
                  <>
                    <span className="font-semibold text-foreground/70">{vehicle.companyName}</span>
                    <span className="mx-1 text-border">·</span>
                  </>
                )}
                {[vehicle.tozoretNm, vehicle.degemNm].filter(Boolean).join(' ')}
                {vehicle.shnatYitzur && (
                  <>
                    <span className="mx-1 text-border">·</span>
                    <span>{vehicle.shnatYitzur}</span>
                  </>
                )}
              </p>
            </div>

            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #152D3C 0%, #1E3D50 100%)' }}
                dir="ltr"
              >
                {plateChars || <Car className="h-5 w-5" />}
              </div>
              <div className="absolute -bottom-1 -left-1">
                <VehicleFitnessLight
                  testExpiryDate={testExpiryDate}
                  insuranceMinExpiry={insuranceMinExpiry}
                  documentMinExpiry={documentMinExpiry}
                  yellowDays={yellowDays}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div dir="rtl" className="bg-white border-x border-b" style={{ borderColor: '#E2EBF4' }}>
          <TabsList
            dir="rtl"
            className="w-full h-auto p-0 bg-transparent rounded-none gap-0 overflow-x-auto flex justify-start"
          >
            {[
              { value: 'details',    label: 'פרטי הרכב',  icon: Car },
              { value: 'tests',      label: 'טסטים',      icon: ClipboardCheck },
              { value: 'insurance',  label: 'ביטוח',      icon: Shield },
              { value: 'assignment', label: 'שיוך נהג',   icon: User },
              { value: 'costs',      label: 'עלויות',     icon: DollarSign },
              { value: 'documents',  label: 'מסמכים',     icon: Paperclip },
              { value: 'notes',      label: 'הערות',      icon: FileText },
              { value: 'km',         label: 'ק"מ',         icon: Gauge },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-muted-foreground hover:text-foreground transition-all shrink-0 text-sm font-medium"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden text-xs">{label.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ══ Tab 1 — פרטי הרכב ══════════════════════════════ */}
        <TabsContent value="details" className="mt-0">
          <div
            dir="rtl"
            className="bg-white border-x border-b rounded-b-2xl p-5"
            style={{ borderColor: '#E2EBF4' }}
          >
            <VehicleDetailsSection
              vehicle={vehicle}
              companies={companies}
              onEditingChange={onDetailsEditingChange}
            />
          </div>
        </TabsContent>

        {/* ══ Tab 2 — טסטים ══════════════════════════════════ */}
        <TabsContent value="tests" className="mt-0">
          <div
            dir="rtl"
            className="bg-white border-x border-b rounded-b-2xl p-5"
            style={{ borderColor: '#E2EBF4' }}
          >
            <VehicleTestsSection
              vehicleId={vehicle.id}
              tests={tests}
              docYellowDays={yellowDays}
              onEditingChange={onTestsEditingChange}
            />
          </div>
        </TabsContent>

        {/* ══ Tab 3 — ביטוח ══════════════════════════════════ */}
        <TabsContent value="insurance" className="mt-0">
          <div
            dir="rtl"
            className="bg-white border-x border-b rounded-b-2xl p-5"
            style={{ borderColor: '#E2EBF4' }}
          >
            <VehicleInsuranceSection
              vehicleId={vehicle.id}
              insurance={insurance}
              docYellowDays={yellowDays}
              onEditingChange={onInsuranceEditingChange}
            />
          </div>
        </TabsContent>

        {/* ══ Tab 4 — שיוך נהג (placeholder — Plan 14-02) ═══ */}
        <TabsContent value="assignment" className="mt-0">
          <PlaceholderTab icon={User} label="שיוך נהג" />
        </TabsContent>

        {/* ══ Tab 5 — עלויות (placeholder — Plan 14-02) ══════ */}
        <TabsContent value="costs" className="mt-0">
          <PlaceholderTab icon={DollarSign} label="עלויות" />
        </TabsContent>

        {/* ══ Tab 6 — מסמכים (placeholder — Plan 14-02) ══════ */}
        <TabsContent value="documents" className="mt-0">
          <PlaceholderTab icon={Paperclip} label="מסמכים" />
        </TabsContent>

        {/* ══ Tab 7 — הערות (placeholder — Plan 14-02) ═══════ */}
        <TabsContent value="notes" className="mt-0">
          <PlaceholderTab icon={FileText} label="הערות" />
        </TabsContent>

        {/* ══ Tab 8 — ק"מ (placeholder — Plan 14-02) ══════════ */}
        <TabsContent value="km" className="mt-0">
          <PlaceholderTab icon={Gauge} label='ק"מ' />
        </TabsContent>
      </Tabs>

      {/* ══ Unsaved Changes Dialog ═════════════════════════════ */}
      <Dialog open={unsavedDialogOpen} onOpenChange={(v) => { if (!v) handleCancelSwitch() }}>
        <DialogContent dir="rtl" className="max-w-sm" style={{ borderRadius: '1rem' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              שינויים שלא נשמרו
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              ביצעת שינויים בטאב{' '}
              <span className="font-bold text-foreground">&quot;{TAB_LABELS[activeTab]}&quot;</span>{' '}
              שלא נשמרו.
            </p>
            <p className="text-sm text-muted-foreground mt-1">מה ברצונך לעשות?</p>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-col">
            <Button
              onClick={handleCancelSwitch}
              className="gap-2 w-full"
              style={{ background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)', border: 'none' }}
            >
              חזור לשמור
            </Button>
            <Button
              variant="outline"
              onClick={handleDiscardAndSwitch}
              className="gap-2 w-full text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
              עבור ללא שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Delete Dialog ══════════════════════════════════════ */}
      <Dialog open={deleteOpen} onOpenChange={(v) => { if (!isDeleting) setDeleteOpen(v) }}>
        <DialogContent dir="rtl" className="max-w-sm" style={{ borderRadius: '1rem' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right text-destructive">
              <Trash2 className="h-5 w-5" />
              מחיקת כרטיס רכב
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              פעולה זו תמחק את כרטיס הרכב{' '}
              <span className="font-bold text-foreground" dir="ltr">{formatLicensePlate(vehicle.licensePlate)}</span>.
              <br />
              להמשך — הזן את סיסמת המחיקה.
            </p>

            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                סיסמת אדמין
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-destructive/30 text-right"
                style={{ borderColor: deleteError ? '#EF4444' : '#C8D5E2' }}
                placeholder="הקלד סיסמה..."
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleDelete() }}
              />
              {deleteError && (
                <p className="text-xs text-destructive text-right">{deleteError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || !deletePassword}
              className="gap-2 flex-1 sm:flex-initial"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              מחק כרטיס
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
