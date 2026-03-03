---
phase: 03-access-control
plan: "02"
subsystem: users
tags: [users, auth, permissions, crud, block-unblock, template-assignment, override]
dependency_graph:
  requires: [03-01]
  provides: [user lifecycle CRUD, auth admin integration, per-user permission overrides, user management UI]
  affects: [03-03]
tech_stack:
  added: [server-only]
  patterns: [two-phase atomic create+rollback, auth.admin API via service_role, ban_duration block/unblock, delete-non-override+insert for template assignment, upsert with is_override for manual overrides, useTransition for non-form actions]
key_files:
  created:
    - src/lib/supabase/admin.ts
    - src/actions/users.ts
    - src/components/admin/users/EmployeeSearchDialog.tsx
    - src/components/admin/users/UserForm.tsx
    - src/components/admin/users/UserPermissionMatrix.tsx
    - src/components/admin/users/UsersTable.tsx
    - src/app/(admin)/admin/users/page.tsx
  modified: []
decisions:
  - "Two-phase atomic createUser: auth.admin.createUser first, then public.users insert; on DB failure rollback by calling auth.admin.deleteUser to prevent orphaned auth accounts"
  - "softDeleteUser: soft-delete public.users + hard-delete auth.users (frees email for reuse); if auth delete fails, log warning but do not fail (soft-delete succeeded)"
  - "blockUser uses ban_duration=87600h (10 years) — Supabase has no permanent ban; 10 years is effectively permanent"
  - "assignTemplate deletes only non-override (is_override=false) user_permissions before inserting template rows — override permissions are preserved"
  - "saveUserPermissions upserts with is_override=true on conflict(user_id,module_key) — manual overrides survive template re-assignments"
  - "EmployeeSearchDialog uses client-side filtering (passed as prop from server) — sufficient for hundreds of employees, avoids extra network calls"
  - "UserPermissionMatrix uses startTransition for assignTemplate (non-form action) and form onSubmit + startTransition for saveUserPermissions — correct React 19 / Next.js 16 pattern"
metrics:
  duration: "~5 minutes"
  completed: 2026-03-03
  tasks_completed: 2
  files_created: 7
  files_modified: 0
---

# Phase 03 Plan 02: User Management CRUD — Summary

**One-liner:** Full user lifecycle management — create users linked to employees via Supabase Auth admin API, assign role templates with automatic permission population, override individual permissions, block/unblock users, and soft-delete users with auth hard-delete rollback.

## What Was Built

Working `/admin/users` page where admin can:
- Create a system user by searching for an active employee (by name/ID/email/employee number), entering email+password, and optionally assigning a role template — all in a single dialog
- View all active users in a searchable table with employee details, status badge, and permission summary
- Block a user (Supabase Auth ban_duration=87600h + is_blocked=true) preventing login
- Unblock a previously blocked user (ban_duration=none)
- Soft-delete a user (sets deleted_at in public.users + hard-deletes auth account to free the email)
- Open per-user permission matrix: assign role template (auto-populates from template_permissions) or manually set per-module levels (persisted as is_override=true overrides)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Admin client, Server Actions, EmployeeSearchDialog | c79da11 | admin.ts, users.ts, EmployeeSearchDialog.tsx, package.json |
| 2 | UserForm, UserPermissionMatrix, UsersTable, users page | 98d9880 | UserForm.tsx, UserPermissionMatrix.tsx, UsersTable.tsx, page.tsx |

## Success Criteria Verification

- USER-01: Admin can create a new user from active employees list — DONE
- USER-02: Employee search works by name / ID / email / employee number — DONE
- USER-03: Admin can update user notes — DONE (updateUser action)
- USER-04: Admin can soft-delete (public.users soft-delete + auth.users hard-delete) — DONE
- USER-05: Admin can block/unblock a user — DONE (ban_duration + is_blocked flag)
- USER-06: Admin can set per-module permissions (none / read / read+write) — DONE (UserPermissionMatrix)
- USER-07: Admin can assign a role template to a user — DONE (assignTemplate in UserPermissionMatrix header)
- TMPL-04: Assigning template auto-populates permissions — DONE (delete non-override + insert from template_permissions)
- TMPL-05: User can override specific permissions after template assignment — DONE (saveUserPermissions with is_override=true, preserving overrides on template re-assign)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Lucide icon `title` prop TypeScript error**
- **Found during:** Task 2 — `npx tsc --noEmit`
- **Issue:** `<Pencil title="..." />` — `title` is not in `LucideProps`. TypeScript error TS2322.
- **Fix:** Changed to `aria-label="הרשאה מותאמת אישית"` — accessible and type-correct.
- **Files modified:** src/components/admin/users/UserPermissionMatrix.tsx
- **Commit:** 98d9880

**2. [Rule 1 - Bug] Fixed Supabase join type mismatch in page.tsx**
- **Found during:** Task 2 — `npx tsc --noEmit`
- **Issue:** Supabase infers `companies` from a nested select as `{ name: any }[]` (always an array), but the UsersTable prop expects `{ name: string } | null`. TypeScript error TS2352.
- **Fix:** Double cast via `unknown` — `(data ?? []) as unknown as ExpectedType`. Safe at runtime since Supabase actually returns a single object or null for a foreign key relation (the generated types are overly conservative).
- **Files modified:** src/app/(admin)/admin/users/page.tsx
- **Commit:** 98d9880

## Key Decisions Made

1. **Two-phase atomic user creation with rollback** — `createUser` first calls `auth.admin.createUser` (Phase 1), then inserts into `public.users` (Phase 2). If Phase 2 fails, Phase 1 is rolled back via `auth.admin.deleteUser`. This prevents orphaned auth accounts that can't be recovered without service role access.

2. **softDeleteUser: dual-phase deletion** — soft-delete `public.users` (preserves audit trail) + hard-delete `auth.users` (frees the email for future reuse). If auth delete fails, it's logged but doesn't fail the operation — the user is effectively disabled by the soft-delete.

3. **blockUser uses `ban_duration: '87600h'`** — Supabase Auth has no "permanent ban" concept. 10 years (87600 hours) is the established convention. Unblock uses `ban_duration: 'none'` to remove the restriction.

4. **assignTemplate preserves is_override=true rows** — When a template is assigned, only non-override rows (`is_override=false`) are deleted. Override rows (deliberate admin customizations) are preserved. This allows a template to be re-assigned without losing manual permission adjustments.

5. **EmployeeSearchDialog client-side filtering** — The full employee list is passed as a prop from the server component. Client-side filtering avoids additional API calls and is sufficient for hundreds of employees. The search covers all four fields (name, ID, email, employee number) with case-insensitive matching.

6. **`server-only` package installed** — Required to prevent `admin.ts` (which holds the `SUPABASE_SERVICE_ROLE_KEY`) from being bundled into client code. The `import 'server-only'` guard throws a build error if the file is ever imported in a client component.

## Self-Check: PASSED

- FOUND: src/lib/supabase/admin.ts
- FOUND: src/actions/users.ts
- FOUND: src/components/admin/users/EmployeeSearchDialog.tsx
- FOUND: src/components/admin/users/UserForm.tsx
- FOUND: src/components/admin/users/UserPermissionMatrix.tsx
- FOUND: src/components/admin/users/UsersTable.tsx
- FOUND: src/app/(admin)/admin/users/page.tsx
- FOUND commit: c79da11
- FOUND commit: 98d9880
- TSC --noEmit: PASS (0 errors)
- npm run build: PASS (/admin/users in route list as dynamic route)
