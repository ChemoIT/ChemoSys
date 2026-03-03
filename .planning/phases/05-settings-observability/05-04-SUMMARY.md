---
phase: 05-settings-observability
plan: 04
subsystem: ui
tags: [supabase, audit-log, dashboard, entity-resolution, exceljs]

# Dependency graph
requires:
  - phase: 05-02
    provides: AuditLogTable component + export-audit route handler with UUID-based user/entity columns
  - phase: 05-01
    provides: Dashboard ActivityFeed with UUID-based user display
provides:
  - Real user names (first_name + last_name via employees join) in activity feed, audit log table, and Excel/CSV export
  - Entity name resolution for all entity_types (employees, companies, departments, projects, role_templates, role_tags, attendance_clocks, users, employee_import)
  - entityName field on ActivityEntry and AuditRow types
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Entity name resolution: collect entity_ids grouped by entity_type → parallel Promise.all lookups → entityNameMap merge"
    - "Supabase FK join cast: u.employees as unknown as { first_name, last_name } | null — Supabase types return array for FK joins, runtime is single object"
    - "async addLookup pattern: inner async function returns Promise<void> directly — avoids PromiseLike<void> type mismatch from .then() chaining"

key-files:
  created: []
  modified:
    - src/app/(admin)/admin/dashboard/page.tsx
    - src/app/(admin)/admin/audit-log/page.tsx
    - src/app/(admin)/api/export-audit/route.ts
    - src/components/admin/dashboard/ActivityFeed.tsx
    - src/components/admin/audit-log/AuditLogTable.tsx

key-decisions:
  - "employees FK join cast via unknown: Supabase TypeScript types report employees as array but runtime returns single object for single FK; double cast (as unknown as Type) is correct pattern"
  - "No deleted_at filter on user/entity lookups: historical audit entries must resolve to real names even if employee/user was later deleted"
  - "Export adds 'ישות' column (human name) + 'UUID ישות' column (raw ID): both are useful — name for readability, UUID for debugging/tracing"
  - "employee_import uses static label 'ייבוא עובדים': no lookup table exists for batch import entries"
  - "ActivityFeed: entityName shown inline in sentence — 'פעל על עובד — יוסי כהן', no separate UUID line"

patterns-established:
  - "Entity name resolution: grouped by type → parallel lookups → Map merge pattern. Reuse in any future page displaying audit_log rows."
  - "Supabase FK join cast: always use (row.employees as unknown as Type | null) not direct cast"

# Metrics
duration: 15min
completed: 2026-03-04
---

# Phase 5 Plan 4: UAT Gap Closure — UUID Display Fix Summary

**Entity name + user name resolution across activity feed, audit log table, and Excel/CSV export — UUIDs replaced with human-readable names via per-entity-type Supabase lookups and employees join**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-04T00:00:00Z
- **Completed:** 2026-03-04T00:15:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Fixed broken user name query — replaced non-existent `full_name`/`email` column select with correct `users → employees(first_name, last_name)` join in all 3 server files
- Added entity name resolution for 9 entity_types using parallel `Promise.all` lookups, covering all tables that appear in audit_log
- Updated `ActivityFeed` to display "שרון בראון פעל על עובד — יוסי כהן" style entries instead of raw UUID line below each action
- Updated `AuditLogTable` entity column to show human-readable name with full UUID as hover tooltip
- Updated Excel/CSV export to include `ישות` (name) column + `UUID ישות` (raw ID) column

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: Fix user name resolution + add entity name resolution + update client components** — `f3e44ae` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/(admin)/admin/dashboard/page.tsx` — Fix users→employees join; add entity name resolution + entityName in ActivityEntry mapping
- `src/app/(admin)/admin/audit-log/page.tsx` — Fix users→employees join; add entity name resolution; add entityName to AuditRow type + mergedRows
- `src/app/(admin)/api/export-audit/route.ts` — Fix users→employees join; add entity name resolution; add 'ישות' + 'UUID ישות' columns to worksheet
- `src/components/admin/dashboard/ActivityFeed.tsx` — Add entityName to ActivityEntry type; display entityName inline in sentence
- `src/components/admin/audit-log/AuditLogTable.tsx` — Add entityName to AuditRow type; update entity column to show name with UUID tooltip

## Decisions Made

- Supabase FK join cast: `u.employees as unknown as { first_name: string; last_name: string } | null` — Supabase TypeScript types declare FK join result as array, but runtime returns single object for single FK. Double cast via `unknown` is the safe pattern.
- No `deleted_at` filter on lookup queries — historical audit entries must still resolve names even after the employee/user/entity was soft-deleted.
- `employee_import` gets static label `ייבוא עובדים` — batch import events have no per-row entity to look up.
- Excel export keeps raw UUID as a separate column (`UUID ישות`) alongside the human name column (`ישות`) for debugging.
- Used `async function addLookup(): Promise<void>` pattern instead of `.then()` chaining — avoids `PromiseLike<void>` TypeScript mismatch when pushing to `Promise<void>[]`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript errors: Supabase FK join type and PromiseLike vs Promise**
- **Found during:** Task 1 (TypeScript check after implementation)
- **Issue:** (a) `u.employees` typed as `array` by Supabase types, simple cast to `object` failed with "neither type sufficiently overlaps" error. (b) `.then()` on Supabase query returns `PromiseLike<void>` not `Promise<void>`, incompatible with `Promise<void>[]` array.
- **Fix:** (a) Changed to double cast `as unknown as Type | null` pattern. (b) Changed `addLookup` from synchronous function using `.then()` to `async function` returning `Promise<void>` directly.
- **Files modified:** All 3 server files
- **Verification:** `npx tsc --noEmit` — clean. `npm run build` — passes.
- **Committed in:** f3e44ae (combined task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript type bugs)
**Impact on plan:** Fix was necessary for correctness. No scope creep.

## Issues Encountered

None beyond the TypeScript type issues documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- UAT Tests 2 and 3 are now resolved — activity feed and audit log show real names
- All UAT gaps from Phase 05 verification are closed
- Milestone v1.0 is complete

## Self-Check: PASSED

All 6 files found. Commit f3e44ae verified in git history.

---
*Phase: 05-settings-observability*
*Completed: 2026-03-04*
