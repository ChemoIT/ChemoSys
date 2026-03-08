# Phase 18: Vehicle Card Redesign — Ownership Tab + Licensing & Insurance Tab — Research

**Researched:** 2026-03-08
**Domain:** React component architecture, Supabase activity journal pattern, PDF upload, tab restructuring
**Confidence:** HIGH (all patterns verified from existing codebase — no external research needed)

---

## Summary

Phase 18 implements two new VehicleCard tabs on top of the already-complete DB migration (00027). The codebase patterns are mature and fully established — this phase is primarily a **component authoring + tab restructuring** effort, not a new architecture design.

**Tab 2 (בעלות)** is a new tab with three categories of fields: simple dropdowns/text saved via `updateVehicleDetails` (ownership_type, ownership_supplier_id, contract_number, vehicle_group), a contract PDF upload using the existing `fleet-vehicle-documents` bucket and `FleetUploadZone` pattern, and the Activity Journal for `vehicle_monthly_costs`.

**Tab 3 (רישוי וביטוח)** merges existing `VehicleTestsSection` (Tab 2 "טסטים") and `VehicleInsuranceSection` (Tab 3 "ביטוח") into one tab. The existing components are reused unchanged — only the tab container in `VehicleCard.tsx` is modified. The two sections are rendered inside a single `TabsContent` wrapper, separated by a visual divider.

The tab restructuring changes the array from 8 tabs to 7 tabs: remove "עלויות" (value: `costs`), rename "טסטים" + "ביטוח" → merged "רישוי וביטוח" (value: `licensing`), and add new "בעלות" (value: `ownership`).

**Primary recommendation:** Author three new files (`VehicleOwnershipSection.tsx`, `VehicleOwnershipJournal.tsx`, `vehicle-ownership.ts`) and modify `VehicleCard.tsx` + `vehicle-types.ts`. Do not modify `VehicleTestsSection.tsx` or `VehicleInsuranceSection.tsx` — they slot directly into the merged tab.

---

## Standard Stack

### Core (no new libraries)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React useState / useTransition / useEffect | existing | Form + async state | Project-wide pattern |
| Supabase browser client | existing | Storage upload (client-side) | `@/lib/supabase/browser` |
| Supabase server client | existing | DB mutations (Server Actions) | `@/lib/supabase/server` |
| sonner toast | existing | Success/error feedback | Already in root layout |
| shadcn/ui Button, Label | existing | Form controls | Design system |
| lucide-react | existing | Icons | Fleet icon set |

### Shared Fleet Components (all already built)

| Component | Location | Use in Phase 18 |
|-----------|----------|-----------------|
| `FleetUploadZone` | `fleet/shared/` | Contract PDF upload in ownership tab |
| `FleetDateInput` | `fleet/shared/` | Start/end dates in monthly cost journal |
| `AlertToggle` | `fleet/shared/` | Not used in Phase 18 (no alerts in ownership) |
| `ExpiryIndicator` | `fleet/shared/` | Not used in Phase 18 |

### No new npm packages required.

---

## DB Schema (verified from migration 00027)

### vehicles table — new ownership columns

```sql
-- All added via ADD COLUMN IF NOT EXISTS in 00027
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS ownership_supplier_id UUID REFERENCES public.vehicle_suppliers(id),
  ADD COLUMN IF NOT EXISTS contract_number        TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_group          INT;  -- CHECK (BETWEEN 1 AND 7)

-- ownership_type already existed from 00025, constraint updated in 00027:
-- CHECK (ownership_type IN ('company','rental','operational_leasing','mini_leasing'))
```

**Current VehicleFull type** (vehicle-types.ts) already has `ownershipType` mapped. Missing fields that must be added to the type: `ownershipSupplierId`, `contractNumber`, `vehicleGroup`, `vehicleStatus`, `fleetExitDate`.

### vehicle_monthly_costs table (Activity Journal pattern)

```sql
CREATE TABLE IF NOT EXISTS public.vehicle_monthly_costs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  start_date  DATE        NOT NULL,
  end_date    DATE,                   -- NULL = currently active rate
  amount      NUMERIC     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES auth.users(id),
  updated_by  UUID        REFERENCES auth.users(id)
);
-- updated_at trigger: vehicle_monthly_costs_updated_at (already created in 00027)
-- RLS: SELECT/INSERT/UPDATE policies for 'authenticated' role (no soft-delete, no hard-delete)
```

**Key characteristics:**
- No `deleted_at` — cost history is a permanent financial audit trail
- No hard DELETE allowed (no RLS DELETE policy)
- `end_date IS NULL` = currently active rate
- Business rule: when adding a new rate, close the previous record (set end_date) then INSERT new row
- This is the same Activity Journal pattern as `vehicle_driver_journal` and `vehicle_project_journal`

### vehicle_suppliers — ownership type

```sql
-- supplier_type CHECK updated in 00027 to include 'ownership'
CHECK (supplier_type IN ('leasing','insurance','fuel_card','garage','other','ownership'))
```

Query for ownership suppliers: `getActiveSuppliersByType('ownership')` — **already exists** in `vehicles.ts`.

---

## Architecture Patterns

### Pattern 1: Activity Journal for vehicle_monthly_costs

The Activity Journal pattern manages date-ranged records where each entry has a `start_date` and optionally an `end_date`. When a new rate is added, the previous active record's `end_date` is set to today (or a chosen date), then a new record is inserted.

**No chemo-activity-journal skill found in the codebase.** The pattern is defined by convention from the Phase 16 research and requirements. Implementation is custom per use case.

**Monthly costs journal UX:**

```
┌─────────────────────────────────────────────────┐
│ עלות חודשית                                     │
│                                                   │
│ עלות נוכחית: ₪2,500/חודש                       │
│ מ-01/01/2025 (פעיל)                             │
│                                                   │
│ היסטוריה:                                       │
│ ₪2,000 — 01/06/2024 עד 31/12/2024              │
│ ₪1,800 — 01/01/2024 עד 31/05/2024              │
│                                                   │
│ [+ הוסף שינוי עלות]                            │
└─────────────────────────────────────────────────┘
```

**Add flow:** User clicks "+ הוסף שינוי עלות" → inline form appears → user enters amount + start_date (end_date optional) → Server Action: (1) UPDATE prev active record SET end_date = new start_date - 1 day, (2) INSERT new record.

**Server actions needed:**
- `getVehicleMonthlyCosts(vehicleId)` — SELECT all, ORDER BY start_date DESC
- `addVehicleMonthlyCost({ vehicleId, startDate, endDate, amount })` — INSERT + close previous
- `updateVehicleMonthlyCost({ costId, vehicleId, startDate, endDate, amount })` — direct UPDATE (no RPC needed — no soft-delete, no RLS SELECT filter)
- No delete action — cost history is immutable (per requirements: "financial audit trail")

**Why no RPC for UPDATE:** The `vehicle_monthly_costs` SELECT RLS is `USING (true)` — not filtered by `deleted_at IS NULL`. So direct `.update()` works without the SECURITY DEFINER workaround needed for soft-delete tables.

### Pattern 2: Ownership Tab Simple Fields

Three fields (ownership_type, ownership_supplier_id, contract_number, vehicle_group) are simple scalar updates to the `vehicles` table. They go through **`updateVehicleDetails`** (already exists in `vehicles.ts`) extended with the new fields.

```typescript
// Extend existing UpdateVehicleInput in vehicles.ts:
export type UpdateVehicleInput = {
  vehicleId: string
  // ... existing fields ...
  ownershipSupplierId?: string | null  // NEW
  contractNumber?: string | null        // NEW
  vehicleGroup?: number | null          // NEW
  vehicleStatus?: string | null         // NEW
  fleetExitDate?: string | null         // NEW
}
```

**Why extend existing action vs. new action:** All are simple UPDATE on vehicles table. No reason to split. `updateVehicleDetails` is the single source of truth for vehicles operational fields.

### Pattern 3: Contract PDF Upload

Follows the exact pattern from `VehicleInsuranceSection` and `VehicleTestsSection`:
- **Bucket:** `fleet-vehicle-documents` (already exists, private)
- **File naming:** `{vehicleId}_contract_{crypto.randomUUID()}.{ext}`
- **Client-side upload:** `createBrowserClient().storage.from('fleet-vehicle-documents').upload()`
- **Signed URL:** `createSignedUrl(fileName, 31_536_000)` (1 year)
- The signed URL is stored in `vehicles.contract_file_url` — but WAIT: this column does NOT exist in migration 00027.

**CRITICAL GAP:** Migration 00027 adds `contract_number` TEXT but does NOT add `contract_file_url`. The requirements doc says "העלאת חוזה PDF — עם preview". A new migration (00029) is required to add this column, OR the planner must decide to store the contract URL in `vehicle_monthly_costs` or skip PDF for now.

**Recommendation for planner:** Add `contract_file_url TEXT` to `vehicles` via migration 00029 (small single-column ALTER TABLE). This is the cleanest approach consistent with how other file fields work in this project.

### Pattern 4: Merged Tab — רישוי וביטוח

The merged tab combines two existing section components side by side (or stacked with a divider). No code changes to `VehicleTestsSection` or `VehicleInsuranceSection` themselves.

**VehicleCard.tsx changes:**

```typescript
// BEFORE (8 tabs):
{ value: 'details',    label: 'פרטי הרכב',  icon: Car },
{ value: 'tests',      label: 'טסטים',      icon: ClipboardCheck },
{ value: 'insurance',  label: 'ביטוח',      icon: Shield },
{ value: 'assignment', label: 'שיוך נהג',   icon: User },
{ value: 'costs',      label: 'עלויות',     icon: DollarSign },
{ value: 'documents',  label: 'מסמכים',     icon: Paperclip },
{ value: 'notes',      label: 'הערות',      icon: FileText },
{ value: 'km',         label: 'ק"מ',         icon: Gauge },

// AFTER (7 tabs):
{ value: 'details',    label: 'פרטי הרכב',      icon: Car },
{ value: 'ownership',  label: 'בעלות',           icon: Building2 },   // NEW
{ value: 'licensing',  label: 'רישוי וביטוח',   icon: ShieldCheck }, // MERGED (was tests + insurance)
{ value: 'assignment', label: 'צמידות',          icon: User },        // renamed from שיוך נהג
{ value: 'documents',  label: 'מסמכים',          icon: Paperclip },
{ value: 'notes',      label: 'הערות',           icon: FileText },
{ value: 'km',         label: 'ק"מ',              icon: Gauge },
// REMOVED: costs (עלויות) — merged into ownership tab
```

**Dirty tracking additions for new tabs:**
```typescript
const onOwnershipEditingChange = useCallback((dirty: boolean) => {
  dirtyStates.current.ownership = dirty
}, [])
const onLicensingEditingChange = useCallback((dirty: boolean) => {
  dirtyStates.current.licensing = dirty
}, [])
```

**TAB_LABELS update:** Remove `tests`, `insurance`, `costs`. Add `ownership`, `licensing`. Rename `assignment` label to `צמידות`.

### Pattern 5: Merged Tab Content Structure

```tsx
{/* Tab 3 — רישוי וביטוח ══════════════════════════════ */}
<TabsContent value="licensing" className="mt-0">
  <div dir="rtl" className="bg-white border-x border-b rounded-b-2xl p-5 space-y-8"
    style={{ borderColor: '#E2EBF4' }}>

    {/* Section: רישוי (was Tab 2 — VehicleTestsSection) */}
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4" />
        רישוי (טסטים)
      </h2>
      <VehicleTestsSection ... onEditingChange={...} />
    </div>

    {/* Divider */}
    <div className="border-t" style={{ borderColor: '#E2EBF4' }} />

    {/* Section: ביטוח (was Tab 3 — VehicleInsuranceSection) */}
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        ביטוח
      </h2>
      <VehicleInsuranceSection ... onEditingChange={...} />
    </div>
  </div>
</TabsContent>
```

**Dirty tracking for merged tab:** The merged tab has two child sections, each reporting dirty state via `onEditingChange`. The parent must OR them together:

```typescript
// In VehicleCard.tsx — use a single "licensing" key that covers both sub-sections
// Option: have VehicleLicensingSection wrap both and expose single onEditingChange
// OR: use two separate keys and check both in isCurrentTabDirty
```

**Recommended approach:** Create a thin wrapper `VehicleLicensingSection.tsx` that holds both sub-components and exposes a single `onEditingChange`. This keeps VehicleCard.tsx clean.

### Pattern 6: VehicleOwnershipSection Component Structure

```
VehicleOwnershipSection.tsx (client)
  ├── Simple fields (ownership_type, ownership_supplier_id, contract_number, vehicle_group)
  │   └── Saved via updateVehicleDetails() Server Action
  │   └── Dirty tracking: compare current vs. original vehicle props
  ├── Contract PDF (FleetUploadZone pattern)
  │   └── Saved as part of updateVehicleDetails (contractFileUrl field)
  │   └── Upload: browser client → fleet-vehicle-documents bucket
  └── VehicleOwnershipJournal.tsx (sub-component)
      └── Monthly costs activity journal
      └── Uses getVehicleMonthlyCosts + addVehicleMonthlyCost Server Actions
```

### Recommended Project Structure

```
src/
├── actions/fleet/
│   ├── vehicles.ts              (MODIFIED: extend UpdateVehicleInput + updateVehicleDetails)
│   └── vehicle-ownership.ts     (NEW: monthly costs Server Actions)
│
├── components/app/fleet/vehicles/
│   ├── VehicleCard.tsx          (MODIFIED: tab array, dirty tracking, props)
│   ├── VehicleOwnershipSection.tsx  (NEW: Tab 2 — ownership fields + contract + journal)
│   ├── VehicleOwnershipJournal.tsx  (NEW: activity journal sub-component)
│   └── VehicleLicensingSection.tsx  (NEW: thin wrapper for merged Tab 3)
│
└── lib/fleet/
    └── vehicle-types.ts         (MODIFIED: VehicleFull + VehicleMonthlyCost types)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload zone | Custom drag-drop | `FleetUploadZone` (already built) | Drag, drop, camera, clear — all handled |
| Date inputs | Native `<input type="date">` | `FleetDateInput` (already built) | RTL, Hebrew, partial selection handling |
| Signed URL generation | Custom URL | `createSignedUrl(path, 31_536_000)` pattern | Already works in tests + insurance |
| Supplier dropdown | Custom fetch | `getActiveSuppliersByType('ownership')` | Already exists, returns `{id, name}[]` |
| Alert toggle | Custom switch | `AlertToggle` component | Already built with label prop |
| Toast notifications | Custom | `sonner` toast | Already in root layout |

---

## Common Pitfalls

### Pitfall 1: contract_file_url column missing from migration 00027

**What goes wrong:** Trying to store contract PDF URL in `vehicles` table will fail — column doesn't exist.
**Why it happens:** The requirements listed PDF upload but the column was overlooked in the migration.
**How to avoid:** Migration 00029 must add `contract_file_url TEXT` to vehicles (single ALTER TABLE IF NOT EXISTS). The planner must schedule this migration before Phase 18 execution.
**Warning signs:** TypeScript error or Supabase insert error when trying to set `contract_file_url`.

### Pitfall 2: Dirty tracking for merged licensing tab

**What goes wrong:** The unsaved changes dialog fires incorrectly (or not at all) because the merged tab uses two separate child dirty states.
**Why it happens:** The parent tracks one key per tab in `dirtyStates.current`. With two sections sharing one tab key, both must be checked.
**How to avoid:** Use `VehicleLicensingSection.tsx` wrapper that ORs the two dirty states into one `onEditingChange` callback. Then VehicleCard only sees one dirty key for `licensing`.

### Pitfall 3: ownership_type CHECK constraint values (old vs. new)

**What goes wrong:** Using old OWNERSHIP_TYPE_LABELS values (company_owned, leased, rented, employee_owned) in the new ownership tab dropdown.
**Why it happens:** `vehicle-types.ts` still has the old `OWNERSHIP_TYPE_LABELS` constant with wrong values.
**How to avoid:** Update `OWNERSHIP_TYPE_LABELS` in vehicle-types.ts to match the new CHECK constraint from 00027: `company | rental | operational_leasing | mini_leasing`. Also update `VEHICLE_TYPE_LABELS` to match `private | commercial | truck | trailer`.

### Pitfall 4: Activity journal — "add rate" must close previous active record

**What goes wrong:** Two active records exist simultaneously (end_date IS NULL on both), breaking the "one active rate" invariant.
**Why it happens:** Developer inserts new record without first closing the previous.
**How to avoid:** The `addVehicleMonthlyCost` Server Action must: (1) find existing record WHERE end_date IS NULL, (2) UPDATE it SET end_date = new_start_date - 1 day, (3) INSERT new record — all in one server-side sequence. No RPC needed (direct UPDATE works — no soft-delete RLS filter).

### Pitfall 5: getVehicleById does not include new ownership fields

**What goes wrong:** VehicleOwnershipSection receives vehicle prop without `ownershipSupplierId`, `contractNumber`, `vehicleGroup`, `contractFileUrl`.
**Why it happens:** `getVehicleById` in vehicles.ts does not SELECT the new columns, and `VehicleFull` type doesn't have the new fields.
**How to avoid:** Must update both `getVehicleById` (add to SELECT) and `VehicleFull` type before authoring VehicleOwnershipSection. This is the first task in the plan.

### Pitfall 6: Tab rename breaks URL/state if user bookmarks or directly navigates

**What goes wrong:** Changing tab values (e.g., `tests` → `licensing`) breaks any URL query param or state that referenced the old value names.
**Why it happens:** The VehicleCard uses controlled Tabs (value stored in useState), but if any link or external code references the old tab values, they break.
**How to avoid:** Check for any URL param usage of tab names. In current VehicleCard, tab state is `useState('details')` — no URL params used. Safe to rename.

### Pitfall 7: VehicleCostsSection removal — import/component must be deleted

**What goes wrong:** TypeScript still imports `VehicleCostsSection` after removing the tab.
**Why it happens:** Developer removes the tab from the array but leaves the import and component reference.
**How to avoid:** When removing the `costs` tab, also remove: the `TabsContent` block, the import statement, and the `VehicleCostsSection` component file itself (or mark it deprecated).

---

## Code Examples

### Monthly Costs Server Actions (vehicle-ownership.ts)

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifyAppUser } from '@/lib/dal'

export type VehicleMonthlyCost = {
  id: string
  vehicleId: string
  startDate: string      // yyyy-mm-dd
  endDate: string | null // null = currently active
  amount: number
  createdAt: string
}

export async function getVehicleMonthlyCosts(vehicleId: string): Promise<VehicleMonthlyCost[]> {
  await verifyAppUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicle_monthly_costs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    vehicleId: r.vehicle_id,
    startDate: r.start_date,
    endDate: r.end_date,
    amount: r.amount,
    createdAt: r.created_at,
  }))
}

export async function addVehicleMonthlyCost(input: {
  vehicleId: string
  startDate: string
  endDate?: string | null
  amount: number
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // 1. Close any currently-active rate (end_date IS NULL) for this vehicle
  await supabase
    .from('vehicle_monthly_costs')
    .update({ end_date: input.startDate, updated_by: userId })
    .eq('vehicle_id', input.vehicleId)
    .is('end_date', null)

  // 2. Insert new rate
  const { data, error } = await supabase
    .from('vehicle_monthly_costs')
    .insert({
      vehicle_id: input.vehicleId,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      amount: input.amount,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת עלות חודשית' }
  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true, id: data.id }
}
```

### getVehicleById — additions needed

```typescript
// Source: existing pattern in src/actions/fleet/vehicles.ts
// Add to SELECT in getVehicleById:
ownership_supplier_id,
contract_number,
contract_file_url,  // only after migration 00029 adds this column
vehicle_group,
vehicle_status,
fleet_exit_date,

// Add to return object:
ownershipSupplierId: data.ownership_supplier_id,
contractNumber: data.contract_number,
contractFileUrl: data.contract_file_url,
vehicleGroup: data.vehicle_group,
vehicleStatus: data.vehicle_status,
fleetExitDate: data.fleet_exit_date,
```

### Ownership type constants update (vehicle-types.ts)

```typescript
// Source: migration 00027 CHECK constraint
// Replace old OWNERSHIP_TYPE_LABELS:
export const OWNERSHIP_TYPE_LABELS: Record<string, string> = {
  company:             'בעלות חברה',
  rental:              'שכירות',
  operational_leasing: 'ליסינג תפעולי',
  mini_leasing:        'מיני ליסינג',
}

// Replace old VEHICLE_TYPE_LABELS:
export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  private:    'פרטי',
  commercial: 'מסחרי',
  truck:      'משאית',
  trailer:    'ניגרר',
}
```

### Contract PDF upload (client-side in VehicleOwnershipSection)

```typescript
// Source: identical pattern from VehicleInsuranceSection.tsx
import { createClient as createBrowserClient } from '@/lib/supabase/browser'

async function uploadContractFile(file: File): Promise<string | null> {
  const supabase = createBrowserClient()
  const ext = file.name.split('.').pop() ?? 'pdf'
  const fileName = `${vehicleId}_contract_${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('fleet-vehicle-documents')
    .upload(fileName, file, { upsert: true })
  if (error) return null
  const { data: signedData } = await supabase.storage
    .from('fleet-vehicle-documents')
    .createSignedUrl(fileName, 31_536_000)
  return signedData?.signedUrl ?? null
}
```

---

## Tab Restructuring Map

| Old Tab | Old Value | New Tab | New Value | Change |
|---------|-----------|---------|-----------|--------|
| פרטי הרכב | `details` | פרטי הרכב | `details` | Unchanged |
| טסטים | `tests` | (moved into Tab 3) | — | Removed as standalone |
| ביטוח | `insurance` | (moved into Tab 3) | — | Removed as standalone |
| שיוך נהג | `assignment` | צמידות | `assignment` | Label rename only |
| עלויות | `costs` | (removed) | — | Removed entirely |
| מסמכים | `documents` | מסמכים | `documents` | Unchanged |
| הערות | `notes` | הערות | `notes` | Unchanged |
| ק"מ | `km` | ק"מ | `km` | Unchanged |
| — (new) | — | בעלות | `ownership` | New — Tab 2 position |
| — (new) | — | רישוי וביטוח | `licensing` | New — Tab 3 position (merges old tests + insurance) |

**New order (7 tabs):** details → ownership → licensing → assignment → documents → notes → km

---

## VehicleFull Type — Required Updates

```typescript
// Add to VehicleFull in vehicle-types.ts:
export type VehicleFull = {
  // ... existing fields ...

  // Ownership tab fields (Phase 18)
  vehicleStatus: string          // 'active' | 'suspended' | 'returned' | 'sold' | 'decommissioned'
  fleetExitDate: string | null   // yyyy-mm-dd
  ownershipSupplierId: string | null
  ownershipSupplierName: string | null  // joined
  contractNumber: string | null
  contractFileUrl: string | null  // after migration 00029
  vehicleGroup: number | null     // 1-7
}

// New type for monthly costs:
export type VehicleMonthlyCost = {
  id: string
  vehicleId: string
  startDate: string      // yyyy-mm-dd
  endDate: string | null // null = currently active
  amount: number
  createdAt: string
}
```

---

## Server Actions — Complete List for Phase 18

### Actions to MODIFY (vehicles.ts)

| Action | Change |
|--------|--------|
| `UpdateVehicleInput` type | Add: `ownershipSupplierId`, `contractNumber`, `contractFileUrl`, `vehicleGroup`, `vehicleStatus`, `fleetExitDate` |
| `updateVehicleDetails()` | Add new fields to `.update()` call |
| `getVehicleById()` | Add new columns to SELECT + return mapping |

### Actions to CREATE (vehicle-ownership.ts — new file)

| Action | Purpose |
|--------|---------|
| `getVehicleMonthlyCosts(vehicleId)` | Load journal entries for ownership tab |
| `addVehicleMonthlyCost(input)` | Close previous active + insert new |
| `updateVehicleMonthlyCost(input)` | Edit existing cost record (direct UPDATE) |

### Actions NOT needed

| What | Why |
|------|-----|
| Delete monthly cost | Immutable financial audit trail (per requirements) |
| New ownership supplier action | `getActiveSuppliersByType('ownership')` already exists |
| New RPC for monthly cost UPDATE | Direct UPDATE works — no soft-delete RLS filter |

---

## Open Questions

1. **contract_file_url column missing from 00027**
   - What we know: migration 00027 does not include this column
   - What's unclear: Should it be in 00029 standalone migration, or can Phase 18 proceed without PDF upload (defer to later)?
   - Recommendation: Planner should create migration 00029 (`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS contract_file_url TEXT`) as the first task in Phase 18 Plan 1.

2. **Monthly cost UPDATE use case**
   - What we know: table allows UPDATE, no delete permitted
   - What's unclear: Does Sharon want to be able to edit an existing cost record after adding it, or only close + create new?
   - Recommendation: Include `updateVehicleMonthlyCost` action for correctness. UI shows edit button on each row.

3. **VehicleCard.tsx props — monthly costs**
   - What we know: VehicleCard page.tsx must load monthly costs server-side and pass to VehicleOwnershipSection
   - What's unclear: Whether to load in page.tsx (Server Component) or fetch client-side on mount
   - Recommendation: Load in page.tsx alongside tests/insurance/documents — consistent with existing pattern. Add `costs: VehicleMonthlyCost[]` to VehicleCard props.

4. **VehicleOwnershipSection dirty tracking scope**
   - What we know: Ownership tab has both simple fields (saved with Save button) and journal (saved inline per entry)
   - What's unclear: Should the dirty state cover only the simple fields, or also track open journal form?
   - Recommendation: Dirty state covers simple fields + contract PDF field. Journal entries save immediately (no pending state in parent).

---

## Sources

### Primary (HIGH confidence — direct codebase reading)

- `src/components/app/fleet/vehicles/VehicleCard.tsx` — tab structure, dirty tracking, dialog patterns
- `src/components/app/fleet/vehicles/VehicleInsuranceSection.tsx` — PDF upload pattern, supplier dropdown, alert toggle
- `src/components/app/fleet/vehicles/VehicleTestsSection.tsx` — test form pattern
- `src/actions/fleet/vehicles.ts` — existing Server Actions, getActiveSuppliersByType, updateVehicleDetails
- `src/lib/fleet/vehicle-types.ts` — VehicleFull type, constants
- `supabase/migrations/00027_vehicle_card_redesign.sql` — exact DB schema for all new columns/tables
- `.planning/vehicle-card-redesign-requirements.md` — Sharon's requirements specification

### No external research required

All patterns exist in the codebase. No new libraries, no API integrations, no unfamiliar patterns.

---

## Metadata

**Confidence breakdown:**
- DB schema: HIGH — read directly from migration 00027
- Existing component patterns: HIGH — read all relevant source files
- Activity journal pattern: HIGH — verified from migration + requirements; simple custom implementation
- Tab restructuring: HIGH — VehicleCard.tsx fully read and understood
- contract_file_url gap: HIGH — confirmed missing by reading migration 00027

**Research date:** 2026-03-08
**Valid until:** 2026-06-08 (stable codebase — no external dependencies)
