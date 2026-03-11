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

import { cache } from 'react'
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
 * Uses fuel_records_enriched view — driver & project names resolved via LATERAL JOIN in DB.
 * Returns { records, total } for the current page.
 */
export async function getFuelRecords(
  filters: FuelFilters
): Promise<{ records: FuelRecord[]; total: number }> {
  await verifyAppUser()
  const supabase = await createClient()

  const fromDate = periodStartDate(filters.fromYear, filters.fromMonth)
  const toDate = periodEndDate(filters.toYear, filters.toMonth)

  // Query the enriched view — driver_name & project_name come from DB LATERAL JOINs
  let query = supabase
    .from('fuel_records_enriched')
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

  const records: FuelRecord[] = (data ?? []).map(row => ({
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
    driverName: row.driver_name || null,
    projectName: row.project_name || null,
  }))

  return { records, total: count ?? 0 }
}

/**
 * Get aggregate stats for the current filter set.
 * Uses get_fuel_stats RPC — SUM computed in DB, not JS.
 */
export async function getFuelStats(filters: FuelFilters): Promise<FuelStats> {
  await verifyAppUser()
  const supabase = await createClient()

  const fromDate = periodStartDate(filters.fromYear, filters.fromMonth)
  const toDate = periodEndDate(filters.toYear, filters.toMonth)

  // Resolve vehicle IDs for vehicleType/project filters (still needed as pre-filter)
  let vehicleIds: string[] | null = null

  if (filters.vehicleType) {
    const { data } = await supabase
      .from('vehicles')
      .select('id')
      .eq('vehicle_type', filters.vehicleType)
      .is('deleted_at', null)
    if (data && data.length > 0) {
      vehicleIds = data.map(v => v.id)
    } else {
      return { totalRecords: 0, totalLiters: 0, totalGrossAmount: 0, totalNetAmount: 0 }
    }
  }

  if (filters.projectId) {
    const { data } = await supabase
      .from('vehicle_project_journal')
      .select('vehicle_id')
      .eq('project_id', filters.projectId)
      .is('end_date', null)
    if (data && data.length > 0) {
      const projectVehicleIds = data.map(v => v.vehicle_id)
      // Intersect with vehicleType filter if both present
      vehicleIds = vehicleIds
        ? vehicleIds.filter(id => projectVehicleIds.includes(id))
        : projectVehicleIds
      if (vehicleIds.length === 0) {
        return { totalRecords: 0, totalLiters: 0, totalGrossAmount: 0, totalNetAmount: 0 }
      }
    } else {
      return { totalRecords: 0, totalLiters: 0, totalGrossAmount: 0, totalNetAmount: 0 }
    }
  }

  const plateSearch = filters.licensePlateSearch?.replace(/\D/g, '') || null

  const { data, error } = await supabase.rpc('get_fuel_stats', {
    p_from_date: fromDate,
    p_to_date: toDate,
    p_supplier: filters.supplier ?? null,
    p_fuel_type: filters.fuelType ?? null,
    p_plate_search: plateSearch,
    p_vehicle_ids: vehicleIds,
  })

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return { totalRecords: 0, totalLiters: 0, totalGrossAmount: 0, totalNetAmount: 0 }
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    totalRecords: Number(row.total_records) || 0,
    totalLiters: Math.round((Number(row.total_liters) || 0) * 100) / 100,
    totalGrossAmount: Math.round((Number(row.total_gross) || 0) * 100) / 100,
    totalNetAmount: Math.round((Number(row.total_net) || 0) * 100) / 100,
  }
}

/**
 * Get active project assignments for the fuel filter dropdown.
 * Wrapped in React.cache() — deduplicated within a single server render pass.
 */
export const getProjectsForFuelFilter = cache(async function getProjectsForFuelFilter(): Promise<ProjectOptionForFilter[]> {
  await verifyAppUser()
  const supabase = await createClient()

  // IRON RULE: fetchAllRows — Supabase 1000-row limit
  const { fetchAllRows } = await import('@/lib/supabase/fetch-all')
  const data = await fetchAllRows<{ project_id: string; projects: { name: string } | null }>(
    supabase, 'vehicle_project_journal', 'project_id, projects ( name )', {
    filters: (q: any) => q.is('end_date', null),
  })

  if (!data) return []

  // Deduplicate projects
  const seen = new Set<string>()
  const projects: ProjectOptionForFilter[] = []
  for (const row of data) {
    if (!seen.has(row.project_id)) {
      seen.add(row.project_id)
      projects.push({
        id: row.project_id,
        name: row.projects?.name ?? '—',
      })
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name, 'he'))
})
