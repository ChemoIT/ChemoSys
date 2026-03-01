---
phase: 01-foundation
plan: "02"
subsystem: database-schema
tags: [postgresql, supabase, rls, soft-delete, typescript-types, migrations]
dependency_graph:
  requires: []
  provides:
    - supabase/migrations/00001_foundation_schema.sql
    - supabase/migrations/00002_rls_policies.sql
    - supabase/migrations/00003_seed_modules.sql
    - src/types/database.ts
    - src/types/entities.ts
  affects:
    - All future Server Actions (depend on table structure)
    - Phase 2 employee import (employees table stub)
    - Phase 3 permission system (users/user_permissions/role_templates tables)
    - Phase 4 project management (projects table stub)
tech_stack:
  added:
    - class-variance-authority (missing shadcn/ui dep — auto-fixed)
  patterns:
    - Universal columns (id, created_at, updated_at, created_by, updated_by, deleted_at)
    - Partial unique indexes WHERE deleted_at IS NULL for soft-delete safety
    - BEFORE UPDATE triggers for auto-updated_at
    - Permissive authenticated-user RLS (Phase 1 simplicity)
    - SECURITY DEFINER function to prevent RLS recursion (Phase 3 readiness)
    - Database interface with Row/Insert/Update sub-types per table
key_files:
  created:
    - supabase/migrations/00001_foundation_schema.sql
    - supabase/migrations/00002_rls_policies.sql
    - supabase/migrations/00003_seed_modules.sql
    - src/types/database.ts
    - src/types/entities.ts
  modified:
    - package.json (added class-variance-authority)
    - package-lock.json
decisions:
  - "RLS UPDATE policies use USING (true) — allows soft-delete UPDATEs that set deleted_at (Pitfall 9 prevention)"
  - "Phase 1 RLS is permissive for authenticated users — business logic enforced in Server Actions, not RLS"
  - "SECURITY DEFINER get_user_permissions() defined now so Phase 3 can reference it without DB changes"
  - "All future-proofing stubs (employees, projects, users) created as empty tables so FK relationships are ready"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-01"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 1 Plan 02: Foundation Schema Summary

**One-liner:** PostgreSQL schema with 12 tables (soft-delete partial indexes, auto-update triggers), permissive RLS on all tables, 9-module seed, and TypeScript Database interface.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Foundation schema migration | `2be774c` | `supabase/migrations/00001_foundation_schema.sql` |
| 2 | RLS policies, seed data, TypeScript types | `76acfe6` | `00002_rls_policies.sql`, `00003_seed_modules.sql`, `src/types/database.ts`, `src/types/entities.ts` |

---

## What Was Built

### Task 1 — Foundation Schema (`00001_foundation_schema.sql`)

12 tables created in migration order:

**Phase 1 Core (actively managed by admin UI):**
- `companies` — internal_number partial unique index, updated_at trigger
- `departments` — (dept_number, company_id) composite partial unique index, self-referential parent_dept_id for hierarchy
- `role_tags` — name partial unique index
- `modules` — UNIQUE key column (system table, no soft delete)
- `audit_log` — immutable (no soft delete, no update), 3 indexes for query performance

**Future-Proofing Stubs (Phase 2+):**
- `employees` — 25+ columns, composite partial unique index (employee_number, company_id)
- `employee_role_tags` — junction table, no soft delete
- `role_templates` — name partial unique index
- `template_permissions` — junction, no soft delete
- `users` — wraps auth.users, auth_user_id UNIQUE constraint
- `user_permissions` — (user_id, module_key) unique index, has updated_at trigger
- `projects` — 30+ columns, project_number partial unique index

**Shared function:** `set_updated_at()` — fires BEFORE UPDATE on all 8 tables with updated_at columns.

**SECURITY DEFINER function:** `get_user_permissions(p_user_id UUID)` — joins user_permissions + users by auth_user_id. Prevents RLS recursion when Phase 3 queries the permissions table from within an RLS policy.

### Task 2 — RLS Policies (`00002_rls_policies.sql`)

- 12 tables have `ENABLE ROW LEVEL SECURITY`
- 34 policies total
- CRUD tables (7): SELECT uses `USING (deleted_at IS NULL)`, INSERT uses `WITH CHECK (true)`, UPDATE uses `USING (true)` (critical — allows soft-delete UPDATEs)
- Junction tables (3): SELECT/INSERT/DELETE all use `USING (true)` / `WITH CHECK (true)`
- `audit_log`: SELECT + INSERT only (no update, no delete via RLS — immutable record)
- `modules`: SELECT only (seeded, system-managed)

### Task 2 — Module Seed (`00003_seed_modules.sql`)

9 admin tab modules seeded with `ON CONFLICT (key) DO NOTHING` (idempotent):
- dashboard, companies, departments, role_tags, employees, users, templates, projects, settings
- All are top-level (parent_key = NULL), sort_order 0-8, Lucide icon names assigned

### Task 2 — TypeScript Types (`src/types/database.ts`, `src/types/entities.ts`)

- `database.ts`: Full `Database` interface with Row/Insert/Update for all 12 tables
- `entities.ts`: Re-exports as clean named types (Company, Department, RoleTag, etc.)
- Also exports Insert/Update convenience types and `ActionResult<T>` / `DeleteResult` union types for Server Actions
- `npx tsc --noEmit` passes cleanly

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `class-variance-authority` dependency**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** `src/components/ui/button.tsx` (from Plan 01) imports `class-variance-authority` which was not installed — TypeScript errors blocked compile verification
- **Fix:** `npm install class-variance-authority` — installed v5.x
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `76acfe6` (included in Task 2 commit)

---

## Success Criteria Check

| Criteria | Status |
|----------|--------|
| FOUND-02: Supabase PostgreSQL connected with complete table schema | Schema files ready to run — pending Supabase project setup |
| FOUND-03: Every table has id, created_at, updated_at, created_by, updated_by, deleted_at | DONE — all user-data tables (audit_log and junctions are intentionally simpler) |
| FOUND-04: Soft delete semantics — partial indexes, no hard delete | DONE — 6 partial unique indexes WHERE deleted_at IS NULL |
| AUDT-01 (partial): audit_log table exists and ready to receive entries | DONE — audit_log created with 3 indexes |

---

## Self-Check

Files verified present:
- `supabase/migrations/00001_foundation_schema.sql` — FOUND
- `supabase/migrations/00002_rls_policies.sql` — FOUND
- `supabase/migrations/00003_seed_modules.sql` — FOUND
- `src/types/database.ts` — FOUND
- `src/types/entities.ts` — FOUND

Commits verified:
- `2be774c` — FOUND (feat(01-02): add foundation schema migration)
- `76acfe6` — FOUND (feat(01-02): add RLS policies, module seed, and TypeScript types)

TypeScript: `npx tsc --noEmit` — PASS

## Self-Check: PASSED
