import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq < 0) continue
  const k = t.slice(0, eq).trim()
  const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  if (!process.env[k]) process.env[k] = v
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const COMPANY_NAMES: Record<string, string> = {
  '1': 'חמו אהרון',
  '2': 'טקסה',
  '3': 'וולדבוט',
  '4': 'קבלנים',
}

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

async function main() {
  // Parse Drivers.top
  const filePath = path.join(__dirname, '..', 'demo_files', 'Drivers.top')
  const buffer = fs.readFileSync(filePath)
  const decoder = new TextDecoder('windows-1255')
  const text = decoder.decode(buffer)
  const lines = text.split(/\r?\n/).filter((l) => l.trim())

  // Fetch companies
  const { data: companies } = await admin.from('companies').select('id, name, internal_number').is('deleted_at', null)
  const companyMap = new Map<string, string>()
  for (const c of companies ?? []) companyMap.set(c.internal_number, c.id)

  // Fetch all employees
  const employees = await fetchAllRows('employees', 'id, employee_number, company_id')
  const empLookup = new Map<string, string>()
  const empByNumber = new Map<string, { id: string; companyId: string }[]>()
  for (const e of employees) {
    empLookup.set(`${e.employee_number}__${e.company_id}`, e.id)
    const list = empByNumber.get(e.employee_number) ?? []
    list.push({ id: e.id, companyId: e.company_id })
    empByNumber.set(e.employee_number, list)
  }

  // Fetch existing drivers
  const existingDrivers = await fetchAllRows('drivers', 'employee_id, deleted_at')
  const existingEmpIds = new Set(existingDrivers.filter((d: any) => !d.deleted_at).map((d: any) => d.employee_id))

  // Reproduce matching — collect failures
  type FailedDriver = {
    rowInFile: number
    empNum: string
    name: string
    companyCode: string
    companyName: string
    reason: string
  }

  const failed: FailedDriver[] = []

  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].split(',')
    const empNum = (f[0] ?? '').trim()

    if (!empNum || empNum === '0' || (f[16] ?? '').trim() !== '' || empNum.startsWith('EX')) continue

    const name = (f[1] ?? '').trim()
    const companyCode = (f[15] ?? '').trim() || '1'
    const companyName = COMPANY_NAMES[companyCode] ?? `קוד ${companyCode}`
    const companyId = companyMap.get(companyCode)

    if (!companyId) {
      failed.push({ rowInFile: i + 1, empNum, name, companyCode, companyName, reason: 'חברה לא נמצאה' })
      continue
    }

    const key = `${empNum}__${companyId}`
    let empId = empLookup.get(key)

    if (!empId) {
      const candidates = empByNumber.get(empNum)
      if (candidates?.length === 1) empId = candidates[0].id
    }

    if (!empId) {
      failed.push({ rowInFile: i + 1, empNum, name, companyCode, companyName, reason: 'עובד לא נמצא בDB' })
      continue
    }

    if (existingEmpIds.has(empId)) continue // already imported successfully

    // This is someone who matched but the employee_id FK failed
    failed.push({ rowInFile: i + 1, empNum, name, companyCode, companyName, reason: 'FK failed — employee_id לא קיים בטבלת employees' })
  }

  // Output CSV
  const csvPath = path.join(__dirname, '..', 'demo_files', 'failed-drivers-import.csv')
  const header = 'שורה בקובץ,מספר עובד,שם,קוד חברה,שם חברה,סיבה'
  const rows = failed.map(f => `${f.rowInFile},${f.empNum},${f.name},${f.companyCode},${f.companyName},${f.reason}`)

  // Write with BOM for Hebrew Excel
  const bom = '\uFEFF'
  fs.writeFileSync(csvPath, bom + header + '\n' + rows.join('\n'), 'utf-8')

  console.log(`סה"כ נכשלו: ${failed.length}\n`)
  console.log(header)
  console.log('-'.repeat(80))
  for (const f of failed) {
    console.log(`${f.rowInFile},${f.empNum},${f.name},${f.companyCode},${f.companyName},${f.reason}`)
  }
  console.log(`\nקובץ CSV נשמר: ${csvPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
