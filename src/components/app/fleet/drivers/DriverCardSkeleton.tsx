import { Skeleton } from '@/components/ui/skeleton'

/**
 * DriverCardSkeleton — loading skeleton for the driver card detail page.
 * Mirrors the real DriverCard layout: breadcrumb + header (avatar + name + buttons) + 5-tab strip + content area.
 * Shows an animated shimmer bar at top so the user knows the system is working.
 */
export function DriverCardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto w-full" dir="rtl">
      {/* ── Animated shimmer bar at top ── */}
      <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden mb-4">
        <div className="h-full w-1/3 bg-sky-500/70 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {/* ── Breadcrumb skeleton ── */}
      <nav className="flex items-center gap-1 mb-4 justify-end">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-3 w-3 rounded" />
        <Skeleton className="h-4 w-20 rounded" />
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

        {/* Header content */}
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          {/* Action buttons — right side (Back, PDF, SMS, Delete) */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Skeleton className="h-9 w-16 rounded-lg" />
            <Skeleton className="h-9 w-14 rounded-lg" />
            <Skeleton className="h-9 w-14 rounded-lg" />
            <Skeleton className="h-9 w-14 rounded-lg" />
          </div>

          {/* Identity — left side (avatar + name + subtitle) */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 text-right space-y-2">
              <Skeleton className="h-7 w-36 rounded-md mr-auto" />
              <Skeleton className="h-4 w-48 rounded-md mr-auto" />
            </div>
            {/* Avatar */}
            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          </div>
        </div>
      </div>

      {/* ── Tab strip ── */}
      <div
        className="bg-white border-x border-b px-3 py-2 flex gap-1 overflow-x-auto"
        style={{ borderColor: '#E2EBF4' }}
      >
        {/* 5 tabs: פרטי הנהג | רשיון נהיגה | מסמכים | תרבות נהיגה | לוג נסיעות */}
        {[88, 96, 72, 100, 88].map((w, i) => (
          <Skeleton key={i} className="h-10 rounded-md shrink-0" style={{ width: w }} />
        ))}
      </div>

      {/* ── Tab content area ── */}
      <div
        className="bg-white rounded-b-2xl border-x border-b p-5 min-h-[300px] space-y-3"
        style={{ borderColor: '#E2EBF4', boxShadow: 'var(--shadow-card)' }}
      >
        {/* Simulate form fields — label + value rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: '#EEF3F9' }}>
            <Skeleton className="h-4 w-28 rounded shrink-0" />
            <Skeleton className="h-4 flex-1 rounded" />
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
