'use server'

/**
 * admin/dashboard.ts — Server Action for dashboard stats.
 *
 * Replaces 6 separate COUNT queries with a single get_dashboard_stats() RPC call.
 * Reference pattern: getFuelStats() in src/actions/fleet/fuel.ts
 *
 * Guard: verifySession() — admin-only (Sharon).
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export type DashboardStats = {
  employees:   number
  projects:    number
  users:       number
  companies:   number
  departments: number
  roleTags:    number
}

const ZERO_STATS: DashboardStats = {
  employees:   0,
  projects:    0,
  users:       0,
  companies:   0,
  departments: 0,
  roleTags:    0,
}

/**
 * getDashboardStats — fetches all 6 stat card counts via a single RPC call.
 * Maps snake_case DB column names to camelCase keys expected by StatsCards.tsx.
 *
 * On any error, returns all-zero fallback so the page still renders.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  await verifySession()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_dashboard_stats')

  if (error) {
    console.error('[Dashboard] getDashboardStats RPC error:', error.message)
    return ZERO_STATS
  }

  // RPC returns an array with one row (RETURNS TABLE with no args)
  const row = Array.isArray(data) ? data[0] : data

  if (!row) {
    console.error('[Dashboard] getDashboardStats returned no data')
    return ZERO_STATS
  }

  return {
    employees:   Number(row.employees_count)   || 0,
    projects:    Number(row.projects_count)    || 0,
    users:       Number(row.users_count)       || 0,
    companies:   Number(row.companies_count)   || 0,
    departments: Number(row.departments_count) || 0,
    roleTags:    Number(row.role_tags_count)   || 0,
  }
}
