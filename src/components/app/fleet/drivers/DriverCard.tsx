'use client'

/**
 * DriverCard — tabs layout for the driver card page.
 * Tabs: פרטי הנהג | רשיון נהיגה | מסמכים | תרבות נהיגה | לוג נסיעות
 *
 * Changes (2026-03-05):
 *  - Header: replaced global Save button with Back button
 *  - SMS: opens dialog with phone (read-only) + message textarea + send/cancel + success toast
 *  - Delete: opens dialog with admin password field — server verifies before delete
 *  - Driver name: large bold headline
 *  - Data values: highlighted vs labels
 *  - Checkboxes: local state only — saved via unified "שמור שינויים" button
 *  - Phone: always-editable input (no separate save)
 *  - Notes: framed textarea (always editable)
 *  - Unified "שמור שינויים" button saves phone + flags + notes together
 *  - Dates formatted as dd/mm/yyyy
 *  - Phones formatted as 05x-xxxxxxx
 */

import { useState, useTransition, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  FileText,
  MessageSquare,
  Trash2,
  ArrowRight,
  User,
  CreditCard,
  Paperclip,
  AlertTriangle,
  History,
  Loader2,
  ChevronLeft,
  Send,
  X,
  Lock,
  Save,
  CheckSquare,
  Square,
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
import { FitnessLight } from './FitnessLight'
import { DriverLicenseSection } from './DriverLicenseSection'
import { DriverDocumentsSection } from './DriverDocumentsSection'
import { DriverViolationsSection } from './DriverViolationsSection'
import {
  updateDriverDetails,
  deleteDriverWithPassword,
  sendDriverSms,
  type DriverFull,
  type DriverLicense,
  type DriverDocument,
  type DriverViolation,
} from '@/actions/fleet/drivers'
import { formatDate, formatPhone, formatId } from '@/lib/format'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function calcAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—'
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return `${age}`
}

function calcSeniority(startDate: string | null): string {
  if (!startDate) return '—'
  const start = new Date(startDate)
  const today = new Date()
  const years = today.getFullYear() - start.getFullYear()
  const months = today.getMonth() - start.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 12) return `${totalMonths} חודשים`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y} שנים ו-${m} חודשים` : `${y} שנים`
}

// formatDate, formatPhone, formatId — imported from @/lib/format

// ─────────────────────────────────────────────────────────────
// InfoRow — label + value, RTL aligned
// ─────────────────────────────────────────────────────────────

function InfoRow({ label, value, valueBold }: { label: string; value: React.ReactNode; valueBold?: boolean }) {
  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: '#EEF3F9' }}
    >
      <span className="text-sm text-muted-foreground w-32 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm flex-1 text-right ${valueBold ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
        {value || '—'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type Props = {
  driver: DriverFull
  license: DriverLicense | null
  documents: DriverDocument[]
  violations: DriverViolation[]
  yellowDays: number
  redDays: number
  docYellowDays: number
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function DriverCard({
  driver,
  license,
  documents,
  violations,
  yellowDays,
  docYellowDays,
}: Props) {
  const router = useRouter()

  // ── Active tab (controlled) ──
  const [activeTab, setActiveTab] = useState('employee')

  // ── Editable fields state ──
  const [phoneValue, setPhoneValue] = useState(driver.effectivePhone ?? '')
  const [campDriver, setCampDriver] = useState(driver.isOccasionalCampDriver)
  const [equipmentOp, setEquipmentOp] = useState(driver.isEquipmentOperator)
  const [notes, setNotes] = useState(driver.notes ?? '')

  // ── Dirty tracking — compare to initial values ──
  const isDirty =
    phoneValue !== (driver.effectivePhone ?? '') ||
    campDriver !== driver.isOccasionalCampDriver ||
    equipmentOp !== driver.isEquipmentOperator ||
    notes !== (driver.notes ?? '')

  // ── Sub-tab dirty state (reported by child components — true only when REAL changes exist) ──
  const dirtyStates = useRef<Record<string, boolean>>({})

  const onLicenseEditingChange = useCallback((dirty: boolean) => {
    dirtyStates.current.license = dirty
  }, [])
  const onDocumentsEditingChange = useCallback((dirty: boolean) => {
    dirtyStates.current.documents = dirty
  }, [])
  const onViolationsEditingChange = useCallback((dirty: boolean) => {
    dirtyStates.current.violations = dirty
  }, [])

  /** Check if the current tab has unsaved changes */
  function isCurrentTabDirty(tab: string): boolean {
    switch (tab) {
      case 'employee': return isDirty
      case 'license': return dirtyStates.current.license ?? false
      case 'documents': return dirtyStates.current.documents ?? false
      case 'violations': return dirtyStates.current.violations ?? false
      default: return false
    }
  }

  const TAB_LABELS: Record<string, string> = {
    employee: 'פרטי הנהג',
    license: 'רשיון נהיגה',
    documents: 'מסמכים',
    violations: 'תרבות נהיגה',
    log: 'לוג נסיעות',
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
  }

  function handleSaveAndSwitch() {
    // For tab 1 (employee) — save directly then switch
    if (activeTab === 'employee' && isDirty) {
      startSaveTransition(async () => {
        const result = await updateDriverDetails(driver.id, {
          phone: phoneValue || null,
          isOccasionalCampDriver: campDriver,
          isEquipmentOperator: equipmentOp,
          notes,
        })
        if (result.success) {
          toast.success('הפרטים נשמרו בהצלחה')
          setUnsavedDialogOpen(false)
          if (pendingTab) setActiveTab(pendingTab)
          setPendingTab(null)
        } else {
          toast.error(result.error ?? 'שגיאה בשמירה')
        }
      })
      return
    }
    // For other tabs — go back so user can use the tab's own save button
    setUnsavedDialogOpen(false)
    setPendingTab(null)
  }

  function handleCancelSwitch() {
    setUnsavedDialogOpen(false)
    setPendingTab(null)
  }

  // ── Transitions ──
  const [isSaving, startSaveTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isSendingSms, startSmsTransition] = useTransition()

  // ── SMS dialog state ──
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsText, setSmsText] = useState('')
  const [smsSent, setSmsSent] = useState(false)

  // ── Delete dialog state ──
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')

  // ── Computed ──
  const docExpiries = documents.map((d) => d.expiryDate).filter(Boolean) as string[]
  const documentMinExpiry = docExpiries.sort()[0] ?? null

  const idDisplay =
    driver.citizenship === 'israeli'
      ? formatId(driver.idNumber)
      : `דרכון: ${driver.passportNumber ?? '—'}`

  const fullAddress = [driver.street, driver.houseNumber, driver.city].filter(Boolean).join(' ')

  // ─────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────

  function handleSaveAll() {
    startSaveTransition(async () => {
      const result = await updateDriverDetails(driver.id, {
        phone: phoneValue || null,
        isOccasionalCampDriver: campDriver,
        isEquipmentOperator: equipmentOp,
        notes,
      })
      if (result.success) {
        toast.success('הפרטים נשמרו בהצלחה')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירה')
      }
    })
  }

  function handleOpenSms() {
    if (!driver.effectivePhone) {
      toast.error('אין מספר טלפון רשום לנהג')
      return
    }
    setSmsSent(false)
    setSmsText('')
    setSmsOpen(true)
  }

  function handleSendSms() {
    if (!smsText.trim()) {
      toast.error('יש להזין תוכן הודעה')
      return
    }
    startSmsTransition(async () => {
      const result = await sendDriverSms(driver.id, smsText)
      if (result.success) {
        setSmsSent(true)
      } else {
        toast.error(result.error ?? 'שגיאה בשליחת SMS')
      }
    })
  }

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
      const result = await deleteDriverWithPassword(driver.id, deletePassword)
      if (result.success) {
        toast.success('כרטיס הנהג נמחק')
        setDeleteOpen(false)
        router.push('/app/fleet/driver-card')
      } else {
        setDeleteError(result.error ?? 'שגיאה במחיקה')
      }
    })
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto w-full">

      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4 justify-end">
        <span className="text-foreground font-semibold">{driver.fullName}</span>
        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/40 rotate-180" />
        <Link href="/app/fleet/driver-card" className="hover:text-primary transition-colors">
          כרטיסי נהגים
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
              href="/app/fleet/driver-card"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
              חזור
            </Link>

            {/* PDF */}
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              onClick={() => window.open(`/api/fleet/drivers/${driver.id}/pdf`, '_blank')}
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>

            {/* SMS */}
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              onClick={handleOpenSms}
            >
              <MessageSquare className="h-4 w-4" />
              SMS
            </button>

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
                {driver.computedStatus === 'active' ? (
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
                <h1 className="text-2xl font-black text-foreground leading-tight tracking-tight">
                  {driver.fullName}
                </h1>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground/70">{driver.companyName}</span>
                <span className="mx-1 text-border">·</span>
                מ׳ עובד{' '}
                <span className="font-mono font-bold text-foreground/80">{driver.employeeNumber}</span>
              </p>
            </div>

            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #152D3C 0%, #1E3D50 100%)' }}
              >
                {driver.fullName.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -left-1">
                <FitnessLight
                  licenseExpiryDate={license?.expiryDate ?? null}
                  documentMinExpiry={documentMinExpiry}
                  yellowDays={yellowDays}
                  size="md"
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
              { value: 'employee',   label: 'פרטי הנהג',   icon: User },
              { value: 'license',    label: 'רשיון נהיגה', icon: CreditCard },
              { value: 'documents',  label: 'מסמכים',       icon: Paperclip },
              { value: 'violations', label: 'תרבות נהיגה', icon: AlertTriangle },
              { value: 'log',        label: 'לוג נסיעות',  icon: History },
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

        {/* ══ Tab 1 — פרטי הנהג ══════════════════════════════ */}
        <TabsContent value="employee" className="mt-0">
          <div
            dir="rtl"
            className="bg-white border-x border-b rounded-b-2xl p-5"
            style={{ borderColor: '#E2EBF4' }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-0">

              {/* ── עמודה ימנית — זהות ─────────────────────────── */}
              <div>
                {/* שם מלא — מובלט */}
                <div className="flex items-start gap-3 py-2.5 border-b" style={{ borderColor: '#EEF3F9' }}>
                  <span className="text-sm text-muted-foreground w-32 shrink-0 pt-0.5">שם מלא</span>
                  <span className="text-xl font-black text-foreground flex-1 text-right leading-tight">
                    {driver.fullName}
                  </span>
                </div>
                <InfoRow
                  label="מספר עובד"
                  value={<span className="font-mono">{driver.employeeNumber}</span>}
                  valueBold
                />
                <InfoRow label="חברה" value={driver.companyName} valueBold />
                <InfoRow label="תחילת עבודה" value={formatDate(driver.startDate)} />
                <InfoRow label="ותק" value={calcSeniority(driver.startDate)} />
                <InfoRow label="גיל" value={`${calcAge(driver.dateOfBirth)} שנים`} />
                <InfoRow label="תאריך לידה" value={formatDate(driver.dateOfBirth)} />
                <InfoRow
                  label="אזרחות"
                  value={
                    driver.citizenship === 'israeli'
                      ? 'ישראלי'
                      : driver.citizenship === 'foreign'
                        ? 'זר'
                        : '—'
                  }
                />
                <InfoRow
                  label="ת.ז. / דרכון"
                  value={<span className="font-mono">{idDisplay}</span>}
                />
              </div>

              {/* ── עמודה שמאלית — כתובת, טלפון, פרטים, הגדרות ── */}
              <div>
                <InfoRow label="כתובת" value={fullAddress || '—'} />

                {/* Phone — always editable */}
                <div className="flex items-start gap-3 py-2.5 border-b" style={{ borderColor: '#EEF3F9' }}>
                  <span className="text-sm text-muted-foreground w-32 shrink-0 pt-1.5">טלפון</span>
                  <div className="flex-1 flex items-center gap-2 justify-end flex-wrap">
                    {driver.phoneOverride && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: '#EEF2F8', color: '#4A6FA5', border: '1px solid #C8D5E8' }}
                      >
                        עודכן בכרטיס
                      </span>
                    )}
                    <input
                      value={phoneValue}
                      onChange={(e) => setPhoneValue(e.target.value)}
                      className="border border-border rounded-lg px-2.5 py-1.5 text-base sm:text-sm w-36 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-right font-mono"
                      dir="ltr"
                      placeholder="052-6804680"
                    />
                  </div>
                </div>

                <InfoRow label="תאריך פתיחת תיק" value={formatDate(driver.openedAt)} />

                {/* Flags — local only, saved via unified button */}
                <div className="py-3 border-b space-y-3" style={{ borderColor: '#EEF3F9' }}>
                  <button
                    onClick={() => setCampDriver((v) => !v)}
                    className="flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors w-full justify-end"
                  >
                    <span>נהג מזדמן על רכב מחנה</span>
                    {campDriver
                      ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                  </button>
                  <button
                    onClick={() => setEquipmentOp((v) => !v)}
                    className="flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors w-full justify-end"
                  >
                    <span>מפעיל צמ&quot;ה</span>
                    {equipmentOp
                      ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                  </button>
                </div>

                {/* Notes — framed, always editable */}
                <div className="py-3">
                  <p className="text-sm text-muted-foreground text-right mb-2">הערות</p>
                  <div
                    className="rounded-xl p-3"
                    style={{ border: '1.5px solid #C8D5E2', background: '#F8FAFB' }}
                  >
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full bg-transparent text-sm text-foreground focus:outline-none resize-none text-right leading-relaxed placeholder:text-muted-foreground/50"
                      placeholder="הוסף הערות על הנהג..."
                    />
                  </div>
                </div>

                {/* Unified save button */}
                <div className="pt-1 flex justify-start">
                  <button
                    onClick={handleSaveAll}
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
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ══ Tab 2 — רשיון נהיגה ════════════════════════════ */}
        <TabsContent value="license" className="mt-0">
          <div dir="rtl" className="bg-white border-x border-b rounded-b-2xl p-5" style={{ borderColor: '#E2EBF4' }}>
            <DriverLicenseSection driverId={driver.id} license={license} yellowDays={yellowDays} onEditingChange={onLicenseEditingChange} />
          </div>
        </TabsContent>

        {/* ══ Tab 3 — מסמכים ══════════════════════════════════ */}
        <TabsContent value="documents" className="mt-0">
          <div dir="rtl" className="bg-white border-x border-b rounded-b-2xl p-5" style={{ borderColor: '#E2EBF4' }}>
            <DriverDocumentsSection driverId={driver.id} documents={documents} docYellowDays={docYellowDays} onEditingChange={onDocumentsEditingChange} />
          </div>
        </TabsContent>

        {/* ══ Tab 4 — תרבות נהיגה ════════════════════════════ */}
        <TabsContent value="violations" className="mt-0">
          <div dir="rtl" className="bg-white border-x border-b rounded-b-2xl p-5" style={{ borderColor: '#E2EBF4' }}>
            <DriverViolationsSection driverId={driver.id} violations={violations} onEditingChange={onViolationsEditingChange} />
          </div>
        </TabsContent>

        {/* ══ Tab 5 — לוג נסיעות ══════════════════════════════ */}
        <TabsContent value="log" className="mt-0">
          <div className="bg-white border-x border-b rounded-b-2xl py-12 text-center" style={{ borderColor: '#E2EBF4' }}>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: '#F0F5FB', border: '1px solid #E2EBF4' }}
            >
              <History className="h-6 w-6 text-muted-foreground/35" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">פיתוח עתידי</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">לוג נסיעות ייפתח בשלב מאוחר יותר</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══ SMS Dialog ════════════════════════════════════════ */}
      <Dialog open={smsOpen} onOpenChange={(v) => { if (!isSendingSms) setSmsOpen(v) }}>
        <DialogContent dir="rtl" className="max-w-md" style={{ borderRadius: '1rem' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <MessageSquare className="h-5 w-5 text-primary" />
              שליחת SMS לנהג
            </DialogTitle>
          </DialogHeader>

          {smsSent ? (
            /* Success state */
            <div className="py-6 text-center space-y-3">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                style={{ background: '#DCFCE7', border: '2px solid #BBF7D0' }}
              >
                <Send className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-base font-bold text-foreground">ההודעה נשלחה בהצלחה!</p>
              <p className="text-sm text-muted-foreground">
                ל-<span className="font-mono font-semibold" dir="ltr">{formatPhone(driver.effectivePhone)}</span>
              </p>
              <Button
                onClick={() => { setSmsOpen(false); setSmsSent(false) }}
                className="mt-2"
                size="sm"
              >
                סגור
              </Button>
            </div>
          ) : (
            /* Compose state */
            <div className="space-y-4 py-2">
              {/* Phone (read-only) */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">מספר טלפון</label>
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-mono font-semibold"
                  style={{ background: '#F0F5FB', border: '1px solid #C8D5E2', direction: 'ltr' }}
                >
                  <span>{formatPhone(driver.effectivePhone)}</span>
                </div>
              </div>

              {/* Message textarea */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">תוכן ההודעה</label>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1.5px solid #C8D5E2', background: '#FAFCFF' }}
                >
                  <textarea
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    rows={5}
                    className="w-full bg-transparent text-sm text-foreground focus:outline-none resize-none p-3 text-right leading-relaxed placeholder:text-muted-foreground/50"
                    placeholder="כתוב כאן את ההודעה..."
                    autoFocus
                    maxLength={160}
                  />
                  <div
                    className="px-3 pb-2 text-left text-xs text-muted-foreground/60"
                    style={{ borderTop: '1px solid #EEF3F9' }}
                  >
                    {smsText.length}/160
                  </div>
                </div>
              </div>
            </div>
          )}

          {!smsSent && (
            <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
              <Button
                onClick={handleSendSms}
                disabled={isSendingSms || !smsText.trim()}
                className="gap-2 flex-1 sm:flex-initial"
                style={{ background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)', border: 'none' }}
              >
                {isSendingSms
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
                שלח
              </Button>
              <Button
                variant="outline"
                onClick={() => setSmsOpen(false)}
                disabled={isSendingSms}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                ביטול
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

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
            {activeTab === 'employee' ? (
              <Button
                onClick={handleSaveAndSwitch}
                disabled={isSaving}
                className="gap-2 w-full"
                style={{ background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)', border: 'none' }}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                שמור ועבור
              </Button>
            ) : (
              <Button
                onClick={handleCancelSwitch}
                className="gap-2 w-full"
                style={{ background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)', border: 'none' }}
              >
                <Save className="h-4 w-4" />
                חזור לשמור
              </Button>
            )}
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
              מחיקת כרטיס נהג
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              פעולה זו תמחק את כרטיס הנהג של{' '}
              <span className="font-bold text-foreground">{driver.fullName}</span>.
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
