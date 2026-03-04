# Phase 8: (app) Shell — Research

**Researched:** 2026-03-04
**Domain:** Next.js App Router route groups, server component layouts, RTL top-header shell
**Confidence:** HIGH — all findings verified against the live codebase (Phases 1–7 already built)

---

## Summary

Phase 8 creates the authenticated shell that wraps every `/app/*` page. The shell consists of three pieces: a route-group layout (`(app)/layout.tsx`), a top-header server component (`AppHeader`), and a client dropdown component (`ModuleSwitcher`). All infrastructure — `verifyAppUser()`, `getAppNavPermissions()`, `logout()`, CSS variables, shadcn/ui primitives — was already built in Phases 6 and 7. This phase is purely a composition task: wire existing DAL functions into a new layout and build the header UI.

The key architectural decision is already locked: **top-header layout (not sidebar)**, optimized for field workers on mobile. The `(app)` route group must wrap `src/app/app/page.tsx` (the existing module selection page) without moving that file — Next.js App Router supports adding a route group around an existing page by placing `layout.tsx` in a `(app)` folder and keeping `app/page.tsx` in place. The existing `app/page.tsx` already calls `verifyAppUser()` directly; once the layout wraps it, the layout guard fires first and the page-level call becomes redundant (harmless but can be left in place for defense-in-depth).

The user's name for the header requires a Supabase join: `users` table (linked by `auth_user_id` = `verifyAppUser().userId`) → `employees` table (via `employee_id` FK) → `first_name + last_name`. This is a single `.select('*, employees(first_name, last_name)')` query. For admin users (Sharon) who have a `public.users` row, this works normally. For bootstrap admin (no `public.users` row), the layout should fall back to showing the email address.

**Primary recommendation:** One plan, one layout file, two components (`AppHeader` + `ModuleSwitcher`). No new packages needed.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.6 | Route group layout, Server Components | Project stack |
| React | 19.0.0 | `cache()`, Server Components | Project stack |
| `@radix-ui/react-dropdown-menu` | 2.1.16 | ModuleSwitcher dropdown primitive | Already installed |
| `lucide-react` | 0.575.0 | Module icons (Truck, HardHat, LogOut) | Already installed |
| `@supabase/ssr` | 0.8.0 | `createClient()` for user name query | Already installed |
| `tailwindcss` | v4 | RTL-aware layout classes | Project stack |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/image` | (Next.js built-in) | Logo display | Always — avoids layout shift |
| `next/navigation` | (Next.js built-in) | `redirect()` in layout | Layout guard |
| `server-only` | 0.0.1 | Guard server-only files | Not needed in layout itself |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DropdownMenu (Radix) | Sheet slide-in panel | Dropdown is simpler for 2 modules; Sheet better for 10+ modules |
| Fetching user name in layout | Passing via `verifyAppUser()` return type | Extending return type requires dal.ts change; separate query in layout is cleaner |
| Server Component header | Client Component header | Server component avoids hydration; works because logout is a form action, not onClick |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/app/
├── (app)/
│   └── layout.tsx          ← NEW: route group layout, verifyAppUser() guard
├── app/
│   └── page.tsx            ← EXISTS: module selection page (stays in place)
src/components/
└── app/                    ← NEW: ChemoSys app-specific components
    ├── AppHeader.tsx        ← NEW: server component, passes data to ModuleSwitcher
    └── ModuleSwitcher.tsx   ← NEW: client component, dropdown with module links
```

**Critical note:** `src/app/(app)/layout.tsx` and `src/app/app/page.tsx` coexist. Next.js App Router matches `(app)/layout.tsx` as the layout for the `/app` route segment because route groups (parentheses) are transparent to the URL structure. This is a verified Next.js pattern — route groups share URL segments with non-grouped siblings.

### Pattern 1: Route Group Layout with Auth Guard

**What:** `(app)/layout.tsx` is an async Server Component that calls `verifyAppUser()` at the top. If the call throws (unauthenticated), Next.js catches the `redirect()` and navigates to `/chemosys`. If it succeeds, the layout renders the header + children.

**When to use:** Whenever a set of routes shares both a UI shell and an auth requirement.

**Example (derived from existing (admin)/layout.tsx pattern):**
```typescript
// src/app/(app)/layout.tsx
import { verifyAppUser, getAppNavPermissions } from '@/lib/dal'
import { AppHeader } from '@/components/app/AppHeader'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth guard — redirects to /chemosys if unauthenticated, blocked, or no app_* perms
  const appUser = await verifyAppUser()

  // Fetch permitted modules for ModuleSwitcher — uses already-cached getPermissionsRpc
  const permissions = await getAppNavPermissions()

  // Fetch user display name (first_name + last_name via employee join)
  const supabase = await createClient()
  const { data: userRow } = await supabase
    .from('users')
    .select('employees(first_name, last_name)')
    .eq('auth_user_id', appUser.userId)
    .is('deleted_at', null)
    .maybeSingle()

  const displayName = userRow?.employees
    ? `${userRow.employees.first_name} ${userRow.employees.last_name}`
    : appUser.email  // fallback for bootstrap admin (no public.users row)

  return (
    <div className="min-h-screen bg-sidebar-bg flex flex-col" dir="rtl">
      <AppHeader
        displayName={displayName}
        permissions={permissions}
      />
      <main className="flex-1 p-4">
        {children}
      </main>
    </div>
  )
}
```

### Pattern 2: AppHeader — Server Component with Client Child

**What:** `AppHeader` is a Server Component that receives `displayName` and `permissions` as props. It renders the logo and user name directly (static). It renders `ModuleSwitcher` (client component) passing it the `permissions` array.

**Why Server Component for the header:** The header contains no interactive state of its own — only `ModuleSwitcher` needs interactivity (dropdown open/close). Making the outer header a server component avoids hydrating static content.

```typescript
// src/components/app/AppHeader.tsx
// Server component — no "use client"
import Image from 'next/image'
import { ModuleSwitcher } from './ModuleSwitcher'
import { AppLogoutButton } from './AppLogoutButton'  // or reuse LogoutButton

type AppHeaderProps = {
  displayName: string
  permissions: string[]
}

export function AppHeader({ displayName, permissions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between
                       gap-4 bg-sidebar-bg border-b border-white/10 px-4 py-3">
      {/* Logo — RTL: starts on the right */}
      <div className="flex items-center gap-3">
        <Image src="/logo-icon.png" alt="CA" width={32} height={32} />
        <span className="text-sidebar-text font-bold text-sm hidden sm:block">
          CHEMO SYSTEM
        </span>
      </div>

      {/* Right side: user name + module switcher + logout */}
      <div className="flex items-center gap-3">
        <span className="text-sidebar-text/80 text-sm hidden sm:block">
          {displayName}
        </span>
        <ModuleSwitcher permissions={permissions} />
        <AppLogoutButton />
      </div>
    </header>
  )
}
```

### Pattern 3: ModuleSwitcher — Client Component Dropdown

**What:** `ModuleSwitcher` is a `"use client"` component. It receives `permissions: string[]` from the server and renders a `DropdownMenu` (already installed Radix primitive) with only the modules the user has access to. Clicking a module item navigates with a `<Link>` — no `useRouter()` needed.

**Module-to-route mapping:**
```typescript
const MODULE_MAP = {
  app_fleet: { label: 'צי רכב', href: '/app/fleet', icon: Truck },
  app_equipment: { label: 'צמ"ה', href: '/app/equipment', icon: HardHat },
} as const
```

**Note:** Only `app_fleet` and `app_equipment` are top-level module keys shown in ModuleSwitcher. Sub-module keys (e.g. `app_fleet_vehicles`) are filtered out — ModuleSwitcher shows the two parent modules only.

**Example:**
```typescript
"use client"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Truck, HardHat, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const TOP_LEVEL_MODULES = ['app_fleet', 'app_equipment'] as const

const MODULE_MAP = {
  app_fleet:     { label: 'צי רכב', href: '/app/fleet',      icon: Truck },
  app_equipment: { label: 'צמ"ה',   href: '/app/equipment',   icon: HardHat },
}

export function ModuleSwitcher({ permissions }: { permissions: string[] }) {
  // Filter to top-level modules only
  const available = TOP_LEVEL_MODULES.filter(k => permissions.includes(k))

  // If only one module — no need for a switcher, show nothing or a simple label
  if (available.length <= 1) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-sidebar-text gap-2">
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">מודולים</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {available.map(key => {
          const m = MODULE_MAP[key]
          const Icon = m.icon
          return (
            <DropdownMenuItem key={key} asChild>
              <Link href={m.href} className="flex items-center gap-2 cursor-pointer">
                <Icon className="h-4 w-4" />
                {m.label}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Pattern 4: Logout Button for App Shell

**What:** Reuse the existing `LogoutButton` component from `src/components/shared/LogoutButton.tsx`. It already calls `logout()` from `src/actions/auth.ts` which signs out and redirects to `/login`. **Consideration:** For ChemoSys users, `logout()` should redirect to `/chemosys` not `/login`. Either create a new `logoutApp()` Server Action that redirects to `/chemosys`, or reuse `logout()` and accept that after sign-out the user sees the admin login page (not ideal UX).

**Recommended:** Create `logoutApp()` in `src/actions/auth.ts` that redirects to `/chemosys`. It's a 5-line addition.

### Pattern 5: /app redirect page behavior

**What:** The existing `src/app/app/page.tsx` already handles the auto-redirect logic (single module → redirect directly, both → show selection screen). Once `(app)/layout.tsx` wraps it, the layout fires `verifyAppUser()` first. The page-level `verifyAppUser()` call in `app/page.tsx` becomes redundant but harmless (React `cache()` deduplicates the RPC call). No change needed to `app/page.tsx` — but the visual shell of the page (which currently sets its own dark background) will now be wrapped inside the layout's background. The existing inline `style` and `bg-sidebar-bg` on the `<main>` tag in `app/page.tsx` should be removed to avoid double-styling.

### Anti-Patterns to Avoid

- **Don't make AppHeader a client component** — it has no interactive state. Only `ModuleSwitcher` needs `"use client"`. Unnecessary `"use client"` propagates client boundary and increases bundle size.
- **Don't call `getAppNavPermissions()` in both layout AND AppHeader** — call once in layout, pass as prop. React `cache()` would deduplicate anyway, but passing as props is cleaner and more explicit.
- **Don't hardcode user name** — must query from `users → employees` join. `verifyAppUser()` only returns `{ userId, email }` — email is for fallback only.
- **Don't use `align="end"` on DropdownMenuContent in RTL** — Radix respects the document `dir` attribute. In RTL, `align="start"` positions the dropdown on the right side (logical start), which is what we want for the header right side.
- **Don't forget `is_admin` users** — `verifyAppUser()` deliberately does NOT block is_admin users. Sharon can access both `/admin/*` and `/app/*` in the same session. The layout must not add any is_admin-specific redirect.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown trigger + portal | Custom positioned div | `DropdownMenu` (Radix, already installed) | Handles focus trap, keyboard nav, RTL positioning |
| Auth guard | Custom cookie check | `verifyAppUser()` from `dal.ts` (already built) | Already handles blocked users, no-row bootstrap, React.cache |
| Token refresh | Manual refresh logic | `proxy.ts` middleware (already built) | Runs on every request, handles Supabase cookie rotation |
| Logout form | `fetch('/api/logout')` | `logout()` / `logoutApp()` Server Actions (form action) | CSRF protection, no client JS needed |

---

## Common Pitfalls

### Pitfall 1: Route Group Collision with Existing app/ Segment

**What goes wrong:** Developer creates `src/app/(app)/app/page.tsx` thinking they need to move the module selection page into the route group. This creates the URL `/app/app` which is wrong.

**Why it happens:** Misunderstanding that route groups are transparent — `(app)` does not add to the URL path.

**How to avoid:** Keep `src/app/app/page.tsx` exactly where it is. The `(app)` route group layout at `src/app/(app)/layout.tsx` automatically wraps the `/app` route because route groups apply to sibling segments.

**Warning signs:** Two `page.tsx` files trying to serve the same `/app` URL — Next.js will error on build.

**VERIFIED:** `src/app/app/page.tsx` already exists. Do NOT create `src/app/(app)/app/page.tsx`.

### Pitfall 2: User Name Not Available for Bootstrap Admin

**What goes wrong:** Layout queries `users` table by `auth_user_id` → gets `null` (no public.users row for bootstrap admin). Trying to access `userRow.employees.first_name` throws.

**Why it happens:** Sharon (bootstrap admin, created before first public.users row) has a valid JWT but no `public.users` row.

**How to avoid:** Use `maybeSingle()` (not `single()`), then check `if (!userRow)` and fall back to `appUser.email`.

**This pattern is already established in the codebase** — `(admin)/layout.tsx` uses the same `maybeSingle()` check.

### Pitfall 3: Double Background on /app Page

**What goes wrong:** `src/app/app/page.tsx` sets `min-h-screen bg-sidebar-bg` on its `<main>` element. Once wrapped by `(app)/layout.tsx` which also sets `bg-sidebar-bg`, the page looks fine but there's redundant styling.

**Why it happens:** The module selection page was built as a standalone fullscreen page before the layout existed.

**How to avoid:** Remove `min-h-screen bg-sidebar-bg` and the inline `style` background gradient from `app/page.tsx` `<main>` when creating the layout. The layout provides the background now.

### Pitfall 4: ModuleSwitcher Showing Sub-Module Keys

**What goes wrong:** `getAppNavPermissions()` returns ALL `app_*` keys including sub-module keys like `app_fleet_vehicles`, `app_fleet_drivers`, etc. If ModuleSwitcher maps all of them, the dropdown shows 16+ entries.

**Why it happens:** Developer forgets to filter to top-level modules only.

**How to avoid:** Filter to `['app_fleet', 'app_equipment']` explicitly in `MODULE_MAP`. Keys not in `MODULE_MAP` are silently ignored.

### Pitfall 5: RTL Dropdown Direction

**What goes wrong:** Dropdown opens on the wrong side or items appear reversed in RTL.

**Why it happens:** Radix DropdownMenu reads `dir` from the nearest ancestor. The root `<html dir="rtl">` is set in `src/app/layout.tsx`.

**How to avoid:** Radix handles RTL automatically when `dir="rtl"` is set on `<html>`. No additional configuration needed. Use `align="start"` (not "end") to open from the logical-start (right in RTL) side of the trigger.

### Pitfall 6: logoutApp redirect target

**What goes wrong:** Reusing `logout()` from `auth.ts` redirects to `/login` (admin login) after sign-out instead of `/chemosys`.

**Why it happens:** Existing `logout()` was designed for admin users.

**How to avoid:** Add `logoutApp()` to `src/actions/auth.ts`:
```typescript
export async function logoutApp(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/chemosys')
}
```
Use this in `AppLogoutButton` instead of `logout()`.

---

## Code Examples

### Layout — Complete Verified Pattern

```typescript
// src/app/(app)/layout.tsx
// Source: derived from src/app/(admin)/layout.tsx (Phase 6) + dal.ts (Phase 6)
import { redirect } from 'next/navigation'
import { verifyAppUser, getAppNavPermissions } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/app/AppHeader'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const appUser = await verifyAppUser()           // throws → /chemosys if invalid
  const permissions = await getAppNavPermissions() // cached via getPermissionsRpc

  // Resolve display name: users → employees join
  const supabase = await createClient()
  const { data: userRow } = await supabase
    .from('users')
    .select('employees(first_name, last_name)')
    .eq('auth_user_id', appUser.userId)
    .is('deleted_at', null)
    .maybeSingle()

  const emp = userRow?.employees as { first_name: string; last_name: string } | null
  const displayName = emp
    ? `${emp.first_name} ${emp.last_name}`
    : appUser.email

  return (
    <div className="min-h-screen bg-sidebar-bg flex flex-col" dir="rtl">
      <AppHeader displayName={displayName} permissions={permissions} />
      <main className="flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}
```

### logoutApp Server Action

```typescript
// Addition to src/actions/auth.ts
export async function logoutApp(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/chemosys')
}
```

### Employee join type handling

The Supabase JS client types `employees(first_name, last_name)` as a nested object or array depending on the relationship. Because `users.employee_id` is a FK (one-to-one), it returns a single object, but the type might be inferred as `{} | {} []`. Safe cast pattern:

```typescript
const emp = Array.isArray(userRow?.employees)
  ? userRow.employees[0]
  : userRow?.employees
const displayName = emp?.first_name
  ? `${emp.first_name} ${emp.last_name}`
  : appUser.email
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getSession()` for auth | `getClaims()` for local JWT check | Phase 1 | No network call on every request |
| Single layout for all routes | Route group layouts `(admin)`, `(chemosys)`, `(app)` | Phase 1→8 | Each shell is isolated |
| Sidebar navigation | Top-header for (app) | Phase 6 decision | Mobile-first for field workers |

---

## What Already Exists (No Research Needed)

These items are DONE — the planner should NOT create tasks for them:

| Item | Status | File |
|------|--------|------|
| `verifyAppUser()` | BUILT | `src/lib/dal.ts` |
| `getAppNavPermissions()` | BUILT | `src/lib/dal.ts` |
| `logout()` Server Action | BUILT | `src/actions/auth.ts` |
| `DropdownMenu` shadcn component | INSTALLED | `src/components/ui/dropdown-menu.tsx` |
| CSS variables (`--color-sidebar-bg`, etc.) | DEFINED | `src/app/globals.css` |
| `logo-icon.png` | EXISTS | `public/logo-icon.png` |
| `LogoutButton` component | EXISTS | `src/components/shared/LogoutButton.tsx` |
| `/app` module selection page | EXISTS | `src/app/app/page.tsx` |
| proxy.ts `/app/*` → `/chemosys` redirect | BUILT | `src/proxy.ts` |
| Heebo font + RTL html tag | BUILT | `src/app/layout.tsx` |

---

## Open Questions

1. **ModuleSwitcher when user has only 1 module**
   - What we know: If only `app_fleet` → layout auto-redirects to `/app/fleet` at login. User is already in fleet and doesn't need a switcher.
   - What's unclear: Should ModuleSwitcher still render (grayed-out equipment option) or be hidden?
   - Recommendation: Hide the ModuleSwitcher entirely when `available.length <= 1`. The header still shows logo + username + logout. Cleaner UX for single-module users.

2. **`app/page.tsx` background styling conflict**
   - What we know: `app/page.tsx` currently renders its own fullscreen dark background.
   - What's unclear: Whether Phase 9 will need `/app` (the module selector) to still be "fullscreen centered" inside the layout or just a normal content page.
   - Recommendation: Remove the fullscreen background from `app/page.tsx` and let the layout handle the background. The centered card layout can be preserved using flexbox on the `<main>` element.

3. **Admin user display name edge case**
   - What we know: Sharon (is_admin, bootstrap) may have a `public.users` row or not.
   - What's unclear: Does Sharon have an `employees` row linked?
   - Recommendation: Always implement the email fallback (`maybeSingle()` + null check). Covers all cases.

---

## Sources

### Primary (HIGH confidence — verified in live codebase)

- `src/lib/dal.ts` — `verifyAppUser()`, `getAppNavPermissions()` implementations verified
- `src/app/(admin)/layout.tsx` — admin layout pattern verified (maybeSingle, redirect on role mismatch)
- `src/app/(chemosys)/layout.tsx` — dark background pattern verified
- `src/app/app/page.tsx` — existing module selection page verified
- `src/actions/auth.ts` — `logout()` redirect target verified as `/login`
- `src/app/globals.css` — all CSS variables verified
- `src/components/ui/dropdown-menu.tsx` — DropdownMenu primitive verified as installed
- `src/types/database.ts` — `users.employee_id` FK to `employees` table verified
- `src/app/layout.tsx` — `dir="rtl"` on `<html>` verified (Radix RTL works automatically)

### Secondary (MEDIUM confidence)

- Next.js App Router docs — route groups are URL-transparent; `(app)/layout.tsx` wraps `/app` segment without affecting URL structure. Consistent with project behavior in Phases 1–7.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in `package.json` and existing components
- Architecture: HIGH — derived from working patterns in Phases 1–7 of this exact codebase
- Pitfalls: HIGH — three pitfalls (bootstrap admin, double background, sub-module filter) verified against existing code
- Route group behavior: MEDIUM — documented Next.js behavior, consistent with what Phase 1 already uses

**Research date:** 2026-03-04
**Valid until:** Stable — Next.js App Router route group behavior has been stable since Next.js 13. No external API changes expected.
