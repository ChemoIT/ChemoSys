'use client'

/**
 * AddVehicleDialog — two-step dialog to create a new vehicle card.
 *
 * Flow:
 *   Step 1 (input): User enters license plate.
 *                   "בדוק ב-MOT" fetches MOT data (read-only preview).
 *   Step 2 (preview): MOT data displayed in a read-only card.
 *                     "פתח כרטיס רכב" creates the vehicle + triggers MOT sync.
 *
 * RTL: Dialog dir="rtl". Plate input dir="ltr" (numbers are LTR).
 * Responsive: max-w-lg, max-h-[90dvh] overflow-y-auto per IRON RULE.
 */

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Car, Loader2, RefreshCw, ChevronLeft } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  lookupVehicleFromMot,
  syncVehicleFromMot,
  type MotVehicleData,
} from '@/actions/fleet/mot-sync'
import { createVehicle } from '@/actions/fleet/vehicles'
import { formatLicensePlate } from '@/lib/format'

type Props = {
  open: boolean
  onClose: () => void
}

type Step = 'input' | 'previewing'

export function AddVehicleDialog({ open, onClose }: Props) {
  const router = useRouter()

  // State
  const [step, setStep] = useState<Step>('input')
  const [plate, setPlate] = useState('')
  const [motData, setMotData] = useState<MotVehicleData | null>(null)

  // Transitions
  const [isLooking, startLookupTransition] = useTransition()
  const [isCreating, startCreatingTransition] = useTransition()

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return
    setStep('input')
    setPlate('')
    setMotData(null)
  }, [open])

  // Step 1: Look up MOT data (read-only preview)
  function handleLookup() {
    if (!plate.trim()) return
    startLookupTransition(async () => {
      const result = await lookupVehicleFromMot(plate)
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'לא נמצאו נתוני רכב')
        return
      }
      setMotData(result.data)
      setStep('previewing')
    })
  }

  // Step 2: Create vehicle + fire MOT sync
  function handleCreate() {
    if (!plate.trim()) return
    startCreatingTransition(async () => {
      // 1. Create vehicle card (plate only — no companyId)
      const createResult = await createVehicle(plate)
      if (!createResult.success || !createResult.vehicleId) {
        toast.error(createResult.error ?? 'שגיאה ביצירת כרטיס הרכב')
        return
      }

      const vehicleId = createResult.vehicleId

      // 2. Fire MOT sync (fire-and-forget — don't block on failure)
      syncVehicleFromMot(vehicleId, plate).then((syncResult) => {
        if (!syncResult.success) {
          toast.warning('כרטיס נפתח, סנכרון MOT נכשל — ניתן לסנכרן ידנית מהכרטיס')
        }
      })

      // 3. Success — close + navigate
      toast.success('כרטיס רכב נפתח')
      onClose()
      router.push(`/app/fleet/vehicle-card/${vehicleId}`)
    })
  }

  // Formatted plate for display in preview
  const formattedPlate = plate.trim()
    ? formatLicensePlate(plate.trim().replace(/\D/g, ''))
    : plate.trim()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            פתיחת כרטיס רכב חדש
          </DialogTitle>
          <DialogDescription>
            {step === 'input'
              ? 'הזן מספר רישוי, לאחר מכן בדוק נתונים ב-MOT.'
              : 'נתוני הרכב שהתקבלו ממשרד הרישוי. אשר כדי לפתוח כרטיס.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Input ── */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* Plate number input — LTR (numbers/dashes) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">מספר רישוי</label>
              <Input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="לדוגמה: 12-345-67"
                dir="ltr"
                className="font-mono text-base"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && plate.trim()) handleLookup()
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={onClose} disabled={isLooking}>
                ביטול
              </Button>
              <Button
                onClick={handleLookup}
                disabled={!plate.trim() || isLooking}
              >
                {isLooking
                  ? <Loader2 className="h-4 w-4 ms-2 animate-spin" />
                  : <RefreshCw className="h-4 w-4 ms-2" />
                }
                בדוק ב-MOT
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: MOT Preview ── */}
        {step === 'previewing' && motData && (
          <div className="space-y-4">
            {/* Plate display */}
            <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border">
              <Car className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="font-mono font-bold text-lg" dir="ltr">
                {formattedPlate}
              </span>
            </div>

            {/* MOT data card */}
            <div className="rounded-lg border divide-y text-sm">
              {[
                { label: 'יצרן', value: motData.tozeret_nm },
                { label: 'דגם', value: motData.degem_nm },
                { label: 'כינוי מסחרי', value: motData.kinuy_mishari },
                { label: 'שנת ייצור', value: motData.shnat_yitzur?.toString() },
                { label: 'צבע', value: motData.tzeva_rechev },
                { label: 'דלק', value: motData.sug_delek_nm },
                { label: 'בעלות', value: motData.baalut },
              ]
                .filter((row) => row.value)
                .map((row) => (
                  <div key={row.label} className="flex justify-between items-center px-3 py-2">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.value}</span>
                  </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                onClick={() => setStep('input')}
                disabled={isCreating}
              >
                <ChevronLeft className="h-4 w-4 ms-1" />
                חזור
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                פתח כרטיס רכב
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
