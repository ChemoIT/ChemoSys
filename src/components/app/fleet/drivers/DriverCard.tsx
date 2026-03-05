'use client'

/**
 * DriverCard — tabs layout for the driver card page.
 * Tabs: פרטי עובד | רשיון נהיגה | מסמכים | תרבות נהיגה | לוג נסיעות
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowRight,
  FileText,
  MessageSquare,
  Trash2,
  Save,
  X,
  CheckSquare,
  Square,
  User,
  CreditCard,
  Paperclip,
  AlertTriangle,
  History,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FitnessLight } from './FitnessLight'
import { DriverLicenseSection } from './DriverLicenseSection'
import { DriverDocumentsSection } from './DriverDocumentsSection'
import { DriverViolationsSection } from './DriverViolationsSection'
import {
  updateDriverPhone,
  updateDriverFlags,
  updateDriverNotes,
  softDeleteDriver,
  type DriverFull,
  type DriverLicense,
  type DriverDocument,
  type DriverViolation,
} from '@/actions/fleet/drivers'

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('he-IL')
}

/** Format Israeli mobile phone: 05x-xxxxxxx */
function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('05')) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }
  return phone
}

/** Format Israeli ID: 9 digits with leading zeros */
function formatId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.replace(/\D/g, '').padStart(9, '0')
}

// ─────────────────────────────────────────────────────────────
// InfoRow
// ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium text-foreground flex-1">{value || '—'}</span>
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

  // Inline edit states
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneValue, setPhoneValue] = useState(driver.effectivePhone ?? '')
  const [campDriver, setCampDriver] = useState(driver.isOccasionalCampDriver)
  const [equipmentOp, setEquipmentOp] = useState(driver.isEquipmentOperator)
  const [notes, setNotes] = useState(driver.notes ?? '')
  const [editingNotes, setEditingNotes] = useState(false)

  const [isSavingPhone, startPhoneTransition] = useTransition()
  const [isSavingFlags, startFlagsTransition] = useTransition()
  const [isSavingNotes, startNotesTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()

  // Nearest document expiry for fitness light
  const docExpiries = documents.map((d) => d.expiryDate).filter(Boolean) as string[]
  const documentMinExpiry = docExpiries.sort()[0] ?? null

  function handleSavePhone() {
    startPhoneTransition(async () => {
      const result = await updateDriverPhone(driver.id, phoneValue)
      if (result.success) {
        toast.success('הטלפון עודכן')
        setEditingPhone(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleSaveFlags() {
    startFlagsTransition(async () => {
      const result = await updateDriverFlags(driver.id, {
        isOccasionalCampDriver: campDriver,
        isEquipmentOperator: equipmentOp,
      })
      if (result.success) {
        toast.success('הסיווג עודכן')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleSaveNotes() {
    startNotesTransition(async () => {
      const result = await updateDriverNotes(driver.id, notes)
      if (result.success) {
        toast.success('ההערות נשמרו')
        setEditingNotes(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete() {
    if (!confirm(`האם למחוק את כרטיס הנהג של ${driver.fullName}?`)) return
    startDeleteTransition(async () => {
      const result = await softDeleteDriver(driver.id)
      if (result.success) {
        toast.success('כרטיס הנהג נמחק')
        router.push('/app/fleet/driver-card')
      } else {
        toast.error(result.error)
      }
    })
  }

  const idDisplay =
    driver.citizenship === 'israeli'
      ? formatId(driver.idNumber)
      : `דרכון: ${driver.passportNumber ?? '—'}`

  const fullAddress = [driver.street, driver.houseNumber, driver.city].filter(Boolean).join(' ')

  return (
    <div className="w-full" dir="rtl">
      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/app/fleet/driver-card" className="hover:text-foreground transition-colors">
          כרטיסי נהגים
        </Link>
        <ArrowRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{driver.fullName}</span>
      </div>

      {/* ── Card header ─────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl overflow-hidden mb-1">
        {/* Accent bar */}
        <div className="h-1.5 bg-gradient-to-l from-primary/60 via-primary to-primary/40" />

        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Identity */}
          <div className="flex items-center gap-4 min-w-0">
            <FitnessLight
              licenseExpiryDate={license?.expiryDate ?? null}
              documentMinExpiry={documentMinExpiry}
              yellowDays={yellowDays}
              size="lg"
              showLabel
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{driver.fullName}</h1>
                <Badge
                  variant={driver.computedStatus === 'active' ? 'default' : 'secondary'}
                  className={
                    driver.computedStatus === 'active'
                      ? 'bg-green-100 text-green-800 hover:bg-green-100 shrink-0'
                      : 'shrink-0'
                  }
                >
                  {driver.computedStatus === 'active' ? 'פעיל' : 'לא פעיל'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                מ׳ עובד {driver.employeeNumber} | {driver.companyName}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-10"
              onClick={() => window.open(`/api/fleet/drivers/${driver.id}/pdf`, '_blank')}
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-10"
              onClick={() => {
                const phone = driver.effectivePhone
                if (!phone) { toast.error('אין מספר טלפון לנהג'); return }
                toast.info(`שולח SMS ל-${formatPhone(phone)}...`)
              }}
            >
              <MessageSquare className="h-4 w-4" />
              SMS
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-10 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              מחק
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <Tabs defaultValue="employee" className="w-full">
        <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b rounded-none gap-0 overflow-x-auto">
          {[
            { value: 'employee', label: 'פרטי עובד', icon: User },
            { value: 'license', label: 'רשיון נהיגה', icon: CreditCard },
            { value: 'documents', label: 'מסמכים', icon: Paperclip },
            { value: 'violations', label: 'תרבות נהיגה', icon: AlertTriangle },
            { value: 'log', label: 'לוג נסיעות', icon: History },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden text-xs">{label.split(' ')[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ══ Tab 1 — פרטי עובד ══════════════════════════════ */}
        <TabsContent value="employee" className="mt-0">
          <div className="bg-card border border-t-0 rounded-b-2xl p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-0">
              {/* Right column */}
              <div>
                <InfoRow label="שם מלא" value={driver.fullName} />
                <InfoRow label="מספר עובד" value={driver.employeeNumber} />
                <InfoRow label="חברה" value={driver.companyName} />
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
                <InfoRow label="ת.ז. / דרכון" value={idDisplay} />
              </div>

              {/* Left column */}
              <div>
                <InfoRow label="כתובת" value={fullAddress || '—'} />

                {/* Phone — editable inline */}
                <div className="flex items-start gap-3 py-2 border-b border-border/40">
                  <span className="text-sm text-muted-foreground w-36 shrink-0 pt-0.5">טלפון</span>
                  {editingPhone ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        className="border rounded px-2 py-1 text-base w-40 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        dir="ltr"
                        autoFocus
                        placeholder="052-6804680"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSavePhone()
                          if (e.key === 'Escape') setEditingPhone(false)
                        }}
                      />
                      <button onClick={handleSavePhone} disabled={isSavingPhone} title="שמור">
                        <Save className="h-4 w-4 text-green-600 hover:text-green-700" />
                      </button>
                      <button
                        onClick={() => { setPhoneValue(driver.effectivePhone ?? ''); setEditingPhone(false) }}
                        title="ביטול"
                      >
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm font-medium" dir="ltr">{formatPhone(driver.effectivePhone)}</span>
                      {driver.phoneOverride && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">עודכן בכרטיס</Badge>
                      )}
                      <button
                        onClick={() => setEditingPhone(true)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        ערוך
                      </button>
                    </div>
                  )}
                </div>

                <InfoRow label="תאריך פתיחת תיק" value={formatDate(driver.openedAt)} />

                {/* Flags — checkboxes */}
                <div className="py-2 border-b border-border/40 space-y-2">
                  <button
                    onClick={() => { setCampDriver((v) => !v); setTimeout(handleSaveFlags, 0) }}
                    className="flex items-center gap-2 text-sm hover:text-foreground text-foreground/80 transition-colors w-full text-right"
                    disabled={isSavingFlags}
                  >
                    {campDriver ? (
                      <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    נהג מזדמן על רכב מחנה
                  </button>
                  <button
                    onClick={() => { setEquipmentOp((v) => !v); setTimeout(handleSaveFlags, 0) }}
                    className="flex items-center gap-2 text-sm hover:text-foreground text-foreground/80 transition-colors w-full text-right"
                    disabled={isSavingFlags}
                  >
                    {equipmentOp ? (
                      <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    מפעיל צמ&quot;ה
                  </button>
                </div>

                {/* Notes */}
                <div className="py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">הערות</span>
                    {!editingNotes && (
                      <button onClick={() => setEditingNotes(true)} className="text-[11px] text-primary hover:underline">
                        ערוך
                      </button>
                    )}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full border rounded px-2 py-1 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveNotes} disabled={isSavingNotes}>
                          {isSavingNotes && <Loader2 className="h-3.5 w-3.5 ms-1 animate-spin" />}
                          שמור
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setNotes(driver.notes ?? ''); setEditingNotes(false) }}>
                          ביטול
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{notes || '—'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ══ Tab 2 — רשיון נהיגה ════════════════════════════ */}
        <TabsContent value="license" className="mt-0">
          <div className="bg-card border border-t-0 rounded-b-2xl p-5">
            <DriverLicenseSection
              driverId={driver.id}
              license={license}
              yellowDays={yellowDays}
            />
          </div>
        </TabsContent>

        {/* ══ Tab 3 — מסמכים ══════════════════════════════════ */}
        <TabsContent value="documents" className="mt-0">
          <div className="bg-card border border-t-0 rounded-b-2xl p-5">
            <DriverDocumentsSection
              driverId={driver.id}
              documents={documents}
              docYellowDays={docYellowDays}
            />
          </div>
        </TabsContent>

        {/* ══ Tab 4 — תרבות נהיגה ════════════════════════════ */}
        <TabsContent value="violations" className="mt-0">
          <div className="bg-card border border-t-0 rounded-b-2xl p-5">
            <DriverViolationsSection driverId={driver.id} violations={violations} />
          </div>
        </TabsContent>

        {/* ══ Tab 5 — לוג נסיעות ══════════════════════════════ */}
        <TabsContent value="log" className="mt-0">
          <div className="bg-card border border-t-0 rounded-b-2xl p-8 text-center">
            <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">פיתוח עתידי</p>
            <p className="text-xs text-muted-foreground mt-1">לוג נסיעות ייפתח בשלב מאוחר יותר</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
