---
phase: 09-fleet-home
plan: 02
status: complete
completed: 2026-03-05
commits:
  - "697705a feat(09-02): fleet home page + ComingSoon component + 9 sub-module pages"
  - "a297fbc fix(09-02): FleetSidebar redesign — SidebarProvider wrapping, RTL fix, Link navigation, uniform lg buttons"
---

# Summary: Plan 09-02 — Fleet Home Page + Sub-Module Pages

## One Liner

Fleet module shell complete — dashboard home page, 11 sub-module placeholder pages (9 original + driver-card + vehicle-card), modern sidebar with client-side navigation and visual checkpoint approved by Sharon.

## What Was Built

### Fleet Home Page (`/app/fleet`)
- Dashboard placeholder with LayoutDashboard icon + "דשבורד צי רכב" heading
- Clean card layout with "בקרוב..." message
- CTAs moved to sidebar (simplified home page)

### ComingSoon Component (`src/components/app/fleet/ComingSoon.tsx`)
- Reusable placeholder for all sub-module pages
- Props: `label` + `icon` (optional Lucide component)
- Pulsing icon in brand-primary, rounded-2xl card, hover scale transition
- Used by all 11 sub-module pages

### Sub-Module Pages (11 total)
- 9 original: fuel, tolls, invoices, ev-charging, charging-stations, rentals, forms, exceptions, reports
- 2 new CTAs: driver-card, vehicle-card (added post-characterization)

### FleetSidebar Redesign (post-checkpoint fixes)
- **Core bug fix**: SidebarProvider now wraps BOTH `<Sidebar>` + content area (was only wrapping sidebar — caused frozen page + broken flex layout)
- **Header offset**: `style={{ top: "3.5rem", height: "calc(100svh - 3.5rem)" }}` on Sidebar — no longer overlaps AppHeader
- **RTL**: tooltip `side="left"` for right-side sidebar
- **Navigation**: All `<a href>` replaced with Next.js `<Link>` — instant client-side navigation
- **Uniform style**: All items `size="lg"` + `font-semibold` (dashboard, 2 CTAs, 9 sub-modules)
- **defaultOpen=true**: Expanded by default (matching admin sidebar UX)
- **Toggle**: SidebarFooter toggle button (ChevronsLeft/Right) + SidebarRail edge handle
- **Content bg**: `bg-background` (white, dark-mode ready)
- **Mobile**: SidebarTrigger shown on mobile screens

## Key Decisions

- SidebarProvider MUST wrap both sidebar + content — shadcn requirement, not optional
- Sidebar uses `fixed` positioning offset from header via inline style (not Tailwind — avoids specificity conflicts with shadcn classes)
- `<Link>` instead of `<a>` for all fleet navigation — critical for performance
- driver-card + vehicle-card added as sidebar CTAs (moved from content area to sidebar per Sharon)
- Content area `bg-background` for white background (sidebar stays dark #1B3A4B)

## Files Modified/Created

- `src/app/(app)/app/fleet/page.tsx` — simplified dashboard home
- `src/components/app/fleet/ComingSoon.tsx` — reusable placeholder
- `src/components/app/fleet/FleetSidebar.tsx` — major redesign
- `src/app/(app)/app/fleet/layout.tsx` — simplified (FleetSidebar is shell)
- `src/app/(app)/layout.tsx` — main → flex flex-col
- `src/app/(app)/app/fleet/driver-card/page.tsx` — new
- `src/app/(app)/app/fleet/vehicle-card/page.tsx` — new
- 9x `src/app/(app)/app/fleet/*/page.tsx` — ComingSoon pages

## Checkpoint

Sharon visually verified and approved the fleet module via browser. Iteration cycle: frozen page fix → RTL sidebar fix → style refinements → uniform buttons → white content area.
