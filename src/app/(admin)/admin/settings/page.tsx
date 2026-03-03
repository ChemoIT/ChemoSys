/**
 * /admin/settings — System Integration Settings Page.
 *
 * Server Component: reads .env.local via getIntegrationSettings() and renders
 * the IntegrationAccordion client component with current values.
 *
 * Security: verifySession() as first line — admin-only.
 * Values: stored in .env.local. Sensitive fields masked before passing to client.
 */

import { verifySession } from '@/lib/dal'
import { getIntegrationSettings } from '@/actions/settings'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { IntegrationAccordion } from '@/components/admin/settings/IntegrationAccordion'

export default async function SettingsPage() {
  // 1. Auth guard — MUST be first
  await verifySession()

  // 2. Read current integration settings from .env.local
  const settings = await getIntegrationSettings()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">הגדרות מערכת</h1>
        <RefreshButton />
      </div>

      {/* Integration accordion — client component */}
      <IntegrationAccordion settings={settings} />
    </div>
  )
}
