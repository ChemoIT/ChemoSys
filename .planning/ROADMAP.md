# Roadmap: ChemoSys — מערכת ניהול פנימית לחמו אהרון

## Overview

ChemoSys is a Hebrew-first internal admin panel for Chemo Aharon Ltd. The system is built in five phases following strict dependency order: foundation and reference data first, then the core employee module, then the permission and user system, then projects, and finally observability and configuration. Each phase delivers a complete, verifiable capability before the next begins. The admin shell that emerges from Phase 1 is the infrastructure on which all future modules (fleet, equipment) will be built.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Auth, DB schema, RTL shell, and all reference entities (companies, departments, role tags)
- [ ] **Phase 2: Employees** - Full employee CRUD with Excel import from payroll system
- [ ] **Phase 3: Access Control** - Users, role templates, permissions matrix, and enforced navigation
- [ ] **Phase 4: Projects** - Project management with employee-linked roles
- [ ] **Phase 5: Settings and Observability** - System config, audit log viewer, and dashboard

## Phase Details

### Phase 1: Foundation

**Goal:** The admin shell is live, authenticated, and ready to hold data — with correct DB schema, RTL Hebrew UI, working login, and all reference entities (companies, departments, role tags) manageable by an admin.

**Depends on:** Nothing (first phase)

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, COMP-01, COMP-02, COMP-03, COMP-04, DEPT-01, DEPT-02, DEPT-03, DEPT-04, RTAG-01, RTAG-02, RTAG-03, AUDT-01

**Success Criteria** (what must be TRUE):
  1. Admin can log in with email and password, and the session persists after browser refresh
  2. An unauthenticated user who visits any admin URL is redirected to the login page, which displays the full Chemo Aharon logo in Hebrew
  3. The admin shell renders in Hebrew RTL with the dark sidebar on the right, Heebo font, Chemo Aharon brand colors, and is usable on mobile and tablet
  4. Admin can create, edit, and soft-delete companies, departments (with parent-child hierarchy), and role tags — and soft-deleted records do not appear in lists
  5. Every create, update, and soft-delete action is automatically written to the audit log (who, what entity, when)

**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold: Next.js 16 + Supabase clients + Tailwind v4 RTL + Heebo font + brand theme
- [x] 01-02-PLAN.md — DB schema: all tables with universal columns, soft-delete partial indexes, RLS policies, triggers, audit_log, modules seed, TypeScript types
- [x] 01-03-PLAN.md — Auth + admin shell: login page, session management, protected routes, DAL, audit utility, responsive sidebar layout
- [x] 01-04-PLAN.md — Reference entities: Companies, Departments (hierarchical), Role Tags CRUD with data tables, forms, soft delete, audit logging

---

### Phase 2: Employees

**Goal:** The admin has a fully operational employee registry — searchable, filterable, and synchronized with the payroll system via Excel import.

**Depends on:** Phase 1 (companies, departments, role tags, and audit log infrastructure must exist)

**Requirements:** EMPL-01, EMPL-02, EMPL-03, EMPL-04, EMPL-05, EMPL-06, EMPL-07, EMPL-08, EMPL-09, EMPL-10

**Success Criteria** (what must be TRUE):
  1. Admin can add, edit, and soft-delete employees with all fields (personal info, address, dates, status, passport, citizenship, communication language, profession, notes)
  2. Admin can link an employee to a company, department, and sub-department, and assign multiple role tags
  3. The employee list is searchable and filterable by company, department, and status, with results sorted on demand
  4. Admin can import employees from a payroll system Excel file — existing employees (matched by employee number + company) are updated automatically, and new employees are created
  5. The composite unique key (employee number + company) is enforced: the same employee number can exist in different companies but not twice in the same company

**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — Employee CRUD: Zod schema (22 fields), 4 Server Actions (create/update/softDelete/suspend), cascading company/department selectors, role tag multi-select (Popover+Command), filterable/searchable/sortable employee list
- [ ] 02-02-PLAN.md — Excel import: exceljs parsing, SECURITY DEFINER RPC upsert function (partial index workaround), import wizard with company selector + preview + confirm flow, column mapping for demo.xlsx

---

### Phase 3: Access Control

**Goal:** The admin can create user accounts and assign permissions via templates or manually — building the full permission management infrastructure for future ChemoSys modules. Note: this admin interface is Sharon-only; permission enforcement will apply to future ChemoSys module pages, not to this admin shell.

**Depends on:** Phase 2 (users are linked to employees; employee list must be populated)

**Requirements:** USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, NAVP-01, NAVP-02, NAVP-03

**Success Criteria** (what must be TRUE):
  1. Admin can create a new user by searching for an active employee and linking a Supabase Auth account to them
  2. Admin can create a role template with a named permission set, assign it to a user, and the user's permissions populate automatically
  3. Admin can override specific module permissions for a user after assigning a template — the override persists independently of the template
  4. Admin can manage the full user lifecycle: create, edit, block, unblock, soft-delete
  5. Permission enforcement infrastructure is in place (requirePermission, getNavPermissions, user_permissions table, get_user_permissions RPC) — ready for ChemoSys module integration when those modules are built

**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md — Role templates CRUD: TemplateSchema, Server Actions (create/update/softDelete), PermissionMatrixEditor (9 modules x 3 levels), TemplateForm dialog, TemplatesTable, templates page
- [x] 03-02-PLAN.md — User management: createAdminClient (service role), user lifecycle (create/edit/delete/block/unblock), EmployeeSearchDialog, template assignment, per-user permission overrides, UsersTable, users page
- [x] 03-03-PLAN.md — Permission infrastructure: migration 00012 (UPDATE policy + is_admin + is_current_user_blocked), requirePermission() + getNavPermissions() + checkPagePermission() + AccessDenied in DAL/components — enforcement on admin shell removed (admin is Sharon-only); infrastructure preserved for ChemoSys

---

### Phase 03.1: Security Hardening (INSERTED)

**Goal:** Apply security hardening across the full Next.js 16 + Supabase admin system before deployment: upgrade patched Next.js version (CVE fix), add security headers + CSP, add rate limiting on login, tighten RLS on user_permissions, and fix minor security gaps (server-only guard, PII logs, encryption key).

**Depends on:** Phase 3

**Plans:** 3 plans

Plans:
- [ ] 03.1-01-PLAN.md — Next.js CVE patch + security headers + CSP in next.config.ts + server-only guard on dal.ts
- [ ] 03.1-02-PLAN.md — Rate limiting on login Server Action + PII log fix in employee import + encryption key env var
- [ ] 03.1-03-PLAN.md — RLS migration 00013: tighten user_permissions write policies to admin-only

---

### Phase 4: Projects

**Goal:** The admin can manage the full project registry — each project has all required fields (basic info, client with logo, supervision contact, attendance clocks, employee-linked managers, conditional CVC, map location with radius), with export capability across all admin tables.

**Depends on:** Phase 2 (project managers are selected from the employee list)

**Requirements:** PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06, PROJ-07, PROJ-08, PROJ-09, PROJ-10, PROJ-11, EXPORT-01

**Success Criteria** (what must be TRUE):
  1. Admin can create a project with all fields and the project number is auto-generated in PR26XXXXXX format
  2. Admin can assign PM and SM from employee list (email/phone auto-pulled) with notification flags
  3. Admin can assign CVC from employees OR enter manually with Israeli mobile validation
  4. Admin can manage attendance clocks (multiple per project, each with unique ID)
  5. Admin can upload client logo (Supabase Storage) and fill supervision contact details
  6. Admin can set project location on map (coordinates + radius) — displayed visually
  7. Admin can edit and soft-delete projects; list filterable by 3-state status with active count
  8. Admin can export any admin table to Excel/CSV

**Plans:** 4 plans

Plans:
- [ ] 04-01-PLAN.md — DB migration 00014 (projects rebuild + attendance_clocks + triggers + RLS + soft-delete RPC) + TypeScript types + ProjectSchema + Server Actions + CSP update + leaflet install
- [ ] 04-02-PLAN.md — ProjectForm dialog: EmployeeCombobox, ProjectLocationPicker (react-leaflet), all 7 form sections (basic, managers, CVC, client, supervision, clocks, map)
- [ ] 04-03-PLAN.md — ProjectsTable with 3-state status filter + active count + projects page + universal Excel/CSV export Route Handler + SidebarNav update
- [ ] 04-04-PLAN.md — Checkpoint: apply migration 00014 + full Phase 4 human verification (53-step checklist)

---

### Phase 5: Settings and Observability

**Goal:** The admin can view a dashboard with live stats and recent activity, browse a filterable audit log of all system actions, and manage integration settings (SMS, WhatsApp, FTP, Telegram, LLM) via a visual .env.local editor UI. Dashboard is a separate sidebar tab. No Config.ini — all settings via .env.local.

**Depends on:** Phase 1 (audit log data accumulates from Phase 1 onward; settings infrastructure needs the shell)

**Requirements:** SETT-01, SETT-02, SETT-03, SETT-04, AUDT-02, DASH-01, DASH-02

**Success Criteria** (what must be TRUE):
  1. Admin can view and edit integration settings (.env.local) from within the settings tab with a visual accordion UI
  2. Admin can add, edit, enable/disable, and test API integrations (SMS, WhatsApp, FTP, Telegram, LLM) with type-specific fields
  3. Admin can view the audit log filtered by entity type, action type, free-text search, and date range — with expandable rows showing before/after changes
  4. The dashboard displays counts of active employees, active projects, total users, companies, departments, and role tags, plus a list of the 20 most recent audit log entries

**Plans:** 3 plans

Plans:
- [x] 05-01-PLAN.md — Dashboard: 6 summary stat cards + 20 recent activity entries from audit_log with user name resolution
- [x] 05-02-PLAN.md — Audit log viewer: server-side filtered table (entity, action, search, date range), 50 rows/page, expandable rows with old/new data diff, Excel/CSV export via dedicated Route Handler, sidebar nav entry
- [x] 05-03-PLAN.md — Integration settings: .env.local read/write library, 5 integration accordion sections (SMS, WhatsApp, FTP, Telegram, LLM) with save, enable/disable toggle, and test connection

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 03.1 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete | 2026-03-01 |
| 2. Employees | 2/2 | Complete | 2026-03-01 |
| 3. Access Control | 3/3 | Complete | 2026-03-03 |
| 03.1. Security Hardening | 3/3 | Complete | 2026-03-03 |
| 4. Projects | 4/4 | Complete | 2026-03-03 |
| 5. Settings and Observability | 3/3 | Complete | 2026-03-03 |

---

## Coverage

All 59 v1 requirements mapped to exactly one phase.

| Phase | Requirements |
|-------|-------------|
| 1. Foundation | FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, COMP-01, COMP-02, COMP-03, COMP-04, DEPT-01, DEPT-02, DEPT-03, DEPT-04, RTAG-01, RTAG-02, RTAG-03, AUDT-01 |
| 2. Employees | EMPL-01, EMPL-02, EMPL-03, EMPL-04, EMPL-05, EMPL-06, EMPL-07, EMPL-08, EMPL-09, EMPL-10 |
| 3. Access Control | USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, NAVP-01, NAVP-02, NAVP-03 |
| 4. Projects | PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06, PROJ-07, PROJ-08, PROJ-09, PROJ-10, PROJ-11, EXPORT-01 |
| 5. Settings and Observability | SETT-01, SETT-02, SETT-03, SETT-04, AUDT-02, DASH-01, DASH-02 |

**Total mapped: 65/65**

Note: Phase 4 requirements expanded from 6 to 12 (PROJ-07 through PROJ-11 + EXPORT-01 added 2026-03-03).

---

*Roadmap created: 2026-03-01*
*Last updated: 2026-03-03 — Phase 5 complete: all 3 plans executed and verified (13/13)*
