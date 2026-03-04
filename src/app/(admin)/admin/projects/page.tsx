/**
 * Projects management page — server component.
 *
 * Fetches projects with employee joins (project_manager + site_manager names)
 * plus all active employees needed for ProjectForm selectors and attendance
 * clocks for the edit mode.
 *
 * Uses parallel fetch with Promise.all for performance.
 * First call: verifySession() — redirects to /login if unauthenticated.
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from '@/components/admin/projects/ProjectsTable'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { Badge } from '@/components/ui/badge'

const EMPLOYEES_PAGE_SIZE = 1000

export default async function ProjectsPage() {
  // Auth guard — redirects to /login if no valid session
  await verifySession()

  const supabase = await createClient()

  // Step 1: Fetch projects, employee count, and attendance clocks in parallel
  const [projectsRes, empCountRes, clocksRes] = await Promise.all([
    // Projects with joined employee names for PM and SM columns
    supabase
      .from('projects')
      .select(
        '*, project_manager:employees!project_manager_id(first_name, last_name), site_manager:employees!site_manager_id(first_name, last_name)'
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    // Count active + suspended (הודעה מוקדמת) employees to determine pagination
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .in('status', ['active', 'suspended']),

    // Attendance clocks — for ProjectForm edit mode (grouped by project_id)
    supabase
      .from('attendance_clocks')
      .select('project_id, clock_id'),
  ])

  // Log fetch errors (non-fatal — render with empty data)
  if (projectsRes.error) {
    console.error('[ProjectsPage] Failed to fetch projects:', projectsRes.error.message)
  }
  if (empCountRes.error) {
    console.error('[ProjectsPage] Failed to count employees:', empCountRes.error.message)
  }
  if (clocksRes.error) {
    console.error('[ProjectsPage] Failed to fetch attendance clocks:', clocksRes.error.message)
  }

  // Step 2: Fetch ALL active employees via paginated parallel queries
  // Supabase (PostgREST) enforces max 1000 rows per request — pagination required
  const empTotal = empCountRes.count ?? 0
  const empPages = Math.ceil(empTotal / EMPLOYEES_PAGE_SIZE)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let employees: any[] = []

  if (empPages > 0) {
    const empPromises = Array.from({ length: empPages }, (_, i) => {
      const from = i * EMPLOYEES_PAGE_SIZE
      const to = from + EMPLOYEES_PAGE_SIZE - 1
      return supabase
        .from('employees')
        .select('id, first_name, last_name, employee_number, email, mobile_phone')
        .is('deleted_at', null)
        .in('status', ['active', 'suspended'])
        .order('first_name')
        .range(from, to)
    })

    const empResults = await Promise.all(empPromises)

    for (const res of empResults) {
      if (res.error) {
        console.error('[ProjectsPage] Employee page fetch error:', res.error.message)
      } else if (res.data) {
        employees.push(...res.data)
      }
    }
  }

  // Build attendance clocks map: project_id → Array<{ clock_id: string }>
  const clocksMap: Record<string, Array<{ clock_id: string }>> = {}
  for (const row of clocksRes.data ?? []) {
    if (!clocksMap[row.project_id]) {
      clocksMap[row.project_id] = []
    }
    clocksMap[row.project_id].push({ clock_id: row.clock_id })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects = (projectsRes.data ?? []) as any[]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול פרויקטים</h1>
        <Badge variant="secondary">{projects.length}</Badge>
        <RefreshButton />
      </div>

      {/* Projects data table with full CRUD */}
      <ProjectsTable
        projects={projects}
        employees={employees}
        clocks={clocksMap}
      />
    </div>
  )
}
