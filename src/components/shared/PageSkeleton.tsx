import { Skeleton } from '@/components/ui/skeleton'

/**
 * PageSkeletonConfig — configuration for generating a page-level loading skeleton.
 *
 * @example
 * // List page skeleton (like fuel page)
 * <PageSkeleton config={{
 *   titleWidth: 96,
 *   chips: [112, 96, 112],
 *   filters: [144, 144, 192, 160, 128, 192],
 *   table: { columns: [80, 50, 90, 80, 100, 60, 60, 60, 60, 80, 60, 70], rows: 10 }
 * }} />
 *
 * @example
 * // Dashboard skeleton (cards)
 * <PageSkeleton config={{
 *   titleWidth: 120,
 *   cards: { count: 6, height: 140, cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" }
 * }} />
 */
interface PageSkeletonConfig {
  /** Page title placeholder width (px). Default: 96 */
  titleWidth?: number
  /** Stat chips/badges to show below title. Array of widths (px). Empty = no chips. */
  chips?: number[]
  /** Filter bar placeholders. Array of widths (px). Empty = no filter bar. */
  filters?: number[]
  /** Table config. If provided, renders table skeleton. */
  table?: {
    /** Column widths (px) for header + each row */
    columns: number[]
    /** Number of data rows. Default: 10 */
    rows?: number
    /** Show pagination footer. Default: true */
    pagination?: boolean
  }
  /**
   * Card grid config. If provided, renders card grid skeleton (alternative to table).
   * Cannot be used together with table.
   */
  cards?: {
    /** Number of card placeholders */
    count: number
    /** Card height (px). Default: 120 */
    height?: number
    /** Tailwind grid-cols class. Default: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" */
    cols?: string
  }
  /** Max width class. Default: "max-w-[calc(100%-6cm)]" (matches fleet pages) */
  maxWidth?: string
}

/**
 * PageSkeleton — reusable configurable skeleton generator for page-level loading states.
 *
 * Generates a complete loading skeleton from a simple config object.
 * Use this for list pages and dashboards. For pages with unique layouts
 * (e.g., tabbed cards), create a custom skeleton component instead.
 *
 * Always renders an animated shimmer progress bar at the top so the user
 * knows the system is working.
 */
export function PageSkeleton({ config }: { config: PageSkeletonConfig }) {
  const {
    titleWidth = 96,
    chips,
    filters,
    table,
    cards,
    maxWidth = 'max-w-[calc(100%-6cm)]',
  } = config

  const tableRows = table?.rows ?? 10
  const tablePagination = table?.pagination ?? true
  const cardHeight = cards?.height ?? 120
  const cardCols = cards?.cols ?? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'

  return (
    <div className={`${maxWidth} mx-auto w-full space-y-5`} dir="rtl">
      {/* ── Animated progress bar at top ── */}
      <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-sky-500/70 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {/* ── Header skeleton ── */}
      <div>
        <Skeleton className="h-7 rounded-md" style={{ width: titleWidth }} />

        {/* Stat chips (optional) */}
        {chips && chips.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {chips.map((w, i) => (
              <Skeleton key={i} className="h-7 rounded-full" style={{ width: w }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Filter bar skeleton (optional) ── */}
      {filters && filters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {filters.map((w, i) => (
            <Skeleton key={i} className="h-9 rounded-full" style={{ width: w }} />
          ))}
        </div>
      )}

      {/* ── Table skeleton (optional) ── */}
      {table && (
        <div
          className="rounded-2xl bg-white border border-border overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {/* Header row */}
          <div
            className="flex items-center gap-3 px-3 py-3 border-b"
            style={{ background: '#F8FAFC', borderColor: '#E8EEF4' }}
          >
            {table.columns.map((w, i) => (
              <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>

          {/* Data rows */}
          {Array.from({ length: tableRows }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-3.5"
              style={{ borderBottom: i < tableRows - 1 ? '1px solid #EEF3F9' : 'none' }}
            >
              {table.columns.map((w, j) => (
                <Skeleton key={j} className="h-4 rounded" style={{ width: w }} />
              ))}
            </div>
          ))}

          {/* Pagination footer (optional) */}
          {tablePagination && (
            <div
              className="px-4 py-2.5 flex items-center justify-between border-t"
              style={{ background: '#FAFCFE', borderColor: '#EEF3F9' }}
            >
              <Skeleton className="h-4 w-36 rounded" />
              <div className="flex items-center gap-1">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Card grid skeleton (optional, alternative to table) ── */}
      {cards && (
        <div className={`grid ${cardCols} gap-4`}>
          {Array.from({ length: cards.count }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white border border-border overflow-hidden"
              style={{ height: cardHeight, boxShadow: 'var(--shadow-card)' }}
            >
              <Skeleton className="w-full h-full rounded-2xl" />
            </div>
          ))}
        </div>
      )}

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
