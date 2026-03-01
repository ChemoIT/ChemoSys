/**
 * EmployeeImportPage — server component for the /admin/employees/import route.
 *
 * Fetches companies for the company selector in the import wizard.
 * The wizard itself (EmployeeImport) is a client component that handles
 * the two-phase Excel upload + preview + confirm flow.
 *
 * Pattern: verifySession (auth guard) → parallel data fetches → render
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { EmployeeImport } from '@/components/admin/employees/EmployeeImport'

export default async function EmployeeImportPage() {
  // Auth guard — redirects to /login if no valid session
  await verifySession()

  const supabase = await createClient()

  // Fetch companies for the wizard's company selector
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .is('deleted_at', null)
    .order('name')

  if (error) {
    console.error('[EmployeeImportPage] Failed to fetch companies:', error.message)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ייבוא עובדים מקובץ Excel</h1>
      </div>

      {/* Import wizard */}
      <EmployeeImport companies={companies ?? []} />
    </div>
  )
}
