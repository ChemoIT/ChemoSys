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
  // Check users with employee_id
  const { data: users, error: usersErr } = await admin
    .from('users')
    .select('id, employee_id')
    .not('employee_id', 'is', null)
  console.log('Users with employee_id:', users?.length ?? 0, usersErr?.message ?? '')
  if (users?.length) console.log('  Sample:', users.slice(0, 3))

  // Try deleting one employee to see detailed error
  const { data: emp } = await admin.from('employees').select('id').limit(1)
  if (!emp?.length) { console.log('No employees found'); return }

  console.log('Trying to delete employee:', emp[0].id)
  const { error } = await admin.from('employees').delete().eq('id', emp[0].id)
  if (error) {
    console.log('Delete error code:', error.code)
    console.log('Delete error message:', error.message)
    console.log('Delete error details:', error.details)
    console.log('Delete error hint:', error.hint)
  } else {
    console.log('Delete succeeded!')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
