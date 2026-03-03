'use client'

// StatsCards — responsive grid of 6 summary stat cards for the dashboard.
// Each card shows an icon, Hebrew label, and count from the database.
// Pattern: STAT_ITEMS config array — easy to add/remove cards.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FolderKanban, UserCog, Building2, Network, Tags } from 'lucide-react'

type Stats = {
  employees: number
  projects: number
  users: number
  companies: number
  departments: number
  roleTags: number
}

const STAT_ITEMS = [
  {
    key: 'employees' as const,
    label: 'עובדים פעילים',
    icon: Users,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    key: 'projects' as const,
    label: 'פרויקטים פעילים',
    icon: FolderKanban,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
  },
  {
    key: 'users' as const,
    label: 'יוזרים',
    icon: UserCog,
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
  },
  {
    key: 'companies' as const,
    label: 'חברות',
    icon: Building2,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
  },
  {
    key: 'departments' as const,
    label: 'מחלקות',
    icon: Network,
    color: 'text-teal-500',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
  },
  {
    key: 'roleTags' as const,
    label: 'תגיות תפקיד',
    icon: Tags,
    color: 'text-pink-500',
    bg: 'bg-pink-50 dark:bg-pink-950/30',
  },
]

export function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {STAT_ITEMS.map(({ key, label, icon: Icon, color, bg }) => (
        <Card key={key} className="overflow-hidden">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className={`inline-flex items-center justify-center rounded-md p-1.5 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </span>
              <span className="leading-tight">{label}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold tracking-tight">
              {stats[key].toLocaleString('he-IL')}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
