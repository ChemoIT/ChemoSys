# Phase 15: VehicleList + AddVehicleDialog (MOT API auto-fill) + Pages + Integration — Research

**Researched:** 2026-03-07
**Domain:** Next.js 16 App Router, fleet vehicle list UI, MOT API integration, dialog-driven create flow
**Confidence:** HIGH — all findings based on direct inspection of existing codebase; no external research required

---

## Summary

Phase 15 builds the VehicleList page and AddVehicleDialog on top of infrastructure that is already 100% complete. The server actions (`getVehiclesList`, `createVehicle`, `syncVehicleFromMot`), types (`VehicleListItem`), shared components (`VehicleFitnessLight`), and the page placeholder (`/app/fleet/vehicle-card/page.tsx`) all exist. Phase 14 (not yet built) will produce `VehicleCard` — but Phase 15 does not depend on it for the list page or the add dialog; the list page only navigates *to* the card URL, it doesn't render the card component.

The established pattern in this codebase is: **Server Component page fetches data → passes to Client Component**. The DriverList/AddDriverDialog pattern is the exact template. The VehicleList differs in that the Add dialog has a two-step flow: enter license plate → auto-fill from MOT API → confirm + create. This requires a stateful multi-step dialog rather than the simple employee-picker used by AddDriverDialog.

The most important technical fact for planning: `syncVehicleFromMot()` currently uses `verifySession()` (admin guard), not `verifyAppUser()` (ChemoSys guard). This must be fixed before the dialog calls it from the app context. Additionally, `createVehicle()` already creates the DB record; MOT sync is a separate step that should happen immediately after creation, inside the dialog flow.

**Primary recommendation:** Mirror DriverList/AddDriverDialog exactly for the list; build a two-step AddVehicleDialog (plate input → MOT preview → confirm); fix `syncVehicleFromMot` guard to use `verifyAppUser()`; replace the placeholder page; create the `[id]/page.tsx` route shell for Phase 14.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| Next.js | 16 (App Router) | Server Components + server actions | Existing project |
| React | 19 | Client Components, useTransition, useEffect | Existing project |
| shadcn/ui Dialog | current | AddVehicleDialog modal | Existing project |
| Tailwind v4 | current | Styling, RTL layout | Existing project |
| sonner | current | Toast notifications | Existing project |
| lucide-react | current | Icons (Car, Plus, Search, RefreshCw) | Existing project |

### Supporting (already in project)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@/lib/format.ts` | `formatDate`, `formatLicensePlate`, `daysUntil` | All date and plate display in VehicleList |
| `@/components/app/fleet/shared/VehicleFitnessLight` | Status dot in list rows | Every vehicle row |
| `@/actions/fleet/vehicles.ts` | `getVehiclesList`, `createVehicle` | Page data fetch + dialog create action |
| `@/actions/fleet/mot-sync.ts` | `syncVehicleFromMot` | Called from AddVehicleDialog after plate entry |

**No new npm packages needed.** All required libraries are already in the project.

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── app/(app)/app/fleet/
│   └── vehicle-card/
│       ├── page.tsx              ← REPLACE placeholder with VehicleList server page
│       └── [id]/
│           └── page.tsx          ← NEW route shell (hands off to VehicleCard in Phase 14)
│
└── components/app/fleet/
    └── vehicles/                 ← NEW folder (mirrors drivers/ folder)
        ├── VehicleList.tsx       ← Client Component (mirrors DriverList.tsx)
        └── AddVehicleDialog.tsx  ← Client Component (two-step MOT flow)
```

### Pattern 1: Server Component Page → Client Component (established pattern)

**What:** Page server component fetches data and passes it as props to a pure client component.
**When to use:** All fleet list/card pages.

```typescript
// Source: existing src/app/(app)/app/fleet/driver-card/page.tsx
export default async function VehicleCardPage() {
  await verifyAppUser()

  const vehicles = await getVehiclesList()

  const yellowDays = parseInt(process.env['FLEET_LICENSE_YELLOW_DAYS'] ?? '60', 10)

  return (
    <VehicleList
      vehicles={vehicles}
      yellowDays={yellowDays}
    />
  )
}
```

### Pattern 2: AddVehicleDialog — Two-Step Flow

**What:** Step 1 = plate input + MOT preview. Step 2 = confirm + create.
**When to use:** AddVehicleDialog only (no other dialog in the fleet module has MOT integration).

```typescript
// AddVehicleDialog internal state machine
type Step = 'input' | 'previewing' | 'confirmed'

// Step 1: User types license plate → clicks "בדוק ב-MOT"
// → calls a NEW server action: lookupVehicleFromMot(licensePlate)
//   returns MotVehicleData (or error) WITHOUT writing to DB yet
//
// Step 2: Show MOT preview (tozeret, degem, shnat_yitzur, tzeva, etc.)
//   User selects company → clicks "צור כרטיס רכב"
// → calls createVehicle(plate, companyId) → gets vehicleId
// → calls syncVehicleFromMot(vehicleId, plate) → writes MOT data to DB
// → router.push(`/app/fleet/vehicle-card/${vehicleId}`)
```

**Critical detail:** A `lookupVehicleFromMot` action (read-only MOT fetch, no DB write) is needed for the preview step. `syncVehicleFromMot` writes to DB and should only be called after `createVehicle` succeeds.

### Pattern 3: VehicleList Filters (mirrors DriverList)

```typescript
// Client-side filtering — no server round trips
type StatusFilter = 'all' | 'active' | 'inactive'
type FitnessFilter = 'all' | 'red' | 'yellow' | 'green'

// Search fields for vehicles (differs from drivers):
// licensePlate | tozeret | degem | companyName | assignedDriverName
```

### Pattern 4: [id] Route Shell for Phase 14

```typescript
// Source: existing src/app/(app)/app/fleet/driver-card/[id]/page.tsx pattern
// Phase 15 creates the route; Phase 14 builds the VehicleCard component
// Phase 15 can ship a temporary placeholder:

export default async function VehicleCardDetailPage({ params }: Props) {
  await verifyAppUser()
  const { id } = await params
  // Placeholder until Phase 14 builds VehicleCard component
  return <ComingSoon label="כרטיס רכב" icon={Car} />
}
```

### Anti-Patterns to Avoid

- **Calling `syncVehicleFromMot` before `createVehicle`:** MOT sync needs an existing `vehicleId` to write to.
- **Using `verifySession()` in `syncVehicleFromMot`:** Currently wrong — this is a ChemoSys action, must use `verifyAppUser()`.
- **Calling `syncVehicleFromMot` for the MOT preview step:** That action writes to DB. Create a separate `lookupVehicleFromMot` (read-only) for the preview.
- **Duplicating fitness logic:** Use `computeVehicleFitnessStatus` from `VehicleFitnessLight.tsx` — it's already exported and tested.
- **Duplicating formatLicensePlate:** Import from `@/lib/format.ts` — it already handles 7-digit and 8-digit plates.
- **Hardcoding company list in dialog:** Fetch companies from Supabase server action, same pattern as `getActiveEmployeesWithoutDriver` in drivers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fitness status logic | Custom function in VehicleList | `computeVehicleFitnessStatus` from `VehicleFitnessLight.tsx` | Already handles all red/yellow/green edge cases |
| License plate formatting | Custom format logic | `formatLicensePlate()` from `@/lib/format.ts` | Handles both 7-digit (`xx-xxx-xx`) and 8-digit (`xxx-xx-xxx`) formats |
| Date display | Custom date string | `formatDate()` from `@/lib/format.ts` | Zero-padded dd/mm/yyyy, project-wide standard |
| Dialog UI shell | Custom modal | shadcn `Dialog` + `DialogContent` with `dir="rtl"` | Already used in DriverCard delete dialog, SMS dialog |
| Segment filter controls | Custom tab bar | Copy DriverList's segment control pattern | Already styled and RTL-correct |
| MOT number conversion | Custom parser | Strip `/\D/g` → `Number()` — already in `syncVehicleFromMot` | MOT API requires NUMBER not string; existing logic handles edge cases |

**Key insight:** This phase is almost entirely about assembling existing pieces into the right shape. The heavy lifting (server actions, types, shared components, MOT API) is done.

---

## Common Pitfalls

### Pitfall 1: `syncVehicleFromMot` Uses Wrong Auth Guard

**What goes wrong:** Dialog calls `syncVehicleFromMot` from the ChemoSys (app) context, but the function calls `verifySession()` (admin guard) instead of `verifyAppUser()`.
**Why it happens:** `mot-sync.ts` was built during admin phase and uses `verifySession()`.
**How to avoid:** Fix `mot-sync.ts` — change `verifySession()` to `verifyAppUser()` at the top of `syncVehicleFromMot` and `testMotApiConnection`. OR: create a new `lookupVehicleFromMot` in `mot-sync.ts` with `verifyAppUser()` and keep `syncVehicleFromMot` as-is for now (less surgical).
**Warning signs:** 401 errors when the dialog tries to call sync from ChemoSys session.

### Pitfall 2: DB Write Before Successful MOT Lookup

**What goes wrong:** Dialog creates vehicle row in DB, then MOT lookup fails — orphaned vehicle record with no MOT data.
**Why it happens:** Calling `createVehicle` before confirming MOT data exists.
**How to avoid:** Two-step dialog: Step 1 = MOT lookup preview (read-only). Only call `createVehicle` + `syncVehicleFromMot` when user clicks confirm on Step 2. This way partial failures don't leave orphaned rows.

### Pitfall 3: `mispar_rechev` Must Be NUMBER

**What goes wrong:** MOT API returns empty results if plate is sent as string.
**Why it happens:** The data.gov.il API filters on exact type — string "1234567" ≠ number 1234567.
**How to avoid:** Strip non-digits with `/\D/g`, then `Number(digitsOnly)`. Already handled in `syncVehicleFromMot` — copy same logic to `lookupVehicleFromMot`.
**Warning signs:** `json.result.total === 0` for valid plates.

### Pitfall 4: `moed_aliya_lakvish` Format "YYYY-M"

**What goes wrong:** MOT returns "2017-3" (no leading zero) — PostgreSQL DATE rejects this.
**Why it happens:** MOT API doesn't pad month numbers.
**How to avoid:** Use `parseMoedAliya()` (already in `mot-sync.ts`) when displaying or saving. For the preview in AddVehicleDialog, show raw display-only (no DB write at that point).

### Pitfall 5: VehicleList Table on Mobile

**What goes wrong:** Wide table overflows on small screens.
**Why it happens:** Vehicle list has more columns than driver list (plate, make, model, year, company, driver, fitness, status).
**How to avoid:** Follow ChemoSystem responsive iron rule — hide non-critical columns at `sm:` breakpoint. Minimum visible: fitness light + plate + make/model + status. Hide: year, company, driver on xs.

### Pitfall 6: `shadcn Tabs` RTL Direction Reset

**What goes wrong:** Dialog with tabs inside loses RTL direction.
**Why it happens:** shadcn `Tabs` resets `dir`. Known issue from DriverCard (Session #18-19).
**How to avoid:** Always set `dir="rtl"` on both `TabsList` and each `TabsContent` wrapper. AddVehicleDialog likely won't need tabs, but if multi-step uses tab-like navigation, apply same fix.

### Pitfall 7: Companies List Needs a Server Action

**What goes wrong:** AddVehicleDialog needs a company selector — companies data is not passed from the list page.
**Why it happens:** `getVehiclesList` returns VehicleListItem which only has `companyName` (string), not the full company list for a select dropdown.
**How to avoid:** Create `getCompaniesForSelect(): Promise<{id: string; name: string}[]>` server action (or reuse existing admin companies fetch). Call it inside the dialog `useEffect` on open, same pattern as `getActiveEmployeesWithoutDriver` in AddDriverDialog.

---

## Code Examples

### VehicleList Page (server component)

```typescript
// Source: pattern from src/app/(app)/app/fleet/driver-card/page.tsx
// File: src/app/(app)/app/fleet/vehicle-card/page.tsx

import { verifyAppUser } from '@/lib/dal'
import { getVehiclesList } from '@/actions/fleet/vehicles'
import { VehicleList } from '@/components/app/fleet/vehicles/VehicleList'

export default async function VehicleCardPage() {
  await verifyAppUser()

  const vehicles = await getVehiclesList()

  // VehicleFitnessLight uses yellowDays for test + insurance yellow threshold
  const yellowDays = parseInt(process.env['FLEET_LICENSE_YELLOW_DAYS'] ?? '60', 10)

  return <VehicleList vehicles={vehicles} yellowDays={yellowDays} />
}
```

### [id] Page Shell (route created in Phase 15, VehicleCard built in Phase 14)

```typescript
// Source: pattern from src/app/(app)/app/fleet/driver-card/[id]/page.tsx
// File: src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx

import { verifyAppUser } from '@/lib/dal'
import { ComingSoon } from '@/components/app/fleet/ComingSoon'
import { Car } from 'lucide-react'

type Props = {
  params: Promise<{ id: string }>
}

export default async function VehicleCardDetailPage({ params }: Props) {
  await verifyAppUser()
  await params // consume params (Phase 14 will use the id)

  // Temporary placeholder — VehicleCard component built in Phase 14
  return <ComingSoon label="כרטיס רכב" icon={Car} />
}
```

### lookupVehicleFromMot (new read-only action needed)

```typescript
// Source: based on syncVehicleFromMot in src/actions/fleet/mot-sync.ts
// New action: reads MOT data without writing to DB — for dialog preview step

'use server'
export async function lookupVehicleFromMot(
  licensePlate: string
): Promise<{ success: boolean; data?: MotVehicleData; error?: string }> {
  await verifyAppUser()  // ChemoSys guard, not verifySession

  const digitsOnly = licensePlate.replace(/\D/g, '')
  const plateNumber = Number(digitsOnly)

  if (!digitsOnly || isNaN(plateNumber) || plateNumber === 0) {
    return { success: false, error: 'מספר רישוי לא תקין' }
  }

  const url = new URL(MOT_API_BASE)
  url.searchParams.set('resource_id', MOT_RESOURCE_ID)
  url.searchParams.set('filters', JSON.stringify({ mispar_rechev: plateNumber }))
  url.searchParams.set('limit', '1')
  url.searchParams.set('records_format', 'objects')
  url.searchParams.set('include_total', 'true')

  // ... fetch + error handling (same as syncVehicleFromMot)
  // Returns data WITHOUT writing to DB
}
```

### AddVehicleDialog Two-Step State

```typescript
// Source: pattern from AddDriverDialog + new MOT preview step
'use client'

type Step = 'input' | 'previewing' | 'creating'

export function AddVehicleDialog({ open, onClose }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [plate, setPlate] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [motData, setMotData] = useState<MotVehicleData | null>(null)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [isLooking, startLookupTransition] = useTransition()
  const [isCreating, startCreatingTransition] = useTransition()

  // Load companies on open
  useEffect(() => {
    if (!open) return
    setStep('input')
    setPlate('')
    setMotData(null)
    getCompaniesForSelect().then(setCompanies)
  }, [open])

  function handleLookup() {
    startLookupTransition(async () => {
      const result = await lookupVehicleFromMot(plate)
      if (!result.success) {
        toast.error(result.error ?? 'שגיאה בחיפוש MOT')
        return
      }
      setMotData(result.data!)
      setStep('previewing')
    })
  }

  function handleCreate() {
    if (!companyId) return
    startCreatingTransition(async () => {
      const createResult = await createVehicle(plate, companyId)
      if (!createResult.success) {
        toast.error(createResult.error ?? 'שגיאה ביצירת כרטיס רכב')
        return
      }
      // Sync MOT data to DB (fire, don't block navigation on failure)
      await syncVehicleFromMot(createResult.vehicleId!, plate)
      toast.success('כרטיס רכב נפתח')
      onClose()
      router.push(`/app/fleet/vehicle-card/${createResult.vehicleId}`)
    })
  }
}
```

### VehicleList Row with VehicleFitnessLight

```typescript
// Source: DriverList.tsx pattern + VehicleFitnessLight component
import { VehicleFitnessLight } from '@/components/app/fleet/shared/VehicleFitnessLight'
import { formatLicensePlate } from '@/lib/format'

// In the table row:
<td className="px-4 py-3.5">
  <VehicleFitnessLight
    testExpiryDate={vehicle.testExpiryDate}
    insuranceMinExpiry={vehicle.insuranceMinExpiry}
    documentMinExpiry={vehicle.documentMinExpiry}
    yellowDays={yellowDays}
  />
</td>
<td className="px-4 py-3.5 font-mono font-semibold text-foreground">
  {formatLicensePlate(vehicle.licensePlate)}
</td>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| One-step create (data entry form) | Two-step: MOT lookup → preview → confirm | Prevents manual data entry errors; MOT is source of truth |
| Custom fitness logic per component | `computeVehicleFitnessStatus()` exported from `VehicleFitnessLight.tsx` | Single source of truth for red/yellow/green logic |
| Multiple MOT calls | Read-once `lookupVehicleFromMot`, write-once `syncVehicleFromMot` | Clean separation of preview vs. persistence |

---

## Open Questions

1. **Phase 14 dependency for `[id]` page**
   - What we know: Phase 15 creates the `[id]` route; Phase 14 builds `VehicleCard` component
   - What's unclear: Does Phase 15 need to produce a fully functional `[id]` page, or is a `ComingSoon` placeholder acceptable?
   - Recommendation: Phase 15 creates the route with `ComingSoon` placeholder; Phase 14 replaces it. The planner should reflect this as a dependency note, not a blocker.

2. **`getCompaniesForSelect` action**
   - What we know: An action returning `{id, name}[]` for the company selector is needed by AddVehicleDialog
   - What's unclear: Does one already exist in the admin actions?
   - Recommendation: Check `src/actions/companies.ts` or `src/actions/employees.ts` — if not present, create a minimal one in `src/actions/fleet/vehicles.ts`.

3. **MOT sync on vehicle creation: sync errors**
   - What we know: If `syncVehicleFromMot` fails after `createVehicle` succeeds, vehicle exists in DB with no MOT data
   - What's unclear: Should the dialog show an error and allow the user to retry sync?
   - Recommendation: Show a toast warning "כרטיס נפתח, סנכרון MOT נכשל — ניתן לסנכרן מכרטיס הרכב". Don't block navigation. Phase 14 VehicleCard will have a "סנכרן מ-MOT" button.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/actions/fleet/vehicles.ts` (all 21 server actions, types)
- Direct codebase inspection — `src/actions/fleet/mot-sync.ts` (API URL, resource ID, plate→number conversion, parseMoedAliya)
- Direct codebase inspection — `src/components/app/fleet/drivers/DriverList.tsx` (list pattern template)
- Direct codebase inspection — `src/components/app/fleet/drivers/AddDriverDialog.tsx` (dialog pattern template)
- Direct codebase inspection — `src/components/app/fleet/shared/VehicleFitnessLight.tsx` (fitness logic, props)
- Direct codebase inspection — `src/lib/fleet/vehicle-types.ts` (VehicleListItem shape)
- Direct codebase inspection — `src/app/(app)/app/fleet/vehicle-card/page.tsx` (placeholder to replace)
- Direct codebase inspection — `src/app/(app)/app/fleet/driver-card/[id]/page.tsx` (page pattern)
- Direct codebase inspection — `src/app/(app)/app/fleet/layout.tsx` (FleetLayout / auth guard)
- Direct codebase inspection — `src/components/app/fleet/FleetSidebar.tsx` (sidebar `/app/fleet/vehicle-card` route already configured)

### Secondary (MEDIUM confidence)
- MEMORY.md project notes — Phase 12-13 decisions (MOT API guard, parseMoedAliya, vehicle_tests INSERT-only, verifyAppUser pattern)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — exact patterns exist in DriverList/AddDriverDialog; direct codebase reference
- Pitfalls: HIGH — two pitfalls (wrong auth guard, mispar_rechev type) are directly documented in existing code comments; others derived from established project patterns

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable — no external library changes affect this phase)
