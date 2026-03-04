# Technology Stack

**Project:** ChemoSys — Internal Management System (Chemo Aharon Ltd.)
**Researched:** 2026-03-04
**Scope:** v2.0 ChemoSys Shell — additions and changes only
**Confidence:** HIGH for versions (verified via npm registry); MEDIUM for integration patterns (verified via existing codebase analysis)

---

## Context: What This File Covers

v1.0 stack is **validated and in production**. This file documents only what v2.0 needs on top of the existing stack. Do not re-install or change: Next.js 16, React 19, TypeScript, Supabase, shadcn/ui, Tailwind v4, TanStack Table v8, react-leaflet v5, ExcelJS, Zod, React Hook Form, Heebo font, Lucide React, Sonner.

**Existing package.json installs that are already present and verified:**
- `next@^16.1.6`, `react@^19.0.0`, `typescript@^5`
- `@supabase/ssr@^0.8.0`, `@supabase/supabase-js@^2.98.0`
- `@tanstack/react-table@^8.21.3`
- `react-leaflet@^5.0.0`, `leaflet@^1.9.4`
- `exceljs@^4.4.0`
- `zod@^4.3.6`, `react-hook-form@^7.71.2`, `@hookform/resolvers@^5.2.2`
- `lucide-react@^0.575.0`, `sonner@^2.0.7`
- `next-themes@^0.4.6` (installed, not yet wired into a theme toggle)
- `@radix-ui/react-accordion`, `dialog`, `dropdown-menu`, `select`, `tabs`, `switch`, `progress`, etc.
- `date-fns@^4.1.0`, `cmdk@^1.1.1`, `react-day-picker@^9.14.0`

---

## New Dependencies for v2.0

### 1. Charts — Dashboard Widgets

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| recharts | ^3.7.0 | Fleet/equipment dashboard charts | React 19 compatible (peer deps verified: `react: ^16.8.0 || ^17 || ^18 || ^19`). MIT license. Composable with shadcn/ui Chart wrapper. Standard choice for Next.js admin dashboards in 2025/2026. Latest stable: 3.7.0 (npm verified 2026-03-04). |

**Install:**
```bash
npm install recharts
```

**shadcn/ui Chart component** (wraps recharts with Tailwind CSS variables):
```bash
npx shadcn@latest add chart
```

This installs `src/components/ui/chart.tsx` — a context provider that maps CSS custom properties (`--chart-1` through `--chart-5`) to recharts colors. Required for consistent theming with the existing Tailwind design tokens.

**RTL note:** Recharts renders SVG, which is direction-neutral. No RTL configuration needed. The `<ResponsiveContainer>` fills its parent width regardless of `dir="rtl"`. Axis labels in Hebrew render correctly because SVG `<text>` elements support Unicode. **Confidence: HIGH** — SVG is inherently direction-neutral per spec.

**recharts v3 dependencies pulled in:** `@reduxjs/toolkit`, `react-redux`, `reselect`, `immer`. These are internal to recharts — not exposed to application code. Bundle adds approximately 80–120KB gzipped when tree-shaken.

**Chart types needed for v2.0 shell:**
- `BarChart` — vehicle count per status (active/maintenance/inactive)
- `LineChart` — km driven per week trend (fleet dashboard)
- `PieChart` / `RadialBarChart` — fuel consumption by category

---

### 2. QR Code Scanning — Camp Vehicles Sub-Module

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| qr-scanner | ^1.4.2 | Camera-based QR code scanning | Lightweight: 524KB unpacked vs html5-qrcode's 2.6MB. Zero dependencies (only `@types/offscreencanvas` as dev). Uses browser's built-in BarcodeDetector API with WASM fallback. Supports mobile camera natively. Works server-side-safe (import only in client components). MIT license. Latest stable: 1.4.2 (npm verified 2026-03-04). |

**Install:**
```bash
npm install qr-scanner
```

**Why qr-scanner over html5-qrcode:**

| Criterion | qr-scanner | html5-qrcode |
|-----------|-----------|--------------|
| Unpacked size | 524 KB | 2.6 MB (5x larger) |
| Dependencies | 0 | 0 (but heavier assets) |
| BarcodeDetector API | Yes (native first) | No (zxing only) |
| React integration | Manual wrapper | Has React component |
| Maintenance | Active (Nimiq) | Active |

**Usage pattern in Next.js App Router:**
```tsx
// MUST be "use client" — accesses browser camera
"use client"

import QrScanner from 'qr-scanner'
import { useEffect, useRef } from 'react'

export function VehicleQrScanner({ onScan }: { onScan: (vehicleId: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current) return
    const scanner = new QrScanner(videoRef.current, result => onScan(result.data))
    scanner.start()
    return () => scanner.destroy()
  }, [onScan])

  return <video ref={videoRef} style={{ width: '100%' }} />
}
```

**Import it dynamically** to avoid SSR errors (accesses `navigator.mediaDevices`):
```tsx
const VehicleQrScanner = dynamic(() => import('@/components/app/fleet/VehicleQrScanner'), { ssr: false })
```

**HTTPS requirement:** Camera access requires HTTPS in production. Vercel deployment satisfies this automatically. Local dev with `localhost` also works (browsers exempt localhost from HTTPS requirement).

---

### 3. Radix UI Components — New shadcn/ui Primitives

The following Radix primitives are NOT in the existing `package.json` but are needed for ChemoSys shell UI patterns:

| Component | Why Needed |
|-----------|-----------|
| `@radix-ui/react-tooltip` (v1.2.8) | Sub-module grid icons — tooltip on hover for label |
| `@radix-ui/react-collapsible` (v1.1.12) | Mobile sidebar collapse for (app) layout |
| `@radix-ui/react-navigation-menu` (v1.2.14) | Top-level module switcher in ChemoSys header |

**Install via shadcn/ui CLI** (preferred — generates the styled wrapper):
```bash
npx shadcn@latest add tooltip collapsible navigation-menu
```

This installs both the Radix primitive and the shadcn-styled wrapper into `src/components/ui/`.

---

## No New Dependencies Required For

These capabilities are already covered by existing stack:

| Feature | Existing Solution |
|---------|------------------|
| Module-based routing | Next.js App Router route groups `(app)/fleet/`, `(app)/equipment/` — no library needed |
| Permission-driven rendering | `checkPagePermission()` + `getNavPermissions()` in `src/lib/dal.ts` — already implemented |
| Permission-driven nav filtering | `getNavPermissions()` returns `string[]` of allowed module keys — wire into (app) sidebar |
| Module selection on login | shadcn/ui `Button` grid with conditional `disabled` state — no library needed |
| Sub-module menu grid (16 items) | shadcn/ui `Card` + `Button` + Lucide icons — no library needed |
| Stat cards (dashboard) | shadcn/ui `Card` — already used in admin dashboard (`StatsCards` component) |
| RTL Hebrew layout | `dir="rtl"` on `<html>` + Tailwind `rtl:` modifiers — already configured in root layout |
| Dark mode toggle | `next-themes` already installed — wire up `ThemeProvider` and toggle button |
| Mobile responsive sidebar | Pattern already established in `MobileSidebar.tsx` — replicate for (app) layout |
| Form-based module interactions | React Hook Form + Zod + Server Actions — already in stack |

---

## Architecture Integration Points

### Route Group: `(app)`

```
src/app/
├── (admin)/     ← v1.0 — Sharon only, verifySession() guard
├── (app)/       ← v2.0 — ChemoSys users, verifySession() + checkPagePermission()
│   ├── layout.tsx          ← AppLayout: verifySession() + getNavPermissions()
│   ├── fleet/
│   │   ├── layout.tsx      ← optional: fleet module context
│   │   └── page.tsx        ← Fleet dashboard (recharts + sub-module grid)
│   └── equipment/
│       └── page.tsx        ← Equipment dashboard (placeholder)
├── (auth)/      ← shared login
└── layout.tsx   ← Root: Heebo, RTL, Toaster
```

The `(app)` route group does NOT create a URL segment — `/app/fleet` becomes `/fleet`. If URL namespace collision with admin is a concern, use nested route groups: `(app)/(fleet)/fleet/`.

### Login Page Strategy

The existing `/login` page under `(auth)` is shared. For ChemoSys v2.0:

**Option A:** Reuse `/login` — add module selection buttons BELOW the existing login form. After Supabase Auth succeeds, render module buttons filtered by `getNavPermissions()`. Redirect on button click.

**Option B:** Separate `/app/login` page — own design, own URL.

**Recommendation: Option A** — same Supabase Auth session, no duplicate auth logic. Add a conditional section after login success: "בחר מודול" with buttons. This is simpler and avoids maintaining two login pages.

### Permission Wiring for (app) Layout

Existing `getNavPermissions()` returns `string[]` of module keys. For ChemoSys:

```tsx
// src/app/(app)/layout.tsx
import { verifySession, getNavPermissions } from '@/lib/dal'

export default async function AppLayout({ children }) {
  const session = await verifySession()       // redirects to /login if unauthenticated
  const allowedModules = await getNavPermissions()  // ['fleet', 'equipment', ...]

  // Pass allowedModules to AppSidebar (server component → client nav)
  return (
    <div>
      <AppSidebar user={session} allowedModules={allowedModules} />
      <main>{children}</main>
    </div>
  )
}
```

For page-level guards (block unauthorized users from direct URL access):
```tsx
// src/app/(app)/fleet/page.tsx
const hasAccess = await checkPagePermission('fleet', 1)
if (!hasAccess) return <AccessDenied />
```

The `requirePermission()` function guards all mutation Server Actions — same pattern as admin.

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| recharts | ^3.7.0 | React 19, Next.js 16 | Peer dep explicitly lists React 19. Uses `react-redux` internally — does NOT conflict with app code (recharts wraps it internally). |
| qr-scanner | ^1.4.2 | Next.js 16 App Router | Must use `dynamic()` with `ssr: false`. No React peer dep — pure browser API wrapper. |
| @radix-ui/react-tooltip | ^1.2.8 | shadcn/ui current, React 19 | Already in Radix ecosystem pattern used by project. |
| @radix-ui/react-collapsible | ^1.1.12 | shadcn/ui current, React 19 | Same. |
| @radix-ui/react-navigation-menu | ^1.2.14 | shadcn/ui current, React 19 | Same. |

---

## What NOT to Install

| Avoid | Why | Already Have |
|-------|-----|--------------|
| Chart.js / react-chartjs-2 | Heavier setup, Canvas-based (accessibility worse), less composable with Tailwind | recharts |
| Victory / Nivo | Heavier bundles, less ecosystem momentum in 2025/2026 | recharts |
| html5-qrcode | 5x larger than qr-scanner (2.6MB vs 524KB unpacked), no BarcodeDetector API support | qr-scanner |
| jsQR | Low-level, requires manual canvas processing — more code for same result | qr-scanner |
| react-icons | Huge bundle unless tree-shaken; inconsistent with existing Lucide usage | lucide-react (already installed) |
| @tanstack/react-query | Duplicates what Server Components already do for server data; adds client complexity | Server Components + Server Actions |
| Redux / Zustand | No shared cross-module client state needed for v2.0 shell | React state + Server Components |
| i18n library (next-intl, react-i18next) | Hebrew-only for v2.0; architecture supports future i18n but don't add now | Hard-coded Hebrew strings |

---

## Installation Summary for v2.0

```bash
# New runtime dependencies
npm install recharts qr-scanner

# New shadcn/ui components (installs Radix primitives automatically)
npx shadcn@latest add chart tooltip collapsible navigation-menu
```

That is 2 npm packages + 4 shadcn components. Everything else reuses v1.0 stack.

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| recharts@3.7.0 latest stable | `npm info recharts dist-tags` (verified 2026-03-04) | HIGH |
| recharts React 19 peer dep support | `npm info recharts peerDependencies` (verified 2026-03-04) | HIGH |
| qr-scanner@1.4.2 latest stable | `npm info qr-scanner dist-tags` (verified 2026-03-04) | HIGH |
| qr-scanner 524KB vs html5-qrcode 2.6MB | `npm info [pkg] dist.unpackedSize` (verified 2026-03-04) | HIGH |
| qr-scanner uses BarcodeDetector API | qr-scanner README (training knowledge, 1.4.x) | MEDIUM |
| SVG direction-neutral (recharts RTL safe) | W3C SVG specification; SVG text Unicode support | HIGH |
| @radix-ui/react-tooltip@1.2.8 | `npm info @radix-ui/react-tooltip version` (verified 2026-03-04) | HIGH |
| @radix-ui/react-collapsible@1.1.12 | `npm info @radix-ui/react-collapsible version` (verified 2026-03-04) | HIGH |
| @radix-ui/react-navigation-menu@1.2.14 | `npm info @radix-ui/react-navigation-menu version` (verified 2026-03-04) | HIGH |
| App Router route groups create no URL segment | Next.js official docs architecture (training knowledge, verified pattern in v1.0) | HIGH |
| shadcn/ui chart component wraps recharts | shadcn/ui docs (training knowledge, pattern widely verified in community) | MEDIUM |
| qr-scanner requires HTTPS for camera | Web API spec — MediaDevices requires secure context | HIGH |

---

*Stack research for: ChemoSys v2.0 shell (fleet + equipment modules)*
*Researched: 2026-03-04*
*Scope: New additions only — v1.0 stack unchanged*
