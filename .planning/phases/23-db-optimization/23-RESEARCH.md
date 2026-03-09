# Phase 23: DB Optimization - Research

**Researched:** 2026-03-09
**Domain:** PostgreSQL / Supabase RPC aggregations, composite indexes, React.cache(), save button loading states
**Confidence:** HIGH — all findings verified against actual codebase code

---

## Summary

Phase 23 מטפל בשלושה אזורים נפרדים: (1) אופטימיזציית DB queries לדשבורד ולדפים כבדים, (2) הוספת indexes ל-DB עבור patterns נפוצים, ו-(3) אחידות UX של כפתורי שמירה. המודל הקיים מתוך מודול הדלק (migration 00036) הוא ה-reference מושלם — RPC אגרגטיבי + VIEW + composite indexes + React.cache(). כל הפתרונות בפאזה זו מיישמים אותו pattern.

מחקר הקוד הקיים מגלה ש-**הדשבורד** מבצע 7+ queries מקביליים + resolving נפרד של entity names — סה"כ יכול להגיע ל-15+ queries per request. **כרטיס הרכב** מבצע 7 queries מקבילים בטעינה ראשונית — כולם server actions נפרדים. **רשימת הנהגים** מחשבת computedStatus ב-JS ולא ב-DB.

ממצא חשוב: **רוב כפתורי השמירה כבר מיושמים** עם `useTransition` + `isPending` + `Loader2`. החריגים הם בעיקר VehicleSuppliersPage שמשתמש ב-`loading` state רגיל ולא ב-useTransition. אין צורך ב-sweep גורף — רק לזהות ולתקן את החסרים.

**Primary recommendation:** עקוב אחר pattern של migration 00036 — create RPC for aggregation, create VIEW for enrichment, add composite indexes for filter patterns, apply React.cache() to shared read actions.

---

## Standard Stack

### Core (existing — no new installations needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase PostgreSQL | Supabase managed | RPC functions + views + indexes | Platform standard |
| `react` | 18.x | `React.cache()` for Server Component deduplication | Built-in, no install |
| `supabase-js` | 2.x | `.rpc()` for calling PostgreSQL functions | Platform standard |
| `next/cache` | Next.js 15 | `revalidatePath` after mutations | Built-in |

### No New Packages Required
This phase is purely DB + patterns — zero npm installs needed.

---

## Architecture Patterns

### Pattern 1: RPC אגרגטיבי (Dashboard Stats)
**What:** PostgreSQL function that returns multiple aggregate counts in a single query
**When to use:** Dashboard-style pages that need counts/sums across multiple tables
**Reference implementation:** `get_fuel_stats()` in migration 00036

```sql
-- Source: supabase/migrations/00036_fuel_performance.sql (verified in codebase)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
  employees_count    BIGINT,
  projects_count     BIGINT,
  users_count        BIGINT,
  companies_count    BIGINT,
  departments_count  BIGINT,
  role_tags_count    BIGINT,
  vehicles_count     BIGINT,
  active_drivers_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.employees WHERE deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.projects WHERE deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.users WHERE deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.companies WHERE deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.departments WHERE deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.role_tags WHERE deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.vehicles WHERE deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.drivers WHERE deleted_at IS NULL)::BIGINT
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats TO authenticated, anon, service_role;
```

**Calling from server action:**
```typescript
// Source: pattern from src/actions/fleet/fuel.ts (getFuelStats)
const { data } = await supabase.rpc('get_dashboard_stats')
const stats = data?.[0] ?? { employees_count: 0, ... }
```

**Important:** dashboard activity feed (audit_log + entity name resolution) does NOT move to RPC — it requires dynamic entity lookups. Only the stat counts move to RPC.

### Pattern 2: React.cache() לדדופליקציה
**What:** Wraps a server action so it executes at most once per render pass
**When to use:** Actions called from multiple Server Components in the same request
**Reference implementation:** `getProjectsForFuelFilter` in `src/actions/fleet/fuel.ts`

```typescript
// Source: src/actions/fleet/fuel.ts (verified in codebase)
import { cache } from 'react'

export const getProjectsForFuelFilter = cache(async (): Promise<ProjectOptionForFilter[]> => {
  await verifyAppUser()
  const supabase = await createClient()
  // ... query
})
```

**Rule:** Use `cache()` only on READ actions (selects). Never on mutations (insert/update/delete).
**Scope:** React.cache() deduplicates within a single request — NOT across requests. This is different from Next.js `unstable_cache`.

### Pattern 3: Composite Indexes לפי Filter Patterns
**What:** Multi-column indexes that match common WHERE clause + ORDER BY combinations
**When to use:** Tables filtered by multiple columns together (status + deleted_at, date + supplier, etc.)
**Reference implementation:** migration 00036

```sql
-- Source: supabase/migrations/00036_fuel_performance.sql (verified)
-- Pattern: put the most selective filter first, then secondary filters
CREATE INDEX IF NOT EXISTS fuel_records_date_supplier_type_idx
  ON public.fuel_records (fueling_date DESC, fuel_supplier, fuel_type, vehicle_id);

-- Pattern: always include deleted_at for soft-delete tables
-- WHERE deleted_at IS NULL patterns benefit from partial indexes:
CREATE INDEX IF NOT EXISTS vehicles_active_status_idx
  ON public.vehicles (status, deleted_at)
  WHERE deleted_at IS NULL;
```

### Pattern 4: Save Button Loading State
**What:** useTransition + isPending + Loader2 + disabled button
**When to use:** Any button that triggers an async server action
**Reference implementation:** VehicleDetailsSection.tsx, VehicleContractSection.tsx (verified in codebase)

```typescript
// Source: src/components/app/fleet/vehicles/VehicleDetailsSection.tsx (verified)
const [isSaving, startSaveTransition] = useTransition()

function handleSave() {
  startSaveTransition(async () => {
    const result = await updateVehicleDetails(id, data)
    if (result.success) toast.success('נשמר בהצלחה')
    else toast.error(result.error ?? 'שגיאה בשמירה')
  })
}

// In JSX:
<Button
  onClick={handleSave}
  disabled={isSaving || !isDirty}
>
  {isSaving ? (
    <>
      <Loader2 className="h-4 w-4 ms-2 animate-spin" />
      שומר...
    </>
  ) : (
    <>
      <Save className="h-4 w-4 ms-2" />
      שמור שינויים
    </>
  )}
</Button>
```

### Recommended Migration Structure
```
supabase/migrations/
└── 00037_db_optimization.sql   # כל האופטימיזציות ב-migration אחד
    ├── -- 1. get_dashboard_stats() RPC
    ├── -- 2. vehicle card indexes (if needed)
    ├── -- 3. driver list indexes
    └── -- 4. admin table composite indexes
```

---

## Codebase Analysis — Current State

### Dashboard (src/app/(admin)/admin/dashboard/page.tsx)
**Problem:** 7 parallel COUNT queries + 2-step audit log resolution (up to 8+ additional queries for entity names)
**Opportunity:** Move 7 COUNT queries into `get_dashboard_stats()` RPC = 1 query
**Cannot move to RPC:** Activity feed entity name resolution (dynamic, per-entity-type lookups)
**Impact:** HIGH — eliminates 6 extra round-trips on every dashboard load

### Vehicle Card (src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx)
**Current:** 7 parallel server actions + 1 companies query = 8 queries total
```
getVehicleById, getVehicleTests, getVehicleInsurance,
getVehicleDocuments, getVehicleDriverJournal,
getVehicleProjectJournal, getVehicleMonthlyCosts
+ companies query
```
**Already parallel:** `Promise.all()` — good
**Existing indexes:** vehicle_tests_vehicle_id_idx, vehicle_insurance_vehicle_id_idx, vehicle_driver_journal_vehicle_active_idx ✓
**Opportunity:** Verify `vehicle_documents_vehicle_id_idx` exists; check if `vehicle_costs` table has indexes
**Impact:** MEDIUM — already parallelized, needs index verification not major restructure

### Driver List (src/app/(app)/app/fleet/driver-card/page.tsx)
**Current:** `getDriversList()` does single query with nested select (drivers + employees + licenses + documents)
**Problem:** computedStatus computed in JS (checks `emp.status` + `emp.deleted_at` + flags) — not in DB
**driver_computed_status view:** EXISTS in migration 00018 but NOT USED by `getDriversList()`
**Opportunity:** Add index on `drivers(deleted_at, created_at)` and `employees(status, deleted_at)` for the JOIN
**Impact:** LOW-MEDIUM — query is already one query, just needs indexes

### Existing Indexes Summary (verified from migrations)
Already exist:
- `vehicles_company_id_idx`, `vehicles_assigned_driver_id_idx`
- `vehicle_tests_vehicle_id_idx`, `vehicle_tests_expiry_date_idx`
- `vehicle_insurance_vehicle_id_idx`, `vehicle_insurance_expiry_date_idx`
- `vehicle_driver_journal_vehicle_active_idx`, `vehicle_project_journal_vehicle_active_idx`
- `vehicle_driver_journal_vehicle_dates_idx`, `vehicle_project_journal_vehicle_dates_idx` (00036)
- `idx_audit_log_user`, `idx_audit_log_entity`, `idx_audit_log_date` (00001)
- `fuel_records_date_supplier_type_idx` (00036)

**Missing / candidates for 00037:**
- `drivers(deleted_at)` partial index — for active-only filter
- `employees(status, deleted_at)` composite — for JOIN in driver list
- `vehicles(deleted_at, status)` partial — for active vehicle filter
- `projects(deleted_at, status)` — for project filter dropdowns
- `users(deleted_at)` — for users list

### Save Button Loading States — Current Coverage
**Already implemented (useTransition + isPending + Loader2):**
- VehicleDetailsSection ✓ (`isSaving` + `Loader2`)
- VehicleContractSection ✓ (`isPending` + `Loader2`)
- VehiclePermitsSection ✓ (`isSaving` + `Loader2`)
- VehicleNotesSection ✓ (`isSaving` + `Loader2`)
- VehicleInsuranceSection ✓ (`isAdding`/`isSaving` + `Loader2`)
- VehicleTestsSection ✓ (`isAdding`/`isSaving` + `Loader2`)
- VehicleDocumentsSection ✓ (`isAdding`/`isSaving` + `Loader2`)
- VehicleAssignmentSection ✓ (multiple transitions)
- VehicleOwnershipJournal ✓
- DriverCard ✓ (`isSaving` + `Loader2`)
- CompanyForm ✓ (useActionState isPending)
- DepartmentForm ✓ (useActionState isPending)
- EmployeeForm ✓ (useActionState isPending)
- ProjectForm ✓ (useActionState isPending)
- UserEditDialog ✓
- All Settings forms ✓ (FleetSettings, SmsSettings, etc.)

**Needs check / may be missing:**
- VehicleSuppliersPage — uses `loading` state (useState), NOT useTransition — pattern mismatch
- AuditLogTable pagination buttons — uses useTransition ✓ but verify spinner visible

**Conclusion:** Coverage is ~90%+. Plan 23-03 should audit remaining forms rather than assume widespread gaps.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aggregating counts across tables | JS Promise.all + manual count | PostgreSQL FUNCTION with subquery COUNTs | Single round-trip to DB instead of N queries |
| Deduplicating server action calls | Manual memoization / global cache | `React.cache()` from 'react' | Scoped to request, automatic, built-in |
| Filtering on computed columns | JS filter post-fetch | Partial index + WHERE clause in query | Index makes it O(log n) not O(n) |
| Loading state during save | setTimeout or custom flag | `useTransition` + `isPending` | React-native, automatic, abort-safe |

**Key insight:** The fuel module already solved all these problems correctly. Phase 23 is about applying the same solutions to dashboard + driver list, not inventing new patterns.

---

## Common Pitfalls

### Pitfall 1: RPC Security — SECURITY INVOKER vs SECURITY DEFINER
**What goes wrong:** Using `SECURITY DEFINER` on a read-only stats RPC bypasses RLS — if the function queries a table with RLS, it will see ALL rows, not just the user's allowed rows.
**Why it happens:** SECURITY DEFINER runs as function owner (postgres), not the calling user.
**How to avoid:** Use `SECURITY INVOKER` for read RPCs (like `get_fuel_stats`). Only use `SECURITY DEFINER` for soft-delete RPCs that need to bypass RLS on UPDATE.
**Warning signs:** RPC returns counts higher than expected for the authenticated user.

```sql
-- Correct for stats RPC:
LANGUAGE sql STABLE SECURITY INVOKER AS $$ ... $$;
```

### Pitfall 2: React.cache() Scope Misunderstanding
**What goes wrong:** Assuming React.cache() caches across requests (like Redis). It ONLY deduplicates within a single render pass.
**Why it happens:** Name suggests persistent caching, but it's per-request memoization.
**How to avoid:** Use `cache()` for deduplication (same action called from multiple Server Components), not for performance across users. For cross-request caching, use Next.js `unstable_cache`.
**Warning signs:** Expecting cache hits across page navigations.

### Pitfall 3: Index on VIEW columns
**What goes wrong:** Trying to CREATE INDEX on a VIEW (driver_computed_status) — PostgreSQL does not allow indexing views.
**Why it happens:** Thinking of the view as a table.
**How to avoid:** Index the UNDERLYING TABLE columns instead. For `driver_computed_status`, add indexes on `drivers(deleted_at)` and `employees(status, deleted_at)`.
**Warning signs:** `ERROR: cannot index a view`

### Pitfall 4: Missing GRANT on new RPC
**What goes wrong:** RPC created but not callable from Supabase client — returns permission denied.
**Why it happens:** New functions default to EXECUTE for creator only.
**How to avoid:** Always add GRANT after every CREATE FUNCTION:
```sql
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats TO authenticated, anon, service_role;
```
**Warning signs:** `.rpc('get_dashboard_stats')` returns 403 or empty error.

### Pitfall 5: Dashboard Activity Feed — Cannot Move to Single RPC
**What goes wrong:** Trying to put audit_log entity name resolution inside the stats RPC.
**Why it happens:** Seems natural to consolidate all dashboard queries.
**How to avoid:** The entity name resolution requires dynamic lookups per entity_type (employees, companies, projects, etc.). This pattern cannot be expressed as a single parameterized RPC without dynamic SQL. Keep it as-is in the page component.
**Warning signs:** RPC becomes impossibly complex with CASE/dynamic table references.

### Pitfall 6: useTransition wrapper around async action
**What goes wrong:** Calling async server action inside `startTransition` without wrapping in async function.
**Why it happens:** startTransition callback must be synchronous OR the async must be explicit.
**How to avoid:** Always use `startTransition(async () => { await action() })` pattern — which is supported in React 18.3+.

```typescript
// WRONG:
startTransition(() => updateVehicleDetails(id, data))  // returns promise, not handled

// CORRECT:
startTransition(async () => {
  const result = await updateVehicleDetails(id, data)
  if (result.success) toast.success('נשמר')
})
```

---

## Code Examples

### RPC Call Pattern (verified from fuel.ts)
```typescript
// Source: src/actions/fleet/fuel.ts — getFuelStats()
export async function getDashboardStats() {
  await verifySession()  // admin guard
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_dashboard_stats')
  if (error) {
    console.error('[Dashboard] stats RPC error:', error.message)
    return null
  }
  return data?.[0] ?? null
}
```

### Dashboard Page Refactor Pattern
```typescript
// Source: pattern from src/app/(admin)/admin/dashboard/page.tsx (current)
// BEFORE: 7 separate queries
const [employeeRes, projectRes, ...] = await Promise.all([...7 queries...])

// AFTER: 1 RPC + audit log queries remain separate
const [statsResult, activityRes] = await Promise.all([
  supabase.rpc('get_dashboard_stats'),
  supabase.from('audit_log').select('...').order(...).limit(20),
])
const stats = statsResult.data?.[0] ?? defaultStats
```

### Composite Index Pattern (verified from migration 00036)
```sql
-- Source: supabase/migrations/00036_fuel_performance.sql
-- For soft-delete tables with status filter:
CREATE INDEX IF NOT EXISTS drivers_active_idx
  ON public.drivers (deleted_at, created_at DESC)
  WHERE deleted_at IS NULL;

-- For employee status + soft-delete (JOIN optimization):
CREATE INDEX IF NOT EXISTS employees_status_active_idx
  ON public.employees (status, deleted_at)
  WHERE deleted_at IS NULL AND status = 'active';
```

### React.cache() Pattern (verified from fuel.ts)
```typescript
// Source: src/actions/fleet/fuel.ts
import { cache } from 'react'

// Wrap read-only actions that might be called from multiple Server Components
export const getCompaniesForFilter = cache(async () => {
  await verifySession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('companies')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')
  return data ?? []
})
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| N parallel COUNT queries from page | Single RPC with subquery COUNTs | N→1 round-trips |
| JS-side aggregation on large arrays | DB-side SUM/COUNT in RPC | No data transfer overhead |
| Raw query per page | VIEW + LATERAL JOIN in DB | Single query with enrichment |
| Multiple calls to same action | `React.cache()` wrapper | Automatic dedup per request |
| `useState(false)` for loading | `useTransition` + `isPending` | React-native, abort-safe |

---

## Plan Scope — Per Sub-Plan

### 23-01: Dashboard RPC
**Migration creates:** `get_dashboard_stats()` function
**Server action:** New `getDashboardStats()` in `src/actions/admin/dashboard.ts` (or inline in page)
**Page refactor:** `dashboard/page.tsx` — replace 7 COUNT queries with single `.rpc('get_dashboard_stats')` call
**Keep as-is:** Audit log activity feed (entity name resolution stays in page)
**Estimated complexity:** LOW — clear pattern, no structural changes

### 23-02: Vehicle Card + Driver List Indexes
**Migration creates:** Composite indexes on drivers, employees, vehicles, projects, users
**Vehicle card:** Verify existing indexes cover all 7 queries — likely already covered by 00025/00027
**Driver list:** Add missing index on `drivers(deleted_at, created_at)` and `employees(status, deleted_at)`
**No code changes expected** — pure DB migration
**Estimated complexity:** LOW — SQL only, no TypeScript changes

### 23-03: React.cache() Audit + Save Button Loading States
**React.cache():** Identify server actions called from multiple places in same request — candidates:
- Dashboard: no shared actions (page is monolithic)
- Vehicle card page: 7 separate actions all called once — low benefit
- Admin pages: `getCompaniesForFilter` if called from multiple components
**Save buttons:** VehicleSuppliersPage `loading` state → migrate to `useTransition`; audit remaining forms
**Estimated complexity:** MEDIUM — requires component-by-component audit

---

## Open Questions

1. **Dashboard RPC — should activity feed move to RPC too?**
   - What we know: Entity name resolution requires dynamic table lookups per entity_type
   - What's unclear: Could a materialized view or JOIN-based approach replace the JS resolution?
   - Recommendation: Keep activity feed in TypeScript. The dynamic nature makes DB-side resolution complex and fragile. The 7 COUNT queries are the real bottleneck.

2. **Vehicle card — is there a compound query opportunity?**
   - What we know: 7 parallel queries with Promise.all() — already fast
   - What's unclear: Would a single RPC returning all vehicle data be faster than 7 parallel queries?
   - Recommendation: Out of scope for phase 23. The parallel approach is already correct. Only add indexes if EXPLAIN shows sequential scans.

3. **React.cache() — which actions are actually called multiple times?**
   - What we know: `getProjectsForFuelFilter` was the original use case
   - What's unclear: Are there Admin page Server Components that call the same action multiple times in a render pass?
   - Recommendation: Do a grep during 23-03 execution: `grep -rn "getCompanies\|getProjects\|getDepartments" src/app --include="*.tsx"` to find duplicates.

---

## Sources

### Primary (HIGH confidence)
- `src/app/(admin)/admin/dashboard/page.tsx` — direct codebase reading, 224 lines analyzed
- `src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx` — verified 7 parallel queries
- `src/app/(app)/app/fleet/driver-card/page.tsx` — verified getDriversList pattern
- `src/actions/fleet/drivers.ts` — full analysis, computedStatus JS logic confirmed
- `src/actions/fleet/fuel.ts` — React.cache() usage verified
- `supabase/migrations/00036_fuel_performance.sql` — RPC + VIEW + index patterns verified
- `supabase/migrations/00001_foundation_schema.sql` — existing audit_log indexes confirmed
- `supabase/migrations/00025_fleet_vehicles.sql` — vehicle indexes confirmed
- `supabase/migrations/00027_vehicle_card_redesign.sql` — journal indexes confirmed
- `src/components/app/fleet/vehicles/*.tsx` — all 8 tab components verified for useTransition

### Secondary (MEDIUM confidence)
- React.cache() docs — deduplication behavior within render pass (standard React 18 behavior)
- PostgreSQL SECURITY INVOKER/DEFINER behavior — well-established PostgreSQL behavior

### Tertiary (LOW confidence)
- Exact performance numbers (query time reduction) — not measurable from static analysis alone

---

## Metadata

**Confidence breakdown:**
- Dashboard RPC pattern: HIGH — direct code analysis, clear parallel with fuel module
- Vehicle card indexes: HIGH — existing indexes visible in migrations, gaps identified
- Driver list: HIGH — single query confirmed, computedStatus in JS confirmed
- React.cache() candidates: MEDIUM — requires runtime analysis to confirm duplication
- Save button coverage: HIGH — component-by-component grep performed

**Research date:** 2026-03-09
**Valid until:** 2026-06-09 (stable domain — Supabase RPC + Next.js patterns are stable)
