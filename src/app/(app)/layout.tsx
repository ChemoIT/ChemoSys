// ChemoSys (app) route group layout — authenticated shell for all /app/* pages.
// Guards the entire (app) segment with verifyAppUser() — any unauthenticated,
// blocked, or permission-less user is redirected to /chemosys.
//
// Provides:
//   - Dark background (bg-sidebar-bg) consistent with ChemoSys branding
//   - AppHeader with logo, user display name, ModuleSwitcher, logout button
//   - Padded <main> area for page content
//
// RTL: inherited from root <html dir="rtl"> in layout.tsx — NOT duplicated here.
//
// Route group behavior: (app) is URL-transparent — pages at src/app/app/ are
// wrapped by this layout automatically. No need to move page.tsx files.

import { verifyAppUser, getAppNavPermissions } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app/AppHeader";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth guard — redirects to /chemosys if unauthenticated, blocked, or no app_* permissions.
  // React.cache() ensures this runs at most once per request even if nested components call it.
  const appUser = await verifyAppUser();

  // Read the user's permitted app_* module keys for ModuleSwitcher and nav filtering.
  // Delegates to the cached getPermissionsRpc — zero extra DB queries.
  const permissions = await getAppNavPermissions();

  // Resolve display name from the employees table via FK join.
  // Falls back to auth email if the user has no linked employee record.
  const supabase = await createClient();
  const { data: userRow } = await supabase
    .from("users")
    .select("employees(first_name, last_name)")
    .eq("auth_user_id", appUser.userId)
    .is("deleted_at", null)
    .maybeSingle();

  // Supabase FK join returns an object (not array) for a single FK relation,
  // but TypeScript types may infer it as an array. Safe cast avoids type errors.
  const emp = (
    userRow?.employees as unknown as {
      first_name: string;
      last_name: string;
    } | null
  );

  const displayName =
    emp?.first_name
      ? `${emp.first_name} ${emp.last_name}`
      : appUser.email;

  return (
    <div className="min-h-screen bg-sidebar-bg flex flex-col">
      <AppHeader displayName={displayName} permissions={permissions} />
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
