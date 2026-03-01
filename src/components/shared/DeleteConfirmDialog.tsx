'use client'

/**
 * DeleteConfirmDialog — Hebrew confirmation dialog for soft-delete operations.
 *
 * Uses shadcn/ui AlertDialog for accessible, keyboard-navigable confirmation.
 * Always shows a warning that the action can be reversed (soft-delete only).
 *
 * Props:
 *   open         — dialog visibility
 *   onOpenChange — toggle handler from parent
 *   onConfirm    — called when user confirms deletion
 *   title        — dialog title (default: "מחיקת רשומה")
 *   description  — dialog body text
 *   loading      — disables confirm button and shows spinner during async op
 */

import { Loader2 } from 'lucide-react'

// Using Dialog (already installed) instead of AlertDialog for the confirmation.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title?: string
  description?: string
  loading?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'מחיקת רשומה',
  description = 'האם אתה בטוח שברצונך למחוק? פעולה זו ניתנת לשחזור.',
  loading = false,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            ביטול
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                מוחק...
              </>
            ) : (
              'מחק'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
