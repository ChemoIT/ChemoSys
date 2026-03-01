# Project Research Summary

**Project:** ChemoSys — מערכת ניהול פנימית לחמו אהרון
**Domain:** Internal enterprise admin panel (HR + project + user management)
**Researched:** 2026-03-01
**Confidence:** HIGH for core decisions; MEDIUM for ecosystem libraries

## Executive Summary

ChemoSys is a Hebrew-first, RTL internal admin panel for Chemo Aharon Ltd., an energy infrastructure contractor operating multiple legal entities. The system must manage employees across companies, import/export data from an existing payroll system, enforce granular permissions per user, and track all mutations for compliance — all in Hebrew. Research confirms this is a well-understood domain (enterprise admin panels), but the combination of RTL Hebrew, multi-company soft-delete semantics, composite key Excel matching, and a custom RBAC system makes this moderately complex to implement correctly. The recommended approach is Next.js 15.x App Router + Supabase + Vercel (pre-decided constraints), with shadcn/ui for RTL-tunable components, TanStack Table for data tables, React Hook Form + Zod for validation, and ExcelJS for RTL-aware Excel handling.

The critical architectural insight is that this system must be built security-first. Permissions must be enforced server-side on every mutation (not just in the UI), the Supabase service role key must never reach the browser, and RTL layout must be configured from Day 1 — retrofitting RTL into a system built LTR is expensive. The permission system design (template-based with per-user overrides) is the most architecturally complex piece and must be implemented early because every subsequent module depends on it.

The top risks are: (1) RLS policies creating infinite recursion on the permissions table — use a SECURITY DEFINER function; (2) Vercel function timeout on Excel bulk import — use batch upsert, not row-by-row; (3) soft delete conflicting with unique constraints — use partial unique indexes from Day 1. Address all three before writing any feature code. The phased build order from architecture research is well-reasoned: auth and DB schema first, permission infrastructure second, then reference data (companies, departments), then the core employee module, then users and access control, then projects, and finally settings and observability.

---

## Key Findings

### Recommended Stack

The stack is constrained at the infrastructure level (Next.js + Supabase + Vercel) and research focused on what to add on top. Next.js 15.2 (App Router, React 19) is confirmed stable with `middleware.ts` renamed to `proxy.ts` in Next.js v16 — verify version at implementation time. The `@supabase/ssr` package is the current standard for auth; the old `@supabase/auth-helpers-nextjs` is deprecated and must not be used. Tailwind CSS v4.1 is scaffolded by default with `create-next-app`; its `rtl:/ltr:` modifiers activate automatically when `dir="rtl"` is set on `<html>`.

**Core technologies:**
- **Next.js 15.x + React 19:** Full-stack framework with App Router; Server Components reduce client-side state management complexity significantly
- **@supabase/ssr:** Current auth package for Next.js App Router; replaces deprecated auth-helpers — use `createServerClient` in Server Components, `createBrowserClient` in Client Components
- **Tailwind CSS v4.1:** RTL support via logical utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`); set `dir="rtl"` on `<html>` from Day 1
- **shadcn/ui:** Component source is owned by the project — essential for RTL since physical CSS properties in components can be manually overridden
- **TanStack Table v8:** Headless MIT-licensed table engine; compose with shadcn/ui Table component; supports server-side pagination for large employee datasets
- **React Hook Form v7 + Zod v3 + @hookform/resolvers:** Official Next.js recommendation for form validation; Zod schemas double as TypeScript types
- **ExcelJS v4:** Server-side only; RTL worksheet support (`rightToLeft: true`); Hebrew column headers; use `iconv-lite` if payroll system exports legacy CSV in Windows-1255
- **Heebo font:** Load via `next/font/google` with `subsets: ['hebrew', 'latin']` and `display: 'swap'`; prevents CLS and ensures consistent Hebrew rendering

**Skip:** Redux/React Query (Server Components handle server state), AG Grid (GPL), MUI DataGrid (conflicts with Tailwind), NextAuth.js (Supabase Auth is already in stack), Zustand (only introduce if prop drilling becomes a real problem).

### Expected Features

Research identified a clear feature hierarchy based on build dependencies and operational priority for an Israeli energy infrastructure firm.

**Must have (table stakes):**
- Employee list with search + filter by company, department, status, role tag
- Employee profile CRUD with soft delete (never hard delete)
- Excel import from payroll system with composite key matching (employee_number + company_id)
- Excel export matching import column structure
- Company and Department CRUD (prerequisites for everything else)
- User account management (one user linked to one employee)
- Role-based permissions at module level (no access / read / read+write)
- Role templates (predefined permission sets with per-user overrides)
- Login + session management via Supabase Auth
- Audit log capturing every create/update/delete with actor + before/after JSON
- RTL Hebrew UI throughout
- Dashboard with summary stats
- Project list with status tracking and manager linkage

**Should have (differentiators for ChemoSys):**
- Excel import preview with conflict resolution UI before committing (prevents silent data corruption)
- Granular per-user permission overrides on top of role templates
- Composite employee key (employee_number + company_id) mirroring payroll system logic
- Audit log with before/after JSON diff (not just "what changed" but "what the old value was")
- Per-module nav visibility — users only see tabs they can access
- Map view for project coordinates (react-leaflet, deferred to Phase 4)
- Role tag system (many-to-many, cross-department tags like "safety officer")

**Defer to v2+:**
- Real-time chat/messaging (WhatsApp/n8n handles field comms)
- Payroll calculation engine (ChemoSys is downstream of payroll, not a payroll replacement)
- Time tracking/attendance
- Document/file attachment storage (adds S3 infrastructure complexity)
- Email notification system
- Native mobile app (responsive web covers the need)
- AI-generated reports (build accurate data model first)

**Hard anti-features:**
- Hard delete of any record (destroys audit trail — all deletes must be soft)
- Public-facing pages (all routes require auth)

### Architecture Approach

The architecture follows a strict server-first pattern: Server Components fetch data, Client Components handle interactivity, Server Actions handle mutations. The key structural elements are route groups separating auth from admin layouts, a Data Access Layer (`lib/dal.ts`) centralizing auth and permission verification, a server-only permissions resolution function (`lib/permissions.ts`), and a `writeAuditLog` utility called from every mutation Server Action. The permission system is data-driven from a `modules` table, making new modules (e.g., fleet vehicles) addable without touching permission infrastructure — just add a row to `modules` and create route/component/action files.

**Major components:**
1. **`proxy.ts` (auth guard):** Optimistic cookie check only — redirect unauthenticated users; no DB permission queries here
2. **`lib/dal.ts` (Data Access Layer):** Authoritative session verification via `supabase.auth.getUser()`; loads permission matrix; used by all Server Components and Actions
3. **`lib/permissions.ts`:** Resolves user permissions by merging template defaults with individual overrides; results cached with `React.cache()` per request
4. **`lib/audit.ts`:** Server-side audit log writer called from every mutation
5. **`actions/*.ts` (Server Actions):** Every mutation follows auth → permission check → Zod validation → DB write → audit log → revalidatePath
6. **`app/(admin)/*` route group:** Server Component pages per module tab; shares sidebar layout
7. **Supabase schema:** Universal columns (`id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`) on all tables; partial unique indexes for soft-delete compatibility; trigger-based `updated_at` automation; `SECURITY DEFINER` function for permission lookups to avoid RLS recursion

**Key DB schema decisions:**
- `modules` table (seeded, data-driven sidebar and permission matrix)
- `permission_templates` + `template_permissions` (named permission sets)
- `user_permissions` (per-user overrides, merged on top of template)
- `audit_log` with JSONB `old_data` and `new_data` columns (indexed on entity_type, entity_id, created_at)
- Partial unique index: `CREATE UNIQUE INDEX ON employees (employee_number, company_id) WHERE deleted_at IS NULL`

### Critical Pitfalls

Research identified 8 critical pitfalls and 7 moderate pitfalls. The most important to address before writing any feature code:

1. **RLS infinite recursion on permissions table** — Write a `SECURITY DEFINER` function `get_user_permissions(p_user_id)` that bypasses RLS; never query `user_permissions` inside an RLS policy on `user_permissions`. Address in Phase 1.

2. **Service role key exposed to browser** — `SUPABASE_SERVICE_ROLE_KEY` must never have the `NEXT_PUBLIC_` prefix. Add a CI/pre-commit grep check. Address in Phase 1.

3. **Deprecated `@supabase/auth-helpers-nextjs`** — Use `@supabase/ssr` exclusively. All tutorials showing `createClientComponentClient` / `createServerComponentClient` are outdated. Address in Phase 1.

4. **RTL layout broken by physical CSS properties** — Use logical Tailwind utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) from Day 1. Set `dir="rtl"` on `<html>` immediately. Develop in RTL mode from the first component. Address in Phase 1.

5. **Soft delete conflicts with UNIQUE constraints** — Use partial unique indexes (`WHERE deleted_at IS NULL`) instead of standard UNIQUE constraints. Address in DB schema before creating any table.

6. **Vercel function timeout on Excel bulk import** — Use `supabase.upsert([...all rows])` in a single call, not per-row loop. Consider Vercel Pro (60s limit) or Supabase Edge Functions. Parse Excel client-side to reduce server processing time. Address during Phase 2 design.

7. **Permission checks client-side only** — Every Server Action must call `requirePermission(module, level)` before executing. UI hiding is UX, not security. Address in Phase 1 pattern definition.

8. **`getSession()` trusted in Server Components** — Always use `supabase.auth.getUser()` (round-trips to verify JWT) in all server contexts. `getSession()` reads the cookie without verification — a crafted cookie can spoof auth. Address in Phase 1.

---

## Implications for Roadmap

Based on the dependency graph from FEATURES.md and the build order from ARCHITECTURE.md, a 5-phase roadmap is recommended. Pitfalls inform which concerns must be addressed within each phase before moving forward.

### Phase 1: Foundation — Auth, DB Schema, RTL Shell

**Rationale:** Every subsequent feature depends on auth working correctly, the DB schema being correct from the start (soft delete, partial indexes, triggers, RLS), and the RTL layout being established before components are built. Retrofitting any of these is expensive.

**Delivers:** Working login/logout, protected routes, correct DB schema with all universal columns and triggers, RTL admin shell with sidebar, and the permission evaluation infrastructure.

**Addresses:** Auth (login, session, logout), RTL UI foundation, Dashboard (basic), Companies CRUD, Departments CRUD, Role Tags CRUD — the simplest entities with no foreign dependencies.

**Avoids:** Pitfalls 1, 2, 3, 4, 5, 7, 8, 10, 12, 13, 14, 17 — all of which must be addressed before or during schema/auth setup.

**Research flag:** Standard patterns — no additional research needed. Auth + Supabase + Next.js patterns are well-documented.

---

### Phase 2: Data Operations — Excel Import and Export

**Rationale:** Payroll integration via Excel is the primary operational pain point for ChemoSys. It depends on the employee model being stable (Phase 1 establishes companies and departments). This phase is isolated enough to build independently of the permission system.

**Delivers:** Excel import with composite key matching, conflict detection preview UI, import confirmation step, Excel export. Import history log.

**Addresses:** Excel import (with encoding handling for Hebrew Windows-1255), export matching import columns, composite key (employee_number + company_id) matching, import preview before commit.

**Avoids:** Pitfalls 7 (Vercel timeout — batch upsert), 9 (Hebrew dates/encoding — `cellDates: true`, `codepage: 1255`), 15 (silent composite key mismatches — preview step required).

**Research flag:** Needs implementation-time research. Test with real payroll export files before building import logic. Composite key mapping from Excel company codes to DB company_id UUIDs needs a configuration mapping step — design this upfront.

---

### Phase 3: Access Control — Users and Permissions

**Rationale:** The permission system can only be properly built after the employee model is stable (users are linked to employees). Permission templates and module registry are pre-seeded from Phase 1, so the infrastructure is ready — this phase builds the management UI.

**Delivers:** User account creation (linked to employees + Supabase Auth), role template CRUD, per-user permission override UI (permission matrix grid), nav visibility driven by resolved permissions.

**Addresses:** User management, role templates, granular permission overrides, module-level nav visibility control.

**Avoids:** Pitfall 8 (server-side permission enforcement — the `requirePermission()` utility established in Phase 1 is already in use by this phase), Pitfall 12 (Auth user lifecycle — define disable/delete flow before building the UI).

**Research flag:** Standard patterns — the permission system architecture is defined in ARCHITECTURE.md with full SQL schema and resolution logic. No additional research needed.

---

### Phase 4: Projects and Operational Layer

**Rationale:** Projects reference employees as managers (FK to employees table), so the employee module must be complete first. Map view for project coordinates is the only component with an external library dependency (react-leaflet) that is deferred until here.

**Delivers:** Projects CRUD with status tracking (planning / active / on-hold / completed), manager assignment (employee FK), project-employee linkage, optional map view for geo-located infrastructure sites.

**Addresses:** Project management, status tracking, map view for coordinates, employee-project relationships.

**Avoids:** Pitfall 19 (next/image external domain config for ch-ah.info assets, and react-leaflet SSR issue requiring `dynamic()` with `ssr: false`).

**Research flag:** Map library choice needs validation. react-leaflet is free (OpenStreetMap) and sufficient for "view on map". If satellite imagery of infrastructure sites is required by users, Google Maps (`@vis.gl/react-google-maps`) should be evaluated — has a cost. Decide at Phase 4 planning time.

---

### Phase 5: Settings, Observability, and Polish

**Rationale:** System settings and the config.ini Route Handler are standalone (no feature dependencies). The audit log viewer reads accumulated data from prior phases. Dashboard enhancements are safe to defer because the data model must be mature before meaningful aggregates can be computed.

**Delivers:** System settings panel, config.ini read/write via cPanel FTP Route Handler, full audit log viewer (filterable by user, entity, date range), enhanced dashboard with aggregate stats and recent activity, loading skeletons, error boundaries, mobile/tablet responsive pass.

**Addresses:** Audit log viewer, dashboard enhancements, config management, error handling polish.

**Avoids:** Pitfall 6 (audit log performance — paginate all audit queries, use indexes; if volume grows with fleet module later, consider monthly partitioning).

**Research flag:** config.ini Route Handler accessing cPanel FTP needs research at implementation time. cPanel API vs direct FTP vs file system access — verify what `ch-ah.info` cPanel exposes. This is the one non-standard integration in the system.

---

### Phase Ordering Rationale

- **Auth before everything:** All Server Actions require `verifySession()` and permission checks. Building features before auth is working produces code that must be retrofitted.
- **DB schema before features:** Soft delete, partial indexes, triggers, and RLS must be set up correctly before any table is created — these cannot be retrofitted cheaply.
- **RTL from Day 1:** Switching from LTR to RTL mid-development requires touching every component with directional CSS. Set `dir="rtl"` on the first commit.
- **Permission infrastructure before modules:** The permission check pattern (`requirePermission()` in every Server Action) must be established before any module is built — or those modules will lack server-side protection.
- **Reference data before employees:** Companies and departments are FK prerequisites for the employees table.
- **Employees before users:** Users are linked to employees; the employee model must be stable.
- **Employees before projects:** Projects reference employees as managers.
- **Everything before the audit viewer:** The audit log viewer is read-only and reads data accumulated by all prior phases.

---

### Research Flags

**Needs research during planning:**
- **Phase 2 (Excel import):** Test with real payroll export files before writing import logic. The company code → `company_id` mapping is project-specific and needs a configuration design decision.
- **Phase 4 (Map view):** Decide between react-leaflet (free, OpenStreetMap) vs Google Maps (paid, better satellite) based on actual user need for infrastructure site visibility.
- **Phase 5 (config.ini):** Research cPanel API capabilities for reading/writing config files on ch-ah.info hosting before designing the Route Handler.

**Standard patterns (skip deep research):**
- **Phase 1:** Next.js + Supabase auth patterns are thoroughly documented and consistent.
- **Phase 3:** Permission system architecture is fully defined in ARCHITECTURE.md with SQL schemas and TypeScript patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core framework choices verified against official Next.js 15.2 release notes, Tailwind v4.1 blog, and Next.js auth docs. Note: Next.js v16 renamed `middleware.ts` to `proxy.ts` — ARCHITECTURE.md includes this; verify exact version used at install time. |
| Features | MEDIUM | Based on domain expertise + project context from PROJECT.md. No user interviews or usage analytics available. Feature priority is inferred, not validated with actual users. |
| Architecture | HIGH | Architecture patterns sourced from official Next.js docs (DAL pattern, optimistic proxy pattern, Server Action pattern). DB schema patterns are standard PostgreSQL. |
| Pitfalls | HIGH | Most pitfalls are well-documented in official Supabase/Next.js docs and community post-mortems. Excel/Hebrew encoding and composite key matching are MEDIUM (more project-specific). |

**Overall confidence:** HIGH for technical decisions; MEDIUM for feature prioritization pending user validation.

### Gaps to Address

- **Excel company code mapping:** The payroll system exports a company code or name in Excel. How this maps to `company_id` UUIDs in the DB is undefined. Needs a configuration design (mapping table? wizard step? hardcoded?) before Phase 2 begins.

- **Actual payroll export format:** Research assumed `.xlsx` with standard column structure. The real export format (column names in Hebrew, date formats, company identifiers) must be obtained from the payroll system before Phase 2 implementation. Get a sample file early.

- **Next.js version — middleware vs proxy:** ARCHITECTURE.md states Next.js v16 renamed `middleware.ts` to `proxy.ts`. STACK.md references Next.js 15.2. These may conflict depending on actual installed version. Verify at scaffold time: `npx next --version`.

- **config.ini access method:** Phase 5 includes a Route Handler to read/write config.ini on cPanel hosting. The exact access mechanism (cPanel API, FTP, SSH, or file served via web) is not defined. Research this before Phase 5 planning.

- **Feature validation:** The feature list is research-derived. Before Phase 3 (access control) is built, validate the permission model with Sharon — specifically: what does a typical "project manager" permission set look like? Are there department heads with partial access? Is there a super-admin role?

---

## Sources

### Primary (HIGH confidence)
- https://nextjs.org/blog/next-15-2 — Next.js 15.2 stable release (verified 2026-03-01)
- https://nextjs.org/docs/app/getting-started/installation — Node.js 20.9+ minimum requirement
- https://nextjs.org/docs/app/guides/authentication — DAL pattern, Zod validation, Server Action security
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy — proxy.ts (formerly middleware.ts, renamed in v16)
- https://tailwindcss.com/blog — Tailwind CSS v4.1 stable (2025-04-03)
- https://tailwindcss.com/docs/hover-focus-and-other-states — RTL logical utilities

### Secondary (MEDIUM confidence)
- Supabase official migration guide — `@supabase/ssr` replacing deprecated `auth-helpers-nextjs`
- ExcelJS GitHub docs — RTL worksheet (`rightToLeft: true`) and Hebrew column support
- TanStack Table v8 — ecosystem position as Next.js community recommendation
- react-leaflet — SSR workaround (`dynamic()` with `ssr: false`)
- Community pattern: permission system with SECURITY DEFINER to avoid RLS recursion

### Tertiary (LOW confidence / verify at implementation)
- ExcelJS `rightToLeft` worksheet property — verify in current v4 docs at implementation time
- Heebo `hebrew` subset availability in `next/font/google` — verify at install time
- Next.js v16 `proxy.ts` rename — verify exact version installed before using this convention

---

*Research completed: 2026-03-01*
*Ready for roadmap: yes*
