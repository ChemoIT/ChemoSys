---
phase: 03-access-control
plan: "03"
subsystem: auth
tags: [permissions, rls, supabase, next.js, server-actions, sidebar, middleware]

# Dependency graph
requires:
  - phase: 03-access-control/03-01
    provides: role_templates table, template_permissions table, get_user_permissions() RPC
  - phase: 03-access-control/03-02
    provides: users table, user_permissions table, is_blocked column, assignTemplate action
provides:
  - requirePermission() — server-side guard for all mutation Server Actions
  - getNavPermissions() — sidebar module filtering based on user permissions
  - checkPagePermission() — page-level access denied rendering
  - Migration 00012: UPDATE policy for user_permissions, is_admin column, is_current_user_blocked()
  - AccessDenied component — Hebrew access denied page
  - Sidebar/SidebarNav/MobileSidebar permission-based nav filtering
  - is_blocked check in AdminLayout — blocked users redirected to /login?blocked=1
affects: ["04-projects", "05-settings"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - requirePermission() called after verifySession() in every mutation Server Action
    - checkPagePermission() returns boolean — page renders AccessDenied if false
    - getNavPermissions() returns string[] of allowed module keys — passed server→Sidebar→SidebarNav
    - allowedModules prop flows: AdminLayout → Sidebar/MobileSidebar → SidebarNav
    - Bootstrap admin pattern: no public.users row = all nav items shown, all pages accessible
    - is_admin column bypasses all permission checks via get_user_permissions() RPC

key-files:
  created:
    - supabase/migrations/00012_access_control.sql
    - src/components/shared/AccessDenied.tsx
  modified:
    - src/lib/dal.ts
    - src/app/(admin)/layout.tsx
    - src/components/shared/Sidebar.tsx
    - src/components/shared/SidebarNav.tsx
    - src/components/shared/MobileSidebar.tsx
    - src/actions/companies.ts
    - src/actions/departments.ts
    - src/actions/role-tags.ts
    - src/actions/employees.ts
    - src/actions/templates.ts
    - src/actions/users.ts
    - src/app/(admin)/admin/companies/page.tsx
    - src/app/(admin)/admin/departments/page.tsx
    - src/app/(admin)/admin/role-tags/page.tsx
    - src/app/(admin)/admin/employees/page.tsx
    - src/app/(admin)/admin/templates/page.tsx
    - src/app/(admin)/admin/users/page.tsx

key-decisions:
  - "requirePermission() throws Error — caught by Server Action error boundary; no return value needed"
  - "getNavPermissions() called in AdminLayout (not per-page) — single DB call serves sidebar for whole request"
  - "Bootstrap admin (no public.users row) sees all nav items and bypasses all permission checks"
  - "is_admin users bypass permission checks via enhanced get_user_permissions() RPC returning all modules at level 2"
  - "SidebarNav CURRENT_PHASE mechanism removed entirely — replaced by permission-based allowedModules filtering"
  - "reactivateEmployee and bulkSoftDeleteEmployees also guarded (Rule 2 — security completeness beyond plan scope)"

patterns-established:
  - "Permission guard pattern: await verifySession() then await requirePermission(module, level) in every Server Action mutation"
  - "Page guard pattern: const hasAccess = await checkPagePermission(module, 1); if (!hasAccess) return <AccessDenied />"
  - "Nav filtering pattern: getNavPermissions() in AdminLayout → allowedModules prop → SidebarNav.filter()"

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 3 Plan 03: Access Control Enforcement Summary

**requirePermission() on all 22+ Server Action mutations, permission-based sidebar filtering via getNavPermissions(), page-level AccessDenied guards, is_blocked check in AdminLayout, and DB migration 00012 with is_admin column + enhanced get_user_permissions() RPC**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-03T11:25:22Z
- **Completed:** 2026-03-03T11:31:xx Z
- **Tasks:** 2 complete (Task 3 = checkpoint awaiting human verification)
- **Files modified:** 19

## Accomplishments
- 22+ mutation Server Actions across 6 files guarded by requirePermission() — unauthorized mutations rejected server-side
- Sidebar nav items filtered by getNavPermissions() — users only see modules they have access to
- All 6 admin pages render AccessDenied for unauthorized direct URL access
- AdminLayout detects is_blocked flag and redirects to /login?blocked=1 with signOut
- Migration 00012 adds UPDATE policy, is_admin column, is_current_user_blocked() function, enhanced get_user_permissions()

## Task Commits

1. **Task 1: Migration 00012, requirePermission/getNavPermissions in DAL, AccessDenied component** - `f3283a5` (feat)
2. **Task 2: Sidebar filtering, page guards, Server Action guards, is_blocked check** - `8ee2537` (feat)
3. **Task 3: Human verification checkpoint** - awaiting

## Files Created/Modified

- `supabase/migrations/00012_access_control.sql` — UPDATE policy, is_admin column, is_current_user_blocked(), enhanced get_user_permissions()
- `src/lib/dal.ts` — added requirePermission(), getNavPermissions(), checkPagePermission(), PermissionLevel type
- `src/components/shared/AccessDenied.tsx` — Hebrew access denied component with ShieldAlert icon
- `src/app/(admin)/layout.tsx` — is_blocked check + getNavPermissions() + allowedModules prop to Sidebar/MobileSidebar
- `src/components/shared/Sidebar.tsx` — accepts allowedModules prop, passes to SidebarNav
- `src/components/shared/SidebarNav.tsx` — CURRENT_PHASE replaced by allowedModules filter; hidden items not rendered
- `src/components/shared/MobileSidebar.tsx` — accepts and passes allowedModules to SidebarNav
- `src/actions/companies.ts` — requirePermission('companies', 2) on create/update/delete
- `src/actions/departments.ts` — requirePermission('departments', 2) on create/update/delete
- `src/actions/role-tags.ts` — requirePermission('role_tags', 2) on create/update/delete
- `src/actions/employees.ts` — requirePermission('employees', 2) on all 6 mutations
- `src/actions/templates.ts` — requirePermission('templates', 2) on create/update/delete
- `src/actions/users.ts` — requirePermission('users', 2) on all 7 mutations
- All 6 admin pages — checkPagePermission() guard at top of every page

## Decisions Made

- requirePermission() throws Error — caught by Server Action error boundary; no return value needed
- getNavPermissions() called in AdminLayout (not per-page) — single DB call serves sidebar for whole request
- Bootstrap admin (no public.users row) sees all nav items and bypasses all permission checks
- is_admin users bypass permission checks via enhanced get_user_permissions() RPC returning all modules at level 2
- SidebarNav CURRENT_PHASE mechanism removed entirely — replaced by permission-based allowedModules filtering

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added requirePermission() to reactivateEmployee and bulkSoftDeleteEmployees**
- **Found during:** Task 2 (Server Action guards)
- **Issue:** Plan listed suspendEmployee but not reactivateEmployee and bulkSoftDeleteEmployees — both are mutations that modify employee data
- **Fix:** Added requirePermission('employees', 2) to both functions for complete coverage
- **Files modified:** src/actions/employees.ts
- **Verification:** TypeScript passes, build passes
- **Committed in:** 8ee2537 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical security guard)
**Impact on plan:** Security completeness — all employee mutations are now equally protected.

## Issues Encountered

None — plan executed cleanly. TypeScript 0 errors, build succeeded.

## User Setup Required

**Migration 00012 must be run manually in Supabase SQL editor.**

Copy and run `supabase/migrations/00012_access_control.sql` in Supabase Dashboard → SQL Editor.

After running migration, set `is_admin = true` on your user row in the `users` table to gain full admin access.

## Next Phase Readiness

- Phase 3 complete after human verification (Task 3 checkpoint)
- Phase 4 (Projects) can begin — all infrastructure, auth, and access control in place
- Pattern established: new modules in Phase 4+ only need to add moduleKey to NAV_ITEMS + checkPagePermission() in page + requirePermission() in actions

## Self-Check: PASSED

All required files exist, all commits verified, all exports confirmed, requirePermission() in all 6 action files, checkPagePermission() in all 6 admin pages, allowedModules in SidebarNav, is_blocked in AdminLayout.

---
*Phase: 03-access-control*
*Completed: 2026-03-03*
