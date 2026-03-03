'use client'

/**
 * EmployeeCombobox — single-select employee picker with auto-pull.
 *
 * Uses shadcn/ui Popover + Command (cmdk) pattern — same as RoleTagMultiSelect
 * but for single selection. On select, fires onChange with the employee ID
 * plus their email and mobile_phone so parent can auto-fill contact fields.
 *
 * Usage:
 *   <EmployeeCombobox
 *     employees={employees}
 *     value={pmId}
 *     onChange={(id, emp) => { setPmId(id); setPmEmail(emp.email ?? '') }}
 *     placeholder="בחר מנהל פרויקט"
 *   />
 */

import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmployeeOption {
  id: string
  first_name: string
  last_name: string
  employee_number?: string | null
  email: string | null
  mobile_phone: string | null
}

interface EmployeeComboboxProps {
  employees: EmployeeOption[]
  value: string                   // selected employee ID or ''
  onChange: (
    employeeId: string,
    employee: { email: string | null; mobile_phone: string | null }
  ) => void
  placeholder?: string
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// EmployeeCombobox
// ---------------------------------------------------------------------------

export function EmployeeCombobox({
  employees,
  value,
  onChange,
  placeholder = 'בחר עובד',
  disabled = false,
}: EmployeeComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selected = employees.find((e) => e.id === value)

  const triggerLabel = selected
    ? `${selected.first_name} ${selected.last_name}`
    : placeholder

  function handleSelect(employeeId: string) {
    const emp = employees.find((e) => e.id === employeeId)
    if (emp) {
      onChange(emp.id, { email: emp.email, mobile_phone: emp.mobile_phone })
    }
    setOpen(false)
  }

  function handleClear() {
    onChange('', { email: null, mobile_phone: null })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {triggerLabel}
          </span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0" align="start">
        <Command
          filter={(employeeId, search) => {
            // Custom filter: match against full name and employee number
            const emp = employees.find((e) => e.id === employeeId)
            if (!emp) return 0
            const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase()
            const empNum   = (emp.employee_number ?? '').toLowerCase()
            const query    = search.toLowerCase()
            return fullName.includes(query) || empNum.includes(query) ? 1 : 0
          }}
        >
          <CommandInput placeholder="חיפוש עובד..." />
          <CommandList>
            <CommandEmpty>לא נמצאו עובדים</CommandEmpty>
            <CommandGroup>
              {/* Clear selection option */}
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={handleClear}
                  className="text-muted-foreground text-xs"
                >
                  <X className="me-2 h-3 w-3" />
                  ניקוי בחירה
                </CommandItem>
              )}

              {employees.map((emp) => (
                <CommandItem
                  key={emp.id}
                  value={emp.id}
                  onSelect={() => handleSelect(emp.id)}
                >
                  <Check
                    className={cn(
                      'me-2 h-4 w-4',
                      value === emp.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span>
                    {emp.first_name} {emp.last_name}
                    {emp.employee_number && (
                      <span className="ms-1 text-xs text-muted-foreground">
                        ({emp.employee_number})
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
