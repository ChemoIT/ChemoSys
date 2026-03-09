# ChemoSys — מערכת ניהול וליבה לוגיסטית לחמו אהרון

## What This Is

מערכת ניהול פנימית מבוססת ווב לחברת חמו אהרון בע"מ (תשתיות אנרגיה). המערכת מחולקת לשני אזורים: **ממשק ניהול** (Admin Panel — שרון בלבד) ו-**ChemoSys** (מערכת ליבה לוגיסטית — מנהלים ועובדי שטח נבחרים). שניהם חיים באותו פרויקט Next.js כ-route groups נפרדים, חולקים DB, auth ותשתית משותפת.

v1.0 שלח: ממשק ניהול מלא — עובדים, חברות, מחלקות, פרויקטים, יוזרים, הרשאות, audit log, dashboard, הגדרות אינטגרציה.
v2.0 בונה: שלד ChemoSys + מודול צי רכב מלא — כרטיס נהג, כרטיס רכב (7 טאבים), מערכת דלק, ספקי רכב, MOT API.
v2.1 שלח: ביצועים ו-UX גלובלי — Suspense, Skeleton, DB optimization, loading indicators על כל דפי המערכת.

## Core Value

ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים. אם האדמין לא עובד, שום דבר לא עובד.

## Current Milestone: v2.0 שלד ChemoSys (In Progress)

**Goal:** שלד מערכת ChemoSys — תשתית כניסה, ניווט והרשאות שעליה ייבנו כל מודולי התפעול. מנהלים ועובדי שטח יכולים להתחבר, לבחור מודול, ולנווט בין דפי הבית של צי רכב וצמ"ה. כולל מודול צי רכב מלא — כרטיס רכב עם redesign, כרטיס נהג, מערכת דלק.

**Remaining work (Phases 10, 15, 17-19):**
- Phase 10: Equipment module + mobile polish
- Phase 15: VehicleList page completion (plan 15-02)
- Phase 17-19: Vehicle card redesign — details, ownership, assignment tabs

## Requirements

### Validated

- ✓ מסך Login עם מייל + סיסמה (Supabase Auth) — v1.0
- ✓ ממשק אדמין עם 9 טאבים + Audit Log — v1.0
- ✓ CRUD מלא לכל ישות עם Soft Delete — v1.0
- ✓ ייבוא/ייצוא Excel לעובדים — v1.0
- ✓ מערכת הרשאות גמישה (מודול × אין גישה/קריאה/כתיבה) — v1.0
- ✓ תבניות הרשאות (Role Templates) — v1.0
- ✓ יומן פעולות (Audit Log) עם filter + expand + export — v1.0
- ✓ עיצוב תעשייתי מקצועי בצבעי חמו אהרון — v1.0
- ✓ RTL עברית + Heebo font — v1.0
- ✓ ניהול פרויקטים מלא (מנהלים, שעוני נוכחות, מפה, לוגו לקוח) — v1.0
- ✓ Security hardening (CSP, HSTS, rate limiting, RLS) — v1.0
- ✓ Dashboard (6 stat cards + activity feed) — v1.0
- ✓ הגדרות אינטגרציה (SMS, WhatsApp, FTP, Telegram, LLM) — v1.0
- ✓ Suspense + Skeleton על כל דפי App (רכבים, נהגים, דלק) — v2.1
- ✓ Suspense + Skeleton על כל דפי Admin (dashboard, projects, users, audit-log, settings, templates) — v2.1
- ✓ DB optimization — Dashboard RPC, composite indexes, React.cache() — v2.1
- ✓ Loading indicators על filter/search/save changes — v2.1
- ✓ IRON RULE: Performance Standard — תבנית חובה לכל דף חדש — v2.1
- ✓ PageSkeleton + LoadingIndicator boilerplate components — v2.1

### Active

- [ ] מודול צמ"ה (Equipment) — placeholder + mobile polish
- [ ] השלמת כרטיס רכב redesign (טאבים: details, ownership, assignment)
- [ ] השלמת רשימת רכבים (VehicleList page component)

### Out of Scope

- Dark mode — הכנה בלבד, לא בשלב זה
- אנגלית — מבנה i18n מוכן, תרגום בעתיד
- אפליקציה מובייל native — רספונסיבי מספיק
- פונקציונליות תתי-מודולים (CRUD, טפסים, דוחות) — כל מודול יאופיין בנפרד ב-milestones עתידיים
- מודול משאבי אנוש — לא ב-v2.0
- רכיבי AI (צ'אטבוט, אוטומציה) — יידון בהמשך

## Current State

- **v1.0 Shipped:** ממשק ניהול מלא — 106 TS files, 17,440 LOC, 102 commits
- **v2.0 In Progress:** שלד ChemoSys + מודול צי רכב (שלבים 6-9 done, 10+15+17-19 remaining)
- **v2.1 Shipped:** ביצועים ו-UX — Suspense+Skeleton על כל הדפים, Dashboard RPC, IRON RULE
- **Codebase:** 205 TypeScript files, 44,176 LOC + 4,269 SQL

## Context

### טכנולוגי
- **Frontend:** Next.js 16 (App Router) + TypeScript + React 19
- **Hosting:** Vercel (deploy via GitHub)
- **Database:** Supabase PostgreSQL (AWS)
- **Auth:** Supabase Auth (email + password)
- **Domain:** ch-ah.info (יוצבע ל-Vercel)
- **UI:** shadcn/ui + Tailwind CSS v4 + Heebo font
- **Maps:** react-leaflet v5
- **Excel:** ExcelJS
- **Tables:** TanStack React Table v8

### עיצוב ומיתוג
- **סגנון:** תעשייתי מקצועי
- **צבע ראשי (Primary):** `#4ECDC4` (טורקיז CA)
- **צבע כהה (Dark):** `#1B3A4B` (כחול כהה)
- **רקע:** `#F5F7FA` (אפור בהיר)
- **כרטיסים:** `#FFFFFF` (לבן)
- **Success:** `#27AE60` | **Warning:** `#F2994A` | **Danger:** `#EB5757`
- **פונט עברית:** Heebo | **פונט אנגלית:** Inter
- **Layout:** RTL, sidebar כהה מימין עם אייקון CA, תוכן משמאל
- **לוגו:** CA.png (אייקון), Heb-ChemoIT.png (מלא בלוגין)

### ארכיטקטורת Routes
```
src/app/
├── (admin)/     ← ממשק ניהול (v1.0 — שרון בלבד)
├── (app)/       ← ChemoSys (v2.0 — מנהלים + עובדי שטח)
├── (auth)/      ← לוגין (משותף)
└── layout.tsx   ← Root (Heebo, RTL, Toaster)
```

### מודולי ChemoSys
**v2.0 (שלד):** צי רכב + צמ"ה — דפי בית עם תפריט, ללא פונקציונליות פנימית
**עתידי:** משאבי אנוש, רכיבי AI — יאופיינו בנפרד

**תתי-מודולים צי רכב (16):**
כרטיס נהג, כרטיס רכב, סל הוצאות, ניהול ק"מ, דלק, כבישי אגרה, דוחות תעבורה/משטרה/נזקים, טבלאות חריגים, טעינת רכב חשמלי, הזמנת רכב שכור, טפסי בטיחות, אישורי חשבוניות ספקים, ספר טיפולים מכניים, חלקי חילוף/צמיגים, רכבי מחנה+QR, הפקת דוחות

**תתי-מודולים צמ"ה:** יאופיינו בהמשך

## Constraints

- **Tech stack:** Next.js 16 + Supabase — נקבע, לא משתנה
- **Hosting:** Vercel + ch-ah.info domain
- **Language:** עברית ראשית, RTL — לא ניתן לדלג
- **Extensibility:** כל רכיב חייב לתמוך בהרחבה עתידית (מודולים, טאבים, הגדרות)
- **Soft Delete:** בכל המערכת — לא למחוק נתונים לעולם
- **Mobile:** תמיכה מלאה — לא "nice to have"
- **Budget:** Free tiers only during development (Supabase Free, Vercel Hobby)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 16 + Vercel (לא PHP + cPanel) | מודרני, SSR, deploy אוטומטי, רספונסיבי מובנה | ✓ Good |
| Supabase Auth (לא custom) | JWT מובנה, session management, password reset | ✓ Good |
| Soft Delete בלבד | שלמות נתונים, audit trail, שחזור קל | ✓ Good |
| Composite key (employee_number + company_id) | אותו מספר עובד יכול להיות בחברות שונות | ✓ Good |
| הרשאות כמטריצת מודול × level | גמישות מקסימלית למודולים עתידיים | ✓ Good — infrastructure ready |
| תבניות הרשאות + דריסה ידנית | איזון בין ניהול קל וגרנולריות | ✓ Good |
| מנהלים מרשימת עובדים | עקביות נתונים, מקור אחד | ✓ Good |
| Audit Log על כל ישות | נדרש למערכת עסקית — מי שינה מה ומתי | ✓ Good |
| proxy.ts (לא middleware.ts) | Next.js 16 convention — auth guard | ✓ Good |
| Static CSP (לא nonce-based) | Admin panel, no 3rd-party scripts, avoids dynamic rendering | ✓ Good |
| Rate limiting in-memory | Free tier constraint — no Upstash/Redis | ✓ Good (switch at production scale) |
| Admin shell = no permission checks | Sharon-only — requirePermission() saved for ChemoSys | ✓ Good |
| ChemoSys in same project | Shared DB, auth, components — route groups for separation | ✓ Good |
| ChemoSys login נפרד מ-admin | UI נפרד, אותו Supabase Auth backend | ✓ Good |
| כפתורי מודול בדף כניסה | יוזר בוחר מודול בלוגין, כפתור אפור אם אין הרשאה | ✓ Good |
| מודולים כ-route groups מקוננים | /app/fleet/, /app/equipment/ — כל מודול תיקייה עצמאית | ✓ Good |
| Suspense+Skeleton (לא loading.tsx) | Streaming SSR, instant feedback, no blank screens | ✓ Good — v2.1 |
| SECURITY INVOKER for read-only RPCs | RLS applies normally, no privilege escalation | ✓ Good — v2.1 |
| Dashboard RPC (get_dashboard_stats) | Single query replaces 7, no-arg RETURNS TABLE | ✓ Good — v2.1 |
| verifySession() outside Suspense | Auth redirect fires immediately, not deferred | ✓ Good — v2.1 |
| PageSkeleton configurable component | Reusable skeleton generator from config object | ✓ Good — v2.1 |

---
*Last updated: 2026-03-09 after v2.1 milestone shipped*
