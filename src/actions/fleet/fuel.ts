'use server'

/**
 * fleet/fuel.ts — Server Actions for fuel records and import batches.
 *
 * Guard: verifyAppUser() for app-side reads, verifySession() for admin actions.
 * Pattern: guard -> build query -> camelCase transform -> return
 *
 * Key behaviours:
 *   - Fuel records are READ-ONLY from the app side (imported via admin).
 *   - Server-side pagination (50 per page) — fuel data can be thousands of rows.
 *   - Period filter uses fueling_date range (yyyy-mm-dd).
 *   - Project filter uses subquery on vehicle_project_journal.
 *   - Vehicle type filter joins the vehicles table.
 */

import { createClient } from '@/lib/supabase/server'
import { verifyAppUser } from '@/lib/dal'
import type {
  FuelRecord,
  FuelFilters,
  FuelStats,
  ProjectOptionForFilter,
} from '@/lib/fleet/fuel-types'
import { FUEL_RECORDS_PER_PAGE } from '@/lib/fleet/fuel-types'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Build start date for period filter: first day of fromMonth/fromYear */
function periodStartDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Build end date for period filter: last day of toMonth/toYear */
function periodEndDate(year: number, month: number): string {
  // Last day = first day of next month minus 1
  const d = new Date(year, month, 0) // month is 1-based, Date(y,m,0) gives last day of month m
  return d.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────────────────────
// FUEL RECORDS — App side (read-only)
// ─────────────────────────────────────────────────────────────

/**
 * Get paginated fuel records with filters.
 * Returns { records, total } for the current page.
 */
export async function getFuelRecords(
  filters: FuelFilters
): Promise<{ records: FuelRecord[]; total: number }> {
  await verifyAppUser()
  const supabase = await createClient()

  const fromDate = periodStartDate(filters.fromYear, filters.fromMonth)
  const toDate = periodEndDate(filters.toYear, filters.toMonth)

  // Start building the query
  let query = supabase
    .from('fuel_records')
    .select('*', { count: 'exact' })
    .gte('fueling_date', fromDate)
    .lte('fueling_date', toDate)

  // Supplier filter
  if (filters.supplier) {
    query = query.eq('fuel_supplier', filters.supplier)
  }

  // Fuel type filter
  if (filters.fuelType) {
    query = query.eq('fuel_type', filters.fuelType)
  }

  // License plate search
  if (filters.licensePlateSearch) {
    const searchTerm = filters.licensePlateSearch.replace(/\D/g, '')
    if (searchTerm) {
      query = query.ilike('license_plate', `%${searchTerm}%`)
    }
  }

  // Vehicle type filter — requires filtering by vehicle_id IN (select from vehicles)
  if (filters.vehicleType) {
    const { data: vehicleIds } = await supabase
      .from('vehicles')
      .select('id')
      .eq('vehicle_type', filters.vehicleType)
      .is('deleted_at', null)
    if (vehicleIds && vehicleIds.length > 0) {
      query = query.in('vehicle_id', vehicleIds.map(v => v.id))
    } else {
      return { records: [], total: 0 }
    }
  }

  // Project filter — requires finding vehicles assigned to this project
  if (filters.projectId) {
    const { data: journalVehicles } = await supabase
      .from('vehicle_project_journal')
      .select('vehicle_id')
      .eq('project_id', filters.projectId)
      .is('end_date', null)
    if (journalVehicles && journalVehicles.length > 0) {
      query = query.in('vehicle_id', journalVehicles.map(v => v.vehicle_id))
    } else {
      return { records: [], total: 0 }
    }
  }

  // Ordering and pagination
  const pageSize = FUEL_RECORDS_PER_PAGE
  const from = (filters.page - 1) * pageSize
  const to = from + pageSize - 1

  const ascending = filters.sortDir === 'asc'
  query = query
    .order(filters.sortBy, { ascending, nullsFirst: false })
  // Secondary sort for stability
  if (filters.sortBy !== 'fueling_date') {
    query = query.order('fueling_date', { ascending: false })
  }
  if (filters.sortBy !== 'fueling_time') {
    query = query.order('fueling_time', { ascending: false, nullsFirst: false })
  }
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('getFuelRecords error:', error.message)
    return { records: [], total: 0 }
  }

  const rows = data ?? []

  // ── Enrich with driver & project names at time of fueling ──
  const vehicleIds = [...new Set(rows.map(r => r.vehicle_id).filter(Boolean))]

  // Batch-fetch driver journal entries that overlap the page's date range
  let driverMap = new Map<string, { driverId: string; startDate: string; endDate: string | null; driverName: string }[]>()
  let projectMap = new Map<string, { startDate: string; endDate: string | null; projectName: string }[]>()

  if (vehicleIds.length > 0) {
    // Driver journal + driver names (drivers → employees for name)
    const { data: driverJournals } = await supabase
      .from('vehicle_driver_journal')
      .select('vehicle_id, start_date, end_date, drivers ( employees ( first_name, last_name ) )')
      .in('vehicle_id', vehicleIds)

    for (const j of driverJournals ?? []) {
      const d = j.drivers as unknown as { employees: { first_name: string; last_name: string } | null } | null
      const emp = d?.employees
      const name = emp ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() : null
      if (!name) continue
      const list = driverMap.get(j.vehicle_id) ?? []
      list.push({ driverId: '', startDate: j.start_date, endDate: j.end_date, driverName: name })
      driverMap.set(j.vehicle_id, list)
    }

    // Project journal + project names
    const { data: projectJournals } = await supabase
      .from('vehicle_project_journal')
      .select('vehicle_id, start_date, end_date, projects ( name )')
      .in('vehicle_id', vehicleIds)

    for (const j of projectJournals ?? []) {
      const p = j.projects as unknown as { name: string } | null
      const name = p?.name ?? null
      if (!name) continue
      const list = projectMap.get(j.vehicle_id) ?? []
      list.push({ startDate: j.start_date, endDate: j.end_date, projectName: name })
      projectMap.set(j.vehicle_id, list)
    }
  }

  /** Find journal entry that covers the given date */
  function findAtDate<T extends { startDate: string; endDate: string | null }>(entries: T[] | undefined, date: string): T | undefined {
    if (!entries) return undefined
    return entries.find(e => e.startDate <= date && (e.endDate == null || e.endDate >= date))
  }

  const records: FuelRecord[] = rows.map(row => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    licensePlate: row.license_plate,
    fuelingDate: row.fueling_date,
    fuelingTime: row.fueling_time,
    fuelSupplier: row.fuel_supplier,
    fuelType: row.fuel_type,
    fuelingMethod: row.fueling_method,
    fuelCardNumber: row.fuel_card_number,
    quantityLiters: Number(row.quantity_liters),
    stationName: row.station_name,
    grossAmount: row.gross_amount != null ? Number(row.gross_amount) : null,
    netAmount: row.net_amount != null ? Number(row.net_amount) : null,
    actualFuelCompany: row.actual_fuel_company,
    odometerKm: row.odometer_km,
    matchStatus: row.match_status,
    importBatchId: row.import_batch_id,
    createdAt: row.created_at,
    driverName: row.vehicle_id ? (findAtDate(driverMap.get(row.vehicle_id), row.fueling_date)?.driverName ?? null) : null,
    projectName: row.vehicle_id ? (findAtDate(projectMap.get(row.vehicle_id), row.fueling_date)?.projectName ?? null) : null,
  }))

  return { records, total: count ?? 0 }
}

/**
 * Get aggregate stats for the current filter set.
 */
export async function getFuelStats(filters: FuelFilters): Promise<FuelStats> {
  await verifyAppUser()
  const supabase = await createClient()

  const fromDate = periodStartDate(filters.fromYear, filters.fromMonth)
  const toDate = periodEndDate(filters.toYear, filters.toMonth)

  let query = supabase
    .from('fuel_records')
    .select('quantity_liters, gross_amount, net_amount', { count: 'exact' })
    .gte('fueling_date', fromDate)
    .lte('fueling_date', toDate)

  if (filters.supplier) query = query.eq('fuel_supplier', filters.supplier)
  if (filters.fuelType) query = query.eq('fuel_type', filters.fuelType)

  if (filters.licensePlateSearch) {
    const searchTerm = filters.licensePlateSearch.replace(/\D/g, '')
    if (searchTerm) query = query.ilike('license_plate', `%${searchTerm}%`)
  }

  if (filters.vehicleType) {
    const { data: vehicleIds } = await supabase
      .from('vehicles')
      .select('id')
      .eq('vehicle_type', filters.vehicleType)
      .is('deleted_at', null)
    if (vehicleIds && vehicleIds.length > 0) {
      query = query.in('vehicle_id', vehicleIds.map(v => v.id))
    } else {
      return { totalRecords: 0, totalLiters: 0, totalGrossAmount: 0, totalNetAmount: 0 }
    }
  }

  if (filters.projectId) {
    const { data: journalVehicles } = await supabase
      .from('vehicle_project_journal')
      .select('vehicle_id')
      .eq('project_id', filters.projectId)
      .is('end_date', null)
    if (journalVehicles && journalVehicles.length > 0) {
      query = query.in('vehicle_id', journalVehicles.map(v => v.vehicle_id))
    } else {
      return { totalRecords: 0, totalLiters: 0, totalGrossAmount: 0, totalNetAmount: 0 }
    }
  }

  // Fetch all rows for aggregation (limit 10000)
  const { data, count } = await query.limit(10000)

  let totalLiters = 0
  let totalGrossAmount = 0
  let totalNetAmount = 0
  for (const row of (data ?? [])) {
    totalLiters += Number(row.quantity_liters) || 0
    totalGrossAmount += Number(row.gross_amount) || 0
    totalNetAmount += Number(row.net_amount) || 0
  }

  return {
    totalRecords: count ?? (data?.length ?? 0),
    totalLiters: Math.round(totalLiters * 100) / 100,
    totalGrossAmount: Math.round(totalGrossAmount * 100) / 100,
    totalNetAmount: Math.round(totalNetAmount * 100) / 100,
  }
}

/**
 * Get active project assignments for the fuel filter dropdown.
 */
export async function getProjectsForFuelFilter(): Promise<ProjectOptionForFilter[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_project_journal')
    .select('project_id, projects ( name )')
    .is('end_date', null)

  if (error || !data) return []

  // Deduplicate projects
  const seen = new Set<string>()
  const projects: ProjectOptionForFilter[] = []
  for (const row of data) {
    if (!seen.has(row.project_id)) {
      seen.add(row.project_id)
      const proj = row.projects as unknown as { name: string } | null
      projects.push({
        id: row.project_id,
        name: proj?.name ?? '—',
      })
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name, 'he'))
}
