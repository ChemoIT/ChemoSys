'use client'

/**
 * CompanyForm — create/edit dialog for a Company record.
 *
 * Uses React Hook Form + Zod resolver for client-side validation.
 * Binds to Server Actions (createCompany / updateCompany) via useActionState.
 * Shows field-level errors returned from server in Hebrew.
 *
 * Props:
 *   open        — dialog visibility
 *   onOpenChange — toggle handler
 *   company     — populated for edit mode, undefined for create mode
 */

import * as React from 'react'
import { useActionState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import type { Company } from '@/types/entities'
import { CompanySchema, type CompanyInput } from '@/lib/schemas'
import { createCompany, updateCompany } from '@/actions/companies'
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

interface CompanyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company?: Company
}

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
} | null

export function CompanyForm({ open, onOpenChange, company }: CompanyFormProps) {
  const isEdit = !!company

  // Bind the appropriate server action (create vs update)
  const boundAction = isEdit
    ? updateCompany.bind(null, company.id)
    : createCompany

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    boundAction as (
      prevState: ActionState,
      formData: FormData
    ) => Promise<ActionState>,
    null
  )

  const form = useForm<CompanyInput>({
    resolver: zodResolver(CompanySchema),
    defaultValues: {
      name: company?.name ?? '',
      internal_number: company?.internal_number ?? '',
      company_reg_number: company?.company_reg_number ?? '',
      contact_name: company?.contact_name ?? '',
      contact_email: company?.contact_email ?? '',
      notes: company?.notes ?? '',
    },
  })

  // Reset form when dialog opens/closes or company changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: company?.name ?? '',
        internal_number: company?.internal_number ?? '',
        company_reg_number: company?.company_reg_number ?? '',
        contact_name: company?.contact_name ?? '',
        contact_email: company?.contact_email ?? '',
        notes: company?.notes ?? '',
      })
    }
  }, [open, company, form])

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
          form.setError(field as keyof CompanyInput, {
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
          <DialogTitle>{isEdit ? 'עריכת חברה' : 'הוספת חברה חדשה'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form action={formAction} className="space-y-4">
            {/* name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם חברה *</FormLabel>
                  <FormControl>
                    <Input placeholder="שם החברה" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* internal_number */}
            <FormField
              control={form.control}
              name="internal_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מספר חברה פנימי *</FormLabel>
                  <FormControl>
                    <Input placeholder="מספר פנימי ייחודי" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* company_reg_number */}
            <FormField
              control={form.control}
              name="company_reg_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מספר ח.פ.</FormLabel>
                  <FormControl>
                    <Input placeholder="מספר חברה (ח.פ.)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* contact_name */}
            <FormField
              control={form.control}
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם אחראי</FormLabel>
                  <FormControl>
                    <Input placeholder="שם איש הקשר" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* contact_email */}
            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מייל אחראי</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="example@company.com"
                      {...field}
                    />
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

            {/* Server-level error (non-field) */}
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
                  'הוסף חברה'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
