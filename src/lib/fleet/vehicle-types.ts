/**
 * vehicle-types.ts — Shared types and constants for the vehicle fleet module.
 *
 * Kept in a separate non-'use server' file so it can be imported in both
 * server actions ('use server') and client components ('use client').
 *
 * 'use server' files can ONLY export async functions — objects/constants
 * and type definitions must live outside the server action file.
 */

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  private:    'פרטי',
  commercial: 'מסחרי',
  truck:      'משאית',
  trailer:    'נגרר',
}

export const OWNERSHIP_TYPE_LABELS: Record<string, string> = {
  company:             'בבעלות חברה',
  rental:              'שכירות',
  operational_leasing: 'ליסינג תפעולי',
  mini_leasing:        'מיני ליסינג',
}

export const INSURANCE_TYPE_LABELS: Record<string, string> = {
  mandatory:    'חובה',
  comprehensive: 'מקיף',
  third_party:  'צד גי׳',
}

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  active:         'פעיל',
  suspended:      'מושבת זמני',
  returned:       'הוחזר',
  sold:           'נמכר',
  decommissioned: 'מושבת',
}

export const REPLACEMENT_REASON_LABELS: Record<string, string> = {
  maintenance: 'טיפול',
  test:        'טסט',
  accident:    'תאונה',
  other:       'אחר',
}

// ─────────────────────────────────────────────────────────────
// VEHICLE LIST TYPE
// Used by VehicleList page to render the vehicles table.
// ─────────────────────────────────────────────────────────────

export type VehicleListItem = {
  id: string
  licensePlate: string
  /** Manufacturer name (Hebrew) from MOT API */
  tozeret: string | null
  /** Model name from MOT API */
  degem: string | null
  /** Year of manufacture from MOT API */
  shnatYitzur: number | null
  companyName: string | null
  computedStatus: 'active' | 'inactive'
  assignedDriverName: string | null
  /** Nearest upcoming vehicle test expiry date */
  testExpiryDate: string | null
  /** Nearest upcoming insurance expiry across all policies */
  insuranceMinExpiry: string | null
  /** Nearest upcoming document expiry */
  documentMinExpiry: string | null
}

// ─────────────────────────────────────────────────────────────
// VEHICLE FULL TYPE
// Used by VehicleCard page — all fields including MOT data.
// ─────────────────────────────────────────────────────────────

export type VehicleFull = {
  id: string

  // MOT API identity fields (populated by mot-sync.ts — may be null until synced)
  licensePlate: string
  tozoretNm: string | null        // manufacturer name (Hebrew)
  degemNm: string | null          // model name
  kinuyMishari: string | null     // commercial nickname
  shnatYitzur: number | null      // year of manufacture
  tzevaRechev: string | null      // vehicle color
  sugDelekNm: string | null       // fuel type name
  misgeret: string | null         // chassis / frame number
  degemManoa: string | null       // engine model
  ramatGimur: string | null       // trim level
  kvutzatZihum: string | null     // pollution group
  baalut: string | null           // ownership per MOT (e.g. company name from registry)
  moedAliyaLakvish: string | null // date first registered on road (yyyy-mm-dd)
  motLastSyncAt: string | null    // when MOT data was last fetched

  // Operational / classification fields
  vehicleType: string | null       // one of VEHICLE_TYPE_LABELS keys
  ownershipType: string | null     // one of OWNERSHIP_TYPE_LABELS keys
  companyId: string | null
  companyName: string | null
  isActive: boolean
  assignedDriverId: string | null
  assignedDriverName: string | null
  notes: string | null
  computedStatus: 'active' | 'inactive'

  // Assignment / category fields (migration 00027)
  vehicleCategory: 'camp' | 'assigned' | null
  campResponsibleType: 'project_manager' | 'other' | null
  campResponsibleName: string | null
  campResponsiblePhone: string | null

  // Vehicle status + fleet entry/exit (migrations 00027 + 00030)
  vehicleStatus: string        // 'active'|'suspended'|'returned'|'sold'|'decommissioned'
  fleetEntryDate: string | null // yyyy-mm-dd
  fleetEntryKm: number | null
  fleetExitDate: string | null  // yyyy-mm-dd
  fleetExitKm: number | null

  // Supplier FK fields (null = not linked)
  leasingCompanyId: string | null
  leasingCompanyName: string | null
  insuranceCompanyId: string | null
  insuranceCompanyName: string | null
  fuelCardSupplierId: string | null
  fuelCardSupplierName: string | null
  garageId: string | null
  garageName: string | null

  // Phase 18 — ownership tab fields (from migrations 00027 + 00029)
  ownershipSupplierId: string | null    // FK → vehicle_suppliers WHERE type='ownership'
  ownershipSupplierName: string | null  // joined from vehicle_suppliers
  contractNumber: string | null         // contract reference number
  contractFileUrl: string | null        // signed URL for contract PDF (migration 00029)
  vehicleGroup: number | null           // 1-7
}

// ─────────────────────────────────────────────────────────────
// VEHICLE TEST TYPE
// One record per test event (history accumulates — INSERT only, no upsert).
// ─────────────────────────────────────────────────────────────

export type VehicleTest = {
  id: string
  vehicleId: string
  testDate: string             // yyyy-mm-dd
  expiryDate: string           // yyyy-mm-dd
  passed: boolean
  testStation: string | null
  cost: number | null
  notes: string | null
  fileUrl: string | null
  alertEnabled: boolean
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// VEHICLE INSURANCE TYPE
// Multiple concurrent policies possible per vehicle (mandatory + comprehensive etc.)
// ─────────────────────────────────────────────────────────────

export type VehicleInsurance = {
  id: string
  vehicleId: string
  /** 'mandatory' | 'comprehensive' | 'third_party' */
  insuranceType: string
  policyNumber: string | null
  supplierId: string | null
  supplierName: string | null  // joined from vehicle_suppliers
  startDate: string | null     // yyyy-mm-dd
  expiryDate: string           // yyyy-mm-dd (NOT NULL in DB)
  cost: number | null
  notes: string | null
  fileUrl: string | null
  alertEnabled: boolean
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// VEHICLE DOCUMENT TYPE
// Arbitrary documents attached to a vehicle (permits, ownership docs, etc.)
// ─────────────────────────────────────────────────────────────

export type VehicleDocument = {
  id: string
  vehicleId: string
  documentName: string
  fileUrl: string | null
  expiryDate: string | null    // yyyy-mm-dd
  alertEnabled: boolean
  notes: string | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// VEHICLE MONTHLY COST TYPE
// Activity journal — one active record at a time (end_date IS NULL = current rate).
// No soft-delete. No delete at all — financial audit trail is immutable.
// ─────────────────────────────────────────────────────────────

export type VehicleMonthlyCost = {
  id: string
  vehicleId: string
  startDate: string      // yyyy-mm-dd — period start
  endDate: string | null // yyyy-mm-dd — period end (null = currently active)
  amount: number         // monthly cost in ILS
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// VEHICLE IMAGE TYPE
// Up to 5 images per vehicle, stored in Supabase storage bucket 'vehicle-images'.
// ─────────────────────────────────────────────────────────────

export type VehicleImage = {
  id: string
  vehicleId: string
  storagePath: string
  position: number           // 1-5
  signedUrl: string | null
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// VEHICLE FUEL CARD TYPE
// Fuel cards linked to a replacement record.
// ─────────────────────────────────────────────────────────────

export type VehicleFuelCard = {
  id: string
  replacementRecordId: string
  cardNumber: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// VEHICLE REPLACEMENT RECORD TYPE
// Tracks replacement vehicles issued while primary vehicle is out of service.
// ─────────────────────────────────────────────────────────────

export type VehicleReplacementRecord = {
  id: string
  vehicleId: string
  licensePlate: string
  motData: Record<string, unknown> | null
  entryDate: string
  entryKm: number | null
  returnDate: string | null
  returnKm: number | null
  reason: 'maintenance' | 'test' | 'accident' | 'other'
  reasonOther: string | null
  status: 'active' | 'returned'
  notes: string | null
  fuelCards: VehicleFuelCard[]
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// VEHICLE DRIVER JOURNAL TYPE
// Activity journal for driver assignments — one active record at a time
// (end_date IS NULL = currently active). Historical facts, never deleted.
// ─────────────────────────────────────────────────────────────

export type VehicleDriverJournal = {
  id: string
  vehicleId: string
  driverId: string
  driverName: string | null  // joined from drivers → employees
  startDate: string          // yyyy-mm-dd
  endDate: string | null     // null = currently active
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// VEHICLE PROJECT JOURNAL TYPE
// Activity journal for project assignments — one active record at a time
// (end_date IS NULL = currently active). Historical facts, never deleted.
// ─────────────────────────────────────────────────────────────

export type VehicleProjectJournal = {
  id: string
  vehicleId: string
  projectId: string
  projectName: string        // joined from projects
  projectNumber: string      // joined from projects
  startDate: string          // yyyy-mm-dd
  endDate: string | null     // null = currently active
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// DRIVER OPTION FOR ASSIGNMENT
// Used by VehicleCard driver assignment dropdown.
// ─────────────────────────────────────────────────────────────

export type DriverOptionForAssignment = {
  id: string        // drivers.id (not employees.id)
  fullName: string
}