// Admin layout — server component, guards all /admin/* routes.
// Calls verifySession() at top — redirects to /login if unauthenticated.
// Renders the two-column shell: fixed sidebar (desktop right) + scrollable content area.
//
// RTL note: In RTL, 'start' = right side of viewport, 'end' = left.
// Sidebar is fixed at inset-y-0 start-0 (right side in RTL).
// Content area offset: ps-64 (padding-start = padding-right in RTL = space for right sidebar).

import { Sidebar } from "@/components/shared/Sidebar";
import { MobileSidebar } from "@/components/shared/MobileSidebar";
import { verifySession } from "@/lib/dal";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Protect entire admin shell — redirects to /login if no valid session.
  const session = await verifySession();

  return (
    <div className="flex min-h-screen bg-brand-bg">
      {/* Desktop sidebar — fixed, right side (RTL: start-0), hidden on mobile */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:start-0 lg:w-64 z-30">
        <Sidebar user={session} />
      </aside>

      {/* Main content — offset from sidebar on desktop */}
      <div className="flex-1 flex flex-col min-w-0 lg:ps-64">
        {/* Mobile header — visible only below lg breakpoint */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center gap-4 bg-sidebar-bg px-4 py-3 shadow-md">
          <MobileSidebar user={session} />
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
  );
}
