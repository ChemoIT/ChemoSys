---
phase: 04-projects
plan: 01
subsystem: projects-crud-foundation
tags: [projects, migration, server-actions, form, employee-selectors, auto-number]
dependency_graph:
  requires: [03.1-security-hardening]
  provides: [project-crud-foundation, project-schema, project-server-actions, project-form]
  affects: [04-02-projects-list-page]
tech_stack:
  added: []
  patterns:
    - generate_project_number SECURITY DEFINER RPC for auto-number generation
    - soft_delete_project SECURITY DEFINER RPC for safe soft-delete
    - Boolean hidden-input pattern for checkboxes in Server Action forms
    - Select + hidden input pattern for enum fields in Server Action forms
    - EmployeeSearchDialog reuse for 3 employee FK selectors (PM, SM, CVC)
    - coordOrNull / fkOrNull helpers for empty-string-to-null conversion in Server Actions
key_files:
  created:
    - supabase/migrations/00014_project_number_sequence.sql
    - src/actions/projects.ts
    - src/components/admin/projects/ProjectForm.tsx
  modified:
    - src/lib/schemas.ts
decisions:
  - "generate_project_number() returns PR{YY}{6-digit-seq} — year prefix from CURRENT_DATE, sequence never resets"
  - "project_number is immutable after creation — updateProject never includes it in UPDATE payload"
  - "softDeleteProject uses SECURITY DEFINER RPC (not direct UPDATE) — same pattern as employees (00007)"
  - "EmployeeSearchDialog reused with linkedEmployeeIds=[] for project manager selectors — any active employee can be assigned"
  - "ProjectForm places EmployeeSearchDialog portals outside main dialog to avoid z-index stacking issues"
metrics:
  duration: "~5 min"
  completed: "2026-03-03"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 04 Plan 01: Project CRUD Foundation Summary

**One-liner:** Migration for `project_number_seq` + `generate_project_number()`/`soft_delete_project()` RPCs, `ProjectSchema` Zod validation, three Server Actions (`createProject`, `updateProject`, `softDeleteProject`), and `ProjectForm` dialog with 7 field groups and 3 `EmployeeSearchDialog` selectors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration 00014 — project number sequence + soft delete RPC | fb2647b | supabase/migrations/00014_project_number_sequence.sql |
| 2 | ProjectSchema + Server Actions + ProjectForm | 10966a2 | src/lib/schemas.ts, src/actions/projects.ts, src/components/admin/projects/ProjectForm.tsx |

## What Was Built

### Migration 00014
- `project_number_seq` — monotonically increasing SEQUENCE (START 1, no year reset)
- `generate_project_number()` — SECURITY DEFINER, returns `PR{YY}{000001}` format
- `soft_delete_project(p_id UUID)` — SECURITY DEFINER, sets `deleted_at + updated_at`

**Note:** Migration must be run manually in Supabase SQL Editor before testing project CRUD.

### ProjectSchema (schemas.ts)
Added after `TemplateSchema`. All 22 fields with Hebrew error messages:
- Boolean fields (`has_attendance_code`, `ignore_auto_equipment`, `pm_notifications`, `sm_notifications`) use `.transform(v => v === 'true')` — hidden input pattern
- FK fields (`project_manager_id`, `site_manager_id`, `camp_vehicle_coordinator_id`) as `z.string().optional().or(z.literal(''))` — null conversion in Server Action
- Coordinate fields as strings from form, converted to `number | null` in Server Action

### Server Actions (projects.ts)
Three actions following the `verifySession → safeParse → DB → writeAuditLog → revalidate` pattern:
- **`createProject`**: Calls `generate_project_number()` RPC, handles unique constraint on project_number, converts empty strings to null
- **`updateProject`**: Never passes `project_number` — it is immutable after creation
- **`softDeleteProject`**: Uses `soft_delete_project()` RPC (never direct UPDATE on deleted_at)

### ProjectForm Dialog (ProjectForm.tsx)
7 field groups in scrollable `max-h-[70vh]` container, `sm:max-w-2xl` dialog:
1. **פרטים בסיסיים** — name, display_name, project_number (read-only in edit), expense_number, general_number, description
2. **קודים** — project_code, attendance_code, has_attendance_code checkbox
3. **סיווג** — project_type Select, ignore_auto_equipment, supervision, client, status Select
4. **מנהל פרויקט** — EmployeeSearchDialog selector + pm_email, pm_phone, pm_notifications
5. **מנהל עבודה** — EmployeeSearchDialog selector + sm_email, sm_phone, sm_notifications
6. **אחראי רכבי מחנה** — EmployeeSearchDialog selector + cvc_phone
7. **קואורדינטות** — latitude + longitude with `dir="ltr"` + `inputMode="decimal"`

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- [x] `npm run build` — passes with no TypeScript errors
- [x] Migration contains `CREATE SEQUENCE`, `generate_project_number`, `soft_delete_project` — all `SECURITY DEFINER`
- [x] `ProjectSchema` exported from `schemas.ts` with all 22 fields
- [x] `projects.ts` has `createProject`, `updateProject`, `softDeleteProject` — all call `verifySession()` first
- [x] `createProject` calls `rpc('generate_project_number')` — never generates number in TypeScript
- [x] `softDeleteProject` calls `rpc('soft_delete_project')` — never direct UPDATE on `deleted_at`
- [x] `ProjectForm` imports and uses `EmployeeSearchDialog` 3 times (PM, SM, CVC)
- [x] All 4 boolean fields use hidden input pattern (`has_attendance_code`, `ignore_auto_equipment`, `pm_notifications`, `sm_notifications`)
- [x] Empty string FKs and coordinates converted to null via `fkOrNull()`/`coordOrNull()` helpers

## Self-Check: PASSED

Files verified to exist:
- FOUND: supabase/migrations/00014_project_number_sequence.sql
- FOUND: src/actions/projects.ts
- FOUND: src/components/admin/projects/ProjectForm.tsx
- FOUND: src/lib/schemas.ts (modified)

Commits verified:
- FOUND: fb2647b — chore(04-01): add migration 00014
- FOUND: 10966a2 — feat(04-01): ProjectSchema + Server Actions + ProjectForm dialog
