# Technology Stack

**Project:** ChemoSys — Internal Management System (Chemo Aharon Ltd.)
**Researched:** 2026-03-01
**Confidence:** HIGH for core decisions (verified against official docs); MEDIUM for ecosystem libraries (verified against multiple sources); LOW noted explicitly where applicable

---

## Summary

This is the definitive stack for building ChemoSys Phase 1 (admin panel). Technology constraints are fixed: Next.js + Supabase + Vercel. Research focused on **what to put on top of those constraints** — specifically for RTL Hebrew UI, data tables, Excel import/export, permissions, and audit logging.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.2 | Full-stack React framework (App Router) | Confirmed stable as of 2026-02-26. App Router is now the default and recommended path. Turbopack is default dev bundler. React 19 built in. |
| React | 19.x | UI rendering | Ships with Next.js 15. Server Components + Server Actions remove the need for a state management library for data fetching. `useActionState` replaces `useFormState`. |
| TypeScript | 5.x (min 5.1) | Type safety | Required by Next.js. Catches FK mismatches, permission matrix errors at compile time — critical for complex HR data models. |
| Node.js | 20.9+ | Runtime | Next.js 15 minimum requirement. |

**Confidence:** HIGH — verified against official Next.js 15.2 release notes (published 2026-02-26) and installation docs.

### Database and Backend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase (PostgreSQL) | v2 | Primary database | Already decided. Provides PostgreSQL + Row Level Security + built-in Auth. |
| @supabase/supabase-js | ^2.x | Supabase JS client | The main client library. Direct DB access from Server Components without REST round-trips. |
| @supabase/ssr | ^0.x | SSR-aware Supabase client | Required for Next.js App Router — replaces the old `@supabase/auth-helpers-nextjs`. Handles cookie-based session management across middleware, Server Components, and Route Handlers. |
| Supabase Auth | Built-in | Authentication | Email + password. Session cookies managed by `@supabase/ssr`. No additional auth library needed. |

**Confidence:** HIGH for package names and approach. MEDIUM for exact minor versions — verify `@supabase/ssr` current version at install time (`npm info @supabase/ssr version`). The `@supabase/ssr` package is the officially recommended replacement for the deprecated auth-helpers package.

**Key constraint:** The Supabase client used in Server Components and middleware MUST be created via `@supabase/ssr` helpers — `createServerClient` for server components/actions/route handlers, `createBrowserClient` for client components. Using a single shared client causes auth state corruption in Next.js App Router.

### UI and Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.1 | Utility-first CSS | v4.1 released 2025-04-03 and is current stable. Built-in `rtl:` / `ltr:` modifiers work via CSS `:dir()` pseudo-class — set `dir="rtl"` on `<html>` and Tailwind RTL utilities activate automatically. No config file needed in v4 (CSS-based configuration). |
| shadcn/ui | latest (post-v4 compatible) | Component library | Not a package — a CLI tool that copies component source into the project. Components are yours to modify. This is the correct choice for RTL because you control the source and can add `rtl:` classes as needed. Built on Radix UI primitives (accessible) + Tailwind. |
| Radix UI | Latest (via shadcn/ui) | Headless accessible primitives | Included through shadcn/ui. Provides Dialog, DropdownMenu, Tabs, Toast, Tooltip, Select, etc. with full keyboard navigation and ARIA compliance out of the box. |
| Lucide React | ^0.x | Icons | Included by shadcn/ui. 1,400+ clean SVG icons. Consistent visual language throughout the admin panel. |
| next/font | Built-in | Font loading | Self-hosts Google Fonts. Zero layout shift. Load Heebo (Hebrew) with `subsets: ['hebrew', 'latin']` and Inter with `subsets: ['latin']`. |
| Heebo | Via next/font/google | Hebrew UI font | Official Google Fonts variable font with Hebrew subset. Designed for Hebrew-primary interfaces. Modern, clean, legible at small sizes. |
| Inter | Via next/font/google | Latin/English UI font | Standard for data-heavy admin UIs. Excellent number rendering (important for employee IDs, project numbers). |

**Confidence:** HIGH for Tailwind v4 status (verified via official blog). HIGH for shadcn/ui approach (verified via multiple sources). MEDIUM for Heebo subset availability — `next/font/google` supports `hebrew` subset; verify at install time. LOW confidence that shadcn/ui has shipped a fully RTL-ready configuration — you MUST add `rtl:` Tailwind modifiers to shadcn components that use directional margin/padding/border (specifically: sidebar, nav items, form layouts, table columns with text alignment).

**RTL Implementation approach:** Set `<html lang="he" dir="rtl">` in the root layout. Tailwind's `rtl:` variants will activate. shadcn/ui base components (Dialog, Table, Button) are direction-neutral by default. Custom layouts (sidebar, nav, card headers) require explicit `rtl:` overrides on directional utilities.

### Data Tables

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TanStack Table | ^8.x | Data table engine | Headless table library — handles sorting, filtering, pagination, row selection, and column visibility client-side WITHOUT prescribing any CSS. Composable with shadcn/ui's `<Table>` component. The de facto standard for React admin tables in 2025/2026. |

**Confidence:** MEDIUM — verified via Next.js official docs mentioning it as a community option and ecosystem dominance. TanStack Table v8 has been stable for 2+ years. No version change expected that breaks this recommendation.

**Why not AG Grid or MUI DataGrid:** AG Grid Community is powerful but GPL-licensed and adds 200KB+. MUI DataGrid requires MUI ecosystem (conflicts with Tailwind+shadcn). TanStack Table is MIT, zero-dependency rendering, composable with existing stack.

**Server-side vs client-side pagination:** For the employee table (potentially thousands of rows), use server-side pagination via Supabase `.range(from, to)`. TanStack Table supports `manualPagination`, `manualSorting`, `manualFiltering` for this. Do NOT load all employees into the browser.

### Forms and Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Hook Form | ^7.x | Client-side form state | Required for complex forms (employee profile has 25+ fields). Manages field registration, dirty state, error display, and form reset without re-rendering on every keystroke. Compatible with Server Actions — use `handleSubmit` to call a Server Action. |
| Zod | ^3.x | Schema validation | Official recommendation in Next.js docs for Server Action validation. Validates form data on the server before any DB write. Schemas double as TypeScript types (`z.infer<typeof schema>`). |
| @hookform/resolvers | ^3.x | RHF + Zod bridge | Connects Zod schema to React Hook Form. One package, no manual transformation. |

**Confidence:** HIGH for RHF + Zod combination — explicitly recommended in Next.js 15 official authentication documentation (verified). Zod is referenced directly in Next.js Server Action examples.

**Note on Zod v4:** As of knowledge cutoff (August 2025), Zod v4 was in beta. Verify current stable version at install time. Use `^3.x` until v4 is confirmed stable and hookform resolvers are updated.

**Form strategy for Server Actions:** Use React Hook Form for client-side UX (instant validation, field dirty tracking), then on submit call the Server Action. Do NOT use `useActionState` alone for complex forms — it lacks field-level dirty state and validation UX. RHF + Server Actions is the right combination for ChemoSys's 25-field employee form.

### Excel Import and Export

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ExcelJS | ^4.x | Excel read/write | Server-side only (in Route Handlers or Server Actions). Supports .xlsx parsing, writing with Hebrew column headers, and RTL sheet direction (`worksheet.views = [{rightToLeft: true}]`). Supports cell formatting, date parsing, and streaming for large files. |

**Confidence:** MEDIUM — ExcelJS is well-established (20M+ weekly downloads historically). Hebrew/RTL support is documented in the library. However, the specific `rightToLeft` worksheet property needs to be verified against current ExcelJS v4 docs at implementation time.

**Why not SheetJS (xlsx package):** SheetJS CE is MIT-licensed and widely used, but ExcelJS provides better Hebrew text handling, richer API for column width/header styling, and native RTL worksheet support — all relevant for payroll import/export. SheetJS Pro is commercial.

**Excel import flow (Server Action):**
1. Upload file via multipart form → Route Handler → parse with ExcelJS
2. Validate each row against Zod schema
3. Match composite key (employee_number + company_id) against DB
4. Return preview payload with diff (new / updated / error rows)
5. Admin confirms → second Server Action commits to DB
6. Write to audit_log for every changed row

**Encoding note:** Hebrew Windows-1255 (ISO-8859-8) encoded files from legacy payroll systems must be converted. ExcelJS handles .xlsx (which is XML/UTF-8 internally). If payroll exports .csv in Windows-1255, use the `iconv-lite` package to transcode before parsing.

**Supporting package:**

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| iconv-lite | ^0.6.x | Character encoding conversion | Only needed if payroll system exports legacy-encoded CSV (Windows-1255 / ISO-8859-8). Not needed for .xlsx files. |

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React built-ins | React 19 | Server state, form state | Server Components + Server Actions eliminate the need for Redux, Zustand, or React Query for server data. Use `useState`/`useReducer` for local UI state only. |
| Zustand | ^4.x | Global client UI state (if needed) | Lightweight (8KB) store for cross-component UI state — e.g., sidebar open/close, active tab, toast queue. Only introduce if prop drilling becomes a problem. |

**Confidence:** HIGH for the no-external-state-manager recommendation. The Next.js 15 data fetching docs explicitly show React Query and SWR as community alternatives, but for admin panels where data is fetched in Server Components, they add unnecessary complexity.

**Do NOT use React Query / TanStack Query:** For this project, all admin data is fetched in Server Components on the server. React Query is a client-side cache that creates complexity when mixed with Server Components. The exception: if real-time updates are needed in a future phase, consider SWR for optimistic mutations on the client.

### Audit Logging

No dedicated library. Implement as a PostgreSQL-native pattern:

- Dedicated `audit_log` table: `id`, `entity_type`, `entity_id`, `action` (CREATE/UPDATE/DELETE), `actor_user_id`, `old_value` (jsonb), `new_value` (jsonb), `created_at`
- Write from Server Actions: every mutation function calls `insertAuditRecord()` before returning
- Read with Server Component: audit log viewer is a server-side paginated table
- Do NOT use triggers: PostgreSQL triggers make the actor invisible (no current user context in RLS trigger context without extra setup). Write audit records explicitly from application code — you always have the actor's user ID from the Supabase session.

**Confidence:** HIGH — this is the standard pattern for Supabase-based audit logging documented in community resources.

### Permissions System

No external RBAC library. Implement as a data model + utility layer:

- `modules` table: list of modules and sub-modules (seeded at deploy time)
- `role_templates` table: named permission sets
- `template_permissions` junction: template × module × permission_level (0=none, 1=read, 2=write)
- `user_permissions` junction: user × module × permission_level (overrides template)
- Resolution function (TypeScript): `resolveUserPermissions(userId)` — fetches template + overrides, merges, returns permission map
- Cache result in server-side session or per-request cache (`React.cache()`)
- Gate every Server Action: check resolved permissions before any mutation

**Confidence:** HIGH — this pattern is well established for custom permission systems. Supabase RLS can additionally enforce permissions at the database layer for defense in depth (recommended for a later phase).

### Maps (Tab 7: Projects)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-leaflet | ^4.x | Map display for project coordinates | MIT licensed, no API key required for base tiles (use OpenStreetMap). Lightweight. Sufficient for "view on map" button on project records. |
| leaflet | ^1.9.x | Underlying map engine | Required peer dependency of react-leaflet. |

**Confidence:** MEDIUM — react-leaflet is the standard React Leaflet wrapper. Known SSR issue with Leaflet (requires `dynamic()` import with `ssr: false` in Next.js). This is a well-documented workaround; implement at Phase 4.

**Alternative if API key is acceptable:** Google Maps React (`@vis.gl/react-google-maps`) offers better satellite imagery for infrastructure site locations. Costs money per map load. Decide at Phase 4 based on actual user need.

### Hosting and DevOps

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | — | Frontend hosting + CI/CD | Already decided. Auto-deploy from GitHub. Edge network for Vercel Functions. Native Next.js support. |
| GitHub | — | Source control + deploy trigger | Connect repo to Vercel for automatic preview deployments on PRs. |
| Supabase (hosted) | — | Database + Auth hosting | Already decided. Supabase cloud on AWS. |
| Vercel Environment Variables | — | Secrets management | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only). Never expose service role key to the browser. |

**Confidence:** HIGH — all hosting decisions are pre-decided constraints.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| UI Component Library | shadcn/ui | Ant Design, MUI | Ant Design and MUI ship their own CSS engines, conflict with Tailwind. Ant Design has RTL support but you lose Tailwind customization. shadcn/ui gives full control over component source — essential for RTL tuning. |
| UI Component Library | shadcn/ui | Mantine | Mantine is excellent and has RTL support, but adds its own CSS-in-JS layer. Tailwind v4 + shadcn/ui is the 2025/2026 standard for Next.js admin panels. |
| Excel Library | ExcelJS | SheetJS (xlsx) | SheetJS CE lacks rich RTL sheet configuration API. SheetJS Pro is paid. ExcelJS is MIT and covers the RTL worksheet need. |
| State Management | React built-ins + Zustand | Redux, Jotai, React Query | Redux is overkill for an admin panel. Jotai is fine but Zustand has better DevX. React Query duplicates what Server Components already do. |
| Form Library | React Hook Form + Zod | Formik | Formik is older, less performant, and lacks first-class TypeScript schema integration. RHF is the industry standard in 2025/2026. |
| Auth | Supabase Auth | NextAuth.js (Auth.js) | Supabase Auth is already in the stack. NextAuth adds unnecessary complexity and another session store. |
| Tables | TanStack Table | AG Grid, MUI DataGrid | AG Grid CE is GPL. MUI DataGrid requires MUI styling system. TanStack Table is MIT and headless. |
| Maps | react-leaflet | Google Maps, Mapbox | react-leaflet is zero-cost and MIT. Google Maps costs money per load. Mapbox requires API key. For "view on map" feature, OpenStreetMap is sufficient. |
| CSS | Tailwind v4 | Tailwind v3 | Next.js 15 create-next-app scaffolds Tailwind v4 by default. RTL support is identical in both; v4 removes config file complexity. Use v4. |

---

## Installation

### 1. Scaffold Project

```bash
npx create-next-app@latest chemosys \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

This installs: Next.js 15.x, React 19, TypeScript, Tailwind CSS 4.x, ESLint.

### 2. Core Dependencies

```bash
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  zod \
  react-hook-form \
  @hookform/resolvers \
  exceljs \
  lucide-react \
  zustand
```

### 3. shadcn/ui Initialization

```bash
npx shadcn@latest init
```

Then add components as needed:

```bash
npx shadcn@latest add button input label table tabs dialog dropdown-menu select badge toast card skeleton separator form
```

### 4. TanStack Table

```bash
npm install @tanstack/react-table
```

### 5. Maps (Phase 4 only — do not install now)

```bash
npm install react-leaflet leaflet
npm install -D @types/leaflet
```

### 6. Dev Dependencies

```bash
npm install -D @types/node @types/react @types/react-dom
```

---

## Environment Variables

```bash
# .env.local (never commit this file)
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...     # safe for browser
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # server-side only — never expose to browser
```

---

## RTL Configuration Reference

### Root Layout (`app/layout.tsx`)

```tsx
import { Heebo, Inter } from 'next/font/google'

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${inter.variable}`}>
      <body className="font-[var(--font-heebo)]">{children}</body>
    </html>
  )
}
```

### Tailwind RTL Utility Pattern

```tsx
// Sidebar: RTL = right side, LTR = left side
<aside className="ltr:left-0 rtl:right-0 fixed top-0 h-full w-64">

// Navigation item icon + label spacing
<span className="ltr:mr-3 rtl:ml-3">{icon}</span>

// Table text alignment: numbers stay LTR inside RTL layout
<td className="text-start tabular-nums">1234</td>
```

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| Next.js 15.2 stable | https://nextjs.org/blog/next-15-2 (verified 2026-03-01) | HIGH |
| Next.js 15 minimum Node.js 20.9 | https://nextjs.org/docs/app/getting-started/installation (verified) | HIGH |
| Zod recommended for Server Action validation | https://nextjs.org/docs/app/guides/authentication (official example) | HIGH |
| Tailwind CSS v4.1 stable release (2025-04-03) | https://tailwindcss.com/blog (verified 2026-03-01) | HIGH |
| Tailwind RTL modifiers (rtl:/ltr:) | https://tailwindcss.com/docs/hover-focus-and-other-states (verified) | HIGH |
| next/font supports hebrew subset | https://nextjs.org/docs/app/getting-started/fonts (verified) | HIGH |
| @supabase/ssr replaces auth-helpers | Supabase official migration guide; confirmed as current recommendation | MEDIUM |
| ExcelJS RTL worksheet support | ExcelJS GitHub docs (training knowledge, not re-verified) | MEDIUM |
| TanStack Table v8 compatibility | Next.js docs lists React Query/community options; ecosystem position verified | MEDIUM |
| react-leaflet SSR workaround needed | Community-documented limitation (Next.js dynamic import ssr:false) | MEDIUM |
