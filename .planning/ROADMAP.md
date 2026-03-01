# Roadmap: ChemoSys — מערכת ניהול פנימית לחמו אהרון

## Overview

ChemoSys is a Hebrew-first internal admin panel for Chemo Aharon Ltd. The system is built in five phases following strict dependency order: foundation and reference data first, then the core employee module, then the permission and user system, then projects, and finally observability and configuration. Each phase delivers a complete, verifiable capability before the next begins. The admin shell that emerges from Phase 1 is the infrastructure on which all future modules (fleet, equipment) will be built.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Auth, DB schema, RTL shell, and all reference entities (companies, departments, role tags)
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

**Plans:** TBD (estimated 4 plans)

Plans:
- [ ] 01-01: Project scaffold — Next.js + Supabase + Tailwind RTL + Heebo font + brand theme
- [ ] 01-02: DB schema — all tables with universal columns, soft-delete partial indexes, RLS, triggers, audit_log table, modules seed
- [ ] 01-03: Auth — login page, session management, protected routes, DAL + permission infrastructure stubs
- [ ] 01-04: Reference entities — Companies, Departments (hierarchical), Role Tags CRUD tabs with soft delete

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

**Plans:** TBD (estimated 2 plans)

Plans:
- [ ] 02-01: Employee CRUD — all fields, soft delete, status management, role tag multi-select, company/department FKs, composite key enforcement, filtered list with search
- [ ] 02-02: Excel import — payroll column mapping, composite key matching, batch upsert, import confirmation flow

---

### Phase 3: Access Control

**Goal:** The admin can create user accounts, assign permissions via templates or manually, and the system enforces access control on every route and mutation — users only see and can do what they are authorized for.

**Depends on:** Phase 2 (users are linked to employees; employee list must be populated)

**Requirements:** USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, NAVP-01, NAVP-02, NAVP-03

**Success Criteria** (what must be TRUE):
  1. Admin can create a new user by searching for an active employee and linking a Supabase Auth account to them
  2. Admin can create a role template with a named permission set, assign it to a user, and the user's permissions populate automatically
  3. Admin can override specific module permissions for a user after assigning a template — the override persists independently of the template
  4. A logged-in user only sees the sidebar tabs for modules they have access to; attempting to navigate directly to a tab they cannot access shows an "אין גישה" message
  5. Every permission check for mutations is enforced server-side (Server Actions), not only in the UI

**Plans:** TBD (estimated 3 plans)

Plans:
- [ ] 03-01: Role templates CRUD — permission matrix UI, template create/edit/delete
- [ ] 03-02: User management — create user linked to employee, assign/block/delete user, assign template
- [ ] 03-03: Permission enforcement — server-side requirePermission() on all Server Actions, sidebar nav filtering, access-denied page

---

### Phase 4: Projects

**Goal:** The admin can manage the full project registry — each project has a unique auto-generated number, is linked to employee managers, and the list is filterable by status.

**Depends on:** Phase 2 (project managers are selected from the employee list)

**Requirements:** PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06

**Success Criteria** (what must be TRUE):
  1. Admin can create a project with all fields (name, display name, description, codes, type, supervision, client, status, coordinates) and the project number is auto-generated in PR25XXXXXX format
  2. Admin can assign project manager, site manager, and camp vehicle coordinator by searching the employee list
  3. Admin can edit and soft-delete projects
  4. The project list is filterable by status (active / inactive) and shows the correct active count

**Plans:** TBD (estimated 2 plans)

Plans:
- [ ] 04-01: Project CRUD — all fields, auto-number generation, soft delete, employee FK selectors for manager roles
- [ ] 04-02: Project list — status filter, display of active/inactive counts

---

### Phase 5: Settings and Observability

**Goal:** The admin can configure system integrations and read the config file, view a filterable audit log of all past actions, and the dashboard shows live summary stats with recent activity.

**Depends on:** Phase 1 (audit log data accumulates from Phase 1 onward; settings infrastructure needs the shell)

**Requirements:** SETT-01, SETT-02, SETT-03, SETT-04, AUDT-02, DASH-01, DASH-02

**Success Criteria** (what must be TRUE):
  1. Admin can read and edit the Config.ini file on the server from within the settings tab
  2. Admin can add, edit, enable/disable, and delete API integrations (SMS, WhatsApp, FTP) with endpoint and key-value parameters
  3. Admin can view the audit log filtered by user, entity type, and date range
  4. The dashboard displays counts of active employees, active projects, and total users, plus a list of the most recent audit log entries

**Plans:** TBD (estimated 3 plans)

Plans:
- [ ] 05-01: Dashboard — summary stats (active employees, projects, users) + recent activity from audit log
- [ ] 05-02: Audit log viewer — filterable table by user, entity, date range; paginated
- [ ] 05-03: System settings — Config.ini read/write Route Handler, API integrations CRUD with enable/disable

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/4 | Not started | - |
| 2. Employees | 0/2 | Not started | - |
| 3. Access Control | 0/3 | Not started | - |
| 4. Projects | 0/2 | Not started | - |
| 5. Settings and Observability | 0/3 | Not started | - |

---

## Coverage

All 59 v1 requirements mapped to exactly one phase.

| Phase | Requirements |
|-------|-------------|
| 1. Foundation | FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, COMP-01, COMP-02, COMP-03, COMP-04, DEPT-01, DEPT-02, DEPT-03, DEPT-04, RTAG-01, RTAG-02, RTAG-03, AUDT-01 |
| 2. Employees | EMPL-01, EMPL-02, EMPL-03, EMPL-04, EMPL-05, EMPL-06, EMPL-07, EMPL-08, EMPL-09, EMPL-10 |
| 3. Access Control | USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, NAVP-01, NAVP-02, NAVP-03 |
| 4. Projects | PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06 |
| 5. Settings and Observability | SETT-01, SETT-02, SETT-03, SETT-04, AUDT-02, DASH-01, DASH-02 |

**Total mapped: 59/59**

Note: REQUIREMENTS.md stated "46 total" but the file contains 59 v1 requirements. All 59 are mapped above. The stated count was set before requirements were finalized and has been corrected in the traceability table.

---

*Roadmap created: 2026-03-01*
*Last updated: 2026-03-01 after initial creation*
