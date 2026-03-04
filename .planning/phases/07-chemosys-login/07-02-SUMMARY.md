---
phase: 07-chemosys-login
plan: 02
subsystem: ui
tags: [next-js, tailwind, lucide-react, server-component, permissions, module-selection]

# Dependency graph
requires:
  - phase: 06-db-auth-foundation
    provides: "verifyAppUser(), getAppNavPermissions() — permission-reading DAL functions"
  - phase: 07-01
    provides: "loginApp() redirects to /app — this is the landing page"
provides:
  - "/app server component — module selection page with permission-gated tiles"
  - "ModuleButton helper — Link tile for enabled, div tile for disabled (no keyboard nav leak)"
  - "Auto-redirect UX: single-module users skip selection screen entirely"
affects: [phase-08-app-layout, phase-09-fleet-module, phase-10-equipment-module]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module selection: always show both tiles, disable unauthorized ones — visual clarity over hiding"
    - "Auto-redirect: if exactly one top-level module, skip selection screen (UX optimization)"
    - "Disabled module tile: use <div aria-disabled> not <Link pointer-events-none> — prevents keyboard nav leak"
    - "ShieldOff badge inside disabled tile — communicates 'no access' iconographically + textually"

key-files:
  created:
    - src/app/app/page.tsx
  modified: []

key-decisions:
  - "ModuleButton uses <div> for disabled state, never <Link> — pointer-events-none on Link still allows keyboard Tab navigation, which would be confusing for blocked modules"
  - "Icon containers are w-14 h-14 rounded-xl — large touch targets for field workers on mobile"
  - "Page placed at src/app/app/page.tsx outside route group — Phase 8 will add (app)/layout.tsx around it without moving the file (Next.js App Router allows this)"
  - "Auto-redirect to /chemosys when neither app_fleet nor app_equipment is present — edge case safety net even though verifyAppUser() should have blocked earlier"

patterns-established:
  - "Permission-gated UI tiles: render all options, disable unauthorized — never hide (matches accessibility + UX best practice)"
  - "Matching dark theme: bg-sidebar-bg + radial teal glow — consistent with /chemosys login page"

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 7 Plan 02: Module Selection Page Summary

**Server component at /app with permission-gated Fleet + Equipment tiles, auto-redirect for single-module users, dark theme matching ChemoSys login**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-04T09:08:22Z
- **Completed:** 2026-03-04T09:13:00Z
- **Tasks:** 1 of 2 (Task 2 = human checkpoint — awaiting verification)
- **Files modified:** 1

## Accomplishments

- `src/app/app/page.tsx` server component with `verifyAppUser()` as first line — redirects unauthenticated/blocked/no-permission users to `/chemosys`
- `getAppNavPermissions()` reads `app_fleet` + `app_equipment` from RPC, drives tile active/disabled state
- Auto-redirect: single-module users land directly in their module — no unnecessary selection screen
- `ModuleButton` inline helper: `<Link>` for enabled (teal border + hover scale), `<div aria-disabled>` for disabled (gray + "אין גישה" badge)
- Dark `bg-sidebar-bg` with radial teal gradient — visually consistent with `/chemosys` login page
- Build passes clean: `/app` registered as dynamic server-rendered route

## Task Commits

1. **Task 1: Create /app module selection page** — `8956e05` (feat)
2. **Task 2: Human verification** — (checkpoint — not committed)

## Files Created/Modified

- `src/app/app/page.tsx` — Module selection page: verifyAppUser guard, permission-gated Fleet + Equipment tiles, auto-redirect, dark theme

## Decisions Made

- `ModuleButton` uses `<div aria-disabled>` for disabled state — `<Link>` with `pointer-events-none` still allows keyboard Tab navigation, which would let users tab into a blocked tile and then press Enter to navigate. Using `<div>` prevents this entirely.
- Icon containers are `w-14 h-14 rounded-xl` with a tinted background — large enough for field-worker thumb taps on mobile, with visual container to aid recognition.
- Both module tiles are always rendered (never `display:none`) — this is the correct UX per SUCCESS CRITERIA 2: disabled users see what they're missing and can contact an admin.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `/app` page is live as a standalone server component
- Phase 8 creates `(app)/layout.tsx` wrapping this page with AppHeader + top navigation
- Test users with `app_fleet` / `app_equipment` permissions needed for human verification (Task 2 checkpoint)
- Admin users should see both tiles active via `get_user_permissions` RPC returning all modules

---
*Phase: 07-chemosys-login*
*Completed: 2026-03-04*
