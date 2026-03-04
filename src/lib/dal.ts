import 'server-only'

// Data Access Layer — session verification and permission enforcement.
// verifySession() is the single source of truth for "is the user logged in?"
// requirePermission() guards every mutation Server Action.
// getNavPermissions() drives sidebar nav filtering.
// checkPagePermission() drives page-level access denied rendering.
// verifyAppUser() guards ChemoSys (app) pages and layouts.
// getAppNavPermissions() drives ChemoSys top-header module switching.
// Wrapped in React cache() to deduplicate multiple calls in one render tree.

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  userId: string;
  email: string;
};

// ============================================================
// INTERNAL: cached RPC call — deduplicated per HTTP request.
// All DAL functions that need permissions call this instead of
// calling supabase.rpc() directly. Module-level constant ensures
// a stable function reference for React.cache().
// ============================================================
const getPermissionsRpc = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_user_permissions', {
    p_user_id: userId,
  })
  if (error) throw new Error('שגיאת הרשאות — לא ניתן לבדוק גישה')
  return (data ?? []) as Array<{ module_key: string; level: number }>
})

/**
 * verifySession — fast local JWT verification using getClaims().
 * Does NOT hit the network (no token refresh, no remote lookup).
 * Call this at the top of any admin page or layout.
 *
 * If unauthenticated: redirects to /login (throws — does not return).
 * If authenticated: returns { userId, email }.
 *
 * Wrapped in React cache() so it runs at most once per request
 * even if called from multiple nested layouts/components.
 */
export const verifySession = cache(async (): Promise<SessionUser> => {
  const supabase = await createClient();

  // getClaims() verifies the JWT locally — fast path, no network call.
  // Do NOT use getSession() — it returns unverified local data.
  // Do NOT use getUser() here — it makes a network request on every call.
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const claims = data.claims;

  return {
    userId: claims.sub as string,
    email: (claims.email as string) ?? "",
  };
});

export type PermissionLevel = 0 | 1 | 2 // 0=none, 1=read, 2=read+write

/**
 * requirePermission — server-side guard for mutation Server Actions.
 * Checks the current user has at least `minLevel` on `moduleKey`.
 * Throws an Error (caught by Server Action error boundary) if insufficient.
 *
 * Uses get_user_permissions() SECURITY DEFINER RPC — no RLS recursion.
 * Admin users (is_admin) get all modules with level 2 from the RPC.
 *
 * Call AFTER verifySession() in every mutation Server Action.
 */
export async function requirePermission(
  moduleKey: string,
  minLevel: PermissionLevel
): Promise<void> {
  const session = await verifySession() // throws if unauthenticated

  const perms = await getPermissionsRpc(session.userId)

  const perm = perms.find((p) => p.module_key === moduleKey)
  const level = (perm?.level ?? 0) as PermissionLevel

  if (level < minLevel) {
    throw new Error(`אין הרשאה למודול ${moduleKey}`)
  }
}

/**
 * getNavPermissions — returns the list of module_keys the user has READ access to.
 * Used by AdminLayout → Sidebar → SidebarNav to filter which nav items to render.
 *
 * Returns ALL module keys if:
 * - User has no public.users row (bootstrap admin — first admin before user creation)
 * - User is is_admin (get_user_permissions returns all modules with level 2)
 *
 * Returns empty array (plus 'dashboard') if user has a public.users row but no permissions.
 */
export async function getNavPermissions(): Promise<string[]> {
  const session = await verifySession()
  const supabase = await createClient()

  // Check if user has a public.users row
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null)
    .maybeSingle()

  // No public.users row = bootstrap admin → show all nav items
  if (!userRow) {
    return ['dashboard', 'companies', 'departments', 'role_tags', 'employees', 'users', 'templates', 'projects', 'settings']
  }

  const perms = await getPermissionsRpc(session.userId)

  // Always include dashboard
  const allowed = new Set<string>(['dashboard'])

  for (const p of perms) {
    if (p.level >= 1) {
      allowed.add(p.module_key)
    }
  }

  return Array.from(allowed)
}

/**
 * checkPagePermission — checks if the current user has at least `minLevel` on `moduleKey`.
 * Returns boolean (does NOT throw). Used in page Server Components to conditionally render
 * AccessDenied instead of the page content.
 *
 * Returns true if user has no public.users row (bootstrap admin).
 */
export async function checkPagePermission(
  moduleKey: string,
  minLevel: PermissionLevel
): Promise<boolean> {
  const session = await verifySession()
  const supabase = await createClient()

  // Check if user has a public.users row
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null)
    .maybeSingle()

  // No public.users row = bootstrap admin → allow everything
  if (!userRow) return true

  const perms = await getPermissionsRpc(session.userId)

  const perm = perms.find((p) => p.module_key === moduleKey)
  return (perm?.level ?? 0) >= minLevel
}

// ============================================================
// APP (ChemoSys): verifyAppUser, getAppNavPermissions
// Used by (app)/layout.tsx and ChemoSys pages (Phase 8+).
// ============================================================

export type AppUser = {
  userId: string
  email: string
}

/**
 * verifyAppUser — verifies the user is a valid, unblocked ChemoSys app user.
 * Checks: valid session, active public.users row (not blocked, not deleted),
 * at least one app_* permission with level >= 1.
 *
 * If any check fails: redirects to /chemosys (throws — does not return).
 *
 * Wrapped in React.cache() for deduplication: (app)/layout.tsx and nested
 * server components can call this multiple times — only one DB query.
 */
export const verifyAppUser = cache(async (): Promise<AppUser> => {
  const session = await verifySession() // throws → /login if no JWT
  const supabase = await createClient()

  // Check user exists and is not blocked
  const { data: userRow } = await supabase
    .from('users')
    .select('is_blocked')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null)
    .maybeSingle()

  // No public.users row = not a registered app user → redirect
  // is_blocked = true → blocked user → redirect
  if (!userRow || userRow.is_blocked) {
    redirect('/chemosys')
  }

  // Check at least one app_* permission
  const perms = await getPermissionsRpc(session.userId)
  const hasAnyAppAccess = perms.some(
    (p) => p.module_key.startsWith('app_') && p.level >= 1
  )

  if (!hasAnyAppAccess) {
    redirect('/chemosys')
  }

  return { userId: session.userId, email: session.email }
})

/**
 * getAppNavPermissions — returns app_* module keys the user has READ access to.
 * Filters get_user_permissions RPC results to only app_* prefix keys with level >= 1.
 *
 * Used by (app)/layout.tsx → AppHeader → ModuleSwitcher to filter visible modules.
 * Returns array of strings like ['app_fleet', 'app_fleet_vehicles', 'app_fleet_drivers', ...].
 */
export async function getAppNavPermissions(): Promise<string[]> {
  const session = await verifySession()
  const perms = await getPermissionsRpc(session.userId)
  return perms
    .filter((p) => p.module_key.startsWith('app_') && p.level >= 1)
    .map((p) => p.module_key)
}
