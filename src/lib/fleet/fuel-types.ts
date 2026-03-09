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
// CARLOG MAPPING CONSTANTS
// ─────────────────────────────────────────────────────────────

/** CarLog column [1] (field 2) → fuel_supplier */
export const CARLOG_SUPPLIER_MAP: Record<string, string> = {
  '': 'delek',
  '1': 'tapuz',
  '2': 'dalkal',
}

/** CarLog column [6] → fuel_type (supports both numeric codes and Hebrew text) */
export const CARLOG_FUEL_TYPE_MAP: Record<string, string> = {
  '095':       'benzine',
  'בנזין 95':  'benzine',
  'בנזין':     'benzine',
  '050':       'diesel',
  '053':       'diesel',
  '53':        'diesel',
  'סולר':      'diesel',
  '037':       'urea',
  'אוריאה':    'urea',
}

/** CarLog column [5] → fueling_method */
export const CARLOG_DEVICE_CODE_MAP: Record<string, string> = {
  '1': 'device',  // דלקן — onboard device
  '2': 'card',    // כרטיס — card master
  '3': 'card',    // כרטיס — card cash
}

/** CarLog column [19] (field 20) → km report source */
export const CARLOG_SOURCE_MAP: Record<string, string> = {
  '1': 'fuel_device',  // קריאה אוטומטית מדלקן
  '2': 'sms',          // דיווח SMS מהנהג
  '3': 'manual',       // עדכון ידני במערכת
  '4': 'fuel_device',  // קריאה אוטומטית מדלקן (API)
  '5': 'whatsapp_ai',  // דיווח דרך סוכן AI בוואטסאפ
}

export const KM_SOURCE_LABELS: Record<string, string> = {
  fuel_device:  'דלקן (אוטומטי)',
  sms:          'SMS נהג',
  manual:       'עדכון ידני',
  whatsapp_ai:  'WhatsApp AI',
}

// ─────────────────────────────────────────────────────────────
// FUEL RECORD TYPE — single fueling transaction
// ─────────────────────────────────────────────────────────────

export type FuelRecord = {
  id: string
  vehicleId: string | null
  licensePlate: string
  fuelingDate: string          // yyyy-mm-dd
  fuelingTime: string | null   // HH:MM:SS
  fuelSupplier: string         // key from FUEL_SUPPLIER_LABELS
  fuelType: string             // key from FUEL_TYPE_LABELS
  fuelingMethod: string | null // key from FUELING_METHOD_LABELS
  fuelCardNumber: string | null
  quantityLiters: number
  stationName: string | null
  grossAmount: number | null
  netAmount: number | null
  actualFuelCompany: string | null
  odometerKm: number | null
  matchStatus: string          // 'matched' | 'unmatched'
  importBatchId: string | null
  createdAt: string
  driverName: string | null    // enriched from vehicle_driver_journal + drivers
  projectName: string | null   // enriched from vehicle_project_journal + projects
}

// ─────────────────────────────────────────────────────────────
// FUEL FILTERS — query parameters for the fuel records page
// ─────────────────────────────────────────────────────────────

export type FuelSortField =
  | 'fueling_date'
  | 'fueling_time'
  | 'license_plate'
  | 'fuel_supplier'
  | 'fuel_type'
  | 'fueling_method'
  | 'quantity_liters'
  | 'station_name'
  | 'net_amount'
  | 'odometer_km'

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
  sortBy: FuelSortField         // default: 'fueling_date'
  sortDir: 'asc' | 'desc'      // default: 'desc'
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
// FUEL IMPORT BATCH — tracks each CarLog.top file import
// ─────────────────────────────────────────────────────────────

export type FuelImportBatch = {
  id: string
  sourceFile: string
  sourceYear: number
  totalLines: number | null
  fuelCount: number | null
  kmCount: number | null
  matchedCount: number | null
  unmatchedCount: number | null
  skippedCount: number | null
  duplicateCount: number | null
  status: string | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// CARLOG IMPORT TYPES
// ─────────────────────────────────────────────────────────────

export type CarLogDryRunReport = {
  fileName: string
  totalLines: number
  fuelRecords: number
  kmRecords: number
  skippedLines: number
  matchedPlates: number
  unmatchedPlates: number
  unmatchedDetails: { licensePlate: string; count: number }[]
  dateRange: { from: string; to: string } | null
  supplierBreakdown: { supplier: string; count: number }[]
  fuelTypeBreakdown: { fuelType: string; count: number }[]
  parseErrors: string[]
}

export type CarLogImportResult = {
  success: boolean
  fuelInserted: number
  kmInserted: number
  duplicatesSkipped: number
  matchedCount: number
  unmatchedCount: number
  errors: string[]
  batchId: string | null
}

// ─────────────────────────────────────────────────────────────
// PROJECT OPTION — for fuel filter dropdown
// ─────────────────────────────────────────────────────────────

export type ProjectOptionForFilter = {
  id: string
  name: string
}
