# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-03-01 — Completed plan 01-03: login page, auth actions, admin shell with RTL sidebar, verifySession DAL, writeAuditLog utility

Progress: [██████░░░░] 15%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~5 min
- Total execution time: ~15 min (01-01: 6 min, 01-02: ~6 min, 01-03: ~3 min)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/4 | ~15 min | ~5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (scaffold + RTL + Supabase clients), 01-02 (DB schema), 01-03 (auth + admin shell)
- Trend: On track, accelerating

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Use @supabase/ssr exclusively — auth-helpers-nextjs is deprecated
- [Pre-Phase 1]: Set dir="rtl" on <html> from Day 1 — retrofitting RTL is expensive
- [Pre-Phase 1]: All UNIQUE constraints must be partial (WHERE deleted_at IS NULL) for soft-delete compatibility
- [Pre-Phase 1]: Use SECURITY DEFINER function for permission lookups to prevent RLS recursion
- [Pre-Phase 1]: Always use supabase.auth.getUser() in server contexts — getSession() is unverified
- [01-01]: Manual scaffold used (not create-next-app) — directory name ChemoSystem has capitals which block npm naming validation
- [01-01]: sonner used instead of deprecated toast component (shadcn/ui latest recommendation)
- [01-01]: Browser Supabase client implemented as singleton to prevent duplicate connections
- [01-01]: proxy.ts at project root (not middleware.ts) — Next.js 16 auth guard convention
- [01-02]: RLS UPDATE policies use USING (true) — allows soft-delete UPDATEs that set deleted_at (Pitfall 9)
- [01-02]: Phase 1 RLS permissive for authenticated users — business logic enforced in Server Actions
- [01-02]: All future-proofing stubs (employees, projects, users) created now so FK relationships are ready
- [Phase 01-foundation]: getClaims() in verifySession — fast local JWT check, O(1), no network; proxy.ts uses getUser() for token refresh but DAL can use getClaims()
- [Phase 01-foundation]: React cache() wraps verifySession — deduplicates JWT verification across nested layouts per request
- [Phase 01-foundation]: SidebarNav as client component inside server Sidebar — only nav needs usePathname(), rest stays SSR

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Get a real payroll Excel export file before implementing import logic — column names in Hebrew, date formats, and company identifiers must match the actual file structure
- [Phase 2]: Design the company code → company_id mapping before Phase 2 begins (mapping table? wizard step?)
- [Phase 5]: Research cPanel API capabilities for config.ini read/write before Phase 5 planning
- [Phase 4]: Decide react-leaflet vs Google Maps for project coordinates at Phase 4 planning time

## Session Continuity

Last session: 2026-03-01
Stopped at: Completed 01-03-PLAN.md — login page, auth actions, admin shell with RTL sidebar, verifySession DAL, writeAuditLog utility
Resume file: None
