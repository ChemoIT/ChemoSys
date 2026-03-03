'use server'
// settings.ts — Server Actions for reading, saving, and testing integration settings.
// All values stored in .env.local. No secrets are written to audit_log.
// SECURITY: Every action begins with verifySession() — admin-only.

import { verifySession } from '@/lib/dal'
import { revalidatePath } from 'next/cache'
import { readEnvFile, writeEnvValues } from '@/lib/env-settings'
import * as net from 'net'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type SmsSettingsData = {
  enabled: boolean
  token: string
  fromName: string
  hasSavedToken: boolean
}

export type WhatsAppSettingsData = {
  enabled: boolean
  accessToken: string
  phoneNumberId: string
  businessAccountId: string
  hasSavedAccessToken: boolean
}

export type FtpSettingsData = {
  enabled: boolean
  protocol: string
  host: string
  port: string
  username: string
  password: string
  remotePath: string
  hasSavedPassword: boolean
}

export type TelegramSettingsData = {
  enabled: boolean
  botToken: string
  chatId: string
  hasSavedBotToken: boolean
}

export type LlmSettingsData = {
  enabled: boolean
  provider: string
  modelName: string
  apiKey: string
  baseUrl: string
  hasSavedApiKey: boolean
}

export type IntegrationSettings = {
  sms: SmsSettingsData
  whatsapp: WhatsAppSettingsData
  ftp: FtpSettingsData
  telegram: TelegramSettingsData
  llm: LlmSettingsData
}

export type TestResult = {
  ok: boolean
  message: string
}

// ─────────────────────────────────────────────────────────────
// Helper: mask sensitive fields for display
// ─────────────────────────────────────────────────────────────

function maskValue(val: string | undefined): string {
  if (!val) return ''
  if (val.length <= 4) return '****'
  return val.slice(0, 4) + '***'
}

// ─────────────────────────────────────────────────────────────
// getIntegrationSettings
// ─────────────────────────────────────────────────────────────

/**
 * Reads .env.local and returns structured settings for all 5 integrations.
 * Sensitive fields (tokens, keys, passwords) are masked for display.
 * hasSavedXxx flags indicate whether a stored value exists (even though it's masked).
 */
export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  await verifySession()
  const env = await readEnvFile()

  return {
    sms: {
      enabled: env['SMS_ENABLED'] === 'true',
      token: maskValue(env['SMS_TOKEN']),
      fromName: env['SMS_FROM_NAME'] ?? '',
      hasSavedToken: Boolean(env['SMS_TOKEN']),
    },
    whatsapp: {
      enabled: env['WHATSAPP_ENABLED'] === 'true',
      accessToken: maskValue(env['WHATSAPP_ACCESS_TOKEN']),
      phoneNumberId: env['WHATSAPP_PHONE_NUMBER_ID'] ?? '',
      businessAccountId: env['WHATSAPP_BUSINESS_ACCOUNT_ID'] ?? '',
      hasSavedAccessToken: Boolean(env['WHATSAPP_ACCESS_TOKEN']),
    },
    ftp: {
      enabled: env['FTP_ENABLED'] === 'true',
      protocol: env['FTP_PROTOCOL'] ?? 'ftp',
      host: env['FTP_HOST'] ?? '',
      port: env['FTP_PORT'] ?? '21',
      username: env['FTP_USERNAME'] ?? '',
      password: maskValue(env['FTP_PASSWORD']),
      remotePath: env['FTP_REMOTE_PATH'] ?? '/',
      hasSavedPassword: Boolean(env['FTP_PASSWORD']),
    },
    telegram: {
      enabled: env['TELEGRAM_ENABLED'] === 'true',
      botToken: maskValue(env['TELEGRAM_BOT_TOKEN']),
      chatId: env['TELEGRAM_CHAT_ID'] ?? '',
      hasSavedBotToken: Boolean(env['TELEGRAM_BOT_TOKEN']),
    },
    llm: {
      enabled: env['LLM_ENABLED'] === 'true',
      provider: env['LLM_PROVIDER'] ?? 'openai',
      modelName: env['LLM_MODEL_NAME'] ?? '',
      apiKey: maskValue(env['LLM_API_KEY']),
      baseUrl: env['LLM_BASE_URL'] ?? '',
      hasSavedApiKey: Boolean(env['LLM_API_KEY']),
    },
  }
}

// ─────────────────────────────────────────────────────────────
// saveIntegrationSettings
// ─────────────────────────────────────────────────────────────

const VALID_TYPES = ['sms', 'whatsapp', 'ftp', 'telegram', 'llm'] as const
type IntegrationType = (typeof VALID_TYPES)[number]

/** Map from integration type + field name to env key */
const ENV_KEY_MAP: Record<IntegrationType, Record<string, string>> = {
  sms: {
    enabled: 'SMS_ENABLED',
    token: 'SMS_TOKEN',
    fromName: 'SMS_FROM_NAME',
  },
  whatsapp: {
    enabled: 'WHATSAPP_ENABLED',
    accessToken: 'WHATSAPP_ACCESS_TOKEN',
    phoneNumberId: 'WHATSAPP_PHONE_NUMBER_ID',
    businessAccountId: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
  },
  ftp: {
    enabled: 'FTP_ENABLED',
    protocol: 'FTP_PROTOCOL',
    host: 'FTP_HOST',
    port: 'FTP_PORT',
    username: 'FTP_USERNAME',
    password: 'FTP_PASSWORD',
    remotePath: 'FTP_REMOTE_PATH',
  },
  telegram: {
    enabled: 'TELEGRAM_ENABLED',
    botToken: 'TELEGRAM_BOT_TOKEN',
    chatId: 'TELEGRAM_CHAT_ID',
  },
  llm: {
    enabled: 'LLM_ENABLED',
    provider: 'LLM_PROVIDER',
    modelName: 'LLM_MODEL_NAME',
    apiKey: 'LLM_API_KEY',
    baseUrl: 'LLM_BASE_URL',
  },
}

/**
 * Save integration settings to .env.local.
 * Maps camelCase field names to env key names.
 * SECURITY: Does NOT log secret values — only logs action name via console.info.
 */
export async function saveIntegrationSettings(
  type: string,
  values: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  await verifySession()

  if (!VALID_TYPES.includes(type as IntegrationType)) {
    return { success: false, error: 'סוג אינטגרציה לא תקין' }
  }

  const keyMap = ENV_KEY_MAP[type as IntegrationType]
  const envMap: Record<string, string> = {}

  for (const [field, value] of Object.entries(values)) {
    const envKey = keyMap[field]
    if (envKey) {
      envMap[envKey] = value
    }
  }

  try {
    await writeEnvValues(envMap)
    revalidatePath('/admin/settings')
    // Log action only — never log secret values
    console.info(`[settings] Settings updated for: ${type}`)
    return { success: true }
  } catch (err) {
    console.error('[settings] Failed to save integration:', err instanceof Error ? err.message : 'Unknown error')
    return { success: false, error: 'שגיאה בשמירת ההגדרות' }
  }
}

// ─────────────────────────────────────────────────────────────
// Test Connection Actions
// ─────────────────────────────────────────────────────────────

/**
 * Test SMS (Micropay) connection.
 * Uses the Micropay ScheduleSms API with a fake number — just tests token validity.
 * NOTE: Micropay returns a numeric ID on success, error text on failure.
 */
export async function testSmsConnection(): Promise<TestResult> {
  await verifySession()

  const token = process.env['SMS_TOKEN'] ?? ''
  if (!token) return { ok: false, message: 'אין token מוגדר' }

  try {
    const url = new URL('http://www.micropay.co.il/ExtApi/ScheduleSms.php')
    url.searchParams.set('get', '1')
    url.searchParams.set('token', token)
    url.searchParams.set('msg', 'Test')
    url.searchParams.set('list', '0500000000') // non-routable fake number
    url.searchParams.set('charset', 'iso-8859-8')
    url.searchParams.set('from', process.env['SMS_FROM_NAME'] ?? 'Test')

    const res = await fetch(url.toString(), { method: 'GET' })
    const text = await res.text()
    // Micropay returns numeric message ID on success, error text on failure
    const ok = /^\d+/.test(text.trim())
    return { ok, message: ok ? 'חיבור SMS תקין' : `שגיאה: ${text.trim()}` }
  } catch (err) {
    return { ok: false, message: `שגיאת רשת: ${err instanceof Error ? err.message : 'Unknown'}` }
  }
}

/**
 * Test WhatsApp connection by verifying phone number credentials via Meta Graph API.
 */
export async function testWhatsAppConnection(): Promise<TestResult> {
  await verifySession()

  const accessToken = process.env['WHATSAPP_ACCESS_TOKEN'] ?? ''
  const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? ''

  if (!accessToken) return { ok: false, message: 'אין Access Token מוגדר' }
  if (!phoneNumberId) return { ok: false, message: 'אין Phone Number ID מוגדר' }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}?access_token=${accessToken}`,
      { method: 'GET' }
    )
    const data = await res.json() as Record<string, unknown>

    if (res.ok && data['id']) {
      return { ok: true, message: `WhatsApp מחובר: ${data['display_phone_number'] ?? phoneNumberId}` }
    }
    const errMsg = (data['error'] as Record<string, string> | undefined)?.message ?? 'שגיאת אימות'
    return { ok: false, message: errMsg }
  } catch (err) {
    return { ok: false, message: `שגיאת רשת: ${err instanceof Error ? err.message : 'Unknown'}` }
  }
}

/**
 * Test FTP/SFTP connection using a TCP socket check (no ftp library needed).
 * Confirms the host:port is reachable. Does not authenticate.
 */
export async function testFtpConnection(): Promise<TestResult> {
  await verifySession()

  const host = process.env['FTP_HOST'] ?? ''
  const port = parseInt(process.env['FTP_PORT'] ?? '21', 10)

  if (!host) return { ok: false, message: 'אין שרת FTP מוגדר' }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end()
      resolve({ ok: true, message: `חיבור ל-${host}:${port} תקין` })
    })

    socket.setTimeout(5000)

    socket.on('timeout', () => {
      socket.destroy()
      resolve({ ok: false, message: `פג זמן חיבור ל-${host}:${port}` })
    })

    socket.on('error', (err) => {
      resolve({ ok: false, message: `לא ניתן להתחבר: ${err.message}` })
    })
  })
}

/**
 * Test Telegram bot by calling getMe API endpoint.
 */
export async function testTelegramConnection(): Promise<TestResult> {
  await verifySession()

  const botToken = process.env['TELEGRAM_BOT_TOKEN'] ?? ''
  if (!botToken) return { ok: false, message: 'אין Bot Token מוגדר' }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { method: 'GET' })
    const data = await res.json() as { ok: boolean; result?: { username?: string } }

    if (data.ok && data.result) {
      return { ok: true, message: `Bot מחובר: @${data.result.username ?? 'unknown'}` }
    }
    return { ok: false, message: 'שגיאת אימות — Token לא תקין' }
  } catch (err) {
    return { ok: false, message: `שגיאת רשת: ${err instanceof Error ? err.message : 'Unknown'}` }
  }
}

/**
 * Test LLM connection by calling the models list endpoint.
 * OpenAI: GET /v1/models with Bearer token
 * Gemini: GET /v1beta/models with API key query param
 */
export async function testLlmConnection(): Promise<TestResult> {
  await verifySession()

  const provider = process.env['LLM_PROVIDER'] ?? 'openai'
  const apiKey = process.env['LLM_API_KEY'] ?? ''
  const baseUrl = process.env['LLM_BASE_URL'] ?? ''

  if (!apiKey) return { ok: false, message: 'אין API Key מוגדר' }

  try {
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { method: 'GET' }
      )
      const data = await res.json() as { models?: unknown[] }
      if (res.ok && data.models) {
        return { ok: true, message: `Gemini מחובר — ${data.models.length} מודלים זמינים` }
      }
      return { ok: false, message: 'שגיאת אימות Gemini — בדוק את ה-API Key' }
    }

    // Default: OpenAI-compatible
    const endpoint = (baseUrl || 'https://api.openai.com') + '/v1/models'
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    const data = await res.json() as { data?: unknown[] }
    if (res.ok && data.data) {
      return { ok: true, message: `OpenAI מחובר — ${data.data.length} מודלים זמינים` }
    }
    return { ok: false, message: 'שגיאת אימות OpenAI — בדוק את ה-API Key' }
  } catch (err) {
    return { ok: false, message: `שגיאת רשת: ${err instanceof Error ? err.message : 'Unknown'}` }
  }
}
