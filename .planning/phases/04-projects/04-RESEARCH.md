# Phase 4: Projects - Research

**Researched:** 2026-03-03
**Domain:** Next.js 16 + Supabase CRUD with auto-number generation and employee FK selectors
**Confidence:** HIGH

---

## Summary

Phase 4 builds a full project registry on top of an already-complete infrastructure. The `projects` table exists in the DB (migration 00001) with all required columns already defined. RLS policies already exist (migration 00002). The phase is almost entirely a UI + Server Action problem — not a schema design problem.

The key technical challenge unique to this phase is **auto-number generation in format `PR25XXXXXX`** (prefix `PR`, two-digit year, 6-digit zero-padded sequence). This must be concurrency-safe and is best solved with a PostgreSQL `SEQUENCE` + `SECURITY DEFINER` RPC function, consistent with the project's existing pattern for soft-delete RPC (`soft_delete_employees`).

The second challenge is the **three employee FK selector fields** (project manager, site manager, camp vehicle coordinator). The `EmployeeSearchDialog` component already exists in `src/components/admin/users/` and is reusable with minor adaptation — no new search dialog needs to be built.

**Primary recommendation:** Follow the established CRUD pattern exactly (companies.ts / CompaniesTable.tsx as the template), add a PostgreSQL sequence + `generate_project_number()` SECURITY DEFINER function for auto-numbering, and adapt `EmployeeSearchDialog` for reuse in the project form.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^16.1.6 | App Router + Server Actions | Locked project stack |
| Supabase | @supabase/supabase-js ^2.98.0 | DB + Auth | Locked project stack |
| TanStack Table | ^8.21.3 | Client-side filtering + sorting | Established in employees table |
| Zod | ^4.3.6 | Schema validation in Server Actions | Established pattern |
| shadcn/ui + Radix | various | Dialog, Select, Input, Table | Established component set |
| sonner | ^2.0.7 | Toast notifications | Already in root layout |
| date-fns | ^4.1.0 | Date formatting | Already used |

### No new packages required

All libraries needed for Phase 4 are already installed. The only new DB artifact is a PostgreSQL sequence and function.

```bash
# No new npm install needed
```

---

## Architecture Patterns

### Recommended File Structure for Phase 4

```
src/
├── actions/
│   └── projects.ts              # Server Actions: createProject, updateProject, softDeleteProject
├── app/(admin)/admin/
│   └── projects/
│       ├── page.tsx             # Server Component — fetches data, renders ProjectsTable
│       └── loading.tsx          # Optional skeleton loader
├── components/admin/
│   └── projects/
│       ├── ProjectsTable.tsx    # Client Component — TanStack Table + status filter + CRUD
│       └── ProjectForm.tsx      # Client Component — Dialog form, all fields, employee selectors
└── lib/
    └── schemas.ts               # Add ProjectSchema (Zod)
```

### Pattern 1: Server Action with Auto-Number Generation

**What:** `createProject` calls `supabase.rpc('generate_project_number')` before INSERT. The RPC returns the next formatted string `PR25XXXXXX`.

**Why RPC not client-side:** Sequence must be concurrency-safe. PostgreSQL `nextval()` is atomic. Never generate the number in TypeScript.

**Example:**
```typescript
// src/actions/projects.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { ProjectSchema } from '@/lib/schemas'

export async function createProject(
  prevState: unknown,
  formData: FormData
): Promise<{ success: boolean; error?: Record<string, string[]> }> {
  const session = await verifySession()
  const supabase = await createClient()

  const parsed = ProjectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  // Auto-generate project number via DB sequence (concurrency-safe)
  const { data: projectNumber, error: seqError } = await supabase
    .rpc('generate_project_number')

  if (seqError || !projectNumber) {
    return { success: false, error: { _form: ['שגיאה ביצירת מספר פרויקט'] } }
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...parsed.data,
      project_number: projectNumber,
      created_by: session.userId,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: { _form: [error.message] } }
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'projects',
    entityId: data.id,
    oldData: null,
    newData: data as Record<string, unknown>,
  })

  revalidatePath('/admin/projects')
  return { success: true }
}
```

### Pattern 2: PostgreSQL Auto-Number Migration

**What:** A dedicated sequence + SECURITY DEFINER function generates `PR25XXXXXX`.

**Format breakdown:** `PR` + `YY` (2-digit year from CURRENT_DATE) + `XXXXXX` (6-digit zero-padded sequential number). The sequence is NOT reset per year — it is monotonically increasing. Year prefix is embedded at generation time and never changes for a project.

**Why SECURITY DEFINER:** Consistent with `soft_delete_employees` pattern already in the codebase. Runs as DB owner, avoiding RLS interference.

```sql
-- New migration: 00014_project_number_sequence.sql

-- Sequence for project numbers (monotonically increasing, never reset)
CREATE SEQUENCE IF NOT EXISTS project_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- SECURITY DEFINER function — called by Server Action via .rpc()
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val   BIGINT;
  year_part  TEXT;
BEGIN
  next_val  := nextval('project_number_seq');
  year_part := to_char(CURRENT_DATE, 'YY');  -- '25' for 2025
  RETURN 'PR' || year_part || LPAD(next_val::TEXT, 6, '0');
END;
$$;
```

**Important:** `CACHE 1` ensures no gaps in sequence due to caching. With `CACHE > 1`, sequence blocks are pre-allocated and gaps can appear after server restart — acceptable for business numbers but mentioned for awareness.

### Pattern 3: Employee Selector for FK Fields

**What:** Adapt the existing `EmployeeSearchDialog` (used in user management) into a reusable `ProjectEmployeeSelector` inline component or reuse directly. The project form needs three independent employee selectors.

**Implementation approach:** Reuse `EmployeeSearchDialog` as-is. Each selector slot (PM, SM, CVC) maintains its own state: `selectedEmployee | null`. The form submits hidden inputs with the employee UUID.

```typescript
// In ProjectForm.tsx — state for three selectors
const [pmEmployee, setPmEmployee]   = useState<EmployeeOption | null>(null)
const [smEmployee, setSmEmployee]   = useState<EmployeeOption | null>(null)
const [cvcEmployee, setCvcEmployee] = useState<EmployeeOption | null>(null)

// In form JSX — one selector section per role
<input type="hidden" name="project_manager_id" value={pmEmployee?.id ?? ''} />
<input type="hidden" name="site_manager_id" value={smEmployee?.id ?? ''} />
<input type="hidden" name="camp_vehicle_coordinator_id" value={cvcEmployee?.id ?? ''} />
```

**Display widget pattern:** Show selected employee as a "pill" with name + employee number + clear button. Opens EmployeeSearchDialog on click.

### Pattern 4: Status Filter with Active Count

**What:** The projects list page shows active count in the page header Badge (same as companies/employees pattern) plus a status filter (active/inactive/all) in the table toolbar.

**Implementation:** Client-side filter via TanStack Table column filter. No server round-trip. Consistent with `EmployeesTable` status filter.

```typescript
// In ProjectsTable.tsx — status filter state
const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

// Filtered data passed to useReactTable
const filteredData = useMemo(() => {
  if (statusFilter === 'all') return projects
  return projects.filter(p => p.status === statusFilter)
}, [projects, statusFilter])

// Active count for header
const activeCount = projects.filter(p => p.status === 'active').length
```

### Pattern 5: Soft Delete via SECURITY DEFINER RPC

**What:** Follows the mandatory soft-delete pattern from `MEMORY.md` — uses RPC, not direct UPDATE.

**Why:** Direct `UPDATE ... SET deleted_at` via PostgREST fails with RLS (bug documented in `00007_soft_delete_rpc.sql`). Must use SECURITY DEFINER RPC.

**New RPC needed:**
```sql
-- Add to migration 00014 or new migration 00015

CREATE OR REPLACE FUNCTION soft_delete_project(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE projects
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_id
    AND deleted_at IS NULL;
END;
$$;
```

### Pattern 6: Zod Schema for Projects

**What:** `ProjectSchema` in `src/lib/schemas.ts` validates all form fields before DB write.

**Key considerations:**
- `project_number` is NOT in the schema — it is server-generated, never submitted in form
- Employee FK fields are optional UUIDs (may be empty string from form)
- `latitude` and `longitude` are optional decimals — validate as `z.coerce.number()` or empty string
- `project_type` enum: `'project' | 'staging_area' | 'storage_area'`
- `status` enum: `'active' | 'inactive'`
- Coordinates: submitted as strings from form inputs, coerce to number or null

```typescript
// In src/lib/schemas.ts — add ProjectSchema
export const ProjectSchema = z.object({
  name:                        z.string().min(1, 'שם פרויקט הוא שדה חובה'),
  display_name:                z.string().optional().or(z.literal('')),
  expense_number:              z.string().optional().or(z.literal('')),
  general_number:              z.string().optional().or(z.literal('')),
  description:                 z.string().optional().or(z.literal('')),
  project_code:                z.string().optional().or(z.literal('')),
  attendance_code:             z.string().optional().or(z.literal('')),
  has_attendance_code:         z.boolean().default(false),
  project_type:                z.enum(['project', 'staging_area', 'storage_area']).optional(),
  ignore_auto_equipment:       z.boolean().default(false),
  supervision:                 z.string().optional().or(z.literal('')),
  client:                      z.string().optional().or(z.literal('')),
  status:                      z.enum(['active', 'inactive']).default('active'),
  project_manager_id:          z.string().uuid().optional().or(z.literal('')),
  pm_email:                    z.string().email().optional().or(z.literal('')),
  pm_phone:                    z.string().optional().or(z.literal('')),
  pm_notifications:            z.boolean().default(true),
  site_manager_id:             z.string().uuid().optional().or(z.literal('')),
  sm_email:                    z.string().email().optional().or(z.literal('')),
  sm_phone:                    z.string().optional().or(z.literal('')),
  sm_notifications:            z.boolean().default(true),
  camp_vehicle_coordinator_id: z.string().uuid().optional().or(z.literal('')),
  cvc_phone:                   z.string().optional().or(z.literal('')),
  latitude:                    z.coerce.number().optional().or(z.literal('')),
  longitude:                   z.coerce.number().optional().or(z.literal('')),
})

export type ProjectInput = z.infer<typeof ProjectSchema>
```

### Pattern 7: Coordinate Input (No Map — Coordinates Only)

**What:** Map view is deferred to v2 (PROJ-V2-01). In Phase 4, coordinates are plain numeric text inputs. Two `<Input>` fields: latitude and longitude, `dir="ltr"`, `type="text"`, validated as optional numbers.

**No new libraries needed.** Do not install react-leaflet or any map library. The `[Phase 4 blocker]` decision from prior phases says: "Decide react-leaflet vs Google Maps for project coordinates at Phase 4 planning time" — but map VIEW is deferred. Phase 4 only needs to **store** coordinates. Simple text inputs are the correct implementation.

### Recommended Page Structure

```
/admin/projects
├── page.tsx (Server Component)
│   ├── await verifySession()
│   ├── fetch projects (is('deleted_at', null))
│   ├── fetch employees (for selectors — active only)
│   ├── count active projects
│   └── render: ProjectsTable
│
└── ProjectsTable.tsx (Client Component)
    ├── Status filter toolbar (all / active / inactive)
    ├── Active count badge
    ├── "+ פרויקט חדש" button
    ├── TanStack Table with sort + search
    ├── Row click → ProjectForm (edit mode)
    └── Delete button → DeleteConfirmDialog
```

### Anti-Patterns to Avoid

- **Never generate `project_number` in TypeScript** — use PostgreSQL sequence only. Client-side generation is not concurrency-safe.
- **Never use direct UPDATE for soft-delete** — always RPC (SECURITY DEFINER). Documented bug in 00007.
- **Never install map libraries in Phase 4** — map is v2. Coordinates = two text inputs only.
- **Never pass `project_number` in the form submission** — it is server-generated and should be excluded from ProjectSchema.
- **Never use `getFilteredRowModel` with server data for status counts** — always compute active count from raw `projects` array before filtering.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Employee search dialog | Custom search UI | Adapt existing `EmployeeSearchDialog` | Already built, tested, matches design system |
| Auto-number generation | TypeScript counter + max query | PostgreSQL `SEQUENCE` + `nextval()` | DB-level atomicity, no race conditions |
| Soft delete | Direct UPDATE | SECURITY DEFINER RPC | Known RLS bug in PostgREST — documented in 00007 |
| Table with filtering | Custom filter logic | TanStack Table (already installed) | Established pattern in EmployeesTable |
| Form dialogs | New dialog pattern | Follow `CompaniesTable` / `EmployeeForm` pattern | Consistent UX, RTL-safe, proven working |
| Toast notifications | Custom notification | `sonner` toast | Already in root layout |

**Key insight:** Phase 4 is primarily UI assembly, not engineering. Every pattern exists in prior phases. The only genuinely new engineering is the sequence function for auto-numbering.

---

## Common Pitfalls

### Pitfall 1: Direct UPDATE for Soft Delete Fails Silently

**What goes wrong:** `supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id)` returns no error but deletes 0 rows.

**Why it happens:** RLS SELECT policy `USING (deleted_at IS NULL)` is re-checked after UPDATE. Once `deleted_at` is set, the row no longer satisfies the SELECT policy, so PostgREST returns 0 rows as if nothing was deleted. No error is thrown.

**How to avoid:** Always use SECURITY DEFINER RPC for soft delete. Create `soft_delete_project(p_id UUID)` function in migration 00014 and call via `.rpc('soft_delete_project', { p_id: id })`.

**Warning signs:** `softDeleteProject` returns `{ success: true }` but the row is still visible in the list.

### Pitfall 2: `project_number` Uniqueness Race Condition

**What goes wrong:** Two concurrent project creations could generate the same number if done in TypeScript (e.g., `SELECT MAX(project_number)` + format + INSERT).

**Why it happens:** No atomicity between SELECT and INSERT in application code.

**How to avoid:** Use `nextval('project_number_seq')` inside a PostgreSQL function. Sequences are atomic by design.

**Warning signs:** Duplicate `project_number` constraint violation (error code `23505`) during load testing.

### Pitfall 3: Boolean Fields from FormData Arrive as String `"on"` or Missing

**What goes wrong:** `has_attendance_code`, `ignore_auto_equipment`, `pm_notifications`, `sm_notifications` are checkboxes. FormData sends `"on"` when checked, and the key is absent when unchecked. Zod `z.boolean()` does not coerce these.

**Why it happens:** HTML form behavior — checkboxes submit `"on"` or nothing.

**How to avoid:** Use `z.preprocess` or controlled state. Pattern from EmployeeForm: use controlled `useState` for boolean fields and set hidden `<input type="hidden">` with `"true"/"false"` values. Then Zod coerces: `z.string().transform(v => v === 'true')`.

**Warning signs:** `has_attendance_code` always persists as `false` regardless of checkbox state.

### Pitfall 4: Employee FK Fields Submit Empty String Instead of `null`

**What goes wrong:** Zod schema has `z.string().uuid().optional().or(z.literal(''))`. DB column is `UUID REFERENCES employees(id)`. Supabase rejects empty string `""` for UUID column — it expects `null`, not `""`.

**Why it happens:** `FormData.get()` returns `""` for empty fields. Supabase does not coerce `""` to `null`.

**How to avoid:** In Server Action, convert `""` to `null` before insert:
```typescript
project_manager_id: input.project_manager_id || null,
site_manager_id: input.site_manager_id || null,
camp_vehicle_coordinator_id: input.camp_vehicle_coordinator_id || null,
```

**Warning signs:** `invalid input syntax for type uuid: ""` error from Supabase.

### Pitfall 5: Latitude/Longitude as `DECIMAL` — Empty String vs `null`

**What goes wrong:** Same as Pitfall 4. An empty coordinate input submits `""`. Supabase rejects `""` for `DECIMAL` column.

**How to avoid:** In Server Action:
```typescript
latitude:  input.latitude  === '' ? null : Number(input.latitude),
longitude: input.longitude === '' ? null : Number(input.longitude),
```

**Warning signs:** `invalid input syntax for type numeric: ""` error from Supabase.

### Pitfall 6: `project_number` Included in Form Submission

**What goes wrong:** If `project_number` is shown as read-only in edit mode and included in the form, the UPDATE action would try to set it from user input. The project number must never change after creation.

**How to avoid:** Exclude `project_number` from `ProjectSchema`. In `updateProject`, never pass `project_number` to the Supabase update call. Display it as plain text (not an input) in edit mode.

### Pitfall 7: Coordinate Fields with `dir="rtl"` Layout

**What goes wrong:** Decimal numbers (lat/lng) displayed RTL look malformed — `-31.7683` could render oddly.

**How to avoid:** Always add `dir="ltr"` and `className="text-left"` to coordinate `Input` components.

---

## Code Examples

### Auto-Number SQL Migration

```sql
-- Migration: 00014_project_number_sequence.sql

CREATE SEQUENCE IF NOT EXISTS project_number_seq
  START WITH 1
  INCREMENT BY 1
  CACHE 1;

CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val  BIGINT;
  year_part TEXT;
BEGIN
  next_val  := nextval('project_number_seq');
  year_part := to_char(CURRENT_DATE, 'YY');
  RETURN 'PR' || year_part || LPAD(next_val::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION soft_delete_project(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE projects
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_id
    AND deleted_at IS NULL;
END;
$$;
```

### Projects Page (Server Component)

```typescript
// src/app/(admin)/admin/projects/page.tsx
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from '@/components/admin/projects/ProjectsTable'
import { Badge } from '@/components/ui/badge'
import { RefreshButton } from '@/components/shared/RefreshButton'

export default async function ProjectsPage() {
  await verifySession()
  const supabase = await createClient()

  const [projectsRes, employeesRes] = await Promise.all([
    supabase
      .from('projects')
      .select('*, pm:employees!project_manager_id(id,first_name,last_name), sm:employees!site_manager_id(id,first_name,last_name), cvc:employees!camp_vehicle_coordinator_id(id,first_name,last_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('employees')
      .select('id, first_name, last_name, employee_number, email, id_number, companies(name)')
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('last_name'),
  ])

  const projects = projectsRes.data ?? []
  const employees = employeesRes.data ?? []
  const activeCount = projects.filter(p => p.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">ניהול פרויקטים</h1>
        <Badge variant="secondary">{activeCount} פעילים</Badge>
        <RefreshButton />
      </div>
      <ProjectsTable projects={projects} employees={employees} />
    </div>
  )
}
```

### Employee Selector Pattern in ProjectForm

```typescript
// Controlled state pattern for three employee selectors
const [pmOpen, setPmOpen] = useState(false)
const [smOpen, setSmOpen] = useState(false)
const [cvcOpen, setCvcOpen] = useState(false)

type SelectedEmployee = { id: string; first_name: string; last_name: string; employee_number: string }

const [pm, setPm]   = useState<SelectedEmployee | null>(null)
const [sm, setSm]   = useState<SelectedEmployee | null>(null)
const [cvc, setCvc] = useState<SelectedEmployee | null>(null)

// In JSX — reuse EmployeeSearchDialog three times
<EmployeeSearchDialog
  open={pmOpen}
  onOpenChange={setPmOpen}
  onSelect={(e) => setPm(e)}
  employees={employees}
  linkedEmployeeIds={[]}
/>
<input type="hidden" name="project_manager_id" value={pm?.id ?? ''} />
```

### Soft Delete Server Action

```typescript
// src/actions/projects.ts
export async function softDeleteProject(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession()
  const supabase = await createClient()

  const { data: oldData } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  // MUST use RPC — direct UPDATE fails with RLS (see 00007_soft_delete_rpc.sql)
  const { error } = await supabase
    .rpc('soft_delete_project', { p_id: id })

  if (error) return { success: false, error: error.message }

  await writeAuditLog({
    userId: session.userId,
    action: 'DELETE',
    entityType: 'projects',
    entityId: id,
    oldData: oldData as Record<string, unknown>,
    newData: null,
  })

  revalidatePath('/admin/projects')
  return { success: true }
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual project number entry | DB sequence auto-generation | No duplicates, no gaps in numbering |
| Client-side soft delete | SECURITY DEFINER RPC | Bypasses RLS collision bug |
| React Hook Form | native form + `useActionState` | Consistent with all other Phase 1-3 forms |
| Server-side filtering | TanStack Table client-side filter | Sufficient for admin panel scale |

---

## Open Questions

1. **Should project_number sequence reset per year?**
   - What we know: Format `PR25XXXXXX` embeds the year at generation time. After sequence reaches `PR25999999` (1M projects) it would overflow — not a real concern for this use case.
   - What's unclear: Whether Sharon wants `PR26000001` to start fresh next year (aesthetic) or continue from where 2025 left off.
   - Recommendation: **Use a monotonically increasing sequence** (no reset). The year is embedded at creation — `PR25000001` created in 2025 will always be `PR25...`, not changed. New projects in 2026 would naturally get `PR26XXXXXX` because `to_char(CURRENT_DATE, 'YY')` reads the current year. This is the most operationally safe approach. If reset-per-year is desired, it requires a more complex function with a year-keyed counter table, which is premature.

2. **How many employees should the employee selector pre-load?**
   - What we know: Phase 2 implemented parallel-paginated fetching for large employee lists (1000+ rows).
   - What's unclear: Whether the project form needs all employees or just active ones.
   - Recommendation: **Fetch active employees only** (`status = 'active'`, `deleted_at IS NULL`). Project managers and coordinators should be active employees. If an archived employee is already assigned, show their name from the join (pre-populate selector from project data on edit).

3. **`EmployeeSearchDialog` reuse — `linkedEmployeeIds` parameter**
   - What we know: The dialog has a `linkedEmployeeIds` parameter to exclude already-linked employees (used in user management to prevent double-linking).
   - What's unclear: For projects, the same employee could be PM on multiple projects — so `linkedEmployeeIds` should be `[]` (empty) for project selectors.
   - Recommendation: Pass `linkedEmployeeIds={[]}` for all three project employee selectors. The field name is slightly misleading in this context but harmless.

---

## Sources

### Primary (HIGH confidence)
- Codebase — `src/actions/companies.ts` — Server Action CRUD pattern (verifySession → Zod → DB → audit → revalidate)
- Codebase — `src/components/admin/users/EmployeeSearchDialog.tsx` — employee selector pattern
- Codebase — `src/components/admin/employees/EmployeesTable.tsx` — TanStack Table with status filter
- Codebase — `src/lib/schemas.ts` — Zod schema pattern for entity forms
- Codebase — `supabase/migrations/00001_foundation_schema.sql` — confirmed `projects` table schema
- Codebase — `supabase/migrations/00007_soft_delete_rpc.sql` — SECURITY DEFINER soft-delete pattern
- Codebase — `supabase/migrations/00002_rls_policies.sql` — confirmed RLS policies exist for `projects`
- Codebase — `src/lib/dal.ts` — verifySession + auth guard pattern
- PostgreSQL official docs (current) — `CREATE SEQUENCE`, `nextval()`, `to_char()` — sequence functions

### Secondary (MEDIUM confidence)
- WebSearch: PostgreSQL auto-generate formatted sequential IDs — confirmed sequence + LPAD + to_char approach matches official PostgreSQL docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new decisions
- Architecture: HIGH — all patterns exist in codebase, verified by reading source
- Auto-number generation: HIGH — PostgreSQL SEQUENCE is standard; pattern matches existing RPC approach in codebase
- Employee selector reuse: HIGH — EmployeeSearchDialog source read directly
- Pitfalls: HIGH — documented from prior phase migrations and MEMORY.md

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (30 days — stable stack, no fast-moving dependencies)
