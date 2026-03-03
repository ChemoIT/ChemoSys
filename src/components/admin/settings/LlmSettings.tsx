'use client'

/**
 * LlmSettings — LLM/AI provider configuration fields.
 *
 * Fields: Provider (openai/gemini select), Model Name, API Key (password), Base URL (optional).
 * Test: calls /v1/models (OpenAI) or /v1beta/models (Gemini) to verify API key.
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
import { saveIntegrationSettings, testLlmConnection } from '@/actions/settings'
import type { LlmSettingsData } from '@/actions/settings'

type Props = {
  settings: LlmSettingsData
}

export function LlmSettings({ settings }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [provider, setProvider] = useState(settings.provider || 'openai')
  const [modelName, setModelName] = useState(settings.modelName)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl)
  const [showApiKey, setShowApiKey] = useState(false)

  const [isSaving, startSavingTransition] = useTransition()
  const [isTesting, startTestingTransition] = useTransition()

  function handleSave() {
    startSavingTransition(async () => {
      const values: Record<string, string> = {
        enabled: String(enabled),
        provider,
        modelName,
        baseUrl,
      }
      if (apiKey.trim()) {
        values.apiKey = apiKey.trim()
      }

      const result = await saveIntegrationSettings('llm', values)
      if (result.success) {
        toast.success('ההגדרות נשמרו')
        setApiKey('')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת ההגדרות')
      }
    })
  }

  function handleTest() {
    startTestingTransition(async () => {
      const result = await testLlmConnection()
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
          id="llm-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="llm-enabled" className="cursor-pointer font-medium">
          {enabled ? 'LLM מופעל' : 'LLM מושבת'}
        </Label>
      </div>

      {/* Provider selector */}
      <div className="space-y-1.5">
        <Label htmlFor="llm-provider">ספק AI</Label>
        <input type="hidden" name="llm-provider-hidden" value={provider} />
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger id="llm-provider" className="w-48" dir="ltr">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="gemini">Google Gemini</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Model Name */}
      <div className="space-y-1.5">
        <Label htmlFor="llm-model-name">שם מודל</Label>
        <Input
          id="llm-model-name"
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder={provider === 'gemini' ? 'gemini-1.5-pro' : 'gpt-4o'}
          dir="ltr"
        />
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <Label htmlFor="llm-api-key">API Key</Label>
        <div className="relative">
          <Input
            id="llm-api-key"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings.hasSavedApiKey ? '(שמור — הקלד לשינוי)' : 'sk-... / AIza...'}
            className="pe-10"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showApiKey ? 'הסתר API Key' : 'הצג API Key'}
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Base URL (optional, OpenAI-compatible endpoints) */}
      <div className="space-y-1.5">
        <Label htmlFor="llm-base-url">
          Base URL <span className="text-muted-foreground text-xs">(אופציונלי — לendpoints תאימים ל-OpenAI)</span>
        </Label>
        <Input
          id="llm-base-url"
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com"
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
          disabled={isTesting || (!settings.hasSavedApiKey && !apiKey)}
          size="sm"
        >
          {isTesting && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          בדוק חיבור
        </Button>
      </div>
    </div>
  )
}
