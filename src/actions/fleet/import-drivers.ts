'use server'

/**
 * import-drivers.ts — Import drivers from legacy Drivers.top file.
 *
 * Flow:
 *   1. parseDriversFile(buffer) — decode Windows-1255, parse 50 columns
 *   2. dryRunDriverImport()     — match to employees, generate report
 *   3. executeDriverImport()    — insert into drivers/licenses/documents (after approval)
 *
 * Guard: verifySession() — admin only (not app user).
 * Uses: createAdminClient() — bypasses RLS for bulk inserts.
 */

import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/dal'
import { normalizePhone, lbSerialToDate } from '@/lib/format'

/**
 * Untyped admin client for import operations.
 * The typed createAdminClient uses Database generics that may not include
 * new columns (category_issue_years) until types are regenerated post-migration.
 */
function createImportClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ParsedDriver = {
  rowIndex: number
  employeeNumber: string
  driverName: string
  licenseNumber: string | null
  licenseCategories: string[]
  categoryIssueYears: Record<string, number>
  licenseExpiryDate: string | null  // yyyy-mm-dd
  notes: string | null
  phone: string | null
  companyCode: string
  driverFileOpenDate: string | null // yyyy-mm-dd
  documents: ParsedDocument[]
  isEquipmentOperator: boolean
}

type ParsedDocument = {
  isActive: boolean
  name: string
  expiryDate: string | null
  alertOnExpiry: boolean
}

export type DryRunReport = {
  totalRows: number
  skippedRows: {
    skipFlag: number
    templateRows: number
    exPrefix: number
    emptyNumber: number
  }
  validRows: number
  matched: {
    total: number
    toInsert: number
    toUpdate: number
  }
  unmatched: {
    total: number
    details: { empNum: string; name: string; company: string; reason: string }[]
  }
  dataQuality: {
    invalidDates: { empNum: string; field: string; rawValue: string }[]
    unknownCategories: { empNum: string; grade: string }[]
    phonesToImport: { empNum: string; phone: string; existingPhone: string | null }[]
  }
  documents: {
    totalDocuments: number
    activeDocuments: number
    inactiveDocuments: number
    uniqueNames: { name: string; count: number }[]
  }
  licensesSummary: {
    withNumber: number
    withCategories: number
    withExpiryDate: number
  }
  equipmentOperators: number
  // The matched drivers ready for import (used by executeDriverImport)
  importReady: ImportReadyDriver[]
}

type ImportReadyDriver = {
  parsed: ParsedDriver
  employeeId: string
  phoneOverride: string | null  // only if different from employee phone
  mode: 'insert' | 'update'
  existingDriverId?: string     // set when mode='update'
}

// ─────────────────────────────────────────────────────────────
// Pagination helper (Supabase limits to 1000 rows per request)
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows(client: any, table: string, select: string): Promise<any[]> {
  const PAGE = 1000
  const all: unknown[] = []
  let offset = 0
  while (true) {
    const { data } = await client.from(table).select(select).range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  'A1', 'A2', 'A', 'B', 'C1', 'C', 'CE', 'D1', 'D2', 'D3', 'D',
  'M',  // מלגזה (forklift)
  'N',  // מכונה ניידת (mobile machine)
])

const COMPANY_NAMES: Record<string, string> = {
  '1': 'חמו אהרון',
  '2': 'טקסה',
  '3': 'וולדבוט',
  '4': 'קבלנים',
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

// lbSerialToDate imported from format.ts — all .top files use Liberty Basic serial dates

/** Parse SplitStr: tilde-delimited groups of `step` fields */
function parseSplitStr(raw: string, step: number): string[][] {
  if (!raw || raw.trim() === '') return []
  const parts = raw.split('~')
  if (parts[parts.length - 1] === '') parts.pop()
  const result: string[][] = []
  for (let i = 0; i < parts.length; i += step) {
    const group: string[] = []
    for (let j = 0; j < step && (i + j) < parts.length; j++) {
      group.push(parts[i + j] ?? '')
    }
    result.push(group)
  }
  return result
}

/** Parse license grades from col[3] SplitStr step=2 */
function parseLicenseGrades(raw: string): { categories: string[]; categoryYears: Record<string, number> } {
  const groups = parseSplitStr(raw, 2)
  const categories: string[] = []
  const categoryYears: Record<string, number> = {}

  for (const [grade, yearStr] of groups) {
    if (!grade?.trim()) continue
    const normalized = grade.trim() === 'C+E' ? 'CE' : grade.trim()
    // Skip "1" — it's a flag, not a license category
    if (!VALID_CATEGORIES.has(normalized)) continue
    if (!categories.includes(normalized)) {
      categories.push(normalized)
    }
    if (yearStr?.trim()) {
      const year = parseInt(yearStr.trim(), 10)
      if (!isNaN(year) && year > 1950 && year <= 2060) {
        categoryYears[normalized] = year
      }
    }
  }

  return { categories, categoryYears }
}

/** Parse documents from col[25] SplitStr step=4 */
function parseDocuments(raw: string): ParsedDocument[] {
  const groups = parseSplitStr(raw, 4)
  const docs: ParsedDocument[] = []

  for (const [isActiveStr, name, expiryStr, alertStr] of groups) {
    if (!name?.trim()) continue
    docs.push({
      isActive: isActiveStr === '1',
      name: name.trim(),
      expiryDate: expiryStr?.trim() ? lbSerialToDate(parseInt(expiryStr.trim(), 10)) : null,
      alertOnExpiry: alertStr === '1',
    })
  }

  return docs
}

// ─────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────

export type ParseResult = {
  parsed: ParsedDriver[]
  skipped: { skipFlag: number; templateRows: number; exPrefix: number; emptyNumber: number }
  invalidDates: { empNum: string; field: string; rawValue: string }[]
  unknownCategories: { empNum: string; grade: string }[]
}

/** Parse Drivers.top buffer (Windows-1255 encoded) */
export async function parseDriversFile(buffer: Buffer): Promise<ParseResult> {
  const decoder = new TextDecoder('windows-1255')
  const text = decoder.decode(buffer)
  const lines = text.split(/\r?\n/).filter((l) => l.trim())

  const parsed: ParsedDriver[] = []
  const skipped = { skipFlag: 0, templateRows: 0, exPrefix: 0, emptyNumber: 0 }
  const invalidDates: ParseResult['invalidDates'] = []
  const unknownCategories: ParseResult['unknownCategories'] = []

  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].split(',')
    const empNum = (f[0] ?? '').trim()

    // Skip conditions
    if (!empNum) { skipped.emptyNumber++; continue }
    if (empNum === '0') { skipped.templateRows++; continue }
    if ((f[16] ?? '').trim() !== '') { skipped.skipFlag++; continue }
    if (empNum.startsWith('EX-') || empNum.startsWith('EX')) { skipped.exPrefix++; continue }

    // License
    const { categories, categoryYears } = parseLicenseGrades(f[3] ?? '')

    // Check for unknown categories in raw data (for report)
    if (f[3]) {
      const groups = parseSplitStr(f[3], 2)
      for (const [grade] of groups) {
        if (!grade?.trim()) continue
        const norm = grade.trim() === 'C+E' ? 'CE' : grade.trim()
        if (!VALID_CATEGORIES.has(norm) && grade.trim() !== '1') {
          unknownCategories.push({ empNum, grade: grade.trim() })
        }
      }
    }

    // Dates
    const rawLicExpiry = (f[4] ?? '').trim()
    const licExpirySerial = rawLicExpiry ? parseInt(rawLicExpiry, 10) : null
    const licenseExpiryDate = licExpirySerial ? lbSerialToDate(licExpirySerial) : null
    if (licExpirySerial && !licenseExpiryDate) {
      invalidDates.push({ empNum, field: 'licenseExpiryDate', rawValue: rawLicExpiry })
    }

    const rawOpenDate = (f[24] ?? '').trim()
    const openDateSerial = rawOpenDate ? parseInt(rawOpenDate, 10) : null
    const driverFileOpenDate = openDateSerial ? lbSerialToDate(openDateSerial) : null
    if (openDateSerial && !driverFileOpenDate) {
      invalidDates.push({ empNum, field: 'driverFileOpenDate', rawValue: rawOpenDate })
    }

    parsed.push({
      rowIndex: i + 1,
      employeeNumber: empNum,
      driverName: (f[1] ?? '').trim(),
      licenseNumber: (f[2] ?? '').trim() || null,
      licenseCategories: categories,
      categoryIssueYears: categoryYears,
      licenseExpiryDate,
      notes: f[6] ? f[6].replace(/\^/g, '\n').trim() || null : null,
      phone: normalizePhone((f[7] ?? '').trim()),
      companyCode: (f[15] ?? '').trim() || '1',
      driverFileOpenDate,
      documents: parseDocuments(f[25] ?? ''),
      isEquipmentOperator: (f[39] ?? '').trim() === '1',
    })
  }

  return { parsed, skipped, invalidDates, unknownCategories }
}

// ─────────────────────────────────────────────────────────────
// Dry-Run
// ─────────────────────────────────────────────────────────────

/** Run dry-run: parse file, match employees, produce report (no writes) */
export async function dryRunDriverImport(fileBuffer: Buffer): Promise<DryRunReport> {
  await verifySession()
  const admin = createImportClient()

  // 1. Parse file
  const { parsed, skipped, invalidDates, unknownCategories } = await parseDriversFile(fileBuffer)

  // 2. Fetch companies
  const { data: companies } = await admin
    .from('companies')
    .select('id, name, internal_number')
    .is('deleted_at', null)

  // Build company code → UUID map using internal_number
  const companyMap = new Map<string, string>()
  for (const c of companies ?? []) {
    companyMap.set(c.internal_number, c.id)
  }

  // 3. Fetch all employees (including inactive — legacy drivers may belong to former employees)
  // Paginate: Supabase limits to 1000 rows per request
  const employees = await fetchAllRows(admin, 'employees', 'id, employee_number, company_id, mobile_phone, status, deleted_at')

  // Build lookup: "empNumber__companyId" → employee
  const empLookup = new Map<string, { id: string; phone: string | null }>()
  // Also build a simpler lookup by just empNumber (for cases where company matching fails)
  const empByNumber = new Map<string, { id: string; phone: string | null; companyId: string }[]>()
  for (const e of employees ?? []) {
    const key = `${e.employee_number}__${e.company_id}`
    empLookup.set(key, { id: e.id, phone: e.mobile_phone })
    const list = empByNumber.get(e.employee_number) ?? []
    list.push({ id: e.id, phone: e.mobile_phone, companyId: e.company_id })
    empByNumber.set(e.employee_number, list)
  }

  // 4. Fetch existing drivers (including soft-deleted, to handle upsert)
  const existingDriversAll = await fetchAllRows(admin, 'drivers', 'id, employee_id, deleted_at')
  // Map: employee_id → { id, deleted_at }
  const existingDriverMap = new Map<string, { id: string; deletedAt: string | null }>()
  for (const d of existingDriversAll) {
    // Prefer active over soft-deleted
    const existing = existingDriverMap.get(d.employee_id)
    if (!existing || (existing.deletedAt && !d.deleted_at)) {
      existingDriverMap.set(d.employee_id, { id: d.id, deletedAt: d.deleted_at })
    }
  }

  // 5. Match each parsed driver
  const matched: ImportReadyDriver[] = []
  const unmatched: DryRunReport['unmatched']['details'] = []
  const phonesToImport: DryRunReport['dataQuality']['phonesToImport'] = []
  let toInsert = 0
  let toUpdate = 0

  for (const p of parsed) {
    const companyId = companyMap.get(p.companyCode)
    if (!companyId) {
      unmatched.push({
        empNum: p.employeeNumber,
        name: p.driverName,
        company: COMPANY_NAMES[p.companyCode] ?? `קוד ${p.companyCode}`,
        reason: `חברה לא מזוהה (קוד ${p.companyCode})`,
      })
      continue
    }

    // Try exact match: empNumber + companyId
    const key = `${p.employeeNumber}__${companyId}`
    let emp = empLookup.get(key)

    // Fallback: if only one employee with this number exists, use it
    if (!emp) {
      const candidates = empByNumber.get(p.employeeNumber)
      if (candidates?.length === 1) {
        emp = { id: candidates[0].id, phone: candidates[0].phone }
      }
    }

    if (!emp) {
      unmatched.push({
        empNum: p.employeeNumber,
        name: p.driverName,
        company: COMPANY_NAMES[p.companyCode] ?? `קוד ${p.companyCode}`,
        reason: 'עובד לא נמצא בטבלת employees',
      })
      continue
    }

    // Phone override logic
    let phoneOverride: string | null = null
    if (p.phone) {
      if (!emp.phone || emp.phone !== p.phone) {
        phoneOverride = p.phone
        phonesToImport.push({
          empNum: p.employeeNumber,
          phone: p.phone,
          existingPhone: emp.phone,
        })
      }
    }

    // Determine mode: insert vs update
    const existingDriver = existingDriverMap.get(emp.id)
    if (existingDriver && !existingDriver.deletedAt) {
      // Active driver exists → update
      toUpdate++
      matched.push({ parsed: p, employeeId: emp.id, phoneOverride, mode: 'update', existingDriverId: existingDriver.id })
    } else {
      // No driver or soft-deleted → insert (soft-deleted will be hard-deleted first)
      toInsert++
      matched.push({ parsed: p, employeeId: emp.id, phoneOverride, mode: 'insert', existingDriverId: existingDriver?.id })
    }
  }

  // 6. Document stats
  let totalDocs = 0
  let activeDocs = 0
  let inactiveDocs = 0
  const docNameCounts = new Map<string, number>()

  for (const m of matched) {
    for (const doc of m.parsed.documents) {
      totalDocs++
      if (doc.isActive) activeDocs++
      else inactiveDocs++
      docNameCounts.set(doc.name, (docNameCounts.get(doc.name) ?? 0) + 1)
    }
  }

  const uniqueNames = [...docNameCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // 7. License stats
  let withNumber = 0
  let withCategories = 0
  let withExpiryDate = 0
  for (const m of matched) {
    if (m.parsed.licenseNumber) withNumber++
    if (m.parsed.licenseCategories.length > 0) withCategories++
    if (m.parsed.licenseExpiryDate) withExpiryDate++
  }

  return {
    totalRows: parsed.length + skipped.skipFlag + skipped.templateRows + skipped.exPrefix + skipped.emptyNumber,
    skippedRows: skipped,
    validRows: parsed.length,
    matched: {
      total: matched.length,
      toInsert,
      toUpdate,
    },
    unmatched: {
      total: unmatched.length,
      details: unmatched,
    },
    dataQuality: {
      invalidDates,
      unknownCategories,
      phonesToImport,
    },
    documents: {
      totalDocuments: totalDocs,
      activeDocuments: activeDocs,
      inactiveDocuments: inactiveDocs,
      uniqueNames,
    },
    licensesSummary: { withNumber, withCategories, withExpiryDate },
    equipmentOperators: matched.filter((m) => m.parsed.isEquipmentOperator).length,
    importReady: matched,
  }
}

// ─────────────────────────────────────────────────────────────
// Execute Import
// ─────────────────────────────────────────────────────────────

export type ImportResult = {
  success: boolean
  driversCreated: number
  driversUpdated: number
  licensesCreated: number
  licensesUpdated: number
  documentsCreated: number
  documentsUpdated: number
  documentNamesUpserted: number
  errors: string[]
}

/** Execute the actual import. Must be called after dry-run approval. */
export async function executeDriverImport(fileBuffer: Buffer): Promise<ImportResult> {
  const { userId } = await verifySession()
  const admin = createImportClient()

  // Parse file once (dry-run already ran on client side — no need to repeat)
  const { parsed: allParsed } = await parseDriversFile(fileBuffer)

  const result: ImportResult = {
    success: true,
    driversCreated: 0,
    driversUpdated: 0,
    licensesCreated: 0,
    licensesUpdated: 0,
    documentsCreated: 0,
    documentsUpdated: 0,
    documentNamesUpserted: 0,
    errors: [],
  }

  // ── 1. Fetch ALL lookup tables in parallel ──
  const [companiesResult, employees, existingDriversAll] = await Promise.all([
    admin.from('companies').select('id, name, internal_number').is('deleted_at', null),
    fetchAllRows(admin, 'employees', 'id, employee_number, company_id, mobile_phone, status, deleted_at'),
    fetchAllRows(admin, 'drivers', 'id, employee_id, deleted_at'),
  ])

  // Build company code → UUID map
  const companyMap = new Map<string, string>()
  for (const c of companiesResult.data ?? []) {
    companyMap.set(c.internal_number, c.id)
  }

  // Build employee lookups
  const empLookup = new Map<string, { id: string; phone: string | null }>()
  const empByNumber = new Map<string, { id: string; phone: string | null; companyId: string }[]>()
  for (const e of employees) {
    const key = `${e.employee_number}__${e.company_id}`
    empLookup.set(key, { id: e.id, phone: e.mobile_phone })
    const list = empByNumber.get(e.employee_number) ?? []
    list.push({ id: e.id, phone: e.mobile_phone, companyId: e.company_id })
    empByNumber.set(e.employee_number, list)
  }

  // Build existing driver map
  const existingDriverMap = new Map<string, { id: string; deletedAt: string | null }>()
  for (const d of existingDriversAll) {
    const existing = existingDriverMap.get(d.employee_id)
    if (!existing || (existing.deletedAt && !d.deleted_at)) {
      existingDriverMap.set(d.employee_id, { id: d.id, deletedAt: d.deleted_at })
    }
  }

  // ── 2. Match parsed drivers to employees (same logic as dry-run) ──
  type ImportReadyItem = { parsed: ParsedDriver; employeeId: string; phoneOverride: string | null; mode: 'insert' | 'update'; existingDriverId?: string }
  const importReady: ImportReadyItem[] = []

  for (const p of allParsed) {
    const companyId = companyMap.get(p.companyCode)
    if (!companyId) continue

    const key = `${p.employeeNumber}__${companyId}`
    let emp = empLookup.get(key)
    if (!emp) {
      const candidates = empByNumber.get(p.employeeNumber)
      if (candidates?.length === 1) emp = { id: candidates[0].id, phone: candidates[0].phone }
    }
    if (!emp) continue

    let phoneOverride: string | null = null
    if (p.phone && (!emp.phone || emp.phone !== p.phone)) {
      phoneOverride = p.phone
    }

    const existingDriver = existingDriverMap.get(emp.id)
    if (existingDriver && !existingDriver.deletedAt) {
      importReady.push({ parsed: p, employeeId: emp.id, phoneOverride, mode: 'update', existingDriverId: existingDriver.id })
    } else {
      importReady.push({ parsed: p, employeeId: emp.id, phoneOverride, mode: 'insert', existingDriverId: existingDriver?.id })
    }
  }

  // ── 3. Process each driver ──
  for (const item of importReady) {
    const { parsed, employeeId, phoneOverride, mode, existingDriverId } = item

    let driverId: string

    if (mode === 'update' && existingDriverId) {
      // ── UPDATE existing active driver ──
      const { error: updateErr } = await admin
        .from('drivers')
        .update({
          phone_override: phoneOverride,
          is_equipment_operator: parsed.isEquipmentOperator,
          opened_at: parsed.driverFileOpenDate ?? undefined,
          notes: parsed.notes,
          updated_by: userId,
        })
        .eq('id', existingDriverId)

      if (updateErr) {
        result.errors.push(`עדכון נהג ${parsed.employeeNumber} (${parsed.driverName}): ${updateErr.message}`)
        continue
      }
      result.driversUpdated++
      driverId = existingDriverId

      // Update license: upsert (delete old + insert new)
      if (parsed.licenseNumber || parsed.licenseCategories.length > 0 || parsed.licenseExpiryDate) {
        await admin.from('driver_licenses').delete().eq('driver_id', driverId)
        const { error: licErr } = await admin
          .from('driver_licenses')
          .insert({
            driver_id: driverId,
            license_number: parsed.licenseNumber,
            license_categories: parsed.licenseCategories,
            category_issue_years: parsed.categoryIssueYears,
            expiry_date: parsed.licenseExpiryDate,
            created_by: userId,
            updated_by: userId,
          })
        if (licErr) {
          result.errors.push(`רשיון נהג ${parsed.employeeNumber}: ${licErr.message}`)
        } else {
          result.licensesUpdated++
        }
      }

      // Batch documents: delete all + re-insert as batch
      await admin.from('driver_documents').delete().eq('driver_id', driverId)
      if (parsed.documents.length > 0) {
        const docRows = parsed.documents.map(doc => ({
          driver_id: driverId,
          document_name: doc.name,
          expiry_date: doc.expiryDate,
          alert_enabled: doc.alertOnExpiry,
          deleted_at: doc.isActive ? null : new Date().toISOString(),
          created_by: userId,
          updated_by: userId,
        }))
        const { error: docErr } = await admin.from('driver_documents').insert(docRows)
        if (docErr) {
          result.errors.push(`מסמכים נהג ${parsed.employeeNumber}: ${docErr.message}`)
        } else {
          result.documentsUpdated += docRows.length
        }
      }

    } else {
      // ── INSERT new driver ──

      // If soft-deleted driver exists, hard-delete it first — in parallel
      if (existingDriverId) {
        await Promise.all([
          admin.from('driver_violations').delete().eq('driver_id', existingDriverId),
          admin.from('driver_documents').delete().eq('driver_id', existingDriverId),
          admin.from('driver_licenses').delete().eq('driver_id', existingDriverId),
        ])
        await admin.from('drivers').delete().eq('id', existingDriverId)
      }

      const { data: driverRow, error: driverErr } = await admin
        .from('drivers')
        .insert({
          employee_id: employeeId,
          phone_override: phoneOverride,
          is_occasional_camp_driver: false,
          is_equipment_operator: parsed.isEquipmentOperator,
          opened_at: parsed.driverFileOpenDate ?? new Date().toISOString().split('T')[0],
          notes: parsed.notes,
          created_by: userId,
          updated_by: userId,
        })
        .select('id')
        .single()

      if (driverErr || !driverRow) {
        result.errors.push(`נהג ${parsed.employeeNumber} (${parsed.driverName}): ${driverErr?.message ?? 'שגיאה לא ידועה'}`)
        continue
      }
      result.driversCreated++
      driverId = driverRow.id

      // Insert license
      if (parsed.licenseNumber || parsed.licenseCategories.length > 0 || parsed.licenseExpiryDate) {
        const { error: licErr } = await admin
          .from('driver_licenses')
          .insert({
            driver_id: driverId,
            license_number: parsed.licenseNumber,
            license_categories: parsed.licenseCategories,
            category_issue_years: parsed.categoryIssueYears,
            expiry_date: parsed.licenseExpiryDate,
            created_by: userId,
            updated_by: userId,
          })
        if (licErr) {
          result.errors.push(`רשיון נהג ${parsed.employeeNumber}: ${licErr.message}`)
        } else {
          result.licensesCreated++
        }
      }

      // Batch insert documents
      if (parsed.documents.length > 0) {
        const docRows = parsed.documents.map(doc => ({
          driver_id: driverId,
          document_name: doc.name,
          expiry_date: doc.expiryDate,
          alert_enabled: doc.alertOnExpiry,
          deleted_at: doc.isActive ? null : new Date().toISOString(),
          created_by: userId,
          updated_by: userId,
        }))
        const { error: docErr } = await admin.from('driver_documents').insert(docRows)
        if (docErr) {
          result.errors.push(`מסמכים נהג ${parsed.employeeNumber}: ${docErr.message}`)
        } else {
          result.documentsCreated += docRows.length
        }
      }
    }
  }

  // 4. Batch upsert document names — all RPC calls in parallel
  const allDocNames = new Set<string>()
  for (const item of importReady) {
    for (const doc of item.parsed.documents) {
      allDocNames.add(doc.name)
    }
  }

  if (allDocNames.size > 0) {
    const rpcResults = await Promise.all(
      [...allDocNames].map(name => admin.rpc('increment_document_name_usage', { p_name: name }))
    )
    result.documentNamesUpserted = rpcResults.filter(r => !r.error).length
  }

  if (result.errors.length > 0) {
    result.success = false
  }

  return result
}

// ─────────────────────────────────────────────────────────────
// Server Actions for UI (FormData-based)
// ─────────────────────────────────────────────────────────────

export type DryRunActionResult = {
  success: boolean
  report?: DryRunReport
  error?: string
}

/** Server Action: dry-run from uploaded file */
export async function dryRunDriverImportAction(formData: FormData): Promise<DryRunActionResult> {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { success: false, error: 'לא נבחר קובץ' }
    }
    if (!file.name.toLowerCase().endsWith('.top')) {
      return { success: false, error: 'יש לבחור קובץ .top' }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const report = await dryRunDriverImport(buffer)
    return { success: true, report }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'שגיאה לא ידועה' }
  }
}

/** Server Action: execute import from uploaded file */
export async function executeDriverImportAction(formData: FormData): Promise<ImportResult> {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { success: false, driversCreated: 0, driversUpdated: 0, licensesCreated: 0, licensesUpdated: 0, documentsCreated: 0, documentsUpdated: 0, documentNamesUpserted: 0, errors: ['לא נבחר קובץ'] }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    return await executeDriverImport(buffer)
  } catch (err) {
    return { success: false, driversCreated: 0, driversUpdated: 0, licensesCreated: 0, licensesUpdated: 0, documentsCreated: 0, documentsUpdated: 0, documentNamesUpserted: 0, errors: [err instanceof Error ? err.message : 'שגיאה לא ידועה'] }
  }
}
