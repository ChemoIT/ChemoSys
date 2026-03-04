---
phase: 09-fleet-home
plan: 01
subsystem: app-fleet-shell
tags: [sidebar, rtl, permissions, nested-layout, shadcn]
dependency_graph:
  requires: [08-01]
  provides: [fleet-layout, fleet-sidebar, shadcn-sidebar, shadcn-tooltip]
  affects: [src/app/(app)/app/fleet/, src/components/app/fleet/]
tech_stack:
  added: [shadcn/ui sidebar, shadcn/ui tooltip, src/hooks/use-mobile.tsx]
  patterns: [nested-server-layout, rtl-collapsible-sidebar, server-client-permission-filtering]
key_files:
  created:
    - src/components/ui/sidebar.tsx
    - src/components/ui/tooltip.tsx
    - src/hooks/use-mobile.tsx
    - src/app/(app)/app/fleet/layout.tsx
    - src/components/app/fleet/FleetSidebar.tsx
    - supabase/migrations/00017_fleet_sidebar_modules.sql
  modified:
    - src/app/(app)/layout.tsx
decisions:
  - key: string[] not Set across server-client boundary
    detail: FleetLayout passes string[] to FleetSidebar (Sets are not JSON-serializable). Client converts to Set via useMemo.
  - key: SidebarProvider scoped to FleetLayout only
    detail: SidebarProvider must NOT be in (app)/layout.tsx — nested providers cause state conflicts.
  - key: parent <main> padding removed
    detail: (app)/layout.tsx main element dropped p-4 md:p-6. Padding moved to FleetLayout content div so sidebar sits flush.
  - key: disabled items use span not a/button
    detail: Non-enabled sub-modules use <span> wrapper (not asChild) + aria-disabled + tabIndex=-1 for full keyboard inaccessibility.
metrics:
  duration_minutes: 4
  completed_date: 2026-03-04
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 1
---

# Phase 9 Plan 01: Fleet Sidebar Shell Summary

**One-liner:** shadcn RTL collapsible sidebar shell with 9 permission-filtered fleet sub-modules, defaultOpen=false, via nested Next.js layout.

---

## What Was Built

Installed shadcn `sidebar` + `tooltip` components, created a nested `FleetLayout` server component with `verifyAppUser()` + `app_fleet` permission guard, and built a `FleetSidebar` client component with 9 sub-modules in a collapsible RTL sidebar.

### shadcn Sidebar Install

`npx shadcn@latest add sidebar` installed:
- `src/components/ui/sidebar.tsx` — full shadcn Sidebar with SidebarProvider, collapsible states, mobile Sheet
- `src/components/ui/tooltip.tsx` — shadcn Tooltip (sidebar tooltip prop peer dep)
- `src/hooks/use-mobile.tsx` — mobile detection hook (used internally by sidebar)

The sidebar component honored existing brand color tokens in `globals.css` (`--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-primary`) — no CSS changes needed.

### Migration 00017

Added 2 module keys missing from 00016:
- `app_fleet_charging_stations` — מעקב עמדות טעינה (sort_order 16)
- `app_fleet_forms` — טפסים (sort_order 17)

Both use `ON CONFLICT (key) DO NOTHING` — safe to re-run.

**Action required:** Run migration 00017 in Supabase SQL editor before testing fleet permissions.

### FleetLayout (server, nested)

`src/app/(app)/app/fleet/layout.tsx`:
- Calls `verifyAppUser()` (cached — defense in depth vs parent layout)
- Calls `getAppNavPermissions()` (cached RPC — zero extra DB queries)
- Redirects to `/app` if `app_fleet` not in permissions
- Passes `fleetPermissions` (string[]) to FleetSidebar
- Wraps children in `<div className="flex flex-1 min-h-0">` with padded content area

### FleetSidebar (client component)

`src/components/app/fleet/FleetSidebar.tsx`:
- 9 sub-modules from static `FLEET_SUB_MODULES` array with Hebrew labels + Lucide icons
- `SidebarProvider defaultOpen={false}` — collapsed to icons on initial render
- `<Sidebar side="right" collapsible="icon">` — RTL logical start
- Permission filtering: `useMemo(() => new Set(permissions))` for O(1) lookup
- Enabled items: `asChild` + `<a href>` with active state detection via `usePathname`
- Disabled items: `<span>` wrapper + `aria-disabled="true"` + `tabIndex={-1}` + `opacity-40 cursor-not-allowed`

### Parent Layout Modification

Removed `p-4 md:p-6` from `(app)/layout.tsx` `<main>` element. Padding moved into FleetLayout's content `<div>`. This ensures the fleet sidebar sits flush against the AppHeader without an outer padding gap.

---

## Commits

| Hash | Message |
|------|---------|
| `acfb9cf` | chore(09-01): install shadcn sidebar + tooltip + add migration 00017 |
| `749bc7b` | feat(09-01): FleetLayout + FleetSidebar — RTL collapsible fleet sidebar |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check

### Files verified
- [x] `src/components/ui/sidebar.tsx` — EXISTS
- [x] `src/components/ui/tooltip.tsx` — EXISTS
- [x] `src/hooks/use-mobile.tsx` — EXISTS
- [x] `src/app/(app)/app/fleet/layout.tsx` — EXISTS
- [x] `src/components/app/fleet/FleetSidebar.tsx` — EXISTS
- [x] `supabase/migrations/00017_fleet_sidebar_modules.sql` — EXISTS

### Commits verified
- [x] `acfb9cf` — EXISTS
- [x] `749bc7b` — EXISTS

### Code checks verified
- [x] `side="right"` — RTL positioning confirmed
- [x] `defaultOpen={false}` — collapsed by default confirmed
- [x] `verifyAppUser()` in FleetLayout — auth guard confirmed
- [x] `app_fleet` permission check — guard confirmed
- [x] `aria-disabled="true"` — accessibility on disabled items confirmed
- [x] 9 items in FLEET_SUB_MODULES — count confirmed
- [x] `npx tsc --noEmit` — passes (after next build regenerates dev types)
- [x] `npx next build` — passes, `/app/fleet` listed in output

## Self-Check: PASSED
