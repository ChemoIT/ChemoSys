# Phase 7: ChemoSys Login - Research

**Researched:** 2026-03-04
**Domain:** Next.js App Router login page, Supabase Auth Server Actions, in-memory rate limiting, RTL Hebrew UI, permission-gated module selection buttons
**Confidence:** HIGH

---

## Summary

Phase 7 is the first user-facing page in the ChemoSys v2.0 system. It creates a dedicated login page at `/chemosys` — visually distinct from the admin login — with a post-login module selection UI that shows only the modules a user is permitted to access.

The codebase already has a near-perfect reference implementation: the admin login at `src/app/(auth)/login/page.tsx` with `src/actions/auth.ts`. Phase 7 creates a parallel version — same technical stack (useActionState, Server Action, Supabase Auth, rate limiting) but with a different post-login flow: instead of redirecting immediately, the user is shown module buttons (app_fleet, app_equipment) filtered by their permissions.

The critical architectural question is **where `/chemosys` lives in the route group structure**. Currently `(auth)/login/` serves the admin login at `/login`. The `/chemosys` URL needs its own page — either inside the existing `(auth)` route group (sharing its centered layout) or in a new route group with its own layout for visual differentiation. Given SUCCESS CRITERIA 1 ("נראה שונה לחלוטין מדף הכניסה לאדמין"), a separate route group `(chemosys)` or a standalone page is the right choice.

The module selection buttons (AUTH-04, AUTH-05) present a UX challenge: they are shown AFTER login succeeds (user is authenticated), but BEFORE the user navigates to `/app`. This means the login page must handle two states — unauthenticated (show form) and post-auth (show module selection). This is a client-side state transition using `useActionState` return value.

**Primary recommendation:** Create a new route group `(chemosys)` with its own layout using the `sidebar-bg` dark color as full-page background (dark teal — brand-dark `#1B3A4B`), visually distinguishing it from the admin login. The Server Action `loginApp()` in `auth.ts` authenticates and returns module permissions instead of redirecting immediately. The page client component renders module buttons post-auth.

---

## Standard Stack

### Core (no new packages required)

| Library | Version in Project | Purpose | Notes |
|---------|-------------------|---------|-------|
| `react` | ^19.0.0 | `useActionState`, `useState`, `useEffect`, `startTransition` | All needed, built-in |
| `next` | ^16.1.6 | App Router, Server Actions, `redirect()` | Already in use |
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client for auth | Already in use |
| `@supabase/supabase-js` | ^2.98.0 | `signInWithPassword()` | Already in use |
| `lucide-react` | ^0.575.0 | Module button icons (Truck for Fleet, HardHat for Equipment) | Already installed |
| `shadcn/ui Button` | current | Module selection buttons, login button | Already installed |
| `shadcn/ui Input` | current | Email/password fields | Already installed |
| `shadcn/ui Label` | current | Form labels | Already installed |
| `shadcn/ui Checkbox` | current | "זכור אותי" | Already installed |
| `next/image` | built-in | Logo display | Used in admin login |

**No new packages required.** Everything needed is already in `package.json`.

### Supporting (already installed)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `cn()` from `@/lib/utils` | Conditional classNames for disabled button styling | Module button disabled/active state |
| `sonner` | Toast — not needed for login (errors shown inline) | Skip for this page |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useActionState` for login | `react-hook-form` + manual fetch | useActionState is the project-established pattern (used in admin login) — must match |
| Inline module selection post-login | Separate `/chemosys/modules` page | One-page flow is simpler UX for field workers |
| New `(chemosys)` route group | Add `/chemosys` page inside `(auth)` group | `(auth)` group has centered white-card layout — ChemoSys needs different visual identity |

**Installation:** Nothing to install.

---

## Architecture Patterns

### Recommended File Structure for Phase 7

```
src/
├── actions/
│   └── auth.ts                      ← MODIFY: add loginApp() Server Action
├── app/
│   ├── (auth)/                      ← EXISTING: admin login layout (white bg, centered card)
│   │   ├── layout.tsx               ← unchanged
│   │   └── login/page.tsx           ← unchanged
│   ├── (chemosys)/                  ← NEW: ChemoSys login route group
│   │   ├── layout.tsx               ← NEW: dark background, full-screen, RTL
│   │   └── chemosys/
│   │       └── page.tsx             ← NEW: login form + module selection
│   ├── (admin)/                     ← EXISTING: unchanged
│   └── layout.tsx                   ← ROOT: unchanged
```

**Route resolution:** `(chemosys)` is a route group — the segment in the URL is `chemosys` (from the folder `chemosys/` inside the group), so the page serves at `/chemosys`. The group name `(chemosys)` creates no URL segment.

**Why a new route group vs putting page inside `(auth)`:**
- `(auth)/layout.tsx` renders `<div className="min-h-screen flex items-center justify-center bg-brand-bg">` — light gray background, centered card
- ChemoSys login should use the dark `sidebar-bg` (`#1B3A4B`) as the page background to look "different" per AUTH-01 and SUCCESS CRITERIA 1
- A new route group gives independent layout control without modifying the existing `(auth)` layout

### Pattern 1: `(chemosys)/layout.tsx` — Dark Background Layout

**What:** Standalone layout for the ChemoSys login page. Dark full-screen background with centered content.

**When to use:** This layout wraps ONLY the `/chemosys` login page in Phase 7. Phase 8's `(app)` layout is separate.

```typescript
// src/app/(chemosys)/layout.tsx
// ChemoSys route group layout — dark full-screen, RTL
// Used only by the /chemosys login page in Phase 7.
// Phase 8 creates (app)/layout.tsx separately for authenticated app pages.

export default function ChemosysLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar-bg">
      {children}
    </div>
  )
}
```

**Note:** `bg-sidebar-bg` maps to `#1B3A4B` (dark teal) — visually distinct from the admin login's `bg-brand-bg` (`#F5F7FA` light gray).

### Pattern 2: Two-State Login Page Component

**What:** The page renders in two states: (1) unauthenticated — show login form; (2) post-auth — show module selection buttons. State transitions via `useActionState` return value from `loginApp()`.

**Key insight:** `loginApp()` Server Action should NOT redirect on success — it should return `{ modules: string[] }` containing the user's permitted module keys. The client component reads this and renders the module buttons. The user then clicks a module button, which navigates to `/app/fleet` or `/app/equipment`.

**Why not redirect from Server Action?** If `loginApp()` redirected to `/app`, the user would be forced to the wrong module if they only have `app_equipment` access. The module selection is the UX for choosing where to go.

**State flow:**

```
Page load (unauthenticated)
  → Render: login form (email, password, "זכור אותי")

Form submit → loginApp() Server Action
  → On error: return { error: "..." } → render error message in form
  → On success: return { modules: ['app_fleet', 'app_equipment'] } → render module buttons

User clicks "צי רכב" button
  → Client-side router.push('/app/fleet') OR <Link href="/app/fleet">
```

**Returning modules from Server Action:** The `loginApp()` action calls `getAppNavPermissions()` AFTER signing in, then returns the list. This avoids a second page load.

**Important caveat:** `getAppNavPermissions()` calls `verifySession()` which reads the JWT. After `signInWithPassword()`, Supabase sets the session cookie in the response. The cookie is available on the NEXT request, not in the same Server Action invocation. This means calling `getAppNavPermissions()` inside the same Server Action that called `signInWithPassword()` may fail to read the new session.

**Solution:** Use `supabase.auth.getUser()` after sign-in (within the same Server Action, the session is in-memory even before cookie propagation). Then call `getPermissionsRpc(user.id)` directly rather than via `verifySession()`:

```typescript
// In loginApp() after successful signInWithPassword:
const { data: { user } } = await supabase.auth.getUser()
// user is available in-memory — session was set by signInWithPassword
const perms = await getPermissionsRpc(user!.id) // internal function from dal.ts — not exported
```

**Alternative simpler approach:** Redirect to `/app` and let `(app)/layout.tsx` (Phase 8) handle module selection. BUT Phase 8 is not built yet, so this would break Phase 7. The two-state page is the right approach for Phase 7 to be standalone.

**Simplest working approach (recommended):** After `signInWithPassword` succeeds, redirect to `/app`. Then build a temporary `/app/page.tsx` in Phase 7 that reads permissions and shows the module selection. This keeps `loginApp()` simple (redirect only) and separates the module selection into its own page. However, this creates a `/app/page.tsx` that Phase 8 will replace — overlap is acceptable since Phase 8 is the shell.

**Decision for planner:** Choose between two-state login page vs redirect to `/app/page.tsx` intermediate. Research recommends the redirect approach for simplicity and separation of concerns — Phase 7 focuses on auth, Phase 8 focuses on shell.

### Pattern 3: `loginApp()` Server Action

**What:** Parallel to the existing `login()` action. Authenticates user, then redirects to `/app`.

```typescript
// src/actions/auth.ts — add loginApp() after existing login()

type LoginAppState = { error: string } | null

// Separate rate limit map for ChemoSys login (AUTH-06)
const loginAppAttempts = new Map<string, RateLimitEntry>()

export async function loginApp(
  _prevState: LoginAppState,
  formData: FormData
): Promise<LoginAppState> {
  // Rate limit check (AUTH-06)
  const headersList = await headers()
  const ip = getClientIp(headersList)

  if (!checkRateLimit(ip, loginAppAttempts)) {
    return { error: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד דקה.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'נא למלא מייל וסיסמה' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.warn('[auth] loginApp failed:', error.message)
    return { error: 'מייל או סיסמה שגויים' }
  }

  redirect('/app')
}
```

**Rate limiting:** Extract `checkLoginRateLimit()` into a generic `checkRateLimit(ip, map)` helper so it can be reused for both `login()` and `loginApp()` without duplicating the logic.

### Pattern 4: Module Selection Buttons (AUTH-04 + AUTH-05)

**What:** Post-login UI showing `app_fleet` and `app_equipment` as clickable tiles. Modules without permission are rendered disabled/grayed.

**Where this renders:** In Phase 7, this can be on a separate `/app/page.tsx` (server component — reads permissions, renders buttons) OR in the two-state login page. Research recommends `/app/page.tsx` for clean separation.

```typescript
// src/app/(app-entry)/app/page.tsx (Phase 7 temporary — replaced/extended in Phase 8)
// Server component: reads permissions, redirects to only accessible module if just one,
// or shows module selection if multiple.

import { verifyAppUser, getAppNavPermissions } from '@/lib/dal'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Truck, HardHat } from 'lucide-react'

export default async function AppEntryPage() {
  const _user = await verifyAppUser() // redirects to /chemosys if not authenticated
  const modules = await getAppNavPermissions()

  const hasFleet = modules.includes('app_fleet')
  const hasEquipment = modules.includes('app_equipment')

  // Auto-redirect if only one top-level module accessible
  if (hasFleet && !hasEquipment) redirect('/app/fleet')
  if (!hasFleet && hasEquipment) redirect('/app/equipment')
  if (!hasFleet && !hasEquipment) redirect('/chemosys') // no access

  // Multiple modules — show selection
  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar-bg">
      <div className="bg-brand-card rounded-xl shadow-lg p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-center mb-6">בחר מודול</h1>
        <div className="grid grid-cols-2 gap-4">
          {/* Fleet button */}
          <Link href="/app/fleet"
            className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-colors
              ${hasFleet
                ? 'border-brand-primary text-brand-primary hover:bg-brand-primary/10'
                : 'border-border text-muted-foreground cursor-not-allowed opacity-50 pointer-events-none'
              }`}
          >
            <Truck className="w-10 h-10" />
            <span className="font-semibold text-sm">צי רכב</span>
          </Link>
          {/* Equipment button */}
          <Link href="/app/equipment"
            className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-colors
              ${hasEquipment
                ? 'border-brand-primary text-brand-primary hover:bg-brand-primary/10'
                : 'border-border text-muted-foreground cursor-not-allowed opacity-50 pointer-events-none'
              }`}
          >
            <HardHat className="w-10 h-10" />
            <span className="font-semibold text-sm">צמ"ה</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
```

**Critical note on disabled buttons:** Using `<Link>` with `pointer-events-none` for disabled modules prevents navigation cleanly in RTL/mobile. Alternative is `<button disabled>` styled as a card. Either works — the planner can choose.

**Critical note on module buttons visibility (SUCCESS CRITERIA 2):** The requirement says disabled buttons should be visible but grayed — NOT hidden. This is intentional UX: the user sees what modules exist but cannot access without permission. The code above shows both buttons always, with disabled styling if no permission.

### Pattern 5: "זכור אותי" in ChemoSys Login (AUTH-03)

**What:** Checkbox that saves email + password (base64) to localStorage. Same pattern as admin login.

**Reference implementation:** `src/app/(auth)/login/page.tsx` lines 26-53. Exact same `REMEMBER_KEY` and `localStorage` approach can be reused with a different key name to avoid collision.

```typescript
const REMEMBER_KEY_APP = 'chemosys_app_remember' // different from admin's 'chemosys_remember'
```

**Note on `startTransition`:** The admin login wraps `formAction(formData)` in the `handleSubmit` function (not `startTransition`). From `patterns.md`: "useActionState + async handler: must wrap formAction(formData) in startTransition() when calling from async onSubmit handler." Since `handleSubmit` is synchronous (the async credential-saving logic is just localStorage), `startTransition` is NOT required here. Match the existing admin login pattern exactly.

### Pattern 6: Rate Limiting Refactor (AUTH-06)

**What:** The existing `checkLoginRateLimit(ip)` in `auth.ts` is hardcoded to use `loginAttempts` Map. Phase 7 needs a second rate limiter for `loginApp()` without code duplication.

**Recommended refactor:**

```typescript
// Generalized rate limit check — takes the Map as parameter
function checkRateLimit(ip: string, store: Map<string, RateLimitEntry>): boolean {
  const now = Date.now()
  const entry = store.get(ip)
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// Separate maps per endpoint (not shared — different attack surfaces)
const loginAttempts = new Map<string, RateLimitEntry>()     // admin login
const loginAppAttempts = new Map<string, RateLimitEntry>()  // ChemoSys login
```

**Why separate Maps:** Admin and ChemoSys logins are independent attack surfaces. An attacker brute-forcing ChemoSys should not affect admin login rate limit and vice versa.

### Anti-Patterns to Avoid

- **Reusing admin `login()` action for ChemoSys:** The post-login redirect is different (`/admin/dashboard` vs `/app`). Never add conditional logic to `login()` — create a separate `loginApp()`.
- **Protecting `/chemosys` in `proxy.ts`:** The `proxy.ts` already excludes `/chemosys` from the auth redirect guard (implemented in Phase 6). Do NOT add any auth check to the `/chemosys` route itself — it must be publicly accessible (unauthenticated users must reach it to log in).
- **Using `getAppNavPermissions()` inside `loginApp()` via `verifySession()`:** `verifySession()` reads the JWT cookie which may not be set yet in the same request where `signInWithPassword()` was called. Use redirect-then-read pattern instead.
- **Single route group sharing admin and ChemoSys login layouts:** `(auth)/layout.tsx` is light gray — ChemoSys needs dark background. Do not add conditional rendering to `(auth)/layout.tsx`.
- **Inline `cache()` in Server Action:** `getPermissionsRpc` in `dal.ts` is cached at module level. Do NOT attempt to re-cache it inside Server Actions — `React.cache()` is not valid in Server Action context (only in Server Components).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom Redis/token bucket | In-memory Map (existing pattern) | Zero paid subscriptions rule. Same approach as admin login. Acceptable for single-instance deployment |
| Module permission check | Custom DB query in Server Action | `verifyAppUser()` + `getAppNavPermissions()` in `dal.ts` | Already implemented in Phase 6. Deduplicated via React.cache() |
| "Remember me" credential storage | Custom encryption | Base64 localStorage (existing pattern) | Matches admin login exactly. Internal tool — acceptable per existing code comments |
| Login form validation | Custom validators | Inline empty-string check (existing pattern) | Form fields are `required` HTML attribute + server-side check. No Zod needed for login |

**Key insight:** The entire technical stack for this phase already exists in `src/actions/auth.ts` and `src/app/(auth)/login/page.tsx`. Phase 7 is a parallel implementation, not a new pattern.

---

## Common Pitfalls

### Pitfall 1: `/chemosys` Route Conflicts With `(chemosys)` Group

**What goes wrong:** Creating `src/app/(chemosys)/chemosys/page.tsx` creates the URL `/chemosys` correctly. But if someone accidentally also creates `src/app/chemosys/page.tsx` (without a route group), Next.js will have a conflict.

**Why it happens:** Next.js App Router does not allow two routes to resolve to the same URL segment.

**How to avoid:** Put the ChemoSys login page ONLY in `(chemosys)/chemosys/page.tsx`. No standalone `src/app/chemosys/` folder.

**Warning signs:** Next.js build error "Conflict: Two pages resolve to the same route."

### Pitfall 2: `loginApp()` Redirect Before Cookie Set

**What goes wrong:** Calling `verifySession()` or `supabase.auth.getClaims()` inside the same Server Action that called `signInWithPassword()` — the JWT cookie from `signInWithPassword()` has not been written to the browser yet, so `getClaims()` returns null.

**Why it happens:** `signInWithPassword()` sets cookies via `supabase.setAll()` (in the Supabase SSR client), but those cookies are only sent to the browser when the Server Action RESPONSE is returned. Any cookie-reading within the same action reads the INCOMING cookies (which predate the sign-in).

**How to avoid:** After successful `signInWithPassword()`, use `supabase.auth.getUser()` which reads the in-memory session (not cookies). OR simply redirect to `/app` and let `(app)/page.tsx` call `verifyAppUser()` on the next request (when cookies are available).

**Recommended solution:** `redirect('/app')` from `loginApp()`. The `/app/page.tsx` handles module selection as a fresh server request with the new session cookies.

**Warning signs:** `verifySession()` redirects to `/login` immediately after a successful `loginApp()` — the session cookie was not set yet when the action tried to read it.

### Pitfall 3: `startTransition` with `useActionState` and `handleSubmit`

**What goes wrong:** The `handleSubmit` function in the ChemoSys login page wraps `formAction(formData)` but is itself passed as `form action`. If `handleSubmit` becomes async (e.g., for localStorage), React 19 requires `startTransition`.

**Why it happens:** From `patterns.md`: "useActionState + async handler: must wrap formAction(formData) in startTransition() when calling from async onSubmit handler."

**How to avoid:** Keep `handleSubmit` synchronous — localStorage reads/writes are synchronous. The admin login page does NOT use `startTransition` and works correctly. Match the admin login pattern exactly.

**Warning signs:** React warning in console: "An update to ... inside a test was not wrapped in act(...)." Or `isPending` not updating correctly.

### Pitfall 4: `(chemosys)/layout.tsx` Conflicting With `(app)/layout.tsx` (Phase 8)

**What goes wrong:** Phase 8 creates `(app)/layout.tsx` which wraps all `/app/*` routes. If the `/app` module-selection page (created in Phase 7) is inside the `(app)` route group, it will also get the Phase 8 app shell layout (header, navigation). This is unintended for Phase 7.

**Why it happens:** Route group layouts nest. A page at `(app)/app/page.tsx` gets wrapped by `(app)/layout.tsx`.

**How to avoid in Phase 7:** The `/app/page.tsx` module selection page should be OUTSIDE the `(app)` route group — at `src/app/app/page.tsx` (standalone, no route group). Phase 8 will MOVE it into `(app)/app/page.tsx` when building the shell.

**Alternative:** Use a separate route `src/app/(app-entry)/app/page.tsx` to make the group explicit. Phase 8 replaces this with `(app)/app/page.tsx`.

**Warning signs:** Module selection page shows app header/nav before it's built in Phase 8 — rendering errors or blank shell.

### Pitfall 5: Disabled Module Buttons Accessible via Direct URL

**What goes wrong:** A user with only `app_fleet` access sees the `app_equipment` button disabled on the login page, but can navigate directly to `/app/equipment` and access it.

**Why it happens:** Disabled buttons are client-side UX only — they do not block server-side access.

**How to avoid:** Phase 8 and 9 address this with `verifyAppUser()` + permission check in each module's layout/page. Phase 7 only implements the LOGIN page — the route guard for `/app/equipment` is Phase 10 (EQUIP-02). Phase 7 must NOT skip the disabled-button UX (it's a SUCCESS CRITERIA requirement) but it does not need to implement the full server-side guard.

**Warning signs:** None in Phase 7 — this is by design. Document clearly for Phase 8-10.

### Pitfall 6: `/chemosys` Route Already Used by `proxy.ts`

**What goes wrong:** Proxy already has `/chemosys` as an exclusion. If the new route group puts files elsewhere but the page is not at `/chemosys`, unauthenticated redirects will send users to a 404.

**Why it happens:** `proxy.ts` hardcodes the `/chemosys` pathname check.

**How to avoid:** Verify the page renders at `/chemosys` by running `npm run dev` and visiting `http://localhost:3000/chemosys`. The file must be at `src/app/(chemosys)/chemosys/page.tsx` OR `src/app/(auth)/chemosys/page.tsx` — both resolve to `/chemosys`.

### Pitfall 7: Permissions-Policy in `next.config.ts` Blocks Camera/Mic/Geolocation

**What goes wrong:** The existing `next.config.ts` has `Permissions-Policy: camera=(), microphone=(), geolocation=()`. This is intentional for the admin panel. For ChemoSys field worker pages (future phases — QR scanning, GPS), these will need to be updated.

**How to avoid in Phase 7:** No change needed to `next.config.ts` for Phase 7. The login page does not use camera/mic/geolocation. Flag this as a future concern for Phase 9+ (vehicle QR scan in `app_fleet_camp_vehicles`).

---

## Code Examples

Verified patterns from existing codebase analysis (HIGH confidence — direct code inspection):

### loginApp() Server Action — Complete Pattern

```typescript
// Source: src/actions/auth.ts — add after existing login()
// Pattern mirrors login() exactly, differing only in redirect target

"use server"

// ... existing imports and types ...

// Separate rate limit store for ChemoSys login (AUTH-06)
// Independent from admin loginAttempts — different attack surface
const loginAppAttempts = new Map<string, RateLimitEntry>()

// Generalized rate limit helper (refactored from checkLoginRateLimit)
function checkRateLimit(ip: string, store: Map<string, RateLimitEntry>): boolean {
  const now = Date.now()
  const entry = store.get(ip)
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

type LoginAppState = { error: string } | null

export async function loginApp(
  _prevState: LoginAppState,
  formData: FormData
): Promise<LoginAppState> {
  const headersList = await headers()
  const ip = getClientIp(headersList)

  if (!checkRateLimit(ip, loginAppAttempts)) {
    return { error: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד דקה.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'נא למלא מייל וסיסמה' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.warn('[auth] loginApp failed:', error.message)
    return { error: 'מייל או סיסמה שגויים' }
  }

  redirect('/app') // Next request will have session cookies — verifyAppUser() will work
}
```

### ChemoSys Login Page — Component Pattern

```typescript
// Source pattern: mirrors src/app/(auth)/login/page.tsx exactly
// with ChemoSys branding and loginApp() action

"use client"

import { useActionState, useEffect, useState } from "react"
import Image from "next/image"
import { loginApp } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

// Separate localStorage key — avoid collision with admin's 'chemosys_remember'
const REMEMBER_KEY = 'chemosys_app_remember'

export default function ChemosysLoginPage() {
  const [state, formAction, isPending] = useActionState(loginApp, null)
  const [savedEmail, setSavedEmail] = useState("")
  const [savedPassword, setSavedPassword] = useState("")
  const [remember, setRemember] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REMEMBER_KEY)
      if (stored) {
        const { e, p } = JSON.parse(atob(stored))
        if (e) setSavedEmail(e)
        if (p) setSavedPassword(p)
        setRemember(true)
      }
    } catch {
      localStorage.removeItem(REMEMBER_KEY)
    }
  }, [])

  function handleSubmit(formData: FormData) {
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    if (remember && email) {
      localStorage.setItem(REMEMBER_KEY, btoa(JSON.stringify({ e: email, p: password })))
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }
    formAction(formData) // synchronous handler — no startTransition needed
  }

  return (
    <div className="bg-brand-card rounded-xl shadow-lg p-8 w-full max-w-md">
      {/* ChemoSys Logo/Branding — different from admin logo */}
      <div className="flex flex-col items-center mb-8 gap-2">
        <Image src="/logo-he.png" alt="חמו אהרון" width={200} height={70} priority />
        <p className="text-sidebar-text text-sm font-medium">מערכת ניהול שטח</p>
      </div>

      <form action={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">כתובת מייל</Label>
          <Input id="email" name="email" type="email" placeholder="your@email.com"
            required autoComplete="email" disabled={isPending} defaultValue={savedEmail} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">סיסמה</Label>
          <Input id="password" name="password" type="password" placeholder="הזינו סיסמה"
            required autoComplete="current-password" disabled={isPending} defaultValue={savedPassword} />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="remember" checked={remember}
            onCheckedChange={(checked) => setRemember(checked === true)} />
          <Label htmlFor="remember" className="text-sm cursor-pointer">זכור אותי</Label>
        </div>

        {state?.error && (
          <p className="text-sm text-brand-danger" role="alert">{state.error}</p>
        )}

        <Button type="submit"
          className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white"
          disabled={isPending}>
          {isPending ? "מתחבר..." : "התחברות"}
        </Button>
      </form>
    </div>
  )
}
```

### `/app/page.tsx` — Module Selection (Server Component)

```typescript
// src/app/app/page.tsx (standalone, outside (app) route group for Phase 7)
// Phase 8 will move/extend this into (app) route group with proper shell layout

import { verifyAppUser, getAppNavPermissions } from '@/lib/dal'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Truck, HardHat } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function AppEntryPage() {
  await verifyAppUser() // redirects to /chemosys if unauthenticated or no app access
  const modules = await getAppNavPermissions()

  const hasFleet = modules.includes('app_fleet')
  const hasEquipment = modules.includes('app_equipment')

  // Auto-redirect if exactly one top-level module
  if (hasFleet && !hasEquipment) redirect('/app/fleet')
  if (hasEquipment && !hasFleet) redirect('/app/equipment')
  if (!hasFleet && !hasEquipment) redirect('/chemosys')

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar-bg">
      <div className="bg-brand-card rounded-xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-center mb-6">בחר מודול</h1>
        <div className="grid grid-cols-2 gap-4">
          <ModuleButton href="/app/fleet" label="צי רכב" icon={<Truck className="w-10 h-10" />} enabled={hasFleet} />
          <ModuleButton href="/app/equipment" label='צמ"ה' icon={<HardHat className="w-10 h-10" />} enabled={hasEquipment} />
        </div>
      </div>
    </div>
  )
}

function ModuleButton({ href, label, icon, enabled }: {
  href: string; label: string; icon: React.ReactNode; enabled: boolean
}) {
  const base = "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-colors text-center"
  const active = "border-brand-primary text-brand-primary hover:bg-brand-primary/10 cursor-pointer"
  const disabled = "border-border text-muted-foreground opacity-50 cursor-not-allowed pointer-events-none"

  return (
    <Link href={href} className={cn(base, enabled ? active : disabled)} aria-disabled={!enabled}>
      {icon}
      <span className="font-semibold text-sm">{label}</span>
      {!enabled && <span className="text-xs text-muted-foreground">אין גישה</span>}
    </Link>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` for auth | `proxy.ts` (same export, renamed file) | Phase 1 | Must use `proxy.ts` only — never create `middleware.ts` |
| `getSession()` (unverified) | `getClaims()` (JWT local verify) | Phase 1 | Already in `verifySession()` — do not regress |
| `supabase.auth.getUser()` in all server components | `getClaims()` in server components, `getUser()` ONLY in proxy | Phase 1 | `getUser()` makes network call — expensive in server components |
| Shared login page for all user types | Separate `/login` (admin) and `/chemosys` (app) | v2.0 architecture decision | Two independent login flows |
| Single rate limit Map | Separate Map per endpoint | Phase 7 (new) | Independent limits for admin vs app login |

**Deprecated/outdated in this project:**
- `middleware.ts` — project uses `proxy.ts` (documented in MEMORY.md). NEVER create `middleware.ts`.
- `supabase.auth.getSession()` — replaced with `getClaims()` in `verifySession()`.
- Any route group named `(app)` without a layout — `(app)` is reserved for Phase 8 shell.

---

## Open Questions

1. **Module selection — two-state login page vs redirect to `/app/page.tsx`**
   - What we know: Both approaches work. Two-state login keeps everything in one page. Redirect keeps Server Action simple.
   - What's unclear: Phase 8 will build `(app)/layout.tsx`. If `/app/page.tsx` is created in Phase 7 as a standalone page (no route group), Phase 8 needs to restructure it. If it's inside `(app)` route group from Phase 7, it conflicts with Phase 8's layout creation.
   - Recommendation: Create `/app/page.tsx` as a standalone page (no route group) in Phase 7. Phase 8 can add the `(app)` route group layout above it — Next.js route groups can be added without moving existing pages.
   - **Planner action needed:** Decide file location for `/app/page.tsx` — `src/app/app/page.tsx` (no group) or `src/app/(app-entry)/app/page.tsx` (separate group).

2. **Where to put the `/chemosys` route — inside `(auth)` or new `(chemosys)` group?**
   - What we know: `(auth)/layout.tsx` = light gray centered layout. Requirement says ChemoSys must look "different" from admin login.
   - What's unclear: Could the same visual difference be achieved by overriding background in the page component itself (not the layout)?
   - Recommendation: New `(chemosys)` route group. This gives complete layout independence — no risk of `(auth)/layout.tsx` changes affecting the ChemoSys login. Clean separation of concerns.

3. **Logo and branding on the ChemoSys login**
   - What we know: Admin login uses `/logo-he.png` (280×100px). SUCCESS CRITERIA 1 says "לוגו, כותרת, ועיצוב ייעודי" — the design should be distinct.
   - What's unclear: Is there a separate ChemoSys logo file, or should the same logo be used with a subtitle?
   - Recommendation: Use the same `/logo-he.png` at a smaller size (200×70px) with a subtitle "מערכת ניהול שטח" below it. The dark background (`bg-sidebar-bg`) already makes it visually distinct. No new logo file needed.
   - **Sharon decision needed if he wants a different visual identity.**

4. **What happens when an admin (Sharon) logs in via `/chemosys`?**
   - What we know: Phase 6 research confirmed `verifyAppUser()` does NOT block `is_admin` users — admins get all app_* permissions via RPC.
   - What's unclear: Should `/app/page.tsx` show both module buttons to Sharon?
   - Recommendation: YES — Sharon logging in via `/chemosys` sees both "צי רכב" and "צמ"ה" active (level 2 on both from the RPC). This is correct and intentional per v2.0 architecture decisions.

---

## Existing Code State (Critical Context for Planner)

### What EXISTS (do not re-implement):

| File | Status | Notes |
|------|--------|-------|
| `src/actions/auth.ts` | EXISTS — MODIFY | Add `loginApp()` + refactor rate limit helper |
| `src/app/(auth)/login/page.tsx` | EXISTS — unchanged | Reference implementation for ChemoSys login |
| `src/app/(auth)/layout.tsx` | EXISTS — unchanged | Light gray, do not touch |
| `src/lib/dal.ts` | EXISTS — unchanged | `verifyAppUser()` + `getAppNavPermissions()` ready since Phase 6 |
| `src/proxy.ts` | EXISTS — unchanged | `/chemosys` exclusion already added in Phase 6 |
| `src/app/layout.tsx` (root) | EXISTS — unchanged | Heebo, RTL, Toaster — applies to all routes |

### What DOES NOT EXIST (needs creation):

| File | What to Create |
|------|---------------|
| `src/app/(chemosys)/layout.tsx` | Dark background layout for `/chemosys` page |
| `src/app/(chemosys)/chemosys/page.tsx` | ChemoSys login form (client component) |
| `src/app/app/page.tsx` | Module selection (server component) — temporary until Phase 8 |

### Route Group Summary:

```
src/app/
├── (auth)/chemosys/    ← Option A (shares auth layout — NOT recommended)
├── (chemosys)/chemosys/ ← Option B (own layout — RECOMMENDED)
└── app/page.tsx        ← Module selection (new, no route group for Phase 7)
```

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection:
  - `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/actions/auth.ts` — existing rate limiting, login pattern
  - `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/app/(auth)/login/page.tsx` — reference login component
  - `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/app/(auth)/layout.tsx` — existing auth layout
  - `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/app/(admin)/layout.tsx` — admin layout pattern
  - `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/lib/dal.ts` — `verifyAppUser()`, `getAppNavPermissions()` (Phase 6 complete)
  - `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/proxy.ts` — `/chemosys` exclusion confirmed
  - `C:/Sharon_ClaudeCode/Apps/ChemoSystem/src/app/globals.css` — brand colors confirmed
  - `C:/Sharon_ClaudeCode/Apps/ChemoSystem/package.json` — installed packages confirmed
- `.planning/ROADMAP.md` — Phase 7 plan count (1 plan: 07-01), requirements confirmed
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-06 confirmed
- `.planning/phases/06-db-auth-foundation/06-RESEARCH.md` — Phase 6 architectural decisions confirmed
- `C:/Users/Alias/.claude/projects/c--Sharon-ClaudeCode-Apps-ChemoSystem/memory/patterns.md` — `startTransition` rule confirmed

### Secondary (MEDIUM confidence)

- Next.js App Router route group behavior — well-established pattern, consistent with existing `(admin)` and `(auth)` groups in this project
- Supabase Auth cookie propagation within same Server Action — inferred from Supabase SSR client behavior (`setAll` writes cookies to response, not available for reading in the same request)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all existing
- Architecture patterns: HIGH — derived from direct codebase inspection + existing patterns
- Code examples: HIGH — all patterns verified against actual files
- Cookie propagation pitfall: MEDIUM — inferred from Supabase SSR mechanics (documented behavior)
- Open questions: clarity needed from planner — not blockers

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable stack, low churn)
