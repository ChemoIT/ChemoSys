/**
 * Employees management page — server component.
 *
 * Fetches employees with joins (company name, department name, role tag names)
 * plus all reference data needed for the form dropdowns and filter toolbar.
 * First call: verifySession() — redirects to /login if unauthenticated.
 *
 * Uses parallel paginated fetch to bypass Supabase's default 1000-row limit
 * (PGRST_MAX_ROWS). First counts total rows, then fetches all pages in parallel.
 */

import Link from 'next/link'
import { Upload } from 'lucide-react'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { EmployeesTable } from '@/components/admin/employees/EmployeesTable'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const EMPLOYEES_SELECT = '*, companies(name), departments!department_id(name), sub_departments:departments!sub_department_id(name), employee_role_tags(role_tags(name))'
const PAGE_SIZE = 1000

export default async function EmployeesPage() {
  // Auth guard — redirects to /login if no valid session
  await verifySession()

  const supabase = await createClient()

  // Step 1: Count total employees + fetch reference data — all in parallel
  const [countRes, companiesRes, departmentsRes, roleTagsRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
    supabase
      .from('companies')
      .select('*')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('departments')
      .select('*')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('role_tags')
      .select('*')
      .is('deleted_at', null)
      .order('name'),
  ])

  if (countRes.error) {
    console.error('[EmployeesPage] Failed to count employees:', countRes.error.message)
  }
  if (companiesRes.error) {
    console.error('[EmployeesPage] Failed to fetch companies:', companiesRes.error.message)
  }
  if (departmentsRes.error) {
    console.error('[EmployeesPage] Failed to fetch departments:', departmentsRes.error.message)
  }
  if (roleTagsRes.error) {
    console.error('[EmployeesPage] Failed to fetch role tags:', roleTagsRes.error.message)
  }

  // Step 2: Fetch all employee pages in PARALLEL
  const totalCount = countRes.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allEmployees: any[] = []

  if (totalPages > 0) {
    const pagePromises = Array.from({ length: totalPages }, (_, i) => {
      const from = i * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      return supabase
        .from('employees')
        .select(EMPLOYEES_SELECT)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to)
    })

    const pageResults = await Promise.all(pagePromises)

    for (const res of pageResults) {
      if (res.error) {
        console.error('[EmployeesPage] Page fetch error:', res.error.message)
      } else if (res.data) {
        allEmployees.push(...res.data)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול עובדים</h1>
        <Badge variant="secondary">{allEmployees.length}</Badge>
        <RefreshButton />
        <div className="me-auto" />
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/employees/import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            ייבוא מ-Excel
          </Link>
        </Button>
      </div>

      {/* Employees data table with full CRUD */}
      <EmployeesTable
        employees={allEmployees}
        companies={companiesRes.data ?? []}
        departments={departmentsRes.data ?? []}
        roleTags={roleTagsRes.data ?? []}
      />
    </div>
  )
}
