/**
 * /admin/settings — System Integration Settings Page.
 *
 * Server Component: reads .env.local via getIntegrationSettings() and renders
 * the IntegrationAccordion client component with current values.
 *
 * Security: verifySession() runs OUTSIDE Suspense — auth redirect fires immediately.
 * Values: stored in .env.local. Sensitive fields masked before passing to client.
 */

import { Suspense } from 'react'
import { verifySession } from '@/lib/dal'
import { getIntegrationSettings } from '@/actions/settings'
import { RefreshButton } from '@/components/shared/RefreshButton'
import { IntegrationAccordion } from '@/components/admin/settings/IntegrationAccordion'
import { PageSkeleton } from '@/components/shared/PageSkeleton'

async function SettingsContent() {
  // Read current integration settings from .env.local
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

export default async function SettingsPage() {
  // Auth guard — MUST be first, OUTSIDE Suspense boundary
  await verifySession()

  return (
    <Suspense fallback={<PageSkeleton config={{
      titleWidth: 110,
      cards: { count: 6, height: 80, cols: 'grid-cols-1' },
      maxWidth: 'max-w-full'
    }} />}>
      <SettingsContent />
    </Suspense>
  )
}
