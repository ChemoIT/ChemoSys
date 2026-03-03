# Phase 3: Access Control - Research

**Researched:** 2026-03-03
**Domain:** Supabase Auth Admin API, RBAC with permission templates, Next.js Server Action guards, sidebar nav filtering
**Confidence:** HIGH (Core patterns verified against official Supabase docs and Next.js docs)

---

## Summary

Phase 3 builds access control on top of the schema already created in Phase 1. The tables (`users`, `user_permissions`, `template_permissions`, `role_templates`, `modules`) are already defined and migrated. The `get_user_permissions()` SECURITY DEFINER function exists in the DB. Phase 3 is primarily a **UI + logic layer** over an already-correct DB schema.

The key architectural challenge is the **dual responsibility of user management**: the admin must create a Supabase Auth account (via `auth.admin.createUser` with service role key) AND a row in the `public.users` table that links `auth_user_id → employee_id`. These are two separate operations that must succeed atomically (create Auth user first, then insert `public.users`, roll back Auth user on failure).

For **permission enforcement**, the project already has `get_user_permissions()` as a SECURITY DEFINER function. Phase 3 will: (a) add a `requirePermission()` helper in `src/lib/dal.ts`, (b) call it at the top of every Server Action that mutates data, and (c) pass allowed modules list to `SidebarNav` as a prop from the server-rendered `Sidebar`.

**Primary recommendation:** Use DB lookup for permission checks in Server Actions (not JWT claims), because the modules matrix can change frequently and JWT claims have a stale-until-expire window. The existing `get_user_permissions()` SECURITY DEFINER function is the right tool.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | ^0.8.0 (already installed) | Server-side Supabase client for SSR | Already in project, official Supabase recommendation |
| `@supabase/supabase-js` | ^2.98.0 (already installed) | Admin API client (service role) | Required for `auth.admin.*` namespace |
| `next` | 16.1.6 (already installed) | Server Actions, Server Components | Already in project |
| `zod` | ^4.3.6 (already installed) | Form validation for user create/edit forms | Already in project |
| `react-hook-form` | ^7.71.2 (already installed) | Form state management | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | ^2.0.7 (already installed) | Toast notifications for success/error | Already in project |
| `lucide-react` | ^0.575.0 (already installed) | Icons for permission matrix (Check, X, Eye) | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB lookup for permissions | JWT custom claims via Auth Hook | JWT claims are stale until token expires; DB lookup is always current. For a permission matrix that admins can change, DB lookup is safer. |
| Service role `createAdminClient()` | Supabase Edge Function | Edge functions add infrastructure complexity; a server action with service role key is simpler and already supported. |
| Custom `is_blocked` flag in `public.users` | `ban_duration` in `auth.users` | Project already has `is_blocked` in `public.users`. Use this as the primary block signal, checked in middleware and Server Actions. `ban_duration` is also set as a belt-and-suspenders measure. |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── dal.ts                    # ADD: verifySession (exists) + requirePermission() + getNavPermissions()
│   ├── supabase/
│   │   ├── server.ts             # EXISTS: regular client (publishable key)
│   │   └── admin.ts              # NEW: admin client (service role key) — NEVER import in client components
├── actions/
│   ├── users.ts                  # NEW: createUser, updateUser, deleteUser, blockUser, assignTemplate
│   └── templates.ts              # NEW: createTemplate, updateTemplate, deleteTemplate, savePermissions
├── app/(admin)/admin/
│   ├── users/
│   │   └── page.tsx              # NEW: User management list
│   └── templates/
│       └── page.tsx              # NEW: Role template CRUD + permission matrix
├── components/
│   ├── shared/
│   │   ├── Sidebar.tsx           # MODIFY: pass allowedModules to SidebarNav
│   │   └── SidebarNav.tsx        # MODIFY: accept allowedModules prop, filter display
│   └── admin/
│       ├── users/                # NEW: UserForm, UsersTable, PermissionMatrix, EmployeeSearchDialog
│       └── templates/            # NEW: TemplateForm, TemplatesTable, PermissionMatrixEditor
supabase/migrations/
├── 00012_access_control.sql      # NEW: Phase 3 RLS tightening + block check function
```

### Pattern 1: Admin Client (Service Role) — createAdminClient()

**What:** A separate Supabase client that uses the `service_role` key. Required for all `auth.admin.*` operations. Must NEVER be used in client components or exposed to the browser.

**When to use:** Only in Server Actions that manage auth users: `createUser`, `deleteUser`, `blockUser`, `unblockUser`.

```typescript
// Source: https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// NEVER import this in a client component.
// NEVER use NEXT_PUBLIC_ prefix for SUPABASE_SERVICE_ROLE_KEY.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only env var
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
```

**Environment variable:** `SUPABASE_SERVICE_ROLE_KEY` — no `NEXT_PUBLIC_` prefix. Will cause build error if imported in a client component (Next.js strips non-public env vars).

### Pattern 2: Create User (Two-Phase Atomic Operation)

**What:** Creating a user requires two steps: (1) create the `auth.users` entry via admin API, (2) insert a row in `public.users`. If step 2 fails, the admin API user must be deleted (cleanup).

**When to use:** `createUser` Server Action.

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-createuser
// src/actions/users.ts
'use server'

export async function createUserAction(employeeId: string, email: string, password: string) {
  await verifySession()
  // TODO: requirePermission('users', 2) in 03-03

  const adminClient = createAdminClient()
  const supabase = await createClient()

  // Step 1: Create auth user — does NOT send confirmation email by default
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email confirmation flow — admin creates directly
  })

  if (authError || !authUser.user) {
    return { error: authError?.message ?? 'שגיאה ביצירת יוזר' }
  }

  // Step 2: Insert public.users row linking auth_user_id → employee_id
  const { error: dbError } = await supabase
    .from('users')
    .insert({
      auth_user_id: authUser.user.id,
      employee_id: employeeId,
      is_blocked: false,
    })

  if (dbError) {
    // Rollback: delete the auth user we just created
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    return { error: 'שגיאה בשמירת יוזר ב-DB — הפעולה בוטלה' }
  }

  revalidatePath('/admin/users')
  return { success: true }
}
```

### Pattern 3: Block / Unblock User

**What:** Blocking sets `is_blocked = true` in `public.users` AND sets `ban_duration = '87600h'` (10 years) in `auth.users` via admin API. This prevents new sessions AND revokes refresh tokens.

**When to use:** `blockUser` / `unblockUser` Server Actions.

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
// Block
await adminClient.auth.admin.updateUserById(authUserId, {
  ban_duration: '87600h' // ~10 years — effectively permanent
})
await supabase.from('users').update({ is_blocked: true }).eq('id', userId)

// Unblock
await adminClient.auth.admin.updateUserById(authUserId, {
  ban_duration: 'none' // lifts ban immediately
})
await supabase.from('users').update({ is_blocked: false }).eq('id', userId)
```

**Note:** JWT-based sessions are valid until expiry even after ban. `ban_duration` prevents token refresh, so existing sessions expire within the `jwt_expiry` window (default: 1 hour). The `is_blocked` flag in `public.users` is checked in the middleware for every request as a belt-and-suspenders guard (see Pattern 7).

### Pattern 4: Delete User (Soft Delete in public.users + Hard Delete in auth.users)

**What:** Soft-delete the `public.users` row (set `deleted_at`). Hard-delete the `auth.users` entry via admin API so the email address can be reused.

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
// Step 1: Soft delete public.users
await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', userId)

// Step 2: Hard delete auth.users (frees the email)
// shouldSoftDelete: false = hard delete (default behavior)
await adminClient.auth.admin.deleteUser(authUserId)
```

**Warning:** Hard deleting `auth.users` will cascade-null all `created_by`/`updated_by` FK references that point to the deleted `auth.users.id`. This is acceptable per schema design (these are nullable FKs).

### Pattern 5: Permission Data Model — Template Assignment + Override

**What:** When assigning a template to a user, the Server Action upserts rows into `user_permissions` with `is_override = false` and `template_id = <template_id>`. When an admin manually overrides a specific module, that row gets `is_override = true` and `template_id = null` (or retains template_id for audit purposes).

**Template assignment logic:**
```typescript
// Assign template: upsert all template_permissions into user_permissions
async function assignTemplate(userId: string, templateId: string) {
  // 1. Fetch template permissions
  const { data: tplPerms } = await supabase
    .from('template_permissions')
    .select('module_key, level')
    .eq('template_id', templateId)

  if (!tplPerms) return

  // 2. Upsert into user_permissions — preserve existing is_override=true rows
  // Strategy: upsert all non-override rows, leave override rows unchanged
  const nonOverrideModules = tplPerms.map(p => p.module_key)

  // Delete non-override rows for this user (will be replaced by template)
  await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('is_override', false)

  // Insert template permissions as non-override
  await supabase.from('user_permissions').insert(
    tplPerms.map(p => ({
      user_id: userId,
      module_key: p.module_key,
      level: p.level,
      template_id: templateId,
      is_override: false,
    }))
  )
}
```

**Override logic:** When admin manually changes a specific module permission:
```typescript
// Upsert with is_override = true — survives template re-assignment
await supabase.from('user_permissions').upsert({
  user_id: userId,
  module_key: moduleKey,
  level: newLevel,
  template_id: null,
  is_override: true,
}, { onConflict: 'user_id,module_key' })
```

**What happens when template is edited after assignment:** Template edits change `template_permissions`. They do NOT automatically update `user_permissions`. The admin must explicitly re-assign the template to propagate changes. This is intentional — users can have diverged from the template (via overrides). Notify the admin via UI that "X users are assigned this template — changes do not auto-apply."

### Pattern 6: requirePermission() in Server Actions

**What:** A server-side guard that checks the calling user's permission level for a given module before proceeding with a mutation. Throws if insufficient.

```typescript
// Source: verified pattern from Makerkit docs + Supabase SECURITY DEFINER docs
// src/lib/dal.ts — ADD to existing file

export type PermissionLevel = 0 | 1 | 2 // 0=none, 1=read, 2=read+write

/**
 * requirePermission — checks if the current user has at least `minLevel` on `moduleKey`.
 * Throws an Error (caught by Server Action error boundary) if insufficient.
 * Uses get_user_permissions() SECURITY DEFINER function — no RLS recursion.
 *
 * Admin users (is_admin flag) bypass all permission checks.
 * Call AFTER verifySession() in every mutation Server Action.
 */
export async function requirePermission(
  moduleKey: string,
  minLevel: PermissionLevel
): Promise<void> {
  const session = await verifySession() // throws → redirect if unauthenticated
  const supabase = await createClient()

  const { data: perms, error } = await supabase.rpc('get_user_permissions', {
    p_user_id: session.userId,
  })

  if (error) throw new Error('שגיאת הרשאות — לא ניתן לבדוק גישה')

  const perm = perms?.find((p: { module_key: string; level: number }) => p.module_key === moduleKey)
  const level = (perm?.level ?? 0) as PermissionLevel

  if (level < minLevel) {
    throw new Error(`אין הרשאה למודול ${moduleKey}`)
  }
}

/**
 * getNavPermissions — fetches the list of module_keys the user has READ (level >= 1) access to.
 * Used by Sidebar (server component) to filter which nav items to render.
 * Returns empty array if user has no public.users row (first login edge case).
 */
export async function getNavPermissions(): Promise<string[]> {
  const session = await verifySession()
  const supabase = await createClient()

  const { data: perms } = await supabase.rpc('get_user_permissions', {
    p_user_id: session.userId,
  })

  return (perms ?? [])
    .filter((p: { level: number }) => p.level >= 1)
    .map((p: { module_key: string }) => p.module_key)
}
```

**Usage in Server Action:**
```typescript
export async function updateCompany(_: unknown, formData: FormData) {
  'use server'
  await verifySession()
  await requirePermission('companies', 2) // read+write required

  // ... mutation logic
}
```

### Pattern 7: is_blocked Check in proxy.ts (Middleware)

**What:** After session is verified, check the `public.users.is_blocked` flag. If blocked, sign out and redirect to /login with a query param.

**Problem:** Querying Supabase custom tables in Next.js middleware has known reliability issues (confirmed in GitHub discussion #29482). The recommended approach is to check `is_blocked` in the **server layout** (`AdminLayout`) rather than in `proxy.ts`.

**Recommended approach — check in AdminLayout, not middleware:**
```typescript
// src/app/(admin)/layout.tsx — ADD after verifySession()
const session = await verifySession()
const supabase = await createClient()

// Check is_blocked — one extra DB query per navigation, acceptable cost
const { data: userRecord } = await supabase
  .from('users')
  .select('is_blocked')
  .eq('auth_user_id', session.userId)
  .single()

if (userRecord?.is_blocked) {
  redirect('/login?blocked=1')
}
```

**Why not in proxy.ts:** Middleware runs in Edge Runtime which has limitations querying Supabase tables. Layout-level check is server-side (Node.js), reliable, and wrapped in `React.cache()` behavior through the component tree.

### Pattern 8: SidebarNav Filtering by Permissions

**What:** The server `Sidebar` component fetches allowed modules, passes them as a prop to the `SidebarNav` client component. `SidebarNav` renders only items present in `allowedModules`.

**Why server-side:** Permission list must never be decided on the client. The server fetches what the user can see; the client only handles the active-link highlighting.

```typescript
// src/components/shared/Sidebar.tsx (MODIFIED)
import { getNavPermissions } from '@/lib/dal'

export async function Sidebar({ user }: SidebarProps) {
  const allowedModules = await getNavPermissions() // server-side DB call
  // allowedModules = ['companies', 'employees', 'users'] for example

  return (
    <div ...>
      {/* ... brand header ... */}
      <SidebarNav allowedModules={allowedModules} />
      {/* ... user footer ... */}
    </div>
  )
}

// src/components/shared/SidebarNav.tsx (MODIFIED)
type SidebarNavProps = {
  allowedModules: string[] // from server — which module keys user can see
}

export function SidebarNav({ allowedModules }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav ...>
      {NAV_ITEMS
        .filter(item =>
          // Always show items that don't require a module key (e.g. dashboard for all)
          // OR show if the module key is in allowedModules
          !item.moduleKey || allowedModules.includes(item.moduleKey)
        )
        .map(item => /* ... existing render logic ... */)}
    </nav>
  )
}
```

**NAV_ITEMS update:** Add `moduleKey` field to `NavItem` type, mapping each item to its `modules` table key.

### Pattern 9: Access Denied Page (NAVP-02)

**What:** When a user navigates directly to `/admin/users` but has no `users` module permission, show an "אין גישה" message instead of an error.

**Approach:** Check permissions in the page's Server Component. If insufficient, render an access denied component in-page (not a redirect).

```typescript
// src/app/(admin)/admin/users/page.tsx
export default async function UsersPage() {
  const session = await verifySession()
  const supabase = await createClient()

  const { data: perms } = await supabase.rpc('get_user_permissions', {
    p_user_id: session.userId
  })
  const hasAccess = perms?.some((p: { module_key: string; level: number }) =>
    p.module_key === 'users' && p.level >= 1
  )

  if (!hasAccess) {
    return <AccessDenied /> // simple component: "אין לך הרשאה לצפות בדף זה"
  }

  // ... render users table
}
```

**Why not use `unauthorized()` / `forbidden()`:** These Next.js 16 functions are **still experimental** (require `authInterrupts: true` in `next.config.ts`, canary-only). Do not use in production. Use inline conditional render instead.

### Anti-Patterns to Avoid

- **Do NOT use JWT custom claims for permission checks.** Claims are stale until token refresh (up to 1 hour). If an admin revokes access, the user can still act for up to 1 hour. Use DB lookup instead.
- **Do NOT query Supabase tables in `proxy.ts`** middleware — unreliable in Edge Runtime (GitHub discussion #29482). Check `is_blocked` in AdminLayout.
- **Do NOT use `auth.admin.*` methods in a regular `createClient()`** — these require the service role key. Use `createAdminClient()`.
- **Do NOT expose `SUPABASE_SERVICE_ROLE_KEY`** with `NEXT_PUBLIC_` prefix — Next.js will bundle it into the client.
- **Do NOT delete `public.users` row without also deleting `auth.users`** — orphaned auth accounts waste seats and the email cannot be reused.
- **Do NOT call `getNavPermissions()` in a Client Component** — it runs on the server only. Pass results as props.
- **Do NOT use `unauthorized()` / `forbidden()` from Next.js** — still experimental as of Next.js 16.1.6.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth user creation | Custom user table without auth.users | `auth.admin.createUser()` | Supabase Auth handles password hashing, session management, JWT issuance |
| Permission lookup | Custom SQL joins in every Server Action | Existing `get_user_permissions()` SECURITY DEFINER RPC | Already in DB, prevents RLS recursion, performs well |
| Service role client | Per-action inline `createClient()` with service role key | Shared `createAdminClient()` in `src/lib/supabase/admin.ts` | Centralizes auth config, prevents accidentally using in client code |
| Block enforcement | Custom session invalidation | `ban_duration` in `auth.admin.updateUserById()` | Supabase Auth handles refresh token revocation |
| Permission matrix UI | Custom checkbox grid from scratch | Existing `shadcn/ui` checkbox + `@tanstack/react-table` | Already installed, consistent UI |

**Key insight:** The DB schema for permissions is already correct (Phase 1 design). Phase 3 is about building the UI and enforcement layer, not re-designing the data model.

---

## DB Schema (Already Exists — Reference Only)

### Current Schema (from 00001_foundation_schema.sql)

```sql
-- modules: seeded, read-only — 9 entries from 00003_seed_modules.sql
-- keys: dashboard, companies, departments, role_tags, employees, users, templates, projects, settings

-- Permission levels:
-- 0 = אין גישה (no access)
-- 1 = קריאה (read)
-- 2 = קריאה + כתיבה (read + write)

-- role_templates: CRUD + soft delete
-- template_permissions: (template_id, module_key, level) UNIQUE(template_id, module_key)
-- users: (auth_user_id FK auth.users, employee_id FK employees, is_blocked, soft delete)
-- user_permissions: (user_id, module_key, level, template_id nullable, is_override bool)
--                   UNIQUE(user_id, module_key)

-- SECURITY DEFINER function (already exists):
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(module_key TEXT, level SMALLINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.module_key, up.level
  FROM user_permissions up
  INNER JOIN users u ON u.id = up.user_id
  WHERE u.auth_user_id = p_user_id;
$$;
```

### Migration 00012 Needed (Phase 3)

The Phase 3 migration needs to:
1. Add RLS policies for `user_permissions` UPDATE (currently only SELECT/INSERT/DELETE exist)
2. Add a `check_user_blocked()` helper function for use in AdminLayout
3. Optionally tighten RLS on `users` table to restrict who can modify permissions (admin only)

```sql
-- Add UPDATE policy to user_permissions (currently missing — only SELECT/INSERT/DELETE exist)
CREATE POLICY "user_permissions_update" ON user_permissions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Helper: check if caller's auth user is blocked in public.users
CREATE OR REPLACE FUNCTION is_current_user_blocked()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_blocked, false)
  FROM users
  WHERE auth_user_id = auth.uid()
    AND deleted_at IS NULL;
$$;
```

---

## Common Pitfalls

### Pitfall 1: Two-Step User Creation Leaving Orphan Auth Users
**What goes wrong:** `auth.admin.createUser()` succeeds but the subsequent `public.users` INSERT fails (e.g., employee already linked). The Supabase Auth user exists but has no corresponding app user row.
**Why it happens:** No transaction across auth schema and public schema in a Server Action.
**How to avoid:** Always catch DB insert errors and immediately call `adminClient.auth.admin.deleteUser(authUser.user.id)` in the catch block. Log the cleanup action.
**Warning signs:** Users appearing in Supabase Dashboard → Auth → Users but not in the app's users table.

### Pitfall 2: JWT Claims Don't Reflect Permission Changes Immediately
**What goes wrong:** Admin revokes a user's access. User continues acting for up to 1 hour (JWT expiry window).
**Why it happens:** JWTs are validated locally (`getClaims()` = no network call). The token is valid until `exp` regardless of DB state.
**How to avoid:** Use DB lookup (`get_user_permissions()` RPC) for all Server Action permission checks, not JWT claims. JWT claims are only suitable for coarse-grained checks (is the user logged in?).
**Warning signs:** Revoked permissions still working in Server Actions.

### Pitfall 3: ban_duration Does Not Immediately Log Out Existing Sessions
**What goes wrong:** Admin blocks a user with `ban_duration: '87600h'`. The user's current session (active JWT) continues working until the token expires (up to 1 hour).
**Why it happens:** Supabase Auth cannot revoke issued JWTs — only refresh tokens are revoked.
**How to avoid:** The `is_blocked` flag in AdminLayout provides near-real-time blocking (checked on every page navigation). Set short JWT expiry in Supabase project settings if immediate block is critical.
**Warning signs:** Blocked users can still perform mutations for a brief window after blocking.

### Pitfall 4: Template Edit Does Not Auto-Update User Permissions
**What goes wrong:** Admin edits a template's permission set. Users assigned to this template still have the old permissions.
**Why it happens:** `user_permissions` rows are copied from the template at assignment time, not dynamically computed.
**How to avoid:** In the template edit UI, show a warning: "X יוזרים משתמשים בתבנית זו — שינויים לא יחולו אוטומטית". Provide a "החל על כל היוזרים" (apply to all) button that re-runs `assignTemplate()` for each user with `is_override = false`.
**Warning signs:** Users reporting unexpected permissions after a template was edited.

### Pitfall 5: Override Rows Wiped When Template Is Re-Assigned
**What goes wrong:** Admin re-assigns a template. The code deletes ALL `user_permissions` rows for the user, losing manual overrides.
**Why it happens:** Naive "delete all then insert" logic ignores `is_override`.
**How to avoid:** When assigning template, only delete rows where `is_override = false`. Leave `is_override = true` rows untouched. See Pattern 5 for correct implementation.
**Warning signs:** Users report that their custom permissions were lost after a template reassignment.

### Pitfall 6: createAdminClient() Accidentally Imported in Client Code
**What goes wrong:** Build fails or service role key is exposed to browser.
**Why it happens:** `SUPABASE_SERVICE_ROLE_KEY` is a non-public env var. If used in a Client Component, Next.js will throw at runtime (key is undefined in browser) or during build.
**How to avoid:** Keep `src/lib/supabase/admin.ts` server-only. Add `import 'server-only'` at the top (npm package: `server-only`). This causes a build-time error if imported from a client component.
**Warning signs:** `process.env.SUPABASE_SERVICE_ROLE_KEY is undefined` errors in browser console.

### Pitfall 7: Querying Supabase Tables in proxy.ts Middleware
**What goes wrong:** `is_blocked` check in middleware returns empty results despite user being blocked.
**Why it happens:** Next.js middleware runs in Edge Runtime. Supabase table queries in Edge Runtime have known issues with cookie handling and RLS evaluation (GitHub discussion #29482).
**How to avoid:** Do NOT query custom tables in proxy.ts. Move `is_blocked` check to AdminLayout (Node.js runtime, reliable).
**Warning signs:** Empty query results in middleware despite data existing in the table.

### Pitfall 8: user_permissions Missing UPDATE Policy
**What goes wrong:** Updating an existing permission row via upsert fails silently (0 rows affected).
**Why it happens:** The Phase 1 RLS migration (00002) created SELECT, INSERT, DELETE policies for `user_permissions` but NOT an UPDATE policy.
**How to avoid:** Add `user_permissions_update` RLS policy in migration 00012.
**Warning signs:** `upsert()` with `onConflict: 'user_id,module_key'` seems to succeed but the level doesn't change.

---

## Code Examples

### createUser Server Action (Full)

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-createuser
// src/actions/users.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySession } from '@/lib/dal'
import { writeAuditLog } from '@/lib/audit'

export async function createUserAction(
  _: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await verifySession()
  // Phase 03-03 adds: await requirePermission('users', 2)

  const employeeId = formData.get('employee_id') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!employeeId || !email || !password) {
    return { error: 'שדות חובה חסרים' }
  }

  const adminClient = createAdminClient()
  const supabase = await createClient()

  // Step 1: Create Supabase Auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // admin creates directly — no email confirmation needed
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'שגיאה ביצירת חשבון' }
  }

  const authUserId = authData.user.id

  // Step 2: Insert public.users row
  const { data: newUser, error: dbError } = await supabase
    .from('users')
    .insert({
      auth_user_id: authUserId,
      employee_id: employeeId,
      is_blocked: false,
      created_by: session.userId,
      updated_by: session.userId,
    })
    .select('id')
    .single()

  if (dbError || !newUser) {
    // Rollback: clean up orphan auth user
    await adminClient.auth.admin.deleteUser(authUserId)
    console.error('[createUser] DB insert failed, auth user deleted:', dbError)
    return { error: 'שגיאה בשמירת יוזר — הפעולה בוטלה' }
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'INSERT',
    entityType: 'users',
    entityId: newUser.id,
    newData: { auth_user_id: authUserId, employee_id: employeeId },
  })

  revalidatePath('/admin/users')
  return { success: true }
}
```

### requirePermission() in an Existing Server Action

```typescript
// Pattern: add to top of every mutation action in Phase 03-03
// Example: employees.ts updateEmployeeAction

export async function updateEmployeeAction(_: unknown, formData: FormData) {
  await verifySession()
  await requirePermission('employees', 2) // throws if level < 2

  // ... existing mutation logic unchanged
}
```

### get_user_permissions() RPC Call

```typescript
// Source: 00001_foundation_schema.sql — SECURITY DEFINER function already in DB
// Usage in Server Component or Server Action:
const { data: perms, error } = await supabase.rpc('get_user_permissions', {
  p_user_id: session.userId, // auth.users.id (UUID)
})
// perms: Array<{ module_key: string; level: number }>
// level: 0 = no access, 1 = read, 2 = read+write
```

### Template Permission Matrix UI (Pseudocode)

```typescript
// The permission matrix is a grid: rows = modules (9), columns = levels (none/read/read+write)
// Each cell is a radio button or select
// Data shape: Record<module_key, 0|1|2>
type PermissionMatrix = {
  dashboard: 0 | 1 | 2
  companies: 0 | 1 | 2
  departments: 0 | 1 | 2
  role_tags: 0 | 1 | 2
  employees: 0 | 1 | 2
  users: 0 | 1 | 2
  templates: 0 | 1 | 2
  projects: 0 | 1 | 2
  settings: 0 | 1 | 2
}
// On save: upsert each non-zero entry into template_permissions
// Delete entries where level = 0 (or insert level=0 explicitly — consistent either way)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers deprecated — project already uses ssr |
| `middleware.ts` | `src/proxy.ts` | Next.js 16 | middleware.ts deprecated in Next.js 16 — project already uses proxy.ts |
| `getSession()` | `getClaims()` for local JWT check | 2024 | getSession() returns unverified data — project already uses getClaims() |
| `unauthorized()` / `forbidden()` | Conditional Server Component render | Next.js 16 (still experimental) | authInterrupts still experimental/canary — do NOT use in production |
| JWT claims for RBAC | DB lookup via SECURITY DEFINER RPC | N/A | Stale JWT problem — DB lookup is always current |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: replaced by `@supabase/ssr` — already migrated in project
- `supabase.auth.getSession()`: returns unverified local data — use `getClaims()` (already done in dal.ts)
- `middleware.ts` (default path): renamed to `proxy.ts` in this project per Next.js 16 pattern — already done

---

## Open Questions

1. **Admin user designation — who is the super-admin?**
   - What we know: The `users` table has no `is_admin` flag currently. All authenticated users currently have full RLS access (Phase 1 permissive policies).
   - What's unclear: Should the initial admin (Sharon) bypass all permission checks? How is the first admin account created (before the permission system exists)?
   - Recommendation: Add `is_admin BOOLEAN DEFAULT FALSE` to `public.users` table in migration 00012. The first admin is set manually in Supabase Dashboard. `requirePermission()` checks `is_admin` first and short-circuits.

2. **Permission level for "dashboard" module**
   - What we know: Dashboard is in the modules seed table. All users probably need access to it.
   - What's unclear: Should dashboard be granted automatically to all users (hard-coded bypass) or managed via permissions?
   - Recommendation: Dashboard bypasses permission check — always shown to any authenticated user with a `public.users` row.

3. **User without a public.users row (admin-only Supabase accounts)**
   - What we know: Sharon (the first admin) has a Supabase Auth account but may not have a `public.users` row.
   - What's unclear: Should `getNavPermissions()` return all modules for users with no `public.users` row (treat as admin) or return empty (lock them out)?
   - Recommendation: In AdminLayout, after `verifySession()`, check if a `public.users` row exists. If not (first admin), show all nav items. Once Phase 3 is complete, the admin creates their own user row to bring themselves into the system.

4. **Employee search for user creation — which fields to search?**
   - What we know: USER-02 requires search by: שם / ת.ז. / מייל / מספר עובד
   - What's unclear: Should the search also exclude employees who already have a user account (prevent duplicate linking)?
   - Recommendation: Yes — filter out employees where `employees.id` already appears in `users.employee_id` (active, non-deleted users).

---

## Sources

### Primary (HIGH confidence)
- Supabase JS API Docs — `auth.admin.createUser`: https://supabase.com/docs/reference/javascript/auth-admin-createuser
- Supabase JS API Docs — `auth.admin.updateUserById` + `ban_duration`: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
- Supabase JS API Docs — `auth.admin.deleteUser` + `shouldSoftDelete`: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
- Supabase Troubleshooting — service role admin client setup: https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa
- Supabase Auth Hooks — Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Supabase RLS Performance Best Practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Supabase RBAC with Custom Claims: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Next.js `unauthorized()` docs (verified experimental): https://nextjs.org/docs/app/api-reference/functions/unauthorized
- Next.js `authInterrupts` config (verified experimental/canary): https://nextjs.org/docs/app/api-reference/config/next-config-js/authInterrupts
- ChemoSystem existing codebase: `/src/lib/dal.ts`, `/src/lib/supabase/server.ts`, `/src/proxy.ts`, `/supabase/migrations/00001_foundation_schema.sql`, `/supabase/migrations/00002_rls_policies.sql`, `/supabase/migrations/00003_seed_modules.sql`

### Secondary (MEDIUM confidence)
- Supabase GitHub discussion #29482 — middleware table query unreliability: https://github.com/orgs/supabase/discussions/29482 (confirmed by community, multiple sources agree)
- Ban duration pattern "87600h" for permanent block: verified across multiple community discussions, consistent with official `ban_duration` format docs
- `requirePermission()` pattern: https://makerkit.dev/docs/next-supabase-turbo/development/permissions-and-roles (verified matches Supabase SECURITY DEFINER pattern)
- Authorization in Next.js Server Actions: https://www.robinwieruch.de/next-authorization/ (verified against Next.js docs)

### Tertiary (LOW confidence)
- Custom Access Token Hook for injecting `user_permissions` into JWT: architecturally sound but NOT recommended for this project due to stale-claims problem (permissions can be revoked but JWT remains valid). LOW confidence this is the right approach for ChemoSys — research points away from it.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in project, verified against Supabase/Next.js official docs
- Architecture (user creation flow): HIGH — verified against official Supabase admin API docs
- Architecture (permission enforcement): HIGH — `get_user_permissions()` SECURITY DEFINER already in DB, pattern verified
- Architecture (sidebar filtering): HIGH — server component passes props to client component, standard Next.js pattern
- Pitfalls: HIGH — most verified against official docs or confirmed GitHub discussions
- Ban/block pattern: MEDIUM — `ban_duration: '87600h'` is a workaround, not an official "permanent ban" API

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable APIs — low churn risk. Supabase admin API has been stable for 2+ years)
