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
      <div className="rounded-2xl bg-white border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Header row */}
        <div className="flex items-center gap-3 px-3 py-3 border-b" style={{ background: '#F8FAFC', borderColor: '#E8EEF4' }}>
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
        {/* Footer */}
        <div className="px-4 py-2.5 flex items-center justify-between border-t" style={{ background: '#FAFCFE', borderColor: '#EEF3F9' }}>
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
