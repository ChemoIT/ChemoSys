# Phase 17: Vehicle Card Redesign — Details Tab + Images + Replacement Vehicle — Research

**Researched:** 2026-03-08
**Domain:** Next.js 16 + Supabase Storage + shadcn/ui — image gallery, card-level locking, replacement vehicle dialog, fuel cards sub-list
**Confidence:** HIGH — based entirely on existing codebase code-reading (no external research needed for well-understood patterns)

---

## Summary

Phase 17 builds on a solid foundation: the DB schema (migrations 00027+00028) is already live in Supabase, RLS policies are in place, and the storage bucket `vehicle-images` (Private) is ready. The work is entirely frontend + server actions — no new migrations needed.

The three main feature areas are:
1. **Image gallery** (up to 5 images) — upload to `vehicle-images` bucket, browse with lightbox, delete. Pattern: `createSignedUrl` (1-year TTL) for private bucket access. Auto-save on upload/delete — no dirty tracking needed for images.
2. **Card-level locking + vehicle_status** — when `vehicle_status IN ('returned','sold','decommissioned')`, all form fields become read-only. The `vehicle_status` dropdown itself stays editable always (to allow unlocking). Lock enforcement happens in the UI layer only — no DB trigger.
3. **Replacement vehicle dialog** — shows historical list + active record. Add/Edit form with MOT lookup, fuel card sub-list (digits-only, add/remove inline). Status is auto-computed: `return_date IS NULL` → 'active', `return_date IS NOT NULL` → 'returned'.

**AddVehicleDialog** needs a focused fix: remove the company selector entirely. `createVehicle()` server action also needs updating to remove the `companyId` parameter.

**Primary recommendation:** Implement in two plans — Plan 17-01 (image gallery + vehicle_status + card locking + AddVehicleDialog fix), Plan 17-02 (replacement vehicle dialog + fuel cards sub-list).

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16 | Server Actions, page routing | Project standard |
| Supabase JS | latest | Storage upload + DB queries | Project standard |
| shadcn/ui | latest | Dialog, Button, Label components | Project standard |
| Tailwind v4 | 4 | Styling | Project standard |
| sonner | latest | Toast notifications | Already wired in root layout |

### Shared Fleet Components (already exist)
| Component | Location | Purpose |
|-----------|----------|---------|
| `FleetDateInput` | `src/components/app/fleet/shared/FleetDateInput.tsx` | 3-select date picker (day/month/year) — use for entry_date, return_date, fleet_exit_date |
| `FleetUploadZone` | `src/components/app/fleet/shared/FleetUploadZone.tsx` | Single-file drag-drop upload — NOT suited for gallery (handles only one file + shows preview/clear) |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended File Structure for Phase 17

```
src/
├── actions/fleet/
│   ├── vehicles.ts          — add: updateVehicleStatus, vehicle_images CRUD, createVehicle (remove companyId)
│   └── vehicle-replacement.ts  — NEW: all replacement record + fuel card server actions
├── components/app/fleet/vehicles/
│   ├── VehicleDetailsSection.tsx   — REPLACE with new version (images + status + locking)
│   ├── VehicleImageGallery.tsx     — NEW: gallery component (5 slots, upload/browse/lightbox/delete)
│   ├── VehicleStatusSelect.tsx     — NEW: status dropdown (always editable, even when locked)
│   ├── ReplacementVehicleDialog.tsx — NEW: full replacement vehicle management dialog
│   ├── ReplacementRecordForm.tsx   — NEW: add/edit form inside dialog
│   ├── FuelCardsList.tsx           — NEW: inline add/remove fuel cards list
│   └── AddVehicleDialog.tsx        — MODIFY: remove company selector
└── lib/fleet/
    └── vehicle-types.ts     — add: VehicleImage, VehicleReplacementRecord, VehicleFuelCard types
                                     + VEHICLE_STATUS_LABELS, REPLACEMENT_REASON_LABELS constants
```

### Pattern 1: Image Upload to Private Supabase Storage Bucket

**What:** Upload image file → get storage path → insert row in `vehicle_images` → return signed URL for display.
**When to use:** All image operations (upload, display, delete).

Storage path convention (from migration 00027):
```
vehicle-images bucket: {vehicle_id}/{position}.{ext}
e.g. "abc123-uuid.../1.jpg"
```

**Upload flow (client-side using Supabase browser client):**
```typescript
// Source: existing driver documents pattern in project
import { createClient } from '@/lib/supabase/browser'

const supabase = createClient()

// 1. Upload file
const ext = file.name.split('.').pop()
const path = `${vehicleId}/${position}.${ext}`

const { error: uploadError } = await supabase.storage
  .from('vehicle-images')
  .upload(path, file, { upsert: true })  // upsert=true allows replacing existing slot

if (uploadError) { /* handle */ }

// 2. Get signed URL (1 year TTL) for immediate display
const { data: signedData } = await supabase.storage
  .from('vehicle-images')
  .createSignedUrl(path, 60 * 60 * 24 * 365)

const signedUrl = signedData?.signedUrl ?? null
```

**Server Action — save image metadata after upload:**
```typescript
// In vehicles.ts (or separate vehicle-images.ts)
export async function addVehicleImage(
  vehicleId: string,
  storagePath: string,
  position: number
): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // If slot already occupied — delete old storage file first, then hard-delete DB row
  const { data: existing } = await supabase
    .from('vehicle_images')
    .select('id, storage_path')
    .eq('vehicle_id', vehicleId)
    .eq('position', position)
    .maybeSingle()

  if (existing) {
    // Hard delete storage file
    await supabase.storage.from('vehicle-images').remove([existing.storage_path])
    // Hard delete DB row
    await supabase.from('vehicle_images').delete().eq('id', existing.id)
  }

  const { data, error } = await supabase
    .from('vehicle_images')
    .insert({ vehicle_id: vehicleId, storage_path: storagePath, position, created_by: userId })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בשמירת התמונה' }

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true, id: data.id }
}

export async function deleteVehicleImage(
  imageId: string,
  storagePath: string,
  vehicleId: string
): Promise<ActionResult> {
  await verifyAppUser()
  const supabase = await createClient()

  // Hard delete storage file + DB row (no soft-delete per decision [16-01])
  await supabase.storage.from('vehicle-images').remove([storagePath])
  await supabase.from('vehicle_images').delete().eq('id', imageId)

  revalidatePath(`/app/fleet/vehicle-card/${vehicleId}`)
  return { success: true }
}
```

**Fetching images with signed URLs (server action):**
```typescript
export async function getVehicleImages(vehicleId: string): Promise<VehicleImage[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_images')
    .select('id, vehicle_id, storage_path, position, created_at')
    .eq('vehicle_id', vehicleId)
    .order('position', { ascending: true })

  if (error || !data) return []

  // Create signed URLs (1-year TTL) for all images
  return Promise.all(data.map(async (img) => {
    const { data: signed } = await supabase.storage
      .from('vehicle-images')
      .createSignedUrl(img.storage_path, 60 * 60 * 24 * 365)
    return {
      id: img.id,
      vehicleId: img.vehicle_id,
      storagePath: img.storage_path,
      position: img.position,
      signedUrl: signed?.signedUrl ?? null,
      createdAt: img.created_at,
    }
  }))
}
```

### Pattern 2: Image Gallery Component (5 Slots)

**What:** Grid of 5 slots. Each slot shows image thumbnail (if filled) or empty placeholder. Click on filled slot → lightbox. Click on empty slot → file picker. Each filled slot has a delete button.

**Lightbox approach:** Use a simple Dialog from shadcn/ui with a full-screen image. No external lightbox library needed — keeps dependencies minimal.

```typescript
// VehicleImageGallery.tsx — simplified structure
'use client'

export function VehicleImageGallery({ vehicleId, images, isLocked }: Props) {
  const [lightboxImage, setLightboxImage] = useState<VehicleImage | null>(null)
  const [uploading, setUploading] = useState<number | null>(null) // which slot is uploading

  // 5 slots always rendered, images fill by position
  const slots = Array.from({ length: 5 }, (_, i) => ({
    position: i + 1,
    image: images.find(img => img.position === i + 1) ?? null,
  }))

  async function handleFileSelect(position: number, file: File) {
    // 1. Upload to storage (client-side)
    // 2. Call addVehicleImage Server Action
    // 3. Show toast on success
  }

  async function handleDelete(image: VehicleImage) {
    await deleteVehicleImage(image.id, image.storagePath, vehicleId)
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {slots.map(({ position, image }) => (
          <ImageSlot
            key={position}
            position={position}
            image={image}
            uploading={uploading === position}
            isLocked={isLocked}
            onFileSelect={(file) => handleFileSelect(position, file)}
            onDelete={() => image && handleDelete(image)}
            onLightbox={() => image && setLightboxImage(image)}
          />
        ))}
      </div>

      {/* Lightbox dialog */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightboxImage && (
            <img
              src={lightboxImage.signedUrl ?? ''}
              alt={`תמונה ${lightboxImage.position}`}
              className="w-full h-auto rounded-lg object-contain max-h-[80dvh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Key decisions:**
- `upsert: true` on storage upload — replaces file at same path when position already used
- Images auto-save immediately on upload/delete — no dirty tracking (matches requirement)
- File picker: `<input type="file" accept="image/*">` hidden input, triggered by slot click
- Camera button optional (like FleetUploadZone) — same approach

### Pattern 3: Card-Level Locking Based on vehicle_status

**What:** When `vehicle_status IN ('returned', 'sold', 'decommissioned')`, all form fields in VehicleDetailsSection are `disabled` (grayed out). The `vehicle_status` dropdown itself is always enabled.

**Implementation — prop drilling:**
```typescript
// VehicleDetailsSection.tsx — add isLocked derived state
const LOCKED_STATUSES = ['returned', 'sold', 'decommissioned'] as const

// Inside component — derive lock state from vehicleStatus
const isLocked = LOCKED_STATUSES.includes(vehicleStatus as typeof LOCKED_STATUSES[number])

// Each field input/select gets: disabled={isLocked}
// EXCEPT vehicleStatus select — always enabled

// Save button: disabled when isSaving || !isDirty || (isLocked && no status change)
// Simpler: save button always enabled when isDirty (status change counts as edit even when locked)
```

**Validation on status change:**
```typescript
// When vehicleStatus changes to 'returned'/'sold'/'decommissioned'
// AND fleetExitDate is empty → block save with toast error
function handleSave() {
  if (LOCKED_STATUSES.includes(vehicleStatus) && !fleetExitDate) {
    toast.error('יש להזין תאריך יציאה מהצי לפני שינוי הסטטוס')
    return
  }
  startSaveTransition(async () => { /* ... */ })
}
```

**Lock state in VehicleCard header:**
- When `isLocked=true`, show a lock badge next to the status badge in the header
- Tab switching still works normally — lock only affects Tab 1 (Details tab)

**Auto-lock from replacement vehicle:** When a replacement vehicle is made 'active' → set `vehicle_status = 'suspended'`. When replacement returned → set `vehicle_status = 'active'`. This logic lives in the replacement vehicle server action (not the Details tab).

### Pattern 4: New Fields in VehicleDetailsSection

Three new fields need to be added to the existing form and dirty tracking:

1. **`vehicle_status`** — `<select>` with 5 options. Always enabled. Values: `active/suspended/returned/sold/decommissioned`.
2. **`fleet_exit_date`** — `FleetDateInput` component (already exists). Only required when status is a locking status.
3. **Replacement Vehicle button** — opens `ReplacementVehicleDialog`. NOT a form field — no dirty tracking.

**Updated VehicleFull type** needs `vehicleStatus` and `fleetExitDate` fields. The `getVehicleById()` query needs these columns added to the SELECT.

**Updated `updateVehicleDetails()` server action** needs `vehicleStatus` and `fleetExitDate` params. The update logic also needs to handle the auto-status side effect from replacement records (see Pattern 6).

### Pattern 5: Replacement Vehicle Dialog Architecture

**Structure:** A single `<Dialog>` component (`ReplacementVehicleDialog`) with two views:
- **List view** (default): Shows all historical replacement records ordered by entry_date DESC. Active record highlighted. "הוסף רכב חלופי" button. Click on record → switches to edit form.
- **Form view** (add/edit): All fields for a single replacement record + fuel cards sub-list.

```typescript
type DialogView = 'list' | 'add' | 'edit'

export function ReplacementVehicleDialog({ vehicleId, open, onClose }: Props) {
  const [view, setView] = useState<DialogView>('list')
  const [editingRecord, setEditingRecord] = useState<VehicleReplacementRecord | null>(null)
  const [records, setRecords] = useState<VehicleReplacementRecord[]>([])

  // Load records when dialog opens
  useEffect(() => {
    if (open) void getVehicleReplacementRecords(vehicleId).then(setRecords)
  }, [open, vehicleId])

  // List view
  if (view === 'list') { /* render list */ }

  // Form view
  return <ReplacementRecordForm
    vehicleId={vehicleId}
    record={editingRecord}
    onSave={() => { setView('list'); reload() }}
    onCancel={() => setView('list')}
  />
}
```

**Single-active-record rule** (from decision [16-01]): Enforced in Server Action, NOT in DB.
```typescript
// In addVehicleReplacementRecord server action:
// Check if active record already exists before inserting
const { data: activeRecord } = await supabase
  .from('vehicle_replacement_records')
  .select('id')
  .eq('vehicle_id', vehicleId)
  .eq('status', 'active')
  .is('deleted_at', null)
  .maybeSingle()

if (activeRecord) {
  return { success: false, error: 'קיים כבר רכב חלופי פעיל עבור רכב זה' }
}
```

**Computed fields (client-side only):**
- "תקופת שהייה בצי" = `return_date - entry_date` (days) — computed in display, not stored
- "סה"כ מרחק נסיעה" = `return_km - entry_km` — computed in display, not stored

### Pattern 6: Fuel Cards Sub-List in Replacement Form

**What:** Within the replacement record form, a mini-list of fuel card numbers. Operations: add a card (text input + button), remove a card (X button). No edit — remove + re-add.

**Data flow:**
- Cards are fetched alongside the replacement record: `vehicle_fuel_cards` joined on `replacement_record_id`
- Hard-delete on remove (no soft-delete per decision [16-01])
- Add card: INSERT into `vehicle_fuel_cards`
- Validation: digits only — `card_number.replace(/\D/g, '') === card_number`

```typescript
// Inline add in dialog form (no separate dialog for cards)
function FuelCardsList({ recordId, cards, onCardsChange }: Props) {
  const [newCard, setNewCard] = useState('')

  async function handleAdd() {
    if (!/^\d+$/.test(newCard.trim())) {
      toast.error('מספר כרטיס חייב להכיל ספרות בלבד')
      return
    }
    await addVehicleFuelCard(recordId, newCard.trim())
    setNewCard('')
    onCardsChange()
  }

  async function handleRemove(cardId: string) {
    await deleteVehicleFuelCard(cardId)
    onCardsChange()
  }
}
```

**Note on new records:** When adding a new replacement record, cards can only be added AFTER the record is saved (recordId needed as FK). The form flow is:
1. Save the new record → get back `recordId`
2. Switch to "editing" mode of that new record → show fuel cards list with the new `recordId`

OR: save record + immediately transition to edit mode for that record.

### Pattern 7: AddVehicleDialog Fix

**Current state:** Dialog has plate input + company selector. `createVehicle(plate, companyId)` requires both.

**Required change:**
1. Remove company selector from dialog UI
2. Remove company validation in `handleLookup()` and `handleCreate()`
3. Update `createVehicle()` in `vehicles.ts` to remove `companyId` parameter and not require/insert it
4. The company field in VehicleDetailsSection remains (can be set later in Tab 1)

```typescript
// Updated createVehicle — no companyId
export async function createVehicle(
  licensePlate: string
): Promise<ActionResult & { vehicleId?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const plate = licensePlate.trim().toUpperCase().replace(/\s+/g, '-')
  if (!plate) return { success: false, error: 'מספר רישוי נדרש' }

  // Guard: no existing active vehicle with this plate
  const { data: existing } = await supabase
    .from('vehicles')
    .select('id')
    .eq('license_plate', plate)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) return { success: false, error: 'רכב עם מספר רישוי זה כבר קיים במערכת' }

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .insert({ license_plate: plate, created_by: userId, updated_by: userId })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה ביצירת כרטיס רכב' }

  revalidatePath('/app/fleet/vehicle-card')
  return { success: true, vehicleId: vehicle.id }
}
```

**Dialog simplification:** After removing company selector, `handleLookup()` only needs `plate.trim()` check. Description text changes to remove company reference.

### Anti-Patterns to Avoid

- **Don't use `FleetUploadZone` for the gallery** — it handles only a single file + shows its own preview/clear. The gallery needs a custom slot-based layout.
- **Don't soft-delete `vehicle_images` or `vehicle_fuel_cards`** — decision [16-01]: hard-delete only for binary assets.
- **Don't enforce single-active-record in DB trigger** — decision [16-01]: enforce in Server Action.
- **Don't auto-save the Details tab form when status changes** — status change + fleet_exit_date validation must go through the explicit Save button.
- **Don't track dirty state for images** — images auto-save immediately. If user browses away after uploading an image, data is already saved (no dialog needed).
- **Don't use `disabled` for the status dropdown when card is locked** — it must always be interactive to allow unlocking.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date picker | Custom date input | `FleetDateInput` | Already exists, tested, handles partial selections |
| Toast notifications | Alert div | `sonner` / `toast()` | Already wired to root layout |
| Modal dialogs | Custom overlay | shadcn `Dialog` | RTL support, accessibility, already used throughout |
| Private storage URLs | Long-lived public URLs | `createSignedUrl` (1yr TTL) | Bucket is private; signed URLs are the only access pattern |
| Computed days remaining | DB column | Client-side calc | `Math.round((new Date(returnDate) - new Date(entryDate)) / 86400000)` |
| Computed km distance | DB column | Client-side subtraction | `return_km - entry_km` |
| Lightbox library | `react-image-lightbox` or similar | shadcn Dialog + `<img>` | Simpler, no new dependency, sufficient for 5 images |

---

## Common Pitfalls

### Pitfall 1: Supabase storage — file overwrite in private bucket
**What goes wrong:** `supabase.storage.upload(path, file)` fails if file already exists at that path (default behavior).
**Why it happens:** Supabase storage by default rejects overwrite — returns error "The resource already exists".
**How to avoid:** Always pass `{ upsert: true }` option in the upload call. This replaces the existing file silently.
**Warning signs:** Upload error containing "already exists" or 23505 code.

### Pitfall 2: Signed URL expiry — stale URLs after page reload
**What goes wrong:** If signed URLs are generated server-side and cached in RSC, they will expire (even with 1yr TTL, the URL itself is embedded in the page).
**Why it happens:** Next.js may cache server component output. The URL is valid for 1 year but if the page is re-rendered from cache after URL expiry, user sees 403.
**How to avoid:** Load images client-side (call `getVehicleImages` from a `useEffect` or make it a client-side fetch). The current project pattern for driver documents uses client-side `createSignedUrl` directly from the browser client — same pattern here.

### Pitfall 3: Lock state — forgetting to disable the Save button for read-only fields
**What goes wrong:** Card is "locked" but user still types in an input they find enabled, clicks Save, and data gets written.
**Why it happens:** Missing `disabled={isLocked}` on some inputs.
**How to avoid:** Extract `isLocked` as a derived constant at the top of `VehicleDetailsSection`, apply it to ALL inputs/selects EXCEPT `vehicleStatus`.

### Pitfall 4: `vehicle_images` UNIQUE INDEX conflict
**What goes wrong:** INSERT into `vehicle_images` for a position that already has a row → PostgreSQL error (unique constraint on `vehicle_id, position`).
**Why it happens:** The unique index `vehicle_images_vehicle_position_key` prevents two rows at the same position.
**How to avoid:** Server Action must first delete the existing row (and its storage file) before inserting the new one. The `upsert: true` on storage is not enough — the DB row also needs replacing.

### Pitfall 5: Replacement record fuel cards — timing issue on new records
**What goes wrong:** User tries to add fuel cards to a NEW record before it has been saved → no `replacement_record_id` FK available.
**Why it happens:** Fuel cards require a `replacement_record_id` (NOT NULL FK).
**How to avoid:** In the add-new-record form flow, fuel cards section only becomes active AFTER the record is saved and `recordId` is available. Implement as: "Save record → auto-switch to edit mode with the new recordId → fuel cards now functional."

### Pitfall 6: Status auto-change from replacement vehicle — stale UI
**What goes wrong:** A replacement record marks the vehicle as 'suspended', but the VehicleDetailsSection still shows 'active' (stale server data).
**Why it happens:** The replacement vehicle dialog triggers a Server Action that changes `vehicle_status`, but `VehicleDetailsSection` is initialized from the `vehicle` prop passed at page load.
**How to avoid:** After any replacement record save that changes vehicle status, call `revalidatePath()` for the vehicle card. In the client, after the dialog closes, trigger a page refresh or router.refresh() to re-fetch updated vehicle data.

### Pitfall 7: AddVehicleDialog — calling createVehicle without company
**What goes wrong:** After removing `companyId` from the dialog, if the server action still validates `if (!companyId) return error`, the vehicle creation fails silently.
**Why it happens:** Server action guard not updated in sync with UI change.
**How to avoid:** Update `createVehicle()` in `vehicles.ts` simultaneously with the dialog change. Remove the `companyId` parameter and its validation.

### Pitfall 8: RTL in shadcn Dialog
**What goes wrong:** Hebrew text appears LTR inside Dialog. Lists and form labels appear in wrong order.
**Why it happens:** shadcn `DialogContent` does not inherit `dir` from parent.
**How to avoid:** Always pass `dir="rtl"` on `DialogContent`. This is already done correctly for the existing Delete dialog and Unsaved Changes dialog in the project.

---

## Code Examples

### Existing pattern: createSignedUrl for private bucket
```typescript
// Source: existing driver documents pattern in project (DriverDocumentsSection, DriverLicenseSection)
// Used for fleet-licenses and fleet-documents buckets — same pattern for vehicle-images

const { data: signed } = await supabase.storage
  .from('vehicle-images')
  .createSignedUrl(storagePath, 60 * 60 * 24 * 365)  // 1 year

const signedUrl = signed?.signedUrl ?? null
```

### New types for vehicle-types.ts
```typescript
// Add to src/lib/fleet/vehicle-types.ts

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  active:          'פעיל',
  suspended:       'מושבת זמני',
  returned:        'הוחזר',
  sold:            'נמכר',
  decommissioned:  'מושבת',
}

export const VEHICLE_TYPE_LABELS_NEW: Record<string, string> = {
  private:    'פרטי',
  commercial: 'מסחרי',
  truck:      'משאית',
  trailer:    'ניגרר',
}
// NOTE: migration 00027 changed vehicle_type values from the old set (private/minibus/light_commercial/heavy/forklift/equipment/other)
// to the new set (private/commercial/truck/trailer). Update VEHICLE_TYPE_LABELS constant to match.

export const REPLACEMENT_REASON_LABELS: Record<string, string> = {
  maintenance: 'טיפול',
  test:        'טסט',
  accident:    'תאונה',
  other:       'אחר',
}

export type VehicleImage = {
  id: string
  vehicleId: string
  storagePath: string
  position: number           // 1-5
  signedUrl: string | null   // generated fresh each load
  createdAt: string
}

export type VehicleFuelCard = {
  id: string
  replacementRecordId: string
  cardNumber: string         // digits only
  createdAt: string
}

export type VehicleReplacementRecord = {
  id: string
  vehicleId: string
  licensePlate: string
  motData: Record<string, unknown> | null  // JSONB — raw MOT API response
  entryDate: string          // yyyy-mm-dd
  entryKm: number | null
  returnDate: string | null  // null = still active
  returnKm: number | null
  reason: 'maintenance' | 'test' | 'accident' | 'other'
  reasonOther: string | null
  status: 'active' | 'returned'
  notes: string | null
  fuelCards: VehicleFuelCard[]
  createdAt: string
}
```

### Updated VehicleFull type additions
```typescript
// Add to VehicleFull in vehicle-types.ts:
vehicleStatus: string        // 'active'|'suspended'|'returned'|'sold'|'decommissioned'
fleetExitDate: string | null // yyyy-mm-dd
```

### getVehicleById — columns to add to SELECT
```typescript
// In vehicles.ts getVehicleById() — add to select string:
vehicle_status,
fleet_exit_date,

// And add to returned object:
vehicleStatus: data.vehicle_status,
fleetExitDate: data.fleet_exit_date,
```

### Replacement record server action signatures
```typescript
// In src/actions/fleet/vehicle-replacement.ts

export async function getVehicleReplacementRecords(
  vehicleId: string
): Promise<VehicleReplacementRecord[]>

export async function addVehicleReplacementRecord(input: {
  vehicleId: string
  licensePlate: string
  entryDate: string
  entryKm?: number | null
  reason: 'maintenance' | 'test' | 'accident' | 'other'
  reasonOther?: string | null
  notes?: string | null
}): Promise<ActionResult & { id?: string }>

export async function updateVehicleReplacementRecord(input: {
  recordId: string
  vehicleId: string
  licensePlate: string
  entryDate: string
  entryKm?: number | null
  returnDate?: string | null
  returnKm?: number | null
  reason: 'maintenance' | 'test' | 'accident' | 'other'
  reasonOther?: string | null
  notes?: string | null
}): Promise<ActionResult>
// NOTE: status is derived from returnDate in server action — not passed by caller

export async function deleteVehicleReplacementRecord(
  recordId: string,
  vehicleId: string
): Promise<ActionResult>
// Uses RPC: soft_delete_vehicle_replacement_record (already exists in 00027)

export async function addVehicleFuelCard(
  replacementRecordId: string,
  cardNumber: string
): Promise<ActionResult & { id?: string }>

export async function deleteVehicleFuelCard(
  cardId: string
): Promise<ActionResult>
// Hard delete — no soft delete (decision [16-01])
```

### updateVehicleDetails — fields to add
```typescript
// Add to UpdateVehicleInput type:
vehicleStatus?: string
fleetExitDate?: string | null

// Add to supabase .update() call:
vehicle_status: input.vehicleStatus ?? 'active',
fleet_exit_date: input.fleetExitDate ?? null,
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `isActive` boolean toggle for vehicle state | `vehicle_status` enum with 5 values (migration 00027) | Details tab needs to track `vehicle_status` instead of / in addition to `isActive` |
| Company required at vehicle creation | Company optional (per requirements) | `createVehicle()` must be updated, `company_id` becomes nullable at creation |
| Single `VEHICLE_TYPE_LABELS` with 7 values | New 4-value set: private/commercial/truck/trailer | Constant in `vehicle-types.ts` needs updating to match migration 00027 CHECK constraint |
| No image gallery | `vehicle_images` table (5 positions) | New gallery component needed |
| No replacement tracking | `vehicle_replacement_records` + `vehicle_fuel_cards` tables | Full dialog implementation needed |

**Deprecated/outdated:**
- `isActive` boolean: Still in DB as a column but `vehicle_status` is now the primary status field. The `is_active` column appears to remain for backwards compatibility (driver_computed_status view still uses it). For new UI, drive lock logic from `vehicle_status`, NOT `is_active`.
- Old `VEHICLE_TYPE_LABELS` keys: `minibus`, `light_commercial`, `heavy`, `forklift`, `equipment`, `other` are no longer valid per migration 00027 CHECK constraint. The constant in `vehicle-types.ts` still has these old values — must be updated in this phase.

---

## Open Questions

1. **`is_active` vs `vehicle_status` — which drives the header status badge?**
   - What we know: `vehicle_computed_status` view uses `vehicle_status` (migration 00027). The header currently shows `vehicle.isActive` (boolean) for the "פעיל/לא פעיל" badge.
   - What's unclear: Should the header badge now reflect `vehicle_status` (showing 'פעיל'/'מושבת זמני'/'הוחזר' etc.) or stay as a binary active/inactive?
   - Recommendation: Update the header badge to show the Hebrew label from `VEHICLE_STATUS_LABELS[vehicle.vehicleStatus]` — more informative. Remove the binary isActive badge logic.

2. **Should `is_active` be updated in sync with `vehicle_status`?**
   - What we know: `is_active` is still read by `driver_computed_status` view.
   - What's unclear: When `vehicle_status` changes to 'suspended'/'returned'/'sold'/'decommissioned', should `is_active` automatically be set to `false`?
   - Recommendation: Yes — in `updateVehicleDetails()` server action, derive `is_active` from `vehicle_status`: `is_active = (vehicleStatus === 'active')`. This keeps `driver_computed_status` view consistent.

3. **MOT lookup for replacement vehicle plate — same MOT API?**
   - What we know: `lookupVehicleFromMot()` accepts any plate string, queries the same MOT endpoint.
   - What's unclear: Does the replacement vehicle need a full MOT data preview (like AddVehicleDialog step-2), or just auto-fill some fields in the form?
   - Recommendation: Auto-fill only (no preview step) — populate `licensePlate` + show MOT data fields (manufacturer, model, year) in read-only display inside the form. Store raw MOT data in `mot_data JSONB` field. This is lighter UX than a full 2-step preview flow.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading of existing codebase — all patterns verified against actual working code
- `src/components/app/fleet/vehicles/VehicleCard.tsx` — tab shell, dirty tracking, dialog patterns
- `src/components/app/fleet/vehicles/VehicleDetailsSection.tsx` — current form structure, save pattern, supplier dropdowns
- `src/components/app/fleet/vehicles/AddVehicleDialog.tsx` — current 2-step dialog, company selector location
- `src/actions/fleet/vehicles.ts` — all 21 existing server actions, guard pattern, RPC usage
- `src/actions/fleet/mot-sync.ts` — `lookupVehicleFromMot()` + `syncVehicleFromMot()` signatures
- `src/components/app/fleet/shared/FleetUploadZone.tsx` — single-file upload component limitations
- `src/components/app/fleet/shared/FleetDateInput.tsx` — date picker implementation
- `supabase/migrations/00027_vehicle_card_redesign.sql` — vehicle_images, vehicle_replacement_records, vehicle_fuel_cards schema + RLS + soft-delete RPC
- `supabase/migrations/00028_vehicle_images_storage_policies.sql` — vehicle-images bucket storage policies
- `src/lib/fleet/vehicle-types.ts` — existing types and constants (noting VEHICLE_TYPE_LABELS is outdated)

### Secondary (MEDIUM confidence)
- Supabase Storage docs pattern: `upload({ upsert: true })` for file replacement — consistent with existing project usage of storage in driver documents
- shadcn/ui Dialog for lightbox: confirmed as sufficient from existing Dialog usage in project (Delete dialog, Unsaved Changes dialog)

---

## Metadata

**Confidence breakdown:**
- DB schema: HIGH — migration 00027+00028 already run, tables/RLS/storage policies confirmed
- Server action patterns: HIGH — directly modeled on existing working server actions in vehicles.ts
- Image gallery implementation: HIGH — mirrors driver document upload pattern (same bucket type, same signed URL pattern)
- Card locking logic: HIGH — simple derived boolean from status field, no edge cases beyond the status dropdown exception
- Replacement dialog architecture: HIGH — mirrors DriverDocumentsSection pattern (list + add/edit form in same component)
- Fuel cards sub-list: HIGH — straightforward CRUD, only timing issue on new records flagged
- AddVehicleDialog fix: HIGH — isolated change, well-understood

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable stack, no external dependencies)
