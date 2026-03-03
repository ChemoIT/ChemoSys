import { ShieldAlert } from 'lucide-react'

/**
 * AccessDenied — server component displayed when a user navigates to a
 * protected page they don't have permission to access.
 *
 * No 'use client' — renders server-side, no interactivity needed.
 * Used in all admin page Server Components after checkPagePermission() returns false.
 */
export function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <ShieldAlert className="h-16 w-16 text-muted-foreground/40" />
      <h2 className="text-xl font-semibold text-foreground">אין גישה</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        אין לך הרשאה לצפות בדף זה. פנה למנהל המערכת לקבלת גישה.
      </p>
    </div>
  )
}
