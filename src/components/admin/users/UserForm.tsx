'use client'

/**
 * UserForm — dialog for creating a new system user.
 *
 * Two-phase UX:
 *   Phase A: Search and select an active employee (via EmployeeSearchDialog)
 *   Phase B: Fill in email (pre-filled from employee) + password + optional template
 *
 * Binds to createUser Server Action via useActionState.
 * Wraps form submission in startTransition for correct React 19 / Next.js 16 behaviour.
 *
 * Props:
 *   open             — dialog visibility
 *   onOpenChange     — toggle handler
 *   employees        — active employees list (for EmployeeSearchDialog)
 *   linkedEmployeeIds — employees already linked to active users (excluded from search)
 *   templates        — available role templates for optional pre-assignment
 */

import * as React from 'react'
import { useActionState, useEffect, useTransition } from 'react'
import { Loader2, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { createUser } from '@/actions/users'
import type { ActionWarning } from '@/lib/action-types'
import { ErrorDetailDialog } from '@/components/ui/error-detail-dialog'
import { EmployeeSearchDialog } from '@/components/admin/users/EmployeeSearchDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionState = { success: boolean; error?: Record<string, string[]>; warnings?: ActionWarning[] } | null

type SelectedEmployee = {
  id: string
  first_name: string
  last_name: string
  employee_number: string
  email?: string | null
  id_number?: string | null
  company_name?: string
}

interface UserFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Array<{
    id: string
    first_name: string
    last_name: string
    employee_number: string
    email: string | null
    id_number: string | null
    companies: { name: string } | null
  }>
  linkedEmployeeIds: string[]
  templates: Array<{ id: string; name: string }>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserForm({
  open,
  onOpenChange,
  employees,
  linkedEmployeeIds,
  templates,
}: UserFormProps) {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [selectedEmployee, setSelectedEmployee] = React.useState<SelectedEmployee | null>(null)
  const [email, setEmail] = React.useState('')
  const [templateId, setTemplateId] = React.useState('')
  const [, startTransition] = useTransition()
  const [pendingWarnings, setPendingWarnings] = React.useState<ActionWarning[]>([])

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createUser,
    null
  )

  // Reset form state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedEmployee(null)
      setEmail('')
      setTemplateId('')
      setSearchOpen(false)
    }
  }, [open])

  // Close on success + show toast
  useEffect(() => {
    if (state?.success) {
      toast.success('יוזר נוצר בהצלחה')
      if (state.warnings?.length) {
        setPendingWarnings(state.warnings)
      }
      onOpenChange(false)
    }
  }, [state, onOpenChange])

  function handleEmployeeSelect(employee: SelectedEmployee) {
    setSelectedEmployee(employee)
    // Pre-fill email from employee record if available
    if (employee.email) setEmail(employee.email)
  }

  function clearEmployee() {
    setSelectedEmployee(null)
    setEmail('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    startTransition(() => {
      formAction(new FormData(form))
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              יצירת יוזר חדש
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ----------------------------------------------------------------
                Phase A: Employee selection
              ---------------------------------------------------------------- */}
            <div className="space-y-2">
              <Label>עובד מקושר *</Label>

              {selectedEmployee ? (
                <div className="flex items-start justify-between rounded-md border bg-muted/30 px-3 py-2.5">
                  <div>
                    <div className="font-medium text-sm">
                      {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      מס׳ {selectedEmployee.employee_number}
                      {selectedEmployee.company_name && ` · ${selectedEmployee.company_name}`}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={clearEmployee}
                    title="הסר בחירה"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setSearchOpen(true)}
                >
                  חיפוש וקישור עובד...
                </Button>
              )}

              {/* Hidden input for Server Action */}
              {selectedEmployee && (
                <input type="hidden" name="employee_id" value={selectedEmployee.id} />
              )}

              {state?.error?.employee_id && (
                <p className="text-xs text-destructive">{state.error.employee_id[0]}</p>
              )}
            </div>

            {/* ----------------------------------------------------------------
                Phase B: Account details (shown only after employee selected)
              ---------------------------------------------------------------- */}
            {selectedEmployee && (
              <>
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">כתובת מייל *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                  />
                  {state?.error?.email && (
                    <p className="text-xs text-destructive">{state.error.email[0]}</p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">סיסמה *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="לפחות 6 תווים"
                    dir="ltr"
                  />
                  {state?.error?.password && (
                    <p className="text-xs text-destructive">{state.error.password[0]}</p>
                  )}
                </div>

                {/* ChemoSys module access */}
                <div className="space-y-2">
                  <Label>גישה ל-ChemoSys</Label>
                  <div className="flex items-center gap-6 rounded-md border bg-muted/30 px-3 py-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="app_fleet"
                        value="1"
                        className="h-4 w-4 accent-primary cursor-pointer"
                      />
                      <span className="text-sm">צי רכב</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="app_equipment"
                        value="1"
                        className="h-4 w-4 accent-primary cursor-pointer"
                      />
                      <span className="text-sm">צמ&quot;ה</span>
                    </label>
                  </div>
                </div>

                {/* Template (optional) */}
                {templates.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="template_id">
                      תבנית הרשאות{' '}
                      <Badge variant="secondary" className="text-xs font-normal ms-1">
                        אופציונלי
                      </Badge>
                    </Label>
                    <select
                      id="template_id"
                      name="template_id"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                    >
                      <option value="">— ללא תבנית —</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      הרשאות התבנית ימולאו אוטומטית לאחר יצירת היוזר
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Server-level errors */}
            {state?.error?._form && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                {state.error._form[0]}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={isPending || !selectedEmployee}>
                {isPending ? (
                  <>
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                    יוצר...
                  </>
                ) : (
                  'צור יוזר'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Employee search dialog — nested outside main dialog to avoid z-index issues */}
      <EmployeeSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleEmployeeSelect}
        employees={employees}
        linkedEmployeeIds={linkedEmployeeIds}
      />

      <ErrorDetailDialog
        open={pendingWarnings.length > 0}
        onOpenChange={(open) => { if (!open) setPendingWarnings([]) }}
        actionLabel="יצירת יוזר"
        warnings={pendingWarnings}
      />
    </>
  )
}
