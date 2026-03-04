# Architecture Research — ChemoSys v2.0 Shell Integration

**Domain:** Employee-facing operational system (ChemoSys) added to existing Next.js Admin Panel
**Researched:** 2026-03-04
**Confidence:** HIGH — based on direct analysis of existing codebase (18 source files read)

---

## Context: What Already Exists

This is a **subsequent milestone** research document. v1.0 shipped a complete admin panel. The
architecture below documents how to integrate the new `(app)` route group into the existing
codebase — not how to build from scratch.

### Existing Route Groups

```
src/app/
├── (auth)/           — /login  (public, centered layout, shared between admin and ChemoSys)
├── (admin)/          — /admin/* (Sharon-only, right sidebar, verifySession() only guard)
└── layout.tsx        — Root: html lang="he" dir="rtl", Heebo font, Toaster
```

### Existing Auth Infrastructure (Already Working)

| Component | File | Role |
|-----------|------|------|
| Token refresh | `src/proxy.ts` | Refreshes Supabase JWT on every request, redirects unauthenticated to /login |
| Session verify | `src/lib/dal.ts` `verifySession()` | Fast local JWT check via `getClaims()`, no network call |
| Permission check | `src/lib/dal.ts` `requirePermission()` | Calls `get_user_permissions()` RPC, throws if insufficient |
| Page guard | `src/lib/dal.ts` `checkPagePermission()` | Returns boolean, used for AccessDenied render |
| Nav filter | `src/lib/dal.ts` `getNavPermissions()` | Returns list of allowed module_keys for current user |
| DB RPC | `get_user_permissions(p_user_id)` | SECURITY DEFINER, returns all modules for is_admin, actual perms for others |

---

## System Overview: After v2.0 Integration

```
Browser
  |
  | HTTPS
  v
Vercel (Edge)
  |-- proxy.ts  (JWT refresh + redirect unauthenticated to /login)
  |             (currently redirects /app/* to /login if no user — needs update for ChemoSys)
  |
  v
Next.js App Router
  |
  |-- (auth)/                   /login page
  |     login.tsx               shared for both admin and ChemoSys
  |     (auth action redirects to /admin/* or /app/* based on post-login target)
  |
  |-- (admin)/                  /admin/* pages (Sharon-only)
  |     layout.tsx              RTL right sidebar, verifySession() only
  |     admin/dashboard/        Stats + audit feed
  |     admin/employees/        CRUD
  |     ...
  |
  |-- (app)/                    /app/* pages (ChemoSys — managers + field workers)
        layout.tsx              Top header + module switcher, verifySession() + permission guard
        app/
          page.tsx              Redirect to /app/fleet (or first permitted module)
          fleet/
            page.tsx            Fleet module home (dashboard + 16 sub-module menu)
            layout.tsx          (optional — fleet-specific sub-layout)
          equipment/
            page.tsx            Equipment module home (dashboard + placeholder)
            layout.tsx          (optional)
  |
  v
lib/dal.ts  (unchanged — works for both admin and ChemoSys)
  |
  v
Supabase PostgreSQL
  modules table  (needs new ChemoSys rows: fleet, equipment, fleet sub-modules)
  user_permissions table  (already supports any module_key)
  get_user_permissions() RPC  (already returns all modules — no change needed)
```

---

## Route Structure

### URL Design

```
/login                     — shared login page (no change)
/admin/*                   — admin panel (no change)
/app/                      — ChemoSys root (redirect to first permitted module)
/app/fleet                 — Fleet module home (dashboard + 16 sub-module tiles)
/app/fleet/driver-card     — (future) sub-module page
/app/fleet/vehicle-card    — (future) sub-module page
... (16 sub-modules — stub routes in v2.0, full build in future milestones)
/app/equipment             — Equipment module home (dashboard + placeholder)
```

### File Structure — New Files for v2.0

```
src/app/
├── (app)/                         NEW route group
│   ├── layout.tsx                 NEW ChemoSys shell layout
│   └── app/
│       ├── page.tsx               NEW redirect to first permitted module
│       ├── fleet/
│       │   └── page.tsx           NEW Fleet home — dashboard + 16 sub-module menu
│       └── equipment/
│           └── page.tsx           NEW Equipment home — dashboard + placeholder
│
src/components/
├── app/                           NEW ChemoSys-specific components
│   ├── AppHeader.tsx              NEW top nav: logo, module switcher, user menu
│   ├── ModuleSwitcher.tsx         NEW buttons to jump between fleet / equipment
│   ├── FleetSubModuleGrid.tsx     NEW 16-tile sub-module menu
│   └── AppStatCard.tsx            NEW (or reuse admin StatsCards pattern)
│
src/actions/
└── app-auth.ts                    NEW login redirect logic for ChemoSys entry
```

### Files Modified (Minimal Surgery)

| File | Change |
|------|--------|
| `src/proxy.ts` | Add `/app/*` to the protected routes check (same logic as `/admin/*`) |
| `src/actions/auth.ts` | Add `redirectTo` parameter so login can redirect to `/app/fleet` instead of `/admin/companies` |
| `supabase/migrations/000XX_chemosys_modules.sql` | NEW migration to seed fleet/equipment module keys |

---

## Layout Architecture

### Admin Layout (Existing — No Change)

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (right, dark navy #1B3A4B, 64 = w-64)      │
│  ┌────────┐  ┌─────────────────────────────────┐    │
│  │ CA logo│  │   Main Content (lg:ps-64)        │    │
│  │ nav    │  │   Server Component pages         │    │
│  │ items  │  │                                  │    │
│  │ logout │  │                                  │    │
│  └────────┘  └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### ChemoSys Layout (New)

```
┌─────────────────────────────────────────────────────┐
│  Header (top, sticky, dark navy, h-14)              │
│  [CA logo]  [FleetModule ▼]  [Equipment]  [avatar]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Main Content                                      │
│   Fleet Home: stat cards + 16 sub-module tiles      │
│   Equipment Home: stat cards + placeholder          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The ChemoSys layout uses a **top header** (not sidebar). This is the correct UX for module-based
operational software accessed from mobile devices in the field.

### Why Top Header Instead of Sidebar

- Field workers use mobile phones — sidebar collapses to a hamburger which is extra tap
- Module switching (fleet ↔ equipment) is top-level navigation, not per-page
- Operational dashboards benefit from full-width layout with no sidebar offset
- Simpler mobile UX: header stays, content scrolls below

---

## Login Flow for ChemoSys

### Current State

The existing `/login` page calls `login()` Server Action which always redirects to
`/admin/companies` on success. This is hardcoded.

### v2.0 Login Flow (Updated)

Two options for ChemoSys login. The better option:

**Option A — Same /login page, redirect based on user type (RECOMMENDED)**

```
User visits /login
  → fills email + password
  → clicks "כניסה"
  → login() Server Action:
      → verifySession succeeds
      → check if user has is_admin = true → redirect /admin/dashboard
      → check if user has any /app/* module permission → redirect /app/fleet
      → else → redirect /app/ (show "no permissions" placeholder)
```

This means ONE login URL for all users. Sharon goes to admin, employees go to ChemoSys.
No separate `/app/login` URL needed.

**Option B — Add /app/login page**

Separate login UI with ChemoSys branding. Calls the same Supabase `signInWithPassword()`.
Adds complexity for no real benefit — same credentials, same session, same Supabase Auth.
Not recommended unless the UX must visually distinguish the two entry points.

### Module Selection Buttons on Login Page

The PROJECT.md specifies "module selection buttons on login page." The correct implementation:

```
AFTER login succeeds (user is authenticated):
  → fetch user's permitted modules from get_user_permissions()
  → render buttons for each permitted module
  → user clicks "צי רכב" → redirect /app/fleet
  → user clicks "צמ"ה" → redirect /app/equipment
  → if only 1 module permitted → auto-redirect without showing chooser
  → if 0 modules permitted → show "אין הרשאות — פנה לאדמין" screen
```

This is a **post-login module chooser**, not a pre-login module selector. The user authenticates
first, then the system shows what they have access to.

### Implementation Pattern

```typescript
// src/actions/auth.ts  (modified login action)
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  // ... rate limiting, validation (unchanged) ...

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'מייל או סיסמה שגויים' }

  // Check is_admin first
  const { data: userRow } = await supabase
    .from('users')
    .select('is_admin, auth_user_id')
    .eq('auth_user_id', (await supabase.auth.getClaims()).data?.claims?.sub)
    .is('deleted_at', null)
    .maybeSingle()

  if (!userRow || userRow.is_admin) {
    redirect('/admin/dashboard')
  }

  // For ChemoSys users — redirect to module chooser or first module
  redirect('/app')  // (app)/app/page.tsx handles the module selection UI
}
```

---

## Permission Integration

### How checkPagePermission() Wires into ChemoSys Pages

The existing `checkPagePermission()` in `dal.ts` already works for any `module_key`. No changes
to the DAL are needed. The pattern for ChemoSys pages is identical to admin pages:

```typescript
// src/app/(app)/app/fleet/page.tsx
import { checkPagePermission } from '@/lib/dal'
import { AccessDenied } from '@/components/shared/AccessDenied'

export default async function FleetHomePage() {
  // verifySession() is called by (app)/layout.tsx — already done before page renders
  const canView = await checkPagePermission('fleet', 1)  // level 1 = read
  if (!canView) return <AccessDenied />

  // ... fetch fleet stats, render dashboard
}
```

### How requirePermission() Wires into ChemoSys Server Actions

```typescript
// src/actions/fleet.ts  (future)
'use server'
export async function updateDriverCard(formData: FormData) {
  await requirePermission('fleet_driver_card', 2)  // level 2 = read+write
  // ... mutation
}
```

### (app) Layout — Permission Check + Module Switcher

```typescript
// src/app/(app)/layout.tsx
import { verifySession, getNavPermissions } from '@/lib/dal'
import { AppHeader } from '@/components/app/AppHeader'

export default async function AppLayout({ children }) {
  const session = await verifySession()  // redirects to /login if unauthenticated

  // Load permitted modules for module switcher
  const permitted = await getNavPermissions()
  // permitted = ['fleet', 'equipment', ...] for ChemoSys users

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader user={session} permittedModules={permitted} />
      <main className="flex-1 p-4 lg:p-6">
        {children}
      </main>
    </div>
  )
}
```

**Note:** `getNavPermissions()` currently returns admin module keys hardcoded for the bootstrap
case. It needs a small update to also include ChemoSys modules once they are seeded.

---

## Module Definitions in DB

### New Migration: `000XX_chemosys_modules.sql`

The `modules` table `parent_key` column supports hierarchy. Use it for sub-modules:

```sql
-- ChemoSys top-level modules
INSERT INTO modules (key, name_he, parent_key, sort_order, icon) VALUES
  ('fleet',            'צי רכב',               NULL,    10, 'Truck'),
  ('equipment',        'צמ"ה',                  NULL,    11, 'HardHat')
ON CONFLICT (key) DO NOTHING;

-- Fleet sub-modules (16)
INSERT INTO modules (key, name_he, parent_key, sort_order, icon) VALUES
  ('fleet_driver_card',      'כרטיס נהג',              'fleet', 1, 'IdCard'),
  ('fleet_vehicle_card',     'כרטיס רכב',              'fleet', 2, 'Car'),
  ('fleet_expenses',         'סל הוצאות',              'fleet', 3, 'Receipt'),
  ('fleet_mileage',          'ניהול ק"מ',              'fleet', 4, 'Gauge'),
  ('fleet_fuel',             'דלק',                    'fleet', 5, 'Fuel'),
  ('fleet_tolls',            'כבישי אגרה',             'fleet', 6, 'Road'),
  ('fleet_violations',       'דוחות תעבורה/משטרה/נזקים','fleet', 7, 'AlertTriangle'),
  ('fleet_exceptions',       'טבלאות חריגים',          'fleet', 8, 'TableProperties'),
  ('fleet_ev_charging',      'טעינת רכב חשמלי',        'fleet', 9, 'Zap'),
  ('fleet_rental',           'הזמנת רכב שכור',         'fleet', 10, 'KeySquare'),
  ('fleet_safety_forms',     'טפסי בטיחות',            'fleet', 11, 'ShieldCheck'),
  ('fleet_invoices',         'אישורי חשבוניות ספקים',  'fleet', 12, 'FileCheck'),
  ('fleet_maintenance_log',  'ספר טיפולים מכניים',     'fleet', 13, 'Wrench'),
  ('fleet_parts',            'חלקי חילוף/צמיגים',      'fleet', 14, 'Settings2'),
  ('fleet_camp_vehicles',    'רכבי מחנה + QR',         'fleet', 15, 'QrCode'),
  ('fleet_reports',          'הפקת דוחות',             'fleet', 16, 'FileBarChart')
ON CONFLICT (key) DO NOTHING;

-- Equipment top-level only (sub-modules defined in future milestone)
-- No sub-module seeds for equipment in v2.0
```

### Permission Key Strategy

Top-level module access (`fleet` level 1) = can see the fleet home page and its sub-module menu.
Sub-module access (`fleet_driver_card` level 1) = can open that specific sub-module.

In v2.0, checking `fleet` permission is sufficient — the sub-module pages don't exist yet.
Future milestones implement `fleet_driver_card` etc. when building each sub-module.

---

## Shared Components: Reuse vs New

### Directly Reusable (No Changes)

| Component | Path | Used in ChemoSys For |
|-----------|------|---------------------|
| `AccessDenied` | `components/shared/AccessDenied.tsx` | Permission denied on any (app) page |
| `LogoutButton` | `components/shared/LogoutButton.tsx` | AppHeader user menu |
| `RefreshButton` | `components/shared/RefreshButton.tsx` | Dashboard refresh |
| `Button`, `Card`, `Badge`, etc. | `components/ui/` | All ChemoSys UI |
| `Skeleton` | `components/ui/skeleton.tsx` | Loading states |
| Brand CSS vars | `app/globals.css` | Same colors, same font |

### Reusable With Minor Adaptation

| Component | Current Form | Adaptation for ChemoSys |
|-----------|-------------|------------------------|
| `StatsCards` | Admin-specific Stats type (employees, projects, etc.) | Extract generic `StatItem[]` type. Admin and fleet home each pass their own items. |
| `DataTable` | Generic — already accepts any column config | Reuse as-is |
| `DeleteConfirmDialog` | Generic title + description | Reuse as-is |

### New Components Required

| Component | Path | Purpose |
|-----------|------|---------|
| `AppHeader` | `components/app/AppHeader.tsx` | Top header: CA logo, module switcher, user email, logout |
| `ModuleSwitcher` | `components/app/ModuleSwitcher.tsx` | Dropdown/buttons to navigate between fleet / equipment (only shows permitted modules) |
| `FleetSubModuleGrid` | `components/app/FleetSubModuleGrid.tsx` | 16-tile responsive grid — each tile = icon + Hebrew label + disabled if no permission |
| `ModuleHomeSkeleton` | `components/app/ModuleHomeSkeleton.tsx` | Loading state for module home pages |

### StatsCards Refactor Plan

Extract the generic pattern from admin's `StatsCards.tsx`:

```typescript
// components/shared/StatsGrid.tsx  (new generic)
type StatItem = {
  label: string
  value: number | string
  icon: LucideIcon
  color: string
  bg: string
}
export function StatsGrid({ items }: { items: StatItem[] }) { ... }

// components/admin/dashboard/StatsCards.tsx  (updated — use StatsGrid)
// components/app/fleet/FleetStatsCards.tsx   (new — use StatsGrid)
```

---

## Data Flow

### ChemoSys Page Load Flow

```
User visits /app/fleet
  → proxy.ts runs:
      → no valid JWT → redirect /login
      → valid JWT → NextResponse.next()
  →
  → (app)/layout.tsx (Server Component):
      → verifySession()  [React cache — fast JWT check]
      → getNavPermissions()  [DB call — loads user's module keys]
      → renders AppHeader with permittedModules
      → renders {children}
  →
  → (app)/app/fleet/page.tsx (Server Component):
      → checkPagePermission('fleet', 1)  [DB call via get_user_permissions RPC]
      → if false → return <AccessDenied />
      → fetch fleet stats  [future: fleet-specific tables]
      → return <FleetStatCards /> + <FleetSubModuleGrid />
```

### Deduplication Note

`verifySession()` and `checkPagePermission()` both call into `getNavPermissions()` which calls
the RPC. React `cache()` wraps `verifySession()` so it only runs once per render tree — the
underlying JWT check is deduplicated. The RPC call in `checkPagePermission()` is a second call
but it is cheap (SECURITY DEFINER, indexed lookup). This is the same pattern used in the admin
panel and it performs well.

### Module Switcher Data Flow

```
AppHeader receives permittedModules: string[]  (from layout.tsx server fetch)
  → filters CHEMOSYS_MODULES config array to only permitted entries
  → renders active module highlighted
  → clicking another module → client-side Link navigation → /app/equipment
```

The module switcher is a **client component** (needs `usePathname()` for active state) wrapped
inside the server layout that passes the permitted modules list as props. Same pattern as
`SidebarNav.tsx` in the admin shell.

---

## Component Boundary Map

```
(app)/layout.tsx  [Server]
  ├── verifySession()  → guards entire (app) tree
  ├── getNavPermissions()  → gets permitted modules
  └── AppHeader.tsx  [Client — needs usePathname for active module]
          └── ModuleSwitcher.tsx  [Client]
                └── LogoutButton.tsx  [Client — calls logout() Server Action]

(app)/app/fleet/page.tsx  [Server]
  ├── checkPagePermission('fleet', 1)  → AccessDenied if no permission
  ├── fetch fleet stats (future)
  ├── StatsGrid.tsx  [Client — stat cards]
  └── FleetSubModuleGrid.tsx  [Client — 16 tiles]
          └── each tile = Link + icon + label + disabled state

(app)/app/equipment/page.tsx  [Server]
  ├── checkPagePermission('equipment', 1)
  ├── StatsGrid.tsx  (placeholder zeros in v2.0)
  └── EquipmentPlaceholder.tsx  [Client — "coming soon" state]
```

---

## Proxy.ts Update

The current `proxy.ts` only redirects to `/login` if the user is not authenticated and the path
is not `/login` or `/auth`. The `/app/*` routes are already covered by this rule (they're not
excluded), so technically no change is needed for the auth redirect.

However, the current redirect-after-login in `auth.ts` always goes to `/admin/companies`. This
must be updated to route ChemoSys users to `/app/fleet` (or `/app` module chooser).

```typescript
// Current (v1.0):
redirect('/admin/companies')

// New (v2.0):
// After login, check is_admin. If not admin, redirect to /app.
// (app)/app/page.tsx handles the module routing logic.
if (userRow?.is_admin) {
  redirect('/admin/dashboard')
} else {
  redirect('/app')
}
```

The `/app/page.tsx` then reads permitted modules and redirects to the first one:

```typescript
// src/app/(app)/app/page.tsx
import { getNavPermissions } from '@/lib/dal'
import { redirect } from 'next/navigation'

export default async function AppRootPage() {
  const permitted = await getNavPermissions()

  // Module priority order — first match wins
  const CHEMOSYS_MODULES = ['fleet', 'equipment']
  const first = CHEMOSYS_MODULES.find(m => permitted.includes(m))

  if (first === 'fleet') redirect('/app/fleet')
  if (first === 'equipment') redirect('/app/equipment')

  // No permitted modules
  return <NoPermissionsPage />
}
```

---

## DB Migration Order

```
00016_chemosys_modules.sql
  → Inserts fleet, equipment, and 16 fleet sub-module keys into modules table
  → Idempotent (ON CONFLICT DO NOTHING)
  → Run BEFORE building (app) pages
```

No other DB changes needed. The existing `user_permissions`, `get_user_permissions()` RPC, and
`users.is_admin` columns all work for ChemoSys module keys without modification.

To grant a ChemoSys user access to fleet: admin panel Users page → set `fleet` permission to
level 1 (read) or 2 (read+write). The permission matrix UI already handles any module_key.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Login Page for ChemoSys

**What:** Creating `/app/login` as a second login page with its own form
**Why bad:** Same Supabase Auth, same credentials, same session cookies — double maintenance with
zero benefit. Two login URLs confuses users.
**Instead:** One `/login` page, post-login redirect based on `is_admin` flag.

### Anti-Pattern 2: Hiding Sub-Module Tiles Client-Side Only

**What:** Rendering all 16 fleet sub-module tiles, then greying out based on client-side
permission data passed as props
**Why bad:** The permission data must come from the server — passing it as client-side props
means the data was fetched server-side anyway. The greying logic is fine, but do not let the
server component pass a simple `isAdmin: true` boolean that bypasses permission checks.
**Instead:** Server Component fetches permissions, passes `permittedSubModules: string[]` as
props to the Client Component grid. Tiles are greyed if module_key not in the list.

### Anti-Pattern 3: Duplicating getNavPermissions Logic in AppLayout

**What:** Writing a second version of `getNavPermissions()` in the new `(app)/layout.tsx`
specifically for ChemoSys module keys
**Why bad:** Two permission functions diverge over time, bugs in one don't appear in the other.
**Instead:** Call `getNavPermissions()` from `dal.ts` as-is. The function returns whatever keys
the user has — it doesn't filter by app context. Fleet/equipment keys will be in the result
once the migration adds them.

### Anti-Pattern 4: Checking Permissions in AppHeader Client Component

**What:** Making the AppHeader fetch user permissions on the client via a Supabase browser
client to decide which modules to show
**Why bad:** Exposes permission logic to the browser, causes a loading flash (module list
appears after client hydration), adds a network call on every navigation.
**Instead:** Server Component layout fetches permissions, passes `permittedModules: string[]`
down to AppHeader as props. AppHeader is a client component only for `usePathname()` active state.

### Anti-Pattern 5: Sub-Module Routes as Parallel Routes

**What:** Using Next.js parallel routes (`@slot` syntax) for the 16 fleet sub-modules
**Why bad:** Unnecessary complexity. Each sub-module is an independent page with its own data.
Standard nested routes are the correct model.
**Instead:** `(app)/app/fleet/[sub-module]/page.tsx` for each sub-module when built in future
milestones.

---

## Build Order for v2.0

Dependencies flow bottom-up. Cannot build ChemoSys pages until migration and DAL updates are done.

```
Step 1: DB Migration (required first)
  → supabase/migrations/000XX_chemosys_modules.sql
  → Adds fleet, equipment, and 16 fleet sub-module keys to modules table
  → Run in Supabase Dashboard before any app code

Step 2: Update auth redirect (required second)
  → src/actions/auth.ts
  → Post-login: is_admin → /admin/dashboard, else → /app
  → This makes the login flow work end-to-end

Step 3: (app) Route Group + Layout (required third)
  → src/app/(app)/layout.tsx
  → verifySession() + getNavPermissions() + AppHeader
  → Everything inside (app) depends on this layout

Step 4: AppHeader + ModuleSwitcher (required fourth)
  → src/components/app/AppHeader.tsx
  → src/components/app/ModuleSwitcher.tsx
  → Layout needs these to render

Step 5: /app root page (required fifth)
  → src/app/(app)/app/page.tsx
  → Reads permitted modules, redirects to first
  → Needed for login redirect to work

Step 6: Fleet home page (main feature)
  → src/app/(app)/app/fleet/page.tsx
  → checkPagePermission + stats + FleetSubModuleGrid
  → Depends on migration (fleet module key must exist)

Step 7: FleetSubModuleGrid component
  → src/components/app/FleetSubModuleGrid.tsx
  → 16-tile responsive grid (4 cols desktop / 2 cols mobile)
  → Depends on migration (fleet_* module keys for permission check)

Step 8: Equipment home page (secondary feature)
  → src/app/(app)/app/equipment/page.tsx
  → checkPagePermission + placeholder
  → Simpler than fleet — no sub-module grid needed in v2.0

Step 9: StatsGrid refactor (optional cleanup)
  → Extract generic StatsGrid from admin StatsCards
  → Used by fleet and equipment home pages
  → Can be skipped if fleet stats are placeholder zeros in v2.0
```

---

## Scalability Considerations

| Concern | v2.0 (Shell) | Future Milestones | Scale Ceiling |
|---------|-------------|-------------------|---------------|
| Adding new ChemoSys module | Add row to modules table + new route | Same pattern, no infra change | Unlimited |
| Adding sub-modules | Already seeded in modules table | Build pages as needed | 16 fleet sub-modules already seeded |
| Fleet data volume | No fleet tables yet | Add partitioned tables per entity | PostgreSQL handles 10M+ rows easily |
| Real-time vehicle data | Not in v2.0 | Supabase Realtime on specific pages | Supabase Free tier: 200 concurrent connections |
| Permission granularity | Module-level (fleet level 1/2) | Sub-module level (fleet_driver_card) | Already modeled in DB |
| Mobile field workers | Responsive CSS, top header layout | PWA installable if needed | No native app required |

---

## Integration Points Summary

| Integration Point | File | Change Type | Notes |
|-------------------|------|-------------|-------|
| Proxy auth redirect | `src/proxy.ts` | No change needed | Already redirects non-/login to /login |
| Login post-redirect | `src/actions/auth.ts` | Modify redirect logic | is_admin check before redirect |
| DAL permissions | `src/lib/dal.ts` | No change | Works for any module_key |
| Modules table | `supabase/migrations/` | New migration | Add fleet + equipment + 16 sub-module keys |
| Admin permission matrix | Admin Users page | No change | Will display new fleet/equipment modules automatically |
| Shared UI components | `src/components/ui/` | No change | All reusable as-is |
| AccessDenied component | `src/components/shared/AccessDenied.tsx` | No change | Reuse directly |
| StatsCards | `src/components/admin/dashboard/StatsCards.tsx` | Optional refactor | Extract generic StatsGrid |
| Root layout | `src/app/layout.tsx` | No change | RTL + Heebo applies to all routes |
| CSS variables | `src/app/globals.css` | No change | All brand colors reused |

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| Route groups isolation: each group gets its own layout | Direct codebase analysis — `(admin)/layout.tsx` and `(auth)/layout.tsx` | HIGH |
| verifySession() uses getClaims() not getUser() — no network call | `src/lib/dal.ts` lines 30-48 | HIGH |
| get_user_permissions() is SECURITY DEFINER, returns all modules for is_admin | `supabase/migrations/00012_access_control.sql` lines 30-60 | HIGH |
| modules table has parent_key column for sub-module hierarchy | `supabase/migrations/00001_foundation_schema.sql` lines 108-117 | HIGH |
| proxy.ts redirects to /login for all non-/login, non-/auth paths | `src/proxy.ts` lines 54-62 | HIGH |
| getNavPermissions() returns hardcoded list for bootstrap admin | `src/lib/dal.ts` lines 106-108 | HIGH |
| React cache() wraps verifySession() for deduplication | `src/lib/dal.ts` line 30 | HIGH |
| auth.ts redirects to /admin/companies on success — needs update | `src/actions/auth.ts` line 92 | HIGH |
| Admin layout is Sharon-only — no module permission checks | `src/app/(admin)/layout.tsx` comment lines 1-6 | HIGH |
| 16 fleet sub-module names | `src/app/(admin)/PROJECT.md` lines 104-105 | HIGH |

---

*Architecture research for: ChemoSys v2.0 Shell Integration*
*Researched: 2026-03-04*
*Based on: Direct analysis of 18 source files — HIGH confidence throughout*
