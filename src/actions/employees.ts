'use server'

/**
 * employees.ts — Server Actions for Employee CRUD and Excel import.
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
 *   - importEmployeesAction: two-phase (preview / confirm) Excel import using ExcelJS.
 *     Phase 1 = preview counts only (no DB writes).
 *     Phase 2 = upsert via upsert_employee() RPC per row (handles partial unique index).
 */

import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { EmployeeSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// Excel column index constants (1-based, verified against demo.xlsx).
// Hebrew column names from the payroll system's per-company export.
// ---------------------------------------------------------------------------
const COL = {
  EMPLOYEE_NUMBER:   1,   // מספר עובד
  FIRST_NAME:        3,   // שם פרטי
  LAST_NAME:         4,   // שם משפחה
  ID_NUMBER:         6,   // מספר זהות
  GENDER_CODE:       7,   // קוד מין: ז=male, נ=female
  STREET:            9,   // כתובת
  HOUSE_NUMBER:      10,  // כתובת - מספר בית
  CITY:              11,  // כתובת - ישוב
  MOBILE_PHONE:      13,  // טלפון
  ADDITIONAL_PHONE:  14,  // טלפון נוסף
  EMAIL:             15,  // כתובת - דוא"ל
  DATE_OF_BIRTH:     16,  // תאריך לידה
  START_DATE:        60,  // תאריך תחילת עבודה
  END_DATE:          61,  // תאריך הפסקת עבודה
  DEPT_NUMBER:       67,  // מספר מחלקה
  SUB_DEPT_NUMBER:   68,  // מספר תת-מחלקה
  COUNTRY_CODE:      73,  // קוד מדינה (non-null = foreign citizen)
  PASSPORT_NUMBER:   74,  // מספר דרכון
} as const

// ---------------------------------------------------------------------------
// Helper functions for Excel cell → DB field conversion
// ---------------------------------------------------------------------------

/**
 * cellToString — coerce any Excel cell value to a trimmed string or null.
 * Returns null for blank/whitespace/undefined cells.
 */
function cellToString(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str === '' ? null : str
}

/**
 * cellToDateString — convert an Excel cell to YYYY-MM-DD string or null.
 * ExcelJS can return Date objects (for date-formatted cells), ISO strings,
 * or numeric serial values (less common). We handle the two most common cases.
 */
function cellToDateString(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    // Guard against Excel's epoch-zero placeholder date (1899-12-30)
    if (isNaN(value.getTime())) return null
    return value.toISOString().split('T')[0]
  }
  const str = String(value).trim()
  if (str === '') return null
  // Accept ISO strings passed as text (e.g. "2020-01-15")
  const asDate = new Date(str)
  return isNaN(asDate.getTime()) ? null : asDate.toISOString().split('T')[0]
}

/**
 * mapGender — translate payroll gender codes to DB enum values.
 * ז (zayin) = male, נ (nun) = female, anything else = null (not stored).
 */
function mapGender(value: ExcelJS.CellValue): 'male' | 'female' | null {
  const code = cellToString(value)
  if (code === 'ז') return 'male'
  if (code === 'נ') return 'female'
  return null
}

// ---------------------------------------------------------------------------
// Parsed row type — intermediate representation before RPC call
// ---------------------------------------------------------------------------

type ParsedEmployeeRow = {
  rowIndex:           number
  employee_number:    string
  first_name:         string
  last_name:          string
  id_number:          string | null
  gender:             'male' | 'female' | null
  street:             string | null
  house_number:       string | null
  city:               string | null
  mobile_phone:       string | null
  additional_phone:   string | null
  email:              string | null
  date_of_birth:      string | null
  start_date:         string | null
  end_date:           string | null
  dept_number:        string | null   // raw dept number — resolved to UUID later
  sub_dept_number:    string | null   // raw sub-dept number — resolved to UUID later
  passport_number:    string | null
  citizenship:        'israeli' | 'foreign'
  status:             'active' | 'inactive'
}

/**
 * parseExcelBufferAsync — async Excel parser.
 * Skips the header row (row 1) and any row missing employee_number or last_name.
 * Returns an array of ParsedEmployeeRow (one per valid data row).
 */
async function parseExcelBufferAsync(
  buffer: ArrayBuffer
): Promise<{ rows: ParsedEmployeeRow[]; skipped: number }> {
  const workbook = new ExcelJS.Workbook()
  // Convert ArrayBuffer → Node.js Buffer. The cast suppresses a @types/node v22
  // vs exceljs type mismatch (Buffer<ArrayBuffer> vs Buffer without generic).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(Buffer.from(buffer) as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    return { rows: [], skipped: 0 }
  }

  const rows: ParsedEmployeeRow[] = []
  let skipped = 0

  worksheet.eachRow((row, rowIndex) => {
    // Skip header row
    if (rowIndex === 1) return

    const employeeNumber = cellToString(row.getCell(COL.EMPLOYEE_NUMBER).value)
    const lastName        = cellToString(row.getCell(COL.LAST_NAME).value)

    // Skip rows without the minimum required fields
    if (!employeeNumber || !lastName) {
      skipped++
      return
    }

    const firstName = cellToString(row.getCell(COL.FIRST_NAME).value) ?? ''

    // Citizenship: non-null country code means foreign national
    const countryCode  = cellToString(row.getCell(COL.COUNTRY_CODE).value)
    const citizenship: 'israeli' | 'foreign' = countryCode ? 'foreign' : 'israeli'

    // Status: if end_date is set, employee is inactive
    const endDate  = cellToDateString(row.getCell(COL.END_DATE).value)
    const status: 'active' | 'inactive' = endDate ? 'inactive' : 'active'

    rows.push({
      rowIndex,
      employee_number:  employeeNumber,
      first_name:       firstName,
      last_name:        lastName,
      id_number:        cellToString(row.getCell(COL.ID_NUMBER).value),
      gender:           mapGender(row.getCell(COL.GENDER_CODE).value),
      street:           cellToString(row.getCell(COL.STREET).value),
      house_number:     cellToString(row.getCell(COL.HOUSE_NUMBER).value),
      city:             cellToString(row.getCell(COL.CITY).value),
      mobile_phone:     cellToString(row.getCell(COL.MOBILE_PHONE).value),
      additional_phone: cellToString(row.getCell(COL.ADDITIONAL_PHONE).value),
      email:            cellToString(row.getCell(COL.EMAIL).value),
      date_of_birth:    cellToDateString(row.getCell(COL.DATE_OF_BIRTH).value),
      start_date:       cellToDateString(row.getCell(COL.START_DATE).value),
      end_date:         endDate,
      dept_number:      cellToString(row.getCell(COL.DEPT_NUMBER).value),
      sub_dept_number:  cellToString(row.getCell(COL.SUB_DEPT_NUMBER).value),
      passport_number:  cellToString(row.getCell(COL.PASSPORT_NUMBER).value),
      citizenship,
      status,
    })
  })

  return { rows, skipped }
}

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

// ---------------------------------------------------------------------------
// importEmployeesAction — two-phase Excel import
// ---------------------------------------------------------------------------

/**
 * ImportActionState — shared return type for both preview and confirm phases.
 *
 * Phase flow:
 *   1. User selects company + uploads file → form submits with action='preview'
 *      → returns { success: true, phase: 'preview', preview: {...counts} }
 *   2. User confirms → client re-submits same file + action='confirm'
 *      → returns { success: true, phase: 'complete', result: {...counts} }
 */
export type ImportActionState = {
  success:  boolean
  phase?:   'preview' | 'complete'
  preview?: {
    total:       number
    newCount:    number
    updateCount: number
    errors:      string[]
  }
  result?: {
    imported: number
    updated:  number
    errors:   string[]
  }
  error?: string
} | null

export async function importEmployeesAction(
  prevState: ImportActionState,
  formData:  FormData
): Promise<ImportActionState> {
  const session  = await verifySession()
  const supabase = await createClient()

  // ── Input extraction ─────────────────────────────────────────────────────
  const companyId = formData.get('company_id') as string | null
  const action    = formData.get('action')    as 'preview' | 'confirm' | null
  const fileEntry = formData.get('excel_file')

  if (!companyId) {
    return { success: false, error: 'יש לבחור חברה לפני הייבוא' }
  }
  if (!action || (action !== 'preview' && action !== 'confirm')) {
    return { success: false, error: 'פעולה לא חוקית' }
  }
  if (!fileEntry || !(fileEntry instanceof Blob)) {
    return { success: false, error: 'לא נבחר קובץ' }
  }

  // ── Parse Excel ──────────────────────────────────────────────────────────
  let rows: ParsedEmployeeRow[]
  let skipped: number
  try {
    const arrayBuffer = await fileEntry.arrayBuffer()
    const result = await parseExcelBufferAsync(arrayBuffer)
    rows    = result.rows
    skipped = result.skipped
  } catch (err) {
    console.error('[importEmployeesAction] Excel parse error:', err)
    return { success: false, error: 'שגיאה בקריאת קובץ ה-Excel. ודא שהקובץ תקין ובפורמט .xlsx' }
  }

  if (rows.length === 0) {
    return { success: false, error: `לא נמצאו שורות תקינות בקובץ (${skipped} שורות דולגו)` }
  }

  // ── Build department number → UUID lookup map ───────────────────────────
  // Fetch all departments for this company (parent + child) to resolve
  // the integer dept_number from the payroll file to the DB UUID.
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('id, dept_number, parent_dept_id')
    .eq('company_id', companyId)
    .is('deleted_at', null)

  if (deptError) {
    console.error('[importEmployeesAction] Failed to fetch departments:', deptError.message)
    return { success: false, error: 'שגיאה בטעינת מחלקות' }
  }

  // Map: dept_number string → UUID (covers both parent and child departments)
  const deptNumberToId = new Map<string, string>(
    (departments ?? []).map((d) => [String(d.dept_number), d.id])
  )

  // ── PHASE 1: Preview — count new vs update, no DB writes ─────────────────
  if (action === 'preview') {
    // Fetch all existing active employee numbers for this company
    const { data: existing, error: existingError } = await supabase
      .from('employees')
      .select('employee_number')
      .eq('company_id', companyId)
      .is('deleted_at', null)

    if (existingError) {
      console.error('[importEmployeesAction] Preview fetch error:', existingError.message)
      return { success: false, error: 'שגיאה בבדיקת עובדים קיימים' }
    }

    const existingNumbers = new Set((existing ?? []).map((e) => e.employee_number))

    let newCount    = 0
    let updateCount = 0
    const previewErrors: string[] = []

    for (const row of rows) {
      if (existingNumbers.has(row.employee_number)) {
        updateCount++
      } else {
        newCount++
      }
    }

    if (skipped > 0) {
      previewErrors.push(`${skipped} שורות דולגו (חסרים שדות חובה)`)
    }

    return {
      success: true,
      phase:   'preview',
      preview: {
        total:       rows.length,
        newCount,
        updateCount,
        errors:      previewErrors,
      },
    }
  }

  // ── PHASE 2: Confirm — upsert via RPC ────────────────────────────────────
  let imported = 0
  let updated  = 0
  const confirmErrors: string[] = []

  // Fetch existing employee numbers once (to distinguish insert vs update for counting)
  const { data: existing } = await supabase
    .from('employees')
    .select('employee_number')
    .eq('company_id', companyId)
    .is('deleted_at', null)

  const existingNumbers = new Set((existing ?? []).map((e) => e.employee_number))

  for (const row of rows) {
    // Resolve department numbers to UUIDs (null if not found — not fatal)
    const departmentId    = row.dept_number
      ? (deptNumberToId.get(row.dept_number) ?? null)
      : null
    const subDepartmentId = row.sub_dept_number && row.sub_dept_number !== '0'
      ? (deptNumberToId.get(row.sub_dept_number) ?? null)
      : null

    const wasExisting = existingNumbers.has(row.employee_number)

    const { error: rpcError } = await supabase.rpc('upsert_employee', {
      p_employee_number:   row.employee_number,
      p_company_id:        companyId,
      p_first_name:        row.first_name,
      p_last_name:         row.last_name,
      p_id_number:         row.id_number,
      p_gender:            row.gender,
      p_street:            row.street,
      p_house_number:      row.house_number,
      p_city:              row.city,
      p_mobile_phone:      row.mobile_phone,
      p_additional_phone:  row.additional_phone,
      p_email:             row.email,
      p_date_of_birth:     row.date_of_birth,
      p_start_date:        row.start_date,
      p_end_date:          row.end_date,
      p_department_id:     departmentId,
      p_sub_department_id: subDepartmentId,
      p_passport_number:   row.passport_number,
      p_citizenship:       row.citizenship,
      p_status:            row.status,
      p_imported_by:       session.userId,
    })

    if (rpcError) {
      console.error(`[importEmployeesAction] RPC error on row ${row.rowIndex}:`, rpcError.message)
      confirmErrors.push(`שורה ${row.rowIndex}: ${rpcError.message}`)
      continue
    }

    if (wasExisting) {
      updated++
    } else {
      imported++
    }
  }

  // Write a single bulk audit log entry for the import (fire-and-forget).
  // Uses INSERT action with entity_type 'employee_import' to distinguish from
  // individual employee mutations in the audit trail.
  await writeAuditLog({
    userId:     session.userId,
    action:     'INSERT',
    entityType: 'employee_import',
    entityId:   companyId,
    oldData:    null,
    newData:    {
      imported,
      updated,
      errors_count: confirmErrors.length,
      company_id:   companyId,
      total_rows:   rows.length,
    },
  })

  revalidatePath('/admin/employees')

  return {
    success: true,
    phase:   'complete',
    result:  { imported, updated, errors: confirmErrors },
  }
}
