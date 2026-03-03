'use client'

/**
 * ProjectForm — placeholder dialog component for create/edit project.
 *
 * NOTE: This is a minimal placeholder created to unblock Plan 03 (ProjectsTable).
 * The full implementation (all 7 sections: basic info, PM/SM, CVC, client, supervision,
 * clocks, location picker) will be built in Plan 02.
 *
 * Currently supports:
 *  - Displaying the dialog shell (open/close)
 *  - Showing project name in edit mode title
 *  - Placeholder message directing user to full form (coming soon)
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Project } from '@/types/entities'
import type { Employee } from '@/types/entities'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProject, updateProject } from '@/actions/projects'
import { useActionState } from 'react'
import { useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
  employees: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'email' | 'mobile_phone'>[]
  clocks?: Array<{ clock_id: string }>
}

// ---------------------------------------------------------------------------
// ProjectForm
// ---------------------------------------------------------------------------

export function ProjectForm({
  open,
  onOpenChange,
  project,
  employees: _employees,
  clocks: _clocks,
}: ProjectFormProps) {
  const router = useRouter()
  const isEdit = !!project

  const action = isEdit ? updateProject : createProject

  const [state, formAction, pending] = useActionState(action, null)

  // Close dialog on success
  useEffect(() => {
    if (state?.success) {
      onOpenChange(false)
      router.refresh()
    }
  }, [state, onOpenChange, router])

  const [name, setName] = useState(project?.name ?? '')
  const [status, setStatus] = useState(project?.status ?? 'active')

  // Reset on open/project change
  useEffect(() => {
    if (open) {
      setName(project?.name ?? '')
      setStatus(project?.status ?? 'active')
    }
  }, [open, project])

  const errorMsg =
    state && !state.success
      ? typeof state.error === 'string'
        ? state.error
        : state.error?._form?.[0] ?? 'שגיאה בשמירת הפרויקט'
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `עריכת פרויקט: ${project?.name}` : 'פרויקט חדש'}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? 'עדכן את פרטי הפרויקט' : 'הוסף פרויקט חדש למערכת'}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {/* Hidden project id for edit mode */}
          {isEdit && <input type="hidden" name="id" value={project.id} />}

          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">שם פרויקט *</Label>
            <Input
              id="name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="הזן שם פרויקט"
            />
          </div>

          {/* Project number — disabled, auto-generated */}
          <div className="space-y-1">
            <Label htmlFor="project_number">מספר פרויקט</Label>
            <Input
              id="project_number"
              name="project_number"
              disabled
              value={project?.project_number ?? ''}
              placeholder="ייווצר אוטומטית"
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label htmlFor="status">סטטוס</Label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'view_only' | 'inactive')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="active">פעיל</option>
              <option value="view_only">לצפייה בלבד</option>
              <option value="inactive">לא פעיל</option>
            </select>
          </div>

          {/* Boolean defaults — required by Server Action */}
          <input type="hidden" name="pm_notifications" value="true" />
          <input type="hidden" name="sm_notifications" value="true" />
          <input type="hidden" name="cvc_is_employee" value="true" />
          <input type="hidden" name="supervision_notifications" value="false" />
          <input type="hidden" name="supervision_attach_reports" value="false" />
          <input type="hidden" name="radius" value="100" />

          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'שומר...' : isEdit ? 'עדכון' : 'שמירה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
