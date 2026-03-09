import { Skeleton } from '@/components/ui/skeleton'

/**
 * VehicleCardSkeleton — loading skeleton for the vehicle card detail page.
 * Mirrors the real VehicleCard layout:
 *   animated shimmer bar → breadcrumb → card header (accent + avatar/plate/buttons) → 8-tab strip → content area.
 * Shows immediately on navigation so the user never sees a blank screen.
 */
export function VehicleCardSkeleton() {
  return (
    <div className="max-w-[calc(100%-6cm)] mx-auto w-full" dir="rtl">

      {/* ── Animated shimmer bar at very top ── */}
      <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden mb-4">
        <div className="h-full w-1/3 bg-sky-500/70 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {/* ── Breadcrumb skeleton ── */}
      <nav className="flex items-center gap-1.5 justify-end mb-4">
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-3 w-3 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </nav>

      {/* ── Card header ── */}
      <div
        className="bg-white rounded-t-2xl overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card)', border: '1px solid #E2EBF4', borderBottom: 'none' }}
      >
        {/* Accent bar */}
        <div
          className="h-1"
          style={{ background: 'linear-gradient(to right, #4ECDC4, #3BBFB6, #2DAAA1, #4ECDC4)' }}
        />

        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          {/* Action buttons — right side (skeleton) */}
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-9 w-16 rounded-lg" />
            <Skeleton className="h-9 w-16 rounded-lg" />
          </div>

          {/* Identity — left side (avatar + plate + subtitle) */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 text-right space-y-1.5">
              <Skeleton className="h-8 w-40 rounded-md" />
              <Skeleton className="h-4 w-56 rounded" />
            </div>
            {/* Avatar */}
            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          </div>
        </div>
      </div>

      {/* ── Tab strip — 8 tabs ── */}
      <div
        className="bg-white overflow-hidden"
        style={{ border: '1px solid #E2EBF4', borderTop: 'none', borderBottom: 'none' }}
      >
        <div className="flex overflow-x-auto">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex-none px-3 py-2.5 border-b-2 border-transparent"
            >
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab content area ── */}
      <div
        className="bg-white rounded-b-2xl min-h-[400px] p-6 space-y-6"
        style={{ boxShadow: 'var(--shadow-card)', border: '1px solid #E2EBF4', borderTop: 'none' }}
      >
        {/* Simulated form sections — 3 blocks of label+value rows */}
        {Array.from({ length: 3 }).map((_, sectionIdx) => (
          <div key={sectionIdx} className="space-y-3">
            <Skeleton className="h-5 w-32 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, fieldIdx) => (
                <div key={fieldIdx} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-20 rounded" />
                  <Skeleton className={`h-9 rounded-lg ${fieldIdx % 3 === 0 ? 'w-full' : fieldIdx % 3 === 1 ? 'w-4/5' : 'w-3/5'}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
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
