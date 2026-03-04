# Phase 9: Fleet Home — Research

**Researched:** 2026-03-04
**Domain:** RTL collapsible sidebar navigation + permission-filtered sub-module list (Next.js App Router)
**Confidence:** HIGH

---

## Summary

Phase 9 replaces the `/app/fleet` placeholder with a full Fleet module shell. The defining UI decision (from Sharon, session #16) is a **collapsible RTL sidebar + content area** — NOT the original grid of 16 cards. The sidebar collapses to icon-only by default, expands to icon+label on hover/click, and becomes a hamburger-overlay on mobile.

The shadcn/ui `Sidebar` component (installable via `npx shadcn@latest add sidebar`) is the correct tool for this. It supports `collapsible="icon"`, `side="right"` for RTL, built-in tooltip display when collapsed, and automatic Sheet/drawer behavior on mobile — all without additional libraries. The sidebar component is NOT yet installed in this project.

The permissions model is already implemented in `dal.ts` (`getAppNavPermissions()` returns a `string[]` of `app_*` keys). The fleet page layout must: (1) verify `app_fleet` permission server-side, (2) fetch the user's sub-module permissions, (3) pass them to the client sidebar component, and (4) render sub-modules as disabled (grayed, non-clickable) when the key is absent from the user's permission set.

**Primary recommendation:** Install shadcn `sidebar` + `tooltip` components, wrap `/app/fleet` in a new `FleetLayout` (nested layout inside `(app)/app/fleet/`), build a `FleetSidebar` client component with 9 sub-modules configured as a static array, and use `Set<string>` permission filtering to control enabled/disabled state.

---

## User Constraints (from Sharon session #16 characterization — no CONTEXT.md)

### Locked Decisions

- **Layout pattern:** Sidebar (right, RTL) + content area. NOT a grid of cards.
- **Sidebar default state:** Collapsed to icons only.
- **Sidebar expanded state:** Icons + text labels — triggered by hover OR click.
- **Mobile:** Hamburger menu → overlay drawer (Sheet).
- **Sub-modules:** 9 items (NOT 16 from original ROADMAP). Dynamic list (can change).
- **Dashboard area:** Placeholder "בקרוב" at top of content — built last.
- **2 primary action buttons (in content area, NOT sidebar):**
  - כרטיס נהג → placeholder
  - כרטיס רכב → placeholder
- **Style:** Modern 2026 — animations, icons — more modern than the admin interface.
- **Design goal:** "הכי מודרנית שיש".

### Sub-module list (sidebar, final for this phase)
1. דלק (`app_fleet_fuel`)
2. כבישי אגרה (`app_fleet_toll`)
3. חשבוניות ספקים (`app_fleet_invoices`)
4. טעינת רכב חשמלי (`app_fleet_ev_charging`)
5. מעקב עמדות טעינה פרטיות (`app_fleet_charging_stations`)
6. הזמנת רכב שכור (`app_fleet_rental`)
7. טפסים (`app_fleet_forms`)
8. טבלת חריגים (`app_fleet_exceptions`)
9. דוחות (`app_fleet_reports`)

*Sharon noted "list is not final — ready for changes" — but these 9 are locked for Phase 9.*

### Claude's Discretion

- Exact Lucide icon selection for each sub-module
- Whether sidebar hover-expand uses CSS-only group-hover or a React state toggle
- Sidebar width values (collapsed icon-only vs expanded icon+text)
- Animation easing/duration specifics
- Whether `FleetLayout` is a nested `layout.tsx` or a wrapper component inside the existing fleet page
- Disabled sub-module tooltip text (e.g., "אין גישה" badge vs tooltip)
- Exact route structure for sub-module placeholder pages

### Deferred (OUT OF SCOPE for Phase 9)

- Equipment module (צמ"ה) — built after fleet module is complete
- Actual sub-module page content (all are placeholder "בקרוב")
- Dashboard widget content (placeholder only)
- כרטיס נהג / כרטיס רכב actual functionality (placeholder only)

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui `sidebar` | latest (CLI) | Collapsible sidebar with icon mode, tooltip, mobile Sheet | Official shadcn component — avoids custom sidebar state management |
| shadcn/ui `tooltip` | latest (CLI) | Tooltip display in collapsed icon mode | Required peer of sidebar's `SidebarMenuButton tooltip` prop |
| `lucide-react` | ^0.575.0 (installed) | Sub-module icons | Already in project, standard for this codebase |
| `next/navigation` (`usePathname`) | Next.js 16 (installed) | Active state detection in sidebar nav | Standard RSC-compatible hook |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui `sheet` | installed | Mobile overlay drawer (used internally by sidebar) | Auto-used by sidebar on mobile — no separate install needed |
| `tw-animate-css` | ^1.4.0 (installed) | Animation classes for sidebar transitions | Already in project; sidebar transitions use CSS `transition-all` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn `sidebar` component | Custom CSS sidebar with useState | Sidebar is complex (cookie persistence, keyboard shortcuts, RTL, mobile Sheet) — custom builds miss edge cases |
| shadcn `tooltip` in sidebar | Manual Tailwind `group-hover:block` | tooltip prop on `SidebarMenuButton` is cleaner and accessible |
| Nested `layout.tsx` | Wrapper component in `page.tsx` | `layout.tsx` is the correct Next.js App Router pattern — keeps sidebar outside page re-renders |

**Installation (not yet installed):**
```bash
npx shadcn@latest add sidebar
npx shadcn@latest add tooltip
```
*Note: React 19 peer dep conflicts may require `--force` flag — standard for this project's shadcn installs.*

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   └── (app)/
│       └── app/
│           └── fleet/
│               ├── layout.tsx          ← NEW: FleetLayout — server component, auth + permission check
│               ├── page.tsx            ← REPLACE: Fleet home content (dashboard placeholder + 2 CTA buttons)
│               └── [sub-module]/
│                   └── page.tsx        ← NEW: placeholder "בקרוב" page (one for each sub-module)
└── components/
    └── app/
        └── fleet/
            ├── FleetSidebar.tsx        ← NEW: client component — sidebar with 9 sub-modules
            ├── FleetSidebarNav.tsx     ← NEW: client component — nav items with permission filter
            └── FleetContent.tsx        ← optional: wrapper for right-side content area
```

### Pattern 1: Nested Layout for Fleet Shell

**What:** `src/app/(app)/app/fleet/layout.tsx` wraps all fleet pages in a sidebar layout. The parent `(app)/layout.tsx` provides AppHeader; this nested layout adds the fleet-specific sidebar + content structure.

**When to use:** When a module needs its own persistent navigation (sidebar) that should appear on ALL sub-pages of that module.

**Example:**
```typescript
// src/app/(app)/app/fleet/layout.tsx
// Server component — no "use client"
import { verifyAppUser, getAppNavPermissions } from "@/lib/dal";
import { redirect } from "next/navigation";
import { FleetSidebar } from "@/components/app/fleet/FleetSidebar";

export default async function FleetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await verifyAppUser(); // redirects to /chemosys if not valid

  const permissions = await getAppNavPermissions();

  // Guard: user must have app_fleet permission
  if (!permissions.includes("app_fleet")) {
    redirect("/app"); // back to module selector
  }

  // Extract fleet sub-module keys — pass as Set for O(1) lookup in client
  const fleetPerms = new Set(
    permissions.filter((k) => k.startsWith("app_fleet_"))
  );

  return (
    // Full-height flex row — sidebar on right (RTL start), content on left (RTL end)
    <div className="flex flex-1 min-h-0">
      <FleetSidebar permissions={fleetPerms} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
```

### Pattern 2: shadcn Sidebar with collapsible="icon" + RTL

**What:** shadcn's `Sidebar` component with `side="right"` (RTL start) and `collapsible="icon"`. Collapses to `--sidebar-width-icon` (48px), expands to `--sidebar-width` (240px). `SidebarMenuButton` with `tooltip` prop shows label when collapsed.

**When to use:** Any sidebar that must collapse to icon-only and show tooltips when collapsed.

**Example:**
```typescript
// src/components/app/fleet/FleetSidebar.tsx
"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { Fuel, /* ... other icons */ } from "lucide-react";
import { cn } from "@/lib/utils";

// Sub-module config — static, driven by Sharon's list
const FLEET_SUB_MODULES = [
  { key: "app_fleet_fuel",              label: "דלק",                          href: "/app/fleet/fuel",              icon: Fuel },
  { key: "app_fleet_toll",              label: "כבישי אגרה",                    href: "/app/fleet/toll",              icon: /* ... */ },
  { key: "app_fleet_invoices",          label: "חשבוניות ספקים",                href: "/app/fleet/invoices",          icon: /* ... */ },
  { key: "app_fleet_ev_charging",       label: "טעינת רכב חשמלי",               href: "/app/fleet/ev-charging",       icon: /* ... */ },
  { key: "app_fleet_charging_stations", label: "מעקב עמדות טעינה פרטיות",       href: "/app/fleet/charging-stations", icon: /* ... */ },
  { key: "app_fleet_rental",            label: "הזמנת רכב שכור",                href: "/app/fleet/rental",            icon: /* ... */ },
  { key: "app_fleet_forms",             label: "טפסים",                         href: "/app/fleet/forms",             icon: /* ... */ },
  { key: "app_fleet_exceptions",        label: "טבלת חריגים",                   href: "/app/fleet/exceptions",        icon: /* ... */ },
  { key: "app_fleet_reports",           label: "דוחות",                         href: "/app/fleet/reports",           icon: /* ... */ },
] as const;

type FleetSidebarProps = {
  permissions: Set<string>; // app_fleet_* keys the user has
};

export function FleetSidebar({ permissions }: FleetSidebarProps) {
  const pathname = usePathname();

  return (
    <SidebarProvider defaultOpen={false}>
      {/* side="right" = RTL logical start */}
      <Sidebar side="right" collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>צי רכב</SidebarGroupLabel>
            <SidebarMenu>
              {FLEET_SUB_MODULES.map((item) => {
                const isEnabled = permissions.has(item.key);
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild={isEnabled}
                      tooltip={item.label}
                      isActive={isActive}
                      className={cn(!isEnabled && "opacity-40 cursor-not-allowed pointer-events-none")}
                    >
                      {isEnabled ? (
                        <a href={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </a>
                      ) : (
                        <span>
                          <Icon />
                          <span>{item.label}</span>
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
```

### Pattern 3: Permission Filtering via Server→Client Boundary

**What:** Server component fetches `getAppNavPermissions()`, converts to `Set<string>`, passes to client sidebar as serializable prop. Client uses `Set.has()` for O(1) permission check per item.

**When to use:** Any time server-fetched permission list must filter client-rendered navigation items.

**Key insight:** Pass `Set<string>` as the prop type but note that Sets are NOT JSON-serializable. The server must pass an `Array<string>` (serializable) and the client converts to `Set<string>`:

```typescript
// Server (FleetLayout): passes string[]
const fleetPermArray = permissions.filter((k) => k.startsWith("app_fleet_"));
<FleetSidebar permissions={fleetPermArray} />

// Client (FleetSidebar): receives string[], converts to Set
const permSet = new Set(props.permissions);
const isEnabled = permSet.has(item.key); // O(1)
```

### Pattern 4: Sub-module Placeholder Pages

**What:** Each of the 9 sub-modules needs a route (`/app/fleet/fuel`, etc.) with a "בקרוב" placeholder. Single reusable component avoids duplication.

**Example:**
```typescript
// src/app/(app)/app/fleet/fuel/page.tsx
import { ComingSoon } from "@/components/app/fleet/ComingSoon";
export default function FleetFuelPage() {
  return <ComingSoon label="דלק" />;
}
```

### Anti-Patterns to Avoid

- **Putting FleetSidebar inside `(app)/layout.tsx`:** The fleet sidebar is fleet-module-specific. The parent layout wraps ALL modules — sidebar must live in the fleet nested layout only.
- **Passing `Set<string>` across server→client boundary:** Sets are not JSON-serializable — Next.js will throw. Always pass `string[]`, convert to `Set` on client side.
- **Using `redirect()` inside a Client Component:** Permission guards (redirect if no `app_fleet`) must happen in the Server Component layout, not in the client sidebar.
- **Duplicating `verifyAppUser()` in FleetLayout:** `verifyAppUser` is cached with `React.cache()` — calling it again in FleetLayout is safe (zero extra DB queries) and recommended for defense-in-depth.
- **`defaultOpen={true}` for fleet sidebar:** Sharon specified collapsed to icons by default. Use `defaultOpen={false}`.
- **shadcn sidebar inside another `SidebarProvider`:** If `(app)/layout.tsx` ever gains a SidebarProvider, nesting providers causes state conflicts. Keep SidebarProvider in FleetLayout scope only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar collapse state + persistence | Custom useState + localStorage | `SidebarProvider` (shadcn sidebar) | Built-in cookie persistence (`sidebar:state`), keyboard shortcut `Cmd+B`, mobile detection |
| Mobile hamburger overlay | Custom Sheet + state | shadcn `Sidebar` (auto-converts to Sheet on mobile) | Sidebar handles breakpoint detection internally with `isMobile` |
| Icon tooltips when collapsed | Custom CSS `group-hover:block` tooltip | `SidebarMenuButton tooltip` prop | Accessible, respects sidebar collapsed state, hides on mobile automatically |
| Permission Set conversion | Recursive object filtering | `new Set(permissions.filter(...))` | Simple, O(1) lookup per item |

**Key insight:** The shadcn `Sidebar` component handles the hardest parts: RTL positioning, mobile Sheet behavior, collapse state with cookie persistence, keyboard accessibility, and tooltip display. Building a custom sidebar for this phase would take 3-4x longer and miss accessible/RTL edge cases.

---

## Common Pitfalls

### Pitfall 1: shadcn Sidebar Not Installed

**What goes wrong:** Import errors from `@/components/ui/sidebar` — component does not exist yet.
**Why it happens:** The sidebar component is NOT in the current component set (verified by `ls src/components/ui/`). It requires explicit `npx shadcn@latest add sidebar` + `npx shadcn@latest add tooltip`.
**How to avoid:** Install both components FIRST before writing any fleet sidebar code.
**Warning signs:** `Module not found: Can't resolve '@/components/ui/sidebar'`

### Pitfall 2: Set<string> Serialization Error

**What goes wrong:** Next.js throws `Error: Only plain objects, and a few built-ins, can be passed to Client Components from Server Components. Classes or null prototypes are not supported.`
**Why it happens:** `Set` is a non-plain object. Server components pass data as JSON to client components.
**How to avoid:** Always pass `string[]` from server, convert to `Set<string>` inside the client component.
**Warning signs:** The error message will specifically mention the prop name.

### Pitfall 3: RTL Sidebar Appearing on Wrong Side

**What goes wrong:** Fleet sidebar appears on the LEFT instead of the RIGHT (breaks RTL layout).
**Why it happens:** Default `side` prop for shadcn Sidebar is `"left"`.
**How to avoid:** Always set `side="right"` on the Sidebar component. In RTL (`dir="rtl"`), the right side IS the logical start (the sidebar belongs there).
**Warning signs:** Sidebar covers the content area instead of being adjacent to it.

### Pitfall 4: Double AppHeader or Missing Header

**What goes wrong:** Fleet page shows two headers, or no header at all.
**Why it happens:** `(app)/layout.tsx` already provides `AppHeader`. If `FleetLayout` wraps content in another header or doesn't properly pass through children, header duplication/loss occurs.
**How to avoid:** `FleetLayout` must NOT render its own `AppHeader`. It only adds the sidebar+content flex wrapper. The parent `(app)/layout.tsx` layout tree provides the header.
**Warning signs:** Two sticky bars visible at top, or `/app/fleet` missing the CHEMO SYSTEM header.

### Pitfall 5: `defaultOpen={true}` vs `defaultOpen={false}`

**What goes wrong:** Sidebar opens expanded by default — violates Sharon's characterization (collapsed to icons by default).
**Why it happens:** shadcn `SidebarProvider` defaults to `defaultOpen={true}`.
**How to avoid:** Explicitly set `<SidebarProvider defaultOpen={false}>` in FleetLayout.
**Warning signs:** Sidebar shows full labels on initial page load.

### Pitfall 6: SidebarProvider Scope Conflict

**What goes wrong:** If `SidebarProvider` is placed in `(app)/layout.tsx` AND in `FleetLayout`, sidebar state is managed in two separate providers — collapse toggle breaks.
**Why it happens:** SidebarProvider uses React context; two providers mean two independent state trees.
**How to avoid:** `SidebarProvider` must wrap the entire fleet section. Place it in `FleetLayout` only. Do NOT add it to `(app)/layout.tsx`.
**Warning signs:** Sidebar toggle button doesn't visually collapse the sidebar.

### Pitfall 7: Disabled Items Still Keyboard-Navigable

**What goes wrong:** Users can Tab to disabled sub-module items and activate them with Enter.
**Why it happens:** Disabled styling is visual-only without `aria-disabled` and preventing keyboard interaction.
**How to avoid:** Add `aria-disabled="true"` and `tabIndex={-1}` to disabled items, and wrap disabled items in `<span>` not `<a>` or `<button>`.
**Warning signs:** Keyboard users can navigate to and "click" grayed-out items.

---

## Code Examples

Verified patterns from project codebase + official shadcn docs:

### Permission Guard in Nested Layout
```typescript
// Source: dal.ts pattern (project codebase) + Next.js nested layout
export default async function FleetLayout({ children }: { children: React.ReactNode }) {
  const appUser = await verifyAppUser(); // cached — no extra DB call
  const permissions = await getAppNavPermissions();

  if (!permissions.includes("app_fleet")) {
    redirect("/app");
  }

  const fleetPermissions = permissions.filter((k) => k.startsWith("app_fleet_"));

  return (
    <div className="flex flex-1 min-h-0">
      <FleetSidebar permissions={fleetPermissions} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

### shadcn Sidebar with icon collapse + tooltip
```typescript
// Source: https://ui.shadcn.com/docs/components/radix/sidebar (verified)
<SidebarProvider defaultOpen={false}>
  <Sidebar side="right" collapsible="icon">
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="דלק" isActive={isActive}>
              <Fuel />
              <span>דלק</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</SidebarProvider>
```

### Active State Detection (client side)
```typescript
// Source: SidebarNav.tsx pattern (project codebase)
import { usePathname } from "next/navigation";

const pathname = usePathname();
const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
```

### Disabled Item (accessible)
```typescript
// Grayed, non-clickable, keyboard-inaccessible sub-module
<SidebarMenuButton
  className="opacity-40 cursor-not-allowed"
  aria-disabled="true"
  tabIndex={-1}
  tooltip={`${item.label} — אין גישה`}
>
  <span aria-hidden="true"><Icon /></span>
  <span>{item.label}</span>
</SidebarMenuButton>
```

### ComingSoon Placeholder Component
```typescript
// Reusable for all 9 sub-module placeholder pages
export function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-64">
      <div className="text-center space-y-3">
        <h2 className="text-xl font-bold text-foreground">{label}</h2>
        <p className="text-muted-foreground text-sm">בקרוב...</p>
      </div>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom sidebar with useState + CSS transitions | shadcn `Sidebar` component with built-in collapse, cookie persistence, mobile Sheet | shadcn 2024 sidebar release | Eliminates ~200 LOC of custom sidebar logic |
| `side="left"` + RTL manual mirroring | `side="right"` native support | shadcn sidebar v1 | Correct RTL behavior without transform hacks |
| Separate mobile Sheet component | Auto-conversion in shadcn Sidebar on mobile | Built-in | No need for separate MobileSidebar component (unlike the admin pattern in Phase 1-5) |

**Deprecated/outdated:**
- Custom `MobileSidebar.tsx` pattern (used in admin shell): Phase 9 should NOT replicate this — shadcn Sidebar handles mobile natively.
- `group-data-[collapsible=icon]:hidden` manual class: This works but shadcn sidebar handles it automatically for content inside `SidebarMenuButton`.

---

## Open Questions

1. **Hover-expand vs click-toggle for sidebar**
   - What we know: Sharon said "מתכווץ לאייקונים בברירת מחדל, נפתח לאייקונים+טקסט בריחוף/לחיצה"
   - What's unclear: shadcn's built-in `collapsible="icon"` is click-toggle (toggle on `SidebarTrigger` click). CSS hover-only expand requires custom CSS using `group-hover` on the SidebarProvider.
   - Recommendation: Implement both — CSS hover for smooth UX + SidebarTrigger for click-toggle. Use `group/sidebar-wrapper` + `hover:[--sidebar-width:240px]` CSS approach. Document in PLAN.md.

2. **Route structure for sub-module placeholder pages**
   - What we know: Sub-modules need routes like `/app/fleet/fuel`, `/app/fleet/toll`, etc.
   - What's unclear: Whether to create 9 separate `page.tsx` files or use a dynamic `[submodule]/page.tsx` with a lookup table.
   - Recommendation: 9 separate pages — they are known, fixed, and will eventually have real content. Dynamic routing would make individual page customization harder later.

3. **`app_fleet_*` key mapping in DB**
   - What we know: Migration 00016 added 18 `app_*` keys. The exact sub-module keys (e.g., `app_fleet_ev_charging` vs `app_fleet_electric`) are not confirmed against the DB seed.
   - What's unclear: Exact key names in the `modules` table for each of the 9 sub-modules.
   - Recommendation: Before writing FLEET_SUB_MODULES array, query Supabase to confirm exact `module_key` values: `SELECT key FROM modules WHERE key LIKE 'app_fleet_%' ORDER BY key;`

4. **FleetLayout position relative to (app)/layout.tsx**
   - What we know: `(app)/layout.tsx` renders `<main className="flex-1 p-4 md:p-6">{children}</main>`.
   - What's unclear: The `p-4 md:p-6` padding on the parent `<main>` will wrap FleetLayout's flex row — the sidebar will have undesired padding around it.
   - Recommendation: FleetLayout's outer `<div className="flex flex-1 min-h-0">` must be `-m-4 md:-m-6` to escape parent padding, OR `(app)/layout.tsx` needs its `<main>` padding removed for fleet pages (harder). Planner should decide. Best approach: Use a `data-fleet` attribute or separate layout strategy.

---

## Sources

### Primary (HIGH confidence)
- shadcn/ui official docs — `https://ui.shadcn.com/docs/components/radix/sidebar` — SidebarProvider, collapsible modes, tooltip, side prop
- Project codebase — `src/lib/dal.ts` — `verifyAppUser()`, `getAppNavPermissions()`, cached RPC pattern
- Project codebase — `src/app/(admin)/layout.tsx` — nested layout + sidebar pattern reference
- Project codebase — `src/components/shared/SidebarNav.tsx` — `usePathname()` active state pattern
- Project codebase — `src/app/globals.css` — brand color tokens (`--color-sidebar-bg`, `--color-sidebar-hover`, `--color-sidebar-active`, `--color-brand-primary`)
- Project codebase — `src/components/ui/` listing — confirmed `sidebar` and `tooltip` are NOT installed

### Secondary (MEDIUM confidence)
- Achromatic blog — `https://www.achromatic.dev/blog/shadcn-sidebar` — SidebarProvider cookie persistence, `--sidebar-width-icon` CSS variable, `isMobile` hook behavior — verified against official docs structure
- WebSearch results — shadcn sidebar `collapsible="icon"` with `group-data-[collapsible=icon]:hidden` — consistent across multiple sources

### Tertiary (LOW confidence)
- WebSearch — hover-expand CSS pattern with `group-hover:[--sidebar-width]` — not verified against official docs. Flag for planner to test.

---

## Metadata

**Confidence breakdown:**
- Standard stack (shadcn sidebar install + tooltip): HIGH — official docs confirmed, component list verified against project
- Architecture (nested layout pattern): HIGH — matches existing admin layout pattern in project, standard Next.js App Router
- Permission filter (server→client string[] → Set): HIGH — pattern used in ModuleSwitcher.tsx already
- Sidebar collapsible icon + RTL: HIGH — official docs, achromatic verification
- Hover-expand CSS approach: LOW — not verified against official docs
- Exact DB module key names: LOW — needs DB query to confirm

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (shadcn sidebar API is stable; Next.js 16 App Router is stable)
