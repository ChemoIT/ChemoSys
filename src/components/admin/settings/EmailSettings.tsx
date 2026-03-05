'use client'

/**
 * EmailSettings — Gmail SMTP configuration fields.
 *
 * Fields: Host, Port, Username (Gmail address), App Password, From Address, From Name.
 * Save: calls saveIntegrationSettings('email', values) via startTransition.
 * Test: calls testEmailConnection() — sends a test email to self.
 *
 * Security: password field masked; hasSavedPassword flag controls placeholder.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { saveIntegrationSettings, testEmailConnection } from '@/actions/settings'
import type { EmailSettingsData } from '@/actions/settings'

type Props = {
  settings: EmailSettingsData
}

export function EmailSettings({ settings }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [host, setHost] = useState(settings.host)
  const [port, setPort] = useState(settings.port)
  const [username, setUsername] = useState(settings.username)
  const [password, setPassword] = useState('')
  const [fromAddress, setFromAddress] = useState(settings.fromAddress)
  const [fromName, setFromName] = useState(settings.fromName)
  const [showPassword, setShowPassword] = useState(false)

  const [isSaving, startSavingTransition] = useTransition()
  const [isTesting, startTestingTransition] = useTransition()

  function handleSave() {
    startSavingTransition(async () => {
      const values: Record<string, string> = {
        enabled: String(enabled),
        host,
        port,
        username,
        fromAddress,
        fromName,
      }
      if (password.trim()) {
        values.password = password.trim()
      }

      const result = await saveIntegrationSettings('email', values)
      if (result.success) {
        toast.success('הגדרות Email נשמרו')
        setPassword('')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת ההגדרות')
      }
    })
  }

  function handleTest() {
    startTestingTransition(async () => {
      const result = await testEmailConnection()
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
          id="email-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="email-enabled" className="cursor-pointer font-medium">
          {enabled ? 'Email מופעל' : 'Email מושבת'}
        </Label>
      </div>

      {/* SMTP Host + Port — side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="email-host">שרת SMTP</Label>
          <Input
            id="email-host"
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.gmail.com"
            dir="ltr"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email-port">פורט</Label>
          <Input
            id="email-port"
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="587"
            dir="ltr"
          />
        </div>
      </div>

      {/* Gmail Username */}
      <div className="space-y-1.5">
        <Label htmlFor="email-username">כתובת Gmail</Label>
        <Input
          id="email-username"
          type="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="your@gmail.com"
          dir="ltr"
        />
      </div>

      {/* App Password */}
      <div className="space-y-1.5">
        <Label htmlFor="email-password">App Password</Label>
        <div className="relative">
          <Input
            id="email-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={settings.hasSavedPassword ? '(שמור — הקלד לשינוי)' : 'הכנס App Password...'}
            className="pe-10"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          סיסמת אפליקציה בת 16 תווים —{' '}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            צור App Password בגוגל
          </a>
        </p>
      </div>

      {/* From Address */}
      <div className="space-y-1.5">
        <Label htmlFor="email-from-address">כתובת שולח (From)</Label>
        <Input
          id="email-from-address"
          type="email"
          value={fromAddress}
          onChange={(e) => setFromAddress(e.target.value)}
          placeholder="your@gmail.com (ברירת מחדל = כתובת Gmail)"
          dir="ltr"
        />
      </div>

      {/* From Name */}
      <div className="space-y-1.5">
        <Label htmlFor="email-from-name">שם שולח</Label>
        <Input
          id="email-from-name"
          type="text"
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          placeholder="Chemo IT"
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
          disabled={isTesting || !settings.hasSavedPassword}
          size="sm"
        >
          {isTesting && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          שלח מייל בדיקה
        </Button>
      </div>
    </div>
  )
}
