'use client'

/**
 * DriverLicenseSection — manages the driver's license.
 *
 * Features:
 *   - Multi-select license categories (10 Israeli categories)
 *   - Image upload (front + back) via Supabase fleet-licenses bucket
 *   - Drag-drop + file picker + camera capture
 *   - Expiry date with days-remaining indicator
 *   - License expiry alert toggle — modern switch inline with expiry date
 */

import { useState, useTransition, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Upload, X, Camera, Bell, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import { upsertDriverLicense, type DriverLicense } from '@/actions/fleet/drivers'
import { formatDate, daysUntil } from '@/lib/format'
import { FleetDateInput } from './FleetDateInput'

// All valid Israeli license categories
const LICENSE_CATEGORIES = ['A1', 'A2', 'A', 'B', 'C1', 'C', 'D1', 'D2', 'D3', 'D', 'M', 'N']
// M = מלגזה (forklift), N = מכונה ניידת (mobile machine)

type Props = {
  driverId: string
  license: DriverLicense | null
  yellowDays: number
  onEditingChange?: (isEditing: boolean) => void
}

// formatDate, daysUntil — imported from @/lib/format

// ── Alert Toggle (shadcn Switch — dir="ltr" to fix RTL slide direction) ──────

function AlertToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-2.5 shrink-0" dir="ltr">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[#4ECDC4]"
      />
      <span
        dir="rtl"
        className={`text-xs flex items-center gap-1 transition-colors ${checked ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}
      >
        <Bell className="h-3.5 w-3.5" />
        {label}
      </span>
    </div>
  )
}

// ── Image Upload Zone ────────────────────────────────────────

type UploadZoneProps = {
  side: 'front' | 'back'
  url: string
  uploading: boolean
  onFile: (file: File) => void
  onClear: () => void
}

function UploadZone({ side, url, uploading, onFile, onClear }: UploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      onFile(file)
    } else if (file) {
      toast.error('ניתן להעלות קבצי תמונה בלבד')
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{side === 'front' ? 'תמונת פנים' : 'תמונת גב'}</Label>
      <div
        className={`relative border-2 border-dashed rounded-xl overflow-hidden transition-colors cursor-pointer ${
          dragging ? 'border-primary bg-primary/5' : url ? 'border-border' : 'border-muted-foreground/30 hover:border-primary/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true) }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
        onDrop={handleDrop}
        onClick={() => { if (!url && !uploading) fileRef.current?.click() }}
      >
        {url ? (
          <div className="relative">
            <img src={url} alt={side === 'front' ? 'פנים' : 'גב'} className="w-full h-36 object-cover" />
            <button
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="absolute top-2 left-2 bg-background/80 rounded-full p-1 hover:bg-background"
              title="הסר תמונה"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="h-28 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Image className="h-6 w-6" />
                <span className="text-xs text-center px-2">לחץ או גרור תמונה לכאן</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = '' } }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = '' } }}
      />

      {!url && !uploading && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>
            <Upload className="h-3.5 w-3.5" />
            מהמחשב
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={(e) => { e.stopPropagation(); cameraRef.current?.click() }}>
            <Camera className="h-3.5 w-3.5" />
            סרוק / צלם
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export function DriverLicenseSection({ driverId, license, yellowDays, onEditingChange }: Props) {
  const [editing, setEditing] = useState(!license)
  const [licenseNumber, setLicenseNumber] = useState(license?.licenseNumber ?? '')
  const [categories, setCategories] = useState<string[]>(license?.licenseCategories ?? [])
  const [categoryYears, setCategoryYears] = useState<Record<string, string>>(() => {
    const years: Record<string, string> = {}
    if (license?.categoryIssueYears) {
      for (const [cat, year] of Object.entries(license.categoryIssueYears)) {
        years[cat] = String(year)
      }
    }
    return years
  })
  const [expiryDate, setExpiryDate] = useState(license?.expiryDate ?? '')
  const [frontUrl, setFrontUrl] = useState(license?.frontImageUrl ?? '')
  const [backUrl, setBackUrl] = useState(license?.backImageUrl ?? '')
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [isSaving, startSavingTransition] = useTransition()

  // Original category years as string record (for dirty comparison)
  const origCategoryYears: Record<string, string> = {}
  if (license?.categoryIssueYears) {
    for (const [cat, year] of Object.entries(license.categoryIssueYears)) {
      origCategoryYears[cat] = String(year)
    }
  }

  // Notify parent of REAL dirty state (actual content changes, not just editing mode)
  const isLicenseDirty = editing && (
    licenseNumber !== (license?.licenseNumber ?? '') ||
    JSON.stringify(categories) !== JSON.stringify(license?.licenseCategories ?? []) ||
    JSON.stringify(categoryYears) !== JSON.stringify(origCategoryYears) ||
    expiryDate !== (license?.expiryDate ?? '') ||
    frontUrl !== (license?.frontImageUrl ?? '') ||
    backUrl !== (license?.backImageUrl ?? '')
  )
  useEffect(() => {
    onEditingChange?.(isLicenseDirty)
  }, [isLicenseDirty, onEditingChange])

  // If existing stored URLs are public-style (no /sign/ in path), regenerate signed URLs.
  // Happens when images were uploaded before switching to createSignedUrl.
  useEffect(() => {
    async function refreshSignedUrls() {
      const supabase = createBrowserClient()
      async function resign(url: string, bucket: string, setUrl: (u: string) => void) {
        if (!url || url.includes('/object/sign/')) return // already signed
        // Extract path: everything after /{bucket}/
        const marker = `/${bucket}/`
        const idx = url.indexOf(marker)
        if (idx === -1) return
        const path = url.slice(idx + marker.length)
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 31_536_000)
        if (data?.signedUrl) setUrl(data.signedUrl)
      }
      await Promise.all([
        resign(frontUrl, 'fleet-licenses', setFrontUrl),
        resign(backUrl, 'fleet-licenses', setBackUrl),
      ])
    }
    void refreshSignedUrls()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleCategory(cat: string) {
    setCategories((prev) => {
      if (prev.includes(cat)) {
        // Remove category — also clear its year
        setCategoryYears((years) => {
          const next = { ...years }
          delete next[cat]
          return next
        })
        return prev.filter((c) => c !== cat)
      }
      return [...prev, cat]
    })
  }

  async function uploadImage(
    file: File,
    side: 'front' | 'back',
    setUrl: (url: string) => void,
    setUploading: (v: boolean) => void
  ) {
    setUploading(true)
    try {
      const supabase = createBrowserClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const fileName = `${driverId}_${side}_${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('fleet-licenses')
        .upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError
      // Private bucket — must use signed URL (getPublicUrl won't work)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('fleet-licenses')
        .createSignedUrl(fileName, 31_536_000) // 1 year
      if (signedError) throw signedError
      setUrl(signedData.signedUrl)
      toast.success(`תמונת ${side === 'front' ? 'פנים' : 'גב'} הועלתה`)
    } catch (err) {
      toast.error(`שגיאה בהעלאת התמונה: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setUploading(false)
    }
  }

  function handleSave() {
    startSavingTransition(async () => {
      // Build category_issue_years: only include selected categories with a year
      const yearsPayload: Record<string, number> = {}
      for (const cat of categories) {
        const yr = categoryYears[cat]
        if (yr) {
          const parsed = parseInt(yr, 10)
          if (!isNaN(parsed)) yearsPayload[cat] = parsed
        }
      }

      const result = await upsertDriverLicense({
        driverId,
        licenseNumber,
        licenseCategories: categories,
        categoryIssueYears: yearsPayload,
        expiryDate: expiryDate || null,
        frontImageUrl: frontUrl || null,
        backImageUrl: backUrl || null,
      })
      if (result.success) {
        toast.success('פרטי הרשיון נשמרו')
        setEditing(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  const days = daysUntil(expiryDate || license?.expiryDate || null)
  const expiryColor =
    days === null ? 'text-muted-foreground'
      : days < 0 ? 'text-red-600 font-semibold'
        : days <= yellowDays ? 'text-yellow-600 font-semibold'
          : 'text-green-600'

  // ── Read mode ───────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(license?.licenseCategories ?? []).map((cat) => {
              const year = license?.categoryIssueYears?.[cat]
              return (
                <Badge key={cat} variant="secondary">
                  {cat}{year ? ` (${year})` : ''}
                </Badge>
              )
            })}
            {(license?.licenseCategories ?? []).length === 0 && (
              <span className="text-sm text-muted-foreground">לא הוזנו סוגי רשיון</span>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>ערוך</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">מספר רשיון</p>
            <p className="font-medium" dir="ltr">{license?.licenseNumber || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">תוקף עד</p>
            <p className={`font-medium ${expiryColor}`}>
              {formatDate(license?.expiryDate ?? null)}
              {days !== null && (
                <span className="text-xs ms-1">
                  ({days < 0 ? `פג לפני ${Math.abs(days)} ימים` : `${days} ימים`})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* License images */}
        {(license?.frontImageUrl || license?.backImageUrl) && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            {license.frontImageUrl && (
              <a href={license.frontImageUrl} target="_blank" rel="noopener noreferrer">
                <img src={license.frontImageUrl} alt="פנים רשיון" className="w-full h-36 object-cover rounded-lg border hover:opacity-90 transition-opacity" />
                <p className="text-xs text-center text-muted-foreground mt-1">פנים</p>
              </a>
            )}
            {license.backImageUrl && (
              <a href={license.backImageUrl} target="_blank" rel="noopener noreferrer">
                <img src={license.backImageUrl} alt="גב רשיון" className="w-full h-36 object-cover rounded-lg border hover:opacity-90 transition-opacity" />
                <p className="text-xs text-center text-muted-foreground mt-1">גב</p>
              </a>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* License number */}
      <div className="space-y-1.5">
        <Label htmlFor="lic-number">מספר רשיון</Label>
        <Input
          id="lic-number"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          dir="ltr"
          className="max-w-xs"
        />
      </div>

      {/* Expiry date + alert toggle — inline */}
      <div className="space-y-1.5">
        <Label htmlFor="lic-expiry">תוקף רשיון</Label>
        <div className="flex items-center gap-4 flex-wrap">
          <FleetDateInput
            value={expiryDate}
            onChange={setExpiryDate}
            minYear={2010}
          />
          {/* Modern toggle switch — inline with expiry date */}
          <AlertToggle
            checked={alertEnabled}
            onChange={setAlertEnabled}
            label={alertEnabled ? `התראה פעילה (${yellowDays} יום לפני)` : 'הפעל התראת תפוגה'}
          />
        </div>
        {days !== null && (
          <p className={`text-xs ${expiryColor} mt-0.5`}>
            {days < 0 ? `פג לפני ${Math.abs(days)} ימים` : `${days} ימים עד פקיעה`}
          </p>
        )}
      </div>

      {/* License categories + per-category issue year */}
      <div className="space-y-2">
        <Label>סוגי רשיון</Label>
        <div className="flex flex-wrap gap-2">
          {LICENSE_CATEGORIES.map((cat) => {
            const selected = categories.includes(cat)
            return (
              <div key={cat} className="flex items-center gap-1">
                <button
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {cat}
                </button>
                {selected && (
                  <Input
                    type="number"
                    placeholder="שנה"
                    value={categoryYears[cat] ?? ''}
                    onChange={(e) => setCategoryYears((prev) => ({ ...prev, [cat]: e.target.value }))}
                    dir="ltr"
                    min={1950}
                    max={new Date().getFullYear()}
                    className="w-[70px] h-8 text-xs text-center"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Image upload zones — front on right (first in RTL grid), back on left */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UploadZone
          side="back"
          url={backUrl}
          uploading={uploadingBack}
          onFile={(f) => uploadImage(f, 'back', setBackUrl, setUploadingBack)}
          onClear={() => setBackUrl('')}
        />
        <UploadZone
          side="front"
          url={frontUrl}
          uploading={uploadingFront}
          onFile={(f) => uploadImage(f, 'front', setFrontUrl, setUploadingFront)}
          onClear={() => setFrontUrl('')}
        />
      </div>

      {/* Save / Cancel */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {license && (
          <Button variant="outline" onClick={() => setEditing(false)}>ביטול</Button>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          <Save className="h-4 w-4 ms-1" />
          שמור רשיון
        </Button>
      </div>
    </div>
  )
}
