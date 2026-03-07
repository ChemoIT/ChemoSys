'use client'

/**
 * FleetFilePreview — PDF/image file preview with open/clear actions.
 *
 * Shared component — used by DriverDocumentsSection and DriverViolationsSection,
 * and will be used by vehicle document sections in Phase 14+.
 *
 * For PDFs: shows a styled card (iframes blocked by signed URL CSP).
 * For images: shows inline preview with "open in new tab" button.
 */

import { FileText, Eye, X } from 'lucide-react'

type FleetFilePreviewProps = {
  url: string
  onClear: () => void
}

export function FleetFilePreview({ url, onClear }: FleetFilePreviewProps) {
  const isPdf = url.toLowerCase().includes('.pdf')

  return (
    <div className="relative border rounded-xl overflow-hidden bg-muted/10">
      {isPdf ? (
        /* PDF: styled card — iframe blocked by signed URL CSP */
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
          >
            <FileText className="h-7 w-7 text-red-500" />
          </div>
          <span className="text-xs text-muted-foreground">PDF הועלה בהצלחה</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/8 hover:bg-primary/15 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            פתח לצפייה
          </a>
        </div>
      ) : (
        /* Image: show inline */
        <img src={url} alt="תצוגה מקדימה" className="w-full h-56 object-contain" />
      )}
      <div className="absolute top-2 left-2 flex gap-1.5">
        {!isPdf && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-background/90 backdrop-blur-sm rounded-full p-1.5 hover:bg-background shadow-sm transition-colors"
            title="פתח בחלון חדש"
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
          </a>
        )}
        <button
          onClick={onClear}
          className="bg-background/90 backdrop-blur-sm rounded-full p-1.5 hover:bg-background shadow-sm transition-colors"
          title="הסר קובץ"
        >
          <X className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>
    </div>
  )
}
