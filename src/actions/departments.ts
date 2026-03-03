'use server'

/**
 * departments.ts — Server Actions for Department CRUD + PDF import.
 *
 * Pattern: verifySession -> validate with Zod -> mutate DB -> writeAuditLog -> revalidate
 *
 * Departments are global across all companies (no company_id).
 * Unique constraint: dept_number WHERE deleted_at IS NULL.
 *
 * importDepartmentsFromPdf — parses a Michpal 2000 payroll PDF (רשימת מחלקות)
 * and upserts (dept_number, name) pairs into the departments table.
 * Two phases: preview (parse only) → confirm (upsert).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession, requirePermission } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { DepartmentSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// PDF parsing helpers (Michpal 2000 format — רשימת מחלקות)
// ---------------------------------------------------------------------------

/** Known noise patterns from the אפיון / הסכם עבודה / הסכם העברה columns */
const PDF_NOISE: [RegExp, string][] = [
  [/תאילנדים\s+אינטל\s+מ\d+\s*[-–]\s*[\d.]+/g, ''],
  [/ערך\s+לא\s+חוקי/g, ''],
  [/שעתיים\s+ז\s+חדש/g, ''],
  [/\bגלובלי\b/g, ''],
  // Match "ריק" in all forms: <ריק>, >ריק<, >ריק>, standalone " ריק ", etc.
  // Uses Unicode lookbehind/ahead to avoid matching Hebrew words containing ריק (e.g. ריקוד)
  [/(?<![\u05D0-\u05EA])ריק(?![\u05D0-\u05EA])/g, ''],
]

/** Lines to skip (page headers / footers) */
const PDF_SKIP = [
  /מיכפל/,
  /לחישוב שכר/,
  /לקוח\d/,
  /מחשב\d/,
  /חברה\s+\d{3}/,
  /תיק\s+ניכויים/,
  /הודפס\s+בתאריך/,
  /מספר\s*מחלקה/,
  /שם\s+מחלקה/,
  /אפיון\s*[12]/,
  /הסכם\s+עבודה/,
  /הסכם\s+העברה/,
  /דף\s+\d/,
]

type ParsedDept = { deptNumber: string; name: string }

function parseDepartmentsPdf(text: string): ParsedDept[] {
  const results: ParsedDept[] = []
  const seen = new Set<string>()

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (PDF_SKIP.some((p) => p.test(line))) continue

    // Remember if line had ריק markers before cleanup (identifies real dept rows
    // even when the dept has no name, e.g. dept 405 with empty שם מחלקה)
    const hadRiq = /(?<![\u05D0-\u05EA])ריק(?![\u05D0-\u05EA])/.test(line)

    // Apply noise cleanup
    let cleaned = line
    for (const [pattern, replacement] of PDF_NOISE) {
      cleaned = cleaned.replace(pattern, replacement)
    }
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    if (!cleaned) continue

    // Find all standalone 1-4 digit integers (not part of longer numbers)
    const nums = [...cleaned.matchAll(/(?<!\d)(\d{1,4})(?!\d)/g)]
    if (nums.length === 0) continue

    // Last matching number = dept number (rightmost column in the RTL table)
    const deptNumber = nums[nums.length - 1][1]

    // Skip line if it's just a standalone number with no surrounding text
    // and no <ריק> markers — typically the total-count line at the PDF bottom (e.g. "125")
    const nameRaw = cleaned
      .replace(new RegExp(`(?<!\\d)${deptNumber}(?!\\d)`), ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!nameRaw && !hadRiq) continue

    // Deduplicate by dept_number (first occurrence wins)
    if (seen.has(deptNumber)) continue
    seen.add(deptNumber)

    results.push({ deptNumber, name: nameRaw })
  }

  return results
}

// ---------------------------------------------------------------------------
// importDepartmentsFromPdf — two-phase PDF import action
// ---------------------------------------------------------------------------

export type DeptImportActionState = {
  success:  boolean
  phase?:   'preview' | 'complete'
  preview?: {
    rows: { deptNumber: string; name: string; isNew: boolean }[]
    newCount:    number
    updateCount: number
  }
  result?: { imported: number; updated: number }
  error?:  string
} | null

export async function importDepartmentsFromPdf(
  prevState: DeptImportActionState,
  formData:  FormData
): Promise<DeptImportActionState> {
  const session  = await verifySession()
  const supabase = await createClient()

  const action = formData.get('action') as 'preview' | 'confirm' | null
  if (!action || (action !== 'preview' && action !== 'confirm')) {
    return { success: false, error: 'פעולה לא חוקית' }
  }

  // ── Parse departments ─────────────────────────────────────────────────────
  // Phase 1 (preview): parse the uploaded PDF file.
  // Phase 2 (confirm): use rows_json from client state — no file re-upload needed.
  let parsedDepts: ParsedDept[]

  if (action === 'preview') {
    const fileEntry = formData.get('pdf_file')
    if (!fileEntry || !(fileEntry instanceof Blob)) {
      return { success: false, error: 'לא נבחר קובץ PDF' }
    }
    try {
      // pdf-parse v2 is ESM-only — use dynamic import + class API (not v1 function API)
      const { PDFParse } = await import('pdf-parse')
      const buffer = Buffer.from(await fileEntry.arrayBuffer())
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const result = await parser.getText()
      parsedDepts  = parseDepartmentsPdf(result.text)
    } catch (err) {
      console.error('[importDepartmentsFromPdf] PDF parse error:', err)
      return { success: false, error: 'שגיאה בקריאת קובץ ה-PDF. ודא שהקובץ תקין.' }
    }
    if (parsedDepts.length === 0) {
      return { success: false, error: 'לא נמצאו מחלקות בקובץ ה-PDF.' }
    }
  } else {
    const rowsJson = formData.get('rows_json') as string | null
    if (!rowsJson) {
      return { success: false, error: 'שגיאה בנתוני הייבוא — נסה שוב מהתחלה' }
    }
    try {
      parsedDepts = JSON.parse(rowsJson) as ParsedDept[]
    } catch {
      return { success: false, error: 'שגיאה בנתוני הייבוא — נסה שוב מהתחלה' }
    }
  }

  // Fetch existing departments globally (no company filter — departments are shared)
  const { data: existing, error: fetchError } = await supabase
    .from('departments')
    .select('id, dept_number')
    .is('deleted_at', null)

  if (fetchError) {
    return { success: false, error: 'שגיאה בטעינת מחלקות קיימות' }
  }

  const existingMap = new Map<string, string>(
    (existing ?? []).map((d) => [String(d.dept_number), d.id])
  )

  // ── PHASE 1: Preview ──────────────────────────────────────────────────────
  if (action === 'preview') {
    const rows = parsedDepts.map((d) => ({
      deptNumber: d.deptNumber,
      name:       d.name,
      isNew:      !existingMap.has(d.deptNumber),
    }))
    return {
      success: true,
      phase:   'preview',
      preview: {
        rows,
        newCount:    rows.filter((r) => r.isNew).length,
        updateCount: rows.filter((r) => !r.isNew).length,
      },
    }
  }

  // ── PHASE 2: Confirm — upsert all rows ───────────────────────────────────
  let imported = 0
  let updated  = 0
  const errors: string[] = []

  for (const dept of parsedDepts) {
    const existingId = existingMap.get(dept.deptNumber)

    if (existingId) {
      const { error } = await supabase
        .from('departments')
        .update({ name: dept.name || `מחלקה ${dept.deptNumber}`, updated_by: session.userId })
        .eq('id', existingId)
      if (error) {
        errors.push(`מחלקה ${dept.deptNumber}: ${error.message}`)
      } else {
        updated++
      }
    } else {
      const { error } = await supabase
        .from('departments')
        .insert({
          dept_number:    dept.deptNumber,
          name:           dept.name || `מחלקה ${dept.deptNumber}`,
          parent_dept_id: null,
          created_by:     session.userId,
        })
      if (error) {
        errors.push(`מחלקה ${dept.deptNumber}: ${error.message}`)
      } else {
        imported++
      }
    }
  }

  await writeAuditLog({
    userId:     session.userId,
    action:     'INSERT',
    entityType: 'department_import',
    entityId:   session.userId,
    oldData:    null,
    newData:    { imported, updated, errors_count: errors.length },
  })

  revalidatePath('/admin/departments')
  return { success: true, phase: 'complete', result: { imported, updated } }
}

// ---------------------------------------------------------------------------
// createDepartment
// ---------------------------------------------------------------------------

export async function createDepartment(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  await requirePermission('departments', 2)
  const supabase = await createClient()

  // Validate form data
  const parsed = DepartmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const { data: input } = parsed

  // Insert into DB
  const { data, error } = await supabase
    .from('departments')
    .insert({
      name: input.name,
      dept_number: input.dept_number,
      parent_dept_id: null,
      notes: input.notes || null,
      created_by: session.userId,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation on dept_number
    if (error.code === '23505') {
      return {
        success: false,
        error: { dept_number: ['מספר מחלקה כבר קיים במערכת'] },
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
  await requirePermission('departments', 2)
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
    // Unique constraint violation on dept_number
    if (error.code === '23505') {
      return {
        success: false,
        error: { dept_number: ['מספר מחלקה כבר קיים במערכת'] },
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
  await requirePermission('departments', 2)
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
