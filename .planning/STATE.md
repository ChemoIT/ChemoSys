# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** v2.0 שלד ChemoSys — השלמת שלבים 10, 15, 17-19

## Current Position

Phase: v2.1 SHIPPED — returning to v2.0 completion
Plan: Phases 10, 15 (plan 02), 17-19 remaining
Status: v2.1 milestone archived — ready for v2.0 continuation
Last activity: 2026-03-09 — v2.1 milestone completed and archived

Progress: v2.0 [████████████░░░░░░░░░░░░░] ~65% (9/14 phases complete, 5 remaining)

## Strategic Decision (Session #18)

**החלטה:** לא מפתחים Phase 10 (Equipment) עכשיו.
**במקום:** שרון יאפיין את מודול הרכבים (fleet vehicles) באופן מלא → פיתוח → ואז איפיון צמ"ה.
**הסיבה:** עדיף לבנות מודול שלם ומאופיין לעומק מאשר שלד של שני מודולים.

## Milestone Summaries

### v1.0 Admin Panel MVP (Shipped 2026-03-04)
- **Phases:** 6 (1, 2, 3, 3.1, 4, 5) — 20 plans, 102 commits
- **Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

### v2.1 Performance & UX (Shipped 2026-03-09)
- **Phases:** 4 (20-23) — 12 plans, 32 commits
- **Archive:** `.planning/milestones/v2.1-ROADMAP.md`, `.planning/milestones/v2.1-REQUIREMENTS.md`

## v2.0 Key Patterns

- **FleetSidebar**: shadcn sidebar RTL, side="right", SidebarProvider wraps sidebar+content, collapsible="icon"
- **Fleet routes**: /app/fleet (dashboard), /app/fleet/driver-card, /app/fleet/vehicle-card, + 9 sub-module placeholders
- **Key pattern**: FleetSidebar accepts children — acts as layout shell, SidebarProvider scoped to fleet only
- **Performance patterns (v2.1)**: Suspense+Skeleton on all pages, verifySession() outside Suspense, PageSkeleton boilerplate, get_dashboard_stats() RPC

## Accumulated Context

### Roadmap Evolution

- Phase 20 added: דוח חריגים דלק — דף נפרד ב-/app/fleet/exceptions/fuel עם 6 סוגי חריגים, KPI cards, פילטרים, accordion groups עם עמודות דינמיות, row expansion, וייצוא Excel

### Pending Todos

None.

### Blockers/Concerns

- Migration 00036 (fuel_records_enriched view + get_fuel_stats RPC) — **must run in Supabase SQL Editor**
- Migration 00037 (get_dashboard_stats RPC + indexes) — **must run in Supabase SQL Editor**
- Migrations 00025-00028: RUN ✓ — vehicle card redesign schema live

## Session Continuity

Last session: 2026-03-09 (v2.1 milestone completion)
Stopped at: v2.1 archived — next step is v2.0 phase completion or `/gsd:new-milestone`

Resume file: None
