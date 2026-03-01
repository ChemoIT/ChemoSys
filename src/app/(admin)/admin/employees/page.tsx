/**
 * Employees management page — server component.
 *
 * Fetches employees with joins (company name, department name, role tag names)
 * plus all reference data needed for the form dropdowns and filter toolbar.
 * First call: verifySession() — redirects to /login if unauthenticated.
 */

import Link from 'next/link'
import { Upload } from 'lucide-react'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { EmployeesTable } from '@/components/admin/employees/EmployeesTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function EmployeesPage() {
  // Auth guard — redirects to /login if no valid session
  await verifySession()

  const supabase = await createClient()

  // Parallel fetches for employees with joins + all reference data
  const [employeesRes, companiesRes, departmentsRes, roleTagsRes] = await Promise.all([
    supabase
      .from('employees')
      .select('*, companies(name), departments(name), employee_role_tags(role_tags(name))')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
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

  // Error handling — log but don't crash (table renders empty state)
  if (employeesRes.error) {
    console.error('[EmployeesPage] Failed to fetch employees:', employeesRes.error.message)
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

  const employeeCount = employeesRes.data?.length ?? 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול עובדים</h1>
        <Badge variant="secondary">{employeeCount}</Badge>
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
        employees={employeesRes.data ?? []}
        companies={companiesRes.data ?? []}
        departments={departmentsRes.data ?? []}
        roleTags={roleTagsRes.data ?? []}
      />
    </div>
  )
}
