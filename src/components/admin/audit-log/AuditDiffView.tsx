'use client'

/**
 * AuditDiffView — renders before/after diff for an expanded audit log row.
 *
 * INSERT: shows new_data in green
 * DELETE: shows old_data in red
 * UPDATE: shows only changed keys, side-by-side (RTL: לפני on right, אחרי on left)
 *
 * All null checks handled — old_data/new_data can be null per schema.
 */

type AuditDiffViewProps = {
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  action: string
}

// ---------------------------------------------------------------------------
// Sub-component: renders a JSON block with label and color
// ---------------------------------------------------------------------------

function JsonBlock({
  label,
  data,
  colorClass,
  bgClass,
}: {
  label: string
  data: Record<string, unknown> | null
  colorClass: string
  bgClass: string
}) {
  if (!data) {
    return (
      <div>
        <p className={`font-semibold ${colorClass} mb-1 text-xs`}>{label}</p>
        <p className="text-muted-foreground text-xs">אין נתונים</p>
      </div>
    )
  }
  return (
    <div>
      <p className={`font-semibold ${colorClass} mb-1 text-xs`}>{label}</p>
      <pre className={`${bgClass} rounded p-2 overflow-auto text-xs leading-relaxed`}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function AuditDiffView({ oldData, newData, action }: AuditDiffViewProps) {
  // INSERT — only new data
  if (action === 'INSERT') {
    return (
      <div className="p-2">
        <JsonBlock
          label="נתונים חדשים"
          data={newData}
          colorClass="text-green-600"
          bgClass="bg-green-50 dark:bg-green-950/30"
        />
      </div>
    )
  }

  // DELETE — only old data
  if (action === 'DELETE') {
    return (
      <div className="p-2">
        <JsonBlock
          label="נתונים שנמחקו"
          data={oldData}
          colorClass="text-red-600"
          bgClass="bg-red-50 dark:bg-red-950/30"
        />
      </div>
    )
  }

  // UPDATE — compare keys, show only changed ones
  if (!oldData && !newData) {
    return <p className="text-muted-foreground text-xs p-2">אין נתונים להצגה</p>
  }

  const allKeys = new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])

  const changedKeys = [...allKeys].filter(
    (k) =>
      JSON.stringify((oldData ?? {})[k as keyof typeof oldData]) !==
      JSON.stringify((newData ?? {})[k as keyof typeof newData])
  )

  if (changedKeys.length === 0) {
    return <p className="text-muted-foreground text-xs p-2">אין שינויים מזוהים</p>
  }

  const oldChanged = Object.fromEntries(changedKeys.map((k) => [k, (oldData ?? {})[k]]))
  const newChanged = Object.fromEntries(changedKeys.map((k) => [k, (newData ?? {})[k]]))

  // RTL layout: grid-cols-2, "לפני" on the right (first in RTL), "אחרי" on the left
  return (
    <div className="grid grid-cols-2 gap-4 p-2 text-xs">
      {/* Right side in RTL = first column = "לפני" */}
      <div>
        <p className="font-semibold text-red-600 mb-1">לפני</p>
        <pre className="bg-red-50 dark:bg-red-950/30 rounded p-2 overflow-auto leading-relaxed">
          {JSON.stringify(oldChanged, null, 2)}
        </pre>
      </div>
      {/* Left side in RTL = second column = "אחרי" */}
      <div>
        <p className="font-semibold text-green-600 mb-1">אחרי</p>
        <pre className="bg-green-50 dark:bg-green-950/30 rounded p-2 overflow-auto leading-relaxed">
          {JSON.stringify(newChanged, null, 2)}
        </pre>
      </div>
    </div>
  )
}
