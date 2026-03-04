# Domain Pitfalls — ChemoSys v2.0 Employee App Shell

**Domain:** Adding employee-facing (app) route group to existing Next.js 16 + Supabase admin panel
**Researched:** 2026-03-04
**Confidence:** HIGH — based on direct code inspection of the existing system (proxy.ts, dal.ts, migrations, layouts, auth.ts) plus established Next.js App Router and Supabase patterns

---

## Context: What Already Exists

Before reading these pitfalls, understand the current system state:

| What | Current State |
|------|--------------|
| Route groups | `(admin)` — Sharon-only, `(auth)` — public login page |
| Auth proxy | `src/proxy.ts` — single redirect target: `/login` |
| Session guard | `verifySession()` — local JWT claim check, cached per request |
| Permission stack | `requirePermission()`, `checkPagePermission()`, `getNavPermissions()` — all implemented in `dal.ts`, **never wired to a production page yet** |
| Modules table | 9 admin keys seeded (`dashboard`, `companies`, `departments`, etc.) — no ChemoSys module keys exist |
| Login flow | Single `/login` page → redirects to `/admin/companies` on success |
| RLS | `get_user_permissions()` SECURITY DEFINER RPC exists and handles `is_admin` correctly |

Adding `(app)` means these untested pieces get used for the first time in production. That is where most pitfalls live.

---

## Critical Pitfalls

---

### Pitfall 1: proxy.ts Redirect Loop — (app) Routes Send Everyone to /login

**What goes wrong:**
The current `proxy.ts` redirects ALL unauthenticated users to `/login`. The `(app)` group will use its own login page at `/app/login`. If an employee visits `/app/dashboard` without a session, proxy.ts sends them to `/login` (the admin login) instead of `/app/login`. The employee is confused, tries to log in, and is redirected to `/admin/companies` — a page they have no business seeing.

**Why it happens:**
`proxy.ts` has a single hardcoded redirect target:
```typescript
// CURRENT CODE — only knows about one login page
if (!user && !request.nextUrl.pathname.startsWith('/login') && ...) {
  url.pathname = '/login'          // <-- always sends to admin login
  return NextResponse.redirect(url)
}
```
There is no path-aware branching. It was written when there was only one login.

**How to avoid:**
Extend the proxy with path-aware redirect logic before adding any `(app)` routes:
```typescript
// Determine which login page to redirect to based on the request path
const isAppRoute = request.nextUrl.pathname.startsWith('/app')

if (!user) {
  const loginPath = isAppRoute ? '/app/login' : '/login'
  // Exclude both login pages from redirect
  if (
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/app/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    url.pathname = loginPath
    return NextResponse.redirect(url)
  }
}
```
Also update the matcher to exclude `/app/login` from redirect.

**Warning signs:**
- Employee visits `/app/dashboard`, lands on admin login page
- After logging in as employee, redirected to `/admin/companies`
- Infinite redirect loop if `/app/login` is not excluded from the redirect check

**Phase to address:** Phase 1 of v2.0 (Shell setup) — FIRST thing before any (app) route is created.

---

### Pitfall 2: login Server Action Hardcodes Redirect to /admin/companies

**What goes wrong:**
The existing `login()` Server Action (in `src/actions/auth.ts`) always redirects to `/admin/companies` on success:
```typescript
redirect("/admin/companies");  // <-- hardcoded, line 92
```
If an employee uses the admin `/login` page (which can happen accidentally), or if a shared login is ever considered, they land on an admin page they cannot access. The admin login page is visually the same — no indication it is admin-only.

**Why it happens:**
When there was one user type, one redirect target made sense. v2.0 introduces a second user type with a different post-login destination.

**How to avoid:**
Two separate Server Actions: `loginAdmin()` (existing) and `loginEmployee()` (new). Each has its own redirect target hardcoded:
```typescript
// actions/auth-app.ts
export async function loginEmployee(...): Promise<LoginState> {
  // ... same Supabase signInWithPassword ...
  // After success: check that this user has a public.users row
  // If they do NOT (i.e., they are Sharon/bootstrap admin), reject with error
  redirect("/app/dashboard")
}
```
Never share one login action between admin and employee paths.

**Warning signs:**
- Employee successfully logs in but sees admin interface
- Admin accidentally uses employee login and ends up at /app/dashboard

**Phase to address:** Phase 1 of v2.0 — create `loginEmployee` action immediately when creating the employee login page.

---

### Pitfall 3: getNavPermissions() Returns Admin Module Keys to (app) Layout

**What goes wrong:**
`getNavPermissions()` in `dal.ts` has a hardcoded fallback:
```typescript
// CURRENT CODE — line 107
if (!userRow) {
  return ['dashboard', 'companies', 'departments', 'role_tags', 'employees', 'users', 'templates', 'projects', 'settings']
}
```
This fallback exists to support Sharon (no public.users row = bootstrap admin). If the `(app)` layout calls `getNavPermissions()` and the user happens to be Sharon (testing the employee app), they get admin module keys — which are meaningless in the employee nav context. Worse, if `getNavPermissions()` is used as-is in the `(app)` layout without filtering for ChemoSys-only module keys, admin module keys like `companies` and `employees` could appear in the employee sidebar.

**Why it happens:**
`getNavPermissions()` was designed for the admin sidebar. It returns raw module keys from the DB without context about which group (admin vs app) those keys belong to.

**How to avoid:**
Create a separate `getAppNavPermissions()` function that:
1. Filters the returned module keys to only include ChemoSys module keys (e.g., `fleet`, `equipment`, `reports`)
2. Has its own fallback (admin users testing the app should see all ChemoSys modules, not admin modules)

```typescript
// The ChemoSys module keys — defined as a constant shared with the seeder
const CHEMO_APP_MODULE_KEYS = ['fleet', 'equipment', 'my_assignments', 'reports']

export async function getAppNavPermissions(): Promise<string[]> {
  const session = await verifySession()
  const supabase = await createClient()
  const { data: perms } = await supabase.rpc('get_user_permissions', { p_user_id: session.userId })

  const allowed = new Set<string>()
  for (const p of (perms ?? [])) {
    if (p.level >= 1 && CHEMO_APP_MODULE_KEYS.includes(p.module_key)) {
      allowed.add(p.module_key)
    }
  }
  return Array.from(allowed)
}
```

**Warning signs:**
- Employee sidebar shows "ניהול חברות" or "ניהול עובדים" (admin modules)
- Sharon sees zero nav items when testing the employee app (because admin modules are filtered out but no app modules are seeded yet)

**Phase to address:** Phase 1 of v2.0, as part of the (app) layout creation.

---

### Pitfall 4: Module Keys Not Seeded — requirePermission() Silently Grants or Denies Access

**What goes wrong:**
`requirePermission('fleet', 1)` is called in an employee Server Action. The `modules` table has no row with `key = 'fleet'`. The `get_user_permissions()` RPC returns no row for `fleet`. The `perm?.level` is `undefined`, which coerces to `0`. The check `0 >= 1` fails → the Server Action throws "אין הרשאה למודול fleet" for every user including admin users. Everything appears broken from day one.

**Why it happens:**
The `modules` table is the canonical list of valid module keys. `user_permissions.module_key` has no FK constraint to `modules.key` — it is plain TEXT. So keys can be used in permission grants that do not exist in the `modules` table, and keys can be checked in `requirePermission()` that are not yet seeded. The result is unpredictable.

**How to avoid:**
Before writing a single ChemoSys page or Server Action, run a migration that seeds all ChemoSys module keys:
```sql
-- 00016_seed_chemosys_modules.sql
INSERT INTO modules (key, name_he, parent_key, sort_order, icon)
VALUES
  ('fleet',           'צי רכבים',         NULL, 10, 'Truck'),
  ('equipment',       'ציוד',              NULL, 11, 'Wrench'),
  ('my_assignments',  'המשימות שלי',        NULL, 12, 'ClipboardList'),
  ('reports',         'דוחות',             NULL, 13, 'FileBarChart')
ON CONFLICT (key) DO NOTHING;
```
This migration MUST run before any employee user is granted permissions.

**Warning signs:**
- `requirePermission('fleet', 1)` throws for all users
- Admin user (is_admin = true) is also blocked because `get_user_permissions()` returns ALL modules but only those in the `modules` table (admin shortcut uses `FROM modules m` in the RPC)
- Checking `user_permissions` table shows rows with module_key values that don't exist in `modules`

**Phase to address:** Phase 1 of v2.0, migration 00016 as the very first v2.0 migration.

---

### Pitfall 5: is_admin Bypass in get_user_permissions() Includes Admin Module Keys

**What goes wrong:**
The current `get_user_permissions()` RPC (from migration 00012) returns ALL modules from the `modules` table with level 2 for admin users:
```sql
SELECT m.key::TEXT AS module_key, 2::SMALLINT AS level
FROM modules m
WHERE EXISTS (SELECT 1 FROM users u WHERE u.auth_user_id = p_user_id AND u.is_admin = true ...)
```
When ChemoSys module keys are added to the `modules` table, admin users will automatically receive level 2 on ALL of them (fleet, equipment, etc.) — which is correct. However, if Sharon tests the employee app while logged into the admin session, the permission checks will pass for every ChemoSys module. This is the intended behavior. The pitfall is the opposite assumption: developers might assume admin users do NOT have app-level permissions and write special-case code to block them. Do not do this.

**How to avoid:**
Accept that is_admin = true means full access to both admin and app modules. This is a deliberate architectural choice. Document it clearly in the (app) layout's header comment so future developers don't add "block admin from app" logic.

**Warning signs:**
- Code like `if (isAdmin) return null` in (app) pages
- Separate permission check functions that explicitly exclude admin users from app access

**Phase to address:** Phase 1 of v2.0 — document the intent in (app) layout.

---

### Pitfall 6: Two Layouts Calling verifySession() + getNavPermissions() — N+1 DB Calls Per Page

**What goes wrong:**
The `(app)` layout calls `verifySession()`, then `getAppNavPermissions()` (which calls `get_user_permissions()` RPC). A page inside the layout also calls `verifySession()` and `checkPagePermission()` (which calls `get_user_permissions()` again). On one page load: 3+ DB calls for auth/permissions. At scale with 50 concurrent employees, this is 150+ RPC calls per second for permission checks alone.

**Why it happens:**
Each Server Component calls what it needs independently. Without memoization, the same RPC is called multiple times per render tree.

**How to avoid:**
`verifySession()` is already wrapped in `React.cache()` — it runs once per request regardless of how many times it is called. Do the same for `get_user_permissions()` data:

```typescript
// In dal.ts — add a cached version of the RPC call
const getUserPermissionsRaw = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_user_permissions', { p_user_id: userId })
  return data ?? []
})

// All permission functions use this cached call
export async function getAppNavPermissions() {
  const session = await verifySession()
  const perms = await getUserPermissionsRaw(session.userId)
  // ... filter for app modules
}

export async function checkPagePermission(moduleKey: string, minLevel: PermissionLevel) {
  const session = await verifySession()
  const perms = await getUserPermissionsRaw(session.userId)
  // ... check
}
```

`React.cache()` deduplicates within a single request's render tree. The RPC fires once; all callers get the same result.

**Warning signs:**
- Supabase dashboard shows high RPC call volume per minute relative to active users
- Page load time increases linearly with the number of permission checks on the page
- Database connection pool exhaustion under moderate load

**Phase to address:** Phase 1 of v2.0, when refactoring `dal.ts` to add app-specific functions.

---

### Pitfall 7: RTL Assumptions Break in New shadcn/ui Components

**What goes wrong:**
The admin panel established RTL using `dir="rtl"` on `<html>` and logical Tailwind utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`). New shadcn/ui components added for ChemoSys (Tabs, Accordion, Sheet, NavigationMenu, Combobox) use physical CSS properties internally (`padding-left`, `margin-right`) and do not automatically flip in RTL. Tables with scroll containers also break — horizontal scroll goes the wrong direction.

**Why it happens:**
shadcn/ui components use Radix UI primitives. Most Radix components are RTL-aware, but some CSS within the shadcn layer uses physical properties. Also: developers adding new components in rapid development forget the RTL-first rule established in v1.0.

**How to avoid:**
1. Test every new shadcn/ui component visually in RTL immediately when added — not after the page is built.
2. Create a `RTLCheck` dev tool: a floating banner visible only in `NODE_ENV=development` that shows "RTL: ON" so developers always know they are in RTL context.
3. Add a lint rule or code review checklist: no `pl-`, `pr-`, `ml-`, `mr-` in new files.
4. For components that need LTR internals (e.g., a number input or a file path display), wrap with `dir="ltr"` on the specific element — do not override the global RTL.

**Warning signs:**
- Icons appear on the wrong side of button labels
- Dropdown menus open off-screen to the left
- Table column headers misaligned from data columns
- Horizontal scroll in data-heavy tables scrolls from the wrong anchor

**Phase to address:** Each phase that introduces new components — verify RTL as part of phase completion criteria.

---

### Pitfall 8: Employee Login Creates Session but User Has No public.users Row

**What goes wrong:**
Supabase Auth login succeeds (email + password correct). But the employee's `auth.users` record was created without a corresponding `public.users` row (e.g., an old invitation was accepted before the app was set up, or a test account was created manually). The employee hits the (app) layout, `verifySession()` succeeds, `getAppNavPermissions()` runs — it finds no `public.users` row, and depending on implementation, may return the bootstrap admin fallback (all permissions) or an empty set (no nav items).

**Why it happens:**
The `public.users` row is created by the admin panel's "Create User" flow, which links `auth_user_id` to an employee record. If an auth user exists without that manual step, the system is in an inconsistent state.

**How to avoid:**
1. The `(app)` layout must explicitly check for a `public.users` row and redirect to a "contact your administrator" page if none exists — do NOT fall through to the bootstrap admin logic.
2. Add a `verifyAppUser()` function separate from `verifySession()`:

```typescript
export async function verifyAppUser(): Promise<AppUser> {
  const session = await verifySession()  // JWT check
  const supabase = await createClient()

  const { data: userRow } = await supabase
    .from('users')
    .select('id, is_blocked, employee_id')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!userRow) redirect('/app/no-account')       // No public.users row
  if (userRow.is_blocked) redirect('/app/blocked') // Blocked user

  return { ...session, internalUserId: userRow.id, employeeId: userRow.employee_id }
}
```

3. The `(app)` layout calls `verifyAppUser()`, NOT `verifySession()` directly.

**Warning signs:**
- Employee logs in, sees the app shell, but all nav items are missing
- Sharon accidentally gets full employee app access when testing (bootstrap fallback fires)
- `is_blocked` employees can access the app because only `verifySession()` is checked

**Phase to address:** Phase 1 of v2.0 — `verifyAppUser()` must exist before the first (app) page is created.

---

### Pitfall 9: Shared /login Page — Employees and Admin Sessions Collide

**What goes wrong:**
Both Sharon (admin) and employees use Supabase Auth. They share the same Supabase project. If an employee visits `/login` (the admin login page), signs in successfully, the `login()` Server Action redirects them to `/admin/companies`. The employee now has a valid session and can potentially access admin pages until the layout's `verifySession()` check fires (it only checks for a valid JWT, not for admin status).

Current `(admin)` layout:
```typescript
const session = await verifySession()  // Only checks JWT — not is_admin
```
Any authenticated user passes this check.

**How to avoid:**
Add an admin-only guard to the `(admin)` layout:
```typescript
export default async function AdminLayout({ children }) {
  const session = await verifySession()

  // NEW: verify this user is actually an admin
  const supabase = await createClient()
  const { data: userRow } = await supabase
    .from('users')
    .select('is_admin')
    .eq('auth_user_id', session.userId)
    .is('deleted_at', null)
    .maybeSingle()

  // No public.users row = bootstrap admin (Sharon before first user creation) — allow
  // Has public.users row but is_admin = false = employee — deny
  if (userRow && !userRow.is_admin) {
    redirect('/app/dashboard')  // Send them where they belong
  }

  // ... rest of layout
}
```

**Warning signs:**
- Employee logs into admin login, lands on admin companies page without error
- Console shows employee email in admin session
- An employee can access `/admin/employees` and see personal data of colleagues

**Phase to address:** Phase 1 of v2.0 — patch the (admin) layout BEFORE releasing the employee login.

---

### Pitfall 10: module_key Naming Collision Between Admin and App Modules

**What goes wrong:**
Admin modules and ChemoSys modules share the same `modules` table and the same `module_key` namespace. If a ChemoSys module is named `dashboard` (same as the admin dashboard key already seeded), the `get_user_permissions()` RPC will conflate them. An employee granted `dashboard` read access (for the app dashboard) will appear to have `dashboard` write access in the admin permission template system as well.

**Why it happens:**
The `modules` table has no `context` or `group` column. All module keys are global.

**How to avoid:**
Use a namespace prefix for all ChemoSys module keys:
```
Admin modules:    dashboard, companies, departments, employees, ...
ChemoSys modules: app_fleet, app_equipment, app_reports, app_my_work, ...
```
Add the prefix from the start — renaming module keys later requires a data migration across `user_permissions.module_key`, `template_permissions.module_key`, and all `requirePermission()` calls in the codebase.

Alternative (cleaner but requires schema change): Add a `context TEXT` column to `modules` with values `'admin'` and `'app'`, and filter by context in `getNavPermissions()` vs `getAppNavPermissions()`.

**Warning signs:**
- Employee permission grant for "dashboard" shows up in admin permission templates
- Admin permission for a module accidentally grants employee access to unrelated app module
- `checkPagePermission('fleet', 1)` returns `true` for all users because "fleet" was granted to admin users generically

**Phase to address:** Phase 1 of v2.0, before the first migration seeding ChemoSys module keys.

---

### Pitfall 11: (app) Layout Nesting — Forgot to Call verifyAppUser() in Each Nested Layout

**What goes wrong:**
Next.js App Router allows nested layouts. The `(app)` route group has a root layout that calls `verifyAppUser()`. A sub-feature (e.g., `/app/fleet/vehicles`) has its own nested layout for the fleet section. The nested layout does NOT repeat the guard. If a user bypasses the root layout somehow (deep link, cache issue), they access the page without the guard firing.

**Why it happens:**
Developers assume the root layout guard propagates down automatically. In Next.js, layouts wrap — the root layout does fire — but if you restructure routes later and move pages outside the protected subtree, the guard is lost silently.

**How to avoid:**
The root `(app)` layout must call `verifyAppUser()`. Any nested layout that adds its own data-fetching (e.g., fleet-specific data) should call `verifySession()` at minimum (JWT check) to ensure the guard is still active even if the tree is refactored. Do not rely on parent layouts for security — treat each layout as responsible for its own guard.

**Warning signs:**
- Moving a route to a different position in the file tree causes it to stop being protected
- A deep link to a nested page works without authentication

**Phase to address:** Each phase that adds nested routes — checklist item: "Guard present in this layout?"

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse admin `getNavPermissions()` in (app) layout | No new code needed | Admin module keys leak into employee nav; confusing results | Never |
| Hardcode employee module keys in the sidebar instead of reading from DB | Simpler nav code | Module list diverges from DB; permission grants for non-existent keys | Never — use DB as source of truth |
| Skip `verifyAppUser()`, use `verifySession()` only in (app) layout | Faster to implement | Blocked/deleted employees can access app; no is_blocked check | Never — security gap |
| Single login page for both admin and employees | One less page to build | Session collision (Pitfall 9); employees land on admin UI | Never in this system |
| Use `React.cache()` in `getNavPermissions()` but not in `checkPagePermission()` | Partial caching | Same RPC called twice per page load | Only temporarily — add to all permission functions in Phase 1 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| proxy.ts + two login pages | Single redirect target `/login` | Path-aware branching: `/app/*` routes → `/app/login`, others → `/login` |
| `get_user_permissions()` RPC + ChemoSys modules | Calling RPC before seeding module keys | Seed migration (00016) runs BEFORE first permission check in any app page |
| Supabase Auth + two user types | Same `login()` Server Action for both | Separate `loginAdmin()` and `loginEmployee()` with separate redirect targets |
| React.cache() + dal.ts | Cache on outer function, not on the RPC call | Cache the raw RPC call so all wrapper functions share the same cached result |
| shadcn/ui Sheet component + RTL | Sheet opens from the wrong side | Apply `side="right"` explicitly since RTL inverts default side |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Uncached `get_user_permissions()` RPC | Each permission check is a separate DB round-trip | Wrap raw RPC in `React.cache()` | At 20+ concurrent users with navigation-heavy pages |
| `getNavPermissions()` called in both layout AND page server components | 2x RPC calls per page | Lift data to layout, pass down as props or use cache | From day one — unnecessary cost |
| Dashboard page awaiting all data before render | Blank screen while fleet + equipment + summary data all load | Use `<Suspense>` with skeleton fallbacks; parallel `Promise.all` for independent queries | When any single data source is slow |
| No pagination on fleet/equipment lists | List renders thousands of rows | Always implement server-side pagination from the start; never fetch all rows | At 500+ records |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `(admin)` layout only calls `verifySession()` — no is_admin check | Employee with valid session accesses admin panel | Add is_admin check to (admin) layout before v2.0 ships |
| Employee login action that does not verify a public.users row exists | Auth-only user (no app access row) gets into the app | `verifyAppUser()` checks for `public.users` row before allowing app access |
| Module key naming collision between admin and app | Employee granted "dashboard" access appears as admin-level module | Prefix all ChemoSys module keys with `app_` |
| `requirePermission()` not called in employee-facing Server Actions | Employee can call mutations for modules they have no access to | Every mutation Server Action in (app) calls `requirePermission()` — same rule as admin |
| Shared session means admin logout also logs out employee on same browser | Data integrity issue if Sharon tests employee app while logged as admin | Expected and acceptable — document this behavior; use separate browsers for testing |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Greyed-out buttons with no tooltip explaining why | Employee clicks button repeatedly thinking it is broken | Add tooltip: "אין לך הרשאה לפעולה זו" on disabled permission-gated buttons |
| Module switching clears form state (unsaved data lost) | Employee fills form, navigates away by accident, loses work | Use `useFormStatus` + unsaved-changes warning before navigation |
| App dashboard loads all widgets sequentially | 3-5 second blank screen on first load | `<Suspense>` wrapper per widget; stagger loading with skeletons |
| No "contact admin" message when user has zero permissions | Employee sees blank sidebar with no explanation | Detect empty permissions set and show "פנה למנהל המערכת להגדרת הרשאות" |
| Hebrew number inputs accept English digits but display RTL | Phone numbers, employee numbers appear backwards | Use `dir="ltr"` on number/ID inputs specifically within the RTL shell |

---

## "Looks Done But Isn't" Checklist

- [ ] **proxy.ts:** Changed to path-aware login redirect — verify `/app/fleet` without session lands on `/app/login`, not `/login`
- [ ] **(admin) layout:** Added is_admin check — verify employee account cannot access `/admin/companies` even with valid session
- [ ] **verifyAppUser():** Added and used in (app) layout — verify blocked user is redirected to `/app/blocked`, not to the dashboard
- [ ] **Module seeds:** 00016 migration executed in Supabase — verify `SELECT * FROM modules WHERE key LIKE 'app_%'` returns rows
- [ ] **requirePermission() in employee Server Actions:** Every mutation in (app) calls it — search codebase for `"use server"` in `/app/` and verify each has `requirePermission()`
- [ ] **getAppNavPermissions():** Returns ONLY ChemoSys module keys — verify Sharon sees no "ניהול חברות" in employee sidebar
- [ ] **RTL check for new components:** Every new shadcn/ui component tested visually in RTL — Tabs, Sheet, NavigationMenu open on correct side
- [ ] **React.cache() on RPC call:** Single RPC call per page load — verify via Supabase dashboard logs (1 RPC call per page, not 3-4)
- [ ] **loginEmployee action:** Redirects to `/app/dashboard` (not `/admin/companies`) — test with real employee credentials

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| proxy.ts wrong redirect (employees hit admin login) | LOW | Edit `src/proxy.ts`, redeploy — 10 minutes |
| loginEmployee redirects to wrong destination | LOW | Edit `src/actions/auth-app.ts`, redeploy — 5 minutes |
| Module keys not seeded, all permission checks fail | LOW | Run `00016_seed_chemosys_modules.sql` in Supabase SQL editor — 2 minutes |
| getNavPermissions() leaks admin keys into employee sidebar | LOW | Replace call with `getAppNavPermissions()` in (app) layout — 30 minutes |
| Employee accesses admin panel (no is_admin check) | MEDIUM | Patch (admin) layout, audit logs for unauthorized access, rotate credentials if sensitive data was seen |
| Module key naming collision (admin + app keys clash) | HIGH | Data migration to rename all module_key values in user_permissions + template_permissions + code changes — plan 4-8 hours |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| proxy.ts single redirect target (P1) | Phase 1 — Shell setup | `curl /app/dashboard` without cookie → 302 to `/app/login` |
| loginEmployee wrong redirect (P2) | Phase 1 — Shell setup | Manual test: employee login → `/app/dashboard` |
| getNavPermissions() returns admin keys (P3) | Phase 1 — Shell setup | Sharon test account: employee sidebar shows only app modules |
| Module keys not seeded (P4) | Phase 1 — Shell setup, first migration | `SELECT * FROM modules WHERE key LIKE 'app_%'` returns rows |
| is_admin bypass includes app modules (P5) | Phase 1 — Architecture decision | Document in (app) layout comment, no code required |
| N+1 RPC calls per page (P6) | Phase 1 — dal.ts refactor | Supabase logs: 1 RPC call per page render |
| RTL breaks in new components (P7) | Each phase adding new components | Visual review checklist per component |
| Employee login without public.users row (P8) | Phase 1 — verifyAppUser() | Test with an auth-only user: redirect to `/app/no-account` |
| Admin/employee session collision (P9) | Phase 1 — (admin) layout patch | Employee session cannot access `/admin/companies` |
| module_key namespace collision (P10) | Phase 1, before migration 00016 | All ChemoSys keys use `app_` prefix in modules table |
| Missing guard in nested layouts (P11) | Each phase adding nested routes | Remove root layout temporarily, verify nested route is also blocked |

---

## Sources

Findings are based on:
- Direct code inspection of the existing ChemoSystem codebase (proxy.ts, dal.ts, all migrations 00001–00015, (admin) layout, (auth) layout, login page, auth Server Action, SidebarNav)
- Established Next.js 15/16 App Router route group behavior (training data through August 2025)
- Supabase Auth + Next.js SSR patterns (official Supabase SSR guide)
- React.cache() deduplication behavior (Next.js documentation)

Key files inspected:
- `src/proxy.ts` — current middleware, single redirect target confirmed
- `src/lib/dal.ts` — verifySession, requirePermission, getNavPermissions, checkPagePermission
- `src/actions/auth.ts` — login() hardcodes redirect to `/admin/companies`
- `src/app/(admin)/layout.tsx` — only calls verifySession(), no is_admin check
- `src/app/(auth)/login/page.tsx` — single login page, no user type branching
- `supabase/migrations/00003_seed_modules.sql` — 9 admin keys, no app keys
- `supabase/migrations/00012_access_control.sql` — is_admin + get_user_permissions() RPC

---
*Pitfalls research for: ChemoSys v2.0 — adding (app) route group to existing admin panel*
*Researched: 2026-03-04*
