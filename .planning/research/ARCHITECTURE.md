# Architecture Patterns

**Project:** ChemoSys — מערכת ניהול פנימית לחמו אהרון
**Domain:** Internal Admin Panel — Next.js App Router + Supabase
**Researched:** 2026-03-01
**Next.js Version Verified:** 16.1.6 (docs last updated 2026-02-27)

---

## Critical Version Note

Next.js v16 renamed `middleware.ts` to `proxy.ts`. The `middleware` export function is now called `proxy`. A codemod exists to migrate. All route protection in this project uses `proxy.ts`.

Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy (HIGH confidence — official docs)

---

## Recommended Architecture

### System Overview

```
Browser
  |
  | HTTPS
  v
Vercel (Edge)
  |-- proxy.ts  (auth guard: cookie check → redirect to /login)
  |
  v
Next.js App Router (Node.js Runtime on Vercel)
  |-- (auth) route group     → /login page, no sidebar layout
  |-- (admin) route group    → /admin/* pages, sidebar layout
      |-- Server Components  → fetch data from Supabase directly
      |-- Client Components  → UI interactions, forms, tabs
      |-- Server Actions     → mutations (create/update/soft-delete)
      |-- Route Handlers     → API endpoints (Excel import/export, config.ini)
  |
  v
lib/dal.ts (Data Access Layer)
  |-- verifySession()        → validates Supabase JWT, loads user permissions
  |-- getPermissions(userId) → loads module permission matrix from DB
  |
  v
Supabase (PostgreSQL on AWS)
  |-- Auth (JWT via @supabase/ssr)
  |-- Tables: companies, departments, employees, users, projects ...
  |-- RLS: enabled but permissive (app-level permission enforcement)
  |-- Triggers: updated_at auto-update, audit_log auto-insert
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `proxy.ts` | Optimistic auth check via cookie. Redirect unauthenticated users to /login. No DB calls. | Next.js router, cookie store |
| `lib/dal.ts` | Authoritative auth + permission check. Used by Server Components and Server Actions. | Supabase (via server client), React cache |
| `lib/supabase/server.ts` | Creates Supabase server client (reads cookies, refreshes session). Used in RSC and Server Actions. | Supabase Auth API |
| `lib/supabase/browser.ts` | Creates Supabase browser client. Used only in Client Components needing real-time. | Supabase Auth API |
| `lib/permissions.ts` | Loads and evaluates module permission matrix for a user. Called via DAL. | Supabase DB (user_permissions table) |
| `lib/audit.ts` | Server-side audit log writer. Called from every Server Action that mutates data. | Supabase DB (audit_log table) |
| `app/(admin)/layout.tsx` | Admin shell: sidebar, header, RTL wrapper. Receives user context. | DAL (getUser), sidebar nav |
| `app/(admin)/admin/[tab]/page.tsx` | Per-tab Server Component pages (companies, employees, etc.). | DAL, Server Actions |
| `components/admin/` | Tab-specific UI components. Mix of Server and Client. | Server Actions, hooks |
| `components/shared/` | Reusable UI: DataTable, Modal, Confirm, Toast, Form fields. | No DB contact |
| `app/api/` | Route Handlers: Excel import/export, config.ini read/write. | Supabase, filesystem (cPanel FTP) |

---

## Folder Structure

```
src/
├── app/
│   ├── (auth)/                        # Route group — no sidebar layout
│   │   ├── layout.tsx                 # Auth layout: centered, logo
│   │   └── login/
│   │       └── page.tsx               # Login form (Server Component + Server Action)
│   │
│   ├── (admin)/                       # Route group — sidebar layout
│   │   ├── layout.tsx                 # Admin shell: sidebar + RTL wrapper
│   │   └── admin/
│   │       ├── page.tsx               # Redirect → /admin/dashboard
│   │       ├── dashboard/
│   │       │   └── page.tsx           # Tab 0: Dashboard (Server Component)
│   │       ├── companies/
│   │       │   └── page.tsx           # Tab 1: Companies CRUD
│   │       ├── departments/
│   │       │   └── page.tsx           # Tab 2: Departments hierarchy
│   │       ├── role-tags/
│   │       │   └── page.tsx           # Tab 3: Role tags
│   │       ├── employees/
│   │       │   └── page.tsx           # Tab 4: Employees CRUD + Excel
│   │       ├── users/
│   │       │   └── page.tsx           # Tab 5: Users + permission matrix
│   │       ├── permission-templates/
│   │       │   └── page.tsx           # Tab 6: Permission templates
│   │       ├── projects/
│   │       │   └── page.tsx           # Tab 7: Projects CRUD
│   │       ├── settings/
│   │       │   └── page.tsx           # Tab 8: System settings + config.ini
│   │       └── audit-log/
│   │           └── page.tsx           # Audit log viewer
│   │
│   ├── api/
│   │   ├── employees/
│   │   │   ├── import/route.ts        # POST: Excel import
│   │   │   └── export/route.ts        # GET: Excel export
│   │   └── settings/
│   │       └── config/route.ts        # GET/POST: config.ini read/write
│   │
│   ├── layout.tsx                     # Root layout (html, body, fonts, RTL dir)
│   ├── globals.css
│   └── not-found.tsx
│
├── components/
│   ├── admin/                         # Module-specific components
│   │   ├── employees/
│   │   │   ├── EmployeeTable.tsx      # Client: sortable/filterable table
│   │   │   ├── EmployeeForm.tsx       # Client: create/edit form
│   │   │   └── EmployeeImport.tsx     # Client: Excel upload UI
│   │   ├── users/
│   │   │   ├── UserTable.tsx
│   │   │   ├── UserForm.tsx
│   │   │   └── PermissionMatrix.tsx   # Client: permission grid (module × level)
│   │   ├── permission-templates/
│   │   │   └── TemplateForm.tsx
│   │   └── [other-modules]/
│   │
│   └── shared/                        # Reusable UI (no business logic)
│       ├── DataTable.tsx              # Generic sortable table with soft-delete toggle
│       ├── Modal.tsx                  # Generic confirm/edit modal
│       ├── Toast.tsx                  # Notification system
│       ├── Sidebar.tsx                # Admin sidebar (module list + active state)
│       ├── TabNav.tsx                 # Tab navigation component
│       ├── SoftDeleteBadge.tsx        # Active/deleted status indicator
│       └── RTLProvider.tsx            # RTL + i18n context provider
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts                  # createServerClient() — for RSC + Server Actions
│   │   └── browser.ts                 # createBrowserClient() — for Client Components
│   ├── dal.ts                         # Data Access Layer: verifySession, getUser, getPermissions
│   ├── permissions.ts                 # Permission evaluation: hasAccess(userId, module, level)
│   ├── audit.ts                       # writeAuditLog(action, entity, oldVal, newVal)
│   ├── excel.ts                       # Excel import/export utilities (ExcelJS)
│   └── utils.ts                       # Shared utilities (formatDate, softDeleteFilter, etc.)
│
├── actions/                           # Server Actions (mutations)
│   ├── auth.ts                        # login, logout
│   ├── companies.ts                   # createCompany, updateCompany, softDeleteCompany
│   ├── departments.ts
│   ├── employees.ts                   # CRUD + Excel import logic
│   ├── users.ts                       # createUser, updatePermissions, applyTemplate
│   ├── projects.ts
│   └── settings.ts
│
├── types/
│   ├── database.ts                    # Supabase generated types (from supabase gen types)
│   ├── permissions.ts                 # PermissionLevel, ModulePermission, PermissionMatrix
│   └── entities.ts                    # Employee, Company, Project, etc. (DTOs)
│
└── proxy.ts                           # Auth guard (formerly middleware.ts in Next.js <16)
```

---

## Data Flow

### Authentication Flow

```
User visits /admin/*
  → proxy.ts runs (Edge, no DB)
      → reads 'sb-auth-token' cookie
      → if no valid JWT → redirect /login
      → if valid → NextResponse.next()
  → RSC page.tsx renders
      → calls verifySession() from lib/dal.ts
          → createServerClient() reads cookie
          → supabase.auth.getUser() validates JWT with Supabase
          → if invalid → redirect('/login')
          → returns { userId, email }
      → calls getPermissions(userId)
          → queries user_permissions table
          → returns PermissionMatrix
      → passes permissionMatrix to child components as props
```

### Mutation Flow (Server Action)

```
User clicks "Save" in EmployeeForm (Client Component)
  → calls updateEmployee(formData) Server Action
      → verifySession() → checks auth
      → hasAccess(userId, 'employees', 'write') → checks permission
      → validate input with Zod schema
      → createServerClient()
          → supabase.from('employees').update({...}).eq('id', id)
          → updated_at set by DB trigger automatically
          → updated_by set by Server Action
      → writeAuditLog('UPDATE', 'employees', oldData, newData)
      → revalidatePath('/admin/employees')
      → return { success: true }
  → Client Component shows success Toast
```

### Permission Check Flow

```
lib/permissions.ts:

hasAccess(userId, module, level):
  → loadPermissions(userId)  [React cache — memoized per request]
      → query: user_permissions WHERE user_id = userId AND deleted_at IS NULL
      → query: users WHERE id = userId → get template_id
      → query: template_permissions WHERE template_id = template_id
      → merge: user overrides take priority over template defaults
  → return permissionMatrix[module].level >= requiredLevel
      → NO_ACCESS = 0, READ = 1, READ_WRITE = 2
```

---

## DB Schema Patterns

### Universal Columns (All Tables)

```sql
id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
created_by  UUID REFERENCES auth.users(id),
updated_by  UUID REFERENCES auth.users(id),
deleted_at  TIMESTAMPTZ DEFAULT NULL   -- NULL = active, NOT NULL = soft deleted
```

### Permission Tables

```sql
-- Module registry (source of truth for permission matrix)
CREATE TABLE modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,     -- 'employees', 'vehicles', etc.
  label_he    TEXT NOT NULL,            -- Hebrew display name
  parent_key  TEXT REFERENCES modules(key),  -- for sub-modules
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE
);

-- Role templates
CREATE TABLE permission_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- Template permission matrix
CREATE TABLE template_permissions (
  template_id UUID REFERENCES permission_templates(id) ON DELETE CASCADE,
  module_key  TEXT REFERENCES modules(key),
  level       SMALLINT NOT NULL DEFAULT 0,  -- 0=none, 1=read, 2=read+write
  PRIMARY KEY (template_id, module_key)
);

-- User permission overrides
CREATE TABLE user_permissions (
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  module_key  TEXT REFERENCES modules(key),
  level       SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, module_key)
);

-- Users table (linked to Supabase auth.users)
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id),
  employee_id     UUID REFERENCES employees(id),
  template_id     UUID REFERENCES permission_templates(id),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id),
  updated_by      UUID REFERENCES auth.users(id),
  deleted_at      TIMESTAMPTZ
);
```

### Audit Log Table

```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,         -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'
  entity_type TEXT NOT NULL,         -- 'employees', 'companies', etc.
  entity_id   UUID,
  old_data    JSONB,                 -- snapshot before change
  new_data    JSONB,                 -- snapshot after change
  ip_address  TEXT,
  user_agent  TEXT
);

-- No soft delete on audit_log — it is the immutable record
-- Index for common queries
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

### DB Triggers

```sql
-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at:
CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- (repeat for each table)
```

### Soft Delete Query Pattern

```typescript
// Every query MUST filter deleted_at
const { data } = await supabase
  .from('employees')
  .select('*')
  .is('deleted_at', null)   // active records only
  .order('created_at', { ascending: false })

// Soft delete
await supabase
  .from('employees')
  .update({ deleted_at: new Date().toISOString(), updated_by: userId })
  .eq('id', employeeId)
```

---

## Auth Layer: proxy.ts Pattern

```typescript
// proxy.ts (root level — formerly middleware.ts, renamed in Next.js v16)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session (required for Supabase SSR)
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  if (isAdminRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

Note: proxy.ts CAN call Supabase for session refresh (Supabase SSR requires it). Granular permission checks (DB queries for module access) are NOT done here — those happen in the DAL inside each page/action.

---

## State Management

### Rule: Server-First

In Next.js App Router, the default is Server Components. Use Client Components only when needed (interactivity, browser APIs, hooks).

| State Type | Where | Tool |
|------------|-------|------|
| Server data (initial load) | Server Components | Supabase server client + DAL |
| Form state | Client Components | React `useActionState` + Server Actions |
| UI state (modals, tabs, filters) | Client Components | `useState` / `useReducer` |
| User session / permissions | Server Components | DAL + `React.cache()` |
| Real-time updates (future) | Client Components | Supabase Realtime |

Do NOT use Zustand, Redux, or global client stores for this admin panel. Data comes from the server. The only client state needed is UI state (which modal is open, which tab is active, filter values before submit).

Exception: If the permission matrix needs to be available deep in a client component tree, pass it as a prop from the Server Component parent, or use React Context within a Client Component subtree.

---

## Patterns to Follow

### Pattern 1: Server Component fetches, Client Component renders

```typescript
// app/(admin)/admin/employees/page.tsx — Server Component
import { verifySession } from '@/lib/dal'
import { hasAccess } from '@/lib/permissions'
import { EmployeeTable } from '@/components/admin/employees/EmployeeTable'

export default async function EmployeesPage() {
  const session = await verifySession()
  const canWrite = await hasAccess(session.userId, 'employees', 'write')

  const { data: employees } = await supabase
    .from('employees')
    .select('*, companies(name), departments(name)')
    .is('deleted_at', null)
    .order('last_name')

  return <EmployeeTable employees={employees} canWrite={canWrite} />
}

// components/admin/employees/EmployeeTable.tsx — Client Component
'use client'
export function EmployeeTable({ employees, canWrite }: Props) {
  // All interactivity here (filters, modals, pagination)
}
```

### Pattern 2: Server Action with auth + permission + audit

```typescript
// actions/employees.ts
'use server'
import { verifySession } from '@/lib/dal'
import { hasAccess } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const EmployeeUpdateSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  // ...
})

export async function updateEmployee(formData: FormData) {
  // 1. Auth
  const session = await verifySession()

  // 2. Permission
  if (!await hasAccess(session.userId, 'employees', 'write')) {
    return { error: 'אין הרשאה לעדכן עובדים' }
  }

  // 3. Validate
  const parsed = EmployeeUpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // 4. Get old data for audit
  const { data: oldData } = await supabase
    .from('employees').select('*').eq('id', parsed.data.id).single()

  // 5. Mutate
  const { data, error } = await supabase
    .from('employees')
    .update({ ...parsed.data, updated_by: session.userId })
    .eq('id', parsed.data.id)
    .select()
    .single()

  if (error) return { error: 'שגיאה בעדכון העובד' }

  // 6. Audit log
  await writeAuditLog({
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'employees',
    entityId: parsed.data.id,
    oldData,
    newData: data,
  })

  // 7. Revalidate
  revalidatePath('/admin/employees')
  return { success: true }
}
```

### Pattern 3: Adding a new module (extensibility)

When adding a future module (e.g., vehicle fleet):

1. Add row to `modules` table: `{ key: 'vehicles', label_he: 'צי רכב', sort_order: 10 }`
2. Create DB tables with standard columns (id, created_at, updated_at, created_by, updated_by, deleted_at)
3. Create `app/(admin)/admin/vehicles/page.tsx` — Server Component
4. Create `components/admin/vehicles/` — Client Components
5. Create `actions/vehicles.ts` — Server Actions
6. Sidebar auto-discovers module from `modules` table query
7. Permission templates automatically include new module (default level = 0 = no access)

The sidebar and permission system are designed to be data-driven from the `modules` table, so no code changes are needed to the permission infrastructure.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: DB calls in proxy.ts beyond session refresh

**What:** Querying user_permissions or any business table in proxy.ts
**Why bad:** proxy.ts runs on every request including prefetches. DB round-trip per request = severe performance degradation at scale.
**Instead:** proxy.ts only refreshes Supabase session (required by @supabase/ssr) and checks if a JWT exists. All permission checks happen in the DAL inside each page.

### Anti-Pattern 2: Checking permissions only in the UI

**What:** Hiding a "Delete" button client-side but not checking in the Server Action
**Why bad:** Server Actions are public endpoints. A user can call them directly.
**Instead:** Every Server Action must call `hasAccess()` before executing. UI hiding is UX, not security.

### Anti-Pattern 3: Querying `auth.users` directly from client

**What:** Using anon key to query auth schema tables
**Why bad:** auth.users is not exposed via the public schema. Will fail.
**Instead:** Use `supabase.auth.getUser()` for session user, and your `public.users` table for app user data.

### Anti-Pattern 4: Skipping soft delete filter

**What:** `supabase.from('employees').select('*')` without `.is('deleted_at', null)`
**Why bad:** Returns deleted records. Users see ghost data.
**Instead:** Create a utility `withSoftDelete(query)` that always appends `.is('deleted_at', null)`. Or use a Postgres View that filters deleted_at.

### Anti-Pattern 5: Supabase client in Client Component with service role key

**What:** Using `SUPABASE_SERVICE_ROLE_KEY` in browser client
**Why bad:** Exposes admin key to browser. Bypasses all RLS. Critical security vulnerability.
**Instead:** Browser client always uses NEXT_PUBLIC_SUPABASE_ANON_KEY. Service role only used in Route Handlers or Server Actions when genuinely needed (e.g., admin operations that must bypass RLS).

### Anti-Pattern 6: Flat tab components in a single giant file

**What:** One 2000-line `AdminPanel.tsx` with all 9 tabs
**Why bad:** Un-maintainable, can't be split into Server/Client correctly, slow to compile.
**Instead:** Each tab is its own `page.tsx` at its own URL segment. Navigation between tabs = client-side navigation (no full reload because they share the same layout).

---

## Suggested Build Order (Dependencies)

Dependencies flow bottom-up: infrastructure must exist before features that depend on it.

```
Phase 1: Foundation
  [1] Supabase project setup — DB schema, RLS, triggers
  [2] Next.js project scaffold — proxy.ts, route groups, layouts
  [3] lib/supabase/ clients (server + browser)
  [4] proxy.ts auth guard
  [5] lib/dal.ts — verifySession, getUser
  [6] Login page + logout action

  Why first: Everything else depends on auth working correctly.

Phase 2: Permission Infrastructure
  [7] modules table + seed data (all 9 admin modules)
  [8] permission_templates + user_permissions tables
  [9] lib/permissions.ts — hasAccess(), loadPermissions()
  [10] Permission matrix UI component (PermissionMatrix.tsx)

  Why second: All tab pages need permission checks. Build once, use everywhere.

Phase 3: Admin Shell + Core Entities
  [11] Admin layout — sidebar, RTL wrapper, header
  [12] Sidebar — reads modules from DB dynamically
  [13] companies CRUD (simplest entity, no foreign deps)
  [14] departments CRUD (depends on companies)
  [15] role-tags CRUD (independent)
  [16] writeAuditLog utility

  Why third: Reference data needed before employees (employees reference companies/departments).

Phase 4: Core Module — Employees
  [17] employees CRUD (depends on companies, departments, role-tags)
  [18] Excel import (employees)
  [19] Excel export (employees)
  [20] Composite unique key validation (employee_number + company_id)

  Why fourth: Most complex entity, depends on all reference data.

Phase 5: Users + Permissions
  [21] users CRUD (link to employees + Supabase Auth)
  [22] Apply template action
  [23] Individual permission override
  [24] Tab 6: permission-templates CRUD

  Why fifth: Depends on employees existing. Permissions depend on modules being seeded.

Phase 6: Projects + Settings
  [25] projects CRUD (references employees as managers)
  [26] settings page (API integrations, config.ini)
  [27] config.ini Route Handler (read/write via FTP or cPanel API)

  Why sixth: References employees. Settings is standalone.

Phase 7: Audit Log Viewer
  [28] Audit log page (filterable: user, entity, date range)

  Why last: Reads accumulated data. Infrastructure (writeAuditLog) already in place.

Phase 8: Polish
  [29] Dashboard Tab 0 — aggregate stats, recent activity
  [30] Loading skeletons (loading.tsx per route)
  [31] Error boundaries (error.tsx per route)
  [32] Mobile/tablet responsive pass
```

---

## Scalability Considerations

| Concern | Current (Admin Panel) | Future (Fleet + Equipment modules) |
|---------|----------------------|-----------------------------------|
| New modules | Add row to `modules` table + new route segment | Same pattern — zero permission infra changes |
| Permission granularity | Module-level | Can extend to sub-module: `vehicles:maintenance` |
| Audit log volume | Low (internal admin) | High (fleet events) — add partitioning by month |
| Real-time data | Not needed | Vehicle location — add Supabase Realtime to specific pages |
| Multi-company | One company (Chemo Aharon) | company_id scoping already on employees — extend to projects/vehicles |

---

## RTL + i18n Architecture

```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body className="font-heebo">
        {children}
      </body>
    </html>
  )
}

// tailwind.config.ts
// Use RTL-aware utilities: ps- (padding-start), pe- (padding-end)
// instead of pl- / pr- for correct RTL/LTR flipping
```

For i18n readiness: keep all Hebrew strings in `lib/strings.he.ts` from day one. This makes future English translation a find-replace rather than a hunt through components.

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| Next.js v16 renamed middleware to proxy | https://nextjs.org/docs/app/api-reference/file-conventions/proxy (official, 2026-02-27) | HIGH |
| Route groups (folderName) convention | https://nextjs.org/docs/app/api-reference/file-conventions/route-groups (official) | HIGH |
| Server Actions pattern (`'use server'`, `useActionState`) | https://nextjs.org/docs/app/getting-started/updating-data (official) | HIGH |
| DAL + verifySession pattern | https://nextjs.org/docs/app/guides/authentication (official) | HIGH |
| proxy.ts optimistic check only (no DB) for permissions | https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional (official) | HIGH |
| Parallel routes for conditional rendering | https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes (official) | HIGH |
| `src/` folder + feature-split organization | https://nextjs.org/docs/app/getting-started/project-structure (official) | HIGH |
| Supabase @supabase/ssr server client pattern | Training data — Supabase docs WebFetch blocked | MEDIUM |
| Postgres trigger for updated_at | Standard PostgreSQL pattern | HIGH |
| Audit log schema design | Standard enterprise pattern | HIGH |
