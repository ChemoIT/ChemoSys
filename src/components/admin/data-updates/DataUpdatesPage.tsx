'use client'

/**
 * DataUpdatesPage — tabbed interface for recurring data imports.
 * First tab: fuel records. Future tabs: km, invoices, etc.
 *
 * CRITICAL: dir="rtl" on TabsList AND each TabsContent (shadcn Tabs resets dir).
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FuelImportTab } from './FuelImportTab'

export function DataUpdatesPage() {
  return (
    <Tabs defaultValue="fuel" className="w-full">
      <TabsList dir="rtl" className="mb-4">
        <TabsTrigger value="fuel">דלק רכבים</TabsTrigger>
        <TabsTrigger value="km" disabled>ק״מ</TabsTrigger>
        <TabsTrigger value="invoices" disabled>חשבוניות</TabsTrigger>
      </TabsList>

      <TabsContent value="fuel" dir="rtl">
        <FuelImportTab />
      </TabsContent>

      <TabsContent value="km" dir="rtl">
        <div className="text-center py-16 text-muted-foreground text-sm">בקרוב...</div>
      </TabsContent>

      <TabsContent value="invoices" dir="rtl">
        <div className="text-center py-16 text-muted-foreground text-sm">בקרוב...</div>
      </TabsContent>
    </Tabs>
  )
}
