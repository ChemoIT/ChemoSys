# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** v2.0 — Phase 14 (10E) COMPLETE. All 8 VehicleCard tabs + vehicle list page built. Phase 15 next.

## Current Position

Phase: 14 (Phase 10E) — 2/2 plans COMPLETE
Status: **הושלם** — Phase 14 DONE. Phase 15 (VehicleList + AddVehicleDialog + MOT auto-fill) next.
Last activity: 2026-03-07 — Session #34 (execute-phase 14, plan 02)

Progress: v2.0 [█████████████████████████] Phase 14 COMPLETE — Phase 15 next

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

## Session Continuity

Last session: 2026-03-07 (session #34)
Stopped at: Phase 14 Plan 02 COMPLETE — All 8 VehicleCard tabs + vehicle list page built.

### Context for next session:

**מה קיים:** Phase 14 DONE — VehicleCard page at /app/fleet/vehicle-card/[id] עם 8 tabs מלאים: פרטי הרכב, טסטים, ביטוח, שיוך נהג (CRUD), עלויות (placeholder), מסמכים (CRUD + upload), הערות (save), ק"מ (placeholder). /app/fleet/vehicle-card = רשימת רכבים עם table (desktop) + card (mobile).

**מה הבא:** Phase 15 — VehicleList + AddVehicleDialog (MOT API auto-fill) + Pages + Integration.

**Key new files (Phase 14-02):**

**Key new files (Phase 13-02):**
- `src/components/app/fleet/shared/FleetDateInput.tsx` — moved from drivers/ (3-select date picker)
- `src/components/app/fleet/shared/AlertToggle.tsx` — extracted from DriverDocumentsSection + DriverLicenseSection
- `src/components/app/fleet/shared/ExpiryIndicator.tsx` — extracted from DriverDocumentsSection
- `src/components/app/fleet/shared/FleetFilePreview.tsx` — extracted from DriverDocumentsSection + DriverViolationsSection
- `src/components/app/fleet/shared/FleetUploadZone.tsx` — extracted from DriverDocumentsSection
- `src/components/app/fleet/shared/VehicleFitnessLight.tsx` — new component for vehicle card/list

**Key new files (Phase 13-01):**
- `src/lib/fleet/vehicle-types.ts` — VehicleListItem, VehicleFull, VehicleTest, VehicleInsurance, VehicleDocument, DriverOptionForAssignment types + VEHICLE_TYPE_LABELS, OWNERSHIP_TYPE_LABELS, INSURANCE_TYPE_LABELS constants
- `src/actions/fleet/vehicles.ts` — 21 complete vehicle CRUD server actions (verifyAppUser guard, RPCs for soft-delete)

- `src/components/app/fleet/vehicles/VehicleAssignmentSection.tsx` — Tab 4: driver assignment + remove
- `src/components/app/fleet/vehicles/VehicleCostsSection.tsx` — Tab 5: Coming Soon placeholder
- `src/components/app/fleet/vehicles/VehicleDocumentsSection.tsx` — Tab 6: document CRUD (mirror of DriverDocumentsSection)
- `src/components/app/fleet/vehicles/VehicleNotesSection.tsx` — Tab 7: notes textarea with dirty tracking
- `src/app/(app)/app/fleet/vehicle-card/page.tsx` — vehicle list (table + mobile cards, replaced ComingSoon)

**Key new files (Phase 14-01):**
- `src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx` — server page with parallel data fetch + companies query
- `src/components/app/fleet/vehicles/VehicleCard.tsx` — 8-tab shell, header, dirty tracking, delete dialog, unsaved dialog
- `src/components/app/fleet/vehicles/VehicleDetailsSection.tsx` — Tab 1: MOT read-only + operational editable
- `src/components/app/fleet/vehicles/VehicleTestsSection.tsx` — Tab 2: test history CRUD + file upload
- `src/components/app/fleet/vehicles/VehicleInsuranceSection.tsx` — Tab 3: insurance policies CRUD + supplier dropdown

**Key fleet files:**
- `src/actions/fleet/mot-sync.ts` — syncVehicleFromMot(), testMotApiConnection(), parseMoedAliya()
- `src/lib/fleet/supplier-types.ts` — VehicleSupplier type + SUPPLIER_TYPE_LABELS (shared constants)
- `src/app/(app)/app/fleet/layout.tsx` — FleetLayout (auth + app_fleet guard)
- `src/components/app/fleet/FleetSidebar.tsx` — FleetSidebar (shell: SidebarProvider + 12 items)
- `supabase/migrations/00025_fleet_vehicles.sql` — vehicle module tables, views, RPCs, RLS
- `supabase/migrations/00026_fleet_vehicles_storage_policies.sql` — storage policies

Resume file: None
