'use server'

/**
 * users.ts — Server Actions for User lifecycle management.
 *
 * Pattern: verifySession -> validate -> mutate (two-phase atomic for create/delete) -> writeAuditLog -> revalidate
 *
 * Two clients in use:
 *   - createAdminClient()  — for auth.admin.* operations (service_role key)
 *   - createClient()       — for public.users and user_permissions (RLS-enforced)
 *
 * CRITICAL: createAdminClient() must NEVER be used for public table operations
 * as it bypasses Row Level Security.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession, requirePermission } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult = { success: boolean; error?: Record<string, string[]> }
type SimpleResult = { success: boolean; error?: string }

// ---------------------------------------------------------------------------
// createUser
// ---------------------------------------------------------------------------

/**
 * createUser — Two-phase atomic user creation.
 *
 * Phase 1: Create Supabase Auth account via auth.admin.createUser (service role).
 * Phase 2: Insert into public.users linking the auth account to an employee.
 *
 * If Phase 2 fails, Phase 1 is rolled back (auth user hard-deleted) to prevent
 * orphaned auth accounts.
 *
 * Optional: if template_id is provided in formData, assignTemplate is called
 * after successful user creation to pre-populate permissions.
 */
export async function createUser(
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await verifySession()
  await requirePermission('users', 2)
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Extract form values
  const employee_id = formData.get('employee_id') as string | null
  const email = formData.get('email') as string | null
  const password = formData.get('password') as string | null
  const template_id = formData.get('template_id') as string | null

  // Manual validation (no Zod schema needed — simple checks)
  const errors: Record<string, string[]> = {}
  if (!employee_id) errors.employee_id = ['נא לבחור עובד']
  if (!email || !email.includes('@')) errors.email = ['כתובת מייל לא תקינה']
  if (!password || password.length < 6) errors.password = ['סיסמה חייבת להכיל לפחות 6 תווים']
  if (Object.keys(errors).length > 0) return { success: false, error: errors }

  // ---------------------------------------------------------------------------
  // Phase 1: Create Supabase Auth account
  // ---------------------------------------------------------------------------
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email!,
    password: password!,
    email_confirm: true, // Skip email verification — admin-created accounts are pre-confirmed
  })

  if (authError) {
    // Common: duplicate email — surface to user
    return { success: false, error: { email: [authError.message] } }
  }

  const authUserId = authData.user.id

  // ---------------------------------------------------------------------------
  // Phase 2: Insert into public.users
  // ---------------------------------------------------------------------------
  const { data: newUser, error: dbError } = await supabase
    .from('users')
    .insert({
      auth_user_id: authUserId,
      employee_id: employee_id!,
      is_blocked: false,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (dbError) {
    // ROLLBACK: hard-delete the auth account we just created to prevent orphans
    await adminClient.auth.admin.deleteUser(authUserId)
    console.error('[createUser] DB insert failed, rolled back auth user:', dbError.message)
    return { success: false, error: { _form: [dbError.message] } }
  }

  // ---------------------------------------------------------------------------
  // Optional: assign template if provided
  // ---------------------------------------------------------------------------
  if (template_id && newUser) {
    await assignTemplateInternal(newUser.id, template_id, session.userId)
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'users',
    entityId: newUser!.id,
    oldData: null,
    newData: { auth_user_id: authUserId, employee_id: employee_id!, is_blocked: false },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateUser
// ---------------------------------------------------------------------------

/**
 * updateUser — Update public.users metadata (notes, etc.).
 * The only field editable post-creation is notes.
 * Re-linking to a different employee is intentionally not supported
 * to preserve audit integrity — delete and recreate instead.
 */
export async function updateUser(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await verifySession()
  await requirePermission('users', 2)
  const supabase = await createClient()

  const notes = formData.get('notes') as string | null

  const { data: oldData } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('users')
    .update({
      notes: notes || null,
      updated_by: session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: { _form: [error.message] } }
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'users',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// softDeleteUser
// ---------------------------------------------------------------------------

/**
 * softDeleteUser — Two-phase deletion.
 *
 * Phase 1: Soft-delete public.users (sets deleted_at) — preserves data for audit.
 * Phase 2: Hard-delete auth.users via admin API — frees the email for reuse.
 *
 * After soft-delete, the auth account is gone; the email can be re-registered.
 * The public.users row remains for historical audit trail.
 */
export async function softDeleteUser(id: string): Promise<SimpleResult> {
  const session = await verifySession()
  await requirePermission('users', 2)
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Fetch user record to get auth_user_id
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('auth_user_id')
    .eq('id', id)
    .single()

  if (fetchError || !user) {
    return { success: false, error: 'יוזר לא נמצא' }
  }

  // Phase 1: Soft-delete public.users
  const { error: softDeleteError } = await supabase
    .from('users')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: session.userId,
    })
    .eq('id', id)

  if (softDeleteError) {
    return { success: false, error: softDeleteError.message }
  }

  // Phase 2: Hard-delete auth.users to free the email
  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.auth_user_id)

  if (authDeleteError) {
    // The soft-delete succeeded — log warning but don't fail.
    // The auth account is orphaned but the user is effectively disabled.
    console.warn('[softDeleteUser] Failed to hard-delete auth user:', authDeleteError.message, {
      userId: id,
      authUserId: user.auth_user_id,
    })
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'DELETE',
    entityType: 'users',
    entityId: id,
    oldData: { auth_user_id: user.auth_user_id },
    newData: null,
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// blockUser
// ---------------------------------------------------------------------------

/**
 * blockUser — Block a user login via Supabase Auth ban_duration.
 *
 * Sets ban_duration to 87600h (10 years — effectively permanent).
 * Also sets is_blocked=true in public.users for UI display.
 *
 * The user will be immediately signed out on next token refresh attempt.
 */
export async function blockUser(id: string): Promise<SimpleResult> {
  const session = await verifySession()
  await requirePermission('users', 2)
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('auth_user_id')
    .eq('id', id)
    .single()

  if (fetchError || !user) {
    return { success: false, error: 'יוזר לא נמצא' }
  }

  // Block in Supabase Auth (prevents login + invalidates sessions)
  const { error: authError } = await adminClient.auth.admin.updateUserById(user.auth_user_id, {
    ban_duration: '87600h', // 10 years — effectively permanent block
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  // Update public.users is_blocked flag for UI
  const { error: dbError } = await supabase
    .from('users')
    .update({
      is_blocked: true,
      updated_by: session.userId,
    })
    .eq('id', id)

  if (dbError) {
    console.warn('[blockUser] DB update failed after auth block:', dbError.message)
    // Auth block succeeded — the user is effectively blocked. DB flag is cosmetic.
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'users',
    entityId: id,
    oldData: { is_blocked: false },
    newData: { is_blocked: true, ban_duration: '87600h' },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// unblockUser
// ---------------------------------------------------------------------------

/**
 * unblockUser — Remove the auth ban and re-enable the user.
 */
export async function unblockUser(id: string): Promise<SimpleResult> {
  const session = await verifySession()
  await requirePermission('users', 2)
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('auth_user_id')
    .eq('id', id)
    .single()

  if (fetchError || !user) {
    return { success: false, error: 'יוזר לא נמצא' }
  }

  // Remove ban in Supabase Auth
  const { error: authError } = await adminClient.auth.admin.updateUserById(user.auth_user_id, {
    ban_duration: 'none',
  })

  if (authError) {
    return { success: false, error: authError.message }
  }

  // Update public.users is_blocked flag
  const { error: dbError } = await supabase
    .from('users')
    .update({
      is_blocked: false,
      updated_by: session.userId,
    })
    .eq('id', id)

  if (dbError) {
    console.warn('[unblockUser] DB update failed after auth unblock:', dbError.message)
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'users',
    entityId: id,
    oldData: { is_blocked: true },
    newData: { is_blocked: false, ban_duration: 'none' },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// assignTemplate (exported)
// ---------------------------------------------------------------------------

/**
 * assignTemplate — Apply a role template's permissions to a user.
 *
 * Deletes all non-override user_permissions for this user, then inserts
 * the template's permissions as non-override rows.
 *
 * Override permissions (is_override=true) are preserved — they represent
 * deliberate admin customizations that should survive template changes.
 */
export async function assignTemplate(
  userId: string,
  templateId: string
): Promise<SimpleResult> {
  const session = await verifySession()
  await requirePermission('users', 2)
  return assignTemplateInternal(userId, templateId, session.userId)
}

// ---------------------------------------------------------------------------
// assignTemplateInternal (shared by createUser + assignTemplate)
// ---------------------------------------------------------------------------

async function assignTemplateInternal(
  userId: string,
  templateId: string,
  actingUserId: string
): Promise<SimpleResult> {
  const supabase = await createClient()

  // Fetch template permissions
  const { data: templatePerms, error: fetchError } = await supabase
    .from('template_permissions')
    .select('module_key, level')
    .eq('template_id', templateId)

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  // Delete all non-override user permissions (template-sourced rows)
  const { error: deleteError } = await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('is_override', false)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  // Insert template permissions as non-override rows
  if (templatePerms && templatePerms.length > 0) {
    const rows = templatePerms.map((p) => ({
      user_id: userId,
      module_key: p.module_key,
      level: p.level,
      template_id: templateId,
      is_override: false,
    }))

    const { error: insertError } = await supabase.from('user_permissions').insert(rows)

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  await writeAuditLog({
    userId: actingUserId,
    action: 'UPDATE',
    entityType: 'users',
    entityId: userId,
    oldData: null,
    newData: { assigned_template_id: templateId, permission_count: templatePerms?.length ?? 0 },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// saveUserPermissions
// ---------------------------------------------------------------------------

/**
 * saveUserPermissions — Save manual per-user permission overrides.
 *
 * Reads perm_{module_key} values from formData (same pattern as
 * PermissionMatrixEditor in Plan 03-01). Each permission is upserted with
 * is_override=true and template_id=null, so it takes precedence over any
 * template-assigned permissions.
 *
 * Conflict resolution: on_conflict('user_id,module_key') — update level and
 * is_override for existing rows.
 */
export async function saveUserPermissions(
  userId: string,
  formData: FormData
): Promise<SimpleResult> {
  const session = await verifySession()
  await requirePermission('users', 2)
  const supabase = await createClient()

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

  // Build upsert rows from formData
  const rows = MODULE_KEYS.map((key) => {
    const raw = formData.get(`perm_${key}`)
    const level = raw !== null ? parseInt(String(raw), 10) : 0
    return {
      user_id: userId,
      module_key: key,
      level: isNaN(level) ? 0 : level,
      is_override: true,
      template_id: null as string | null,
    }
  })

  const { error } = await supabase
    .from('user_permissions')
    .upsert(rows, { onConflict: 'user_id,module_key' })

  if (error) {
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'users',
    entityId: userId,
    oldData: null,
    newData: { override_permissions_saved: rows.length },
  })

  revalidatePath('/admin/users')
  return { success: true }
}
