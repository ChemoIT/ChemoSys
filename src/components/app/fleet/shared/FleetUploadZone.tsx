'use client'

/**
 * FleetUploadZone — drag-drop upload zone with file picker + camera button.
 *
 * Shared component — used by DriverDocumentsSection,
 * and will be used by vehicle document sections in Phase 14+.
 *
 * Shows FleetFilePreview when a file is already uploaded.
 * Shows drag-drop area + icon buttons when no file is present.
 */

import { Loader2, Upload, Camera, FileText } from 'lucide-react'
import { FleetFilePreview } from './FleetFilePreview'

type FleetUploadZoneProps = {
  fileUrl: string
  uploading: boolean
  dragging: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onFileClick: () => void
  onCameraClick: () => void
  onClear: () => void
}

export function FleetUploadZone({
  fileUrl,
  uploading,
  dragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileClick,
  onCameraClick,
  onClear,
}: FleetUploadZoneProps) {
  if (fileUrl) {
    return <FleetFilePreview url={fileUrl} onClear={onClear} />
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            <FileText className="h-6 w-6" />
            <span className="text-xs">{dragging ? 'שחרר כאן...' : 'גרור קובץ לכאן'}</span>
          </>
        )}
      </div>
      {!uploading && (
        <div className="flex justify-center gap-3 mt-3">
          <button
            onClick={onFileClick}
            className="flex items-center justify-center h-10 w-10 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
            title="העלה מהמחשב"
          >
            <Upload className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onCameraClick}
            className="flex items-center justify-center h-10 w-10 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
            title="סרוק / צלם"
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}
