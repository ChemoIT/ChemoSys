# Requirements: ChemoSys v2.0 — שלד ChemoSys

**Defined:** 2026-03-04
**Core Value:** שלד מערכת ChemoSys — תשתית כניסה, ניווט והרשאות שעליה ייבנו כל מודולי התפעול.

## v2.0 Requirements

### תשתית ואבטחה (INFRA)

- [ ] **INFRA-01**: Migration 00016 מוסיף module keys עם prefix `app_` לטבלת modules (fleet, equipment + 16 sub-modules)
- [ ] **INFRA-02**: `(admin)/layout.tsx` חוסם גישה ליוזרים שאינם admin (בדיקת `is_admin`)
- [ ] **INFRA-03**: `proxy.ts` מפנה בקשות לא-מאומתות ב-`/app/*` לדף `/chemosys`
- [ ] **INFRA-04**: `dal.ts` כולל `verifyAppUser()` שמוודא יוזר פעיל עם הרשאת app כלשהי
- [ ] **INFRA-05**: `dal.ts` כולל `getAppNavPermissions()` שמחזיר רק מפתחות `app_*`
- [ ] **INFRA-06**: קריאת RPC `get_user_permissions` עטופה ב-`React.cache()` למניעת קריאות כפולות

### אימות ChemoSys (AUTH)

- [ ] **AUTH-01**: דף כניסה ייעודי ב-`/chemosys` — נפרד לחלוטין מלוגין אדמין
- [ ] **AUTH-02**: יוזר נכנס עם מייל + סיסמה (Supabase Auth הקיים)
- [ ] **AUTH-03**: Checkbox "זכור אותי" שמשמר credentials
- [ ] **AUTH-04**: כפתורי בחירת מודול (צי רכב + צמ"ה) עם אייקונים מתאימים
- [ ] **AUTH-05**: כפתורי מודול אפורים/חסומים אם אין ליוזר הרשאה למודול
- [ ] **AUTH-06**: Rate limiting על כניסה ל-ChemoSys

### שלד ChemoSys (SHELL)

- [ ] **SHELL-01**: Route group `(app)` קיים עם layout נפרד (RTL, עברית, מיתוג חמו אהרון)
- [ ] **SHELL-02**: Header עליון עם לוגו CA, שם היוזר, ModuleSwitcher, וכפתור התנתקות
- [ ] **SHELL-03**: יוזר יכול לעבור בין מודולים בכל רגע דרך ModuleSwitcher
- [ ] **SHELL-04**: דף `/app` מפנה למודול הראשון המורשה (אם מודול יחיד — auto-redirect)

### צי רכב (FLEET)

- [ ] **FLEET-01**: דף בית Fleet מציג grid של 16 תתי-מודולים עם אייקונים ושמות בעברית
- [ ] **FLEET-02**: תתי-מודולים ללא הרשאה מוצגים אפורים/חסומים
- [ ] **FLEET-03**: לחיצה על תת-מודול פעיל מובילה לדף placeholder "בקרוב"
- [ ] **FLEET-04**: בדיקת הרשאה `app_fleet` בכניסה למודול — redirect אם אין גישה

### צמ"ה (EQUIP)

- [ ] **EQUIP-01**: דף בית Equipment מציג placeholder "מודול בפיתוח" עם אייקונים כלליים
- [ ] **EQUIP-02**: בדיקת הרשאה `app_equipment` בכניסה למודול — redirect אם אין גישה

### רספונסיביות (MOBILE)

- [ ] **MOBILE-01**: כל קומפוננטות ChemoSys רספונסיביות מ-375px ומעלה עם touch targets 44px

## Future Requirements (v2.1+)

כל תת-מודול יאופיין בנפרד. סדר עדיפות מוצע מהריסרץ':

### צי רכב — תוכן תתי-מודולים
- **FLEET-VEH-01**: כרטיס רכב — כל פרטי הרכב, מסמכים, היסטוריה
- **FLEET-DRV-01**: כרטיס נהג — רישיון, קטגוריות, תוקף, תעודה רפואית
- **FLEET-MLG-01**: ניהול ק"מ — דיווח חודשי, אישור מנהל
- **FLEET-FUEL-01**: ניהול דלק — תדלוקים, צריכה, חריגות
- **FLEET-TOLL-01**: כבישי אגרה — חיוב חודשי כביש 6
- **FLEET-VIO-01**: דוחות תעבורה/משטרה/נזקים
- **FLEET-SAFE-01**: טפסי בטיחות — בדיקה יומית, התראות תוקף
- **FLEET-MAINT-01**: ספר טיפולים מכניים
- **FLEET-SPARE-01**: חלקי חילוף / צמיגים
- **FLEET-EXC-01**: טבלאות חריגים — ספי התראה
- **FLEET-EV-01**: מעקב טעינת רכב חשמלי
- **FLEET-RENT-01**: הזמנת רכב שכור
- **FLEET-INV-01**: אישורי חשבוניות ספקים
- **FLEET-EXP-01**: סל הוצאות רכב (aggregation view)
- **FLEET-CAMP-01**: רכבי מחנה + QR
- **FLEET-RPT-01**: הפקת דוחות

### דשבורד (סוף כל milestone מודולרי)
- **FLEET-DASH-01**: דשבורד צי רכב — סטטיסטיקות, גרפים, התראות
- **EQUIP-DASH-01**: דשבורד צמ"ה — סטטיסטיקות, גרפים, התראות

### צמ"ה — תוכן תתי-מודולים
- יאופיינו בשיחה נפרדת לפני milestone צמ"ה

## Out of Scope

| Feature | Reason |
|---------|--------|
| GPS tracking (Pointer/Matrix/Ituran) | דורש חוזה ספק + חומרה — v3+ |
| WhatsApp/SMS notifications | עיצוב hooks ב-DB עכשיו, חיווט n8n בהמשך |
| ייבוא מ-API כרטיסי דלק | ספקים ישראליים עם API סגור — CSV בינתיים |
| אינטגרציה Priority/SAP | v3+ |
| אפליקציה native iOS/Android | PWA מכסה 95% מהצרכים |
| Dark mode | הכנה בלבד |
| רכיבי AI | יידון בהמשך |
| דשבורד מודולים | ייבנה בסוף כל milestone מודולרי |
| פונקציונליות תתי-מודולים | כל אחד יאופיין בנפרד |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 6 | Pending |
| INFRA-02 | Phase 6 | Pending |
| INFRA-03 | Phase 6 | Pending |
| INFRA-04 | Phase 6 | Pending |
| INFRA-05 | Phase 6 | Pending |
| INFRA-06 | Phase 6 | Pending |
| AUTH-01 | Phase 7 | Pending |
| AUTH-02 | Phase 7 | Pending |
| AUTH-03 | Phase 7 | Pending |
| AUTH-04 | Phase 7 | Pending |
| AUTH-05 | Phase 7 | Pending |
| AUTH-06 | Phase 7 | Pending |
| SHELL-01 | Phase 8 | Pending |
| SHELL-02 | Phase 8 | Pending |
| SHELL-03 | Phase 8 | Pending |
| SHELL-04 | Phase 8 | Pending |
| FLEET-01 | Phase 9 | Pending |
| FLEET-02 | Phase 9 | Pending |
| FLEET-03 | Phase 9 | Pending |
| FLEET-04 | Phase 9 | Pending |
| EQUIP-01 | Phase 10 | Pending |
| EQUIP-02 | Phase 10 | Pending |
| MOBILE-01 | Phase 10 | Pending |

**Coverage:**
- v2.0 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 — traceability confirmed after roadmap creation*
