# Phase 14: VehicleCard Tabs 4-8 (Assignment, Costs, Documents, Notes, KM placeholder) - Research

**Researched:** 2026-03-07
**Domain:** Next.js 16 (App Router) + Supabase + shadcn/ui — internal fleet management UI
**Confidence:** HIGH (all findings based on direct codebase inspection — no guesswork)

---

## Summary

Phase 14 builds the VehicleCard page — the per-vehicle detail screen — using the DriverCard (Phase 9) as the reference implementation. All server actions, DB tables, RLS policies, shared components, and TypeScript types were completed in Phase 13 (vehicles.ts: 21 actions; shared/: 6 components). **Zero new migrations are needed.**

The phase title says "Tabs 4-8" but the naming is misleading — it implies some tabs already exist. In reality, the VehicleCard page currently has a `ComingSoon` placeholder at `/app/fleet/vehicle-card`. This phase builds the **entire VehicleCard** from scratch: the page, the card header, and all tabs. The "4-8" numbering in the phase title likely refers to the last 5 of 8 total tabs — suggesting tabs 1-3 (vehicle details, tests, insurance) may be scoped to a prior task and tabs 4-8 (assignment, costs, documents, notes, KM) to a second task — but this is a planning decision.

**The most important architectural fact:** The DriverCard implementation is the exact blueprint. Every pattern (RTL tabs, dirty tracking via `useRef<Record<string,boolean>>`, unsaved changes Dialog, `onEditingChange` callbacks, FleetDateInput + AlertToggle + ExpiryIndicator reuse, soft-delete via RPC) should be replicated verbatim. Do not invent new patterns.

**Primary recommendation:** Model VehicleCard 1:1 on DriverCard. Build the full page (header + all tabs) in one phase, splitting into two plans: Plan A = page infrastructure + tabs 1-3, Plan B = tabs 4-8 (the ones named in the phase title). KM tab = placeholder (same "Coming Soon" pattern used in DriverCard's log tab).

---

## Standard Stack

### Core — what's already in the project (no new installs needed)

| Library | Purpose | Status |
|---------|---------|--------|
| Next.js 16 (App Router) | Page + layout system | Already installed |
| Supabase (`@/lib/supabase/server` + `browser`) | DB reads + storage uploads | Already installed |
| shadcn/ui `Tabs`, `Dialog`, `Button`, `Input`, `Label` | Tab system + dialogs | Already installed |
| `lucide-react` | Icons | Already installed |
| `sonner` | Toast notifications | Already installed (Toaster in root layout) |
| `@/lib/format` | formatDate, formatPhone, formatLicensePlate, daysUntil | Already in project |

### Shared fleet components (all ready in `src/components/app/fleet/shared/`)

| Component | Purpose | Used by vehicle? |
|-----------|---------|-----------------|
| `FleetDateInput` | dd/mm/yyyy three-select date picker | Yes — tests, insurance, documents |
| `AlertToggle` | Bell icon + Switch for alert_enabled | Yes — documents, tests, insurance |
| `ExpiryIndicator` | Expiry date display with color-coded days remaining | Yes — document rows |
| `FleetFilePreview` | Image inline / PDF link preview | Yes — file rows |
| `FleetUploadZone` | Drag-drop upload area with file+camera buttons | Yes — documents, tests, insurance |
| `VehicleFitnessLight` | Green/yellow/red dot for vehicle fitness | Yes — card header |

### No new installations required

```bash
# Nothing to install — all dependencies already present
```

---

## Architecture Patterns

### Recommended File Structure for Phase 14

```
src/
├── app/(app)/app/fleet/vehicle-card/
│   ├── page.tsx                    ← REPLACE ComingSoon with VehicleList
│   └── [id]/
│       └── page.tsx                ← NEW: VehicleCard server page (fetch + pass props)
│
├── components/app/fleet/vehicles/
│   ├── VehicleCard.tsx             ← NEW: main card component (mirror of DriverCard.tsx)
│   ├── VehicleDetailsSection.tsx   ← NEW: Tab 1 — MOT data + operational fields
│   ├── VehicleTestsSection.tsx     ← NEW: Tab 2 — vehicle tests (טסטים)
│   ├── VehicleInsuranceSection.tsx ← NEW: Tab 3 — insurance policies
│   ├── VehicleAssignmentSection.tsx← NEW: Tab 4 — driver assignment
│   ├── VehicleCostsSection.tsx     ← NEW: Tab 5 — monthly costs (placeholder / simple)
│   ├── VehicleDocumentsSection.tsx ← NEW: Tab 6 — vehicle documents (mirror of DriverDocumentsSection)
│   ├── VehicleNotesSection.tsx     ← NEW: Tab 7 — free-text notes
│   └── (KM tab = inline placeholder in VehicleCard.tsx — no separate file needed)
```

### Pattern 1: Server Page — fetch all data, pass as props

The DriverCard pattern: server page fetches everything, passes to client component. No client-side data fetching on mount.

```typescript
// src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getVehicleById, getVehicleTests, getVehicleInsurance, getVehicleDocuments } from '@/actions/fleet/vehicles'
import { VehicleCard } from '@/components/app/fleet/vehicles/VehicleCard'

export default async function VehicleCardPage({ params }: { params: { id: string } }) {
  const [vehicle, tests, insurance, documents] = await Promise.all([
    getVehicleById(params.id),
    getVehicleTests(params.id),
    getVehicleInsurance(params.id),
    getVehicleDocuments(params.id),
  ])

  if (!vehicle) notFound()

  const yellowDays = parseInt(process.env.FLEET_LICENSE_YELLOW_DAYS ?? '60')
  const docYellowDays = parseInt(process.env.FLEET_DOCUMENT_YELLOW_DAYS ?? '60')

  return (
    <VehicleCard
      vehicle={vehicle}
      tests={tests}
      insurance={insurance}
      documents={documents}
      yellowDays={yellowDays}
      docYellowDays={docYellowDays}
    />
  )
}
```

### Pattern 2: VehicleCard header structure (mirror of DriverCard header)

```typescript
// VehicleCard.tsx header pattern — mirror of DriverCard.tsx lines 354-457
// Key differences from DriverCard:
//   - Avatar letter = license plate first chars (not driver name initial)
//   - Identity = license plate (bold, large) + tozeret/degem + company + year
//   - Status badge = active/inactive (same as driver)
//   - VehicleFitnessLight (not FitnessLight)
//   - Action buttons: Back | Delete (no PDF, no SMS for vehicles initially)
//   - No SMS dialog (vehicles don't have phone numbers)
```

### Pattern 3: Tabs layout — exact mirror of DriverCard

```typescript
// Tabs for VehicleCard:
const TABS = [
  { value: 'details',    label: 'פרטי הרכב',   icon: Car },
  { value: 'tests',      label: 'טסטים',         icon: ClipboardCheck },
  { value: 'insurance',  label: 'ביטוח',          icon: Shield },
  { value: 'assignment', label: 'שיוך נהג',      icon: User },
  { value: 'costs',      label: 'עלויות',         icon: DollarSign },
  { value: 'documents',  label: 'מסמכים',         icon: Paperclip },
  { value: 'notes',      label: 'הערות',          icon: FileText },
  { value: 'km',         label: 'ק"מ',            icon: Gauge },
]

// Dirty tracking — same useRef<Record<string,boolean>> pattern from DriverCard lines 160-170
// Tab controlled via value + onValueChange — same unsaved changes Dialog pattern
```

### Pattern 4: VehicleDocumentsSection — exact mirror of DriverDocumentsSection

The `VehicleDocumentsSection` is a near-identical copy of `DriverDocumentsSection` with these substitutions:

| DriverDocumentsSection | VehicleDocumentsSection |
|------------------------|------------------------|
| `driverId` prop | `vehicleId` prop |
| `addDriverDocument` | `addVehicleDocument` |
| `updateDriverDocument` | `updateVehicleDocument` |
| `deleteDriverDocument` | `deleteVehicleDocument` |
| `getDocumentNameSuggestions` | `getVehicleDocumentNameSuggestions` |
| `fleet-documents` bucket | `fleet-vehicle-documents` bucket |
| `DriverDocument` type | `VehicleDocument` type |

All shared components (FleetDateInput, AlertToggle, ExpiryIndicator, FleetUploadZone) plug in identically.

### Pattern 5: VehicleTestsSection — list + add/edit form

Vehicle tests are INSERT-only (history accumulates — no upsert). The UI is a list with "add test" form.

```typescript
// Key fields in the add/edit form:
// - test_date (FleetDateInput, required)
// - expiry_date (FleetDateInput, required) + ExpiryIndicator + quick expiry buttons
// - passed (checkbox, default true)
// - test_station (text input, optional)
// - cost (number input, optional)
// - file_url (FleetUploadZone, bucket: fleet-vehicle-documents)
// - alert_enabled (AlertToggle)
// - notes (textarea, optional)
//
// Upload path: `${vehicleId}_test_${crypto.randomUUID()}.${ext}`
// Bucket: fleet-vehicle-documents (private, signed URLs)
```

### Pattern 6: VehicleInsuranceSection — multiple policies per vehicle

Vehicle insurance uses INSERT (not upsert) like tests — multiple concurrent policies are valid. UI shows grouped list by insurance type (mandatory/comprehensive/third_party) with an "add policy" form.

```typescript
// Key fields in the add/edit form:
// - insurance_type: select ('mandatory' | 'comprehensive' | 'third_party')
//   Display: INSURANCE_TYPE_LABELS from vehicle-types.ts
// - policy_number (text, optional)
// - supplier_id: select from vehicle_suppliers (insurance type)
//   NOTE: Need getActiveSuppliersByType() action — not yet in vehicles.ts!
// - start_date (FleetDateInput, optional)
// - expiry_date (FleetDateInput, required) + ExpiryIndicator
// - cost (number, optional)
// - file_url (FleetUploadZone)
// - alert_enabled (AlertToggle)
// - notes (textarea, optional)
```

**CRITICAL MISSING ACTION:** `getActiveSuppliersByType(type)` is not in `vehicles.ts`. The insurance tab needs to populate a supplier dropdown with insurance-type suppliers. This action must be added to `vehicles.ts` in Phase 14.

### Pattern 7: VehicleAssignmentSection (Tab 4)

The current assignment is stored on `vehicles.assigned_driver_id`. The section shows:
- Current assigned driver (read from `vehicle.assignedDriverName`)
- A searchable/select dropdown of active drivers (`getActiveDriversForAssignment()` already exists)
- "Assign" button → calls `assignDriverToVehicle(vehicleId, driverId)`
- "Remove assignment" button → calls `assignDriverToVehicle(vehicleId, null)`

No history table exists for assignment history — this is a simple current-state display. Future v2.1+ may add history.

```typescript
// Props for VehicleAssignmentSection:
type Props = {
  vehicleId: string
  assignedDriverId: string | null
  assignedDriverName: string | null
  onAssignmentChange?: () => void  // optional refresh signal
}
```

### Pattern 8: VehicleCostsSection (Tab 5) — simple or placeholder

There is **no `vehicle_costs` table in the DB schema (migration 00025)**. This tab is either:
- A **pure placeholder** (same pattern as DriverCard "log tab" — Coming Soon icon + text)
- A **simple notes field** for monthly cost estimates stored as free text in `vehicles.notes`

Recommendation: make it a placeholder for now matching the "Coming Soon" pattern, but label it "עלויות חודשיות" with a note that full cost tracking is planned for v2.1+. The phase title says "Costs" but the DB has no cost table — so this must be a placeholder.

### Pattern 9: VehicleNotesSection (Tab 7)

Notes for vehicles are stored directly in `vehicles.notes` (TEXT column). This tab is a simple textarea that saves via `updateVehicleDetails({ vehicleId, notes })`. It mirrors the notes field in DriverCard Tab 1 but promoted to its own tab for visibility.

```typescript
// VehicleNotesSection — simple component:
// - textarea bound to local state
// - "שמור" button (calls updateVehicleDetails with notes only)
// - isDirty = notes !== vehicle.notes
// - onEditingChange callback to parent (dirty tracking)
```

### Pattern 10: KM Tab (Tab 8) — placeholder

No KM tracking table exists in the DB. Implement as inline placeholder in VehicleCard.tsx:

```typescript
// In VehicleCard.tsx — inline placeholder (no separate component file):
<TabsContent value="km" className="mt-0">
  <div className="bg-white border-x border-b rounded-b-2xl py-12 text-center" style={{ borderColor: '#E2EBF4' }}>
    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
      style={{ background: '#F0F5FB', border: '1px solid #E2EBF4' }}>
      <Gauge className="h-6 w-6 text-muted-foreground/35" />
    </div>
    <p className="text-sm font-semibold text-muted-foreground">פיתוח עתידי</p>
    <p className="text-xs text-muted-foreground/50 mt-0.5">מעקב קילומטראז׳ ייפתח בגרסה הבאה</p>
  </div>
</TabsContent>
```

### Anti-Patterns to Avoid

- **Do NOT use direct `.update()` for soft-delete** — ALL soft-deletes on vehicle tables must use RPCs (`soft_delete_vehicle_document`, `soft_delete_vehicle_test`, `soft_delete_vehicle_insurance`). Direct `.update({ deleted_at })` fails due to RLS interaction (PostgREST blocks UPDATE when SELECT policy is `USING(deleted_at IS NULL)`).
- **Do NOT use `createClient` from `@/lib/supabase/client`** — the project uses `@/lib/supabase/browser` for browser-side Supabase (see MEMORY.md: "Supabase browser import: import { createClient } from '@/lib/supabase/browser'").
- **Do NOT hardcode tab dirty state as boolean** — use `useRef<Record<string,boolean>>` + `useCallback` for section `onEditingChange` (DriverCard lines 160-170 pattern). This prevents unnecessary re-renders.
- **Do NOT use `disabled` on inputs that submit via FormData** — use `readOnly` + `pointer-events-none` for readonly display fields (MEMORY.md: disabled vs readOnly lesson).
- **Do NOT fetch data client-side on mount** — all initial data comes from server page props (DriverCard pattern).
- **Do NOT build a separate VehicleList in this phase** — Phase 15 handles VehicleList + AddVehicleDialog. Phase 14 = VehicleCard only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date picker (dd/mm/yyyy) | Custom input | `FleetDateInput` from `shared/` | Already built, handles partial selection + external value sync |
| Alert toggle (bell) | Custom checkbox | `AlertToggle` from `shared/` | RTL-safe Switch pattern already solved |
| Expiry date display | Custom component | `ExpiryIndicator` from `shared/` | Color coding + days remaining already implemented |
| File upload zone | Custom drag-drop | `FleetUploadZone` from `shared/` | Handles drag, camera, file picker, preview |
| Vehicle fitness indicator | Custom dot | `VehicleFitnessLight` from `shared/` | Red/yellow/green logic already correct |
| Tab unsaved changes warning | `window.confirm()` | shadcn `Dialog` | Browser confirm blocked in some contexts; Dialog is styled consistently |
| Toast notifications | Custom toast | `sonner` (already in root layout) | `toast.success()` / `toast.error()` work everywhere |
| Soft-delete | `.update({ deleted_at })` | RPC call via `supabase.rpc(...)` | RLS SECURITY DEFINER bypass is mandatory for this project |

**Key insight:** The shared fleet components were extracted in Phase 13 specifically for VehicleCard reuse. Use them all.

---

## Common Pitfalls

### Pitfall 1: Missing `getActiveSuppliersByType` action for insurance dropdown

**What goes wrong:** VehicleInsuranceSection needs to populate a supplier dropdown for insurance suppliers. `getActiveDriversForAssignment()` exists for drivers, but there is NO equivalent `getActiveSuppliersByType()` in `vehicles.ts`.

**Why it happens:** Phase 13 built actions around the main CRUD operations. Supplier-by-type query was not needed until UI is built.

**How to avoid:** Add `getActiveSuppliersByType(type: string): Promise<{ id: string; name: string }[]>` to `vehicles.ts` as part of Phase 14. It's a simple SELECT with `.eq('supplier_type', type).is('deleted_at', null)`. This is a server action addition, not a migration.

**Warning signs:** InsuranceSection crashes or shows empty supplier dropdown.

### Pitfall 2: Storage bucket name — fleet-vehicle-documents (not fleet-documents)

**What goes wrong:** Driver documents use bucket `fleet-documents`. Vehicle documents use a DIFFERENT bucket: `fleet-vehicle-documents`.

**Why it happens:** Two separate buckets for driver and vehicle files (both private, set up in migration 00026).

**How to avoid:** In all VehicleCard upload components, the Supabase storage call must target `fleet-vehicle-documents`, not `fleet-documents`.

**Warning signs:** `Error: Bucket not found` or files uploaded to wrong bucket.

### Pitfall 3: Signed URLs expire — use 1-year expiry on upload

**What goes wrong:** Signed URLs with short expiry (default ~1 hour) expire before the user views the file again.

**Why it happens:** Supabase private buckets require signed URLs; the default expiry is short.

**How to avoid:** Use `createSignedUrl(fileName, 31_536_000)` (1 year = 31,536,000 seconds). This is the pattern already used in DriverDocumentsSection (line 112).

**Warning signs:** Files show "URL expired" error after a day.

### Pitfall 4: shadcn Tabs resets `dir` — must set `dir="rtl"` on TabsList AND TabsContent wrappers

**What goes wrong:** RTL tab order reverses or text displays LTR inside tabs.

**Why it happens:** shadcn `<Tabs>` resets the `dir` attribute. Setting `dir="rtl"` on the `<Tabs>` root is not sufficient.

**How to avoid:** Set `dir="rtl"` on both `<TabsList dir="rtl">` AND the `<div dir="rtl">` wrapper inside each `<TabsContent>` (see DriverCard lines 461-484 for the exact pattern).

**Warning signs:** Tab labels appear in wrong order, or form inputs inside tabs display LTR.

### Pitfall 5: `params` in Next.js 16 App Router is async

**What goes wrong:** `params.id` in page component causes TypeScript error or runtime warning in Next.js 16.

**Why it happens:** Next.js 16 made `params` a Promise-like object in some configurations.

**How to avoid:** Declare the page as `async function` and use `params` directly as `{ params: { id: string } }`. If Next.js 16 enforces `await params`, use `const { id } = await params`.

**Warning signs:** TypeScript error on `params.id` access or runtime warning about synchronous params access.

### Pitfall 6: Vehicle tests use INSERT always (not upsert)

**What goes wrong:** Developer tries to update an existing test via INSERT, creating duplicates.

**Why it happens:** `vehicle_tests` has no unique constraint on `(vehicle_id, test_date)` — each test event is a separate record.

**How to avoid:** For EDITING an existing test record, call `updateVehicleTest()` (uses `update_vehicle_test` RPC). For ADDING a new test, call `addVehicleTest()` (uses INSERT). UI must distinguish between add mode and edit mode.

**Warning signs:** Duplicate test records appearing for the same date.

### Pitfall 7: VehicleFitnessLight needs test + insurance expiry dates from all records

**What goes wrong:** Fitness light shows wrong status because only the first test/insurance record's expiry is checked.

**Why it happens:** A vehicle may have multiple tests and multiple insurance policies. The fitness light needs the NEAREST expiry across all records.

**How to avoid:** In the VehicleCard page, compute:
- `testExpiryDate` = earliest expiry from all `tests` (sort by expiry_date ASC, take first)
- `insuranceMinExpiry` = earliest expiry across all `insurance` records
- `documentMinExpiry` = earliest expiry across all `documents`

Pass these to `VehicleFitnessLight`. The `getVehiclesList()` action already does this for the list view — apply the same logic in the card page.

---

## Code Examples

Verified patterns from existing codebase:

### Storage upload to fleet-vehicle-documents bucket

```typescript
// Source: DriverDocumentsSection.tsx lines 99-119 (adapted for vehicles)
async function uploadFile(file: File): Promise<string | null> {
  setUploading(true)
  try {
    const supabase = createBrowserClient()
    const ext = file.name.split('.').pop() ?? 'pdf'
    const fileName = `${vehicleId}_doc_${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from('fleet-vehicle-documents')  // ← vehicle bucket, not 'fleet-documents'
      .upload(fileName, file, { upsert: true })
    if (error) throw error
    const { data: signedData, error: signedError } = await supabase.storage
      .from('fleet-vehicle-documents')
      .createSignedUrl(fileName, 31_536_000)  // ← 1 year signed URL
    if (signedError) throw signedError
    return signedData.signedUrl
  } catch (err) {
    toast.error(`שגיאה בהעלאת הקובץ: ${err instanceof Error ? err.message : 'Unknown'}`)
    return null
  } finally {
    setUploading(false)
  }
}
```

### Dirty tracking with useRef across tabs

```typescript
// Source: DriverCard.tsx lines 160-170
const dirtyStates = useRef<Record<string, boolean>>({})

const onTestsEditingChange = useCallback((dirty: boolean) => {
  dirtyStates.current.tests = dirty
}, [])
const onInsuranceEditingChange = useCallback((dirty: boolean) => {
  dirtyStates.current.insurance = dirty
}, [])
const onDocumentsEditingChange = useCallback((dirty: boolean) => {
  dirtyStates.current.documents = dirty
}, [])
const onNotesEditingChange = useCallback((dirty: boolean) => {
  dirtyStates.current.notes = dirty
}, [])
```

### Compute min expiry for VehicleFitnessLight in card page

```typescript
// Pattern from getVehiclesList() in vehicles.ts lines 87-90
const testExpiries = tests.map(t => t.expiryDate).filter(Boolean) as string[]
const insuranceExpiries = insurance.map(i => i.expiryDate).filter(Boolean) as string[]
const docExpiries = documents.map(d => d.expiryDate).filter(Boolean) as string[]

const testMinExpiry = testExpiries.sort()[0] ?? null
const insuranceMinExpiry = insuranceExpiries.sort()[0] ?? null
const documentMinExpiry = docExpiries.sort()[0] ?? null
```

### Quick expiry buttons (reuse from DriverDocumentsSection)

```typescript
// Source: DriverDocumentsSection.tsx lines 288-311
{[
  { label: '3 חודשים', months: 3 },
  { label: 'שנה', months: 12 },
  { label: 'שנתיים', months: 24 },
].map(({ label, months }) => (
  <button
    key={months}
    type="button"
    onClick={() => {
      const d = new Date()
      d.setMonth(d.getMonth() + months)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      setExpiryDate(`${yyyy}-${mm}-${dd}`)
    }}
    className="px-2.5 py-1 rounded-md border text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
    style={{ borderColor: '#C8D5E2' }}
  >
    {label}
  </button>
))}
```

---

## What Tabs Exist and What They Need

### Tab 1 — פרטי הרכב (VehicleDetailsSection)

Fields to display (from `VehicleFull` type):
- **MOT fields** (read-only, populated by MOT sync): licensePlate, tozoretNm, degemNm, kinuyMishari, shnatYitzur, tzevaRechev, sugDelekNm, misgeret, degemManoa, ramatGimur, kvutzatZihum, baalut, moedAliyaLakvish, motLastSyncAt
- **Operational fields** (editable): vehicleType (select from VEHICLE_TYPE_LABELS), ownershipType (select from OWNERSHIP_TYPE_LABELS), companyId (select from companies), isActive (toggle), leasingCompanyId, insuranceCompanyId, fuelCardSupplierId, garageId (all selects from vehicle_suppliers)
- Save via `updateVehicleDetails()`
- Supplier dropdowns need `getActiveSuppliersByType()` — MISSING, must add

### Tab 2 — טסטים (VehicleTestsSection)

- List of tests (newest first)
- Add new test form (INSERT, not upsert)
- Edit existing test (inline form, UPDATE via `updateVehicleTest` RPC)
- Delete test (soft-delete via `soft_delete_vehicle_test` RPC)
- Fields: testDate, expiryDate (+ExpiryIndicator +quick buttons), passed (checkbox), testStation, cost (₪), fileUrl (upload), alertEnabled, notes

### Tab 3 — ביטוח (VehicleInsuranceSection)

- List of insurance policies grouped or sorted by type
- Add new policy form (INSERT)
- Edit/delete existing
- Fields: insuranceType (select), policyNumber, supplierId (from vehicle_suppliers.insurance), startDate, expiryDate, cost (₪), fileUrl, alertEnabled, notes

### Tab 4 — שיוך נהג (VehicleAssignmentSection)

- Shows current assigned driver name or "לא משויך"
- Dropdown of active drivers (`getActiveDriversForAssignment()`)
- "שייך" button → `assignDriverToVehicle(vehicleId, driverId)`
- "הסר שיוך" button → `assignDriverToVehicle(vehicleId, null)`
- No assignment history (future v2.1+)
- No dirty tracking needed (auto-save on button click)

### Tab 5 — עלויות (Placeholder)

- No DB table for costs exists
- Implement as "Coming Soon" placeholder with DollarSign icon
- Label: "ניהול עלויות ייפתח בגרסה הבאה"

### Tab 6 — מסמכים (VehicleDocumentsSection)

- Exact mirror of DriverDocumentsSection
- Bucket: `fleet-vehicle-documents`
- Autocomplete from `vehicle_document_names` via `getVehicleDocumentNameSuggestions()`
- All shared components: FleetDateInput, AlertToggle, ExpiryIndicator, FleetUploadZone

### Tab 7 — הערות (VehicleNotesSection)

- Simple textarea bound to `vehicle.notes`
- Save button → `updateVehicleDetails({ vehicleId, notes })`
- `onEditingChange` callback for dirty tracking

### Tab 8 — ק"מ (Placeholder)

- Inline placeholder in VehicleCard.tsx (no separate file)
- "Coming Soon" pattern identical to DriverCard's "לוג נסיעות" tab (lines 654-666)
- Icon: `Gauge` from lucide-react

---

## Missing Server Action (must add in Phase 14)

**`getActiveSuppliersByType(supplierType: string): Promise<{ id: string; name: string }[]>`**

This is needed by:
1. `VehicleDetailsSection` — dropdowns for leasingCompanyId, insuranceCompanyId, fuelCardSupplierId, garageId
2. `VehicleInsuranceSection` — supplierId dropdown for insurance suppliers

The action is simple and non-breaking (SELECT only, no new migrations):

```typescript
// Add to src/actions/fleet/vehicles.ts
export async function getActiveSuppliersByType(
  supplierType: string
): Promise<{ id: string; name: string }[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_suppliers')
    .select('id, name')
    .eq('supplier_type', supplierType)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []).map(row => ({ id: row.id, name: row.name }))
}
```

---

## Planning Recommendations

### Phase 14 should split into 2 plans

**Plan 14-01 — VehicleCard infrastructure + Tabs 1-3:**
1. Add `getActiveSuppliersByType()` to `vehicles.ts`
2. Create `/app/fleet/vehicle-card/[id]/page.tsx` (server page)
3. Create `VehicleCard.tsx` (header + tab shell + dirty tracking + dialogs)
4. Create `VehicleDetailsSection.tsx` (Tab 1 — MOT data display + operational field editing)
5. Create `VehicleTestsSection.tsx` (Tab 2 — test history + add/edit/delete)
6. Create `VehicleInsuranceSection.tsx` (Tab 3 — insurance policies + add/edit/delete)

**Plan 14-02 — Tabs 4-8 + VehicleCard list page:**
1. Create `VehicleAssignmentSection.tsx` (Tab 4 — driver assignment)
2. Create `VehicleCostsSection.tsx` (Tab 5 — placeholder)
3. Create `VehicleDocumentsSection.tsx` (Tab 6 — mirror of DriverDocumentsSection)
4. Create `VehicleNotesSection.tsx` (Tab 7 — notes textarea)
5. KM Tab 8 — inline placeholder in VehicleCard.tsx
6. Update `/app/fleet/vehicle-card/page.tsx` with basic VehicleList (simple table — full list with AddVehicleDialog is Phase 15)

### No migrations needed

All DB tables, RPCs, RLS policies, and storage bucket are already in place from Phase 11-12.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Browser `confirm()` for unsaved changes | shadcn `Dialog` component | Styled, consistent, blocking |
| Client-side data fetching (useEffect) | Server page fetches, passes as props | No loading flicker, better SSR |
| Global `disabled` on inputs | `readOnly` + `pointer-events-none` | Inputs submit correctly in forms |
| Single FitnessLight component | Driver-specific + Vehicle-specific | Avoids mega-generic component anti-pattern |

---

## Open Questions

1. **Should VehicleDetailsSection show a MOT Sync button?**
   - What we know: MOT sync action exists (`syncVehicleWithMot` in `mot-sync.ts`)
   - What's unclear: Is the sync button in the vehicle card or only in admin Fleet Settings?
   - Recommendation: Include a "עדכן ממשרד הרישוי" button in VehicleDetailsSection for convenience. Low risk — calls existing action.

2. **Does Tab 5 (Costs) need any content at all, or is it excluded from the tab list?**
   - What we know: No DB table for costs exists. Phase title explicitly says "Costs".
   - What's unclear: Whether to show the tab as "Coming Soon" or omit it entirely.
   - Recommendation: Show the tab with a Coming Soon placeholder — it sets user expectations and is consistent with the KM tab approach. Sharon can decide to remove it if unwanted.

3. **VehicleList for `/app/fleet/vehicle-card/` page — minimal or full?**
   - What we know: Phase 15 handles full VehicleList + AddVehicleDialog. Currently the page is `ComingSoon`.
   - What's unclear: Should Phase 14 plan 14-02 build a minimal list (just navigation to cards) or leave it as ComingSoon?
   - Recommendation: Build a minimal vehicle list in 14-02 (table showing plate + make + model + status + link to card) so the flow is testable end-to-end. AddVehicleDialog waits for Phase 15.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/actions/fleet/vehicles.ts` — all 21 server actions inspected
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/lib/fleet/vehicle-types.ts` — all types and constants
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/components/app/fleet/drivers/DriverCard.tsx` — reference implementation (886 lines, fully read)
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/components/app/fleet/drivers/DriverDocumentsSection.tsx` — reference for VehicleDocumentsSection (489 lines, fully read)
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/components/app/fleet/shared/` — all 6 shared components inspected
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/supabase/migrations/00025_fleet_vehicles.sql` — complete DB schema (644 lines)
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/supabase/migrations/00026_fleet_vehicles_storage_policies.sql` — storage bucket policies
- `C:/Users/Alias/.claude/projects/c--Sharon-ClaudeCode-Apps-ChemoSystem/memory/MEMORY.md` — project memory with patterns and pitfalls

### Secondary (MEDIUM confidence)

- ROADMAP.md — phase dependencies and goals

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in project, versions verified via file inspection
- Architecture: HIGH — VehicleCard mirrors DriverCard which is production code in same codebase
- Pitfalls: HIGH — all pitfalls are documented in MEMORY.md or directly observed in existing code patterns
- Missing action: HIGH — confirmed by searching vehicles.ts which contains no supplier-by-type query

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable codebase — valid long-term until schema changes)
