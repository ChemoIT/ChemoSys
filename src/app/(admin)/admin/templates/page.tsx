/**
 * Templates management page — server component.
 *
 * Fetches all active role_templates with their template_permissions join
 * and renders the TemplatesTable client component.
 * First line: verifySession() — redirects to /login if unauthenticated.
 *
 * verifySession() runs OUTSIDE Suspense so auth redirect fires immediately.
 */

import { Suspense } from 'react'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { TemplatesTable } from '@/components/admin/templates/TemplatesTable'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { Badge } from '@/components/ui/badge'

async function TemplatesContent() {
  const supabase = await createClient()

  // Fetch active templates with their permission rows
  const { data: templates, error } = await supabase
    .from('role_templates')
    .select('*, template_permissions(module_key, level)')
    .is('deleted_at', null)
    .order('name')

  if (error) {
    console.error('[TemplatesPage] Failed to fetch templates:', error.message)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">תבניות הרשאות</h1>
        <Badge variant="secondary">{templates?.length ?? 0}</Badge>
      </div>

      {/* Templates data table with create/edit/delete */}
      <TemplatesTable templates={templates ?? []} />
    </div>
  )
}

export default async function TemplatesPage() {
  // Auth guard — redirects to /login if no valid session (must run OUTSIDE Suspense)
  await verifySession()

  return (
    <Suspense fallback={<PageSkeleton config={{
      titleWidth: 110,
      table: { columns: [120, 200, 60], rows: 6, pagination: false },
      maxWidth: 'max-w-full',
    }} />}>
      <TemplatesContent />
    </Suspense>
  )
}
