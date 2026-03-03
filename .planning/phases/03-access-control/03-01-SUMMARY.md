---
phase: 03-access-control
plan: "01"
subsystem: templates
tags: [templates, permissions, crud, matrix-editor]
dependency_graph:
  requires: [01-04, 02-01]
  provides: [role_templates CRUD, template_permissions storage, permission matrix UI]
  affects: [03-02]
tech_stack:
  added: []
  patterns: [delete-all+insert for template_permissions, native radio inputs for FormData, useActionState + zodResolver]
key_files:
  created:
    - src/actions/templates.ts
    - src/components/admin/templates/PermissionMatrixEditor.tsx
    - src/components/admin/templates/TemplateForm.tsx
    - src/components/admin/templates/TemplatesTable.tsx
    - src/app/(admin)/admin/templates/page.tsx
  modified:
    - src/lib/schemas.ts
    - src/proxy.ts
decisions:
  - "Native <input type='radio'> used instead of shadcn RadioGroup — radios must write to FormData natively"
  - "Delete-all + insert pattern for template_permissions on every save (same as employee_role_tags)"
  - "Only levels > 0 stored in template_permissions — absence means no access (level 0)"
  - "proxy.ts: renamed middleware() to proxy() export for Next.js 16.1.6 API requirement"
metrics:
  duration: "~4 minutes"
  completed: 2026-03-03
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 03 Plan 01: Role Template CRUD with Permission Matrix — Summary

**One-liner:** Full role template CRUD with interactive 9-module × 3-level permission matrix persisting to template_permissions via delete-all+insert pattern.

## What Was Built

Working `/admin/templates` page where admin can:
- Create a role template with name, description, and a permission matrix covering all 9 system modules
- Edit an existing template (metadata + permission matrix — full replace)
- Soft-delete a template (template_permissions preserved for audit history)

The permission matrix editor renders as a table with 9 rows (one per module) and 3 native radio buttons per row (אין גישה / קריאה / קריאה+כתיבה). Native HTML radios write to FormData automatically without extra wiring.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TemplateSchema, Server Actions, PermissionMatrixEditor | 1372137 | schemas.ts, templates.ts, PermissionMatrixEditor.tsx |
| 2 | TemplateForm dialog, TemplatesTable, templates page | 17be82e | TemplateForm.tsx, TemplatesTable.tsx, page.tsx, proxy.ts |

## Success Criteria Verification

- TMPL-01: Admin can create a role template with name, description, and permission set — DONE
- TMPL-02: Admin can edit an existing template (name, description, and permissions) — DONE
- TMPL-03: Admin can soft-delete a template — DONE
- Permission matrix covers all 9 modules with 3 levels (none/read/read+write) — DONE
- template_permissions table correctly stores the permission set for each template — DONE

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed proxy.ts export name for Next.js 16.1.6**
- **Found during:** Task 2 npm run build
- **Issue:** `npm run build` failed with error "The file ./src/proxy.ts must export a function, either as a default export or as a named 'proxy' export." The function was exported as `middleware` (old API name).
- **Fix:** Renamed export from `middleware` to `proxy` in src/proxy.ts — Next.js 16.1.6 requires the `proxy` name for the proxy/middleware file.
- **Files modified:** src/proxy.ts
- **Commit:** 17be82e (included in Task 2 commit)

## Key Decisions Made

1. **Native radio inputs over shadcn RadioGroup** — The plan specified native `<input type="radio">` to ensure values write to FormData automatically. shadcn RadioGroup uses controlled state and does not write to FormData natively. Native radios with `name={perm_${key}}` work correctly with Server Action FormData.

2. **Delete-all + insert pattern for template_permissions** — On every create/update, all existing permission rows for the template are deleted and new ones inserted. Only levels > 0 are stored — absence from table means no access (level 0). This matches the employee_role_tags pattern from Phase 2.

3. **proxy.ts export rename (auto-fixed)** — Next.js 16.1.6 changed the middleware/proxy file API. The function export must be named `proxy`, not `middleware`. This was a blocking build issue fixed under Rule 3.

## Self-Check: PASSED

- FOUND: src/lib/schemas.ts (TemplateSchema added)
- FOUND: src/actions/templates.ts
- FOUND: src/components/admin/templates/PermissionMatrixEditor.tsx
- FOUND: src/components/admin/templates/TemplateForm.tsx
- FOUND: src/components/admin/templates/TemplatesTable.tsx
- FOUND: src/app/(admin)/admin/templates/page.tsx
- FOUND commit: 1372137
- FOUND commit: 17be82e
- TSC --noEmit: PASS (0 errors)
- npm run build: PASS (/admin/templates in route list)
