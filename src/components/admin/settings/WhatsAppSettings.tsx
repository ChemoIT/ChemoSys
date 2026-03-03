'use client'

/**
 * WhatsAppSettings — Meta WhatsApp Cloud API configuration fields.
 *
 * Fields: Access Token (password), Phone Number ID (text), Business Account ID (text, optional).
 * Save: calls saveIntegrationSettings('whatsapp', values) via startTransition.
 * Test: calls testWhatsAppConnection() and shows toast.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { saveIntegrationSettings, testWhatsAppConnection } from '@/actions/settings'
import type { WhatsAppSettingsData } from '@/actions/settings'

type Props = {
  settings: WhatsAppSettingsData
}

export function WhatsAppSettings({ settings }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [accessToken, setAccessToken] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState(settings.phoneNumberId)
  const [businessAccountId, setBusinessAccountId] = useState(settings.businessAccountId)
  const [showToken, setShowToken] = useState(false)

  const [isSaving, startSavingTransition] = useTransition()
  const [isTesting, startTestingTransition] = useTransition()

  function handleSave() {
    startSavingTransition(async () => {
      const values: Record<string, string> = {
        enabled: String(enabled),
        phoneNumberId,
        businessAccountId,
      }
      if (accessToken.trim()) {
        values.accessToken = accessToken.trim()
      }

      const result = await saveIntegrationSettings('whatsapp', values)
      if (result.success) {
        toast.success('ההגדרות נשמרו')
        setAccessToken('')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת ההגדרות')
      }
    })
  }

  function handleTest() {
    startTestingTransition(async () => {
      const result = await testWhatsAppConnection()
      if (result.ok) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className={`space-y-4 ${!enabled ? 'opacity-60' : ''}`}>
      {/* Enable toggle */}
      <div className="flex items-center gap-3 pb-2 border-b">
        <Switch
          id="whatsapp-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="whatsapp-enabled" className="cursor-pointer font-medium">
          {enabled ? 'WhatsApp מופעל' : 'WhatsApp מושבת'}
        </Label>
      </div>

      {/* Access Token */}
      <div className="space-y-1.5">
        <Label htmlFor="wa-access-token">Access Token</Label>
        <div className="relative">
          <Input
            id="wa-access-token"
            type={showToken ? 'text' : 'password'}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={settings.hasSavedAccessToken ? '(שמור — הקלד לשינוי)' : 'הכנס token...'}
            className="pe-10"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showToken ? 'הסתר token' : 'הצג token'}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Phone Number ID */}
      <div className="space-y-1.5">
        <Label htmlFor="wa-phone-id">Phone Number ID</Label>
        <Input
          id="wa-phone-id"
          type="text"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          placeholder="123456789012345"
          dir="ltr"
        />
      </div>

      {/* Business Account ID (optional) */}
      <div className="space-y-1.5">
        <Label htmlFor="wa-business-id">Business Account ID <span className="text-muted-foreground text-xs">(אופציונלי)</span></Label>
        <Input
          id="wa-business-id"
          type="text"
          value={businessAccountId}
          onChange={(e) => setBusinessAccountId(e.target.value)}
          placeholder="987654321098765"
          dir="ltr"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          שמור הגדרות
        </Button>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={isTesting || (!settings.hasSavedAccessToken && !accessToken)}
          size="sm"
        >
          {isTesting && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          בדוק חיבור
        </Button>
      </div>
    </div>
  )
}
