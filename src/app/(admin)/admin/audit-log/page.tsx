/**
 * /admin/audit-log — Audit Log Viewer Page.
 *
 * Server Component: reads URL search params, fetches filtered audit_log page,
 * resolves user display names via two-step pattern, passes data to client table.
 *
 * Security: verifySession() as first line — same guard as all Server Actions.
 * Data: audit_log rows + public.users display name merge + filter dropdown options.
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { AuditLogTable } from '@/components/admin/audit-log/AuditLogTable'
import { RefreshButton } from '@/components/shared/RefreshButton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchParams = {
  entity?: string
  action?: string
  search?: string
  from?: string
  to?: string
  page?: string
}

type AuditRow = {
  id: string
  created_at: string
  action: string
  entity_type: string
  entity_id: string
  user_id: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  userName: string
  entityName: string
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // 1. Auth guard — MUST be first
  await verifySession()

  const supabase = await createClient()

  // 2. Await searchParams (Next.js 16 Promise pattern — Pitfall 7)
  const params = await searchParams

  // 3. Pagination
  const PAGE_SIZE = 50
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const rangeFrom = (page - 1) * PAGE_SIZE
  const rangeTo = rangeFrom + PAGE_SIZE - 1

  // 4. Build filtered Supabase query
  let query = supabase
    .from('audit_log')
    .select('id, created_at, action, entity_type, entity_id, user_id, old_data, new_data', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(rangeFrom, rangeTo)

  if (params.entity) query = query.eq('entity_type', params.entity)
  if (params.action) query = query.eq('action', params.action)
  // Pitfall 6: use explicit UTC boundaries for date filtering
  if (params.from) query = query.gte('created_at', params.from + 'T00:00:00.000Z')
  if (params.to)   query = query.lte('created_at', params.to + 'T23:59:59.999Z')
  // Free-text search on entity_type and entity_id (Pitfall 2: no user_id text search)
  if (params.search) {
    query = query.or(
      `entity_type.ilike.%${params.search}%,entity_id::text.ilike.%${params.search}%`
    )
  }

  const { data: rawRows, count } = await query
  const rows = rawRows ?? []

  // 5. Resolve user display names — two-step pattern (Pitfall 2)
  // audit_log.user_id → auth.users(id). Display names via users → employees join.
  // No deleted_at filter — resolve names for historical entries too.
  const distinctUserIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]

  const userMap = new Map<string, string>()
  if (distinctUserIds.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('auth_user_id, employees(first_name, last_name)')
      .in('auth_user_id', distinctUserIds)

    if (userRows) {
      for (const u of userRows) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emp = (u.employees as unknown as { first_name: string; last_name: string } | null)
        const displayName = emp
          ? `${emp.first_name} ${emp.last_name}`
          : u.auth_user_id.substring(0, 8)
        userMap.set(u.auth_user_id, displayName)
      }
    }
  }

  // 5b. Resolve entity names per entity_type
  const entityGroups = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!row.entity_id) continue
    const group = entityGroups.get(row.entity_type) ?? new Set<string>()
    group.add(row.entity_id)
    entityGroups.set(row.entity_type, group)
  }

  const entityNameMap = new Map<string, string>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type EntityRow = { id: string; [key: string]: any }
  async function addLookup(
    entityType: string,
    table: string,
    fields: string,
    nameBuilder: (row: EntityRow) => string
  ): Promise<void> {
    const ids = entityGroups.get(entityType)
    if (!ids || ids.size === 0) return
    const { data } = await supabase
      .from(table)
      .select(fields)
      .in('id', [...ids])
    for (const row of ((data ?? []) as unknown as EntityRow[])) {
      entityNameMap.set(row.id, nameBuilder(row))
    }
  }

  const lookupPromises: Promise<void>[] = [
    addLookup('employees', 'employees', 'id, first_name, last_name',
      (r) => `${r.first_name} ${r.last_name}`),
    addLookup('companies', 'companies', 'id, name', (r) => r.name as string),
    addLookup('departments', 'departments', 'id, name', (r) => r.name as string),
    addLookup('projects', 'projects', 'id, name', (r) => r.name as string),
    addLookup('role_templates', 'role_templates', 'id, name', (r) => r.name as string),
    addLookup('role_tags', 'role_tags', 'id, name', (r) => r.name as string),
    addLookup('attendance_clocks', 'attendance_clocks', 'id, clock_id',
      (r) => r.clock_id as string),
  ]

  // For users entity_type — join through employees
  const userEntityIds = entityGroups.get('users')
  if (userEntityIds && userEntityIds.size > 0) {
    lookupPromises.push((async () => {
      const { data } = await supabase
        .from('users')
        .select('id, employees(first_name, last_name)')
        .in('id', [...userEntityIds])
      for (const row of (data ?? [])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emp = (row.employees as unknown as { first_name: string; last_name: string } | null)
        entityNameMap.set(row.id, emp ? `${emp.first_name} ${emp.last_name}` : row.id.substring(0, 8))
      }
    })())
  }
  // employee_import — static label
  const importIds = entityGroups.get('employee_import')
  if (importIds) {
    for (const id of importIds) entityNameMap.set(id, 'ייבוא עובדים')
  }

  await Promise.all(lookupPromises)

  // 6. Merge userName + entityName into each row
  const mergedRows: AuditRow[] = rows.map((r) => ({
    ...r,
    old_data: r.old_data as Record<string, unknown> | null,
    new_data: r.new_data as Record<string, unknown> | null,
    userName: userMap.get(r.user_id) ?? r.user_id?.substring(0, 8) ?? '—',
    entityName: entityNameMap.get(r.entity_id) ?? r.entity_id?.substring(0, 8) ?? '—',
  }))

  // 7. Fetch distinct entity types for filter dropdown
  const { data: entityTypeRows } = await supabase
    .from('audit_log')
    .select('entity_type')
    .limit(1000)

  const entityTypes = [...new Set((entityTypeRows ?? []).map((r) => r.entity_type))].filter(
    Boolean
  )

  // 8. Fetch distinct action types for filter dropdown
  const { data: actionTypeRows } = await supabase
    .from('audit_log')
    .select('action')
    .limit(1000)

  const actionTypes = [...new Set((actionTypeRows ?? []).map((r) => r.action))].filter(Boolean)

  // 9. Render
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">יומן פעולות</h1>
        <RefreshButton />
      </div>

      {/* Main audit log table (client component) */}
      <AuditLogTable
        rows={mergedRows}
        totalCount={count ?? 0}
        pageSize={PAGE_SIZE}
        currentPage={page}
        entityTypes={entityTypes}
        actionTypes={actionTypes}
        currentFilters={{
          entity: params.entity,
          action: params.action,
          search: params.search,
          from: params.from,
          to: params.to,
        }}
      />
    </div>
  )
}
