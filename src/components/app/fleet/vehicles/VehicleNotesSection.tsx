'use client'

/**
 * VehicleNotesSection — Tab 7: Free-text notes for a vehicle.
 *
 * Simple textarea bound to vehicle.notes:
 * - Dirty tracking: local state vs original notes
 * - Calls onEditingChange(dirty) for parent VehicleCard unsaved-changes Dialog
 * - Save button calls updateVehicleDetails({ vehicleId, notes })
 * - Toast on success/failure
 */

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateVehicleDetails } from '@/actions/fleet/vehicles'

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

type Props = {
  vehicleId: string
  notes: string | null
  onEditingChange: (dirty: boolean) => void
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function VehicleNotesSection({ vehicleId, notes: initialNotes, onEditingChange }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [isSaving, startSaveTransition] = useTransition()

  const original = initialNotes ?? ''
  const isDirty = notes !== original

  // Notify parent whenever dirty state changes
  useEffect(() => {
    onEditingChange(isDirty)
  }, [isDirty, onEditingChange])

  function handleSave() {
    startSaveTransition(async () => {
      const result = await updateVehicleDetails({
        vehicleId,
        notes: notes.trim() || null,
      })
      if (result.success) {
        toast.success('הערות נשמרו בהצלחה')
      } else {
        toast.error(result.error ?? 'שגיאה בשמירת הערות')
      }
    })
  }

  return (
    <div dir="rtl" className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-muted-foreground">הערות לרכב</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="w-full border border-border rounded-lg px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
          placeholder="הוסף הערות לרכב זה..."
          disabled={isSaving}
        />
      </div>

      <div className="flex justify-start">
        <Button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="gap-2"
          style={
            isDirty
              ? { background: 'linear-gradient(135deg, #4ECDC4, #3ABFB6)', border: 'none' }
              : undefined
          }
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          שמור הערות
        </Button>
      </div>
    </div>
  )
}
