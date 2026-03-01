/**
 * Role Tags management page — server component.
 * Fetches all active role tags and renders the RoleTagsTable client component.
 */

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { RoleTagsTable } from '@/components/admin/role-tags/RoleTagsTable'
import { Badge } from '@/components/ui/badge'

export default async function RoleTagsPage() {
  // Auth guard — redirects to /login if no valid session
  await verifySession()

  const supabase = await createClient()

  // Fetch active role tags (exclude soft-deleted)
  const { data: roleTags, error } = await supabase
    .from('role_tags')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[RoleTagsPage] Failed to fetch role tags:', error.message)
  }

  const roleTagsList = roleTags ?? []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">תגיות תפקיד</h1>
        <Badge variant="secondary">{roleTagsList.length}</Badge>
      </div>

      {/* Role tags data table with create/edit/delete */}
      <RoleTagsTable roleTags={roleTagsList} />
    </div>
  )
}
