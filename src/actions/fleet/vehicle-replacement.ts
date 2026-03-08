'use server'

/**
 * fleet/vehicle-replacement.ts -- Server Actions for Vehicle Replacement Records.
 *
 * Guard: ALL actions start with verifyAppUser() -- ChemoSys employee-facing app.
 *
 * Business rules:
 *   - Only one ACTIVE replacement record per vehicle at a time.
 *   - Adding active replacement: sets vehicle vehicle_status='suspended', is_active=false.
 *   - Returning replacement (returnDate set): if no other active replacement, restores vehicle to active.
 *   - vehicle_fuel_cards: hard-delete (no soft-delete -- decision [16-01]).
 *   - single_active_per_vehicle rule enforced here (NOT in DB triggers).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifyAppUser } from '@/lib/dal'
import type {
  VehicleReplacementRecord,
  VehicleFuelCard,
} from '@/lib/fleet/vehicle-types'

export type ActionResult = {
  success: boolean
  error?: string
}

// ─────────────────────────────────────────────────────────────
// GET REPLACEMENT RECORDS
// ─────────────────────────────────────────────────────────────

export async function getVehicleReplacementRecords(
  vehicleId: string
): Promise<VehicleReplacementRecord[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_replacement_records')
    .select('*, vehicle_fuel_cards(*)')
    .eq('vehicle_id', vehicleId)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })

  if (error || !data) return []

  return data.map((r) => {
    const fuelCards = ((r.vehicle_fuel_cards as unknown) as Array<{
      id: string
      replacement_record_id: string
      card_number: string
      created_at: string
    }> ?? []).map((fc): VehicleFuelCard => ({
      id: fc.id,
      replacementRecordId: fc.replacement_record_id,
      cardNumber: fc.card_number,
      createdAt: fc.created_at,
    }))

    return {
      id: r.id,
      vehicleId: r.vehicle_id,
      licensePlate: r.license_plate,
      motData: r.mot_data ?? null,
      entryDate: r.entry_date,
      entryKm: r.entry_km ?? null,
      returnDate: r.return_date ?? null,
      returnKm: r.return_km ?? null,
      reason: r.reason as 'maintenance' | 'test' | 'accident' | 'other',
      reasonOther: r.reason_other ?? null,
      status: (r.return_date ? 'returned' : 'active') as 'active' | 'returned',
      notes: r.notes ?? null,
      fuelCards,
      createdAt: r.created_at,
    }
  })
}

// ─────────────────────────────────────────────────────────────
// ADD REPLACEMENT RECORD
// ─────────────────────────────────────────────────────────────

type AddReplacementInput = {
  vehicleId: string
  licensePlate: string
  entryDate: string
  entryKm?: number | null
  reason: 'maintenance' | 'test' | 'accident' | 'other'
  reasonOther?: string | null
  notes?: string | null
}

export async function addVehicleReplacementRecord(
  input: AddReplacementInput
): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  if (!input.licensePlate.trim()) {
    return { success: false, error: 'מספר רישוי נדרש' }
  }

  if (input.reason === 'other' && !input.reasonOther?.trim()) {
    return { success: false, error: 'נדרש הסבר לסיבה "אחר"' }
  }

  // Guard: only one active replacement per vehicle
  const { data: existing } = await supabase
    .from('vehicle_replacement_records')
    .select('id')
    .eq('vehicle_id', input.vehicleId)
    .is('return_date', null)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: 'קיים כבר רכב חלופי פעיל עבור רכב זה',
    }
  }

  const { data, error } = await supabase
    .from('vehicle_replacement_records')
    .insert({
      vehicle_id: input.vehicleId,
      license_plate: input.licensePlate.trim(),
      entry_date: input.entryDate,
      entry_km: input.entryKm ?? null,
      reason: input.reason,
      reason_other: input.reasonOther?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת רכב חלופי' }

  // Set vehicle to suspended
  await supabase
    .from('vehicles')
    .update({ vehicle_status: 'suspended', is_active: false, updated_by: userId })
    .eq('id', input.vehicleId)
    .is('deleted_at', null)

  revalidatePath('/app/fleet/vehicle-card/' + input.vehicleId)
  return { success: true, id: data.id }
}

// ─────────────────────────────────────────────────────────────
// UPDATE REPLACEMENT RECORD
// ─────────────────────────────────────────────────────────────

type UpdateReplacementInput = {
  recordId: string
  vehicleId: string
  licensePlate: string
  entryDate: string
  entryKm?: number | null
  returnDate?: string | null
  returnKm?: number | null
  reason: 'maintenance' | 'test' | 'accident' | 'other'
  reasonOther?: string | null
  notes?: string | null
}

export async function updateVehicleReplacementRecord(
  input: UpdateReplacementInput
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  if (input.reason === 'other' && !input.reasonOther?.trim()) {
    return { success: false, error: 'נדרש הסבר לסיבה "אחר"' }
  }

  const { error } = await supabase
    .from('vehicle_replacement_records')
    .update({
      license_plate: input.licensePlate.trim(),
      entry_date: input.entryDate,
      entry_km: input.entryKm ?? null,
      return_date: input.returnDate ?? null,
      return_km: input.returnKm ?? null,
      reason: input.reason,
      reason_other: input.reasonOther?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      updated_by: userId,
    })
    .eq('id', input.recordId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'שגיאה בעדכון רכב חלופי' }

  // If record now returned, check if vehicle should go back to active
  if (input.returnDate) {
    const { data: stillActive } = await supabase
      .from('vehicle_replacement_records')
      .select('id')
      .eq('vehicle_id', input.vehicleId)
      .is('return_date', null)
      .is('deleted_at', null)
      .neq('id', input.recordId)
      .maybeSingle()

    if (!stillActive) {
      await supabase
        .from('vehicles')
        .update({ vehicle_status: 'active', is_active: true, updated_by: userId })
        .eq('id', input.vehicleId)
        .is('deleted_at', null)
    }
  }

  revalidatePath('/app/fleet/vehicle-card/' + input.vehicleId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DELETE REPLACEMENT RECORD
// ─────────────────────────────────────────────────────────────

export async function deleteVehicleReplacementRecord(
  recordId: string,
  vehicleId: string
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { error } = await supabase.rpc('soft_delete_vehicle_replacement_record', {
    p_id: recordId,
    p_user_id: userId,
  })

  if (error) return { success: false, error: 'שגיאה במחיקת רכב חלופי' }

  revalidatePath('/app/fleet/vehicle-card/' + vehicleId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// ADD FUEL CARD
// ─────────────────────────────────────────────────────────────

export async function addVehicleFuelCard(
  replacementRecordId: string,
  cardNumber: string
): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  if (!/^\d+$/.test(cardNumber.trim())) {
    return { success: false, error: 'מספר כרטיס חייב להכיל ספרות בלבד' }
  }

  const { data, error } = await supabase
    .from('vehicle_fuel_cards')
    .insert({
      replacement_record_id: replacementRecordId,
      card_number: cardNumber.trim(),
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת כרטיס דלק' }

  return { success: true, id: data.id }
}

// ─────────────────────────────────────────────────────────────
// DELETE FUEL CARD (hard delete -- decision [16-01])
// ─────────────────────────────────────────────────────────────

export async function deleteVehicleFuelCard(cardId: string): Promise<ActionResult> {
  await verifyAppUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('vehicle_fuel_cards')
    .delete()
    .eq('id', cardId)

  if (error) return { success: false, error: 'שגיאה במחיקת כרטיס דלק' }

  return { success: true }
}