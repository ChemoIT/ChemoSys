'use client'

/**
 * ProjectForm — full project create/edit dialog.
 *
 * Organized into 7 visual sections matching the PROJ requirements:
 *   1. פרטים בסיסיים    — name, project_number, dates, type, status, description
 *   2. מנהלים           — PM + SM employee selectors with auto-pulled email/phone
 *   3. אחראי רכב מחנה  — CVC employee selector or manual phone entry
 *   4. מזמין            — client name + logo upload to Supabase Storage
 *   5. חברת פיקוח       — supervision contact details + notification toggles
 *   6. שעוני נוכחות    — dynamic list of attendance clock IDs
 *   7. מיקום פרויקט    — react-leaflet map (click-to-place) + radius input
 *
 * Pattern: native HTML form + useActionState + handleSubmit override
 *   (logo upload before submit, same pattern as EmployeeForm photo upload)
 *
 * Map import: ProjectLocationPicker is loaded via dynamic() with ssr: false
 *   to prevent Leaflet's window/document access crashing the SSR render.
 *
 * Boolean fields: sent as hidden inputs with 'true'/'false' values.
 *   Server Action normalises them via formDataToBoolean().
 *
 * Attendance clocks: serialised as JSON string in one hidden input.
 *   Server Action parses via JSON.parse().
 */

import dynamic from 'next/dynamic'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
import { createClient as createBrowserSupabase } from '@/lib/supabase/browser'
import type { Database } from '@/types/database'
import { createProject, updateProject } from '@/actions/projects'
import { EmployeeCombobox, type EmployeeOption } from './EmployeeCombobox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

// ---------------------------------------------------------------------------
// Dynamic import for react-leaflet map (MUST be ssr:false — Leaflet uses window)
// ---------------------------------------------------------------------------

const DynamicLocationPicker = dynamic(
  () => import('./ProjectLocationPicker').then((m) => ({ default: m.ProjectLocationPicker })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full rounded-lg border bg-muted animate-pulse" />
    ),
  }
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProjectRow = Database['public']['Tables']['projects']['Row']

interface ProjectFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Active employees list for PM/SM/CVC selectors */
  employees: EmployeeOption[]
  /** null = create mode, defined = edit mode */
  project?: ProjectRow | null
  /** Existing attendance clocks in edit mode */
  clocks?: Array<{ clock_id: string }>
}

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
} | null

// ---------------------------------------------------------------------------
// Shared helpers (same style as EmployeeForm)
// ---------------------------------------------------------------------------

/** Shared Tailwind classes for native <select> — matches Input style */
const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer'

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="pt-3 pb-2">
      <h3 className="text-sm font-semibold text-brand-dark border-r-4 border-brand-primary pr-3 py-1">
        {title}
      </h3>
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-xs font-medium leading-none text-muted-foreground">
      {children}
      {required && <span className="text-brand-primary"> *</span>}
    </label>
  )
}

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
  const messages = errors?.[field]
  if (!messages?.length) return null
  return <p className="text-xs text-destructive">{messages[0]}</p>
}

const ACCEPTED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

/**
 * formatIsraeliPhone — normalise phone to 05x-xxxxxxx display format.
 * Handles: "0521234567", "521234567", "+972521234567", "052-1234567"
 */
function formatIsraeliPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  // Strip everything except digits
  let digits = raw.replace(/\D/g, '')
  // Remove country code prefix 972
  if (digits.startsWith('972') && digits.length > 9) {
    digits = '0' + digits.slice(3)
  }
  // If starts without 0, add leading 0 (e.g. "521234567" → "0521234567")
  if (digits.length === 9 && /^[5]/.test(digits)) {
    digits = '0' + digits
  }
  // Format as 05x-xxxxxxx
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits.slice(0, 3) + '-' + digits.slice(3)
  }
  // Fallback: return as-is if not a standard mobile
  return raw
}

// ---------------------------------------------------------------------------
// ProjectForm
// ---------------------------------------------------------------------------

export function ProjectForm({
  open,
  onOpenChange,
  employees,
  project,
  clocks: initialClocks = [],
}: ProjectFormProps) {
  const isEdit = !!project

  // Build bound action: edit mode adds project id into FormData before calling updateProject
  const boundAction = isEdit
    ? async (prevState: ActionState, formData: FormData) => {
        formData.set('id', project.id)
        return updateProject(prevState, formData)
      }
    : createProject

  const [, startTransition] = useTransition()
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    boundAction as (prevState: ActionState, formData: FormData) => Promise<ActionState>,
    null
  )

  const errors = state?.error

  // ── Section 1: Basic Info state ──
  const [projectType, setProjectType] = useState(project?.project_type ?? '')
  const [status, setStatus]           = useState<string>(project?.status ?? 'active')

  // ── Section 2: PM state ──
  const [pmId, setPmId]       = useState(project?.project_manager_id ?? '')
  const [pmEmail, setPmEmail] = useState(project?.pm_email ?? '')
  const [pmPhone, setPmPhone] = useState(project?.pm_phone ?? '')
  const [pmNotif, setPmNotif] = useState(project?.pm_notifications ?? true)

  // ── Section 2: SM state ──
  const [smId, setSmId]       = useState(project?.site_manager_id ?? '')
  const [smEmail, setSmEmail] = useState(project?.sm_email ?? '')
  const [smPhone, setSmPhone] = useState(project?.sm_phone ?? '')
  const [smNotif, setSmNotif] = useState(project?.sm_notifications ?? true)

  // ── Section 3: CVC state ──
  const [cvcIsEmployee, setCvcIsEmployee] = useState(project?.cvc_is_employee ?? true)
  const [cvcId, setCvcId]                 = useState(project?.camp_vehicle_coordinator_id ?? '')
  const [cvcName, setCvcName]             = useState(project?.cvc_name ?? '')
  const [cvcPhone, setCvcPhone]           = useState(project?.cvc_phone ?? '')

  // ── Section 4: Client logo state ──
  const [logoFile, setLogoFile]       = useState<File | null>(null)
  const [logoUrl, setLogoUrl]         = useState(project?.client_logo_url ?? '')
  const [logoPreview, setLogoPreview] = useState<string | null>(project?.client_logo_url ?? null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // ── Section 5: Supervision notification states ──
  const [supervNotif, setSupervNotif]   = useState(project?.supervision_notifications ?? false)
  const [supervAttach, setSupervAttach] = useState(project?.supervision_attach_reports ?? false)

  // ── Section 6: Attendance clocks state ──
  const [clocks, setClocks] = useState<string[]>(
    initialClocks.map((c) => c.clock_id)
  )

  // ── Section 7: Location state ──
  const [latitude, setLatitude]   = useState<number | null>(project?.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(project?.longitude ?? null)
  const [radius, setRadius]       = useState<number>(project?.radius ?? 100)

  // ── Reset all state when project prop changes (new dialog open) ──
  useEffect(() => {
    setProjectType(project?.project_type ?? '')
    setStatus(project?.status ?? 'active')

    setPmId(project?.project_manager_id ?? '')
    setPmEmail(project?.pm_email ?? '')
    setPmPhone(project?.pm_phone ?? '')
    setPmNotif(project?.pm_notifications ?? true)

    setSmId(project?.site_manager_id ?? '')
    setSmEmail(project?.sm_email ?? '')
    setSmPhone(project?.sm_phone ?? '')
    setSmNotif(project?.sm_notifications ?? true)

    setCvcIsEmployee(project?.cvc_is_employee ?? true)
    setCvcId(project?.camp_vehicle_coordinator_id ?? '')
    setCvcName(project?.cvc_name ?? '')
    setCvcPhone(project?.cvc_phone ?? '')

    setLogoFile(null)
    setLogoUrl(project?.client_logo_url ?? '')
    setLogoPreview(project?.client_logo_url ?? null)

    setSupervNotif(project?.supervision_notifications ?? false)
    setSupervAttach(project?.supervision_attach_reports ?? false)

    setClocks(initialClocks.map((c) => c.clock_id))

    setLatitude(project?.latitude ?? null)
    setLongitude(project?.longitude ?? null)
    setRadius(project?.radius ?? 100)
  }, [project]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close dialog + toast on success ──
  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? 'הפרויקט עודכן בהצלחה' : 'הפרויקט נוצר בהצלחה')
      onOpenChange(false)
    }
  }, [state, isEdit, onOpenChange])

  // ── Logo file handler ──
  function handleLogoFile(file: File) {
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      toast.error('סוג הקובץ אינו נתמך — יש להשתמש ב-JPG, PNG, WebP, או SVG')
      return
    }
    const preview = URL.createObjectURL(file)
    setLogoFile(file)
    setLogoPreview(preview)
  }

  // ── Attendance clocks handlers ──
  function addClock() {
    setClocks((prev) => [...prev, ''])
  }

  function removeClock(index: number) {
    setClocks((prev) => prev.filter((_, i) => i !== index))
  }

  function updateClock(index: number, value: string) {
    setClocks((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  // ── Form submit — upload logo first, then submit to Server Action ──
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    // Client-side duplicate clock ID validation
    const nonEmpty = clocks.filter((c) => c.trim() !== '')
    const uniqueSet = new Set(nonEmpty)
    if (uniqueSet.size !== nonEmpty.length) {
      toast.error('קיימים מזהי שעון כפולים — יש להסיר כפילויות לפני השמירה')
      return
    }

    // Upload logo to Supabase Storage if a new file was selected
    // Logo upload failure does NOT block form submission — project is saved without logo
    if (logoFile) {
      try {
        const supabase = createBrowserSupabase()
        const ext      = logoFile.name.split('.').pop() || 'png'
        const fileName = `${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('client-logos')
          .upload(fileName, logoFile, { upsert: true })

        if (uploadError) {
          console.error('[ProjectForm] Logo upload error:', uploadError.message)
          toast.error('שגיאה בהעלאת הלוגו — הפרויקט יישמר בלי לוגו. ודא שה-bucket "client-logos" קיים ב-Storage.')
          // Clear logo so form doesn't send a broken URL
          formData.set('client_logo_url', '')
        } else {
          const { data: urlData } = supabase.storage
            .from('client-logos')
            .getPublicUrl(fileName)
          const newUrl = urlData.publicUrl
          setLogoUrl(newUrl)
          formData.set('client_logo_url', newUrl)
        }
      } catch (err) {
        console.error('[ProjectForm] Logo upload failed:', err instanceof Error ? err.message : 'Unknown error')
        toast.error('שגיאה בהעלאת הלוגו — הפרויקט יישמר בלי לוגו.')
        formData.set('client_logo_url', '')
      }
    }

    startTransition(() => {
      formAction(formData)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">

          {/* ── Sticky header with save/cancel buttons ── */}
          <div className="border-b bg-background px-6 py-4 flex items-center justify-between shrink-0">
            <DialogHeader className="p-0 space-y-0">
              <DialogTitle className="text-lg text-brand-dark">
                {isEdit ? 'עריכת פרויקט' : 'הוספת פרויקט חדש'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-brand-primary hover:bg-brand-primary/90 active:scale-95 transition-transform text-white"
              >
                {isPending ? (
                  <>
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                    שומר...
                  </>
                ) : isEdit ? 'שמור שינויים' : 'צור פרויקט'}
              </Button>
            </div>
          </div>

          {/* ── Scrollable form body ── */}
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">

            {/* ══════════════════════════════════════════════════════════════
                Section 1: פרטים בסיסיים
            ══════════════════════════════════════════════════════════════ */}
            <SectionHeading title="פרטים בסיסיים" />
            <div className="bg-muted/10 rounded-lg p-4 space-y-3">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project name — required */}
                <div className="space-y-1">
                  <FieldLabel required>שם פרויקט</FieldLabel>
                  <Input
                    name="name"
                    placeholder="שם הפרויקט"
                    defaultValue={project?.name ?? ''}
                    required
                  />
                  <FieldError errors={errors} field="name" />
                </div>

                {/* Project number — editable; if left empty, DB trigger auto-generates PR26XXXXXX */}
                <div className="space-y-1">
                  <FieldLabel>מספר פרויקט</FieldLabel>
                  <Input
                    name="project_number"
                    defaultValue={project?.project_number ?? ''}
                    placeholder="השאר ריק למספור אוטומטי"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Open date */}
                <div className="space-y-1">
                  <FieldLabel>תאריך פתיחה</FieldLabel>
                  <Input
                    name="open_date"
                    type="date"
                    defaultValue={project?.open_date ?? ''}
                    dir="ltr"
                  />
                </div>

                {/* Expense number */}
                <div className="space-y-1">
                  <FieldLabel>מספר הוצאה</FieldLabel>
                  <Input
                    name="expense_number"
                    placeholder="מספר הוצאה"
                    defaultValue={project?.expense_number ?? ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project type — shadcn Select does not write to FormData; use native select + hidden input */}
                <div className="space-y-1">
                  <FieldLabel>סיווג</FieldLabel>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">בחר סיווג</option>
                    <option value="project">פרויקט</option>
                    <option value="staging_area">שטח התארגנות</option>
                    <option value="storage_area">שטח אחסנה</option>
                  </select>
                  <input type="hidden" name="project_type" value={projectType} />
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <FieldLabel>סטטוס</FieldLabel>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={selectClass}
                  >
                    <option value="active">פעיל</option>
                    <option value="view_only">לצפייה בלבד</option>
                    <option value="inactive">לא פעיל</option>
                  </select>
                  <input type="hidden" name="status" value={status} />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <FieldLabel>תיאור</FieldLabel>
                <textarea
                  name="description"
                  className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="תיאור הפרויקט..."
                  defaultValue={project?.description ?? ''}
                />
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                Section 2: מנהלים (PM + SM) — PROJ-04
            ══════════════════════════════════════════════════════════════ */}
            <SectionHeading title="מנהלים" />
            <div className="bg-muted/10 rounded-lg p-4 space-y-4">

              {/* ── Project Manager ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">מנהל פרויקט</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <FieldLabel>בחירת עובד</FieldLabel>
                    <EmployeeCombobox
                      employees={employees}
                      value={pmId}
                      onChange={(id, emp) => {
                        setPmId(id)
                        setPmEmail(emp.email ?? '')
                        setPmPhone(formatIsraeliPhone(emp.mobile_phone))
                      }}
                      placeholder="בחר מנהל פרויקט"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <FieldLabel>מייל</FieldLabel>
                      <Input
                        value={pmEmail}
                        onChange={(e) => setPmEmail(e.target.value)}
                        type="email"
                        placeholder="מייל מנהל"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>טלפון</FieldLabel>
                      <Input
                        value={pmPhone}
                        onChange={(e) => setPmPhone(e.target.value)}
                        placeholder="טלפון מנהל"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="pm_notifications_check"
                    checked={pmNotif}
                    onChange={(e) => setPmNotif(e.target.checked)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="pm_notifications_check" className="text-xs text-muted-foreground cursor-pointer">
                    שלח הודעות למנהל פרויקט
                  </label>
                </div>
              </div>

              {/* Hidden inputs for PM — Server Action reads these (not the combobox display) */}
              <input type="hidden" name="project_manager_id" value={pmId} />
              <input type="hidden" name="pm_email" value={pmEmail} />
              <input type="hidden" name="pm_phone" value={pmPhone} />
              <input type="hidden" name="pm_notifications" value={pmNotif ? 'true' : 'false'} />

              <Separator />

              {/* ── Site Manager ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">מנהל עבודה</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <FieldLabel>בחירת עובד</FieldLabel>
                    <EmployeeCombobox
                      employees={employees}
                      value={smId}
                      onChange={(id, emp) => {
                        setSmId(id)
                        setSmEmail(emp.email ?? '')
                        setSmPhone(formatIsraeliPhone(emp.mobile_phone))
                      }}
                      placeholder="בחר מנהל עבודה"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <FieldLabel>מייל</FieldLabel>
                      <Input
                        value={smEmail}
                        onChange={(e) => setSmEmail(e.target.value)}
                        type="email"
                        placeholder="מייל מנהל"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>טלפון</FieldLabel>
                      <Input
                        value={smPhone}
                        onChange={(e) => setSmPhone(e.target.value)}
                        placeholder="טלפון מנהל"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="sm_notifications_check"
                    checked={smNotif}
                    onChange={(e) => setSmNotif(e.target.checked)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="sm_notifications_check" className="text-xs text-muted-foreground cursor-pointer">
                    שלח הודעות למנהל עבודה
                  </label>
                </div>
              </div>

              {/* Hidden inputs for SM */}
              <input type="hidden" name="site_manager_id" value={smId} />
              <input type="hidden" name="sm_email" value={smEmail} />
              <input type="hidden" name="sm_phone" value={smPhone} />
              <input type="hidden" name="sm_notifications" value={smNotif ? 'true' : 'false'} />
            </div>

            {/* ══════════════════════════════════════════════════════════════
                Section 3: אחראי רכב מחנה (CVC) — PROJ-10
            ══════════════════════════════════════════════════════════════ */}
            <SectionHeading title="אחראי רכב מחנה (CVC)" />
            <div className="bg-muted/10 rounded-lg p-4 space-y-3">

              {/* CVC mode toggle — employee selector vs manual phone entry */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-muted-foreground">אופן בחירה:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="_cvc_mode_radio"
                    value="employee"
                    checked={cvcIsEmployee}
                    onChange={() => {
                      setCvcIsEmployee(true)
                      setCvcName('')
                      setCvcPhone('')
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-xs">בחירה מרשימת עובדים</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="_cvc_mode_radio"
                    value="manual"
                    checked={!cvcIsEmployee}
                    onChange={() => {
                      setCvcIsEmployee(false)
                      setCvcId('')
                      setCvcPhone('')
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-xs">רישום חופשי</span>
                </label>
              </div>

              {cvcIsEmployee ? (
                /* Employee mode — select from list, phone auto-pulled */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <FieldLabel>אחראי רכב מחנה</FieldLabel>
                    <EmployeeCombobox
                      employees={employees}
                      value={cvcId}
                      onChange={(id, emp) => {
                        setCvcId(id)
                        setCvcPhone(formatIsraeliPhone(emp.mobile_phone))
                      }}
                      placeholder="בחר אחראי רכב מחנה"
                    />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel>טלפון (מתוך רישום העובד)</FieldLabel>
                    <Input
                      value={cvcPhone}
                      disabled
                      placeholder="יתמלא אוטומטית"
                      dir="ltr"
                      className="bg-muted/30"
                    />
                  </div>
                </div>
              ) : (
                /* Manual mode — name + phone for external CVC contact */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <FieldLabel required>שם אחראי</FieldLabel>
                    <Input
                      value={cvcName}
                      onChange={(e) => setCvcName(e.target.value)}
                      placeholder="שם מלא"
                    />
                    <FieldError errors={errors} field="cvc_name" />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel required>טלפון נייד</FieldLabel>
                    <Input
                      value={cvcPhone}
                      onChange={(e) => setCvcPhone(e.target.value)}
                      placeholder="05x-xxxxxxx"
                      dir="ltr"
                    />
                    <FieldError errors={errors} field="cvc_phone" />
                  </div>
                </div>
              )}

              {/* Hidden inputs for CVC — Server Action reads these */}
              <input type="hidden" name="camp_vehicle_coordinator_id" value={cvcId} />
              <input type="hidden" name="cvc_is_employee" value={cvcIsEmployee ? 'true' : 'false'} />
              <input type="hidden" name="cvc_name" value={cvcName} />
              <input type="hidden" name="cvc_phone" value={cvcPhone} />
            </div>

            {/* ══════════════════════════════════════════════════════════════
                Section 4: מזמין (Client) — PROJ-08
            ══════════════════════════════════════════════════════════════ */}
            <SectionHeading title="מזמין" />
            <div className="bg-muted/10 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client name */}
                <div className="space-y-1">
                  <FieldLabel>שם מזמין</FieldLabel>
                  <Input
                    name="client_name"
                    placeholder="שם החברה / המזמין"
                    defaultValue={project?.client_name ?? ''}
                  />
                </div>

                {/* Client logo — drag & drop or click to upload */}
                <div className="space-y-1">
                  <FieldLabel>לוגו מזמין</FieldLabel>
                  <div
                    className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-4 transition-colors hover:border-brand-primary/50 cursor-pointer"
                    onClick={() => logoInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.add('border-brand-primary', 'bg-brand-primary/5')
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.remove('border-brand-primary', 'bg-brand-primary/5')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.remove('border-brand-primary', 'bg-brand-primary/5')
                      const file = e.dataTransfer.files?.[0]
                      if (file) handleLogoFile(file)
                    }}
                  >
                    {logoPreview ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={logoPreview}
                          alt="לוגו מזמין"
                          className="h-12 w-12 object-contain rounded border bg-white p-0.5"
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">לחץ או גרור קובץ חדש להחלפה</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-6 px-2 w-fit"
                            onClick={(e) => {
                              e.stopPropagation()
                              setLogoFile(null)
                              setLogoPreview(null)
                              setLogoUrl('')
                            }}
                          >
                            הסר לוגו
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        גרור קובץ לכאן או לחץ לבחירת קובץ (JPG, PNG, WebP, SVG)
                      </span>
                    )}
                  </div>
                  {/* Hidden file input — triggered by click/drop above */}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleLogoFile(file)
                    }}
                  />
                  {/* URL set after successful upload in handleSubmit */}
                  <input type="hidden" name="client_logo_url" value={logoUrl} />
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                Section 5: חברת פיקוח (Supervision) — PROJ-09
            ══════════════════════════════════════════════════════════════ */}
            <SectionHeading title="חברת פיקוח" />
            <div className="bg-muted/10 rounded-lg p-4 space-y-3">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <FieldLabel>שם חברת פיקוח</FieldLabel>
                  <Input
                    name="supervision_company"
                    placeholder="שם החברה"
                    defaultValue={project?.supervision_company ?? ''}
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>שם איש קשר</FieldLabel>
                  <Input
                    name="supervision_contact"
                    placeholder="שם מלא"
                    defaultValue={project?.supervision_contact ?? ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <FieldLabel>מייל פיקוח</FieldLabel>
                  <Input
                    name="supervision_email"
                    type="email"
                    placeholder="email@company.com"
                    defaultValue={project?.supervision_email ?? ''}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>טלפון פיקוח</FieldLabel>
                  <Input
                    name="supervision_phone"
                    placeholder="03-XXXXXXX"
                    defaultValue={project?.supervision_phone ?? ''}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={supervNotif}
                    onChange={(e) => setSupervNotif(e.target.checked)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">אישור שליחת הודעות לחברת פיקוח</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={supervAttach}
                    onChange={(e) => setSupervAttach(e.target.checked)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">צירוף לדוחות</span>
                </label>
              </div>

              {/* Hidden inputs for supervision booleans */}
              <input type="hidden" name="supervision_notifications" value={supervNotif ? 'true' : 'false'} />
              <input type="hidden" name="supervision_attach_reports" value={supervAttach ? 'true' : 'false'} />
            </div>

            {/* ══════════════════════════════════════════════════════════════
                Section 6: שעוני נוכחות (Attendance Clocks) — PROJ-07
            ══════════════════════════════════════════════════════════════ */}
            <SectionHeading title="שעוני נוכחות" />
            <div className="bg-muted/10 rounded-lg p-4 space-y-3">

              {clocks.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  אין שעוני נוכחות מוגדרים לפרויקט זה.
                </p>
              )}

              {clocks.map((clockId, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 shrink-0 text-end">{index + 1}.</span>
                  <Input
                    value={clockId}
                    onChange={(e) => updateClock(index, e.target.value)}
                    placeholder={`מזהה שעון ${index + 1}`}
                    dir="ltr"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => removeClock(index)}
                    aria-label={`הסר שעון ${index + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addClock}
                className="mt-1"
              >
                <Plus className="me-1.5 h-4 w-4" />
                הוסף שעון
              </Button>

              {/* Clocks serialised as JSON array of non-empty clock IDs */}
              <input
                type="hidden"
                name="attendance_clocks"
                value={JSON.stringify(clocks.filter((c) => c.trim() !== ''))}
              />
            </div>

            {/* ══════════════════════════════════════════════════════════════
                Section 7: מיקום פרויקט (Location) — PROJ-11
            ══════════════════════════════════════════════════════════════ */}
            <SectionHeading title="מיקום פרויקט" />
            <div className="bg-muted/10 rounded-lg p-4 space-y-3">

              <div className="grid grid-cols-3 gap-3">
                {/* Latitude — read-only, set by map click */}
                <div className="space-y-1">
                  <FieldLabel>קו רוחב (Latitude)</FieldLabel>
                  <Input
                    value={latitude !== null ? latitude.toFixed(6) : ''}
                    readOnly
                    placeholder="לא נבחר"
                    dir="ltr"
                    className="bg-muted/30"
                  />
                </div>

                {/* Longitude — read-only, set by map click */}
                <div className="space-y-1">
                  <FieldLabel>קו אורך (Longitude)</FieldLabel>
                  <Input
                    value={longitude !== null ? longitude.toFixed(6) : ''}
                    readOnly
                    placeholder="לא נבחר"
                    dir="ltr"
                    className="bg-muted/30"
                  />
                </div>

                {/* Radius — editable, updates circle on map */}
                <div className="space-y-1">
                  <FieldLabel>רדיוס כיסוי (מטרים)</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    value={radius}
                    onChange={(e) => setRadius(Math.max(0, Number(e.target.value) || 0))}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Hidden inputs — submitted in FormData to Server Action */}
              <input type="hidden" name="latitude" value={latitude !== null ? String(latitude) : ''} />
              <input type="hidden" name="longitude" value={longitude !== null ? String(longitude) : ''} />
              <input type="hidden" name="radius" value={radius} />

              <p className="text-xs text-muted-foreground">
                לחץ על המפה לסימון מיקום הפרויקט. העיגול הכחול מציג את רדיוס כיסוי שעון הנוכחות.
              </p>

              {/* react-leaflet map — loaded only client-side via dynamic import (ssr: false) */}
              <DynamicLocationPicker
                latitude={latitude}
                longitude={longitude}
                radius={radius}
                onLocationChange={(lat, lng) => {
                  setLatitude(lat)
                  setLongitude(lng)
                }}
              />
            </div>

            {/* ── Server-level form error ── */}
            {errors?._form && (
              <p className="text-sm text-destructive px-1">{errors._form[0]}</p>
            )}

          </div>{/* end scrollable body */}

          {/* ── Sticky footer — duplicate buttons for long-form UX ── */}
          <DialogFooter className="border-t px-6 py-3 shrink-0 flex flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-brand-primary hover:bg-brand-primary/90 active:scale-95 transition-transform text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  שומר...
                </>
              ) : isEdit ? 'שמור שינויים' : 'צור פרויקט'}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  )
}
