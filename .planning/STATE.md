# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** v2.1 Performance & UX — Defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-09 — Milestone v2.1 started

Progress: v2.1 [░░░░░░░░░░░░░░░░░░░░░░░░░] 0%

## Strategic Decision (Session #18)

**החלטה:** לא מפתחים Phase 10 (Equipment) עכשיו.
**במקום:** שרון יאפיין את מודול הרכבים (fleet vehicles) באופן מלא → פיתוח → ואז איפיון צמ"ה.
**הסיבה:** עדיף לבנות מודול שלם ומאופיין לעומק מאשר שלד של שני מודולים.

## v1.0 Summary

- **Phases:** 6 (1, 2, 3, 3.1, 4, 5)
- **Plans:** 20
- **Commits:** 102
- **Codebase:** 106 TS files, 17,440 LOC + 1,558 SQL
- **Timeline:** 2026-03-01 → 2026-03-04 (3 days)
- **Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

## v2.0 Summary (Phases 6–9)

- **FleetSidebar**: shadcn sidebar RTL, side="right", SidebarProvider wraps sidebar+content, collapsible="icon"
- **Fleet routes**: /app/fleet (dashboard), /app/fleet/driver-card, /app/fleet/vehicle-card, + 9 sub-module placeholders
- **Key pattern**: FleetSidebar accepts children — acts as layout shell, SidebarProvider scoped to fleet only

## Accumulated Context

### Key Decisions (v2.0)

- **[12-02]** MOT API mispar_rechev must be NUMBER not string — Number(digitsOnly) before API call
- **[12-02]** parseMoedAliya: "YYYY-M" → "YYYY-MM-01" (day=01, MOT only provides year+month)
- **[12-02]** vehicle_tests INSERT (not upsert) — test history accumulates; no unique constraint on vehicle_id+test_date
- **[12-02]** use server files cannot export objects/constants — shared types live in @/lib/fleet/*.ts (supplier-types.ts pattern)
- **[12-02]** Fleet vehicle alert thresholds default: yellow=60 days, red=30 days (same as driver thresholds)
- **[11-01]** Partial unique index on vehicles.license_plate (WHERE deleted_at IS NULL) — allows soft-delete + plate reuse
- **[11-01]** driver_computed_status updated in same migration — vehicle assignment WHEN precedes is_occasional_camp_driver
- **[11-01]** vehicle_insurance uses supplier_id FK (not direct insurer fields) — normalized to vehicle_suppliers
- **[11-01]** alert_enabled=TRUE default for vehicle_tests/insurance, FALSE for vehicle_documents (mirrors driver pattern)
- **[11-02]** company_id in vehicles fixed from INT to UUID (matches companies.id)
- **[11-02]** fleet-vehicle-documents bucket = Private, 4 storage policies (INSERT/SELECT/UPDATE/DELETE)
- ChemoSys login page = `/chemosys` (נפרד מ-`/login` של admin)
- Module keys prefix = `app_` (e.g., `app_fleet`, `app_equipment`) — מניעת collision עם admin keys
- Build order: migration → auth.ts routing → (admin) guard → dal.ts → (app) layout → pages
- Phase 6 must complete before ANY employee-facing page is created — security gate
- (app) layout = top-header (לא sidebar) — מותאם לעובדי שטח במובייל
- Equipment sub-modules = TBD — יאופיין בנפרד
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
- **[09-01]** SidebarProvider MUST wrap both Sidebar + content — scoped to FleetSidebar (shell pattern)
- **[09-01]** (app)/layout.tsx main = flex flex-col — allows FleetSidebar's SidebarProvider (flex-1) to fill height
- **[09-01]** Sidebar fixed positioning offset: style={{ top: "3.5rem", height: "calc(100svh-3.5rem)" }}
- **[09-01]** All fleet navigation uses Next.js <Link> — client-side, instant, no full reload
- **[09-02]** FleetSidebar defaultOpen=true (expanded) — matches admin sidebar UX
- **[09-02]** All sidebar items size="lg" + font-semibold — uniform large button style
- **[09-02]** Content area bg-background — white in light mode, dark-mode ready
- **[09-02]** Disabled sub-modules: span+aria-disabled+tabIndex=-1
- **[12-01]** SUPPLIER_TYPE_LABELS in src/lib/fleet/supplier-types.ts (not 'use server' file) — Next.js 16 Turbopack enforces 'use server' can ONLY export async functions; re-exporting const objects causes build failure
- **[12-01]** Supplier phones allow landlines — normalizePhone() attempted first, raw stripped fallback for non-mobile (relaxation of mobile-only IRON RULE for vendor data)
- **[12-01]** Fleet shared types live in src/lib/fleet/ — constants/types shared between server actions and client components go here
- **[13-01]** vehicle-types.ts no 'use server' — Turbopack enforces server action files export only async functions; constants live in separate non-server files
- **[13-01]** getVehicleById uses FK hints for multi-supplier joins: leasing:vehicle_suppliers!leasing_company_id (Supabase disambiguates multiple FKs to same table)
- **[13-01]** assignDriverToVehicle uses direct .update (not RPC) — vehicles UPDATE policy USING(true) allows it; only SELECT policy blocks soft-deleted rows
- **[13-01]** 21 vehicle server actions complete: getVehiclesList, getVehicleById, createVehicle, updateVehicleDetails, softDeleteVehicle, deleteVehicleWithPassword + tests (4) + insurance (4) + documents (5+autocomplete) + assignment (2)
- **[13-02]** VehicleFitnessLight red logic: test expired OR insurance expired = red (vs driver where only license = red — road legality difference)
- **[13-02]** DriverLicenseSection UploadZone NOT extracted — different signature (image-only, side prop) vs FleetUploadZone (file+PDF+drag) — intentional separation
- **[13-02]** FleetDateInput moved to shared/ (rename via git, 96% similarity preserved)
- **[14-01]** getActiveSuppliersByType uses verifyAppUser (not verifySession) — ChemoSys context; filters is_active=true + deleted_at IS NULL
- **[14-01]** Companies fetched directly via supabase in server page — no dedicated action for simple reference data
- **[14-01]** syncVehicleFromMot uses verifySession (admin) — intentional, MOT sync is admin-level operation called from ChemoSys
- **[14-01]** VehicleCard avatar = first 2 chars of plate digits for visual identification
- **[14-01]** Tabs 4-8 = PlaceholderTab component — clean separation for Plan 14-02
- **[14-02]** VehicleDocumentsSection uses fleet-vehicle-documents bucket (not fleet-documents) — separate private bucket for vehicle docs
- **[14-02]** VehicleAssignmentSection auto-save on button click + router.refresh() — no dirty tracking needed (not form-based)
- **[14-02]** VehicleNotesSection reuses updateVehicleDetails({ vehicleId, notes }) — no new action
- **[14-02]** KM tab inline JSX in VehicleCard (not extracted component) — simpler for single-use placeholder
- **[15-01]** lookupVehicleFromMot is read-only (no DB write) — separate from syncVehicleFromMot which writes to DB
- **[15-01]** syncVehicleFromMot fixed: verifySession → verifyAppUser (ChemoSys employee-facing context)
- **[15-01]** testMotApiConnection kept on verifySession (admin FleetSettings caller, not ChemoSys)
- **[15-01]** AddVehicleDialog: syncVehicleFromMot is fire-and-forget post-create — MOT failure shows toast.warning, never blocks navigation
- **[15-01]** AddVehicleDialog step 2 back button preserves plate+companyId (no reset on return)
- **[16-01]** 00028 storage policies created in same plan as 00027 — matches established 00025+00026 two-file split pattern
- **[16-01]** vehicle_images + vehicle_fuel_cards = hard-delete (DELETE RLS policy, no deleted_at) — binary assets replaced not versioned
- **[16-01]** Activity journal tables (driver/project/monthly_costs journals) = no soft-delete — historical facts never removed
- **[16-01]** vehicle_status NOT NULL DEFAULT 'active' — all existing vehicles auto-assigned 'active' on migration run
- **[16-01]** Single-active-record-per-vehicle rule enforced in Server Actions, NOT in DB triggers — follows project pattern
- **[16-01]** 00028 storage policies created in same plan as 00027 — matches established 00025+00026 two-file split pattern
- **[16-02]** Migrations 00027+00028 verified in production Supabase (2026-03-08) — schema stable, ready for Phase 17-19 UI
- **[17-01]** VEHICLE_TYPE_LABELS: 4 values (private/commercial/truck/trailer) matching migration 00027 CHECK constraint
- **[17-01]** is_active derived from vehicle_status in updateVehicleDetails -- not separate field
- **[17-01]** VehicleImageGallery: client-side upload to storage, then server action for metadata -- avoids base64 overhead
- **[17-01]** FleetDateInput: disabled prop added to support lock mode in VehicleDetailsSection
- **[17-01]** AddVehicleDialog: company selector removed -- createVehicle(plate) only
- **[19-01]** getVehicleDriverJournal + getVehicleProjectJournal use verifyAppUser (ChemoSys context) — consistent with all fleet read actions
- **[19-01]** assignDriverJournal syncs vehicles.assigned_driver_id after journal write — driver_computed_status view requires this field
- **[19-01]** campResponsiblePhone normalizePhone returns null on invalid — invalid phone stored as null, never as raw string (IRON RULE)
- **[19-01]** vehicleStatus + fleetExitDate added to getVehicleById() (Phase 17 added to VehicleFull type) — auto-fixed TS error
- **[18-01]** OWNERSHIP_TYPE_LABELS corrected to company/rental/operational_leasing/mini_leasing — previous keys (company_owned/leased/rented/employee_owned) did not match 00027 DB CHECK constraint
- **[18-01]** updateVehicleMonthlyCost uses direct .update() (no RPC) — vehicle_monthly_costs has no deleted_at RLS filter (immutable journal, no soft-delete)
- **[18-01]** addVehicleMonthlyCost closes previous active record before insert — single-active-record invariant enforced in Server Action, NOT in DB trigger (project pattern)
- **[18-02]** VehicleOwnershipJournal optimistic local state: closes previous active record locally after addVehicleMonthlyCost success — no full page reload needed
- **[18-02]** Exit date asterisk indicator is client-side only (not HTML required attr) — shown when vehicleStatus is returned/sold/decommissioned
- **[18-02]** Existing contract file link shown only when contractFileUrl matches vehicle.contractFileUrl — prevents stale link when user uploads new contract before saving
- **[18-03]** VehicleLicensingSection uses useRef booleans (not useState) to OR dirty states — avoids re-render on sub-section dirty change, single onEditingChange upstream
- **[18-03]** docYellowDays (not yellowDays) passed to VehicleLicensingSection — tests/insurance use document threshold, consistent with VehicleDocumentsSection
- **[18-03]** VehicleOwnershipSection renders its own border/padding wrapper — Tab 2 TabsContent has no outer wrapper div (avoids double-border)

### Roadmap Evolution

- Phase 11 added: Phase 10A — Vehicle Card Database + Storage + Vehicle Suppliers tables
- Phase 12 added: Phase 10B — Vehicle Suppliers Admin Settings UI + MOT API integration
- Phase 13 added: Phase 10C — Vehicle Server Actions + Shared Fleet Components extraction
- Phase 14 added: Phase 10E — VehicleCard Tabs 4-8 (Assignment, Costs, Documents, Notes, KM placeholder)
- Phase 15 added: Phase 10F — VehicleList + AddVehicleDialog (MOT API auto-fill) + Pages + Integration

### Hotfixes Applied (2026-03-04)

- **BUG FIX — שמות מחלקות הפוכים ב-PDF import:** `.split(' ').reverse().join(' ')` ב-`parseDepartmentsPdf()`
- **שיפור — מספר מחלקה בכרטיס עובד:** שדה "מס׳ מחלקה" בסעיף שיוך ארגוני
- **כלל ברזל — מחלקה 0 = לא פעיל:** `deriveStatus()`, `deriveStatusFromEndDate()`, onChange handlers, Excel import

### Pending Todos

None.

### Blockers/Concerns

- Migration 00016: חייב לרוץ ב-Supabase לפני deploy של כל קוד (app)
- Migration 00017: חייבת לרוץ ב-Supabase לפני test של fleet permissions (מוסיפה app_fleet_charging_stations + app_fleet_forms)
- **Migrations 00025+00026: RUN ✓** — vehicle module DB foundation complete
- **Migrations 00027+00028: RUN ✓** — vehicle card redesign schema live in Supabase. 6 new tables, 9 new vehicles columns, vehicle-images Private bucket all verified (2026-03-08).

## Session Continuity

Last session: 2026-03-09 (milestone v2.1 started)
Stopped at: Defining requirements for v2.1 Performance & UX

### Context for next session:

**מה קיים:** v2.0 shipped. דף דלק = רפרנס לתבנית ביצועים (Suspense + FuelPageSkeleton + React.cache + DB view + RPC).
**מה הבא:** Define requirements → roadmap → execute performance optimization on all pages.

Resume file: None
