/**
 * supplier-types.ts — Shared constants for vehicle supplier types.
 *
 * Kept in a separate non-'use server' file so it can be imported in both
 * server actions ('use server') and client components ('use client').
 *
 * 'use server' files can ONLY export async functions — objects/constants
 * must live outside the server action file.
 */

export const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  ownership: 'בעלות רכב',
  insurance: 'חברת ביטוח',
  fuel_card: 'ספק כרטיס דלק',
  garage:    'מוסך',
  other:     'אחר',
}

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
