'use client'

/**
 * DepartmentForm — create/edit dialog for a Department record.
 * Simplified: only dept_number, name, notes. Company auto-assigned server-side.
 */

import * as React from 'react'
import { useActionState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import type { Department } from '@/types/entities'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface DepartmentFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  department?: Department
}

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
} | null

export function DepartmentForm({
  open,
  onOpenChange,
  department,
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
      notes: department?.notes ?? '',
    },
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: department?.name ?? '',
        dept_number: department?.dept_number ?? '',
        notes: department?.notes ?? '',
      })
    }
  }, [open, department, form])

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
