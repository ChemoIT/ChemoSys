/**
 * Standalone dry-run script for driver import.
 * Reads demo_files/Drivers.top, parses it, matches against Supabase employees,
 * and prints a detailed report.
 *
 * Usage: npx tsx scripts/dry-run-drivers.ts
 *
 * This script bypasses Next.js server action auth (verifySession) because it
 * runs outside the app context. It uses SUPABASE_SERVICE_ROLE_KEY directly.
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually (no dotenv dependency)
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

// ─── Copy of parser logic (to avoid importing from 'use server' module) ─────

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

function parseDocuments(raw: string): { isActive: boolean; name: string; expiryDate: string | null; alertOnExpiry: boolean }[] {
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
  const invalidDates: { empNum: string; field: string; rawValue: string }[] = []
  const unknownCategories: { empNum: string; grade: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].split(',')
    const empNum = (f[0] ?? '').trim()

    if (!empNum) { skipped.emptyNumber++; continue }
    if (empNum === '0') { skipped.templateRows++; continue }
    if ((f[16] ?? '').trim() !== '') { skipped.skipFlag++; continue }
    if (empNum.startsWith('EX-') || empNum.startsWith('EX')) { skipped.exPrefix++; continue }

    const { categories, categoryYears } = parseLicenseGrades(f[3] ?? '')

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

    const rawLicExpiry = (f[4] ?? '').trim()
    const licExpirySerial = rawLicExpiry ? parseInt(rawLicExpiry, 10) : null
    const licenseExpiryDate = licExpirySerial ? serialToDate(licExpirySerial) : null
    if (licExpirySerial && !licenseExpiryDate) {
      invalidDates.push({ empNum, field: 'licenseExpiryDate', rawValue: rawLicExpiry })
    }

    const rawOpenDate = (f[24] ?? '').trim()
    const openDateSerial = rawOpenDate ? parseInt(rawOpenDate, 10) : null
    const driverFileOpenDate = openDateSerial ? serialToDate(openDateSerial) : null
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
      phone: (f[7] ?? '').trim() || null,
      companyCode: (f[15] ?? '').trim() || '1',
      driverFileOpenDate,
      documents: parseDocuments(f[25] ?? ''),
      isEquipmentOperator: (f[39] ?? '').trim() === '1',
    })
  }

  return { parsed, skipped, invalidDates, unknownCategories }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const filePath = path.join(__dirname, '..', 'demo_files', 'Drivers.top')
  const buffer = fs.readFileSync(filePath)

  console.log('=== DRIVER IMPORT DRY-RUN ===\n')

  // 1. Parse
  const { parsed, skipped, invalidDates, unknownCategories } = parseDriversFile(Buffer.from(buffer))
  const totalRows = parsed.length + skipped.skipFlag + skipped.templateRows + skipped.exPrefix + skipped.emptyNumber

  console.log(`--- שורות בקובץ ---`)
  console.log(`  סה"כ שורות: ${totalRows}`)
  console.log(`  נדלגו (skip flag col[16]): ${skipped.skipFlag}`)
  console.log(`  נדלגו (template "0"): ${skipped.templateRows}`)
  console.log(`  נדלגו (EX- prefix): ${skipped.exPrefix}`)
  console.log(`  נדלגו (ריק): ${skipped.emptyNumber}`)
  console.log(`  ✓ שורות תקפות: ${parsed.length}\n`)

  // 2. Fetch companies
  const { data: companies } = await admin
    .from('companies')
    .select('id, name, internal_number')
    .is('deleted_at', null)

  const companyMap = new Map<string, string>()
  for (const c of companies ?? []) {
    companyMap.set(c.internal_number, c.id)
  }

  console.log(`--- חברות בDB ---`)
  for (const c of companies ?? []) {
    console.log(`  internal_number="${c.internal_number}" → ${c.name} (${c.id.slice(0, 8)}...)`)
  }
  console.log()

  // 3. Fetch all employees (including inactive — legacy drivers may belong to former employees)
  // Paginate: Supabase limits to 1000 rows per request
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

  const employees = await fetchAllRows('employees', 'id, employee_number, company_id, mobile_phone, status, deleted_at')

  const empLookup = new Map<string, { id: string; phone: string | null }>()
  const empByNumber = new Map<string, { id: string; phone: string | null; companyId: string }[]>()
  for (const e of employees) {
    const key = `${e.employee_number}__${e.company_id}`
    empLookup.set(key, { id: e.id, phone: e.mobile_phone })
    const list = empByNumber.get(e.employee_number) ?? []
    list.push({ id: e.id, phone: e.mobile_phone, companyId: e.company_id })
    empByNumber.set(e.employee_number, list)
  }
  console.log(`--- עובדים בDB: ${employees?.length ?? 0} ---\n`)

  // 4. Fetch existing drivers
  const { data: existingDrivers } = await admin
    .from('drivers')
    .select('employee_id')
    .is('deleted_at', null)
  const existingDriverEmpIds = new Set(
    (existingDrivers ?? []).map((d: { employee_id: string }) => d.employee_id)
  )
  console.log(`--- כרטיסי נהג קיימים בDB: ${existingDriverEmpIds.size} ---\n`)

  // 5. Match
  type MatchedDriver = { parsed: ParsedDriver; employeeId: string; phoneOverride: string | null }
  const matched: MatchedDriver[] = []
  const unmatched: { empNum: string; name: string; company: string; reason: string }[] = []
  const phonesToImport: { empNum: string; phone: string; existingPhone: string | null }[] = []
  let withExistingCard = 0

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

    const key = `${p.employeeNumber}__${companyId}`
    let emp = empLookup.get(key)

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

    if (existingDriverEmpIds.has(emp.id)) {
      withExistingCard++
      continue
    }

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

    matched.push({ parsed: p, employeeId: emp.id, phoneOverride })
  }

  // 6. Report
  console.log(`=== תוצאות MATCHING ===`)
  console.log(`  הותאמו סה"כ: ${matched.length + withExistingCard}`)
  console.log(`  כבר יש כרטיס נהג: ${withExistingCard} (ידלגו)`)
  console.log(`  מוכנים לייבוא: ${matched.length}`)
  console.log(`  לא הותאמו: ${unmatched.length}\n`)

  if (unmatched.length > 0) {
    console.log(`--- לא הותאמו (${unmatched.length}) ---`)
    for (const u of unmatched) {
      console.log(`  [${u.empNum}] ${u.name} | ${u.company} | ${u.reason}`)
    }
    console.log()
  }

  // Document stats
  let totalDocs = 0, activeDocs = 0, inactiveDocs = 0
  const docNameCounts = new Map<string, number>()
  for (const m of matched) {
    for (const doc of m.parsed.documents) {
      totalDocs++
      if (doc.isActive) activeDocs++; else inactiveDocs++
      docNameCounts.set(doc.name, (docNameCounts.get(doc.name) ?? 0) + 1)
    }
  }

  console.log(`=== מסמכים (matched בלבד) ===`)
  console.log(`  סה"כ: ${totalDocs} | פעילים: ${activeDocs} | לא פעילים: ${inactiveDocs}`)
  console.log(`  שמות ייחודיים:`)
  for (const [name, count] of [...docNameCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${name}: ${count}`)
  }
  console.log()

  // License stats
  let withNumber = 0, withCategories = 0, withExpiryDate = 0
  for (const m of matched) {
    if (m.parsed.licenseNumber) withNumber++
    if (m.parsed.licenseCategories.length > 0) withCategories++
    if (m.parsed.licenseExpiryDate) withExpiryDate++
  }

  console.log(`=== רשיונות (matched בלבד) ===`)
  console.log(`  עם מספר רשיון: ${withNumber}`)
  console.log(`  עם קטגוריות: ${withCategories}`)
  console.log(`  עם תאריך תפוגה: ${withExpiryDate}`)
  console.log(`  מפעילי צמ"ה: ${matched.filter(m => m.parsed.isEquipmentOperator).length}\n`)

  // Data quality
  if (invalidDates.length > 0) {
    console.log(`=== תאריכים לא תקינים (${invalidDates.length}) ===`)
    for (const d of invalidDates) {
      console.log(`  [${d.empNum}] ${d.field}: "${d.rawValue}"`)
    }
    console.log()
  }

  if (unknownCategories.length > 0) {
    console.log(`=== קטגוריות לא מוכרות (${unknownCategories.length}) ===`)
    for (const c of unknownCategories) {
      console.log(`  [${c.empNum}] "${c.grade}"`)
    }
    console.log()
  }

  if (phonesToImport.length > 0) {
    console.log(`=== טלפונים לייבוא (${phonesToImport.length}) ===`)
    for (const p of phonesToImport.slice(0, 20)) {
      console.log(`  [${p.empNum}] ${p.phone} (קיים: ${p.existingPhone ?? 'אין'})`)
    }
    if (phonesToImport.length > 20) console.log(`  ... ועוד ${phonesToImport.length - 20}`)
    console.log()
  }

  // Sample of first 5 matched drivers
  console.log(`=== דוגמה: 5 נהגים ראשונים לייבוא ===`)
  for (const m of matched.slice(0, 5)) {
    const p = m.parsed
    console.log(`  [${p.employeeNumber}] ${p.driverName}`)
    console.log(`    רשיון: ${p.licenseNumber ?? '-'} | קטגוריות: ${p.licenseCategories.join(', ') || '-'}`)
    console.log(`    שנות הנפקה: ${JSON.stringify(p.categoryIssueYears)}`)
    console.log(`    תפוגה: ${p.licenseExpiryDate ?? '-'} | פתיחת תיק: ${p.driverFileOpenDate ?? '-'}`)
    console.log(`    טלפון override: ${m.phoneOverride ?? '-'} | צמ"ה: ${p.isEquipmentOperator ? 'כן' : 'לא'}`)
    console.log(`    מסמכים: ${p.documents.length} (${p.documents.filter(d => d.isActive).length} פעילים)`)
    console.log()
  }

  console.log('=== DRY-RUN COMPLETE ===')
  console.log(`סה"כ לייבוא: ${matched.length} נהגים, ${matched.reduce((s, m) => s + (m.parsed.licenseNumber || m.parsed.licenseCategories.length ? 1 : 0), 0)} רשיונות, ${totalDocs} מסמכים`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
