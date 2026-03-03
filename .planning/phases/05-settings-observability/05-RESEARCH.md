# Phase 5: Settings and Observability - Research

**Researched:** 2026-03-03
**Domain:** Next.js 16 + Supabase audit log viewer, .env file read/write at runtime, integration settings UI, dashboard stats
**Confidence:** HIGH (codebase verified) / MEDIUM (integration API fields)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard design**
- Dashboard is a **separate tab in the sidebar** (not the landing page after login)
- Stats display: Claude's discretion on layout (cards with numbers, mini-charts, etc.)
- Stats to show: active employees, active projects, total users, companies, departments, role tags
- Activity feed: **detailed list, 15-20 recent entries** from audit_log — showing who, what entity, what action, when, and on which entity
- Data loading: **fresh load on every page visit** (Server Component fetch) + **manual refresh button**
- No auto-refresh/polling

**Audit Log viewer**
- **Extended filters**: entity type dropdown, action type dropdown (CREATE/UPDATE/DELETE), free-text search, date range picker
- **50 rows per page** with pagination
- **Expandable rows**: clicking a row reveals before/after field changes (from audit_log.changes JSONB)
- **Export**: Excel/CSV export button that exports the currently filtered data (uses the universal export Route Handler from Phase 4)

**Integration management (הגדרות מערכת)**
- **5 integration types**: SMS (Micropay), WhatsApp, FTP, Telegram, LLM models (Gemini, OpenAI, etc.)
- **All config in .env** — no DB table for integrations. The settings page reads and writes to .env file
- **Type-specific fields**: each integration type has its own set of fields (Claude to determine based on each provider's API requirements; for SMS use the Micropay skill for field reference)
- **Test connection button** for each integration — sends a test request to verify config works
- **Enable/disable toggle** per integration — stored in .env as boolean
- After saving .env changes, the running process picks up the new values (implementation detail for Claude)

### Claude's Discretion
- Dashboard card layout, colors, and typography
- Exact stats to highlight (beyond the core: employees, projects, users)
- Loading skeletons and empty states
- Audit log table column order and widths
- Specific fields per integration type (research each provider's API)
- How to handle .env read/write at runtime (file system access, restart handling, etc.)
- Error state handling for failed test connections

### Deferred Ideas (OUT OF SCOPE)
- AI agent integration in vehicle fleet cards — future module, but LLM settings infrastructure prepared in this phase
- Real-time dashboard with WebSocket/polling — not needed now, fresh load is sufficient
- Audit log retention/cleanup policy — add when data volume warrants it
</user_constraints>

---

## Summary

Phase 5 has three distinct sub-domains: (1) a dashboard page, (2) an audit log viewer, and (3) an integration settings editor. The codebase is mature — TanStack Table, shadcn/ui, react-day-picker, and date-fns are already installed. The existing pattern of Server Component page + TanStack Table client component + RefreshButton is well-established and should be followed throughout.

The key technical challenge is .env read/write at runtime. Writing to `.env` via Node.js `fs` module in a Server Action is feasible — but changes do NOT automatically update `process.env` in the running process. The solution is to write the file AND mutate `process.env` in-memory (within the same Server Action call), giving immediate effect without restart. This is a deliberate, security-reviewed pattern for an admin-only settings page in a Node.js server environment.

The audit log table requires expandable rows, which is not in the existing `DataTable.tsx` (single-filter only). A dedicated `AuditLogTable.tsx` component is needed that extends the TanStack Table pattern with `getExpandedRowModel()` — the same library already used. For integration fields, each of the 5 providers has been researched and documented with concrete field names below.

**Primary recommendation:** Follow the established page-per-feature pattern, extend TanStack Table for the audit log, use `fs/promises` + in-memory `process.env` mutation for .env writes, and build a settings accordion UI using shadcn `Accordion` (already available via @radix-ui).

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | ^8.21.3 | Audit log table with expandable rows | Already used for all tables in this project |
| `react-day-picker` | ^9.14.0 | Date range picker for audit log filters | Already installed, used in project |
| `date-fns` | ^4.1.0 | Date formatting and manipulation | Already installed, paired with react-day-picker |
| `exceljs` | ^4.4.0 | Audit log Excel/CSV export | Already installed, used in export Route Handler |
| `sonner` | ^2.0.7 | Toast notifications for test connection results | Already installed in root layout |
| `lucide-react` | ^0.575.0 | Icons throughout | Already installed |
| `zod` | ^4.3.6 | Validation for settings form inputs | Already installed |

### Supporting (already installed via @radix-ui)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-tabs` | ^1.1.13 | Tab navigation between dashboard/audit/settings sub-pages | Already installed |
| `@radix-ui/react-select` | ^2.2.6 | Dropdowns for entity type and action type filters | Already installed |
| `@radix-ui/react-popover` | ^1.1.15 | Date range picker popover wrapper | Already installed |
| Node.js `fs/promises` | built-in | Read/write .env file at runtime | Server-side only, no install needed |

### New Install Needed

```bash
# No new packages required — all dependencies are already installed.
# The shadcn accordion component needs to be added via CLI (it copies component code, no npm install):
npx shadcn@latest add accordion
npx shadcn@latest add switch
```

Note: `accordion` and `switch` are shadcn UI components (they copy source into `src/components/ui/`). They depend on `@radix-ui/react-accordion` and `@radix-ui/react-switch` which shadcn will install automatically.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending TanStack Table for expandable rows | Build custom accordion table | TanStack already installed, `getExpandedRowModel()` is built-in — no reason to hand-roll |
| In-memory `process.env` mutation after fs write | Restart Next.js server | Restart is disruptive for admin; in-memory mutation takes effect immediately for current process |
| Accordion sections per integration | Tab per integration | Accordion is more compact, shows all integrations on one screen |

---

## Architecture Patterns

### Recommended Project Structure for Phase 5

```
src/
├── app/(admin)/admin/
│   ├── dashboard/
│   │   └── page.tsx               # Server Component — stats + activity feed
│   ├── audit-log/
│   │   └── page.tsx               # Server Component — fetches initial page + filter options
│   └── settings/
│       └── page.tsx               # Server Component — reads .env, renders settings UI
│
├── components/admin/
│   ├── dashboard/
│   │   ├── StatsCards.tsx         # Client: 6 stat cards (employees, projects, users, companies, depts, role_tags)
│   │   └── ActivityFeed.tsx       # Client: 15-20 recent audit_log entries list
│   ├── audit-log/
│   │   ├── AuditLogTable.tsx      # Client: TanStack Table with expandable rows + filters
│   │   ├── AuditLogFilters.tsx    # Client: entity type, action, text search, date range
│   │   └── AuditLogExportButton.tsx  # Client: triggers export route handler with current filters
│   └── settings/
│       ├── IntegrationAccordion.tsx  # Client: accordion with all 5 integration sections
│       ├── SmsSettings.tsx           # Client: Micropay SMS fields
│       ├── WhatsAppSettings.tsx      # Client: Meta WhatsApp Cloud API fields
│       ├── FtpSettings.tsx           # Client: FTP/SFTP fields
│       ├── TelegramSettings.tsx      # Client: Telegram Bot fields
│       └── LlmSettings.tsx           # Client: LLM provider selection + fields
│
├── actions/
│   └── settings.ts               # Server Actions: readEnvSettings, saveIntegration, testIntegration
│
└── lib/
    └── env-settings.ts           # Server-only: typed .env read/write helpers
```

### Pattern 1: Dashboard — Server Component Stats Fetch

**What:** `page.tsx` runs parallel Supabase count queries and passes results to client components.
**When to use:** Fresh load on every visit (no caching). No client-side state needed for initial render.

```typescript
// src/app/(admin)/admin/dashboard/page.tsx
// Source: established pattern from EmployeesPage + ProjectsPage in this codebase

import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { StatsCards } from '@/components/admin/dashboard/StatsCards'
import { ActivityFeed } from '@/components/admin/dashboard/ActivityFeed'
import { RefreshButton } from '@/components/shared/RefreshButton'

export default async function DashboardPage() {
  await verifySession()
  const supabase = await createClient()

  // Parallel fetch — counts + recent activity
  const [
    employeeCount,
    projectCount,
    userCount,
    companyCount,
    deptCount,
    roleTagCount,
    activityRes,
  ] = await Promise.all([
    supabase.from('employees').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('users').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('companies').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('departments').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('role_tags').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('audit_log')
      .select('id, created_at, action, entity_type, entity_id, user_id, users!inner(full_name)')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const stats = {
    employees: employeeCount.count ?? 0,
    projects: projectCount.count ?? 0,
    users: userCount.count ?? 0,
    companies: companyCount.count ?? 0,
    departments: deptCount.count ?? 0,
    roleTags: roleTagCount.count ?? 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">דשבורד</h1>
        <RefreshButton />
      </div>
      <StatsCards stats={stats} />
      <ActivityFeed entries={activityRes.data ?? []} />
    </div>
  )
}
```

### Pattern 2: Audit Log — Server Component with Client TanStack Table

**What:** Server component fetches the first page of audit_log with distinct entity_types and actions for filter dropdowns. Client component handles filtering, pagination, expandable rows entirely client-side from a pre-fetched dataset (or via Server Actions for filtered queries).

**Decision: Client-side filtering vs Server-side filtering**

The audit_log can grow large. The two approaches are:
- **Client-side filtering:** Fetch all rows (or a large batch), filter in TanStack Table — simple but not scalable.
- **Server-side filtering:** Use URL search params + Server Component re-fetch on filter change — scalable, matches Next.js App Router patterns.

**Use Server-side filtering** (URL search params pattern). The page re-renders with new data when filters change via `router.push` with search params. This matches `fresh load on every page visit` requirement and avoids fetching thousands of audit rows to the client.

```typescript
// src/app/(admin)/admin/audit-log/page.tsx
// Server Component — reads search params, fetches filtered page
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { AuditLogTable } from '@/components/admin/audit-log/AuditLogTable'

type SearchParams = {
  entity?: string
  action?: string
  search?: string
  from?: string   // ISO date string
  to?: string     // ISO date string
  page?: string
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await verifySession()
  const supabase = await createClient()
  const params = await searchParams

  const page = parseInt(params.page ?? '1', 10)
  const PAGE_SIZE = 50
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Build filtered query
  let query = supabase
    .from('audit_log')
    .select('*, users!left(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.entity) query = query.eq('entity_type', params.entity)
  if (params.action) query = query.eq('action', params.action)
  if (params.from)   query = query.gte('created_at', params.from)
  if (params.to)     query = query.lte('created_at', params.to + 'T23:59:59Z')
  // Note: free-text search on entity_type or action — Supabase ilike filter:
  if (params.search) query = query.or(`entity_type.ilike.%${params.search}%,action.ilike.%${params.search}%`)

  const { data, count } = await query

  // Fetch distinct entity types for filter dropdown
  const { data: entityTypes } = await supabase
    .from('audit_log')
    .select('entity_type')
    // Use distinct via RPC or just get all unique in JS:
    .limit(1000)

  const distinctEntities = [...new Set((entityTypes ?? []).map((r: { entity_type: string }) => r.entity_type))]

  return (
    <AuditLogTable
      rows={data ?? []}
      totalCount={count ?? 0}
      pageSize={PAGE_SIZE}
      currentPage={page}
      entityTypes={distinctEntities}
      currentFilters={params}
    />
  )
}
```

### Pattern 3: .env Read/Write at Runtime (CRITICAL DECISION)

**What:** Read current .env values in a Server Action, write updated values using Node.js `fs/promises`, and immediately update `process.env` in-memory so current process reflects new values without restart.

**Why in-memory mutation is required:** Writing to `.env` on disk alone does NOT update `process.env` in the running process. The file is only read at startup. To make settings take effect immediately (e.g., test connection right after save), we must also update `process.env[key] = value` in the Server Action.

**Security constraint:** This Server Action must be `'use server'` + called only from `verifySession()`-guarded paths. The `.env` file path must be hardcoded to `process.cwd() + '/.env.local'` (never user-controlled).

```typescript
// src/lib/env-settings.ts  (server-only)
import 'server-only'
import * as fs from 'fs/promises'
import * as path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env.local')

/** Read all current .env.local values as a Record */
export async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(ENV_PATH, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      result[key] = val
    }
    return result
  } catch {
    return {}  // .env.local doesn't exist yet — return empty
  }
}

/** Write/update specific keys in .env.local (preserves other keys) */
export async function writeEnvValues(updates: Record<string, string>): Promise<void> {
  const current = await readEnvFile()
  const merged = { ...current, ...updates }

  // Rebuild file content
  let content = ''
  for (const [key, val] of Object.entries(merged)) {
    // Quote values that contain spaces
    const quoted = val.includes(' ') ? `"${val}"` : val
    content += `${key}=${quoted}\n`
  }

  await fs.writeFile(ENV_PATH, content, 'utf-8')

  // CRITICAL: Also update process.env in-memory for immediate effect
  for (const [key, val] of Object.entries(updates)) {
    process.env[key] = val
  }
}
```

### Pattern 4: TanStack Table Expandable Rows for Audit Log

**What:** Use `getExpandedRowModel()` from `@tanstack/react-table` to render a detail panel when a row is clicked. The detail panel shows `old_data` and `new_data` from the `audit_log.changes` JSONB column (in this schema: `old_data` and `new_data` columns).

**Note on audit_log schema:** The migration in `00001_foundation_schema.sql` uses `old_data` and `new_data` columns (not `changes`). The CONTEXT.md mentions "before/after field changes (from audit_log.changes JSONB)" but the actual column names are `old_data` and `new_data`. Use the actual schema.

```typescript
// Source: @tanstack/react-table v8 docs — getExpandedRowModel
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  type ExpandedState,
} from '@tanstack/react-table'
import { useState } from 'react'

// In the component:
const [expanded, setExpanded] = useState<ExpandedState>({})

const table = useReactTable({
  data: rows,
  columns,
  state: { expanded },
  onExpandedChange: setExpanded,
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getRowCanExpand: () => true,
})

// In the column definition — add expander column:
{
  id: 'expander',
  header: '',
  cell: ({ row }) => (
    <button onClick={row.getToggleExpandedHandler()}>
      {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
    </button>
  ),
}

// In the table body — render expanded detail row:
{row.getIsExpanded() && (
  <TableRow>
    <TableCell colSpan={columns.length} className="bg-muted/30 p-4">
      <AuditDiffView oldData={row.original.old_data} newData={row.original.new_data} />
    </TableCell>
  </TableRow>
)}
```

### Pattern 5: Integration Settings Accordion + Server Actions

**What:** Settings page reads `.env.local` values via a Server Action on load, displays fields per integration type in a shadcn Accordion. Save triggers a Server Action that validates, writes to `.env.local`, and updates `process.env`.

```typescript
// src/actions/settings.ts
'use server'
import { verifySession } from '@/lib/dal'
import { revalidatePath } from 'next/cache'
import { readEnvFile, writeEnvValues } from '@/lib/env-settings'

export async function getIntegrationSettings() {
  await verifySession()
  const env = await readEnvFile()

  return {
    sms: {
      enabled: env['SMS_ENABLED'] === 'true',
      token: env['SMS_TOKEN'] ?? '',
      fromName: env['SMS_FROM_NAME'] ?? '',
    },
    whatsapp: {
      enabled: env['WHATSAPP_ENABLED'] === 'true',
      accessToken: env['WHATSAPP_ACCESS_TOKEN'] ?? '',
      phoneNumberId: env['WHATSAPP_PHONE_NUMBER_ID'] ?? '',
    },
    ftp: {
      enabled: env['FTP_ENABLED'] === 'true',
      host: env['FTP_HOST'] ?? '',
      port: env['FTP_PORT'] ?? '21',
      username: env['FTP_USERNAME'] ?? '',
      password: env['FTP_PASSWORD'] ?? '',
    },
    telegram: {
      enabled: env['TELEGRAM_ENABLED'] === 'true',
      botToken: env['TELEGRAM_BOT_TOKEN'] ?? '',
      chatId: env['TELEGRAM_CHAT_ID'] ?? '',
    },
    llm: {
      enabled: env['LLM_ENABLED'] === 'true',
      provider: env['LLM_PROVIDER'] ?? 'openai',
      modelName: env['LLM_MODEL_NAME'] ?? '',
      apiKey: env['LLM_API_KEY'] ?? '',
    },
  }
}

export async function saveIntegrationSettings(
  integration: string,
  values: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  await verifySession()

  try {
    await writeEnvValues(values)
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (err) {
    console.error('[settings] Failed to save integration:', err)
    return { success: false, error: 'שגיאה בשמירת ההגדרות' }
  }
}
```

### Pattern 6: Test Connection — Server Action per Integration

Each integration's "Test Connection" button calls a dedicated Server Action that makes a real API call with the current settings and returns success/failure.

```typescript
// src/actions/settings.ts — test connection actions
export async function testSmsConnection(): Promise<{ ok: boolean; message: string }> {
  await verifySession()

  const token = process.env['SMS_TOKEN'] ?? ''
  if (!token) return { ok: false, message: 'אין token מוגדר' }

  try {
    const url = new URL('http://www.micropay.co.il/ExtApi/ScheduleSms.php')
    url.searchParams.set('get', '1')
    url.searchParams.set('token', token)
    url.searchParams.set('msg', 'Test')
    url.searchParams.set('list', '0521234567')  // dummy number — just tests auth
    url.searchParams.set('charset', 'iso-8859-8')
    url.searchParams.set('from', process.env['SMS_FROM_NAME'] ?? 'Test')

    const res = await fetch(url.toString(), { method: 'GET' })
    const text = await res.text()
    // Micropay returns error text on failure, numeric ID on success
    const ok = /^\d+/.test(text.trim())
    return { ok, message: ok ? 'חיבור SMS תקין' : `שגיאה: ${text}` }
  } catch (err) {
    return { ok: false, message: `שגיאת רשת: ${String(err)}` }
  }
}
```

### Pattern 7: Audit Log Export — Extend Existing Route Handler

The existing `/api/export` Route Handler in `(admin)/api/export/route.ts` has a hardcoded `ALLOWED_TABLES` whitelist that currently excludes `audit_log`. For the audit log export, there are two approaches:

**Option A:** Add `audit_log` to `ALLOWED_TABLES` with a special "no soft delete filter" code path.
**Option B:** Create a new Route Handler at `(admin)/api/export-audit/route.ts` that accepts filter params (entity, action, from, to) and exports only filtered rows.

**Use Option B.** The existing export handler is designed for simple table exports. The audit log export needs to pass the current filter state (entity type, action, date range) as query params. A separate handler keeps concerns clean and avoids polluting the existing export handler with conditional logic.

```
GET /api/export-audit?entity=employees&action=UPDATE&from=2026-01-01&to=2026-03-03&format=xlsx
```

### Anti-Patterns to Avoid

- **Do NOT use `import fs from 'fs'` in a Client Component** — will break build. Only `'use server'` files or `server-only` modules can use `fs`.
- **Do NOT use `getSession()` or `getUser()` in settings Server Actions** — use `verifySession()` from `@/lib/dal` (established pattern).
- **Do NOT store secrets in the audit log** — when writing `new_data` to audit_log, sanitize out any `password`, `token`, `api_key` fields.
- **Do NOT use `searchParams` directly in a client component without awaiting** — in Next.js 16 App Router, `searchParams` in a page is a Promise; must be awaited.
- **Do NOT render raw JSONB diff without null checks** — `old_data` and `new_data` in audit_log can be null (INSERT has no old_data, DELETE has no new_data).
- **Do NOT hardcode test phone number as a real number in testSmsConnection** — Micropay will send an actual SMS. Use a clearly fake non-routable number or better: use a "query balance" API endpoint if Micropay provides one (research at implementation time).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expandable table rows | Custom div-based accordion table | `getExpandedRowModel()` from `@tanstack/react-table` | Already installed, handles row state, accessibility, keyboard nav |
| Date range picker | Custom two-input date component | `react-day-picker` (already installed) with shadcn Popover | Handles calendar navigation, locale, range selection edge cases |
| .env file parser | Custom regex line-by-line parser | Custom (see Pattern 3) — BUT the parsing logic is simple enough to hand-write for this specific use case | No npm package needed; `dotenv` is read-only and doesn't write |
| JSON diff viewer | Custom recursive diff component | Build a simple `AuditDiffView` component — OR use `json-diff` npm package | For Phase 5, a simple key-by-key comparison is sufficient; full diff library is overkill |
| Toast notifications on test connection | Custom alert/modal | `sonner` toast (already installed) | Already in root layout; `toast.success()` / `toast.error()` are 1-line calls |
| Switch/toggle for enable/disable | Custom styled checkbox | shadcn `Switch` component (add via `npx shadcn@latest add switch`) | Accessible, RTL-safe, consistent with design system |
| Accordion sections | Custom expand/collapse divs | shadcn `Accordion` (add via `npx shadcn@latest add accordion`) | Accessible, animated, consistent with design system |

**Key insight:** This phase reuses all already-installed libraries. The only "new" things are: (1) shadcn Accordion + Switch UI components (CLI copy, not npm install), and (2) the custom `env-settings.ts` read/write helper.

---

## Common Pitfalls

### Pitfall 1: audit_log Schema — Column Name Mismatch
**What goes wrong:** CONTEXT.md refers to "audit_log.changes JSONB" for before/after data, but the actual migration (`00001_foundation_schema.sql`) defines `old_data JSONB` and `new_data JSONB` — there is no `changes` column.
**Why it happens:** CONTEXT.md was written from a conceptual description, not from reading the actual schema.
**How to avoid:** Always query `old_data` and `new_data` in audit_log queries. If expanding rows, display `old_data` on the left and `new_data` on the right.
**Warning signs:** Supabase query returns `null` for a "changes" field that doesn't exist.

### Pitfall 2: audit_log User Join — No FK to `public.users`
**What goes wrong:** `audit_log.user_id` references `auth.users(id)` — not `public.users`. You cannot do `.select('*, users!inner(full_name)')` to get the display name from `public.users`.
**Why it happens:** The audit_log was created before `public.users` table and references `auth.users` directly.
**How to avoid:** Join `public.users` separately: `.select('*, public_users:users!audit_log_user_id_fkey(full_name, email)')` won't work. Instead, do a two-query pattern: (1) fetch audit_log rows, (2) fetch user display names from `public.users` where `auth_user_id IN (...)`, merge in JS. OR add a Supabase view that joins them. The simplest safe approach: display `user_id` UUID truncated, and separately query `public.users` for display names.
**Warning signs:** Supabase PostgREST error "Could not find a relationship between..." on the user join.

### Pitfall 3: .env Write — File Location
**What goes wrong:** Writing to `.env` instead of `.env.local`. Next.js uses `.env.local` for local overrides (gitignored). Writing to `.env` risks committing secrets to git.
**Why it happens:** Confusion between the various `.env*` files Next.js supports.
**How to avoid:** Always write to `.env.local` (`path.join(process.cwd(), '.env.local')`). Never write to `.env` (which may be committed to git).
**Warning signs:** `.env` appearing in git diff after a settings save.

### Pitfall 4: process.env Mutation — TypeScript Error
**What goes wrong:** TypeScript may complain about `process.env[key] = value` because `process.env` values are typed as `string | undefined`, but assigning is valid at runtime.
**Why it happens:** TypeScript strict typing of `process.env` index signature.
**How to avoid:** Use `process.env[key] = value` (direct assignment works at runtime in Node.js). Add `// eslint-disable-next-line` comment if the linter objects, or cast: `(process.env as Record<string, string>)[key] = value`.

### Pitfall 5: Dashboard — audit_log User Display Name
**What goes wrong:** The activity feed shows raw UUIDs instead of user names for `user_id`.
**Why it happens:** Same FK mismatch as Pitfall 2 — `audit_log.user_id` → `auth.users`, not `public.users`.
**How to avoid:** For the dashboard activity feed (limited to 15-20 rows), do a separate query to `public.users` with `auth_user_id IN (...)` to get display names, then merge by UUID. This is acceptable at this small scale.

### Pitfall 6: Date Range Filter — Timezone Issues
**What goes wrong:** Date range filter cuts off records at the wrong time due to UTC vs local time.
**Why it happens:** `audit_log.created_at` is `TIMESTAMPTZ` (UTC). The date picker returns dates in local timezone.
**How to avoid:** When building the Supabase query, treat the "to" date as end-of-day UTC: `to + 'T23:59:59.999Z'`. For the "from" date, use start-of-day UTC: `from + 'T00:00:00.000Z'`. `date-fns` functions `startOfDay`, `endOfDay`, and `formatISO` help with this.

### Pitfall 7: Next.js 16 searchParams — Must Be Awaited
**What goes wrong:** TypeScript error or runtime error when reading `searchParams.entity` in a Next.js 16 page Server Component.
**Why it happens:** In Next.js 16, `searchParams` is a `Promise<Record<string, string>>` — must be `await`ed before use.
**How to avoid:** Always `const params = await searchParams` at the top of the page component.
**Warning signs:** TypeScript error "Property 'entity' does not exist on type 'Promise<...>'"

### Pitfall 8: Audit Log Export — Passing Filter State
**What goes wrong:** The export button exports ALL audit_log rows instead of the currently filtered view.
**Why it happens:** The export Route Handler doesn't receive the client-side filter state.
**How to avoid:** The export button reads the current URL search params (entity, action, from, to) and appends them to the export URL: `GET /api/export-audit?entity=...&action=...&from=...&to=...`. The Route Handler applies the same filters as the page.

---

## Integration Fields Reference

### SMS — Micropay
Source: `C:/Users/Alias/.claude/skills/send-sms-micropay/SKILL.md` (HIGH confidence — project-specific skill)

| Field | Env Key | Description | Example |
|-------|---------|-------------|---------|
| Enabled | `SMS_ENABLED` | Toggle | `true` |
| Token | `SMS_TOKEN` | Auth token (16nI8fd...) | `16nI8fd3c366...` |
| From Name | `SMS_FROM_NAME` | Sender ID (max 11 chars) | `Chemo IT` |

API endpoint: `http://www.micropay.co.il/ExtApi/ScheduleSms.php`
Method: GET with `get=1&token=&msg=&list=&charset=iso-8859-8&from=`

### WhatsApp — Meta Cloud API
Source: WebSearch + n8n docs (MEDIUM confidence)

| Field | Env Key | Description |
|-------|---------|-------------|
| Enabled | `WHATSAPP_ENABLED` | Toggle |
| Access Token | `WHATSAPP_ACCESS_TOKEN` | System user permanent token from Meta Business Manager |
| Phone Number ID | `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from Meta Cloud API console |
| Business Account ID | `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional — needed for management API |

API endpoint: `https://graph.facebook.com/v18.0/{phone-number-id}/messages`

### FTP/SFTP
Source: Standard FTP/SFTP protocol (HIGH confidence — universally documented)

| Field | Env Key | Description | Default |
|-------|---------|-------------|---------|
| Enabled | `FTP_ENABLED` | Toggle | |
| Protocol | `FTP_PROTOCOL` | `ftp` or `sftp` | `ftp` |
| Host | `FTP_HOST` | Server hostname or IP | |
| Port | `FTP_PORT` | Port number | `21` (FTP) / `22` (SFTP) |
| Username | `FTP_USERNAME` | Auth username | |
| Password | `FTP_PASSWORD` | Auth password | |
| Remote Path | `FTP_REMOTE_PATH` | Base path on server | `/` |

### Telegram Bot
Source: Telegram Bot API official docs (HIGH confidence)

| Field | Env Key | Description |
|-------|---------|-------------|
| Enabled | `TELEGRAM_ENABLED` | Toggle |
| Bot Token | `TELEGRAM_BOT_TOKEN` | Token from BotFather (format: `123456:ABC-DEF...`) |
| Chat ID | `TELEGRAM_CHAT_ID` | Target chat or group ID (can be negative for groups) |

API endpoint: `https://api.telegram.org/bot{token}/sendMessage`
Test: `https://api.telegram.org/bot{token}/getMe`

### LLM — OpenAI / Gemini (forward-looking)
Source: Standard LLM API patterns (HIGH confidence)

| Field | Env Key | Description |
|-------|---------|-------------|
| Enabled | `LLM_ENABLED` | Toggle |
| Provider | `LLM_PROVIDER` | `openai` or `gemini` |
| Model Name | `LLM_MODEL_NAME` | e.g., `gpt-4o`, `gemini-1.5-pro` |
| API Key | `LLM_API_KEY` | API key for the selected provider |
| Base URL | `LLM_BASE_URL` | Optional override for OpenAI-compatible endpoints |

Test for OpenAI: `GET https://api.openai.com/v1/models` with `Authorization: Bearer {key}`
Test for Gemini: `GET https://generativelanguage.googleapis.com/v1beta/models?key={key}`

---

## Code Examples

### Audit Log Diff View Component

```typescript
// src/components/admin/audit-log/AuditDiffView.tsx
// Renders a side-by-side (or stacked) view of old_data vs new_data

type AuditDiffViewProps = {
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  action: string
}

export function AuditDiffView({ oldData, newData, action }: AuditDiffViewProps) {
  if (action === 'INSERT') {
    return <JsonBlock label="נתונים חדשים" data={newData} colorClass="text-green-600" />
  }
  if (action === 'DELETE') {
    return <JsonBlock label="נתונים שנמחקו" data={oldData} colorClass="text-red-600" />
  }

  // UPDATE — show only changed keys
  const allKeys = new Set([
    ...Object.keys(oldData ?? {}),
    ...Object.keys(newData ?? {}),
  ])

  const changedKeys = [...allKeys].filter(
    (k) => JSON.stringify((oldData ?? {})[k]) !== JSON.stringify((newData ?? {})[k])
  )

  if (changedKeys.length === 0) {
    return <p className="text-muted-foreground text-sm">אין שינויים מזוהים</p>
  }

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="font-semibold text-red-600 mb-1">לפני</p>
        <pre className="bg-red-50 dark:bg-red-950/30 rounded p-2 overflow-auto text-xs">
          {JSON.stringify(
            Object.fromEntries(changedKeys.map((k) => [k, (oldData ?? {})[k]])),
            null, 2
          )}
        </pre>
      </div>
      <div>
        <p className="font-semibold text-green-600 mb-1">אחרי</p>
        <pre className="bg-green-50 dark:bg-green-950/30 rounded p-2 overflow-auto text-xs">
          {JSON.stringify(
            Object.fromEntries(changedKeys.map((k) => [k, (newData ?? {})[k]])),
            null, 2
          )}
        </pre>
      </div>
    </div>
  )
}
```

### Date Range Picker with react-day-picker (existing library)

```typescript
// Pattern: Popover + Calendar from shadcn, using react-day-picker DateRange
// Source: react-day-picker v9 docs — already installed in this project

import { useState } from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'  // Hebrew locale
import { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'  // shadcn Calendar
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {value?.from
            ? `${format(value.from, 'dd/MM/yyyy')} — ${value.to ? format(value.to, 'dd/MM/yyyy') : '...'}`
            : 'טווח תאריכים'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          locale={he}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
```

### Stats Card Component Pattern

```typescript
// Pattern: Simple card grid using shadcn Card — consistent with project design
// 6 cards in a responsive grid (2 cols mobile, 3 cols tablet, 6 cols desktop)

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FolderKanban, UserCog, Building2, Network, Tags } from 'lucide-react'

type Stats = {
  employees: number
  projects: number
  users: number
  companies: number
  departments: number
  roleTags: number
}

const STAT_ITEMS = [
  { key: 'employees',   label: 'עובדים פעילים',  icon: Users,        color: 'text-blue-500' },
  { key: 'projects',    label: 'פרויקטים פעילים', icon: FolderKanban, color: 'text-green-500' },
  { key: 'users',       label: 'יוזרים',          icon: UserCog,      color: 'text-purple-500' },
  { key: 'companies',   label: 'חברות',            icon: Building2,    color: 'text-orange-500' },
  { key: 'departments', label: 'מחלקות',           icon: Network,      color: 'text-teal-500' },
  { key: 'roleTags',    label: 'תגיות תפקיד',     icon: Tags,         color: 'text-pink-500' },
] as const

export function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {STAT_ITEMS.map(({ key, label, icon: Icon, color }) => (
        <Card key={key}>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon className={`h-4 w-4 ${color}`} />
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats[key].toLocaleString('he-IL')}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Config.ini for settings | `.env.local` with visual editor UI | Aligns with 12-factor app principles, works with Next.js env loading |
| Poll audit log for updates | Fresh load on page visit + manual refresh | Sufficient for admin-only use case; avoids WebSocket complexity |
| Separate DB table for integration config | .env file with Server Action read/write | No migration needed, simpler implementation for admin-only tool |
| `process.env` read-only assumption | Write `.env.local` + mutate `process.env` in-memory | Makes settings take effect immediately in the same Node.js process |

**Deprecated/outdated:**
- `dotenv` npm package for write: `dotenv` is read-only. Use `fs/promises` directly.
- `update-dotenv` npm package: Unnecessary extra dependency for this use case — the custom `writeEnvValues` helper is simpler.
- `Config.ini`: Not used — per locked decision in CONTEXT.md.

---

## Open Questions

1. **audit_log user display name join**
   - What we know: `audit_log.user_id` references `auth.users(id)`, not `public.users`. `public.users` has `auth_user_id` and `full_name`.
   - What's unclear: Whether PostgREST allows joining `audit_log → public.users` via the `auth_user_id` FK despite the primary FK being to `auth.users`.
   - Recommendation: Use a two-step approach at implementation — fetch audit rows, then fetch `public.users` where `auth_user_id IN (distinct user_ids)`. Alternatively, create a Supabase database view `audit_log_with_users` that does the join at the DB level. The view approach is cleaner for the planner to specify.

2. **Test connection for SMS — real SMS sent**
   - What we know: The Micropay API sends a real SMS when called. There is no documented "dry run" or "verify token" endpoint.
   - What's unclear: Whether Micropay has a balance-check or token-validation endpoint that doesn't send a message.
   - Recommendation: For the test connection, check the Micropay API response from a minimal request (the skill shows success returns a numeric ID). Use a clearly fake number format like `0500000000` and note in the UI that a test SMS will be sent to that number. Or better: at implementation time, try `GET http://www.micropay.co.il/ExtApi/GetBalance.php?token=...` — many SMS providers offer this without sending a message.

3. **Expandable rows — TanStack Table server-side pagination compatibility**
   - What we know: TanStack Table `getExpandedRowModel()` works with client-side data arrays. When using server-side pagination (fetching one page at a time), expanded state is per-page.
   - What's unclear: Whether expanded rows from page 1 need to persist when navigating to page 2.
   - Recommendation: Expanded state does not need to persist across pages — collapsing on page change is standard UX and acceptable for an audit log.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/app/(admin)/api/export/route.ts` — existing export Route Handler pattern
- Codebase: `src/lib/audit.ts` — audit_log write pattern and column names
- Codebase: `supabase/migrations/00001_foundation_schema.sql` — actual audit_log table definition (`old_data`, `new_data` columns)
- Codebase: `src/components/shared/DataTable.tsx` — TanStack Table pattern
- Codebase: `src/components/shared/RefreshButton.tsx` — refresh pattern
- Codebase: `src/lib/dal.ts` — verifySession pattern
- Codebase: `src/components/shared/SidebarNav.tsx` — confirmed `settings` module key and `/admin/settings` route
- Skill: `C:/Users/Alias/.claude/skills/send-sms-micropay/SKILL.md` — Micropay SMS API fields (project-verified)
- `package.json` — confirmed all libraries (tanstack/react-table, react-day-picker, date-fns, exceljs, sonner, zod) already installed

### Secondary (MEDIUM confidence)
- n8n docs for WhatsApp Business Cloud credentials: `https://docs.n8n.io/integrations/builtin/credentials/whatsapp/` — `access_token` + `phone_number_id` fields
- Telegram Bot API official docs: `https://core.telegram.org/bots/api` — `bot_token` + `chat_id` required fields
- Next.js official docs: `https://nextjs.org/docs/pages/guides/environment-variables` — environment variable loading behavior

### Tertiary (LOW confidence)
- WebSearch: Node.js `process.env` in-memory mutation pattern — confirmed feasible in multiple community sources but not official Next.js docs
- WebSearch: `update-dotenv` npm package — exists but deemed unnecessary for this use case

---

## Metadata

**Confidence breakdown:**
- Dashboard stats pattern: HIGH — identical to existing page patterns in codebase
- Audit log table with expandable rows: HIGH — TanStack Table already installed, `getExpandedRowModel()` is documented API
- Audit log filters (date range, dropdowns): HIGH — react-day-picker and @radix-ui/react-select already installed
- .env read/write approach: MEDIUM — `fs/promises` is Node.js built-in; `process.env` mutation is valid but non-standard
- Integration API fields (SMS): HIGH — verified from project skill file
- Integration API fields (WhatsApp, Telegram, FTP, LLM): MEDIUM — standard fields confirmed from official/semi-official docs
- Audit log user name join: MEDIUM — FK structure verified from migration, join approach needs testing at implementation

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (30 days — stable stack, all libraries locked versions)
