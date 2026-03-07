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

async function main() {
  // Find the employee
  const { data: emp, error: empErr } = await admin
    .from('employees')
    .select('id, first_name, last_name, employee_number, company_id')
    .or('last_name.ilike.%חלף%,last_name.ilike.%halef%,last_name.ilike.%khalaf%')

  console.log('עובדים שנמצאו:', emp?.length ?? 0, empErr?.message ?? '')
  if (emp?.length) {
    for (const e of emp) {
      console.log(`  ${e.first_name} ${e.last_name} | ID: ${e.id} | emp#: ${e.employee_number}`)
    }
  }

  if (!emp?.length) {
    // Try broader search
    const { data: all } = await admin.from('employees').select('id, first_name, last_name').ilike('first_name', '%אודליה%')
    console.log('חיפוש לפי שם פרטי:', all?.length ?? 0)
    if (all?.length) all.forEach(e => console.log(`  ${e.first_name} ${e.last_name} | ${e.id}`))
    return
  }

  const empId = emp[0].id
  console.log(`\nבודק FK על employee ID: ${empId}\n`)

  // Check users table
  const { data: users } = await admin.from('users').select('id, employee_id').eq('employee_id', empId)
  console.log(`users.employee_id: ${users?.length ?? 0} שורות`)
  if (users?.length) users.forEach(u => console.log(`  user: ${u.id}`))

  // Check drivers
  const { data: drivers } = await admin.from('drivers').select('id, employee_id').eq('employee_id', empId)
  console.log(`drivers.employee_id: ${drivers?.length ?? 0} שורות`)

  // Check employee_role_tags
  const { data: tags } = await admin.from('employee_role_tags').select('id, employee_id').eq('employee_id', empId)
  console.log(`employee_role_tags: ${tags?.length ?? 0} שורות`)

  // Check projects
  const { data: pm } = await admin.from('projects').select('id, project_name').eq('project_manager_id', empId)
  const { data: sm } = await admin.from('projects').select('id, project_name').eq('site_manager_id', empId)
  const { data: cvc } = await admin.from('projects').select('id, project_name').eq('camp_vehicle_coordinator_id', empId)
  console.log(`projects.project_manager_id: ${pm?.length ?? 0}`)
  console.log(`projects.site_manager_id: ${sm?.length ?? 0}`)
  console.log(`projects.camp_vehicle_coordinator_id: ${cvc?.length ?? 0}`)

  // Try to delete
  console.log('\nמנסה למחוק...')
  const { error: delErr } = await admin.from('employees').delete().eq('id', empId)
  if (delErr) {
    console.log('שגיאת מחיקה:')
    console.log('  code:', delErr.code)
    console.log('  message:', delErr.message)
    console.log('  details:', delErr.details)
    console.log('  hint:', delErr.hint)
  } else {
    console.log('✅ המחיקה הצליחה!')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
