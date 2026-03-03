import 'server-only'
// env-settings.ts — server-only helpers for reading and writing .env.local at runtime.
// The settings page uses these to let the admin configure integrations without restart.
// SECURITY: This module is server-only. Never import from client components.
// The ENV_PATH is hardcoded — never user-controlled. Only admin can trigger writes
// via verifySession()-guarded Server Actions.

import * as fs from 'fs/promises'
import * as path from 'path'

// Always .env.local — never .env (which may be committed to git). Pitfall 3.
const ENV_PATH = path.join(process.cwd(), '.env.local')

/**
 * Read all current .env.local values as a Record<string, string>.
 * Skips blank lines and comments (#).
 * Strips surrounding quotes from values.
 * Returns empty object if .env.local does not exist yet.
 */
export async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(ENV_PATH, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      result[key] = val
    }
    return result
  } catch {
    // .env.local doesn't exist yet — return empty, will be created on first write
    return {}
  }
}

/**
 * Write/update specific keys in .env.local (preserves all other keys).
 * After writing the file, also mutates process.env in-memory so the current
 * process reflects the new values without requiring a restart.
 * Values containing spaces are quoted.
 */
export async function writeEnvValues(updates: Record<string, string>): Promise<void> {
  const current = await readEnvFile()
  const merged = { ...current, ...updates }

  // Rebuild file content — one key=value per line
  let content = ''
  for (const [key, val] of Object.entries(merged)) {
    // Quote values that contain spaces or special characters
    const quoted = val.includes(' ') ? `"${val}"` : val
    content += `${key}=${quoted}\n`
  }

  await fs.writeFile(ENV_PATH, content, 'utf-8')

  // CRITICAL: Mutate process.env in-memory for immediate effect (no restart needed).
  // Pitfall 4: cast required for TypeScript strict typing of process.env index.
  for (const [key, val] of Object.entries(updates)) {
    ;(process.env as Record<string, string>)[key] = val
  }
}

/**
 * Remove specific keys from .env.local and from process.env in-memory.
 * Useful for clearing sensitive values.
 */
export async function deleteEnvKeys(keys: string[]): Promise<void> {
  const current = await readEnvFile()

  for (const key of keys) {
    delete current[key]
  }

  // Rebuild without removed keys
  let content = ''
  for (const [key, val] of Object.entries(current)) {
    const quoted = val.includes(' ') ? `"${val}"` : val
    content += `${key}=${quoted}\n`
  }

  await fs.writeFile(ENV_PATH, content, 'utf-8')

  // Also remove from process.env in-memory
  for (const key of keys) {
    delete process.env[key]
  }
}
