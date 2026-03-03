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
 */

import { verifySession, checkPagePermission } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { UsersTable } from '@/components/admin/users/UsersTable'
import { Badge } from '@/components/ui/badge'
import { AccessDenied } from '@/components/shared/AccessDenied'

export default async function UsersPage() {
  await verifySession()

  const hasAccess = await checkPagePermission('users', 1)
  if (!hasAccess) return <AccessDenied />
  const supabase = await createClient()

  const [usersRes, employeesRes, templatesRes] = await Promise.all([
    supabase
      .from('users')
      .select(
        '*, employees(first_name, last_name, employee_number, email, id_number), user_permissions(module_key, level, is_override, template_id)'
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('employees')
      .select('id, first_name, last_name, employee_number, email, id_number, companies(name)')
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('last_name'),
    supabase
      .from('role_templates')
      .select('id, name')
      .is('deleted_at', null)
      .order('name'),
  ])

  if (usersRes.error) console.error('[UsersPage] users fetch error:', usersRes.error.message)
  if (employeesRes.error) console.error('[UsersPage] employees fetch error:', employeesRes.error.message)
  if (templatesRes.error) console.error('[UsersPage] templates fetch error:', templatesRes.error.message)

  // Employees already linked to active users — exclude from the create form search
  const linkedEmployeeIds = (usersRes.data ?? []).map((u) => u.employee_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול יוזרים</h1>
        <Badge variant="secondary">{usersRes.data?.length ?? 0}</Badge>
      </div>

      <UsersTable
        users={(usersRes.data ?? []) as unknown as Parameters<typeof UsersTable>[0]['users']}
        employees={
          (employeesRes.data ?? []) as unknown as Parameters<typeof UsersTable>[0]['employees']
        }
        linkedEmployeeIds={linkedEmployeeIds}
        templates={templatesRes.data ?? []}
      />
    </div>
  )
}
