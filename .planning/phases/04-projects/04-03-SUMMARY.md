---
phase: 04-projects
plan: "03"
subsystem: projects-ui
tags: [tanstack-table, exceljs, react, nextjs, supabase, tailwind, shadcn, rtl]

dependency_graph:
  requires:
    - 04-01 (projects table + softDeleteProject Server Action)
    - 02-employees (EmployeesTable pattern, DeleteConfirmDialog)
  provides:
    - ProjectsTable with 3-state status filter + active count badge + export dropdown
    - projects/page.tsx server component with parallel fetch (projects + employees + clocks)
    - /api/export Route Handler for all 6 admin tables (companies, departments, employees, projects, users, role_templates)
    - ProjectForm placeholder (unblocks Plan 03 — full form in Plan 02)
  affects:
    - 04-02-plan (ProjectForm full build — placeholder now exists at correct path)
    - 04-04-plan (if any — projects admin page is now navigable)

tech-stack:
  added: []
  patterns:
    - Pre-TanStack JS filter (same as EmployeesTable) — filter array before passing to table
    - active count memoized from FULL list before filter (always accurate regardless of filter state)
    - Universal export Route Handler with ALLOWED_TABLES whitelist (security pattern)
    - RTL ExcelJS worksheet via worksheet.views = [{ rightToLeft: true }]
    - Buffer cast (as any) for @types/node v22 + exceljs type mismatch (established pattern from 02-02)

key-files:
  created:
    - src/components/admin/projects/ProjectsTable.tsx
    - src/components/admin/projects/ProjectForm.tsx
    - src/app/(admin)/admin/projects/page.tsx
    - src/app/(admin)/api/export/route.ts
  modified: []

key-decisions:
  - "SidebarNav already uses usePathname() — no CURRENT_PHASE gate needed, projects tab active automatically when /admin/projects page exists"
  - "ProjectForm created as minimal placeholder to unblock Plan 03 TypeScript compilation — full 7-section form is Plan 02 scope"
  - "Buffer cast (as any) for exceljs writeBuffer — @types/node v22 Buffer<ArrayBufferLike> vs exceljs non-generic Buffer mismatch (established 02-02 pattern)"
  - "ALLOWED_TABLES whitelist in export route — prevents SQL injection and unauthorized access to system tables"
  - "Export dropdown uses window.location.href for file download — avoids fetch() complexity with binary blobs"

patterns-established:
  - "Universal export pattern: GET /api/export?table=X&format=xlsx|csv with ALLOWED_TABLES whitelist"
  - "RTL Excel export: worksheet.views = [{ rightToLeft: true }] for Hebrew spreadsheets"

metrics:
  duration: "~4 min (236 seconds)"
  completed: "2026-03-03"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 4 Plan 03: ProjectsTable + Export Route Summary

**ProjectsTable with 3-state filter/active-count/export, projects page server component, and universal /api/export Route Handler for all 6 admin tables.**

## Performance

- **Duration:** ~4 min (236 seconds)
- **Started:** 2026-03-03T18:14:22Z
- **Completed:** 2026-03-03T18:18:18Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- Built `ProjectsTable` with text search, 3-state status filter (active/view_only/inactive), active count badge (from full list), export dropdown (Excel/CSV), sortable columns, edit/delete actions
- Built `projects/page.tsx` server component with parallel fetch of projects+joins, active employees for form, attendance clocks map
- Built `/api/export` universal Route Handler for 6 admin tables — auth-guarded, RTL worksheet, bold headers, internal columns excluded
- Created `ProjectForm` placeholder to unblock TypeScript (full form is Plan 02 scope)

## Task Commits

1. **Task 1: ProjectsTable + projects page + ProjectForm placeholder** - `8614172` (feat)
2. **Task 2: Universal Excel/CSV export Route Handler** - `4d0ec5a` (feat)

## Files Created/Modified

- `src/components/admin/projects/ProjectsTable.tsx` — Projects data table with 3-state filter, active count badge, export dropdown, edit/delete
- `src/components/admin/projects/ProjectForm.tsx` — Minimal placeholder dialog (create/edit project name+status only); full form is Plan 02
- `src/app/(admin)/admin/projects/page.tsx` — Server component: verifySession + parallel fetch + clocks map + ProjectsTable render
- `src/app/(admin)/api/export/route.ts` — GET export handler: ALLOWED_TABLES whitelist, verifySession, ExcelJS RTL workbook, xlsx + csv support

## Decisions Made

- **SidebarNav — no change needed:** The current SidebarNav uses `usePathname()` for active link detection (not a CURRENT_PHASE gate). The projects tab activates automatically when `/admin/projects` page exists and the user navigates to it. The plan referenced an older pattern that was already superseded.

- **ProjectForm as placeholder (Rule 3 - Blocking):** ProjectsTable imports ProjectForm. Without any file at that path, TypeScript compilation would fail and the entire plan would be blocked. Created a minimal but functional placeholder (shows create/edit dialog with project name + status fields). Full 7-section form (PM/SM/CVC/supervision/clocks/map) is Plan 02 scope.

- **Buffer cast (as any):** ExcelJS `writeBuffer()` returns `Buffer<ArrayBufferLike>` from @types/node v22 but ExcelJS types expect the older `Buffer` (non-generic). Same established pattern from Plan 02-02. Runtime-safe.

- **Export via window.location.href:** Simpler than fetch() for binary file downloads — browser handles Content-Disposition automatically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created ProjectForm placeholder to unblock Plan 03**

- **Found during:** Task 1 (ProjectsTable + projects page)
- **Issue:** `ProjectsTable.tsx` imports `ProjectForm` from `./ProjectForm`, but Plan 02 (which builds the full form) had not yet been executed. Without a file at that path, TypeScript compilation fails, making Plan 03 unexecutable.
- **Fix:** Created minimal `ProjectForm.tsx` with a functional Dialog shell supporting create/edit (project name + status fields, proper Server Action binding). Clearly documented as placeholder pending Plan 02.
- **Files modified:** `src/components/admin/projects/ProjectForm.tsx` (created)
- **Verification:** `npx tsc --noEmit` passes. ProjectsTable renders correctly with ProjectForm importable.
- **Committed in:** `8614172` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed ExcelJS Buffer type mismatch**

- **Found during:** Task 2 (export route)
- **Issue:** `workbook.xlsx.writeBuffer()` return type `Buffer<ArrayBufferLike>` is not assignable to `BodyInit` in `new Response(buffer, ...)` — TypeScript error TS2345.
- **Fix:** Cast with `as any` (established pattern from 02-02 — @types/node v22 vs exceljs non-generic Buffer, runtime-safe).
- **Files modified:** `src/app/(admin)/api/export/route.ts`
- **Verification:** `npx tsc --noEmit` passes. Runtime behavior unaffected.
- **Committed in:** `4d0ec5a` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation and correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Next Phase Readiness

- Projects page is navigable at `/admin/projects` — renders all projects in filterable table
- Export works for all 6 admin tables at `/api/export?table=X&format=xlsx|csv`
- Plan 02 (ProjectForm full build) can now proceed — ProjectForm placeholder exists at the correct path
- Plan 04 (if any) can proceed — all PROJ UI requirements for table view are met

---
*Phase: 04-projects*
*Completed: 2026-03-03*
