import { Skeleton } from '@/components/ui/skeleton'

/**
 * DriverListSkeleton — loading skeleton for driver cards list page.
 * Matches the real layout: header + stat chips + filters + 7-column table.
 * Shows an animated progress bar at top so the user knows the system is working.
 *
 * Container uses max-w-4xl (matches DriverList real layout).
 * No pagination footer — DriverList uses client-side filtering, no paginator.
 */
export function DriverListSkeleton() {
  // 7 columns: כשירות(40) | שם נהג(120) | מ׳ עובד(60) | חברה(100) | סוג(80) | סטטוס(70) | chevron(32)
  const colWidths = [40, 120, 60, 100, 80, 70, 32]

  return (
    <div className="max-w-4xl mx-auto w-full space-y-5" dir="rtl">
      {/* ── Animated progress bar at top ── */}
      <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-sky-500/70 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {/* ── Header skeleton ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          {/* Title */}
          <Skeleton className="h-7 w-28 rounded-md" />
          {/* Stat chips: סה"כ נהגים | פעילים | לא פעילים */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
        {/* "נהג חדש" button placeholder */}
        <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
      </div>

      {/* ── Filter bar skeleton ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search input */}
        <Skeleton className="h-9 w-52 rounded-full" />
        {/* Status segment control */}
        <Skeleton className="h-9 w-48 rounded-full" />
        {/* Fitness segment control */}
        <Skeleton className="h-9 w-56 rounded-full" />
      </div>

      {/* ── Table skeleton ── */}
      <div
        className="rounded-2xl bg-white border border-border overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {/* Header row */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ background: '#F8FAFC', borderColor: '#E8EEF4' }}
        >
          {colWidths.map((w, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ width: w, flexShrink: 0 }} />
          ))}
        </div>

        {/* Data rows — 10 rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderBottom: i < 9 ? '1px solid #EEF3F9' : 'none' }}
          >
            {colWidths.map((w, j) => (
              <Skeleton key={j} className="h-4 rounded" style={{ width: w, flexShrink: 0 }} />
            ))}
          </div>
        ))}

        {/* Footer row — "מציג X מתוך Y נהגים" */}
        <div
          className="px-4 py-2.5 border-t"
          style={{ background: '#FAFCFE', borderColor: '#EEF3F9' }}
        >
          <Skeleton className="h-3.5 w-36 rounded" />
        </div>
      </div>

      {/* Inline style for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(200%); }
          100% { transform: translateX(-200%); }
        }
      `}</style>
    </div>
  )
}
