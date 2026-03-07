'use server'
// mot-sync.ts — MOT (Ministry of Transportation) API Server Actions.
//
// Syncs vehicle data from the Israeli open data registry (data.gov.il).
// Resource ID: 053cea08-09bc-40ec-8f7a-156f0677aff3 (vehicle registry)
//
// CRITICAL: MOT API requires mispar_rechev as a NUMBER, not a string.
// Never cache MOT data — always fetch fresh (revalidate: 0).
// SECURITY: syncVehicleFromMot + lookupVehicleFromMot use verifyAppUser (ChemoSys).
//           testMotApiConnection keeps verifySession (admin-only, called from FleetSettings).

import { verifySession, verifyAppUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TestResult } from '@/actions/settings'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type MotVehicleData = {
  mispar_rechev: number
  tozeret_nm: string | null
  degem_nm: string | null
  kinuy_mishari: string | null
  shnat_yitzur: number | null
  tzeva_rechev: string | null
  sug_delek_nm: string | null
  misgeret: string | null
  degem_manoa: string | null
  ramat_gimur: string | null
  kvutzat_zihum: number | null
  baalut: string | null
  moed_aliya_lakvish: string | null
  tokef_dt: string | null
  mivchan_acharon_dt: string | null
}

type MotApiResponse = {
  success: boolean
  result: {
    total: number
    records: MotVehicleData[]
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: parse MOT "YYYY-M" date format → ISO "YYYY-MM-01"
// ─────────────────────────────────────────────────────────────

/**
 * parseMoedAliya — converts MOT "moed_aliya_lakvish" field to a PostgreSQL-compatible DATE string.
 *
 * MOT API returns dates in "YYYY-M" or "YYYY-MM" format (month without leading zero).
 * PostgreSQL DATE columns expect "YYYY-MM-DD".
 * We use the 1st of the month since MOT only provides year + month.
 *
 * Examples:
 *   parseMoedAliya("2017-3")  → "2017-03-01"
 *   parseMoedAliya("2020-12") → "2020-12-01"
 *   parseMoedAliya(null)      → null
 *   parseMoedAliya("")        → null
 */
function parseMoedAliya(raw: string | null | undefined): string | null {
  if (!raw) return null
  const parts = raw.split('-')
  if (parts.length < 2) return null
  const year = parts[0]
  const month = parts[1].padStart(2, '0')
  if (!year || !month || isNaN(Number(year)) || isNaN(Number(month))) return null
  return `${year}-${month}-01`
}

// ─────────────────────────────────────────────────────────────
// MOT API base URL + resource
// ─────────────────────────────────────────────────────────────

const MOT_API_BASE = 'https://data.gov.il/api/3/action/datastore_search'
const MOT_RESOURCE_ID = '053cea08-09bc-40ec-8f7a-156f0677aff3'

// ─────────────────────────────────────────────────────────────
// syncVehicleFromMot
// ─────────────────────────────────────────────────────────────

/**
 * Fetches vehicle data from the MOT registry and updates the vehicles table.
 * Also inserts a vehicle_tests record if test date + expiry are available.
 *
 * CRITICAL: MOT API requires mispar_rechev as a NUMBER (not string).
 * Strip non-digits, convert to Number — reject if NaN or 0.
 *
 * Never cache: uses { next: { revalidate: 0 } }
 */
export async function syncVehicleFromMot(
  vehicleId: string,
  licensePlate: string
): Promise<{ success: boolean; data?: MotVehicleData; error?: string }> {
  const { userId } = await verifyAppUser()

  // Convert plate to number — strip anything non-digit first
  const digitsOnly = licensePlate.replace(/\D/g, '')
  const plateNumber = Number(digitsOnly)

  if (!digitsOnly || isNaN(plateNumber) || plateNumber === 0) {
    return { success: false, error: 'מספר רישוי לא תקין' }
  }

  // Build MOT API URL
  const url = new URL(MOT_API_BASE)
  url.searchParams.set('resource_id', MOT_RESOURCE_ID)
  url.searchParams.set('filters', JSON.stringify({ mispar_rechev: plateNumber }))
  url.searchParams.set('limit', '1')
  url.searchParams.set('records_format', 'objects')
  url.searchParams.set('include_total', 'true')

  let json: MotApiResponse
  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 }, // never cache MOT data
    })

    if (!res.ok) {
      return { success: false, error: `שגיאת רשת: ${res.status} ${res.statusText}` }
    }

    json = await res.json() as MotApiResponse
  } catch (err) {
    return {
      success: false,
      error: `שגיאת רשת: ${err instanceof Error ? err.message : 'Unknown'}`,
    }
  }

  if (!json.success || json.result.total === 0) {
    return { success: false, error: 'הרכב לא נמצא ברשומות משרד הרישוי' }
  }

  const v = json.result.records[0]

  // Update vehicles table with MOT fields
  const supabase = await createClient()

  const { error: updateError } = await supabase
    .from('vehicles')
    .update({
      tozeret_nm:         v.tozeret_nm,
      degem_nm:           v.degem_nm,
      kinuy_mishari:      v.kinuy_mishari,
      shnat_yitzur:       v.shnat_yitzur,
      tzeva_rechev:       v.tzeva_rechev,
      sug_delek_nm:       v.sug_delek_nm,
      misgeret:           v.misgeret,
      degem_manoa:        v.degem_manoa,
      ramat_gimur:        v.ramat_gimur,
      kvutzat_zihum:      String(v.kvutzat_zihum ?? ''), // number → string (DB TEXT column)
      baalut:             v.baalut,
      moed_aliya_lakvish: parseMoedAliya(v.moed_aliya_lakvish), // "YYYY-M" → "YYYY-MM-01"
      mot_last_sync_at:   new Date().toISOString(),
    })
    .eq('id', vehicleId)

  if (updateError) {
    console.error('[mot-sync] Failed to update vehicles:', updateError.message)
    return { success: false, error: 'שגיאה בעדכון הרכב: ' + updateError.message }
  }

  // Insert vehicle_tests record if both test date + expiry are present
  if (v.mivchan_acharon_dt && v.tokef_dt) {
    const { error: testError } = await supabase
      .from('vehicle_tests')
      .insert({
        vehicle_id:   vehicleId,
        test_date:    v.mivchan_acharon_dt,
        expiry_date:  v.tokef_dt,
        passed:       true,
        alert_enabled: true,
        created_by:   userId,
        updated_by:   userId,
      })

    if (testError) {
      // Log but don't fail the sync — the vehicle data was already updated
      console.error('[mot-sync] Failed to insert vehicle_tests:', testError.message)
    }
  }

  revalidatePath('/app/fleet/vehicle-card/' + vehicleId)

  return { success: true, data: v }
}

// ─────────────────────────────────────────────────────────────
// lookupVehicleFromMot
// ─────────────────────────────────────────────────────────────

/**
 * Read-only MOT lookup — fetches vehicle data without writing to DB.
 * Used by AddVehicleDialog to preview MOT data before creating a vehicle card.
 *
 * CRITICAL: MOT API requires mispar_rechev as a NUMBER (not string).
 * Strip non-digits, convert to Number — reject if NaN or 0.
 *
 * Never cache: uses { next: { revalidate: 0 } }
 */
export async function lookupVehicleFromMot(
  licensePlate: string
): Promise<{ success: boolean; data?: MotVehicleData; error?: string }> {
  await verifyAppUser()

  // Convert plate to number — strip anything non-digit first
  const digitsOnly = licensePlate.replace(/\D/g, '')
  const plateNumber = Number(digitsOnly)

  if (!digitsOnly || isNaN(plateNumber) || plateNumber === 0) {
    return { success: false, error: 'מספר רישוי לא תקין' }
  }

  // Build MOT API URL
  const url = new URL(MOT_API_BASE)
  url.searchParams.set('resource_id', MOT_RESOURCE_ID)
  url.searchParams.set('filters', JSON.stringify({ mispar_rechev: plateNumber }))
  url.searchParams.set('limit', '1')
  url.searchParams.set('records_format', 'objects')
  url.searchParams.set('include_total', 'true')

  let json: MotApiResponse
  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 }, // never cache MOT data
    })

    if (!res.ok) {
      return { success: false, error: `שגיאת רשת: ${res.status} ${res.statusText}` }
    }

    json = await res.json() as MotApiResponse
  } catch (err) {
    return {
      success: false,
      error: `שגיאת רשת: ${err instanceof Error ? err.message : 'Unknown'}`,
    }
  }

  if (!json.success || json.result.total === 0) {
    return { success: false, error: 'הרכב לא נמצא ברשומות משרד הרישוי' }
  }

  const v = json.result.records[0]
  return { success: true, data: v }
}

// ─────────────────────────────────────────────────────────────
// testMotApiConnection
// ─────────────────────────────────────────────────────────────

/**
 * Tests connectivity to the MOT API by querying a known plate number.
 * Uses plate 6242255 — a public bus always present in the registry.
 * Returns { ok, message } compatible with TestResult from settings.ts.
 */
export async function testMotApiConnection(): Promise<TestResult> {
  await verifySession()

  const TEST_PLATE = 6242255 // Known public bus — always in MOT registry

  const url = new URL(MOT_API_BASE)
  url.searchParams.set('resource_id', MOT_RESOURCE_ID)
  url.searchParams.set('filters', JSON.stringify({ mispar_rechev: TEST_PLATE }))
  url.searchParams.set('limit', '1')
  url.searchParams.set('records_format', 'objects')
  url.searchParams.set('include_total', 'true')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return { ok: false, message: `שגיאת רשת: ${res.status} ${res.statusText}` }
    }

    const json = await res.json() as MotApiResponse

    if (json.success && json.result.total > 0) {
      return { ok: true, message: 'API משרד הרישוי נגיש — מצא רכב בדיקה' }
    }

    if (json.success && json.result.total === 0) {
      return { ok: true, message: 'API נגיש אך לא מצא רכב בדיקה' }
    }

    return { ok: false, message: 'API החזיר תשובה לא צפויה' }
  } catch (err) {
    return {
      ok: false,
      message: `שגיאת רשת: ${err instanceof Error ? err.message : 'Unknown'}`,
    }
  }
}
