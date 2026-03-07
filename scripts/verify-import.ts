/**
 * Verify driver import results.
 * Usage: npx tsx scripts/verify-import.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

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

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

async function fetchAllRows(table: string, select: string, filter?: { col: string; op: string; val: any }) {
  const PAGE = 1000
  const all: any[] = []
  let offset = 0
  while (true) {
    let q = admin.from(table).select(select).range(offset, offset + PAGE - 1)
    if (filter) q = (q as any)[filter.op](filter.col, filter.val)
    const { data } = await q
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

async function main() {
  console.log('=== בדיקת ייבוא נהגים ===\n')

  // 1. Drivers count (active vs soft-deleted)
  const allDrivers = await fetchAllRows('drivers', 'id, employee_id, deleted_at, is_equipment_operator, phone_override, notes, opened_at')
  const active = allDrivers.filter(d => !d.deleted_at)
  const deleted = allDrivers.filter(d => d.deleted_at)
  console.log(`--- כרטיסי נהג ---`)
  console.log(`  סה"כ בטבלה: ${allDrivers.length}`)
  console.log(`  פעילים: ${active.length}`)
  console.log(`  מחוקים (soft): ${deleted.length}`)

  // 2. Check for duplicate employee_id among active drivers
  const empIds = active.map(d => d.employee_id)
  const dupes = empIds.filter((id, i) => empIds.indexOf(id) !== i)
  if (dupes.length > 0) {
    console.log(`  ⚠️ כפילויות employee_id (פעילים): ${dupes.length}`)
    for (const dup of [...new Set(dupes)]) {
      const matches = active.filter(d => d.employee_id === dup)
      console.log(`    ${dup} — ${matches.length} כרטיסים`)
    }
  } else {
    console.log(`  ✅ אין כפילויות employee_id בפעילים`)
  }

  // 3. Driver data quality
  const withPhone = active.filter(d => d.phone_override)
  const withNotes = active.filter(d => d.notes)
  const withEquip = active.filter(d => d.is_equipment_operator)
  const withOpened = active.filter(d => d.opened_at && d.opened_at !== new Date().toISOString().split('T')[0])
  console.log(`  עם טלפון override: ${withPhone.length}`)
  console.log(`  עם הערות: ${withNotes.length}`)
  console.log(`  מפעילי צמ"ה: ${withEquip.length}`)
  console.log(`  עם תאריך פתיחת תיק (לא היום): ${withOpened.length}`)

  // 4. Licenses
  const licenses = await fetchAllRows('driver_licenses', 'id, driver_id, license_number, license_categories, category_issue_years, expiry_date')
  console.log(`\n--- רשיונות ---`)
  console.log(`  סה"כ: ${licenses.length}`)
  const withLicNum = licenses.filter(l => l.license_number)
  const withCats = licenses.filter(l => l.license_categories?.length > 0)
  const withExpiry = licenses.filter(l => l.expiry_date)
  const withYears = licenses.filter(l => l.category_issue_years && Object.keys(l.category_issue_years).length > 0)
  console.log(`  עם מספר רשיון: ${withLicNum.length}`)
  console.log(`  עם קטגוריות: ${withCats.length}`)
  console.log(`  עם תאריך תפוגה: ${withExpiry.length}`)
  console.log(`  עם שנות הנפקה: ${withYears.length}`)

  // Category distribution
  const catCounts = new Map<string, number>()
  for (const l of licenses) {
    for (const cat of (l.license_categories ?? [])) {
      catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1)
    }
  }
  console.log(`  פילוג קטגוריות:`)
  for (const [cat, count] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`)
  }

  // 5. Documents
  const allDocs = await fetchAllRows('driver_documents', 'id, driver_id, document_name, expiry_date, alert_enabled, deleted_at')
  const activeDocs = allDocs.filter(d => !d.deleted_at)
  const deletedDocs = allDocs.filter(d => d.deleted_at)
  console.log(`\n--- מסמכים ---`)
  console.log(`  סה"כ בטבלה: ${allDocs.length}`)
  console.log(`  פעילים: ${activeDocs.length}`)
  console.log(`  לא פעילים (soft-deleted): ${deletedDocs.length}`)
  const withAlert = activeDocs.filter(d => d.alert_enabled)
  const withDocExpiry = activeDocs.filter(d => d.expiry_date)
  console.log(`  פעילים עם התראה: ${withAlert.length}`)
  console.log(`  פעילים עם תאריך תפוגה: ${withDocExpiry.length}`)

  // Doc name distribution
  const docNameCounts = new Map<string, number>()
  for (const d of allDocs) {
    docNameCounts.set(d.document_name, (docNameCounts.get(d.document_name) ?? 0) + 1)
  }
  console.log(`  שמות מסמכים:`)
  for (const [name, count] of [...docNameCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${name}: ${count}`)
  }

  // 6. Document names autocomplete table
  const { data: docNames } = await admin.from('driver_document_names').select('name, usage_count').order('usage_count', { ascending: false })
  console.log(`\n--- שמות מסמכים (autocomplete) ---`)
  for (const dn of docNames ?? []) {
    console.log(`  ${dn.name}: ${dn.usage_count}`)
  }

  // 7. Check the 2 failed drivers — שרון בראון and ישראל ביטון
  console.log(`\n--- בדיקת 2 הנהגים שנכשלו ---`)
  for (const empNum of ['2297', '30']) {
    const { data: emps } = await admin
      .from('employees')
      .select('id, first_name, last_name, employee_number, company_id')
      .eq('employee_number', empNum)

    console.log(`  מספר עובד ${empNum}:`)
    for (const e of emps ?? []) {
      console.log(`    ${e.first_name} ${e.last_name} (company: ${e.company_id?.slice(0, 8)}...)`)
      // Check if has driver card
      const { data: drvs } = await admin
        .from('drivers')
        .select('id, deleted_at, created_at')
        .eq('employee_id', e.id)
      for (const drv of drvs ?? []) {
        console.log(`    → כרטיס נהג: ${drv.id.slice(0, 8)}... | deleted_at: ${drv.deleted_at ?? 'NULL'} | created: ${drv.created_at}`)
      }
    }
  }

  // 8. Orphan check — drivers without matching active employee
  const empIdSet = new Set<string>()
  const employees = await fetchAllRows('employees', 'id')
  for (const e of employees) empIdSet.add(e.id)
  const orphans = active.filter(d => !empIdSet.has(d.employee_id))
  console.log(`\n--- בדיקת שלמות ---`)
  console.log(`  נהגים ללא עובד תואם: ${orphans.length}`)

  // 9. Sample — 5 random active drivers with their license
  console.log(`\n--- דוגמה: 5 נהגים פעילים ---`)
  const sample = active.sort(() => Math.random() - 0.5).slice(0, 5)
  for (const d of sample) {
    const { data: emp } = await admin
      .from('employees')
      .select('first_name, last_name, employee_number')
      .eq('id', d.employee_id)
      .single()

    const lic = licenses.find(l => l.driver_id === d.id)
    const docs = allDocs.filter(doc => doc.driver_id === d.id)
    console.log(`  [${emp?.employee_number}] ${emp?.first_name} ${emp?.last_name}`)
    console.log(`    רשיון: ${lic?.license_number ?? '-'} | קטגוריות: ${lic?.license_categories?.join(', ') ?? '-'} | תפוגה: ${lic?.expiry_date ?? '-'}`)
    console.log(`    מסמכים: ${docs.length} | צמ"ה: ${d.is_equipment_operator ? 'כן' : 'לא'} | טלפון: ${d.phone_override ?? '-'}`)
  }

  console.log(`\n=== בדיקה הושלמה ===`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
