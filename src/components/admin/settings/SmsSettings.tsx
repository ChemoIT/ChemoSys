'use client'

/**
 * SmsSettings — Micropay SMS integration configuration fields.
 *
 * Fields: Token (password), From Name (text, max 11 chars), Enable/Disable toggle.
 * Save: calls saveIntegrationSettings('sms', values) via startTransition.
 * Test: calls testSmsConnection() and shows toast.
 *
 * Security: sensitive token field masked in display; hasSavedToken flag controls placeholder.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { saveIntegrationSettings, testSmsConnection } from '@/actions/settings'
import type { SmsSettingsData } from '@/actions/settings'

type Props = {
  settings: SmsSettingsData
}

export function SmsSettings({ settings }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [token, setToken] = useState('')
  const [fromName, setFromName] = useState(settings.fromName)
  const [showToken, setShowToken] = useState(false)

  const [isSaving, startSavingTransition] = useTransition()
  const [isTesting, startTestingTransition] = useTransition()

  function handleSave() {
    startSavingTransition(async () => {
      const values: Record<string, string> = {
        enabled: String(enabled),
        fromName,
      }
      // Only include token if user typed a new one (preserve existing if left blank)
      if (token.trim()) {
        values.token = token.trim()
      }

      const result = await saveIntegrationSettings('sms', values)
      if (result.success) {
        toast.success('ההגדרות נשמרו')
        setToken('') // Clear token field after save (don't show it again)
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת ההגדרות')
      }
    })
  }

  function handleTest() {
    startTestingTransition(async () => {
      const result = await testSmsConnection()
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
          id="sms-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="sms-enabled" className="cursor-pointer font-medium">
          {enabled ? 'SMS מופעל' : 'SMS מושבת'}
        </Label>
      </div>

      {/* Token field */}
      <div className="space-y-1.5">
        <Label htmlFor="sms-token">Token אימות</Label>
        <div className="relative">
          <Input
            id="sms-token"
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={settings.hasSavedToken ? '(שמור — הקלד לשינוי)' : 'הכנס token...'}
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

      {/* From Name field */}
      <div className="space-y-1.5">
        <Label htmlFor="sms-from-name">שם שולח (עד 11 תווים)</Label>
        <Input
          id="sms-from-name"
          type="text"
          value={fromName}
          onChange={(e) => setFromName(e.target.value.slice(0, 11))}
          placeholder="Chemo IT"
          maxLength={11}
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">{fromName.length}/11 תווים</p>
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
          disabled={isTesting || !settings.hasSavedToken}
          size="sm"
        >
          {isTesting && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          בדוק חיבור
        </Button>
      </div>
    </div>
  )
}
