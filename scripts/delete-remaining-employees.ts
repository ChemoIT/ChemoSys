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
  // Find protected employee IDs (referenced by users table)
  const { data: users } = await admin
    .from('users')
    .select('employee_id')
    .not('employee_id', 'is', null)

  const protectedIds = new Set(users?.map(u => u.employee_id) ?? [])
  console.log(`עובדים מוגנים (מקושרים ל-users): ${protectedIds.size}`)
  for (const id of protectedIds) console.log(`  ${id}`)

  const { count: before } = await admin.from('employees').select('id', { count: 'exact', head: true })
  console.log(`עובדים לפני מחיקה: ${before}`)

  // Delete in batches, excluding protected IDs
  const BATCH = 100
  let total = 0
  while (true) {
    let query = admin.from('employees').select('id').limit(BATCH)
    for (const pid of protectedIds) {
      query = query.neq('id', pid)
    }
    const { data } = await query
    if (!data || data.length === 0) break

    const ids = data.map((r: { id: string }) => r.id)
    const { error } = await admin.from('employees').delete().in('id', ids)
    if (error) {
      console.error(`שגיאה:`, error.message)
      break
    }
    total += ids.length
    process.stdout.write(`\r  נמחקו ${total}...`)
    if (data.length < BATCH) break
  }

  const { count: after } = await admin.from('employees').select('id', { count: 'exact', head: true })
  console.log(`\n✅ נמחקו ${total} עובדים. נשארו: ${after ?? 0} (כולל ${protectedIds.size} מוגנים)`)
}

main().catch(e => { console.error(e); process.exit(1) })
