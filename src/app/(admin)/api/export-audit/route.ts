/**
 * /api/export-audit — Audit Log Excel/CSV export Route Handler.
 *
 * GET /api/export-audit?format=<xlsx|csv>&entity=...&action=...&from=...&to=...&search=...
 *
 * Security:
 *   - verifySession() — same auth guard as Server Actions. Returns 401 if not logged in.
 *   - NO user-controlled table name — this handler is always for audit_log only.
 *
 * Features:
 *   - Applies the same filters as the page (entity, action, from, to, search)
 *   - Resolves user display names via two-step pattern (Pitfall 2)
 *   - RTL worksheet with Hebrew column headers
 *   - Bold header row
 *   - Filename: audit_log_export_{YYYY-MM-DD}.{xlsx|csv}
 *   - Row limit: 10,000 (prevents memory issues on large datasets)
 *
 * Note: audit_log has NO deleted_at column — soft-delete filter is NOT applied.
 * This differs from the universal /api/export route handler.
 */

import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

const MAX_EXPORT_ROWS = 10_000

export async function GET(req: NextRequest) {
  // 1. Auth guard — same as Server Actions
  try {
    await verifySession()
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const formatParam  = searchParams.get('format') ?? 'xlsx'
  const entityParam  = searchParams.get('entity') ?? ''
  const actionParam  = searchParams.get('action') ?? ''
  const searchParam  = searchParams.get('search') ?? ''
  const fromParam    = searchParams.get('from') ?? ''
  const toParam      = searchParams.get('to') ?? ''

  const format = formatParam === 'csv' ? 'csv' : 'xlsx'

  // 2. Build filtered Supabase query — same logic as page.tsx
  const supabase = await createClient()

  let query = supabase
    .from('audit_log')
    .select('id, created_at, action, entity_type, entity_id, user_id, old_data, new_data')
    .order('created_at', { ascending: false })
    .limit(MAX_EXPORT_ROWS)
  // Note: NO .is('deleted_at', null) — audit_log has no deleted_at column

  if (entityParam) query = query.eq('entity_type', entityParam)
  if (actionParam) query = query.eq('action', actionParam)
  if (fromParam)   query = query.gte('created_at', fromParam + 'T00:00:00.000Z')
  if (toParam)     query = query.lte('created_at', toParam + 'T23:59:59.999Z')
  if (searchParam) {
    query = query.or(
      `entity_type.ilike.%${searchParam}%,entity_id::text.ilike.%${searchParam}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('[export-audit] Failed to fetch audit_log:', error.message)
    return new Response('Export failed', { status: 500 })
  }

  const rows = data ?? []

  // 3. Resolve user display names — two-step pattern (Pitfall 2)
  const distinctUserIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]

  const userMap = new Map<string, string>()
  if (distinctUserIds.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('auth_user_id, full_name, email')
      .in('auth_user_id', distinctUserIds)

    if (userRows) {
      for (const u of userRows) {
        const displayName = u.full_name ?? u.email ?? u.auth_user_id.substring(0, 8)
        userMap.set(u.auth_user_id, displayName)
      }
    }
  }

  // 4. Build ExcelJS workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ChemoSystem'

  const worksheet = workbook.addWorksheet('יומן פעולות')

  // RTL layout for Hebrew content
  worksheet.views = [{ rightToLeft: true }]

  // Define columns with Hebrew headers
  worksheet.columns = [
    { header: 'תאריך',        key: 'created_at', width: 20 },
    { header: 'משתמש',        key: 'userName',   width: 25 },
    { header: 'פעולה',        key: 'action',     width: 12 },
    { header: 'סוג ישות',     key: 'entity_type',width: 20 },
    { header: 'מזהה ישות',    key: 'entity_id',  width: 38 },
    { header: 'נתונים ישנים', key: 'old_data',   width: 50 },
    { header: 'נתונים חדשים', key: 'new_data',   width: 50 },
  ]

  // Add data rows
  for (const row of rows) {
    worksheet.addRow({
      created_at: new Date(row.created_at).toLocaleString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      userName:    userMap.get(row.user_id) ?? row.user_id?.substring(0, 8) ?? '—',
      action:      row.action,
      entity_type: row.entity_type,
      entity_id:   row.entity_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      old_data:    row.old_data ? JSON.stringify(row.old_data as any) : '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new_data:    row.new_data ? JSON.stringify(row.new_data as any) : '',
    })
  }

  // Bold the header row
  worksheet.getRow(1).font = { bold: true }

  // 5. Generate filename
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const filename = `audit_log_export_${today}.${format}`

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
