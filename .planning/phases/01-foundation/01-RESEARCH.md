# Phase 1: Foundation - Research

**Researched:** 2026-03-01
**Domain:** Next.js 16 + Supabase SSR + Tailwind v4 RTL + PostgreSQL schema
**Confidence:** HIGH (core stack verified against official docs and current release notes)

---

## Summary

Phase 1 establishes everything that every subsequent phase depends on: project scaffold, DB schema with universal columns and soft-delete semantics, authentication infrastructure, RTL Hebrew UI shell, and CRUD for the three reference entities (companies, departments, role tags). Getting this phase right prevents expensive rewrites later — RTL cannot be retrofitted cheaply, soft delete constraints must be partial indexes from the start, and auth must use the current `@supabase/ssr` API (not the deprecated helpers).

The tech landscape has moved since prior project research was completed. **Next.js 16.1.6 is now the stable version** (released Oct 2025, current patch 2026-02-27). The `middleware.ts` file is deprecated and renamed to `proxy.ts` in v16. Crucially, in Next.js 16 **synchronous access to `cookies()`, `headers()`, and `params` is fully removed** — all must be awaited. This is a breaking change from v15 and requires `await cookies()` in the Supabase server client factory. Supabase has also introduced `getClaims()` as the preferred server-side JWT verification method (faster than `getUser()` because it verifies locally against public keys rather than making a network round-trip to the Auth server), though `getUser()` remains required when session revocation must be detected.

The prior project research (STACK.md, ARCHITECTURE.md, PITFALLS.md) is largely sound and is incorporated here. This document adds verified current-version specifics, corrects any outdated patterns, and focuses on what the planner needs for the four Phase 1 plans.

**Primary recommendation:** Scaffold with `npx create-next-app@latest` (installs Next.js 16), use `proxy.ts` (not `middleware.ts`), await all cookies/headers, use `@supabase/ssr@0.8.0` with `getAll`/`setAll` pattern, and set `dir="rtl"` on `<html>` before writing a single component.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | Full-stack framework (App Router) | Current stable (Oct 2025). Turbopack default. React 19.2. `proxy.ts` replaces deprecated `middleware.ts`. |
| React | 19.2 | UI rendering | Ships with Next.js 16. Server Components + Server Actions. View Transitions available. |
| TypeScript | 5.x (min 5.1) | Type safety | Required by Next.js 16. |
| Node.js | 20.9+ | Runtime | Next.js 16 minimum requirement. |
| @supabase/supabase-js | ^2.x | Supabase JS client | Main client library for DB access. |
| @supabase/ssr | 0.8.0 | SSR-aware Supabase client | Required for Next.js App Router. Handles cookie-based session across proxy.ts, Server Components, Route Handlers. Only package to use — `auth-helpers-nextjs` is deprecated and removed. |
| Tailwind CSS | 4.1 | Utility-first CSS | Scaffolded by `create-next-app`. CSS-based config (no tailwind.config.js in v4). Built-in logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) for RTL. |
| shadcn/ui | latest (Tailwind v4 compatible) | Component library | Components are owned by the project (CLI copies source). Components updated for Tailwind v4 and React 19. Uses `data-slot` attributes instead of `forwardRef`. Animation library is now `tw-animate-css` (not `tailwindcss-animate`). |
| Radix UI | Latest (via shadcn/ui) | Accessible headless primitives | Dialog, DropdownMenu, Tabs, Select, etc. with full keyboard nav + ARIA. |
| Lucide React | ^0.x | Icons | Included by shadcn/ui. |
| next/font (Google) | Built-in | Font loading | Self-hosts Google Fonts. Zero CLS. Load Heebo with `subsets: ['hebrew', 'latin']`. |
| Zod | ^3.x | Schema validation | Official Next.js recommendation for Server Action validation. Schemas double as TypeScript types. |
| React Hook Form | ^7.x | Form state | Required for complex forms. Compatible with Server Actions. |
| @hookform/resolvers | ^3.x | RHF + Zod bridge | One package, no manual transformation. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TanStack Table | ^8.x | Data table engine | Headless, MIT, composable with shadcn/ui Table. Use for all sortable/filterable lists in Phase 1 (companies, departments, role tags). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui | Ant Design, MUI | Ant Design / MUI conflict with Tailwind v4. shadcn/ui gives source control — essential for RTL tuning. |
| TanStack Table | AG Grid | AG Grid CE is GPL. TanStack is MIT and headless. |
| Zod | Yup | Zod has superior TypeScript inference and is explicitly recommended in Next.js docs. |

**Installation:**
```bash
# 1. Scaffold (installs Next.js 16, React 19.2, Tailwind v4, TypeScript, ESLint)
npx create-next-app@latest chemosys \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# 2. Core dependencies
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  zod \
  react-hook-form \
  @hookform/resolvers \
  lucide-react \
  @tanstack/react-table

# 3. shadcn/ui (copies components into project source)
npx shadcn@latest init
npx shadcn@latest add button input label table tabs dialog dropdown-menu \
  select badge toast card skeleton separator form

# 4. Dev dependencies
npm install -D @types/node @types/react @types/react-dom
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (auth)/                        # Route group — centered auth layout
│   │   ├── layout.tsx                 # Auth layout: centered, logo
│   │   └── login/
│   │       └── page.tsx               # Login form (Client Component + Server Action)
│   │
│   ├── (admin)/                       # Route group — sidebar layout
│   │   ├── layout.tsx                 # Admin shell: sidebar + RTL wrapper
│   │   └── admin/
│   │       ├── companies/page.tsx
│   │       ├── departments/page.tsx
│   │       └── role-tags/page.tsx
│   │
│   ├── layout.tsx                     # Root layout (html dir="rtl", Heebo font)
│   ├── globals.css                    # Tailwind v4 CSS config + @theme directive
│   └── not-found.tsx
│
├── components/
│   ├── admin/                         # Module-specific components
│   │   ├── companies/
│   │   ├── departments/
│   │   └── role-tags/
│   └── shared/                        # Reusable UI (no business logic)
│       ├── DataTable.tsx
│       ├── Modal.tsx
│       └── Sidebar.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts                  # createClient() for RSC + Server Actions
│   │   └── browser.ts                 # createBrowserClient() for Client Components
│   ├── dal.ts                         # verifySession(), getUser(), getPermissions()
│   ├── permissions.ts                 # hasAccess(userId, module, level)
│   ├── audit.ts                       # writeAuditLog(action, entity, oldVal, newVal)
│   └── utils.ts                       # Shared utilities
│
├── actions/                           # Server Actions ('use server')
│   ├── auth.ts                        # login, logout
│   ├── companies.ts                   # createCompany, updateCompany, softDeleteCompany
│   ├── departments.ts
│   └── role-tags.ts
│
└── types/
    ├── database.ts                    # Supabase generated types
    └── entities.ts                    # Company, Department, RoleTag DTOs

proxy.ts                               # Auth guard (Next.js 16 — replaces middleware.ts)
```

### Pattern 1: Supabase Server Client (Next.js 16 — Async Cookies)

**What:** Create the Supabase server client using `await cookies()` (required in Next.js 16 — synchronous access removed).
**When to use:** All Server Components, Server Actions, Route Handlers.

```typescript
// Source: Supabase official docs (supabase.com/docs/guides/auth/server-side/creating-a-client)
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()  // MUST await in Next.js 16

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,  // formerly ANON_KEY
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Safe to ignore in Server Component context — proxy.ts handles writes
          }
        },
      },
    }
  )
}
```

### Pattern 2: proxy.ts (Formerly middleware.ts)

**What:** Auth guard that refreshes the Supabase session on every request and redirects unauthenticated users.
**When to use:** At the project root. Replaces `middleware.ts` in Next.js 16.

```typescript
// Source: Official Next.js 16 upgrade guide + Supabase SSR docs
// proxy.ts  ← file must be named proxy.ts in Next.js 16
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {  // function MUST be named proxy
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // MUST call getUser() to refresh the session token
  // getClaims() does NOT refresh tokens — only getUser() does in proxy context
  const { data: { user } } = await supabase.auth.getUser()

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isLoginRoute = request.nextUrl.pathname.startsWith('/login')

  if (isAdminRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isLoginRoute && user) {
    return NextResponse.redirect(new URL('/admin/companies', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Note:** In Next.js 16, `middleware.ts` is deprecated (still works for Edge runtime). For Node.js runtime (standard use), use `proxy.ts`. Edge runtime is NOT supported in `proxy.ts`.

### Pattern 3: Server Action with Auth + Permission + Audit

**What:** The standard mutation pattern — every Server Action must follow this exact sequence.
**When to use:** Every `actions/*.ts` file.

```typescript
// Source: Next.js official authentication guide + project architecture
// actions/companies.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const CompanySchema = z.object({
  name: z.string().min(1, 'שם חברה הוא שדה חובה'),
  internal_number: z.string().min(1),
  company_reg_number: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  notes: z.string().optional(),
})

export async function createCompany(formData: FormData) {
  // 1. Auth — always first
  const session = await verifySession()

  // 2. Validate
  const parsed = CompanySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // 3. Mutate
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .insert({ ...parsed.data, created_by: session.userId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: { internal_number: ['מספר חברה כבר קיים'] } }
    return { error: 'שגיאת מערכת. נסה שנית.' }
  }

  // 4. Audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'companies',
    entityId: data.id,
    oldData: null,
    newData: data,
  })

  // 5. Revalidate
  revalidatePath('/admin/companies')
  return { success: true, data }
}

export async function softDeleteCompany(id: string) {
  const session = await verifySession()
  const supabase = await createClient()

  // Fetch old data for audit
  const { data: oldData } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('companies')
    .update({ deleted_at: new Date().toISOString(), updated_by: session.userId })
    .eq('id', id)

  if (error) return { error: 'שגיאת מחיקה' }

  await writeAuditLog({
    userId: session.userId,
    action: 'DELETE',
    entityType: 'companies',
    entityId: id,
    oldData,
    newData: { deleted_at: new Date().toISOString() },
  })

  revalidatePath('/admin/companies')
  return { success: true }
}
```

### Pattern 4: DAL — verifySession()

**What:** Authoritative session verification using `getClaims()` (fast, locally verifies JWT) with fallback to `getUser()` for logout detection.
**When to use:** At the top of every Server Component page and every Server Action.

```typescript
// Source: Next.js official DAL pattern (nextjs.org/docs/app/guides/authentication)
// lib/dal.ts
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const verifySession = cache(async () => {
  const supabase = await createClient()

  // getClaims() is fast (local JWT verification) — preferred for page rendering
  // Use getUser() when you need to detect deleted/banned users
  const { data: { claims }, error } = await supabase.auth.getClaims()

  if (error || !claims) {
    redirect('/login')
  }

  return {
    userId: claims.sub,
    email: claims.email,
  }
})
```

### Pattern 5: Root Layout — RTL Hebrew from Day 1

**What:** Set `dir="rtl"` and Heebo font in the root layout before any component is written.
**When to use:** `app/layout.tsx` — first thing created after scaffold.

```typescript
// Source: Next.js official font docs + Tailwind v4 logical properties docs
// app/layout.tsx
import { Heebo } from 'next/font/google'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  display: 'swap',
  variable: '--font-heebo',
  weight: ['300', '400', '500', '600', '700', '800'],
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-[var(--font-heebo)] bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
```

### Pattern 6: DB Schema — Universal Columns + Soft Delete + Triggers

**What:** Every table gets the same set of universal columns, and soft delete uses partial unique indexes.

```sql
-- Source: Standard PostgreSQL / Supabase pattern from project ARCHITECTURE.md

-- Universal column template (apply to EVERY table)
id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
created_by  UUID REFERENCES auth.users(id),
updated_by  UUID REFERENCES auth.users(id),
deleted_at  TIMESTAMPTZ DEFAULT NULL   -- NULL = active, NOT NULL = soft deleted

-- Enable RLS on EVERY table (non-negotiable)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Partial unique index for soft-delete compatibility (NOT a plain UNIQUE constraint)
CREATE UNIQUE INDEX companies_internal_number_unique
  ON companies (internal_number)
  WHERE deleted_at IS NULL;

-- Auto-update trigger (apply to every table)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- SECURITY DEFINER function for permission lookups (prevents RLS recursion)
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(module_key TEXT, level SMALLINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT module_key, level
  FROM user_permissions
  WHERE user_id = p_user_id;
$$;
```

### Anti-Patterns to Avoid

- **Using `middleware.ts` in Next.js 16:** The function export name must be `proxy` and the file must be named `proxy.ts`. `middleware.ts` still works but is deprecated.
- **Synchronous `cookies()` access:** Next.js 16 removed sync access. Always `await cookies()`. This breaks the Supabase server client if not updated.
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY` as env var name:** Supabase is transitioning to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both names work for now; use the new naming in new projects.
- **Standard `UNIQUE` constraint on soft-deleteable tables:** Use partial indexes (`WHERE deleted_at IS NULL`) or unique constraint checks will fire on previously-deleted records.
- **`getSession()` in server contexts:** Reads cookie without server verification. Use `getClaims()` for fast local verification or `getUser()` when session revocation detection is needed.
- **Physical CSS directional utilities (`pl-`, `pr-`, `ml-`, `mr-`):** Use logical Tailwind utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) so RTL flips automatically.
- **RLS SELECT policy + soft delete UPDATE collision:** A SELECT policy that filters `deleted_at IS NULL` can block the UPDATE that sets `deleted_at`. Design RLS policies to allow UPDATE on records being soft-deleted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie management for Supabase sessions | Custom cookie store | `@supabase/ssr` with `getAll`/`setAll` | Token refresh, cookie domain scoping, secure flags — all edge cases |
| Form validation | Custom validation logic | Zod + React Hook Form | Type inference, field-level errors, async validation, nested objects |
| RTL-aware accessible dialogs | Custom modal/dialog | shadcn/ui Dialog (Radix UI) | Focus trap, keyboard navigation, ARIA roles, scroll lock |
| Accessible data tables | Custom `<table>` | TanStack Table + shadcn/ui Table | Sort state, pagination, row selection, column visibility, server-side mode |
| Font loading + CLS prevention | `<link>` to Google Fonts | `next/font/google` | Self-hosted, preloaded, zero layout shift, subset optimization |
| Auth guard / route protection | Custom session check | `proxy.ts` + `lib/dal.ts` pattern | Handles JWT refresh, cookie writing, redirect loops |

**Key insight:** The auth and cookie layer is where subtle bugs cause session loss, infinite redirect loops, and security vulnerabilities. Let `@supabase/ssr` own it entirely.

---

## Common Pitfalls

### Pitfall 1: Synchronous `cookies()` in Next.js 16
**What goes wrong:** `const cookieStore = cookies()` (no await) throws a runtime error in Next.js 16 because synchronous access was removed.
**Why it happens:** All tutorials and the previous Supabase docs show the synchronous pattern, which worked in Next.js 15.
**How to avoid:** Always `const cookieStore = await cookies()` in every server context. The server client factory function must be `async`.
**Warning signs:** TypeScript error "cookies() returns a Promise" at compile time. Runtime error "Cannot read properties of undefined" in production.

### Pitfall 2: `middleware.ts` Instead of `proxy.ts`
**What goes wrong:** Using `middleware.ts` with `export function middleware()` in a Next.js 16 project. Works but triggers deprecation warning; future version will remove it.
**Why it happens:** All online examples still show `middleware.ts`. The rename is only 4 months old (Oct 2025).
**How to avoid:** Create `proxy.ts` at project root with `export async function proxy()`. Edge runtime NOT supported in proxy.ts — use Node.js runtime.
**Warning signs:** Deprecation warning in `next dev` output: "middleware.ts is deprecated, rename to proxy.ts."

### Pitfall 3: getUser() vs getClaims() — Wrong Tool in Proxy
**What goes wrong:** Using `getClaims()` in `proxy.ts` for token refresh. `getClaims()` does NOT refresh expiring tokens. If the session is about to expire, the proxy must call `getUser()` so Supabase can refresh and write new cookies.
**Why it happens:** `getClaims()` is marketed as "the new secure way" but it serves a different purpose — fast verification, not token refresh.
**How to avoid:** In `proxy.ts`: always call `supabase.auth.getUser()` (this refreshes tokens). In Server Components and Server Actions (inside the page/action request): use `getClaims()` via `verifySession()` for fast auth checks.
**Warning signs:** Users are randomly logged out after ~1 hour (JWT expiry, never refreshed).

### Pitfall 4: RLS Infinite Recursion on `user_permissions`
**What goes wrong:** An RLS policy on `user_permissions` that queries `user_permissions` itself creates an infinite loop. Supabase returns "stack depth limit exceeded."
**Why it happens:** Permission systems need to check permissions to decide what to show — including the permissions table itself.
**How to avoid:** Create `get_user_permissions(p_user_id UUID)` as a `SECURITY DEFINER` function. RLS policies call this function instead of querying the table directly.
**Warning signs:** Permission queries return empty arrays for all users; service-role calls work but anon/user calls don't.

### Pitfall 5: Plain UNIQUE Constraint on Soft-Deleted Tables
**What goes wrong:** `UNIQUE(internal_number)` on companies table. Admin soft-deletes company with internal_number "101", then creates a new company "101" — unique constraint fires even though old record is "deleted."
**Why it happens:** Standard UNIQUE constraint covers ALL rows including those with `deleted_at IS NOT NULL`.
**How to avoid:** `CREATE UNIQUE INDEX name ON companies (internal_number) WHERE deleted_at IS NULL;`
**Warning signs:** Error `duplicate key value violates unique constraint` when creating records that were previously soft-deleted.

### Pitfall 6: RTL Physical CSS Properties
**What goes wrong:** Using `pl-4`, `mr-2`, `right-0` in a Hebrew RTL UI. The layout works in LTR dev mode but breaks when `dir="rtl"` is active.
**Why it happens:** Muscle memory from LTR development. Physical utilities don't flip in RTL.
**How to avoid:** Use logical utilities only: `ps-4` (padding-inline-start), `me-2` (margin-inline-end), `end-0`. Set `dir="rtl"` on `<html>` from the first commit and develop in RTL mode from Day 1.
**Warning signs:** Sidebar on wrong side; icons misaligned; dropdown opens off-screen.

### Pitfall 7: Service Role Key Exposed to Browser
**What goes wrong:** `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` is set — exposing the key that bypasses all RLS to any browser.
**Why it happens:** Developer uses service role to "fix" RLS issues during development, accidentally names it with `NEXT_PUBLIC_` prefix.
**How to avoid:** Service role key: ONLY in Server Actions and Route Handlers, variable name `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix). Add a CI grep check.
**Warning signs:** Any env var starting with `NEXT_PUBLIC_` containing "SERVICE_ROLE" in the codebase.

### Pitfall 8: Heebo Font Missing Hebrew Subset
**What goes wrong:** Heebo loads with only the Latin subset. Hebrew characters fall back to system font and look visually inconsistent.
**Why it happens:** Next.js `next/font/google` defaults to Latin only.
**How to avoid:** Always specify `subsets: ['hebrew', 'latin']` in the Heebo font config.
**Warning signs:** Hebrew text renders in a different font size or weight on first load; Lighthouse CLS score above 0.1.

### Pitfall 9: RLS SELECT Policy Blocks Soft Delete UPDATE
**What goes wrong:** RLS SELECT policy `USING (deleted_at IS NULL)` combined with an UPDATE that sets `deleted_at` — the SELECT policy re-checks after the UPDATE and finds the row is "gone," returning 0 rows even though the update succeeded.
**Why it happens:** PostgreSQL evaluates WITH CHECK and USING after the mutation, not just before.
**How to avoid:** Write RLS UPDATE policy to explicitly allow updates that set `deleted_at`. Or: use service role for soft-delete operations and do auth/permission checks in the Server Action (not in RLS).
**Warning signs:** Soft delete appears to succeed (no error) but returns 0 affected rows.

### Pitfall 10: Tailwind v4 — Wrong PostCSS Plugin
**What goes wrong:** Using `tailwindcss` directly as a PostCSS plugin instead of `@tailwindcss/postcss`. In v4, the PostCSS integration moved to a separate package. RTL utilities appear "broken" because no classes are generated at all.
**Why it happens:** Old `postcss.config.js` patterns show `plugins: ['tailwindcss']`. Tailwind v4 changed this.
**How to avoid:** `create-next-app` scaffolds the correct config automatically. If manually configuring: use `@tailwindcss/postcss` in `postcss.config.mjs`.
**Warning signs:** No Tailwind utility classes applied; no RTL modifiers working; empty CSS output.

---

## Code Examples

### Heebo Font + RTL Root Layout
```typescript
// Source: nextjs.org/docs/app/getting-started/fonts (official)
// app/layout.tsx
import { Heebo } from 'next/font/google'
import './globals.css'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],  // hebrew subset is REQUIRED
  display: 'swap',
  variable: '--font-heebo',
  weight: ['300', '400', '500', '600', '700', '800'],
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-[var(--font-heebo)]">
        {children}
      </body>
    </html>
  )
}
```

### Tailwind v4 CSS Config with Brand Theme
```css
/* Source: Tailwind v4 blog + shadcn/ui Tailwind v4 docs */
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";  /* shadcn/ui v4 uses this, NOT tailwindcss-animate */

@theme inline {
  /* Brand colors — Chemo Aharon */
  --color-brand-primary: oklch(35% 0.12 250);   /* Dark navy */
  --color-brand-accent: oklch(62% 0.18 30);     /* Orange accent */
  --color-sidebar-bg: oklch(18% 0.05 250);      /* Dark sidebar */
  --color-sidebar-text: oklch(90% 0 0);         /* Light sidebar text */

  /* Font */
  --font-sans: var(--font-heebo);
}

:root {
  --background: oklch(100% 0 0);
  --foreground: oklch(20% 0.05 250);
}

.dark {
  --background: oklch(18% 0.05 250);
  --foreground: oklch(95% 0 0);
}
```

### RTL-Safe Tailwind Utility Usage
```typescript
// Source: tailwindcss.com/docs/padding (logical properties docs)
// Use logical utilities — these flip automatically with dir="rtl"

// CORRECT — logical
<div className="ps-4 pe-2">         {/* padding-inline-start, padding-inline-end */}
<div className="ms-2 me-4">         {/* margin-inline-start, margin-inline-end */}
<div className="start-0 end-0">     {/* inset-inline-start, inset-inline-end */}

// WRONG — physical (do not use in this project)
<div className="pl-4 pr-2">         {/* These do NOT flip in RTL */}
<div className="ml-2 mr-4">
<div className="left-0 right-0">
```

### Audit Log Table Schema
```sql
-- Source: project ARCHITECTURE.md (standard PostgreSQL pattern)
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
  entity_type TEXT NOT NULL,   -- 'companies', 'departments', 'role_tags', etc.
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  user_agent  TEXT
);

-- No soft delete on audit_log — it is the immutable record
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Indexes for common queries
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_log_date ON audit_log(created_at DESC);
```

### Companies Table Schema
```sql
-- Source: project ARCHITECTURE.md + universal columns pattern
CREATE TABLE companies (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  internal_number  TEXT NOT NULL,
  company_reg_number TEXT,             -- ח.פ.
  contact_name     TEXT,
  contact_email    TEXT,
  notes            TEXT,
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Partial unique index — only enforces uniqueness among non-deleted records
CREATE UNIQUE INDEX companies_internal_number_active
  ON companies (internal_number)
  WHERE deleted_at IS NULL;

-- updated_at trigger
CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Departments Table Schema (Hierarchical)
```sql
CREATE TABLE departments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  dept_number      TEXT NOT NULL,
  company_id       UUID REFERENCES companies(id) NOT NULL,
  parent_dept_id   UUID REFERENCES departments(id),  -- NULL = top-level
  notes            TEXT,
  -- Universal columns
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Unique department number per company, active records only
CREATE UNIQUE INDEX departments_number_company_active
  ON departments (dept_number, company_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Soft Delete Query Pattern
```typescript
// Source: project ARCHITECTURE.md
// Every query MUST filter deleted_at — no exceptions
const supabase = await createClient()

// Fetch active records
const { data } = await supabase
  .from('companies')
  .select('*')
  .is('deleted_at', null)        // MUST be on every query
  .order('created_at', { ascending: false })

// Soft delete
await supabase
  .from('companies')
  .update({
    deleted_at: new Date().toISOString(),
    updated_by: session.userId
  })
  .eq('id', companyId)
  .is('deleted_at', null)        // Safety: only delete non-deleted records
```

### Login Page and Server Action Pattern
```typescript
// app/(auth)/login/page.tsx — Client Component for form interactivity
'use client'
import { useActionState } from 'react'
import { login } from '@/actions/auth'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Chemo Aharon Logo */}
        <div className="text-center">
          <img src="/chemo-logo-he.png" alt="חמו אהרון" className="mx-auto h-24" />
        </div>
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              כתובת מייל
            </label>
            <input id="email" name="email" type="email" required className="w-full border rounded-md px-3 py-2" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              סיסמה
            </label>
            <input id="password" name="password" type="password" required className="w-full border rounded-md px-3 py-2" />
          </div>
          {state?.error && (
            <p className="text-red-600 text-sm">{state.error}</p>
          )}
          <button type="submit" disabled={pending} className="w-full bg-brand-primary text-white py-2 rounded-md">
            {pending ? 'מתחבר...' : 'התחברות'}
          </button>
        </form>
      </div>
    </div>
  )
}

// actions/auth.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(prevState: unknown, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: 'מייל או סיסמה שגויים' }
  }

  redirect('/admin/companies')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` + `export function middleware()` | `proxy.ts` + `export async function proxy()` | Next.js 16 (Oct 2025) | Must rename file and function — old file still works but deprecated |
| `cookies()` synchronous | `await cookies()` | Next.js 16 (Oct 2025) | Breaking change — sync access fully removed, throws runtime error |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 (already in project decisions) | `createServerComponentClient` etc. removed |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 2025 (transitional) | Both work currently; new projects should use `PUBLISHABLE_KEY` naming |
| `supabase.auth.getUser()` for all server checks | `getClaims()` for fast checks, `getUser()` for token refresh | Supabase 2025 | `getClaims()` is local JWT verification (no round-trip); `getUser()` still required in proxy.ts for session refresh |
| `tailwindcss` PostCSS plugin | `@tailwindcss/postcss` | Tailwind v4 (Apr 2025) | Auto-handled by `create-next-app`; breaks if using old config |
| `tailwindcss-animate` | `tw-animate-css` | shadcn/ui Tailwind v4 update | Used in `globals.css` import; old plugin removed from new shadcn/ui projects |
| `tailwind.config.js` for theming | `@theme` directive in `globals.css` | Tailwind v4 | CSS-based config; no config file needed |
| `forwardRef` in shadcn/ui components | `data-slot` attributes | shadcn/ui Tailwind v4 update | Components updated for React 19; no action needed unless customizing |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Fully deprecated — do not install
- `createClientComponentClient`, `createServerComponentClient`: These function names do not exist in `@supabase/ssr` — only in the deprecated helpers
- `supabase.auth.getSession()` in server contexts: Reads cookie without server verification — use `getClaims()` or `getUser()` instead
- `tailwindcss-animate`: Replaced by `tw-animate-css` in new shadcn/ui Tailwind v4 projects
- Physical Tailwind utilities in RTL contexts: `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`

---

## Open Questions

1. **`PUBLISHABLE_KEY` vs `ANON_KEY` — which to use?**
   - What we know: Supabase is transitioning to new key naming (`sb_publishable_...` format). Both names work. The official docs now show `PUBLISHABLE_KEY`. The transition is "opt-in, no action required until at least 1 Nov 2025" — meaning by March 2026, the old anon key should still work.
   - What's unclear: Whether new Supabase projects created today still generate the old `anon` key format or the new `publishable` key format.
   - Recommendation: Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as the env var name in code. At project setup, check the Supabase dashboard for the key format and name accordingly. Add an env var alias if the Supabase project was created with the old format.

2. **Chemo Aharon logo path for login page**
   - What we know: Logo files are in the git repo root (`CA.png`, `Heb-ChemoIT.png`, `Chemo_Aharon_Logo.png`).
   - What's unclear: Which logo to use for the login page (the requirement says "לוגו חמו אהרון המלא בעברית" — the full Hebrew logo).
   - Recommendation: Copy `Heb-ChemoIT.png` to `src/public/logo-he.png` during Plan 01-01 scaffold. Use `next/image` with `priority` for the login page.

3. **RLS policy design for Phase 1 tables**
   - What we know: RLS must be enabled on all tables. For this admin-only system, the pattern is: authenticated users can read all active records; mutations are controlled by Server Actions (not RLS).
   - What's unclear: Whether to enforce write-level RLS (e.g., only service role can write) or use more permissive RLS (authenticated user can write) with Server Actions enforcing business rules.
   - Recommendation: Phase 1 approach — enable RLS with a permissive policy for authenticated users (`USING (auth.uid() IS NOT NULL)`) for reads; use service role key in Server Actions for writes that need to bypass row-level checks (soft delete). This keeps complexity low for Phase 1 and can be tightened in later phases.

---

## Sources

### Primary (HIGH confidence)
- https://nextjs.org/blog/next-16 — Next.js 16 stable release (Oct 21, 2025): proxy.ts, Turbopack default, React 19.2, async params/cookies
- https://nextjs.org/docs/app/guides/upgrading/version-16 — Version 16 upgrade guide (docs updated 2026-02-27): complete breaking changes list, async cookies requirement
- https://supabase.com/docs/guides/auth/server-side/creating-a-client — `@supabase/ssr` server client creation with `await cookies()`, `getAll`/`setAll` pattern
- https://supabase.com/docs/guides/auth/server-side/nextjs — Supabase Next.js SSR setup guide
- https://supabase.com/docs/guides/getting-started/ai-prompts/nextjs-supabase-auth — Full Supabase + Next.js 16 auth scaffold prompt (shows `proxy.ts` + `await cookies()` + `PUBLISHABLE_KEY`)
- https://nextjs.org/docs/app/guides/authentication — Next.js official DAL pattern, verifySession, Server Action validation with Zod
- https://tailwindcss.com/blog/tailwindcss-v4 — Tailwind v4 stable release, CSS-based config, `@theme` directive
- https://ui.shadcn.com/docs/tailwind-v4 — shadcn/ui Tailwind v4 changes: `tw-animate-css`, `data-slot`, OKLCH colors

### Secondary (MEDIUM confidence)
- https://supabase.com/docs/reference/javascript/auth-getclaims — `getClaims()` vs `getUser()` distinction: local JWT verification vs server round-trip
- https://www.npmjs.com/package/@supabase/ssr — Package version 0.8.0 (confirmed current stable, published ~3 months ago)
- Community discussion: `getClaims()` does not refresh tokens; `getUser()` required in proxy.ts for token refresh
- https://oneuptime.com/blog/post/2026-01-21-postgresql-soft-deletes/view — Partial indexes + RLS for soft delete (confirmed partial index approach)

### Tertiary (LOW confidence — verify at implementation)
- Supabase publishable key transition timeline — "opt-in until Nov 2025" but exact current state of new projects unclear
- shadcn/ui RTL-specific component behavior — test each component in `dir="rtl"` context; physical properties may need manual override
- RLS + soft delete UPDATE policy collision — verify during DB schema implementation that UPDATE policies don't block soft-delete operations

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Next.js 16, @supabase/ssr 0.8.0, Tailwind v4.1 all verified against official release notes and docs
- Architecture patterns: HIGH — DAL pattern, proxy.ts, Server Action pattern from official Next.js docs
- DB schema: HIGH — Standard PostgreSQL patterns (partial indexes, triggers, RLS) are stable
- RTL approach: HIGH — Tailwind logical properties documented; `dir="rtl"` on `<html>` is established
- Pitfalls: HIGH — Most are well-documented breaking changes from official sources; one (RLS/soft-delete UPDATE collision) is MEDIUM

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (30 days — stack is currently stable; @supabase/ssr is the fast-moving part, verify version at install time)
