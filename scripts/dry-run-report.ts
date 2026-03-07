/**
 * Generate detailed CSV reports for driver import dry-run.
 * Creates two files:
 *   1. matched-drivers.csv — drivers ready for import (with employee details)
 *   2. unmatched-drivers.csv — drivers not found in employees table
 *
 * Usage: npx tsx scripts/dry-run-report.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually
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

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
)

// ─── Parser (copied from import-drivers.ts) ────────────────────────────────

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

function parseLicenseGrades(raw: string) {
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

function parseDocuments(raw: string) {
  const groups = parseSplitStr(raw, 4)
  const docs: { isActive: boolean; name: string; expiryDate: string | null; alertOnExpiry: boolean }[] = []
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
  documents: { isActive: boolean; name: string; expiryDate: string | null; alertOnExpiry: boolean }[]
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

// ─── CSV helpers ────────────────────────────────────────────────────────────

/** Escape CSV value: wrap in quotes if contains comma, quote, or newline */
function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

// Supabase pagination helper (1000 row limit per request)
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

// Add BOM for Excel Hebrew support
const BOM = '\uFEFF'

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const filePath = path.join(__dirname, '..', 'demo_files', 'Drivers.top')
  const buffer = fs.readFileSync(filePath)
  const { parsed, skipped } = parseDriversFile(Buffer.from(buffer))

  // Fetch companies
  const { data: companies } = await admin
    .from('companies')
    .select('id, name, internal_number')
    .is('deleted_at', null)
  const companyMap = new Map<string, string>()
  const companyNameMap = new Map<string, string>()
  for (const c of companies ?? []) {
    companyMap.set(c.internal_number, c.id)
    companyNameMap.set(c.id, c.name)
  }

  // Fetch all employees (including inactive — legacy drivers may belong to former employees)
  const employees = await fetchAllRows(admin, 'employees', 'id, employee_number, company_id, first_name, last_name, mobile_phone, status, deleted_at, department_id')

  const empLookup = new Map<string, { id: string; phone: string | null; firstName: string; lastName: string; companyId: string; status: string }>()
  const empByNumber = new Map<string, { id: string; phone: string | null; firstName: string; lastName: string; companyId: string; status: string }[]>()
  for (const e of employees ?? []) {
    const key = `${e.employee_number}__${e.company_id}`
    const rec = { id: e.id, phone: e.mobile_phone, firstName: e.first_name, lastName: e.last_name, companyId: e.company_id, status: e.status }
    empLookup.set(key, rec)
    const list = empByNumber.get(e.employee_number) ?? []
    list.push(rec)
    empByNumber.set(e.employee_number, list)
  }

  // Fetch existing driver cards
  const { data: existingDrivers } = await admin
    .from('drivers')
    .select('employee_id')
    .is('deleted_at', null)
  const existingDriverEmpIds = new Set(
    (existingDrivers ?? []).map((d: { employee_id: string }) => d.employee_id)
  )

  // Match
  type MatchResult = {
    parsed: ParsedDriver
    status: 'ready' | 'existing_card' | 'unmatched'
    matchReason?: string
    employeeId?: string
    employeeName?: string
    employeePhone?: string
    employeeCompany?: string
    employeeStatus?: string
    phoneOverride?: string | null
  }

  const results: MatchResult[] = []

  for (const p of parsed) {
    const companyId = companyMap.get(p.companyCode)
    if (!companyId) {
      results.push({
        parsed: p,
        status: 'unmatched',
        matchReason: `חברה לא מזוהה (קוד ${p.companyCode})`,
      })
      continue
    }

    const key = `${p.employeeNumber}__${companyId}`
    let emp = empLookup.get(key)
    let matchMethod = 'exact'

    if (!emp) {
      const candidates = empByNumber.get(p.employeeNumber)
      if (candidates?.length === 1) {
        emp = candidates[0]
        matchMethod = 'fallback (single match)'
      }
    }

    if (!emp) {
      results.push({
        parsed: p,
        status: 'unmatched',
        matchReason: 'עובד לא נמצא בטבלת employees',
      })
      continue
    }

    if (existingDriverEmpIds.has(emp.id)) {
      results.push({
        parsed: p,
        status: 'existing_card',
        matchReason: matchMethod,
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeePhone: emp.phone ?? '',
        employeeCompany: companyNameMap.get(emp.companyId) ?? '',
        employeeStatus: emp.status,
      })
      continue
    }

    let phoneOverride: string | null = null
    if (p.phone && (!emp.phone || emp.phone !== p.phone)) {
      phoneOverride = p.phone
    }

    results.push({
      parsed: p,
      status: 'ready',
      matchReason: matchMethod,
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      employeePhone: emp.phone ?? '',
      employeeCompany: companyNameMap.get(emp.companyId) ?? '',
      employeeStatus: emp.status,
      phoneOverride,
    })
  }

  // ─── Generate CSV: Matched (ready to import) ───────────────────────────

  const matchedRows = results.filter(r => r.status === 'ready')
  const matchedHeader = [
    'מספר עובד',
    'שם ב-Drivers.top',
    'שם ב-employees',
    'חברה',
    'סטטוס עובד',
    'מספר רשיון',
    'קטגוריות',
    'שנות הנפקה',
    'תפוגת רשיון',
    'טלפון Drivers.top',
    'טלפון employees',
    'phone_override',
    'צמ"ה',
    'מסמכים (שמות)',
    'מסמכים (תפוגה)',
    'פתיחת תיק',
    'הערות',
  ]

  let matchedCSV = BOM + matchedHeader.join(',') + '\n'
  for (const r of matchedRows) {
    const p = r.parsed
    const docNames = p.documents.filter(d => d.isActive).map(d => d.name).join(' | ')
    const docExpiry = p.documents.filter(d => d.isActive).map(d => `${d.name}: ${d.expiryDate ?? 'אין'}`).join(' | ')
    const row = [
      p.employeeNumber,
      csvEscape(p.driverName),
      csvEscape(r.employeeName ?? ''),
      csvEscape(r.employeeCompany ?? ''),
      r.employeeStatus ?? '',
      p.licenseNumber ?? '',
      p.licenseCategories.join(' '),
      csvEscape(JSON.stringify(p.categoryIssueYears)),
      p.licenseExpiryDate ?? '',
      p.phone ?? '',
      r.employeePhone ?? '',
      r.phoneOverride ?? '',
      p.isEquipmentOperator ? 'כן' : 'לא',
      csvEscape(docNames),
      csvEscape(docExpiry),
      p.driverFileOpenDate ?? '',
      csvEscape((p.notes ?? '').replace(/\n/g, ' ')),
    ]
    matchedCSV += row.join(',') + '\n'
  }

  // ─── Generate CSV: Unmatched ──────────────────────────────────────────

  const unmatchedRows = results.filter(r => r.status === 'unmatched')
  const unmatchedHeader = [
    'מספר עובד',
    'שם ב-Drivers.top',
    'חברה (קוד)',
    'חברה (שם)',
    'סיבת אי-התאמה',
    'מספר רשיון',
    'קטגוריות',
    'תפוגת רשיון',
    'טלפון',
    'צמ"ה',
    'מסמכים',
  ]

  let unmatchedCSV = BOM + unmatchedHeader.join(',') + '\n'
  for (const r of unmatchedRows) {
    const p = r.parsed
    const row = [
      p.employeeNumber,
      csvEscape(p.driverName),
      p.companyCode,
      csvEscape(COMPANY_NAMES[p.companyCode] ?? `קוד ${p.companyCode}`),
      csvEscape(r.matchReason ?? ''),
      p.licenseNumber ?? '',
      p.licenseCategories.join(' '),
      p.licenseExpiryDate ?? '',
      p.phone ?? '',
      p.isEquipmentOperator ? 'כן' : 'לא',
      csvEscape(p.documents.filter(d => d.isActive).map(d => d.name).join(' | ')),
    ]
    unmatchedCSV += row.join(',') + '\n'
  }

  // ─── Write files ─────────────────────────────────────────────────────

  const outDir = path.join(__dirname, '..', 'demo_files')

  const matchedPath = path.join(outDir, 'import-matched-drivers.csv')
  fs.writeFileSync(matchedPath, matchedCSV, 'utf-8')

  const unmatchedPath = path.join(outDir, 'import-unmatched-drivers.csv')
  fs.writeFileSync(unmatchedPath, unmatchedCSV, 'utf-8')

  // Summary
  console.log('=== דוחות נוצרו בהצלחה ===\n')
  console.log(`  ✓ matched:   ${matchedPath}`)
  console.log(`    ${matchedRows.length} נהגים מוכנים לייבוא\n`)
  console.log(`  ✓ unmatched: ${unmatchedPath}`)
  console.log(`    ${unmatchedRows.length} נהגים לא הותאמו\n`)

  const existingCount = results.filter(r => r.status === 'existing_card').length
  if (existingCount > 0) {
    console.log(`  ℹ ${existingCount} נהגים כבר יש להם כרטיס (לא נכללו בדוח)\n`)
  }

  console.log(`סה"כ בקובץ: ${parsed.length + skipped.skipFlag + skipped.templateRows + skipped.exPrefix + skipped.emptyNumber} שורות`)
  console.log(`תקפות: ${parsed.length} | matched: ${matchedRows.length} | unmatched: ${unmatchedRows.length} | existing: ${existingCount}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
