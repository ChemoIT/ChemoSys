// FleetLayout — nested server layout for all /app/fleet/* pages.
// Sits INSIDE (app)/layout.tsx which provides AppHeader + auth shell.
//
// Responsibilities:
//   1. verifyAppUser() — cached auth guard (zero extra DB queries vs parent)
//   2. Permission guard — redirect to /app if user lacks app_fleet
//   3. Render FleetSidebar shell (wraps SidebarProvider + Sidebar + content area)
//
// Layout structure:
//   (app)/layout.tsx → AppHeader + <main>
//     FleetLayout → FleetSidebar (client shell wrapping sidebar + content)
//       page.tsx → fleet page content

import { redirect } from "next/navigation";
import { verifyAppUser, getAppNavPermissions } from "@/lib/dal";
import { FleetSidebar } from "@/components/app/fleet/FleetSidebar";

export default async function FleetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifyAppUser();
  const permissions = await getAppNavPermissions();

  if (!permissions.includes("app_fleet")) {
    redirect("/app");
  }

  const fleetPermissions = permissions.filter((k) =>
    k.startsWith("app_fleet_")
  );

  // FleetSidebar is the shell — SidebarProvider wraps both sidebar + content.
  // Content area padding (p-4 md:p-6) lives inside FleetSidebar's content div.
  return (
    <FleetSidebar permissions={fleetPermissions}>{children}</FleetSidebar>
  );
}
