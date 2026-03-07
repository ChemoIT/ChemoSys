# Phase 12: Phase 10B — Vehicle Suppliers Admin Settings UI + MOT API Integration — Research

**Researched:** 2026-03-07
**Domain:** Admin Settings UI (CRUD for DB lookup table) + Israeli MOT API integration (data.gov.il)
**Confidence:** HIGH (both domains verified from codebase and SKILL.md)

---

## Summary

Phase 12 has two distinct deliverables that are independent but logically grouped:

**Part A — Vehicle Suppliers Admin UI:** A CRUD management page for the `vehicle_suppliers` table (already created in Phase 11). This is an admin-facing page under `/admin/settings` or a dedicated admin page. The table stores garages, leasing companies, insurance companies, fuel card providers, etc. Each supplier has type, name, contact info, and is_active flag. This is a standard admin CRUD feature — full list/add/edit/delete — following the exact patterns used throughout the admin panel.

**Part B — MOT API Integration:** A Server Action (and optionally a UI trigger in the vehicle card) that queries the Israeli Ministry of Transportation vehicle registry API (data.gov.il resource `053cea08-09bc-40ec-8f7a-156f0677aff3`) by license plate number and populates/updates the MOT fields on the `vehicles` row. The MOT skill (`israel-mot-vehicle-query`) provides the complete API reference. This is a pure server-side integration — no external library needed, only `fetch()`.

The two parts are independent: Part A can be delivered as its own plan, Part B as another. No new npm packages are required for either part.

**Primary recommendation:** Build Part A as a standalone admin page with a DataTable-style list + Dialog-based add/edit form. Build Part B as a Server Action `syncVehicleFromMot(vehicleId, licensePlate)` called from a "Sync MOT" button in the vehicle card UI (Phase 14/15). In this phase, deliver the Server Action + a test/trigger UI in Admin Settings (mirrors the "Test Connection" buttons pattern in IntegrationAccordion).

---

## Standard Stack

### Core (no new libraries needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Server Actions | existing | All mutations — `verifySession()` guard | Project-wide security rule |
| Supabase (server client) | existing | DB queries — vehicle_suppliers CRUD | Already in use for all fleet actions |
| shadcn/ui | existing | Dialog, Table, Form, Input, Select | Already installed; consistent UI |
| Tailwind v4 | existing | Styling | Project standard |
| `fetch()` (built-in) | Node.js built-in | MOT API HTTP calls | No library needed — public REST API, no auth |
| sonner (toast) | existing | Success/error feedback | Already in root layout |

### No new npm packages required

This phase is 100% UI + Server Actions. The MOT API is a public REST API requiring no authentication, so `fetch()` is sufficient. No API client library is needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── actions/
│   └── fleet/
│       ├── vehicle-suppliers.ts   # NEW — CRUD Server Actions for vehicle_suppliers
│       └── mot-sync.ts            # NEW — syncVehicleFromMot() Server Action
├── app/
│   └── (admin)/admin/
│       └── vehicle-suppliers/
│           └── page.tsx           # NEW — Admin CRUD page for suppliers
│               (OR extend /admin/settings as new accordion section)
└── components/
    └── admin/
        └── vehicle-suppliers/
            ├── VehicleSuppliersTable.tsx   # List with edit/delete actions
            ├── AddSupplierDialog.tsx       # Add new supplier dialog
            └── EditSupplierDialog.tsx      # Edit supplier dialog
```

**Decision to make:** Should vehicle suppliers live under `/admin/settings` (as a new accordion item) or as a standalone `/admin/vehicle-suppliers` page? See Open Questions below.

### Pattern 1: Admin Settings Accordion Extension

The `IntegrationAccordion` component already has 7 items. Vehicle Suppliers is a **data management** concern (not an integration setting), so it fits better as a standalone admin page. However, the Fleet Settings accordion could gain a "Sync MOT" test button (mirroring the `testSmsConnection()` pattern).

**Recommended approach:**
- `/admin/vehicle-suppliers` — standalone CRUD page (same layout as `/admin/employees`, `/admin/projects`)
- `/admin/settings` → Fleet accordion → add "MOT API sync test" button

### Pattern 2: Server Action Guard Pattern (from existing codebase)

All admin Server Actions use `verifySession()` (not `verifyAppUser()`):

```typescript
// Source: src/actions/settings.ts (verified)
'use server'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export async function createVehicleSupplier(formData: FormData) {
  await verifySession()  // Admin-only guard
  const supabase = await createClient()
  // ...
}
```

### Pattern 3: Vehicle Suppliers CRUD — Supabase Direct (no RPC needed for INSERT/UPDATE)

For the vehicle_suppliers table, INSERT and UPDATE can go through the Supabase client directly (RLS allows it). Only soft-delete MUST use the `soft_delete_vehicle_supplier` RPC (established in Phase 11).

```typescript
// INSERT — direct (RLS WITH CHECK true for authenticated)
const { data, error } = await supabase
  .from('vehicle_suppliers')
  .insert({
    supplier_type: type,
    name,
    contact_name: contactName,
    phone: normalizePhone(phone) ?? phone,
    email,
    address,
    notes,
    created_by: user.authUserId,
    updated_by: user.authUserId,
  })
  .select()
  .single()

// UPDATE — direct (RLS USING true for authenticated)
const { error } = await supabase
  .from('vehicle_suppliers')
  .update({ name, ..., updated_by: user.authUserId, updated_at: new Date().toISOString() })
  .eq('id', id)

// SOFT-DELETE — must use RPC (RLS SELECT blocks direct UPDATE on deleted_at)
const { error } = await supabase.rpc('soft_delete_vehicle_supplier', {
  p_id: id,
  p_user_id: user.authUserId,
})
```

### Pattern 4: MOT API Server Action

```typescript
// Source: israel-mot-vehicle-query SKILL.md (HIGH confidence)
// src/actions/fleet/mot-sync.ts
'use server'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const MOT_RESOURCE_ID = '053cea08-09bc-40ec-8f7a-156f0677aff3'
const MOT_BASE_URL = 'https://data.gov.il/api/3/action/datastore_search'

export async function syncVehicleFromMot(
  vehicleId: string,
  licensePlate: string
): Promise<{ success: boolean; data?: MotVehicleData; error?: string }> {
  await verifySession()

  // License plate must be numeric for the MOT API
  const plateNumber = Number(licensePlate.replace(/\D/g, ''))
  if (!plateNumber) return { success: false, error: 'מספר רישוי לא תקין' }

  const url = new URL(MOT_BASE_URL)
  url.searchParams.set('resource_id', MOT_RESOURCE_ID)
  url.searchParams.set('filters', JSON.stringify({ mispar_rechev: plateNumber }))
  url.searchParams.set('limit', '1')
  url.searchParams.set('records_format', 'objects')
  url.searchParams.set('include_total', 'true')

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 0 },  // never cache — always fresh from MOT
  })

  if (!res.ok) return { success: false, error: `שגיאת רשת: ${res.status}` }

  const json = await res.json() as MotApiResponse
  if (!json.success || json.result.total === 0) {
    return { success: false, error: 'הרכב לא נמצא ברשומות משרד הרישוי' }
  }

  const v = json.result.records[0]
  const supabase = await createClient()

  // Update MOT fields on the vehicle row
  const { error } = await supabase
    .from('vehicles')
    .update({
      tozeret_nm:         v.tozeret_nm       ?? null,
      degem_nm:           v.degem_nm         ?? null,
      kinuy_mishari:      v.kinuy_mishari    ?? null,
      shnat_yitzur:       v.shnat_yitzur     ?? null,
      tzeva_rechev:       v.tzeva_rechev     ?? null,
      sug_delek_nm:       v.sug_delek_nm     ?? null,
      misgeret:           v.misgeret         ?? null,
      degem_manoa:        v.degem_manoa      ?? null,
      ramat_gimur:        v.ramat_gimur      ?? null,
      kvutzat_zihum:      String(v.kvutzat_zihum ?? ''),
      baalut:             v.baalut           ?? null,
      moed_aliya_lakvish: parseMoedAliya(v.moed_aliya_lakvish),
      mot_last_sync_at:   new Date().toISOString(),
    })
    .eq('id', vehicleId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true, data: v }
}
```

**Critical MOT quirk: `moed_aliya_lakvish` format**

The MOT API returns `moed_aliya_lakvish` as `"YYYY-M"` (e.g. `"2017-3"`) — NOT a standard ISO date. Must parse before storing as PostgreSQL `DATE`:

```typescript
function parseMoedAliya(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Format: "YYYY-M" or "YYYY-MM"
  const parts = raw.split('-')
  if (parts.length < 2) return null
  const year = parts[0]
  const month = parts[1].padStart(2, '0')
  return `${year}-${month}-01`  // first of the month — sufficient precision
}
```

### Pattern 5: MOT API also populates vehicle_tests

When syncing from MOT, `tokef_dt` (רישיון תוקף) and `mivchan_acharon_dt` (טסט אחרון) should create/update `vehicle_tests` records:

```typescript
// After updating vehicles table:
// Upsert latest test record from MOT data
if (v.mivchan_acharon_dt && v.tokef_dt) {
  await supabase.from('vehicle_tests').upsert({
    vehicle_id: vehicleId,
    test_date:   v.mivchan_acharon_dt,   // last test date
    expiry_date: v.tokef_dt,             // license expiry (= next test due)
    passed:      true,                   // MOT API only shows passing vehicles
    alert_enabled: true,
    created_by:  user.authUserId,
    updated_by:  user.authUserId,
  }, {
    onConflict: 'vehicle_id,test_date',  // NOTE: need unique index for this upsert
    ignoreDuplicates: false,
  })
}
```

**Important:** The vehicle_tests table has no unique index on `(vehicle_id, test_date)` — this needs a migration if upsert-by-date is desired. Alternative: insert only if no existing test exists for this vehicle with the same test_date. Check if this is needed or if simple insert is sufficient.

### Pattern 6: Supplier Type Labels (Hebrew)

```typescript
// Centralize supplier type → Hebrew label mapping
export const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  leasing:    'חברת ליסינג',
  insurance:  'חברת ביטוח',
  fuel_card:  'ספק כרטיס דלק',
  garage:     'מוסך',
  other:      'אחר',
}
```

### Anti-Patterns to Avoid

- **Direct UPDATE on deleted_at:** Never `supabase.from('vehicle_suppliers').update({deleted_at: ...})` — use `soft_delete_vehicle_supplier` RPC (SECURITY DEFINER). This is the established pattern across all fleet tables.
- **MOT API with string plate:** The API filter `{"mispar_rechev": "6242255"}` (string) returns `total: 0`. Must pass as `Number`: `{"mispar_rechev": 6242255}`.
- **Caching MOT responses:** MOT data must never be cached with `next: { revalidate: N }` — always `revalidate: 0`. A vehicle's status can change daily.
- **Storing tokef_dt in vehicles table:** `tokef_dt` belongs in `vehicle_tests.expiry_date`, not in the `vehicles` table. Do not add a `tokef_dt` column to vehicles.
- **Phone normalization:** All phone fields on vehicle_suppliers must go through `normalizePhone()` from `format.ts` before storage (IRON RULE).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Soft-delete supplier | Direct UPDATE deleted_at | `soft_delete_vehicle_supplier` RPC | PostgREST + RLS interaction — proven broken with direct UPDATE |
| Phone validation | Custom regex | `normalizePhone()` from `format.ts` | IRON RULE — all phone fields go through this |
| MOT HTTP client | Axios, got, node-fetch | `fetch()` built-in | Public API, no auth, no retry needed for manual trigger |
| Supplier type dropdown | Hardcoded JSX options | SUPPLIER_TYPE_LABELS map | Single source of truth, consistent with DB CHECK constraint values |
| Dialog state management | Redux/Zustand | `useState` + shadcn Dialog | Project pattern — all dialogs use local state |

---

## Common Pitfalls

### Pitfall 1: MOT API License Plate as Number Not String

**What goes wrong:** `filters={"mispar_rechev":"0624225"}` returns `total: 0` even for a valid plate.

**Why it happens:** The MOT `mispar_rechev` field is stored as a `numeric` type in CKAN datastore. String comparison doesn't match.

**How to avoid:** Always `Number(plate.replace(/\D/g, ''))` before passing to filters.

**Source:** israel-mot-vehicle-query SKILL.md §11 "Common Errors & Fixes" (HIGH confidence — verified from skill)

### Pitfall 2: moed_aliya_lakvish Format

**What goes wrong:** Storing `"2017-3"` directly into a PostgreSQL `DATE` column throws an invalid date error.

**Why it happens:** MOT API returns month without zero-padding (`"YYYY-M"` not `"YYYY-MM-DD"`).

**How to avoid:** Parse with `parseMoedAliya()` to produce `"YYYY-MM-01"` before INSERT.

**Source:** israel-mot-vehicle-query SKILL.md §5 field reference (HIGH confidence)

### Pitfall 3: Supplier Appears in All Type Dropdowns

**What goes wrong:** When vehicle card asks for "choose insurance company", all garages and leasing companies appear in the dropdown.

**Why it happens:** Query doesn't filter by `supplier_type`.

**How to avoid:** Always filter `vehicle_suppliers` by type: `.eq('supplier_type', 'insurance')`. Each supplier type dropdown in vehicle card only shows suppliers of that type.

**Source:** vehicle_suppliers table design — `supplier_type` INDEX exists for this pattern (verified from 00025_fleet_vehicles.sql)

### Pitfall 4: DELETE vs SOFT-DELETE on vehicle_suppliers

**What goes wrong:** Admin user deletes a supplier that is FK-referenced by `vehicles.insurance_company_id`. Hard delete fails with FK constraint violation. Soft-delete sets `deleted_at` — but if the SELECT RLS is `USING (deleted_at IS NULL)`, the supplier disappears from dropdowns even though vehicles still reference it.

**How to avoid:**
1. Always soft-delete (FK stays intact).
2. When building supplier dropdowns in vehicle card, query including soft-deleted when showing existing assignment: `SELECT * FROM vehicle_suppliers WHERE id = $current_supplier_id OR deleted_at IS NULL`.
3. Or: check for references before allowing delete (count of vehicles FK-ing this supplier).

**Source:** Pattern from existing `drivers` table — soft-delete is project standard for all FK-referenced tables.

### Pitfall 5: Missing verifySession() in Server Actions

**What goes wrong:** Admin Server Action callable by any authenticated user — not just admin.

**Why it happens:** Using `verifyAppUser()` instead of `verifySession()` for admin actions.

**How to avoid:** Admin CRUD actions (`createVehicleSupplier`, `updateVehicleSupplier`, etc.) use `verifySession()`. ChemoSys app actions use `verifyAppUser()`. The vehicle suppliers CRUD is admin-facing — use `verifySession()`.

**Source:** MEMORY.md "CRITICAL Architecture Decision" (HIGH confidence — project documentation)

### Pitfall 6: Tailwind v4 Grid on Mobile

**What goes wrong:** Suppliers table renders with 5 columns on 375px mobile, content overflows.

**Why it happens:** `grid-cols-5` without responsive breakpoints.

**How to avoid:** IRON RULE from MEMORY.md — always `grid-cols-1 sm:grid-cols-2` pattern. On mobile, table rows should collapse to card layout. Use `hidden sm:table-cell` for non-critical columns on the suppliers table.

---

## Code Examples

### Vehicle Suppliers List Query

```typescript
// Source: Pattern from src/actions/fleet/drivers.ts (verified from codebase)
export async function getVehicleSuppliers(
  type?: string
): Promise<VehicleSupplier[]> {
  await verifySession()
  const supabase = await createClient()

  let query = supabase
    .from('vehicle_suppliers')
    .select('id, supplier_type, name, contact_name, phone, email, is_active, created_at')
    .order('supplier_type')
    .order('name')

  if (type) {
    query = query.eq('supplier_type', type)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapSupplier)
}
```

### Dialog Pattern (from existing admin UI)

All add/edit dialogs in this project follow the pattern:

```typescript
// Source: Pattern from AddDriverDialog.tsx (verified from codebase)
'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { createVehicleSupplierAction } from '@/actions/fleet/vehicle-suppliers'

export function AddSupplierDialog({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  // ...
  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createVehicleSupplierAction(formData)
      if (result.success) {
        toast.success('הספק נוסף בהצלחה')
        onClose()
      } else {
        toast.error(result.error ?? 'שגיאה')
      }
    })
  }
  // ...
}
```

### MOT Sync Button with Loading State

```typescript
// Pattern: mirrors testSmsConnection() button in SmsSettings.tsx
'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { syncVehicleFromMotAction } from '@/actions/fleet/mot-sync'

export function MotSyncButton({ vehicleId, licensePlate }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleSync() {
    startTransition(async () => {
      const result = await syncVehicleFromMotAction(vehicleId, licensePlate)
      if (result.success) {
        toast.success('נתוני משרד הרישוי עודכנו')
      } else {
        toast.error(result.error ?? 'שגיאה בסנכרון')
      }
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending}>
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      סנכרן עם משרד הרישוי
    </Button>
  )
}
```

---

## Scope Boundaries for This Phase

This phase is explicitly Phase 10B. It feeds into but does NOT include:

- **Phase 13 (10C):** Vehicle Server Actions for the vehicle card itself (add vehicle, edit details, manage tests/insurance/documents)
- **Phase 14 (10E):** Vehicle card tabs
- **Phase 15 (10F):** VehicleList + AddVehicleDialog with MOT auto-fill on add

**What Phase 12 DOES include:**
1. Admin UI for managing `vehicle_suppliers` table (CRUD)
2. Server Actions for vehicle_suppliers (create, read, update, soft-delete)
3. MOT API Server Action `syncVehicleFromMot()` + associated types
4. A trigger UI for MOT sync (either in admin settings or a test page)
5. `FleetSettingsData` extension for vehicle-related thresholds (test/insurance alert days — mirrors existing license/document thresholds)

**New env vars expected:**
- `FLEET_TEST_YELLOW_DAYS` — days before vehicle test expiry for yellow alert (default: 60)
- `FLEET_TEST_RED_DAYS` — days before vehicle test expiry for red alert (default: 30)
- `FLEET_INSURANCE_YELLOW_DAYS` — days before insurance expiry for yellow alert (default: 60)
- `FLEET_INSURANCE_RED_DAYS` — days before insurance expiry for red alert (default: 30)

These follow the exact pattern of `FLEET_LICENSE_YELLOW_DAYS` and `FLEET_DOCUMENT_YELLOW_DAYS` established in Phase 9.

---

## Admin Settings Accordion Decision

**Current accordion items:** SMS, WhatsApp, FTP, Telegram, LLM, Email, Fleet (7 items).

**Phase 12 additions to Fleet accordion section:**
- Vehicle test alert thresholds (4 inputs, same as license/document thresholds)
- Vehicle insurance alert thresholds (4 inputs)
- "MOT API Test" button — test that the MOT API is reachable (mirrors testSmsConnection pattern)

**Vehicle Suppliers admin page:** Should be a STANDALONE PAGE at `/admin/vehicle-suppliers` — not inside the settings accordion. Rationale: It's a data management page (CRUD records), not a settings/configuration page. The accordion is for configuration values and integrations. Vehicle suppliers are data entities similar to projects or departments.

**Recommendation:** The Fleet accordion gets extended with vehicle thresholds + MOT test. Vehicle Suppliers gets its own admin page under `/admin`.

---

## DB Schema Already in Place (from Phase 11)

No new migrations are required for Phase 12. All tables exist:

```
vehicle_suppliers (id, supplier_type, name, contact_name, phone, email, address, notes, is_active, created_at, updated_at, created_by, updated_by, deleted_at)

vehicles (... mot_last_sync_at, tozeret_nm, degem_nm, kinuy_mishari, shnat_yitzur, tzeva_rechev, sug_delek_nm, misgeret, degem_manoa, ramat_gimur, kvutzat_zihum, baalut, moed_aliya_lakvish ...)
```

The `soft_delete_vehicle_supplier` RPC exists and is SECURITY DEFINER.

**One potential migration need:** If the `syncVehicleFromMot` action wants to upsert to `vehicle_tests` by `(vehicle_id, test_date)`, a UNIQUE index on that pair is required. However, the simpler approach is to insert a new record and let history accumulate (no upsert needed). Recommendation: **no migration in Phase 12** — insert new test records from MOT sync, never upsert.

---

## Phase 12 Plan Breakdown Recommendation

**Plan 12-01: Vehicle Suppliers Admin Page**
- `src/actions/fleet/vehicle-suppliers.ts` — Server Actions: getVehicleSuppliers, createVehicleSupplier, updateVehicleSupplier, toggleSupplierActive, deleteVehicleSupplier (soft-delete via RPC)
- `src/app/(admin)/admin/vehicle-suppliers/page.tsx` — Server Component, verifySession() guard
- `src/components/admin/vehicle-suppliers/VehicleSuppliersTable.tsx` — list with type filter, edit/delete actions
- `src/components/admin/vehicle-suppliers/AddSupplierDialog.tsx` + `EditSupplierDialog.tsx`

**Plan 12-02: MOT API Server Action + Fleet Settings Extension**
- `src/actions/fleet/mot-sync.ts` — syncVehicleFromMot() + testMotApiConnection()
- Extend `FleetSettingsData` type + `getIntegrationSettings()` in `settings.ts` with 4 new vehicle threshold fields
- Extend `FleetSettings.tsx` with vehicle test/insurance threshold inputs
- Add MOT API test button to Fleet settings accordion
- Update `.env.local` handling in `env-settings.ts` for new keys

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Separate insurer/garage/leasing fields on vehicles | Normalized `vehicle_suppliers` lookup table | Shared suppliers across all vehicle types, consistent FK management |
| Manual MOT data entry | API sync from data.gov.il | Real-time accurate vehicle data, no manual errors |
| Single fleet alert threshold section | Separate thresholds per entity type (license, document, test, insurance) | Precise control over alert behavior per entity |

---

## Open Questions

1. **Should vehicle_suppliers have its own admin nav link?**
   - What we know: Admin nav is in a sidebar component. Current links: Dashboard, Employees, Projects, Settings.
   - What's unclear: Is there a dedicated admin nav component to modify?
   - Recommendation: Add "ספקי רכב" link to admin sidebar alongside other data entities. Check `src/app/(admin)/admin/layout.tsx` or sidebar component for the add point.

2. **MOT sync: when is it triggered?**
   - What we know: Phase 15 builds the AddVehicleDialog with MOT auto-fill on plate entry.
   - What's unclear: Should Phase 12 also expose a sync button in some UI, or just deliver the Server Action?
   - Recommendation: Deliver the Server Action + a test button in admin settings (MOT reachability test). The actual "Sync" button in vehicle card is Phase 14/15 concern. The test button is sufficient for Phase 12.

3. **What happens when MOT returns `baalut` = "ליסינג" — should it auto-assign a supplier?**
   - What we know: `vehicles.baalut` stores MOT ownership type. `leasing_company_id` is a separate FK.
   - What's unclear: Should sync auto-match baalut to a supplier row?
   - Recommendation: No auto-match in Phase 12. `baalut` is informational from MOT (who the registered owner is per MOT records). `leasing_company_id` is the operational FK and is set manually by admin. Keep them independent.

4. **Should supplier phone be validated with normalizePhone()?**
   - What we know: IRON RULE — all phone fields go through normalizePhone().
   - What's unclear: Suppliers may have landline phones (not mobile), which normalizePhone rejects.
   - Recommendation: Apply `normalizePhone()` for display normalization attempt, but store raw value if normalization returns null. Suppliers can have landlines. This is a relaxation of the IRON RULE that only applies to employee/driver mobile numbers.

---

## Sources

### Primary (HIGH confidence)
- `src/components/admin/settings/FleetSettings.tsx` — Exact component pattern for fleet settings UI extension (verified from codebase)
- `src/components/admin/settings/IntegrationAccordion.tsx` — Accordion structure for new section (verified from codebase)
- `src/actions/settings.ts` — verifySession() guard pattern, FleetSettingsData type, ENV_KEY_MAP pattern (verified from codebase)
- `supabase/migrations/00025_fleet_vehicles.sql` — vehicle_suppliers schema, soft_delete_vehicle_supplier RPC, RLS policies (verified from codebase)
- `C:/Users/Alias/.claude/skills/israel-mot-vehicle-query/SKILL.md` — Complete MOT API reference: endpoint, field types, encoding gotchas, license plate as number (HIGH confidence)
- `.planning/phases/11-*/11-01-SUMMARY.md` + `11-02-SUMMARY.md` — What Phase 11 delivered, confirmed in Supabase (HIGH confidence)
- `src/lib/format.ts` — normalizePhone(), formatPhone() patterns (verified from codebase)

### Secondary (MEDIUM confidence)
- MEMORY.md — Admin vs app auth guard distinction, env vars pattern, IRON RULE phone validation
- Phase 11 RESEARCH.md — MOT field reference table (originally verified against live API)

### Tertiary (LOW confidence)
- General CRUD admin page patterns (inferred from existing admin pages structure)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new libraries, all existing patterns
- Vehicle Suppliers CRUD architecture: HIGH — exact same pattern as other admin CRUD pages in codebase
- MOT API integration: HIGH — SKILL.md provides complete, verified reference
- Fleet Settings extension: HIGH — mirroring existing FleetSettings pattern exactly
- Phone validation for suppliers (landlines): MEDIUM — relaxation of IRON RULE, needs Sharon confirmation

**Research date:** 2026-03-07
**Valid until:** 2026-06-01 (MOT API endpoint stable; codebase patterns stable)
