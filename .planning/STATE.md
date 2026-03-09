# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** v2.1 Performance & UX — Phase 23 (DB Optimization)

## Current Position

Phase: 23 of 23 (DB Optimization)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-09 — Plan 23-02 complete (useTransition audit + VehicleSuppliersPage fix + React.cache audit)

Progress: v2.1 [█████████████████████░░░░] 85% (Phases 20-22 complete, 23 in progress — 2/3 plans done)

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
| 20 | IRON RULE + מסמך סטנדרט + boilerplate | RULE-01, -02, -03 | ✓ Complete |
| 21 | App pages — Suspense + Skeleton + loading | SKEL-APP-01–04, LOAD-01–04 | ✓ Complete |
| 22 | Admin pages — Suspense + Skeleton + loading | SKEL-ADM-01–08, LOAD-05 | ✓ Complete |
| 23 | DB optimization + React.cache + save states | DBOPT-01–05, LOAD-06 | In progress (2/3 plans done) |

## Accumulated Context

### Key Decisions (v2.1 Relevant)

- **[fuel-session40]** fuel_records_enriched VIEW with LATERAL JOINs = reference pattern for DB enrichment
- **[fuel-session40]** get_fuel_stats() RPC = reference pattern for aggregated stats (replaces JS loop over rows)
- **[fuel-session40]** React.cache() on getProjectsForFuelFilter = reference pattern for deduplication
- **[fuel-session40]** FuelPageSkeleton = animated shimmer bar at top of page = reference skeleton pattern
- **[fuel-session40]** Loading indicator = spinner + "מעדכן נתונים..." text (replaces opacity-only) = reference pattern
- **[20-02]** PageSkeleton is a starting point — custom skeletons still needed for unique layouts (tabs, etc.)
- **[20-02]** LoadingIndicator marked 'use client' — receives client state (isPending) as prop
- **[20-02]** PageSkeleton default maxWidth = max-w-[calc(100%-6cm)] (matches all fleet pages)
- **[21-01]** VehicleList client-side filtering = no useTransition/LoadingIndicator needed; skeleton handles initial data load only
- **[21-02]** VehicleCard page split: thin page.tsx (auth+Suspense only) + VehicleCardContent inner async component owns all data fetching
- **[21-02]** No tab-switch loading indicator needed for VehicleCard — all tab data fetched upfront via Promise.all (LOAD-03 satisfied by design)
- **[21-03]** DriverList uses max-w-4xl (not max-w-[calc(100%-6cm)]) — skeleton must match this specific container width
- **[21-03]** No useTransition/LoadingIndicator for DriverList — client-side filtering is instant, no server round-trip
- **[21-04]** DriverCard uses max-w-4xl (not max-w-[calc(100%-6cm)]) — skeleton must match this specific container width
- **[21-04]** Tab loading indicators NOT needed for DriverCard — all tab data fetched upfront via Promise.all; add only if tabs lazy-loaded later
- **[22-02]** Admin pages use maxWidth: max-w-full — admin layout is full-width unlike fleet app pages
- **[22-02]** verifySession() must run OUTSIDE Suspense boundary — auth redirect must fire immediately
- **[22-01]** DashboardSkeleton custom (not PageSkeleton) — two-section layout (stat grid + activity feed) requires dedicated component
- **[22-01]** verifySession() always outside Suspense boundary — auth redirect must not be deferred
- **[23-01]** get_dashboard_stats() RPC = no-arg RETURNS TABLE pattern for aggregated dashboard stats — reference for future stat dashboards
- **[23-01]** getDashboardStats() server action = verifySession + rpc() + array[0] + camelCase mapping + zero fallback — reference wrapper pattern
- **[23-01]** SECURITY INVOKER for read-only stats RPC — no privilege escalation needed, RLS applies normally
- **[23-01]** Activity feed entity resolution stays inline in page.tsx — complex 8-entity lookup chain, too risky to abstract
- **[23-02]** deleting/blocking useState in Table components passed to DeleteConfirmDialog = false positives (dialog manages spinner) — NOT anti-patterns
- **[23-02]** Form submit anti-pattern: only standalone form-submit handler with useState loading is anti-pattern; DeleteConfirmDialog prop pattern is acceptable
- **[23-02]** React.cache() audit complete: verifySession + verifyAppUser + getProjectsForFuelFilter already cached; all other server actions called once per render — no new candidates

### Pending Todos

None.

### Blockers/Concerns

- Migration 00036 (fuel_records_enriched view + get_fuel_stats RPC) — **must run in Supabase SQL Editor before Phase 21**
- Migrations 00027+00028: RUN ✓ — vehicle card redesign schema live
- Migrations 00025+00026: RUN ✓ — vehicle module DB foundation complete
- Phase 21 depends on Phase 20 (standards must be documented before implementation)
- Phase 23 depends on Phase 21 (App pages must have Suspense before DB optimization is measured)

## Session Continuity

Last session: 2026-03-09 (Phase 23 Plan 02 executed — useTransition audit + VehicleSuppliersPage fix)
Stopped at: Completed 23-02-PLAN.md — VehicleSuppliersPage save button fixed, full codebase audit documented

Resume file: None
