import { Skeleton } from '@/components/ui/skeleton'

/**
 * VehicleListSkeleton — loading skeleton for vehicle list page (/app/fleet/vehicle-card).
 * Matches the real VehicleList layout: header + stat chips + filters + 9-column table.
 * Shows an animated shimmer bar at top so the user knows the system is working.
 *
 * Columns mirrored: כשירות | מספר רישוי | יצרן/דגם | שנה | קטגוריה | פרויקט | נהג | סטטוס | (arrow)
 *
 * NOTE: VehicleList uses client-side filtering — no useTransition/loading indicator needed.
 * This skeleton handles the only slow part: initial server data fetch.
 */
export function VehicleListSkeleton() {
  // Column widths matching real table: כשירות, רישוי, יצרן/דגם, שנה, קטגוריה, פרויקט, נהג, סטטוס, חץ
  const colWidths = [40, 90, 120, 50, 80, 100, 80, 80, 32]

  return (
    <div className="max-w-[calc(100%-6cm)] mx-auto w-full space-y-5" dir="rtl">
      {/* ── Animated shimmer progress bar at top ── */}
      <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-sky-500/70 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {/* ── Header skeleton ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          {/* Title */}
          <Skeleton className="h-7 w-28 rounded-md" />
          {/* Stat chips: total, active, suspended */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        </div>
        {/* Add vehicle button placeholder */}
        <Skeleton className="h-8 w-28 rounded-md shrink-0" />
      </div>

      {/* ── Filter bar skeleton ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search input */}
        <Skeleton className="h-9 w-64 rounded-full" />
        {/* Status segment control */}
        <Skeleton className="h-9 w-52 rounded-full" />
        {/* Fitness segment control */}
        <Skeleton className="h-9 w-48 rounded-full" />
        {/* Vehicle type segment control */}
        <Skeleton className="h-9 w-48 rounded-full" />
        {/* Project dropdown */}
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>

      {/* ── Table skeleton ── */}
      <div
        className="rounded-2xl bg-white border border-border overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {/* Header row */}
        <div
          className="flex items-center gap-3 px-3 py-3 border-b"
          style={{ background: '#F8FAFC', borderColor: '#E8EEF4' }}
        >
          {colWidths.map((w, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ width: w, minWidth: w }} />
          ))}
        </div>

        {/* 10 data rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-3.5"
            style={{ borderBottom: i < 9 ? '1px solid #EEF3F9' : 'none' }}
          >
            {colWidths.map((w, j) => (
              <Skeleton key={j} className="h-4 rounded" style={{ width: w, minWidth: w }} />
            ))}
          </div>
        ))}

        {/* Footer: "displaying X of Y" placeholder */}
        <div
          className="px-4 py-2.5 border-t"
          style={{ background: '#FAFCFE', borderColor: '#EEF3F9' }}
        >
          <Skeleton className="h-4 w-36 rounded" />
        </div>
      </div>

      {/* Inline keyframes for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(200%); }
          100% { transform: translateX(-200%); }
        }
      `}</style>
    </div>
  )
}
