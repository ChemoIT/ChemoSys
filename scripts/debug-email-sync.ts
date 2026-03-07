/**
 * debug-email-sync.ts — Diagnose email propagation for a specific employee.
 *
 * Usage: npx tsx scripts/debug-email-sync.ts 3941
 *
 * Checks:
 * 1. Employee record (email in employees table)
 * 2. Linked user in public.users
 * 3. Auth email in auth.users
 * 4. Attempts to sync if mismatch found
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually (no dotenv dependency)
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
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

async function main() {
  const empNumber = process.argv[2] || '3941'
  console.log(`\n=== Diagnosing email sync for employee_number: ${empNumber} ===\n`)

  // Step 1: Find employee
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, employee_number, first_name, last_name, email, company_id')
    .eq('employee_number', empNumber)
    .is('deleted_at', null)

  if (empError) {
    console.error('Employee query error:', empError.message)
    return
  }

  if (!employee || employee.length === 0) {
    console.log('No employee found with that number.')
    return
  }

  for (const emp of employee) {
    console.log(`Employee: ${emp.first_name} ${emp.last_name} (ID: ${emp.id})`)
    console.log(`  employees.email: ${emp.email ?? '(null)'}`)

    // Step 2: Find linked user
    const { data: linkedUser, error: userError } = await supabase
      .from('users')
      .select('id, auth_user_id, is_blocked, deleted_at')
      .eq('employee_id', emp.id)

    if (userError) {
      console.error('  Users query error:', userError.message)
      continue
    }

    if (!linkedUser || linkedUser.length === 0) {
      console.log('  No linked user found.')
      continue
    }

    for (const user of linkedUser) {
      console.log(`  Linked user: ${user.id}`)
      console.log(`    auth_user_id: ${user.auth_user_id}`)
      console.log(`    deleted_at: ${user.deleted_at ?? '(null)'}`)
      console.log(`    is_blocked: ${user.is_blocked}`)

      // Step 3: Get auth email
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.auth_user_id)

      if (authError) {
        console.error(`    Auth getUserById error: ${authError.message}`)
        continue
      }

      console.log(`    auth.users.email: ${authUser.user?.email ?? '(null)'}`)

      // Step 4: Check mismatch
      if (emp.email && authUser.user?.email !== emp.email) {
        console.log(`\n    >>> MISMATCH DETECTED <<<`)
        console.log(`    employees.email: ${emp.email}`)
        console.log(`    auth.users.email: ${authUser.user?.email}`)

        // Try to fix
        console.log(`\n    Attempting sync...`)
        const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
          user.auth_user_id,
          { email: emp.email, email_confirm: true }
        )

        if (updateError) {
          console.error(`    SYNC FAILED: ${updateError.message}`)
        } else {
          console.log(`    SYNC SUCCESS — new auth email: ${updated.user?.email}`)
        }
      } else if (emp.email) {
        console.log(`    Emails match — no sync needed.`)
      }
    }
  }

  // Step 5: Check if target email exists in other auth users
  const targetEmail = employee[0]?.email
  if (targetEmail) {
    console.log(`\n--- Checking if "${targetEmail}" exists in other auth users ---`)
    const { data: allAuth } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (allAuth?.users) {
      const matches = allAuth.users.filter(u => u.email === targetEmail)
      if (matches.length > 0) {
        console.log(`Found ${matches.length} auth user(s) with this email:`)
        for (const m of matches) {
          console.log(`  auth_user_id: ${m.id}, email: ${m.email}, created: ${m.created_at}`)
        }
      } else {
        console.log('No auth users found with this email.')
      }
    }
  }

  // Step 6: Delete orphan auth user and retry sync if requested
  const orphanId = process.argv[3]
  if (orphanId) {
    console.log(`\n--- Deleting orphan auth user: ${orphanId} ---`)
    const { error: delError } = await supabase.auth.admin.deleteUser(orphanId)
    if (delError) {
      console.error(`DELETE FAILED: ${delError.message}`)
    } else {
      console.log('DELETE SUCCESS — orphan auth user removed.')

      // Retry sync for active linked user
      if (targetEmail) {
        const activeUser = employee.length > 0
          ? await supabase.from('users').select('auth_user_id').eq('employee_id', employee[0].id).is('deleted_at', null).maybeSingle()
          : null
        if (activeUser?.data?.auth_user_id) {
          console.log(`\nRetrying sync for active user (auth_user_id: ${activeUser.data.auth_user_id})...`)
          const { data: retryData, error: retryError } = await supabase.auth.admin.updateUserById(
            activeUser.data.auth_user_id,
            { email: targetEmail, email_confirm: true }
          )
          if (retryError) {
            console.error(`RETRY SYNC FAILED: ${retryError.message}`)
          } else {
            console.log(`RETRY SYNC SUCCESS — auth email now: ${retryData.user?.email}`)
          }
        }
      }
    }
  }

  console.log('\n=== Done ===\n')
}

main().catch(console.error)
