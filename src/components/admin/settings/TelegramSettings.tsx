'use client'

/**
 * TelegramSettings — Telegram Bot configuration fields.
 *
 * Fields: Bot Token (password), Chat ID (text).
 * Test: calls Telegram getMe API to verify bot token via testTelegramConnection().
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { saveIntegrationSettings, testTelegramConnection } from '@/actions/settings'
import type { TelegramSettingsData } from '@/actions/settings'

type Props = {
  settings: TelegramSettingsData
}

export function TelegramSettings({ settings }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState(settings.chatId)
  const [showToken, setShowToken] = useState(false)

  const [isSaving, startSavingTransition] = useTransition()
  const [isTesting, startTestingTransition] = useTransition()

  function handleSave() {
    startSavingTransition(async () => {
      const values: Record<string, string> = {
        enabled: String(enabled),
        chatId,
      }
      if (botToken.trim()) {
        values.botToken = botToken.trim()
      }

      const result = await saveIntegrationSettings('telegram', values)
      if (result.success) {
        toast.success('ההגדרות נשמרו')
        setBotToken('')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת ההגדרות')
      }
    })
  }

  function handleTest() {
    startTestingTransition(async () => {
      const result = await testTelegramConnection()
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
          id="telegram-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="telegram-enabled" className="cursor-pointer font-medium">
          {enabled ? 'Telegram מופעל' : 'Telegram מושבת'}
        </Label>
      </div>

      {/* Bot Token */}
      <div className="space-y-1.5">
        <Label htmlFor="telegram-bot-token">Bot Token</Label>
        <div className="relative">
          <Input
            id="telegram-bot-token"
            type={showToken ? 'text' : 'password'}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={settings.hasSavedBotToken ? '(שמור — הקלד לשינוי)' : '123456:ABC-DEF...'}
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
        <p className="text-xs text-muted-foreground">מתקבל מ-BotFather בפורמט: 123456789:ABC-DEFGhijk...</p>
      </div>

      {/* Chat ID */}
      <div className="space-y-1.5">
        <Label htmlFor="telegram-chat-id">Chat ID</Label>
        <Input
          id="telegram-chat-id"
          type="text"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="-1001234567890"
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">מספר חיובי לצ&apos;אט פרטי, שלילי לקבוצה</p>
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
          disabled={isTesting || (!settings.hasSavedBotToken && !botToken)}
          size="sm"
        >
          {isTesting && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          בדוק חיבור
        </Button>
      </div>
    </div>
  )
}
