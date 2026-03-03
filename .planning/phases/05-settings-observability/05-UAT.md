---
status: diagnosed
phase: 05-settings-observability
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md]
started: 2026-03-03T22:00:00Z
updated: 2026-03-04T00:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. דשבורד — 6 כרטיסי סטטיסטיקה
expected: נכנס ל-/admin/dashboard. מוצגים 6 כרטיסים עם מספרים: עובדים פעילים, פרויקטים פעילים, משתמשים, חברות, מחלקות, תגי תפקיד. כל כרטיס מציג אייקון צבעוני ומספר בעברית.
result: pass

### 2. דשבורד — פיד פעילות אחרונה
expected: מתחת לכרטיסים מוצגת רשימה של עד 20 פעולות אחרונות מיומן הביקורת. כל שורה מציגה: שם המשתמש, תג פעולה בעברית (ירוק/כחול/אדום), סוג ישות, וזמן יחסי בעברית (לדוגמה "לפני 3 שעות").
result: issue
reported: "אני לא רואה שם משתמש או שם העובד אלא רק מספרים ומשפטים לא מזוהים כמו פעל על פרויקט"
severity: major

### 3. יומן פעולות — כניסה לדף וטבלה
expected: לוחץ על "יומן פעולות" בסיידבר (אייקון ScrollText). נפתח דף עם טבלה מסוננת של כל פעולות המערכת. 50 שורות בעמוד עם פגינציה.
result: issue
reported: "גם פה בעמודת משתמש יש מספרים ובעמודת מזהה ישות יש מספרים"
severity: major

### 4. יומן פעולות — סינון
expected: מעל הטבלה מוצגים פילטרים: סוג ישות (dropdown), סוג פעולה (dropdown), חיפוש טקסט חופשי, ובחירת טווח תאריכים. שינוי פילטר מסנן את הטבלה בזמן אמת.
result: pass

### 5. יומן פעולות — שורות מתרחבות
expected: לוחץ על שורה בטבלת היומן — השורה מתרחבת ומציגה את פרטי השינוי: ב-INSERT/DELETE מוצג JSON בודד, וב-UPDATE מוצגת השוואה דו-עמודית (לפני/אחרי) עם הדגשת שדות שהשתנו.
result: pass

### 6. יומן פעולות — ייצוא Excel/CSV
expected: כפתור ייצוא מעל הטבלה מציע xlsx ו-csv. לחיצה מורידה קובץ עם נתוני היומן בהתאם לפילטרים הפעילים. הקובץ בפורמט RTL עם עברית תקינה.
result: pass

### 7. הגדרות — 5 אקורדיונים
expected: נכנס ל-/admin/settings. מוצגים 5 אקורדיונים: SMS, WhatsApp, FTP/SFTP, Telegram, LLM. כל אקורדיון מציג תג סטטוס (מוגדר/לא מוגדר). לחיצה פותחת את ההגדרות.
result: pass

### 8. הגדרות — מתג הפעלה/כיבוי
expected: בכל אקורדיון יש מתג (toggle/switch) שמפעיל או מכבה את האינטגרציה. שינוי המתג משנה את הסטטוס.
result: pass

### 9. הגדרות — שמירת הגדרות
expected: ממלא שדות באחד האקורדיונים (לדוגמה SMS — token ו-fromName). לוחץ שמור. מרענן את הדף — ההגדרות נשמרות. שדות רגישים (token, סיסמה) מוצגים ממוסכים (4 תווים ראשונים + ***).
result: pass

### 10. הגדרות — בדיקת חיבור
expected: לוחץ על "בדיקת חיבור" באחד האקורדיונים. מוצגת הודעת toast עם תוצאת הבדיקה (הצלחה או כישלון עם הודעת שגיאה).
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "פיד פעילות אחרונה מציג שם משתמש אמיתי וזיהוי ישות קריא"
  status: failed
  reason: "User reported: אני לא רואה שם משתמש או שם העובד אלא רק מספרים ומשפטים לא מזוהים כמו פעל על פרויקט"
  severity: major
  test: 2
  root_cause: "Query selects non-existent full_name/email from public.users — names live in employees table via users.employee_id FK. Entity ID rendered as raw UUID with no name lookup."
  artifacts:
    - path: "src/app/(admin)/admin/dashboard/page.tsx"
      issue: "Line 99: .select('auth_user_id, full_name, email') — columns don't exist on users table"
    - path: "src/components/admin/dashboard/ActivityFeed.tsx"
      issue: "Line 122-123: entry.entity_id rendered raw as UUID"
  missing:
    - "Join users → employees to get first_name + last_name"
    - "Entity name resolution: group entity_ids by entity_type, query respective tables for display names"
  debug_session: ".planning/debug/dashboard-activity-names.md"

- truth: "טבלת יומן פעולות מציגה שם משתמש קריא ומזהה ישות קריא"
  status: failed
  reason: "User reported: גם פה בעמודת משתמש יש מספרים ובעמודת מזהה ישות יש מספרים"
  severity: major
  test: 3
  root_cause: "Same broken query (.select full_name/email from users) in audit-log page.tsx and export-audit route.ts. AuditLogTable entity_id column truncates UUID with no name lookup."
  artifacts:
    - path: "src/app/(admin)/admin/audit-log/page.tsx"
      issue: "Line 96: .select('auth_user_id, full_name, email') — columns don't exist"
    - path: "src/components/admin/audit-log/AuditLogTable.tsx"
      issue: "Line 200-216: entity_id rendered as truncated UUID"
    - path: "src/app/(admin)/api/export-audit/route.ts"
      issue: "Line 83: same broken user name query"
  missing:
    - "Join users → employees for display names in all 3 server files"
    - "Entity name resolution in audit-log page.tsx and export-audit route.ts"
  debug_session: ".planning/debug/audit-log-truncated-uuids.md"
