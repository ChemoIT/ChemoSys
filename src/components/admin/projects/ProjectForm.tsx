'use client'

/**
 * ProjectForm — create/edit dialog for a Project record.
 *
 * Uses React Hook Form + Zod resolver for client-side validation.
 * Binds to Server Actions (createProject / updateProject) via useActionState.
 * Shows field-level errors returned from server in Hebrew.
 *
 * Form is divided into logical field groups, displayed in a scrollable dialog.
 * Three employee selectors reuse EmployeeSearchDialog.
 * Boolean fields use hidden input pattern — checkboxes do NOT write to FormData.
 *
 * Props:
 *   open        — dialog visibility
 *   onOpenChange — toggle handler
 *   project     — populated for edit mode, undefined for create mode
 *   employees   — active employees list (fetched server-side) for selectors
 */

import * as React from 'react'
import { useActionState, useEffect, useState, startTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, X, UserSearch } from 'lucide-react'
import type { Project } from '@/types/entities'
import { ProjectSchema, type ProjectInput } from '@/lib/schemas'
import { createProject, updateProject } from '@/actions/projects'
import { EmployeeSearchDialog } from '@/components/admin/users/EmployeeSearchDialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SelectedEmployee = {
  id: string
  first_name: string
  last_name: string
  employee_number: string
}

type EmployeeOption = {
  id: string
  first_name: string
  last_name: string
  employee_number: string
  email: string | null
  id_number: string | null
  companies: { name: string } | null
}

/** Project with joined employee data for edit mode pre-population */
export type ProjectWithManagers = Project & {
  project_manager?: { id: string; first_name: string; last_name: string; employee_number: string } | null
  site_manager?: { id: string; first_name: string; last_name: string; employee_number: string } | null
  camp_vehicle_coordinator?: { id: string; first_name: string; last_name: string; employee_number: string } | null
}

interface ProjectFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: ProjectWithManagers
  employees: EmployeeOption[]
}

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
} | null

// ---------------------------------------------------------------------------
// Section header helper
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b pb-1 mb-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{children}</h3>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectForm({ open, onOpenChange, project, employees }: ProjectFormProps) {
  const isEdit = !!project

  // Bind the appropriate server action (create vs update)
  const boundAction = isEdit
    ? updateProject.bind(null, project.id)
    : createProject

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    boundAction as (prevState: ActionState, formData: FormData) => Promise<ActionState>,
    null
  )

  // ---------------------------------------------------------------------------
  // Boolean state — hidden input pattern (checkboxes don't write to FormData)
  // ---------------------------------------------------------------------------
  const [hasAttendanceCode, setHasAttendanceCode] = useState(project?.has_attendance_code ?? false)
  const [ignoreAutoEquipment, setIgnoreAutoEquipment] = useState(project?.ignore_auto_equipment ?? false)
  const [pmNotifications, setPmNotifications] = useState(project?.pm_notifications ?? false)
  const [smNotifications, setSmNotifications] = useState(project?.sm_notifications ?? false)

  // ---------------------------------------------------------------------------
  // Employee selector state — three selectors (PM, SM, CVC)
  // ---------------------------------------------------------------------------
  const [pm, setPm] = useState<SelectedEmployee | null>(
    project?.project_manager ?? null
  )
  const [sm, setSm] = useState<SelectedEmployee | null>(
    project?.site_manager ?? null
  )
  const [cvc, setCvc] = useState<SelectedEmployee | null>(
    project?.camp_vehicle_coordinator ?? null
  )

  const [pmOpen, setPmOpen] = useState(false)
  const [smOpen, setSmOpen] = useState(false)
  const [cvcOpen, setCvcOpen] = useState(false)

  // ---------------------------------------------------------------------------
  // Select field state (hidden input pattern — Select.onValueChange ≠ FormData)
  // ---------------------------------------------------------------------------
  const [projectType, setProjectType] = useState<string>(project?.project_type ?? '')
  const [status, setStatus] = useState<string>(project?.status ?? 'active')

  // ---------------------------------------------------------------------------
  // React Hook Form
  // ---------------------------------------------------------------------------
  const form = useForm<ProjectInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ProjectSchema as any),
    defaultValues: buildDefaults(project),
  })

  // Reset all state when dialog opens/closes or project changes
  useEffect(() => {
    if (open) {
      form.reset(buildDefaults(project))
      setHasAttendanceCode(project?.has_attendance_code ?? false)
      setIgnoreAutoEquipment(project?.ignore_auto_equipment ?? false)
      setPmNotifications(project?.pm_notifications ?? false)
      setSmNotifications(project?.sm_notifications ?? false)
      setPm(project?.project_manager ?? null)
      setSm(project?.site_manager ?? null)
      setCvc(project?.camp_vehicle_coordinator ?? null)
      setProjectType(project?.project_type ?? '')
      setStatus(project?.status ?? 'active')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project])

  // Close dialog on success
  useEffect(() => {
    if (state?.success) {
      onOpenChange(false)
    }
  }, [state, onOpenChange])

  // Apply server-side field errors to form
  useEffect(() => {
    if (state?.error) {
      Object.entries(state.error).forEach(([field, messages]) => {
        if (field !== '_form' && messages?.length) {
          form.setError(field as keyof ProjectInput, { message: messages[0] })
        }
      })
    }
  }, [state, form])

  // ---------------------------------------------------------------------------
  // Form submission — wrap in startTransition (React 19 / Next.js 16 requirement)
  // ---------------------------------------------------------------------------
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(() => {
      formAction(formData)
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'עריכת פרויקט' : 'הוספת פרויקט חדש'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-0">
              {/* Scrollable field area */}
              <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 pb-4">

                {/* ============================================================
                    1. Basic Info
                    ============================================================ */}
                <div>
                  <SectionHeader>פרטים בסיסיים</SectionHeader>
                  <div className="space-y-4">

                    {/* name */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>שם פרויקט *</FormLabel>
                          <FormControl>
                            <Input placeholder="שם הפרויקט" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* display_name */}
                    <FormField
                      control={form.control}
                      name="display_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>שם תצוגה</FormLabel>
                          <FormControl>
                            <Input placeholder="שם קצר לתצוגה (אופציונלי)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* project_number — display-only in edit mode */}
                    {isEdit && (
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">מספר פרויקט</Label>
                        <Input
                          value={project.project_number}
                          readOnly
                          disabled
                          className="bg-muted text-muted-foreground"
                        />
                        <p className="text-xs text-muted-foreground">מספר הפרויקט נוצר אוטומטית ואינו ניתן לשינוי</p>
                      </div>
                    )}

                    {/* expense_number + general_number side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="expense_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>מספר הוצאה</FormLabel>
                            <FormControl>
                              <Input placeholder="מספר הוצאה" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="general_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>מספר כללי</FormLabel>
                            <FormControl>
                              <Input placeholder="מספר כללי" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>תיאור</FormLabel>
                          <FormControl>
                            <textarea
                              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="תיאור הפרויקט..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* ============================================================
                    2. Codes
                    ============================================================ */}
                <div>
                  <SectionHeader>קודים</SectionHeader>
                  <div className="space-y-4">

                    {/* project_code */}
                    <FormField
                      control={form.control}
                      name="project_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>קוד פרויקט</FormLabel>
                          <FormControl>
                            <Input placeholder="קוד פרויקט" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* attendance_code + has_attendance_code */}
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <FormField
                        control={form.control}
                        name="attendance_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>קוד נוכחות</FormLabel>
                            <FormControl>
                              <Input placeholder="קוד נוכחות" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-center gap-2 pb-2">
                        {/* Hidden input — carries boolean value to FormData */}
                        <input type="hidden" name="has_attendance_code" value={hasAttendanceCode ? 'true' : 'false'} />
                        <Checkbox
                          id="has_attendance_code"
                          checked={hasAttendanceCode}
                          onCheckedChange={(v) => setHasAttendanceCode(!!v)}
                        />
                        <label htmlFor="has_attendance_code" className="text-sm cursor-pointer">
                          פרויקט עם נוכחות
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ============================================================
                    3. Classification
                    ============================================================ */}
                <div>
                  <SectionHeader>סיווג</SectionHeader>
                  <div className="space-y-4">

                    {/* project_type — Select + hidden input */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">סוג פרויקט</Label>
                      <input type="hidden" name="project_type" value={projectType} />
                      <Select value={projectType} onValueChange={setProjectType}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר סוג פרויקט..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="project">פרויקט</SelectItem>
                          <SelectItem value="staging_area">שטח התארגנות</SelectItem>
                          <SelectItem value="storage_area">שטח אחסנה</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* ignore_auto_equipment */}
                    <div className="flex items-center gap-2">
                      <input type="hidden" name="ignore_auto_equipment" value={ignoreAutoEquipment ? 'true' : 'false'} />
                      <Checkbox
                        id="ignore_auto_equipment"
                        checked={ignoreAutoEquipment}
                        onCheckedChange={(v) => setIgnoreAutoEquipment(!!v)}
                      />
                      <label htmlFor="ignore_auto_equipment" className="text-sm cursor-pointer">
                        התעלם מציוד אוטומטי
                      </label>
                    </div>

                    {/* supervision + client */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="supervision"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>פיקוח</FormLabel>
                            <FormControl>
                              <Input placeholder="גורם מפקח" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="client"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>לקוח</FormLabel>
                            <FormControl>
                              <Input placeholder="שם הלקוח" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* status — Select + hidden input */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">סטטוס</Label>
                      <input type="hidden" name="status" value={status} />
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">פעיל</SelectItem>
                          <SelectItem value="inactive">לא פעיל</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* ============================================================
                    4. Project Manager (מנהל פרויקט)
                    ============================================================ */}
                <div>
                  <SectionHeader>מנהל פרויקט</SectionHeader>
                  <div className="space-y-4">
                    {/* Hidden FK input */}
                    <input type="hidden" name="project_manager_id" value={pm?.id ?? ''} />

                    {/* Employee selector button */}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 justify-start text-start font-normal"
                        onClick={() => setPmOpen(true)}
                      >
                        <UserSearch className="me-2 h-4 w-4 text-muted-foreground" />
                        {pm
                          ? `${pm.first_name} ${pm.last_name} (${pm.employee_number})`
                          : 'בחר מנהל פרויקט...'}
                      </Button>
                      {pm && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="הסר מנהל פרויקט"
                          onClick={() => setPm(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* PM email + phone */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="pm_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>מייל מנהל פרויקט</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="pm@company.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="pm_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>טלפון מנהל פרויקט</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="05X-XXXXXXX" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* pm_notifications */}
                    <div className="flex items-center gap-2">
                      <input type="hidden" name="pm_notifications" value={pmNotifications ? 'true' : 'false'} />
                      <Checkbox
                        id="pm_notifications"
                        checked={pmNotifications}
                        onCheckedChange={(v) => setPmNotifications(!!v)}
                      />
                      <label htmlFor="pm_notifications" className="text-sm cursor-pointer">
                        שלח התראות למנהל פרויקט
                      </label>
                    </div>
                  </div>
                </div>

                {/* ============================================================
                    5. Site Manager (מנהל עבודה)
                    ============================================================ */}
                <div>
                  <SectionHeader>מנהל עבודה</SectionHeader>
                  <div className="space-y-4">
                    <input type="hidden" name="site_manager_id" value={sm?.id ?? ''} />

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 justify-start text-start font-normal"
                        onClick={() => setSmOpen(true)}
                      >
                        <UserSearch className="me-2 h-4 w-4 text-muted-foreground" />
                        {sm
                          ? `${sm.first_name} ${sm.last_name} (${sm.employee_number})`
                          : 'בחר מנהל עבודה...'}
                      </Button>
                      {sm && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="הסר מנהל עבודה"
                          onClick={() => setSm(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="sm_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>מייל מנהל עבודה</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="sm@company.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sm_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>טלפון מנהל עבודה</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="05X-XXXXXXX" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input type="hidden" name="sm_notifications" value={smNotifications ? 'true' : 'false'} />
                      <Checkbox
                        id="sm_notifications"
                        checked={smNotifications}
                        onCheckedChange={(v) => setSmNotifications(!!v)}
                      />
                      <label htmlFor="sm_notifications" className="text-sm cursor-pointer">
                        שלח התראות למנהל עבודה
                      </label>
                    </div>
                  </div>
                </div>

                {/* ============================================================
                    6. Camp Vehicle Coordinator (אחראי רכבי מחנה)
                    ============================================================ */}
                <div>
                  <SectionHeader>אחראי רכבי מחנה</SectionHeader>
                  <div className="space-y-4">
                    <input type="hidden" name="camp_vehicle_coordinator_id" value={cvc?.id ?? ''} />

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 justify-start text-start font-normal"
                        onClick={() => setCvcOpen(true)}
                      >
                        <UserSearch className="me-2 h-4 w-4 text-muted-foreground" />
                        {cvc
                          ? `${cvc.first_name} ${cvc.last_name} (${cvc.employee_number})`
                          : 'בחר אחראי רכבי מחנה...'}
                      </Button>
                      {cvc && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="הסר אחראי רכבי מחנה"
                          onClick={() => setCvc(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="cvc_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>טלפון אחראי רכבי מחנה</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="05X-XXXXXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* ============================================================
                    7. Coordinates (קואורדינטות)
                    ============================================================ */}
                <div>
                  <SectionHeader>קואורדינטות</SectionHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>קו רוחב (Latitude)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              dir="ltr"
                              className="text-left"
                              placeholder="31.7683"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="longitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>קו אורך (Longitude)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              dir="ltr"
                              className="text-left"
                              placeholder="35.2137"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

              </div>{/* end scrollable area */}

              {/* Server-level error (non-field) */}
              {state?.error?._form && (
                <p className="text-sm text-destructive px-1 pt-2">{state.error._form[0]}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
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
                    'הוסף פרויקט'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Employee Search Dialogs — outside main dialog to avoid z-index stacking */}
      <EmployeeSearchDialog
        open={pmOpen}
        onOpenChange={setPmOpen}
        onSelect={(emp) => setPm({ id: emp.id, first_name: emp.first_name, last_name: emp.last_name, employee_number: emp.employee_number })}
        employees={employees}
        linkedEmployeeIds={[]}
      />
      <EmployeeSearchDialog
        open={smOpen}
        onOpenChange={setSmOpen}
        onSelect={(emp) => setSm({ id: emp.id, first_name: emp.first_name, last_name: emp.last_name, employee_number: emp.employee_number })}
        employees={employees}
        linkedEmployeeIds={[]}
      />
      <EmployeeSearchDialog
        open={cvcOpen}
        onOpenChange={setCvcOpen}
        onSelect={(emp) => setCvc({ id: emp.id, first_name: emp.first_name, last_name: emp.last_name, employee_number: emp.employee_number })}
        employees={employees}
        linkedEmployeeIds={[]}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaults(project: ProjectWithManagers | undefined): ProjectInput {
  return {
    name:                        project?.name ?? '',
    display_name:                project?.display_name ?? '',
    expense_number:              project?.expense_number ?? '',
    general_number:              project?.general_number ?? '',
    description:                 project?.description ?? '',
    project_code:                project?.project_code ?? '',
    attendance_code:             project?.attendance_code ?? '',
    // Transform fields — provide 'true'/'false' strings for Zod .transform()
    has_attendance_code:         project?.has_attendance_code ? 'true' : 'false',
    project_type:                project?.project_type ?? '',
    ignore_auto_equipment:       project?.ignore_auto_equipment ? 'true' : 'false',
    supervision:                 project?.supervision ?? '',
    client:                      project?.client ?? '',
    status:                      project?.status ?? 'active',
    project_manager_id:          project?.project_manager_id ?? '',
    pm_email:                    project?.pm_email ?? '',
    pm_phone:                    project?.pm_phone ?? '',
    pm_notifications:            project?.pm_notifications ? 'true' : 'false',
    site_manager_id:             project?.site_manager_id ?? '',
    sm_email:                    project?.sm_email ?? '',
    sm_phone:                    project?.sm_phone ?? '',
    sm_notifications:            project?.sm_notifications ? 'true' : 'false',
    camp_vehicle_coordinator_id: project?.camp_vehicle_coordinator_id ?? '',
    cvc_phone:                   project?.cvc_phone ?? '',
    latitude:                    project?.latitude != null ? String(project.latitude) : '',
    longitude:                   project?.longitude != null ? String(project.longitude) : '',
  } as unknown as ProjectInput
}
