# Phase 2: Employees - Research

**Researched:** 2026-03-01
**Domain:** Employee CRUD + Payroll Excel Import (Next.js 16 + Supabase + ExcelJS)
**Confidence:** HIGH (core stack verified; one MEDIUM-confidence area noted for upsert/partial index)

---

## Summary

Phase 2 builds on Phase 1's foundation without introducing any new infrastructure. The `employees`, `employee_role_tags`, and supporting tables already exist in the DB schema (created as future-proofing stubs in migration `00001_foundation_schema.sql`). RLS policies for `employees` and `employee_role_tags` are already live in `00002_rls_policies.sql`. All Phase 2 work is: (1) build the admin UI and Server Actions for employee CRUD, and (2) implement the Excel import flow.

The CRUD plan (02-01) follows the exact same pattern as companies/departments from Phase 1: RHF + Zod v4 schema, Server Action with `verifySession → validate → mutate → writeAuditLog → revalidatePath`, TanStack Table for the list. The employee form is larger (20+ fields) and introduces three new UI challenges: a `shadcn/ui Select` for FK fields (company, department, status, gender, citizenship, language), a multi-select pattern for role tags, and a cascading company → department → sub-department selector. The established "hidden input alongside Select" pattern from Phase 1 MUST be used for all shadcn/ui `<Select>` fields.

The import plan (02-02) has one non-trivial constraint: Supabase's `.upsert()` API cannot use a partial unique index (`WHERE deleted_at IS NULL`) as the `onConflict` target. PostgREST requires a full non-partial UNIQUE constraint or PRIMARY KEY for ON CONFLICT. The solution is a PostgreSQL `SECURITY DEFINER` RPC function that performs the upsert in raw SQL, using the partial index predicate directly in `ON CONFLICT (employee_number, company_id) WHERE deleted_at IS NULL`. The actual payroll Excel file has been inspected (`demo.xlsx`): it has 133 columns, all Hebrew headers, dates as ISO strings from ExcelJS, **no company column** (company must be selected by the admin at import time), department numbers (not UUIDs) in columns 67 and 68, and gender codes `ז`/`נ`.

**Primary recommendation:** Follow Phase 1 patterns exactly for CRUD. For Excel import: use `exceljs` (npm `exceljs@4.4.0`) for parsing, a PostgreSQL RPC function for the upsert, and a company selector + preview table before confirming the import.

---

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase. The following constraints come from the project's prior decisions, enforced across all phases:

- Use `@supabase/ssr` exclusively — `auth-helpers-nextjs` is deprecated
- Set `dir="rtl"` on `<html>` from Day 1 — already done in Phase 1
- All UNIQUE constraints must be partial (`WHERE deleted_at IS NULL`) for soft-delete compatibility
- Use SECURITY DEFINER function for permission lookups to prevent RLS recursion
- Phase 1 RLS is permissive for authenticated users — business logic in Server Actions
- All future-proofing stubs (employees, projects, users) already created in migration 00001
- Hidden inputs alongside shadcn/ui `<Select>` — `Select.onValueChange` does NOT write to FormData

---

## Standard Stack

### Core (inherited from Phase 1 — already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | Full-stack framework (App Router) | Already running |
| @supabase/ssr | ^0.8.0 | Supabase SSR client | Already installed |
| @supabase/supabase-js | ^2.98.0 | Supabase JS client | Already installed |
| zod | ^4.3.6 | Schema validation | Already installed — NOTE: project uses Zod v4, not v3 |
| react-hook-form | ^7.71.2 | Form state management | Already installed |
| @hookform/resolvers | ^5.2.2 | RHF + Zod bridge | Already installed — v5.2+ supports Zod v4 |
| @tanstack/react-table | ^8.21.3 | Data table engine | Already installed |
| shadcn/ui (components) | latest | UI component library | Already installed via CLI |

### New for Phase 2

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| exceljs | ^4.4.0 | Excel file parsing | Server-side XLSX reading from Buffer. Supports `workbook.xlsx.load(buffer)`. Hebrew column names work natively (Unicode). Maintained, MIT licensed. Do NOT use the `xlsx` npm package — it is 2+ years stale and has a high-severity vulnerability. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| exceljs | xlsx (SheetJS npm) | xlsx@0.18.5 on npm registry is 2+ years stale, high-severity vulnerability. SheetJS moved to private CDN at v18.5+. Do not use. |
| exceljs | read-excel-file | read-excel-file is simpler but requires a schema definition upfront — less flexible for Hebrew column mapping. |
| RPC function for upsert | Supabase `.upsert()` direct | `.upsert({ onConflict: 'employee_number,company_id' })` FAILS because the employees table uses a partial unique index. PostgREST cannot use partial indexes in ON CONFLICT. RPC is the correct workaround. |

**Installation (new package only):**
```bash
npm install exceljs
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
src/
├── app/
│   └── (admin)/
│       └── admin/
│           └── employees/
│               ├── page.tsx              # Server Component: fetch employees list
│               └── import/
│                   └── page.tsx          # Server Component: import wizard (optional route)
│
├── components/
│   └── admin/
│       └── employees/
│           ├── EmployeesTable.tsx        # TanStack Table with multi-filter toolbar
│           ├── EmployeeForm.tsx          # Create/edit dialog (large form, multi-section)
│           └── EmployeeImport.tsx        # Import wizard: upload -> preview -> confirm
│
├── actions/
│   └── employees.ts                      # createEmployee, updateEmployee, softDeleteEmployee, importEmployees
│
└── lib/
    └── schemas.ts                        # Add EmployeeSchema to existing schemas.ts

supabase/
└── migrations/
    └── 00004_employee_import_function.sql  # upsert_employees_from_import() RPC
```

### Pattern 1: Employee Form with shadcn/ui Select + Hidden Input

**What:** Every `shadcn/ui <Select>` field in the employee form must be paired with a hidden `<input>` to write the selected value into FormData. `Select.onValueChange` updates React state; the hidden input syncs the value into the native form's FormData. This is the established pattern from Phase 1.

**When to use:** All FK selectors (company_id, department_id, sub_department_id) and enum fields (status, gender, citizenship, correspondence_language).

```typescript
// Source: Phase 1 established pattern (src/components/admin/departments/ pattern)
// src/components/admin/employees/EmployeeForm.tsx (excerpt)

const [selectedCompanyId, setSelectedCompanyId] = React.useState(employee?.company_id ?? '')
const [selectedDeptId, setSelectedDeptId] = React.useState(employee?.department_id ?? '')

// In JSX:
<Select
  value={selectedCompanyId}
  onValueChange={(value) => {
    setSelectedCompanyId(value)
    setSelectedDeptId('')  // Reset sub-selects on parent change
  }}
>
  <SelectTrigger>
    <SelectValue placeholder="בחר חברה" />
  </SelectTrigger>
  <SelectContent>
    {companies.map(c => (
      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
{/* MANDATORY: hidden input writes value to FormData */}
<input type="hidden" name="company_id" value={selectedCompanyId} />
```

### Pattern 2: Multi-Select for Role Tags

**What:** Role tags use a custom multi-select implementation (shadcn/ui does not have a built-in multi-select). Use a Popover + Command (cmdk) pattern with checkboxes. Selected tag IDs are serialized as multiple hidden inputs or a comma-separated string.

**When to use:** The role tags field in EmployeeForm.

```typescript
// Pattern: Multiple hidden inputs for multi-select (cleanest for FormData)
// Each selected role tag gets its own hidden input with the same name
// Server Action reads: formData.getAll('role_tag_ids') -> string[]

// In JSX (simplified):
{selectedTagIds.map(tagId => (
  <input key={tagId} type="hidden" name="role_tag_ids" value={tagId} />
))}
```

**Server Action reads it as:**
```typescript
const roleTagIds = formData.getAll('role_tag_ids') as string[]
```

**Alternative:** Single hidden input with comma-separated IDs, split server-side. Either approach works — multiple hidden inputs is more idiomatic HTML.

### Pattern 3: Cascading Company → Department Selector

**What:** When a company is selected, the department dropdown must show only departments belonging to that company. Sub-department shows only departments whose `parent_dept_id` is the selected department.

**When to use:** EmployeeForm for department_id and sub_department_id fields.

**Implementation:** Pass all departments as a prop to EmployeeForm. Filter client-side:

```typescript
// All departments fetched server-side, passed as prop to EmployeeForm
// Filter in the component, no round-trip needed

const deptsByCompany = departments.filter(
  d => d.company_id === selectedCompanyId && d.parent_dept_id === null
)

const subDeptsByDept = departments.filter(
  d => d.parent_dept_id === selectedDeptId
)
```

### Pattern 4: TanStack Table with Multi-Filter Toolbar

**What:** The employee list needs filtering by company, department, and status — not just text search. Use TanStack Table's `columnFilters` state with `setFilterValue` for each dropdown.

**When to use:** EmployeesTable.tsx for the /admin/employees list.

```typescript
// Source: TanStack Table v8 official column filtering API
// Extend existing DataTable.tsx or create EmployeesTable.tsx directly

const table = useReactTable({
  data: employees,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onColumnFiltersChange: setColumnFilters,
  onSortingChange: setSorting,
  state: { sorting, columnFilters },
})

// Filter controls — dropdown per filter
<select
  value={(table.getColumn('status')?.getFilterValue() as string) ?? ''}
  onChange={e => table.getColumn('status')?.setFilterValue(e.target.value || undefined)}
>
  <option value="">כל הסטטוסים</option>
  <option value="active">פעיל</option>
  <option value="suspended">מושהה</option>
  <option value="inactive">לא פעיל</option>
</select>
```

### Pattern 5: Excel File Upload via Server Action

**What:** File input in a Client Component submits via `<form action={importAction}>`. The Server Action receives the `File` object from FormData, converts to Buffer, parses with ExcelJS, validates rows, and calls the RPC upsert function.

**When to use:** 02-02 Excel import plan — `EmployeeImport.tsx` + `actions/employees.ts`.

```typescript
// Client Component
'use client'
export function EmployeeImportForm({ companies }: { companies: Company[] }) {
  const [state, formAction, isPending] = useActionState(importEmployeesAction, null)

  return (
    <form action={formAction}>
      {/* Company selector — use hidden input pattern */}
      <select name="company_id">
        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input type="file" name="excel_file" accept=".xlsx,.xls" required />
      <button type="submit" disabled={isPending}>ייבוא</button>
    </form>
  )
}

// Server Action
'use server'
export async function importEmployeesAction(prevState: unknown, formData: FormData) {
  const session = await verifySession()

  const file = formData.get('excel_file') as File | null
  const companyId = formData.get('company_id') as string | null

  if (!file || !companyId) return { error: 'שדות חובה חסרים' }

  // Convert File -> Buffer (Next.js Server Actions support File objects in FormData)
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Parse with ExcelJS
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]

  // Map rows to employee records...
}
```

### Pattern 6: RPC Upsert Function (Partial Index Workaround)

**What:** Supabase `.upsert({ onConflict: 'employee_number,company_id' })` FAILS when the unique constraint is a partial index (`WHERE deleted_at IS NULL`). PostgREST cannot reference a partial index in `ON CONFLICT`. Solution: a `SECURITY DEFINER` PostgreSQL function that performs the upsert using raw SQL.

**When to use:** Excel import batch upsert — the core of plan 02-02.

```sql
-- supabase/migrations/00004_employee_import_function.sql
-- Called via: supabase.rpc('upsert_employee', { p_employee_number: ..., ... })

CREATE OR REPLACE FUNCTION upsert_employee(
  p_employee_number     TEXT,
  p_company_id          UUID,
  p_first_name          TEXT,
  p_last_name           TEXT,
  p_id_number           TEXT,
  p_gender              TEXT,
  p_street              TEXT,
  p_house_number        TEXT,
  p_city                TEXT,
  p_mobile_phone        TEXT,
  p_additional_phone    TEXT,
  p_email               TEXT,
  p_date_of_birth       DATE,
  p_start_date          DATE,
  p_end_date            DATE,
  p_department_id       UUID,
  p_sub_department_id   UUID,
  p_passport_number     TEXT,
  p_citizenship         TEXT,
  p_status              TEXT,
  p_imported_by         UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO employees (
    employee_number, company_id, first_name, last_name,
    id_number, gender, street, house_number, city,
    mobile_phone, additional_phone, email,
    date_of_birth, start_date, end_date,
    department_id, sub_department_id,
    passport_number, citizenship, status,
    created_by, updated_by
  )
  VALUES (
    p_employee_number, p_company_id, p_first_name, p_last_name,
    p_id_number, p_gender, p_street, p_house_number, p_city,
    p_mobile_phone, p_additional_phone, p_email,
    p_date_of_birth, p_start_date, p_end_date,
    p_department_id, p_sub_department_id,
    p_passport_number, p_citizenship, p_status,
    p_imported_by, p_imported_by
  )
  ON CONFLICT (employee_number, company_id)
  WHERE deleted_at IS NULL
  DO UPDATE SET
    first_name          = EXCLUDED.first_name,
    last_name           = EXCLUDED.last_name,
    id_number           = EXCLUDED.id_number,
    gender              = EXCLUDED.gender,
    street              = EXCLUDED.street,
    house_number        = EXCLUDED.house_number,
    city                = EXCLUDED.city,
    mobile_phone        = EXCLUDED.mobile_phone,
    additional_phone    = EXCLUDED.additional_phone,
    email               = EXCLUDED.email,
    date_of_birth       = EXCLUDED.date_of_birth,
    start_date          = EXCLUDED.start_date,
    end_date            = EXCLUDED.end_date,
    department_id       = EXCLUDED.department_id,
    sub_department_id   = EXCLUDED.sub_department_id,
    passport_number     = EXCLUDED.passport_number,
    citizenship         = EXCLUDED.citizenship,
    status              = EXCLUDED.status,
    updated_by          = EXCLUDED.updated_by,
    updated_at          = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
```

**Called from Server Action:**
```typescript
// Process rows one-by-one (or in small batches with Promise.all)
const { data, error } = await supabase.rpc('upsert_employee', {
  p_employee_number: row.employeeNumber,
  p_company_id: companyId,
  // ... all fields
})
```

**Note:** RPC calls do not support batch arrays natively — call the function per-row. For ~hundreds of employees this is acceptable. For thousands, use a bulk RPC function that accepts a JSONB array.

### Pattern 7: Department Number → UUID Lookup

**What:** The payroll Excel file stores department numbers (integers: 1, 2, 12) in columns 67 and 68 — not UUIDs. The Server Action must query departments to map `dept_number + company_id → department_id UUID`.

**When to use:** Excel import Server Action, before building the employee insert payload.

```typescript
// Fetch all departments for the selected company once, build a lookup map
const { data: depts } = await supabase
  .from('departments')
  .select('id, dept_number, parent_dept_id')
  .eq('company_id', companyId)
  .is('deleted_at', null)

// Build lookup maps
const deptByNumber = new Map(depts?.map(d => [d.dept_number, d]) ?? [])

// Per row:
const deptId = deptByNumber.get(String(excelDeptNumber))?.id ?? null
const subDeptId = deptByNumber.get(String(excelSubDeptNumber))?.id ?? null
```

### Anti-Patterns to Avoid

- **Supabase `.upsert({ onConflict: 'employee_number,company_id' })` direct call:** FAILS with PostgREST error 42P10 because `employees_number_company_active` is a partial index. Use the RPC function instead.
- **Reading Excel dates as strings:** ExcelJS returns date cells as JavaScript `Date` objects (ISO string in older API) or `Date` instances — verify with `instanceof Date` and call `.toISOString()` to get a string for Postgres.
- **Installing `xlsx` from npm:** The version on npm registry is 2+ years old and has a high-severity vulnerability. Use `exceljs` instead.
- **Sending raw employee data from client to server for import:** The file upload MUST go to a Server Action — never parse Excel client-side and send JSON rows. Parsing on server is more secure and avoids the 1MB Server Action body limit issue (the limit applies to the whole body, so a large Excel file must be sent as a `File` in FormData, not as parsed JSON).
- **Select.onValueChange without hidden input:** `shadcn/ui <Select>` does NOT write to FormData. This is a project-wide established pitfall.
- **Not resetting sub-department when company changes:** Company → Department → Sub-Department is a cascade. Changing company must clear department_id and sub_department_id in the form state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel file parsing | Custom ZIP/XML parser | `exceljs` | 133 column XLSX with Hebrew headers, date cells, numeric cells — edge cases in every cell type |
| Multi-select UI | Custom dropdown with checkbox list | Radix UI Popover + shadcn Command + state | Focus management, keyboard nav, accessibility in RTL — all handled |
| Upsert with soft delete | Custom SELECT → INSERT/UPDATE logic | PostgreSQL `ON CONFLICT DO UPDATE` via RPC function | Race conditions in concurrent imports, atomicity, partial index semantics |
| Department number lookup | Inline SELECT per row | Pre-fetched Map before loop | N+1 query pattern — one query, build Map, O(1) lookups per row |
| Form validation for 20+ fields | Manual checks | Zod v4 schema + RHF | Type inference, field-level errors in Hebrew, async validation |

**Key insight:** The Excel import has deceptive complexity hidden in three places: (1) the upsert on partial index, (2) the company identifier not being in the file, and (3) date values that need type-checking before `.toISOString()`.

---

## Common Pitfalls

### Pitfall 1: Supabase Upsert Fails on Partial Index

**What goes wrong:** `supabase.from('employees').upsert([...], { onConflict: 'employee_number,company_id' })` throws PostgREST error code 42P10: "there is no unique or exclusion constraint matching the ON CONFLICT specification."

**Why it happens:** The `employees_number_company_active` index is a PARTIAL unique index (`WHERE deleted_at IS NULL`). PostgREST's upsert implementation can only use full UNIQUE constraints or PRIMARY KEYs in `ON CONFLICT` — not partial indexes. This is a known limitation tracked in PostgREST issue #2123.

**How to avoid:** Create a `SECURITY DEFINER` PostgreSQL function that performs the upsert with native SQL `ON CONFLICT (...) WHERE deleted_at IS NULL DO UPDATE SET ...`. Call it via `supabase.rpc('upsert_employee', params)`.

**Warning signs:** Error `42P10` or "no unique or exclusion constraint matching" in Supabase logs during import testing.

### Pitfall 2: ExcelJS Date Values Are JavaScript Date Objects

**What goes wrong:** Code does `row.getCell(16).value` expecting a string like "1973-04-14", but gets a JavaScript `Date` object. Calling `.toString()` on it produces "Sat Apr 14 1973 00:00:00 GMT+0000" which Postgres rejects as a DATE input.

**Why it happens:** ExcelJS deserializes Excel serial date numbers into JavaScript `Date` objects automatically.

**How to avoid:** Check cell type and convert:
```typescript
function cellToDateString(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().split('T')[0]  // "YYYY-MM-DD"
  if (typeof value === 'string') return value.split('T')[0]
  return null
}
```
**Warning signs:** Postgres error "invalid input syntax for type date" during import.

### Pitfall 3: Company ID Not in the Excel File

**What goes wrong:** Developer assumes the Excel file identifies which company each employee belongs to. The actual payroll export (`demo.xlsx`) has no company column. All 9 data rows implicitly belong to one company, identified only by which file was exported.

**Why it happens:** The payroll system exports per-company. The company context is implicit.

**How to avoid:** The import UI MUST include a company selector before the file upload. The selected `company_id` is sent alongside the file in the same FormData. The Server Action validates that `company_id` is non-null before processing.

**Warning signs:** Import succeeds but all employees have null company_id, violating the NOT NULL constraint on employees.company_id.

### Pitfall 4: Department Numbers Are Integers, Not UUIDs

**What goes wrong:** Column 67 in the Excel file contains `1`, `2`, `12` — department numbers that match the `dept_number` TEXT field in the departments table. These are NOT UUIDs. Trying to use them directly as `department_id` causes a Postgres UUID format error.

**Why it happens:** The payroll system stores department numbers as integers in its own database. The UUID is an internal ChemoSystem identifier.

**How to avoid:** Before processing rows, fetch all departments for the import company and build a `Map<string, UUID>` keyed by `dept_number`. Use this map to convert each Excel department number to a department UUID. If no match found: set `department_id = null` (or flag the row as needing manual review).

**Warning signs:** Postgres error "invalid input syntax for type uuid" on the department_id column.

### Pitfall 5: Next.js Server Action Body Size Limit for Large Excel Files

**What goes wrong:** Importing a large Excel file (many employees, >1MB) causes `Error: Body exceeded 1mb limit` in the Server Action.

**Why it happens:** Next.js Server Actions have a default 1MB body size limit. A payroll Excel export with hundreds of employees can easily exceed this.

**How to avoid:** Configure `serverActions.bodySizeLimit` in `next.config.ts`:
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  serverActions: {
    bodySizeLimit: '10mb',  // Adjust based on expected file size
  },
}
```
**Warning signs:** 413 or body size error in the browser console when uploading large files; works fine in dev with small test files.

### Pitfall 6: Gender Code Mapping

**What goes wrong:** The Excel file uses `ז` (zayin) for male and `נ` (nun) for female. The `employees` table uses the DB constraint `CHECK (gender IN ('male', 'female', 'other'))`. Storing `ז` directly violates the constraint.

**Why it happens:** The payroll system uses Hebrew single-character gender codes; the DB uses English strings.

**How to avoid:** Map in the import function:
```typescript
function mapGender(code: string | null): string | null {
  if (code === 'ז') return 'male'
  if (code === 'נ') return 'female'
  return null  // 'other' not used in payroll system
}
```

### Pitfall 7: Zod v4 Error Message API Changed

**What goes wrong:** Using old Zod v3 patterns like `.min(1, { message: 'שדה חובה' })` or `z.string({ required_error: 'חובה' })` in the EmployeeSchema. In Zod v4, `message` is replaced with `error` and `required_error` / `invalid_type_error` are removed.

**Why it happens:** The project uses Zod v4.3.6 (see `package.json`). All online tutorials still show v3 syntax.

**How to avoid:** Use Zod v4 syntax exclusively:
```typescript
// Zod v4 (correct for this project)
z.string().min(1, 'שם פרטי הוא שדה חובה')       // Simple string message still works
z.string().min(1, { error: 'שם פרטי הוא שדה חובה' })  // Object form uses `error` not `message`

// WRONG — v3 syntax that does NOT work in v4:
z.string({ required_error: 'שדה חובה' })          // v3 only — removed in v4
z.string({ invalid_type_error: 'לא טקסט' })       // v3 only — removed in v4
```
**Warning signs:** TypeScript type error on schema definition; no validation error displayed at runtime.

### Pitfall 8: RLS SELECT Policy Blocks Soft-Delete UPDATE (inherited from Phase 1)

**What goes wrong:** `employees` has `USING (deleted_at IS NULL)` on SELECT, but UPDATE policy uses `USING (true)`. If developers add a tighter UPDATE policy that mirrors the SELECT policy, the soft-delete UPDATE will return 0 rows silently.

**How to avoid:** Keep `employees_update` RLS policy as `USING (true)` (already set correctly in `00002_rls_policies.sql`). Never mirror the SELECT USING clause on UPDATE policies for soft-deleteable tables.

---

## Code Examples

Verified patterns from the actual codebase and official sources:

### Employee Zod Schema (Zod v4)

```typescript
// Source: Existing schemas.ts in project + Zod v4 official docs
// src/lib/schemas.ts — add EmployeeSchema

export const EmployeeSchema = z.object({
  first_name:                 z.string().min(1, 'שם פרטי הוא שדה חובה'),
  last_name:                  z.string().min(1, 'שם משפחה הוא שדה חובה'),
  employee_number:            z.string().min(1, 'מספר עובד הוא שדה חובה'),
  company_id:                 z.string().uuid('חברה לא תקינה'),
  id_number:                  z.string().optional().or(z.literal('')),
  gender:                     z.enum(['male', 'female', 'other']).optional(),
  street:                     z.string().optional().or(z.literal('')),
  house_number:               z.string().optional().or(z.literal('')),
  city:                       z.string().optional().or(z.literal('')),
  mobile_phone:               z.string().optional().or(z.literal('')),
  additional_phone:           z.string().optional().or(z.literal('')),
  email:                      z.string().optional().or(z.literal('')),
  date_of_birth:              z.string().optional().or(z.literal('')),
  start_date:                 z.string().optional().or(z.literal('')),
  end_date:                   z.string().optional().or(z.literal('')),
  status:                     z.enum(['active', 'suspended', 'inactive']).default('active'),
  department_id:              z.string().uuid().optional().or(z.literal('')),
  sub_department_id:          z.string().uuid().optional().or(z.literal('')),
  passport_number:            z.string().optional().or(z.literal('')),
  citizenship:                z.enum(['israeli', 'foreign']).optional(),
  correspondence_language:    z.enum(['hebrew', 'english', 'arabic', 'thai']).default('hebrew'),
  profession:                 z.string().optional().or(z.literal('')),
  notes:                      z.string().optional().or(z.literal('')),
})

export type EmployeeInput = z.infer<typeof EmployeeSchema>
```

### Employee Create Server Action

```typescript
// Source: Project pattern from src/actions/companies.ts
// src/actions/employees.ts (excerpt)
'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { EmployeeSchema } from '@/lib/schemas'

export async function createEmployee(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  // Role tags come as multiple hidden inputs with the same name
  const roleTagIds = formData.getAll('role_tag_ids') as string[]

  // Exclude role_tag_ids from the main schema parse
  const rawData = Object.fromEntries(formData)
  delete (rawData as Record<string, unknown>).role_tag_ids

  const parsed = EmployeeSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const input = parsed.data

  // Insert employee
  const { data: employee, error } = await supabase
    .from('employees')
    .insert({
      ...input,
      company_id: input.company_id,
      department_id: input.department_id || null,
      sub_department_id: input.sub_department_id || null,
      date_of_birth: input.date_of_birth || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      created_by: session.userId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: { employee_number: ['מספר עובד כבר קיים בחברה זו'] } }
    }
    return { success: false, error: { _form: [error.message] } }
  }

  // Insert role tag junctions (if any)
  if (roleTagIds.length > 0) {
    await supabase.from('employee_role_tags').insert(
      roleTagIds.map(tagId => ({ employee_id: employee.id, role_tag_id: tagId }))
    )
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'employees',
    entityId: employee.id,
    oldData: null,
    newData: employee as Record<string, unknown>,
  })

  revalidatePath('/admin/employees')
  return { success: true }
}
```

### ExcelJS File Parsing (Server Action)

```typescript
// Source: ExcelJS v4.4.0 official API (github.com/exceljs/exceljs)
// src/actions/employees.ts — importEmployeesAction (excerpt)
import ExcelJS from 'exceljs'

// Excel column mapping for the payroll export (verified against demo.xlsx):
const COL = {
  EMPLOYEE_NUMBER:    1,   // מספר עובד
  FIRST_NAME:         3,   // שם פרטי
  LAST_NAME:          4,   // שם משפחה
  ID_NUMBER:          6,   // מספר זהות
  GENDER_CODE:        7,   // קוד מין: ז=male, נ=female
  STREET:             9,   // כתובת
  HOUSE_NUMBER:      10,   // כתובת - מספר בית
  CITY:              11,   // כתובת - ישוב
  MOBILE_PHONE:      13,   // טלפון
  ADDITIONAL_PHONE:  14,   // טלפון נוסף
  EMAIL:             15,   // כתובת - דוא"ל
  DATE_OF_BIRTH:     16,   // תאריך לידה (Date object from ExcelJS)
  START_DATE:        60,   // תאריך תחילת עבודה (Date object)
  END_DATE:          61,   // תאריך הפסקת עבודה (Date | null)
  DEPT_NUMBER:       67,   // מספר מחלקה (integer, NOT UUID)
  SUB_DEPT_NUMBER:   68,   // מספר תת-מחלקה (integer, 0 = no sub-dept)
  COUNTRY_CODE:      73,   // קוד מדינה (null = Israeli, non-null = foreign)
  PASSPORT_NUMBER:   74,   // מספר דרכון
} as const

function cellToDateString(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().split('T')[0]
  if (typeof value === 'string') return value.split('T')[0]
  return null
}

function cellToString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value).trim() || null
}

async function parseEmployeesFromExcel(
  buffer: Buffer,
  companyId: string,
  departments: Array<{ id: string; dept_number: string; parent_dept_id: string | null }>
): Promise<ParsedEmployee[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]  // First sheet: גיליון1

  // Build department lookup map
  const deptByNumber = new Map(departments.map(d => [d.dept_number, d.id]))

  const employees: ParsedEmployee[] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return  // Skip header row

    const employeeNumber = cellToString(row.getCell(COL.EMPLOYEE_NUMBER).value)
    if (!employeeNumber) return  // Skip empty rows

    const endDate = cellToDateString(row.getCell(COL.END_DATE).value)
    const deptNumberRaw = row.getCell(COL.DEPT_NUMBER).value
    const subDeptNumberRaw = row.getCell(COL.SUB_DEPT_NUMBER).value
    const genderCode = cellToString(row.getCell(COL.GENDER_CODE).value)
    const countryCode = row.getCell(COL.COUNTRY_CODE).value

    employees.push({
      employee_number:  employeeNumber,
      company_id:       companyId,
      first_name:       cellToString(row.getCell(COL.FIRST_NAME).value) ?? '',
      last_name:        cellToString(row.getCell(COL.LAST_NAME).value) ?? '',
      id_number:        cellToString(row.getCell(COL.ID_NUMBER).value),
      gender:           genderCode === 'ז' ? 'male' : genderCode === 'נ' ? 'female' : null,
      street:           cellToString(row.getCell(COL.STREET).value),
      house_number:     cellToString(row.getCell(COL.HOUSE_NUMBER).value),
      city:             cellToString(row.getCell(COL.CITY).value),
      mobile_phone:     cellToString(row.getCell(COL.MOBILE_PHONE).value),
      additional_phone: cellToString(row.getCell(COL.ADDITIONAL_PHONE).value),
      email:            cellToString(row.getCell(COL.EMAIL).value),
      date_of_birth:    cellToDateString(row.getCell(COL.DATE_OF_BIRTH).value),
      start_date:       cellToDateString(row.getCell(COL.START_DATE).value),
      end_date:         endDate,
      status:           endDate ? 'inactive' : 'active',
      department_id:    deptByNumber.get(String(deptNumberRaw || '')) ?? null,
      sub_department_id: (subDeptNumberRaw && Number(subDeptNumberRaw) !== 0)
                          ? deptByNumber.get(String(subDeptNumberRaw)) ?? null
                          : null,
      passport_number:  cellToString(row.getCell(COL.PASSPORT_NUMBER).value),
      citizenship:      countryCode ? 'foreign' : 'israeli',
    })
  })

  return employees
}
```

### Soft Status Change (Suspend Employee)

```typescript
// EMPL-04: Suspend = status change to 'suspended' (not a soft delete)
export async function suspendEmployee(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  const { data: oldData } = await supabase.from('employees').select('*').eq('id', id).single()

  const { error } = await supabase
    .from('employees')
    .update({ status: 'suspended', updated_by: session.userId })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'employees',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: { status: 'suspended' },
  })

  revalidatePath('/admin/employees')
  return { success: true }
}
```

### Role Tag Junction: Update (Replace All Tags)

```typescript
// Pattern for EMPL-05: update role tags — delete all, re-insert selected
export async function updateEmployeeRoleTags(
  employeeId: string,
  roleTagIds: string[]
): Promise<void> {
  const supabase = await createClient()

  // Delete existing tags (no soft delete on junction table)
  await supabase.from('employee_role_tags').delete().eq('employee_id', employeeId)

  // Re-insert selected tags
  if (roleTagIds.length > 0) {
    await supabase.from('employee_role_tags').insert(
      roleTagIds.map(tagId => ({ employee_id: employeeId, role_tag_id: tagId }))
    )
  }
}
```

---

## Payroll Excel File Structure (VERIFIED from demo.xlsx)

This section documents the actual payroll export format. It is the source of truth for the import mapping.

**File:** `demo.xlsx` (28,709 bytes, valid Office Open XML)
**Sheets:** 2 — `גיליון1` (employee data), `תעריף` (rate/salary data — not imported in Phase 2)
**Data rows in `גיליון1`:** 9 rows + 1 header = 10 total
**Columns:** 133 total, all Hebrew headers

### Column Mapping (complete, relevant columns only)

| Column | Hebrew Header | DB Field | Notes |
|--------|---------------|----------|-------|
| 1 | מספר עובד | `employee_number` | Composite key component. Integer in demo, stored as TEXT. |
| 3 | שם פרטי | `first_name` | |
| 4 | שם משפחה | `last_name` | |
| 6 | מספר זהות | `id_number` | T.Z. number. 0 in demo = no ID (foreign worker). |
| 7 | קוד מין | `gender` | `ז` → `'male'`, `נ` → `'female'`. Must map. |
| 9 | כתובת | `street` | Some values are `????` (encoding artifact in demo file — production files will be clean). |
| 10 | כתובת - מספר בית | `house_number` | |
| 11 | כתובת - ישוב | `city` | |
| 13 | טלפון | `mobile_phone` | |
| 14 | טלפון נוסף | `additional_phone` | |
| 15 | כתובת - דוא"ל | `email` | |
| 16 | תאריך לידה | `date_of_birth` | ExcelJS returns `Date` object. Convert to `YYYY-MM-DD`. |
| 60 | תאריך תחילת עבודה | `start_date` | ExcelJS returns `Date` object. |
| 61 | תאריך הפסקת עבודה | `end_date` | `null` = still employed. If set, infer `status = 'inactive'`. |
| 67 | מספר מחלקה | `department_id` | Integer dept number. Must look up UUID by `dept_number + company_id`. Values seen: 0, 1, 2, 12. |
| 68 | מספר תת-מחלקה | `sub_department_id` | Integer. `0` means no sub-department. |
| 73 | קוד מדינה | `citizenship` | `null` → `'israeli'`, non-null → `'foreign'`. |
| 74 | מספר דרכון | `passport_number` | |

### Company Column: ABSENT

The Excel file has no company identifier. The company is implicit — one export per company. The import UI must present a company selector and pass `company_id` alongside the file.

### Status Inference

The `status` field is not directly in the Excel. Infer from:
- `end_date` (column 61) is set → `status = 'inactive'`
- `end_date` is null → `status = 'active'` (suspended state cannot be inferred from export — treat as active on import)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `xlsx` from npm | `exceljs` | SheetJS left npm at v18.5 (2023) | Use `exceljs` — the npm `xlsx` package is stale and vulnerable |
| `z.string({ message: ... })` | `z.string({ error: ... })` | Zod v4 (2025) | Project uses Zod v4. Use `error` not `message` in object form. |
| `z.string().email()` | `z.email()` (or keep old form, still works in v4) | Zod v4 | Both work in v4 but top-level form is preferred |
| Supabase `.upsert({ onConflict })` on partial index | `supabase.rpc('upsert_employee', ...)` | Ongoing PostgREST limitation | Partial indexes never worked with PostgREST upsert — RPC is the permanent workaround |
| `Select.onValueChange` writes to FormData | Hidden input pattern | Phase 1 established | Radix Select does not write to FormData — hidden input is required |

**Deprecated/outdated:**
- `xlsx` npm package: stale at v0.18.5, high-severity vulnerability, SheetJS moved to private CDN
- Zod v3 `required_error` / `invalid_type_error` parameters: removed in v4 (project uses v4.3.6)
- Direct `supabase.from('employees').upsert()` with composite partial index: fails with 42P10

---

## Open Questions

1. **Company code → company_id mapping at import time**
   - What we know: The Excel file has no company column. The payroll system exports per-company. Admin must select the company before uploading.
   - What's unclear: Is there a "company code" in the payroll system that maps to the `internal_number` in the companies table? Does the admin always know which company a file belongs to?
   - Recommendation: Present a company selector as the FIRST step in the import wizard. Label it clearly: "בחר את החברה שממנה יובא הקובץ". The selected `company_id` is required — block upload until selected. Do NOT try to auto-detect company from the file.

2. **Import preview before commit**
   - What we know: The requirement says "import confirmation flow" (EMPL-10 / plan 02-02).
   - What's unclear: How much preview detail is needed? Just a count ("נמצאו 47 עובדים — 12 חדשים, 35 יעודכנו"), or a full table of all rows?
   - Recommendation: Show a summary count (new vs update) before committing. Full table preview is a nice-to-have but adds implementation complexity. Start with summary, add full table in a later iteration.

3. **Role tags on import**
   - What we know: The Excel file has no role tag data. Role tags are assigned manually in the admin UI.
   - What's unclear: Should the import reset role tags, or leave them unchanged?
   - Recommendation: Import NEVER touches `employee_role_tags`. Role tag assignment is manual-only. The import function only updates fields in the `employees` table.

4. **What happens to duplicate-number employees who were previously soft-deleted?**
   - What we know: The partial index enforces uniqueness only among non-deleted records. If employee #5 is soft-deleted and the import file includes employee #5, the RPC function would INSERT a new record (not conflict with the deleted one).
   - What's unclear: Is this the desired behavior? Or should the import restore the deleted employee?
   - Recommendation: The current RPC implementation is correct — insert as new if the deleted record exists. The import creates a fresh active record. This is consistent with soft-delete semantics.

5. **`?????` values in street/address fields**
   - What we know: The demo.xlsx has `????` in some address fields. This is likely an encoding artifact specific to the demo/test file.
   - What's unclear: Whether production files will have the same encoding issue (Hebrew in address fields corrupted to `?`).
   - Recommendation: Store the value as-is during import. Do not validate or reject based on address content. The admin can correct it manually after import.

---

## Sources

### Primary (HIGH confidence)
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/supabase/migrations/00001_foundation_schema.sql` — Employee table schema, composite partial unique index definition, employee_role_tags junction table
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/supabase/migrations/00002_rls_policies.sql` — RLS policies for employees and employee_role_tags already live
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/actions/companies.ts` — Canonical Server Action pattern (verifySession → validate → mutate → writeAuditLog → revalidatePath)
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/demo.xlsx` — Actual payroll Excel file: 133 columns, Hebrew headers, 9 data rows, column positions verified by running ExcelJS against the file
- `https://zod.dev/v4/changelog` — Zod v4 breaking changes: `error` replaces `message`, `required_error`/`invalid_type_error` removed
- `https://supabase.com/docs/reference/javascript/upsert` — Upsert API: `onConflict` requires full UNIQUE constraint; does not support partial indexes

### Secondary (MEDIUM confidence)
- `https://github.com/orgs/supabase/discussions/12565` — PostgREST upsert on partial index fails (42P10); RPC workaround confirmed by Supabase maintainer
- `https://github.com/orgs/supabase/discussions/28927` — Composite uniqueness + upsert: index required, constraint alone insufficient
- `https://www.npmjs.com/package/exceljs` — ExcelJS v4.4.0 current stable; `workbook.xlsx.load(buffer)` API confirmed
- `https://github.com/exceljs/exceljs` — ExcelJS: `worksheet.eachRow()`, `row.getCell(n).value`, Date object return for date cells
- `https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions` — `serverActions.bodySizeLimit` config for large file uploads (default 1MB)
- `https://github.com/react-hook-form/resolvers/releases` — @hookform/resolvers v5.2+ supports Zod v4

### Tertiary (LOW confidence — verify at implementation)
- Address field `????` encoding in demo.xlsx: may be demo-specific, not production-representative — verify with a real payroll export before finalizing import logic
- `correspondence_language: 'thai'` value in the employees table CHECK constraint: the Excel file doesn't export language preference, and Thai workers appear in `תעריף` sheet — verify that the import correctly leaves this field at the Hebrew default
- RPC function batch size limits: calling `upsert_employee` per-row is safe for hundreds of employees, but for thousands a bulk JSONB-array function may be needed — test with realistic data volume

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries are from Phase 1 (verified) plus exceljs (npm confirmed, API docs checked)
- Employee schema/DB: HIGH — Migration files read directly from the codebase
- CRUD patterns: HIGH — Direct copy of Phase 1 pattern from companies/departments
- Excel column mapping: HIGH — `demo.xlsx` inspected with ExcelJS; headers extracted directly
- Upsert/partial index: MEDIUM — PostgREST limitation documented in GitHub issues, RPC workaround confirmed; exact PostgreSQL syntax for `ON CONFLICT ... WHERE` needs testing at implementation time
- Pitfalls: HIGH (most) / MEDIUM (address encoding artifact — demo-file specific)

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (30 days — stack is stable; verify exceljs version and @hookform/resolvers Zod v4 compatibility at install time)
