# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.
**Current focus:** v2.0 Phase 7 — ChemoSys Login + User Edit

## Current Position

Phase: 7 of 10 (ChemoSys Login)
Plan: 2 of 2 in current phase
Status: Phase 7 code COMPLETE — awaiting human verification + commit
Last activity: 2026-03-04 — Session #14

Progress: v2.0 [██████░░░░░░░░░░░░░░] 38% (3/8 plans complete)

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
- **[session14]** user_permissions כתיבות חייבות adminClient (service_role) — RLS 00013 חוסם כתיבה עם RLS client גם ל-admin user
- **[session14]** auth email (מ-auth.users) מוצג בטבלת יוזרים, לא employee email (מ-employees)
- **[session14]** שרון רוצה בחירת מודול ישירות ממסך הלוגאין של ChemoSys — לא בדף נפרד אחרי login

### Hotfixes Applied (2026-03-04, post Phase 7)

- **BUG FIX — שמות מחלקות הפוכים ב-PDF import:** `pdf-parse` מחלץ טקסט עברי RTL בסדר ויזואלי (LTR), כך ש"בקרת איכות" הפכה ל"איכות בקרת". תיקון: `.split(' ').reverse().join(' ')` ב-`parseDepartmentsPdf()` (`src/actions/departments.ts`)
- **שיפור — מספר מחלקה בכרטיס עובד:** הוספת שדה "מס׳ מחלקה" לסעיף שיוך ארגוני ב-`EmployeeForm.tsx`. אפשר לבחור מחלקה לפי מספר או לפי שם. Dropdowns מציגים `{dept_number} — {name}`.
- **כלל ברזל חדש — מחלקה 0 = לא פעיל:** עובד במחלקה 0 תמיד `inactive`, ללא תלות בתאריך סיום. מיושם ב-`deriveStatus()` (server-side), `deriveStatusFromEndDate()` (client-side), onChange handlers בטופס, וב-Excel import.

### Session #14 Changes (2026-03-04, NOT committed)

**באגים שתוקנו:**
1. **באג מייל יוזרים** — הטבלה הציגה employee email במקום auth email. תוקן: `page.tsx` שולף auth emails דרך `adminClient.auth.admin.listUsers()`, מעביר `auth_email` לטבלה.
2. **באג כתיבת הרשאות (user_permissions)** — RLS policy 00013 חוסם INSERT/UPDATE/DELETE גם ל-admin user דרך RLS client. כל כתיבות ל-`user_permissions` עברו ל-`adminClient` (service_role): `createUser`, `updateUserAuth`, `saveUserPermissions`, `assignTemplateInternal`.
3. **ניקוי יוזר יתום** — `odelia.m@chemo-aharon.com` נמחק מ-Supabase Auth דרך SQL דינמי שסורק `information_schema` לכל FKs.

**פיצ'רים חדשים:**
4. **דיאלוג עריכת יוזר** — `UserEditDialog.tsx` חדש: עדכון מייל (auth), סיסמה, הרשאות ChemoSys. לחיצה על שורה בטבלה פותחת את הדיאלוג.
5. **Server Action `updateUserAuth`** — עדכון auth email/password דרך `adminClient.auth.admin.updateUserById()` + upsert הרשאות ChemoSys.

**קבצים שהשתנו (לא committed):**
- `src/app/(admin)/admin/users/page.tsx` — import adminClient, fetch auth emails, merge into users
- `src/actions/users.ts` — `updateUserAuth()` חדש, כל permission writes → adminClient
- `src/components/admin/users/UsersTable.tsx` — auth_email type, clickable rows, UserEditDialog integration
- `src/components/admin/users/UserEditDialog.tsx` — קומפוננטה חדשה
- `src/lib/dal.ts` — debug logs הוסרו

### Pending Todos

None.

### Blockers/Concerns

- Phase 6 (plan 06-01): Migration 00016 חייב לרוץ ב-Supabase לפני deploy של כל קוד (app) — hard dependency
- Phase 9 (plan 09-01): נדרשת החלטה על pattern להעברת sub-module permissions ל-FleetSubModuleGrid — Set<string> מה-server
- **ChemoSys login UX change**: שרון רוצה module selection ישירות במסך הלוגאין `/chemosys` (לא בדף `/app` נפרד). צריך לעדכן את ה-login page ואת `loginApp()` — בשיחה הבאה.

## Session Continuity

Last session: 2026-03-04 (session #14)
Stopped at: Phase 7 code complete — all changes unstaged, need commit. ChemoSys login works but module selection needs redesign.

### Context for next session:

**Status:** Phase 7 code COMPLETE + session #14 improvements. All changes are UNSTAGED — need commit first.

**Verification pending:**
1. Login at `/chemosys` → reaches `/app` → module selection screen (currently goes to white screen if only one module — auto-redirect to non-existent `/app/fleet`)
2. The auto-redirect logic in `/app/page.tsx` (lines 96-102) sends users to `/app/fleet` or `/app/equipment` which don't exist yet — needs UX redesign

**Design change (Sharon's request):**
- Module selection should be integrated INTO the `/chemosys` login page itself
- After entering email + password, user selects which module to enter (צי רכב / צמ"ה)
- `loginApp()` should receive the module choice and redirect directly to `/app/fleet` or `/app/equipment`
- The `/app/page.tsx` module selection page may still exist as a fallback for users with both modules
- Future: each module will have internal navigation to switch modules

Resume file: None
