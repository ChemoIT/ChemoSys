/**
 * clean-all-tables.ts — HARD DELETE all imported data.
 *
 * Deletes in FK-safe order:
 *   1. driver_violations
 *   2. driver_documents
 *   3. driver_licenses
 *   4. drivers
 *   5. employee_role_tags
 *   6. SET NULL on projects FK columns (project_manager_id, site_manager_id, etc.)
 *   7. employees
 *   8. driver_document_names
 *
 * Does NOT touch: users, projects (rows), departments, companies.
 *
 * Usage: npx tsx scripts/clean-all-tables.ts
 *
 * ⚠️  DESTRUCTIVE — run only after confirming with Sharon.
 *     This wipes ALL employees, drivers, and related data.
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Load .env.local ──────────────────────────────────────────────
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

// ─── Pagination helper ────────────────────────────────────────────
async function countRows(table: string): Promise<number> {
  const { count } = await admin.from(table).select('id', { count: 'exact', head: true })
  return count ?? 0
}

async function deleteAll(table: string): Promise<number> {
  // Supabase needs a filter for delete — use id != impossible UUID
  // Or delete with gte on created_at to match all rows
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
    if (data.length < PAGE) break
  }

  return total
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║   סקריפט ניקוי מלא — HARD DELETE ALL DATA      ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log()

  // Pre-count
  const counts: Record<string, number> = {}
  for (const table of ['driver_violations', 'driver_documents', 'driver_licenses', 'drivers', 'employee_role_tags', 'employees', 'driver_document_names']) {
    counts[table] = await countRows(table)
  }

  console.log('── מצב נוכחי ──')
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count} שורות`)
  }
  console.log()

  // Step 1: driver_violations
  console.log('1/8 מוחק driver_violations...')
  const v = await deleteAll('driver_violations')
  console.log(`     נמחקו ${v} שורות`)

  // Step 2: driver_documents
  console.log('2/8 מוחק driver_documents...')
  const dd = await deleteAll('driver_documents')
  console.log(`     נמחקו ${dd} שורות`)

  // Step 3: driver_licenses
  console.log('3/8 מוחק driver_licenses...')
  const dl = await deleteAll('driver_licenses')
  console.log(`     נמחקו ${dl} שורות`)

  // Step 4: drivers
  console.log('4/8 מוחק drivers...')
  const dr = await deleteAll('drivers')
  console.log(`     נמחקו ${dr} שורות`)

  // Step 5: employee_role_tags
  console.log('5/8 מוחק employee_role_tags...')
  const ert = await deleteAll('employee_role_tags')
  console.log(`     נמחקו ${ert} שורות`)

  // Step 6: NULL-ify project FK columns that reference employees
  console.log('6/8 מנתק FK של projects מעובדים...')
  const { error: projErr } = await admin
    .from('projects')
    .update({
      project_manager_id: null,
      site_manager_id: null,
      camp_vehicle_coordinator_id: null,
    })
    .not('id', 'is', null) // match all rows
  if (projErr) {
    console.error('     שגיאה:', projErr.message)
  } else {
    console.log('     הושלם — כל ה-FK של projects הוגדרו ל-NULL')
  }

  // Step 7: employees
  console.log('7/8 מוחק employees...')
  const emp = await deleteAll('employees')
  console.log(`     נמחקו ${emp} שורות`)

  // Step 8: driver_document_names
  console.log('8/8 מוחק driver_document_names...')
  const dn = await deleteAll('driver_document_names')
  console.log(`     נמחקו ${dn} שורות`)

  console.log()
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║   ✅ הניקוי הושלם                                ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log()
  console.log('סיכום:')
  console.log(`  driver_violations:    ${v} נמחקו`)
  console.log(`  driver_documents:     ${dd} נמחקו`)
  console.log(`  driver_licenses:      ${dl} נמחקו`)
  console.log(`  drivers:              ${dr} נמחקו`)
  console.log(`  employee_role_tags:   ${ert} נמחקו`)
  console.log(`  employees:            ${emp} נמחקו`)
  console.log(`  driver_document_names: ${dn} נמחקו`)
  console.log()
  console.log('הטבלאות הבאות לא נמחקו: users, projects, departments, companies')
  console.log('עכשיו ניתן לייבא מחדש עובדים (אקסל) ונהגים (Drivers.top)')
}

main().catch((err) => {
  console.error('שגיאה קריטית:', err)
  process.exit(1)
})
