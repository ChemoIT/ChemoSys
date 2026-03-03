/**
 * /api/export — Universal admin table Excel/CSV export Route Handler.
 *
 * GET /api/export?table=<name>&format=<xlsx|csv>
 *
 * Security:
 *   - verifySession() — same auth guard as Server Actions. Returns 401 if not logged in.
 *   - ALLOWED_TABLES whitelist — prevents access to any table not explicitly listed.
 *     No user input goes directly into a query — table name is whitelisted first.
 *
 * Features:
 *   - RTL worksheet (Hebrew) via worksheet.views = [{ rightToLeft: true }]
 *   - Bold header row
 *   - Internal columns excluded from export: deleted_at, created_by, updated_by
 *   - Soft-deleted rows excluded: .is('deleted_at', null)
 *   - Filename format: {table}_export_{YYYY-MM-DD}.xlsx (or .csv)
 *
 * Supported tables (EXPORT-01 requirement):
 *   companies, departments, employees, projects, users, role_templates
 */

import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Whitelist — ONLY these tables can be exported.
// Prevents access to system tables, audit_log, auth.users, etc.
// ---------------------------------------------------------------------------

const ALLOWED_TABLES = [
  'companies',
  'departments',
  'employees',
  'projects',
  'users',
  'role_templates',
] as const

type AllowedTable = typeof ALLOWED_TABLES[number]

// ---------------------------------------------------------------------------
// Hebrew worksheet names
// ---------------------------------------------------------------------------

const HEBREW_TABLE_NAMES: Record<AllowedTable, string> = {
  companies:       'חברות',
  departments:     'מחלקות',
  employees:       'עובדים',
  projects:        'פרויקטים',
  users:           'משתמשים',
  role_templates:  'תבניות הרשאות',
}

// ---------------------------------------------------------------------------
// Internal columns to exclude from exports
// These are DB-internal UUIDs/timestamps not useful in an export spreadsheet.
// ---------------------------------------------------------------------------

const EXCLUDED_COLUMNS = ['deleted_at', 'created_by', 'updated_by'] as const

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // 1. Auth guard — same as Server Actions
  try {
    await verifySession()
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const tableParam  = searchParams.get('table') ?? ''
  const formatParam = searchParams.get('format') ?? 'xlsx'

  // 2. Validate table is in whitelist
  if (!ALLOWED_TABLES.includes(tableParam as AllowedTable)) {
    return new Response('Invalid table', { status: 400 })
  }

  const table  = tableParam as AllowedTable
  const format = formatParam === 'csv' ? 'csv' : 'xlsx'

  // 3. Fetch data — exclude soft-deleted rows
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .is('deleted_at', null)

  if (error) {
    console.error(`[export] Failed to fetch ${table}:`, error.message)
    return new Response('Export failed', { status: 500 })
  }

  const rows = data ?? []

  // 4. Build ExcelJS workbook
  const workbook  = new ExcelJS.Workbook()
  workbook.creator = 'ChemoSystem'

  const worksheet = workbook.addWorksheet(HEBREW_TABLE_NAMES[table])

  // RTL layout for Hebrew content
  worksheet.views = [{ rightToLeft: true }]

  if (rows.length > 0) {
    // Determine columns — filter out internal-only columns
    const allKeys    = Object.keys(rows[0] as Record<string, unknown>)
    const filteredKeys = allKeys.filter(
      (key) => !EXCLUDED_COLUMNS.includes(key as typeof EXCLUDED_COLUMNS[number])
    )

    // Set worksheet columns with header and width
    worksheet.columns = filteredKeys.map((key) => ({
      header: key,
      key,
      width: 20,
    }))

    // Add data rows (only the filtered columns)
    const filteredRows = rows.map((row) => {
      const r = row as Record<string, unknown>
      const filtered: Record<string, unknown> = {}
      for (const key of filteredKeys) {
        filtered[key] = r[key]
      }
      return filtered
    })

    worksheet.addRows(filteredRows)

    // Bold the header row
    worksheet.getRow(1).font = { bold: true }
  }

  // 5. Generate filename
  const today    = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const filename = `${table}_export_${today}.${format}`

  // 6. Return response
  if (format === 'csv') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const csv = await workbook.csv.writeBuffer() as any
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // xlsx (default)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await workbook.xlsx.writeBuffer() as any
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
