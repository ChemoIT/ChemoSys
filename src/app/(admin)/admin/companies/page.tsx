/**
 * Companies management page — server component.
 * Fetches all active companies and renders the CompaniesTable client component.
 * First line: verifySession() — redirects to /login if unauthenticated.
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { CompaniesTable } from '@/components/admin/companies/CompaniesTable'
import { Badge } from '@/components/ui/badge'

export default async function CompaniesPage() {
  // Auth guard — redirects to /login if no valid session
  await verifySession()

  const supabase = await createClient()

  // Fetch active companies (exclude soft-deleted)
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[CompaniesPage] Failed to fetch companies:', error.message)
  }

  const companiesList = companies ?? []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול חברות</h1>
        <Badge variant="secondary">{companiesList.length}</Badge>
      </div>

      {/* Companies data table with create/edit/delete */}
      <CompaniesTable companies={companiesList} />
    </div>
  )
}
