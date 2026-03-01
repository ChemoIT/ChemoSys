'use client'

/**
 * DepartmentForm — create/edit dialog for a Department record.
 *
 * Supports parent-child hierarchy:
 *   - Company dropdown populated from companies prop
 *   - Parent department dropdown filters by selected company_id
 *   - When company changes, parent department is reset
 *   - Cannot select itself as parent (edit mode guard)
 *
 * Uses React Hook Form + Zod resolver + useActionState Server Action binding.
 */

import * as React from 'react'
import { useActionState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import type { Company, Department } from '@/types/entities'
import { DepartmentSchema, type DepartmentFormValues } from '@/lib/schemas'
import { createDepartment, updateDepartment } from '@/actions/departments'
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

interface DepartmentFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  department?: Department
  companies: Pick<Company, 'id' | 'name'>[]
  departments: Pick<Department, 'id' | 'name' | 'dept_number' | 'company_id'>[]
}

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
} | null

export function DepartmentForm({
  open,
  onOpenChange,
  department,
  companies,
  departments,
}: DepartmentFormProps) {
  const isEdit = !!department

  const boundAction = isEdit
    ? updateDepartment.bind(null, department.id)
    : createDepartment

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    boundAction as (
      prevState: ActionState,
      formData: FormData
    ) => Promise<ActionState>,
    null
  )

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(DepartmentSchema),
    defaultValues: {
      name: department?.name ?? '',
      dept_number: department?.dept_number ?? '',
      company_id: department?.company_id ?? '',
      parent_dept_id: department?.parent_dept_id ?? '',
      notes: department?.notes ?? '',
    },
  })

  // Track selected company_id to filter parent department options
  const selectedCompanyId = form.watch('company_id')

  // Filter available parent departments:
  //   - Must belong to the selected company
  //   - Must NOT be the current department (no self-reference)
  const availableParents = departments.filter(
    (d) =>
      d.company_id === selectedCompanyId &&
      (!isEdit || d.id !== department?.id)
  )

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: department?.name ?? '',
        dept_number: department?.dept_number ?? '',
        company_id: department?.company_id ?? '',
        parent_dept_id: department?.parent_dept_id ?? '',
        notes: department?.notes ?? '',
      })
    }
  }, [open, department, form])

  // When company changes, reset parent_dept_id
  useEffect(() => {
    form.setValue('parent_dept_id', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId])

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
          form.setError(field as keyof DepartmentFormValues, {
            message: messages[0],
          })
        }
      })
    }
  }, [state, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'עריכת מחלקה' : 'הוספת מחלקה חדשה'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form action={formAction} className="space-y-4">
            {/* dept_number */}
            <FormField
              control={form.control}
              name="dept_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מספר מחלקה *</FormLabel>
                  <FormControl>
                    <Input placeholder="מספר מחלקה ייחודי" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם מחלקה *</FormLabel>
                  <FormControl>
                    <Input placeholder="שם המחלקה" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* company_id — Select */}
            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>חברה *</FormLabel>
                  {/* Hidden input so formAction receives the value */}
                  <input type="hidden" name="company_id" value={field.value} />
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר חברה" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* parent_dept_id — Select (optional) */}
            <FormField
              control={form.control}
              name="parent_dept_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מחלקת-אב (אופציונלי)</FormLabel>
                  {/* Hidden input so formAction receives the value */}
                  <input
                    type="hidden"
                    name="parent_dept_id"
                    value={field.value ?? ''}
                  />
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    disabled={!selectedCompanyId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="ללא מחלקת-אב (מחלקה ראשית)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableParents.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.dept_number} — {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  'הוסף מחלקה'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
