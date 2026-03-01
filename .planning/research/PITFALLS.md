# Domain Pitfalls — ChemoSys Admin Panel

**Domain:** Internal admin panel — Next.js App Router + Supabase + RTL Hebrew
**Researched:** 2026-03-01
**Confidence:** HIGH (core pitfalls are well-established patterns; sourced from training on official Supabase docs, Next.js docs, and community post-mortems through Aug 2025)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or security breaches.

---

### Pitfall 1: RLS Infinite Recursion on Permission Lookups

**What goes wrong:**
You write an RLS policy on `user_permissions` that calls `auth.uid()` and then queries `user_permissions` itself to check if the user has access — creating an infinite recursive loop. Supabase will error with `stack depth limit exceeded` or silently return no rows.

**Why it happens:**
Granular permission systems need to query a permissions table. The instinct is to write the RLS policy on that table using the same table as the source of truth. This is circular.

**Consequences:**
- Entire permission system breaks
- All users lose access
- Silent failures possible (returns empty set instead of erroring, so admin thinks "no permissions exist")

**Warning signs:**
- `ERROR: stack depth limit exceeded` in Supabase logs
- Permission queries returning empty arrays for all users
- Only service-role API calls work, anon/user calls return nothing

**Prevention:**
Define one "bootstrap" function that uses `SECURITY DEFINER` to bypass RLS for permission lookups:
```sql
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(module TEXT, sub_module TEXT, access_level TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT module, sub_module, access_level
  FROM user_permissions
  WHERE user_id = p_user_id AND deleted_at IS NULL;
$$;
```
Then write RLS policies that call this function — never query `user_permissions` directly inside a policy on `user_permissions`.

**Phase:** Address in Phase 1 (DB Schema) before writing any RLS policies.

---

### Pitfall 2: Using the `service_role` Key on the Client Side

**What goes wrong:**
`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` is set as a public env var (prefixed `NEXT_PUBLIC_`), exposing the service role key to the browser. The service role key bypasses ALL RLS policies — anyone with it has unrestricted database access.

**Why it happens:**
Developers use the service role key to "make things work" when RLS blocks them, then accidentally expose it in client code.

**Consequences:**
- Complete data breach — any browser user can read/write/delete all rows
- No audit trail of unauthorized access
- Unrecoverable if the key is used in production and logs are not watched

**Warning signs:**
- Any env var starting with `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` in the codebase
- `createClient(url, SERVICE_ROLE_KEY)` appearing in any file under `app/` or `components/`

**Prevention:**
- Service role key: ONLY in Server Actions, Route Handlers, and Supabase Edge Functions
- Client components: ONLY use the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Add a git pre-commit hook or CI check: `grep -r "SERVICE_ROLE" src/` must return empty
- In Vercel: set `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) — never expose it

**Phase:** Address in Phase 1 (Auth + Infrastructure setup) as a non-negotiable rule.

---

### Pitfall 3: Supabase Auth Cookie Handling in Next.js App Router

**What goes wrong:**
The old `@supabase/auth-helpers-nextjs` package (now deprecated) handled cookies differently from the current `@supabase/ssr` package. Mixing them, or using the old pattern with App Router, causes:
- Sessions not persisting across page navigation
- `auth.uid()` returning `null` in Server Components even when user is logged in
- Middleware not refreshing the session token, causing auto-logout after 1 hour

**Why it happens:**
Most tutorials and Stack Overflow answers still show the old `createClientComponentClient()` / `createServerComponentClient()` pattern from `auth-helpers-nextjs`. This API was deprecated in 2024.

**Consequences:**
- Users are logged out randomly (JWT expiry not refreshed)
- Server Components always see unauthenticated state → 401s on all protected routes
- Middleware redirects loop infinitely

**Warning signs:**
- Installing `@supabase/auth-helpers-nextjs` (deprecated package)
- No middleware.ts file refreshing the session
- `createServerComponentClient` or `createClientComponentClient` in codebase
- Users reporting "logged out after a while" without explicit sign-out

**Prevention:**
Use `@supabase/ssr` (current package) exclusively:
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```
Middleware must call `supabase.auth.getUser()` on every request to refresh the JWT.

**Phase:** Address in Phase 1 (Auth foundation). This is the first thing to get right.

---

### Pitfall 4: RTL Layout Breaking with Tailwind CSS — `left`/`right` vs `start`/`end`

**What goes wrong:**
Using `pl-4`, `mr-2`, `left-0`, `right-0` (physical directional utilities) instead of logical utilities (`ps-4`, `me-2`, `start-0`, `end-0`) in a Hebrew RTL interface. The layout works in LTR development but breaks when `dir="rtl"` is applied.

**Why it happens:**
Developers write CSS from muscle memory in LTR. Physical utilities (`left`, `right`, `pl`, `pr`, `ml`, `mr`) do not flip in RTL. Logical utilities (`start`, `end`, `ps`, `pe`, `ms`, `me`) flip automatically.

**Consequences:**
- Sidebar appears on wrong side
- Icons appear opposite to text
- Dropdowns open to the wrong side
- Tooltips and popups overflow off-screen
- The longer the development, the more painful the RTL fix

**Warning signs:**
- `className` contains `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-` without a deliberate RTL override
- Sidebar navigation working in LTR dev but looking wrong when you switch to Hebrew
- Third-party component libraries using physical CSS properties internally

**Prevention:**
- Set `dir="rtl"` in `<html>` tag from Day 1 and develop in RTL mode from the start
- Enforce a rule: use `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-` everywhere
- Add Tailwind config check or ESLint rule to flag `pl-`, `pr-`, `ml-`, `mr-` usage
- For shadcn/ui: it uses physical properties internally — test each component in RTL and add CSS overrides where needed
- For the dark sidebar (right-side in RTL): set `dir="ltr"` on the sidebar explicitly if it needs to remain visually anchored regardless of locale

**Phase:** Address in Phase 1 (UI foundation). Fix RTL before building any components.

---

### Pitfall 5: Soft Delete Breaking Foreign Keys and Unique Constraints

**What goes wrong:**
Soft delete (`deleted_at IS NOT NULL`) conflicts with `UNIQUE` constraints. Example: Employee number 123 at company 1 is soft-deleted. You try to create a new Employee 123 at company 1 — the `UNIQUE(employee_number, company_id)` constraint fires even though the first record is "deleted". Also, RLS policies that don't filter `deleted_at IS NULL` expose deleted rows.

**Why it happens:**
Soft delete is applied as a simple nullable timestamp column, but the database still enforces constraints on all rows, active or deleted.

**Consequences:**
- Cannot re-hire an employee with the same employee number
- Cannot restore a deleted record if a duplicate was created
- Deleted rows appear in JOIN results, corrupting reports and audit views
- RLS policies that don't filter soft-deleted rows leak deleted data

**Warning signs:**
- `duplicate key value violates unique constraint` errors when trying to create records that were previously soft-deleted
- Queries returning rows with `deleted_at IS NOT NULL` when they shouldn't
- COUNT() queries including deleted rows

**Prevention:**

1. **Partial unique indexes** instead of UNIQUE constraints:
```sql
-- Only enforce uniqueness among non-deleted rows
CREATE UNIQUE INDEX employees_active_unique
  ON employees (employee_number, company_id)
  WHERE deleted_at IS NULL;
```

2. **Views for all application queries:**
```sql
CREATE VIEW active_employees AS
  SELECT * FROM employees WHERE deleted_at IS NULL;
```

3. **RLS policies must always include** `deleted_at IS NULL` filter or use the views.

4. **FK references to soft-deleted rows:** Use a database trigger that prevents soft-deleting a parent if active children exist.

**Phase:** Address in Phase 1 (DB Schema) before any table is created.

---

### Pitfall 6: Audit Log Performance — Writing Synchronously on Every Mutation

**What goes wrong:**
Audit logging is implemented as a synchronous INSERT into an `audit_log` table on every mutation (create, update, delete). As the number of operations grows:
- Each mutation takes twice as long (user waits for audit INSERT)
- High-frequency operations (Excel import of 500 employees) create 500+ synchronous audit rows, causing timeouts
- The `audit_log` table becomes the largest table and slows down all queries
- Fetching audit history requires full table scans without proper indexing

**Why it happens:**
Audit logging is added "the easy way" — an INSERT after every mutation. No one thinks about scale until it's already slow.

**Consequences:**
- Excel import of 500 employees times out (Vercel's 10-second function limit)
- Admin dashboard audit log tab loads slowly
- Database CPU spikes on bulk operations

**Warning signs:**
- Audit log table has no composite index on `(entity_type, entity_id, created_at)`
- Audit INSERTs happen in the same transaction as the mutation
- No pagination on audit log queries (fetching all rows)
- Bulk operations trigger one audit row per row changed

**Prevention:**

1. **Use a PostgreSQL trigger for audit logging** — moves the write off the application layer:
```sql
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name, record_id, operation,
    old_data, new_data, changed_by, changed_at
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    to_jsonb(OLD),
    to_jsonb(NEW),
    auth.uid(),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

2. **Index the audit log properly:**
```sql
CREATE INDEX audit_log_entity_idx ON audit_log (table_name, record_id, changed_at DESC);
CREATE INDEX audit_log_user_idx ON audit_log (changed_by, changed_at DESC);
CREATE INDEX audit_log_date_idx ON audit_log (changed_at DESC);
```

3. **For bulk imports:** Wrap in one transaction with a single "bulk import" audit entry at the application level, not one per row.

4. **Paginate audit log queries** — never fetch all rows. Use `LIMIT 50 OFFSET N`.

5. **Partition the audit_log table by month** if volume is expected to grow significantly (vehicle fleet module will add high-frequency events).

**Phase:** Address in Phase 1 (DB Schema design) and revisited in the Excel import phase.

---

### Pitfall 7: Vercel Function Timeout on Excel Import

**What goes wrong:**
Excel import of 500 employees runs as a single Next.js Route Handler or Server Action. Vercel's Hobby/Pro plans enforce a 10-second (Hobby) or 60-second (Pro) function execution limit. Processing, validating, matching composites, and upserting 500 rows hits this limit.

**Why it happens:**
The import is built as a simple loop:
1. Parse Excel file
2. For each row: validate → lookup composite key → upsert → log audit

At 500 rows × ~50ms per DB round-trip = 25 seconds. Exceeds Hobby plan limit.

**Consequences:**
- Import silently fails mid-way — partial data imported, no error shown to user
- User imports same file again → duplicates or incorrect overwrites
- No way to know which rows succeeded

**Warning signs:**
- Import works on local dev (no timeout) but fails on Vercel
- Vercel logs show `FUNCTION_INVOCATION_TIMEOUT`
- Users report import "hanging" then showing generic error

**Prevention:**

1. **Batch upserts** — send all rows in a single `supabase.from('employees').upsert([...all rows])` call instead of one-by-one.

2. **Upgrade Vercel plan** to Pro (60-second limit) or use Vercel's Fluid compute (no limit) for import routes.

3. **Move import to Supabase Edge Function** — no Vercel timeout applies. Parse on client, POST JSON to Edge Function.

4. **Client-side preview first** — parse Excel in the browser (SheetJS), show the user a preview table, then POST the parsed JSON (not the file) to the API. This removes parsing overhead from the function.

5. **Progress feedback** — use Server-Sent Events or polling so user sees progress, not a spinner that eventually fails.

**Phase:** Address in the Excel import phase. Plan for batch upsert from Day 1.

---

### Pitfall 8: Permission System — Checking Permissions Client-Side Only

**What goes wrong:**
The UI hides buttons/tabs based on the user's permissions (loaded from `user_permissions` table). But the API routes/Server Actions that perform the actual mutations do not re-check permissions server-side. A determined user (or a script) can call the API directly, bypassing the UI restrictions.

**Why it happens:**
"The user can't see the button, so they can't do the action" — a classic client-side security mistake.

**Consequences:**
- Any user with a REST client can perform any action regardless of their assigned permissions
- RLS is the last line of defense but not the permission system
- Audit log shows unauthorized mutations with no indication they were unauthorized

**Warning signs:**
- Permission checks only appear in component render logic (`if (hasPermission) return <Button>`)
- Server Actions have no permission check at the top
- Route handlers trust `req.body` without verifying the caller's access level

**Prevention:**
Create a server-side permission check utility that must be called at the top of every mutation:
```typescript
// lib/permissions.ts
export async function requirePermission(
  supabase: SupabaseClient,
  module: string,
  subModule: string,
  level: 'read' | 'write'
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const perms = await get_user_permissions(user.id)
  const perm = perms.find(p => p.module === module && p.sub_module === subModule)

  if (!perm || !meetsLevel(perm.access_level, level)) {
    throw new Error('Forbidden')
  }
}
```
This must be called in EVERY Server Action and Route Handler that mutates data.

**Phase:** Address in Phase 1 (Auth + Permissions foundation). Define the pattern before writing any mutation.

---

## Moderate Pitfalls

---

### Pitfall 9: Excel Hebrew Date and Encoding Issues

**What goes wrong:**
Excel files from Israeli payroll systems (like the described salary system export) use Windows-1255 or CP1252 encoding. SheetJS (xlsx library) reads dates as Excel serial numbers, not JavaScript Date objects. Hebrew text in cells can appear as garbled characters if encoding is not handled explicitly. Date fields like `תאריך לידה` (date of birth) come as numbers like `44927` (Excel date serial) instead of `2023-01-01`.

**Why it happens:**
Excel has its own date epoch (Jan 1, 1900) and SheetJS defaults to keeping raw values unless you set `cellDates: true`. Encoding issues arise when the file was saved in legacy Excel format (`.xls` vs `.xlsx`).

**Warning signs:**
- Date columns showing 5-digit numbers instead of dates
- Hebrew column headers appearing as `???` or boxes
- Fields that should be dates showing as strings like `"44927"`

**Prevention:**
```typescript
import * as XLSX from 'xlsx'

const workbook = XLSX.read(buffer, {
  type: 'buffer',
  cellDates: true,     // Convert Excel dates to JS Date objects
  codepage: 1255,      // Hebrew Windows code page
})
```
Validate all date fields against a known range (e.g., birth date must be between 1930 and 2010) as a sanity check after parsing.

**Phase:** Excel import phase. Test with real exported files from the salary system before building import logic.

---

### Pitfall 10: Supabase Auth — `getSession()` vs `getUser()` Trust Issue

**What goes wrong:**
`supabase.auth.getSession()` reads the session from the cookie/localStorage without server verification. In Server Components, this session could be tampered with. `supabase.auth.getUser()` makes a round-trip to Supabase Auth to verify the JWT is valid. Using `getSession()` for security decisions in Server Components is a vulnerability.

**Why it happens:**
`getSession()` is faster and doesn't require a network call, so developers use it everywhere for convenience.

**Consequences:**
- A crafted cookie can fool your server-side permission checks into thinking a user is authenticated
- Privilege escalation attacks become possible

**Warning signs:**
- `getSession()` used in middleware.ts or Server Components for authentication decisions
- No `getUser()` call before checking permissions on the server

**Prevention:**
- In middleware and Server Components: always use `getUser()` for authentication checks
- `getSession()` is acceptable only in Client Components for reading non-sensitive session data (like displaying the user's name)

**Phase:** Phase 1 (Auth setup). This rule must be in a CLAUDE.md or coding standards doc for the project.

---

### Pitfall 11: Heebo Font — CLS and Missing Font Subsets

**What goes wrong:**
Heebo font is loaded from Google Fonts without the `display: swap` option or without pre-loading, causing Cumulative Layout Shift (CLS) — text renders in a fallback font, then jumps when Heebo loads. Additionally, if only the Latin subset is loaded, Hebrew characters fall back to the system font and look visually inconsistent.

**Why it happens:**
Next.js `next/font/google` is used without specifying the Hebrew subset explicitly.

**Warning signs:**
- Hebrew text on first load appears in a different font for 1-2 seconds
- Lighthouse CLS score above 0.1
- Characters look inconsistent (some Latin, some different Hebrew font)

**Prevention:**
```typescript
// app/layout.tsx
import { Heebo } from 'next/font/google'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  display: 'swap',
  variable: '--font-heebo',
  weight: ['300', '400', '500', '600', '700', '800'],
})
```
Use `next/font/google` (not a `<link>` tag) — Next.js automatically handles preloading and self-hosting.

**Phase:** Phase 1 (UI foundation).

---

### Pitfall 12: Deleting a User from Supabase Auth Without Cleaning Up Application Data

**What goes wrong:**
Supabase Auth users live in `auth.users` (managed by Supabase). Your application users live in your `users` table with `auth_user_id` as a FK. If you delete a user from the Supabase Auth dashboard (not via your application), the FK constraint breaks or leaves orphaned records. Conversely, soft-deleting from your `users` table doesn't remove the Auth user — they can still log in.

**Why it happens:**
The Supabase Auth table is separate from the application data model. Developers manage them independently without coordination.

**Consequences:**
- Disabled employees can still authenticate via Supabase Auth
- Dashboard shows "0 users" in your table but the person can log in
- Auth user exists with no application record → crashes on any auth.uid() lookup

**Prevention:**
- Never soft-delete a `users` record without also calling `supabase.auth.admin.deleteUser(auth_user_id)` OR disabling the Auth user
- Better: don't delete from Auth — disable the app user by setting `is_active = false` in your `users` table and enforce this via RLS: inactive users get an empty permission set
- Add a database trigger: when `users.deleted_at IS NOT NULL`, automatically revoke all `user_permissions` rows for that user

**Phase:** Phase 1 (Auth + User management design). Define this lifecycle before writing the user management screen.

---

### Pitfall 13: Next.js Server Actions — Missing Error Boundaries and Undefined State

**What goes wrong:**
Server Actions that throw uncaught errors crash the entire React tree instead of showing a user-friendly error. In forms with Hebrew validation messages, errors returned as `string` from Server Actions are not properly handled — the UI shows a generic "Something went wrong" in English even though the app is Hebrew.

**Why it happens:**
Error handling in Server Actions requires explicit `try/catch` returning a result object, not throwing. And Hebrew error strings must be returned from the server, not generated client-side from error codes.

**Warning signs:**
- Any Server Action without a `try/catch` block
- Error handling that only logs to console, not returned to the client
- Validation errors shown in English in a Hebrew UI

**Prevention:**
```typescript
// Standard Server Action pattern
export async function upsertEmployee(formData: FormData) {
  try {
    // ... logic
    return { success: true, data: employee }
  } catch (error) {
    // Return Hebrew error messages from server
    if (error instanceof ValidationError) {
      return { success: false, error: error.hebrewMessage }
    }
    return { success: false, error: 'שגיאת מערכת. נסה שנית.' }
  }
}
```

**Phase:** Phase 1 (patterns established). Document the standard Server Action pattern before writing any.

---

### Pitfall 14: RLS Policies — Forgetting to Enable RLS on New Tables

**What goes wrong:**
Every new table created in Supabase has RLS disabled by default. If a developer creates a table (e.g., `role_templates`, `system_settings`) and forgets to enable RLS, ALL authenticated and anonymous users can read and write every row.

**Why it happens:**
RLS is opt-in in Supabase. The Supabase dashboard shows a warning, but it's easy to miss during rapid development.

**Warning signs:**
- New table visible in Supabase dashboard without the green "RLS Enabled" badge
- `supabase.from('new_table').select('*')` returns data for any anon user in test

**Prevention:**
- Add this to every migration file:
```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
-- Then immediately add policies
```
- Add a CI test: query every table with the anon key and assert that it returns no rows (or specific expected rows)
- Establish a checklist: "RLS enabled + policies written" before any table goes to production

**Phase:** Phase 1 (DB Schema). Non-negotiable standard for all migrations.

---

### Pitfall 15: Composite Key Excel Matching — Silent Mismatches

**What goes wrong:**
The Excel import matches employees by `employee_number + company_id`. The `company_id` must be resolved from a company name or company number in the Excel file. If the company name in Excel doesn't exactly match the company name in the database (trailing space, different casing, Hebrew vs English company name), the match fails silently — the employee is created as a duplicate instead of updated.

**Why it happens:**
Israeli payroll exports often include company codes (not names). The mapping from Excel company code to `company_id` is not defined early enough, and no validation step shows mismatches to the user before import.

**Consequences:**
- Duplicate employee records with the same `employee_number` but different (wrong) `company_id`
- Import appears to succeed but creates new records instead of updating
- The original (correct) employee record remains outdated

**Warning signs:**
- After import, employees appear duplicated in the list
- Import "success" count doesn't match expected update count

**Prevention:**
1. Show a preview step before committing: "Found 487 matches, 13 new records — is this correct?"
2. Map Excel company codes to `company_id` explicitly in a configuration table or import wizard
3. Add a post-import validation query: count employees where `employee_number` is not unique per company and alert if > 0
4. Log every match/no-match decision in the import result report

**Phase:** Excel import phase. Design the matching and preview UI before writing any import logic.

---

## Minor Pitfalls

---

### Pitfall 16: Vercel Environment Variables Not Available at Build Time

**What goes wrong:**
Some Supabase configuration (like the database URL for Prisma or direct DB connections) is needed at build time. Vercel only injects `NEXT_PUBLIC_` variables at build time by default. Server-only variables are available at runtime, not build time.

**Prevention:**
- Know which variables are build-time vs runtime
- Use `NEXT_PUBLIC_` prefix only for anon key and Supabase URL
- Never reference server-only env vars in `next.config.js` or static generation functions without `NEXT_PHASE` guards

**Phase:** Phase 1 (Infrastructure). Document in a `.env.example` file.

---

### Pitfall 17: `updated_by` and `created_by` Not Set Automatically

**What goes wrong:**
The schema requires `created_by` and `updated_by` on every table (pointing to the user who made the change). If this is handled application-side, every developer must remember to set it. Someone forgets, and records are created with `null` in `created_by`.

**Prevention:**
Use a PostgreSQL trigger to set `created_by` and `updated_by` from `auth.uid()`:
```sql
CREATE OR REPLACE FUNCTION set_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
  END IF;
  NEW.updated_by = auth.uid();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
Apply to every table. This removes human error from the equation.

**Phase:** Phase 1 (DB Schema). Part of the standard migration template.

---

### Pitfall 18: Infinite Re-renders from Supabase Realtime Subscriptions

**What goes wrong:**
If Supabase Realtime subscriptions are set up inside a `useEffect` without proper cleanup, or if the subscription callback triggers a state update that re-renders the component and re-runs the effect, it creates an infinite subscription loop. Memory leaks and duplicate event handling result.

**Prevention:**
Always return a cleanup function from `useEffect`:
```typescript
useEffect(() => {
  const channel = supabase
    .channel('employees')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' },
      (payload) => handleChange(payload))
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, []) // Empty dependency array — subscribe once
```
For the current scale (500 employees, 50 users), Realtime is not needed. Avoid it until there is a specific requirement.

**Phase:** Any phase that introduces live data requirements.

---

### Pitfall 19: `next/image` Not Configured for External Domains

**What goes wrong:**
If logos (e.g., CA.png, Heb-ChemoIT.png) are served from cPanel (ch-ah.info) and displayed via `<Image>` (next/image), Next.js will throw a configuration error unless `ch-ah.info` is in the `images.remotePatterns` config.

**Prevention:**
```typescript
// next.config.ts
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ch-ah.info' },
    ],
  },
}
```
Or serve static assets from `/public/` folder in the Next.js project itself — simpler and avoids cross-origin issues.

**Phase:** Phase 1 (UI foundation).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| DB Schema creation | Forgetting to enable RLS on every table (Pitfall 14) | Template migration with RLS enabled + policy placeholder |
| DB Schema creation | Unique constraints broken by soft delete (Pitfall 5) | Use partial unique indexes from the start |
| DB Schema creation | Missing `created_by`/`updated_by` automation (Pitfall 17) | Trigger-based audit fields |
| Auth setup | Deprecated `auth-helpers-nextjs` package (Pitfall 3) | Use `@supabase/ssr` only, document in project CLAUDE.md |
| Auth setup | `getSession()` trusted server-side (Pitfall 10) | Code review rule: `getUser()` in all server contexts |
| Auth setup | Service role key in client code (Pitfall 2) | CI grep check for `NEXT_PUBLIC_SERVICE_ROLE` |
| Permissions system | RLS infinite recursion (Pitfall 1) | `SECURITY DEFINER` function for permission lookups |
| Permissions system | Client-side-only permission checks (Pitfall 8) | `requirePermission()` utility called in every mutation |
| User management | Auth user not disabled on soft delete (Pitfall 12) | Lifecycle design before coding user management |
| UI foundation | RTL physical CSS properties (Pitfall 4) | RTL from Day 1, logical Tailwind utilities only |
| UI foundation | Heebo font CLS (Pitfall 11) | `next/font/google` with `subsets: ['hebrew']` |
| UI foundation | Server Action errors in English (Pitfall 13) | Standard error pattern with Hebrew messages |
| Audit logging | Synchronous per-row audit writes (Pitfall 6) | Database trigger for audit, not application code |
| Excel import | Vercel function timeout (Pitfall 7) | Batch upsert, client-side parse, Pro plan |
| Excel import | Hebrew date/encoding issues (Pitfall 9) | `cellDates: true`, `codepage: 1255`, test with real files |
| Excel import | Silent composite key mismatches (Pitfall 15) | Preview step before commit, match report |
| Vercel deploy | Build-time env var availability (Pitfall 16) | Document in `.env.example` with clear labels |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| RLS pitfalls (1, 10, 14) | HIGH | Well-documented in official Supabase docs and community issues |
| Auth/SSR pitfalls (2, 3) | HIGH | Official Supabase migration guide from auth-helpers → ssr package |
| RTL pitfalls (4, 11) | HIGH | Tailwind logical properties are documented; Heebo subset is Next.js docs |
| Soft delete pitfalls (5) | HIGH | Standard PostgreSQL pattern, well-understood |
| Audit log pitfalls (6) | HIGH | Standard pattern; PostgreSQL trigger approach is industry standard |
| Vercel timeout (7) | HIGH | Vercel plan limits are documented and commonly hit |
| Permission security (8) | HIGH | Classic web security principle, extensively documented |
| Excel pitfalls (9, 15) | MEDIUM | SheetJS behavior is well-known; composite key matching is project-specific |
| Auth lifecycle (12) | HIGH | Supabase Auth admin API is documented |
| Error handling (13) | HIGH | Next.js Server Action error patterns are documented |

---

## Sources

Note: All external tools were unavailable in this research session. Findings are based on:
- Training data through August 2025 covering official Supabase docs, Next.js App Router docs, Tailwind CSS docs, SheetJS docs
- Community patterns from GitHub issues, Supabase Discord, and Next.js discussions
- ChemoSys PROJECT.md analyzed for project-specific pitfalls

Key official documentation to verify during implementation:
- https://supabase.com/docs/guides/auth/server-side/nextjs (Auth + SSR)
- https://supabase.com/docs/guides/auth/row-level-security (RLS)
- https://supabase.com/docs/guides/database/postgres/row-level-security (RLS policies)
- https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations (Server Actions)
- https://tailwindcss.com/docs/hover-focus-and-other-states (logical properties)
- https://sheetjs.com/docs/ (SheetJS Excel parsing options)
- https://vercel.com/docs/functions/runtimes#max-duration (Vercel function limits)
