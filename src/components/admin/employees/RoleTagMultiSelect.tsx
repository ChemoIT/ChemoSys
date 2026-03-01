'use client'

/**
 * RoleTagMultiSelect — multi-select component for role tags.
 *
 * Uses shadcn/ui Popover + Command (cmdk) pattern:
 *   - Popover trigger shows selected count or names
 *   - Command list with search input and toggleable items
 *   - Selected tags rendered as removable Badges below trigger
 *   - Hidden inputs for each selected ID so FormData is accessible
 *     in Server Actions via formData.getAll('role_tag_ids')
 */

import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import type { RoleTag } from '@/types/entities'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

interface RoleTagMultiSelectProps {
  roleTags: RoleTag[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function RoleTagMultiSelect({
  roleTags,
  selectedIds,
  onChange,
}: RoleTagMultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  // Toggle a role tag in/out of selected set
  function toggleTag(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  // Remove a tag from the badge row
  function removeTag(id: string) {
    onChange(selectedIds.filter((s) => s !== id))
  }

  // Build trigger label
  const selectedTags = roleTags.filter((t) => selectedIds.includes(t.id))
  let triggerLabel: string
  if (selectedTags.length === 0) {
    triggerLabel = 'בחר תגיות תפקיד'
  } else if (selectedTags.length <= 2) {
    triggerLabel = selectedTags.map((t) => t.name).join(', ')
  } else {
    triggerLabel = `${selectedTags.length} תגיות נבחרו`
  }

  return (
    <div className="space-y-2">
      {/* Hidden inputs — one per selected ID — so Server Action can read them */}
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="role_tag_ids" value={id} />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="חיפוש תגית..." />
            <CommandList>
              <CommandEmpty>לא נמצאו תגיות</CommandEmpty>
              <CommandGroup>
                {roleTags.map((tag) => {
                  const isSelected = selectedIds.includes(tag.id)
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => toggleTag(tag.id)}
                    >
                      <Check
                        className={cn(
                          'me-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {tag.name}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected tags as removable badges */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 pe-1"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="rounded-sm hover:bg-secondary-foreground/20 p-0.5"
                aria-label={`הסר ${tag.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
