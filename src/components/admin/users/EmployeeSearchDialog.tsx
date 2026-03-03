'use client'

/**
 * EmployeeSearchDialog — searchable dialog for selecting an employee during user creation.
 *
 * Performs client-side filtering across: first_name, last_name, id_number, email,
 * employee_number. Excludes employees already linked to an active user account.
 *
 * Props:
 *   open             — dialog visibility
 *   onOpenChange     — toggle handler
 *   onSelect         — callback with selected employee data
 *   employees        — full list fetched server-side (active employees only)
 *   linkedEmployeeIds — IDs already linked to non-deleted users (excluded from results)
 */

import * as React from 'react'
import { Search, User } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmployeeOption = {
  id: string
  first_name: string
  last_name: string
  employee_number: string
  email: string | null
  id_number: string | null
  companies: { name: string } | null
}

interface EmployeeSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (employee: {
    id: string
    first_name: string
    last_name: string
    employee_number: string
    email?: string | null
    id_number?: string | null
    company_name?: string
  }) => void
  employees: EmployeeOption[]
  /** Employee IDs already linked to active (non-deleted) users — excluded from results */
  linkedEmployeeIds: string[]
}

// ---------------------------------------------------------------------------
// Helper: mask ID number — show only last 4 digits
// ---------------------------------------------------------------------------

function maskId(idNumber: string | null): string {
  if (!idNumber) return '---'
  if (idNumber.length <= 4) return idNumber
  return '****' + idNumber.slice(-4)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployeeSearchDialog({
  open,
  onOpenChange,
  onSelect,
  employees,
  linkedEmployeeIds,
}: EmployeeSearchDialogProps) {
  const [query, setQuery] = React.useState('')

  // Reset search when dialog opens
  React.useEffect(() => {
    if (open) setQuery('')
  }, [open])

  // Filter employees:
  // 1. Exclude already-linked employees
  // 2. Match against: full name, id_number, email, employee_number
  const filtered = React.useMemo(() => {
    const available = employees.filter((e) => !linkedEmployeeIds.includes(e.id))
    if (!query.trim()) return available

    const q = query.trim().toLowerCase()
    return available.filter((e) => {
      const fullName = `${e.first_name} ${e.last_name}`.toLowerCase()
      const reverseName = `${e.last_name} ${e.first_name}`.toLowerCase()
      return (
        fullName.includes(q) ||
        reverseName.includes(q) ||
        (e.id_number ?? '').toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        e.employee_number.toLowerCase().includes(q)
      )
    })
  }, [employees, linkedEmployeeIds, query])

  function handleSelect(employee: EmployeeOption) {
    onSelect({
      id: employee.id,
      first_name: employee.first_name,
      last_name: employee.last_name,
      employee_number: employee.employee_number,
      email: employee.email,
      id_number: employee.id_number,
      company_name: employee.companies?.name,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>בחירת עובד</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder="חיפוש לפי שם, ת.ז., מייל, מספר עובד..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pt-1">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {query ? 'לא נמצאו עובדים התואמים לחיפוש' : 'כל העובדים כבר מקושרים ליוזרים'}
            </div>
          ) : (
            filtered.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => handleSelect(employee)}
                className="w-full text-start rounded-md px-3 py-2.5 hover:bg-accent transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {employee.first_name} {employee.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                      <span>מס׳ {employee.employee_number}</span>
                      {employee.companies?.name && (
                        <span className="text-muted-foreground/70">· {employee.companies.name}</span>
                      )}
                      {employee.id_number && (
                        <span>· ת.ז. {maskId(employee.id_number)}</span>
                      )}
                      {employee.email && (
                        <span className="truncate">· {employee.email}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
