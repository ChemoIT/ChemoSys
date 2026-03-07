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

async function deleteAll(table: string): Promise<number> {
  const PAGE = 1000
  let total = 0
  while (true) {
    const { data } = await admin.from(table).select('id').limit(PAGE)
    if (!data || data.length === 0) break
    const ids = data.map((r: { id: string }) => r.id)
    const { error } = await admin.from(table).delete().in('id', ids)
    if (error) {
      console.error(`  שגיאה במחיקה מ-${table}:`, error.message)
      break
    }
    total += ids.length
    console.log(`  ${table}: נמחקו ${total} עד כה...`)
    if (data.length < PAGE) break
  }
  return total
}

async function main() {
  // Step 1: Save and NULL-ify users.employee_id
  const { data: usersWithEmp } = await admin
    .from('users')
    .select('id, employee_id')
    .not('employee_id', 'is', null)

  if (usersWithEmp?.length) {
    console.log(`מנתק ${usersWithEmp.length} users מ-employees...`)
    for (const u of usersWithEmp) {
      await admin.from('users').update({ employee_id: null }).eq('id', u.id)
    }
    console.log('  הושלם — employee_id הוגדר ל-NULL')
  }

  // Step 2: Delete all employees
  console.log('מוחק employees...')
  const count = await deleteAll('employees')
  console.log(`✅ נמחקו ${count} עובדים`)

  // Verify
  const { count: remaining } = await admin.from('employees').select('id', { count: 'exact', head: true })
  console.log(`נשארו: ${remaining ?? 0} עובדים`)
}

main().catch(e => { console.error(e); process.exit(1) })
