# Project Research Summary

**Project:** ChemoSys v2.0 — Employee-Facing Operational Shell (Fleet + Equipment)
**Domain:** Internal fleet and heavy equipment management system for energy infrastructure company
**Researched:** 2026-03-04
**Confidence:** HIGH (architecture + pitfalls based on direct codebase analysis); MEDIUM (features + competitor analysis)

---

## Executive Summary

ChemoSys v2.0 is an employee-facing operational module built on top of the existing v1.0 admin panel. It introduces a new `(app)` route group into the same Next.js 16 + Supabase project, accessed by managers and field workers — not Sharon. The system replaces a 10-year-old Liberty Basic fleet management system with 16 fleet sub-modules and a heavy equipment (tzama) module. The v2.0 milestone is a shell-only build: the `(app)` route group, the shared header with module switcher, fleet and equipment home dashboards, and the 16 sub-module tiles. No sub-module content is built in v2.0 — that work is explicitly deferred to v2.1 through v2.15.

The recommended approach is maximum reuse of v1.0 infrastructure: the same Supabase Auth session, the same `dal.ts` permission functions (with targeted extensions), the same UI component library, and the same RTL Hebrew layout patterns. Only 2 new npm packages are needed (`recharts` + `qr-scanner`) plus 4 shadcn/ui components. The entire v2.0 shell can be built with surgical changes to 3 existing files (`proxy.ts`, `auth.ts`, `(admin)/layout.tsx`) and approximately 8 new files. The `modules` table in the DB is the only data change required — one new migration seeding 18 module keys.

The key risk is introducing the second user type (employee vs admin) into an existing system that was designed for a single user. Six critical pitfalls involve auth and permission routing: proxy.ts redirects, login Server Action redirect targets, admin layout bypassing employee sessions, getNavPermissions() leaking admin keys into the employee nav, missing `verifyAppUser()` guard, and module key namespace collisions. All six must be addressed in Phase 1 — before any employee-facing page is created. If even one is skipped, employees can land on the admin interface or admins can be blocked from the app. These are not performance issues; they are security and correctness gates.

---

## Key Findings

### Recommended Stack

The v1.0 stack requires no new packages for the shell infrastructure. Two npm packages are justified for v2.0 sub-module content: `recharts@^3.7.0` (dashboard charts, React 19 compatible, composable with shadcn/ui chart wrapper) and `qr-scanner@^1.4.2` (camera QR scanning for camp vehicle check-in — 5x lighter than alternatives, uses BarcodeDetector API natively). Four shadcn/ui components via CLI: `chart`, `tooltip`, `collapsible`, `navigation-menu`. Everything else — routing, permissions, forms, tables, auth, RTL, components — reuses v1.0 patterns without modification.

**Core technologies for v2.0 shell:**
- `recharts@^3.7.0`: Fleet/equipment dashboard charts — only React 19-compatible chart library with native shadcn/ui integration (verified npm 2026-03-04)
- `qr-scanner@^1.4.2`: Camp vehicle QR tracking — 524KB vs html5-qrcode's 2.6MB, requires `dynamic()` with `ssr: false`, HTTPS required in production
- `@radix-ui/react-tooltip`, `collapsible`, `navigation-menu`: New Radix primitives for AppHeader and module switcher — install via `npx shadcn@latest add`
- `next-themes` (already installed): Wire `ThemeProvider` and toggle button — zero-install feature unlock

**Do not install:** react-query, Redux/Zustand, i18n libraries, Chart.js, react-chartjs-2, html5-qrcode, or any state management beyond React state + Server Components.

### Expected Features

The fleet module replaces a legacy system that managers and field workers depend on daily. Users will immediately compare every workflow to what they could do in the Liberty Basic system. Missing any of the 12 table-stakes fleet features means the system feels like a downgrade.

**Must have (table stakes for v2.0 shell):**
- `(app)` route group with top-header layout and module switcher
- ChemoSys login/post-auth routing: admins to `/admin/dashboard`, employees to `/app`
- Fleet home: 6 stat cards (active projects live, others as placeholder zeros with "(בפיתוח)" label)
- Fleet sub-module grid: 16 tiles with Hebrew labels, Lucide icons, responsive layout (2-col mobile / 4-col desktop)
- Equipment home: placeholder tiles with "בפיתוח" label
- Permission wiring: `verifyAppUser()` in `(app)` layout, `checkPagePermission()` on each page
- DB migration 00016: 18 module keys seeded in `modules` table with `app_` prefix

**Should have (for sub-module milestones v2.1+):**
- Driver card (כרטיס נהג) — license categories, expiry dates per category, medical certificate
- Vehicle card (כרטיס רכב) — registration, type, ownership, assigned driver, assigned project
- Mileage management (ניהול ק"מ) — monthly report, driver submits, manager approves
- Fuel management (דלק) — fills per vehicle, consumption rate, abnormal consumption alerts
- Toll road management (כבישי אגרה) — Kvish 6 monthly billing reconciliation
- Traffic violations (דוחות תנועה) — fine log, liability transfer, deadline tracking
- Mechanical maintenance log (ספר טיפולים) — service history, next service date, cost
- Safety forms (טפסי בטיחות) — daily vehicle inspection, mobile-first, non-completion alerts
- Spare parts / tires (חלקי חילוף) — tire positions, parts inventory, cost attribution
- Exception tables (טבלאות חריגים) — configurable thresholds for all alert logic

**Should have (differentiators vs Liberty Basic, for future milestones):**
- EV charging tracking — Chemo Aharon has electric vehicles; fuel-equivalent cost tracking is unique
- Camp vehicle QR tracking — energy infrastructure camp model; replaces manual whiteboard at remote sites
- Rental car order management — approval workflow + booking tracking
- Document expiry alerts — 30/7/1 day warnings for regulatory documents (license, insurance, registration)
- Cost allocation to projects — fleet costs linked to `projects` table for project P&L

**Defer to v3+:**
- GPS tracking (requires vendor contract + hardware — Pointer, Matrix, or Ituran)
- WhatsApp/SMS notifications (design notification_log hooks in DB now; wire n8n later)
- Fuel card API import (Israeli providers have closed B2B APIs; use CSV for now)
- Priority/SAP ERP integration
- Native iOS/Android app (PWA covers 95% of use case)

### Architecture Approach

The `(app)` route group integrates into the existing project with minimal surgery to existing files. The architectural pattern is top-header layout (not sidebar) — correct for field-facing operational software on mobile. The existing `dal.ts` permission infrastructure works for ChemoSys module keys without modification; only a new `verifyAppUser()` function and a new `getAppNavPermissions()` function (filtering for `app_`-namespaced keys) need to be added. The `proxy.ts` middleware requires no changes since the shared `/login` handles both user types. The `(admin)` layout needs an `is_admin` guard added. The login Server Action needs post-login user-type branching.

**Major components for v2.0:**
1. `src/app/(app)/layout.tsx` — ChemoSys root layout: calls `verifyAppUser()` + `getAppNavPermissions()`, renders `AppHeader`
2. `src/components/app/AppHeader.tsx` — Top nav: CA logo, `ModuleSwitcher`, user email, logout (Client Component for `usePathname()`)
3. `src/components/app/FleetSubModuleGrid.tsx` — 16-tile responsive grid; tiles grayed if sub-module key not in permitted list
4. `src/app/(app)/app/page.tsx` — Module chooser: reads permissions, redirects to first permitted module
5. `src/app/(app)/app/fleet/page.tsx` — Fleet home: `checkPagePermission('app_fleet', 1)`, stat cards, sub-module grid
6. `src/app/(app)/app/equipment/page.tsx` — Equipment home: `checkPagePermission('app_equipment', 1)`, placeholder
7. `supabase/migrations/00016_chemosys_modules.sql` — Seeds all 18 module keys with `app_` prefix namespace

**Build order is non-negotiable (each step is a prerequisite for the next):**
DB migration first → auth.ts post-login routing → `(admin)` layout `is_admin` guard → `dal.ts` new functions → `(app)` layout + `verifyAppUser()` → AppHeader → pages.

### Critical Pitfalls

1. **Admin layout has no `is_admin` check** — Any authenticated employee with a valid JWT can visit `/admin/employees` and see colleague personal data. The `(admin)/layout.tsx` only calls `verifySession()` (JWT check), not a role check. Fix: add `is_admin` guard to `(admin)/layout.tsx` before v2.0 ships — this is a data protection requirement, not just UX.

2. **login Server Action hardcodes redirect to `/admin/companies`** — An employee who accidentally uses the admin login URL gets redirected to the admin panel. Fix: update `auth.ts` post-login logic to check `is_admin` and redirect accordingly: admins to `/admin/dashboard`, others to `/app`. Keep one shared login page (Option A from ARCHITECTURE.md).

3. **Module keys not seeded = permission checks silently fail for ALL users** — `requirePermission('app_fleet', 1)` returns "no permission" for all users (including Sharon as admin) if no `modules` row exists with that key. The `is_admin` bypass in `get_user_permissions()` queries `FROM modules m` — unseeded keys return nothing. Fix: migration 00016 must run in Supabase BEFORE any `(app)` code is deployed. Hard dependency.

4. **Module key namespace collision** — Admin modules (`dashboard`, `companies`) and ChemoSys modules share the same `modules` table with no context column. Using `fleet` as a key means any admin template with a `fleet` grant could collide with ChemoSys access. Fix: prefix all ChemoSys module keys with `app_` from the start (`app_fleet`, `app_equipment`, etc.). Renaming later requires a data migration across three tables — 4-8 hours recovery cost.

5. **`getNavPermissions()` leaks admin keys into employee sidebar** — The existing function returns all user permission keys without filtering by context. If called from `(app)` layout, employees see "ניהול חברות" and "ניהול עובדים" in their nav. Fix: create `getAppNavPermissions()` that filters to `CHEMO_APP_MODULE_KEYS` (keys starting with `app_`) only.

6. **N+1 RPC calls per page load** — `get_user_permissions()` RPC fires once in layout (`getAppNavPermissions()`) and again in each `checkPagePermission()` call on the page. Fix: wrap the raw RPC call in `React.cache()` in `dal.ts` so all permission functions share one cached result per request. `verifySession()` already does this — extend the pattern to the permissions RPC.

---

## Implications for Roadmap

Based on research, the v2.0 milestone maps to 4 phases structured around the hard dependency chain identified in the architecture research.

### Phase 1: DB + Auth Foundation (Gates Everything Else)

**Rationale:** All application code depends on the DB migration and auth routing changes being correct. Building any `(app)` page before the migration runs causes silent permission failures. Building any employee-facing page before the `(admin)` layout is patched creates a data security hole. These are correctness prerequisites, not nice-to-have setup tasks.

**Delivers:**
- Migration 00016 executed in Supabase: 18 module keys with `app_` prefix seeded to `modules` table
- `src/actions/auth.ts` updated: post-login routing checks `is_admin` → `/admin/dashboard` or `/app`
- `src/app/(admin)/layout.tsx` patched: `is_admin` guard added (employees with valid session blocked from admin)
- `src/lib/dal.ts` extended: `verifyAppUser()`, `getAppNavPermissions()`, `getUserPermissionsRaw` with `React.cache()`

**Addresses:** Pitfalls 1, 2, 3, 4, 5, 6 (all six critical auth and permission pitfalls from PITFALLS.md)
**Avoids:** Session collision, silent permission failures, admin key namespace collision, N+1 DB calls
**Research flag:** Standard patterns — all changes are documented in ARCHITECTURE.md and PITFALLS.md with exact file locations and code samples. No additional research needed.

### Phase 2: (app) Route Group + Shell Layout

**Rationale:** With DB and auth in place, the shell layout can be built. The layout is the container for all future employee pages and cannot be built before Phase 1. The `AppHeader` and `ModuleSwitcher` are layout dependencies.

**Delivers:**
- `src/app/(app)/layout.tsx` — calls `verifyAppUser()` + `getAppNavPermissions()`
- `src/components/app/AppHeader.tsx` — top nav: CA logo, module switcher, user email, logout
- `src/components/app/ModuleSwitcher.tsx` — filters permitted modules, active state via `usePathname()`
- `src/app/(app)/app/page.tsx` — module chooser: reads permissions, redirects to first permitted module
- Install `recharts` + run `npx shadcn@latest add chart tooltip collapsible navigation-menu`

**Uses:** `verifyAppUser()` and `getAppNavPermissions()` from Phase 1
**Implements:** ChemoSys top-header layout (field-worker mobile UX — full-width content, no sidebar offset)
**Avoids:** Anti-pattern of permission checks in client components — `AppHeader` receives `permittedModules: string[]` as props from server layout
**Research flag:** Standard patterns — top-header layout, module switcher, and logout are established shadcn/ui patterns.

### Phase 3: Fleet Home Dashboard + Sub-Module Grid

**Rationale:** Fleet is the primary deliverable of v2.0 and the main value delivery to managers. The 16 tile grid must display all sub-modules even though the pages behind them are stubs. Stats must show real data where possible (active projects from existing table) and honest placeholders where sub-module tables don't exist yet.

**Delivers:**
- `src/app/(app)/app/fleet/page.tsx` — `checkPagePermission('app_fleet', 1)`, 6 stat cards, sub-module grid
- `src/components/app/FleetSubModuleGrid.tsx` — 16 tiles, 2-col mobile / 4-col desktop, grayed if no sub-module permission
- `src/components/shared/StatsGrid.tsx` — generic stat card grid (refactored from admin `StatsCards.tsx`)
- Stat cards: active projects (live from `projects` table), remaining 5 as placeholder zeros with "(בפיתוח)" label

**Uses:** recharts (optional for stat card sparklines), Lucide icons per tile, `permittedSubModules: string[]` from server layout
**Features:** Fleet home dashboard + 16 sub-module tile menu (both P1 priority features from FEATURES.md)
**Avoids:** Hardcoding tile visibility client-side only — server component fetches permissions and passes `permittedSubModules` to the grid
**Research flag:** Sub-module tile permission filtering: the exact pattern for checking which of 16 sub-module keys a user has access to within a single page needs a concrete implementation decision before coding `FleetSubModuleGrid.tsx`. Consider passing a `Set<string>` of permitted keys from the server.

### Phase 4: Equipment Home + Mobile Polish + Verification

**Rationale:** Equipment module is secondary for v2.0 but must exist so the module switcher has a second destination. Mobile responsiveness is non-negotiable given field-worker use case. End-to-end testing completes the milestone.

**Delivers:**
- `src/app/(app)/app/equipment/page.tsx` — `checkPagePermission('app_equipment', 1)`, placeholder stat cards, "בפיתוח" tiles
- `/app/no-account` and `/app/blocked` error pages for `verifyAppUser()` redirect targets
- Mobile RTL visual review: every new component tested at 375px in RTL mode
- End-to-end test: employee login → module selection → fleet home → equipment home → logout
- Sharon admin test: Sharon can visit both `/admin/dashboard` and `/app/fleet` (is_admin bypass works for both)

**Uses:** `EquipmentPlaceholder.tsx` (simple component — not a full sub-module grid)
**Implements:** Mobile-first field-worker UX (44px touch targets, responsive tile grid verified)
**Avoids:** RTL breakage in new shadcn/ui components — NavigationMenu, Sheet, Tabs each tested visually before sign-off
**Research flag:** Equipment sub-module list is TBD (characterization needed before v2.15). For v2.0, a generic "בפיתוח" placeholder is sufficient — no research needed for this phase.

---

### Phase Ordering Rationale

The order is driven by two dependency chains:

**Chain 1 (hard prerequisite):** DB migration → `dal.ts` functions → auth routing → `(app)` layout → pages. Every step is a prerequisite for the next. Skipping Phase 1 means Phase 2 work will not function.

**Chain 2 (security gate):** The `(admin)` layout patch (Phase 1) must complete before any employee user account is created in Supabase Auth. If an employee account exists before the admin layout has an `is_admin` guard, that employee can visit `/admin/employees` and see colleague personal data. This is a personal data exposure risk under Israeli privacy law, not just a UX issue.

**Grouping logic:** Phases 1-2 are infrastructure-only with no user-visible deliverables. Phases 3-4 deliver the visible UI. This separation lets Sharon verify the infrastructure is solid before any feature UI is shown to employees.

---

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 3 (sub-module tile permissions):** The `getNavPermissions()` function returns a flat array of module keys. Filtering it for sub-module-level tiles (which of 16 fleet sub-modules a user can access) requires either a second RPC call or extending the cached result. The exact pattern for passing this data to `FleetSubModuleGrid.tsx` needs a concrete decision before implementation begins.

- **Future v2.1 (Vehicle Card + Driver Card):** These are the foundational data models for all 14 remaining fleet sub-modules. Wrong column choices propagate through 14 future milestones. DB schema design deserves its own research phase before v2.1 planning begins.

**Phases with established patterns (skip research-phase):**

- **Phase 1 (DB + Auth):** All changes are direct edits to known files. Migration SQL, dal.ts changes, and auth.ts changes are all documented in ARCHITECTURE.md and PITFALLS.md with code samples.

- **Phase 2 (Shell Layout):** Top-header layout, module switcher, and logout are standard shadcn/ui patterns reusing v1.0 component conventions.

- **Phase 4 (Equipment placeholder + mobile polish):** Entirely derivative of Phase 3 with simpler content.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All new packages verified against npm registry on 2026-03-04. Version compatibility confirmed. recharts peer deps explicitly list React 19. qr-scanner HTTPS requirement is web spec, not assumption. |
| Features | MEDIUM | 12 table-stakes fleet features based on Israeli fleet management domain knowledge (training data). Israeli regulatory requirements confirmed by domain knowledge but specific regulation numbers unverified — validate against current Ministry of Transport circulars before implementing compliance claims. Competitor analysis is LOW confidence. |
| Architecture | HIGH | Based on direct analysis of 18 source files in the existing codebase. All claims cite specific file + line numbers in ARCHITECTURE.md. No assumptions. The proxy.ts single-redirect issue and hardcoded `/admin/companies` redirect were confirmed by direct file reads. |
| Pitfalls | HIGH | 11 pitfalls identified by direct code inspection of proxy.ts, dal.ts, (admin)/layout.tsx, auth.ts, and all migrations 00001-00015. All pitfall descriptions include the exact current code that causes the problem. |

**Overall confidence:** HIGH for v2.0 shell execution. MEDIUM for the feature content of future sub-module milestones (v2.1+).

### Gaps to Address

- **`app_` prefix vs no prefix decision:** PITFALLS.md recommends `app_fleet`, `app_equipment` etc. to avoid namespace collision. ARCHITECTURE.md uses `fleet`, `equipment` without prefix. This inconsistency must be resolved before migration 00016 is written — once keys are in the DB and permissions are granted, renaming costs 4-8 hours. **Decision: adopt the `app_` prefix.** It is the more conservative choice and explicitly prevents a known collision risk.

- **Shared `/login` vs separate `/app/login`:** ARCHITECTURE.md recommends Option A (shared `/login`, post-login routing based on `is_admin`). PITFALLS.md Pitfall 1 warns about proxy.ts redirect logic for a separate `/app/login`. These are reconcilable: with Option A (shared login), proxy.ts does NOT need a second login URL exclusion because there is only one login URL. Confirm this decision in Phase 1 implementation.

- **Israeli regulatory compliance specifics:** Feature research confirms that driver license tracking, annual vehicle inspection (טסט), and daily safety form (בדיקה יומית) are regulatory requirements. However, specific regulation numbers and current Ministry of Transport circulars were not web-searched (WebSearch was unavailable during research). Before marking compliance features as "complete" in future milestones, verify current requirements with Sharon or the company's transport compliance officer.

- **Equipment module sub-module list:** The 16 fleet sub-modules are fully defined. The equipment sub-modules are explicitly TBD — "characterization needed" per FEATURES.md. Equipment module characterization must happen before v2.15 milestone planning.

- **`getNavPermissions()` bootstrap fallback for Sharon in `(app)` context:** The existing function returns all admin module keys for a user with no `public.users` row (Sharon bootstrap case). If Sharon tests `(app)` routes, `getAppNavPermissions()` must handle this gracefully — returning all `app_` keys for admin users, not the admin module keys. Confirm the `is_admin` bypass in `get_user_permissions()` RPC will naturally include newly seeded `app_` keys (it queries `FROM modules m` — yes, it will include them automatically once migration 00016 runs).

---

## Sources

### Primary (HIGH confidence — direct codebase analysis, 2026-03-04)
- `src/proxy.ts` — confirmed single redirect target `/login`, no path branching
- `src/lib/dal.ts` — confirmed `verifySession()` uses `getClaims()` (no network call), `React.cache()` wraps it, `getNavPermissions()` has hardcoded admin fallback
- `src/actions/auth.ts` — confirmed hardcoded `redirect("/admin/companies")` on success
- `src/app/(admin)/layout.tsx` — confirmed no `is_admin` check, only `verifySession()`
- `supabase/migrations/00003_seed_modules.sql` — confirmed 9 admin keys, no ChemoSys keys
- `supabase/migrations/00012_access_control.sql` — confirmed `is_admin` bypass returns all modules from `modules` table via `FROM modules m`
- `npm info recharts dist-tags` — confirmed 3.7.0 latest stable, React 19 peer dep (2026-03-04)
- `npm info qr-scanner dist-tags` — confirmed 1.4.2 latest stable (2026-03-04)
- `npm info @radix-ui/react-tooltip version` — confirmed 1.2.8 (2026-03-04)
- `npm info @radix-ui/react-collapsible version` — confirmed 1.1.12 (2026-03-04)
- `npm info @radix-ui/react-navigation-menu version` — confirmed 1.2.14 (2026-03-04)

### Secondary (MEDIUM confidence — domain knowledge, training data through August 2025)
- Israeli fleet management systems (Shlager, NetFleet, Track) — feature landscape and expected functionality
- Israeli regulatory context: Transport Authority requirements for commercial fleets — driver license, annual test, daily inspection
- shadcn/ui chart component wrapping recharts — community-verified pattern
- qr-scanner BarcodeDetector API behavior — README-based, not directly tested

### Tertiary (LOW confidence — requires validation)
- Competitor feature comparison: Shlager, NetFleet, Track, Ituran (training knowledge through 2024, market may have evolved)
- Israeli regulatory compliance: specific regulation numbers and current Ministry of Transport circulars (unverified — WebSearch unavailable during research)

---

*Research completed: 2026-03-04*
*Ready for roadmap: yes*
