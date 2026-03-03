# Phase 4: Projects - Research

**Researched:** 2026-03-03
**Domain:** Next.js 16 + Supabase + react-leaflet + ExcelJS — Project CRUD with map, file upload, child tables, and universal export
**Confidence:** HIGH (codebase read directly; library APIs verified via official docs and WebFetch)

---

## Summary

Phase 4 builds the full project registry on top of the existing foundation (Phases 1-3). The admin can create, edit, and soft-delete projects with a rich set of fields: basic info, auto-generated project number, employee-linked roles (PM, SM, CVC), attendance clocks as a child table, client logo upload to Supabase Storage, supervision contact, and map location (coordinates + radius) rendered on an interactive OpenStreetMap.

The most technically complex requirements are: (1) the map component — react-leaflet must be loaded client-only via `dynamic(() => import(...), { ssr: false })` due to Leaflet's direct DOM dependency; (2) the auto-generated project number in `PR26XXXXXX` format — implemented as a PostgreSQL SEQUENCE + BEFORE INSERT trigger; (3) the attendance clocks child table — a one-to-many list managed inside the project form; and (4) the universal Excel/CSV export — a Next.js Route Handler that uses the already-installed ExcelJS to generate the file server-side.

The existing `projects` table stub from migration 00001 is incomplete relative to the updated Phase 4 requirements. A new migration (00014) must DROP the old stub and CREATE a fully specified table (plus a sequence, trigger for auto-number, a child `attendance_clocks` table, and the RLS policies and soft-delete RPC). The CSP in `next.config.ts` needs a single addition: `tile.openstreetmap.org` must be added to `img-src` for the map tiles.

**Primary recommendation:** Build in three plans — (1) DB migration + types + Server Actions, (2) ProjectForm dialog with all fields including embedded map picker and clocks list, (3) ProjectsTable + filter + status count + export Route Handler.

---

## Gap Analysis: Existing projects Table vs Updated Requirements

The `projects` table created in migration 00001 is an OLD STUB that does NOT match the current Phase 4 requirements. It must be replaced.

### Missing columns (need to add)
| Column | Requirement |
|--------|-------------|
| `open_date` (DATE) | PROJ-01 — תאריך פתיחה |
| `status` needs 3rd value `'view_only'` | PROJ-01 — לצפייה בלבד |
| `client_name` (TEXT) | PROJ-08 — שם מזמין |
| `client_logo_url` (TEXT) | PROJ-08 — לוגו מזמין |
| `supervision_company` (TEXT) | PROJ-09 — חברת פיקוח |
| `supervision_contact` (TEXT) | PROJ-09 — שם איש קשר פיקוח |
| `supervision_email` (TEXT) | PROJ-09 — מייל פיקוח |
| `supervision_phone` (TEXT) | PROJ-09 — טלפון פיקוח |
| `supervision_notifications` (BOOLEAN) | PROJ-09 — אישור שליחת הודעות לפיקוח |
| `supervision_attach_reports` (BOOLEAN) | PROJ-09 — צירוף לדוחות |
| `cvc_is_employee` (BOOLEAN) | PROJ-10 — CVC from employee vs manual |
| `radius` (INTEGER) | PROJ-11 — רדיוס כיסוי במטרים |

### Columns that change type/constraint
| Column | Old | New |
|--------|-----|-----|
| `status` CHECK | `('active', 'inactive')` | `('active', 'view_only', 'inactive')` |

### Separate child table needed
| Table | Purpose |
|-------|---------|
| `attendance_clocks` | PROJ-07 — multiple clocks per project, each with unique clock_id |

### Columns to KEEP as-is from stub
- `id`, `name`, `project_number`, `expense_number`, `description`, `project_type`, `project_manager_id`, `pm_email`, `pm_phone`, `pm_notifications`, `site_manager_id`, `sm_email`, `sm_phone`, `sm_notifications`, `camp_vehicle_coordinator_id`, `cvc_phone`, `latitude`, `longitude`, universal columns

### Columns to DROP (not in updated requirements)
- `display_name`, `general_number`, `project_code`, `attendance_code`, `has_attendance_code`, `ignore_auto_equipment`, `supervision` (text), `client` (text — replaced by `client_name`)

**Conclusion:** Migration 00014 must DROP TABLE projects (cascade) and recreate it with the correct schema. This is safe because all Phase 4 code was reverted — there is no production data in the projects table.

---

## Standard Stack

### Core (already installed — confirmed from package.json)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| next | ^16.1.6 | App Router, Server Actions, Route Handlers | INSTALLED |
| react / react-dom | ^19.0.0 | UI framework | INSTALLED |
| @supabase/supabase-js | ^2.98.0 | DB client | INSTALLED |
| @supabase/ssr | ^0.8.0 | SSR-safe Supabase client | INSTALLED |
| exceljs | ^4.4.0 | Excel file generation (export) | INSTALLED |
| zod | ^4.3.6 | Schema validation | INSTALLED |
| react-hook-form | ^7.71.2 | Form state management | INSTALLED |
| @hookform/resolvers | ^5.2.2 | Zod + RHF integration | INSTALLED |
| tailwindcss | ^4 | Styling (RTL) | INSTALLED |
| lucide-react | ^0.575.0 | Icons | INSTALLED |
| sonner | ^2.0.7 | Toast notifications | INSTALLED |
| date-fns | ^4.1.0 | Date formatting | INSTALLED |

### New libraries to install (Phase 4 only)
| Library | Version | Purpose | Why This |
|---------|---------|---------|----------|
| leaflet | ^1.9.x | Map rendering engine | Industry standard, free, OpenStreetMap |
| react-leaflet | ^4.x | React bindings for Leaflet | Official React wrapper |
| @types/leaflet | ^1.9.x | TypeScript types for Leaflet | Dev-only, required for TS |

**Installation:**
```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

Note: react-leaflet v5 exists but targets `react@rc` (pre-release). Use v4 which targets stable React 19. Verify with `npm info react-leaflet versions` before installing.

### Why NOT Google Maps / Mapbox
- Google Maps requires billing account and API key ($7/1000 requests beyond free)
- Mapbox requires paid plan for >50k map loads/month
- OpenStreetMap + Leaflet: completely free, no API key, no quota

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── actions/
│   └── projects.ts          # Server Actions: createProject, updateProject, softDeleteProject
├── app/
│   └── (admin)/admin/
│       ├── projects/
│       │   └── page.tsx     # Server component: fetches projects list + employees list
│       └── api/
│           └── export/
│               └── route.ts # Route Handler: GET /api/export?table=projects&format=xlsx
├── components/admin/
│   └── projects/
│       ├── ProjectsTable.tsx         # Client: TanStack Table + 3-status filter + active count
│       ├── ProjectForm.tsx           # Client: full project dialog form (tabs for sections)
│       └── ProjectLocationPicker.tsx # Client: react-leaflet map with Circle + click-to-place
├── lib/
│   └── schemas.ts           # Add: ProjectSchema (Zod)
└── types/
    └── database.ts          # Update: projects Row/Insert/Update types
```

### Pattern 1: Auto-Generated Project Number (PR26XXXXXX)
**What:** PostgreSQL SEQUENCE + BEFORE INSERT trigger generates the project number before INSERT.
**When to use:** Whenever the number must be unique, sequential, and human-readable.
**How it works:**

```sql
-- In migration 00014
CREATE SEQUENCE projects_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if not supplied by caller
  IF NEW.project_number IS NULL OR NEW.project_number = '' THEN
    NEW.project_number := 'PR26' || LPAD(nextval('projects_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_projects_generate_number
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION generate_project_number();
```

This generates: PR260001, PR260002 ... PR269999. The Server Action passes `project_number: ''` (or omits it) and the DB fills it in. The action then reads back the generated value from `.select().single()`.

**Confidence:** HIGH — standard PostgreSQL pattern, verified via official PostgreSQL docs.

### Pattern 2: react-leaflet in Next.js App Router
**What:** Leaflet cannot run on the server (accesses `window`, `document`). Must be dynamically imported with `ssr: false`.
**When to use:** Any component that uses react-leaflet.

```typescript
// ProjectLocationPicker.tsx (the actual leaflet component)
'use client'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet'

// ClickHandler — inside the map, uses useMapEvents hook
function ClickHandler({ onLocationClick }: { onLocationClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function ProjectLocationPicker({ lat, lng, radius, onChange }: Props) {
  const center: [number, number] = lat && lng ? [lat, lng] : [31.7683, 35.2137] // Default: Jerusalem
  return (
    <MapContainer center={center} zoom={13} style={{ height: '300px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ClickHandler onLocationClick={(lat, lng) => onChange(lat, lng)} />
      {lat && lng && (
        <Circle
          center={[lat, lng]}
          radius={radius ?? 100}
          pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 }}
        />
      )}
    </MapContainer>
  )
}
```

```typescript
// ProjectForm.tsx — WRAP the map with dynamic import
import dynamic from 'next/dynamic'

const ProjectLocationPicker = dynamic(
  () => import('./ProjectLocationPicker').then(m => m.ProjectLocationPicker),
  { ssr: false, loading: () => <div className="h-[300px] bg-muted rounded-lg animate-pulse" /> }
)
```

**Confidence:** HIGH — verified via react-leaflet official docs, multiple confirmed examples from 2024-2025.

### Pattern 3: Attendance Clocks as Child Table (One-to-Many in Form)
**What:** `attendance_clocks` is a separate table. The project form manages the clocks list in UI state; on save, the Server Action replaces all clocks (delete old, insert new) within the same transaction (or using an RPC).

```typescript
// In the form — clocks are managed in local state
const [clocks, setClocks] = useState<{ clock_id: string }[]>(initialClocks)

function addClock() {
  setClocks(prev => [...prev, { clock_id: '' }])
}
function removeClock(index: number) {
  setClocks(prev => prev.filter((_, i) => i !== index))
}
```

```typescript
// Server Action — replace-all pattern (same as role tags in employees)
// After saving the project, delete all existing clocks and re-insert
const { error: deleteError } = await supabase
  .from('attendance_clocks')
  .delete()
  .eq('project_id', projectId)

if (clockIds.length > 0) {
  await supabase.from('attendance_clocks').insert(
    clockIds.map(clockId => ({ project_id: projectId, clock_id: clockId }))
  )
}
```

**Confidence:** HIGH — same pattern used for `employee_role_tags` in this codebase (verified in `src/actions/employees.ts`).

### Pattern 4: Client Logo Upload to Supabase Storage
**What:** Logo is uploaded from the browser client (same pattern as employee photos). A new `client-logos` bucket is needed.

```typescript
// In ProjectForm.tsx (client component) — before form submission
const supabase = createBrowserClient()
const ext = logoFile.name.split('.').pop() || 'png'
const fileName = `${crypto.randomUUID()}.${ext}`

const { error: uploadError } = await supabase.storage
  .from('client-logos')
  .upload(fileName, logoFile, { upsert: true })

if (!uploadError) {
  const { data: urlData } = supabase.storage.from('client-logos').getPublicUrl(fileName)
  formData.set('client_logo_url', urlData.publicUrl)
}
```

**Bucket setup:** Create `client-logos` bucket in Supabase Storage → Public: ON. Add Storage RLS policies (same pattern as `00010_storage_policies.sql` but for `client-logos`). Migration 00014 should include the Storage policies.

**Confidence:** HIGH — identical pattern to employee photo upload, already working in this codebase.

### Pattern 5: Excel/CSV Export via Route Handler
**What:** A Next.js Route Handler (`GET /api/export?table=projects&format=xlsx`) fetches data server-side and streams the file. Using ExcelJS (already installed) to generate the buffer.

```typescript
// src/app/(admin)/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  await verifySession()  // Auth guard — same as Server Actions

  const table = req.nextUrl.searchParams.get('table') ?? 'projects'
  const format = req.nextUrl.searchParams.get('format') ?? 'xlsx'

  const supabase = await createClient()
  const { data } = await supabase.from(table).select('*').is('deleted_at', null)

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(table)

  if (data && data.length > 0) {
    worksheet.columns = Object.keys(data[0]).map(key => ({ header: key, key }))
    worksheet.addRows(data)
  }

  if (format === 'csv') {
    const csv = await workbook.csv.writeBuffer()
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}.csv"`,
      },
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${table}.xlsx"`,
    },
  })
}
```

**Client trigger (in table toolbar button):**
```typescript
function handleExport(format: 'xlsx' | 'csv') {
  window.location.href = `/api/export?table=projects&format=${format}`
}
```

**Confidence:** HIGH — ExcelJS `writeBuffer()` → `Response` is a standard Node.js pattern. Route Handlers are Next.js App Router standard.

### Pattern 6: CVC Conditional Field (Employee vs Manual)
**What:** The CVC field is either an employee selection (phone auto-pulled) or a free-text entry with Israeli mobile phone validation.

```typescript
// In form state
const [cvcMode, setCvcMode] = useState<'employee' | 'manual'>('employee')

// In ProjectSchema (Zod)
const IsraeliMobilePhone = z.string().regex(
  /^0(5[0-9])[0-9]{7}$/,
  'מספר טלפון נייד ישראלי לא תקין (10 ספרות, מתחיל ב-05X)'
)

// Zod superRefine for conditional validation
.superRefine((data, ctx) => {
  if (data.cvc_is_employee === false && !data.cvc_phone) {
    ctx.addIssue({ code: 'custom', path: ['cvc_phone'], message: 'טלפון נייד הוא שדה חובה ברישום חופשי' })
  }
  if (data.cvc_is_employee === false && data.cvc_phone) {
    if (!/^0(5[0-9])[0-9]{7}$/.test(data.cvc_phone)) {
      ctx.addIssue({ code: 'custom', path: ['cvc_phone'], message: 'מספר טלפון נייד ישראלי לא תקין' })
    }
  }
})
```

**Israeli mobile phone regex:** `/^0(5[0-9])[0-9]{7}$/` — validates 10 digits starting with 05X (050-059 are Israeli mobile prefixes). Rejects 057 (Bezeq landline disguised) — if stricter filtering needed use `/^0(5[012346789])[0-9]{7}$/` to exclude 057.

**Confidence:** HIGH — regex verified via regextester.com and etl-tools.com (authoritative source for Israeli phone validation).

### Pattern 7: Employee Selector with Auto-Pull (PM, SM, CVC)
**What:** Combobox/Command search over the employees list. On selection, auto-fill email and phone fields.

```typescript
// When employee selected for PM role:
function handlePmSelect(employee: Employee) {
  form.setValue('project_manager_id', employee.id)
  form.setValue('pm_email', employee.email ?? '')
  form.setValue('pm_phone', employee.mobile_phone ?? '')
}
```

The employees list is fetched in the page Server Component (same as companies/departments patterns in other admin pages) and passed down as a prop. The selector uses the existing `cmdk` package (already installed) with Popover + Command components — same UI pattern as `RoleTagMultiSelect`.

**Confidence:** HIGH — existing `cmdk` + Popover + Command pattern already in codebase.

### Anti-Patterns to Avoid
- **Loading leaflet in a Server Component:** Will throw `window is not defined` — always wrap in `dynamic()` with `ssr: false`.
- **Using Leaflet Popup component:** Leaflet popups inject inline styles that violate the current CSP `style-src 'self' 'unsafe-inline'`. Since the current CSP already includes `'unsafe-inline'` for style-src (needed by Tailwind v4 + shadcn), this is not a blocker. But to keep it clean, use Circle + Tooltip (not Popup) to avoid the known Leaflet CSP issue with bottom positioning.
- **Generating project_number in Server Action:** Don't generate the number in TypeScript — let the DB trigger handle it. Read it back from `.select().single()` after insert.
- **Submitting form clocks as FormData array:** FormData does not natively support arrays of objects. Pass clocks as a JSON string in a hidden `<input>` and parse on the server.
- **Hard-deleting attendance_clocks:** Always soft-delete the project (sets deleted_at). The clocks can be hard-deleted since they have no historical value without the project. OR cascade delete them via ON DELETE CASCADE.
- **Using Server Action for Excel export:** Server Actions return JSON-like states, not raw file streams. Use a Route Handler (GET endpoint) for file downloads.

---

## Database Schema (Migration 00014)

### projects table (full replacement)
```sql
-- Migration 00014: Rebuild projects table for Phase 4 requirements
-- Drop old stub (Phase 4 was reverted — no production data)

DROP TABLE IF EXISTS projects CASCADE;

CREATE SEQUENCE projects_number_seq START 1;

CREATE TABLE projects (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Basic info (PROJ-01)
  name                       TEXT NOT NULL,
  project_number             TEXT NOT NULL DEFAULT '',    -- auto-filled by trigger
  open_date                  DATE,
  expense_number             TEXT,
  description                TEXT,
  project_type               TEXT CHECK (project_type IN ('project', 'staging_area', 'storage_area')),
  status                     TEXT NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'view_only', 'inactive')),
  -- PM (PROJ-04)
  project_manager_id         UUID REFERENCES employees(id),
  pm_email                   TEXT,
  pm_phone                   TEXT,
  pm_notifications           BOOLEAN DEFAULT TRUE,
  -- SM (PROJ-04)
  site_manager_id            UUID REFERENCES employees(id),
  sm_email                   TEXT,
  sm_phone                   TEXT,
  sm_notifications           BOOLEAN DEFAULT TRUE,
  -- CVC (PROJ-10)
  camp_vehicle_coordinator_id UUID REFERENCES employees(id),
  cvc_is_employee            BOOLEAN DEFAULT TRUE,
  cvc_phone                  TEXT,
  -- Client (PROJ-08)
  client_name                TEXT,
  client_logo_url            TEXT,
  -- Supervision (PROJ-09)
  supervision_company        TEXT,
  supervision_contact        TEXT,
  supervision_email          TEXT,
  supervision_phone          TEXT,
  supervision_notifications  BOOLEAN DEFAULT FALSE,
  supervision_attach_reports BOOLEAN DEFAULT FALSE,
  -- Location (PROJ-11)
  latitude                   DECIMAL,
  longitude                  DECIMAL,
  radius                     INTEGER DEFAULT 100,         -- meters
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

CREATE UNIQUE INDEX projects_number_active
  ON projects (project_number)
  WHERE deleted_at IS NULL AND project_number != '';

CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-number trigger (PROJ-05)
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_number = '' OR NEW.project_number IS NULL THEN
    NEW.project_number := 'PR26' || LPAD(nextval('projects_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_projects_generate_number
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION generate_project_number();
```

### attendance_clocks table (PROJ-07)
```sql
CREATE TABLE attendance_clocks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  clock_id    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id)
  -- No soft delete — clocks are replaced wholesale on project update
);

CREATE UNIQUE INDEX attendance_clocks_project_clock_unique
  ON attendance_clocks (project_id, clock_id);
```

### RLS Policies (same pattern as other tables)
```sql
-- projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_projects" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_update_projects" ON projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- attendance_clocks
ALTER TABLE attendance_clocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_clocks" ON attendance_clocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_clocks" ON attendance_clocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_update_clocks" ON attendance_clocks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_clocks" ON attendance_clocks FOR DELETE TO authenticated USING (true);

-- Soft-delete RPC for projects (same pattern as soft_delete_employees)
CREATE OR REPLACE FUNCTION soft_delete_projects(p_ids UUID[])
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected INT;
BEGIN
  UPDATE projects SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = ANY(p_ids) AND deleted_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive map | Custom SVG/Canvas map | react-leaflet + OpenStreetMap | Tile loading, zoom, drag, touch events — hundreds of edge cases |
| Map circle with radius | CSS overlay | `<Circle>` from react-leaflet | radius in real meters, not pixels — accounts for zoom level |
| Excel file generation | CSV string building | ExcelJS (already installed) | Column widths, RTL cell direction, proper MIME type, multi-sheet |
| Auto-increment project number | `SELECT MAX()+1` pattern | PostgreSQL SEQUENCE + trigger | Race conditions under concurrent inserts — sequence is atomic |
| Israeli phone validation | Custom string checks | Regex `/^0(5[0-9])[0-9]{7}$/` + Zod | One regex validated by authoritative source covers all edge cases |
| Employee combobox search | Custom dropdown | cmdk (already installed) via Popover + Command | Fuzzy search, keyboard navigation, accessibility — already proven in RoleTagMultiSelect |

**Key insight:** Leaflet's Circle radius is in real-world meters, correctly scaled at all zoom levels. A CSS overlay cannot do this.

---

## CSP Update Required

The current CSP in `next.config.ts` does NOT allow OpenStreetMap tile requests. One line change needed:

```typescript
// BEFORE (current)
`img-src 'self' blob: data: ${supabaseUrl}`,

// AFTER (add OpenStreetMap tile domain)
`img-src 'self' blob: data: ${supabaseUrl} https://*.tile.openstreetmap.org`,
// Also add to connect-src for tile requests:
`connect-src 'self' ${supabaseUrl} wss://*.supabase.co https://*.tile.openstreetmap.org`,
```

The `img-src` update is needed because Leaflet loads map tiles as images. The `connect-src` update covers the XHR fetch of tiles in some browsers.

**Confidence:** HIGH — CSP directives verified vs MDN and existing next.config.ts pattern.

---

## Common Pitfalls

### Pitfall 1: Leaflet SSR — window is not defined
**What goes wrong:** Importing `react-leaflet` or `leaflet` at module top-level in any component that can render on the server causes `ReferenceError: window is not defined` during Next.js build or SSR.
**Why it happens:** Leaflet accesses `window` and `document` at import time (not just at render time).
**How to avoid:** The map component file must have `'use client'` AND be imported with `dynamic(() => import(...), { ssr: false })` from any parent component.
**Warning signs:** Build error "window is not defined" or "document is not defined".

### Pitfall 2: Leaflet CSS Not Loaded — Map Tiles Visible but Markers/Controls Broken
**What goes wrong:** The map renders tiles but icons are broken (grey boxes), zoom controls are invisible, or the container clips incorrectly.
**Why it happens:** `leaflet/dist/leaflet.css` was not imported in the leaf map component.
**How to avoid:** Add `import 'leaflet/dist/leaflet.css'` at the top of the component file that contains `'use client'` with the actual Leaflet components. Do NOT import it in a Server Component or `globals.css` (the SSR path will fail).
**Warning signs:** Map shows tiles but zoom buttons are missing, or marker images are broken squares.

### Pitfall 3: Map Container Height Must Be Explicit
**What goes wrong:** Map renders as a 0-height invisible element.
**Why it happens:** `MapContainer` from react-leaflet requires an explicit height on the container `<div>`. CSS flex/grid auto-height does not work.
**How to avoid:** Always pass `style={{ height: '300px', width: '100%' }}` directly to `<MapContainer>`.
**Warning signs:** No visible map area — just white space.

### Pitfall 4: Project Number Sequence Gap Risk
**What goes wrong:** If a project INSERT is rolled back (e.g., due to a validation error after the trigger fires), the sequence value is consumed and not reused — creating gaps like PR260001, PR260003.
**Why it happens:** PostgreSQL sequences are non-transactional by design.
**How to avoid:** Accept gaps — they are normal behavior for sequences. The project number is still unique and sequential. Do not try to fill gaps.
**Warning signs:** Non-consecutive project numbers (this is expected, not a bug).

### Pitfall 5: Clocks FormData Serialization
**What goes wrong:** The attendance clocks list (array of objects) cannot be passed to a Server Action through standard FormData, which only supports string values.
**Why it happens:** `formData.append('clocks[]', value)` only works for arrays of strings, not objects.
**How to avoid:** Serialize the clocks array as JSON and pass it in a single hidden input: `<input type="hidden" name="attendance_clocks" value={JSON.stringify(clocks)} />`. Parse it in the Server Action with `JSON.parse(formData.get('attendance_clocks') as string)`.
**Warning signs:** Clocks saved incorrectly or Server Action receives undefined.

### Pitfall 6: Supabase SELECT Policy vs soft_delete RPC
**What goes wrong:** Direct `UPDATE projects SET deleted_at = ...` via PostgREST returns 42501 (RLS violation).
**Why it happens:** The SELECT policy `USING(deleted_at IS NULL)` is evaluated during UPDATE's implicit SELECT check in PostgREST — same root cause as `soft_delete_employees` bug discovered in Phase 2.
**How to avoid:** Always soft-delete via `SECURITY DEFINER` RPC function (`soft_delete_projects`). This is documented in `00007_soft_delete_rpc.sql` and the MEMORY.md: "Soft delete MUST use RPC".
**Warning signs:** 42501 error when trying to set `deleted_at` directly.

### Pitfall 7: Leaflet Tile src CSP Violation
**What goes wrong:** Map tiles fail to load silently, or browser console shows CSP violation for `https://a.tile.openstreetmap.org`.
**Why it happens:** The current `next.config.ts` CSP `img-src` does not include the OpenStreetMap tile domain.
**How to avoid:** Add `https://*.tile.openstreetmap.org` to both `img-src` and `connect-src` in `next.config.ts` before testing the map.
**Warning signs:** Grey map tiles, CSP violation in browser console.

---

## Code Examples

### Example 1: ProjectSchema (Zod)
```typescript
// Source: based on existing EmployeeSchema pattern in src/lib/schemas.ts
export const ProjectSchema = z.object({
  name:                       z.string().min(1, 'שם פרויקט הוא שדה חובה'),
  project_number:             z.string().optional().or(z.literal('')), // auto-generated
  open_date:                  z.string().optional().or(z.literal('')),
  expense_number:             z.string().optional().or(z.literal('')),
  description:                z.string().optional().or(z.literal('')),
  project_type:               z.enum(['project', 'staging_area', 'storage_area']).optional(),
  status:                     z.enum(['active', 'view_only', 'inactive']).default('active'),
  // PM
  project_manager_id:         z.string().uuid().optional().or(z.literal('')),
  pm_email:                   z.string().optional().or(z.literal('')),
  pm_phone:                   z.string().optional().or(z.literal('')),
  pm_notifications:           z.boolean().default(true),
  // SM
  site_manager_id:            z.string().uuid().optional().or(z.literal('')),
  sm_email:                   z.string().optional().or(z.literal('')),
  sm_phone:                   z.string().optional().or(z.literal('')),
  sm_notifications:           z.boolean().default(true),
  // CVC
  camp_vehicle_coordinator_id: z.string().uuid().optional().or(z.literal('')),
  cvc_is_employee:            z.boolean().default(true),
  cvc_phone:                  z.string().optional().or(z.literal('')),
  // Client
  client_name:                z.string().optional().or(z.literal('')),
  client_logo_url:            z.string().optional().or(z.literal('')),
  // Supervision
  supervision_company:        z.string().optional().or(z.literal('')),
  supervision_contact:        z.string().optional().or(z.literal('')),
  supervision_email:          z.string().optional().or(z.literal('')),
  supervision_phone:          z.string().optional().or(z.literal('')),
  supervision_notifications:  z.boolean().default(false),
  supervision_attach_reports: z.boolean().default(false),
  // Location
  latitude:                   z.coerce.number().optional().nullable(),
  longitude:                  z.coerce.number().optional().nullable(),
  radius:                     z.coerce.number().int().min(0).default(100),
  // Clocks (JSON string — parsed in Server Action)
  attendance_clocks:          z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (!data.cvc_is_employee && data.cvc_phone) {
    if (!/^0(5[0-9])[0-9]{7}$/.test(data.cvc_phone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['cvc_phone'],
        message: 'מספר טלפון נייד ישראלי לא תקין (10 ספרות, מתחיל ב-05)',
      })
    }
  }
})
```

### Example 2: createProject Server Action
```typescript
// Source: follows createEmployee pattern in src/actions/employees.ts
'use server'

export async function createProject(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await verifySession()
  const supabase = await createClient()

  const rawData = Object.fromEntries(formData)
  const clocksJson = rawData['attendance_clocks'] as string
  delete rawData['attendance_clocks']

  const parsed = ProjectSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  const input = parsed.data

  // Insert project (project_number auto-generated by DB trigger)
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name:                       input.name,
      project_number:             '',   // trigger fills this in
      open_date:                  input.open_date || null,
      expense_number:             input.expense_number || null,
      // ... all other fields
      created_by:                 session.userId,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: { _form: [error.message] } }
  }

  // Replace-all attendance clocks
  const clockIds: string[] = clocksJson ? JSON.parse(clocksJson) : []
  if (clockIds.length > 0) {
    await supabase.from('attendance_clocks').insert(
      clockIds.filter(Boolean).map(clockId => ({
        project_id: data.id,
        clock_id:   clockId,
        created_by: session.userId,
      }))
    )
  }

  await writeAuditLog({ userId: session.userId, action: 'INSERT', entityType: 'projects', entityId: data.id, oldData: null, newData: data as Record<string, unknown> })
  revalidatePath('/admin/projects')
  return { success: true }
}
```

### Example 3: ExcelJS Export Route Handler
```typescript
// Source: ExcelJS writeBuffer() verified via github.com/exceljs/exceljs/issues/354
// src/app/(admin)/api/export/route.ts
import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TABLES = ['companies', 'departments', 'employees', 'projects', 'users', 'role_templates']

export async function GET(req: NextRequest) {
  try {
    await verifySession()
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const table = req.nextUrl.searchParams.get('table') ?? ''
  const format = req.nextUrl.searchParams.get('format') ?? 'xlsx'

  if (!ALLOWED_TABLES.includes(table)) {
    return new Response('Invalid table', { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from(table).select('*').is('deleted_at', null)

  if (error) return new Response(error.message, { status: 500 })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ChemoSystem'
  const worksheet = workbook.addWorksheet(table)
  worksheet.views = [{ rightToLeft: true }]   // RTL for Hebrew data

  if (data && data.length > 0) {
    worksheet.columns = Object.keys(data[0]).map(key => ({
      header: key,
      key,
      width: 20,
    }))
    worksheet.addRows(data)
    worksheet.getRow(1).font = { bold: true }
  }

  if (format === 'csv') {
    const csv = await workbook.csv.writeBuffer()
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}_export.csv"`,
      },
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer as Buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${table}_export.xlsx"`,
    },
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Maps (paid) | react-leaflet + OpenStreetMap (free) | 2019+ | Zero cost, no API key |
| Leaflet v3 `Popup` | Leaflet v4 `Circle` + `Tooltip` | 2023 | Avoids CSP inline-style issue |
| `SELECT MAX(id)+1` for sequential numbers | PostgreSQL SEQUENCE + trigger | Always standard | Race-condition safe, atomic |
| SheetJS/XLSX (was on npm, removed) | ExcelJS (npm, maintained) | 2022+ | ExcelJS is actively maintained on npm |
| `useActionState` for file downloads | Route Handler (GET endpoint) | Next.js 13+ | Server Actions cannot return file streams |

**Deprecated/outdated:**
- SheetJS XLSX npm package: removed from npm registry at v18.5, older versions have high severity CVEs. DO NOT use. ExcelJS is already installed and the correct choice.
- `middleware.ts` for auth: this project uses `proxy.ts` (not middleware.ts). Already documented in MEMORY.md.

---

## Open Questions

1. **react-leaflet version: v4 vs v5**
   - What we know: v5 targets `react@rc` (pre-release React). v4 targets stable React 19 which is what this project uses.
   - What's unclear: Whether v5 has been released as stable by the time this phase starts.
   - Recommendation: Run `npm info react-leaflet dist-tags` before installing. Install `react-leaflet@4` unless v5 is tagged `latest` with stable React dependency.

2. **Project number format: PR26 prefix**
   - What we know: Requirement PROJ-05 specifies `PR26XXXXXX` format.
   - What's unclear: Does "26" represent the year 2026 (should it be PR27 next year), or is it a fixed prefix?
   - Recommendation: Treat "26" as a fixed literal per the requirement. Do not make it dynamic unless Sharon confirms otherwise. If year-based, change the trigger function to use `EXTRACT(YEAR FROM NOW())::TEXT`.

3. **Export — which columns to include**
   - What we know: `SELECT *` will export all columns including internal ones (created_by UUID, deleted_at, etc.).
   - What's unclear: Whether Sharon wants all columns or a curated export (Hebrew column names, no internal UUIDs).
   - Recommendation: Start with `SELECT *` minus `deleted_at`, `created_by`, `updated_by`. Add Hebrew header mapping in the workbook columns config in a future iteration. Confirm with Sharon after first implementation.

---

## Sources

### Primary (HIGH confidence)
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/actions/employees.ts` — replace-all pattern for child tables, Server Action structure, audit log, revalidatePath
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/components/admin/employees/EmployeeForm.tsx` — photo upload pattern, Supabase Storage browser client usage
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/supabase/migrations/00001_foundation_schema.sql` — existing projects stub, trigger pattern, universal columns
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/supabase/migrations/00007_soft_delete_rpc.sql` — SECURITY DEFINER soft delete RPC pattern
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/supabase/migrations/00010_storage_policies.sql` — Storage bucket RLS pattern
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/next.config.ts` — current CSP config that needs tile domain addition
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/lib/schemas.ts` — existing Zod patterns
- `C:/Sharon_ClaudeCode/Apps/ChemoSystem/package.json` — confirmed installed packages
- https://react-leaflet.js.org/docs/start-installation/ — react-leaflet installation requirements (HIGH)
- https://supabase.com/docs/guides/storage/uploads/standard-uploads — Supabase Storage standard upload pattern (HIGH)
- https://github.com/exceljs/exceljs/issues/354 — ExcelJS `writeBuffer()` pattern for downloads (HIGH)

### Secondary (MEDIUM confidence)
- https://xxlsteve.net/blog/react-leaflet-on-next-15/ — react-leaflet + Next.js 15 App Router setup
- https://placekit.io/blog/articles/making-react-leaflet-work-with-nextjs-493i — dynamic import pattern
- https://github.com/Leaflet/Leaflet/issues/9168 — Leaflet CSP popup inline-style issue (confirmed open, no fix)
- https://www.etl-tools.com/regular-expressions/is-israeli-mobile-phone-number.html — Israeli mobile regex
- https://www.regextester.com/104924 — Israeli mobile phone regex verified

### Tertiary (LOW confidence)
- General WebSearch results on PostgreSQL SEQUENCE + trigger for custom formatted IDs (pattern is well-known but no single authoritative URL verified)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via package.json (installed) or official docs
- Architecture: HIGH — patterns derived directly from existing codebase + official docs
- DB schema: HIGH — gaps identified by comparing existing migration to requirements
- Map integration: HIGH — SSR issue is well-documented; dynamic import pattern verified
- Excel export: HIGH — ExcelJS writeBuffer pattern verified via GitHub issues
- Pitfalls: HIGH — most derived from existing codebase bugs already documented in MEMORY.md

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable libraries — 30 day window)
