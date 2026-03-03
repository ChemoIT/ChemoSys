# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** ALL PHASES COMPLETE ✓ — Milestone v1.0 ready for completion

## Current Position

Phase: 05-settings-observability ✅ COMPLETE + VERIFIED (13/13) + GAP CLOSURE (05-04)
Plan: 4/4 — all plans complete + verification passed + UAT gaps closed
Status: All 5 phases + 03.1 complete + UAT gap closure complete. Milestone v1.0 ready for `/gsd:complete-milestone`.
Last activity: 2026-03-04 — UAT gap closure: user names + entity names now show as real names in activity feed, audit log, and export.

Progress: [████████████████████] 100% — ALL PHASES COMPLETE

## Performance Metrics

**Velocity:**
- Total plans completed: 17 (Phase 1: 4, Phase 2: 2, Phase 3: 2, Phase 03.1: 3, Phase 4: 3, Phase 5: 3)
- Average duration: ~5.5 min
- Total execution time: ~92 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation    | 4/4 | ~21 min | ~5 min |
| 02-employees     | 2/2 | ~17 min | ~8 min |
| 03-access-control | 3/3 | ~9 min  | ~4.5 min |
| 03.1-security-hardening | 3/3 COMPLETE | ~13 min | ~4 min |
| 04-projects | 3/3 COMPLETE ✓ | ~20 min | ~7 min |
| 05-settings-observability | 4/4 COMPLETE ✓ | ~52 min | ~13 min |

**Recent Trend:**
- Phase 5 completed: Dashboard, Audit Log Viewer, Integration Settings all live
- AuditLogTable.tsx was missing from working tree (post-Plan-02 deletion) — restored from git history (Rule 3 auto-fix)

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
- [Phase 04-projects]: project_number editable — auto-gen PR26XXXXXX only if field left empty
- [Phase 04-projects]: attendance_clocks managed via replace-all in updateProject (same pattern as employee_role_tags)
- [04-02]: EmployeeCombobox uses custom filter function on Command — cmdk default filters on value prop (UUID) not label; custom filter matches first_name+last_name+employee_number
- [04-02]: ProjectLocationPicker loaded via dynamic(ssr:false) — Leaflet accesses window at import time, crashes SSR if imported directly
- [04-02]: Duplicate clock ID client-side check in handleSubmit before Server Action — prevents raw DB unique constraint error
- [04-02]: ProjectForm replaces Plan 03 placeholder with full 7-section implementation (962 lines) — ProjectsTable props interface unchanged
- [04-FIX]: cvc_name column added (migration 00015) — CVC free-text mode requires both name and phone
- [04-FIX]: Phone format 05x-xxxxxxx via formatIsraeliPhone helper — normalizes employee phone on auto-fill
- [04-FIX]: Logo upload uses existing browser.ts singleton — NOT inline createBrowserClient with wrong env var
- [04-FIX]: Logo drag-and-drop with visual feedback on dragover
- [04-FIX]: Logo upload failure does not block form submission — project saved without logo
- [05-01]: Two-step user name resolution for audit_log: audit_log.user_id → auth.users(id), NOT public.users; must query public.users WHERE auth_user_id IN (distinct_user_ids) and merge via Map
- [05-01]: 7 parallel queries in DashboardPage via Promise.all — 6 entity counts + 1 audit_log fetch, fresh load on every visit with no caching
- [05-01]: ActivityFeed uses formatDistanceToNow with date-fns/locale/he for Hebrew relative timestamps
- [05-02]: AuditLogTable is a dedicated component — DataTable.tsx does not support getExpandedRowModel and cannot be reused
- [05-02]: Server-side filtering via URL search params for audit log — scalable for large tables, aligns with "fresh load on every page visit" requirement
- [05-02]: Separate /api/export-audit Route Handler (not extending /api/export) — filter params via query string, clean separation of concerns
- [05-02]: Date filter UTC boundaries: gte 'T00:00:00.000Z', lte 'T23:59:59.999Z' to avoid timezone cutoff (Pitfall 6)
- [05-02]: Max 10,000 rows for audit export — prevents memory issues on large datasets
- [05-03]: env-settings uses process.env in-memory mutation after fs.writeFile — settings take effect immediately without restart; TypeScript requires (process.env as Record<string, string>)[key] cast
- [05-03]: Sensitive fields masked with first 4 chars + *** on server side; hasSavedXxx boolean sent to client for placeholder UX
- [05-03]: Empty password field on save = preserve existing env value (never overwrite with empty string)
- [05-03]: FTP test uses TCP socket via Node.js net module — no ftp library needed, checks host:port reachability with 5s timeout
- [05-03]: AuditLogTable.tsx was missing from working tree post-Plan-02 commit — restored via git checkout b121753 (Rule 3 auto-fix)
- [05-04]: Supabase FK join cast pattern: `u.employees as unknown as { first_name, last_name } | null` — Supabase types declare FK join as array; runtime returns single object for single FK; double cast via unknown is the safe pattern
- [05-04]: No deleted_at filter on entity/user name resolution lookups — historical audit entries must resolve names even after soft-delete
- [05-04]: async addLookup pattern: inner async function returns Promise<void> directly — avoids PromiseLike<void> type mismatch from .then() chaining in Promise<void>[] array
- [05-04]: Excel export includes both 'ישות' (human name) + 'UUID ישות' (raw UUID) columns — name for readability, UUID for debugging

### Roadmap Evolution

- Phase 03.1 inserted after Phase 3: Security Hardening (URGENT) — security baseline required before deployment: security headers, password policy, rate limiting on login, session timeout, migration 00012
- Phase 4 re-planning: Sharon's updated requirements add attendance clocks (child table), client logo upload, supervision contact details, conditional CVC (employee or free text), map+radius for location, CSV/Excel export from all tables

### Pending Todos

- Apply migration 00004_employee_import_function.sql in Supabase SQL editor before testing import flow

### Blockers/Concerns

None — all phases complete.

## Session Continuity

Last session: 2026-03-04
Stopped at: Phase 5 UAT gap closure complete (05-04-PLAN.md). All milestone phases + gap closure done.
Resume file: None
