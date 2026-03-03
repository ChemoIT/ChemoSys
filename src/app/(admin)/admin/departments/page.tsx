/**
 * Departments management page — server component.
 * Fetches active departments for table display.
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { DepartmentsTable } from '@/components/admin/departments/DepartmentsTable'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { Badge } from '@/components/ui/badge'
import type { Department } from '@/types/entities'

export default async function DepartmentsPage() {
  await verifySession()

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[DepartmentsPage] Failed to fetch departments:', error.message)
  }

  const departmentsList = (data ?? []) as Department[]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול מחלקות</h1>
        <Badge variant="secondary">{departmentsList.length}</Badge>
        <RefreshButton />
      </div>

      <DepartmentsTable departments={departmentsList} />
    </div>
  )
}
