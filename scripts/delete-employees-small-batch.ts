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
  const BATCH = 100 // smaller batch to avoid URL length limit
  let total = 0

  const { count } = await admin.from('employees').select('id', { count: 'exact', head: true })
  console.log(`עובדים לפני מחיקה: ${count}`)

  while (true) {
    const { data } = await admin.from('employees').select('id').limit(BATCH)
    if (!data || data.length === 0) break

    const ids = data.map((r: { id: string }) => r.id)
    const { error } = await admin.from('employees').delete().in('id', ids)
    if (error) {
      console.error(`שגיאה ב-batch:`, error.message)
      // Try one by one for this batch
      for (const id of ids) {
        const { error: e2 } = await admin.from('employees').delete().eq('id', id)
        if (e2) console.error(`  נכשל ${id}: ${e2.message}`)
        else total++
      }
    } else {
      total += ids.length
    }
    process.stdout.write(`\r  נמחקו ${total}...`)
  }

  console.log(`\n✅ סה"כ נמחקו ${total} עובדים`)
  const { count: remaining } = await admin.from('employees').select('id', { count: 'exact', head: true })
  console.log(`נשארו: ${remaining ?? 0}`)
}

main().catch(e => { console.error(e); process.exit(1) })
