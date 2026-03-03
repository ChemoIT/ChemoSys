'use client'

/**
 * FtpSettings — FTP/SFTP integration configuration fields.
 *
 * Fields: Protocol (FTP/SFTP select), Host, Port, Username, Password, Remote Path.
 * Test: TCP socket connection check to host:port via testFtpConnection().
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveIntegrationSettings, testFtpConnection } from '@/actions/settings'
import type { FtpSettingsData } from '@/actions/settings'

type Props = {
  settings: FtpSettingsData
}

export function FtpSettings({ settings }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [protocol, setProtocol] = useState(settings.protocol || 'ftp')
  const [host, setHost] = useState(settings.host)
  const [port, setPort] = useState(settings.port || '21')
  const [username, setUsername] = useState(settings.username)
  const [password, setPassword] = useState('')
  const [remotePath, setRemotePath] = useState(settings.remotePath || '/')
  const [showPassword, setShowPassword] = useState(false)

  const [isSaving, startSavingTransition] = useTransition()
  const [isTesting, startTestingTransition] = useTransition()

  // Auto-set default port when protocol changes
  function handleProtocolChange(val: string) {
    setProtocol(val)
    if (val === 'sftp' && port === '21') setPort('22')
    if (val === 'ftp' && port === '22') setPort('21')
  }

  function handleSave() {
    startSavingTransition(async () => {
      const values: Record<string, string> = {
        enabled: String(enabled),
        protocol,
        host,
        port,
        username,
        remotePath,
      }
      if (password.trim()) {
        values.password = password.trim()
      }

      const result = await saveIntegrationSettings('ftp', values)
      if (result.success) {
        toast.success('ההגדרות נשמרו')
        setPassword('')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת ההגדרות')
      }
    })
  }

  function handleTest() {
    startTestingTransition(async () => {
      const result = await testFtpConnection()
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
          id="ftp-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="ftp-enabled" className="cursor-pointer font-medium">
          {enabled ? 'FTP מופעל' : 'FTP מושבת'}
        </Label>
      </div>

      {/* Protocol */}
      <div className="space-y-1.5">
        <Label htmlFor="ftp-protocol">פרוטוקול</Label>
        {/* Hidden input for Select value — Select.onValueChange doesn't write to FormData */}
        <input type="hidden" name="ftp-protocol-hidden" value={protocol} />
        <Select value={protocol} onValueChange={handleProtocolChange}>
          <SelectTrigger id="ftp-protocol" className="w-40" dir="ltr">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ftp">FTP</SelectItem>
            <SelectItem value="sftp">SFTP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Host + Port in one row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="ftp-host">שרת (Host)</Label>
          <Input
            id="ftp-host"
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="ftp.example.com"
            dir="ltr"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ftp-port">פורט</Label>
          <Input
            id="ftp-port"
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="21"
            dir="ltr"
          />
        </div>
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <Label htmlFor="ftp-username">שם משתמש</Label>
        <Input
          id="ftp-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ftpuser"
          dir="ltr"
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="ftp-password">סיסמה</Label>
        <div className="relative">
          <Input
            id="ftp-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={settings.hasSavedPassword ? '(שמורה — הקלד לשינוי)' : 'הכנס סיסמה...'}
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
      </div>

      {/* Remote Path */}
      <div className="space-y-1.5">
        <Label htmlFor="ftp-remote-path">נתיב מרוחק (Remote Path)</Label>
        <Input
          id="ftp-remote-path"
          type="text"
          value={remotePath}
          onChange={(e) => setRemotePath(e.target.value)}
          placeholder="/"
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
          disabled={isTesting || !host}
          size="sm"
        >
          {isTesting && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          בדוק חיבור
        </Button>
      </div>
    </div>
  )
}
