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
import { verifySession } from '@/lib/dal'
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

  // ---------------------------------------------------------------------------
  // ChemoSys module access (app_fleet / app_equipment checkboxes)
  // ---------------------------------------------------------------------------
  const appFleet = formData.get('app_fleet') === '1'
  const appEquipment = formData.get('app_equipment') === '1'
  const appRows: Array<{ user_id: string; module_key: string; level: number; is_override: boolean; template_id: null }> = []
  if (appFleet) appRows.push({ user_id: newUser!.id, module_key: 'app_fleet', level: 1, is_override: true, template_id: null })
  if (appEquipment) appRows.push({ user_id: newUser!.id, module_key: 'app_equipment', level: 1, is_override: true, template_id: null })
  if (appRows.length > 0) {
    // Uses adminClient — permission writes are admin-only (00013 RLS policy)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: permError } = await (adminClient.from('user_permissions') as any).upsert(appRows, { onConflict: 'user_id,module_key' })
    if (permError) console.error('[createUser] permission upsert failed:', permError.message)
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'users',
    entityId: newUser!.id,
    oldData: null,
    newData: { auth_user_id: authUserId, employee_id: employee_id!, is_blocked: false, app_fleet: appFleet, app_equipment: appEquipment },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateUserAuth — Update auth email and/or password + ChemoSys permissions
// ---------------------------------------------------------------------------

/**
 * updateUserAuth — Updates auth credentials (email, password) via admin API
 * and ChemoSys module permissions (app_fleet, app_equipment).
 *
 * Uses adminClient for auth.admin.updateUserById (service_role).
 * Uses RLS client for user_permissions upsert.
 */
export async function updateUserAuth(
  userId: string,
  formData: FormData
): Promise<SimpleResult> {
  const session = await verifySession()
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Fetch user to get auth_user_id
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('auth_user_id')
    .eq('id', userId)
    .single()

  if (fetchError || !user) {
    return { success: false, error: 'יוזר לא נמצא' }
  }

  // Build auth update payload (only non-empty fields)
  const newEmail = (formData.get('email') as string)?.trim()
  const newPassword = (formData.get('password') as string)?.trim()

  const authUpdate: Record<string, unknown> = {}
  if (newEmail) authUpdate.email = newEmail
  if (newPassword && newPassword.length >= 6) authUpdate.password = newPassword

  // Validate email format
  if (newEmail && !newEmail.includes('@')) {
    return { success: false, error: 'כתובת מייל לא תקינה' }
  }
  if (newPassword && newPassword.length > 0 && newPassword.length < 6) {
    return { success: false, error: 'סיסמה חייבת להכיל לפחות 6 תווים' }
  }

  // Update auth if there are changes
  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      user.auth_user_id,
      authUpdate
    )
    if (authError) {
      return { success: false, error: authError.message }
    }
  }

  // Update ChemoSys module permissions
  // Uses adminClient to bypass RLS — permission writes are admin-only (00013 policy)
  // and we already verified the caller is admin via verifySession().
  const appFleet = formData.get('app_fleet') === '1'
  const appEquipment = formData.get('app_equipment') === '1'
  const appRows = [
    { user_id: userId, module_key: 'app_fleet', level: appFleet ? 1 : 0, is_override: true, template_id: null },
    { user_id: userId, module_key: 'app_equipment', level: appEquipment ? 1 : 0, is_override: true, template_id: null },
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: permError } = await (adminClient.from('user_permissions') as any).upsert(appRows, { onConflict: 'user_id,module_key' })
  if (permError) {
    console.error('[updateUserAuth] permission upsert failed:', permError.message)
    return { success: false, error: 'שגיאה בעדכון הרשאות: ' + permError.message }
  }

  // Mark updated_by
  await supabase.from('users').update({ updated_by: session.userId }).eq('id', userId)

  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'users',
    entityId: userId,
    oldData: null,
    newData: {
      email_changed: !!newEmail,
      password_changed: !!newPassword,
      app_fleet: appFleet,
      app_equipment: appEquipment,
    },
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
  const adminClient = createAdminClient()

  // Fetch template permissions (read — RLS allows SELECT for authenticated)
  const { data: templatePerms, error: fetchError } = await supabase
    .from('template_permissions')
    .select('module_key, level')
    .eq('template_id', templateId)

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  // Delete all non-override user permissions (template-sourced rows)
  // Uses adminClient — permission writes are admin-only (00013 RLS policy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (adminClient.from('user_permissions') as any)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (adminClient.from('user_permissions') as any).insert(rows)

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
  const supabase = await createClient()
  const adminClient = createAdminClient()

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

  // Build upsert rows from formData (admin modules)
  const rows: Array<{ user_id: string; module_key: string; level: number; is_override: boolean; template_id: string | null }> = MODULE_KEYS.map((key) => {
    const raw = formData.get(`perm_${key}`)
    const level = raw !== null ? parseInt(String(raw), 10) : 0
    return {
      user_id: userId,
      module_key: key,
      level: isNaN(level) ? 0 : level,
      is_override: true,
      template_id: null,
    }
  })

  // ChemoSys module access (checkboxes → level 1 if checked, 0 if unchecked)
  const APP_MODULES = ['app_fleet', 'app_equipment'] as const
  for (const appKey of APP_MODULES) {
    rows.push({
      user_id: userId,
      module_key: appKey,
      level: formData.get(appKey) === '1' ? 1 : 0,
      is_override: true,
      template_id: null,
    })
  }

  // Uses adminClient — permission writes are admin-only (00013 RLS policy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient.from('user_permissions') as any)
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
