'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

// מפת נתיבים להודעות טעינה בעברית
const ROUTE_MESSAGES: Record<string, string> = {
  '/admin/dashboard': 'טוען לוח בקרה...',
  '/admin/employees': 'טוען רשימת עובדים...',
  '/admin/companies': 'טוען רשימת חברות...',
  '/admin/departments': 'טוען רשימת מחלקות...',
  '/admin/role-tags': 'טוען תגי תפקיד...',
  '/admin/users': 'טוען רשימת משתמשים...',
  '/admin/templates': 'טוען תבניות...',
  '/admin/projects': 'טוען רשימת פרויקטים...',
  '/admin/audit-log': 'טוען לוג פעילות...',
  '/admin/settings': 'טוען הגדרות...',
  '/admin/fleet/import-drivers': 'טוען ייבוא נהגים...',
  '/admin/fleet/import-carlog': 'טוען ייבוא תדלוקים...',
  '/admin/employees/import': 'טוען ייבוא עובדים...',
  '/app/fleet/driver-card': 'טוען כרטיס נהג...',
  '/app/fleet/vehicle-card': 'טוען כרטיס רכב...',
  '/app/fleet/fuel': 'טוען דוחות דלק...',
  '/app/fleet/tolls': 'טוען אגרות כבישים...',
  '/app/fleet/invoices': 'טוען חשבוניות...',
  '/app/fleet/ev-charging': 'טוען טעינה חשמלית...',
  '/app/fleet/rentals': 'טוען השכרות...',
  '/app/fleet/forms': 'טוען טפסים...',
  '/app/fleet/exceptions': 'טוען חריגות...',
  '/app/fleet/reports': 'טוען דוחות...',
  '/app/fleet': 'טוען מודול צי רכב...',
  '/app/equipment': 'טוען מודול צמ"ה...',
}

function getRouteMessage(href: string): string {
  // Exact match first
  if (ROUTE_MESSAGES[href]) return ROUTE_MESSAGES[href]

  // Try prefix match (longest first) — e.g. /app/fleet/driver-card/123
  const sorted = Object.keys(ROUTE_MESSAGES).sort((a, b) => b.length - a.length)
  for (const route of sorted) {
    if (href.startsWith(route)) return ROUTE_MESSAGES[route]
  }

  return 'טוען...'
}

// Simulated progress stages
const PROGRESS_STAGES = [
  { value: 30, delay: 0 },
  { value: 50, delay: 400 },
  { value: 65, delay: 800 },
  { value: 75, delay: 1500 },
  { value: 85, delay: 2500 },
]

const TIMEOUT_MS = 8000

export function NavigationLoader() {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)
  const [message, setMessage] = useState('טוען...')
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const currentPathRef = useRef(pathname)
  const navigationStartRef = useRef(false)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  const endNavigation = useCallback(() => {
    if (!navigationStartRef.current) return
    navigationStartRef.current = false
    clearTimers()
    setProgress(100)
    // Fade out after completing
    const t = setTimeout(() => {
      setVisible(false)
      setIsNavigating(false)
      setProgress(0)
    }, 300)
    timersRef.current.push(t)
  }, [clearTimers])

  const startNavigation = useCallback(
    (href: string) => {
      // Don't start if already navigating or same page
      if (navigationStartRef.current) return
      if (href === currentPathRef.current) return

      // Don't show for hash links or external URLs
      if (href.startsWith('#') || href.startsWith('http')) return

      navigationStartRef.current = true
      setMessage(getRouteMessage(href))
      setProgress(0)
      setIsNavigating(true)
      setVisible(true)

      // Simulate progress stages
      for (const stage of PROGRESS_STAGES) {
        const t = setTimeout(() => setProgress(stage.value), stage.delay)
        timersRef.current.push(t)
      }

      // Safety timeout
      const timeout = setTimeout(endNavigation, TIMEOUT_MS)
      timersRef.current.push(timeout)
    },
    [endNavigation]
  )

  // Detect navigation completion via pathname change
  useEffect(() => {
    if (pathname !== currentPathRef.current) {
      currentPathRef.current = pathname
      endNavigation()
    }
  }, [pathname, endNavigation])

  // Global click listener — intercept internal link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Find closest anchor element
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // Only internal links that start with /
      if (!href.startsWith('/')) return

      // Skip if modifier keys (open in new tab, etc.)
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return

      // Skip if target="_blank"
      if (anchor.target === '_blank') return

      // Skip download links
      if (anchor.hasAttribute('download')) return

      startNavigation(href)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [startNavigation])

  // Cleanup on unmount
  useEffect(() => {
    return clearTimers
  }, [clearTimers])

  if (!isNavigating && !visible) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-xs mx-4 bg-white rounded-xl shadow-2xl p-6 flex flex-col items-center gap-4 transition-all duration-200 ${
          visible
            ? 'scale-100 opacity-100'
            : 'scale-95 opacity-0'
        }`}
        dir="rtl"
      >
        {/* Spinner */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-sky-50">
          <Loader2 className="h-6 w-6 text-sky-600 animate-spin" />
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-800">
          אנא המתן...
        </h3>

        {/* Dynamic message */}
        <p className="text-sm text-gray-500 text-center">
          {message}
        </p>

        {/* Progress bar */}
        <div className="w-full" dir="ltr">
          <Progress
            value={progress}
            className="h-2 bg-gray-100 [&>div]:bg-sky-500 [&>div]:transition-all [&>div]:duration-500 [&>div]:ease-out"
          />
        </div>

        {/* Percentage */}
        <span className="text-xs text-gray-400 tabular-nums">
          {progress}%
        </span>
      </div>
    </div>
  )
}
