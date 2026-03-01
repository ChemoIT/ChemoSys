# Requirements: ChemoSys Admin

**Defined:** 2026-03-01
**Core Value:** ממשק אדמין שמאפשר לנהל עובדים, יוזרים, חברות, פרויקטים והרשאות — התשתית שעליה כל המודולים העתידיים נבנים.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: מערכת Next.js מוגדרת עם RTL עברית, פונט Heebo, צבעי מותג חמו אהרון
- [ ] **FOUND-02**: חיבור ל-Supabase PostgreSQL עם סכמת טבלאות מלאה
- [ ] **FOUND-03**: כל טבלה כוללת id, created_at, updated_at, created_by, updated_by, deleted_at
- [ ] **FOUND-04**: Soft delete בכל המערכת — מחיקה מסמנת deleted_at, לא מוחקת מה-DB
- [ ] **FOUND-05**: Layout רספונסיבי — sidebar כהה מימין (RTL), אזור תוכן משמאל, תמיכה במובייל וטאבלט

### Authentication

- [ ] **AUTH-01**: יוזר יכול להתחבר למערכת עם מייל וסיסמה
- [ ] **AUTH-02**: Session נשמר אחרי רענון דפדפן (JWT via Supabase Auth)
- [ ] **AUTH-03**: יוזר לא מאומת מופנה אוטומטית לדף Login
- [ ] **AUTH-04**: דף Login מציג לוגו חמו אהרון המלא בעברית

### Companies (ניהול חברות)

- [ ] **COMP-01**: אדמין יכול להוסיף חברה חדשה (שם, מספר פנימי, ח.פ., אחראי, מייל, הערות)
- [ ] **COMP-02**: אדמין יכול לערוך חברה קיימת
- [ ] **COMP-03**: אדמין יכול למחוק חברה (soft delete)
- [ ] **COMP-04**: מספר חברה פנימי הוא ייחודי

### Departments (ניהול מחלקות)

- [ ] **DEPT-01**: אדמין יכול להוסיף מחלקה (מספר, שם, חברה, מחלקת-אב, הערות)
- [ ] **DEPT-02**: אדמין יכול לערוך מחלקה קיימת
- [ ] **DEPT-03**: אדמין יכול למחוק מחלקה (soft delete)
- [ ] **DEPT-04**: מחלקות תומכות בהיררכיה (מחלקה → תת-מחלקה)

### Role Tags (תגיות תפקיד)

- [ ] **RTAG-01**: אדמין יכול להוסיף תגית תפקיד (שם, תיאור, הערות)
- [ ] **RTAG-02**: אדמין יכול לערוך תגית קיימת
- [ ] **RTAG-03**: אדמין יכול למחוק תגית (soft delete)

### Employees (ניהול עובדים)

- [ ] **EMPL-01**: אדמין יכול להוסיף עובד חדש עם כל השדות (שם, ת.ז., חברה, מחלקה, כתובת, טלפון, מייל, תאריכים, סטטוס, דרכון, אזרחות, שפת דיוור, מקצוע, הערות)
- [ ] **EMPL-02**: אדמין יכול לערוך עובד קיים
- [ ] **EMPL-03**: אדמין יכול למחוק עובד (soft delete)
- [ ] **EMPL-04**: אדמין יכול לחסום עובד (שינוי סטטוס למושהה)
- [ ] **EMPL-05**: אדמין יכול לשייך תגיות תפקיד מרובות לעובד
- [ ] **EMPL-06**: עובד משויך לחברה מתוך טבלת חברות
- [ ] **EMPL-07**: עובד משויך למחלקה/תת-מחלקה מתוך טבלת מחלקות
- [ ] **EMPL-08**: מפתח ייחודי: מספר עובד + חברה (composite unique)
- [ ] **EMPL-09**: רשימת עובדים עם חיפוש, סינון לפי חברה/מחלקה/סטטוס, ומיון
- [ ] **EMPL-10**: אדמין יכול לייבא רשימת עובדים מקובץ Excel — הצלבה לפי מספר עובד + חברה, עדכון אוטומטי לקיימים

### Users (ניהול יוזרים)

- [ ] **USER-01**: אדמין יכול ליצור יוזר חדש מתוך רשימת עובדים פעילים
- [ ] **USER-02**: חיפוש עובד ביצירת יוזר לפי שם / ת.ז. / מייל / מספר עובד
- [ ] **USER-03**: אדמין יכול לערוך יוזר קיים
- [ ] **USER-04**: אדמין יכול למחוק יוזר (soft delete)
- [ ] **USER-05**: אדמין יכול לחסום יוזר (מניעת כניסה)
- [ ] **USER-06**: אדמין יכול להגדיר הרשאות ליוזר לפי מודול ותת-מודול (אין גישה / קריאה / קריאה+כתיבה)
- [ ] **USER-07**: אדמין יכול לשייך תבנית הרשאות ליוזר

### Role Templates (תבניות הרשאות)

- [ ] **TMPL-01**: אדמין יכול ליצור תבנית הרשאות (שם, תיאור, סט הרשאות)
- [ ] **TMPL-02**: אדמין יכול לערוך תבנית קיימת
- [ ] **TMPL-03**: אדמין יכול למחוק תבנית
- [ ] **TMPL-04**: כשמשייכים תבנית ליוזר — ההרשאות מתמלאות אוטומטית
- [ ] **TMPL-05**: יוזר יכול לדרוס הרשאות ספציפיות אחרי שיוך תבנית

### Navigation & Permissions

- [ ] **NAVP-01**: Sidebar מציג רק טאבים שליוזר יש גישה אליהם
- [ ] **NAVP-02**: ניסיון גישה לדף ללא הרשאה מציג הודעת "אין גישה"
- [ ] **NAVP-03**: בדיקת הרשאות מתבצעת בצד שרת (Server Actions), לא רק ב-UI

### Projects (ניהול פרויקטים)

- [ ] **PROJ-01**: אדמין יכול להוסיף פרויקט חדש עם כל השדות (שם, שם תצוגה, מספר אוטומטי, תיאור, קודים, סוג, פיקוח, מזמין, סטטוס, קואורדינטות)
- [ ] **PROJ-02**: אדמין יכול לערוך פרויקט קיים
- [ ] **PROJ-03**: אדמין יכול למחוק פרויקט (soft delete)
- [ ] **PROJ-04**: מנהל פרויקט / מנהל עבודה / אחראי רכבי מחנה נבחרים מרשימת עובדים
- [ ] **PROJ-05**: מספר פרויקט נוצר אוטומטית (פורמט PR25XXXXXX)
- [ ] **PROJ-06**: רשימת פרויקטים עם סינון לפי סטטוס (פעיל/לא פעיל)

### System Settings (הגדרות מערכת)

- [ ] **SETT-01**: אדמין יכול לקרוא ולערוך קובץ Config.ini בשרת
- [ ] **SETT-02**: אדמין יכול להוסיף התממשקות API חדשה (שם, סוג, endpoint, פרמטרים)
- [ ] **SETT-03**: אדמין יכול לערוך ולמחוק התממשקות קיימת
- [ ] **SETT-04**: כל התממשקות ניתנת להפעלה/השבתה

### Audit Log (יומן פעולות)

- [ ] **AUDT-01**: כל פעולת יצירה/עדכון/מחיקה נרשמת אוטומטית (מי, מה, מתי)
- [ ] **AUDT-02**: אדמין יכול לצפות ביומן עם פילטרים (לפי יוזר, ישות, טווח תאריכים)

### Dashboard

- [ ] **DASH-01**: דף נחיתה מציג סיכומים: עובדים פעילים, פרויקטים פעילים, יוזרים
- [ ] **DASH-02**: דף נחיתה מציג פעילות אחרונה מתוך Audit Log

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Employee Enhancements

- **EMPL-V2-01**: ייצוא רשימת עובדים ל-Excel
- **EMPL-V2-02**: תצוגת תצוגה מקדימה לפני ייבוא Excel עם הצגת קונפליקטים
- **EMPL-V2-03**: היסטוריית ייבואים (מי ייבא, מתי, מה השתנה)
- **EMPL-V2-04**: עריכה ישירה בטבלה (inline edit)

### Auth Enhancements

- **AUTH-V2-01**: איפוס סיסמה דרך קישור מייל
- **AUTH-V2-02**: Session timeout מוגדר

### Projects Enhancements

- **PROJ-V2-01**: תצוגת מפה עם react-leaflet (קואורדינטות כבר ב-DB)

### Audit Log Enhancements

- **AUDT-V2-01**: יומן עם before/after diff (ערך ישן vs ערך חדש)

### Dashboard Enhancements

- **DASH-V2-01**: גרפים וסטטיסטיקות מתקדמות

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| מודול צי רכב | מיילסטון נפרד — לא חלק מה-Admin |
| מודול צמ"ה | מיילסטון נפרד — לא חלק מה-Admin |
| צ'אט / הודעות בזמן אמת | WhatsApp/n8n מטפלים בתקשורת שטח |
| מנוע שכר / חישובי שכר | ChemoSys downstream של מערכת השכר |
| דיווחי נוכחות / שעון | מערכת נפרדת |
| אחסון מסמכים / קבצים מצורפים | מורכבות S3/CDN — לא ב-v1 |
| התראות מייל | תשתית בפני עצמה — v2+ |
| אפליקציה מובייל native | רספונסיבי מספיק |
| דוחות AI | לא צורך מאומת — מודל נתונים קודם |
| שפות מעבר לעברית+אנגלית | לא נדרש לכוח האדם הנוכחי |
| מחיקה קשיחה (hard delete) | הורסת audit trail |
| דפים ציבוריים | מערכת פנימית בלבד |
| Dark mode | הכנה בלבד, לא ב-v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| COMP-01 | Phase 1 | Pending |
| COMP-02 | Phase 1 | Pending |
| COMP-03 | Phase 1 | Pending |
| COMP-04 | Phase 1 | Pending |
| DEPT-01 | Phase 1 | Pending |
| DEPT-02 | Phase 1 | Pending |
| DEPT-03 | Phase 1 | Pending |
| DEPT-04 | Phase 1 | Pending |
| RTAG-01 | Phase 1 | Pending |
| RTAG-02 | Phase 1 | Pending |
| RTAG-03 | Phase 1 | Pending |
| AUDT-01 | Phase 1 | Pending |
| EMPL-01 | Phase 2 | Pending |
| EMPL-02 | Phase 2 | Pending |
| EMPL-03 | Phase 2 | Pending |
| EMPL-04 | Phase 2 | Pending |
| EMPL-05 | Phase 2 | Pending |
| EMPL-06 | Phase 2 | Pending |
| EMPL-07 | Phase 2 | Pending |
| EMPL-08 | Phase 2 | Pending |
| EMPL-09 | Phase 2 | Pending |
| EMPL-10 | Phase 2 | Pending |
| USER-01 | Phase 3 | Pending |
| USER-02 | Phase 3 | Pending |
| USER-03 | Phase 3 | Pending |
| USER-04 | Phase 3 | Pending |
| USER-05 | Phase 3 | Pending |
| USER-06 | Phase 3 | Pending |
| USER-07 | Phase 3 | Pending |
| TMPL-01 | Phase 3 | Pending |
| TMPL-02 | Phase 3 | Pending |
| TMPL-03 | Phase 3 | Pending |
| TMPL-04 | Phase 3 | Pending |
| TMPL-05 | Phase 3 | Pending |
| NAVP-01 | Phase 3 | Pending |
| NAVP-02 | Phase 3 | Pending |
| NAVP-03 | Phase 3 | Pending |
| PROJ-01 | Phase 4 | Pending |
| PROJ-02 | Phase 4 | Pending |
| PROJ-03 | Phase 4 | Pending |
| PROJ-04 | Phase 4 | Pending |
| PROJ-05 | Phase 4 | Pending |
| PROJ-06 | Phase 4 | Pending |
| SETT-01 | Phase 5 | Pending |
| SETT-02 | Phase 5 | Pending |
| SETT-03 | Phase 5 | Pending |
| SETT-04 | Phase 5 | Pending |
| AUDT-02 | Phase 5 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 59 total (note: original stated 46, actual count is 59 — corrected at roadmap creation)
- Mapped to phases: 59
- Unmapped: 0

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after roadmap creation — traceability complete*
