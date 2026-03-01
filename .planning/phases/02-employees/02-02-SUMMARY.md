---
phase: 02-employees
plan: "02"
subsystem: employee-excel-import
tags: [employees, excel, import, exceljs, rpc, server-actions, wizard]
dependency_graph:
  requires:
    - 02-01-SUMMARY  # Employee CRUD (employees table, companies, departments ready)
  provides:
    - employee-excel-import
    - upsert-employee-rpc
    - import-wizard-ui
    - import-route
  affects:
    - employees-page      # Added "ייבוא מ-Excel" button in header
    - next-config         # experimental.serverActions.bodySizeLimit = 10mb
    - employees-actions   # importEmployeesAction added
tech_stack:
  added:
    - exceljs v4 (XLSX parsing in Node.js Server Actions)
  patterns:
    - SECURITY DEFINER PostgreSQL function for partial unique index upsert
    - Two-phase Server Action (preview = read-only, confirm = write)
    - ArrayBuffer → Buffer.from() conversion for ExcelJS in Server Actions
    - File kept in useState across steps for confirm re-submission
    - useTransition for non-blocking Server Action dispatch
key_files:
  created:
    - supabase/migrations/00004_employee_import_function.sql
    - src/components/admin/employees/EmployeeImport.tsx
    - src/app/(admin)/admin/employees/import/page.tsx
  modified:
    - src/actions/employees.ts   # importEmployeesAction + Excel parsing helpers
    - next.config.ts             # experimental.serverActions.bodySizeLimit = 10mb
    - package.json               # exceljs added
decisions:
  - "experimental.serverActions.bodySizeLimit in next.config.ts — Next.js 16 places serverActions under experimental (not top-level) in both runtime and TypeScript types"
  - "Buffer.from(arrayBuffer) + (as any) cast — @types/node v22 Buffer<ArrayBuffer> vs exceljs types Buffer (without generic) version mismatch; cast is safe at runtime"
  - "audit log uses INSERT + entity_type='employee_import' — audit_log.action enum is INSERT|UPDATE|DELETE|LOGIN|LOGOUT; IMPORT is not a valid value; using INSERT with a distinct entity_type preserves query-ability"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-01"
  tasks: 2
  files_created: 3
  files_modified: 3
  total_lines_added: ~2000
  checkpoint_pending: true
---

# Phase 2 Plan 02: Excel Employee Import Summary

Payroll XLSX import pipeline: Hebrew column mapping, ExcelJS parsing, two-phase preview/confirm wizard, and partial-index-safe upsert via a SECURITY DEFINER PostgreSQL RPC function.

## What Was Built

### Task 1 — RPC migration, exceljs install, config, and Server Action

**`supabase/migrations/00004_employee_import_function.sql`**
- Creates `upsert_employee()` SECURITY DEFINER function with `ON CONFLICT (employee_number, company_id) WHERE deleted_at IS NULL`
- Required because PostgREST `.upsert()` cannot specify partial index predicates (returns error 42P10)
- Parameters: all 20 importable employee fields + p_imported_by (UUID)
- Returns: employee UUID (caller uses for insert vs update counting)
- `GRANT EXECUTE ON FUNCTION public.upsert_employee TO authenticated`

**`next.config.ts`**
- `experimental.serverActions.bodySizeLimit = '10mb'`
- Allows payroll XLSX files (typically 2–8MB) to upload without "413 body too large" errors

**`package.json`** — `exceljs` v4 installed

**`src/actions/employees.ts`** — added:
- `COL` constant object: 18 column mappings (1-based), verified against demo.xlsx
- `cellToString()`: Excel cell → trimmed string | null
- `cellToDateString()`: Excel Date object / ISO string → YYYY-MM-DD | null
- `mapGender()`: 'ז' → 'male', 'נ' → 'female', else null
- `ParsedEmployeeRow` type: intermediate row representation before RPC
- `parseExcelBufferAsync()`: async ExcelJS parser, skips header row, skips rows missing employee_number or last_name
- `importEmployeesAction()`: two-phase Server Action:
  - Phase 1 (action='preview'): parses file, queries existing employee numbers, returns `{ total, newCount, updateCount, errors }` without DB writes
  - Phase 2 (action='confirm'): parses file again, resolves dept_numbers to UUIDs, calls `upsert_employee` RPC per row, counts inserts vs updates, writes bulk audit log entry, revalidates `/admin/employees`

### Task 2 — Import wizard UI and route

**`src/components/admin/employees/EmployeeImport.tsx`**
- Client component, 3-step wizard:
  - Step 1 (upload): Company `<Select>` + hidden input companion + file input (`.xlsx,.xls`) + "תצוגה מקדימה" submit button
  - Step 2 (preview): Counts display (green badge = new, blue badge = update) + "אישור ייבוא" + "ביטול" buttons. Confirm programmatically builds a new `FormData` with the saved `File` object + `action='confirm'` and dispatches via `useTransition`
  - Step 3 (complete): Success banner + imported/updated badges + per-row error list (scrollable) + "חזרה לרשימת עובדים" Link
- `useActionState` bound to `importEmployeesAction`
- File saved to `useState` after Step 1 for re-use in confirm submission

**`src/app/(admin)/admin/employees/import/page.tsx`**
- Server component: `verifySession()` + fetches companies → renders `<EmployeeImport />`
- Route: `/admin/employees/import` (ƒ dynamic, confirmed in build output)

**`src/app/(admin)/admin/employees/page.tsx`**
- Added "ייבוא מ-Excel" button (Upload icon, outline variant) in the page header, right side, linking to `/admin/employees/import`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] experimental.serverActions in next.config.ts**
- **Found during:** Task 1 TypeScript check
- **Issue:** Plan specified top-level `serverActions: { bodySizeLimit: '10mb' }` in NextConfig. TypeScript error TS2353 — property does not exist on NextConfig type. In Next.js 16, `serverActions` lives under `experimental` in the `ExperimentalConfig` type.
- **Fix:** Moved to `experimental: { serverActions: { bodySizeLimit: '10mb' } }`
- **Files modified:** `next.config.ts`
- **Commit:** `099a0f2`

**2. [Rule 3 - Blocking] Buffer type mismatch for ExcelJS**
- **Found during:** Task 1 TypeScript check
- **Issue:** `workbook.xlsx.load(buffer as Buffer)` fails — @types/node v22 exports `Buffer<ArrayBuffer>` but exceljs types declare `Buffer` (non-generic). TypeScript TS2352 conversion error.
- **Fix:** `Buffer.from(arrayBuffer) as any` — runtime-safe conversion (Buffer.from creates the correct Node.js Buffer), cast silences the version mismatch
- **Files modified:** `src/actions/employees.ts`
- **Commit:** `099a0f2`

**3. [Rule 1 - Bug] Dead parseExcelBuffer stub removed**
- **Found during:** Task 1 implementation review
- **Issue:** Accidentally included a non-functional `parseExcelBuffer()` stub that threw unconditionally. Would confuse readers and could cause mistakes if called.
- **Fix:** Removed the stub. Only `parseExcelBufferAsync()` remains.
- **Files modified:** `src/actions/employees.ts`
- **Commit:** `099a0f2`

## Checkpoint Status

**Task 3 (human-verify) is PENDING — awaiting manual verification by Sharon.**

The RPC migration `00004_employee_import_function.sql` must be applied in the Supabase SQL editor before testing the import flow.

See plan Task 3 for the 17-step verification checklist covering both Employee CRUD (plan 02-01) and Excel Import (plan 02-02).

## Success Criteria Coverage

- EMPL-10: Admin can upload payroll XLSX and import employees via `/admin/employees/import`
- Company selector required (payroll file has no company column) — Step 1 of wizard
- Preview step shows new vs update count before any DB writes — Step 2 of wizard
- Gender codes (ז→male, נ→female), dept numbers (int→UUID lookup), dates (Date→YYYY-MM-DD), citizenship (country code presence→'foreign') all mapped in `parseExcelBufferAsync()`
- Large files up to 10MB: `experimental.serverActions.bodySizeLimit = '10mb'`
- Re-import updates via `ON CONFLICT (employee_number, company_id) WHERE deleted_at IS NULL DO UPDATE SET ...`

## Commits

| Hash | Message |
|------|---------|
| `099a0f2` | feat(02-02): RPC migration, exceljs install, config + importEmployeesAction |
| `785b8fb` | feat(02-02): EmployeeImport wizard and /admin/employees/import route |

## Self-Check: PASSED

All 5 required files found on disk. Both task commits verified in git log.
ExcelJS in package.json. bodySizeLimit in next.config.ts. Partial index predicate in migration SQL.
Checkpoint Task 3 awaiting human verification (not committed — no automated output).
