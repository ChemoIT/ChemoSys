'use server'

/**
 * companies.ts — Server Actions for Company CRUD.
 *
 * Pattern: verifySession -> validate with Zod -> mutate DB -> writeAuditLog -> revalidate
 *
 * Every action requires an authenticated session.
 * Every mutation writes an immutable audit log entry.
 * Soft-delete sets deleted_at — never hard-deletes.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { CompanySchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// createCompany
// ---------------------------------------------------------------------------

export async function createCompany(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Validate form data
  const parsed = CompanySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Insert into DB
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: input.name,
      internal_number: input.internal_number,
      company_reg_number: input.company_reg_number || null,
      contact_name: input.contact_name || null,
      contact_email: input.contact_email || null,
      notes: input.notes || null,
      created_by: session.userId,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation on internal_number
    if (error.code === '23505') {
      return {
        success: false,
        error: { internal_number: ['מספר חברה כבר קיים'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Write audit log (fire-and-forget — never blocks)
  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'companies',
    entityId: data.id,
    oldData: null,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/companies')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateCompany
// ---------------------------------------------------------------------------

export async function updateCompany(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Validate form data
  const parsed = CompanySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Fetch old data for audit log before mutating
  const { data: oldData } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  // Update record
  const { data, error } = await supabase
    .from('companies')
    .update({
      name: input.name,
      internal_number: input.internal_number,
      company_reg_number: input.company_reg_number || null,
      contact_name: input.contact_name || null,
      contact_email: input.contact_email || null,
      notes: input.notes || null,
      updated_by: session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // Unique constraint violation on internal_number
    if (error.code === '23505') {
      return {
        success: false,
        error: { internal_number: ['מספר חברה כבר קיים'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Write audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'companies',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/companies')
  return { success: true }
}

// ---------------------------------------------------------------------------
// softDeleteCompany
// ---------------------------------------------------------------------------

export async function softDeleteCompany(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Fetch old data for audit log
  const { data: oldData } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  // Soft-delete: set deleted_at timestamp
  const { error } = await supabase
    .from('companies')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: session.userId,
    })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Write audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'DELETE',
    entityType: 'companies',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: null,
  })

  revalidatePath('/admin/companies')
  return { success: true }
}
