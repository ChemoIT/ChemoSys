'use server'

/**
 * departments.ts — Server Actions for Department CRUD.
 *
 * Pattern: verifySession -> validate with Zod -> mutate DB -> writeAuditLog -> revalidate
 *
 * Departments support parent-child hierarchy via parent_dept_id (nullable).
 * A null parent_dept_id means top-level department.
 * Unique constraint: (dept_number, company_id) WHERE deleted_at IS NULL.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { DepartmentSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// createDepartment
// ---------------------------------------------------------------------------

export async function createDepartment(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Validate form data
  const parsed = DepartmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Auto-assign to first active company
  const { data: firstCompany } = await supabase
    .from('companies')
    .select('id')
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .single()

  if (!firstCompany) {
    return { success: false, error: { _form: ['יש ליצור חברה לפני יצירת מחלקה'] } }
  }

  // Insert into DB
  const { data, error } = await supabase
    .from('departments')
    .insert({
      name: input.name,
      dept_number: input.dept_number,
      company_id: firstCompany.id,
      parent_dept_id: null,
      notes: input.notes || null,
      created_by: session.userId,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation on (dept_number, company_id)
    if (error.code === '23505') {
      return {
        success: false,
        error: { dept_number: ['מספר מחלקה כבר קיים בחברה זו'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Write audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'departments',
    entityId: data.id,
    oldData: null,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/departments')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateDepartment
// ---------------------------------------------------------------------------

export async function updateDepartment(
  id: string,
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Validate form data
  const parsed = DepartmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Fetch old data for audit log before mutating
  const { data: oldData } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .single()

  // Update record (company_id and parent_dept_id unchanged)
  const { data, error } = await supabase
    .from('departments')
    .update({
      name: input.name,
      dept_number: input.dept_number,
      notes: input.notes || null,
      updated_by: session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // Unique constraint violation on (dept_number, company_id)
    if (error.code === '23505') {
      return {
        success: false,
        error: { dept_number: ['מספר מחלקה כבר קיים בחברה זו'] },
      }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Write audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'departments',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/departments')
  return { success: true }
}

// ---------------------------------------------------------------------------
// softDeleteDepartment
// ---------------------------------------------------------------------------

export async function softDeleteDepartment(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Fetch old data for audit log
  const { data: oldData } = await supabase
    .from('departments')
    .select('*')
    .eq('id', id)
    .single()

  // Soft-delete: set deleted_at timestamp
  const { error } = await supabase
    .from('departments')
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
    entityType: 'departments',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: null,
  })

  revalidatePath('/admin/departments')
  return { success: true }
}
