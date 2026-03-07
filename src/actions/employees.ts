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
 * Excel column detection: DYNAMIC — columns are resolved by scanning the Hebrew
 * header text in row 1 (see HEADER_MAP). This handles Michpal 2000 exports with
 * varying column counts (133, 150, etc.) where later columns shift positions.
 *
 * Mapped fields (header text → field):
 *   מספר עובד              → EMPLOYEE_NUMBER
 *   שם פרטי                → FIRST_NAME
 *   שם משפחה               → LAST_NAME
 *   מספר זהות              → ID_NUMBER
 *   קוד מין                → GENDER_CODE   ז=male, נ=female
 *   כתובת (exact)          → STREET
 *   מספר בית               → HOUSE_NUMBER
 *   ישוב                   → CITY
 *   טלפון (exact)          → MOBILE_PHONE
 *   טלפון נוסף             → ADDITIONAL_PHONE
 *   דוא"ל                  → EMAIL
 *   תאריך לידה             → DATE_OF_BIRTH
 *   רישוי רכב              → SALARY_SYSTEM_LICENSE
 *   קוד תושב               → CITIZENSHIP_CODE  כ=ישראלי, ח=זר
 *   תאריך תחילת עבודה      → START_DATE   dd/mm/yy
 *   תאריך הפסקת עבודה      → END_DATE     dd/mm/yy
 *   מספר מחלקה             → DEPT_NUMBER   → UUID lookup
 *   מספר תת-מחלקה          → SUB_DEPT_NUMBER → UUID lookup
 *   מספר דרכון             → PASSPORT_NUMBER
 */

import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { EmployeeSchema } from '@/lib/schemas'
import { normalizePhone } from '@/lib/format'

// ---------------------------------------------------------------------------
// Dynamic Excel column detection — header-based mapping
// ---------------------------------------------------------------------------
// Michpal 2000 exports vary in column count (133–150+). Instead of hardcoded
// indices we scan row 1 headers and resolve each field dynamically.
//
// `exact: true` means the header text must equal the pattern exactly (not just
// include it). Required when a short header is a substring of other headers:
//   "כתובת" ⊂ "כתובת - שמאל", "כתובת - מספר בית", "כתובת - ישוב", etc.
//   "טלפון" ⊂ "טלפון נוסף"
// ---------------------------------------------------------------------------

type HeaderPattern = {
  field: string
  patterns: string[]
  exact?: boolean
}

const HEADER_MAP: HeaderPattern[] = [
  { field: 'EMPLOYEE_NUMBER',       patterns: ['מספר עובד'] },
  { field: 'FIRST_NAME',            patterns: ['שם פרטי'] },
  { field: 'LAST_NAME',             patterns: ['שם משפחה'] },
  { field: 'ID_NUMBER',             patterns: ['מספר זהות'] },
  { field: 'GENDER_CODE',           patterns: ['קוד מין'] },
  { field: 'STREET',                patterns: ['כתובת'], exact: true },
  { field: 'HOUSE_NUMBER',          patterns: ['מספר בית'] },
  { field: 'CITY',                  patterns: ['ישוב'] },
  { field: 'MOBILE_PHONE',          patterns: ['טלפון'], exact: true },
  { field: 'ADDITIONAL_PHONE',      patterns: ['טלפון נוסף'] },
  { field: 'EMAIL',                 patterns: ['דוא"ל', 'דואל', 'אימייל'] },
  { field: 'DATE_OF_BIRTH',         patterns: ['תאריך לידה'] },
  { field: 'SALARY_SYSTEM_LICENSE', patterns: ['רישוי רכב'] },
  { field: 'CITIZENSHIP_CODE',      patterns: ['קוד תושב'] },
  { field: 'START_DATE',            patterns: ['תאריך תחילת עבודה'] },
  { field: 'END_DATE',              patterns: ['תאריך הפסקת עבודה'] },
  { field: 'DEPT_NUMBER',           patterns: ['מספר מחלקה'] },
  { field: 'SUB_DEPT_NUMBER',       patterns: ['מספר תת-מחלקה', 'תת מחלקה'] },
  { field: 'PASSPORT_NUMBER',       patterns: ['מספר דרכון', 'דרכון'] },
]

/** field name → 1-based column index */
type ColumnMap = Record<string, number>

/**
 * detectColumns — scan the worksheet header row and build a dynamic column map.
 * Returns a Record<fieldName, colNumber> for every field whose header was found.
 * Missing fields are simply absent from the map (graceful degradation).
 */
function detectColumns(worksheet: ExcelJS.Worksheet): ColumnMap {
  const headerRow = worksheet.getRow(1)
  const colMap: ColumnMap = {}

  // Collect all non-empty header cells
  const headers: { col: number; text: string }[] = []
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = String(cell.value ?? '').trim()
    if (text) headers.push({ col: colNumber, text })
  })

  // Track claimed columns to prevent double-matching
  const claimed = new Set<number>()

  for (const { field, patterns, exact } of HEADER_MAP) {
    for (const pattern of patterns) {
      const match = headers.find(h =>
        !claimed.has(h.col) && (exact ? h.text === pattern : h.text.includes(pattern))
      )
      if (match) {
        colMap[field] = match.col
        claimed.add(match.col)
        break
      }
    }
  }

  return colMap
}

/** Safe cell read — returns the cell value if the column was detected, null otherwise. */
function getCell(row: ExcelJS.Row, col: ColumnMap, field: string): ExcelJS.CellValue {
  const colIndex = col[field]
  return colIndex ? row.getCell(colIndex).value : null
}

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
 * deriveStatus — determine employee status from end_date and dept_number.
 * Iron rule: dept_number '0' = always inactive, regardless of end_date.
 * - Dept 0         → inactive (לא פעיל, red)
 * - No end_date    → active (פעיל, green)
 * - Future end_date → suspended / notice period (הודעה מוקדמת, yellow)
 * - Past/today end_date → inactive (לא פעיל, red)
 */
function deriveStatus(endDate: string | null, deptNumber?: string | null): 'active' | 'suspended' | 'inactive' {
  if (deptNumber === '0') return 'inactive'
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
 * parseExcelBufferAsync — async Excel parser with dynamic column detection.
 * Scans row 1 headers to resolve column positions, then iterates data rows.
 * Skips any row missing employee_number or last_name.
 * Throws Error('MISSING_HEADERS') if the critical columns are not found.
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

  // Dynamic column detection from header row
  const col = detectColumns(worksheet)

  if (process.env.NODE_ENV === 'development') {
    console.log('[importEmployees] Detected column mapping:', col)
  }

  // Validate critical columns exist
  if (!col.EMPLOYEE_NUMBER || !col.LAST_NAME) {
    throw new Error('MISSING_HEADERS')
  }

  const rows: ParsedEmployeeRow[] = []
  const skippedRows: SkippedRowDetail[] = []

  worksheet.eachRow((row, rowIndex) => {
    // Skip header row
    if (rowIndex === 1) return

    const employeeNumber = cellToString(getCell(row, col, 'EMPLOYEE_NUMBER'))
    const lastName        = cellToString(getCell(row, col, 'LAST_NAME'))

    // Skip rows without the minimum required fields — collect detail
    if (!employeeNumber || !lastName) {
      const missing: string[] = []
      if (!employeeNumber) missing.push('מספר עובד')
      if (!lastName) missing.push('שם משפחה')
      skippedRows.push({ row: rowIndex, missing })
      return
    }

    const firstName = cellToString(getCell(row, col, 'FIRST_NAME')) ?? ''

    // Citizenship: קוד תושב — כ=israeli, ח=foreign
    const citizenship = mapCitizenship(getCell(row, col, 'CITIZENSHIP_CODE'))

    // Correspondence language: hebrew for Israeli citizens (editable in form)
    const correspondenceLanguage: 'hebrew' | 'english' =
      citizenship === 'israeli' ? 'hebrew' : 'english'

    // Status: derived from end_date + dept_number (dept 0 = always inactive)
    const endDate    = cellToDateString(getCell(row, col, 'END_DATE'))
    const deptNumber = cellToString(getCell(row, col, 'DEPT_NUMBER'))
    const status     = deriveStatus(endDate, deptNumber)

    rows.push({
      rowIndex,
      employee_number:         employeeNumber,
      first_name:              firstName,
      last_name:               lastName,
      id_number:               cellToString(getCell(row, col, 'ID_NUMBER')),
      gender:                  mapGender(getCell(row, col, 'GENDER_CODE')),
      street:                  cellToString(getCell(row, col, 'STREET')),
      house_number:            cellToString(getCell(row, col, 'HOUSE_NUMBER')),
      city:                    cellToString(getCell(row, col, 'CITY')),
      mobile_phone:            normalizePhone(cellToString(getCell(row, col, 'MOBILE_PHONE')))
                               ?? normalizePhone(cellToString(getCell(row, col, 'ADDITIONAL_PHONE'))),
      additional_phone:        normalizePhone(cellToString(getCell(row, col, 'ADDITIONAL_PHONE'))),
      email:                   cellToString(getCell(row, col, 'EMAIL')),
      date_of_birth:           cellToDateString(getCell(row, col, 'DATE_OF_BIRTH')),
      start_date:              cellToDateString(getCell(row, col, 'START_DATE')),
      end_date:                endDate,
      dept_number:             cellToString(getCell(row, col, 'DEPT_NUMBER')),
      sub_dept_number:         cellToString(getCell(row, col, 'SUB_DEPT_NUMBER')),
      passport_number:         cellToString(getCell(row, col, 'PASSPORT_NUMBER')),
      citizenship,
      correspondence_language: correspondenceLanguage,
      salary_system_license:   cellToString(getCell(row, col, 'SALARY_SYSTEM_LICENSE')),
      status,
    })
  })

  return { rows, skippedRows }
}

import type { ActionWarning } from '@/lib/action-types'

type ActionState = {
  success: boolean
  error?: Record<string, string[]>
  warnings?: ActionWarning[]
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

  // ── Propagation: sync email/phone changes to related tables ──────────
  const emailChanged = oldData && data && oldData.email !== data.email
  const phoneChanged = oldData && data && oldData.mobile_phone !== data.mobile_phone
  const warnings: ActionWarning[] = []

  if (data?.email) {
    // Always sync email to auth.users when employee has a linked user.
    // Not just on emailChanged — covers mismatches from previous failed syncs.
    const { data: linkedUser } = await supabase
      .from('users')
      .select('auth_user_id')
      .eq('employee_id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (linkedUser?.auth_user_id) {
      const adminClient = createAdminClient()
      const { error: authError } = await adminClient.auth.admin.updateUserById(
        linkedUser.auth_user_id,
        { email: data.email, email_confirm: true }
      )
      if (authError) {
        console.error('[updateEmployee] Failed to sync auth email:', authError.message)
        warnings.push({
          context: 'סנכרון מייל ל-auth.users (יוזר מקושר)',
          message: authError.message,
          code: authError.code,
        })
      }
    }
  }

  if (emailChanged || phoneChanged) {
    await propagateEmployeeContactsToProjects(
      supabase, id, data?.email ?? null, data?.mobile_phone ?? null
    )
  }

  revalidatePath('/admin/employees')
  return { success: true, ...(warnings.length > 0 ? { warnings } : {}) }
}

// ---------------------------------------------------------------------------
// updateLockedFields — toggle lock/unlock per field for a single employee
// ---------------------------------------------------------------------------

const LOCKABLE_FIELDS = [
  'gender', 'citizenship', 'mobile_phone', 'additional_phone',
  'email', 'correspondence_language', 'notes', 'role_tags',
] as const

export async function updateLockedFields(
  employeeId: string,
  lockedFields: string[]
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Whitelist — only lockable fields allowed
  const sanitized = lockedFields.filter((f) =>
    (LOCKABLE_FIELDS as readonly string[]).includes(f)
  )

  const { error } = await supabase
    .from('employees')
    .update({
      locked_fields: sanitized,
      updated_by: session.userId,
    })
    .eq('id', employeeId)

  if (error) return { success: false, error: error.message }

  await writeAuditLog({
    userId:     session.userId,
    action:     'UPDATE',
    entityType: 'employees',
    entityId:   employeeId,
    oldData:    null,
    newData:    { locked_fields: sanitized },
  })

  revalidatePath('/admin/employees')
  return { success: true }
}

// ---------------------------------------------------------------------------
// propagateEmployeeContactsToProjects — private helper
// Updates pm_email/pm_phone, sm_email/sm_phone, cvc_phone in projects
// where this employee is assigned as PM, SM, or CVC (FK only).
// ---------------------------------------------------------------------------

async function propagateEmployeeContactsToProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
  newEmail: string | null,
  newPhone: string | null
) {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, project_manager_id, site_manager_id, camp_vehicle_coordinator_id, cvc_is_employee')
    .is('deleted_at', null)
    .or(
      `project_manager_id.eq.${employeeId},` +
      `site_manager_id.eq.${employeeId},` +
      `camp_vehicle_coordinator_id.eq.${employeeId}`
    )

  if (error || !projects?.length) return

  for (const project of projects) {
    const updates: Record<string, string | null> = {}

    if (project.project_manager_id === employeeId) {
      if (newEmail !== null) updates.pm_email = newEmail
      if (newPhone !== null) updates.pm_phone = newPhone
    }

    if (project.site_manager_id === employeeId) {
      if (newEmail !== null) updates.sm_email = newEmail
      if (newPhone !== null) updates.sm_phone = newPhone
    }

    // CVC: only update if selected from employee list (not free-text)
    if (
      project.camp_vehicle_coordinator_id === employeeId &&
      project.cvc_is_employee
    ) {
      if (newPhone !== null) updates.cvc_phone = newPhone
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('projects')
        .update(updates)
        .eq('id', project.id)
    }
  }
}

// ---------------------------------------------------------------------------
// softDeleteEmployee
// ---------------------------------------------------------------------------

export async function softDeleteEmployee(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
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
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'MISSING_HEADERS') {
      return { success: false, error: 'לא נמצאו כותרות חובה (מספר עובד / שם משפחה) בשורה הראשונה של הקובץ' }
    }
    console.error('[importEmployeesAction] Excel parse error:', msg)
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
