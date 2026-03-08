'use server'

/**
 * fleet/vehicles.ts — Server Actions for Fleet Vehicle Card module.
 *
 * Guard: ALL actions start with verifyAppUser() — ChemoSys employee-facing app.
 * Pattern: verifyAppUser -> validate -> mutate DB -> revalidate
 *
 * Key behaviours:
 *   - Vehicle card is created with license_plate + company_id (MOT sync fills the rest).
 *   - Partial unique index on vehicles.license_plate (WHERE deleted_at IS NULL) —
 *     allows soft-delete + plate reuse.
 *   - vehicle_tests = INSERT always (not upsert) — test history accumulates over time.
 *   - vehicle_insurance.supplier_id = FK to vehicle_suppliers — always joined on read.
 *   - Soft-delete on all vehicle entities MUST use RPCs (never direct .update).
 *   - MOT fields are READ-ONLY in this file — mot-sync.ts writes them exclusively.
 *   - Storage bucket for vehicle files = 'fleet-vehicle-documents' (private).
 *   - Fitness status (light) is computed client-side from expiry dates + threshold env vars.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifyAppUser } from '@/lib/dal'
import { normalizePhone } from '@/lib/format'
import type {
  VehicleListItem,
  VehicleFull,
  VehicleTest,
  VehicleInsurance,
  VehicleDocument,
  DriverOptionForAssignment,
  VehicleDriverJournal,
  VehicleProjectJournal,
  VehicleImage,
} from '@/lib/fleet/vehicle-types'

// ─────────────────────────────────────────────────────────────
// Shared result type
// ─────────────────────────────────────────────────────────────

export type ActionResult = {
  success: boolean
  error?: string
}

// ─────────────────────────────────────────────────────────────
// VEHICLE LIST
// ─────────────────────────────────────────────────────────────

/**
 * Returns all vehicle cards with computed status and nearest expiry dates.
 * Used by the vehicles list page.
 */
export async function getVehiclesList(): Promise<VehicleListItem[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      id,
      license_plate,
      tozeret_nm,
      degem_nm,
      shnat_yitzur,
      is_active,
      vehicle_type,
      vehicle_status,
      vehicle_category,
      companies ( name ),
      drivers (
        employees ( first_name, last_name )
      ),
      vehicle_tests ( expiry_date ),
      vehicle_insurance ( expiry_date ),
      vehicle_documents ( expiry_date ),
      vehicle_project_journal ( project_id, end_date, projects ( name ) )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const company = (row.companies as unknown) as { name: string } | null
    const driver = (row.drivers as unknown) as {
      employees: { first_name: string; last_name: string } | null
    } | null
    const driverEmployee = driver?.employees ?? null

    const tests = (row.vehicle_tests ?? []) as { expiry_date: string | null }[]
    const insurance = (row.vehicle_insurance ?? []) as { expiry_date: string | null }[]
    const docs = (row.vehicle_documents ?? []) as { expiry_date: string | null }[]

    const testExpiries = tests.map((t) => t.expiry_date).filter(Boolean) as string[]
    const insuranceExpiries = insurance.map((i) => i.expiry_date).filter(Boolean) as string[]
    const docExpiries = docs.map((d) => d.expiry_date).filter(Boolean) as string[]

    const computedStatus: 'active' | 'inactive' = row.is_active ? 'active' : 'inactive'

    // Find active project (end_date IS NULL)
    const journalEntries = (row.vehicle_project_journal ?? []) as unknown as {
      project_id: string; end_date: string | null
      projects: { name: string } | null
    }[]
    const activeProject = journalEntries.find((j) => j.end_date === null)

    return {
      id: row.id,
      licensePlate: row.license_plate,
      tozeret: row.tozeret_nm,
      degem: row.degem_nm,
      shnatYitzur: row.shnat_yitzur,
      vehicleType: row.vehicle_type ?? null,
      vehicleStatus: row.vehicle_status ?? 'active',
      vehicleCategory: (row.vehicle_category as 'camp' | 'assigned' | null) ?? null,
      companyName: company?.name ?? null,
      computedStatus,
      assignedDriverName: driverEmployee
        ? `${driverEmployee.first_name} ${driverEmployee.last_name}`
        : null,
      activeProjectName: activeProject?.projects?.name ?? null,
      testExpiryDate: testExpiries.sort()[0] ?? null,
      insuranceMinExpiry: insuranceExpiries.sort()[0] ?? null,
      documentMinExpiry: docExpiries.sort()[0] ?? null,
    }
  })
}

// ─────────────────────────────────────────────────────────────
// VEHICLE FULL (card)
// ─────────────────────────────────────────────────────────────

/** Returns full vehicle data including MOT fields + joined relations. */
export async function getVehicleById(vehicleId: string): Promise<VehicleFull | null> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      id,
      license_plate,
      tozeret_nm,
      degem_nm,
      kinuy_mishari,
      shnat_yitzur,
      tzeva_rechev,
      sug_delek_nm,
      misgeret,
      degem_manoa,
      ramat_gimur,
      kvutzat_zihum,
      baalut,
      moed_aliya_lakvish,
      mot_last_sync_at,
      vehicle_status,
      fleet_entry_date,
      fleet_entry_km,
      fleet_exit_date,
      fleet_exit_km,
      vehicle_type,
      vehicle_type_note,
      ownership_type,
      company_id,
      is_active,
      assigned_driver_id,
      notes,
      vehicle_category,
      camp_responsible_type,
      camp_responsible_name,
      camp_responsible_phone,
      companies ( name ),
      drivers (
        employees ( first_name, last_name )
      ),
      leasing:vehicle_suppliers!leasing_company_id ( name ),
      insurance_co:vehicle_suppliers!insurance_company_id ( name ),
      fuel_card:vehicle_suppliers!fuel_card_supplier_id ( name ),
      garage:vehicle_suppliers!garage_id ( name ),
      ownership_co:vehicle_suppliers!ownership_supplier_id ( name ),
      leasing_company_id,
      insurance_company_id,
      fuel_card_supplier_id,
      garage_id,
      ownership_supplier_id,
      contract_number,
      contract_file_url,
      vehicle_group,
      toll_road_permits,
      weekend_holiday_permit,
      pascal_number,
      service_interval_km,
      service_interval_alert,
      annual_km_limit,
      annual_km_limit_alert,
      monthly_fuel_limit_liters,
      monthly_fuel_limit_alert
    `)
    .eq('id', vehicleId)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null

  const company = (data.companies as unknown) as { name: string } | null
  const driver = (data.drivers as unknown) as {
    employees: { first_name: string; last_name: string } | null
  } | null
  const driverEmployee = driver?.employees ?? null

  const leasing = (data.leasing as unknown) as { name: string } | null
  const insuranceCo = (data.insurance_co as unknown) as { name: string } | null
  const fuelCard = (data.fuel_card as unknown) as { name: string } | null
  const garage = (data.garage as unknown) as { name: string } | null
  const ownershipCo = (data.ownership_co as unknown) as { name: string } | null

  const computedStatus: 'active' | 'inactive' = data.is_active ? 'active' : 'inactive'

  return {
    id: data.id,
    licensePlate: data.license_plate,
    tozoretNm: data.tozeret_nm,
    degemNm: data.degem_nm,
    kinuyMishari: data.kinuy_mishari,
    shnatYitzur: data.shnat_yitzur,
    tzevaRechev: data.tzeva_rechev,
    sugDelekNm: data.sug_delek_nm,
    misgeret: data.misgeret,
    degemManoa: data.degem_manoa,
    ramatGimur: data.ramat_gimur,
    kvutzatZihum: data.kvutzat_zihum,
    baalut: data.baalut,
    moedAliyaLakvish: data.moed_aliya_lakvish,
    motLastSyncAt: data.mot_last_sync_at,
    vehicleStatus: data.vehicle_status ?? 'active',
    fleetEntryDate: data.fleet_entry_date ?? null,
    fleetEntryKm: data.fleet_entry_km ?? null,
    fleetExitDate: data.fleet_exit_date ?? null,
    fleetExitKm: data.fleet_exit_km ?? null,
    vehicleType: data.vehicle_type,
    vehicleTypeNote: data.vehicle_type_note ?? null,
    ownershipType: data.ownership_type,
    companyId: data.company_id,
    companyName: company?.name ?? null,
    isActive: data.is_active,
    assignedDriverId: data.assigned_driver_id,
    assignedDriverName: driverEmployee
      ? `${driverEmployee.first_name} ${driverEmployee.last_name}`
      : null,
    notes: data.notes,
    computedStatus,
    vehicleCategory: data.vehicle_category ?? null,
    campResponsibleType: data.camp_responsible_type ?? null,
    campResponsibleName: data.camp_responsible_name ?? null,
    campResponsiblePhone: data.camp_responsible_phone ?? null,
    leasingCompanyId: data.leasing_company_id,
    leasingCompanyName: leasing?.name ?? null,
    insuranceCompanyId: data.insurance_company_id,
    insuranceCompanyName: insuranceCo?.name ?? null,
    fuelCardSupplierId: data.fuel_card_supplier_id,
    fuelCardSupplierName: fuelCard?.name ?? null,
    garageId: data.garage_id,
    garageName: garage?.name ?? null,
    ownershipSupplierId: data.ownership_supplier_id,
    ownershipSupplierName: ownershipCo?.name ?? null,
    contractNumber: data.contract_number,
    contractFileUrl: data.contract_file_url,
    vehicleGroup: data.vehicle_group,
    tollRoadPermits: data.toll_road_permits ?? [],
    weekendHolidayPermit: data.weekend_holiday_permit ?? false,
    pascalNumber: data.pascal_number ?? null,
    serviceIntervalKm: data.service_interval_km ?? null,
    serviceIntervalAlert: data.service_interval_alert ?? false,
    annualKmLimit: data.annual_km_limit ?? null,
    annualKmLimitAlert: data.annual_km_limit_alert ?? false,
    monthlyFuelLimitLiters: data.monthly_fuel_limit_liters ?? null,
    monthlyFuelLimitAlert: data.monthly_fuel_limit_alert ?? false,
  }
}

// ─────────────────────────────────────────────────────────────
// CREATE VEHICLE
// ─────────────────────────────────────────────────────────────

export async function createVehicle(
  licensePlate: string,
  companyId?: string | null,
): Promise<ActionResult & { vehicleId?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const plate = licensePlate.trim().toUpperCase().replace(/\s+/g, '-')

  if (!plate) return { success: false, error: 'מספר רישוי נדרש' }

  // Guard: no existing active vehicle with this plate
  const { data: existing } = await supabase
    .from('vehicles')
    .select('id')
    .eq('license_plate', plate)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'רכב עם מספר רישוי זה כבר קיים במערכת' }
  }

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .insert({
      license_plate: plate,
      ...(companyId ? { company_id: companyId } : {}),
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה ביצירת כרטיס רכב' }

  revalidatePath('/app/fleet/vehicle-card')
  return { success: true, vehicleId: vehicle.id }
}

// ─────────────────────────────────────────────────────────────
// UPDATE VEHICLE DETAILS
// ─────────────────────────────────────────────────────────────

export type UpdateVehicleInput = {
  vehicleId: string
  vehicleType?: string | null
  vehicleTypeNote?: string | null
  ownershipType?: string | null
  companyId?: string | null
  vehicleStatus?: string       // 'active'|'suspended'|'returned'|'sold'|'decommissioned'
  fleetEntryDate?: string | null
  fleetEntryKm?: number | null
  fleetExitDate?: string | null
  fleetExitKm?: number | null
  assignedDriverId?: string | null
  notes?: string | null
  leasingCompanyId?: string | null
  insuranceCompanyId?: string | null
  fuelCardSupplierId?: string | null
  garageId?: string | null
  vehicleCategory?: 'camp' | 'assigned' | null
  campResponsibleType?: 'project_manager' | 'other' | null
  campResponsibleName?: string | null
  campResponsiblePhone?: string | null
  ownershipSupplierId?: string | null
  contractNumber?: string | null
  contractFileUrl?: string | null
  vehicleGroup?: number | null
  // Permits & limits (migration 00031)
  tollRoadPermits?: string[]
  weekendHolidayPermit?: boolean
  pascalNumber?: string | null
  serviceIntervalKm?: number | null
  serviceIntervalAlert?: boolean
  annualKmLimit?: number | null
  annualKmLimitAlert?: boolean
  monthlyFuelLimitLiters?: number | null
  monthlyFuelLimitAlert?: boolean
}

/**
 * Updates operational fields only.
 * NEVER updates MOT fields — those are managed exclusively by mot-sync.ts.
 */
export async function updateVehicleDetails(input: UpdateVehicleInput): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Build update object — only include fields that were explicitly passed
  // to avoid overwriting values from other tabs (e.g. status from details tab)
  const updateObj: Record<string, unknown> = { updated_by: userId }

  if (input.vehicleType !== undefined) {
    updateObj.vehicle_type = input.vehicleType
    // Clear note when type is not 'other'
    if (input.vehicleType !== 'other') updateObj.vehicle_type_note = null
  }
  if (input.vehicleTypeNote !== undefined) updateObj.vehicle_type_note = input.vehicleTypeNote || null
  if (input.ownershipType !== undefined) updateObj.ownership_type = input.ownershipType
  if (input.companyId !== undefined) updateObj.company_id = input.companyId
  if (input.vehicleStatus !== undefined) {
    updateObj.vehicle_status = input.vehicleStatus
    updateObj.is_active = input.vehicleStatus === 'active'
  }
  if (input.fleetEntryDate !== undefined) updateObj.fleet_entry_date = input.fleetEntryDate
  if (input.fleetEntryKm !== undefined) updateObj.fleet_entry_km = input.fleetEntryKm
  if (input.fleetExitDate !== undefined) updateObj.fleet_exit_date = input.fleetExitDate
  if (input.fleetExitKm !== undefined) updateObj.fleet_exit_km = input.fleetExitKm
  if (input.assignedDriverId !== undefined) updateObj.assigned_driver_id = input.assignedDriverId
  if (input.notes !== undefined) updateObj.notes = input.notes || null
  if (input.leasingCompanyId !== undefined) updateObj.leasing_company_id = input.leasingCompanyId
  if (input.insuranceCompanyId !== undefined) updateObj.insurance_company_id = input.insuranceCompanyId
  if (input.fuelCardSupplierId !== undefined) updateObj.fuel_card_supplier_id = input.fuelCardSupplierId
  if (input.garageId !== undefined) updateObj.garage_id = input.garageId
  if (input.vehicleCategory !== undefined) updateObj.vehicle_category = input.vehicleCategory
  if (input.campResponsibleType !== undefined) updateObj.camp_responsible_type = input.campResponsibleType
  if (input.campResponsibleName !== undefined) updateObj.camp_responsible_name = input.campResponsibleName
  if (input.campResponsiblePhone !== undefined) {
    updateObj.camp_responsible_phone = input.campResponsiblePhone != null
      ? normalizePhone(input.campResponsiblePhone) ?? null
      : null
  }
  if (input.ownershipSupplierId !== undefined) updateObj.ownership_supplier_id = input.ownershipSupplierId
  if (input.contractNumber !== undefined) updateObj.contract_number = input.contractNumber
  if (input.contractFileUrl !== undefined) updateObj.contract_file_url = input.contractFileUrl
  if (input.vehicleGroup !== undefined) updateObj.vehicle_group = input.vehicleGroup
  // Permits & limits (migration 00031)
  if (input.tollRoadPermits !== undefined) updateObj.toll_road_permits = input.tollRoadPermits
  if (input.weekendHolidayPermit !== undefined) updateObj.weekend_holiday_permit = input.weekendHolidayPermit
  if (input.pascalNumber !== undefined) updateObj.pascal_number = input.pascalNumber || null
  if (input.serviceIntervalKm !== undefined) updateObj.service_interval_km = input.serviceIntervalKm
  if (input.serviceIntervalAlert !== undefined) updateObj.service_interval_alert = input.serviceIntervalAlert
  if (input.annualKmLimit !== undefined) updateObj.annual_km_limit = input.annualKmLimit
  if (input.annualKmLimitAlert !== undefined) updateObj.annual_km_limit_alert = input.annualKmLimitAlert
  if (input.monthlyFuelLimitLiters !== undefined) updateObj.monthly_fuel_limit_liters = input.monthlyFuelLimitLiters
  if (input.monthlyFuelLimitAlert !== undefined) updateObj.monthly_fuel_limit_alert = input.monthlyFuelLimitAlert

  const { error } = await supabase
    .from('vehicles')
    .update(updateObj)
    .eq('id', input.vehicleId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'שגיאה בשמירת פרטי הרכב' }

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  revalidatePath('/app/fleet/vehicle-card')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// SOFT DELETE VEHICLE
// ─────────────────────────────────────────────────────────────

export async function softDeleteVehicle(vehicleId: string): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Must use RPC — direct .update({ deleted_at }) fails due to PostgREST + RLS interaction
  const { error } = await supabase.rpc('soft_delete_vehicle', {
    p_id: vehicleId,
    p_user_id: userId,
  })

  if (error) return { success: false, error: 'שגיאה במחיקת כרטיס הרכב' }

  revalidatePath('/app/fleet/vehicle-card')
  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DELETE VEHICLE WITH ADMIN PASSWORD
// ─────────────────────────────────────────────────────────────

/**
 * Verifies the admin delete password then soft-deletes the vehicle.
 * Password is compared server-side against FLEET_ADMIN_PASSWORD in .env.local.
 * SECURITY: verifyAppUser() + env-based password — never exposed to client.
 */
export async function deleteVehicleWithPassword(
  vehicleId: string,
  password: string
): Promise<ActionResult> {
  await verifyAppUser()

  const stored = process.env['FLEET_ADMIN_PASSWORD'] ?? ''
  if (!stored) return { success: false, error: 'סיסמת מחיקה לא מוגדרת בהגדרות המערכת' }
  if (password !== stored) return { success: false, error: 'סיסמה שגויה' }

  return softDeleteVehicle(vehicleId)
}

// ─────────────────────────────────────────────────────────────
// VEHICLE TESTS (טסטים)
// ─────────────────────────────────────────────────────────────

export async function getVehicleTests(vehicleId: string): Promise<VehicleTest[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_tests')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .is('deleted_at', null)
    .order('test_date', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((t) => ({
    id: t.id,
    vehicleId: t.vehicle_id,
    testDate: t.test_date,
    expiryDate: t.expiry_date,
    passed: t.passed,
    testStation: t.test_station,
    cost: t.cost,
    notes: t.notes,
    fileUrl: t.file_url,
    alertEnabled: t.alert_enabled ?? true,
    createdAt: t.created_at,
  }))
}

export type AddVehicleTestInput = {
  vehicleId: string
  testDate: string
  expiryDate: string
  passed?: boolean
  testStation?: string | null
  cost?: number | null
  notes?: string | null
  fileUrl?: string | null
  alertEnabled?: boolean
}

/**
 * INSERT always — vehicle test history accumulates.
 * No upsert: each test event is a separate record (no unique constraint on vehicle_id+test_date).
 */
export async function addVehicleTest(
  input: AddVehicleTestInput
): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_tests')
    .insert({
      vehicle_id: input.vehicleId,
      test_date: input.testDate,
      expiry_date: input.expiryDate,
      passed: input.passed ?? true,
      test_station: input.testStation || null,
      cost: input.cost ?? null,
      notes: input.notes || null,
      file_url: input.fileUrl ?? null,
      alert_enabled: input.alertEnabled ?? true,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת הטסט' }

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true, id: data.id }
}

export type UpdateVehicleTestInput = {
  testId: string
  vehicleId: string
  testDate: string
  expiryDate: string
  passed?: boolean
  testStation?: string | null
  cost?: number | null
  notes?: string | null
  fileUrl?: string | null
  alertEnabled?: boolean
}

export async function updateVehicleTest(input: UpdateVehicleTestInput): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { error } = await supabase.rpc('update_vehicle_test', {
    p_id: input.testId,
    p_user_id: userId,
    p_test_date: input.testDate,
    p_expiry_date: input.expiryDate,
    p_passed: input.passed ?? true,
    p_test_station: input.testStation ?? null,
    p_cost: input.cost ?? null,
    p_notes: input.notes ?? null,
    p_file_url: input.fileUrl ?? null,
    p_alert_enabled: input.alertEnabled ?? true,
  })

  if (error) return { success: false, error: 'שגיאה בעדכון הטסט' }

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true }
}

export async function deleteVehicleTest(testId: string, vehicleId: string): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Must use RPC — direct .update({ deleted_at }) fails due to PostgREST + RLS interaction
  const { error } = await supabase.rpc('soft_delete_vehicle_test', {
    p_id: testId,
    p_user_id: userId,
  })

  if (error) return { success: false, error: 'שגיאה במחיקת הטסט' }

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// VEHICLE INSURANCE (ביטוח)
// ─────────────────────────────────────────────────────────────

export async function getVehicleInsurance(vehicleId: string): Promise<VehicleInsurance[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_insurance')
    .select(`
      id,
      vehicle_id,
      insurance_type,
      policy_number,
      supplier_id,
      start_date,
      expiry_date,
      cost,
      notes,
      file_url,
      alert_enabled,
      created_at,
      vehicle_suppliers ( name )
    `)
    .eq('vehicle_id', vehicleId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((i) => {
    const supplier = (i.vehicle_suppliers as unknown) as { name: string } | null
    return {
      id: i.id,
      vehicleId: i.vehicle_id,
      insuranceType: i.insurance_type,
      policyNumber: i.policy_number,
      supplierId: i.supplier_id,
      supplierName: supplier?.name ?? null,
      startDate: i.start_date,
      expiryDate: i.expiry_date,
      cost: i.cost,
      notes: i.notes,
      fileUrl: i.file_url,
      alertEnabled: i.alert_enabled ?? true,
      createdAt: i.created_at,
    }
  })
}

export type AddVehicleInsuranceInput = {
  vehicleId: string
  insuranceType: 'mandatory' | 'comprehensive' | 'third_party'
  policyNumber?: string | null
  supplierId?: string | null
  startDate?: string | null
  expiryDate: string
  cost?: number | null
  notes?: string | null
  fileUrl?: string | null
  alertEnabled?: boolean
}

export async function addVehicleInsurance(
  input: AddVehicleInsuranceInput
): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_insurance')
    .insert({
      vehicle_id: input.vehicleId,
      insurance_type: input.insuranceType,
      policy_number: input.policyNumber || null,
      supplier_id: input.supplierId ?? null,
      start_date: input.startDate || null,
      expiry_date: input.expiryDate,
      cost: input.cost ?? null,
      notes: input.notes || null,
      file_url: input.fileUrl ?? null,
      alert_enabled: input.alertEnabled ?? true,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת הביטוח' }

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true, id: data.id }
}

export type UpdateVehicleInsuranceInput = {
  insuranceId: string
  vehicleId: string
  insuranceType: 'mandatory' | 'comprehensive' | 'third_party'
  policyNumber?: string | null
  supplierId?: string | null
  startDate?: string | null
  expiryDate: string
  cost?: number | null
  notes?: string | null
  fileUrl?: string | null
  alertEnabled?: boolean
}

export async function updateVehicleInsurance(
  input: UpdateVehicleInsuranceInput
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { error } = await supabase.rpc('update_vehicle_insurance', {
    p_id: input.insuranceId,
    p_user_id: userId,
    p_insurance_type: input.insuranceType,
    p_policy_number: input.policyNumber ?? null,
    p_supplier_id: input.supplierId ?? null,
    p_start_date: input.startDate ?? null,
    p_expiry_date: input.expiryDate,
    p_cost: input.cost ?? null,
    p_notes: input.notes ?? null,
    p_file_url: input.fileUrl ?? null,
    p_alert_enabled: input.alertEnabled ?? true,
  })

  if (error) return { success: false, error: 'שגיאה בעדכון הביטוח' }

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true }
}

export async function deleteVehicleInsurance(
  insuranceId: string,
  vehicleId: string
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Must use RPC — direct .update({ deleted_at }) fails due to PostgREST + RLS interaction
  const { error } = await supabase.rpc('soft_delete_vehicle_insurance', {
    p_id: insuranceId,
    p_user_id: userId,
  })

  if (error) return { success: false, error: 'שגיאה במחיקת הביטוח' }

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// VEHICLE DOCUMENTS
// ─────────────────────────────────────────────────────────────

export async function getVehicleDocuments(vehicleId: string): Promise<VehicleDocument[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_documents')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((d) => ({
    id: d.id,
    vehicleId: d.vehicle_id,
    documentName: d.document_name,
    fileUrl: d.file_url,
    expiryDate: d.expiry_date,
    alertEnabled: d.alert_enabled ?? false,
    notes: d.notes,
    createdAt: d.created_at,
  }))
}

export type AddVehicleDocumentInput = {
  vehicleId: string
  documentName: string
  fileUrl?: string | null
  expiryDate?: string | null
  alertEnabled?: boolean
  notes?: string | null
}

export async function addVehicleDocument(
  input: AddVehicleDocumentInput
): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_documents')
    .insert({
      vehicle_id: input.vehicleId,
      document_name: input.documentName.trim(),
      file_url: input.fileUrl ?? null,
      expiry_date: input.expiryDate || null,
      alert_enabled: input.alertEnabled ?? false,
      notes: input.notes || null,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת המסמך' }

  // Upsert document name for autocomplete suggestions (fire-and-forget)
  void supabase.rpc('increment_vehicle_document_name_usage', {
    p_name: input.documentName.trim(),
  })

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true, id: data.id }
}

export type UpdateVehicleDocumentInput = {
  docId: string
  vehicleId: string
  documentName: string
  fileUrl?: string | null
  expiryDate?: string | null
  alertEnabled?: boolean
  notes?: string | null
}

export async function updateVehicleDocument(
  input: UpdateVehicleDocumentInput
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Use RPC to bypass RLS interaction on UPDATE
  const { error } = await supabase.rpc('update_vehicle_document', {
    p_id: input.docId,
    p_user_id: userId,
    p_document_name: input.documentName.trim(),
    p_file_url: input.fileUrl ?? null,
    p_expiry_date: input.expiryDate || null,
    p_alert_enabled: input.alertEnabled ?? false,
    p_notes: input.notes ?? null,
  })

  if (error) return { success: false, error: 'שגיאה בעדכון המסמך' }

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true }
}

export async function deleteVehicleDocument(
  docId: string,
  vehicleId: string
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Must use RPC — direct .update({ deleted_at }) fails due to PostgREST + RLS interaction
  // Note: storage file is NOT deleted here — deferred cleanup (soft-delete pattern)
  const { error } = await supabase.rpc('soft_delete_vehicle_document', {
    p_id: docId,
    p_user_id: userId,
  })

  if (error) return { success: false, error: 'שגיאה במחיקת המסמך' }

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// VEHICLE DOCUMENT NAME AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────

export async function getVehicleDocumentNameSuggestions(query: string): Promise<string[]> {
  await verifyAppUser()
  const supabase = await createClient()

  if (!query.trim()) {
    // Return most frequently used names when no query
    const { data } = await supabase
      .from('vehicle_document_names')
      .select('name')
      .order('usage_count', { ascending: false })
      .limit(10)
    return (data ?? []).map((d) => d.name)
  }

  const { data } = await supabase
    .from('vehicle_document_names')
    .select('name')
    .ilike('name', `%${query}%`)
    .order('usage_count', { ascending: false })
    .limit(10)

  return (data ?? []).map((d) => d.name)
}

// ─────────────────────────────────────────────────────────────
// ACTIVE SUPPLIERS BY TYPE (for dropdowns in VehicleCard tabs)
// ─────────────────────────────────────────────────────────────

/**
 * Returns active suppliers of a given type for use in client-side dropdowns.
 * Uses verifyAppUser() — ChemoSys employee-facing context.
 * Lighter than admin getVehicleSuppliers() — filters is_active=true, no deleted rows.
 */
export async function getActiveSuppliersByType(
  supplierType: string
): Promise<{ id: string; name: string }[]> {
  await verifyAppUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicle_suppliers')
    .select('id, name')
    .eq('supplier_type', supplierType)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }))
}

// ─────────────────────────────────────────────────────────────
// DRIVER ASSIGNMENT
// ─────────────────────────────────────────────────────────────

/**
 * Returns active drivers (with active employees) for the assignment dropdown.
 * Filters: driver card not deleted + employee status active + employee not deleted.
 */
export async function getActiveDriversForAssignment(): Promise<DriverOptionForAssignment[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('drivers')
    .select(`
      id,
      employees!inner (
        first_name,
        last_name,
        status,
        deleted_at
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((row) => {
      const emp = (row.employees as unknown) as {
        status: string
        deleted_at: string | null
      }
      return emp.status === 'active' && emp.deleted_at === null
    })
    .map((row) => {
      const emp = (row.employees as unknown) as {
        first_name: string
        last_name: string
      }
      return {
        id: row.id,
        fullName: `${emp.first_name} ${emp.last_name}`,
      }
    })
}

// ─────────────────────────────────────────────────────────────
// COMPANIES FOR SELECT (dialog dropdown)
// ─────────────────────────────────────────────────────────────

/**
 * Returns active companies for use in the AddVehicleDialog company selector.
 * Defensive: returns empty array on error so the dialog still renders.
 */
export async function getCompaniesForSelect(): Promise<{ id: string; name: string }[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

  if (error) {
    console.error('[vehicles] getCompaniesForSelect error:', error.message)
    return []
  }

  return (data ?? []).map((c) => ({ id: c.id, name: c.name }))
}

// ─────────────────────────────────────────────────────────────
// VEHICLE DRIVER JOURNAL
// Activity log: one active record at a time (end_date IS NULL = active).
// Historical facts — records are closed, never deleted.
// ─────────────────────────────────────────────────────────────

/**
 * Returns driver journal entries for a vehicle, ordered by start_date desc.
 * Includes driver full name joined from drivers → employees.
 */
export async function getVehicleDriverJournal(vehicleId: string): Promise<VehicleDriverJournal[]> {
  await verifyAppUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicle_driver_journal')
    .select(`
      id, vehicle_id, driver_id, start_date, end_date, created_at,
      drivers ( employees ( first_name, last_name ) )
    `)
    .eq('vehicle_id', vehicleId)
    .order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const driver = (row.drivers as unknown) as {
      employees: { first_name: string; last_name: string } | null
    } | null
    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      driverId: row.driver_id,
      driverName: driver?.employees
        ? `${driver.employees.first_name} ${driver.employees.last_name}`
        : null,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
    }
  })
}

/**
 * Assigns a driver to a vehicle:
 * 1. Closes the current active record (if any) by setting end_date = startDate.
 * 2. Inserts a new active record.
 * 3. Syncs vehicles.assigned_driver_id (required for driver_computed_status view).
 */
export async function assignDriverJournal(
  vehicleId: string,
  driverId: string,
  startDate: string   // yyyy-mm-dd
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Step 1: Close current active record (if any)
  await supabase
    .from('vehicle_driver_journal')
    .update({ end_date: startDate })
    .eq('vehicle_id', vehicleId)
    .is('end_date', null)

  // Step 2: Insert new active record
  const { error } = await supabase
    .from('vehicle_driver_journal')
    .insert({
      vehicle_id: vehicleId,
      driver_id: driverId,
      start_date: startDate,
      end_date: null,
      created_by: userId,
    })

  if (error) return { success: false, error: 'שגיאה בשיוך הנהג' }

  // Step 3: Sync vehicles.assigned_driver_id (required for driver_computed_status view)
  await supabase
    .from('vehicles')
    .update({ assigned_driver_id: driverId })
    .eq('id', vehicleId)

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}

/**
 * Ends the current active driver assignment:
 * Closes the active journal record and clears vehicles.assigned_driver_id.
 */
export async function endDriverJournal(vehicleId: string): Promise<ActionResult> {
  await verifyAppUser()
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  await supabase
    .from('vehicle_driver_journal')
    .update({ end_date: today })
    .eq('vehicle_id', vehicleId)
    .is('end_date', null)

  // Sync: no active driver
  await supabase
    .from('vehicles')
    .update({ assigned_driver_id: null })
    .eq('id', vehicleId)

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// VEHICLE PROJECT JOURNAL
// Activity log: one active record at a time (end_date IS NULL = active).
// Historical facts — records are closed, never deleted.
// ─────────────────────────────────────────────────────────────

/**
 * Returns project journal entries for a vehicle, ordered by start_date desc.
 * Includes project name and number joined from projects.
 */
export async function getVehicleProjectJournal(vehicleId: string): Promise<VehicleProjectJournal[]> {
  await verifyAppUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicle_project_journal')
    .select(`
      id, vehicle_id, project_id, start_date, end_date, created_at,
      projects ( name, project_number, project_manager:employees!project_manager_id ( first_name, last_name ) )
    `)
    .eq('vehicle_id', vehicleId)
    .order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const project = (row.projects as unknown) as {
      name: string; project_number: string
      project_manager: { first_name: string; last_name: string } | null
    } | null
    const pm = project?.project_manager
    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      projectId: row.project_id,
      projectName: project?.name ?? '—',
      projectNumber: project?.project_number ?? '',
      projectManagerName: pm ? `${pm.first_name} ${pm.last_name}`.trim() : null,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
    }
  })
}

/**
 * Assigns a project to a vehicle:
 * 1. Closes the current active record (if any) by setting end_date = startDate.
 * 2. Inserts a new active record.
 */
export async function assignProjectJournal(
  vehicleId: string,
  projectId: string,
  startDate: string   // yyyy-mm-dd
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Step 1: Close current active record (if any)
  await supabase
    .from('vehicle_project_journal')
    .update({ end_date: startDate })
    .eq('vehicle_id', vehicleId)
    .is('end_date', null)

  // Step 2: Insert new active record
  const { error } = await supabase
    .from('vehicle_project_journal')
    .insert({
      vehicle_id: vehicleId,
      project_id: projectId,
      start_date: startDate,
      end_date: null,
      created_by: userId,
    })

  if (error) return { success: false, error: 'שגיאה בשיוך הפרויקט' }

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}

/**
 * Ends the current active project assignment:
 * Closes the active journal record with today's date.
 */
export async function endProjectJournal(vehicleId: string): Promise<ActionResult> {
  await verifyAppUser()
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  await supabase
    .from('vehicle_project_journal')
    .update({ end_date: today })
    .eq('vehicle_id', vehicleId)
    .is('end_date', null)

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// ACTIVE PROJECTS FOR SELECT (project assignment dropdown)
// ─────────────────────────────────────────────────────────────

/**
 * Returns active projects for use in the Assignment tab project dropdown.
 * Filters: status='active' AND deleted_at IS NULL.
 */
export async function getActiveProjectsForSelect(): Promise<
  { id: string; name: string; projectNumber: string }[]
> {
  await verifyAppUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id, name, project_number')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name')
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    projectNumber: p.project_number,
  }))
}


// ─────────────────────────────────────────────────────────────
// VEHICLE IMAGES
// ─────────────────────────────────────────────────────────────

/**
 * Returns all images for a vehicle with signed URLs (1-year TTL).
 * Called client-side to avoid caching stale signed URLs.
 */
export async function getVehicleImages(vehicleId: string): Promise<VehicleImage[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_images')
    .select('id, vehicle_id, storage_path, position, created_at')
    .eq('vehicle_id', vehicleId)
    .order('position', { ascending: true })

  if (error || !data) return []

  return Promise.all(
    data.map(async (img) => {
      const { data: signed } = await supabase.storage
        .from('vehicle-images')
        .createSignedUrl(img.storage_path, 60 * 60 * 24 * 365)
      return {
        id: img.id,
        vehicleId: img.vehicle_id,
        storagePath: img.storage_path,
        position: img.position,
        signedUrl: signed?.signedUrl ?? null,
        createdAt: img.created_at,
      }
    })
  )
}

/**
 * Saves image metadata after client-side upload to storage.
 * If slot already occupied — deletes old storage file + DB row first.
 */
export async function addVehicleImage(
  vehicleId: string,
  storagePath: string,
  position: number
): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Handle position conflict: delete old DB row + storage file
  const { data: existing } = await supabase
    .from('vehicle_images')
    .select('id, storage_path')
    .eq('vehicle_id', vehicleId)
    .eq('position', position)
    .maybeSingle()

  if (existing) {
    await supabase.storage.from('vehicle-images').remove([existing.storage_path])
    await supabase.from('vehicle_images').delete().eq('id', existing.id)
  }

  const { data, error } = await supabase
    .from('vehicle_images')
    .insert({ vehicle_id: vehicleId, storage_path: storagePath, position, created_by: userId })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בשמירת התמונה' }

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true, id: data.id }
}

/**
 * Hard-deletes an image from storage + DB (no soft-delete — decision [16-01]).
 */
export async function deleteVehicleImage(
  imageId: string,
  storagePath: string,
  vehicleId: string
): Promise<ActionResult> {
  await verifyAppUser()
  const supabase = await createClient()

  await supabase.storage.from('vehicle-images').remove([storagePath])
  const { error } = await supabase.from('vehicle_images').delete().eq('id', imageId)

  if (error) return { success: false, error: 'שגיאה במחיקת התמונה' }

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}

/**
 * Assigns or unassigns a driver to/from a vehicle.
 * Pass null as driverId to unassign.
 */
export async function assignDriverToVehicle(
  vehicleId: string,
  driverId: string | null
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('vehicles')
    .update({
      assigned_driver_id: driverId,
      updated_by: userId,
    })
    .eq('id', vehicleId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'שגיאה בשיוך הנהג לרכב' }

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  revalidatePath('/app/fleet/vehicle-card')
  return { success: true }
}
