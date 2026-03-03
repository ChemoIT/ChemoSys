---
phase: 04-projects
verified: 2026-03-03T22:00:00Z
status: human_needed
score: 12/12 must-haves verified (automated checks passed)
re_verification: null
gaps: []
human_verification:
  - test: Apply migrations 00014 and 00015 in Supabase SQL Editor
    expected: projects table with all columns incl cvc_name; attendance_clocks; sequence; soft_delete_projects RPC; client-logos Storage policies
    why_human: Cannot verify Supabase DB state from code. client-logos bucket must be created manually in Supabase Dashboard before running 00014.
  - test: Create a new project and verify auto-generated project number
    expected: After submit project receives a number in PR26XXXXXX format
    why_human: DB trigger runs server-side cannot verify without running the migration
  - test: Select a PM from employee combobox and verify email/phone auto-fill
    expected: pm_email and pm_phone fields populate with employee values phone formatted as 05x-xxxxxxx
    why_human: Requires live UI interaction with real employee data
  - test: Toggle CVC to manual mode enter invalid phone submit
    expected: Hebrew validation error for Israeli mobile format
    why_human: Zod superRefine runs in Server Action requires live round-trip
  - test: Add duplicate attendance clock IDs and try to submit
    expected: Client-side toast.error about duplicates; form NOT submitted
    why_human: Client-side validation in handleSubmit requires live browser interaction
  - test: Upload client logo via drag and drop
    expected: Preview shows; after save client_logo_url in DB contains Supabase Storage public URL
    why_human: Requires Supabase Storage client-logos bucket to exist
  - test: Click on map to set project location
    expected: Latitude/Longitude inputs update; blue Circle appears at correct radius
    why_human: Visual interactive test requires Leaflet to load in browser
  - test: Filter projects by status view_only
    expected: Only view_only projects shown; active count badge unchanged
    why_human: Requires live project data with different statuses in DB
  - test: Export projects table to Excel
    expected: Downloads projects_export_YYYY-MM-DD.xlsx with RTL layout; no deleted_at column
    why_human: Requires running dev server with authenticated session
  - test: Edit project remove an attendance clock save
    expected: Only remaining clocks in attendance_clocks table for that project
    why_human: Requires live DB state verification of replace-all pattern
---
# Phase 4: Projects Verification Report

**Phase Goal:** The admin can manage the full project registry. Each project has all required fields (basic info, client with logo, supervision contact, attendance clocks, employee-linked managers, conditional CVC, map location with radius), with export capability across all admin tables.

**Verified:** 2026-03-03T22:00:00Z
**Status:** human_needed - all automated code checks passed; pending migration execution and live UI testing
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can create a project with all fields | VERIFIED | ProjectForm.tsx 1013 lines, all 7 sections present, createProject Server Action wired via useActionState |
| 2 | Project has PM with auto-pulled email/phone from employee | VERIFIED | EmployeeCombobox onChange: setPmEmail(emp.email), setPmPhone(formatIsraeliPhone(emp.mobile_phone)) |
| 3 | Project has SM with auto-pulled email/phone | VERIFIED | Same pattern as PM; second EmployeeCombobox instance |
| 4 | CVC toggles between employee selection and manual entry (name + phone) | VERIFIED | Radio toggle; cvcIsEmployee state; superRefine validates Israeli mobile when false; cvc_name added in migration 00015 |
| 5 | Attendance clocks can be added/removed dynamically | VERIFIED | addClock/removeClock/updateClock handlers; JSON.stringify to hidden input; replace-all in updateProject |
| 6 | Client name and logo with drag and drop upload | VERIFIED | onDragOver/onDragLeave/onDrop handlers; logoFile state; Storage upload in handleSubmit before formAction |
| 7 | Supervision company contact info with notification toggles | VERIFIED | Section 5: supervision_company, supervision_contact, supervision_email, supervision_phone plus 2 boolean checkboxes |
| 8 | Map with click-to-place marker and adjustable radius | VERIFIED | ProjectLocationPicker: useMapEvents click handler; Circle with radius prop; dynamic ssr:false import |
| 9 | Status filter (active/view_only/inactive) with count badge | VERIFIED | 4-option Select filter; memoized activeCount from full projects list; green Badge shows count |
| 10 | Edit and soft-delete from table | VERIFIED | openEdit() opens ProjectForm in edit mode; DeleteConfirmDialog calls softDeleteProject RPC |
| 11 | Project number field (editable, auto-gen fallback) | VERIFIED | Input not disabled; empty string triggers DB trigger (PR26XXXXXX); UNIQUE partial index on active projects |
| 12 | Universal Excel/CSV export Route Handler | VERIFIED | /api/export GET: ALLOWED_TABLES whitelist, verifySession, ExcelJS RTL workbook, both format branches |

**Score:** 12/12 truths verified (automated code analysis)
---

### Required Artifacts

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| supabase/migrations/00014_projects_rebuild.sql | -- | 244 | VERIFIED | Full schema rebuild + attendance_clocks + sequence + triggers + RLS + RPC + Storage policies |
| supabase/migrations/00015_add_cvc_name.sql | -- | 11 | VERIFIED | ALTER TABLE adds cvc_name TEXT for manual CVC entry |
| src/types/database.ts | -- | 494+ | VERIFIED | projects Row/Insert/Update + attendance_clocks types; cvc_name included |
| src/lib/schemas.ts | -- | 180 | VERIFIED | ProjectSchema with all fields; superRefine CVC conditional validation |
| src/actions/projects.ts | -- | 394 | VERIFIED | createProject + updateProject + softDeleteProject; all with verifySession + audit log |
| src/components/admin/projects/ProjectForm.tsx | 400 | 1013 | VERIFIED | Full 7-section dialog; dynamic ssr:false; 3 EmployeeCombobox instances; drag-drop logo |
| src/components/admin/projects/ProjectLocationPicker.tsx | 30 | 96 | VERIFIED | react-leaflet MapContainer + TileLayer + Circle + ClickHandler; leaflet CSS imported |
| src/components/admin/projects/EmployeeCombobox.tsx | 40 | 167 | VERIFIED | Popover+Command; custom filter for UUID values; onChange auto-pull callback |
| src/components/admin/projects/ProjectsTable.tsx | 100 | 464 | VERIFIED | 3-state filter; active count badge; export dropdown; TanStack Table; edit/delete |
| src/app/(admin)/admin/projects/page.tsx | 30 | 90 | VERIFIED | Server component; verifySession; parallel fetch; clocksMap build |
| src/app/(admin)/api/export/route.ts | 50 | 167 | VERIFIED | GET handler; whitelist; ExcelJS RTL; xlsx + csv; auth guard |
| src/components/shared/SidebarNav.tsx | -- | 79 | VERIFIED | /admin/projects nav item present; usePathname() active detection |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ProjectForm.tsx | src/actions/projects.ts | useActionState(createProject/updateProject) | WIRED | Lines 34, 164 - import and binding confirmed |
| ProjectForm.tsx | ProjectLocationPicker.tsx | dynamic(ssr:false) | WIRED | Lines 51-58 - prevents SSR crash |
| ProjectForm.tsx | EmployeeCombobox.tsx | 3 EmployeeCombobox renders (PM, SM, CVC) | WIRED | Lines 484, 545, 645 |
| src/actions/projects.ts | src/lib/schemas.ts | ProjectSchema.safeParse | WIRED | Lines 25, 86, 225 - import and both safeParse calls |
| src/actions/projects.ts | supabase projects table | .insert() and .update() | WIRED | Lines 94, 242 - real DB mutations |
| src/actions/projects.ts | supabase RPC | .rpc(soft_delete_projects) | WIRED | Line 368 - with p_ids array |
| page.tsx | ProjectsTable.tsx | renders with fetched data | WIRED | Lines 14, 83 |
| page.tsx | supabase | parallel fetch with employee joins | WIRED | Lines 28-46 - actual DB queries |
| /api/export route.ts | src/lib/dal.ts | verifySession() at route start | WIRED | Lines 24, 69-73 |
| ProjectsTable.tsx | /api/export | window.location.href on export click | WIRED | Lines 334, 340 - xlsx and csv branches |
---

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|---------|
| PROJ-01: Admin can create a project with all fields | SATISFIED | createProject Server Action + full 7-section ProjectForm |
| PROJ-02: PM with auto-pulled email/phone | SATISFIED | EmployeeCombobox onChange sets pmEmail/pmPhone; hidden inputs send to Server Action |
| PROJ-03: SM with auto-pulled email/phone | SATISFIED | Same pattern as PM with smEmail/smPhone |
| PROJ-04: CVC toggles employee/manual (name + phone) | SATISFIED | Radio toggle; cvcIsEmployee state; superRefine validates; cvc_name in 00015 |
| PROJ-05: Attendance clocks add/remove dynamically | SATISFIED | addClock/removeClock handlers; JSON to hidden input; replace-all in updateProject |
| PROJ-06: Client name and logo with drag and drop | SATISFIED | Drag-and-drop div; logoFile state; Storage upload; client-logos policies in 00014 |
| PROJ-07: Supervision contact info + notification toggles | SATISFIED | Section 5 with all fields and 2 boolean checkboxes |
| PROJ-08: Map click-to-place + adjustable radius | SATISFIED | ProjectLocationPicker with useMapEvents; Circle with radius; ssr:false |
| PROJ-09: Status filter (3-state) with count badge | SATISFIED | 4-option Select; memoized activeCount Badge |
| PROJ-10: Edit and soft-delete from table | SATISFIED | openEdit() + ProjectForm edit mode; DeleteConfirmDialog + RPC |
| PROJ-11: Project number field (editable, auto-gen) | SATISFIED | Input editable; empty string triggers trigger; UNIQUE partial index |
| EXPORT-01: Universal Excel/CSV export Route Handler | SATISFIED | /api/export GET for 6 tables; RTL; bold headers; internal cols excluded |

---

### Anti-Patterns Found

| File | Issue | Severity | Impact |
|------|-------|----------|--------|
| supabase/migrations/00014_projects_rebuild.sql | Uncommitted change: DROP FUNCTION IF EXISTS added before CREATE OR REPLACE (idempotency improvement) | Info | Should be committed before running migration; no functional impact |
| src/app/(admin)/admin/projects/page.tsx line 70 | as any[] cast for projects joined data | Info | TypeScript escape for Supabase join type complexity; runtime safe |
| src/app/(admin)/api/export/route.ts lines 147 and 159 | as any cast for ExcelJS buffer | Info | Known @types/node v22 vs exceljs type mismatch; established pattern; runtime safe |
| page.tsx employee select line 38 | employee_number not fetched; combobox searches by name only | Warning | Employee numbers will not appear in combobox dropdown; search still works; not a requirement blocker |
---

### Human Verification Required

#### 1. Apply DB Migrations

**Test:** Create client-logos Storage bucket in Supabase Dashboard (Storage -> New Bucket -> client-logos, Public: ON). Then run 00014_projects_rebuild.sql followed by 00015_add_cvc_name.sql in the Supabase SQL Editor.

**Expected:** projects table created with all columns including cvc_name; attendance_clocks table with FK CASCADE; projects_number_seq sequence; soft_delete_projects RPC function; Storage policies for client-logos bucket.

**Why human:** Cannot verify Supabase DB state from code alone.

#### 2. Project Create with Auto-Generated Number

**Test:** Open the dialog, fill in project name only, leave project number blank, click save.

**Expected:** Project saved with number in format PR26000001 (increments per DB sequence).

**Why human:** DB trigger logic runs server-side after INSERT.

#### 3. PM/SM Employee Selection and Auto-Pull

**Test:** Open create dialog, click PM combobox, search by employee name, select an employee.

**Expected:** pm_email and pm_phone fields populate automatically; phone formatted as 05x-xxxxxxx.

**Why human:** Requires live UI with real employee data in DB.

#### 4. CVC Manual Mode Validation

**Test:** Toggle CVC to manual mode, enter a name, enter 12345 as phone, click save.

**Expected:** Hebrew error message about invalid Israeli mobile format.

**Why human:** Zod superRefine validation runs in Server Action.

#### 5. Attendance Clock Duplicate Check

**Test:** Add two clocks with the same ID, click save.

**Expected:** toast.error with Hebrew message about duplicates; form does NOT reach the server.

**Why human:** Client-side validation in handleSubmit.

#### 6. Client Logo Drag and Drop

**Test:** Drag a PNG image onto the logo area; observe preview; save project.

**Expected:** Logo preview appears on drop; after save, client_logo_url in DB is a Supabase Storage public URL.

**Why human:** Requires Supabase Storage client-logos bucket to exist.

#### 7. Map Location Picker

**Test:** Open ProjectForm, scroll to Section 7, click in Israel on the map.

**Expected:** Latitude/Longitude inputs update to clicked coordinates; blue Circle renders at the specified radius.

**Why human:** Visual interactive test requiring Leaflet to load in browser.

#### 8. Status Filter (3-State)

**Test:** Create projects with statuses active, view_only, and inactive. Filter by view_only.

**Expected:** Only view_only projects shown; active count badge unchanged.

**Why human:** Requires live project data with multiple statuses.

#### 9. Excel Export Download

**Test:** Navigate to /admin/projects while logged in, click Export -> Export Excel.

**Expected:** Browser downloads projects_export_YYYY-MM-DD.xlsx with RTL layout; no deleted_at column visible.

**Why human:** Requires authenticated dev server session.

#### 10. Edit Project and Verify Clock Replace-All

**Test:** Open a project with 2 attendance clocks in edit mode, remove one clock, save.

**Expected:** attendance_clocks table for that project has only 1 row after save.

**Why human:** Requires live DB state inspection after save.

---

## Gaps Summary

No code-level gaps found. The implementation is complete and correct based on static analysis. All 12 requirements are satisfied by the code. All required files exist with substantive implementations. All key links between components, Server Actions, DB, and API routes are wired. No placeholder or TODO patterns found in delivered files. The security pattern (verifySession + ALLOWED_TABLES whitelist + SECURITY DEFINER RPC) is correctly applied throughout.

The phase is at human_needed status for two reasons:

1. Migration not yet applied: migrations 00014 and 00015 must be executed in Supabase. The client-logos Storage bucket must be created manually in Supabase Dashboard before running 00014.

2. Live end-to-end testing required: 10 human verification items cover the complete user flow including DB trigger behavior, file upload, map interaction, and export download.

Pre-flight note: The uncommitted change in supabase/migrations/00014_projects_rebuild.sql (adding DROP FUNCTION IF EXISTS generate_project_number() CASCADE before the function body) should be committed before running the migration. This improves idempotency so the migration can be re-run safely.

Minor warning: The projects page does not fetch employee_number for the employees query, so employee numbers will not appear in the EmployeeCombobox dropdown. This does not block any requirement. Fix: add employee_number to the SELECT in src/app/(admin)/admin/projects/page.tsx line 38.

---

_Verified: 2026-03-03_
_Verifier: Claude Sonnet 4.6 (gsd-verifier)_