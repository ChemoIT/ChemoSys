import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * fetchAllRows — Paginated fetch that bypasses Supabase's 1000-row default limit.
 *
 * IRON RULE: Every Supabase .select() on a table that may exceed 1000 rows
 * MUST use this function (or manual .range() pagination).
 *
 * Tables currently >1000 rows:
 *   vehicle_project_journal (2315+), vehicle_driver_journal (1610+),
 *   fuel_records (1700+), vehicles (1193+), vehicle_km_log (1446+)
 *
 * @param client  - Supabase client (server or admin)
 * @param table   - Table name
 * @param select  - Select string (e.g. 'id, name, projects ( name )')
 * @param options - Optional filters and ordering
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  select: string,
  options?: {
    filters?: (query: ReturnType<SupabaseClient['from']>) => ReturnType<SupabaseClient['from']>
    order?: { column: string; ascending?: boolean }
  }
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let offset = 0

  while (true) {
    let query = client.from(table).select(select).range(offset, offset + PAGE - 1) as any
    if (options?.filters) {
      query = options.filters(query)
    }
    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending ?? true })
    }
    const { data, error } = await query
    if (error) throw new Error(`fetchAllRows(${table}): ${error.message}`)
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  return all
}

/**
 * fetchAllRowsFiltered — Same as fetchAllRows but with a date range filter built in.
 * Useful for fuel_records, vehicle_km_log queries filtered by date.
 */
export async function fetchAllRowsFiltered<T = Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  select: string,
  dateCol: string,
  from: string,
  to: string
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let offset = 0

  while (true) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .gte(dateCol, from)
      .lte(dateCol, to)
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`fetchAllRowsFiltered(${table}): ${error.message}`)
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  return all
}
