# Feature Landscape

**Domain:** Internal enterprise admin panel (HR + project + user management)
**Researched:** 2026-03-01
**Confidence:** MEDIUM — based on domain expertise and project context

---

## Table Stakes

Features users expect in any enterprise admin panel. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Employee list with search + filter | Core HR interaction — admins live in this view | Low | Filter by company, department, status, role tag |
| Employee profile CRUD | Create/read/update/delete is baseline HR operation | Low | Soft delete, not hard delete |
| Excel import from payroll system | Payroll → HR data sync is standard in Israeli enterprise | High | Composite key (employee_number + company_id); must handle duplicates, partial rows, encoding (Hebrew UTF-8) |
| Excel export | Audit, payroll cross-reference, reporting | Medium | Must match import column structure exactly |
| Department management (CRUD) | Organizational structure is prerequisite to everything else | Low | Parent-child hierarchy if needed later |
| Company management (CRUD) | Multi-company structure requires this first | Low | ChemoSystem has multiple legal entities |
| User account management | Access control requires user accounts | Low | One user linked to one employee |
| Role-based permissions (module-level) | Standard access control — no access / read / read+write | Medium | Per module + per sub-module granularity |
| Role templates (predefined permission sets) | Reduces admin burden when onboarding users | Medium | Templates as defaults; individual overrides applied on top |
| Login + session management | Security baseline | Medium | Auth system with secure session handling |
| Audit log (who did what, when) | Compliance and accountability requirement for infrastructure companies | High | Every create/update/delete captured with actor + timestamp + before/after |
| Soft delete everywhere | Data recovery, compliance, audit integrity | Medium | Deleted records remain in DB with deleted_at timestamp |
| RTL Hebrew UI | Israeli workforce — Hebrew is the working language | Medium | Full RTL layout, not just text direction |
| Mobile-responsive layout | Field workers and managers use phones | Medium | Especially for project status views |
| Project list with status tracking | Core operational visibility for energy project managers | Low | Status: planning / active / on-hold / completed |
| Project-employee linkage (manager field) | Projects must be assigned to a responsible person | Low | FK to employees table |
| System settings panel | Every enterprise system needs configurable constants | Low | Company name, defaults, feature flags |
| Dashboard with summary stats | First screen must give orientation at a glance | Medium | Employee count, active projects, recent activity |

---

## Differentiators

Features that go beyond baseline and provide genuine value for ChemoSys specifically.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Granular per-user permission overrides on top of role templates | Covers edge cases without creating a new template for every exception | High | Template inheritance with override layer — rare in simpler systems |
| Excel import preview + conflict resolution UI | Prevents silent data corruption during payroll imports | High | Show rows with conflicts before committing; allow admin to resolve each |
| Composite employee key (employee_number + company_id) | Supports multi-company without ID collisions — mirrors payroll system reality | Medium | Most systems use single surrogate key; this matches real payroll logic |
| Map view for projects (coordinates field) | Energy infrastructure projects are geo-located — map gives spatial context | High | Requires map library (Leaflet or Google Maps); coordinates stored as lat/lng |
| Audit log with before/after diff | Not just "what happened" but "what changed" — critical for compliance | High | Store JSON snapshots of record before and after mutation |
| Per-module visibility control in navigation | Users only see tabs they have access to — reduces confusion and security surface | Medium | UI responds to permission set; menu items hidden not just disabled |
| Role tag system (not just department) | Tags like "safety officer" or "crane operator" cut across departments | Medium | Many-to-many employee-to-tag relationship |
| Inline edit in employee table | Faster for bulk updates than navigating to profile view | Medium | Optional UX enhancement, not required for v1 |
| Import history log | Track who imported what file, when, and what changed | Medium | Useful for reconciling payroll discrepancies after the fact |

---

## Anti-Features

Features to explicitly NOT build in ChemoSys.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time chat / messaging | Out of scope — WhatsApp/n8n handles field comms | Link to existing comms channels in employee profile if needed |
| Payroll calculation engine | ChemoSys is downstream of payroll, not a payroll system | Import from payroll via Excel; never replicate payroll logic |
| Time tracking / attendance | Scope creep — separate system concern | Keep employee fields to identity/role, not activity tracking |
| Document storage / file attachments | Adds infrastructure complexity (S3, CDN) for minimal benefit in v1 | Defer to a later phase if genuinely needed |
| Email notification system | Notification infrastructure is a project in itself | Use simple in-app alerts for v1; defer email to later |
| Mobile app (native iOS/Android) | Responsive web covers 95% of mobile needs for admin panels | Keep as responsive web; PWA is acceptable future upgrade |
| AI-generated reports | Not validated user need; adds complexity and cost | Build accurate data model first; AI layer can come later |
| Multi-language beyond Hebrew+English | Not needed for current workforce | Hebrew primary, English for technical fields; no other langs |
| Hard delete of any record | Destroys audit trail | All deletes must be soft (deleted_at timestamp) |
| Public-facing pages | This is internal only | No public routes; auth required for all pages |

---

## Feature Dependencies

```
Company CRUD
  → Department CRUD (departments belong to companies)
    → Employee CRUD (employees belong to departments + companies)
      → Excel Import/Export (operates on employee records)
      → User Account Management (users are linked to employees)
        → Role Templates (assigned to users)
          → Granular Permission Overrides (applied on top of templates)
            → Per-module nav visibility (derived from resolved permissions)

Employee CRUD
  → Project Management (projects have manager = employee FK)
    → Map View (projects have coordinates)

All write operations
  → Audit Log (every mutation captured)

Soft Delete
  → All CRUD modules (must be implemented from the start, not retrofitted)
```

---

## Phase-Specific Feature Grouping

| Phase | Features | Rationale |
|-------|----------|-----------|
| Phase 1: Foundation | Companies, Departments, Role Tags, Employees (CRUD + soft delete), Auth + Login, Basic Audit Log, RTL UI, Dashboard | Everything else depends on this |
| Phase 2: Data Operations | Excel Import/Export, Import conflict detection, composite key handling | Payroll integration is the primary operational pain point |
| Phase 3: Access Control | Users, Role Templates, Granular Permission Overrides, Nav visibility | Can only be properly built once employee model is stable |
| Phase 4: Projects + Ops | Projects CRUD, manager linkage, status tracking, map view | Operational layer on top of organizational foundation |
| Phase 5: Settings + Observability | System settings, Config.ini editor, API integrations, full audit diff log, dashboard enhancements | Configuration and compliance layer |
