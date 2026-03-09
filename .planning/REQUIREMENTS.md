# Requirements: ChemoSys v2.1 — Performance & UX

**Defined:** 2026-03-09
**Core Value:** כל דף במערכת נטען עם feedback מיידי (Skeleton), DB מאופטם, ו-loading indicators — חוויית משתמש חלקה ומודרנית.

## v2.1 Requirements

### Suspense & Skeleton — App Pages (SKEL-APP)

- [ ] **SKEL-APP-01**: רשימת רכבים — Suspense boundary + Skeleton component עם שורות טבלה + פילטרים
- [ ] **SKEL-APP-02**: כרטיס רכב (דף [id]) — Suspense boundary + Skeleton component עם 7 טאבים
- [ ] **SKEL-APP-03**: רשימת נהגים — Suspense boundary + Skeleton component עם שורות טבלה + פילטרים
- [ ] **SKEL-APP-04**: כרטיס נהג (דף [id]) — Suspense boundary + Skeleton component עם header + טאבים
- [ ] **SKEL-APP-05**: דף דלק — כבר מיושם (FuelPageSkeleton) — רפרנס בלבד, לא נדרשת עבודה

### Suspense & Skeleton — Admin Pages (SKEL-ADM)

- [ ] **SKEL-ADM-01**: Dashboard — Suspense + Skeleton עם 6 stat cards + activity feed placeholders
- [ ] **SKEL-ADM-02**: Projects — Suspense + Skeleton עם טבלת פרויקטים
- [ ] **SKEL-ADM-03**: Users — Suspense + Skeleton עם טבלת יוזרים
- [ ] **SKEL-ADM-04**: Audit Log — Suspense + Skeleton עם טבלת לוגים + פילטרים
- [ ] **SKEL-ADM-05**: Templates — Suspense + Skeleton עם רשימת תבניות
- [ ] **SKEL-ADM-06**: Settings — Suspense + Skeleton עם טפסי הגדרות
- [ ] **SKEL-ADM-07**: Vehicle Suppliers — Suspense + Skeleton עם טבלת ספקים
- [ ] **SKEL-ADM-08**: הסרת loading.tsx ישנים (companies, departments, employees, role-tags) ומעבר ל-Suspense אחיד

### DB Optimization (DBOPT)

- [ ] **DBOPT-01**: Dashboard — RPC אגרגטיבי שמחזיר את כל ה-stats ב-query אחד (במקום 7 queries נפרדים)
- [ ] **DBOPT-02**: Vehicle card — ביקורת ואופטימיזציה של 7 queries בדף [id] (views/indexes לפי הצורך)
- [ ] **DBOPT-03**: Driver list — index על driver_computed_status view + שדות filter נפוצים
- [ ] **DBOPT-04**: Admin tables — composite indexes על projects, users, audit_log לפי דפוסי filter/sort נפוצים
- [ ] **DBOPT-05**: React.cache() על server actions נפוצים שנקראים ממספר server components

### Loading Indicators (LOAD)

- [ ] **LOAD-01**: רשימת רכבים — spinner + text בזמן filter/search change
- [ ] **LOAD-02**: רשימת נהגים — spinner + text בזמן filter/search change
- [ ] **LOAD-03**: כרטיס רכב — loading indicator בזמן tab switch (אם טאב טוען data)
- [ ] **LOAD-04**: כרטיס נהג — loading indicator בזמן tab switch (אם טאב טוען data)
- [ ] **LOAD-05**: דפי admin (טבלאות) — spinner + text בזמן filter/pagination change
- [ ] **LOAD-06**: Save button — loading state ברור בכל כפתור שמירה שעדיין חסר

### IRON RULE & Standards (RULE)

- [ ] **RULE-01**: הגדרת IRON RULE חדש ב-CLAUDE.md: "כל דף חדש חייב Suspense + Skeleton + loading indicators"
- [ ] **RULE-02**: תיעוד Performance Standard — מסמך הנחיות עם דוגמאות קוד (רפרנס: FuelPageSkeleton)
- [ ] **RULE-03**: Skeleton generator/boilerplate — תבנית קוד מוכנה ליצירת Skeleton components חדשים

## Future Requirements (v2.2+)

- **LAZY-01**: Lazy-load vehicle card tabs (dynamic import per tab — medium risk due to dirty tracking)
- **STREAM-01**: React streaming SSR for heavy pages (dashboard, lists)
- **PREFETCH-01**: Prefetch data on hover/focus for card links
- **CACHE-01**: ISR/SWR for semi-static data (companies, departments, role-tags)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Service Worker / PWA caching | מורכבות גבוהה, לא נדרש כרגע |
| CDN edge caching | Free tier — Vercel Hobby |
| Bundle splitting / code splitting | Next.js מטפל אוטומטית |
| Image optimization (next/image) | אין תמונות כבדות במערכת |
| WebSocket / real-time updates | לא רלוונטי ל-v2.1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SKEL-APP-01 | TBD | Pending |
| SKEL-APP-02 | TBD | Pending |
| SKEL-APP-03 | TBD | Pending |
| SKEL-APP-04 | TBD | Pending |
| SKEL-APP-05 | — | Complete (reference) |
| SKEL-ADM-01 | TBD | Pending |
| SKEL-ADM-02 | TBD | Pending |
| SKEL-ADM-03 | TBD | Pending |
| SKEL-ADM-04 | TBD | Pending |
| SKEL-ADM-05 | TBD | Pending |
| SKEL-ADM-06 | TBD | Pending |
| SKEL-ADM-07 | TBD | Pending |
| SKEL-ADM-08 | TBD | Pending |
| DBOPT-01 | TBD | Pending |
| DBOPT-02 | TBD | Pending |
| DBOPT-03 | TBD | Pending |
| DBOPT-04 | TBD | Pending |
| DBOPT-05 | TBD | Pending |
| LOAD-01 | TBD | Pending |
| LOAD-02 | TBD | Pending |
| LOAD-03 | TBD | Pending |
| LOAD-04 | TBD | Pending |
| LOAD-05 | TBD | Pending |
| LOAD-06 | TBD | Pending |
| RULE-01 | TBD | Pending |
| RULE-02 | TBD | Pending |
| RULE-03 | TBD | Pending |

**Coverage:**
- v2.1 requirements: 27 total (26 active + 1 reference)
- Mapped to phases: 0
- Unmapped: 26 ⚠️

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after initial definition*
