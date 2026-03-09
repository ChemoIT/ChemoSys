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
 *   - Project filter uses subquery on vehicle_project_journal.
 *   - Vehicle type filter joins the vehicles table.
 */

import { createClient } from '@/lib/supabase/server'
import { verifyAppUser, verifySession } from '@/lib/dal'
import type {
  FuelRecord,
  FuelFilters,
  FuelStats,
  FuelImportBatch,
  ProjectOptionForFilter,
} from '@/lib/fleet/fuel-types'
import { FUEL_RECORDS_PER_PAGE } from '@/lib/fleet/fuel-types'

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

  // Build period range as YYYYMM integers for comparison
  const fromPeriod = filters.fromYear * 100 + filters.fromMonth
  const toPeriod = filters.toYear * 100 + filters.toMonth

  // Start building the query
  let query = supabase
    .from('fuel_records')
    .select('*', { count: 'exact' })

  // Period filter: import_year * 100 + import_month BETWEEN from AND to
  // Supabase doesn't support computed columns in filters, so we filter by range
  query = query.gte('import_year', filters.fromYear).lte('import_year', filters.toYear)

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
  // Supabase PostgREST can't do subqueries easily, so we fetch matching vehicle IDs first
  if (filters.vehicleType) {
    const { data: vehicleIds } = await supabase
      .from('vehicles')
      .select('id')
      .eq('vehicle_type', filters.vehicleType)
      .is('deleted_at', null)
    if (vehicleIds && vehicleIds.length > 0) {
      query = query.in('vehicle_id', vehicleIds.map(v => v.id))
    } else {
      // No vehicles match this type — return empty
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

  query = query
    .order('fueling_date', { ascending: false })
    .order('fueling_time', { ascending: false, nullsFirst: false })
    .range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('getFuelRecords error:', error.message)
    return { records: [], total: 0 }
  }

  // Post-filter for exact period match (since we can't do computed column filter)
  // The year range filter above is a broad filter; we narrow it here
  const records: FuelRecord[] = (data ?? [])
    .filter(row => {
      const period = row.import_year * 100 + row.import_month
      return period >= fromPeriod && period <= toPeriod
    })
    .map(row => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      licensePlate: row.license_plate,
      fuelingDate: row.fueling_date,
      fuelingTime: row.fueling_time,
      fuelSupplier: row.fuel_supplier,
      fuelType: row.fuel_type,
      fuelingMethod: row.fueling_method,
      quantityLiters: Number(row.quantity_liters),
      stationName: row.station_name,
      grossAmount: row.gross_amount != null ? Number(row.gross_amount) : null,
      netAmount: row.net_amount != null ? Number(row.net_amount) : null,
      odometerKm: row.odometer_km,
      importMonth: row.import_month,
      importYear: row.import_year,
      importBatchId: row.import_batch_id,
      createdAt: row.created_at,
    }))

  return { records, total: count ?? 0 }
}

/**
 * Get aggregate stats for the current filter set.
 */
export async function getFuelStats(filters: FuelFilters): Promise<FuelStats> {
  await verifyAppUser()
  const supabase = await createClient()

  const fromPeriod = filters.fromYear * 100 + filters.fromMonth
  const toPeriod = filters.toYear * 100 + filters.toMonth

  // Use an RPC or fetch all matching rows for aggregation
  // For now, do a simple query with no pagination to get all matching records
  let query = supabase
    .from('fuel_records')
    .select('quantity_liters, gross_amount, net_amount, import_year, import_month', { count: 'exact' })
    .gte('import_year', filters.fromYear)
    .lte('import_year', filters.toYear)

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

  // Fetch all rows for aggregation (limit 10000 — fuel records per month are ~hundreds)
  const { data, count } = await query.limit(10000)

  const filtered = (data ?? []).filter(row => {
    const period = row.import_year * 100 + row.import_month
    return period >= fromPeriod && period <= toPeriod
  })

  let totalLiters = 0
  let totalGrossAmount = 0
  let totalNetAmount = 0
  for (const row of filtered) {
    totalLiters += Number(row.quantity_liters) || 0
    totalGrossAmount += Number(row.gross_amount) || 0
    totalNetAmount += Number(row.net_amount) || 0
  }

  return {
    totalRecords: filtered.length,
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

// ─────────────────────────────────────────────────────────────
// FUEL IMPORT BATCHES — Admin side
// ─────────────────────────────────────────────────────────────

/**
 * Get all import batches, ordered by most recent first.
 */
export async function getFuelImportBatches(): Promise<FuelImportBatch[]> {
  await verifySession()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('fuel_import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !data) return []

  return data.map(row => ({
    id: row.id,
    importMonth: row.import_month,
    importYear: row.import_year,
    fuelSupplier: row.fuel_supplier,
    recordCount: row.record_count,
    matchedCount: row.matched_count,
    unmatchedCount: row.unmatched_count,
    status: row.status,
    fileName: row.file_name,
    createdAt: row.created_at,
  }))
}
