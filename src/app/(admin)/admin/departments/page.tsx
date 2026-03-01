/**
 * Departments management page — server component.
 *
 * Fetches:
 *   - Active departments with company join (for table display)
 *   - Active companies (for form dropdown)
 *   - All active departments (for parent department dropdown in form)
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { DepartmentsTable } from '@/components/admin/departments/DepartmentsTable'
import { Badge } from '@/components/ui/badge'

export default async function DepartmentsPage() {
  // Auth guard — redirects to /login if no valid session
  await verifySession()

  const supabase = await createClient()

  // Departments with company name join
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('*, companies(name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (deptError) {
    console.error('[DepartmentsPage] Failed to fetch departments:', deptError.message)
  }

  // Active companies for form dropdown
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

  if (compError) {
    console.error('[DepartmentsPage] Failed to fetch companies:', compError.message)
  }

  // All active departments for parent dropdown
  const { data: allDepts, error: allDeptsError } = await supabase
    .from('departments')
    .select('id, name, dept_number, company_id')
    .is('deleted_at', null)
    .order('name')

  if (allDeptsError) {
    console.error('[DepartmentsPage] Failed to fetch all departments:', allDeptsError.message)
  }

  const departmentsList = (departments ?? []) as Parameters<typeof DepartmentsTable>[0]['departments']
  const companiesList = (companies ?? []) as Parameters<typeof DepartmentsTable>[0]['companies']
  const allDeptsList = (allDepts ?? []) as Parameters<typeof DepartmentsTable>[0]['allDepts']

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול מחלקות</h1>
        <Badge variant="secondary">{departmentsList.length}</Badge>
      </div>

      {/* Departments data table with create/edit/delete */}
      <DepartmentsTable
        departments={departmentsList}
        companies={companiesList}
        allDepts={allDeptsList}
      />
    </div>
  )
}
