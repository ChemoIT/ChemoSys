# Roadmap: ChemoSys — מערכת ניהול וליבה לוגיסטית לחמו אהרון

## Milestones

- ✅ **v1.0 Admin Panel MVP** — Phases 1-5 + 3.1 (shipped 2026-03-04) — [Archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 שלד ChemoSys** — Phases 6-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 Admin Panel MVP (Phases 1–5 + 3.1) — SHIPPED 2026-03-04</summary>

- [x] Phase 1: Foundation (4/4 plans) — Auth, DB schema, RTL shell, companies/departments/role-tags — completed 2026-03-01
- [x] Phase 2: Employees (2/2 plans) — Full employee CRUD + Excel import from payroll — completed 2026-03-01
- [x] Phase 3: Access Control (3/3 plans) — Users, role templates, permission matrix — completed 2026-03-03
- [x] Phase 03.1: Security Hardening (3/3 plans) — CSP, HSTS, rate limiting, RLS tightening — completed 2026-03-03
- [x] Phase 4: Projects (4/4 plans) — Full project management with map, clocks, logo, export — completed 2026-03-03
- [x] Phase 5: Settings and Observability (4/4 plans) — Dashboard, audit log viewer, integration settings — completed 2026-03-04

</details>

---

### 🚧 v2.0 שלד ChemoSys (In Progress)

**Milestone Goal:** שלד מערכת ChemoSys — תשתית כניסה, ניווט והרשאות שעליה ייבנו כל מודולי התפעול. מנהלים ועובדי שטח יכולים להתחבר, לבחור מודול, ולנווט בין דפי הבית של צי רכב וצמ"ה.

- [x] **Phase 6: DB + Auth Foundation** — מיגרציה, תיקון ניתוב auth, הרחבת dal.ts — completed 2026-03-04
- [x] **Phase 7: ChemoSys Login** — דף כניסה ייעודי עם בחירת מודול לפי הרשאות — completed 2026-03-04
- [x] **Phase 8: (app) Shell** — route group + layout + header + module switcher — completed 2026-03-04
- [ ] **Phase 9: Fleet Home** — דף בית צי רכב עם grid של 16 תתי-מודולים
- [ ] **Phase 10: Equipment + Mobile Polish** — דף בית צמ"ה + רספונסיביות + וריפיקציה

---

## Phase Details

### Phase 6: DB + Auth Foundation

**Goal:** תשתית ה-DB וה-auth מאובטחות ומוכנות לקליטת יוזרי ChemoSys — כל 6 הפיתפולים הקריטיים מטופלים לפני שנוצר אפילו דף אחד לעובד.

**Depends on:** Phase 5 (v1.0)

**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06

**Success Criteria** (what must be TRUE):
1. יוזר מאומת ללא `is_admin` שמנסה לגשת ל-`/admin/employees` מקבל redirect — לא רואה נתוני עובדים
2. לאחר login מוצלח, admin מועבר ל-`/admin/dashboard` ועובד מועבר ל-`/app` — לא שניהם לאותו URL
3. `verifyAppUser()` ו-`getAppNavPermissions()` קיימות ב-`dal.ts` ומחזירות רק מפתחות `app_*`
4. Migration 00016 רץ ב-Supabase — 18 מפתחות מודול עם prefix `app_` קיימים בטבלת `modules`
5. `get_user_permissions` RPC עטוף ב-`React.cache()` — קריאה אחת בלבד לבקשה, גם אם מופעל ממספר server components

**Plans:** 2 plans

Plans:
- [x] 06-01-PLAN.md — Migration 00016 (18 app_* keys) + admin layout is_admin guard + proxy.ts /app/* redirect
- [x] 06-02-PLAN.md — auth.ts login redirect fix + dal.ts React.cache() refactor + verifyAppUser + getAppNavPermissions

---

### Phase 7: ChemoSys Login

**Goal:** מנהלים ועובדי שטח יכולים להתחבר ל-ChemoSys דרך דף כניסה ייעודי שמראה להם בדיוק לאיזה מודולים יש להם גישה — לא יותר, לא פחות.

**Depends on:** Phase 6

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06

**Success Criteria** (what must be TRUE):
1. דף `/chemosys` קיים ונראה שונה לחלוטין מדף הכניסה לאדמין — לוגו, כותרת, ועיצוב ייעודי
2. יוזר עם הרשאת `app_fleet` בלבד רואה כפתור "צי רכב" פעיל וכפתור "צמ"ה" אפור/חסום
3. Checkbox "זכור אותי" שומר את ה-session — יוזר שסגר ופתח את הדפדפן לא נדרש להתחבר מחדש
4. ניסיון כניסה כושל חוזר 5 פעמים ב-60 שניות מקבל חסימה — הודעת שגיאה מוצגת

**Plans:** 2 plans

Plans:
- [x] 07-01-PLAN.md — loginApp() Server Action + rate limit refactor + (chemosys) layout + ChemoSys login page
- [x] 07-02-PLAN.md — Module selection page at /app with permission-gated buttons + human verification

---

### Phase 8: (app) Shell

**Goal:** יוזר מחובר ל-ChemoSys רואה layout עקבי — header עם לוגו, שמו, ואפשרות לעבור בין מודולים — בכל דף שהוא מבקר בו.

**Depends on:** Phase 7

**Requirements:** SHELL-01, SHELL-02, SHELL-03, SHELL-04

**Success Criteria** (what must be TRUE):
1. `(app)/layout.tsx` קיים — כל דף תחת `/app/*` מוגן על ידי `verifyAppUser()` ויוזר לא-מאומת מועבר ל-`/chemosys`
2. Header מציג לוגו CA, שם יוזר מחובר, ModuleSwitcher עם מודולים מורשים, וכפתור התנתקות פעיל
3. יוזר שלוחץ על ModuleSwitcher רואה רק את המודולים שיש לו הרשאה אליהם — ועובר לדף הבית שלהם בלחיצה אחת
4. ביקור ב-`/app` ללא מודול ספציפי מפנה אוטומטית למודול הראשון המורשה

**Plans:** 1 plan

Plans:
- [x] 08-01-PLAN.md — (app)/layout.tsx + AppHeader + ModuleSwitcher + logoutApp() + /app page cleanup

---

### Phase 9: Fleet Home

**Goal:** מנהל שנכנס למודול "צי רכב" רואה sidebar ימני (RTL) עם 9 תתי-מודולים, דשבורד placeholder, ו-2 כפתורי CTA — עיצוב מודרני 2026 עם אנימציות וחיווי הרשאות ברור.

**Depends on:** Phase 8

**Requirements:** FLEET-01, FLEET-02, FLEET-03, FLEET-04

**Success Criteria** (what must be TRUE):
1. דף `/app/fleet` מציג sidebar ימני עם 9 תתי-מודולים — מכווץ לאייקונים בברירת מחדל, נפתח בריחוף/לחיצה
2. תת-מודול שאין ליוזר הרשאה אליו מוצג אפור ולא לחיץ — לא נעלם ולא זורק שגיאה
3. לחיצה על תת-מודול פעיל פותחת דף עם הודעת "בקרוב" — לא 404 ולא שגיאת server
4. יוזר ללא הרשאת `app_fleet` שמנסה לגשת ישירות ל-`/app/fleet` מועבר חזרה — לא נכנס לדף

**Plans:** 2 plans

Plans:
- [ ] 09-01-PLAN.md — Install shadcn sidebar + tooltip, create FleetLayout with auth guard, FleetSidebar with 9 sub-modules, migration for 2 missing module keys
- [ ] 09-02-PLAN.md — Fleet home page (dashboard placeholder + 2 CTA), ComingSoon component, 9 sub-module placeholder pages, visual verification

---

### Phase 10: Equipment + Mobile Polish

**Goal:** מערכת ChemoSys v2.0 שלמה ועובדת — מודול צמ"ה קיים, כל הדפים עובדים על מסך 375px, ו-Sharon יכול לאשר שהמסלולים הצפויים (כניסה → מודול → בית) פועלים נכון משני סוגי יוזר.

**Depends on:** Phase 9

**Requirements:** EQUIP-01, EQUIP-02, MOBILE-01

**Success Criteria** (what must be TRUE):
1. דף `/app/equipment` קיים ומציג placeholder "מודול בפיתוח" — ניתן לנווט אליו מה-ModuleSwitcher
2. יוזר ללא הרשאת `app_equipment` שמנסה לגשת ישירות ל-`/app/equipment` מועבר חזרה
3. כל דפי ChemoSys (login, fleet home, equipment) נראים ונגישים על מסך 375px — כפתורים ב-44px לפחות, טקסט קריא, אין overflow אופקי
4. Sharon (admin) יכול להתחבר גם ל-`/admin/dashboard` וגם ל-`/app/fleet` באותה session — is_admin bypass עובד לשני הכיוונים

**Plans:** TBD

Plans:
- [ ] 10-01: Equipment home + error pages + mobile RTL review + E2E verification

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-03-01 |
| 2. Employees | v1.0 | 2/2 | Complete | 2026-03-01 |
| 3. Access Control | v1.0 | 3/3 | Complete | 2026-03-03 |
| 03.1. Security Hardening | v1.0 | 3/3 | Complete | 2026-03-03 |
| 4. Projects | v1.0 | 4/4 | Complete | 2026-03-03 |
| 5. Settings and Observability | v1.0 | 4/4 | Complete | 2026-03-04 |
| 6. DB + Auth Foundation | v2.0 | 2/2 | Complete | 2026-03-04 |
| 7. ChemoSys Login | v2.0 | 2/2 | Complete | 2026-03-04 |
| 8. (app) Shell | v2.0 | 1/1 | Complete | 2026-03-04 |
| 9. Fleet Home | v2.0 | 0/1 | Not started | - |
| 10. Equipment + Mobile Polish | v2.0 | 0/1 | Not started | - |

## Coverage

All 65 v1.0 requirements mapped and completed. See [v1.0 Requirements Archive](milestones/v1.0-REQUIREMENTS.md).

v2.0: 23/23 requirements mapped. See [REQUIREMENTS.md](REQUIREMENTS.md).

---

*Roadmap created: 2026-03-01*
*Last updated: 2026-03-04 — Phase 8 complete*
