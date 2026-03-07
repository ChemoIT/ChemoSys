'use client'

/**
 * AddDriverDialog — opens a dialog to create a new driver card.
 *
 * Flow:
 *   1. Fetch active employees without a driver card.
 *   2. User searches + selects an employee.
 *   3. On confirm → createDriver(employeeId) → redirect to /app/fleet/driver-card/[id].
 */

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Search, UserPlus } from 'lucide-react'
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
  getActiveEmployeesWithoutDriver,
  createDriver,
  type EmployeeOption,
} from '@/actions/fleet/drivers'

type Props = {
  open: boolean
  onClose: () => void
}

export function AddDriverDialog({ open, onClose }: Props) {
  const router = useRouter()
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EmployeeOption | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, startCreatingTransition] = useTransition()

  // Load employee list when dialog opens
  useEffect(() => {
    if (!open) return
    setSearch('')
    setSelected(null)
    setIsLoading(true)
    getActiveEmployeesWithoutDriver()
      .then(setEmployees)
      .catch(() => toast.error('שגיאה בטעינת העובדים'))
      .finally(() => setIsLoading(false))
  }, [open])

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase()
    return (
      e.fullName.toLowerCase().includes(q) ||
      e.employeeNumber.includes(q) ||
      e.companyName.toLowerCase().includes(q)
    )
  })

  function handleCreate() {
    if (!selected) return
    startCreatingTransition(async () => {
      const result = await createDriver(selected.id)
      if (!result.success) {
        toast.error(result.error ?? 'שגיאה ביצירת כרטיס הנהג')
        return
      }
      toast.success(`כרטיס נהג נפתח עבור ${selected.fullName}`)
      onClose()
      router.push(`/app/fleet/driver-card/${result.driverId}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            פתיחת כרטיס נהג חדש
          </DialogTitle>
          <DialogDescription>
            בחר עובד פעיל. ניתן לפתוח כרטיס רק לעובד פעיל שאין לו עדיין כרטיס נהג.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, מ' עובד, חברה..."
            className="pr-9"
            autoFocus
          />
        </div>

        {/* Employee list */}
        <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin me-2" />
              טוען עובדים...
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {employees.length === 0
                ? 'כל העובדים הפעילים כבר רשומים כנהגים'
                : 'לא נמצאו תוצאות'}
            </p>
          )}
          {!isLoading &&
            filtered.map((emp) => (
              <button
                key={emp.id}
                onClick={() => setSelected(selected?.id === emp.id ? null : emp)}
                className={`w-full text-right px-4 py-3 text-sm transition-colors hover:bg-muted/50 ${
                  selected?.id === emp.id ? 'bg-primary/10 font-medium' : ''
                }`}
              >
                <div className="font-medium">{emp.fullName}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  מ' {emp.employeeNumber} | {emp.companyName}
                </div>
              </button>
            ))}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-2">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            ביטול
          </Button>
          <Button onClick={handleCreate} disabled={!selected || isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
            פתח כרטיס נהג
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
