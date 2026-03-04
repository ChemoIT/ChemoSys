---
phase: 08-app-shell
plan: 01
subsystem: ui
tags: [next.js, server-component, route-group, supabase, app-shell, header, rtl]

# Dependency graph
requires:
  - phase: 06-app-auth-dal
    provides: verifyAppUser(), getAppNavPermissions(), AppUser type in dal.ts
  - phase: 07-chemosys-login
    provides: /chemosys login page, loginApp() action, (chemosys) layout pattern

provides:
  - (app)/layout.tsx — authenticated shell wrapping all /app/* pages with auth guard + AppHeader
  - AppHeader — sticky top header with CA logo, user display name, ModuleSwitcher, logout
  - ModuleSwitcher — client dropdown for switching between app_fleet / app_equipment
  - AppLogoutButton — calls logoutApp(), redirects to /chemosys on sign-out
  - logoutApp() Server Action in auth.ts — sign-out for ChemoSys users → /chemosys

affects:
  - Phase 09 (fleet module) — all fleet pages inherit this layout automatically
  - Phase 10 (equipment module) — all equipment pages inherit this layout automatically

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "(app) route group layout — URL-transparent wrapper applied to /app/* without moving page files"
    - "AppHeader as server component passing permissions[] to client ModuleSwitcher"
    - "Supabase FK join with `as unknown as Type | null` cast for single-FK employee name resolution"
    - "ModuleSwitcher returns null for single-module users — no dropdown rendered"

key-files:
  created:
    - src/app/(app)/layout.tsx
    - src/components/app/AppHeader.tsx
    - src/components/app/ModuleSwitcher.tsx
    - src/components/app/AppLogoutButton.tsx
  modified:
    - src/actions/auth.ts
    - src/app/app/page.tsx

key-decisions:
  - "(app)/layout.tsx does NOT set dir=rtl — inherited from root <html dir='rtl'> in layout.tsx"
  - "ModuleSwitcher hidden (returns null) when user has <=1 top-level module — UX simplification for single-module field workers"
  - "Employee display name resolved via FK join in layout (not DAL) — display concern belongs in layout"
  - "logoutApp() is a separate Server Action from logout() — different redirect targets (/chemosys vs /login) and different user populations"
  - "verifyAppUser() retained in /app/page.tsx as defense-in-depth — React.cache() deduplicates with layout call"

# Metrics
duration: 18min
completed: 2026-03-04
---

# Phase 8 Plan 01: App Shell Summary

**(app) route group layout shell with sticky AppHeader (CA logo, display name, ModuleSwitcher dropdown, logout) wrapping all /app/* pages via verifyAppUser() auth guard**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-04T09:50:15Z
- **Completed:** 2026-03-04T10:08:35Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `(app)/layout.tsx` guards all `/app/*` pages — unauthenticated/blocked/no-perm users redirected to `/chemosys`
- `AppHeader` renders sticky top bar with CA logo, full name from employees table (fallback to email), ModuleSwitcher, and logout button
- `ModuleSwitcher` shows only permitted top-level modules; renders `null` when user has a single module (avoids unnecessary UI)
- `logoutApp()` added to `auth.ts` — ChemoSys users return to `/chemosys`, not the admin `/login`
- `/app/page.tsx` cleaned — fullscreen dark background, inline gradient, and `dir="rtl"` removed; layout now provides those

## Task Commits

Each task was committed atomically:

1. **Task 1: logoutApp() + (app)/layout.tsx + AppHeader + ModuleSwitcher + AppLogoutButton** - `4e838e9` (feat)
2. **Task 2: Clean up /app/page.tsx — remove redundant fullscreen styling** - `618bcc7` (feat)

## Files Created/Modified

- `src/app/(app)/layout.tsx` — Route group layout: verifyAppUser() guard, display name resolution, AppHeader render
- `src/components/app/AppHeader.tsx` — Server component: sticky header with logo, name, ModuleSwitcher, AppLogoutButton
- `src/components/app/ModuleSwitcher.tsx` — Client component: DropdownMenu for app_fleet/app_equipment; hidden for <=1 module
- `src/components/app/AppLogoutButton.tsx` — Client component: form action calling logoutApp()
- `src/actions/auth.ts` — Added logoutApp() Server Action (redirects to /chemosys)
- `src/app/app/page.tsx` — Removed fullscreen bg/gradient/dir — layout provides these now

## Decisions Made

- `(app)/layout.tsx` does NOT set `dir="rtl"` — root `<html dir="rtl">` in `src/app/layout.tsx` already sets RTL globally. Duplicating it is redundant (confirmed by checking admin and chemosys layout patterns which also don't set dir).
- `ModuleSwitcher` returns `null` for ≤1 module — single-module users are auto-redirected anyway; showing a one-item dropdown adds no UX value.
- Employee display name is resolved in layout (not DAL) — this is a display concern, not a data access concern. DAL stays clean.
- `logoutApp()` is a separate function from `logout()` — different user populations, different redirect destinations. Merging them would require passing a parameter to a Server Action, which is less clean.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All `/app/*` pages now inherit the authenticated shell automatically
- Phase 9 (fleet module) can create pages under `src/app/(app)/fleet/` and they will be protected + headed
- Phase 10 (equipment module) same pattern
- ModuleSwitcher already handles `app_equipment` — no changes needed when equipment module ships

---
*Phase: 08-app-shell*
*Completed: 2026-03-04*
