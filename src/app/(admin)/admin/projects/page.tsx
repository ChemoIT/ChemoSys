/**
 * Projects management page — server component.
 *
 * Fetches all active projects with employee FK joins (PM, SM, CVC) and the
 * list of active employees for the ProjectForm selectors.
 * First line: verifySession() — redirects to /login if unauthenticated.
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from '@/components/admin/projects/ProjectsTable'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { Badge } from '@/components/ui/badge'

export default async function ProjectsPage() {
  // Auth guard — redirects to /login if no valid session
  await verifySession()

  const supabase = await createClient()

  // Parallel fetch: projects with employee joins + active employees for selectors
  const [{ data: projects, error: projectsError }, { data: employees, error: empError }] =
    await Promise.all([
      supabase
        .from('projects')
        .select(
          `*,
          pm:employees!project_manager_id(id, first_name, last_name, employee_number),
          sm:employees!site_manager_id(id, first_name, last_name, employee_number),
          cvc:employees!camp_vehicle_coordinator_id(id, first_name, last_name, employee_number)`
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),

      supabase
        .from('employees')
        .select('id, first_name, last_name, employee_number, email, id_number, companies(name)')
        .is('deleted_at', null)
        .eq('status', 'active')
        .order('last_name'),
    ])

  if (projectsError) {
    console.error('[ProjectsPage] Failed to fetch projects:', projectsError.message)
  }
  if (empError) {
    console.error('[ProjectsPage] Failed to fetch employees:', empError.message)
  }

  const projectsList = projects ?? []
  const employeesList = employees ?? []

  // Active count computed server-side for the badge
  const activeCount = projectsList.filter((p) => p.status === 'active').length

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול פרויקטים</h1>
        <Badge variant="secondary">{activeCount} פעילים</Badge>
        <RefreshButton />
      </div>

      {/* Projects data table with create/edit/delete */}
      <ProjectsTable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        projects={projectsList as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        employees={employeesList as any}
      />
    </div>
  )
}
