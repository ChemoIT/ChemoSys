# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** v2.0 Phase 6 — DB + Auth Foundation

## Current Position

Phase: 7 of 10 (ChemoSys Login)
Plan: 1 of 2 in current phase
Status: In progress — Plan 07-01 complete, Plan 07-02 pending
Last activity: 2026-03-04 — Plan 07-01 complete (ChemoSys login page + loginApp() Server Action)

Progress: v2.0 [█████░░░░░░░░░░░░░░░] 38% (3/8 plans complete)

## v1.0 Summary

- **Phases:** 6 (1, 2, 3, 3.1, 4, 5)
- **Plans:** 20
- **Commits:** 102
- **Codebase:** 106 TS files, 17,440 LOC + 1,558 SQL
- **Timeline:** 2026-03-01 → 2026-03-04 (3 days)
- **Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

## Accumulated Context

### Key Decisions (v2.0)

- ChemoSys login page = `/chemosys` (נפרד מ-`/login` של admin)
- Module keys prefix = `app_` (e.g., `app_fleet`, `app_equipment`) — מניעת collision עם admin keys
- Build order: migration → auth.ts routing → (admin) guard → dal.ts → (app) layout → pages
- Phase 6 must complete before ANY employee-facing page is created — security gate
- (app) layout = top-header (לא sidebar) — מותאם לעובדי שטח במובייל
- Equipment sub-modules = TBD — placeholder בלבד ב-v2.0
- **[06-01]** maybeSingle() not single() in is_admin query — bootstrap admin (no public.users row) retains access
- **[06-01]** is_admin guard in (admin)/layout not in proxy — proxy handles unauthenticated only, layout handles role mismatch
- **[06-01]** Migration 00016 must run manually before Phase 7+ deployment — hard dependency
- **[06-02]** getPermissionsRpc must be module-level const (not inside function) — React.cache() requires stable function reference for deduplication
- **[06-02]** verifyAppUser does NOT block is_admin users — admins can use ChemoSys too
- **[06-02]** getAppNavPermissions is plain async function (not cached) — delegates to already-cached getPermissionsRpc
- **[06-02]** Admin login redirect changed to /admin/dashboard (was /admin/companies)
- **[07-01]** loginApp() does NOT call verifyAppUser() after signInWithPassword — session propagates on next request, /app/page.tsx handles the guard in Phase 8
- **[07-01]** checkRateLimit(ip, store) generic helper — loginAttempts and loginAppAttempts are separate Maps (different attack surfaces must not share rate limit counters)
- **[07-01]** (chemosys)/layout.tsx uses bg-sidebar-bg (#1B3A4B) + radial teal CSS gradient — visually distinct from admin (bg-brand-bg #F5F7FA)

### Pending Todos

None.

### Blockers/Concerns

- Phase 6 (plan 06-01): Migration 00016 חייב לרוץ ב-Supabase לפני deploy של כל קוד (app) — hard dependency
- Phase 9 (plan 09-01): נדרשת החלטה על pattern להעברת sub-module permissions ל-FleetSubModuleGrid — Set<string> מה-server

## Session Continuity

Last session: 2026-03-04
Stopped at: Task 2 checkpoint in 07-02-PLAN.md — /app module selection page built (commit 8956e05). Awaiting human verification of full ChemoSys login flow.
Resume file: None
