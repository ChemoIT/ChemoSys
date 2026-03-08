# Phase 19: Vehicle Card Redesign — Assignment Tab + Documents + Cleanup — Research

**Researched:** 2026-03-08
**Domain:** React component refactor, activity-journal pattern, VehicleCard shell update
**Confidence:** HIGH — all findings from direct codebase inspection

---

## Summary

Phase 19 is primarily a **component refactor + new tab build**, not a DB migration phase. The database (migration 00027) is already deployed in Supabase. The code changes fall into three distinct tracks:

**Track A — VehicleAssignmentSection rewrite (Tab 4):** The existing component is a simple single-driver dropdown. It must be replaced with a full `VehicleAssignmentSection` that handles vehicle category selection (camp vs. assigned), camp responsible fields, driver activity journal, and project activity journal. All four DB tables/columns needed are already live in Supabase (`vehicle_category`, `camp_responsible_*` columns on `vehicles`, `vehicle_driver_journal`, `vehicle_project_journal`).

**Track B — VehicleDocumentsSection (Tab 5):** This component is **already built and working** (it was implemented in phase 14). The server actions (`addVehicleDocument`, `updateVehicleDocument`, `deleteVehicleDocument`, `getVehicleDocumentNameSuggestions`) all exist in `vehicles.ts`. The `VehicleDocument` type exists in `vehicle-types.ts`. The `fleet-vehicle-documents` storage bucket is live. Nothing in Tab 5 needs to be built — only verified.

**Track C — VehicleCard shell cleanup:** Remove the `costs` tab from VehicleCard.tsx (8 tabs → 7 tabs). Delete `VehicleCostsSection.tsx`. Rename the `assignment` tab label from "שיוך נהג" to "צמידות".

**Primary recommendation:** Build Track A (new VehicleAssignmentSection) first, verify Track B is already wired (it is), then do Track C shell cleanup last.

---

## Standard Stack

No new libraries needed. All tools already in use:

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Server Actions | 16 | `verifyAppUser()` guard + DB mutations | Project standard — all fleet actions use this |
| @supabase/ssr | current | Supabase queries | Project standard |
| sonner | current | Toast notifications | Project standard |
| lucide-react | current | Icons | Project standard |
| shadcn/ui | current | Button, Dialog, Label, Input | Project standard |

### No installation required
All dependencies for Phase 19 are already in `package.json`.

---

## Architecture Patterns

### Recommended File Structure Changes

```
src/
├── actions/fleet/vehicles.ts         ← ADD: journal CRUD actions + getActiveProjectsForSelect
├── lib/fleet/vehicle-types.ts        ← ADD: VehicleDriverJournal, VehicleProjectJournal types + vehicle_category fields in VehicleFull
├── components/app/fleet/vehicles/
│   ├── VehicleCard.tsx               ← MODIFY: remove costs tab, rename assignment tab label, update imports
│   ├── VehicleAssignmentSection.tsx  ← REWRITE: full assignment tab (category + camp fields + journals)
│   ├── VehicleDocumentsSection.tsx   ← NO CHANGE (already complete)
│   └── VehicleCostsSection.tsx       ← DELETE
└── app/(app)/app/fleet/vehicle-card/[id]/page.tsx  ← ADD: fetch journal data in parallel
```

### Pattern 1: Activity Journal — Single Active Record Rule
**What:** `vehicle_driver_journal` and `vehicle_project_journal` use end_date IS NULL = currently active. Business rule: only one active record at a time.
**When to use:** Whenever user picks a new driver or project assignment.

Server action pattern for "assign new driver":
```typescript
// Source: migration 00027 comments + project patterns
export async function assignDriverJournal(
  vehicleId: string,
  driverId: string,
  startDate: string
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Step 1: Close current active record (if any)
  await supabase
    .from('vehicle_driver_journal')
    .update({ end_date: startDate })  // close yesterday or the start date
    .eq('vehicle_id', vehicleId)
    .is('end_date', null)

  // Step 2: Insert new active record
  const { error } = await supabase
    .from('vehicle_driver_journal')
    .insert({
      vehicle_id: vehicleId,
      driver_id: driverId,
      start_date: startDate,
      end_date: null,
      created_by: userId,
    })

  if (error) return { success: false, error: 'שגיאה בשיוך הנהג' }
  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}
```

### Pattern 2: Camp Vehicle — Direct DB Column Update
**What:** `vehicle_category`, `camp_responsible_type`, `camp_responsible_name`, `camp_responsible_phone` are plain columns on `vehicles`, updated via `updateVehicleDetails`.
**When to use:** User selects "רכב מחנה" or changes camp responsible fields.

The existing `updateVehicleDetails` action (and its `UpdateVehicleInput` type) must be **extended** to include these new fields. No new action needed — just add fields to existing action.

```typescript
// Extend UpdateVehicleInput in vehicles.ts
export type UpdateVehicleInput = {
  // ... existing fields ...
  vehicleCategory?: 'camp' | 'assigned' | null
  campResponsibleType?: 'project_manager' | 'other' | null
  campResponsibleName?: string | null
  campResponsiblePhone?: string | null
}
```

### Pattern 3: Phone Validation (IRON RULE)
**What:** `camp_responsible_phone` must pass through `normalizePhone()` from `@/lib/format`.
**When to use:** Always — before saving any phone field to DB.

```typescript
// Source: MEMORY.md IRON RULE
import { normalizePhone } from '@/lib/format'
const phone = normalizePhone(input.campResponsiblePhone ?? '')
// if phone is null after normalize, don't save to DB
```

### Pattern 4: VehicleFull — Missing Fields
**What:** `getVehicleById()` in `vehicles.ts` does NOT select `vehicle_category`, `camp_responsible_*` from the vehicles table. These fields need to be added to the SELECT and mapped in `VehicleFull`.
**When to use:** Must fix this before building VehicleAssignmentSection.

Fields missing from the current `getVehicleById()` SELECT:
- `vehicle_category`
- `camp_responsible_type`
- `camp_responsible_name`
- `camp_responsible_phone`

Fields missing from `VehicleFull` type:
- `vehicleCategory: string | null`
- `campResponsibleType: string | null`
- `campResponsibleName: string | null`
- `campResponsiblePhone: string | null`

### Pattern 5: Journal Data — Server Component Fetch
**What:** Driver journal and project journal data for a vehicle must be fetched server-side and passed as props to `VehicleAssignmentSection`.
**When to use:** In the `/app/fleet/vehicle-card/[id]/page.tsx` server component, alongside existing parallel fetches.

```typescript
// In page.tsx — add to Promise.all
const [vehicle, tests, insurance, documents, driverJournal, projectJournal] =
  await Promise.all([
    getVehicleById(id),
    getVehicleTests(id),
    getVehicleInsurance(id),
    getVehicleDocuments(id),
    getVehicleDriverJournal(id),   // NEW
    getVehicleProjectJournal(id),  // NEW
  ])
```

### Pattern 6: Active Projects Query
**What:** The projects table has a `status` column with values `('active', 'view_only', 'inactive')`. For project assignment, only `status = 'active'` projects should appear in the dropdown.
**When to use:** `getActiveProjectsForSelect()` — new function needed in `vehicles.ts`.

```typescript
export async function getActiveProjectsForSelect(): Promise<{ id: string; name: string; projectNumber: string }[]> {
  await verifyAppUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id, name, project_number')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name')
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, projectNumber: p.project_number }))
}
```

### Pattern 7: Tab Label + Tab Value Rename
**What:** Current tab value is `'assignment'` with label `'שיוך נהג'`. Must rename label to `'צמידות'` and update the icon (User → GitBranch or Shuffle).
**When to use:** VehicleCard.tsx TAB_LABELS map + tabs array.
**Note:** Keep tab VALUE as `'assignment'` (changing the value would reset dirty tracking state and is unnecessary).

### Anti-Patterns to Avoid
- **Building a DB trigger for the single-active-record rule:** Decision [16-01] explicitly says enforce in Server Actions only, not in DB triggers.
- **Calling `assignDriverToVehicle` for journal entries:** The old `assignDriverToVehicle` action updates `vehicles.assigned_driver_id` — this is NOT the same as inserting a `vehicle_driver_journal` record. The journal is the new canonical assignment mechanism.
- **Exporting types/constants from 'use server' files:** IRON RULE [12-02] — new types for journal records must go in `vehicle-types.ts`, not in `vehicles.ts`.
- **Writing phone directly without normalizePhone:** IRON RULE — `camp_responsible_phone` must be validated/normalized.
- **Removing dirty tracking from Tab 4:** VehicleAssignmentSection needs `onEditingChange` prop for the camp fields sub-form.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date input UI | Custom date picker | `FleetDateInput` from `@/components/app/fleet/shared/FleetDateInput` | Already handles partial input, internal state, yyyy-mm-dd output |
| File preview | Custom viewer | `FleetUploadZone` + `FleetFilePreview` from shared/ | Already handles PDF/image, drag-drop, camera |
| Expiry indicator | Custom display | `ExpiryIndicator` from shared/ | Color-coded, uses daysUntil from format.ts |
| Alert toggle | Custom switch | `AlertToggle` from shared/ | Standardized toggle with label |
| Phone normalization | Custom regex | `normalizePhone()` from `@/lib/format` | IRON RULE — project-wide standard |
| Active driver list | New query | `getActiveDriversForAssignment()` — already exists in vehicles.ts | Already filters active drivers |

**Key insight:** The shared fleet components (`FleetDateInput`, `FleetUploadZone`, `AlertToggle`, `ExpiryIndicator`) are the correct tools for all date/file/alert UI in this phase. Reuse them directly.

---

## Common Pitfalls

### Pitfall 1: Thinking VehicleDocumentsSection Needs to Be Built
**What goes wrong:** Developer reads phase description ("copy from DriverDocumentsSection") and builds a new component.
**Why it happens:** Phase description says "copy" but the copy was already done in Phase 14.
**How to avoid:** `VehicleDocumentsSection.tsx` already exists and is fully wired in `VehicleCard.tsx` as Tab 6. It uses `addVehicleDocument`, `updateVehicleDocument`, `deleteVehicleDocument`, `getVehicleDocumentNameSuggestions` — all in vehicles.ts. **No work needed on this tab.**
**Warning signs:** If a task says "create VehicleDocumentsSection.tsx" — stop and verify first.

### Pitfall 2: Forgetting to Update getVehicleById to SELECT New Fields
**What goes wrong:** VehicleAssignmentSection receives `vehicle.vehicleCategory` as undefined/null even though the DB has data.
**Why it happens:** `getVehicleById()` SELECT query does not include `vehicle_category`, `camp_responsible_*`. They exist in DB (migration 00027) but are not fetched.
**How to avoid:** Update SELECT in `getVehicleById()` AND update the `return {}` mapping AND add fields to `VehicleFull` type.
**Warning signs:** TypeScript will not catch this — the type cast `(data as VehicleFull)` would silently miss the field.

### Pitfall 3: Conflating `assigned_driver_id` Column With Journal
**What goes wrong:** Developer sets `vehicles.assigned_driver_id` instead of inserting into `vehicle_driver_journal`.
**Why it happens:** Old `VehicleAssignmentSection` used `assignDriverToVehicle()` which updates `assigned_driver_id`. The journal is a new concept from Phase 19.
**How to avoid:** New assignment tab writes to `vehicle_driver_journal`. The `assigned_driver_id` column on vehicles may remain for legacy compatibility (fitness light uses it), but the journal is the new source of truth for "current driver" in Tab 4.
**Warning signs:** If test shows driver assigned in Tab 4 but not in the journal table, this pitfall occurred.

### Pitfall 4: camp_responsible_phone Validation
**What goes wrong:** Any phone string including non-phone values gets saved to DB.
**Why it happens:** Fields are free-text without `normalizePhone()`.
**How to avoid:** Server action must call `normalizePhone()` before saving. If result is null, save null.
**Warning signs:** DB contains 8-digit numbers or ת.ז. in phone field.

### Pitfall 5: Tab 4 Dirty Tracking for Camp Sub-Form
**What goes wrong:** User edits camp responsible name → switches tab → no unsaved changes warning.
**Why it happens:** VehicleAssignmentSection does not implement `onEditingChange` callback.
**How to avoid:** Camp fields sub-form is a form (save button). Wire `onEditingChange` to compare current form values vs. original vehicle data. Journal entries are NOT form-based (they save immediately) — only camp fields need dirty tracking.
**Warning signs:** User can navigate away from Tab 4 with unsaved camp field changes without a warning.

### Pitfall 6: Missing TAB_LABELS Entry for Tab 4
**What goes wrong:** Unsaved changes Dialog shows "שיוך נהג" instead of "צמידות".
**Why it happens:** `TAB_LABELS` map in `VehicleCard.tsx` still has `assignment: 'שיוך נהג'`.
**How to avoid:** Update the `TAB_LABELS` record when renaming the tab label.

---

## Code Examples

### Current Tab Structure (8 tabs) — BEFORE
```typescript
// Source: VehicleCard.tsx lines 323-342
{ value: 'details',    label: 'פרטי הרכב',  icon: Car },
{ value: 'tests',      label: 'טסטים',      icon: ClipboardCheck },
{ value: 'insurance',  label: 'ביטוח',      icon: Shield },
{ value: 'assignment', label: 'שיוך נהג',   icon: User },
{ value: 'costs',      label: 'עלויות',     icon: DollarSign },
{ value: 'documents',  label: 'מסמכים',     icon: Paperclip },
{ value: 'notes',      label: 'הערות',      icon: FileText },
{ value: 'km',         label: 'ק"מ',         icon: Gauge },
```

### Target Tab Structure (7 tabs) — AFTER
```typescript
{ value: 'details',    label: 'פרטי הרכב',  icon: Car },
{ value: 'tests',      label: 'טסטים',      icon: ClipboardCheck },
{ value: 'insurance',  label: 'ביטוח',      icon: Shield },
{ value: 'assignment', label: 'צמידות',     icon: Shuffle },   // label + icon changed
// costs tab REMOVED
{ value: 'documents',  label: 'מסמכים',     icon: Paperclip },
{ value: 'notes',      label: 'הערות',      icon: FileText },
{ value: 'km',         label: 'ק"מ',         icon: Gauge },
```

### New Types Needed in vehicle-types.ts
```typescript
// Source: migration 00027 schema
export type VehicleDriverJournal = {
  id: string
  vehicleId: string
  driverId: string
  driverName: string | null  // joined from drivers+employees
  startDate: string          // yyyy-mm-dd
  endDate: string | null     // null = currently active
  createdAt: string
}

export type VehicleProjectJournal = {
  id: string
  vehicleId: string
  projectId: string
  projectName: string        // joined from projects
  projectNumber: string      // joined from projects
  startDate: string          // yyyy-mm-dd
  endDate: string | null     // null = currently active
  createdAt: string
}

// Fields to ADD to VehicleFull:
// vehicleCategory: 'camp' | 'assigned' | null
// campResponsibleType: 'project_manager' | 'other' | null
// campResponsibleName: string | null
// campResponsiblePhone: string | null
```

### VehicleAssignmentSection New Props Shape
```typescript
// New props for the rewritten component
type Props = {
  vehicleId: string
  vehicle: VehicleFull          // for vehicleCategory + campResponsible* fields
  driverJournal: VehicleDriverJournal[]
  projectJournal: VehicleProjectJournal[]
  onEditingChange?: (isEditing: boolean) => void  // for camp sub-form dirty tracking
}
```

### Journal Read Query Pattern
```typescript
// Source: migration 00027 + project patterns
export async function getVehicleDriverJournal(vehicleId: string): Promise<VehicleDriverJournal[]> {
  await verifyAppUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicle_driver_journal')
    .select(`
      id, vehicle_id, driver_id, start_date, end_date, created_at,
      drivers ( employees ( first_name, last_name ) )
    `)
    .eq('vehicle_id', vehicleId)
    .order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const driver = (row.drivers as unknown) as {
      employees: { first_name: string; last_name: string } | null
    } | null
    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      driverId: row.driver_id,
      driverName: driver?.employees
        ? `${driver.employees.first_name} ${driver.employees.last_name}`
        : null,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
    }
  })
}
```

---

## Exact Current State Inventory

### What EXISTS and is COMPLETE (no changes needed):

| Item | Location | Status |
|------|----------|--------|
| `VehicleDocumentsSection.tsx` | `src/components/app/fleet/vehicles/` | COMPLETE — fully implemented Tab 5 |
| `addVehicleDocument()` | `vehicles.ts` lines 675–705 | EXISTS |
| `updateVehicleDocument()` | `vehicles.ts` lines 717–738 | EXISTS — uses `update_vehicle_document` RPC |
| `deleteVehicleDocument()` | `vehicles.ts` lines 740–758 | EXISTS — uses `soft_delete_vehicle_document` RPC |
| `getVehicleDocumentNameSuggestions()` | `vehicles.ts` lines 764–786 | EXISTS |
| `VehicleDocument` type | `vehicle-types.ts` lines 155–164 | EXISTS |
| `fleet-vehicle-documents` storage bucket | Supabase | LIVE (migration 00026) |
| `vehicle_documents` table | Supabase | LIVE (migration 00025) |
| `vehicle_driver_journal` table | Supabase | LIVE (migration 00027) |
| `vehicle_project_journal` table | Supabase | LIVE (migration 00027) |
| `vehicle_category` column on vehicles | Supabase | LIVE (migration 00027) |
| `camp_responsible_*` columns on vehicles | Supabase | LIVE (migration 00027) |
| `getActiveDriversForAssignment()` | `vehicles.ts` lines 821–859 | EXISTS — returns active drivers |
| `VehicleCostsSection.tsx` | `src/components/app/fleet/vehicles/` | EXISTS — placeholder only, DELETE |

### What NEEDS TO BE BUILT/CHANGED:

| Item | Action | Location |
|------|--------|----------|
| `VehicleFull` type | ADD 4 fields: `vehicleCategory`, `campResponsibleType`, `campResponsibleName`, `campResponsiblePhone` | `vehicle-types.ts` |
| `VehicleDriverJournal` type | ADD new type | `vehicle-types.ts` |
| `VehicleProjectJournal` type | ADD new type | `vehicle-types.ts` |
| `getVehicleById()` | ADD 4 fields to SELECT + return mapping | `vehicles.ts` |
| `UpdateVehicleInput` type | ADD 4 assignment fields | `vehicles.ts` |
| `updateVehicleDetails()` | ADD 4 fields to UPDATE + normalizePhone | `vehicles.ts` |
| `getVehicleDriverJournal()` | ADD new function | `vehicles.ts` |
| `getVehicleProjectJournal()` | ADD new function | `vehicles.ts` |
| `assignDriverJournal()` | ADD new function (close current + insert new) | `vehicles.ts` |
| `assignProjectJournal()` | ADD new function (close current + insert new) | `vehicles.ts` |
| `getActiveProjectsForSelect()` | ADD new function | `vehicles.ts` |
| `VehicleAssignmentSection.tsx` | REWRITE completely | `src/components/app/fleet/vehicles/` |
| `VehicleCard.tsx` | MODIFY: remove costs tab, rename assignment label, update imports | `src/components/app/fleet/vehicles/` |
| `/[id]/page.tsx` | ADD: fetch journal data in Promise.all + pass as props | `src/app/(app)/app/fleet/vehicle-card/[id]/` |
| `VehicleCostsSection.tsx` | DELETE | `src/components/app/fleet/vehicles/` |

---

## Open Questions

1. **Should `vehicles.assigned_driver_id` be kept in sync with the journal?**
   - What we know: The fitness light (`VehicleFitnessLight`) currently checks expiry dates, not `assigned_driver_id`. The driver card computed status (`driver_computed_status` view) references `vehicles.assigned_driver_id` to determine if a driver is "active via vehicle assignment".
   - What's unclear: After this phase, journal is the new source of truth for Tab 4. Should `assigned_driver_id` be updated by the journal write action to keep the driver's computed status correct?
   - Recommendation: YES — when `assignDriverJournal()` creates a new active entry, also update `vehicles.assigned_driver_id` to match. When removing all assignments (end_date set, no new entry), set `assigned_driver_id = null`. This preserves backward compatibility with the existing `driver_computed_status` view.

2. **What happens to old `assignDriverToVehicle()` action?**
   - What we know: Still imported in `VehicleAssignmentSection.tsx` (old version). New section will not use it.
   - What's unclear: Does anything else call it?
   - Recommendation: Keep it in `vehicles.ts` for now (don't delete). Remove its import from `VehicleAssignmentSection.tsx` during the rewrite.

3. **Journal "end" action — can a vehicle be unassigned from a driver (no new driver)?**
   - What we know: Requirements say "only one active driver at a time". The "שינוי" button opens the journal form to pick a new driver + date.
   - What's unclear: Is there a "remove current driver" flow (set end_date on current record without adding a new one)?
   - Recommendation: Implement an "end current assignment" button that closes the active record without starting a new one. This sets `end_date` and sets `vehicles.assigned_driver_id = null`.

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `src/components/app/fleet/vehicles/VehicleCard.tsx` — exact 8-tab structure
- Direct file read: `src/components/app/fleet/vehicles/VehicleAssignmentSection.tsx` — old design
- Direct file read: `src/components/app/fleet/vehicles/VehicleDocumentsSection.tsx` — already complete
- Direct file read: `src/actions/fleet/vehicles.ts` — all existing server actions confirmed
- Direct file read: `src/lib/fleet/vehicle-types.ts` — missing fields confirmed
- Direct file read: `supabase/migrations/00027_vehicle_card_redesign.sql` — DB schema confirmed live
- Direct file read: `supabase/migrations/00014_projects_rebuild.sql` — projects.status field confirmed
- Direct file read: `src/app/(app)/app/fleet/vehicle-card/[id]/page.tsx` — server component fetch pattern

### Secondary (MEDIUM confidence)
- `MEMORY.md` — IRON RULE: normalizePhone(), project-wide patterns confirmed

---

## Metadata

**Confidence breakdown:**
- What exists vs. what needs building: HIGH — read directly from source files
- Journal write pattern: HIGH — based on migration comments + existing project Server Action patterns
- `assigned_driver_id` sync question: MEDIUM — open question, recommendation based on view analysis
- Projects status filter: HIGH — read directly from migration 00014

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable codebase, no fast-moving deps)
