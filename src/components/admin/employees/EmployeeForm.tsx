'use client'

/**
 * EmployeeForm — create/edit dialog for an Employee record.
 *
 * 22+ fields organised across 5 sections:
 *   1. פרטים אישיים  (Personal info)
 *   2. כתובת ופרטי קשר (Address & Contact)
 *   3. שיוך ארגוני  (Organisational assignment — cascading selectors)
 *   4. תעסוקה       (Employment — dates, status, role tags)
 *   5. הערות        (Notes)
 *
 * Pattern:
 *   - useActionState bound to createEmployee / updateEmployee.bind(null, id)
 *   - React Hook Form + zodResolver for client-side validation
 *   - Every shadcn/ui <Select> has a companion hidden <input> for FormData access
 *   - Cascading: company → department → sub-department (resets on parent change)
 *   - RoleTagMultiSelect writes hidden inputs for junction table management
 *
 * NOTE: zodResolver type cast (as any) is intentional — Zod v4 .default() and
 * .optional() produce variance issues with RHF's Resolver generic in strict TS.
 * Identical pattern to DepartmentForm (Phase 1 decision [01-04]).
 */

import * as React from 'react'
import { useActionState, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import type { Company, Department, Employee, RoleTag } from '@/types/entities'
import { EmployeeSchema } from '@/lib/schemas'
import { createEmployee, updateEmployee } from '@/actions/employees'
import { RoleTagMultiSelect } from './RoleTagMultiSelect'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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

/**
 * EmployeeFormValues — concrete form values type.
 * Manually defined to avoid Zod v4 .default()/.optional() variance
 * conflicts with zodResolver (same pattern as Phase 1 DepartmentForm).
 */
type EmployeeFormValues = {
  first_name: string
  last_name: string
  employee_number: string
  company_id: string
  id_number: string
  gender: string
  street: string
  house_number: string
  city: string
  mobile_phone: string
  additional_phone: string
  email: string
  date_of_birth: string
  start_date: string
  end_date: string
  status: string
  department_id: string
  sub_department_id: string
  passport_number: string
  citizenship: string
  correspondence_language: string
  profession: string
  notes: string
}

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
// Helper — section heading divider
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

  // Bind the appropriate server action
  const boundAction = isEdit
    ? updateEmployee.bind(null, employee.id)
    : createEmployee

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    boundAction as (prevState: ActionState, formData: FormData) => Promise<ActionState>,
    null
  )

  // React Hook Form — cast resolver to avoid Zod v4 + RHF generic variance issue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<EmployeeFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(EmployeeSchema) as any,
    defaultValues: buildDefaultValues(employee),
  })

  // ---------------------------------------------------------------------------
  // Select state (each Select needs controlled value for hidden input companion)
  // ---------------------------------------------------------------------------
  const [selectedCompanyId,   setSelectedCompanyId]   = useState(employee?.company_id ?? '')
  const [selectedDeptId,      setSelectedDeptId]      = useState(employee?.department_id ?? '')
  const [selectedSubDeptId,   setSelectedSubDeptId]   = useState(employee?.sub_department_id ?? '')
  const [selectedGender,      setSelectedGender]      = useState(employee?.gender ?? '')
  const [selectedCitizenship, setSelectedCitizenship] = useState(employee?.citizenship ?? '')
  const [selectedStatus,      setSelectedStatus]      = useState<string>(employee?.status ?? 'active')
  const [selectedLanguage,    setSelectedLanguage]    = useState<string>(employee?.correspondence_language ?? 'hebrew')
  const [selectedRoleTagIds,  setSelectedRoleTagIds]  = useState<string[]>(
    employee?.role_tags?.map((r) => r.role_tag_id) ?? []
  )

  // ---------------------------------------------------------------------------
  // Derived lists for cascading selectors
  // ---------------------------------------------------------------------------
  const filteredDepts = departments.filter(
    (d) => d.company_id === selectedCompanyId && d.parent_dept_id === null
  )
  const filteredSubDepts = departments.filter(
    (d) => d.parent_dept_id === selectedDeptId
  )

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Reset all state when dialog opens
  useEffect(() => {
    if (open) {
      form.reset(buildDefaultValues(employee))
      setSelectedCompanyId(employee?.company_id ?? '')
      setSelectedDeptId(employee?.department_id ?? '')
      setSelectedSubDeptId(employee?.sub_department_id ?? '')
      setSelectedGender(employee?.gender ?? '')
      setSelectedCitizenship(employee?.citizenship ?? '')
      setSelectedStatus(employee?.status ?? 'active')
      setSelectedLanguage(employee?.correspondence_language ?? 'hebrew')
      setSelectedRoleTagIds(employee?.role_tags?.map((r) => r.role_tag_id) ?? [])
    }
  }, [open, employee, form])

  // Close dialog on success
  useEffect(() => {
    if (state?.success) {
      onOpenChange(false)
    }
  }, [state, onOpenChange])

  // Apply server-side field errors
  useEffect(() => {
    if (state?.error) {
      Object.entries(state.error).forEach(([field, messages]) => {
        if (field !== '_form' && messages?.length) {
          form.setError(field as keyof EmployeeFormValues, { message: messages[0] })
        }
      })
    }
  }, [state, form])

  // ---------------------------------------------------------------------------
  // Cascading handlers
  // ---------------------------------------------------------------------------

  function handleCompanyChange(value: string) {
    setSelectedCompanyId(value)
    setSelectedDeptId('')
    setSelectedSubDeptId('')
  }

  function handleDeptChange(value: string) {
    setSelectedDeptId(value === '__none__' ? '' : value)
    setSelectedSubDeptId('')
  }

  function handleSubDeptChange(value: string) {
    setSelectedSubDeptId(value === '__none__' ? '' : value)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'עריכת עובד' : 'הוספת עובד חדש'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form action={formAction} className="space-y-4">

            {/* ================================================================
                Section 1 — פרטים אישיים
            ================================================================ */}
            <SectionHeading title="פרטים אישיים" />

            {/* employee_number */}
            <FormField
              control={form.control}
              name="employee_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מספר עובד *</FormLabel>
                  <FormControl>
                    <Input placeholder="מספר עובד ייחודי" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* first_name */}
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם פרטי *</FormLabel>
                    <FormControl>
                      <Input placeholder="שם פרטי" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* last_name */}
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם משפחה *</FormLabel>
                    <FormControl>
                      <Input placeholder="שם משפחה" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* id_number */}
              <FormField
                control={form.control}
                name="id_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תעודת זהות</FormLabel>
                    <FormControl>
                      <Input placeholder="מספר ת.ז." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* gender — Select + hidden input */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">מגדר</label>
                <Select value={selectedGender} onValueChange={setSelectedGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר מגדר" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">זכר</SelectItem>
                    <SelectItem value="female">נקבה</SelectItem>
                    <SelectItem value="other">אחר</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="gender" value={selectedGender} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* date_of_birth */}
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תאריך לידה</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* citizenship — Select + hidden input */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">אזרחות</label>
                <Select value={selectedCitizenship} onValueChange={setSelectedCitizenship}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר אזרחות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="israeli">ישראלית</SelectItem>
                    <SelectItem value="foreign">זרה</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="citizenship" value={selectedCitizenship} />
              </div>
            </div>

            {/* passport_number — visible only when citizenship = foreign */}
            {selectedCitizenship === 'foreign' && (
              <FormField
                control={form.control}
                name="passport_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מספר דרכון</FormLabel>
                    <FormControl>
                      <Input placeholder="מספר דרכון" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* ================================================================
                Section 2 — כתובת ופרטי קשר
            ================================================================ */}
            <SectionHeading title="כתובת ופרטי קשר" />

            <div className="grid grid-cols-3 gap-4">
              {/* street */}
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>רחוב</FormLabel>
                      <FormControl>
                        <Input placeholder="שם הרחוב" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* house_number */}
              <FormField
                control={form.control}
                name="house_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מספר בית</FormLabel>
                    <FormControl>
                      <Input placeholder="מס'" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* city */}
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>עיר</FormLabel>
                  <FormControl>
                    <Input placeholder="שם העיר" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* mobile_phone */}
              <FormField
                control={form.control}
                name="mobile_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>טלפון נייד</FormLabel>
                    <FormControl>
                      <Input placeholder="05X-XXXXXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* additional_phone */}
              <FormField
                control={form.control}
                name="additional_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>טלפון נוסף</FormLabel>
                    <FormControl>
                      <Input placeholder="טלפון נוסף" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>דוא&quot;ל</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="example@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ================================================================
                Section 3 — שיוך ארגוני
            ================================================================ */}
            <SectionHeading title="שיוך ארגוני" />

            {/* company_id (required) — Select + hidden input */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">חברה *</label>
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר חברה" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="company_id" value={selectedCompanyId} />
              {form.formState.errors.company_id && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.company_id.message as string}
                </p>
              )}
            </div>

            {/* department_id — filtered by company */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">מחלקה</label>
              <Select
                value={selectedDeptId || '__none__'}
                onValueChange={handleDeptChange}
                disabled={!selectedCompanyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCompanyId ? 'בחר מחלקה' : 'בחר חברה תחילה'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא מחלקה</SelectItem>
                  {filteredDepts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="department_id" value={selectedDeptId} />
            </div>

            {/* sub_department_id — filtered by department */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">תת-מחלקה</label>
              <Select
                value={selectedSubDeptId || '__none__'}
                onValueChange={handleSubDeptChange}
                disabled={!selectedDeptId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedDeptId ? 'בחר תת-מחלקה' : 'בחר מחלקה תחילה'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא תת-מחלקה</SelectItem>
                  {filteredSubDepts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="sub_department_id" value={selectedSubDeptId} />
            </div>

            {/* ================================================================
                Section 4 — תעסוקה
            ================================================================ */}
            <SectionHeading title="תעסוקה" />

            <div className="grid grid-cols-2 gap-4">
              {/* start_date */}
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תאריך תחילת עבודה</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* end_date */}
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תאריך סיום עבודה</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* status — Select + hidden input */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">סטטוס</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="suspended">מושהה</SelectItem>
                    <SelectItem value="inactive">לא פעיל</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="status" value={selectedStatus} />
              </div>

              {/* correspondence_language — Select + hidden input */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">שפת התכתבות</label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hebrew">עברית</SelectItem>
                    <SelectItem value="english">אנגלית</SelectItem>
                    <SelectItem value="arabic">ערבית</SelectItem>
                    <SelectItem value="thai">תאית</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="correspondence_language" value={selectedLanguage} />
              </div>
            </div>

            {/* profession */}
            <FormField
              control={form.control}
              name="profession"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מקצוע</FormLabel>
                  <FormControl>
                    <Input placeholder="מקצוע העובד" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* role_tags — multi-select with hidden inputs */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">תגיות תפקיד</label>
              <RoleTagMultiSelect
                roleTags={roleTags}
                selectedIds={selectedRoleTagIds}
                onChange={setSelectedRoleTagIds}
              />
            </div>

            {/* ================================================================
                Section 5 — הערות
            ================================================================ */}
            <SectionHeading title="הערות" />

            {/* notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="הערות נוספות..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Server-level error */}
            {state?.error?._form && (
              <p className="text-sm text-destructive">{state.error._form[0]}</p>
            )}

            {/* ================================================================
                Actions
            ================================================================ */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                    שומר...
                  </>
                ) : isEdit ? (
                  'שמור שינויים'
                ) : (
                  'הוסף עובד'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Helper — build RHF default values from employee (or empty for create)
// ---------------------------------------------------------------------------

function buildDefaultValues(
  employee?: (Employee & { role_tags?: { role_tag_id: string }[] }) | undefined
): EmployeeFormValues {
  return {
    first_name:              employee?.first_name ?? '',
    last_name:               employee?.last_name ?? '',
    employee_number:         employee?.employee_number ?? '',
    company_id:              employee?.company_id ?? '',
    id_number:               employee?.id_number ?? '',
    gender:                  employee?.gender ?? '',
    street:                  employee?.street ?? '',
    house_number:            employee?.house_number ?? '',
    city:                    employee?.city ?? '',
    mobile_phone:            employee?.mobile_phone ?? '',
    additional_phone:        employee?.additional_phone ?? '',
    email:                   employee?.email ?? '',
    date_of_birth:           employee?.date_of_birth ?? '',
    start_date:              employee?.start_date ?? '',
    end_date:                employee?.end_date ?? '',
    status:                  employee?.status ?? 'active',
    department_id:           employee?.department_id ?? '',
    sub_department_id:       employee?.sub_department_id ?? '',
    passport_number:         employee?.passport_number ?? '',
    citizenship:             employee?.citizenship ?? '',
    correspondence_language: employee?.correspondence_language ?? 'hebrew',
    profession:              employee?.profession ?? '',
    notes:                   employee?.notes ?? '',
  }
}
