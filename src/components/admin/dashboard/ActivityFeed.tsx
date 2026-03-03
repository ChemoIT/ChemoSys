'use client'

// ActivityFeed — shows the 20 most recent audit log entries on the dashboard.
// Each entry shows: user name, action badge (Hebrew), entity type (Hebrew), and relative time.
// Pitfall 2 from RESEARCH.md: user_id in audit_log refs auth.users — display name resolved
// server-side via two-step query and passed as `userName` in each entry.

import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale/he'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity } from 'lucide-react'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type ActivityEntry = {
  id: string
  created_at: string
  action: string
  entity_type: string
  entity_id: string
  user_id: string
  userName: string // resolved server-side from public.users
}

// ----------------------------------------------------------------
// Mappings
// ----------------------------------------------------------------

const ACTION_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | null; className: string }> = {
  INSERT: { label: 'יצירה',  variant: null, className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  UPDATE: { label: 'עדכון',  variant: null, className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  DELETE: { label: 'מחיקה', variant: null, className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  LOGIN:  { label: 'כניסה',  variant: null, className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  LOGOUT: { label: 'יציאה',  variant: null, className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

const ENTITY_TYPE_MAP: Record<string, string> = {
  employees:        'עובד',
  companies:        'חברה',
  departments:      'מחלקה',
  projects:         'פרויקט',
  users:            'משתמש',
  role_tags:        'תגית תפקיד',
  role_templates:   'תבנית הרשאות',
  employee_import:  'ייבוא עובדים',
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function ActionBadge({ action }: { action: string }) {
  const mapping = ACTION_MAP[action] ?? {
    label: action,
    variant: null,
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${mapping.className}`}>
      {mapping.label}
    </span>
  )
}

function formatEntityType(entityType: string): string {
  return ENTITY_TYPE_MAP[entityType] ?? entityType
}

function formatUserName(entry: ActivityEntry): string {
  if (entry.userName) return entry.userName
  // Fallback: truncated UUID if no name resolved
  return entry.user_id ? `${entry.user_id.slice(0, 8)}…` : 'לא ידוע'
}

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { locale: he, addSuffix: true })
  } catch {
    return dateStr
  }
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          פעילות אחרונה
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            אין פעילות מתועדת
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-6 py-3 hover:bg-muted/40 transition-colors">
                {/* Action badge */}
                <div className="pt-0.5 shrink-0">
                  <ActionBadge action={entry.action} />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{formatUserName(entry)}</span>
                    {' '}
                    <span className="text-muted-foreground">פעל על</span>
                    {' '}
                    <span className="font-medium">{formatEntityType(entry.entity_type)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="ltr">
                    {entry.entity_id}
                  </p>
                </div>

                {/* Timestamp */}
                <div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap pt-0.5" dir="rtl">
                  {formatRelativeTime(entry.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
