# Phase 6: DB + Auth Foundation - Research

**Researched:** 2026-03-04
**Domain:** Supabase SQL migrations, Next.js App Router auth guards, React.cache(), DAL patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### ניתוב Post-Login
- שתי כניסות נפרדות לחלוטין: `/login` (admin) ו-`/chemosys` (ChemoSys)
- כניסה מ-`/login` → תמיד `/admin/dashboard`
- כניסה מ-`/chemosys` → תמיד `/app`
- אין ניתוב דינמי לפי תפקיד — הדלת שנכנסת ממנה קובעת את היעד
- שרון (admin) נכנס דרך `/login` כשהוא עובד כ-admin, ודרך `/chemosys` כשהוא עובד כיוזר רגיל

#### מפתחות מודול (18 keys)
- רשימת 18 מפתחות מוגדרת ב-REQUIREMENTS.md (INFRA-01): `app_fleet`, `app_equipment` + 16 fleet sub-modules
- שמות ה-sub-modules לפי הרשימה בסעיף Future Requirements: `vehicles`, `drivers`, `mileage`, `fuel`, `tolls`, `violations`, `safety`, `maintenance`, `spare_parts`, `exceptions`, `ev_charging`, `rentals`, `invoices`, `expenses`, `camp_vehicles`, `reports`

#### סקילים ו-teams (הנחיות milestone)
- **frontend-design** — להפעלה בפאזות 7-10 (כל פאזה עם UI)
- **Agent teams** — לביצוע מקבילי בפאזות מורכבות
- **Next.js skills** — nextjs-app-router-patterns, nextjs-supabase-auth, shadcn-ui, tailwind — פעילים לאורך כל ה-milestone
- מטרה: מערכת מודרנית ברמה הגבוהה ביותר

### Claude's Discretion
- מבנה ה-SQL של migration 00016
- אופן מימוש ה-admin guard (server component vs middleware)
- מבנה פנימי של `verifyAppUser()` ו-`getAppNavPermissions()`
- אופן עטיפת `React.cache()` סביב `get_user_permissions`

### Deferred Ideas (OUT OF SCOPE)
- עיצוב ולוק מודרני למערכת — Phase 7+ (דף כניסה, shell, fleet home)
- דיון על Equipment sub-modules — TBD בנפרד (כפי שמופיע ב-REQUIREMENTS.md)
</user_constraints>

---

## Summary

Phase 6 is pure infrastructure — no UI, no user-facing pages. It establishes the DB and auth foundation that all ChemoSys app phases (7-10) depend on. The phase has six requirements across two plans: (1) DB migration + admin guard, and (2) auth routing + DAL extensions.

The codebase is already well-structured. The existing `dal.ts`, `proxy.ts`, and `auth.ts` are solid and close to what is needed. The changes required are surgical: one SQL migration, one guard addition to `(admin)/layout.tsx`, a two-line routing fix in `auth.ts`, two new functions in `dal.ts`, and a `React.cache()` refactor on the shared RPC call. No new packages are needed — everything is already installed.

The trickiest part is INFRA-02 (admin guard). The current `(admin)/layout.tsx` only calls `verifySession()` (checks session exists), but does NOT check `is_admin`. A non-admin ChemoSys user who happens to know the `/admin/employees` URL can currently access it if they have a valid session. This is the critical security gap to close.

**Primary recommendation:** Implement the two plans sequentially. Plan 06-01 (migration + admin guard) has no code dependencies on Plan 06-02 (auth routing + DAL). Either order is safe, but migration first is cleaner because the new `app_*` module keys must exist in the DB before `getAppNavPermissions()` can return them.

---

## Standard Stack

### Core (no new packages required)

| Library | Version in Project | Purpose | Notes |
|---------|-------------------|---------|-------|
| `react` | ^19.0.0 | `React.cache()` for deduplication | Built-in, no import needed beyond `import { cache } from 'react'` |
| `next` | ^16.1.6 | App Router, Server Components, `redirect()` | Already in use |
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client | Already in use |
| `@supabase/supabase-js` | ^2.98.0 | `getClaims()`, `getUser()`, RPC | Already in use |
| `server-only` | ^0.0.1 | Prevents DAL import in client components | Already used in `dal.ts` |

**No new packages to install.** All required tools are already in `package.json`.

---

## Architecture Patterns

### Recommended File Changes

```
src/
├── actions/
│   └── auth.ts                  ← MODIFY: two redirect targets (admin vs app)
├── app/
│   ├── (admin)/
│   │   └── layout.tsx           ← MODIFY: add is_admin guard
│   └── (auth)/                  ← no changes here
├── lib/
│   └── dal.ts                   ← MODIFY: add verifyAppUser(), getAppNavPermissions(),
│                                           refactor RPC into React.cache() helper
└── proxy.ts                     ← MODIFY: add /app/* → /chemosys redirect

supabase/migrations/
└── 00016_app_modules.sql        ← CREATE: 18 app_* module keys
```

---

### Pattern 1: Migration 00016 — Idempotent INSERT

**What:** Add 18 `app_*` keys to the `modules` table using the same pattern as `00003_seed_modules.sql`.

**Key constraints from DB schema:**
- `modules` table has: `id`, `key` (UNIQUE), `name_he`, `parent_key`, `sort_order`, `icon`, `created_at`
- No soft delete — modules are system-managed
- `ON CONFLICT (key) DO NOTHING` makes it safe to re-run

**The 18 keys (locked by CONTEXT.md decisions):**

| key | name_he | parent_key | sort_order | icon |
|-----|---------|------------|------------|------|
| `app_fleet` | צי רכב | NULL | 0 | `Truck` |
| `app_equipment` | צמ"ה | NULL | 1 | `HardHat` |
| `app_fleet_vehicles` | רכבים | `app_fleet` | 0 | `Car` |
| `app_fleet_drivers` | נהגים | `app_fleet` | 1 | `UserCheck` |
| `app_fleet_mileage` | קילומטראז' | `app_fleet` | 2 | `Gauge` |
| `app_fleet_fuel` | דלק | `app_fleet` | 3 | `Fuel` |
| `app_fleet_tolls` | כבישי אגרה | `app_fleet` | 4 | `SquareActivity` |
| `app_fleet_violations` | דוחות | `app_fleet` | 5 | `FileWarning` |
| `app_fleet_safety` | בטיחות | `app_fleet` | 6 | `ShieldCheck` |
| `app_fleet_maintenance` | טיפולים | `app_fleet` | 7 | `Wrench` |
| `app_fleet_spare_parts` | חלקי חילוף | `app_fleet` | 8 | `Settings2` |
| `app_fleet_exceptions` | חריגים | `app_fleet` | 9 | `AlertTriangle` |
| `app_fleet_ev_charging` | טעינה חשמלית | `app_fleet` | 10 | `Zap` |
| `app_fleet_rentals` | רכבי שכירות | `app_fleet` | 11 | `KeyRound` |
| `app_fleet_invoices` | חשבוניות | `app_fleet` | 12 | `Receipt` |
| `app_fleet_expenses` | הוצאות | `app_fleet` | 13 | `Wallet` |
| `app_fleet_camp_vehicles` | רכבי מחנה | `app_fleet` | 14 | `Tent` |
| `app_fleet_reports` | דוחות | `app_fleet` | 15 | `BarChart2` |

**Example SQL (from existing 00003 pattern):**
```sql
-- Migration: 00016_app_modules.sql
-- Purpose: Seed 18 app_* module keys for ChemoSys v2.0
-- Idempotent: ON CONFLICT DO NOTHING

INSERT INTO modules (key, name_he, parent_key, sort_order, icon)
VALUES
  ('app_fleet',               'צי רכב',         NULL,        0,  'Truck'),
  ('app_equipment',           'צמ"ה',            NULL,        1,  'HardHat'),
  ('app_fleet_vehicles',      'רכבים',           'app_fleet', 0,  'Car'),
  ('app_fleet_drivers',       'נהגים',           'app_fleet', 1,  'UserCheck'),
  ('app_fleet_mileage',       'קילומטראז''',     'app_fleet', 2,  'Gauge'),
  ('app_fleet_fuel',          'דלק',             'app_fleet', 3,  'Fuel'),
  ('app_fleet_tolls',         'כבישי אגרה',      'app_fleet', 4,  'SquareActivity'),
  ('app_fleet_violations',    'דוחות תנועה',     'app_fleet', 5,  'FileWarning'),
  ('app_fleet_safety',        'בטיחות',          'app_fleet', 6,  'ShieldCheck'),
  ('app_fleet_maintenance',   'טיפולים',         'app_fleet', 7,  'Wrench'),
  ('app_fleet_spare_parts',   'חלקי חילוף',      'app_fleet', 8,  'Settings2'),
  ('app_fleet_exceptions',    'חריגים',          'app_fleet', 9,  'AlertTriangle'),
  ('app_fleet_ev_charging',   'טעינה חשמלית',    'app_fleet', 10, 'Zap'),
  ('app_fleet_rentals',       'רכבי שכירות',     'app_fleet', 11, 'KeyRound'),
  ('app_fleet_invoices',      'חשבוניות',        'app_fleet', 12, 'Receipt'),
  ('app_fleet_expenses',      'הוצאות',          'app_fleet', 13, 'Wallet'),
  ('app_fleet_camp_vehicles', 'רכבי מחנה',       'app_fleet', 14, 'Tent'),
  ('app_fleet_reports',       'דוחות',           'app_fleet', 15, 'BarChart2')
ON CONFLICT (key) DO NOTHING;
```

---

### Pattern 2: INFRA-02 — Admin Guard in `(admin)/layout.tsx`

**What:** Add `is_admin` check to `(admin)/layout.tsx` to block non-admin users from accessing `/admin/*`.

**Current state:** `(admin)/layout.tsx` calls `verifySession()` which only checks that a Supabase JWT exists. A non-admin user with a valid session (e.g., a field worker who logs in via `/chemosys`) can access `/admin/employees` if they know the URL.

**The gap:** `verifySession()` returns `{ userId, email }` — it does NOT check `is_admin`. The `is_admin` flag lives in the `public.users` table (added in migration 00012).

**Implementation approach (Claude's Discretion): Server Component check in layout.tsx**

This is the correct approach for this project. Reasons:
- `proxy.ts` runs on the Edge Runtime. The Edge Runtime cannot make table queries reliably (noted in migration `00012` comment: `"Used in AdminLayout (NOT in proxy.ts — Edge Runtime unreliable for table queries)"`).
- `(admin)/layout.tsx` is a Server Component — it can use the Supabase server client directly.
- The existing `is_current_user_blocked()` RPC (from 00012) shows the established pattern: admin checks happen in layout, not middleware.

```typescript
// (admin)/layout.tsx — add after verifySession()
const supabase = await createClient()
const { data: userRow } = await supabase
  .from('users')
  .select('is_admin')
  .eq('auth_user_id', session.userId)
  .is('deleted_at', null)
  .maybeSingle()

// No public.users row = bootstrap admin (Sharon before first user setup) → allow
// is_admin = false = non-admin user → redirect to /chemosys login
if (userRow !== null && !userRow.is_admin) {
  redirect('/chemosys')
}
```

**Why `maybeSingle()` with null check:** The project pattern (established in `dal.ts` `getNavPermissions()`) treats "no public.users row" as the bootstrap admin — Sharon's Supabase auth user before the `public.users` row was created. This must remain accessible.

---

### Pattern 3: INFRA-03 — proxy.ts Extension for `/app/*`

**What:** `proxy.ts` currently redirects all unauthenticated requests to `/login`. It needs to also redirect unauthenticated requests on `/app/*` to `/chemosys` instead of `/login`.

**Current proxy.ts redirect logic:**
```typescript
if (
  !user &&
  !request.nextUrl.pathname.startsWith('/login') &&
  !request.nextUrl.pathname.startsWith('/auth')
) {
  url.pathname = '/login'
  return NextResponse.redirect(url)
}
```

**Required change:** Split the redirect destination based on the requested path:
```typescript
if (!user) {
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
  const isAppPath = request.nextUrl.pathname.startsWith('/app')
  const isLoginPath = request.nextUrl.pathname.startsWith('/login')
  const isChemosysPath = request.nextUrl.pathname.startsWith('/chemosys')
  const isAuthPath = request.nextUrl.pathname.startsWith('/auth')

  if (!isLoginPath && !isChemosysPath && !isAuthPath) {
    const url = request.nextUrl.clone()
    url.pathname = isAppPath ? '/chemosys' : '/login'
    return NextResponse.redirect(url)
  }
}
```

**Important:** The `/chemosys` login page itself must NOT be protected (authenticated users landing on `/chemosys` should see the login page, same as `/login` for admin). The proxy must allow `/chemosys` through regardless of auth state.

---

### Pattern 4: INFRA-04 — `verifyAppUser()` in `dal.ts`

**What:** A new exported function that verifies: (a) user has a valid session, (b) the user has a `public.users` row with `is_blocked = false`, (c) the user has at least one `app_*` permission with level >= 1.

**Implementation approach (Claude's Discretion):**

```typescript
export type AppUser = {
  userId: string
  email: string
}

/**
 * verifyAppUser — verifies the user is a valid, unblocked ChemoSys app user.
 * Checks: valid session, active public.users row (not blocked), at least one app_* permission.
 * If any check fails: redirects to /chemosys (throws — does not return).
 * Wrapped in React.cache() for deduplication across the (app) layout tree.
 */
export const verifyAppUser = cache(async (): Promise<AppUser> => {
  const session = await verifySession() // throws → /login if no JWT
  const supabase = await createClient()

  const { data: userRow } = await supabase
    .from('users')
    .select('is_blocked')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!userRow || userRow.is_blocked) {
    redirect('/chemosys')
  }

  // Check at least one app_* permission
  const appPerms = await getAppPermissionsRpc(session.userId, supabase)
  const hasAnyAppAccess = appPerms.some((p) => p.level >= 1)

  if (!hasAnyAppAccess) {
    redirect('/chemosys')
  }

  return { userId: session.userId, email: session.email }
})
```

**Note on `verifySession()` redirect target:** `verifySession()` currently redirects to `/login`. For app users, if session is expired, redirecting to `/login` is acceptable (both login pages share the same Supabase session). The `/chemosys` login page will be a separate Server Action in Phase 7 that sets a different post-login redirect, so this is fine.

---

### Pattern 5: INFRA-05 + INFRA-06 — `getAppNavPermissions()` and `React.cache()` refactor

**What:** Two related changes that should be done together.

**The current problem:**
- `requirePermission()`, `getNavPermissions()`, and `checkPagePermission()` each call `supabase.rpc('get_user_permissions', ...)` independently.
- There is no `React.cache()` on the RPC call itself — only `verifySession()` is cached.
- In the `(app)` layout tree, `verifyAppUser()` + `getAppNavPermissions()` would both call the RPC separately for the same user in the same render.

**Solution — extract a cached RPC helper (Claude's Discretion):**

```typescript
// Internal cached RPC helper — not exported
// This is the single cached RPC call. All DAL functions that need permissions
// call this instead of calling supabase.rpc() directly.
const getPermissionsRpc = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_user_permissions', {
    p_user_id: userId,
  })
  if (error) throw new Error('שגיאת הרשאות — לא ניתן לבדוק גישה')
  return (data ?? []) as Array<{ module_key: string; level: number }>
})
```

**`getAppNavPermissions()` implementation:**
```typescript
/**
 * getAppNavPermissions — returns app_* module keys the user has READ access to.
 * Filters get_user_permissions RPC results to only app_* prefix keys.
 * Used by (app)/layout.tsx → AppSidebar/AppNav to filter visible modules.
 */
export async function getAppNavPermissions(): Promise<string[]> {
  const session = await verifySession()
  const perms = await getPermissionsRpc(session.userId)
  return perms
    .filter((p) => p.module_key.startsWith('app_') && p.level >= 1)
    .map((p) => p.module_key)
}
```

**Refactor existing functions to use the shared cache:**
- `requirePermission()` → replace `supabase.rpc(...)` with `await getPermissionsRpc(session.userId)`
- `getNavPermissions()` → replace its `supabase.rpc(...)` with `await getPermissionsRpc(session.userId)`
- `checkPagePermission()` → replace its `supabase.rpc(...)` with `await getPermissionsRpc(session.userId)`

**Why `cache()` works here:** `React.cache()` deduplicates within a single React render tree (one HTTP request). Two server components calling `getPermissionsRpc(sameUserId)` in the same request will only hit the DB once. The cache is per-request — no cross-request leakage.

**Important caveat:** `getPermissionsRpc` takes `userId` as a parameter. `React.cache()` uses arguments as the cache key, so different `userId` values produce different cache entries. This is correct behavior.

---

### Pattern 6: `auth.ts` Post-Login Routing Fix

**What:** `auth.ts` `login()` currently redirects to `/admin/companies` on success. Decision says admin login → `/admin/dashboard`. A future ChemoSys `loginApp()` action (Phase 7) will redirect to `/app`.

**Current code (line 92 in auth.ts):**
```typescript
redirect("/admin/companies");
```

**Required change:**
```typescript
redirect("/admin/dashboard");
```

**Phase 7 context:** The `/chemosys` login page (Phase 7) will have its OWN Server Action (e.g., `loginApp()` in `auth.ts` or a separate `auth-app.ts`). That action will `redirect("/app")`. This Phase 6 task is only about fixing the existing admin login redirect — from `/admin/companies` to `/admin/dashboard`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request-scoped caching | Custom singleton/Map per request | `React.cache()` from `react` | React.cache() is the canonical Next.js 15/16 pattern for per-request deduplication in Server Components |
| Admin session check | Edge middleware DB query | Server Component layout check | Edge Runtime has no reliable Node.js DB access (documented in 00012 migration comments) |
| ChemoSys-specific Supabase client | New client factory | Reuse existing `createClient()` from `@/lib/supabase/server` | Same Supabase project, same cookies — no separate client needed |
| Manual permission cache key | Custom hash/serialization | Pass `userId` directly to `cache()` function | React.cache() uses `Object.is` comparison on arguments |

---

## Common Pitfalls

### Pitfall 1: `verifySession()` redirects to `/login`, not `/chemosys`
**What goes wrong:** `verifyAppUser()` calls `verifySession()` first. If an app user's session expires, they get redirected to `/login` (the admin login), not `/chemosys`.
**Why it happens:** `verifySession()` has `redirect("/login")` hardcoded.
**How to avoid:** This is acceptable for Phase 6 — both login pages share the same Supabase session. The Phase 7 `/chemosys` page will have a "go to ChemoSys login" link. Do not modify `verifySession()` to support dual redirects — keep it simple.
**Warning signs:** If a ChemoSys user is confused by landing on the admin login — address in Phase 7 UX.

### Pitfall 2: `React.cache()` does NOT persist across requests
**What goes wrong:** Assuming `getPermissionsRpc` will cache across multiple HTTP requests (like a global cache or Redis).
**Why it happens:** The name "cache" implies persistence.
**How to avoid:** `React.cache()` is per-render-tree (per HTTP request) only. A new request always makes a fresh DB call. This is correct and intentional — permissions can change between requests.
**Warning signs:** If you see stale permissions — they won't occur because of cache, only because of a DB issue.

### Pitfall 3: Admin guard `maybeSingle()` vs `single()`
**What goes wrong:** Using `.single()` instead of `.maybeSingle()` in the admin guard throws if no row is found (e.g., bootstrap admin with no public.users row).
**Why it happens:** `.single()` throws on 0 rows, `.maybeSingle()` returns null.
**How to avoid:** Always use `.maybeSingle()` when checking for the bootstrap admin pattern. The existing `dal.ts` consistently uses this pattern — follow it.

### Pitfall 4: Migration column name mismatch
**What goes wrong:** Inserting `app_fleet_spare_parts` but referring to it in code as `app_fleet_spare-parts` (dash vs underscore).
**Why it happens:** The REQUIREMENTS.md uses "spare_parts" but easy to mis-type.
**How to avoid:** All 18 keys use underscores only. Keys follow pattern `app_fleet_{submodule}` where submodule matches the REQUIREMENTS.md list verbatim.
**Warning signs:** TypeScript permission checks failing because key doesn't match DB.

### Pitfall 5: `proxy.ts` allowing `/chemosys` through
**What goes wrong:** Making `/chemosys` a protected route in proxy.ts (requiring auth to access the login page itself).
**Why it happens:** The proxy currently only excludes `/login` and `/auth` from the redirect guard.
**How to avoid:** Add `/chemosys` to the exclusion list in the proxy's unauthenticated-redirect logic, alongside `/login`. The `/chemosys` login page must be accessible without a session.

### Pitfall 6: `React.cache()` function must not be inlined
**What goes wrong:** Wrapping an anonymous inline arrow function: `const fn = cache(() => ...)` inside another function body — the cache becomes a new function reference on every call.
**Why it happens:** Module-level cache vs function-level cache.
**How to avoid:** All `cache()`-wrapped functions must be declared at MODULE level (top-level exports or top-level constants in the file). The existing `verifySession = cache(async () => ...)` at the top of `dal.ts` is the correct pattern.

---

## Code Examples

### Complete migration 00016 structure

```sql
-- =============================================================================
-- Migration: 00016_app_modules.sql
-- Phase:     06 — DB + Auth Foundation
-- Purpose:   Seed 18 app_* module keys for ChemoSys v2.0 (INFRA-01).
--            app_fleet + app_equipment (top-level) + 16 fleet sub-modules.
--
-- Idempotent: ON CONFLICT (key) DO NOTHING — safe to re-run.
-- No soft delete on modules — system table.
-- =============================================================================

INSERT INTO modules (key, name_he, parent_key, sort_order, icon)
VALUES
  -- Top-level modules
  ('app_fleet',               'צי רכב',         NULL,        0,  'Truck'),
  ('app_equipment',           'צמ"ה',            NULL,        1,  'HardHat'),
  -- Fleet sub-modules
  ('app_fleet_vehicles',      'רכבים',           'app_fleet', 0,  'Car'),
  ('app_fleet_drivers',       'נהגים',           'app_fleet', 1,  'UserCheck'),
  ('app_fleet_mileage',       'קילומטראז''',     'app_fleet', 2,  'Gauge'),
  ('app_fleet_fuel',          'דלק',             'app_fleet', 3,  'Fuel'),
  ('app_fleet_tolls',         'כבישי אגרה',      'app_fleet', 4,  'SquareActivity'),
  ('app_fleet_violations',    'דוחות תנועה',     'app_fleet', 5,  'FileWarning'),
  ('app_fleet_safety',        'בטיחות',          'app_fleet', 6,  'ShieldCheck'),
  ('app_fleet_maintenance',   'טיפולים',         'app_fleet', 7,  'Wrench'),
  ('app_fleet_spare_parts',   'חלקי חילוף',      'app_fleet', 8,  'Settings2'),
  ('app_fleet_exceptions',    'חריגים',          'app_fleet', 9,  'AlertTriangle'),
  ('app_fleet_ev_charging',   'טעינה חשמלית',    'app_fleet', 10, 'Zap'),
  ('app_fleet_rentals',       'רכבי שכירות',     'app_fleet', 11, 'KeyRound'),
  ('app_fleet_invoices',      'חשבוניות',        'app_fleet', 12, 'Receipt'),
  ('app_fleet_expenses',      'הוצאות',          'app_fleet', 13, 'Wallet'),
  ('app_fleet_camp_vehicles', 'רכבי מחנה',       'app_fleet', 14, 'Tent'),
  ('app_fleet_reports',       'דוחות',           'app_fleet', 15, 'BarChart2')
ON CONFLICT (key) DO NOTHING;
```

### Full dal.ts structure after Phase 6

```typescript
import 'server-only'
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// --- Types ---
export type SessionUser = { userId: string; email: string }
export type AppUser = { userId: string; email: string }
export type PermissionLevel = 0 | 1 | 2

// ============================================================
// INTERNAL: cached RPC call — deduplicated per request
// Module-level constant = stable function reference for cache
// ============================================================
const getPermissionsRpc = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_user_permissions', {
    p_user_id: userId,
  })
  if (error) throw new Error('שגיאת הרשאות — לא ניתן לבדוק גישה')
  return (data ?? []) as Array<{ module_key: string; level: number }>
})

// ============================================================
// verifySession — shared by admin and app paths
// ============================================================
export const verifySession = cache(async (): Promise<SessionUser> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect("/login")
  const claims = data.claims
  return {
    userId: claims.sub as string,
    email: (claims.email as string) ?? "",
  }
})

// ============================================================
// ADMIN: requirePermission, getNavPermissions, checkPagePermission
// (refactored to use getPermissionsRpc)
// ============================================================
export async function requirePermission(
  moduleKey: string,
  minLevel: PermissionLevel
): Promise<void> {
  const session = await verifySession()
  const perms = await getPermissionsRpc(session.userId)
  const perm = perms.find((p) => p.module_key === moduleKey)
  const level = (perm?.level ?? 0) as PermissionLevel
  if (level < minLevel) {
    throw new Error(`אין הרשאה למודול ${moduleKey}`)
  }
}

export async function getNavPermissions(): Promise<string[]> {
  const session = await verifySession()
  const supabase = await createClient()
  const { data: userRow } = await supabase
    .from('users').select('id')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null).maybeSingle()
  if (!userRow) {
    return ['dashboard', 'companies', 'departments', 'role_tags', 'employees', 'users', 'templates', 'projects', 'settings']
  }
  const perms = await getPermissionsRpc(session.userId)
  const allowed = new Set<string>(['dashboard'])
  for (const p of perms) {
    if (p.level >= 1) allowed.add(p.module_key)
  }
  return Array.from(allowed)
}

export async function checkPagePermission(
  moduleKey: string,
  minLevel: PermissionLevel
): Promise<boolean> {
  const session = await verifySession()
  const supabase = await createClient()
  const { data: userRow } = await supabase
    .from('users').select('id')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null).maybeSingle()
  if (!userRow) return true
  const perms = await getPermissionsRpc(session.userId)
  const perm = perms.find((p) => p.module_key === moduleKey)
  return (perm?.level ?? 0) >= minLevel
}

// ============================================================
// APP (ChemoSys): verifyAppUser, getAppNavPermissions
// ============================================================
export const verifyAppUser = cache(async (): Promise<AppUser> => {
  const session = await verifySession()
  const supabase = await createClient()
  const { data: userRow } = await supabase
    .from('users').select('is_blocked')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null).maybeSingle()
  if (!userRow || userRow.is_blocked) redirect('/chemosys')
  const perms = await getPermissionsRpc(session.userId)
  const hasAnyAppAccess = perms.some((p) => p.module_key.startsWith('app_') && p.level >= 1)
  if (!hasAnyAppAccess) redirect('/chemosys')
  return { userId: session.userId, email: session.email }
})

export async function getAppNavPermissions(): Promise<string[]> {
  const session = await verifySession()
  const perms = await getPermissionsRpc(session.userId)
  return perms
    .filter((p) => p.module_key.startsWith('app_') && p.level >= 1)
    .map((p) => p.module_key)
}
```

### Admin layout guard addition

```typescript
// (admin)/layout.tsx — after const session = await verifySession()
const supabase = await createClient()
const { data: userRow } = await supabase
  .from('users')
  .select('is_admin')
  .eq('auth_user_id', session.userId)
  .is('deleted_at', null)
  .maybeSingle()

// userRow === null means no public.users row = bootstrap admin → allow access
// userRow.is_admin === false means regular user → redirect to app login
if (userRow !== null && !userRow.is_admin) {
  redirect('/chemosys')
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `getSession()` (returns unverified data) | `getClaims()` (verifies JWT locally) | Already implemented in `verifySession()` |
| `middleware.ts` | `proxy.ts` (same export, renamed file) | Already implemented — must continue using `proxy.ts` |
| Calling RPC per-function (current) | Single cached RPC via `getPermissionsRpc` | INFRA-06 fix — reduces DB calls from N to 1 per request |
| Redirect to `/admin/companies` on login | Redirect to `/admin/dashboard` (fix needed) | Small bug — login currently lands on wrong page |

**Deprecated in this project:**
- `middleware.ts` — the project uses `proxy.ts` (documented in MEMORY.md: "Next.js 16 proxy: middleware file is `src/proxy.ts`"). Never create `middleware.ts`.
- `supabase.auth.getSession()` — already replaced with `getClaims()` in `verifySession()`.
- `supabase.auth.getUser()` in server components — only used in `proxy.ts` for token refresh (correct and intentional).

---

## Open Questions

1. **`verifyAppUser()` — should it also check `is_admin` flag?**
   - What we know: admin users (`is_admin = true`) also have a `public.users` row. They could log into ChemoSys.
   - What's unclear: Should Sharon (is_admin) be able to log in via `/chemosys` and use the app as a regular user?
   - The CONTEXT.md says: "שרון נכנס דרך `/login` כשהוא עובד כ-admin, ודרך `/chemosys` כשהוא עובד כיוזר רגיל" — YES, Sharon should be able to use ChemoSys via `/chemosys`.
   - Recommendation: `verifyAppUser()` should NOT block `is_admin` users. Admin users can have `app_*` permissions too. No special case needed — the RPC returns all modules with level 2 for admins, so `hasAnyAppAccess` will be true.

2. **`get_user_permissions` RPC and `app_*` keys for admin**
   - What we know: The RPC returns ALL modules (including `app_*`) with level 2 for `is_admin` users (from migration 00012: `SELECT m.key, 2 FROM modules m WHERE EXISTS (admin check)`).
   - What this means: After migration 00016 adds the 18 `app_*` keys, Sharon's admin account will automatically have level 2 on all of them via the RPC. No manual permission rows needed.
   - Recommendation: Verify this assumption in Supabase SQL editor after migration 00016 runs.

3. **`(app)` route group — does it need to be created in Phase 6?**
   - What we know: Phase 6 requirements (INFRA-01 through INFRA-06) do not include any UI pages. The `(app)` route group layout is Phase 8 (SHELL-01).
   - What's unclear: `verifyAppUser()` in dal.ts is tested how if there's no `(app)/layout.tsx` yet?
   - Recommendation: Phase 6 only creates the DAL functions. The `(app)` layout that CALLS them is Phase 8. The functions can exist in `dal.ts` without being called. No `(app)` directory needed in Phase 6.

---

## Existing Code State (Critical Context for Planner)

This section documents what already exists so plans don't re-implement it.

### `src/lib/dal.ts` — Current State
- `verifySession()` — EXISTS, wrapped in `React.cache()`, redirects to `/login`
- `requirePermission()` — EXISTS, calls `supabase.rpc()` directly (not cached)
- `getNavPermissions()` — EXISTS, calls `supabase.rpc()` directly (not cached)
- `checkPagePermission()` — EXISTS, calls `supabase.rpc()` directly (not cached)
- `verifyAppUser()` — MISSING (INFRA-04)
- `getAppNavPermissions()` — MISSING (INFRA-05)
- Shared `getPermissionsRpc` cache — MISSING (INFRA-06)

### `src/proxy.ts` — Current State
- Token refresh via `getUser()` — EXISTS, correct
- Redirect all unauthenticated to `/login` — EXISTS but needs extension for `/app/*` → `/chemosys`
- `/chemosys` exclusion from guard — MISSING (INFRA-03)

### `src/actions/auth.ts` — Current State
- `login()` — EXISTS, redirects to `/admin/companies` — needs fix to `/admin/dashboard`
- `logout()` — EXISTS, correct
- `loginApp()` — MISSING — will be created in Phase 7, NOT Phase 6

### `src/app/(admin)/layout.tsx` — Current State
- `verifySession()` call — EXISTS
- `is_admin` guard — MISSING (INFRA-02)

### `supabase/migrations/` — Current State
- 00001–00015 — ALL EXIST AND HAVE BEEN RUN IN SUPABASE
- 00016 — MISSING (INFRA-01) — needs to be created and run manually

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis — `src/lib/dal.ts`, `src/proxy.ts`, `src/actions/auth.ts`, `src/app/(admin)/layout.tsx` — direct code inspection
- `supabase/migrations/00001_foundation_schema.sql` — modules table schema confirmed
- `supabase/migrations/00003_seed_modules.sql` — INSERT pattern confirmed
- `supabase/migrations/00012_access_control.sql` — `is_admin`, `get_user_permissions` RPC, Edge Runtime note confirmed
- `package.json` — Next.js 16, React 19, @supabase/ssr 0.8.0 versions confirmed
- `.planning/REQUIREMENTS.md` — 18 module keys list confirmed
- `.planning/phases/06-db-auth-foundation/06-CONTEXT.md` — locked decisions confirmed

### Secondary (MEDIUM confidence)
- React.cache() deduplication behavior — well-established Next.js App Router pattern, consistent with existing `verifySession()` implementation in this codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all existing
- Architecture: HIGH — derived from direct codebase inspection, existing patterns
- Pitfalls: HIGH — most derived from existing migration comments and code comments in this project
- SQL migration content: HIGH — 18 keys are locked decisions, schema is confirmed

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable infrastructure, low churn)
