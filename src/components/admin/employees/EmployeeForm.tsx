'use client'

/**
 * EmployeeForm — create/edit dialog for an Employee record.
 *
 * Uses native HTML form + useActionState (no React Hook Form).
 * Server-side validation via Zod in Server Actions.
 * Native <select> elements instead of Radix Select.
 * Photo upload uses Supabase Storage via the browser client.
 *
 * Status logic (auto-calculated from end_date, manually overridable):
 *   active    → פעיל (green)  — no end_date
 *   suspended → הודעה מוקדמת (yellow) — future end_date
 *   inactive  → לא פעיל (red) — past/today end_date
 */

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Camera, CalendarIcon, Lock, LockOpen } from 'lucide-react'
import { format, parse } from 'date-fns'
import { he } from 'date-fns/locale'
import type { Company, Department, Employee, RoleTag } from '@/types/entities'
import { createEmployee, updateEmployee, updateLockedFields } from '@/actions/employees'
import type { ActionWarning } from '@/lib/action-types'
import { ErrorDetailDialog } from '@/components/ui/error-detail-dialog'
import { RoleTagMultiSelect } from './RoleTagMultiSelect'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful save — parent should call router.refresh() */
  onSaved?: () => void
  employee?: Employee & { role_tags?: { role_tag_id: string }[] }
  companies: Company[]
  departments: Department[]
  roleTags: RoleTag[]
}

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
  warnings?: ActionWarning[]
} | null

// ---------------------------------------------------------------------------
// Helpers
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
      {children}{required && <span className="text-brand-primary"> *</span>}
    </label>
  )
}

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
  const messages = errors?.[field]
  if (!messages?.length) return null
  return <p className="text-xs text-destructive">{messages[0]}</p>
}

/**
 * formatIdNumber — pad Israeli ID to 9 digits for display.
 * Only pads purely numeric IDs shorter than 9 digits.
 */
function formatIdNumber(id: string | null | undefined): string {
  if (!id) return ''
  if (/^\d+$/.test(id) && id.length < 9) return id.padStart(9, '0')
  return id
}

/**
 * deriveStatusFromEndDate — compute status from end date and dept number.
 * Iron rule: dept_number '0' = always inactive, regardless of end_date.
 */
function deriveStatusFromEndDate(endDate: string, deptNumber?: string): 'active' | 'suspended' | 'inactive' {
  if (deptNumber === '0') return 'inactive'
  if (!endDate) return 'active'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  if (end > today) return 'suspended'  // הודעה מוקדמת
  return 'inactive'
}

// ---------------------------------------------------------------------------
// DateInput — displays dd/mm/yyyy, submits YYYY-MM-DD
// ---------------------------------------------------------------------------

function DateInput({
  name,
  defaultValue,
  placeholder = 'dd/mm/yyyy',
  onChange,
  disabled,
}: {
  name: string
  defaultValue?: string | null
  placeholder?: string
  onChange?: (isoValue: string) => void
  disabled?: boolean
}) {
  function isoToDisplay(iso: string | null | undefined): string {
    if (!iso) return ''
    const parts = iso.split('-')
    if (parts.length !== 3) return ''
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }

  function displayToIso(display: string): string {
    const parts = display.split('/')
    if (parts.length !== 3) return ''
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }

  const [displayValue, setDisplayValue] = useState(isoToDisplay(defaultValue))
  const [isoValue, setIsoValue] = useState(defaultValue ?? '')
  const [calendarOpen, setCalendarOpen] = useState(false)

  const selectedDate = isoValue
    ? parse(isoValue, 'yyyy-MM-dd', new Date())
    : undefined

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value
    const digits = val.replace(/\D/g, '')
    if (digits.length >= 5) {
      val = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
    } else if (digits.length >= 3) {
      val = `${digits.slice(0, 2)}/${digits.slice(2)}`
    } else {
      val = digits
    }
    setDisplayValue(val)
    if (val.length === 10) {
      const iso = displayToIso(val)
      setIsoValue(iso)
      onChange?.(iso)
    } else {
      setIsoValue('')
      onChange?.('')
    }
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) return
    const iso     = format(date, 'yyyy-MM-dd')
    const display = format(date, 'dd/MM/yyyy')
    setIsoValue(iso)
    setDisplayValue(display)
    setCalendarOpen(false)
    onChange?.(iso)
  }

  return (
    <div className="flex gap-1">
      <Input
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={10}
        dir="ltr"
        className={`text-center flex-1 ${disabled ? 'bg-muted/50 text-muted-foreground' : ''}`}
        disabled={disabled}
      />
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="shrink-0 h-10 w-10" disabled={disabled}>
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            locale={he}
            captionLayout="dropdown"
            startMonth={new Date(1940, 0)}
            endMonth={new Date(2030, 11)}
          />
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={isoValue} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// PhotoUpload — circular preview + file picker
// ---------------------------------------------------------------------------

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function PhotoUpload({
  currentUrl,
  onPhotoSelected,
}: {
  currentUrl?: string | null
  onPhotoSelected: (file: File | null, previewUrl: string | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [isDragging, setIsDragging] = useState(false)

  // Sync preview state when currentUrl prop changes (e.g. editing different employee)
  useEffect(() => {
    setPreview(currentUrl ?? null)
  }, [currentUrl])

  function processFile(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    onPhotoSelected(file, url)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleRemove() {
    setPreview(null)
    onPhotoSelected(null, null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative w-24 h-24 rounded-full border-2 flex items-center justify-center overflow-hidden cursor-pointer transition-colors ${
          isDragging
            ? 'border-solid border-brand-primary bg-brand-primary/10 scale-105'
            : 'border-dashed border-brand-primary/40 bg-muted/30 hover:border-brand-primary'
        }`}
        onClick={() => fileRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {preview ? (
          <img src={preview} alt="תמונת עובד" className="w-full h-full object-cover" />
        ) : (
          <Camera className="h-8 w-8 text-muted-foreground/50" />
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileInput}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-xs text-brand-primary hover:underline cursor-pointer"
        >
          {preview ? 'שנה תמונה' : 'העלה או גרור תמונה'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-destructive hover:underline cursor-pointer"
          >
            הסר
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LockToggle — per-field lock icon for lockable fields
// ---------------------------------------------------------------------------

function LockToggle({
  fieldName,
  lockedFields,
  onToggle,
}: {
  fieldName: string
  lockedFields: string[]
  onToggle: (field: string, locked: boolean) => void
}) {
  const isLocked = lockedFields.includes(fieldName)
  return (
    <button
      type="button"
      title={isLocked ? 'שדה נעול — ייבוא לא ידרוס. לחץ לפתיחה' : 'שדה פתוח — ייבוא ידרוס. לחץ לנעילה'}
      onClick={() => onToggle(fieldName, !isLocked)}
      className={`p-0.5 rounded transition-colors ${
        isLocked
          ? 'text-amber-600 hover:text-amber-800'
          : 'text-muted-foreground/30 hover:text-muted-foreground/60'
      }`}
    >
      {isLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// EmployeeForm
// ---------------------------------------------------------------------------

export function EmployeeForm({
  open,
  onOpenChange,
  onSaved,
  employee,
  companies,
  departments,
  roleTags,
}: EmployeeFormProps) {
  const isEdit = !!employee

  const boundAction = isEdit
    ? updateEmployee.bind(null, employee.id)
    : createEmployee

  const [, startTransition] = useTransition()
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    boundAction as (prevState: ActionState, formData: FormData) => Promise<ActionState>,
    null
  )

  // Controlled state for selects
  const [companyId, setCompanyId] = useState('')
  const [deptId, setDeptId] = useState('')
  const [subDeptId, setSubDeptId] = useState('')
  const [gender, setGender] = useState('')
  const [citizenship, setCitizenship] = useState('')
  const [status, setStatus] = useState('active')
  const [language, setLanguage] = useState('hebrew')
  const [roleTagIds, setRoleTagIds] = useState<string[]>([])

  // Lock state (per-field import protection)
  const [lockedFields, setLockedFields] = useState<string[]>(
    (employee as Record<string, unknown>)?.locked_fields as string[] ?? []
  )

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string>(employee?.photo_url ?? '')

  // Reset state when employee prop changes (new dialog open)
  useEffect(() => {
    setCompanyId(employee?.company_id ?? '')
    setDeptId(employee?.department_id ?? '')
    setSubDeptId(employee?.sub_department_id ?? '')
    setGender(employee?.gender ?? '')
    setCitizenship(employee?.citizenship ?? '')
    setStatus(employee?.status ?? 'active')
    setLanguage(employee?.correspondence_language ?? 'hebrew')
    setRoleTagIds(employee?.role_tags?.map((r) => r.role_tag_id) ?? [])
    setPhotoUrl(employee?.photo_url ?? '')
    setPhotoFile(null)
    setLockedFields((employee as Record<string, unknown>)?.locked_fields as string[] ?? [])
  }, [employee])

  // Warnings dialog state
  const [pendingWarnings, setPendingWarnings] = useState<ActionWarning[]>([])

  // Close on success + notify parent to refresh data (fixes stale photo_url)
  useEffect(() => {
    if (state?.success) {
      onSaved?.()
      if (state.warnings?.length) {
        setPendingWarnings(state.warnings)
      }
      onOpenChange(false)
    }
  }, [state, onOpenChange, onSaved])

  // Auto-calculate status when end_date changes (still manually overridable)
  // Iron rule: dept 0 = always inactive — overrides end_date logic
  function handleEndDateChange(iso: string) {
    const currentDeptNumber = filteredDepts.find((d) => d.id === deptId)?.dept_number
    setStatus(deriveStatusFromEndDate(iso, currentDeptNumber))
  }

  // Toggle field lock — saves immediately to DB
  async function handleLockToggle(field: string, locked: boolean) {
    if (!employee) return
    const prev = lockedFields
    const next = locked
      ? [...lockedFields, field]
      : lockedFields.filter((f) => f !== field)
    setLockedFields(next) // optimistic
    const result = await updateLockedFields(employee.id, next)
    if (!result.success) {
      toast.error('שגיאה בשמירת נעילה: ' + result.error)
      setLockedFields(prev) // rollback
    }
  }

  // Department dropdowns:
  // - Main dept: show ALL parent departments (no company filter) so imported
  //   employees always see their assigned department regardless of company_id
  // - Sub-dept: children of selected parent
  const filteredDepts    = departments.filter((d) => d.parent_dept_id === null)
  const filteredSubDepts = departments.filter((d) => d.parent_dept_id === deptId)

  const errors = state?.error

  // Handle form submission — upload photo first, then submit form
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    // Upload photo to Supabase Storage if a new file was selected
    if (photoFile) {
      try {
        const supabase = createBrowserClient()
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const fileName = `${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('employee-photos')
          .upload(fileName, photoFile, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('employee-photos')
            .getPublicUrl(fileName)
          const newUrl = urlData.publicUrl
          formData.set('photo_url', newUrl)
          setPhotoUrl(newUrl)
        } else {
          toast.error(`שגיאה בהעלאת תמונה: ${uploadError.message}`)
        }
      } catch (err) {
        console.error('[EmployeeForm] Photo upload failed:', err)
        toast.error('שגיאה בהעלאת התמונה — ודא שה-bucket "employee-photos" קיים ב-Supabase Storage')
      }
    }

    startTransition(() => {
      formAction(formData)
    })
  }

  return (
  <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">

        {/* Sticky header — title + action buttons */}
        <div className="border-b bg-background px-6 py-4 flex items-center justify-between shrink-0">
          <DialogHeader className="p-0 space-y-0">
            <DialogTitle className="text-lg text-brand-dark">
              {isEdit ? 'עריכת עובד' : 'הוספת עובד חדש'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
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
              ) : isEdit ? 'שמור שינויים' : 'הוסף עובד'}
            </Button>
          </div>
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">

          {/* ── Photo + Top Identity Row ── */}
          <div className="flex gap-6 items-start bg-muted/20 rounded-lg p-4">
            <PhotoUpload
              currentUrl={employee?.photo_url}
              onPhotoSelected={(file) => {
                setPhotoFile(file)
                if (!file) setPhotoUrl('')
              }}
            />
            <input type="hidden" name="photo_url" value={photoUrl} />

            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <FieldLabel required>מספר עובד</FieldLabel>
                <Input name="employee_number" placeholder="מספר עובד ייחודי" defaultValue={employee?.employee_number ?? ''} readOnly={isEdit} tabIndex={isEdit ? -1 : undefined} className={isEdit ? 'bg-muted/50 text-muted-foreground pointer-events-none' : ''} />
                <FieldError errors={errors} field="employee_number" />
              </div>
              <div className="space-y-1">
                <FieldLabel required>שם פרטי</FieldLabel>
                <Input name="first_name" placeholder="שם פרטי" defaultValue={employee?.first_name ?? ''} readOnly={isEdit} tabIndex={isEdit ? -1 : undefined} className={isEdit ? 'bg-muted/50 text-muted-foreground pointer-events-none' : ''} />
                <FieldError errors={errors} field="first_name" />
              </div>
              <div className="space-y-1">
                <FieldLabel required>שם משפחה</FieldLabel>
                <Input name="last_name" placeholder="שם משפחה" defaultValue={employee?.last_name ?? ''} readOnly={isEdit} tabIndex={isEdit ? -1 : undefined} className={isEdit ? 'bg-muted/50 text-muted-foreground pointer-events-none' : ''} />
                <FieldError errors={errors} field="last_name" />
              </div>
            </div>
          </div>

          {/* ── Section 1: פרטים אישיים ── */}
          <SectionHeading title="פרטים אישיים" />

          <div className="bg-muted/10 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <FieldLabel>תעודת זהות</FieldLabel>
                <Input
                  name="id_number"
                  placeholder="000000000"
                  defaultValue={formatIdNumber(employee?.id_number)}
                  dir="ltr"
                  className={`text-center ${isEdit ? 'bg-muted/50 text-muted-foreground pointer-events-none' : ''}`}
                  readOnly={isEdit}
                  tabIndex={isEdit ? -1 : undefined}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <FieldLabel>מגדר</FieldLabel>
                  {isEdit && <LockToggle fieldName="gender" lockedFields={lockedFields} onToggle={handleLockToggle} />}
                </div>
                <select
                  name="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={selectClass}
                >
                  <option value="">בחר מגדר</option>
                  <option value="male">זכר</option>
                  <option value="female">נקבה</option>
                  <option value="other">אחר</option>
                </select>
              </div>
              <div className="space-y-1">
                <FieldLabel>תאריך לידה</FieldLabel>
                <DateInput name="date_of_birth" defaultValue={employee?.date_of_birth} disabled={isEdit} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <FieldLabel>אזרחות</FieldLabel>
                  {isEdit && <LockToggle fieldName="citizenship" lockedFields={lockedFields} onToggle={handleLockToggle} />}
                </div>
                <select
                  name="citizenship"
                  value={citizenship}
                  onChange={(e) => setCitizenship(e.target.value)}
                  className={selectClass}
                >
                  <option value="">בחר אזרחות</option>
                  <option value="israeli">ישראלית</option>
                  <option value="foreign">זרה</option>
                </select>
              </div>
            </div>

            {citizenship === 'foreign' && (
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <FieldLabel>מספר דרכון</FieldLabel>
                  <Input name="passport_number" placeholder="מספר דרכון" defaultValue={employee?.passport_number ?? ''} />
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: כתובת ופרטי קשר ── */}
          <SectionHeading title="כתובת ופרטי קשר" />

          <div className="bg-muted/10 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2 space-y-1">
                <FieldLabel>רחוב</FieldLabel>
                <Input name="street" placeholder="שם הרחוב" defaultValue={employee?.street ?? ''} />
              </div>
              <div className="space-y-1">
                <FieldLabel>מספר בית</FieldLabel>
                <Input name="house_number" placeholder="מס'" defaultValue={employee?.house_number ?? ''} />
              </div>
              <div className="space-y-1">
                <FieldLabel>עיר</FieldLabel>
                <Input name="city" placeholder="שם העיר" defaultValue={employee?.city ?? ''} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <FieldLabel>טלפון נייד</FieldLabel>
                  {isEdit && <LockToggle fieldName="mobile_phone" lockedFields={lockedFields} onToggle={handleLockToggle} />}
                </div>
                <Input name="mobile_phone" placeholder="05X-XXXXXXX" defaultValue={employee?.mobile_phone ?? ''} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <FieldLabel>טלפון נוסף</FieldLabel>
                  {isEdit && <LockToggle fieldName="additional_phone" lockedFields={lockedFields} onToggle={handleLockToggle} />}
                </div>
                <Input name="additional_phone" placeholder="טלפון נוסף" defaultValue={employee?.additional_phone ?? ''} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <FieldLabel>דוא&quot;ל</FieldLabel>
                  {isEdit && <LockToggle fieldName="email" lockedFields={lockedFields} onToggle={handleLockToggle} />}
                </div>
                <Input name="email" type="email" placeholder="example@company.com" defaultValue={employee?.email ?? ''} />
              </div>
            </div>
          </div>

          {/* ── Section 3: שיוך ארגוני ── */}
          <SectionHeading title="שיוך ארגוני" />

          <div className="bg-muted/10 rounded-lg p-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <FieldLabel required>חברה</FieldLabel>
                <select
                  name="company_id"
                  value={companyId}
                  onChange={(e) => { setCompanyId(e.target.value); setDeptId(''); setSubDeptId('') }}
                  className={selectClass}
                >
                  <option value="">בחר חברה</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <FieldError errors={errors} field="company_id" />
              </div>
              <div className="space-y-1">
                <FieldLabel>מס׳ מחלקה</FieldLabel>
                <Input
                  value={deptId ? (filteredDepts.find((d) => d.id === deptId)?.dept_number ?? '') : ''}
                  onChange={(e) => {
                    const num = e.target.value.trim()
                    if (!num) { setDeptId(''); setSubDeptId(''); return }
                    const match = filteredDepts.find((d) => d.dept_number === num)
                    if (match) {
                      setDeptId(match.id)
                      setSubDeptId('')
                      if (num === '0') setStatus('inactive')
                    }
                  }}
                  placeholder="מס׳"
                  dir="ltr"
                  className={`text-center ${isEdit ? 'bg-muted/50 text-muted-foreground pointer-events-none' : ''}`}
                  readOnly={isEdit}
                  tabIndex={isEdit ? -1 : undefined}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>מחלקה</FieldLabel>
                {isEdit && <input type="hidden" name="department_id" value={deptId} />}
                <select
                  name={isEdit ? undefined : 'department_id'}
                  value={deptId}
                  onChange={(e) => {
                    setDeptId(e.target.value)
                    setSubDeptId('')
                    const dept = filteredDepts.find((d) => d.id === e.target.value)
                    if (dept?.dept_number === '0') setStatus('inactive')
                  }}
                  className={`${selectClass} ${isEdit ? 'bg-muted/50 text-muted-foreground' : ''}`}
                  disabled={isEdit}
                >
                  <option value="">בחר מחלקה</option>
                  {filteredDepts.map((d) => (
                    <option key={d.id} value={d.id}>{d.dept_number} — {d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <FieldLabel>תת-מחלקה</FieldLabel>
                {isEdit && <input type="hidden" name="sub_department_id" value={subDeptId} />}
                <select
                  name={isEdit ? undefined : 'sub_department_id'}
                  value={subDeptId}
                  onChange={(e) => setSubDeptId(e.target.value)}
                  disabled={isEdit || !deptId}
                  className={`${selectClass} ${isEdit ? 'bg-muted/50 text-muted-foreground' : ''}`}
                >
                  <option value="">{deptId ? 'בחר תת-מחלקה' : 'בחר מחלקה תחילה'}</option>
                  {filteredSubDepts.map((d) => (
                    <option key={d.id} value={d.id}>{d.dept_number} — {d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 4: תעסוקה ── */}
          <SectionHeading title="תעסוקה" />

          <div className="bg-muted/10 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <FieldLabel>תאריך תחילת עבודה</FieldLabel>
                <DateInput name="start_date" defaultValue={employee?.start_date} disabled={isEdit} />
              </div>
              <div className="space-y-1">
                <FieldLabel>תאריך סיום עבודה</FieldLabel>
                <DateInput
                  name="end_date"
                  defaultValue={employee?.end_date}
                  onChange={handleEndDateChange}
                  disabled={isEdit}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>סטטוס</FieldLabel>
                {isEdit && <input type="hidden" name="status" value={status} />}
                <div className="relative">
                  <span className={`absolute start-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full pointer-events-none ${
                    status === 'active'    ? 'bg-green-500'  :
                    status === 'suspended' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <select
                    name={isEdit ? undefined : 'status'}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={isEdit}
                    className={`${selectClass} ps-8 font-medium ${
                      isEdit ? 'bg-muted/50' : ''
                    } ${
                      status === 'active'    ? 'border-green-400 text-green-700'  :
                      status === 'suspended' ? 'border-yellow-400 text-yellow-700' :
                                              'border-red-400 text-red-700'
                    }`}
                  >
                    <option value="active">פעיל</option>
                    <option value="suspended">הודעה מוקדמת</option>
                    <option value="inactive">לא פעיל</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <FieldLabel>שפת התכתבות</FieldLabel>
                  {isEdit && <LockToggle fieldName="correspondence_language" lockedFields={lockedFields} onToggle={handleLockToggle} />}
                </div>
                <select
                  name="correspondence_language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={selectClass}
                >
                  <option value="hebrew">עברית</option>
                  <option value="english">אנגלית</option>
                  <option value="arabic">ערבית</option>
                  <option value="thai">תאית</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <FieldLabel>מקצוע</FieldLabel>
                <Input name="profession" placeholder="מקצוע העובד" defaultValue={employee?.profession ?? ''} />
              </div>
              <div className="space-y-1">
                <FieldLabel>רישוי רכב במערכת שכר</FieldLabel>
                <Input
                  name="salary_system_license"
                  placeholder="קוד רישוי רכב"
                  defaultValue={employee?.salary_system_license ?? ''}
                  readOnly={isEdit}
                  tabIndex={isEdit ? -1 : undefined}
                  className={isEdit ? 'bg-muted/50 text-muted-foreground pointer-events-none' : ''}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <FieldLabel>תגיות תפקיד</FieldLabel>
                  {isEdit && <LockToggle fieldName="role_tags" lockedFields={lockedFields} onToggle={handleLockToggle} />}
                </div>
                <RoleTagMultiSelect
                  roleTags={roleTags}
                  selectedIds={roleTagIds}
                  onChange={setRoleTagIds}
                />
              </div>
            </div>
          </div>

          {/* ── Section 5: הערות ── */}
          <div className="flex items-center gap-2 pt-3 pb-2">
            <h3 className="text-sm font-semibold text-brand-dark border-r-4 border-brand-primary pr-3 py-1">הערות</h3>
            {isEdit && <LockToggle fieldName="notes" lockedFields={lockedFields} onToggle={handleLockToggle} />}
          </div>

          <div className="bg-muted/10 rounded-lg p-4">
            <textarea
              name="notes"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="הערות נוספות..."
              defaultValue={employee?.notes ?? ''}
            />
          </div>

          {/* Server-level error */}
          {errors?._form && (
            <p className="text-sm text-destructive">{errors._form[0]}</p>
          )}

        </div>{/* end scrollable body */}
        </form>
      </DialogContent>
    </Dialog>

    <ErrorDetailDialog
      open={pendingWarnings.length > 0}
      onOpenChange={(open) => { if (!open) setPendingWarnings([]) }}
      actionLabel={employee ? 'עדכון עובד' : 'יצירת עובד'}
      warnings={pendingWarnings}
    />
  </>
  )
}
