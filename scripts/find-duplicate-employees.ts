/**
 * Find duplicate employees in the employees table.
 * Checks for duplicates by:
 *   1. Same employee_number + company_id (including soft-deleted)
 *   2. Same id_number (ת.ז.) across all companies
 *   3. Same first_name + last_name + company_id
 *
 * Usage: npx tsx scripts/find-duplicate-employees.ts
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

interface Employee {
  id: string
  employee_number: string
  company_id: string
  first_name: string
  last_name: string
  id_number: string | null
  status: string
  deleted_at: string | null
  start_date: string | null
  end_date: string | null
  mobile_phone: string | null
  department_id: string | null
  created_at: string
}

interface DuplicateGroup {
  key: string
  type: string
  rows: Employee[]
}

async function main() {
  console.log('=== בדיקת כפילויות בטבלת עובדים ===\n')

  // Fetch all employees (including soft-deleted)
  const employees: Employee[] = await fetchAllRows(
    'employees',
    'id, employee_number, company_id, first_name, last_name, id_number, status, deleted_at, start_date, end_date, mobile_phone, department_id, created_at'
  )

  // Fetch companies for display
  const { data: companies } = await admin.from('companies').select('id, name')
  const companyMap = new Map<string, string>()
  for (const c of companies || []) companyMap.set(c.id, c.name)

  console.log(`סה"כ רשומות בטבלה: ${employees.length}\n`)

  const allDuplicates: DuplicateGroup[] = []

  // --- 1. Duplicates by employee_number + company_id ---
  const byNumCompany = new Map<string, Employee[]>()
  for (const emp of employees) {
    const key = `${emp.employee_number}|${emp.company_id}`
    if (!byNumCompany.has(key)) byNumCompany.set(key, [])
    byNumCompany.get(key)!.push(emp)
  }
  for (const [key, group] of byNumCompany) {
    if (group.length > 1) {
      const [empNum] = key.split('|')
      const company = companyMap.get(group[0].company_id) || '?'
      allDuplicates.push({
        key: `מספר עובד ${empNum} / ${company}`,
        type: 'employee_number+company',
        rows: group,
      })
    }
  }

  // --- 2. Duplicates by id_number (ת.ז.) ---
  const byIdNumber = new Map<string, Employee[]>()
  for (const emp of employees) {
    if (!emp.id_number || emp.id_number.trim() === '') continue
    const normalized = emp.id_number.replace(/\D/g, '').padStart(9, '0')
    if (!byIdNumber.has(normalized)) byIdNumber.set(normalized, [])
    byIdNumber.get(normalized)!.push(emp)
  }
  for (const [idNum, group] of byIdNumber) {
    if (group.length > 1) {
      allDuplicates.push({
        key: `ת.ז. ${idNum}`,
        type: 'id_number',
        rows: group,
      })
    }
  }

  // --- 3. Duplicates by full name + company ---
  const byNameCompany = new Map<string, Employee[]>()
  for (const emp of employees) {
    const name = `${emp.first_name.trim()}|${emp.last_name.trim()}|${emp.company_id}`.toLowerCase()
    if (!byNameCompany.has(name)) byNameCompany.set(name, [])
    byNameCompany.get(name)!.push(emp)
  }
  for (const [key, group] of byNameCompany) {
    if (group.length > 1) {
      const [first, last] = key.split('|')
      const company = companyMap.get(group[0].company_id) || '?'
      // Skip if already caught by employee_number duplicate
      const empNumKeys = group.map(e => `${e.employee_number}|${e.company_id}`)
      const allSameEmpNum = empNumKeys.every(k => k === empNumKeys[0])
      if (allSameEmpNum && (byNumCompany.get(empNumKeys[0])?.length || 0) > 1) continue
      allDuplicates.push({
        key: `שם ${first} ${last} / ${company}`,
        type: 'name+company',
        rows: group,
      })
    }
  }

  // --- Output ---
  if (allDuplicates.length === 0) {
    console.log('✅ לא נמצאו כפילויות!\n')
    return
  }

  console.log(`🔍 נמצאו ${allDuplicates.length} קבוצות כפילויות:\n`)

  // Summary by type
  const byType = { 'employee_number+company': 0, 'id_number': 0, 'name+company': 0 }
  for (const d of allDuplicates) byType[d.type as keyof typeof byType]++
  console.log('סיכום לפי סוג:')
  if (byType['employee_number+company'] > 0) console.log(`  📋 מספר עובד + חברה: ${byType['employee_number+company']} קבוצות`)
  if (byType['id_number'] > 0) console.log(`  🆔 ת.ז. זהה: ${byType['id_number']} קבוצות`)
  if (byType['name+company'] > 0) console.log(`  👤 שם זהה + חברה: ${byType['name+company']} קבוצות`)
  console.log()

  // Detailed output
  const lines: string[] = ['type,key,id,employee_number,company,first_name,last_name,id_number,status,deleted_at,start_date,end_date,mobile_phone,created_at']

  for (const group of allDuplicates) {
    console.log(`── ${group.type}: ${group.key} (${group.rows.length} רשומות) ──`)
    for (const emp of group.rows) {
      const company = companyMap.get(emp.company_id) || '?'
      const deleted = emp.deleted_at ? `🗑️ ${emp.deleted_at.slice(0, 10)}` : '✅'
      console.log(
        `   #${emp.employee_number.padEnd(6)} | ${emp.first_name} ${emp.last_name}` +
        ` | ת.ז.=${emp.id_number || '-'}` +
        ` | ${company}` +
        ` | ${emp.status}` +
        ` | ${deleted}` +
        ` | start=${emp.start_date || '-'}` +
        ` | end=${emp.end_date || '-'}`
      )
      lines.push([
        group.type,
        group.key,
        emp.id,
        emp.employee_number,
        company,
        emp.first_name,
        emp.last_name,
        emp.id_number || '',
        emp.status,
        emp.deleted_at || '',
        emp.start_date || '',
        emp.end_date || '',
        emp.mobile_phone || '',
        emp.created_at,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    }
    console.log()
  }

  // Write CSV report
  const csvPath = path.join(__dirname, '..', 'demo_files', 'duplicate-employees.csv')
  fs.writeFileSync(csvPath, '\uFEFF' + lines.join('\n'), 'utf-8')
  console.log(`📄 דוח CSV נשמר ב: ${csvPath}`)

  // Count total duplicate rows
  const totalDupRows = allDuplicates.reduce((sum, g) => sum + g.rows.length, 0)
  console.log(`\nסה"כ רשומות מעורבות בכפילויות: ${totalDupRows}`)
  console.log('\n⚠️  זהו דוח בלבד — לא בוצעו שינויים בנתונים.')
}

main().catch(err => {
  console.error('שגיאה:', err)
  process.exit(1)
})
