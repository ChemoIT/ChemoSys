---
phase: 07-chemosys-login
plan: 01
subsystem: auth
tags: [supabase-auth, server-actions, rate-limiting, next-js, tailwind, login-page, chemosys]

# Dependency graph
requires:
  - phase: 06-db-auth-foundation
    provides: "verifyAppUser(), getAppNavPermissions(), loginAttempts Map pattern, Supabase auth client"
provides:
  - "loginApp() Server Action in auth.ts — ChemoSys-specific auth with redirect to /app"
  - "checkRateLimit(ip, store) generic helper replacing checkLoginRateLimit(ip)"
  - "loginAppAttempts Map — independent rate limit counter for ChemoSys login"
  - "(chemosys)/layout.tsx — dark bg-sidebar-bg (#1B3A4B) full-screen layout"
  - "/chemosys login page — modern dark-themed login with remember-me"
affects: [phase-08-app-layout, phase-09-fleet-module, any phase that references auth.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generic rate limiter: checkRateLimit(ip, store) — pass the Map as parameter to support independent counters per endpoint"
    - "Route group (chemosys) for URL /chemosys — same pattern as (auth) for /login"
    - "Separate localStorage keys per surface: chemosys_app_remember vs chemosys_remember"
    - "LoginAppState type separate from LoginState — clarity for useActionState typing"

key-files:
  created:
    - src/app/(chemosys)/layout.tsx
    - src/app/(chemosys)/chemosys/page.tsx
  modified:
    - src/actions/auth.ts

key-decisions:
  - "loginApp() does NOT call verifyAppUser() after signInWithPassword — session cookie propagates on next request, /app/page.tsx handles the guard"
  - "loginAppAttempts and loginAttempts are separate Maps — different attack surfaces must not share rate limit counters"
  - "checkRateLimit() is a module-private function (no export) — rate limit state is server-internal"
  - "Layout radial teal glow (rgba(78,205,196,0.08)) added for depth — no external image dependency"

patterns-established:
  - "ChemoSys login page: dark bg-sidebar-bg layout + white card — visually distinct from admin (bg-brand-bg)"
  - "Error display: styled alert box (bg-brand-danger/10 border border-brand-danger/30) instead of plain text"

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 7 Plan 01: ChemoSys Login Summary

**ChemoSys login at /chemosys with dedicated loginApp() Server Action, independent rate limiting via generic checkRateLimit(ip, store), dark-themed modern UI with remember-me (chemosys_app_remember key)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-04T09:03:11Z
- **Completed:** 2026-03-04T09:06:08Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- `loginApp()` Server Action exported from `auth.ts` — mirrors `login()` exactly, redirects to `/app`, uses independent `loginAppAttempts` Map
- `checkRateLimit(ip, store)` generic helper replaces hardcoded `checkLoginRateLimit(ip)` — admin and ChemoSys login use separate counters
- `/chemosys` route renders with dark `#1B3A4B` background, white card, modern UI with radial teal glow, tall inputs, styled error alerts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add loginApp() Server Action + refactor rate limiting** - `184c6f7` (feat)
2. **Task 2: Create (chemosys) layout + ChemoSys login page** - `c20238f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/actions/auth.ts` — refactored: generic `checkRateLimit()`, `loginAppAttempts` Map, `loginApp()` export, `LoginAppState` type
- `src/app/(chemosys)/layout.tsx` — dark full-screen layout with `bg-sidebar-bg` + radial teal glow effect
- `src/app/(chemosys)/chemosys/page.tsx` — ChemoSys login page: logo, "מערכת ניהול שטח" divider, modern card, remember-me, Hebrew errors

## Decisions Made

- `loginApp()` does NOT call `verifyAppUser()` after `signInWithPassword()` — session cookie propagates on next request, `/app/page.tsx` in Phase 8 will call `verifyAppUser()` itself. Avoids double auth check on login.
- `loginAppAttempts` and `loginAttempts` are intentionally separate Maps — different attack surfaces must not share rate limit counters.
- `checkRateLimit()` is module-private (no export) — rate limit state is server-internal implementation detail.
- Layout uses CSS radial gradient for teal glow instead of an image — zero external dependencies, pure CSS.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `/chemosys` login page is live and functional
- `loginApp()` redirects authenticated users to `/app` — Phase 8 must create `(app)/layout.tsx` and `/app/page.tsx` with `verifyAppUser()` guard
- Rate limiting is in-memory; remains acceptable for single-instance deployment per project policy (no paid Redis until production go-live)

---
*Phase: 07-chemosys-login*
*Completed: 2026-03-04*
