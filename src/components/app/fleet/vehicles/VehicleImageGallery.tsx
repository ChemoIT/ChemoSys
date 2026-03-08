'use client'

/**
 * VehicleImageGallery — 5-slot image gallery for vehicle card.
 *
 * Each slot shows thumbnail (if filled) or empty placeholder.
 * Click filled slot → lightbox dialog.
 * Click empty slot → file picker (image/*).
 * Filled slots have a delete button (x).
 * Upload: client-side to Supabase storage → Server Action to save metadata.
 * Auto-save on upload/delete — no dirty tracking needed.
 * Locked: when isLocked=true — no upload/delete available.
 */

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { toast } from 'sonner'
import { X, ImagePlus, Loader2, ZoomIn } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { getVehicleImages, addVehicleImage, deleteVehicleImage } from '@/actions/fleet/vehicles'
import type { VehicleImage } from '@/lib/fleet/vehicle-types'

type Props = {
  vehicleId: string
  isLocked: boolean
}

export function VehicleImageGallery({ vehicleId, isLocked }: Props) {
  const [images, setImages] = useState<VehicleImage[]>([])
  const [uploading, setUploading] = useState<number | null>(null)
  const [lightboxImage, setLightboxImage] = useState<VehicleImage | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingPosition, setPendingPosition] = useState<number | null>(null)

  // Load images on mount
  useEffect(() => {
    void getVehicleImages(vehicleId).then(setImages)
  }, [vehicleId])

  // 5 slots always — filled by position
  const slots = Array.from({ length: 5 }, (_, i) => ({
    position: i + 1,
    image: images.find((img) => img.position === i + 1) ?? null,
  }))

  async function handleFileSelect(position: number, file: File) {
    setUploading(position)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${vehicleId}/${position}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('vehicle-images')
      .upload(path, file, { upsert: true }) // upsert=true: replaces existing file

    if (uploadError) {
      toast.error('שגיאה בהעלאת התמונה')
      setUploading(null)
      return
    }

    const result = await addVehicleImage(vehicleId, path, position)
    if (!result.success) {
      toast.error(result.error ?? 'שגיאה בשמירת התמונה')
      setUploading(null)
      return
    }

    // Refresh images with updated signed URLs
    const updated = await getVehicleImages(vehicleId)
    setImages(updated)
    setUploading(null)
    toast.success('התמונה הועלתה')
  }

  async function handleDelete(image: VehicleImage) {
    const result = await deleteVehicleImage(image.id, image.storagePath, vehicleId)
    if (!result.success) {
      toast.error(result.error ?? 'שגיאה במחיקת התמונה')
      return
    }
    setImages((prev) => prev.filter((img) => img.id !== image.id))
    toast.success('התמונה נמחקה')
  }

  function handleEmptySlotClick(position: number) {
    if (isLocked) return
    setPendingPosition(position)
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-semibold">תמונות רכב (עד 5)</p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && pendingPosition !== null) {
            void handleFileSelect(pendingPosition, file)
            setPendingPosition(null)
          }
          e.target.value = '' // reset input to allow re-selection of same file
        }}
      />

      {/* Grid of 5 slots */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {slots.map(({ position, image }) => (
          <div key={position} className="relative aspect-square">
            {image ? (
              // Filled slot
              <div className="relative w-full h-full group">
                <img
                  src={image.signedUrl ?? ''}
                  alt={`תמונת רכב ${position}`}
                  className="w-full h-full object-cover rounded-lg border border-border cursor-pointer"
                  onClick={() => setLightboxImage(image)}
                />
                {/* Zoom icon overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer pointer-events-none">
                  <ZoomIn className="h-5 w-5 text-white" />
                </div>
                {/* Delete button */}
                {!isLocked && (
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDelete(image) }}
                    className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="מחק תמונה"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : uploading === position ? (
              // Loading slot
              <div className="w-full h-full rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center bg-primary/5">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : (
              // Empty slot
              <button
                onClick={() => handleEmptySlotClick(position)}
                disabled={isLocked}
                className="w-full h-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                title={isLocked ? 'הכרטיס נעול' : 'הוסף תמונה'}
              >
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-3xl p-2" dir="rtl">
          {lightboxImage && (
            <img
              src={lightboxImage.signedUrl ?? ''}
              alt={`תמונת רכב ${lightboxImage.position}`}
              className="w-full h-auto rounded-lg object-contain max-h-[80dvh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
