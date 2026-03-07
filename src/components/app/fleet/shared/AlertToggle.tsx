'use client'

/**
 * AlertToggle — bell toggle switch for alert_enabled fields.
 *
 * Shared component — used by DriverDocumentsSection and DriverLicenseSection,
 * and will be used by vehicle document/test sections in Phase 14+.
 *
 * Uses dir="ltr" on wrapper + dir="rtl" on label to fix RTL slide direction
 * (shadcn Switch slides correctly only in LTR context).
 */

import { Bell } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

type AlertToggleProps = {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}

export function AlertToggle({ checked, onChange, label }: AlertToggleProps) {
  return (
    <div className="flex items-center gap-2.5 shrink-0" dir="ltr">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[#4ECDC4]"
      />
      <span
        dir="rtl"
        className={`text-xs flex items-center gap-1 transition-colors ${checked ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}
      >
        <Bell className="h-3.5 w-3.5" />
        {label}
      </span>
    </div>
  )
}
