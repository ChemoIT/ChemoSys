// fleet-constants.ts — Shared constants for the fleet module.
// These constants are used by both Server Actions and client components.
// MUST NOT be in a 'use server' file — 'use server' files can only export async functions.

export const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  leasing:   'חברת ליסינג',
  insurance: 'חברת ביטוח',
  fuel_card: 'ספק כרטיס דלק',
  garage:    'מוסך',
  other:     'אחר',
}
