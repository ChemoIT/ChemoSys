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
  // Query FK constraints pointing to employees
  const { data, error } = await admin.rpc('exec_sql', {
    query: `
      SELECT
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'employees'
      ORDER BY source_table;
    `
  })

  if (error) {
    console.log('RPC error, trying direct query...')
    // Alternative: try a batch delete of just 5 and see which one fails
    const { data: emps } = await admin.from('employees').select('id').limit(5)
    if (!emps?.length) return
    for (const emp of emps) {
      const { error: delErr } = await admin.from('employees').delete().eq('id', emp.id)
      if (delErr) {
        console.log(`Failed to delete ${emp.id}:`, delErr.message, delErr.details, delErr.hint)
      } else {
        console.log(`Deleted ${emp.id} OK`)
      }
    }
    return
  }

  console.log('FK constraints pointing to employees:')
  for (const row of data) {
    console.log(`  ${row.source_table}.${row.source_column} → employees.${row.target_column} (${row.constraint_name})`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
