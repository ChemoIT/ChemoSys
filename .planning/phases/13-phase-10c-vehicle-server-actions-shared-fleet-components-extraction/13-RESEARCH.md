# Phase 13: Vehicle Server Actions + Shared Fleet Components Extraction — Research

**Researched:** 2026-03-07
**Domain:** Next.js 16 Server Actions + Supabase CRUD patterns + React component extraction
**Confidence:** HIGH — research is based entirely on existing project codebase (drivers.ts, migration 00025, supplier-types.ts pattern). No external library research required.

---

## Summary

Phase 13 has two distinct deliverables that must be built in order:

1. **Vehicle Server Actions** (`src/actions/fleet/vehicles.ts`) — a full CRUD file mirroring `drivers.ts`, covering the `vehicles`, `vehicle_tests`, `vehicle_insurance`, `vehicle_documents`, and `vehicle_document_names` tables. Every function that the vehicle card UI (Phases 14–15) will need must be here before those phases start.

2. **Shared Fleet Component Extraction** — identify reusable sub-components in the existing driver card that can be shared with the vehicle card without copy-paste, then move them to `src/components/app/fleet/shared/`. Key candidates: `FleetDateInput`, `FitnessLight` (with a vehicle-variant), `AlertToggle`, `ExpiryIndicator`, `UploadZone`/`FilePreview`, and the document-name autocomplete pattern.

The database (migration 00025) and all RPCs (`soft_delete_vehicle`, `soft_delete_vehicle_document`, `soft_delete_vehicle_test`, `soft_delete_vehicle_insurance`, `update_vehicle_document`, `update_vehicle_test`, `update_vehicle_insurance`, `increment_vehicle_document_name_usage`) are already in place. Phase 13 is purely TypeScript — zero migrations required.

**Primary recommendation:** Build `vehicles.ts` first (following `drivers.ts` exactly), then extract shared components second. Keep the extraction focused on components that are genuinely identical or near-identical — do not over-engineer the shared layer.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 16 (App Router) | 16.x | Server Actions + `revalidatePath` | Project stack |
| Supabase JS v2 | 2.x | DB queries + storage signed URLs | Project stack |
| React 19 | 19.x | `useTransition`, `useCallback`, `useState` | Project stack |
| Tailwind v4 | 4.x | Styling | Project stack |
| shadcn/ui | current | Switch, Button, Label, Input, Badge | Project stack |
| sonner | current | `toast.success` / `toast.error` | Project stack |
| lucide-react | current | Icons (FileText, Bell, Trash2, etc.) | Project stack |

### No New Dependencies Required

This phase installs nothing. All required tools are already in the project.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── actions/fleet/
│   ├── drivers.ts          # existing — reference pattern
│   ├── vehicles.ts         # NEW — vehicle CRUD server actions
│   ├── vehicle-suppliers.ts # existing
│   └── mot-sync.ts         # existing
├── lib/fleet/
│   ├── supplier-types.ts   # existing — shared constants pattern
│   └── vehicle-types.ts    # NEW — VehicleFull, VehicleListItem, etc.
└── components/app/fleet/
    ├── drivers/            # existing
    │   ├── FleetDateInput.tsx       # will be MOVED to shared/
    │   ├── FitnessLight.tsx         # will be MOVED to shared/ (generalized)
    │   └── DriverDocumentsSection.tsx # stays — internal sub-components extracted
    └── shared/             # NEW — extracted reusable components
        ├── FleetDateInput.tsx        # moved from drivers/
        ├── VehicleFitnessLight.tsx   # new variant for vehicles (test+insurance+docs)
        ├── AlertToggle.tsx           # extracted from DriverDocumentsSection + DriverLicenseSection
        ├── ExpiryIndicator.tsx       # extracted from DriverDocumentsSection
        ├── FleetUploadZone.tsx       # generalized from DriverDocumentsSection
        └── FleetDocumentNameInput.tsx  # autocomplete pattern (generalized)
```

### Pattern 1: Vehicle Server Actions File (mirrors drivers.ts)

**What:** `src/actions/fleet/vehicles.ts` — `'use server'` file exporting only async functions. Types/constants live in `src/lib/fleet/vehicle-types.ts` (same pattern as `supplier-types.ts`).

**Guard:** `verifyAppUser()` (not `verifySession()`) — vehicles are ChemoSys employee-facing, NOT admin panel. This is the same guard as `drivers.ts`.

**Vehicle-specific behaviors NOT in drivers.ts:**
- `vehicle_tests` = INSERT (not upsert) — test history accumulates, each test is a separate row.
- `vehicle_insurance` = multiple concurrent policies per vehicle (mandatory + comprehensive + third_party).
- `vehicle_insurance.supplier_id` = FK to `vehicle_suppliers` — must join on fetch.
- `vehicles` has MOT fields (`tozeret_nm`, `degem_nm`, etc.) — these are read-only from Server Actions perspective (populated by `mot-sync.ts`).
- Fitness status for vehicles = computed from `vehicle_tests.expiry_date` + `vehicle_insurance.expiry_date` + `vehicle_documents.expiry_date`.
- `vehicle_computed_status` view already exists — use it for list queries.
- Soft-delete: uses `soft_delete_vehicle`, `soft_delete_vehicle_document`, `soft_delete_vehicle_test`, `soft_delete_vehicle_insurance` RPCs (all in migration 00025).

**Example structure from drivers.ts (adapted for vehicles):**
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifyAppUser } from '@/lib/dal'
import type { VehicleListItem, VehicleFull, VehicleTest, VehicleInsurance, VehicleDocument } from '@/lib/fleet/vehicle-types'

export type ActionResult = { success: boolean; error?: string }

// getVehiclesList() — joins companies, assigned_driver, nearest expiry dates
// getVehicleById() — full data including MOT fields + joined supplier names
// createVehicle(licensePlate, companyId) — inserts, checks for existing plate
// updateVehicleDetails(...) — updates operational fields (not MOT fields)
// deleteVehicleWithPassword(vehicleId, password) — FLEET_ADMIN_PASSWORD env check + soft_delete_vehicle RPC
// softDeleteVehicle(vehicleId) — RPC only
// getVehicleTests(vehicleId) — sorted by test_date DESC
// addVehicleTest(input) — INSERT (not upsert, history accumulates)
// updateVehicleTest(input) — update_vehicle_test RPC
// deleteVehicleTest(testId, vehicleId) — soft_delete_vehicle_test RPC
// getVehicleInsurance(vehicleId) — all active policies
// addVehicleInsurance(input) — INSERT with supplier_id
// updateVehicleInsurance(input) — update_vehicle_insurance RPC
// deleteVehicleInsurance(insuranceId, vehicleId) — soft_delete_vehicle_insurance RPC
// getVehicleDocuments(vehicleId) — sorted by created_at DESC
// addVehicleDocument(input) — INSERT + increment_vehicle_document_name_usage RPC
// updateVehicleDocument(input) — update_vehicle_document RPC
// deleteVehicleDocument(docId, vehicleId) — soft_delete_vehicle_document RPC
// getVehicleDocumentNameSuggestions(query) — from vehicle_document_names table
// getActiveDriversForAssignment() — drivers without vehicle assigned (for dropdown)
// assignDriverToVehicle(vehicleId, driverId | null) — sets assigned_driver_id
```

### Pattern 2: Shared Types File

**What:** `src/lib/fleet/vehicle-types.ts` — non-`'use server'` file with TypeScript types and constants for vehicles. Follows `supplier-types.ts` exactly.

```typescript
// vehicle-types.ts — NOT 'use server'
// CRITICAL: 'use server' files can ONLY export async functions (Next.js 16 Turbopack)

export type VehicleListItem = {
  id: string
  licensePlate: string
  tozeret: string | null      // manufacturer
  degem: string | null        // model
  shnatYitzur: number | null
  companyName: string
  computedStatus: 'active' | 'inactive'
  assignedDriverName: string | null
  testExpiryDate: string | null
  insuranceMinExpiry: string | null
  documentMinExpiry: string | null
}

export type VehicleFull = {
  id: string
  licensePlate: string
  // MOT fields
  tozoretNm: string | null
  degemNm: string | null
  kinuyMishari: string | null
  shnatYitzur: number | null
  tzevaRechev: string | null
  sugDelekNm: string | null
  misgeret: string | null
  degemManoa: string | null
  ramatGimur: string | null
  kvutzatZihum: string | null
  baalut: string | null
  moedAliyaLakvish: string | null
  motLastSyncAt: string | null
  // Operational fields
  vehicleType: string | null
  ownershipType: string | null
  companyId: string | null
  companyName: string | null
  isActive: boolean
  assignedDriverId: string | null
  assignedDriverName: string | null
  notes: string | null
  computedStatus: 'active' | 'inactive'
}

export type VehicleTest = {
  id: string
  vehicleId: string
  testDate: string
  expiryDate: string
  passed: boolean
  testStation: string | null
  cost: number | null
  notes: string | null
  fileUrl: string | null
  alertEnabled: boolean
  createdAt: string
}

export type VehicleInsurance = {
  id: string
  vehicleId: string
  insuranceType: 'mandatory' | 'comprehensive' | 'third_party'
  policyNumber: string | null
  supplierId: string | null
  supplierName: string | null  // joined from vehicle_suppliers
  startDate: string | null
  expiryDate: string
  cost: number | null
  notes: string | null
  fileUrl: string | null
  alertEnabled: boolean
  createdAt: string
}

export type VehicleDocument = {
  id: string
  vehicleId: string
  documentName: string
  fileUrl: string | null
  expiryDate: string | null
  alertEnabled: boolean
  notes: string | null
  createdAt: string
}

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  private:         'פרטי',
  minibus:         'מיניבוס',
  light_commercial:'מסחרי קל',
  heavy:           'כבד',
  forklift:        'מלגזה',
  equipment:       'ציוד',
  other:           'אחר',
}

export const OWNERSHIP_TYPE_LABELS: Record<string, string> = {
  company_owned:   'בבעלות חברה',
  leased:          'ליסינג',
  rented:          'שכור',
  employee_owned:  'בבעלות עובד',
}

export const INSURANCE_TYPE_LABELS: Record<string, string> = {
  mandatory:      'חובה',
  comprehensive:  'מקיף',
  third_party:    'צד ג׳',
}
```

### Pattern 3: Shared Component Extraction

**What:** Move reusable components from `drivers/` to `shared/`. Update import paths in `drivers/` components. Create vehicle variants where needed.

**Components to extract (HIGH priority — identical code duplicated otherwise):**

| Component | Current Location | Move To | Notes |
|-----------|-----------------|---------|-------|
| `FleetDateInput` | `drivers/FleetDateInput.tsx` | `shared/FleetDateInput.tsx` | Zero changes needed — already generic |
| `AlertToggle` | inline in `DriverLicenseSection` + `DriverDocumentsSection` | `shared/AlertToggle.tsx` | Identical in both — extract once |
| `ExpiryIndicator` | inline in `DriverDocumentsSection` | `shared/ExpiryIndicator.tsx` | Reusable for vehicle docs/tests/insurance |
| `FilePreview` | inline in `DriverDocumentsSection` | `shared/FleetFilePreview.tsx` | Same for vehicle docs |
| `UploadZone` | inline in `DriverDocumentsSection` | `shared/FleetUploadZone.tsx` | Generalized: accept `bucket` prop |

**New vehicle-specific components:**

| Component | Location | Purpose |
|-----------|---------|---------|
| `VehicleFitnessLight` | `shared/VehicleFitnessLight.tsx` | Vehicle status light — test+insurance+docs (3 expiry types vs driver's 2) |

**FitnessLight analysis:** The existing `FitnessLight` is driver-specific (license + docs). Vehicles have 3 expiry categories: `vehicle_tests`, `vehicle_insurance`, `vehicle_documents`. A new `VehicleFitnessLight` should accept:
- `testExpiryDate: string | null`
- `insuranceMinExpiry: string | null`
- `documentMinExpiry: string | null`
- `yellowDays: number`

Logic: red = test expired OR insurance expired. Yellow = any of the 3 within yellowDays. Green = all clear.

The existing `FitnessLight` in `drivers/FitnessLight.tsx` stays — it's still used by `DriverList.tsx` and `DriverCard.tsx`. No breaking changes.

### Anti-Patterns to Avoid

- **Avoid creating a single mega-generic FitnessLight**: The driver variant and vehicle variant have different red/yellow logic. Two focused components are better than one over-parameterized one.
- **Never export types from `'use server'` files**: `vehicles.ts` types live in `vehicle-types.ts`. Confirmed pattern from `drivers.ts` (types exported directly from the same `'use server'` file) — this works ONLY because types are erased at runtime. Constants (`VEHICLE_TYPE_LABELS`) MUST live in `vehicle-types.ts`.
- **Avoid global UploadZone**: The bucket name differs between driver docs (`fleet-documents`) and vehicle docs (`fleet-vehicle-documents`). The extracted `FleetUploadZone` must accept `bucket: string` as a prop.
- **Never use direct `.update({ deleted_at })` on soft-deletable tables**: Always use the corresponding RPC. This is reinforced by RLS on UPDATE USING(true) pattern in migration 00025.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Document name autocomplete | Custom fuzzy search | `vehicle_document_names` table + `increment_vehicle_document_name_usage` RPC | Already built in migration 00025 |
| Soft-delete | `supabase.from('vehicles').update({ deleted_at })` | `supabase.rpc('soft_delete_vehicle', ...)` | RLS USING(deleted_at IS NULL) blocks direct UPDATE |
| Fitness status display | Custom logic per component | Extracted `VehicleFitnessLight` + `computeVehicleFitnessStatus()` | Centralizes expiry logic |
| Date display | `new Date().toLocaleDateString()` | `formatDate()` from `@/lib/format` | IRON RULE — no local duplicates |
| License plate display | Custom formatting | `formatLicensePlate()` from `@/lib/format` | IRON RULE |
| File upload to private bucket | Public URL | `supabase.storage.from('fleet-vehicle-documents').createSignedUrl(path, 31_536_000)` | Bucket is private (migration 00026) |

---

## Common Pitfalls

### Pitfall 1: Exporting Constants from `'use server'` Files

**What goes wrong:** Build fails with Turbopack error: "Only async functions are allowed to be exported from Server Action files."
**Why it happens:** Next.js 16 Turbopack enforces this strictly. `drivers.ts` works because it only exports async functions + TypeScript types (erased at compile time). Constants like `VEHICLE_TYPE_LABELS` cannot be in `vehicles.ts`.
**How to avoid:** Put all constants and TypeScript interfaces in `src/lib/fleet/vehicle-types.ts`. Import from there in both `vehicles.ts` and client components.
**Warning signs:** If you write `export const VEHICLE_TYPE_LABELS = ...` in `vehicles.ts`, the build will fail.

### Pitfall 2: `vehicle_tests` Upsert vs INSERT

**What goes wrong:** Accidentally writing upsert logic for `vehicle_tests`, thinking "only one test per period."
**Why it happens:** `driver_licenses` has one-per-driver semantics → upsert. `vehicle_tests` accumulates history → INSERT always.
**How to avoid:** `addVehicleTest()` calls `supabase.from('vehicle_tests').insert(...)`. No upsert. No unique constraint on `vehicle_id + test_date`.
**Warning signs:** If the function checks for an existing record before inserting — it's wrong.

### Pitfall 3: Using `fleet-documents` Bucket for Vehicle Files

**What goes wrong:** Vehicle documents uploaded to `fleet-documents` (driver bucket) instead of `fleet-vehicle-documents`.
**Why it happens:** The driver docs bucket name is similar. The vehicle bucket was created in migration 00026.
**How to avoid:** The extracted `FleetUploadZone` takes `bucket` as a prop. Vehicle docs = `'fleet-vehicle-documents'`, driver docs = `'fleet-documents'`, driver licenses = `'fleet-licenses'`.
**Warning signs:** If any vehicle-related upload hardcodes `'fleet-documents'`.

### Pitfall 4: Broken Import Paths After Component Move

**What goes wrong:** `DriverDocumentsSection.tsx` still imports `FleetDateInput` from `'./FleetDateInput'` after it's moved to `shared/`.
**Why it happens:** Moving files without updating all import sites.
**How to avoid:** After moving each component to `shared/`, grep for all existing import sites and update them. Files that import `FleetDateInput` currently: `DriverDocumentsSection.tsx`, `DriverLicenseSection.tsx`, `DriverViolationsSection.tsx`.
**Warning signs:** TypeScript compiler errors on `Module not found`.

### Pitfall 5: `vehicle_insurance.supplier_id` FK Join

**What goes wrong:** `getVehicleInsurance()` returns raw `supplier_id` UUID without the supplier name, forcing client to do a second lookup.
**Why it happens:** Forgetting to join `vehicle_suppliers` in the query.
**How to avoid:** Join at query time: `vehicle_insurance ( *, vehicle_suppliers ( name ) )`. Map to `supplierName` in the return type.
**Warning signs:** `VehicleInsurance` type has `supplierId` but no `supplierName`.

### Pitfall 6: `deleteDriverDocumentsSection` Storage Orphans

**What goes wrong:** Soft-deleting a vehicle document removes the DB row but leaves the file in storage.
**Why it happens:** Project uses soft-delete everywhere. The `file_url` is lost when the record is soft-deleted.
**How to avoid:** This is a KNOWN PROJECT PATTERN — storage cleanup is deferred (same as drivers). Do NOT attempt to delete storage objects during soft-delete. Note this in code comments.

### Pitfall 7: Wrong Auth Guard on Vehicle Actions

**What goes wrong:** Using `verifySession()` instead of `verifyAppUser()` in `vehicles.ts`.
**Why it happens:** `vehicle-suppliers.ts` uses `verifySession()` (it's an admin action). `vehicles.ts` is a ChemoSys employee-facing action → `verifyAppUser()`.
**How to avoid:** Check the pattern: admin panel actions use `verifySession()`. (app) actions use `verifyAppUser()`.
**Warning signs:** If `vehicles.ts` imports `verifySession` instead of `verifyAppUser`.

---

## Code Examples

### getVehiclesList() — With Fitness Expiry Data

```typescript
// Source: derived from drivers.ts getDriversList() pattern + migration 00025 schema
export async function getVehiclesList(): Promise<VehicleListItem[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      id,
      license_plate,
      tozeret_nm,
      degem_nm,
      shnat_yitzur,
      is_active,
      companies ( name ),
      drivers:assigned_driver_id ( employees ( first_name, last_name ) ),
      vehicle_tests ( expiry_date ),
      vehicle_insurance ( expiry_date ),
      vehicle_documents ( expiry_date )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const testExpiries = (row.vehicle_tests ?? [])
      .map((t: { expiry_date: string }) => t.expiry_date)
      .filter(Boolean).sort()
    const insuranceExpiries = (row.vehicle_insurance ?? [])
      .map((i: { expiry_date: string }) => i.expiry_date)
      .filter(Boolean).sort()
    const docExpiries = (row.vehicle_documents ?? [])
      .map((d: { expiry_date: string | null }) => d.expiry_date)
      .filter(Boolean).sort()

    return {
      id: row.id,
      licensePlate: row.license_plate,
      tozeret: row.tozeret_nm,
      degem: row.degem_nm,
      shnatYitzur: row.shnat_yitzur,
      companyName: (row.companies as { name: string } | null)?.name ?? '',
      computedStatus: row.is_active ? 'active' : 'inactive',
      assignedDriverName: null, // TODO: resolve from drivers join
      testExpiryDate: testExpiries[0] ?? null,
      insuranceMinExpiry: insuranceExpiries[0] ?? null,
      documentMinExpiry: docExpiries[0] ?? null,
    }
  })
}
```

### addVehicleTest() — INSERT (not upsert)

```typescript
// Source: migration 00025 — vehicle_tests has no unique constraint on vehicle_id+test_date
export async function addVehicleTest(input: {
  vehicleId: string
  testDate: string
  expiryDate: string
  passed?: boolean
  testStation?: string | null
  cost?: number | null
  notes?: string | null
  fileUrl?: string | null
  alertEnabled?: boolean
}): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_tests')
    .insert({
      vehicle_id:    input.vehicleId,
      test_date:     input.testDate,
      expiry_date:   input.expiryDate,
      passed:        input.passed ?? true,
      test_station:  input.testStation ?? null,
      cost:          input.cost ?? null,
      notes:         input.notes ?? null,
      file_url:      input.fileUrl ?? null,
      alert_enabled: input.alertEnabled ?? true,   // default TRUE for tests
      created_by:    userId,
      updated_by:    userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת הטסט' }

  revalidatePath(`/app/fleet/vehicle-card/${input.vehicleId}`)
  return { success: true, id: data.id }
}
```

### AlertToggle — Extracted Shared Component

```typescript
// Source: identical pattern in DriverLicenseSection.tsx + DriverDocumentsSection.tsx
// Moved to shared/AlertToggle.tsx

'use client'

import { Bell } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

type AlertToggleProps = {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}

export function AlertToggle({ checked, onChange, label }: AlertToggleProps) {
  return (
    <div className="flex items-center gap-2.5 shrink-0" dir="ltr">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[#4ECDC4]"
      />
      <span
        dir="rtl"
        className={`text-xs flex items-center gap-1 transition-colors ${
          checked ? 'text-amber-600 font-medium' : 'text-muted-foreground'
        }`}
      >
        <Bell className="h-3.5 w-3.5" />
        {label}
      </span>
    </div>
  )
}
```

### VehicleFitnessLight — New Component

```typescript
// Source: adapted from FitnessLight.tsx — different red logic for vehicles
// Drivers: red = license expired
// Vehicles: red = test expired OR ANY insurance expired

'use client'

import { cn } from '@/lib/utils'

export type FitnessStatus = 'red' | 'yellow' | 'green'

export function computeVehicleFitnessStatus(
  testExpiryDate: string | null,
  insuranceMinExpiry: string | null,
  documentMinExpiry: string | null,
  yellowDays: number
): FitnessStatus {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  function isExpired(dateStr: string | null): boolean {
    if (!dateStr) return false
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
    return d <= today
  }

  function isYellow(dateStr: string | null): boolean {
    if (!dateStr) return false
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
    if (d <= today) return false  // already red
    const days = Math.ceil((d.getTime() - today.getTime()) / 86_400_000)
    return days <= yellowDays
  }

  // RED: test expired or insurance expired
  if (isExpired(testExpiryDate) || isExpired(insuranceMinExpiry)) return 'red'

  // YELLOW: any of the three within yellowDays
  if (isYellow(testExpiryDate) || isYellow(insuranceMinExpiry) || isYellow(documentMinExpiry)) return 'yellow'

  return 'green'
}

// ... (render same dot pattern as FitnessLight)
```

---

## Key Differences: Vehicles vs Drivers

| Aspect | Drivers | Vehicles |
|--------|---------|---------|
| Core entity | `drivers` table | `vehicles` table |
| Auth guard | `verifyAppUser()` | `verifyAppUser()` |
| "License" equivalent | `driver_licenses` (one per driver, upsert) | `vehicle_tests` (many per vehicle, INSERT) |
| Test history | N/A | `vehicle_tests` accumulates — no unique constraint |
| Insurance | N/A | `vehicle_insurance` (mandatory/comprehensive/third_party) with `supplier_id` FK |
| Documents bucket | `fleet-documents` | `fleet-vehicle-documents` |
| Fitness red trigger | license expired | test expired OR insurance expired |
| Fitness yellow | license or doc within N days | test, insurance, or doc within N days |
| External data sync | N/A | `mot-sync.ts` (already built) — no new sync code in Phase 13 |
| Soft-delete RPC | `soft_delete_driver` | `soft_delete_vehicle` |
| Admin password delete | `deleteDriverWithPassword` | `deleteVehicleWithPassword` (same FLEET_ADMIN_PASSWORD env var) |
| Autocomplete table | `driver_document_names` | `vehicle_document_names` |
| Autocomplete RPC | `increment_document_name_usage` | `increment_vehicle_document_name_usage` |

---

## Open Questions

1. **VehicleCard URL pattern** — What will the URL be?
   - What we know: DriverCard = `/app/fleet/driver-card/[id]`, `STATE.md` mentions `/app/fleet/vehicle-card`
   - What's unclear: Will it be `/app/fleet/vehicle-card/[id]` or just `/app/fleet/vehicles/[id]`?
   - Recommendation: Use `/app/fleet/vehicle-card/[id]` to be consistent with driver card pattern. `revalidatePath` calls in `vehicles.ts` should use this path.

2. **FitnessLight — Should we move or copy?**
   - What we know: `FitnessLight` is driver-specific (license + docs). Vehicles need a different variant.
   - What's unclear: Whether to rename the existing file to `DriverFitnessLight` or keep it as-is.
   - Recommendation: Keep existing `FitnessLight.tsx` in `drivers/` unchanged (zero breaking changes). Create new `VehicleFitnessLight.tsx` in `shared/`. The naming distinction is clear enough.

3. **FleetDateInput — Move or re-export?**
   - What we know: Used in `DriverLicenseSection`, `DriverDocumentsSection`, `DriverViolationsSection`. Completely generic.
   - Recommendation: Move file to `shared/FleetDateInput.tsx`, update all 3 import sites in `drivers/`. This is the cleanest approach.

4. **`getActiveDriversForAssignment()` scope**
   - What we know: Vehicle card Phase 14 needs a driver assignment dropdown. Vehicles have `assigned_driver_id`.
   - Recommendation: Include `getActiveDriversForAssignment()` in `vehicles.ts` in Phase 13 — Phase 14 will need it immediately and it's a simple query.

---

## Sources

### Primary (HIGH confidence)

- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/actions/fleet/drivers.ts` — complete reference pattern for all CRUD actions
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/supabase/migrations/00025_fleet_vehicles.sql` — all tables, RPCs, RLS, views verified
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/lib/fleet/supplier-types.ts` — confirmed shared-types pattern
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/components/app/fleet/drivers/FleetDateInput.tsx` — extraction candidate verified
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/components/app/fleet/drivers/FitnessLight.tsx` — driver fitness logic verified
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/components/app/fleet/drivers/DriverDocumentsSection.tsx` — AlertToggle, ExpiryIndicator, UploadZone extraction candidates verified
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/components/app/fleet/drivers/DriverLicenseSection.tsx` — AlertToggle duplication confirmed
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/.planning/STATE.md` — key decisions [12-01], [12-02], [11-01] confirmed
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/actions/fleet/vehicle-suppliers.ts` — verifySession vs verifyAppUser distinction confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all patterns verified in codebase
- Architecture: HIGH — vehicles.ts structure derived directly from drivers.ts + migration schema
- Pitfalls: HIGH — based on documented project decisions and existing code patterns

**Research date:** 2026-03-07
**Valid until:** Stable — based on internal codebase analysis, not external libraries
