/**
 * Dashboard page — Server Component.
 * Fetches 6 entity counts + 20 recent audit log entries in parallel.
 *
 * Pitfall 2 (RESEARCH.md): audit_log.user_id references auth.users(id),
 * not public.users. User display names resolved via two-step approach:
 *   1. Fetch audit log rows
 *   2. Collect distinct user_ids → query public.users.auth_user_id IN (...)
 *   3. Build Map<user_id, displayName> → merge into entries
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { StatsCards } from '@/components/admin/dashboard/StatsCards'
import { ActivityFeed, type ActivityEntry } from '@/components/admin/dashboard/ActivityFeed'
import { RefreshButton } from '@/components/shared/RefreshButton'

export default async function DashboardPage() {
  // Auth guard — redirects to /login if no valid session
  await verifySession()

  const supabase = await createClient()

  // Run 7 queries in parallel for fast page load
  const [
    employeeRes,
    projectRes,
    userRes,
    companyRes,
    deptRes,
    roleTagRes,
    activityRes,
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase
      .from('role_tags')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase
      .from('audit_log')
      .select('id, created_at, action, entity_type, entity_id, user_id')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Log any query errors (non-blocking — page renders with fallback zeros)
  if (employeeRes.error) console.error('[Dashboard] employee count error:', employeeRes.error.message)
  if (projectRes.error)  console.error('[Dashboard] project count error:', projectRes.error.message)
  if (userRes.error)     console.error('[Dashboard] user count error:', userRes.error.message)
  if (companyRes.error)  console.error('[Dashboard] company count error:', companyRes.error.message)
  if (deptRes.error)     console.error('[Dashboard] department count error:', deptRes.error.message)
  if (roleTagRes.error)  console.error('[Dashboard] role_tag count error:', roleTagRes.error.message)
  if (activityRes.error) console.error('[Dashboard] activity feed error:', activityRes.error.message)

  const stats = {
    employees:   employeeRes.count  ?? 0,
    projects:    projectRes.count   ?? 0,
    users:       userRes.count      ?? 0,
    companies:   companyRes.count   ?? 0,
    departments: deptRes.count      ?? 0,
    roleTags:    roleTagRes.count   ?? 0,
  }

  // ----------------------------------------------------------------
  // Resolve user display names for activity feed
  // Two-step pattern required — audit_log.user_id → auth.users(id),
  // NOT public.users. Display names live in public.users.auth_user_id.
  // ----------------------------------------------------------------

  const auditRows = activityRes.data ?? []
  let entries: ActivityEntry[] = []

  if (auditRows.length > 0) {
    // Step 1: collect distinct user_ids
    const distinctUserIds = [...new Set(auditRows.map((r) => r.user_id).filter(Boolean))]

    // Step 2: query public.users where auth_user_id IN (distinctUserIds)
    // Join through employees to get real names — public.users has no full_name/email columns
    // No deleted_at filter — resolve names for historical entries too
    const { data: userRows } = await supabase
      .from('users')
      .select('auth_user_id, employees(first_name, last_name)')
      .in('auth_user_id', distinctUserIds)

    // Step 3: build lookup Map<auth_user_id, displayName>
    const userMap = new Map<string, string>()
    for (const u of (userRows ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emp = (u.employees as unknown as { first_name: string; last_name: string } | null)
      const displayName = emp
        ? `${emp.first_name} ${emp.last_name}`
        : u.auth_user_id.substring(0, 8)
      userMap.set(u.auth_user_id, displayName)
    }

    // Step 4: resolve entity names per entity_type
    const entityGroups = new Map<string, Set<string>>()
    for (const row of auditRows) {
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
    // employee_import — static label, no lookup needed
    const importIds = entityGroups.get('employee_import')
    if (importIds) {
      for (const id of importIds) entityNameMap.set(id, 'ייבוא עובדים')
    }

    await Promise.all(lookupPromises)

    // Step 5: merge display names into audit rows
    entries = auditRows.map((row) => ({
      id:          row.id,
      created_at:  row.created_at,
      action:      row.action,
      entity_type: row.entity_type,
      entity_id:   row.entity_id,
      user_id:     row.user_id,
      userName:    userMap.get(row.user_id) ?? row.user_id?.substring(0, 8) ?? '—',
      entityName:  entityNameMap.get(row.entity_id) ?? row.entity_id?.substring(0, 8) ?? '—',
    }))
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">דשבורד</h1>
        <RefreshButton />
      </div>

      {/* 6 stat cards */}
      <StatsCards stats={stats} />

      {/* Recent audit log activity */}
      <ActivityFeed entries={entries} />
    </div>
  )
}
