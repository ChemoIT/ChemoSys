'use client'

/**
 * DriverLicenseSection — manages the driver's license.
 *
 * Features:
 *   - Multi-select license categories (10 Israeli categories)
 *   - Image upload (front + back) via Supabase fleet-licenses bucket
 *   - Drag-drop + file picker + camera capture
 *   - Expiry date with days-remaining indicator
 *   - License expiry alert toggle
 */

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Upload, X, Camera, Bell, BellOff, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient as createBrowserClient } from '@/lib/supabase/browser'
import { upsertDriverLicense, type DriverLicense } from '@/actions/fleet/drivers'

// All valid Israeli license categories
const LICENSE_CATEGORIES = ['A1', 'A2', 'A', 'B', 'C1', 'C', 'D1', 'D2', 'D3', 'D']

type Props = {
  driverId: string
  license: DriverLicense | null
  yellowDays: number
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / 86_400_000)
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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
  }

  return (
    <div className="space-y-1.5">
      <Label>{side === 'front' ? 'תמונת פנים' : 'תמונת גב'}</Label>
      <div
        className={`relative border-2 border-dashed rounded-xl overflow-hidden transition-colors ${
          dragging ? 'border-primary bg-primary/5' : url ? 'border-border' : 'border-muted-foreground/30 hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {url ? (
          <div className="relative">
            <img src={url} alt={side === 'front' ? 'פנים' : 'גב'} className="w-full h-36 object-cover" />
            <button
              onClick={onClear}
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
                <span className="text-xs text-center px-2">גרור תמונה לכאן</span>
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
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />

      {!url && !uploading && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            מהמחשב
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => cameraRef.current?.click()}>
            <Camera className="h-3.5 w-3.5" />
            סרוק / צלם
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export function DriverLicenseSection({ driverId, license, yellowDays }: Props) {
  const [editing, setEditing] = useState(!license)
  const [licenseNumber, setLicenseNumber] = useState(license?.licenseNumber ?? '')
  const [categories, setCategories] = useState<string[]>(license?.licenseCategories ?? [])
  const [issueYear, setIssueYear] = useState(license?.issueYear ? String(license.issueYear) : '')
  const [expiryDate, setExpiryDate] = useState(license?.expiryDate ?? '')
  const [frontUrl, setFrontUrl] = useState(license?.frontImageUrl ?? '')
  const [backUrl, setBackUrl] = useState(license?.backImageUrl ?? '')
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [isSaving, startSavingTransition] = useTransition()

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
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
      const { data } = supabase.storage.from('fleet-licenses').getPublicUrl(fileName)
      setUrl(data.publicUrl)
      toast.success(`תמונת ${side === 'front' ? 'פנים' : 'גב'} הועלתה`)
    } catch (err) {
      toast.error(`שגיאה בהעלאת התמונה: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setUploading(false)
    }
  }

  function handleSave() {
    startSavingTransition(async () => {
      const result = await upsertDriverLicense({
        driverId,
        licenseNumber,
        licenseCategories: categories,
        issueYear: issueYear ? parseInt(issueYear, 10) : null,
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
            {(license?.licenseCategories ?? []).map((cat) => (
              <Badge key={cat} variant="secondary">{cat}</Badge>
            ))}
            {(license?.licenseCategories ?? []).length === 0 && (
              <span className="text-sm text-muted-foreground">לא הוזנו סוגי רשיון</span>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>ערוך</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">מספר רשיון</p>
            <p className="font-medium" dir="ltr">{license?.licenseNumber || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">שנת הוצאה</p>
            <p className="font-medium">{license?.issueYear ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">תוקף עד</p>
            <p className={`font-medium ${expiryColor}`}>
              {license?.expiryDate ? new Date(license.expiryDate).toLocaleDateString('he-IL') : '—'}
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
      {/* License number + issue year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lic-number">מספר רשיון</Label>
          <Input
            id="lic-number"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            dir="ltr"
            placeholder="1234567"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lic-year">שנת הוצאה (אופציונלי)</Label>
          <Input
            id="lic-year"
            type="number"
            value={issueYear}
            onChange={(e) => setIssueYear(e.target.value)}
            dir="ltr"
            placeholder="2018"
            min={1950}
            max={new Date().getFullYear()}
          />
        </div>
      </div>

      {/* Expiry date */}
      <div className="space-y-1.5">
        <Label htmlFor="lic-expiry">תוקף רשיון</Label>
        <Input
          id="lic-expiry"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          dir="ltr"
          className="w-48"
        />
        {days !== null && (
          <p className={`text-xs ${expiryColor} mt-0.5`}>
            {days < 0 ? `פג לפני ${Math.abs(days)} ימים` : `${days} ימים עד פקיעה`}
          </p>
        )}
      </div>

      {/* Alert toggle */}
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
        <button
          onClick={() => setAlertEnabled((v) => !v)}
          className={`flex items-center gap-2 text-sm transition-colors ${
            alertEnabled ? 'text-amber-600' : 'text-muted-foreground'
          }`}
        >
          {alertEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {alertEnabled ? 'התראת תפוגה פעילה' : 'הפעל התראה על תפוגת רשיון קרוב'}
        </button>
        <span className="text-xs text-muted-foreground">(ישלח SMS {yellowDays} ימים לפני תפוגה)</span>
      </div>

      {/* License categories */}
      <div className="space-y-2">
        <Label>סוגי רשיון</Label>
        <div className="flex flex-wrap gap-2">
          {LICENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                categories.includes(cat)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Image upload zones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UploadZone
          side="front"
          url={frontUrl}
          uploading={uploadingFront}
          onFile={(f) => uploadImage(f, 'front', setFrontUrl, setUploadingFront)}
          onClear={() => setFrontUrl('')}
        />
        <UploadZone
          side="back"
          url={backUrl}
          uploading={uploadingBack}
          onFile={(f) => uploadImage(f, 'back', setBackUrl, setUploadingBack)}
          onClear={() => setBackUrl('')}
        />
      </div>

      {/* Save / Cancel */}
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
          <Save className="h-4 w-4 ms-1" />
          שמור רשיון
        </Button>
        {license && (
          <Button variant="outline" onClick={() => setEditing(false)}>ביטול</Button>
        )}
      </div>
    </div>
  )
}
