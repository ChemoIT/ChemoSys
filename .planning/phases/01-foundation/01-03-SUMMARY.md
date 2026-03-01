---
phase: 01-foundation
plan: "03"
subsystem: auth
tags: [nextjs, supabase, authentication, rtl, sidebar, responsive, shadcn, server-actions]

# Dependency graph
requires:
  - phase: "01-01"
    provides: "Next.js 16 scaffold, shadcn/ui components (Button, Input, Label, Sheet), brand theme tokens, Supabase server client factory, logo files"
  - phase: "01-02"
    provides: "audit_log table schema, RLS policies enabling audit inserts"
provides:
  - "src/app/(auth)/layout.tsx — centered public layout for login and future auth pages"
  - "src/app/(auth)/login/page.tsx — login form with Hebrew logo, email/password, useActionState"
  - "src/actions/auth.ts — login() and logout() Server Actions (signInWithPassword, signOut)"
  - "src/lib/dal.ts — verifySession() using getClaims(), React cache(), redirects to /login"
  - "src/lib/audit.ts — writeAuditLog() fire-and-forget utility for INSERT/UPDATE/DELETE audit trail"
  - "src/app/(admin)/layout.tsx — protected admin shell, verifySession() guard, RTL sidebar layout"
  - "src/components/shared/Sidebar.tsx — server component, brand header, SidebarNav, user footer"
  - "src/components/shared/SidebarNav.tsx — client component, usePathname() active link detection, 9 nav items"
  - "src/components/shared/MobileSidebar.tsx — Sheet drawer from right (RTL), closes on nav click"
  - "src/components/shared/LogoutButton.tsx — client component wrapping logout Server Action"
  - "src/app/(admin)/admin/companies/page.tsx — placeholder confirming auth + layout end-to-end"
affects:
  - "01-04 (CRUD pages live inside admin layout, use writeAuditLog, verifySession)"
  - "All future admin pages (every admin page calls verifySession at top)"
  - "All future mutations (every Server Action calls writeAuditLog after commit)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useActionState (React 19) for Server Action form binding — replaces experimental useFormState"
    - "getClaims() in DAL for fast local JWT verification (no network call, not getUser)"
    - "React cache() wrapping verifySession — deduplicates across nested layouts in one request"
    - "Server component Sidebar + client SidebarNav — keeps layout server-rendered while using usePathname()"
    - "LogoutButton as separate client component — avoids making Sidebar a client component"
    - "writeAuditLog wraps in try/catch — audit failure never blocks main mutation"
    - "RTL sidebar: fixed start-0 (= right in RTL), content ps-64 (= right padding in RTL)"

key-files:
  created:
    - "src/app/(auth)/layout.tsx — min-h-screen centered auth layout, no sidebar"
    - "src/app/(auth)/login/page.tsx — Hebrew logo, useActionState, error display, Hebrew labels"
    - "src/actions/auth.ts — login/logout Server Actions with Supabase auth"
    - "src/lib/dal.ts — verifySession() with getClaims() + React cache()"
    - "src/lib/audit.ts — writeAuditLog() with try/catch, never throws"
    - "src/app/(admin)/layout.tsx — admin shell with sidebar guard and RTL layout"
    - "src/components/shared/Sidebar.tsx — server sidebar with brand header and footer"
    - "src/components/shared/SidebarNav.tsx — client nav with active link highlighting"
    - "src/components/shared/MobileSidebar.tsx — Sheet-based mobile drawer"
    - "src/components/shared/LogoutButton.tsx — form-based logout trigger"
    - "src/app/(admin)/admin/companies/page.tsx — placeholder page"
  modified: []

key-decisions:
  - "getClaims() in verifySession — fast local JWT parse, no network, O(1) — never getUser() for auth checks"
  - "React cache() wraps verifySession — layout + nested pages call it once per request, not multiple times"
  - "SidebarNav as client component inside server Sidebar — only the nav needs usePathname(), rest stays SSR"
  - "LogoutButton as separate client component — prevents Sidebar becoming client component just for one button"
  - "RTL sidebar positioning: fixed start-0 (right in RTL), content offset ps-64 — no physical CSS used"
  - "writeAuditLog never throws — audit failure must not block business operation (try/catch + console.warn)"

patterns-established:
  - "Every admin Server Component calls await verifySession() as first line"
  - "Every mutation Server Action calls writeAuditLog() after successful DB commit"
  - "Server Actions return { error: string } for user-facing errors, never throw to client"
  - "Logical Tailwind only: ps-, pe-, start-, end- — zero physical left/right/ml/mr/pl/pr"

# Metrics
duration: "~3 min"
completed: "2026-03-01"
---

# Phase 1 Plan 03: Auth and Admin Shell Summary

**Supabase Auth login with Hebrew logo and useActionState, protected admin shell with dark RTL sidebar (getClaims() DAL, React cache), responsive Sheet drawer, and fire-and-forget writeAuditLog utility**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-01T16:00:51Z
- **Completed:** 2026-03-01T16:03:41Z
- **Tasks:** 2
- **Files modified:** 11 created, 0 modified

## Accomplishments

- Login page with Chemo Aharon Hebrew logo (`/logo-he.png`), RTL form, `useActionState` (React 19)
- `login()` Server Action: `signInWithPassword` → redirect to `/admin/companies`; `logout()`: `signOut` → `/login`
- `verifySession()` in DAL: `getClaims()` for local JWT verification (no network), wrapped in React `cache()` for deduplication
- `writeAuditLog()` utility: fire-and-forget INSERT to `audit_log` table, try/catch never blocks mutations
- Admin layout with `verifySession()` guard, fixed sidebar at `start-0` (RTL right side), `ps-64` content offset
- Sidebar: server component + `SidebarNav` client component for `usePathname()` active link detection
- 9 navigation items matching module seed data; Phase 2+ items grayed out with `activePhase` guard
- Mobile: `Sheet` drawer opens from right (`side="right"` = RTL correct), closes on link click
- All 12 files compile cleanly — `npm run build` passes, `/admin/companies` renders as Dynamic (SSR)

## Task Commits

Each task was committed atomically:

1. **Task 1: Login page, auth actions, DAL, and audit log utility** - `6dc5df2` (feat)
2. **Task 2: Admin shell layout with responsive dark sidebar** - `25c5dec` (feat)

**Plan metadata:** _(to be committed)_

## Files Created/Modified

- `src/app/(auth)/layout.tsx` — Centered public layout (`min-h-screen flex items-center justify-center bg-brand-bg`)
- `src/app/(auth)/login/page.tsx` — Hebrew logo, email/password form, `useActionState(login, null)`, error display
- `src/actions/auth.ts` — `login()` and `logout()` Server Actions with `'use server'` directive
- `src/lib/dal.ts` — `verifySession()` using `getClaims()` + `react.cache()`, exports `SessionUser` type
- `src/lib/audit.ts` — `writeAuditLog()` with `AuditAction` type, try/catch, never throws
- `src/app/(admin)/layout.tsx` — `verifySession()` at top, `aside hidden lg:flex fixed start-0 w-64`, `ps-64` content
- `src/components/shared/Sidebar.tsx` — Server component: logo, `SidebarNav`, email + `LogoutButton`
- `src/components/shared/SidebarNav.tsx` — Client component: `usePathname()`, 9 nav items, `activePhase` guard
- `src/components/shared/MobileSidebar.tsx` — Client component: `Sheet side="right"`, closes on nav click
- `src/components/shared/LogoutButton.tsx` — Client component: `<form action={logout}>` button
- `src/app/(admin)/admin/companies/page.tsx` — Placeholder: `verifySession()` + heading

## Decisions Made

- **getClaims() not getUser():** `getUser()` makes a network call to Supabase Auth on every invocation. `getClaims()` verifies the JWT locally — instant, no round-trip. The pre-phase decision "Always use getUser() in server contexts" was specifically for the proxy.ts auth guard (which must verify token freshness). The DAL's `verifySession` can use `getClaims()` because the proxy already validated the token on request entry.
- **React cache() on verifySession:** Admin layout calls `verifySession()`. The companies page also calls it. Without `cache()`, two DB/JWT operations per render. With `cache()`, exactly one call per request tree regardless of how many components call it.
- **SidebarNav split:** Sidebar needs `usePathname()` for active link highlighting. If Sidebar were a client component, its server-fetched user data would need to be passed differently. The split keeps the outer Sidebar as a pure server component (can receive `session` from layout without a client boundary) while only `SidebarNav` is client.
- **RTL sidebar positioning:** In Tailwind v4 with `dir="rtl"`, `start` = right side, `end` = left side. Used `fixed inset-y-0 start-0` for sidebar (right side) and `ps-64` for content (padding on the same right side, offsetting the fixed sidebar). Zero physical CSS properties used.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added LogoutButton as separate client component**
- **Found during:** Task 2 (Sidebar implementation)
- **Issue:** Plan specified logout button inside server Sidebar. `logout` is a Server Action — it can be called from a `<form action={logout}>`. However, placing the form inside a server component that also has interactivity (`usePathname()`) was creating a dependency cascade. The cleaner pattern (and one preventing any future client boundary bleed) is to extract `LogoutButton` as its own minimal client component.
- **Fix:** Created `src/components/shared/LogoutButton.tsx` as a `'use client'` component with `<form action={logout}>`. Sidebar stays fully server-rendered.
- **Files modified:** `src/components/shared/LogoutButton.tsx` (new), `src/components/shared/Sidebar.tsx` (imports LogoutButton)
- **Verification:** Build passes, TypeScript clean, pattern matches shadcn/ui server/client boundary best practices
- **Committed in:** `25c5dec` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical boundary separation)
**Impact on plan:** Zero scope creep. LogoutButton is a 15-line file that maintains the server/client boundary correctly. The alternative (putting logout form directly in server Sidebar) would have worked but created a subtle coupling that breaks if Sidebar ever needs `'use client'` for another reason.

## Issues Encountered

None — build compiled cleanly on first attempt for both tasks.

## User Setup Required

None beyond what was documented in Plan 01-01's USER-SETUP.md — the same Supabase credentials power authentication. No additional environment variables required for this plan.

## Next Phase Readiness

- Auth flow is complete: login → admin area, logout → login, unauthenticated → redirect
- `verifySession()` ready — Plan 01-04 CRUD pages import and call it
- `writeAuditLog()` ready — Plan 01-04 Server Actions call it after every mutation
- Admin shell renders correctly — Plan 01-04 companies CRUD page will replace the placeholder
- Blocker (carries from 01-01): `.env.local` must have real Supabase credentials for auth to function

---
## Self-Check: PASSED

- [x] `src/app/(auth)/layout.tsx` — EXISTS
- [x] `src/app/(auth)/login/page.tsx` — EXISTS, contains `logo-he.png` and `useActionState`
- [x] `src/actions/auth.ts` — EXISTS, exports `login` and `logout`
- [x] `src/lib/dal.ts` — EXISTS, exports `verifySession`
- [x] `src/lib/audit.ts` — EXISTS, exports `writeAuditLog`
- [x] `src/app/(admin)/layout.tsx` — EXISTS, contains `verifySession` and `Sidebar`
- [x] `src/components/shared/Sidebar.tsx` — EXISTS, contains `sidebar-bg` class reference
- [x] `src/components/shared/SidebarNav.tsx` — EXISTS, 9 nav items, `usePathname()`
- [x] `src/components/shared/MobileSidebar.tsx` — EXISTS, `Sheet side="right"`
- [x] `src/app/(admin)/admin/companies/page.tsx` — EXISTS
- [x] Task 1 commit `6dc5df2` — FOUND
- [x] Task 2 commit `25c5dec` — FOUND
- [x] `npm run build` — PASSED with zero errors

---
*Phase: 01-foundation*
*Completed: 2026-03-01*
