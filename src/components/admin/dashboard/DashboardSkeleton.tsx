import { Skeleton } from '@/components/ui/skeleton'

/**
 * DashboardSkeleton — custom loading skeleton for the admin dashboard page.
 *
 * Mirrors the real dashboard layout:
 *   1. Animated shimmer progress bar at top (IRON RULE: always visible during load)
 *   2. Header with title + refresh button placeholder
 *   3. 6 stat cards in a 3-column grid (lg) — employees, projects, users, companies, departments, role tags
 *   4. Activity feed section — 8 skeleton rows with avatar + action + timestamp
 *
 * Server Component — no 'use client' needed.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Animated shimmer progress bar at top ── */}
      <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-sky-500/70 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        {/* Title: "דשבורד" placeholder */}
        <Skeleton className="h-7 w-24 rounded-md" />
        {/* Refresh button placeholder */}
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* ── 6 stat cards grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white border border-border p-5 flex flex-col gap-4"
            style={{ minHeight: 120, boxShadow: 'var(--shadow-card)' }}
          >
            {/* Top row: icon circle + label */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            {/* Bottom: large number */}
            <Skeleton className="h-8 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* ── Activity feed section ── */}
      <div className="rounded-2xl bg-white border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Section header */}
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-6 w-32 rounded" />
        </div>

        {/* 8 activity rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-3.5"
            style={{ borderBottom: i < 7 ? '1px solid #EEF3F9' : 'none' }}
          >
            {/* Avatar circle */}
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            {/* Action text */}
            <Skeleton className="h-4 flex-1 max-w-48 rounded" />
            {/* Timestamp — pushed to end */}
            <div className="mr-auto">
              <Skeleton className="h-3 w-20 rounded" />
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
