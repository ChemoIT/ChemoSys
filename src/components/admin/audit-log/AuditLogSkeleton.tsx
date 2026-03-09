import { Skeleton } from '@/components/ui/skeleton'

/**
 * AuditLogSkeleton — Loading skeleton for the Audit Log page.
 *
 * Mirrors the real layout: header (title + refresh button), filter bar
 * (entity type, action, search, date range pickers), table (7 columns, 10 rows),
 * and pagination footer.
 *
 * Shown as the <Suspense> fallback during initial server-side data fetch
 * and during filter-triggered re-renders (server component re-render).
 *
 * Admin pages are full-width — no maxWidth constraint applied.
 */
export function AuditLogSkeleton() {
  const TABLE_COLUMNS = [40, 120, 100, 80, 100, 100, 100]
  const TABLE_ROWS = 10

  return (
    <div className="space-y-5 w-full" dir="rtl">
      {/* ── Animated shimmer progress bar at top ── */}
      <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-sky-500/70 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {/* ── Header: title + refresh button placeholder ── */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-28 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* ── Filter bar: 5 filter placeholders ── */}
      {/* entity type | action | date from | date to | search */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-36 rounded-full" />
        <Skeleton className="h-9 w-36 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-48 rounded-full" />
      </div>

      {/* ── Table skeleton ── */}
      <div className="rounded-md border overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-3 py-3 border-b bg-muted/40">
          {TABLE_COLUMNS.map((w, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: TABLE_ROWS }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-3"
            style={{ borderBottom: i < TABLE_ROWS - 1 ? '1px solid #EEF3F9' : 'none' }}
          >
            {TABLE_COLUMNS.map((w, j) => (
              <Skeleton key={j} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}

        {/* Pagination footer */}
        <div className="px-4 py-2.5 flex items-center justify-between border-t bg-muted/20">
          <Skeleton className="h-4 w-48 rounded" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
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
