# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** v2.0 Phase 9 — Fleet Home

## Current Position

Phase: 9 of 10 (Fleet Home)
Plan: 1 of 2 in current phase
Status: Phase 9 Plan 01 COMPLETE — ready for Plan 02 (fleet home page)
Last activity: 2026-03-04 — Session #17

Progress: v2.0 [███████████████░░░░░] 78% (7/9 plans complete)

## v1.0 Summary

- **Phases:** 6 (1, 2, 3, 3.1, 4, 5)
- **Plans:** 20
- **Commits:** 102
- **Codebase:** 106 TS files, 17,440 LOC + 1,558 SQL
- **Timeline:** 2026-03-01 → 2026-03-04 (3 days)
- **Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

## Accumulated Context

### Key Decisions (v2.0)

- ChemoSys login page = `/chemosys` (נפרד מ-`/login` של admin)
- Module keys prefix = `app_` (e.g., `app_fleet`, `app_equipment`) — מניעת collision עם admin keys
- Build order: migration → auth.ts routing → (admin) guard → dal.ts → (app) layout → pages
- Phase 6 must complete before ANY employee-facing page is created — security gate
- (app) layout = top-header (לא sidebar) — מותאם לעובדי שטח במובייל
- Equipment sub-modules = TBD — placeholder בלבד ב-v2.0
- **[06-01]** maybeSingle() not single() in is_admin query — bootstrap admin (no public.users row) retains access
- **[06-01]** is_admin guard in (admin)/layout not in proxy — proxy handles unauthenticated only, layout handles role mismatch
- **[06-01]** Migration 00016 must run manually before Phase 7+ deployment — hard dependency
- **[06-02]** getPermissionsRpc must be module-level const (not inside function) — React.cache() requires stable function reference for deduplication
- **[06-02]** verifyAppUser does NOT block is_admin users — admins can use ChemoSys too
- **[06-02]** getAppNavPermissions is plain async function (not cached) — delegates to already-cached getPermissionsRpc
- **[06-02]** Admin login redirect changed to /admin/dashboard (was /admin/companies)
- **[07-login]** loginApp() authenticates + checks module permission + redirects to /app/{module} directly
- **[07-login]** Module selection integrated INTO /chemosys login page (not separate /app page)
- **[07-login]** loginApp() signs out + returns error if user blocked / not registered / no module access
- **[07-login]** checkRateLimit(ip, store) generic helper — loginAttempts and loginAppAttempts are separate Maps
- **[07-login]** (chemosys)/layout.tsx uses bg-sidebar-bg (#1B3A4B) + radial teal CSS gradient
- **[session14]** user_permissions כתיבות חייבות adminClient (service_role) — RLS 00013 חוסם כתיבה עם RLS client
- **[session14]** auth email (מ-auth.users) מוצג בטבלת יוזרים, לא employee email
- **[session15]** Branding: "מערכת ניהול לוגיסטי" + "CHEMO SYSTEM" בלוגאין
- **[08-01]** (app)/layout.tsx does NOT set dir=rtl — inherited from root <html dir="rtl">
- **[08-01]** ModuleSwitcher returns null for <=1 module — no dropdown for single-module users
- **[08-01]** logoutApp() separate from logout() — ChemoSys → /chemosys, admin → /login
- **[08-01]** Employee display name resolved in layout (not DAL) — display concern belongs in layout
- **[09-01]** FleetLayout passes string[] to FleetSidebar (not Set) — Sets not JSON-serializable across server→client boundary; client converts via useMemo
- **[09-01]** SidebarProvider scoped to FleetLayout only — do NOT add to (app)/layout.tsx (nested providers cause state conflicts)
- **[09-01]** (app)/layout.tsx main element has no padding — moved to FleetLayout content div so sidebar sits flush
- **[09-01]** Disabled sub-modules use span+aria-disabled+tabIndex=-1 — full keyboard inaccessibility without CSS-only hack

### Hotfixes Applied (2026-03-04, post Phase 7)

- **BUG FIX — שמות מחלקות הפוכים ב-PDF import:** `.split(' ').reverse().join(' ')` ב-`parseDepartmentsPdf()`
- **שיפור — מספר מחלקה בכרטיס עובד:** שדה "מס׳ מחלקה" בסעיף שיוך ארגוני
- **כלל ברזל — מחלקה 0 = לא פעיל:** `deriveStatus()`, `deriveStatusFromEndDate()`, onChange handlers, Excel import

### Pending Todos

None.

### Blockers/Concerns

- Phase 6 (plan 06-01): Migration 00016 חייב לרוץ ב-Supabase לפני deploy של כל קוד (app) — hard dependency
- Phase 9 (plan 09-01): Migration 00017 חייבת לרוץ ב-Supabase לפני test של fleet permissions (מוסיפה app_fleet_charging_stations + app_fleet_forms)

## Session Continuity

Last session: 2026-03-04 (session #17)
Stopped at: Phase 9 Plan 01 COMPLETE — fleet sidebar shell done. Ready for Plan 02 (fleet home page).

### Context for next session:

**Status:** Phase 9 Plan 01 DONE — fleet sidebar shell committed + verified. Plan 02 = fleet home page content.

**Commits this session (Phase 9 Plan 01):**
- `acfb9cf` — chore(09-01): install shadcn sidebar + tooltip + add migration 00017
- `749bc7b` — feat(09-01): FleetLayout + FleetSidebar — RTL collapsible fleet sidebar

**Phase 9 Plan 02 scope:**
- Fleet home page (`/app/fleet`) — replace placeholder with real content
- Dashboard area at top (placeholder "בקרוב")
- 2 primary CTA buttons: כרטיס נהג + כרטיס רכב (placeholder)
- 9 sub-module placeholder pages (fuel, tolls, invoices, ev-charging, charging-stations, rentals, forms, exceptions, reports)

**IMPORTANT — Migration required:**
- Run `supabase/migrations/00017_fleet_sidebar_modules.sql` in Supabase before testing fleet permissions
- Adds: `app_fleet_charging_stations` + `app_fleet_forms`

**Key files:**
- `src/app/(app)/app/fleet/layout.tsx` — FleetLayout (server, nested, auth+permission guard)
- `src/components/app/fleet/FleetSidebar.tsx` — FleetSidebar (client, 9 sub-modules, RTL)
- `src/app/(app)/app/fleet/page.tsx` — fleet home page (replace in Plan 02)

Resume file: None
