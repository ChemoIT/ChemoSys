---
phase: 06-db-auth-foundation
plan: 01
subsystem: auth
tags: [supabase, nextjs, middleware, rls, is_admin, modules, migration]

# Dependency graph
requires:
  - phase: 05-admin-shell
    provides: "verifySession() in dal.ts, public.users table with is_admin column (migration 00012), admin layout structure"
provides:
  - "Migration 00016 with 18 app_* module keys for ChemoSys permission matrix"
  - "is_admin guard in (admin)/layout.tsx — blocks non-admin users from admin shell"
  - "Split redirect in proxy.ts — /app/* to /chemosys, /admin/* to /login"
  - "/chemosys accessible without authentication"
affects:
  - phase: 07-chemosys-login
  - phase: 08-chemosys-layout
  - phase: 09-fleet-permissions
  - phase: 10-fleet-pages

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "maybeSingle() for optional row queries — avoids throwing on 0 rows (bootstrap admin use case)"
    - "Layered auth guards: proxy (unauthenticated) → layout (authenticated but wrong role)"
    - "Path-based redirect splitting in middleware — /app/* vs /admin/*"
    - "Module key prefix convention: app_* for ChemoSys, unprefixed for admin"

key-files:
  created:
    - supabase/migrations/00016_app_modules.sql
    - .planning/phases/06-db-auth-foundation/06-01-SUMMARY.md
  modified:
    - src/app/(admin)/layout.tsx
    - src/proxy.ts

key-decisions:
  - "maybeSingle() not single() in is_admin query — bootstrap admin (Sharon before public.users row) must retain access"
  - "is_admin guard in layout, not in proxy — proxy handles unauthenticated only, layout handles role mismatch"
  - "Migration 00016 must be run manually in Supabase SQL Editor before any (app) routes go live"

patterns-established:
  - "Role-based layout guard pattern: verifySession() → query public.users is_admin → maybeSingle() → conditional redirect"
  - "Split middleware redirect: path prefix determines login page destination"

# Metrics
duration: 10min
completed: 2026-03-04
---

# Phase 6 Plan 01: DB + Auth Foundation Summary

**is_admin guard in admin layout + split proxy redirect + 18 app_* module keys migration — security foundation for ChemoSys dual-login architecture**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-04T07:57:00Z
- **Completed:** 2026-03-04T08:07:51Z
- **Tasks:** 3
- **Files modified:** 3 (+ 1 created)

## Accomplishments

- Migration 00016 with 18 idempotent app_* module keys ready for Supabase SQL Editor
- Admin shell now blocks non-admin authenticated users (is_admin=false) → redirect to /chemosys
- Proxy correctly routes unauthenticated /app/* to /chemosys, /admin/* still to /login
- /chemosys added to proxy public list — accessible without authentication
- npm run build passes cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 00016_app_modules.sql** - `acab601` (chore)
2. **Task 2: Add is_admin guard to (admin)/layout.tsx** - `a3db833` (feat)
3. **Task 3: Extend proxy.ts to redirect /app/* to /chemosys** - `7561bcf` (feat)

## Files Created/Modified

- `supabase/migrations/00016_app_modules.sql` — 18 app_* INSERT rows with ON CONFLICT DO NOTHING; ready for manual Supabase run
- `src/app/(admin)/layout.tsx` — Added createClient import, is_admin query with maybeSingle(), redirect to /chemosys for non-admin users
- `src/proxy.ts` — Added /chemosys to public exclusion list, /app/* paths redirect to /chemosys instead of /login

## Decisions Made

- **maybeSingle() not single():** The bootstrap admin user (Sharon's Supabase Auth user, created before the public.users row) has no row in public.users. `.single()` throws on 0 rows — `.maybeSingle()` returns null, which the guard treats as "allow". This preserves access for the bootstrap admin while blocking real non-admin users.
- **Guard in layout, not proxy:** The proxy handles the unauthenticated case. The is_admin guard is for authenticated users with wrong role. Mixing these in proxy would require an extra DB query on every request regardless of whether user is logged in.
- **Migration manual run:** Migration 00016 MUST be run manually in Supabase SQL Editor before any Phase 7+ (app) routes are deployed. This is a hard dependency flagged in STATE.md blockers.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **npm run build lock conflict:** On first build attempt, .next/lock was held by a running dev server. Stopped all Node processes, retried build — succeeded cleanly.

## User Setup Required

**Migration 00016 requires manual execution in Supabase.**

Before any Phase 7+ work can go live:
1. Open Supabase project → SQL Editor
2. Paste contents of `supabase/migrations/00016_app_modules.sql`
3. Run the query
4. Verify: `SELECT key FROM modules WHERE key LIKE 'app_%' ORDER BY key;` should return 18 rows

This is a hard gate — ChemoSys permission system depends on these module keys existing in the DB.

## Next Phase Readiness

- Security foundation complete — non-admin users blocked from admin shell
- Proxy routing ready — /app/* will reach ChemoSys pages (once created)
- Module keys ready in migration — permission matrix can be built in Phase 9
- **Blocker:** Migration 00016 must run before Phase 7 (ChemoSys login) is deployed

---
*Phase: 06-db-auth-foundation*
*Completed: 2026-03-04*

## Self-Check: PASSED

All files verified present. All commits verified in git log.
