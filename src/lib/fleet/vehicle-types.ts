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
  private:          'פרטי',
  minibus:          'מיניבוס',
  light_commercial: 'מסחרי קל',
  heavy:            'כבד',
  forklift:         'מלגזה',
  equipment:        'ציוד',
  other:            'אחר',
}

export const OWNERSHIP_TYPE_LABELS: Record<string, string> = {
  company_owned:  'בבעלות חברה',
  leased:         'ליסינג',
  rented:         'שכור',
  employee_owned: 'בבעלות עובד',
}

export const INSURANCE_TYPE_LABELS: Record<string, string> = {
  mandatory:    'חובה',
  comprehensive: 'מקיף',
  third_party:  'צד ג׳',
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

  // Supplier FK fields (null = not linked)
  leasingCompanyId: string | null
  leasingCompanyName: string | null
  insuranceCompanyId: string | null
  insuranceCompanyName: string | null
  fuelCardSupplierId: string | null
  fuelCardSupplierName: string | null
  garageId: string | null
  garageName: string | null
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
