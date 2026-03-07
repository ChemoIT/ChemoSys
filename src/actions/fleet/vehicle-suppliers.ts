'use server'

/**
 * vehicle-suppliers.ts — Server Actions for Vehicle Supplier CRUD.
 *
 * Pattern: verifySession -> validate -> mutate DB -> writeAuditLog -> revalidate
 *
 * Vehicle suppliers include: leasing companies, insurance providers,
 * fuel card vendors, garages, and other related vendors.
 *
 * Phone handling note: Suppliers can have landlines — relaxation of the
 * mobile-only IRON RULE. We attempt normalizePhone() first, but if it returns
 * null (non-mobile), we store the raw value with non-digit chars stripped.
 *
 * Soft-delete: MUST use RPC `soft_delete_vehicle_supplier` — never direct UPDATE.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { normalizePhone } from '@/lib/format'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VehicleSupplier = {
  id: string
  supplier_type: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  leasing:   'חברת ליסינג',
  insurance: 'חברת ביטוח',
  fuel_card: 'ספק כרטיס דלק',
  garage:    'מוסך',
  other:     'אחר',
}

const VALID_SUPPLIER_TYPES = Object.keys(SUPPLIER_TYPE_LABELS)

// ---------------------------------------------------------------------------
// Helper: normalize phone for suppliers (landlines allowed)
// Returns normalized mobile, or stripped digits for landlines, or null if empty
// ---------------------------------------------------------------------------
function normalizeSupplierPhone(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null
  // Try mobile normalization first
  const mobile = normalizePhone(raw)
  if (mobile) return mobile
  // Fallback: strip non-digit chars and store raw (for landlines, e.g. 03-XXXXXXX)
  const stripped = raw.replace(/[^\d\-+\s]/g, '').trim()
  return stripped || null
}

// ---------------------------------------------------------------------------
// getVehicleSuppliers
// ---------------------------------------------------------------------------

export async function getVehicleSuppliers(type?: string): Promise<VehicleSupplier[]> {
  await verifySession()
  const supabase = await createClient()

  let query = supabase
    .from('vehicle_suppliers')
    .select('id, supplier_type, name, contact_name, phone, email, address, notes, is_active, created_at')
    .is('deleted_at', null)
    .order('supplier_type', { ascending: true })
    .order('name', { ascending: true })

  if (type) {
    query = query.eq('supplier_type', type)
  }

  const { data, error } = await query

  if (error) {
    console.error('[vehicle-suppliers] getVehicleSuppliers error:', error.message)
    return []
  }

  return (data ?? []) as VehicleSupplier[]
}

// ---------------------------------------------------------------------------
// createVehicleSupplier
// ---------------------------------------------------------------------------

export async function createVehicleSupplier(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Extract fields
  const supplier_type = formData.get('supplier_type') as string
  const name = (formData.get('name') as string)?.trim()
  const contact_name = (formData.get('contact_name') as string)?.trim() || null
  const phone = formData.get('phone') as string
  const email = (formData.get('email') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  // Validate
  if (!name) {
    return { success: false, error: 'שם ספק הוא שדה חובה' }
  }
  if (!supplier_type || !VALID_SUPPLIER_TYPES.includes(supplier_type)) {
    return { success: false, error: 'סוג ספק לא תקין' }
  }

  const normalizedPhone = normalizeSupplierPhone(phone)

  // Insert
  const { data, error } = await supabase
    .from('vehicle_suppliers')
    .insert({
      supplier_type,
      name,
      contact_name,
      phone: normalizedPhone,
      email,
      address,
      notes,
      created_by: session.userId,
      updated_by: session.userId,
    })
    .select()
    .single()

  if (error) {
    console.error('[vehicle-suppliers] createVehicleSupplier error:', error.message)
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'vehicle_suppliers',
    entityId: data.id,
    oldData: null,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/vehicle-suppliers')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateVehicleSupplier
// ---------------------------------------------------------------------------

export async function updateVehicleSupplier(
  id: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Extract fields
  const supplier_type = formData.get('supplier_type') as string
  const name = (formData.get('name') as string)?.trim()
  const contact_name = (formData.get('contact_name') as string)?.trim() || null
  const phone = formData.get('phone') as string
  const email = (formData.get('email') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  // Validate
  if (!name) {
    return { success: false, error: 'שם ספק הוא שדה חובה' }
  }
  if (!supplier_type || !VALID_SUPPLIER_TYPES.includes(supplier_type)) {
    return { success: false, error: 'סוג ספק לא תקין' }
  }

  const normalizedPhone = normalizeSupplierPhone(phone)

  // Fetch old data for audit log
  const { data: oldData } = await supabase
    .from('vehicle_suppliers')
    .select('*')
    .eq('id', id)
    .single()

  // Update
  const { data, error } = await supabase
    .from('vehicle_suppliers')
    .update({
      supplier_type,
      name,
      contact_name,
      phone: normalizedPhone,
      email,
      address,
      notes,
      updated_by: session.userId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[vehicle-suppliers] updateVehicleSupplier error:', error.message)
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'vehicle_suppliers',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/vehicle-suppliers')
  return { success: true }
}

// ---------------------------------------------------------------------------
// toggleSupplierActive
// ---------------------------------------------------------------------------

export async function toggleSupplierActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  const { error } = await supabase
    .from('vehicle_suppliers')
    .update({
      is_active: isActive,
      updated_by: session.userId,
    })
    .eq('id', id)

  if (error) {
    console.error('[vehicle-suppliers] toggleSupplierActive error:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/vehicle-suppliers')
  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteVehicleSupplier — MUST use RPC (project pattern)
// ---------------------------------------------------------------------------

export async function deleteVehicleSupplier(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Fetch old data for audit log before soft-delete
  const { data: oldData } = await supabase
    .from('vehicle_suppliers')
    .select('*')
    .eq('id', id)
    .single()

  // IRON RULE: soft-delete via RPC only — never direct UPDATE on deleted_at
  const { error } = await supabase.rpc('soft_delete_vehicle_supplier', {
    p_id: id,
    p_user_id: session.userId,
  })

  if (error) {
    console.error('[vehicle-suppliers] deleteVehicleSupplier error:', error.message)
    return { success: false, error: error.message }
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'DELETE',
    entityType: 'vehicle_suppliers',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: null,
  })

  revalidatePath('/admin/vehicle-suppliers')
  return { success: true }
}
