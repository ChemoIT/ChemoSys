---
phase: 08-app-shell
verified: 2026-03-04T22:30:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 8: App Shell Verification Report

**Phase Goal:** יוזר מחובר ל-ChemoSys רואה layout עקבי — header עם לוגו, שמו, ואפשרות לעבור בין מודולים — בכל דף שהוא מבקר בו.
**Verified:** 2026-03-04T22:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | כל דף תחת /app/* מוגן ע״י verifyAppUser() | VERIFIED | layout.tsx:26 — `await verifyAppUser()`. proxy.ts:64-66 — `/app*` unauthenticated → `/chemosys` at middleware layer before DAL |
| 2  | Header מוצג עם לוגו CA, שם היוזר, ואפשרות התנתקות | VERIFIED | AppHeader.tsx — `<Image src="/logo-icon.png">` + `{displayName}` + `<AppLogoutButton />`. Layout passes displayName resolved from employees FK join |
| 3  | ModuleSwitcher מוצג כשיש ליוזר יותר ממודול אחד | VERIFIED | ModuleSwitcher.tsx:57 — `if (available.length <= 1) return null`. DropdownMenu rendered with app_fleet + app_equipment items when 2+ modules |
| 4  | ModuleSwitcher מוסתר כשיש ליוזר מודול אחד בלבד | VERIFIED | ModuleSwitcher.tsx:57 — `if (available.length <= 1) return null` — explicit guard |
| 5  | כפתור התנתקות מחזיר ל-/chemosys (לא ל-/login) | VERIFIED | AppLogoutButton.tsx:14 — `<form action={logoutApp}>`. auth.ts:216 — `redirect("/chemosys")` |
| 6  | ביקור ב-/app מפנה למודול הראשון המורשה | VERIFIED | app/page.tsx:96-97 — single-module auto-redirect to `/app/fleet` or `/app/equipment`. Pre-existing behavior preserved |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| `src/app/(app)/layout.tsx` | 25 | 62 | VERIFIED | verifyAppUser() + getAppNavPermissions() + FK join + AppHeader render |
| `src/components/app/AppHeader.tsx` | 20 | 55 | VERIFIED | Server component — logo, displayName, ModuleSwitcher, AppLogoutButton |
| `src/components/app/ModuleSwitcher.tsx` | 25 | 88 | VERIFIED | Client component — DropdownMenu, MODULE_MAP, null guard for <=1 module |
| `src/components/app/AppLogoutButton.tsx` | 8 | 26 | VERIFIED | Client component — form action calling logoutApp() |
| `src/actions/auth.ts` | — | exists | VERIFIED | logoutApp() at line 213 — signOut + redirect("/chemosys") |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `(app)/layout.tsx` | `src/lib/dal.ts` | `verifyAppUser()` + `getAppNavPermissions()` | WIRED | layout.tsx:15 import, :26 call, :30 call |
| `(app)/layout.tsx` | `AppHeader.tsx` | renders with displayName + permissions props | WIRED | layout.tsx:58 — `<AppHeader displayName={displayName} permissions={permissions} />` |
| `AppHeader.tsx` | `ModuleSwitcher.tsx` | renders with permissions prop | WIRED | AppHeader.tsx:48 — `<ModuleSwitcher permissions={permissions} />` |
| `AppLogoutButton.tsx` | `src/actions/auth.ts` | form action calling `logoutApp()` | WIRED | AppLogoutButton.tsx:8 import, :14 — `action={logoutApp}` |

### Auth Guard — Layered Analysis

שתי שכבות הגנה משלימות:

1. **proxy.ts (middleware)** — מיירט כל בקשה ל-`/app*` ללא JWT. מפנה ל-`/chemosys` לפני שהקוד של ה-layout בכלל רץ. (proxy.ts:64-66)
2. **verifyAppUser() בlayout** — בודק גם is_blocked, גם deleted_at, גם שיש לפחות app_* permission אחד. מפנה ל-`/chemosys` אם אחד מהם נכשל. (dal.ts:201-212)

הערה: `verifySession()` בתוך `verifyAppUser()` מפנה ל-`/login` (לא `/chemosys`) כ-fallback, אבל המקרה הזה אינו נגיש בפועל כי ה-proxy מטפל בו קודם לכן.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ModuleSwitcher.tsx` | 57, 75 | `return null` | Info | תקין לוגית — null guard לגיטימי (single-module + missing key guard) |

אין blockers. אין stubs. אין TODO/FIXME/PLACEHOLDER.

### Human Verification Required

#### 1. Header Visual Rendering

**Test:** התחברות כיוזר עם שני מודולים (app_fleet + app_equipment) → ניווט ל-`/app`
**Expected:** header sticky בראש הדף עם לוגו CA בצד ימין, שם המשתמש, dropdown "מודולים" עם שתי אפשרויות, וכפתור "התנתקות"
**Why human:** לא ניתן לאמת rendering ויזואלי ב-RTL, sticky position, ו-hover states מ-grep בלבד

#### 2. ModuleSwitcher Hidden for Single-Module User

**Test:** התחברות כיוזר עם app_fleet בלבד → ניווט ל-`/app/fleet`
**Expected:** ה-header מוצג ללא dropdown "מודולים" — רק שם + כפתור התנתקות
**Why human:** ה-null guard קיים בקוד, אבל אישור ויזואלי נדרש

#### 3. Logout Flow

**Test:** לחיצה על "התנתקות" בheader
**Expected:** redirect ל-`/chemosys` (לא ל-`/login`)
**Why human:** Server Action redirect לאחר sign-out — דורש בדיקת browser navigation

#### 4. Employee Display Name Resolution

**Test:** יוזר שקשור לרשומת עובד (employees table) רואה שם מלא בheader
**Expected:** שם מלא `{first_name} {last_name}` — לא email
**Why human:** תלוי בנתוני DB ובשוליות ה-FK join

### Gaps Summary

אין gaps. כל 6 ה-truths אומתו. כל 5 ה-artifacts קיימים ועוברים את שלושת הרמות (exists, substantive, wired). כל 4 ה-key links מחווטים.

---

_Verified: 2026-03-04T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
