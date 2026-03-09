/**
 * UsersPage — /admin/users
 *
 * Server Component. Fetches:
 *   - users (with employee join + user_permissions join)
 *   - employees (active only, for create form)
 *   - role_templates (for template assignment)
 *
 * Computes linkedEmployeeIds to prevent linking the same employee twice.
 * Passes all data down to UsersTable (client component).
 *
 * verifySession() runs OUTSIDE Suspense so auth redirect fires immediately.
 */

import { Suspense } from 'react'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UsersTable } from '@/components/admin/users/UsersTable'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { Badge } from '@/components/ui/badge'

const EMPLOYEES_PAGE_SIZE = 1000

async function UsersContent() {
  const supabase = await createClient()

  // Step 1: Fetch users, employee count, and templates in parallel
  const [usersRes, empCountRes, templatesRes] = await Promise.all([
    supabase
      .from('users')
      .select(
        '*, employees(first_name, last_name, employee_number, email, id_number), user_permissions(module_key, level, is_override, template_id)'
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .in('status', ['active', 'suspended']),
    supabase
      .from('role_templates')
      .select('id, name')
      .is('deleted_at', null)
      .order('name'),
  ])

  if (usersRes.error) console.error('[UsersPage] users fetch error:', usersRes.error.message)
  if (empCountRes.error) console.error('[UsersPage] employees count error:', empCountRes.error.message)
  if (templatesRes.error) console.error('[UsersPage] templates fetch error:', templatesRes.error.message)

  // Step 2: Fetch ALL active employees via paginated parallel queries
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
        .select('id, first_name, last_name, employee_number, email, id_number, companies(name)')
        .is('deleted_at', null)
        .in('status', ['active', 'suspended'])
        .order('last_name')
        .range(from, to)
    })

    const empResults = await Promise.all(empPromises)

    for (const res of empResults) {
      if (res.error) {
        console.error('[UsersPage] Employee page fetch error:', res.error.message)
      } else if (res.data) {
        employees.push(...res.data)
      }
    }
  }

  // Fetch auth emails for all users via admin client
  const adminClient = createAdminClient()
  const authEmailMap = new Map<string, string>()
  const activeUsers = usersRes.data ?? []
  if (activeUsers.length > 0) {
    // Batch-fetch auth users (listUsers paginates, but our user count is small)
    const { data: authList } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    if (authList?.users) {
      for (const au of authList.users) {
        if (au.email) authEmailMap.set(au.id, au.email)
      }
    }
  }

  // Merge auth email into each user record
  const usersWithAuthEmail = activeUsers.map((u) => ({
    ...u,
    auth_email: authEmailMap.get(u.auth_user_id) ?? null,
  }))

  // Employees already linked to active users — exclude from the create form search
  const linkedEmployeeIds = activeUsers.map((u) => u.employee_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול יוזרים</h1>
        <Badge variant="secondary">{usersRes.data?.length ?? 0}</Badge>
      </div>

      <UsersTable
        users={usersWithAuthEmail as unknown as Parameters<typeof UsersTable>[0]['users']}
        employees={
          employees as unknown as Parameters<typeof UsersTable>[0]['employees']
        }
        linkedEmployeeIds={linkedEmployeeIds}
        templates={templatesRes.data ?? []}
      />
    </div>
  )
}

export default async function UsersPage() {
  // Auth guard — redirects to /login if no valid session (must run OUTSIDE Suspense)
  await verifySession()

  return (
    <Suspense fallback={<PageSkeleton config={{
      titleWidth: 110,
      table: { columns: [100, 80, 100, 80, 60, 80], rows: 8 },
      maxWidth: 'max-w-full',
    }} />}>
      <UsersContent />
    </Suspense>
  )
}
