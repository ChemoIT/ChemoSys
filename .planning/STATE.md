# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** v2.0 שלד ChemoSys — Defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-04 — Milestone v2.0 started

Progress: v2.0 [░░░░░░░░░░░░░░░░░░░░] 0%

## v1.0 Summary

- **Phases:** 6 (1, 2, 3, 3.1, 4, 5)
- **Plans:** 20
- **Commits:** 102
- **Codebase:** 106 TS files, 17,440 LOC + 1,558 SQL
- **Timeline:** 2026-03-01 → 2026-03-04 (3 days)
- **Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

## Accumulated Context

### Key Decisions (v1.0 → v2.0)

- Admin interface (ChemoSystem) ≠ ChemoSys application — route group separation: (admin) vs (app)
- Permission enforcement (requirePermission, modules table) ready for ChemoSys — NOT used in admin shell
- proxy.ts handles auth guard for all routes — will add (app) routes
- Soft delete everywhere — all tables, partial indexes, RPC-based
- verifySession() is fast local JWT check — getClaims() in DAL, getUser() in proxy
- ChemoSys replaces 10-year-old Liberty Basic system
- ChemoSys login separate UI from admin, same Supabase Auth backend
- Module selection on login page — buttons grayed if no permission
- v2.0 scope: skeleton only (login + 2 home pages), modules characterized incrementally

### Pending Todos

None — clean slate for v2.0.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-04
Stopped at: v2.0 milestone started. Defining requirements.
Resume file: None
