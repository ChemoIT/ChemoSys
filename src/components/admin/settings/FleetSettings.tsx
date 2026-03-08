'use client'

/**
 * FleetSettings — Fleet module alert threshold configuration.
 *
 * Manages 8 numeric threshold fields (stored in .env.local as days):
 *   Driver thresholds:
 *     licenseYellowDays  → FLEET_LICENSE_YELLOW_DAYS  (default 60)
 *     licenseRedDays     → FLEET_LICENSE_RED_DAYS     (default 30)
 *     documentYellowDays → FLEET_DOCUMENT_YELLOW_DAYS (default 60)
 *     documentRedDays    → FLEET_DOCUMENT_RED_DAYS    (default 30)
 *   Vehicle thresholds:
 *     testYellowDays      → FLEET_TEST_YELLOW_DAYS      (default 60)
 *     testRedDays         → FLEET_TEST_RED_DAYS         (default 30)
 *     insuranceYellowDays → FLEET_INSURANCE_YELLOW_DAYS (default 60)
 *     insuranceRedDays    → FLEET_INSURANCE_RED_DAYS    (default 30)
 *
 * Also contains:
 *   - Admin delete password (used for driver/vehicle card deletion)
 *   - MOT API connectivity test button
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { saveIntegrationSettings } from '@/actions/settings'
import type { FleetSettingsData } from '@/actions/settings'
import { testMotApiConnection } from '@/actions/fleet/mot-sync'
import { DriversImportSection } from './DriversImportSection'
import { VehiclesImportSection } from './VehiclesImportSection'
import { ProjectsImportSection } from './ProjectsImportSection'

type Props = {
  settings: FleetSettingsData
}

export function FleetSettings({ settings }: Props) {
  // ── Driver thresholds ──────────────────────────────────────
  const [licenseYellow, setLicenseYellow] = useState(String(settings.licenseYellowDays))
  const [licenseRed,    setLicenseRed]    = useState(String(settings.licenseRedDays))
  const [docYellow,     setDocYellow]     = useState(String(settings.documentYellowDays))
  const [docRed,        setDocRed]        = useState(String(settings.documentRedDays))

  // ── Vehicle thresholds ─────────────────────────────────────
  const [testYellow, setTestYellow] = useState(String(settings.testYellowDays))
  const [testRed,    setTestRed]    = useState(String(settings.testRedDays))
  const [insYellow,  setInsYellow]  = useState(String(settings.insuranceYellowDays))
  const [insRed,     setInsRed]     = useState(String(settings.insuranceRedDays))

  // ── Admin password ─────────────────────────────────────────
  const [adminPassword, setAdminPassword] = useState(settings.adminPassword)
  const [showPassword,  setShowPassword]  = useState(false)
  const [hasSavedPassword, setHasSavedPassword] = useState(settings.hasSavedAdminPassword)

  // ── Transitions ────────────────────────────────────────────
  const [isSaving,  startSavingTransition]  = useTransition()
  const [isTesting, startTestingTransition] = useTransition()

  // ── Save handler ───────────────────────────────────────────
  function handleSave() {
    const ly  = parseInt(licenseYellow, 10)
    const lr  = parseInt(licenseRed,    10)
    const dy  = parseInt(docYellow,     10)
    const dr  = parseInt(docRed,        10)
    const ty  = parseInt(testYellow,    10)
    const tr  = parseInt(testRed,       10)
    const iy  = parseInt(insYellow,     10)
    const ir  = parseInt(insRed,        10)

    if ([ly, lr, dy, dr, ty, tr, iy, ir].some((n) => isNaN(n) || n < 1)) {
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
    if (tr >= ty) {
      toast.error('ספ ההתראה האדומה לטסט רכב חייב להיות קטן מהצהובה')
      return
    }
    if (ir >= iy) {
      toast.error('ספ ההתראה האדומה לביטוח רכב חייב להיות קטן מהצהובה')
      return
    }

    startSavingTransition(async () => {
      const payload: Record<string, string> = {
        licenseYellowDays:   String(ly),
        licenseRedDays:      String(lr),
        documentYellowDays:  String(dy),
        documentRedDays:     String(dr),
        testYellowDays:      String(ty),
        testRedDays:         String(tr),
        insuranceYellowDays: String(iy),
        insuranceRedDays:    String(ir),
      }
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

  // ── MOT test handler ───────────────────────────────────────
  function handleMotTest() {
    startTestingTransition(async () => {
      const result = await testMotApiConnection()
      if (result.ok) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="space-y-6">

      {/* ── 1. License expiry thresholds ─────────────────────── */}
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

      {/* ── 2. Document expiry thresholds ───────────────────── */}
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

      {/* ── 3. Vehicle test expiry thresholds ───────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b pb-1">
          תפוגת טסט רכב
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fleet-test-yellow" className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
              התראה צהובה (ימים לפני)
            </Label>
            <Input
              id="fleet-test-yellow"
              type="number"
              min={1}
              max={365}
              value={testYellow}
              onChange={(e) => setTestYellow(e.target.value)}
              dir="ltr"
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fleet-test-red" className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              התראה אדומה (ימים לפני)
            </Label>
            <Input
              id="fleet-test-red"
              type="number"
              min={1}
              max={365}
              value={testRed}
              onChange={(e) => setTestRed(e.target.value)}
              dir="ltr"
              className="w-28"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          כשיישאר פחות מ-<strong>{testYellow}</strong> ימים לתוקף הטסט — צהוב.
          כשיישאר פחות מ-<strong>{testRed}</strong> ימים — אדום.
          אם פג — אדום.
        </p>
      </div>

      {/* ── 4. Vehicle insurance expiry thresholds ───────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b pb-1">
          תפוגת ביטוח רכב
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fleet-ins-yellow" className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
              התראה צהובה (ימים לפני)
            </Label>
            <Input
              id="fleet-ins-yellow"
              type="number"
              min={1}
              max={365}
              value={insYellow}
              onChange={(e) => setInsYellow(e.target.value)}
              dir="ltr"
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fleet-ins-red" className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              התראה אדומה (ימים לפני)
            </Label>
            <Input
              id="fleet-ins-red"
              type="number"
              min={1}
              max={365}
              value={insRed}
              onChange={(e) => setInsRed(e.target.value)}
              dir="ltr"
              className="w-28"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          כשיישאר פחות מ-<strong>{insYellow}</strong> ימים לתוקף הביטוח — צהוב.
          כשיישאר פחות מ-<strong>{insRed}</strong> ימים — אדום.
        </p>
      </div>

      {/* ── 5. MOT API test ──────────────────────────────────── */}
      <div className="space-y-3 border-t pt-4 mt-2">
        <h3 className="text-sm font-semibold text-foreground border-b pb-1">
          API משרד הרישוי
        </h3>
        <p className="text-xs text-muted-foreground">
          בדיקת נגישות ל-API הרכב של משרד התחבורה (data.gov.il).
          משמש לסנכרון אוטומטי של פרטי רכב לפי מספר רישוי.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleMotTest}
          disabled={isTesting}
        >
          {isTesting
            ? <Loader2 className="h-4 w-4 ms-2 animate-spin" />
            : <RefreshCw className="h-4 w-4 ms-2" />
          }
          בדוק חיבור
        </Button>
      </div>

      {/* ── 6. Admin delete password ──────────────────────────── */}
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

      {/* ── 7. Save button ────────────────────────────────────── */}
      <Button onClick={handleSave} disabled={isSaving} size="sm">
        {isSaving && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
        שמור הגדרות
      </Button>

      <Separator className="my-6" />

      {/* ── 8. Drivers.top Import ─────────────────────────────── */}
      <DriversImportSection />

      <Separator className="my-6" />

      {/* ── 9. CarList.top Import ──────────────────────────────── */}
      <VehiclesImportSection />

      <Separator className="my-6" />

      {/* ── 10. SystemProject.top Import ─────────────────────────── */}
      <ProjectsImportSection />
    </div>
  )
}
