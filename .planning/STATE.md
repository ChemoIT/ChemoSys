# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** Phase 3 — Access Control (Templates CRUD done, User management done, starting /admin/users nav link)

## Current Position

Phase: 3 of 5 (Access Control)
Plan: 2 of 3 complete (03-01 Templates CRUD done, 03-02 User management done)
Status: 03-02 complete — full user lifecycle: create/block/unblock/delete + permission matrix with template assignment
Last activity: 2026-03-03 — Phase 3 Plan 02 executed (User CRUD + auth admin integration + permission matrix)

Progress: [██████░░░░] 55% (Phase 2 done, Phase 3 Plans 01+02 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (Phase 1: 4, Phase 2: 2 full, Phase 3: 2)
- Average duration: ~6 min
- Total execution time: ~47 min (01-01: 6 min, 01-02: ~6 min, 01-03: ~3 min, 01-04: ~6 min, 02-01: ~7 min, 02-02: ~10 min, 03-01: ~4 min, 03-02: ~5 min)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation    | 4/4 | ~21 min | ~5 min |
| 02-employees     | 2/2 | ~17 min | ~8 min |
| 03-access-control | 2/3 | ~9 min  | ~4.5 min |

**Recent Trend:**
- Last 5 plans: 02-02 (Excel import wizard + RPC), 03-01 (Role Templates + permission matrix), 03-02 (User CRUD + auth admin API + permission matrix)
- Trend: On track, Phase 3 averaging ~4.5 min/plan due to established patterns

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
- [03-01]: Native <input type="radio"> used instead of shadcn RadioGroup — radios must write to FormData natively for Server Actions
- [03-01]: Delete-all + insert pattern for template_permissions on every save — only levels > 0 stored; absence = no access
- [03-01]: proxy.ts export renamed from middleware() to proxy() for Next.js 16.1.6 API requirement (auto-fixed, blocking build)
- [03-02]: Two-phase atomic createUser with rollback — auth.admin.createUser first, if DB insert fails hard-delete auth user to prevent orphaned accounts
- [03-02]: softDeleteUser: soft-delete public.users + hard-delete auth.users (frees email for reuse); auth delete failure is logged but does not fail the operation
- [03-02]: blockUser uses ban_duration=87600h (10 years) — Supabase has no permanent ban concept
- [03-02]: assignTemplate preserves is_override=true user_permissions — manual overrides survive template re-assignment
- [03-02]: Lucide icon title prop removed (LucideProps type constraint) → aria-label used instead (auto-fix Rule 1)
- [03-02]: Supabase join returns array type; double cast via unknown for foreign key relation in page.tsx (auto-fix Rule 1)

### Pending Todos

- Apply migration 00004_employee_import_function.sql in Supabase SQL editor before testing import flow

### Blockers/Concerns

- [Phase 2 checkpoint]: Migration 00004 must be applied manually in Supabase SQL editor — upsert_employee() RPC will not exist until then
- [Phase 5]: Research cPanel API capabilities for config.ini read/write before Phase 5 planning
- [Phase 4]: Decide react-leaflet vs Google Maps for project coordinates at Phase 4 planning time

## Session Continuity

Last session: 2026-03-03
Stopped at: 03-02 complete — awaiting continuation to 03-03 (sidebar nav link for /admin/users + access control finalization)
Resume file: None
