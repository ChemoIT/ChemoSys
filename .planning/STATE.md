# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** Phase 2 — Employee CRUD + Excel Import built, awaiting human verification checkpoint

## Current Position

Phase: 2 of 5 (Employees) — CHECKPOINT PENDING
Plan: 2 of 2 automated tasks complete — awaiting Task 3 human-verify checkpoint
Status: 02-02 automated tasks done — RPC migration must be applied in Supabase SQL editor before testing import
Last activity: 2026-03-01 — Phase 2 Plan 02 executed (Excel import: migration, wizard, route)

Progress: [████░░░░░░] 30% (automated tasks done; checkpoint pending)

## Performance Metrics

**Velocity:**
- Total plans completed: 5 (+ 02-02 automated tasks, checkpoint pending)
- Average duration: ~7 min
- Total execution time: ~38 min (01-01: 6 min, 01-02: ~6 min, 01-03: ~3 min, 01-04: ~6 min, 02-01: ~7 min, 02-02: ~10 min)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4/4 | ~21 min | ~5 min |
| 02-employees  | 1/2 full + 1 checkpoint | ~17 min  | ~8 min  |

**Recent Trend:**
- Last 5 plans: 01-03 (auth + admin shell), 01-04 (Companies/Departments/RoleTags CRUD), 02-01 (Employee CRUD — 22 fields), 02-02 (Excel import wizard + RPC)
- Trend: On track, feature plans averaging ~7-10 min

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Use @supabase/ssr exclusively — auth-helpers-nextjs is deprecated
- [Pre-Phase 1]: Set dir="rtl" on <html> from Day 1 — retrofitting RTL is expensive
- [Pre-Phase 1]: All UNIQUE constraints must be partial (WHERE deleted_at IS NULL) for soft-delete compatibility
- [Pre-Phase 1]: Use SECURITY DEFINER function for permission lookups to prevent RLS recursion
- [Pre-Phase 1]: Always use supabase.auth.getUser() in server contexts — getSession() is unverified
- [01-01]: Manual scaffold used (not create-next-app) — directory name ChemoSystem has capitals which block npm naming validation
- [01-01]: sonner used instead of deprecated toast component (shadcn/ui latest recommendation)
- [01-01]: Browser Supabase client implemented as singleton to prevent duplicate connections
- [01-01]: proxy.ts at project root (not middleware.ts) — Next.js 16 auth guard convention
- [01-02]: RLS UPDATE policies use USING (true) — allows soft-delete UPDATEs that set deleted_at (Pitfall 9)
- [01-02]: Phase 1 RLS permissive for authenticated users — business logic enforced in Server Actions
- [01-02]: All future-proofing stubs (employees, projects, users) created now so FK relationships are ready
- [Phase 01-foundation]: getClaims() in verifySession — fast local JWT check, O(1), no network; proxy.ts uses getUser() for token refresh but DAL can use getClaims()
- [Phase 01-foundation]: React cache() wraps verifySession — deduplicates JWT verification across nested layouts per request
- [Phase 01-foundation]: SidebarNav as client component inside server Sidebar — only nav needs usePathname(), rest stays SSR
- [01-04]: No Zod .transform() in DepartmentSchema — zodResolver type conflict with React Hook Form v7; null coercion moved to Server Action
- [01-04]: DeleteConfirmDialog uses Dialog (not AlertDialog) — AlertDialog not in installed components; Dialog provides identical UX
- [01-04]: Hidden inputs alongside shadcn/ui Select — Select.onValueChange does not write to FormData; hidden inputs required for Server Action access
- [01-04 checkpoint]: Department form simplified per user request — company_id and parent_dept_id removed from UI, company auto-assigned server-side
- [01-04 checkpoint]: Table component RTL fix — text-left → text-start, pr-0 → pe-0
- [02-01]: zodResolver cast (as any) for EmployeeForm — Zod v4 .default()/.optional() variance with RHF (same established [01-04] pattern)
- [02-01]: Multi-filter toolbar pre-processes raw data array before TanStack Table — simpler than setFilterValue with join data
- [02-01]: EmployeesTable does not reuse DataTable.tsx — multi-filter toolbar not supported by DataTable
- [02-01]: CURRENT_PHASE advanced 1 → 2 in SidebarNav — employees nav item now active
- [02-02]: experimental.serverActions.bodySizeLimit in next.config.ts — Next.js 16 places serverActions under experimental, not top-level in NextConfig type
- [02-02]: Buffer.from() + (as any) cast for ExcelJS — @types/node v22 Buffer<ArrayBuffer> vs exceljs types Buffer (non-generic) version mismatch; runtime-safe
- [02-02]: audit log uses INSERT + entity_type='employee_import' — IMPORT is not a valid action enum value; distinct entity_type preserves audit trail query-ability

### Pending Todos

- Apply migration 00004_employee_import_function.sql in Supabase SQL editor before testing import flow

### Blockers/Concerns

- [Phase 2 checkpoint]: Migration 00004 must be applied manually in Supabase SQL editor — upsert_employee() RPC will not exist until then
- [Phase 5]: Research cPanel API capabilities for config.ini read/write before Phase 5 planning
- [Phase 4]: Decide react-leaflet vs Google Maps for project coordinates at Phase 4 planning time

## Session Continuity

Last session: 2026-03-01
Stopped at: 02-02 Task 3 checkpoint (human-verify) — automated tasks 1+2 complete, awaiting Sharon's verification of Phase 2 employee module
Resume file: None
