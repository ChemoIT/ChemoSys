'use client'

/**
 * RoleTagForm — create/edit dialog for a RoleTag record.
 *
 * Simplest of the three forms — no foreign key dropdowns.
 * Fields: name (שם תגית), description (תיאור), notes (הערות)
 *
 * Uses React Hook Form + Zod resolver + useActionState Server Action binding.
 */

import * as React from 'react'
import { useActionState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import type { RoleTag } from '@/types/entities'
import { RoleTagSchema, type RoleTagInput } from '@/lib/schemas'
import { createRoleTag, updateRoleTag } from '@/actions/role-tags'
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

interface RoleTagFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleTag?: RoleTag
}

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
} | null

export function RoleTagForm({ open, onOpenChange, roleTag }: RoleTagFormProps) {
  const isEdit = !!roleTag

  const boundAction = isEdit
    ? updateRoleTag.bind(null, roleTag.id)
    : createRoleTag

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    boundAction as (
      prevState: ActionState,
      formData: FormData
    ) => Promise<ActionState>,
    null
  )

  const form = useForm<RoleTagInput>({
    resolver: zodResolver(RoleTagSchema),
    defaultValues: {
      name: roleTag?.name ?? '',
      description: roleTag?.description ?? '',
      notes: roleTag?.notes ?? '',
    },
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: roleTag?.name ?? '',
        description: roleTag?.description ?? '',
        notes: roleTag?.notes ?? '',
      })
    }
  }, [open, roleTag, form])

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
          form.setError(field as keyof RoleTagInput, {
            message: messages[0],
          })
        }
      })
    }
  }, [state, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'עריכת תגית תפקיד' : 'הוספת תגית תפקיד חדשה'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form action={formAction} className="space-y-4">
            {/* name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם תגית *</FormLabel>
                  <FormControl>
                    <Input placeholder="שם התגית" {...field} />
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
                    <Input placeholder="תיאור קצר של התגית" {...field} />
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
                  'הוסף תגית'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
