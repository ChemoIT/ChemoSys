---
phase: 05-settings-observability
plan: 03
subsystem: ui
tags: [settings, env, dotenv, accordion, switch, shadcn, server-actions, integration, sms, whatsapp, ftp, telegram, llm]

# Dependency graph
requires:
  - phase: 05-settings-observability/01
    provides: "Dashboard foundation + shared patterns (RefreshButton, page structure)"
  - phase: 01-foundation
    provides: "verifySession(), DAL, server-only pattern"

provides:
  - "/admin/settings page with 5 integration accordion sections"
  - "src/lib/env-settings.ts: server-only .env.local read/write with in-memory process.env mutation"
  - "src/actions/settings.ts: getIntegrationSettings, saveIntegrationSettings, test* Server Actions"
  - "shadcn accordion and switch UI components installed"
  - "5 integration forms: SMS, WhatsApp, FTP/SFTP, Telegram, LLM"

affects:
  - "future-integrations"
  - "sms-notifications"
  - "ai-agent-modules"

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-accordion (via shadcn accordion)"
    - "@radix-ui/react-switch (via shadcn switch)"
  patterns:
    - "env-settings: server-only .env.local read/write with process.env in-memory mutation"
    - "sensitive field masking: first 4 chars + *** + hasSavedXxx boolean for UI placeholder"
    - "password field preservation: empty field on save = keep existing value (don't overwrite)"
    - "test connection pattern: dedicated Server Action per integration, toast on result"
    - "TCP socket test for FTP: no library needed, net.createConnection with 5s timeout"

key-files:
  created:
    - src/lib/env-settings.ts
    - src/actions/settings.ts
    - src/app/(admin)/admin/settings/page.tsx
    - src/components/admin/settings/IntegrationAccordion.tsx
    - src/components/admin/settings/SmsSettings.tsx
    - src/components/admin/settings/WhatsAppSettings.tsx
    - src/components/admin/settings/FtpSettings.tsx
    - src/components/admin/settings/TelegramSettings.tsx
    - src/components/admin/settings/LlmSettings.tsx
    - src/components/ui/accordion.tsx
    - src/components/ui/switch.tsx
  modified: []

key-decisions:
  - "env-settings uses process.env in-memory mutation after fs write — settings take effect immediately without restart"
  - "Sensitive fields masked with first 4 chars + *** on server; hasSavedXxx boolean sent to client for placeholder UX"
  - "Empty password field on save = preserve existing (never overwrite with empty string)"
  - "FTP test uses TCP socket (Node.js net module) — no ftp library needed, just checks host:port reachability"
  - "AuditLogTable.tsx was missing from working tree (deleted post-commit) — restored from git history via checkout"

patterns-established:
  - "env-settings pattern: readEnvFile + writeEnvValues + deleteEnvKeys — server-only, always .env.local"
  - "settings save pattern: map camelCase field names to env key names via ENV_KEY_MAP"
  - "sensitive field display: mask on getIntegrationSettings, hasSavedXxx flag for UI feedback"

# Metrics
duration: 12min
completed: 2026-03-03
---

# Phase 5 Plan 03: Integration Settings Summary

**Visual admin settings panel for 5 integration types (SMS, WhatsApp, FTP, Telegram, LLM) with .env.local read/write, enable/disable toggles, and live test connection buttons**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-03T21:23:57Z
- **Completed:** 2026-03-03T21:36:00Z
- **Tasks:** 2
- **Files created:** 11

## Accomplishments

- Installed shadcn `accordion` and `switch` components (with @radix-ui deps)
- Built `src/lib/env-settings.ts`: server-only .env.local parser with in-memory `process.env` mutation on write
- Built `src/actions/settings.ts`: 7 Server Actions (get, save, + 5 test connections) with verifySession guard
- Built `/admin/settings` page with `IntegrationAccordion` showing all 5 integrations with status badges
- Each integration section has: enable/disable switch, type-specific fields, save button, test connection button
- Sensitive fields (tokens, passwords, API keys) are masked on display with `hasSavedXxx` flag for UX

## Task Commits

1. **Task 1: shadcn components + env-settings library + Server Actions** - `84ae554` (feat)
2. **Task 2: Settings page + 5 integration accordion sections** - `8a79e04` (feat)

**Plan metadata:** (docs commit — next)

## Files Created/Modified

- `src/lib/env-settings.ts` - Server-only .env.local read/write with process.env in-memory mutation
- `src/actions/settings.ts` - 7 Server Actions: get/save settings + test connections for all 5 integrations
- `src/app/(admin)/admin/settings/page.tsx` - Server Component settings page (verifySession + accordion)
- `src/components/admin/settings/IntegrationAccordion.tsx` - Accordion with 5 integration sections + status badges
- `src/components/admin/settings/SmsSettings.tsx` - Micropay SMS: token + fromName + enable toggle
- `src/components/admin/settings/WhatsAppSettings.tsx` - WhatsApp Cloud API: token + phone ID + business ID
- `src/components/admin/settings/FtpSettings.tsx` - FTP/SFTP: protocol select + host + port + auth + path
- `src/components/admin/settings/TelegramSettings.tsx` - Telegram Bot: bot token + chat ID
- `src/components/admin/settings/LlmSettings.tsx` - LLM: provider select + model + API key + base URL
- `src/components/ui/accordion.tsx` - shadcn accordion (installed via CLI)
- `src/components/ui/switch.tsx` - shadcn switch (installed via CLI)

## Decisions Made

- **process.env in-memory mutation**: After writing .env.local to disk, also mutate `process.env[key] = val` so settings take effect in the running process without restart. TypeScript requires `(process.env as Record<string, string>)[key]` cast.
- **Sensitive field masking**: Tokens and passwords returned as `firstXxx***` for display; `hasSavedXxx` boolean allows UI to show `(שמור — הקלד לשינוי)` placeholder without exposing the real value.
- **Empty field = preserve existing**: When saving, if a password/token field is empty, it's excluded from the save payload — the existing .env.local value is preserved.
- **FTP test via TCP socket**: No ftp library needed. `net.createConnection({host, port})` with 5-second timeout tests host reachability. Resolves `{ ok, message }` promise.
- **SECURITY**: saveIntegrationSettings logs only `"Settings updated for: {type}"` via console.info — never logs secret values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored missing AuditLogTable.tsx from git history**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** `src/components/admin/audit-log/AuditLogTable.tsx` was missing from working tree but referenced in `audit-log/page.tsx` → TypeScript error TS2307 blocked compilation
- **Fix:** `git checkout b121753 -- src/components/admin/audit-log/AuditLogTable.tsx` — the file was committed in Plan 02's commit but somehow absent from the working tree
- **Files modified:** src/components/admin/audit-log/AuditLogTable.tsx (restored)
- **Verification:** TypeScript compiled clean after restore
- **Committed in:** 84ae554 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Necessary fix to unblock compilation. No scope creep. Plan 02 work was intact in git, just missing from working tree.

## Issues Encountered

None beyond the AuditLogTable.tsx deviation above.

## User Setup Required

None — no external service configuration required during install. The settings page itself IS the configuration UI for external services. Admin can configure each integration at `/admin/settings` when ready.

## Next Phase Readiness

- Phase 5 Plan 03 complete. All 3 plans in Phase 5 are now complete.
- `/admin/settings` is live at full functionality
- Integration credentials can be entered and tested from the UI
- `.env.local` stores all integration config with in-memory effect
- Phase 5 verification checkpoint is ready

## Self-Check

Files verified to exist:
- [x] src/lib/env-settings.ts
- [x] src/actions/settings.ts
- [x] src/app/(admin)/admin/settings/page.tsx
- [x] src/components/admin/settings/IntegrationAccordion.tsx
- [x] src/components/admin/settings/SmsSettings.tsx
- [x] src/components/admin/settings/WhatsAppSettings.tsx
- [x] src/components/admin/settings/FtpSettings.tsx
- [x] src/components/admin/settings/TelegramSettings.tsx
- [x] src/components/admin/settings/LlmSettings.tsx
- [x] src/components/ui/accordion.tsx
- [x] src/components/ui/switch.tsx

Commits verified:
- [x] 84ae554 — Task 1: accordion + switch + env-settings + Server Actions
- [x] 8a79e04 — Task 2: settings page + 5 integration sections

Build: npm run build → 17 pages, no TypeScript errors

---
*Phase: 05-settings-observability*
*Completed: 2026-03-03*
