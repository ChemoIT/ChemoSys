'use client'

/**
 * ErrorDetailDialog — Shows non-fatal warnings from server actions.
 *
 * When a main operation succeeds but side-effects fail (email sync,
 * permission writes), this dialog surfaces the details to the admin
 * with a "copy to clipboard" button for pasting to Claude Code.
 */

import { useState } from 'react'
import { AlertTriangle, Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ActionWarning } from '@/lib/action-types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The action that triggered the warnings — e.g. "עדכון עובד" */
  actionLabel: string
  warnings: ActionWarning[]
}

function formatForClipboard(actionLabel: string, warnings: ActionWarning[]): string {
  const now = new Date()
  const date = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  let text = `=== שגיאת מערכת ===\n`
  text += `פעולה: ${actionLabel}\n`
  text += `תאריך: ${date} ${time}\n`
  text += `---\n`

  warnings.forEach((w, i) => {
    text += `[${i + 1}] ${w.context}\n`
    text += `    שגיאה: ${w.message}\n`
    if (w.code) text += `    קוד: ${w.code}\n`
  })

  text += `---\n`
  text += `הדבק הודעה זו ל-Claude Code לאבחון מיידי.\n`
  return text
}

export function ErrorDetailDialog({ open, onOpenChange, actionLabel, warnings }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = formatForClipboard(actionLabel, warnings)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (warnings.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <DialogTitle>פעולות שנכשלו</DialogTitle>
          </div>
          <DialogDescription>
            הפעולה הראשית הצליחה, אבל חלק מהפעולות המשניות נכשלו.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          {warnings.map((w, i) => (
            <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              <div className="font-medium text-amber-800 dark:text-amber-200">{w.context}</div>
              <div className="mt-1 text-amber-700 dark:text-amber-300 font-mono text-xs break-all">
                {w.message}
                {w.code && <span className="mr-2 text-amber-500">({w.code})</span>}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row-reverse sm:flex-row-reverse gap-2">
          <Button onClick={handleCopy} variant="outline" className="gap-2">
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                הועתק!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                העתק ללוח
              </>
            )}
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="default">
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
