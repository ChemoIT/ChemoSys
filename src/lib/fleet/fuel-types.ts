/**
 * fuel-types.ts — Shared types and constants for fuel records & km tracking.
 *
 * No 'use server' — importable from both server actions and client components.
 */

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

export const FUEL_SUPPLIER_LABELS: Record<string, string> = {
  delek:  'דלק',
  tapuz:  'תפוז',
  dalkal: 'דלקל',
}

export const FUEL_TYPE_LABELS: Record<string, string> = {
  benzine: 'בנזין',
  diesel:  'סולר',
  urea:    'אוריאה',
}

export const FUELING_METHOD_LABELS: Record<string, string> = {
  device: 'דלקן',
  card:   'כרטיס',
}

export const FUEL_RECORDS_PER_PAGE = 50

// Hebrew month names for dropdowns
export const HEBREW_MONTHS: Record<number, string> = {
  1:  'ינואר',
  2:  'פברואר',
  3:  'מרץ',
  4:  'אפריל',
  5:  'מאי',
  6:  'יוני',
  7:  'יולי',
  8:  'אוגוסט',
  9:  'ספטמבר',
  10: 'אוקטובר',
  11: 'נובמבר',
  12: 'דצמבר',
}

// ─────────────────────────────────────────────────────────────
// FUEL RECORD TYPE — single fueling transaction
// ─────────────────────────────────────────────────────────────

export type FuelRecord = {
  id: string
  vehicleId: string
  licensePlate: string
  fuelingDate: string          // yyyy-mm-dd
  fuelingTime: string | null   // HH:MM:SS
  fuelSupplier: string         // key from FUEL_SUPPLIER_LABELS
  fuelType: string             // key from FUEL_TYPE_LABELS
  fuelingMethod: string | null // key from FUELING_METHOD_LABELS
  quantityLiters: number
  stationName: string | null
  grossAmount: number | null
  netAmount: number | null
  odometerKm: number | null
  importMonth: number
  importYear: number
  importBatchId: string | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// FUEL FILTERS — query parameters for the fuel records page
// ─────────────────────────────────────────────────────────────

export type FuelFilters = {
  fromMonth: number     // 1-12
  fromYear: number
  toMonth: number       // 1-12
  toYear: number
  supplier: string | null       // null = all
  fuelType: string | null       // null = all
  licensePlateSearch: string | null
  projectId: string | null      // null = all
  vehicleType: string | null    // null = all
  page: number                  // 1-based
}

// ─────────────────────────────────────────────────────────────
// FUEL STATS — aggregate summary for current filters
// ─────────────────────────────────────────────────────────────

export type FuelStats = {
  totalRecords: number
  totalLiters: number
  totalGrossAmount: number
  totalNetAmount: number
}

// ─────────────────────────────────────────────────────────────
// FUEL IMPORT BATCH — tracks each Excel import operation
// ─────────────────────────────────────────────────────────────

export type FuelImportBatch = {
  id: string
  importMonth: number
  importYear: number
  fuelSupplier: string
  recordCount: number | null
  matchedCount: number | null
  unmatchedCount: number | null
  status: string | null
  fileName: string | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// PROJECT OPTION — for fuel filter dropdown
// ─────────────────────────────────────────────────────────────

export type ProjectOptionForFilter = {
  id: string
  name: string
}
