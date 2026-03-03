# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** Phase 4 — Projects (Plans 01 + 03 complete — data layer + ProjectsTable + export ready)

## Current Position

Phase: 04-projects
Plan: 3/4 (04-01, 04-03 complete — data layer + ProjectsTable + export; 04-02 ProjectForm full build pending)
Status: Active execution — Phase 4 Plan 03 complete. Next: Plan 02 (ProjectForm full build — full 7-section form).
Last activity: 2026-03-03 — 04-03 executed: ProjectsTable, projects page, ProjectForm placeholder, /api/export Route Handler

Progress: [███████████████] 80% (Phase 3 + 03.1 complete — Phase 4 Plans 01+03/4 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 11 (Phase 1: 4, Phase 2: 2, Phase 3: 2, Phase 03.1: 3, Phase 4: 1 — 04-01)
- Average duration: ~5.5 min
- Total execution time: ~65 min (01-01: 6 min, 01-02: ~6 min, 01-03: ~3 min, 01-04: ~6 min, 02-01: ~7 min, 02-02: ~10 min, 03-01: ~4 min, 03-02: ~5 min, 03.1-01: ~3 min, 03.1-02: ~5 min, 03.1-03: ~5 min, 04-01: ~5 min)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation    | 4/4 | ~21 min | ~5 min |
| 02-employees     | 2/2 | ~17 min | ~8 min |
| 03-access-control | 3/3 | ~9 min  | ~4.5 min |
| 03.1-security-hardening | 3/3 COMPLETE | ~13 min | ~4 min |
| 04-projects | 3/4 | ~9 min | ~4.5 min |

**Recent Trend:**
- Last 5 plans: 03.1-03 (admin-only RLS on user_permissions), 04-01 (projects data layer + migration + leaflet), 04-03 (ProjectsTable + projects page + /api/export)
- Trend: Phase 4 active. Plans 01+03 complete — data layer + admin UI table + universal export route.

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
- [03-03]: requirePermission() throws Error — caught by Server Action error boundary; no return value needed
- [03-03]: getNavPermissions() / checkPagePermission() / requirePermission() built in dal.ts — infrastructure for future ChemoSys module pages
- [03-03]: Bootstrap admin (no public.users row) bypasses all permission checks — safe fallback for initial setup
- [03-03 CORRECTION 2026-03-03]: Admin interface is Sharon-only — permission enforcement removed from admin shell (layout, sidebar, Server Actions, pages). All functions preserved in dal.ts for future ChemoSys use.
- [ARCHITECTURE]: Admin interface (ChemoSystem) ≠ ChemoSys application. ChemoSys is a future separate system. Users and permissions managed here are for ChemoSys modules (fleet, equipment, etc.), not for this admin shell.
- [03.1-01]: next@16.1.6 is already latest stable — CVE-2025-55183/67779 fix confirmed included (16.0.10 was the fix for 16.0.x line; 16.1.x carries the fix forward)
- [03.1-01]: Static CSP chosen over nonce-based — nonces force all pages to dynamic rendering; admin panel has no third-party scripts so static + unsafe-inline is correct
- [03.1-01]: HSTS only in production via isDev guard — prevents localhost HTTPS lockout in development
- [03.1-01]: No Google Fonts CDN in CSP — Heebo served locally via next/font/google; fonts.googleapis.com and fonts.gstatic.com are never hit at runtime
- [03.1-01]: server-only as first import in dal.ts — prevents accidental client bundle inclusion of session verification logic
- [03.1-02]: Rate limiting in auth.ts (Node.js runtime), NOT proxy.ts (Edge Runtime) — Edge resets module-level Map on every request
- [03.1-02]: Rate limit check BEFORE signInWithPassword — blocks Supabase Auth hits from brute-force
- [03.1-02]: logout() excluded from rate limiting — requires active session, cannot be brute-forced
- [03.1-02]: PII-safe logging pattern: err instanceof Error ? err.message : 'Unknown error' — never dump raw error objects
- [03.1-02]: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY generated with crypto.randomBytes(32).toString(base64) — consistent across deploys
- [03.1-03]: user_permissions write policies renamed with _admin suffix — avoids naming conflicts if DROP POLICY IF EXISTS fails silently
- [03.1-03]: user_permissions SELECT policy left permissive — reads are harmless; get_user_permissions() SECURITY DEFINER is the real guard
- [03.1-03]: RLS admin gate pattern: EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND is_admin = true AND deleted_at IS NULL)
- [03.1-03]: Bootstrap admin (no public.users row) unaffected — createAdminClient() service role key bypasses RLS entirely
- [Phase 4 REVERT 2026-03-03]: Phase 4 code reverted — Sharon provided updated requirements with significant field changes (attendance clocks table, client logo upload, supervision contact, conditional CVC entry, map with radius, CSV export)
- [Phase 04-projects]: react-leaflet v5 chosen — latest stable, React 19 compatible
- [Phase 04-projects]: project_number sent as empty string on INSERT — DB trigger fills in PR26XXXXXX format
- [Phase 04-projects]: attendance_clocks managed via replace-all in updateProject (same pattern as employee_role_tags)

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Security Hardening (URGENT) — security baseline required before deployment: security headers, password policy, rate limiting on login, session timeout, migration 00012
- Phase 4 re-planning: Sharon's updated requirements add attendance clocks (child table), client logo upload, supervision contact details, conditional CVC (employee or free text), map+radius for location, CSV/Excel export from all tables

### Pending Todos

- Apply migration 00004_employee_import_function.sql in Supabase SQL editor before testing import flow

### Blockers/Concerns

- [Phase 2 checkpoint]: Migration 00004 must be applied manually in Supabase SQL editor — upsert_employee() RPC will not exist until then
- [Phase 5]: Research cPanel API capabilities for config.ini read/write before Phase 5 planning
- [Phase 4]: Map integration decision needed — react-leaflet (free) vs Google Maps (paid API key) vs interactive map skill
- [04-03]: SidebarNav already uses usePathname() — no CURRENT_PHASE gate, projects tab active automatically
- [04-03]: ProjectForm placeholder created to unblock Plan 03 TypeScript (full 7-section form is Plan 02 scope)
- [04-03]: Universal export Route Handler pattern: ALLOWED_TABLES whitelist + verifySession + ExcelJS RTL + Buffer (as any) cast

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 04-projects-03-PLAN.md — ProjectsTable + projects page + /api/export Route Handler
Resume file: None
