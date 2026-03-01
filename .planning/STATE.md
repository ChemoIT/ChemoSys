# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-03-01 — Completed plan 01-01: Next.js 16 scaffold, RTL layout, brand theme, Supabase clients, proxy.ts

Progress: [████░░░░░░] 10%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: ~6 min
- Total execution time: ~12 min (01-01: 6 min, 01-02: ~6 min est.)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2/4 | ~12 min | ~6 min |

**Recent Trend:**
- Last 5 plans: 01-01 (scaffold + RTL + Supabase clients), 01-02 (DB schema)
- Trend: On track

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Get a real payroll Excel export file before implementing import logic — column names in Hebrew, date formats, and company identifiers must match the actual file structure
- [Phase 2]: Design the company code → company_id mapping before Phase 2 begins (mapping table? wizard step?)
- [Phase 5]: Research cPanel API capabilities for config.ini read/write before Phase 5 planning
- [Phase 4]: Decide react-leaflet vs Google Maps for project coordinates at Phase 4 planning time

## Session Continuity

Last session: 2026-03-01
Stopped at: Completed 01-01-PLAN.md — Next.js 16 scaffold, RTL Hebrew layout, brand theme, Supabase clients, proxy.ts
Resume file: None
