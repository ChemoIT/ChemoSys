'use client'

/**
 * PermissionMatrixEditor — interactive 9-row permission matrix.
 *
 * Renders a table with one row per system module. Each row has 3 native
 * radio buttons (0=אין גישה, 1=קריאה, 2=קריאה+כתיבה).
 *
 * Uses native <input type="radio"> (not shadcn RadioGroup) so the values
 * write to FormData automatically when the form is submitted.
 *
 * Props:
 *   initialPermissions — record of module_key -> level for edit mode.
 *                        Defaults to all zeros (no access) for create mode.
 */

import * as React from 'react'

// ---------------------------------------------------------------------------
// Module definitions
// ---------------------------------------------------------------------------

const MODULE_KEYS = [
  'dashboard',
  'companies',
  'departments',
  'role_tags',
  'employees',
  'users',
  'templates',
  'projects',
  'settings',
] as const

type ModuleKey = (typeof MODULE_KEYS)[number]

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'דשבורד',
  companies: 'חברות',
  departments: 'מחלקות',
  role_tags: 'תגיות תפקיד',
  employees: 'עובדים',
  users: 'יוזרים',
  templates: 'תבניות הרשאות',
  projects: 'פרויקטים',
  settings: 'הגדרות',
}

const LEVELS: Array<{ value: 0 | 1 | 2; label: string }> = [
  { value: 0, label: 'אין גישה' },
  { value: 1, label: 'קריאה' },
  { value: 2, label: 'קריאה + כתיבה' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionMatrixEditorProps {
  /** Initial permission values — from existing template_permissions for edit mode */
  initialPermissions?: Record<string, number>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionMatrixEditor({
  initialPermissions = {},
}: PermissionMatrixEditorProps) {
  // Initialize state from props (or all zeros for create mode)
  const [levels, setLevels] = React.useState<Record<ModuleKey, 0 | 1 | 2>>(() => {
    const init = {} as Record<ModuleKey, 0 | 1 | 2>
    for (const key of MODULE_KEYS) {
      const raw = initialPermissions[key] ?? 0
      init[key] = (raw === 1 || raw === 2 ? raw : 0) as 0 | 1 | 2
    }
    return init
  })

  function handleChange(key: ModuleKey, value: 0 | 1 | 2) {
    setLevels((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-start px-4 py-3 font-medium text-muted-foreground w-1/4">
              מודול
            </th>
            {LEVELS.map((lvl) => (
              <th
                key={lvl.value}
                className="text-center px-4 py-3 font-medium text-muted-foreground"
              >
                {lvl.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULE_KEYS.map((key, index) => (
            <tr
              key={key}
              className={
                index % 2 === 0
                  ? 'bg-background border-b last:border-0'
                  : 'bg-muted/20 border-b last:border-0'
              }
            >
              {/* Module label */}
              <td className="px-4 py-3 font-medium">{MODULE_LABELS[key]}</td>

              {/* Radio buttons — one per level */}
              {LEVELS.map((lvl) => (
                <td key={lvl.value} className="px-4 py-3 text-center">
                  <input
                    type="radio"
                    name={`perm_${key}`}
                    value={String(lvl.value)}
                    checked={levels[key] === lvl.value}
                    onChange={() => handleChange(key, lvl.value)}
                    className="h-4 w-4 cursor-pointer accent-primary"
                    aria-label={`${MODULE_LABELS[key]} - ${lvl.label}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
