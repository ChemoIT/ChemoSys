# Vehicle Card Redesign — Full Requirements

**Defined:** 2026-03-07
**Source:** Sharon's direct specification (Session #35)
**Scope:** Complete redesign of VehicleCard tabs, AddVehicleDialog, and supporting DB

---

## AddVehicleDialog — Simplified

- לוחית רישוי בלבד (ללא בחירת חברה — רכב לא משויך לחברה, רק לעובד/פרויקט)
- כפתור "בדוק במשרד הרישוי" → MOT API lookup
- אחרי זיהוי → "פתח כרטיס רכב"

---

## Tab 1: פרטי הרכב (Vehicle Details)

### קיים (נשמר):
- שדות MOT read-only (יצרן, דגם, כינוי מסחרי, שנת ייצור, צבע, דלק, בעלות)
- שדות תפעוליים (הערות, טלפון)

### חדש:
1. **גלריית תמונות רכב** — עד 5 תמונות, עם:
   - אפשרות העלאה
   - דפדוף בין תמונות
   - עריכה ומחיקה של כל תמונה
   - תצוגה בגודל מלא (lightbox)

2. **סוג רכב** — בחירה: פרטי / מסחרי / משאית / ניגרר

3. **סטטוס רכב** — בחירה: פעיל / מושבת זמני / הוחזר / נמכר / מושבת
   - **נעילה:** סטטוס הוחזר/נמכר/מושבת → כל השדות בכרטיס ננעלים (read-only)
   - **שחרור:** שינוי סטטוס חזרה לפעיל → שחרור הנעילה
   - **תנאי:** שינוי לסטטוס הוחזר/נמכר/מושבת דורש תאריך יציאה מהצי — אם לא מצוין, התראה ומניעת שמירה
   - **אוטומטי:** רכב חלופי פעיל → סטטוס הופך למושבת זמני; רכב חלופי הוחזר → סטטוס חוזר לפעיל
   - **dropdown סטטוס תמיד ניתן לשינוי** (גם כשכרטיס נעול — כדי לאפשר שחרור)

4. **תאריך יציאה מהצי** — שדה תאריך חדש

5. **כפתור "רכב חלופי"** → פותח דיאלוג ניהול רכב חלופי:
   - תאריך כניסת הרכב החלופי
   - מספר רישוי (+ זיהוי MOT API)
   - ק"מ כניסה
   - מעקב כרטיסי תדלוק — רשימת מספרי כרטיסים (ספרות בלבד), הוספה/הסרה/עריכה
   - סיבה: טיפול / טסט / תאונה / אחר (עם חובת הסבר)
   - סטטוס רכב חלופי — אוטומטי: פעיל (לא הוחזר) / הוחזר (הוחזר)
   - תאריך החזרה
   - ק"מ החזרה
   - תקופת שהייה בצי — חישוב אוטומטי (תאריך החזרה - תאריך כניסה)
   - סה"כ מרחק נסיעה — חישוב אוטומטי (ק"מ החזרה - ק"מ כניסה)
   - הערות
   - **היסטוריה:** רכב אחד יכול לצבור כמה רשומות רכב חלופי לאורך הזמן

---

## Tab 2: בעלות (Ownership) — חדש

1. **תצורת רכב** — בחירה: בעלות חברה / שכירות / ליסינג תפעולי / מיני ליסינג
2. **ספק בעלות** — מתוך טבלת `vehicle_suppliers` (סוג `ownership`) — מנוהל באדמין
   - ספקים ראשוניים: חמו אהרון בע"מ / בלו סקיי / קל אוטו / פרי / פריים ליסט / אלדן / אלבר
3. **מספר חוזה** — ספרות בלבד
4. **העלאת חוזה PDF** — עם preview, אפשרות זריקה/הוספה/מחיקה
5. **עלות חודשית** — **יומן פעילות** (chemo-activity-journal): תאריך + עלות. היסטוריית שינויים
6. **קבוצת רכב** — dropdown: קבוצה 1 עד קבוצה 7

---

## Tab 3: רישוי וביטוח (Licensing & Insurance) — מאוחד

- **תמיד פתוח** (ללא תלות בתצורת הרכב)
- מחולק ל-2 חלקים זהים: **רישוי** + **ביטוח**
- כל חלק כולל:
  - PDF upload עם preview, אפשרות זריקה/העלאה/עריכה/מחיקה
  - תאריך תפוגה
  - Switch התראה מקדימה (בדומה לכרטיס נהג)

---

## Tab 4: צמידות (Assignment) — שם חדש

### כללים:
- לכל רכב חייב להיות מישהו אחראי
- לכל רכב יכולים להיות מספר נהגים לאורך זמן אבל לא באותו זמן

### קטגוריית רכב — בחירה:
**רכב מחנה:**
- בחירה: האחראי = אחראי כללי של הפרויקט המקושר, או אחראי רכב אחר
- אם "אחראי רכב אחר": שם האחראי + מספר טלפון נייד (ספרות, ולידציית פורמט)

**רכב צמוד נהג:**
- מציג שם נהג נוכחי
- כפתור "שינוי" → **יומן פעילות** לשינוי נהגים (בחירה מטבלת נהגים + תאריך הצמדה)

### שיוך לפרויקט:
- **יומן פעילות** — בחירת פרויקט מתוך פרויקטים פעילים + תאריך ביצוע

---

## Tab 5: מסמכים (Documents)
- העתקה מדויקת מכרטיס נהג (DriverDocumentsSection)

---

## Tab 6: הערות (Notes)
- ללא שינוי

---

## Tab 7: ק"מ (KM)
- ללא שינוי

---

## טאב שהוסר:
- **עלויות** — הוסר לחלוטין

---

## DB Changes Required

### שדות חדשים ב-vehicles:
- `vehicle_type` TEXT — פרטי/מסחרי/משאית/ניגרר
- `vehicle_status` TEXT — פעיל/מושבת זמני/הוחזר/נמכר/מושבת (default: פעיל)
- `fleet_exit_date` DATE — תאריך יציאה מהצי
- `vehicle_category` TEXT — camp/assigned (רכב מחנה / רכב צמוד נהג)
- `camp_responsible_type` TEXT — project_manager/other
- `camp_responsible_name` TEXT
- `camp_responsible_phone` TEXT
- `ownership_type` TEXT — company/rental/operational_leasing/mini_leasing
- `ownership_supplier_id` UUID FK → vehicle_suppliers
- `contract_number` TEXT
- `vehicle_group` INT — 1-7

### טבלאות חדשות:
- `vehicle_images` — vehicle_id, storage_path, position (1-5), created_at
- `vehicle_replacement_records` — vehicle_id, license_plate, mot_data JSONB, entry_date, entry_km, return_date, return_km, reason, reason_other, status, notes, created_at
- `vehicle_fuel_cards` — replacement_record_id FK, card_number TEXT
- `vehicle_driver_journal` — vehicle_id, driver_id FK, start_date, end_date (activity journal)
- `vehicle_project_journal` — vehicle_id, project_id FK, start_date, end_date (activity journal)
- `vehicle_monthly_costs` — vehicle_id, start_date, end_date, amount NUMERIC (activity journal)

### Storage:
- bucket `vehicle-images` (Private) — for vehicle photos

### vehicle_suppliers:
- Add type `ownership` to existing supplier types
