'use server'

/**
 * import-projects.ts — Import projects from legacy SystemProject.top file.
 *
 * Flow:
 *   1. parseProjectsFile(buffer) — decode Windows-1255, parse 50 columns
 *   2. dryRunProjectImport()     — match managers to employees, generate report
 *   3. executeProjectImport()    — upsert into projects + attendance_clocks
 *
 * Guard: verifySession() — admin only.
 * Uses: createImportClient() — bypasses RLS for bulk inserts.
 */

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { normalizePhone } from '@/lib/format'

// ---------------------------------------------------------------------------
// Admin client (bypasses RLS)
// ---------------------------------------------------------------------------
function createImportClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResolvedManager = {
  isEmployee: boolean
  employeeId: string | null
  name: string | null
  email: string | null
  phone: string | null
}

type ParsedProject = {
  name: string
  project_number: string
  description: string | null
  client_name: string | null
  supervision_company: string | null
  expense_number: string | null
  project_type: string | null
  status: string
  // PM
  pm_is_employee: boolean
  project_manager_id: string | null
  pm_name: string | null
  pm_email: string | null
  pm_phone: string | null
  pm_notifications: boolean
  // SM
  sm_is_employee: boolean
  site_manager_id: string | null
  sm_name: string | null
  sm_email: string | null
  sm_phone: string | null
  sm_notifications: boolean
  // CVC
  cvc_is_employee: boolean
  camp_vehicle_coordinator_id: string | null
  cvc_name: string | null
  cvc_phone: string | null
  // Location
  latitude: number | null
  longitude: number | null
  radius: number | null
  // Clocks (not stored in projects table)
  _clocks: string[]
  // Raw names for reporting
  _rawPmName: string
  _rawSmName: string
  _rawCvcName: string
}

export type ProjectDryRunReport = {
  totalRows: number
  skippedRows: { deleted: number; noNumber: number; endMarker: number }
  validRows: number
  statusBreakdown: { active: number; inactive: number }
  typeBreakdown: { project: number; staging_area: number; storage_area: number; none: number }
  pm: {
    employee: number
    freeText: number
    empty: number
    freeTextDetails: { name: string; email: string; phone: string }[]
  }
  sm: {
    employee: number
    freeText: number
    empty: number
    freeTextDetails: { name: string; email: string; phone: string }[]
  }
  cvc: {
    employee: number
    freeText: number
    empty: number
  }
  clocksTotal: number
  projectsWithClocks: number
  existing: number   // projects already in DB (will update)
  toInsert: number   // new projects
}

export type ProjectImportResult = {
  success: boolean
  inserted: number
  updated: number
  errors: string[]
  clocksInserted: number
}

// ---------------------------------------------------------------------------
// MANUAL_MAP: manager name → employee_number (null = free text)
// Built from analysis + Sharon's decisions
// ---------------------------------------------------------------------------
const MANUAL_MAP: Record<string, number | null> = {
  // PM (English)
  'Asaf Rolnicki': 227, 'Asaf': 227,
  'Eli Biton': 27, 'Israel Biton': 30,
  'Eldad Goldshmidt': 702,
  'Haim Dahan': 1645, 'Tomer Baruch': 256,
  'Yuval Soberano': 302,
  'Nati Efargan': 1500, 'Nati Ifergan': 1500,
  'Mofid Hamdan': 35, 'Mufid Hamdan': 35,
  'Shay Swissa': 3248, 'Shay Shimon Swissa': 3248,
  'Shahar Poran': 2291, 'Natale Falco': 1441,
  'Liron Panker': 4006, 'Shimon Malul': 4189,
  'Esten': 95, 'Esten / Yoav': 95,
  'Eli Arviv': null, 'Simone Ruginenti': null,
  'Keisi Sigron': null, 'Yishai Porat': null,
  'Eyal Nachman': null, 'Yoav Ben-Natan': null,
  'Keisi \\ Yoav': null,
  // PM (Hebrew)
  'אלי ביטון': 27, 'ישראל ביטון': 30,
  'אלדד גולדשמיט': 702, 'אלדד גולדשמידט': 702,
  'אסף רוליצקי': 227, 'יובל סוברנו': 302,
  'נתי איפרגן': 1500, 'תומר ברוך': 256, 'מופיד': 35,
  'אלי ארביב': null, 'אלדד אמריליו': null, 'אלדד אמנריליו': null,
  'אייל נחמן': null, 'ישי פורט': null,
  'קייסי': null, 'שמוליק': null, 'אסי הראל': null,
  // SM (Hebrew)
  'אליאב דהן': 1613, 'אסטן עזיזוב': 95,
  'אבי אבו רבן': null, 'אחיק': null, 'אילן אינהורן': null,
  'אלירן סאסי': null, 'זוהר עקרי': null, 'חיים איפרגן': null,
  'טופיק רישה': null, 'יחיאל דורון': null, 'ראמי סוועד': null,
  // CVC (Hebrew)
  'אודליה משה': 3941,   // = אודליה חלף
  'איתמר עמר': 3566, 'אסף גבאי': 3661,
  'וויסאם עבדו': 2376, 'יוסי ציון': 5038,
  'ליאור כהן': 2957, 'מאור מועלם': 2523,
  'מתן בן חמו': 3685,
  'שמעון מלול': 4189, 'לירון פנקר': 4006,
}

// ---------------------------------------------------------------------------
// parseSplitStr (attendance clocks — step=1)
// ---------------------------------------------------------------------------
function parseSplitStr(str: string): string[] {
  if (!str || str.trim() === '') return []
  const parts = str.split('~')
  if (parts[parts.length - 1] === '') parts.pop()
  return parts.filter(p => p.trim() !== '')
}

// ---------------------------------------------------------------------------
// resolveManager — match name to employee or return free-text data
// ---------------------------------------------------------------------------
function resolveManager(
  name: string,
  fileEmail: string,
  filePhone: string,
  empByNumber: Map<number, { id: string; email: string | null; mobile_phone: string | null }>
): ResolvedManager {
  if (!name) {
    return { isEmployee: true, employeeId: null, name: null, email: null, phone: null }
  }

  const empNum = MANUAL_MAP[name]

  // Matched to employee
  if (empNum !== undefined && empNum !== null) {
    const emp = empByNumber.get(empNum)
    if (emp) {
      return {
        isEmployee: true,
        employeeId: emp.id,
        name: null,
        email: emp.email || null,
        phone: normalizePhone(emp.mobile_phone ?? '') || null,
      }
    }
  }

  // Free text
  return {
    isEmployee: false,
    employeeId: null,
    name,
    email: fileEmail || null,
    phone: normalizePhone(filePhone) || filePhone || null,
  }
}

// ---------------------------------------------------------------------------
// fetchAllEmployees — paginate past the 1000-row limit
// ---------------------------------------------------------------------------
async function fetchAllEmployees(admin: ReturnType<typeof createImportClient>) {
  const allEmps: { id: string; employee_number: string; email: string | null; mobile_phone: string | null }[] = []
  let page = 0
  while (true) {
    const { data } = await admin.from('employees')
      .select('id, employee_number, email, mobile_phone')
      .range(page * 1000, (page + 1) * 1000 - 1)
      .order('employee_number')
    if (!data) break
    allEmps.push(...data)
    if (data.length < 1000) break
    page++
  }
  return allEmps
}

// ---------------------------------------------------------------------------
// parseProjectsFile — decode Windows-1255 + parse 50 columns
// ---------------------------------------------------------------------------
function parseProjectsFile(
  buffer: ArrayBuffer,
  empByNumber: Map<number, { id: string; email: string | null; mobile_phone: string | null }>
): { projects: ParsedProject[]; skipped: { deleted: number; noNumber: number; endMarker: number } } {
  const decoder = new TextDecoder('windows-1255')
  const content = decoder.decode(buffer)
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const projects: ParsedProject[] = []
  const skipped = { deleted: 0, noNumber: 0, endMarker: 0 }

  for (const line of lines) {
    const f = line.split(',')

    if (f[0] && f[0].includes('ChemoEndFile')) { skipped.endMarker++; continue }
    if (f[46] && f[46].trim() === '1') { skipped.deleted++; continue }

    const projectNumber = (f[1] || '').trim()
    if (!projectNumber) { skipped.noNumber++; continue }

    // PM
    const pmName = (f[10] || '').trim()
    const pmEmail = (f[11] || '').trim()
    const pmPhone = (f[12] || '').trim()
    const pmNotify = f[13] === '1'
    const pmResolved = resolveManager(pmName, pmEmail, pmPhone, empByNumber)

    // SM
    const smName = (f[14] || '').trim()
    const smEmail = (f[15] || '').trim()
    const smPhone = (f[16] || '').trim()
    const smNotify = f[17] === '1'
    const smResolved = resolveManager(smName, smEmail, smPhone, empByNumber)

    // CVC
    const cvcName = (f[43] || '').trim()
    const cvcPhone = (f[44] || '').trim()
    const cvcResolved = resolveManager(cvcName, '', cvcPhone, empByNumber)

    // Status
    const status = (f[34] || '').trim() === '1' ? 'active' : 'inactive'

    // Type
    let projectType: string | null = null
    if (f[7] === '1') projectType = 'project'
    else if (f[8] === '1') projectType = 'staging_area'
    else if (f[9] === '1') projectType = 'storage_area'

    // Location
    const lat = f[28] ? parseFloat(f[28]) : null
    const lng = f[29] ? parseFloat(f[29]) : null
    const radius = f[30] ? parseInt(f[30], 10) : null

    // Clocks
    const clocks = parseSplitStr(f[35] || '')

    projects.push({
      name: (f[0] || '').trim(),
      project_number: projectNumber,
      description: (f[2] || '').trim() || null,
      client_name: (f[3] || '').trim() || null,
      supervision_company: (f[4] || '').trim() || null,
      expense_number: (f[5] || '').trim() || null,
      project_type: projectType,
      status,
      pm_is_employee: pmResolved.isEmployee,
      project_manager_id: pmResolved.employeeId,
      pm_name: pmResolved.name,
      pm_email: pmResolved.email,
      pm_phone: pmResolved.phone,
      pm_notifications: pmNotify,
      sm_is_employee: smResolved.isEmployee,
      site_manager_id: smResolved.employeeId,
      sm_name: smResolved.name,
      sm_email: smResolved.email,
      sm_phone: smResolved.phone,
      sm_notifications: smNotify,
      cvc_is_employee: cvcResolved.isEmployee,
      camp_vehicle_coordinator_id: cvcResolved.employeeId,
      cvc_name: cvcResolved.name,
      cvc_phone: cvcResolved.phone,
      latitude: isNaN(lat!) ? null : lat,
      longitude: isNaN(lng!) ? null : lng,
      radius: isNaN(radius!) || radius === null ? 100 : radius,
      _clocks: clocks,
      _rawPmName: pmName,
      _rawSmName: smName,
      _rawCvcName: cvcName,
    })
  }

  return { projects, skipped }
}

// ---------------------------------------------------------------------------
// dryRunProjectImport
// ---------------------------------------------------------------------------
async function dryRunProjectImport(buffer: ArrayBuffer): Promise<ProjectDryRunReport> {
  const admin = createImportClient()
  const allEmps = await fetchAllEmployees(admin)

  const empByNumber = new Map<number, { id: string; email: string | null; mobile_phone: string | null }>()
  for (const e of allEmps) empByNumber.set(Number(e.employee_number), e)

  const { projects, skipped } = parseProjectsFile(buffer, empByNumber)

  // Count existing projects in DB
  const projectNumbers = projects.map(p => p.project_number)
  let existingCount = 0
  // Check in batches of 100
  for (let i = 0; i < projectNumbers.length; i += 100) {
    const batch = projectNumbers.slice(i, i + 100)
    const { count } = await admin.from('projects')
      .select('id', { count: 'exact', head: true })
      .in('project_number', batch)
    existingCount += count ?? 0
  }

  // PM free text details
  const pmFreeText = projects
    .filter(p => !p.pm_is_employee && p.pm_name)
    .map(p => ({ name: p.pm_name!, email: p.pm_email ?? '', phone: p.pm_phone ?? '' }))
  const uniquePmFree = [...new Map(pmFreeText.map(f => [f.name, f])).values()]

  // SM free text details
  const smFreeText = projects
    .filter(p => !p.sm_is_employee && p.sm_name)
    .map(p => ({ name: p.sm_name!, email: p.sm_email ?? '', phone: p.sm_phone ?? '' }))
  const uniqueSmFree = [...new Map(smFreeText.map(f => [f.name, f])).values()]

  // Clock count
  const totalClocks = projects.reduce((sum, p) => sum + p._clocks.length, 0)
  const projectsWithClocks = projects.filter(p => p._clocks.length > 0).length

  return {
    totalRows: projects.length + skipped.deleted + skipped.noNumber + skipped.endMarker,
    skippedRows: skipped,
    validRows: projects.length,
    statusBreakdown: {
      active: projects.filter(p => p.status === 'active').length,
      inactive: projects.filter(p => p.status === 'inactive').length,
    },
    typeBreakdown: {
      project: projects.filter(p => p.project_type === 'project').length,
      staging_area: projects.filter(p => p.project_type === 'staging_area').length,
      storage_area: projects.filter(p => p.project_type === 'storage_area').length,
      none: projects.filter(p => !p.project_type).length,
    },
    pm: {
      employee: projects.filter(p => p.pm_is_employee && p.project_manager_id).length,
      freeText: projects.filter(p => !p.pm_is_employee && p.pm_name).length,
      empty: projects.filter(p => !p.project_manager_id && !p.pm_name).length,
      freeTextDetails: uniquePmFree,
    },
    sm: {
      employee: projects.filter(p => p.sm_is_employee && p.site_manager_id).length,
      freeText: projects.filter(p => !p.sm_is_employee && p.sm_name).length,
      empty: projects.filter(p => !p.site_manager_id && !p.sm_name).length,
      freeTextDetails: uniqueSmFree,
    },
    cvc: {
      employee: projects.filter(p => p.cvc_is_employee && p.camp_vehicle_coordinator_id).length,
      freeText: projects.filter(p => !p.cvc_is_employee && p.cvc_name).length,
      empty: projects.filter(p => !p.camp_vehicle_coordinator_id && !p.cvc_name).length,
    },
    clocksTotal: totalClocks,
    projectsWithClocks,
    existing: existingCount,
    toInsert: projects.length - existingCount,
  }
}

// ---------------------------------------------------------------------------
// executeProjectImport
// ---------------------------------------------------------------------------
async function executeProjectImport(buffer: ArrayBuffer): Promise<ProjectImportResult> {
  const admin = createImportClient()
  const allEmps = await fetchAllEmployees(admin)

  const empByNumber = new Map<number, { id: string; email: string | null; mobile_phone: string | null }>()
  for (const e of allEmps) empByNumber.set(Number(e.employee_number), e)

  const { projects } = parseProjectsFile(buffer, empByNumber)

  let inserted = 0
  let updated = 0
  let clocksInserted = 0
  const errors: string[] = []

  // ── Fetch ALL existing projects in one query (instead of per-project) ──
  const projectNumbers = projects.map(p => p.project_number)
  const existingMap = new Map<string, string>() // project_number → id

  // Fetch in batches of 100 (Supabase .in() limit)
  for (let i = 0; i < projectNumbers.length; i += 100) {
    const batch = projectNumbers.slice(i, i + 100)
    const { data } = await admin.from('projects')
      .select('id, project_number')
      .in('project_number', batch)
    for (const row of data ?? []) {
      existingMap.set(row.project_number, row.id)
    }
  }

  for (const p of projects) {
    const clocks = p._clocks
    const row: Record<string, unknown> = {
      name: p.name,
      project_number: p.project_number,
      description: p.description,
      client_name: p.client_name,
      supervision_company: p.supervision_company,
      expense_number: p.expense_number,
      project_type: p.project_type,
      status: p.status,
      pm_is_employee: p.pm_is_employee,
      project_manager_id: p.project_manager_id,
      pm_name: p.pm_name,
      pm_email: p.pm_email,
      pm_phone: p.pm_phone,
      pm_notifications: p.pm_notifications,
      sm_is_employee: p.sm_is_employee,
      site_manager_id: p.site_manager_id,
      sm_name: p.sm_name,
      sm_email: p.sm_email,
      sm_phone: p.sm_phone,
      sm_notifications: p.sm_notifications,
      cvc_is_employee: p.cvc_is_employee,
      camp_vehicle_coordinator_id: p.camp_vehicle_coordinator_id,
      cvc_name: p.cvc_name,
      cvc_phone: p.cvc_phone,
      latitude: p.latitude,
      longitude: p.longitude,
      radius: p.radius,
      deleted_at: null,  // resurrect soft-deleted projects
    }

    const existingId = existingMap.get(p.project_number)
    let projectId: string | undefined

    if (existingId) {
      const { data, error } = await admin.from('projects')
        .update(row)
        .eq('id', existingId)
        .select('id')
        .single()

      if (error) {
        errors.push(`UPDATE ${p.project_number} ${p.name}: ${error.message}`)
        continue
      }
      projectId = data.id
      updated++
    } else {
      const { data, error } = await admin.from('projects')
        .insert(row)
        .select('id')
        .single()

      if (error) {
        errors.push(`INSERT ${p.project_number} ${p.name}: ${error.message}`)
        continue
      }
      projectId = data.id
      inserted++
    }

    // Replace-all attendance clocks
    if (projectId) {
      await admin.from('attendance_clocks').delete().eq('project_id', projectId)

      if (clocks.length > 0) {
        const clockRows = clocks.map(clockId => ({
          project_id: projectId!,
          clock_id: clockId.trim(),
        }))
        const { error: clockErr } = await admin.from('attendance_clocks').insert(clockRows)
        if (clockErr) {
          errors.push(`Clocks ${p.project_number}: ${clockErr.message}`)
        } else {
          clocksInserted += clocks.length
        }
      }
    }
  }

  revalidatePath('/admin/projects')

  return {
    success: errors.length === 0,
    inserted,
    updated,
    errors,
    clocksInserted,
  }
}

// ---------------------------------------------------------------------------
// Server Action wrappers (FormData → Buffer → core function)
// ---------------------------------------------------------------------------

export type DryRunActionResult = {
  success: boolean
  report?: ProjectDryRunReport
  error?: string
}

export async function dryRunProjectImportAction(
  formData: FormData
): Promise<DryRunActionResult> {
  await verifySession()

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'לא נבחר קובץ' }
  if (!file.name.toLowerCase().endsWith('.top')) {
    return { success: false, error: 'הקובץ חייב להיות בסיומת .top' }
  }

  try {
    const buffer = await file.arrayBuffer()
    const report = await dryRunProjectImport(buffer)
    return { success: true, report }
  } catch (err) {
    console.error('[dryRunProjectImport] Error:', err)
    return { success: false, error: String(err) }
  }
}

export async function executeProjectImportAction(
  formData: FormData
): Promise<ProjectImportResult> {
  await verifySession()

  const file = formData.get('file') as File | null
  if (!file) return { success: false, inserted: 0, updated: 0, errors: ['לא נבחר קובץ'], clocksInserted: 0 }

  try {
    const buffer = await file.arrayBuffer()
    return await executeProjectImport(buffer)
  } catch (err) {
    console.error('[executeProjectImport] Error:', err)
    return { success: false, inserted: 0, updated: 0, errors: [String(err)], clocksInserted: 0 }
  }
}
