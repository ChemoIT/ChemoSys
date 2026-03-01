---
phase: 01-foundation
plan: "04"
subsystem: admin-crud
tags: [nextjs, tanstack-table, react-hook-form, zod, server-actions, audit-log, rtl, hebrew, soft-delete]

# Dependency graph
requires:
  - phase: "01-01"
    provides: "Next.js 16 scaffold, shadcn/ui components, brand theme, Supabase client factories"
  - phase: "01-02"
    provides: "companies, departments, role_tags, audit_log table schemas with RLS"
  - phase: "01-03"
    provides: "verifySession() DAL, writeAuditLog() utility, admin shell layout"
provides:
  - "src/lib/schemas.ts — Zod validation schemas for Company, Department, RoleTag (Hebrew error messages)"
  - "src/components/shared/DataTable.tsx — Reusable TanStack Table wrapper with sorting and search"
  - "src/components/shared/DeleteConfirmDialog.tsx — Hebrew soft-delete confirmation dialog"
  - "src/actions/companies.ts — createCompany, updateCompany, softDeleteCompany Server Actions"
  - "src/components/admin/companies/CompanyForm.tsx — Company create/edit dialog with React Hook Form"
  - "src/components/admin/companies/CompaniesTable.tsx — Companies data table with edit/delete actions"
  - "src/app/(admin)/admin/companies/page.tsx — Full Companies CRUD management page"
  - "src/actions/departments.ts — createDepartment, updateDepartment, softDeleteDepartment Server Actions"
  - "src/components/admin/departments/DepartmentForm.tsx — Dept form with company + parent dept dropdowns"
  - "src/components/admin/departments/DepartmentsTable.tsx — Departments table with hierarchy display"
  - "src/app/(admin)/admin/departments/page.tsx — Full Departments CRUD management page"
  - "src/actions/role-tags.ts — createRoleTag, updateRoleTag, softDeleteRoleTag Server Actions"
  - "src/components/admin/role-tags/RoleTagForm.tsx — Role tag create/edit dialog"
  - "src/components/admin/role-tags/RoleTagsTable.tsx — Role tags data table"
  - "src/app/(admin)/admin/role-tags/page.tsx — Full Role Tags CRUD management page"
affects:
  - "Phase 2 (employees will reuse DataTable, DeleteConfirmDialog, and the Server Action pattern)"
  - "All future entity modules (same CRUD pattern: verifySession -> validate -> mutate -> audit -> revalidate)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action pattern: verifySession -> ZodSchema.safeParse -> mutate -> writeAuditLog -> revalidatePath"
    - "useActionState (React 19) binding form submit to Server Action — no fetch/axios needed"
    - "React Hook Form + zodResolver for client-side validation with server error hydration"
    - "TanStack Table with getSortedRowModel + getFilteredRowModel for sortable, searchable tables"
    - "DataTable as generic wrapper component: ColumnDef<T> columns + data props"
    - "Zod schemas without .transform() to avoid zodResolver type conflicts — null coercion in Server Action"
    - "Soft-delete: deleted_at timestamp set, RLS SELECT policy filters deleted_at IS NULL automatically"
    - "Audit log: written after every INSERT/UPDATE/DELETE — fire-and-forget, never blocks mutations"

key-files:
  created:
    - "src/lib/schemas.ts — CompanySchema, DepartmentSchema, RoleTagSchema with Hebrew validation messages"
    - "src/components/shared/DataTable.tsx — generic TanStack Table, sorting headers, search input, empty state"
    - "src/components/shared/DeleteConfirmDialog.tsx — Dialog with ביטול / מחק buttons, loading spinner"
    - "src/actions/companies.ts — 3 Server Actions with audit logging and unique constraint handling"
    - "src/components/admin/companies/CompanyForm.tsx — 6-field dialog with useActionState binding"
    - "src/components/admin/companies/CompaniesTable.tsx — 5 display columns + actions column"
    - "src/actions/departments.ts — 3 Server Actions with composite unique constraint handling"
    - "src/components/admin/departments/DepartmentForm.tsx — company Select + parent dept Select (filtered)"
    - "src/components/admin/departments/DepartmentsTable.tsx — shows company name + parent dept name"
    - "src/actions/role-tags.ts — 3 Server Actions, simplest entity (no FK)"
    - "src/components/admin/role-tags/RoleTagForm.tsx — 3-field dialog (name, description, notes)"
    - "src/components/admin/role-tags/RoleTagsTable.tsx — 2 display columns + actions column"
    - "src/app/(admin)/admin/departments/page.tsx — 3 parallel Supabase fetches (depts, companies, allDepts)"
    - "src/app/(admin)/admin/role-tags/page.tsx — simple role_tags fetch"
  modified:
    - "src/app/(admin)/admin/companies/page.tsx — replaced placeholder with full CRUD page"

key-decisions:
  - "Removed .transform() from DepartmentSchema.parent_dept_id — zodResolver has a known type incompatibility with Zod .transform(). Empty string converted to null in Server Action instead."
  - "DeleteConfirmDialog uses Dialog (already installed) instead of AlertDialog (not installed) — zero new dependencies, identical UX"
  - "DataTable uses generic ColumnDef<T> — type-safe per entity, reusable without modification"
  - "DepartmentForm hidden inputs for Select fields — shadcn/ui Select onChange does not propagate to FormData; hidden inputs ensure Server Action receives values"
  - "allDepts passed separately from departments in DepartmentsPage — departments has company join (for display), allDepts is plain dept list (for parent dropdown)"

patterns-established:
  - "Every admin page: await verifySession() as first line, then fetch, then render client table component"
  - "Every Server Action: verifySession() -> safeParse() -> insert/update -> writeAuditLog() -> revalidatePath()"
  - "Table components: state for formOpen, editingEntity, deleteTarget, deleting — standard pattern"
  - "Form components: useActionState binding, useEffect for success/error handling, reset on dialog open"

# Metrics
duration: "~6 min"
completed: "2026-03-01"
---

# Phase 1 Plan 04: Companies, Departments, and Role Tags CRUD Summary

**Full CRUD for three reference entities (Companies, Departments with hierarchy, Role Tags) using TanStack Table, React Hook Form + Zod, Server Actions with audit logging, and Hebrew UI — establishing the reusable pattern for all Phase 2+ entity management**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-01T16:07:00Z
- **Completed:** 2026-03-01T16:13:52Z
- **Tasks completed:** 2 (Task 3 is checkpoint — awaiting human verification)
- **Files created:** 14
- **Files modified:** 1

## Task Commits

Each task was committed atomically:

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Shared components, Zod schemas, and Companies CRUD | `e20f6c4` | 7 files (schemas.ts, DataTable, DeleteConfirmDialog, companies action/form/table/page) |
| 2 | Departments CRUD (hierarchical) and Role Tags CRUD | `13ea282` | 9 files (dept/role-tag actions, forms, tables, pages + schema update) |
| 3 | Visual and functional verification of complete Phase 1 | — | CHECKPOINT: awaiting human verification |

## What Was Built

### Task 1 — Shared Infrastructure

**`src/lib/schemas.ts`** — Zod validation schemas with Hebrew error messages:
- `CompanySchema`: name, internal_number, company_reg_number, contact_name, contact_email, notes
- `DepartmentSchema`: name, dept_number, company_id, parent_dept_id (optional), notes
- `RoleTagSchema`: name, description, notes

**`src/components/shared/DataTable.tsx`** — Reusable TanStack Table wrapper:
- Generic `ColumnDef<T>` + `data: T[]` props — type-safe, entity-agnostic
- Column sorting on header click (↑/↓ indicator)
- Text search filter on configurable `searchKey` column
- Hebrew empty state: "לא נמצאו תוצאות"

**`src/components/shared/DeleteConfirmDialog.tsx`** — Hebrew soft-delete confirmation:
- Uses shadcn/ui `Dialog` (AlertDialog not installed)
- Buttons: "ביטול" (cancel) and "מחק" (destructive)
- Loading spinner state disables confirm button during async operation

**Companies CRUD** (`src/actions/companies.ts`, `CompanyForm.tsx`, `CompaniesTable.tsx`, `page.tsx`):
- `createCompany` / `updateCompany` / `softDeleteCompany` Server Actions
- Pattern: verifySession -> safeParse -> insert/update -> writeAuditLog -> revalidatePath
- Handles PostgreSQL unique constraint error (code 23505): "מספר חברה כבר קיים"
- 6-field form dialog bound with `useActionState` (React 19)
- Table columns: שם חברה, מספר פנימי, ח.פ., אחראי, מייל, פעולות

### Task 2 — Departments and Role Tags

**Departments CRUD** (`src/actions/departments.ts`, `DepartmentForm.tsx`, `DepartmentsTable.tsx`, `page.tsx`):
- Handles `(dept_number, company_id)` composite unique constraint: "מספר מחלקה כבר קיים בחברה זו"
- Parent-child hierarchy: `parent_dept_id` nullable FK to departments
- `DepartmentForm` has two Select dropdowns: company (required) and parent dept (optional, filtered by company)
- Changing company resets parent dept selection (useEffect dependency)
- Cannot select itself as parent (edit mode filter)
- Table shows company name (from join) and parent dept name (from id lookup map)
- Page fetches 3 data sets: departments+company join, active companies, all active departments

**Role Tags CRUD** (`src/actions/role-tags.ts`, `RoleTagForm.tsx`, `RoleTagsTable.tsx`, `page.tsx`):
- Simplest entity — no FK relationships
- 3-field form: name, description (Input), notes (textarea)
- Unique constraint on name: "שם תגית כבר קיים"

### Task 3 — CHECKPOINT (Pending Human Verification)

Task 3 is a `checkpoint:human-verify` gate that requires the user to:

1. Open `http://localhost:3000` and verify redirect to `/login`
2. Verify Chemo Aharon Hebrew logo on login page
3. Log in and verify RTL dark sidebar on right side
4. Navigate to ניהול חברות — test create, edit, duplicate error, delete
5. Navigate to ניהול מחלקות — test hierarchy (top-level + sub-department)
6. Navigate to תגיות תפקיד — test create, edit, delete
7. Verify mobile responsive (hamburger menu from right)
8. Verify session persistence after refresh
9. Verify logout redirect
10. Check Supabase audit_log for entries from all operations

**Status:** Awaiting user verification. Resume signal: type "approved" or describe issues.

## Decisions Made

- **Removed `.transform()` from DepartmentSchema:** `zodResolver` in React Hook Form v7 has a known type incompatibility with Zod schemas that use `.transform()` — the output type diverges from the form values type. Fixed by removing the transform and doing `input.parent_dept_id || null` in the Server Action. Zero behavior change.
- **`DeleteConfirmDialog` uses `Dialog` not `AlertDialog`:** `AlertDialog` is not in the installed shadcn/ui components list. `Dialog` with the same pattern provides identical UX without adding a dependency.
- **Hidden inputs for shadcn/ui Select fields:** `shadcn/ui Select` uses `onValueChange` (not native `onChange`) and does not propagate to the `FormData` object passed to Server Actions via `form action`. Added `<input type="hidden" name="..." value={field.value} />` alongside each Select to ensure Server Actions receive the values.
- **Separate `allDepts` fetch in DepartmentsPage:** The main `departments` query uses `select('*, companies(name)')` for the display table. The parent dropdown needs plain dept records without the join. Two separate queries is cleaner than stripping join data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed Zod `.transform()` to fix zodResolver type incompatibility**
- **Found during:** Task 2, TypeScript check after writing `DepartmentForm.tsx`
- **Issue:** `zodResolver(DepartmentSchema)` returned a `Resolver` with output type `{ parent_dept_id: string | null }` (post-transform), but `useForm<DepartmentFormValues>` expected `{ parent_dept_id?: string | undefined }` (pre-transform). TypeScript errors on all `FormField` `control` props.
- **Fix:** Removed `.transform((v) => v || null)` from `DepartmentSchema.parent_dept_id`. The schema now accepts `string | ''` and the Server Action does `input.parent_dept_id || null` before inserting.
- **Files modified:** `src/lib/schemas.ts`, `src/actions/departments.ts`
- **Verification:** `npx tsc --noEmit` — PASS

**2. [Rule 2 - Missing Critical] AlertDialog not installed — used Dialog instead**
- **Found during:** Task 1, writing `DeleteConfirmDialog.tsx`
- **Issue:** Plan specified "shadcn/ui AlertDialog variant" but `alert-dialog.tsx` was not in the installed components.
- **Fix:** Implemented `DeleteConfirmDialog` using the already-installed `Dialog` component with identical UX (Hebrew cancel + destructive confirm, loading state). No behavior difference.
- **Files modified:** `src/components/shared/DeleteConfirmDialog.tsx`
- **Verification:** TypeScript clean, no missing imports

---

**Total deviations:** 2 auto-fixed (1 type bug, 1 missing component)
**Impact on plan:** Zero scope change. Both fixes are transparent to the user — the UI and behavior are exactly as specified.

## Success Criteria Status

| Criteria | Status |
|----------|--------|
| COMP-01: Admin can create a company with all fields | READY (pending DB connection for runtime verify) |
| COMP-02: Admin can edit a company | READY |
| COMP-03: Admin can soft-delete a company | READY |
| COMP-04: Internal company number is unique | READY (23505 handler returns Hebrew error) |
| DEPT-01: Admin can create a department with all fields including hierarchy | READY |
| DEPT-02: Admin can edit a department | READY |
| DEPT-03: Admin can soft-delete a department | READY |
| DEPT-04: Departments support parent-child hierarchy | READY (parent_dept_id FK + form filter) |
| RTAG-01: Admin can create a role tag | READY |
| RTAG-02: Admin can edit a role tag | READY |
| RTAG-03: Admin can soft-delete a role tag | READY |
| AUDT-01: Every create/update/delete writes to audit log | READY (9 mutations x writeAuditLog) |

All criteria are code-complete and TypeScript-verified. Runtime verification (Task 3) requires Supabase credentials in `.env.local`.

## Next Phase Readiness

- CRUD pattern established — Phase 2 employee management can reuse DataTable, DeleteConfirmDialog, and the exact Server Action template
- All three Phase 1 reference entities are ready to receive FK references from employees (Phase 2)
- Audit log writes confirmed for all 9 mutation types — AUDT-01 will be verified at runtime in Task 3

---

## Self-Check

Files verified:
- `src/lib/schemas.ts` — FOUND
- `src/components/shared/DataTable.tsx` — FOUND
- `src/components/shared/DeleteConfirmDialog.tsx` — FOUND
- `src/actions/companies.ts` — FOUND
- `src/components/admin/companies/CompanyForm.tsx` — FOUND
- `src/components/admin/companies/CompaniesTable.tsx` — FOUND
- `src/app/(admin)/admin/companies/page.tsx` — FOUND
- `src/actions/departments.ts` — FOUND
- `src/components/admin/departments/DepartmentForm.tsx` — FOUND
- `src/components/admin/departments/DepartmentsTable.tsx` — FOUND
- `src/app/(admin)/admin/departments/page.tsx` — FOUND
- `src/actions/role-tags.ts` — FOUND
- `src/components/admin/role-tags/RoleTagForm.tsx` — FOUND
- `src/components/admin/role-tags/RoleTagsTable.tsx` — FOUND
- `src/app/(admin)/admin/role-tags/page.tsx` — FOUND

Commits verified:
- `e20f6c4` — Task 1 (feat(01-04): shared components, Zod schemas, and Companies CRUD)
- `13ea282` — Task 2 (feat(01-04): Departments CRUD and Role Tags CRUD)

TypeScript: `npx tsc --noEmit` — PASS (0 errors)

Task 3: checkpoint:human-verify — PENDING (awaiting user visual/functional verification)

## Self-Check: PASSED (Tasks 1 & 2)
