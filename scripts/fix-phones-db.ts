/**
 * Fix all phone numbers in employees table.
 * - Normalizes mobile_phone and additional_phone using the same logic as normalizePhone()
 * - If mobile_phone is invalid but additional_phone is valid → moves additional to mobile
 * - Clears invalid phone values (sets to null)
 *
 * Usage: npx tsx scripts/fix-phones-db.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

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

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00972')) digits = digits.slice(5)
  else if (digits.startsWith('972')) digits = digits.slice(3)
  if (digits.startsWith('5') && digits.length === 9) digits = '0' + digits
  if (digits.length === 10 && digits.startsWith('05')) return digits
  return null
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
  console.log('=== תיקון טלפונים בטבלת employees ===\n')

  const employees = await fetchAllRows('employees', 'id, employee_number, first_name, last_name, mobile_phone, additional_phone')
  console.log(`סה"כ עובדים: ${employees.length}\n`)

  let fixed = 0
  let mobileNormalized = 0
  let additionalNormalized = 0
  let mobileCleared = 0
  let additionalCleared = 0
  let mobileFallback = 0 // mobile was junk, took additional instead
  const changes: string[] = []

  for (const e of employees) {
    const origMobile = e.mobile_phone
    const origAdditional = e.additional_phone

    const normMobile = normalizePhone(origMobile)
    const normAdditional = normalizePhone(origAdditional)

    let newMobile: string | null = normMobile
    let newAdditional: string | null = normAdditional

    // If mobile is invalid but additional is valid → use additional as mobile
    if (!normMobile && normAdditional) {
      newMobile = normAdditional
      newAdditional = null
      mobileFallback++
    }

    // Check if anything changed
    const mobileChanged = origMobile !== newMobile
    const additionalChanged = origAdditional !== newAdditional

    if (!mobileChanged && !additionalChanged) continue

    // Track stats
    if (mobileChanged) {
      if (newMobile && origMobile) mobileNormalized++
      else if (!newMobile && origMobile) mobileCleared++
    }
    if (additionalChanged) {
      if (newAdditional && origAdditional) additionalNormalized++
      else if (!newAdditional && origAdditional) additionalCleared++
    }

    changes.push(
      `  [${e.employee_number}] ${e.first_name} ${e.last_name}: ` +
      `mobile: "${origMobile}" → "${newMobile}", additional: "${origAdditional}" → "${newAdditional}"`
    )

    // Update DB
    const { error } = await admin
      .from('employees')
      .update({ mobile_phone: newMobile, additional_phone: newAdditional })
      .eq('id', e.id)

    if (error) {
      console.log(`  ❌ [${e.employee_number}]: ${error.message}`)
    } else {
      fixed++
    }
  }

  console.log(`=== סיכום ===`)
  console.log(`  עובדים שתוקנו: ${fixed}`)
  console.log(`  mobile נורמל (הוספת 0 וכו'): ${mobileNormalized}`)
  console.log(`  mobile נוקה (לא טלפון): ${mobileCleared}`)
  console.log(`  mobile ← fallback מ-additional: ${mobileFallback}`)
  console.log(`  additional נורמל: ${additionalNormalized}`)
  console.log(`  additional נוקה: ${additionalCleared}`)

  if (changes.length > 0) {
    console.log(`\n=== פירוט שינויים (${changes.length}) ===`)
    for (const c of changes) console.log(c)
  }

  // Verify: count phones that don't start with 05
  const afterEmps = await fetchAllRows('employees', 'id, mobile_phone, additional_phone')
  const badMobile = afterEmps.filter(e => e.mobile_phone && !e.mobile_phone.startsWith('05'))
  const badAdditional = afterEmps.filter(e => e.additional_phone && !e.additional_phone.startsWith('05'))
  console.log(`\n=== אימות ===`)
  console.log(`  mobile_phone לא תקני (לא 05x): ${badMobile.length}`)
  console.log(`  additional_phone לא תקני (לא 05x): ${badAdditional.length}`)
  if (badMobile.length > 0) {
    for (const e of badMobile.slice(0, 10)) {
      console.log(`    mobile: "${e.mobile_phone}"`)
    }
  }
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
