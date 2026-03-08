'use server'

/**
 * vehicle-ownership.ts — Server Actions for vehicle monthly costs (ownership tab).
 *
 * Guard: ALL actions start with verifyAppUser() — ChemoSys employee-facing app.
 *
 * vehicle_monthly_costs Activity Journal rules:
 *   - One active record per vehicle at a time (end_date IS NULL = current rate)
 *   - No soft-delete, no hard-delete — financial audit trail is immutable
 *   - addVehicleMonthlyCost: closes previous open record, then inserts new
 *   - updateVehicleMonthlyCost: direct .update() works — no deleted_at RLS filter on this table
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifyAppUser } from '@/lib/dal'
import type { VehicleMonthlyCost } from '@/lib/fleet/vehicle-types'

export type CostActionResult = {
  success: boolean
  error?: string
  id?: string
}

// ─────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────

/**
 * Returns all monthly cost records for a vehicle, ordered start_date DESC.
 * Active record (end_date IS NULL) appears first.
 */
export async function getVehicleMonthlyCosts(vehicleId: string): Promise<VehicleMonthlyCost[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_monthly_costs')
    .select('id, vehicle_id, start_date, end_date, amount, created_at')
    .eq('vehicle_id', vehicleId)
    .order('start_date', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    id: r.id,
    vehicleId: r.vehicle_id,
    startDate: r.start_date,
    endDate: r.end_date ?? null,
    amount: Number(r.amount),
    createdAt: r.created_at,
  }))
}

// ─────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────

/**
 * Adds a new monthly cost entry.
 *
 * Business invariant: only one record per vehicle may have end_date IS NULL.
 * Step 1: Close the current active record by setting end_date = new startDate.
 *   (The new rate takes effect from startDate, so the previous rate ends the day before.)
 * Step 2: Insert new record with end_date = null (becomes the new active record).
 *
 * If no active record exists for this vehicle, step 1 updates 0 rows — that is correct.
 */
export async function addVehicleMonthlyCost(input: {
  vehicleId: string
  startDate: string  // yyyy-mm-dd
  amount: number
}): Promise<CostActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  if (!input.vehicleId) return { success: false, error: 'מזהה רכב נדרש' }
  if (!input.startDate) return { success: false, error: 'תאריך התחלה נדרש' }
  if (!input.amount || input.amount <= 0) return { success: false, error: 'סכום חייב להיות חיובי' }

  // Step 1: Close the current active record (end_date IS NULL)
  await supabase
    .from('vehicle_monthly_costs')
    .update({ end_date: input.startDate, updated_by: userId })
    .eq('vehicle_id', input.vehicleId)
    .is('end_date', null)

  // Step 2: Insert the new rate (end_date = null = becomes active)
  const { data, error } = await supabase
    .from('vehicle_monthly_costs')
    .insert({
      vehicle_id: input.vehicleId,
      start_date: input.startDate,
      end_date: null,
      amount: input.amount,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת עלות חודשית' }

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true, id: data.id }
}

/**
 * Edits an existing monthly cost record (correction, not a new period).
 * Direct UPDATE — no RPC needed because vehicle_monthly_costs SELECT RLS
 * uses USING (true) — no deleted_at filter that would require SECURITY DEFINER.
 *
 * No delete action is exposed — cost history is an immutable financial audit trail.
 */
export async function updateVehicleMonthlyCost(input: {
  costId: string
  vehicleId: string
  startDate: string
  endDate?: string | null
  amount: number
}): Promise<CostActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  if (!input.costId) return { success: false, error: 'מזהה רשומה נדרש' }
  if (!input.startDate) return { success: false, error: 'תאריך התחלה נדרש' }
  if (!input.amount || input.amount <= 0) return { success: false, error: 'סכום חייב להיות חיובי' }

  const { error } = await supabase
    .from('vehicle_monthly_costs')
    .update({
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      amount: input.amount,
      updated_by: userId,
    })
    .eq('id', input.costId)
    .eq('vehicle_id', input.vehicleId)

  if (error) return { success: false, error: 'שגיאה בעדכון עלות חודשית' }

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true }
}
