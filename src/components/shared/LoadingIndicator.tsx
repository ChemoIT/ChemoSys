'use client'

import { Loader2 } from 'lucide-react'

/**
 * LoadingIndicator — standardized loading spinner with Hebrew status text.
 *
 * Drop-in replacement for the inline loading pattern in page components.
 * Renders nothing when isLoading is false (safe to render unconditionally).
 *
 * @example
 * // In a client component with useTransition:
 * const [isPending, startTransition] = useTransition()
 * // ...
 * <LoadingIndicator isLoading={isPending} />
 *
 * @example
 * // Custom text and small size:
 * <LoadingIndicator isLoading={isSubmitting} text="שומר שינויים..." size="sm" />
 */

interface LoadingIndicatorProps {
  /** Whether to show the indicator. Typically from useTransition's isPending. */
  isLoading: boolean
  /** Custom text. Default: "מעדכן נתונים..." */
  text?: string
  /** Size variant. Default: "default" */
  size?: 'sm' | 'default'
}

export function LoadingIndicator({
  isLoading,
  text = 'מעדכן נתונים...',
  size = 'default',
}: LoadingIndicatorProps) {
  if (!isLoading) return null

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <Loader2 className={`${iconSize} text-sky-600 animate-spin`} />
      <span className={`${textSize} text-muted-foreground`}>{text}</span>
    </div>
  )
}
