# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** v2.1 Performance & UX — Phase 20 (Performance Standards)

## Current Position

Phase: 20 of 23 (Performance Standards)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-03-09 — Roadmap v2.1 created (phases 20-23 defined)

Progress: v2.1 [░░░░░░░░░░░░░░░░░░░░░░░░░] 0%

## Strategic Decision (Session #18)

**החלטה:** לא מפתחים Phase 10 (Equipment) עכשיו.
**במקום:** שרון יאפיין את מודול הרכבים (fleet vehicles) באופן מלא → פיתוח → ואז איפיון צמ"ה.
**הסיבה:** עדיף לבנות מודול שלם ומאופיין לעומק מאשר שלד של שני מודולים.

## v1.0 Summary

- **Phases:** 6 (1, 2, 3, 3.1, 4, 5)
- **Plans:** 20
- **Commits:** 102
- **Codebase:** 106 TS files, 17,440 LOC + 1,558 SQL
- **Timeline:** 2026-03-01 → 2026-03-04 (3 days)
- **Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

## v2.0 Summary (Phases 6–9)

- **FleetSidebar**: shadcn sidebar RTL, side="right", SidebarProvider wraps sidebar+content, collapsible="icon"
- **Fleet routes**: /app/fleet (dashboard), /app/fleet/driver-card, /app/fleet/vehicle-card, + 9 sub-module placeholders
- **Key pattern**: FleetSidebar accepts children — acts as layout shell, SidebarProvider scoped to fleet only

## v2.1 Roadmap (NEW)

**Reference implementation:** דף דלק (`/app/fleet/fuel`) — Suspense + FuelPageSkeleton + React.cache + DB view + RPC

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 20 | IRON RULE + מסמך סטנדרט + boilerplate | RULE-01, -02, -03 | Not started |
| 21 | App pages — Suspense + Skeleton + loading | SKEL-APP-01–04, LOAD-01–04 | Not started |
| 22 | Admin pages — Suspense + Skeleton + loading | SKEL-ADM-01–08, LOAD-05 | Not started |
| 23 | DB optimization + React.cache + save states | DBOPT-01–05, LOAD-06 | Not started |

## Accumulated Context

### Key Decisions (v2.1 Relevant)

- **[fuel-session40]** fuel_records_enriched VIEW with LATERAL JOINs = reference pattern for DB enrichment
- **[fuel-session40]** get_fuel_stats() RPC = reference pattern for aggregated stats (replaces JS loop over rows)
- **[fuel-session40]** React.cache() on getProjectsForFuelFilter = reference pattern for deduplication
- **[fuel-session40]** FuelPageSkeleton = animated shimmer bar at top of page = reference skeleton pattern
- **[fuel-session40]** Loading indicator = spinner + "מעדכן נתונים..." text (replaces opacity-only) = reference pattern

### Pending Todos

None.

### Blockers/Concerns

- Migration 00036 (fuel_records_enriched view + get_fuel_stats RPC) — **must run in Supabase SQL Editor before Phase 21**
- Migrations 00027+00028: RUN ✓ — vehicle card redesign schema live
- Migrations 00025+00026: RUN ✓ — vehicle module DB foundation complete
- Phase 21 depends on Phase 20 (standards must be documented before implementation)
- Phase 23 depends on Phase 21 (App pages must have Suspense before DB optimization is measured)

## Session Continuity

Last session: 2026-03-09 (milestone v2.1 roadmap created)
Stopped at: Roadmap phases 20-23 written, requirements mapped, STATE.md updated

Resume file: None
