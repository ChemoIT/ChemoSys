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
import { Loader2, Camera, CalendarIcon } from 'lucide-react'
import { format, parse } from 'date-fns'
import { he } from 'date-fns/locale'
import type { Company, Department, Employee, RoleTag } from '@/types/entities'
import { createEmployee, updateEmployee } from '@/actions/employees'
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
 * deriveStatusFromEndDate — compute status from end date value.
 */
function deriveStatusFromEndDate(endDate: string): 'active' | 'suspended' | 'inactive' {
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
}: {
  name: string
  defaultValue?: string | null
  placeholder?: string
  onChange?: (isoValue: string) => void
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
        className="text-center flex-1"
      />
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="shrink-0 h-10 w-10">
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
  }, [employee])

  // Close on success + notify parent to refresh data (fixes stale photo_url)
  useEffect(() => {
    if (state?.success) {
      onSaved?.()
      onOpenChange(false)
    }
  }, [state, onOpenChange, onSaved])

  // Auto-calculate status when end_date changes (still manually overridable)
  function handleEndDateChange(iso: string) {
    setStatus(deriveStatusFromEndDate(iso))
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
                <Input name="employee_number" placeholder="מספר עובד ייחודי" defaultValue={employee?.employee_number ?? ''} />
                <FieldError errors={errors} field="employee_number" />
              </div>
              <div className="space-y-1">
                <FieldLabel required>שם פרטי</FieldLabel>
                <Input name="first_name" placeholder="שם פרטי" defaultValue={employee?.first_name ?? ''} />
                <FieldError errors={errors} field="first_name" />
              </div>
              <div className="space-y-1">
                <FieldLabel required>שם משפחה</FieldLabel>
                <Input name="last_name" placeholder="שם משפחה" defaultValue={employee?.last_name ?? ''} />
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
                {/* Display padded to 9 digits (Israeli ID standard) */}
                <Input
                  name="id_number"
                  placeholder="000000000"
                  defaultValue={formatIdNumber(employee?.id_number)}
                  dir="ltr"
                  className="text-center"
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>מגדר</FieldLabel>
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
                <DateInput name="date_of_birth" defaultValue={employee?.date_of_birth} />
              </div>
              <div className="space-y-1">
                <FieldLabel>אזרחות</FieldLabel>
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
                <FieldLabel>טלפון נייד</FieldLabel>
                <Input name="mobile_phone" placeholder="05X-XXXXXXX" defaultValue={employee?.mobile_phone ?? ''} />
              </div>
              <div className="space-y-1">
                <FieldLabel>טלפון נוסף</FieldLabel>
                <Input name="additional_phone" placeholder="טלפון נוסף" defaultValue={employee?.additional_phone ?? ''} />
              </div>
              <div className="space-y-1">
                <FieldLabel>דוא&quot;ל</FieldLabel>
                <Input name="email" type="email" placeholder="example@company.com" defaultValue={employee?.email ?? ''} />
              </div>
            </div>
          </div>

          {/* ── Section 3: שיוך ארגוני ── */}
          <SectionHeading title="שיוך ארגוני" />

          <div className="bg-muted/10 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-3">
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
                <FieldLabel>מחלקה</FieldLabel>
                <select
                  name="department_id"
                  value={deptId}
                  onChange={(e) => { setDeptId(e.target.value); setSubDeptId('') }}
                  className={selectClass}
                >
                  <option value="">בחר מחלקה</option>
                  {filteredDepts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <FieldLabel>תת-מחלקה</FieldLabel>
                <select
                  name="sub_department_id"
                  value={subDeptId}
                  onChange={(e) => setSubDeptId(e.target.value)}
                  disabled={!deptId}
                  className={selectClass}
                >
                  <option value="">{deptId ? 'בחר תת-מחלקה' : 'בחר מחלקה תחילה'}</option>
                  {filteredSubDepts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
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
                <DateInput name="start_date" defaultValue={employee?.start_date} />
              </div>
              <div className="space-y-1">
                <FieldLabel>תאריך סיום עבודה</FieldLabel>
                {/* Changing end_date auto-calculates status */}
                <DateInput
                  name="end_date"
                  defaultValue={employee?.end_date}
                  onChange={handleEndDateChange}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>סטטוס</FieldLabel>
                <div className="relative">
                  <span className={`absolute start-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full pointer-events-none ${
                    status === 'active'    ? 'bg-green-500'  :
                    status === 'suspended' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <select
                    name="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`${selectClass} ps-8 font-medium ${
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
                <FieldLabel>שפת התכתבות</FieldLabel>
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
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>תגיות תפקיד</FieldLabel>
                <RoleTagMultiSelect
                  roleTags={roleTags}
                  selectedIds={roleTagIds}
                  onChange={setRoleTagIds}
                />
              </div>
            </div>
          </div>

          {/* ── Section 5: הערות ── */}
          <SectionHeading title="הערות" />

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
  )
}
