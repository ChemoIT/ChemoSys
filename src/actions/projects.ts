'use server'

/**
 * projects.ts — Server Actions for Project CRUD.
 *
 * Pattern: verifySession -> validate with Zod -> mutate DB -> writeAuditLog -> revalidate
 *
 * Every action requires an authenticated session.
 * Every mutation writes an immutable audit log entry.
 * Soft-delete uses SECURITY DEFINER RPC (never direct UPDATE on deleted_at).
 * project_number is auto-generated via generate_project_number() RPC on create.
 * project_number is IMMUTABLE — never passed in updateProject payload.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { ProjectSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert empty string FK to null — avoids foreign key constraint violation */
function fkOrNull(value: string | undefined | null): string | null {
  return value && value !== '' ? value : null
}

/** Convert empty string coordinate to null, otherwise parse as float */
function coordOrNull(value: string | undefined | null): number | null {
  if (!value || value === '') return null
  const n = parseFloat(value)
  return isNaN(n) ? null : n
}

/** Convert empty string project_type to null */
function projectTypeOrNull(
  value: string | undefined | null
): 'project' | 'staging_area' | 'storage_area' | null {
  if (!value || value === '') return null
  return value as 'project' | 'staging_area' | 'storage_area'
}

// ---------------------------------------------------------------------------
// createProject
// ---------------------------------------------------------------------------

export async function createProject(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Validate form data
  const parsed = ProjectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Auto-generate project number via DB function
  const { data: projectNumber, error: seqError } = await supabase.rpc(
    'generate_project_number'
  )
  if (seqError || !projectNumber) {
    return {
      success: false,
      error: { _form: ['שגיאה ביצירת מספר פרויקט. נסה שוב.'] },
    }
  }

  // Insert into DB
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name:                        input.name,
      display_name:                input.display_name || null,
      project_number:              projectNumber as string,
      expense_number:              input.expense_number || null,
      general_number:              input.general_number || null,
      description:                 input.description || null,
      project_code:                input.project_code || null,
      attendance_code:             input.attendance_code || null,
      has_attendance_code:         input.has_attendance_code,
      project_type:                projectTypeOrNull(input.project_type as string),
      ignore_auto_equipment:       input.ignore_auto_equipment,
      supervision:                 input.supervision || null,
      client:                      input.client || null,
      status:                      input.status,
      project_manager_id:          fkOrNull(input.project_manager_id),
      pm_email:                    input.pm_email || null,
      pm_phone:                    input.pm_phone || null,
      pm_notifications:            input.pm_notifications,
      site_manager_id:             fkOrNull(input.site_manager_id),
      sm_email:                    input.sm_email || null,
      sm_phone:                    input.sm_phone || null,
      sm_notifications:            input.sm_notifications,
      camp_vehicle_coordinator_id: fkOrNull(input.camp_vehicle_coordinator_id),
      cvc_phone:                   input.cvc_phone || null,
      latitude:                    coordOrNull(input.latitude as string),
      longitude:                   coordOrNull(input.longitude as string),
      created_by:                  session.userId,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation (project_number collision — extremely unlikely but safe)
    if (error.code === '23505') {
      return {
        success: false,
        error: { _form: ['מספר הפרויקט שנוצר כבר קיים. נסה שוב.'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Write audit log (fire-and-forget)
  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'projects',
    entityId: data.id,
    oldData: null,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/projects')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateProject
// ---------------------------------------------------------------------------

export async function updateProject(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Validate form data
  const parsed = ProjectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Fetch old data for audit log before mutating
  const { data: oldData } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  // Update — project_number is immutable, never included
  const { data, error } = await supabase
    .from('projects')
    .update({
      name:                        input.name,
      display_name:                input.display_name || null,
      expense_number:              input.expense_number || null,
      general_number:              input.general_number || null,
      description:                 input.description || null,
      project_code:                input.project_code || null,
      attendance_code:             input.attendance_code || null,
      has_attendance_code:         input.has_attendance_code,
      project_type:                projectTypeOrNull(input.project_type as string),
      ignore_auto_equipment:       input.ignore_auto_equipment,
      supervision:                 input.supervision || null,
      client:                      input.client || null,
      status:                      input.status,
      project_manager_id:          fkOrNull(input.project_manager_id),
      pm_email:                    input.pm_email || null,
      pm_phone:                    input.pm_phone || null,
      pm_notifications:            input.pm_notifications,
      site_manager_id:             fkOrNull(input.site_manager_id),
      sm_email:                    input.sm_email || null,
      sm_phone:                    input.sm_phone || null,
      sm_notifications:            input.sm_notifications,
      camp_vehicle_coordinator_id: fkOrNull(input.camp_vehicle_coordinator_id),
      cvc_phone:                   input.cvc_phone || null,
      latitude:                    coordOrNull(input.latitude as string),
      longitude:                   coordOrNull(input.longitude as string),
      updated_by:                  session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: { _form: [error.message] } }
  }

  // Write audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'projects',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/projects')
  return { success: true }
}

// ---------------------------------------------------------------------------
// softDeleteProject
// ---------------------------------------------------------------------------

export async function softDeleteProject(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Fetch old data for audit log before mutating
  const { data: oldData } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  // MUST use RPC — direct UPDATE on deleted_at is blocked by RLS (see 00007 pattern)
  const { error } = await supabase.rpc('soft_delete_project', { p_id: id })

  if (error) {
    return { success: false, error: error.message }
  }

  // Write audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'DELETE',
    entityType: 'projects',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: null,
  })

  revalidatePath('/admin/projects')
  return { success: true }
}
