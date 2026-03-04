'use client'

/**
 * UserEditDialog — edit an existing user's auth credentials and ChemoSys permissions.
 *
 * Editable fields:
 *   - Email (auth — used for login)
 *   - Password (optional reset — leave blank to keep current)
 *   - ChemoSys module access (app_fleet / app_equipment checkboxes)
 *
 * Calls updateUserAuth Server Action on submit.
 */

import * as React from 'react'
import { useTransition } from 'react'
import { Loader2, Pencil, Truck, HardHat } from 'lucide-react'
import { toast } from 'sonner'
import { updateUserAuth } from '@/actions/users'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PermissionRow = {
  module_key: string
  level: number
  is_override: boolean
  template_id: string | null
}

interface UserEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  authEmail: string | null
  currentPermissions: PermissionRow[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserEditDialog({
  open,
  onOpenChange,
  userId,
  userName,
  authEmail,
  currentPermissions,
}: UserEditDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = React.useState(authEmail ?? '')
  const [password, setPassword] = React.useState('')
  const [appFleet, setAppFleet] = React.useState(false)
  const [appEquipment, setAppEquipment] = React.useState(false)

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setEmail(authEmail ?? '')
      setPassword('')
      setAppFleet(currentPermissions.some(p => p.module_key === 'app_fleet' && p.level >= 1))
      setAppEquipment(currentPermissions.some(p => p.module_key === 'app_equipment' && p.level >= 1))
    }
  }, [open, authEmail, currentPermissions])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateUserAuth(userId, formData)
      if (result.success) {
        toast.success('פרטי היוזר עודכנו בהצלחה')
        onOpenChange(false)
      } else {
        toast.error(result.error ?? 'שגיאה בעדכון היוזר')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            עריכת יוזר — {userName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="edit-email">כתובת מייל (להתחברות)</Label>
            <Input
              id="edit-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              disabled={isPending}
            />
          </div>

          {/* Password (optional reset) */}
          <div className="space-y-2">
            <Label htmlFor="edit-password">סיסמה חדשה</Label>
            <Input
              id="edit-password"
              name="password"
              type="password"
              placeholder="השאר ריק כדי לא לשנות"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              לפחות 6 תווים. השאר ריק כדי לשמור את הסיסמה הנוכחית.
            </p>
          </div>

          {/* ChemoSys module access */}
          <div className="space-y-2">
            <Label>גישה ל-ChemoSys</Label>
            <div className="flex items-center gap-6 rounded-md border bg-muted/30 px-3 py-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="app_fleet"
                  value="1"
                  checked={appFleet}
                  onChange={(e) => setAppFleet(e.target.checked)}
                  className="h-4 w-4 accent-primary cursor-pointer"
                  disabled={isPending}
                />
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">צי רכב</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="app_equipment"
                  value="1"
                  checked={appEquipment}
                  onChange={(e) => setAppEquipment(e.target.checked)}
                  className="h-4 w-4 accent-primary cursor-pointer"
                  disabled={isPending}
                />
                <HardHat className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">צמ&quot;ה</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  שומר...
                </>
              ) : (
                'שמור שינויים'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
