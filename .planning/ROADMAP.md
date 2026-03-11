# Roadmap: ChemoSys — מערכת ניהול וליבה לוגיסטית לחמו אהרון

## Milestones

- ✅ **v1.0 Admin Panel MVP** — Phases 1-5 + 3.1 (shipped 2026-03-04) — [Archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 שלד ChemoSys** — Phases 6-19 (in progress)
- ✅ **v2.1 Performance & UX** — Phases 20-23 (shipped 2026-03-09) — [Archive](milestones/v2.1-ROADMAP.md)

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
- [x] **Phase 9: Fleet Home** — דף בית צי רכב עם sidebar ו-9 תתי-מודולים — completed 2026-03-05
- [ ] **Phase 10: Equipment + Mobile Polish** — דף בית צמ"ה + רספונסיביות + וריפיקציה
- [ ] **Phase 11–19: Vehicle Card + Fuel System** — DB, Server Actions, UI מלא לכרטיס רכב + מערכת דלק

---

<details>
<summary>✅ v2.1 Performance & UX (Phases 20-23) — SHIPPED 2026-03-09</summary>

- [x] Phase 20: Performance Standards (2/2 plans) — IRON RULE + מסמך סטנדרט + boilerplate — completed 2026-03-09
- [x] Phase 21: App Pages Suspense + Loading (4/4 plans) — Skeleton לרשימות/כרטיסי רכב ונהגים — completed 2026-03-09
- [x] Phase 22: Admin Pages Suspense + Loading (4/4 plans) — Skeleton ל-7 דפי אדמין + הסרת loading.tsx — completed 2026-03-09
- [x] Phase 23: DB Optimization (2/2 plans) — Dashboard RPC + indexes + React.cache() — completed 2026-03-09

</details>

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

### Phase 11: Phase 10A — Vehicle Card Database + Storage + Vehicle Suppliers tables

**Goal:** תשתית DB מלאה למודול כרטיס רכב — 6 טבלאות, views, RPCs, RLS, ו-storage bucket מוכנים ל-Supabase. בסיום הפאזה, כל האובייקטים קיימים ב-DB ומוכנים לפיתוח Server Actions ו-UI בפאזות הבאות.
**Depends on:** Phase 10
**Plans:** 2 plans

Plans:
- [x] 11-01-PLAN.md — Main migration 00025: 6 tables + views + 9 RPCs + RLS policies + indexes + triggers
- [x] 11-02-PLAN.md — Storage policies migration 00026 + human verification of both migrations in Supabase

### Phase 12: Phase 10B — Vehicle Suppliers Admin Settings UI + MOT API integration

**Goal:** דף אדמין מלא לניהול ספקי רכב (מוסכים, ליסינג, ביטוח, דלק) + Server Action לסנכרון נתוני רכב ממשרד הרישוי (MOT API) + הרחבת הגדרות צי רכב עם ספי התראה לטסט וביטוח. בסיום הפאזה, האדמין יכול לנהל ספקים ולבדוק חיבור API — תשתית מוכנה לכרטיס רכב.
**Depends on:** Phase 11
**Plans:** 2 plans

Plans:
- [x] 12-01-PLAN.md — Vehicle Suppliers Admin CRUD page + Server Actions + sidebar nav link
- [x] 12-02-PLAN.md — MOT API Server Action + Fleet Settings extension (vehicle test/insurance thresholds + MOT test button)

### Phase 13: Phase 10C — Vehicle Server Actions + Shared Fleet Components extraction

**Goal:** שכבת הנתונים המלאה למודול כרטיס רכב — 21 Server Actions ב-vehicles.ts + קובץ טיפוסים vehicle-types.ts + 6 רכיבי UI משותפים ב-shared/ (מועברים מדרייברים + VehicleFitnessLight חדש). בסיום הפאזה, כל הקוד שפאזות 14-15 צריכות קיים — אפס מיגרציות.
**Depends on:** Phase 12
**Plans:** 2 plans

Plans:
- [x] 13-01-PLAN.md — Vehicle types file (vehicle-types.ts) + complete vehicle CRUD server actions (vehicles.ts — 21 functions)
- [x] 13-02-PLAN.md — Shared fleet component extraction (FleetDateInput, AlertToggle, ExpiryIndicator, FleetFilePreview, FleetUploadZone) + VehicleFitnessLight

### Phase 14: Phase 10E — VehicleCard Tabs 4-8 (Assignment, Costs, Documents, Notes, KM placeholder)

**Goal:** דף כרטיס רכב מלא עם 8 טאבים — פרטי הרכב (MOT + שדות תפעוליים), טסטים, ביטוח, שיוך נהג, עלויות (placeholder), מסמכים, הערות, וק"מ (placeholder). כולל dirty tracking, Dialog שינויים לא שמורים, ודף רשימת רכבים מינימלי לניווט.
**Depends on:** Phase 13
**Plans:** 2 plans

Plans:
- [x] 14-01-PLAN.md — VehicleCard infrastructure + server page + shell + Tabs 1-3 (Details, Tests, Insurance) + getActiveSuppliersByType action
- [x] 14-02-PLAN.md — Tabs 4-8 (Assignment, Costs placeholder, Documents, Notes, KM placeholder) + minimal VehicleList page

### Phase 15: Phase 10F — VehicleList + AddVehicleDialog (MOT API auto-fill) + Pages + Integration

**Goal:** דף רשימת רכבים מלא עם טבלה, פילטרים, חיפוש ורמזור כשירות + דיאלוג פתיחת כרטיס רכב חדש עם חיפוש MOT דו-שלבי (הכנסת לוחית -> תצוגה מקדימה -> אישור ויצירה) + ניתוב דפים ושילוב עם VehicleCard.
**Depends on:** Phase 14
**Plans:** 2 plans

Plans:
- [x] 15-01-PLAN.md — Server action prep (lookupVehicleFromMot + fix mot-sync guards + getCompaniesForSelect) + AddVehicleDialog two-step component
- [ ] 15-02-PLAN.md — VehicleList component (mirrors DriverList) + page routes (vehicle-card/page.tsx + [id]/page.tsx) + visual verification

### Phase 16: Vehicle Card Redesign — DB Migration

**Goal:** מיגרציית DB מלאה לעיצוב מחדש של כרטיס רכב — שדות חדשים ב-vehicles (סטטוס, סוג, תאריך יציאה, קטגוריה, בעלות), טבלאות חדשות (תמונות, רכב חלופי, כרטיסי תדלוק, יומני נהגים/פרויקטים/עלויות), storage bucket לתמונות, וסוג ownership ב-vehicle_suppliers.
**Depends on:** Phase 15
**Requirements doc:** [vehicle-card-redesign-requirements.md](vehicle-card-redesign-requirements.md)
**Plans:** 2 plans

Plans:
- [x] 16-01-PLAN.md — Main migration 00027: ALTER TABLE vehicles (9 columns + constraints) + vehicle_suppliers + 6 new tables + views + RPC + RLS
- [x] 16-02-PLAN.md — Storage policies migration 00028 (vehicle-images bucket) + human verification of both migrations in Supabase

### Phase 17: Vehicle Card Redesign — Details Tab + Images + Replacement Vehicle

**Goal:** טאב פרטי רכב מחודש — גלריית תמונות (עד 5), סוג רכב, סטטוס רכב עם נעילת כרטיס אוטומטית, תאריך יציאה מהצי, דיאלוג ניהול רכב חלופי מלא (כניסה/יציאה/כרטיסי תדלוק/סיבה). תיקון AddVehicleDialog (הסרת בחירת חברה).
**Depends on:** Phase 16
**Requirements doc:** [vehicle-card-redesign-requirements.md](vehicle-card-redesign-requirements.md)
**Plans:** 2 plans

Plans:
- [ ] 17-01-PLAN.md — Types + Server Actions (images + replacement + fix createVehicle) + AddVehicleDialog fix + VehicleDetailsSection overhaul + VehicleImageGallery
- [ ] 17-02-PLAN.md — ReplacementVehicleDialog (list + form + fuel cards) + integration + visual verification

### Phase 18: Vehicle Card Redesign — Ownership Tab + Licensing & Insurance Tab

**Goal:** טאב בעלות חדש (תצורת רכב, ספק בעלות מ-vehicle_suppliers, מספר חוזה, PDF חוזה, יומן עלויות חודשיות, קבוצת רכב) + טאב רישוי וביטוח מאוחד (2 חלקים זהים עם PDF, תפוגה, והתראה).
**Depends on:** Phase 16
**Requirements doc:** [vehicle-card-redesign-requirements.md](vehicle-card-redesign-requirements.md)
**Plans:** 3 plans

Plans:
- [ ] 18-01-PLAN.md — Migration 00029 (contract_file_url) + vehicle-types.ts (constants + VehicleFull + VehicleMonthlyCost) + vehicles.ts (extend getVehicleById + updateVehicleDetails) + vehicle-ownership.ts (3 monthly cost actions)
- [ ] 18-02-PLAN.md — VehicleOwnershipSection (Tab 2: fields + contract PDF + journal) + VehicleOwnershipJournal (activity journal sub-component)
- [ ] 18-03-PLAN.md — VehicleLicensingSection (merged Tab 3 wrapper) + VehicleCard.tsx (8→7 tabs) + page.tsx (monthly costs fetch) + VehicleCostsSection deletion

### Phase 19: Vehicle Card Redesign — Assignment Tab (צמידות) + Documents + Cleanup

**Goal:** טאב צמידות מחודש — קטגוריית רכב (מחנה/צמוד), אחראי רכב, יומן פעילות לנהגים, יומן פעילות לפרויקטים. טאב מסמכים (העתקה מכרטיס נהג). הסרת טאב עלויות. VehicleCard shell update (7 טאבים במקום 8).
**Depends on:** Phase 16
**Requirements doc:** [vehicle-card-redesign-requirements.md](vehicle-card-redesign-requirements.md)
**Plans:** 2 plans

Plans:
- [ ] 19-01-PLAN.md — Data layer: vehicle-types.ts journal types + getVehicleById/updateVehicleDetails extensions + 6 journal server actions
- [ ] 19-02-PLAN.md — VehicleAssignmentSection rewrite (category + camp form + driver/project journals) + VehicleCard shell cleanup (8→7 tabs) + page.tsx journal fetches

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
| 9. Fleet Home | v2.0 | 2/2 | Complete | 2026-03-05 |
| 10. Equipment + Mobile Polish | v2.0 | 0/1 | Not started | - |
| 11. Vehicle Card DB | v2.0 | 2/2 | Complete | 2026-03-07 |
| 12. Suppliers + MOT API | v2.0 | 2/2 | Complete | 2026-03-07 |
| 13. Vehicle Server Actions | v2.0 | 2/2 | Complete | 2026-03-07 |
| 14. VehicleCard Full UI | v2.0 | 2/2 | Complete | 2026-03-07 |
| 15. VehicleList + AddVehicleDialog | v2.0 | 1/2 | In progress | - |
| 16. Vehicle Card Redesign — DB | v2.0 | 2/2 | Complete | 2026-03-08 |
| 17. Vehicle Card Redesign — Details | v2.0 | 0/2 | Not started | - |
| 18. Vehicle Card Redesign — Ownership | v2.0 | 0/3 | Not started | - |
| 19. Vehicle Card Redesign — Assignment | v2.0 | 0/2 | Not started | - |
| 20. Performance Standards | v2.1 | 2/2 | Complete | 2026-03-09 |
| 21. App Pages Suspense + Loading | v2.1 | 4/4 | Complete | 2026-03-09 |
| 22. Admin Pages Suspense + Loading | v2.1 | 4/4 | Complete | 2026-03-09 |
| 23. DB Optimization | v2.1 | 2/2 | Complete | 2026-03-09 |

## Coverage

All 65 v1.0 requirements mapped and completed. See [v1.0 Requirements Archive](milestones/v1.0-REQUIREMENTS.md).

v2.0: 23/23 requirements mapped. See [REQUIREMENTS.md](REQUIREMENTS.md).

v2.1: 26/26 requirements mapped and completed. See [v2.1 Requirements Archive](milestones/v2.1-REQUIREMENTS.md).

### Phase 20: דוח חריגים דלק — דף נפרד ב-/app/fleet/exceptions/fuel עם 6 סוגי חריגים, KPI cards, פילטרים, accordion groups עם עמודות דינמיות, row expansion, וייצוא Excel

**Goal:** [To be planned]
**Depends on:** Phase 19
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 20 to break down)

---

*Roadmap created: 2026-03-01*
*Last updated: 2026-03-09 — v2.1 milestone shipped*
