/**
 * Compare duplicate employees — check which fields differ between records in each group.
 * Excludes the id_number=0 group (not real duplicates).
 * Fetches ALL columns to do a thorough comparison.
 *
 * Usage: npx tsx scripts/compare-duplicates.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
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

async function fetchAllRows(table: string, select: string) {
  const PAGE = 1000
  const all: any[] = []
  let offset = 0
  while (true) {
    const { data, error } = await admin.from(table).select(select).range(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

// Fields to compare (excluding system/audit fields)
const COMPARE_FIELDS = [
  'employee_number', 'company_id', 'first_name', 'last_name', 'id_number',
  'gender', 'date_of_birth', 'citizenship', 'passport_number',
  'mobile_phone', 'additional_phone', 'email', 'street', 'house_number', 'city',
  'start_date', 'end_date', 'status', 'department_id', 'sub_department_id',
  'profession', 'correspondence_language', 'salary_system_license', 'notes',
]

const DISPLAY_FIELDS = [
  'employee_number', 'first_name', 'last_name', 'id_number',
  'gender', 'date_of_birth', 'citizenship', 'passport_number',
  'mobile_phone', 'additional_phone', 'email', 'street', 'house_number', 'city',
  'start_date', 'end_date', 'status', 'department_id', 'sub_department_id',
  'profession', 'correspondence_language', 'salary_system_license', 'notes',
]

interface DupGroup {
  type: string
  key: string
  rows: any[]
  diffs: string[]       // fields that differ
  identical: boolean
}

async function main() {
  console.log('=== השוואת כפילויות — בדיקת הבדלים בין רשומות ===\n')

  const employees = await fetchAllRows(
    'employees',
    '*, departments:department_id(dept_number, name), sub_departments:sub_department_id(dept_number, name)'
  )

  const { data: companies } = await admin.from('companies').select('id, name')
  const companyMap = new Map<string, string>()
  for (const c of companies || []) companyMap.set(c.id, c.name)

  const { data: departments } = await admin.from('departments').select('id, dept_number, name')
  const deptMap = new Map<string, string>()
  for (const d of departments || []) deptMap.set(d.id, `${d.dept_number}-${d.name}`)

  console.log(`סה"כ רשומות: ${employees.length}\n`)

  const allGroups: DupGroup[] = []

  // --- 1. By id_number (excluding 0/empty) ---
  const byIdNumber = new Map<string, any[]>()
  for (const emp of employees) {
    if (!emp.id_number || emp.id_number.trim() === '') continue
    const normalized = emp.id_number.replace(/\D/g, '').padStart(9, '0')
    if (normalized === '000000000') continue // skip ת.ז.=0
    if (!byIdNumber.has(normalized)) byIdNumber.set(normalized, [])
    byIdNumber.get(normalized)!.push(emp)
  }
  for (const [idNum, group] of byIdNumber) {
    if (group.length > 1) {
      const diffs = findDiffs(group)
      allGroups.push({
        type: 'ת.ז. זהה',
        key: idNum,
        rows: group,
        diffs,
        identical: diffs.length === 0,
      })
    }
  }

  // --- 2. By name + company (skip if already caught by id_number) ---
  const idNumGroupIds = new Set<string>()
  for (const g of allGroups) for (const r of g.rows) idNumGroupIds.add(r.id)

  const byNameCompany = new Map<string, any[]>()
  for (const emp of employees) {
    const key = `${emp.first_name.trim()}|${emp.last_name.trim()}|${emp.company_id}`.toLowerCase()
    if (!byNameCompany.has(key)) byNameCompany.set(key, [])
    byNameCompany.get(key)!.push(emp)
  }
  for (const [key, group] of byNameCompany) {
    if (group.length <= 1) continue
    // Skip if all members are already in an id_number group
    if (group.every(r => idNumGroupIds.has(r.id))) continue
    const [first, last] = key.split('|')
    const company = companyMap.get(group[0].company_id) || '?'
    const diffs = findDiffs(group)
    allGroups.push({
      type: 'שם זהה',
      key: `${first} ${last} / ${company}`,
      rows: group,
      diffs,
      identical: diffs.length === 0,
    })
  }

  // --- Output ---
  const identicalGroups = allGroups.filter(g => g.identical)
  const diffGroups = allGroups.filter(g => !g.identical)

  console.log(`📊 סה"כ קבוצות כפילויות (ללא ת.ז.=0): ${allGroups.length}`)
  console.log(`   ✅ זהות לחלוטין (כל השדות): ${identicalGroups.length}`)
  console.log(`   ⚠️  יש הבדלים בין הרשומות: ${diffGroups.length}`)
  console.log()

  // --- Identical groups ---
  if (identicalGroups.length > 0) {
    console.log('═══════════════════════════════════════════════════')
    console.log(`✅ רשומות זהות לחלוטין (${identicalGroups.length} קבוצות) — ניתן לנקות בבטחה:`)
    console.log('═══════════════════════════════════════════════════')
    for (const g of identicalGroups) {
      const company = companyMap.get(g.rows[0].company_id) || '?'
      console.log(`\n  ${g.type}: ${g.key}  |  ${g.rows.length} רשומות  |  ${company}`)
      for (const r of g.rows) {
        const deleted = r.deleted_at ? `🗑️ ${r.deleted_at.slice(0, 10)}` : '✅ פעיל'
        console.log(`    #${r.employee_number.padEnd(6)} ${r.first_name} ${r.last_name} | ${r.status} | ${deleted} | created=${r.created_at.slice(0, 10)}`)
      }
    }
    console.log()
  }

  // --- Groups with differences ---
  if (diffGroups.length > 0) {
    console.log('═══════════════════════════════════════════════════')
    console.log(`⚠️  רשומות עם הבדלים (${diffGroups.length} קבוצות) — דורש בדיקה ידנית:`)
    console.log('═══════════════════════════════════════════════════')
    for (const g of diffGroups) {
      const company = companyMap.get(g.rows[0].company_id) || '?'
      console.log(`\n  ${g.type}: ${g.key}  |  ${g.rows.length} רשומות  |  ${company}`)
      console.log(`  שדות שונים: ${g.diffs.join(', ')}`)

      // Print rows with the differing fields highlighted
      for (const r of g.rows) {
        const deleted = r.deleted_at ? `🗑️ ${r.deleted_at.slice(0, 10)}` : '✅ פעיל'
        console.log(`    #${r.employee_number.padEnd(6)} ${r.first_name} ${r.last_name} | ${r.status} | ${deleted}`)

        // Show differing field values
        for (const field of g.diffs) {
          let val = r[field]
          if (field === 'company_id') val = companyMap.get(val) || val
          if (field === 'department_id') val = deptMap.get(val) || val || '(ללא)'
          if (field === 'sub_department_id') val = deptMap.get(val) || val || '(ללא)'
          if (val === null || val === undefined) val = '(ריק)'
          console.log(`      ${field}: ${val}`)
        }
      }
    }
    console.log()
  }

  // --- CSV report ---
  const csvLines: string[] = ['type,key,identical,diff_fields,id,employee_number,company,first_name,last_name,id_number,status,deleted_at,start_date,end_date,mobile_phone,department,profession,created_at']
  for (const g of allGroups) {
    for (const r of g.rows) {
      csvLines.push([
        g.type,
        g.key,
        g.identical ? 'זהה' : 'שונה',
        g.diffs.join('; '),
        r.id,
        r.employee_number,
        companyMap.get(r.company_id) || '?',
        r.first_name,
        r.last_name,
        r.id_number || '',
        r.status,
        r.deleted_at || '',
        r.start_date || '',
        r.end_date || '',
        r.mobile_phone || '',
        deptMap.get(r.department_id) || '',
        r.profession || '',
        r.created_at,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    }
  }
  const csvPath = path.join(__dirname, '..', 'demo_files', 'duplicate-employees-comparison.csv')
  fs.writeFileSync(csvPath, '\uFEFF' + csvLines.join('\n'), 'utf-8')
  console.log(`📄 דוח CSV נשמר ב: ${csvPath}`)
  console.log('\n⚠️  זהו דוח בלבד — לא בוצעו שינויים בנתונים.')
}

function findDiffs(rows: any[]): string[] {
  const diffs: string[] = []
  const ref = rows[0]
  for (const field of COMPARE_FIELDS) {
    const refVal = normalize(ref[field])
    for (let i = 1; i < rows.length; i++) {
      const val = normalize(rows[i][field])
      if (refVal !== val) {
        diffs.push(field)
        break
      }
    }
  }
  return diffs
}

function normalize(v: any): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v).trim().toLowerCase()
}

main().catch(err => {
  console.error('שגיאה:', err)
  process.exit(1)
})
