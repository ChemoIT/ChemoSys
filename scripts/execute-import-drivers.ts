/**
 * Standalone EXECUTE script for driver import.
 * Reads demo_files/Drivers.top, re-runs dry-run matching, then inserts into DB.
 *
 * Usage: npx tsx scripts/execute-import-drivers.ts
 *
 * Bypasses verifySession() — uses SUPABASE_SERVICE_ROLE_KEY directly.
 * Uses a hardcoded userId for created_by/updated_by (first admin user).
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Load .env.local ──────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx < 0) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
  if (!process.env[key]) process.env[key] = val
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars in .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

// ─── Copy of parser + helpers (same as dry-run-drivers.ts) ────────

const VALID_CATEGORIES = new Set([
  'A1', 'A2', 'A', 'B', 'C1', 'C', 'CE', 'D1', 'D2', 'D3', 'D', 'M', 'N',
])

const COMPANY_NAMES: Record<string, string> = {
  '1': 'חמו אהרון',
  '2': 'טקסה',
  '3': 'וולדבוט',
  '4': 'קבלנים',
}

function serialToDate(serial: number): string | null {
  if (!serial || serial < 1) return null
  const ms = (serial - 25569) * 86400 * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  const year = d.getFullYear()
  if (year < 1990 || year > 2060) return null
  return d.toISOString().split('T')[0]
}

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

function parseLicenseGrades(raw: string): { categories: string[]; categoryYears: Record<string, number> } {
  const groups = parseSplitStr(raw, 2)
  const categories: string[] = []
  const categoryYears: Record<string, number> = {}
  for (const [grade, yearStr] of groups) {
    if (!grade?.trim()) continue
    const normalized = grade.trim() === 'C+E' ? 'CE' : grade.trim()
    if (!VALID_CATEGORIES.has(normalized)) continue
    if (!categories.includes(normalized)) categories.push(normalized)
    if (yearStr?.trim()) {
      const year = parseInt(yearStr.trim(), 10)
      if (!isNaN(year) && year > 1950 && year <= 2060) categoryYears[normalized] = year
    }
  }
  return { categories, categoryYears }
}

type ParsedDocument = { isActive: boolean; name: string; expiryDate: string | null; alertOnExpiry: boolean }

function parseDocuments(raw: string): ParsedDocument[] {
  const groups = parseSplitStr(raw, 4)
  const docs: ParsedDocument[] = []
  for (const [isActiveStr, name, expiryStr, alertStr] of groups) {
    if (!name?.trim()) continue
    docs.push({
      isActive: isActiveStr === '1',
      name: name.trim(),
      expiryDate: expiryStr?.trim() ? serialToDate(parseInt(expiryStr.trim(), 10)) : null,
      alertOnExpiry: alertStr === '1',
    })
  }
  return docs
}

type ParsedDriver = {
  rowIndex: number
  employeeNumber: string
  driverName: string
  licenseNumber: string | null
  licenseCategories: string[]
  categoryIssueYears: Record<string, number>
  licenseExpiryDate: string | null
  notes: string | null
  phone: string | null
  companyCode: string
  driverFileOpenDate: string | null
  documents: ParsedDocument[]
  isEquipmentOperator: boolean
}

function parseDriversFile(buffer: Buffer) {
  const decoder = new TextDecoder('windows-1255')
  const text = decoder.decode(buffer)
  const lines = text.split(/\r?\n/).filter((l) => l.trim())

  const parsed: ParsedDriver[] = []
  const skipped = { skipFlag: 0, templateRows: 0, exPrefix: 0, emptyNumber: 0 }

  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].split(',')
    const empNum = (f[0] ?? '').trim()

    if (!empNum) { skipped.emptyNumber++; continue }
    if (empNum === '0') { skipped.templateRows++; continue }
    if ((f[16] ?? '').trim() !== '') { skipped.skipFlag++; continue }
    if (empNum.startsWith('EX-') || empNum.startsWith('EX')) { skipped.exPrefix++; continue }

    const { categories, categoryYears } = parseLicenseGrades(f[3] ?? '')

    const rawLicExpiry = (f[4] ?? '').trim()
    const licExpirySerial = rawLicExpiry ? parseInt(rawLicExpiry, 10) : null
    const licenseExpiryDate = licExpirySerial ? serialToDate(licExpirySerial) : null

    const rawOpenDate = (f[24] ?? '').trim()
    const openDateSerial = rawOpenDate ? parseInt(rawOpenDate, 10) : null
    const driverFileOpenDate = openDateSerial ? serialToDate(openDateSerial) : null

    parsed.push({
      rowIndex: i + 1,
      employeeNumber: empNum,
      driverName: (f[1] ?? '').trim(),
      licenseNumber: (f[2] ?? '').trim() || null,
      licenseCategories: categories,
      categoryIssueYears: categoryYears,
      licenseExpiryDate,
      notes: f[6] ? f[6].replace(/\^/g, '\n').trim() || null : null,
      phone: (f[7] ?? '').trim() || null,
      companyCode: (f[15] ?? '').trim() || '1',
      driverFileOpenDate,
      documents: parseDocuments(f[25] ?? ''),
      isEquipmentOperator: (f[39] ?? '').trim() === '1',
    })
  }

  return { parsed, skipped }
}

// ─── Pagination helper ────────────────────────────────────────────

async function fetchAllRows(table: string, select: string) {
  const PAGE = 1000
  const all: any[] = []
  let offset = 0
  while (true) {
    const { data } = await admin.from(table).select(select).range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  const filePath = path.join(__dirname, '..', 'demo_files', 'Drivers.top')
  const buffer = fs.readFileSync(filePath)

  console.log('=== DRIVER IMPORT — EXECUTE ===\n')

  // 1. Parse
  const { parsed, skipped } = parseDriversFile(Buffer.from(buffer))
  const totalRows = parsed.length + skipped.skipFlag + skipped.templateRows + skipped.exPrefix + skipped.emptyNumber
  console.log(`שורות: ${totalRows} סה"כ, ${parsed.length} תקפות\n`)

  // 2. Get first user — for created_by/updated_by (references auth.users(id))
  const { data: users, error: userErr } = await admin
    .from('users')
    .select('id, auth_user_id')
    .is('deleted_at', null)
    .limit(1)

  if (userErr || !users || users.length === 0) {
    console.error('לא נמצא משתמש בDB:', userErr?.message)
    process.exit(1)
  }
  const userId = users[0].auth_user_id
  console.log(`User auth_user_id: ${userId.slice(0, 8)}...\n`)

  // 3. Fetch companies
  const { data: companies } = await admin
    .from('companies')
    .select('id, name, internal_number')
    .is('deleted_at', null)

  const companyMap = new Map<string, string>()
  for (const c of companies ?? []) {
    companyMap.set(c.internal_number, c.id)
  }

  // 4. Fetch all employees
  const employees = await fetchAllRows('employees', 'id, employee_number, company_id, mobile_phone')

  const empLookup = new Map<string, { id: string; phone: string | null }>()
  const empByNumber = new Map<string, { id: string; phone: string | null; companyId: string }[]>()
  for (const e of employees) {
    const key = `${e.employee_number}__${e.company_id}`
    empLookup.set(key, { id: e.id, phone: e.mobile_phone })
    const list = empByNumber.get(e.employee_number) ?? []
    list.push({ id: e.id, phone: e.mobile_phone, companyId: e.company_id })
    empByNumber.set(e.employee_number, list)
  }
  console.log(`עובדים בDB: ${employees.length}`)

  // 5. Fetch existing drivers
  const existingDrivers = await fetchAllRows('drivers', 'employee_id, deleted_at')
  const existingDriverEmpIds = new Set(
    existingDrivers.filter((d: any) => !d.deleted_at).map((d: any) => d.employee_id)
  )
  console.log(`כרטיסי נהג קיימים: ${existingDriverEmpIds.size}\n`)

  // 6. Match
  type MatchedDriver = { parsed: ParsedDriver; employeeId: string; phoneOverride: string | null }
  const matched: MatchedDriver[] = []
  let unmatchedCount = 0
  let withExistingCard = 0

  for (const p of parsed) {
    const companyId = companyMap.get(p.companyCode)
    if (!companyId) { unmatchedCount++; continue }

    const key = `${p.employeeNumber}__${companyId}`
    let emp = empLookup.get(key)

    if (!emp) {
      const candidates = empByNumber.get(p.employeeNumber)
      if (candidates?.length === 1) {
        emp = { id: candidates[0].id, phone: candidates[0].phone }
      }
    }

    if (!emp) { unmatchedCount++; continue }

    if (existingDriverEmpIds.has(emp.id)) {
      withExistingCard++
      continue
    }

    let phoneOverride: string | null = null
    if (p.phone && (!emp.phone || emp.phone !== p.phone)) {
      phoneOverride = p.phone
    }

    matched.push({ parsed: p, employeeId: emp.id, phoneOverride })
  }

  console.log(`=== MATCHING ===`)
  console.log(`  מוכנים לייבוא: ${matched.length}`)
  console.log(`  כבר יש כרטיס: ${withExistingCard}`)
  console.log(`  לא הותאמו: ${unmatchedCount}\n`)

  if (matched.length === 0) {
    console.log('אין נהגים לייבוא. יציאה.')
    return
  }

  // 7. EXECUTE — insert drivers, licenses, documents
  console.log(`=== מתחיל ייבוא ${matched.length} נהגים... ===\n`)

  let driversCreated = 0
  let licensesCreated = 0
  let documentsCreated = 0
  let documentNamesUpserted = 0
  const errors: string[] = []

  // Process in batches for progress reporting
  const BATCH = 50
  for (let batchStart = 0; batchStart < matched.length; batchStart += BATCH) {
    const batch = matched.slice(batchStart, batchStart + BATCH)

    for (const item of batch) {
      const { parsed: p, employeeId, phoneOverride } = item

      // Insert driver
      const { data: driverRow, error: driverErr } = await admin
        .from('drivers')
        .insert({
          employee_id: employeeId,
          phone_override: phoneOverride,
          is_occasional_camp_driver: false,
          is_equipment_operator: p.isEquipmentOperator,
          opened_at: p.driverFileOpenDate ?? new Date().toISOString().split('T')[0],
          notes: p.notes,
          created_by: userId,
          updated_by: userId,
        })
        .select('id')
        .single()

      if (driverErr || !driverRow) {
        errors.push(`[${p.employeeNumber}] ${p.driverName}: ${driverErr?.message ?? 'unknown'}`)
        continue
      }
      driversCreated++
      const driverId = driverRow.id

      // Insert license
      if (p.licenseNumber || p.licenseCategories.length > 0 || p.licenseExpiryDate) {
        const { error: licErr } = await admin
          .from('driver_licenses')
          .insert({
            driver_id: driverId,
            license_number: p.licenseNumber,
            license_categories: p.licenseCategories,
            category_issue_years: p.categoryIssueYears,
            expiry_date: p.licenseExpiryDate,
            created_by: userId,
            updated_by: userId,
          })

        if (licErr) {
          errors.push(`רשיון [${p.employeeNumber}]: ${licErr.message}`)
        } else {
          licensesCreated++
        }
      }

      // Insert documents
      for (const doc of p.documents) {
        const { error: docErr } = await admin
          .from('driver_documents')
          .insert({
            driver_id: driverId,
            document_name: doc.name,
            expiry_date: doc.expiryDate,
            alert_enabled: doc.alertOnExpiry,
            deleted_at: doc.isActive ? null : new Date().toISOString(),
            created_by: userId,
            updated_by: userId,
          })

        if (docErr) {
          errors.push(`מסמך "${doc.name}" [${p.employeeNumber}]: ${docErr.message}`)
        } else {
          documentsCreated++
        }
      }
    }

    const progress = Math.min(batchStart + BATCH, matched.length)
    console.log(`  ✓ ${progress}/${matched.length} נהגים (${driversCreated} created, ${errors.length} errors)`)
  }

  // 8. Upsert document names for autocomplete
  console.log(`\nמעדכן שמות מסמכים לautocomplete...`)
  const allDocNames = new Map<string, number>()
  for (const item of matched) {
    for (const doc of item.parsed.documents) {
      allDocNames.set(doc.name, (allDocNames.get(doc.name) ?? 0) + 1)
    }
  }

  for (const [name] of allDocNames) {
    const { error: nameErr } = await admin.rpc('increment_document_name_usage', {
      p_name: name,
    })
    if (!nameErr) documentNamesUpserted++
  }

  // 9. Final report
  console.log(`\n=== IMPORT COMPLETE ===`)
  console.log(`  נהגים נוצרו: ${driversCreated}`)
  console.log(`  רשיונות נוצרו: ${licensesCreated}`)
  console.log(`  מסמכים נוצרו: ${documentsCreated}`)
  console.log(`  שמות מסמכים: ${documentNamesUpserted}`)
  console.log(`  שגיאות: ${errors.length}`)

  if (errors.length > 0) {
    console.log(`\n=== שגיאות (${errors.length}) ===`)
    for (const e of errors) {
      console.log(`  ✗ ${e}`)
    }
  }

  // 10. Verify — count drivers in DB
  const { count: finalDriverCount } = await admin
    .from('drivers')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  console.log(`\n=== אימות: ${finalDriverCount} כרטיסי נהג פעילים בDB ===`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
