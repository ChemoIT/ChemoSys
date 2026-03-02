'use client'

/**
 * EmployeeForm — create/edit dialog for an Employee record.
 *
 * Uses native HTML form + useActionState (no React Hook Form).
 * Server-side validation via Zod in Server Actions.
 * Select fields use controlled state + hidden inputs for FormData.
 */

import { useActionState, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Company, Department, Employee, RoleTag } from '@/types/entities'
import { createEmployee, updateEmployee } from '@/actions/employees'
import { RoleTagMultiSelect } from './RoleTagMultiSelect'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="pt-2 pb-1">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">
        {title}
      </h3>
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium leading-none">
      {children}{required && ' *'}
    </label>
  )
}

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
  const messages = errors?.[field]
  if (!messages?.length) return null
  return <p className="text-sm text-destructive">{messages[0]}</p>
}

// ---------------------------------------------------------------------------
// EmployeeForm
// ---------------------------------------------------------------------------

export function EmployeeForm({
  open,
  onOpenChange,
  employee,
  companies,
  departments,
  roleTags,
}: EmployeeFormProps) {
  const isEdit = !!employee

  const boundAction = isEdit
    ? updateEmployee.bind(null, employee.id)
    : createEmployee

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    boundAction as (prevState: ActionState, formData: FormData) => Promise<ActionState>,
    null
  )

  // Select state
  const [companyId, setCompanyId] = useState('')
  const [deptId, setDeptId] = useState('')
  const [subDeptId, setSubDeptId] = useState('')
  const [gender, setGender] = useState('')
  const [citizenship, setCitizenship] = useState('')
  const [status, setStatus] = useState('active')
  const [language, setLanguage] = useState('hebrew')
  const [roleTagIds, setRoleTagIds] = useState<string[]>([])

  // Reset on open
  useEffect(() => {
    setCompanyId(employee?.company_id ?? '')
    setDeptId(employee?.department_id ?? '')
    setSubDeptId(employee?.sub_department_id ?? '')
    setGender(employee?.gender ?? '')
    setCitizenship(employee?.citizenship ?? '')
    setStatus(employee?.status ?? 'active')
    setLanguage(employee?.correspondence_language ?? 'hebrew')
    setRoleTagIds(employee?.role_tags?.map((r) => r.role_tag_id) ?? [])
  }, [employee])

  // Close on success
  useEffect(() => {
    if (state?.success) onOpenChange(false)
  }, [state, onOpenChange])

  // Cascading
  const filteredDepts = departments.filter(
    (d) => d.company_id === companyId && d.parent_dept_id === null
  )
  const filteredSubDepts = departments.filter(
    (d) => d.parent_dept_id === deptId
  )

  const errors = state?.error

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'עריכת עובד' : 'הוספת עובד חדש'}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">

          {/* ── Section 1: פרטים אישיים ── */}
          <SectionHeading title="פרטים אישיים" />

          <div className="space-y-2">
            <FieldLabel required>מספר עובד</FieldLabel>
            <Input name="employee_number" placeholder="מספר עובד ייחודי" defaultValue={employee?.employee_number ?? ''} />
            <FieldError errors={errors} field="employee_number" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel required>שם פרטי</FieldLabel>
              <Input name="first_name" placeholder="שם פרטי" defaultValue={employee?.first_name ?? ''} />
              <FieldError errors={errors} field="first_name" />
            </div>
            <div className="space-y-2">
              <FieldLabel required>שם משפחה</FieldLabel>
              <Input name="last_name" placeholder="שם משפחה" defaultValue={employee?.last_name ?? ''} />
              <FieldError errors={errors} field="last_name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>תעודת זהות</FieldLabel>
              <Input name="id_number" placeholder="מספר ת.ז." defaultValue={employee?.id_number ?? ''} />
            </div>
            <div className="space-y-2">
              <FieldLabel>מגדר</FieldLabel>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="בחר מגדר" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">זכר</SelectItem>
                  <SelectItem value="female">נקבה</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="gender" value={gender} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>תאריך לידה</FieldLabel>
              <Input name="date_of_birth" type="date" defaultValue={employee?.date_of_birth ?? ''} />
            </div>
            <div className="space-y-2">
              <FieldLabel>אזרחות</FieldLabel>
              <Select value={citizenship} onValueChange={setCitizenship}>
                <SelectTrigger><SelectValue placeholder="בחר אזרחות" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="israeli">ישראלית</SelectItem>
                  <SelectItem value="foreign">זרה</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="citizenship" value={citizenship} />
            </div>
          </div>

          {citizenship === 'foreign' && (
            <div className="space-y-2">
              <FieldLabel>מספר דרכון</FieldLabel>
              <Input name="passport_number" placeholder="מספר דרכון" defaultValue={employee?.passport_number ?? ''} />
            </div>
          )}

          {/* ── Section 2: כתובת ופרטי קשר ── */}
          <SectionHeading title="כתובת ופרטי קשר" />

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <FieldLabel>רחוב</FieldLabel>
              <Input name="street" placeholder="שם הרחוב" defaultValue={employee?.street ?? ''} />
            </div>
            <div className="space-y-2">
              <FieldLabel>מספר בית</FieldLabel>
              <Input name="house_number" placeholder="מס'" defaultValue={employee?.house_number ?? ''} />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>עיר</FieldLabel>
            <Input name="city" placeholder="שם העיר" defaultValue={employee?.city ?? ''} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>טלפון נייד</FieldLabel>
              <Input name="mobile_phone" placeholder="05X-XXXXXXX" defaultValue={employee?.mobile_phone ?? ''} />
            </div>
            <div className="space-y-2">
              <FieldLabel>טלפון נוסף</FieldLabel>
              <Input name="additional_phone" placeholder="טלפון נוסף" defaultValue={employee?.additional_phone ?? ''} />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>דוא&quot;ל</FieldLabel>
            <Input name="email" type="email" placeholder="example@company.com" defaultValue={employee?.email ?? ''} />
          </div>

          {/* ── Section 3: שיוך ארגוני ── */}
          <SectionHeading title="שיוך ארגוני" />

          <div className="space-y-2">
            <FieldLabel required>חברה</FieldLabel>
            <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setDeptId(''); setSubDeptId('') }}>
              <SelectTrigger><SelectValue placeholder="בחר חברה" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="company_id" value={companyId} />
            <FieldError errors={errors} field="company_id" />
          </div>

          <div className="space-y-2">
            <FieldLabel>מחלקה</FieldLabel>
            <Select value={deptId || '__none__'} onValueChange={(v) => { setDeptId(v === '__none__' ? '' : v); setSubDeptId('') }} disabled={!companyId}>
              <SelectTrigger><SelectValue placeholder={companyId ? 'בחר מחלקה' : 'בחר חברה תחילה'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא מחלקה</SelectItem>
                {filteredDepts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="department_id" value={deptId} />
          </div>

          <div className="space-y-2">
            <FieldLabel>תת-מחלקה</FieldLabel>
            <Select value={subDeptId || '__none__'} onValueChange={(v) => setSubDeptId(v === '__none__' ? '' : v)} disabled={!deptId}>
              <SelectTrigger><SelectValue placeholder={deptId ? 'בחר תת-מחלקה' : 'בחר מחלקה תחילה'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא תת-מחלקה</SelectItem>
                {filteredSubDepts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="sub_department_id" value={subDeptId} />
          </div>

          {/* ── Section 4: תעסוקה ── */}
          <SectionHeading title="תעסוקה" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>תאריך תחילת עבודה</FieldLabel>
              <Input name="start_date" type="date" defaultValue={employee?.start_date ?? ''} />
            </div>
            <div className="space-y-2">
              <FieldLabel>תאריך סיום עבודה</FieldLabel>
              <Input name="end_date" type="date" defaultValue={employee?.end_date ?? ''} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>סטטוס</FieldLabel>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">פעיל</SelectItem>
                  <SelectItem value="suspended">מושהה</SelectItem>
                  <SelectItem value="inactive">לא פעיל</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="status" value={status} />
            </div>
            <div className="space-y-2">
              <FieldLabel>שפת התכתבות</FieldLabel>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hebrew">עברית</SelectItem>
                  <SelectItem value="english">אנגלית</SelectItem>
                  <SelectItem value="arabic">ערבית</SelectItem>
                  <SelectItem value="thai">תאית</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="correspondence_language" value={language} />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>מקצוע</FieldLabel>
            <Input name="profession" placeholder="מקצוע העובד" defaultValue={employee?.profession ?? ''} />
          </div>

          <div className="space-y-2">
            <FieldLabel>תגיות תפקיד</FieldLabel>
            <RoleTagMultiSelect
              roleTags={roleTags}
              selectedIds={roleTagIds}
              onChange={setRoleTagIds}
            />
          </div>

          {/* ── Section 5: הערות ── */}
          <SectionHeading title="הערות" />

          <div className="space-y-2">
            <FieldLabel>הערות</FieldLabel>
            <textarea
              name="notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="הערות נוספות..."
              defaultValue={employee?.notes ?? ''}
            />
          </div>

          {/* Server-level error */}
          {errors?._form && (
            <p className="text-sm text-destructive">{errors._form[0]}</p>
          )}

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              ביטול
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  שומר...
                </>
              ) : isEdit ? 'שמור שינויים' : 'הוסף עובד'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
