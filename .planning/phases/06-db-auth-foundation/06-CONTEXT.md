# Phase 6: DB + Auth Foundation - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

תשתית DB ו-auth מאובטחות לקליטת יוזרי ChemoSys. כולל: migration 00016 (מפתחות מודול app_*), guard על admin layout, תיקון ניתוב post-login ב-auth.ts, והרחבת dal.ts עם פונקציות app. אין UI בשלב זה — תשתית טהורה.

</domain>

<decisions>
## Implementation Decisions

### ניתוב Post-Login
- שתי כניסות נפרדות לחלוטין: `/login` (admin) ו-`/chemosys` (ChemoSys)
- כניסה מ-`/login` → תמיד `/admin/dashboard`
- כניסה מ-`/chemosys` → תמיד `/app`
- אין ניתוב דינמי לפי תפקיד — הדלת שנכנסת ממנה קובעת את היעד
- שרון (admin) נכנס דרך `/login` כשהוא עובד כ-admin, ודרך `/chemosys` כשהוא עובד כיוזר רגיל

### מפתחות מודול (18 keys)
- רשימת 18 מפתחות מוגדרת ב-REQUIREMENTS.md (INFRA-01): app_fleet, app_equipment + 16 fleet sub-modules
- שמות ה-sub-modules לפי הרשימה בסעיף Future Requirements: vehicles, drivers, mileage, fuel, tolls, violations, safety, maintenance, spare_parts, exceptions, ev_charging, rentals, invoices, expenses, camp_vehicles, reports

### סקילים ו-teams (הנחיות milestone)
- **frontend-design** — להפעלה בפאזות 7-10 (כל פאזה עם UI)
- **Agent teams** — לביצוע מקבילי בפאזות מורכבות
- **Next.js skills** — nextjs-app-router-patterns, nextjs-supabase-auth, shadcn-ui, tailwind — פעילים לאורך כל ה-milestone
- מטרה: מערכת מודרנית ברמה הגבוהה ביותר

### Claude's Discretion
- מבנה ה-SQL של migration 00016
- אופן מימוש ה-admin guard (server component vs middleware)
- מבנה פנימי של verifyAppUser() ו-getAppNavPermissions()
- אופן עטיפת React.cache() סביב get_user_permissions

</decisions>

<specifics>
## Specific Ideas

- שרון ציין שהמערכת חייבת להיראות "הכי מודרנית שיש" — רלוונטי לפאזות 7-10
- שימוש ב-skills מתמחים (frontend-design, next.js patterns) כהנחיית milestone

</specifics>

<deferred>
## Deferred Ideas

- עיצוב ולוק מודרני למערכת — Phase 7+ (דף כניסה, shell, fleet home)
- דיון על Equipment sub-modules — TBD בנפרד (כפי שמופיע ב-REQUIREMENTS.md)

</deferred>

---

*Phase: 06-db-auth-foundation*
*Context gathered: 2026-03-04*
