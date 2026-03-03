// Admin layout — server component, guards all /admin/* routes.
// Calls verifySession() at top — redirects to /login if unauthenticated.
// Checks is_blocked — redirects blocked users to /login?blocked=1.
// Calls getNavPermissions() — passes allowed modules to Sidebar for filtering.
//
// RTL note: In RTL, 'start' = right side of viewport, 'end' = left.
// Sidebar is fixed at inset-y-0 start-0 (right side in RTL).
// Content area offset: ps-64 (padding-start = padding-right in RTL = space for right sidebar).

import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/shared/Sidebar'
import { MobileSidebar } from '@/components/shared/MobileSidebar'
import { verifySession, getNavPermissions } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Protect entire admin shell — redirects to /login if no valid session.
  const session = await verifySession()
  const supabase = await createClient()

  // Check if user is blocked — only applies to users with a public.users row.
  // Bootstrap admin (no public.users row) is never blocked.
  const { data: userRecord } = await supabase
    .from('users')
    .select('is_blocked')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (userRecord?.is_blocked) {
    // Sign out and redirect — blocked users cannot access the admin panel.
    await supabase.auth.signOut()
    redirect('/login?blocked=1')
  }

  // Fetch allowed modules for sidebar nav filtering.
  // Bootstrap admin (no public.users row) receives all module keys.
  const allowedModules = await getNavPermissions()

  return (
    <div className="flex min-h-screen bg-brand-bg">
      {/* Desktop sidebar — fixed, right side (RTL: start-0), hidden on mobile */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:start-0 lg:w-64 z-30">
        <Sidebar user={session} allowedModules={allowedModules} />
      </aside>

      {/* Main content — offset from sidebar on desktop */}
      <div className="flex-1 flex flex-col min-w-0 lg:ps-64">
        {/* Mobile header — visible only below lg breakpoint */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center gap-4 bg-sidebar-bg px-4 py-3 shadow-md">
          <MobileSidebar user={session} allowedModules={allowedModules} />
          <span className="text-sidebar-text font-semibold text-base">
            ChemoSys
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
