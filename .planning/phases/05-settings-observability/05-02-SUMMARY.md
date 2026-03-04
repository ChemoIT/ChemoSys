---
phase: 05-settings-observability
plan: 02
subsystem: ui
tags: [tanstack-table, react-day-picker, date-fns, exceljs, audit-log, rtl]

requires:
  - phase: 01-foundation
    provides: audit_log table schema (old_data/new_data JSONB), verifySession(), createClient()
  - phase: 02-employees
    provides: ExcelJS export pattern (writeBuffer + RTL worksheet)
  - phase: 03-access-control
    provides: SidebarNav nav item pattern, moduleKey convention

provides:
  - Filterable audit log viewer at /admin/audit-log (50 rows/page, server-side pagination)
  - AuditLogTable with expandable rows (TanStack getExpandedRowModel)
  - AuditLogFilters: entity type, action type, debounced text search, date range picker
  - AuditDiffView: INSERT/DELETE/UPDATE before-after JSON diff with RTL layout
  - AuditLogExportButton: xlsx/csv download passing current filter state to Route Handler
  - /api/export-audit Route Handler (filter-aware, user name resolution, ExcelJS RTL output)
  - "יומן פעולות" nav item in SidebarNav (ScrollText icon, between projects and settings)

affects: [05-03-settings, all future phases that add audit_log writes]

tech-stack:
  added: []
  patterns:
    - "Server-side filtering via URL search params — page re-fetches on filter change via router.push"
    - "Two-step user name resolution: fetch audit_log rows, then query public.users where auth_user_id IN (...)"
    - "TanStack getExpandedRowModel for expandable rows (dedicated component, not DataTable.tsx reuse)"
    - "Date range Pitfall 6 fix: gte 'T00:00:00.000Z' and lte 'T23:59:59.999Z' on UTC filter boundaries"
    - "Export Route Handler passes filter params in query string — same filters as page"

key-files:
  created:
    - src/app/(admin)/admin/audit-log/page.tsx
    - src/components/admin/audit-log/AuditLogTable.tsx
    - src/components/admin/audit-log/AuditLogFilters.tsx
    - src/components/admin/audit-log/AuditLogExportButton.tsx
    - src/components/admin/audit-log/AuditDiffView.tsx
    - src/app/(admin)/api/export-audit/route.ts
  modified:
    - src/components/shared/SidebarNav.tsx

key-decisions:
  - "AuditLogTable is a dedicated component — NOT reusing DataTable.tsx (DataTable lacks getExpandedRowModel support)"
  - "Server-side filtering chosen over client-side — audit_log can grow large; URL params pattern matches Next.js App Router"
  - "Two-step user name resolution: audit_log.user_id → auth.users (not public.users FK). Fetch public.users separately by auth_user_id"
  - "Separate /api/export-audit Route Handler (Option B) — keeps filter logic clean, avoids polluting universal /api/export with conditional audit_log paths"
  - "Row expansion resets on page navigation — standard UX, acceptable for audit log"
  - "Max 10,000 rows for export — prevents memory issues on large audit datasets"

patterns-established:
  - "Pattern: AuditLogFilters pushes URL search params, always resets page to 1 on filter change"
  - "Pattern: export-audit Route Handler mirrors page.tsx filter logic exactly"

duration: 22min
completed: 2026-03-03
---

# Phase 5 Plan 02: Audit Log Viewer Summary

**URL-param-driven audit log viewer with TanStack expandable rows, date range filter, AuditDiffView before/after JSON diff, and filter-aware Excel/CSV export via dedicated Route Handler**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-03T21:23:48Z
- **Completed:** 2026-03-03T21:45:00Z
- **Tasks:** 2 (both committed together in 1 atomic commit)
- **Files modified:** 7

## Accomplishments

- Built `/admin/audit-log` Server Component page with server-side URL-param filtering, pagination (50 rows/page), and two-step user display name resolution
- Built `AuditLogTable` with TanStack `getExpandedRowModel()` — dedicated component (not DataTable.tsx reuse) with expandable rows showing `AuditDiffView`
- Built `AuditLogFilters` with entity dropdown, action dropdown (Hebrew labels), debounced text search (300ms), and react-day-picker date range (Hebrew locale)
- Built `AuditDiffView` rendering INSERT/DELETE as single-panel JSON, UPDATE as two-column RTL grid showing only changed keys
- Built `/api/export-audit` Route Handler with same filter logic as page, user name resolution, ExcelJS RTL Hebrew worksheet, 10,000 row cap
- Added "יומן פעולות" (ScrollText icon) to `SidebarNav` between projects and settings

## Task Commits

Tasks 1 and 2 were committed together (Task 2 built the client components that Task 1 renders):

1. **Tasks 1+2: Audit log page, client components, export route** - `b121753` (feat)

**Plan metadata:** (committed separately with SUMMARY.md)

## Files Created/Modified

- `src/app/(admin)/admin/audit-log/page.tsx` — Server Component: filtered query, user name resolution, passes data to AuditLogTable
- `src/components/admin/audit-log/AuditLogTable.tsx` — TanStack Table with getExpandedRowModel, expandable rows, server-side pagination, AuditLogFilters + AuditLogExportButton in header
- `src/components/admin/audit-log/AuditLogFilters.tsx` — entity/action dropdowns, debounced text search, react-day-picker date range (Hebrew locale), clear button
- `src/components/admin/audit-log/AuditLogExportButton.tsx` — DropdownMenu with xlsx/csv options, triggers /api/export-audit with current filters via window.location.href
- `src/components/admin/audit-log/AuditDiffView.tsx` — JSON diff view: INSERT shows new_data green, DELETE shows old_data red, UPDATE shows two-column changed-keys RTL grid
- `src/app/(admin)/api/export-audit/route.ts` — GET handler: verifySession, filter params, audit_log query (no deleted_at filter), user name resolution, ExcelJS RTL output
- `src/components/shared/SidebarNav.tsx` — Added ScrollText icon import + "יומן פעולות" nav item between projects and settings

## Decisions Made

- `AuditLogTable` is a dedicated component — DataTable.tsx does not support `getExpandedRowModel()` and cannot be reused for this use case
- Server-side filtering via URL search params (Pattern 2 from RESEARCH.md) — scalable for large audit_log tables, aligns with "fresh load on every page visit" requirement
- Two-step user name resolution pattern: `audit_log.user_id → auth.users(id)` (not `public.users`), so a separate query to `public.users` on `auth_user_id IN (...)` is required
- Separate `/api/export-audit` Route Handler (RESEARCH.md Option B) — filter params via query string, clean separation of concerns
- Date filter boundaries: `T00:00:00.000Z` for `from` and `T23:59:59.999Z` for `to` to avoid timezone cutoff issues (Pitfall 6)

## Deviations from Plan

None — plan executed exactly as written. All pitfalls from RESEARCH.md were handled as specified.

## Issues Encountered

None — build succeeded on first attempt with no TypeScript errors.

## User Setup Required

None — no external service configuration required. Audit log data comes from the existing `audit_log` table populated by all previous Server Action mutations.

## Next Phase Readiness

- Plan 02 complete: audit log viewer fully functional
- Plan 03 (Settings page with integration accordion) is the next plan in Phase 5
- All audit_log data is now visible and filterable — admins can monitor all system changes
- Export ready for compliance or auditing use cases

## Self-Check: PASSED

All 7 files verified to exist on disk. Commit `b121753` confirmed in git log. SidebarNav "יומן פעולות" entry confirmed. `npm run build` succeeded with zero TypeScript errors, `/admin/audit-log` and `/api/export-audit` routes appear in the build output.

---
*Phase: 05-settings-observability*
*Completed: 2026-03-03*
