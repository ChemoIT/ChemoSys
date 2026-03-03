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
 *     Phase 2 = upsert via bulk_upsert_employees() RPC (single DB transaction).
 *
 * Excel column mapping (1-based, from payroll system export):
 *   EMPLOYEE_NUMBER       = col  1  (A)
 *   FIRST_NAME            = col  3  (C)
 *   LAST_NAME             = col  4  (D)
 *   ID_NUMBER             = col  6  (F)
 *   GENDER_CODE           = col  7  (G)  ז=male, נ=female
 *   STREET                = col  9  (I)
 *   HOUSE_NUMBER          = col 10  (J)
 *   CITY                  = col 11  (K)
 *   MOBILE_PHONE          = col 13  (M)
 *   ADDITIONAL_PHONE      = col 14  (N)
 *   EMAIL                 = col 15  (O)
 *   DATE_OF_BIRTH         = col 16  (P)
 *   SALARY_SYSTEM_LICENSE = col 45  (AS) רישוי רכב במערכת שכר
 *   CITIZENSHIP_CODE      = col 46  (AT) כ=ישראלי, ח=זר
 *   START_DATE            = col 65  (BM) dd/mm/yy
 *   END_DATE              = col 66  (BN) dd/mm/yy
 *   DEPT_NUMBER           = col 72  (BT) department number → UUID lookup
 *   SUB_DEPT_NUMBER       = col 73  (BU) sub-department number → UUID lookup
 *   PASSPORT_NUMBER       = col 79  (CA)
 *
 * Note: col 74 (BV) = קוד משרה בי"ל — NOT passport number (contains Hebrew codes like "ע")
 */

import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { verifySession, requirePermission } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { EmployeeSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// Excel column index constants (1-based, from payroll system export)
// ---------------------------------------------------------------------------
const COL = {
  EMPLOYEE_NUMBER:       1,   // מספר עובד
  FIRST_NAME:            3,   // שם פרטי
  LAST_NAME:             4,   // שם משפחה
  ID_NUMBER:             6,   // מספר זהות
  GENDER_CODE:           7,   // קוד מין: ז=male, נ=female
  STREET:                9,   // כתובת
  HOUSE_NUMBER:          10,  // מספר בית
  CITY:                  11,  // עיר
  MOBILE_PHONE:          13,  // טלפון נייד
  ADDITIONAL_PHONE:      14,  // טלפון נוסף
  EMAIL:                 15,  // דוא"ל
  DATE_OF_BIRTH:         16,  // תאריך לידה
  SALARY_SYSTEM_LICENSE: 45,  // רישוי רכב במערכת שכר (AS)
  CITIZENSHIP_CODE:      46,  // אזרחות: כ=ישראלי, ח=זר (AT)
  START_DATE:            65,  // תאריך תחילת עבודה (BM)
  END_DATE:              66,  // תאריך הפסקת עבודה (BN)
  DEPT_NUMBER:           72,  // מספר מחלקה (BT)
  SUB_DEPT_NUMBER:       73,  // מספר תת-מחלקה (BU)
  PASSPORT_NUMBER:       79,  // מספר דרכון (CA)
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
 * Handles:
 *   1. JavaScript Date objects (ExcelJS converts date-formatted cells automatically)
 *   2. Israeli/payroll format strings: dd/mm/yy or dd/mm/yyyy
 *   3. ISO strings: YYYY-MM-DD
 */
function cellToDateString(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    // Guard against Excel's epoch-zero placeholder date (1899-12-30)
    if (value.getFullYear() < 1900) return null
    return value.toISOString().split('T')[0]
  }

  const str = String(value).trim()
  if (str === '') return null

  // Parse dd/mm/yy or dd/mm/yyyy (Israeli/payroll format)
  const ddmmMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (ddmmMatch) {
    const day   = ddmmMatch[1].padStart(2, '0')
    const month = ddmmMatch[2].padStart(2, '0')
    let year    = ddmmMatch[3]
    if (year.length === 2) {
      // 2-digit year: 00-49 → 2000s, 50-99 → 1900s
      year = parseInt(year) < 50 ? `20${year}` : `19${year}`
    }
    const iso = `${year}-${month}-${day}`
    const d   = new Date(iso)
    return isNaN(d.getTime()) ? null : iso
  }

  // Fallback: try ISO or other parseable string
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

/**
 * mapCitizenship — translate payroll citizenship codes to DB enum values.
 * כ (kaf) = israeli, ח (het) = foreign. Defaults to 'israeli' if unknown.
 */
function mapCitizenship(value: ExcelJS.CellValue): 'israeli' | 'foreign' {
  const code = cellToString(value)
  if (code === 'ח') return 'foreign'
  return 'israeli'  // 'כ' or any other value → israeli
}

/**
 * deriveStatus — determine employee status from end_date.
 * - No end_date    → active (פעיל, green)
 * - Future end_date → suspended / notice period (הודעה מוקדמת, yellow)
 * - Past/today end_date → inactive (לא פעיל, red)
 */
function deriveStatus(endDate: string | null): 'active' | 'suspended' | 'inactive' {
  if (!endDate) return 'active'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  if (end > today) return 'suspended'  // Notice period (הודעה מוקדמת)
  return 'inactive'
}

// ---------------------------------------------------------------------------
// Parsed row type — intermediate representation before RPC call
// ---------------------------------------------------------------------------

type ParsedEmployeeRow = {
  rowIndex:               number
  employee_number:        string
  first_name:             string
  last_name:              string
  id_number:              string | null
  gender:                 'male' | 'female' | null
  street:                 string | null
  house_number:           string | null
  city:                   string | null
  mobile_phone:           string | null
  additional_phone:       string | null
  email:                  string | null
  date_of_birth:          string | null
  start_date:             string | null
  end_date:               string | null
  dept_number:            string | null   // raw dept number — resolved to UUID later
  sub_dept_number:        string | null   // raw sub-dept number — resolved to UUID later
  passport_number:        string | null
  citizenship:            'israeli' | 'foreign'
  correspondence_language: 'hebrew' | 'english'
  salary_system_license:  string | null
  status:                 'active' | 'suspended' | 'inactive'
}

/** Detail about a single skipped row */
type SkippedRowDetail = {
  row: number
  missing: string[]
}

/**
 * parseExcelBufferAsync — async Excel parser.
 * Skips the header row (row 1) and any row missing employee_number or last_name.
 * Returns an array of ParsedEmployeeRow (one per valid data row) plus detailed
 * info about each skipped row (row number + which fields are missing).
 */
async function parseExcelBufferAsync(
  buffer: ArrayBuffer
): Promise<{ rows: ParsedEmployeeRow[]; skippedRows: SkippedRowDetail[] }> {
  const workbook = new ExcelJS.Workbook()
  // Convert ArrayBuffer → Node.js Buffer. The cast suppresses a @types/node v22
  // vs exceljs type mismatch (Buffer<ArrayBuffer> vs Buffer without generic).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(Buffer.from(buffer) as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    return { rows: [], skippedRows: [] }
  }

  const rows: ParsedEmployeeRow[] = []
  const skippedRows: SkippedRowDetail[] = []

  worksheet.eachRow((row, rowIndex) => {
    // Skip header row
    if (rowIndex === 1) return

    const employeeNumber = cellToString(row.getCell(COL.EMPLOYEE_NUMBER).value)
    const lastName        = cellToString(row.getCell(COL.LAST_NAME).value)

    // Skip rows without the minimum required fields — collect detail
    if (!employeeNumber || !lastName) {
      const missing: string[] = []
      if (!employeeNumber) missing.push('מספר עובד')
      if (!lastName) missing.push('שם משפחה')
      skippedRows.push({ row: rowIndex, missing })
      return
    }

    const firstName = cellToString(row.getCell(COL.FIRST_NAME).value) ?? ''

    // Citizenship: column AT — כ=israeli, ח=foreign
    const citizenship = mapCitizenship(row.getCell(COL.CITIZENSHIP_CODE).value)

    // Correspondence language: hebrew for Israeli citizens (editable in form)
    const correspondenceLanguage: 'hebrew' | 'english' =
      citizenship === 'israeli' ? 'hebrew' : 'english'

    // Status: derived from end_date
    const endDate = cellToDateString(row.getCell(COL.END_DATE).value)
    const status  = deriveStatus(endDate)

    rows.push({
      rowIndex,
      employee_number:         employeeNumber,
      first_name:              firstName,
      last_name:               lastName,
      id_number:               cellToString(row.getCell(COL.ID_NUMBER).value),
      gender:                  mapGender(row.getCell(COL.GENDER_CODE).value),
      street:                  cellToString(row.getCell(COL.STREET).value),
      house_number:            cellToString(row.getCell(COL.HOUSE_NUMBER).value),
      city:                    cellToString(row.getCell(COL.CITY).value),
      mobile_phone:            cellToString(row.getCell(COL.MOBILE_PHONE).value),
      additional_phone:        cellToString(row.getCell(COL.ADDITIONAL_PHONE).value),
      email:                   cellToString(row.getCell(COL.EMAIL).value),
      date_of_birth:           cellToDateString(row.getCell(COL.DATE_OF_BIRTH).value),
      start_date:              cellToDateString(row.getCell(COL.START_DATE).value),
      end_date:                endDate,
      dept_number:             cellToString(row.getCell(COL.DEPT_NUMBER).value),
      sub_dept_number:         cellToString(row.getCell(COL.SUB_DEPT_NUMBER).value),
      passport_number:         cellToString(row.getCell(COL.PASSPORT_NUMBER).value),
      citizenship,
      correspondence_language: correspondenceLanguage,
      salary_system_license:   cellToString(row.getCell(COL.SALARY_SYSTEM_LICENSE).value),
      status,
    })
  })

  return { rows, skippedRows }
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
  await requirePermission('employees', 2)
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
  // photo_url and salary_system_license spread conditionally — columns may not exist
  // if migrations 00005/00009 not run yet.
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
      ...(input.photo_url ? { photo_url: input.photo_url } : {}),
      ...(input.salary_system_license ? { salary_system_license: input.salary_system_license } : {}),
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
  await requirePermission('employees', 2)
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
      ...(input.photo_url ? { photo_url: input.photo_url } : {}),
      ...(input.salary_system_license !== undefined
        ? { salary_system_license: input.salary_system_license || null }
        : {}),
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
  await requirePermission('employees', 2)
  const supabase = await createClient()

  // Fetch old data for audit log (also verifies the row exists)
  const { data: oldData, error: fetchError } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !oldData) {
    return { success: false, error: 'העובד לא נמצא או כבר נמחק' }
  }

  // Soft-delete via RPC — SECURITY DEFINER function bypasses RLS.
  const { data: affected, error } = await supabase.rpc('soft_delete_employees', {
    p_ids: [id],
  })

  if (error) {
    console.error('[softDeleteEmployee] RPC error:', error.message)
    return { success: false, error: error.message }
  }

  if (affected === 0) {
    return { success: false, error: 'העובד לא נמצא או כבר נמחק' }
  }

  // Write audit log (fire-and-forget)
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
// bulkSoftDeleteEmployees — batch delete in a single query
// ---------------------------------------------------------------------------

export async function bulkSoftDeleteEmployees(
  ids: string[]
): Promise<{ success: boolean; deleted: number; error?: string }> {
  if (ids.length === 0) return { success: true, deleted: 0 }

  const session = await verifySession()
  await requirePermission('employees', 2)
  const supabase = await createClient()

  // Soft-delete via RPC — SECURITY DEFINER function bypasses RLS.
  const { data: affected, error } = await supabase.rpc('soft_delete_employees', {
    p_ids: ids,
  })

  if (error) {
    console.error('[bulkSoftDeleteEmployees] RPC error:', error.message)
    return { success: false, deleted: 0, error: error.message }
  }

  const deletedCount = affected ?? 0

  // Single bulk audit log entry
  await writeAuditLog({
    userId:     session.userId,
    action:     'DELETE',
    entityType: 'employee_bulk_delete',
    entityId:   ids[0],
    oldData:    { employee_ids: ids, count: ids.length },
    newData:    null,
  })

  revalidatePath('/admin/employees')
  return { success: true, deleted: deletedCount }
}

// ---------------------------------------------------------------------------
// suspendEmployee — set status to 'suspended' (notice period / הודעה מוקדמת)
// NOTE: The suspend button is removed from the employee UI.
//       This action remains for potential programmatic use.
// ---------------------------------------------------------------------------

export async function suspendEmployee(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  await requirePermission('employees', 2)
  const supabase = await createClient()

  const { data: oldData } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

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
// reactivateEmployee — set status back to 'active' from 'suspended'
// ---------------------------------------------------------------------------

export async function reactivateEmployee(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  await requirePermission('employees', 2)
  const supabase = await createClient()

  const { data: oldData } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('employees')
    .update({
      status:     'active',
      updated_by: session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

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
    skippedRows: { row: number; missing: string[] }[]
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
  let skippedRows: SkippedRowDetail[]
  try {
    const arrayBuffer = await fileEntry.arrayBuffer()
    const result = await parseExcelBufferAsync(arrayBuffer)
    rows        = result.rows
    skippedRows = result.skippedRows
  } catch (err) {
    console.error('[importEmployeesAction] Excel parse error:', err)
    return { success: false, error: 'שגיאה בקריאת קובץ ה-Excel. ודא שהקובץ תקין ובפורמט .xlsx' }
  }

  if (rows.length === 0) {
    return { success: false, error: `לא נמצאו שורות תקינות בקובץ (${skippedRows.length} שורות דולגו)` }
  }

  // ── Build department number → UUID lookup map ───────────────────────────
  // Fetch ALL departments globally (no company filter) to resolve
  // the integer dept_number from the payroll file to the DB UUID.
  // Departments are stored under the first active company (auto-assigned)
  // and are shared across all companies — filtering by companyId would miss them.
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('id, dept_number, parent_dept_id')
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

    if (skippedRows.length > 0) {
      previewErrors.push(`${skippedRows.length} שורות דולגו (חסרים שדות חובה)`)
    }

    return {
      success: true,
      phase:   'preview',
      preview: {
        total:       rows.length,
        newCount,
        updateCount,
        errors:      previewErrors,
        skippedRows,
      },
    }
  }

  // ── PHASE 2: Confirm — bulk upsert via single RPC call ──────────────────
  let imported = 0
  let updated  = 0
  const confirmErrors: string[] = []

  // Build JSON array with resolved department UUIDs for the bulk RPC
  const jsonRows = rows.map((row) => {
    const departmentId    = row.dept_number
      ? (deptNumberToId.get(row.dept_number) ?? null)
      : null
    const subDepartmentId = row.sub_dept_number && row.sub_dept_number !== '0'
      ? (deptNumberToId.get(row.sub_dept_number) ?? null)
      : null

    return {
      employee_number:         row.employee_number,
      first_name:              row.first_name,
      last_name:               row.last_name,
      id_number:               row.id_number,
      gender:                  row.gender,
      street:                  row.street,
      house_number:            row.house_number,
      city:                    row.city,
      mobile_phone:            row.mobile_phone,
      additional_phone:        row.additional_phone,
      email:                   row.email,
      date_of_birth:           row.date_of_birth,
      start_date:              row.start_date,
      end_date:                row.end_date,
      department_id:           departmentId,
      sub_department_id:       subDepartmentId,
      passport_number:         row.passport_number,
      citizenship:             row.citizenship,
      correspondence_language: row.correspondence_language,
      salary_system_license:   row.salary_system_license,
      status:                  row.status,
    }
  })

  // Single RPC call — processes all rows in one DB transaction
  const { data: bulkResult, error: bulkError } = await supabase.rpc('bulk_upsert_employees', {
    p_rows:        jsonRows,
    p_company_id:  companyId,
    p_imported_by: session.userId,
  })

  if (bulkError) {
    console.error('[importEmployeesAction] Bulk RPC error:', bulkError.message)
    confirmErrors.push(bulkError.message)
  } else if (bulkResult && bulkResult.length > 0) {
    imported = bulkResult[0].new_count
    updated  = bulkResult[0].updated_count
  }

  // Write a single bulk audit log entry for the import
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
