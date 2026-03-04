// FleetLayout — nested server layout for all /app/fleet/* pages.
// Sits INSIDE (app)/layout.tsx which provides AppHeader + auth shell.
//
// Responsibilities:
//   1. verifyAppUser() — cached auth guard (zero extra DB queries vs parent)
//   2. Permission guard — redirect to /app if user lacks app_fleet
//   3. Render FleetSidebar (client component, RTL icon sidebar) + content area
//
// Layout structure:
//   (app)/layout.tsx → AppHeader + <main className="flex-1">
//     FleetLayout → flex row (FleetSidebar on right | content div on left)
//       page.tsx → fleet page content
//
// Content area padding (p-4 md:p-6) lives HERE, not in parent <main>.
// This ensures the sidebar sits flush while page content has proper spacing.

import { redirect } from "next/navigation";
import { verifyAppUser, getAppNavPermissions } from "@/lib/dal";
import { FleetSidebar } from "@/components/app/fleet/FleetSidebar";

export default async function FleetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth guard — React.cache() deduplicates vs (app)/layout.tsx call.
  // Defense-in-depth: if someone bypasses the parent layout, this catches it.
  await verifyAppUser();

  // Fetch all app_* permissions — cached RPC, zero extra DB queries.
  const permissions = await getAppNavPermissions();

  // Guard: user must have app_fleet to access any /app/fleet/* page.
  // Redirect to /app (module selector) — not /chemosys (login).
  if (!permissions.includes("app_fleet")) {
    redirect("/app");
  }

  // Filter to fleet sub-module keys only — passed as string[] (not Set).
  // Set is not JSON-serializable across server→client boundary.
  // FleetSidebar converts to Set<string> internally via useMemo.
  const fleetPermissions = permissions.filter((k) =>
    k.startsWith("app_fleet_")
  );

  return (
    // Full-height flex row:
    // - FleetSidebar on RTL start (right side, icon-only by default)
    // - Content div fills remaining space with overflow scroll + padding
    <div className="flex flex-1 min-h-0">
      <FleetSidebar permissions={fleetPermissions} />
      <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
    </div>
  );
}
