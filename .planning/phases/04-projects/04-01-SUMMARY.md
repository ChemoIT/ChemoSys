---
phase: 04-projects
plan: "01"
subsystem: projects-data-layer
tags: [database, migration, server-actions, zod, leaflet, csp, typescript]
dependency_graph:
  requires:
    - 02-employees (employees table for PM/SM/CVC FK references)
    - 03.1-security-hardening (CSP infrastructure in next.config.ts)
  provides:
    - projects table with full field set (PM/SM/CVC/client/supervision/location)
    - attendance_clocks child table
    - project number auto-generation (PR26XXXXXX)
    - soft_delete_projects RPC
    - ProjectSchema with conditional CVC validation
    - createProject / updateProject / softDeleteProject Server Actions
  affects:
    - 04-02-plan (ProjectForm depends on ProjectSchema + Server Actions)
    - 04-03-plan (ProjectsTable depends on projects table + softDelete)
tech_stack:
  added:
    - leaflet@1.9.4
    - react-leaflet@5.0.0
    - "@types/leaflet@1.9.21"
  patterns:
    - SECURITY DEFINER RPC for soft-delete (same as employees)
    - replace-all junction table pattern for attendance_clocks
    - formDataToBoolean helper for checkbox/hidden boolean normalisation
    - nullIfEmpty helper for optional text fields
key_files:
  created:
    - supabase/migrations/00014_projects_rebuild.sql
    - src/actions/projects.ts
  modified:
    - src/types/database.ts
    - src/lib/schemas.ts
    - next.config.ts
    - package.json
decisions:
  - "react-leaflet v5 chosen (latest stable, React 19 compatible)"
  - "project_number sent as empty string on INSERT — DB trigger fills in PR26XXXXXX"
  - "cvc_is_employee=false requires cvc_phone — Israeli mobile regex enforced in superRefine"
  - "attendance_clocks sent as JSON string via FormData — parsed in Server Action"
  - "replace-all pattern for clocks on update (same as employee_role_tags)"
metrics:
  duration: "~5 min (287 seconds)"
  completed: "2026-03-03"
  tasks_completed: 2
  files_created: 2
  files_modified: 4
---

# Phase 4 Plan 01: Projects Data Layer Summary

**One-liner:** Projects DB rebuild with PM/SM/CVC/location/clocks + ProjectSchema + CRUD Server Actions + leaflet + OpenStreetMap CSP.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | DB migration + TypeScript types + CSP + leaflet | 7d17f07 | 00014_projects_rebuild.sql, database.ts, next.config.ts, package.json |
| 2 | ProjectSchema + Server Actions | ece8f68 | schemas.ts, actions/projects.ts |

## What Was Built

### Migration 00014 (`supabase/migrations/00014_projects_rebuild.sql`)

Full projects table rebuild including:
- Basic info: name, project_number (auto PR26XXXXXX), open_date, expense_number, description, project_type, status (active/view_only/inactive)
- PM section: project_manager_id (FK employees), pm_email, pm_phone, pm_notifications
- SM section: site_manager_id (FK employees), sm_email, sm_phone, sm_notifications
- CVC section: camp_vehicle_coordinator_id (FK employees nullable), cvc_is_employee, cvc_phone
- Client: client_name, client_logo_url (Supabase Storage)
- Supervision: supervision_company, supervision_contact, supervision_email, supervision_phone, supervision_notifications, supervision_attach_reports
- Location: latitude, longitude, radius (meters, default 100)
- Universal: created_at, updated_at, created_by, updated_by, deleted_at

Child table `attendance_clocks` with ON DELETE CASCADE, unique index on (project_id, clock_id).

Sequence `projects_number_seq` + BEFORE INSERT trigger generating `PR26` + 6-digit padded number.

RLS policies for both tables. `soft_delete_projects` SECURITY DEFINER RPC. Storage policies for `client-logos` bucket.

### TypeScript Types (`src/types/database.ts`)

- Replaced old stub `projects` type with full schema (all new columns, status includes 'view_only')
- Added `attendance_clocks` table: Row / Insert / Update types

### CSP Update (`next.config.ts`)

Added `https://*.tile.openstreetmap.org` to both:
- `connect-src` — allows Leaflet to fetch map tiles
- `img-src` — allows map tile images to render

### Leaflet Installation (`package.json`)

- `leaflet@^1.9.4` (dependencies)
- `react-leaflet@^5.0.0` (dependencies)
- `@types/leaflet@^1.9.21` (devDependencies)

### ProjectSchema (`src/lib/schemas.ts`)

Full Zod schema with:
- `name` as required (min 1)
- All optional fields via `.optional().or(z.literal(''))`
- Boolean fields: pm_notifications (default true), sm_notifications (default true), cvc_is_employee (default true), supervision_notifications (default false), supervision_attach_reports (default false)
- Location: latitude/longitude as `z.coerce.number().optional().nullable()`, radius as `z.coerce.number().int().min(0).default(100)`
- `attendance_clocks` as JSON string (parsed in Server Action)
- `.superRefine()` for conditional CVC: when `cvc_is_employee=false`, `cvc_phone` is required and must match Israeli mobile regex `/^0(5[0-9])[0-9]{7}$/`

### Server Actions (`src/actions/projects.ts`)

Three exported Server Actions:

**createProject(prevState, formData)**
- verifySession() first
- extracts clocksJson before FormData parse
- normalises boolean fields via `formDataToBoolean()`
- Zod validation → Hebrew field errors on failure
- INSERT with `project_number: ''` (trigger fills in)
- INSERT attendance_clocks from parsed JSON array
- writeAuditLog INSERT
- revalidatePath('/admin/projects')

**updateProject(prevState, formData)**
- verifySession() first
- extracts project id and clocksJson
- same boolean normalisation + Zod validation
- fetches old data for audit log
- UPDATE project row
- replace-all: DELETE existing clocks, INSERT new set
- writeAuditLog UPDATE with old/new data
- revalidatePath('/admin/projects')

**softDeleteProject(id: string)**
- verifySession() first
- fetches old data (validates row exists)
- `.rpc('soft_delete_projects', { p_ids: [id] })` — SECURITY DEFINER
- writeAuditLog DELETE
- revalidatePath('/admin/projects')

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All files confirmed present. All commits confirmed in git log.

| Check | Result |
|-------|--------|
| `supabase/migrations/00014_projects_rebuild.sql` | FOUND |
| `src/actions/projects.ts` | FOUND |
| `src/types/database.ts` | FOUND |
| `src/lib/schemas.ts` | FOUND |
| `next.config.ts` | FOUND |
| `package.json` | FOUND |
| commit 7d17f07 | FOUND |
| commit ece8f68 | FOUND |
