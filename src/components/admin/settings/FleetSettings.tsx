'use client'

/**
 * FleetSettings — Fleet module alert threshold configuration.
 *
 * Manages 4 numeric fields (stored in .env.local as days):
 *   - licenseYellowDays  → FLEET_LICENSE_YELLOW_DAYS  (default 60)
 *   - licenseRedDays     → FLEET_LICENSE_RED_DAYS     (default 30)
 *   - documentYellowDays → FLEET_DOCUMENT_YELLOW_DAYS (default 60)
 *   - documentRedDays    → FLEET_DOCUMENT_RED_DAYS    (default 30)
 *
 * These values drive the FitnessLight (רמזור כשירות) logic for drivers.
 * Yellow = expiry is approaching. Red = license expired.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { saveIntegrationSettings } from '@/actions/settings'
import type { FleetSettingsData } from '@/actions/settings'
import { DriversImportSection } from './DriversImportSection'

type Props = {
  settings: FleetSettingsData
}

export function FleetSettings({ settings }: Props) {
  const [licenseYellow, setLicenseYellow] = useState(String(settings.licenseYellowDays))
  const [licenseRed,    setLicenseRed]    = useState(String(settings.licenseRedDays))
  const [docYellow,     setDocYellow]     = useState(String(settings.documentYellowDays))
  const [docRed,        setDocRed]        = useState(String(settings.documentRedDays))
  const [adminPassword, setAdminPassword] = useState(settings.adminPassword)
  const [showPassword,  setShowPassword]  = useState(false)
  const [hasSavedPassword, setHasSavedPassword] = useState(settings.hasSavedAdminPassword)

  const [isSaving, startSavingTransition] = useTransition()

  function handleSave() {
    // Basic validation: red threshold must be < yellow threshold
    const ly = parseInt(licenseYellow, 10)
    const lr = parseInt(licenseRed, 10)
    const dy = parseInt(docYellow, 10)
    const dr = parseInt(docRed, 10)

    if ([ly, lr, dy, dr].some((n) => isNaN(n) || n < 1)) {
      toast.error('כל הערכים חייבים להיות מספרים חיוביים')
      return
    }
    if (lr >= ly) {
      toast.error('ספ ההתראה האדומה לרשיון חייב להיות קטן מהצהובה')
      return
    }
    if (dr >= dy) {
      toast.error('ספ ההתראה האדומה למסמכים חייב להיות קטן מהצהובה')
      return
    }

    startSavingTransition(async () => {
      const payload: Record<string, string> = {
        licenseYellowDays:  String(ly),
        licenseRedDays:     String(lr),
        documentYellowDays: String(dy),
        documentRedDays:    String(dr),
      }
      // Always send password value (field is pre-populated with saved value)
      if (adminPassword.trim()) {
        payload['adminPassword'] = adminPassword.trim()
      }
      const result = await saveIntegrationSettings('fleet', payload)
      if (result.success) {
        toast.success('הגדרות צי הרכב נשמרו')
        setHasSavedPassword(Boolean(adminPassword.trim()))
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת ההגדרות')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* License expiry thresholds */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b pb-1">
          תפוגת רשיון נהיגה
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fleet-lic-yellow" className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
              התראה צהובה (ימים לפני)
            </Label>
            <Input
              id="fleet-lic-yellow"
              type="number"
              min={1}
              max={365}
              value={licenseYellow}
              onChange={(e) => setLicenseYellow(e.target.value)}
              dir="ltr"
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fleet-lic-red" className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              התראה אדומה (ימים לפני)
            </Label>
            <Input
              id="fleet-lic-red"
              type="number"
              min={1}
              max={365}
              value={licenseRed}
              onChange={(e) => setLicenseRed(e.target.value)}
              dir="ltr"
              className="w-28"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          כשיישאר פחות מ-<strong>{licenseYellow}</strong> ימים — צהוב.
          כשיישאר פחות מ-<strong>{licenseRed}</strong> ימים — אדום.
          אם פג — אדום.
        </p>
      </div>

      {/* Document expiry thresholds */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b pb-1">
          תפוגת מסמכי נהג
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fleet-doc-yellow" className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
              התראה צהובה (ימים לפני)
            </Label>
            <Input
              id="fleet-doc-yellow"
              type="number"
              min={1}
              max={365}
              value={docYellow}
              onChange={(e) => setDocYellow(e.target.value)}
              dir="ltr"
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fleet-doc-red" className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              התראה אדומה (ימים לפני)
            </Label>
            <Input
              id="fleet-doc-red"
              type="number"
              min={1}
              max={365}
              value={docRed}
              onChange={(e) => setDocRed(e.target.value)}
              dir="ltr"
              className="w-28"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          כשיישאר פחות מ-<strong>{docYellow}</strong> ימים — צהוב.
          כשיישאר פחות מ-<strong>{docRed}</strong> ימים — אדום.
        </p>
      </div>

      {/* Admin delete password */}
      <div className="space-y-3 border-t pt-4 mt-2">
        <h3 className="text-sm font-semibold text-foreground border-b pb-1">
          סיסמת מחיקה (כרטיס נהג)
        </h3>
        <p className="text-xs text-muted-foreground">
          סיסמה זו תידרש בעת מחיקת כרטיס נהג.
          {hasSavedPassword && (
            <span className="mr-1 text-green-600 font-medium">✓ סיסמה מוגדרת</span>
          )}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="fleet-admin-pw">
            {hasSavedPassword ? 'שנה סיסמה' : 'הגדר סיסמה חדשה'}
          </Label>
          <div className="relative w-56">
            <Input
              id="fleet-admin-pw"
              type={showPassword ? 'text' : 'password'}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="הקלד סיסמה..."
              className="pr-9"
              dir="ltr"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving} size="sm">
        {isSaving && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
        שמור הגדרות
      </Button>

      <Separator className="my-6" />

      {/* Drivers.top Import */}
      <DriversImportSection />
    </div>
  )
}
