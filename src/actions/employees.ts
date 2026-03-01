'use server'

/**
 * employees.ts — Server Actions for Employee CRUD.
 *
 * Pattern: verifySession -> validate with Zod -> mutate DB -> writeAuditLog -> revalidate
 *
 * Key behaviours:
 *   - All optional empty-string fields are coerced to null before DB insert/update.
 *   - Role tags are managed via the employee_role_tags junction using replace-all
 *     pattern on update (delete all then re-insert).
 *   - Composite unique key violation (employee_number + company_id) returns
 *     a Hebrew field error on employee_number.
 *   - Soft-delete sets deleted_at — never hard-deletes.
 *   - Every mutation writes an immutable audit log entry (fire-and-forget).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { EmployeeSchema } from '@/lib/schemas'

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
} | null

// ---------------------------------------------------------------------------
// createEmployee
// ---------------------------------------------------------------------------

export async function createEmployee(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await verifySession()
  const supabase = await createClient()

  // Extract role_tag_ids before parsing (they're not in EmployeeSchema)
  const roleTagIds = formData.getAll('role_tag_ids') as string[]

  // Build raw data from FormData — omit role_tag_ids so Zod doesn't choke
  const rawData = Object.fromEntries(formData)
  delete rawData['role_tag_ids']

  // Validate
  const parsed = EmployeeSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const input = parsed.data

  // Insert employee record — empty strings converted to null for nullable TEXT
  const { data, error } = await supabase
    .from('employees')
    .insert({
      first_name:              input.first_name,
      last_name:               input.last_name,
      employee_number:         input.employee_number,
      company_id:              input.company_id,
      id_number:               input.id_number || null,
      gender:                  input.gender ?? null,
      street:                  input.street || null,
      house_number:            input.house_number || null,
      city:                    input.city || null,
      mobile_phone:            input.mobile_phone || null,
      additional_phone:        input.additional_phone || null,
      email:                   input.email || null,
      date_of_birth:           input.date_of_birth || null,
      start_date:              input.start_date || null,
      end_date:                input.end_date || null,
      status:                  input.status,
      department_id:           input.department_id || null,
      sub_department_id:       input.sub_department_id || null,
      passport_number:         input.passport_number || null,
      citizenship:             input.citizenship ?? null,
      correspondence_language: input.correspondence_language,
      profession:              input.profession || null,
      notes:                   input.notes || null,
      created_by:              session.userId,
    })
    .select()
    .single()

  if (error) {
    // Composite unique constraint violation: (employee_number, company_id) WHERE deleted_at IS NULL
    if (error.code === '23505') {
      return {
        success: false,
        error: { employee_number: ['מספר עובד כבר קיים בחברה זו'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Insert role tag associations (junction table)
  if (roleTagIds.length > 0) {
    const junctionRows = roleTagIds.map((tagId) => ({
      employee_id: data.id,
      role_tag_id: tagId,
    }))

    const { error: tagError } = await supabase
      .from('employee_role_tags')
      .insert(junctionRows)

    if (tagError) {
      console.error('[createEmployee] Failed to insert role tags:', tagError.message)
    }
  }

  // Write audit log (fire-and-forget)
  await writeAuditLog({
    userId:     session.userId,
    action:     'INSERT',
    entityType: 'employees',
    entityId:   data.id,
    oldData:    null,
    newData:    data as Record<string, unknown>,
  })

  revalidatePath('/admin/employees')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateEmployee
// ---------------------------------------------------------------------------

export async function updateEmployee(
  id: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await verifySession()
  const supabase = await createClient()

  // Extract role_tag_ids before parsing
  const roleTagIds = formData.getAll('role_tag_ids') as string[]

  // Build raw data — omit role_tag_ids
  const rawData = Object.fromEntries(formData)
  delete rawData['role_tag_ids']

  // Validate
  const parsed = EmployeeSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const input = parsed.data

  // Fetch old data for audit log
  const { data: oldData } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

  // Update employee record
  const { data, error } = await supabase
    .from('employees')
    .update({
      first_name:              input.first_name,
      last_name:               input.last_name,
      employee_number:         input.employee_number,
      company_id:              input.company_id,
      id_number:               input.id_number || null,
      gender:                  input.gender ?? null,
      street:                  input.street || null,
      house_number:            input.house_number || null,
      city:                    input.city || null,
      mobile_phone:            input.mobile_phone || null,
      additional_phone:        input.additional_phone || null,
      email:                   input.email || null,
      date_of_birth:           input.date_of_birth || null,
      start_date:              input.start_date || null,
      end_date:                input.end_date || null,
      status:                  input.status,
      department_id:           input.department_id || null,
      sub_department_id:       input.sub_department_id || null,
      passport_number:         input.passport_number || null,
      citizenship:             input.citizenship ?? null,
      correspondence_language: input.correspondence_language,
      profession:              input.profession || null,
      notes:                   input.notes || null,
      updated_by:              session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        error: { employee_number: ['מספר עובד כבר קיים בחברה זו'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Replace-all role tags: delete existing, then re-insert new set
  const { error: deleteTagError } = await supabase
    .from('employee_role_tags')
    .delete()
    .eq('employee_id', id)

  if (deleteTagError) {
    console.error('[updateEmployee] Failed to delete old role tags:', deleteTagError.message)
  }

  if (roleTagIds.length > 0) {
    const junctionRows = roleTagIds.map((tagId) => ({
      employee_id: id,
      role_tag_id: tagId,
    }))

    const { error: tagError } = await supabase
      .from('employee_role_tags')
      .insert(junctionRows)

    if (tagError) {
      console.error('[updateEmployee] Failed to insert role tags:', tagError.message)
    }
  }

  // Write audit log
  await writeAuditLog({
    userId:     session.userId,
    action:     'UPDATE',
    entityType: 'employees',
    entityId:   id,
    oldData:    oldData as Record<string, unknown>,
    newData:    data as Record<string, unknown>,
  })

  revalidatePath('/admin/employees')
  return { success: true }
}

// ---------------------------------------------------------------------------
// softDeleteEmployee
// ---------------------------------------------------------------------------

export async function softDeleteEmployee(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Fetch old data for audit log
  const { data: oldData } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

  // Soft-delete: set deleted_at timestamp
  const { error } = await supabase
    .from('employees')
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
    userId:     session.userId,
    action:     'DELETE',
    entityType: 'employees',
    entityId:   id,
    oldData:    oldData as Record<string, unknown>,
    newData:    null,
  })

  revalidatePath('/admin/employees')
  return { success: true }
}

// ---------------------------------------------------------------------------
// suspendEmployee
// ---------------------------------------------------------------------------

export async function suspendEmployee(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Fetch old data for audit log before mutating
  const { data: oldData } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

  // Set status to suspended
  const { data, error } = await supabase
    .from('employees')
    .update({
      status:     'suspended',
      updated_by: session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Write audit log
  await writeAuditLog({
    userId:     session.userId,
    action:     'UPDATE',
    entityType: 'employees',
    entityId:   id,
    oldData:    oldData as Record<string, unknown>,
    newData:    data as Record<string, unknown>,
  })

  revalidatePath('/admin/employees')
  return { success: true }
}
