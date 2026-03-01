# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 0 of 4 in current phase
Status: Ready to plan
Last activity: 2026-03-01 — Roadmap created, requirements mapped, ready to plan Phase 1

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Get a real payroll Excel export file before implementing import logic — column names in Hebrew, date formats, and company identifiers must match the actual file structure
- [Phase 2]: Design the company code → company_id mapping before Phase 2 begins (mapping table? wizard step?)
- [Phase 5]: Research cPanel API capabilities for config.ini read/write before Phase 5 planning
- [Phase 4]: Decide react-leaflet vs Google Maps for project coordinates at Phase 4 planning time

## Session Continuity

Last session: 2026-03-01
Stopped at: Roadmap created, all 59 v1 requirements mapped to 5 phases
Resume file: None
