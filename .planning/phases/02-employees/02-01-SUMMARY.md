---
phase: 02-employees
plan: "01"
subsystem: employee-crud
tags: [employees, crud, form, table, server-actions, role-tags, tanstack-table]
dependency_graph:
  requires:
    - 01-04-SUMMARY  # Companies, Departments, RoleTags CRUD (data for selectors)
  provides:
    - employee-create
    - employee-update
    - employee-soft-delete
    - employee-suspend
    - employee-role-tag-junction
    - employees-page
  affects:
    - sidebar-nav       # CURRENT_PHASE bumped to 2 → employees nav item active
    - schemas-ts        # EmployeeSchema added
tech_stack:
  added:
    - shadcn/ui Popover (role tag multi-select trigger)
    - shadcn/ui Command / cmdk (role tag searchable list)
  patterns:
    - Server Actions (verifySession -> Zod safeParse -> DB insert/update -> writeAuditLog -> revalidatePath)
    - replace-all junction table management (delete all + re-insert for role tags on update)
    - hidden <input> companions for every shadcn Select (FormData access in Server Actions)
    - cascading Selects (company → department → sub-department with state reset on parent change)
    - conditional field (passport_number shown only when citizenship = foreign)
    - multi-filter toolbar (text + company + department + status) applied pre-TanStack-Table
key_files:
  created:
    - src/actions/employees.ts
    - src/components/admin/employees/RoleTagMultiSelect.tsx
    - src/components/admin/employees/EmployeeForm.tsx
    - src/components/admin/employees/EmployeesTable.tsx
    - src/app/(admin)/admin/employees/page.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/command.tsx
  modified:
    - src/lib/schemas.ts            # EmployeeSchema + EmployeeInput added
    - src/components/shared/SidebarNav.tsx  # CURRENT_PHASE 1 → 2
decisions:
  - "zodResolver cast (as any) for EmployeeForm — same Zod v4 + RHF variance issue as DepartmentForm (established [01-04] pattern)"
  - "Multi-filter toolbar applied in JS before TanStack Table (not via setFilterValue) — simpler, avoids accessor mismatches with nested join data"
  - "EmployeesTable does not reuse DataTable.tsx — employee table needs multi-filter toolbar DataTable does not support"
  - "CURRENT_PHASE advanced from 1 to 2 in SidebarNav — employees nav item now active and clickable"
metrics:
  duration: "~7 minutes"
  completed: "2026-03-01"
  tasks: 3
  files_created: 7
  files_modified: 2
  total_lines_added: ~1700
---

# Phase 2 Plan 01: Employee CRUD Summary

Full employee registry with CRUD, status management, role tag multi-select, cascading department selectors, and a searchable/filterable/sortable employee list.

## What Was Built

### Task 1 — Schema, Server Actions, Prerequisites
- Added `EmployeeSchema` (22 fields, Zod v4, all errors in Hebrew) to `src/lib/schemas.ts`
- Created `src/actions/employees.ts` with four Server Actions:
  - `createEmployee` — inserts employee + role tag junction rows
  - `updateEmployee` — updates employee + replace-all role tag junction
  - `softDeleteEmployee` — sets `deleted_at`, audit log
  - `suspendEmployee` — sets `status = 'suspended'`, audit log
- Composite unique key violation `(employee_number, company_id)` returns `{ employee_number: ['מספר עובד כבר קיים בחברה זו'] }`
- Installed shadcn/ui `popover` and `command` components
- Advanced `SidebarNav.CURRENT_PHASE` from 1 to 2

### Task 2 — RoleTagMultiSelect and EmployeeForm
- Created `RoleTagMultiSelect` using Popover + Command (cmdk):
  - Searchable tag list, checkbox-style toggle, removable badge row
  - Hidden `<input name="role_tag_ids">` per selected ID for FormData access
- Created `EmployeeForm` (758 lines) with 22+ fields across 5 sections:
  1. פרטים אישיים — employee_number, first_name, last_name, id_number, gender, date_of_birth, citizenship, passport_number (conditional)
  2. כתובת ופרטי קשר — street, house_number, city, mobile_phone, additional_phone, email
  3. שיוך ארגוני — company_id, department_id, sub_department_id (cascading)
  4. תעסוקה — start_date, end_date, status, correspondence_language, profession, role_tags
  5. הערות — notes
- Every Select field has a hidden input companion
- Cascading resets: company change resets department + sub-dept; department change resets sub-dept

### Task 3 — EmployeesTable and Employees Page
- Created `EmployeesTable` with:
  - Multi-filter toolbar: text search, company Select, department Select, status Select
  - Department filter scoped to selected company
  - Status badges: green=פעיל, yellow=מושהה, gray=לא פעיל
  - Role tag badges per row
  - Edit / Suspend / Delete action buttons
  - DeleteConfirmDialog integration with softDeleteEmployee
  - Suspend via `useTransition` (non-blocking UI)
- Created server component `src/app/(admin)/admin/employees/page.tsx`:
  - Parallel fetch: employees with joins + companies + departments + role_tags
  - Employee count badge in page header

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] zodResolver type cast required for EmployeeForm**
- **Found during:** Task 2 TypeScript check
- **Issue:** Zod v4's `.default()` and `.optional()` on EmployeeSchema cause Resolver generic variance mismatch with React Hook Form. The inferred type has `status?: "active" | "suspended" | "inactive" | undefined` but RHF expects the concrete type to match exactly.
- **Fix:** Added `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + `as any` cast on `zodResolver(EmployeeSchema)`. Used a concrete `EmployeeFormValues` type (all strings) for `useForm<>` generic so RHF operates correctly.
- **Files modified:** `src/components/admin/employees/EmployeeForm.tsx`
- **Commit:** `3e8fdb6`
- **Note:** Identical pattern to DepartmentForm fix in Phase 1 ([01-04] decision). Pre-established, expected deviation.

**2. [Rule 2 - Multi-filter approach] Pre-TanStack filter instead of setFilterValue**
- **Found during:** Task 3 implementation
- **Issue:** The plan referenced `table.getColumn('columnId')?.setFilterValue()` for each filter. However, the company/department/status data comes from joined objects (`row.companies?.name`, `row.departments?.name`), not direct column values. TanStack `columnFilters` works on accessorKey values; filtering on join IDs via column filter required complex accessor mapping.
- **Fix:** Implemented multi-filter as a pre-processing step on the raw data array before passing to TanStack Table. This is simpler, cleaner, and avoids accessorFn/filterFn complexity. TanStack still handles sorting.
- **Files modified:** `src/components/admin/employees/EmployeesTable.tsx`
- **Commit:** `6c35f70`

## Success Criteria Coverage

- EMPL-01: Admin can add employee with all 22+ fields via EmployeeForm dialog
- EMPL-02: Admin can edit via EmployeeForm in edit mode (state hydrated from employee prop)
- EMPL-03: Admin can soft-delete via DeleteConfirmDialog + softDeleteEmployee
- EMPL-04: Admin can suspend via suspendEmployee action (Ban icon button per row)
- EMPL-05: Admin can assign multiple role tags via RoleTagMultiSelect + junction table
- EMPL-06: Employee linked to company via company_id Select with hidden input
- EMPL-07: Employee linked to department/sub-department via cascading Selects
- EMPL-08: Composite unique key enforced — duplicate employee_number+company returns Hebrew error
- EMPL-09: Employee list searchable by name, filterable by company/department/status, sortable

## Commits

| Hash | Message |
|------|---------|
| `16d9c8e` | feat(02-01): EmployeeSchema, Server Actions, shadcn prerequisites |
| `3e8fdb6` | feat(02-01): RoleTagMultiSelect and EmployeeForm components |
| `6c35f70` | feat(02-01): EmployeesTable with multi-filter toolbar and employees page |

## Self-Check: PASSED

All 9 required files found on disk. All 3 task commits verified in git log.
