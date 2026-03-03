'use server'

/**
 * templates.ts — Server Actions for Role Template CRUD.
 *
 * Pattern: verifySession -> validate with Zod -> mutate DB -> manage template_permissions
 *          -> writeAuditLog -> revalidate
 *
 * Permission matrix uses a delete-all + insert pattern:
 * On every create/update, existing template_permissions rows are deleted
 * and replaced with the new set. Only levels > 0 are stored (absence = no access).
 *
 * Every action requires an authenticated session.
 * Soft-delete preserves template_permissions rows for audit history.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession, requirePermission } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { TemplateSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// Module keys — the 9 system modules (matches modules table seed)
// ---------------------------------------------------------------------------
const MODULE_KEYS = [
  'dashboard',
  'companies',
  'departments',
  'role_tags',
  'employees',
  'users',
  'templates',
  'projects',
  'settings',
] as const

type ModuleKey = (typeof MODULE_KEYS)[number]

type PermissionRow = {
  module_key: ModuleKey
  level: 0 | 1 | 2
}

/**
 * extractPermissions — reads perm_{module_key} fields from FormData
 * and returns a typed array of module+level pairs.
 */
function extractPermissions(formData: FormData): PermissionRow[] {
  return MODULE_KEYS.map((key) => ({
    module_key: key,
    level: (parseInt(
      (formData.get(`perm_${key}`) as string) || '0',
      10
    ) as 0 | 1 | 2),
  }))
}

// ---------------------------------------------------------------------------
// createTemplate
// ---------------------------------------------------------------------------

export async function createTemplate(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  await requirePermission('templates', 2)
  const supabase = await createClient()

  // Validate template metadata fields
  const parsed = TemplateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Insert role_template row
  const { data, error } = await supabase
    .from('role_templates')
    .insert({
      name: input.name,
      description: input.description || null,
      created_by: session.userId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        error: { name: ['שם תבנית כבר קיים'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  const templateId = data.id

  // Extract and persist permission matrix
  const permissions = extractPermissions(formData)
  const permRows = permissions
    .filter((p) => p.level > 0)
    .map((p) => ({ template_id: templateId, module_key: p.module_key, level: p.level }))

  if (permRows.length > 0) {
    const { error: permError } = await supabase
      .from('template_permissions')
      .insert(permRows)
    if (permError) {
      console.error('[createTemplate] Failed to insert permissions:', permError.message)
    }
  }

  // Write audit log (fire-and-forget)
  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'role_templates',
    entityId: templateId,
    oldData: null,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/templates')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateTemplate
// ---------------------------------------------------------------------------

export async function updateTemplate(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  await requirePermission('templates', 2)
  const supabase = await createClient()

  // Validate template metadata fields
  const parsed = TemplateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Fetch old data for audit log before mutating
  const { data: oldData } = await supabase
    .from('role_templates')
    .select('*')
    .eq('id', id)
    .single()

  // Update role_template row
  const { data, error } = await supabase
    .from('role_templates')
    .update({
      name: input.name,
      description: input.description || null,
      updated_by: session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        error: { name: ['שם תבנית כבר קיים'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Replace all template_permissions — delete-all + insert pattern
  const { error: deleteError } = await supabase
    .from('template_permissions')
    .delete()
    .eq('template_id', id)

  if (deleteError) {
    console.error('[updateTemplate] Failed to delete old permissions:', deleteError.message)
  }

  const permissions = extractPermissions(formData)
  const permRows = permissions
    .filter((p) => p.level > 0)
    .map((p) => ({ template_id: id, module_key: p.module_key, level: p.level }))

  if (permRows.length > 0) {
    const { error: permError } = await supabase
      .from('template_permissions')
      .insert(permRows)
    if (permError) {
      console.error('[updateTemplate] Failed to insert new permissions:', permError.message)
    }
  }

  // Write audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'role_templates',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/templates')
  return { success: true }
}

// ---------------------------------------------------------------------------
// softDeleteTemplate
// ---------------------------------------------------------------------------

export async function softDeleteTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  await requirePermission('templates', 2)
  const supabase = await createClient()

  // Fetch old data for audit log
  const { data: oldData } = await supabase
    .from('role_templates')
    .select('*')
    .eq('id', id)
    .single()

  // Soft-delete: set deleted_at timestamp
  // template_permissions rows are NOT deleted — soft-delete preserves history
  const { error } = await supabase
    .from('role_templates')
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
    entityType: 'role_templates',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: null,
  })

  revalidatePath('/admin/templates')
  return { success: true }
}
