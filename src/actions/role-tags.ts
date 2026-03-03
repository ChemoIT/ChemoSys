'use server'

/**
 * role-tags.ts — Server Actions for Role Tag CRUD.
 *
 * Pattern: verifySession -> validate with Zod -> mutate DB -> writeAuditLog -> revalidate
 *
 * Role tags are the simplest entity — no foreign keys, just name/description/notes.
 * Unique constraint: name WHERE deleted_at IS NULL.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { RoleTagSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// createRoleTag
// ---------------------------------------------------------------------------

export async function createRoleTag(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Validate form data
  const parsed = RoleTagSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Insert into DB
  const { data, error } = await supabase
    .from('role_tags')
    .insert({
      name: input.name,
      description: input.description || null,
      notes: input.notes || null,
      created_by: session.userId,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation on name
    if (error.code === '23505') {
      return {
        success: false,
        error: { name: ['שם תגית כבר קיים'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Write audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'role_tags',
    entityId: data.id,
    oldData: null,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/role-tags')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateRoleTag
// ---------------------------------------------------------------------------

export async function updateRoleTag(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Validate form data
  const parsed = RoleTagSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Fetch old data for audit log before mutating
  const { data: oldData } = await supabase
    .from('role_tags')
    .select('*')
    .eq('id', id)
    .single()

  // Update record
  const { data, error } = await supabase
    .from('role_tags')
    .update({
      name: input.name,
      description: input.description || null,
      notes: input.notes || null,
      updated_by: session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // Unique constraint violation on name
    if (error.code === '23505') {
      return {
        success: false,
        error: { name: ['שם תגית כבר קיים'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Write audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'role_tags',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/role-tags')
  return { success: true }
}

// ---------------------------------------------------------------------------
// softDeleteRoleTag
// ---------------------------------------------------------------------------

export async function softDeleteRoleTag(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Fetch old data for audit log
  const { data: oldData } = await supabase
    .from('role_tags')
    .select('*')
    .eq('id', id)
    .single()

  // Soft-delete: set deleted_at timestamp
  const { error } = await supabase
    .from('role_tags')
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
    entityType: 'role_tags',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: null,
  })

  revalidatePath('/admin/role-tags')
  return { success: true }
}
