# Performance Standard — תבנית ביצועים חובה

> רפרנס: דף דלק (`/app/fleet/fuel`) — Session #40

כל דף חדש במערכת ChemoSystem חייב לממש את כל הדפוסים המפורטים כאן.
המטרה: אפס מסכים ריקים, feedback ויזואלי מיידי, ואגרגציות מהירות בצד DB.

---

## 1. Page Structure Pattern — Suspense + Skeleton

### כיצד עובדת התבנית

```
page.tsx renders instantly
    └─ <Suspense fallback={<PageSkeleton />}>   ← Skeleton מוצג מיד
           └─ <PageContent />                   ← async — מביא data מה-DB
                  └─ renders real UI            ← מחליף את ה-Skeleton
```

**כלל:** `page.tsx` עצמו חייב להיות synchronous ולהכיל רק את ה-auth check + ה-Suspense boundary.
כל ה-`await` לdata עוברים לתוך component פנימי נפרד.

### קוד רפרנס — `src/app/(app)/app/fleet/fuel/page.tsx`

```tsx
import { Suspense } from 'react'
import { verifyAppUser } from '@/lib/dal'
import { getFuelRecords, getFuelStats, getProjectsForFuelFilter } from '@/actions/fleet/fuel'
import { FuelRecordsPage } from '@/components/app/fleet/fuel/FuelRecordsPage'
import { FuelPageSkeleton } from '@/components/app/fleet/fuel/FuelPageSkeleton'
import type { FuelFilters } from '@/lib/fleet/fuel-types'

function getDefaultFilters(): FuelFilters {
  const now = new Date()
  return {
    fromMonth: now.getMonth() + 1,
    fromYear: now.getFullYear(),
    toMonth: now.getMonth() + 1,
    toYear: now.getFullYear(),
    // ... other defaults
  }
}

// ── Component פנימי async — כאן כל ה-data fetching ──
async function FuelContent() {
  const defaultFilters = getDefaultFilters()

  // Promise.all = parallel fetching — חוסך זמן המתנה
  const [{ records, total }, stats, projects] = await Promise.all([
    getFuelRecords(defaultFilters),
    getFuelStats(defaultFilters),
    getProjectsForFuelFilter(),
  ])

  return (
    <FuelRecordsPage
      initialRecords={records}
      initialTotal={total}
      initialStats={stats}
      projects={projects}
      initialFilters={defaultFilters}
    />
  )
}

// ── Page component — synchronous, מכיל auth + Suspense בלבד ──
export default async function FleetFuelPage() {
  await verifyAppUser()   // auth check לפני כל דבר

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <Suspense fallback={<FuelPageSkeleton />}>
        <FuelContent />
      </Suspense>
    </div>
  )
}
```

### נקודות חשובות
- **`verifyAppUser()`** (או `verifySession()` לאדמין) — תמיד **לפני** ה-Suspense
- **`Promise.all()`** — תמיד לbatch מספר server calls במקביל
- **אין `await`** ב-`page.tsx` עצמו מחוץ לauth — הכל בתוך הcomponent הפנימי

---

## 2. Skeleton Component Pattern

### דרישות חובה לכל Skeleton

1. **Animated shimmer bar** בחלק העליון — המשתמש רואה תנועה, יודע שהמערכת עובדת
2. **Layout matching** — Skeleton חייב לשקף את layout האמיתי (header → filters → table/cards)
3. **shadcn `<Skeleton>`** — שימוש בcomponent הסטנדרטי לplaceholder blocks
4. **Inline `@keyframes shimmer`** — style block בתוך ה-component
5. **שם** — `{PageName}Skeleton` (דוגמאות: `VehicleListSkeleton`, `DriverCardSkeleton`, `ProjectListSkeleton`)

### קוד רפרנס — `src/components/app/fleet/fuel/FuelPageSkeleton.tsx`

```tsx
import { Skeleton } from '@/components/ui/skeleton'

/**
 * FuelPageSkeleton — loading skeleton for fuel records page.
 * Matches the real layout: header + stat chips + filters + table.
 * Shows an animated progress bar at top so the user knows the system is working.
 */
export function FuelPageSkeleton() {
  return (
    <div className="max-w-[calc(100%-6cm)] mx-auto w-full space-y-5" dir="rtl">

      {/* ── Animated progress bar at top ── */}
      <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-sky-500/70 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {/* ── Header skeleton ── */}
      <div>
        <Skeleton className="h-7 w-24 rounded-md" />
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </div>

      {/* ── Filter bar skeleton ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <Skeleton className="h-9 w-36 rounded-full" />
        <Skeleton className="h-9 w-36 rounded-full" />
        <Skeleton className="h-9 w-48 rounded-full" />
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-48 rounded-full" />
      </div>

      {/* ── Table skeleton ── */}
      <div className="rounded-2xl bg-white border border-border overflow-hidden"
           style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Header row */}
        <div className="flex items-center gap-3 px-3 py-3 border-b"
             style={{ background: '#F8FAFC', borderColor: '#E8EEF4' }}>
          {[80, 50, 90, 80, 100, 60, 60, 60, 60, 80, 60, 70].map((w, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-3.5"
            style={{ borderBottom: i < 9 ? '1px solid #EEF3F9' : 'none' }}
          >
            {[80, 50, 90, 80, 100, 60, 60, 60, 60, 80, 60, 70].map((w, j) => (
              <Skeleton key={j} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
        {/* Footer / pagination */}
        <div className="px-4 py-2.5 flex items-center justify-between border-t"
             style={{ background: '#FAFCFE', borderColor: '#EEF3F9' }}>
          <Skeleton className="h-4 w-36 rounded" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Inline style for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(200%); }
          100% { transform: translateX(-200%); }
        }
      `}</style>
    </div>
  )
}
```

### ה-shimmer bar — הסבר הטכניקה

```
Container: w-full h-1 bg-muted/40 overflow-hidden
  └─ Bar:  w-1/3 bg-sky-500/70 animate-[shimmer_1.5s_ease-in-out_infinite]
           translateX(200%) → translateX(-200%)  =  נע מימין לשמאל ברציפות
```

---

## 3. Loading Indicator Pattern — Filter/Search/Pagination

### הבעיה שנפתרת

כאשר משתמש משנה filter, ה-UI צריך להציג שהנתונים מתעדכנים — בלי שהדף מתרנדר מחדש לגמרי.
הפתרון: `useTransition` של React — מאפשר עדכון state ב-background תוך הצגת pending state.

### קוד רפרנס — `src/components/app/fleet/fuel/FuelRecordsPage.tsx`

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { getFuelRecords, getFuelStats } from '@/actions/fleet/fuel'

export function FuelRecordsPage({ initialRecords, initialFilters, ... }) {
  const [records, setRecords] = useState(initialRecords)
  const [filters, setFilters] = useState(initialFilters)

  // ── useTransition — מאפשר loading indicator בזמן server call ──
  const [isPending, startTransition] = useTransition()

  const applyFilters = (newFilters: FuelFiltersType) => {
    setFilters(newFilters)
    startTransition(async () => {
      // כל server calls עוברים בתוך startTransition
      const [recordsResult, statsResult] = await Promise.all([
        getFuelRecords(newFilters),
        getFuelStats(newFilters),
      ])
      setRecords(recordsResult.records)
      setTotal(recordsResult.total)
      setStats(statsResult)
    })
  }

  return (
    <div>
      {/* ... filters, header ... */}

      {/* ── Loading indicator — מוצג בזמן isPending ── */}
      {isPending && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />
          <span className="text-sm text-muted-foreground">מעדכן נתונים...</span>
        </div>
      )}

      {/* ── Table — opacity נמוכה בזמן טעינה ── */}
      <div className={isPending ? 'opacity-60 pointer-events-none' : ''}>
        {/* table content */}
      </div>
    </div>
  )
}
```

### כללי שימוש
- **`useTransition`** — תמיד עבור server calls שמתחילות מ-client interaction
- **`isPending`** — להצגת loading indicator וlockout של UI בזמן העדכון
- **`Loader2`** מ-`lucide-react` — spinner סטנדרטי בפרויקט
- **הטקסט:** תמיד "מעדכן נתונים..." (עברית, עקבי בכל הדפים)

---

## 4. React.cache() Pattern

### הבעיה שנפתרת

כאשר מספר Server Components קוראים לאותה Server Action באותו render pass, נוצרים DB queries כפולים.
`React.cache()` מבטיח שה-function מופעל פעם אחת בלבד לכל render pass.

### קוד רפרנס — `src/actions/fleet/fuel.ts`

```ts
import { cache } from 'react'

/**
 * Get active project assignments for the fuel filter dropdown.
 * Wrapped in React.cache() — deduplicated within a single server render pass.
 */
export const getProjectsForFuelFilter = cache(async function getProjectsForFuelFilter(): Promise<ProjectOptionForFilter[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_project_journal')
    .select('project_id, projects ( name )')
    .is('end_date', null)

  if (error || !data) return []

  // ... process and return
})
```

### מתי להשתמש
- **כן:** Server Action שנקראת מ-2+ server components באותו request (כמו רשימת פרויקטים, רשימת קטגוריות)
- **לא:** Server Actions שמקבלות פרמטרים שונים בכל קריאה (cache לא יעזור)
- **לא:** Client-side calls (cache עובד רק ב-server render)

---

## 5. DB Aggregation Pattern — RPC במקום JS loop

### הבעיה שנפתרת

מביאים 10,000 שורות ל-JS רק כדי לסכום אותן — בזבוז bandwidth וזמן.
הפתרון: Supabase RPC (PostgreSQL function) שמחשבת `SUM()` בDB ומחזירה שורה אחת בלבד.

### קוד רפרנס — שימוש ב-RPC

```ts
// ❌ לא לעשות — JS loop על אלפי שורות
const { data: allRows } = await supabase.from('fuel_records').select('*')
const totalLiters = allRows?.reduce((sum, r) => sum + r.quantity_liters, 0) ?? 0

// ✅ לעשות — DB מחשב, מחזיר שורה אחת
const { data, error } = await supabase.rpc('get_fuel_stats', {
  p_from_date: fromDate,
  p_to_date: toDate,
  p_supplier: filters.supplier ?? null,
  p_fuel_type: filters.fuelType ?? null,
  p_plate_search: plateSearch,
  p_vehicle_ids: vehicleIds,
})

const row = Array.isArray(data) ? data[0] : data
const totalLiters = Number(row.total_liters) || 0
```

### PostgreSQL function template

```sql
-- Template לפונקציית aggregation
CREATE OR REPLACE FUNCTION get_page_stats(
  p_from_date date,
  p_to_date date,
  -- ... other filters
)
RETURNS TABLE(
  total_records bigint,
  total_value numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(amount), 0)
  FROM table_name
  WHERE date BETWEEN p_from_date AND p_to_date;
    -- ... other filter conditions
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### מתי להשתמש
- כל aggregation (SUM, COUNT, AVG) על יותר מ-~500 שורות → **RPC**
- Stats chips בראש דף (כמו סה"כ ליטר, סה"כ עלות) → **RPC תמיד**
- פעולות CRUD רגילות → Supabase client רגיל

---

## 6. Checklist — לפני שליחת דף חדש

השתמש בchecklist הזה לאימות לפני `git commit` על כל task של דף:

```
[ ] page.tsx has <Suspense> wrapping the async content component
[ ] Skeleton component exists with a name matching {PageName}Skeleton
[ ] Skeleton layout mirrors the real page (header → filters → table/cards)
[ ] Skeleton has animated shimmer bar at top (sky-500/70 + shimmer keyframes)
[ ] Client component uses useTransition + isPending for filter/search/pagination
[ ] Loading indicator renders when isPending === true: Loader2 + "מעדכן נתונים..."
[ ] Server Actions returning shared data are wrapped with React.cache()
[ ] Aggregations (totals, counts, sums) run in DB via RPC, not JS
[ ] No blank screen during initial load (Skeleton always visible instantly)
[ ] No silent filter changes (user always sees "מעדכן נתונים...")
```

---

## נספח — מבנה קבצים מומלץ

```
src/
├── app/(app)/app/fleet/[module]/
│   └── page.tsx                      ← Suspense + auth only
│
└── components/app/fleet/[module]/
    ├── [Module]Page.tsx               ← Client, useTransition, layout
    ├── [Module]PageSkeleton.tsx       ← Skeleton, shimmer bar
    ├── [Module]Filters.tsx            ← Client filter bar
    └── [Module]Table.tsx              ← Table / card list
```

---

> **סיכום:** הדף צריך לעבוד כך — המשתמש פותח דף, רואה skeleton מיד, data נטען ב-background ומחליף את ה-skeleton. כל שינוי filter מציג spinner + טקסט. אף פעולה לא נעשית בשקט.
