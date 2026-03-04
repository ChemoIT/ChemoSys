# ChemoSys — מערכת ניהול וליבה לוגיסטית לחמו אהרון

## What This Is

מערכת ניהול פנימית מבוססת ווב לחברת חמו אהרון בע"מ (תשתיות אנרגיה). המערכת מחולקת לשני אזורים: **ממשק ניהול** (Admin Panel — שרון בלבד) ו-**ChemoSys** (מערכת ליבה לוגיסטית — מנהלים ועובדי שטח נבחרים). שניהם חיים באותו פרויקט Next.js כ-route groups נפרדים, חולקים DB, auth ותשתית משותפת.

v1.0 שולח: ממשק ניהול מלא — עובדים, חברות, מחלקות, פרויקטים, יוזרים, הרשאות, audit log, dashboard, הגדרות אינטגרציה.

## Core Value

ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים. אם האדמין לא עובד, שום דבר לא עובד.

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

### Active

(יוגדר ב-milestone v2.0 — שיחת אפיון ChemoSys)

### Out of Scope

- Dark mode — הכנה בלבד, לא בשלב זה
- אנגלית — מבנה i18n מוכן, תרגום בעתיד
- אפליקציה מובייל native — רספונסיבי מספיק

## Current State (v1.0 Shipped)

- **Codebase:** 106 TypeScript files, 17,440 LOC + 1,558 SQL lines
- **DB:** 18 tables, 15 migrations applied, all RLS enforced
- **Components:** 62 React components (19 UI + 8 shared + 35 admin)
- **Server Actions:** 9 action files covering all entities
- **Security:** CSP, HSTS, X-Frame-Options, rate limiting, server-only guard
- **Commits:** 102
- **Next milestone:** v2.0 ChemoSys — מערכת ליבה לוגיסטית

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

### מודולים עתידיים (ChemoSys v2.0)
יוגדרו בשיחת אפיון — צפי ראשוני:
1. ניהול צי רכב — כרטיס נהג, כרטיס רכב, מעקב טיפולים/ק"מ/דלק/אגרה/בטיחות/תאונות/חשבוניות
2. ניהול צמ"ה — כרטיס צמ"ה, שעות מנוע, יומן שימוש, צריכת דלק, מפעיל, טפסי בטיחות
3. משאבי אנוש — מבוסס על טבלת עובדים הקיימת
4. רכיבי AI — צ'אטבוט, אוטומציה חכמה (יידון בהמשך)

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
| ChemoSys in same project | Shared DB, auth, components — route groups for separation | — Pending (v2.0) |

---
*Last updated: 2026-03-04 after v1.0 milestone*
