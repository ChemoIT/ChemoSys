---
phase: 01-foundation
plan: "01"
subsystem: ui
tags: [nextjs, tailwind, shadcn, supabase, rtl, hebrew, heebo]

# Dependency graph
requires: []
provides:
  - "Next.js 16.1.6 project scaffold with TypeScript, Tailwind v4, ESLint"
  - "RTL Hebrew root layout with Heebo font (subsets: hebrew + latin)"
  - "Brand theme: turquoise #4ECDC4, dark #1B3A4B, sidebar vars in @theme"
  - "Supabase server client factory with await cookies() (Next.js 16)"
  - "Supabase browser client singleton for Client Components"
  - "proxy.ts auth guard protecting /admin/* routes, redirecting /login if authed"
  - "14 shadcn/ui components (button, input, label, table, tabs, dialog, dropdown-menu, select, badge, card, skeleton, separator, form, sheet, sonner)"
  - "Logo files: public/logo-he.png (login), public/logo-icon.png (sidebar)"
affects:
  - "01-02 (DB schema uses Supabase client factories)"
  - "01-03 (admin layout extends root layout with RTL + brand theme)"
  - "01-04 (login page uses root layout + Supabase auth)"
  - "All subsequent plans use the component library and theme tokens"

# Tech tracking
tech-stack:
  added:
    - "next@16.1.6"
    - "react@19.0.0"
    - "@supabase/ssr@0.8.0"
    - "@supabase/supabase-js@2.x"
    - "tailwindcss@4.x + @tailwindcss/postcss"
    - "tw-animate-css (shadcn/ui v4 animation library)"
    - "shadcn/ui (14 components, Tailwind v4 compatible)"
    - "zod@4.x"
    - "react-hook-form@7.x"
    - "@hookform/resolvers"
    - "@tanstack/react-table@8.x"
    - "lucide-react"
    - "clsx + tailwind-merge"
    - "sonner (toast replacement)"
  patterns:
    - "RTL-first: dir=rtl on html from Day 1, logical Tailwind utilities only (ps-, pe-, ms-, me-)"
    - "next/font/google Heebo with hebrew+latin subsets (zero CLS)"
    - "Tailwind v4 @theme inline block for brand token definition"
    - "Supabase SSR pattern: getAll/setAll cookies with await cookies() in server.ts"
    - "proxy.ts at project root (not middleware.ts) — Next.js 16 convention"
    - "getUser() in proxy for token refresh, NOT getClaims()"
    - "Browser client as singleton to avoid duplicate Supabase instances"

key-files:
  created:
    - "src/app/layout.tsx — Root layout: lang=he, dir=rtl, Heebo font, metadata in Hebrew"
    - "src/app/globals.css — Tailwind v4 @theme with full brand palette + shadcn/ui CSS vars"
    - "src/app/page.tsx — Server redirect to /login"
    - "src/lib/supabase/server.ts — Async createClient() factory using await cookies()"
    - "src/lib/supabase/browser.ts — Singleton createBrowserClient() for client components"
    - "proxy.ts — Auth guard at project root, protects /admin/*, redirects from /login if authed"
    - "src/lib/utils.ts — cn() utility (clsx + tailwind-merge)"
    - "src/components/ui/* — 15 shadcn/ui components"
    - "public/logo-he.png — Full Hebrew Chemo Aharon logo (login page)"
    - "public/logo-icon.png — CA icon (sidebar)"
    - ".env.local.example — Supabase env var template"
    - "components.json — shadcn/ui configuration"
    - "next.config.ts — Next.js configuration"
    - "postcss.config.mjs — Tailwind v4 PostCSS plugin"
    - "tsconfig.json — TypeScript configuration"
  modified: []

key-decisions:
  - "Used manual scaffold instead of create-next-app — directory name ChemoSystem has capital letters which block create-next-app's npm naming validation"
  - "toast component deprecated, replaced with sonner (shadcn/ui latest recommendation)"
  - "tsx updated jsx from preserve to react-jsx by Next.js during build (auto-fix)"
  - "Browser client implemented as singleton to prevent multiple Supabase connections"

patterns-established:
  - "RTL-first: All Tailwind utilities must use logical properties (ps-, pe-, ms-, me-, start-, end-)"
  - "Server Supabase client always async — await cookies() is mandatory in Next.js 16"
  - "proxy.ts (not middleware.ts) — Next.js 16 naming convention"

# Metrics
duration: 6min
completed: "2026-03-01"
---

# Phase 1 Plan 01: Foundation Scaffold Summary

**Next.js 16.1.6 RTL Hebrew scaffold with Heebo font, Chemo Aharon brand theme in Tailwind v4, Supabase SSR client factories, and proxy.ts auth guard**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-01T15:51:04Z
- **Completed:** 2026-03-01T15:56:58Z
- **Tasks:** 2
- **Files modified:** 34

## Accomplishments

- Next.js 16.1.6 project scaffolded with all Phase 1 dependencies (React 19, TypeScript 5, Tailwind v4, shadcn/ui)
- Root layout configured with `dir="rtl"` and `lang="he"` from Day 1; Heebo loaded with hebrew+latin subsets (zero CLS)
- Brand theme defined in Tailwind v4 `@theme` block: primary #4ECDC4, dark #1B3A4B, sidebar vars, success/warning/danger tokens
- Supabase server/browser client factories using `@supabase/ssr` 0.8.0 with `await cookies()` (Next.js 16 mandatory)
- `proxy.ts` at project root guards `/admin/*` routes and redirects authenticated users away from `/login`
- 15 shadcn/ui components installed and ready (button, input, label, table, tabs, dialog, dropdown-menu, select, badge, card, skeleton, separator, form, sheet, sonner)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js project with all dependencies** - `9d18cf0` (feat)
2. **Task 2: Configure RTL root layout, brand theme, and Supabase clients** - `cba03d7` (feat)

**Plan metadata:** _(to be committed)_

## Files Created/Modified

- `src/app/layout.tsx` — Root layout with `dir="rtl"`, `lang="he"`, Heebo font, Hebrew metadata
- `src/app/globals.css` — Tailwind v4 `@theme` block with brand colors + shadcn/ui CSS variables
- `src/app/page.tsx` — Server component that redirects to `/login`
- `src/lib/supabase/server.ts` — `async createClient()` with `await cookies()` for Server Components/Actions
- `src/lib/supabase/browser.ts` — Singleton `createClient()` using `createBrowserClient` for Client Components
- `proxy.ts` — Auth guard at project root: protects `/admin/*`, redirects `/login` if already authed
- `src/lib/utils.ts` — `cn()` utility combining clsx + tailwind-merge
- `src/components/ui/` — 15 shadcn/ui components (Tailwind v4 compatible)
- `public/logo-he.png` — Full Hebrew logo (Heb-ChemoIT.png copy)
- `public/logo-icon.png` — CA icon (CA.png copy)
- `.env.local.example` — Supabase env var template
- `package.json` — Full dependency manifest with all Phase 1 packages

## Decisions Made

- **Manual scaffold over create-next-app:** The project directory is named `ChemoSystem` (capital letters). `create-next-app` validates the directory name against npm naming rules and rejects names with capitals. Manual scaffolding produces identical output.
- **sonner instead of toast:** `npx shadcn@latest add toast` returned a deprecation notice recommending sonner. Added sonner instead — same toasting API, better maintained.
- **Browser client as singleton:** Prevents multiple Supabase WebSocket connections in React re-renders.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced create-next-app with manual scaffold**
- **Found during:** Task 1 (scaffold step)
- **Issue:** `create-next-app` rejects directory name `ChemoSystem` due to npm naming rules (no capital letters). Exited with code 1.
- **Fix:** Scaffolded the project manually: created `package.json` with `"name": "chemosys"`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `.gitignore`, then ran `npm install` followed by individual `npx shadcn@latest add` commands for each component.
- **Files modified:** All project config files
- **Verification:** `npx tsc --noEmit` passes, `npm run build` succeeds with zero errors
- **Committed in:** 9d18cf0 (Task 1 commit)

**2. [Rule 1 - Bug] Replaced deprecated toast with sonner**
- **Found during:** Task 1 (shadcn/ui components installation)
- **Issue:** `npx shadcn@latest add toast` returned: "The toast component is deprecated. Use the sonner component instead." Installing deprecated components would cause future compatibility issues.
- **Fix:** Added `sonner` instead of `toast`. Sonner is the current recommended toast library in shadcn/ui.
- **Files modified:** `src/components/ui/sonner.tsx`, `package.json` (sonner@2.0.7 added)
- **Verification:** Component file created successfully, TypeScript compiles cleanly
- **Committed in:** 9d18cf0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary — manual scaffold produces identical result to create-next-app, sonner is a direct replacement for toast.

## Issues Encountered

None — all deviations were handled automatically per deviation rules.

## User Setup Required

**External services require manual configuration.** See [01-USER-SETUP.md](./01-USER-SETUP.md) for:
- Supabase project creation
- Environment variables to add to `.env.local`
- Dashboard configuration steps
- Verification commands

## Next Phase Readiness

- Next.js 16 scaffold complete — `npm run build` compiles with zero errors
- RTL foundation established — `dir="rtl"` set from Day 1 (cannot be retrofitted cheaply)
- Supabase client factories ready — Plan 01-02 DB schema migration can use them immediately
- All Phase 1 UI components installed — Plans 01-03 and 01-04 can import from `@/components/ui`
- Blocker: `.env.local` must be filled with real Supabase credentials before auth flows work

---
## Self-Check: PASSED

- [x] `src/app/layout.tsx` — EXISTS, contains `dir="rtl"` and `lang="he"`
- [x] `src/app/globals.css` — EXISTS, contains `@theme` with brand tokens
- [x] `src/lib/supabase/server.ts` — EXISTS, contains `await cookies()`
- [x] `src/lib/supabase/browser.ts` — EXISTS, contains `createBrowserClient`
- [x] `proxy.ts` — EXISTS at project root, contains `export async function proxy`
- [x] `public/logo-he.png` — EXISTS
- [x] `public/logo-icon.png` — EXISTS
- [x] `.env.local.example` — EXISTS with correct variable names
- [x] Commits exist: `9d18cf0` (feat: scaffold), `cba03d7` (feat: RTL + Supabase)
- [x] `npm run build` — PASSED with zero errors

---
*Phase: 01-foundation*
*Completed: 2026-03-01*
