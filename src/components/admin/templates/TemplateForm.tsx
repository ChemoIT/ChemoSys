'use client'

/**
 * TemplateForm — create/edit dialog for a Role Template record.
 *
 * Uses React Hook Form + Zod resolver for client-side validation.
 * Binds to Server Actions (createTemplate / updateTemplate) via useActionState.
 *
 * Dialog sections:
 *   1. פרטי תבנית — name + description
 *   2. מטריצת הרשאות — embedded PermissionMatrixEditor (9 modules × 3 levels)
 *
 * The PermissionMatrixEditor's native radio inputs are inside the <form>
 * element, so they automatically write to FormData on submit.
 *
 * Props:
 *   open        — dialog visibility
 *   onOpenChange — toggle handler
 *   template    — populated for edit mode, undefined for create mode
 */

import * as React from 'react'
import { useActionState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { RoleTemplate, TemplatePermission } from '@/types/entities'
import { TemplateSchema, type TemplateInput } from '@/lib/schemas'
import { createTemplate, updateTemplate } from '@/actions/templates'
import { PermissionMatrixEditor } from '@/components/admin/templates/PermissionMatrixEditor'
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateWithPermissions = RoleTemplate & {
  template_permissions?: Pick<TemplatePermission, 'module_key' | 'level'>[]
}

interface TemplateFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: TemplateWithPermissions
}

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
} | null

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateForm({ open, onOpenChange, template }: TemplateFormProps) {
  const isEdit = !!template

  // Bind the appropriate server action (create vs update)
  const boundAction = isEdit
    ? updateTemplate.bind(null, template.id)
    : createTemplate

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    boundAction as (
      prevState: ActionState,
      formData: FormData
    ) => Promise<ActionState>,
    null
  )

  const form = useForm<TemplateInput>({
    resolver: zodResolver(TemplateSchema as any),
    defaultValues: {
      name: template?.name ?? '',
      description: template?.description ?? '',
    },
  })

  // Reset form when dialog opens/closes or template changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: template?.name ?? '',
        description: template?.description ?? '',
      })
    }
  }, [open, template, form])

  // Close dialog and show toast on success
  useEffect(() => {
    if (state?.success) {
      toast.success(isEdit ? 'התבנית עודכנה בהצלחה' : 'התבנית נוצרה בהצלחה')
      onOpenChange(false)
    }
  }, [state, onOpenChange, isEdit])

  // Apply server-side field errors to React Hook Form
  useEffect(() => {
    if (state?.error) {
      Object.entries(state.error).forEach(([field, messages]) => {
        if (field !== '_form' && messages?.length) {
          form.setError(field as keyof TemplateInput, {
            message: messages[0],
          })
        }
      })
    }
  }, [state, form])

  // Build initialPermissions map for PermissionMatrixEditor (edit mode)
  const initialPermissions: Record<string, number> =
    template?.template_permissions?.reduce(
      (acc, p) => ({ ...acc, [p.module_key]: p.level }),
      {} as Record<string, number>
    ) ?? {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'עריכת תבנית הרשאות' : 'הוספת תבנית הרשאות חדשה'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form action={formAction} className="space-y-6">
            {/* ── Section 1: Template Details ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
                פרטי תבנית
              </h3>

              {/* name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם תבנית *</FormLabel>
                    <FormControl>
                      <Input placeholder="שם התבנית" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        placeholder="תיאור קצר של התבנית ואיזה תפקיד היא מייצגת..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Section 2: Permission Matrix ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
                מטריצת הרשאות
              </h3>

              <PermissionMatrixEditor initialPermissions={initialPermissions} />
            </div>

            {/* Server-level error (non-field) */}
            {state?.error?._form && (
              <p className="text-sm text-destructive">{state.error._form[0]}</p>
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
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                    שומר...
                  </>
                ) : isEdit ? (
                  'שמור שינויים'
                ) : (
                  'צור תבנית'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
