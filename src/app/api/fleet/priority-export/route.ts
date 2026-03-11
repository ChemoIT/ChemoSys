/**
 * /api/fleet/priority-export — Generate Priority ERP fuel report Excel file.
 *
 * GET /api/fleet/priority-export?month=1&year=2026&supplier=dalkal
 *
 * Security:
 *   - verifySession() — admin-only (same as other admin exports)
 *
 * Flow:
 *   1. Validate params (month, year, supplier)
 *   2. Call get_priority_fuel_report RPC — returns enriched fuel rows
 *   3. Aggregate in JS: GROUP BY (plate, employee_number, price_per_liter, project, original_plate)
 *   4. Generate Excel with exceljs — exact Priority format (13 columns A-M)
 *   5. Return .xlsx download
 */

import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { FUEL_SUPPLIER_LABELS } from '@/lib/fleet/fuel-types'
import type { PriorityFuelRawRow, PriorityFuelRow } from '@/lib/fleet/fuel-types'

// ─────────────────────────────────────────────────────────────
// Constants — Priority report fixed values
// ─────────────────────────────────────────────────────────────

const PRIORITY_MAKAT = '999004'
const PRIORITY_SPACE3 = '90001'
const PRIORITY_EXPENSE = '931-998'
const PRIORITY_SECTION = '1.800-004'
const CAMP_DRIVER_CODE = '99999'
const ANOMALY_LABEL = "דו''ח חריגים"

// ─────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Auth guard
  try {
    await verifySession()
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const month = parseInt(searchParams.get('month') ?? '', 10)
  const year = parseInt(searchParams.get('year') ?? '', 10)
  const supplier = searchParams.get('supplier') ?? ''

  // Validate params
  if (!month || month < 1 || month > 12) {
    return new Response('Invalid month', { status: 400 })
  }
  if (!year || year < 2020 || year > 2100) {
    return new Response('Invalid year', { status: 400 })
  }
  if (!['delek', 'tapuz', 'dalkal'].includes(supplier)) {
    return new Response('Invalid supplier', { status: 400 })
  }

  // 2. Call RPC
  const supabase = await createClient()
  const { data: rawRows, error } = await supabase.rpc('get_priority_fuel_report', {
    p_month: month,
    p_year: year,
    p_supplier: supplier,
  })

  if (error) {
    console.error('[priority-export] RPC error:', error.message)
    return new Response('Export failed', { status: 500 })
  }

  const rows = (rawRows ?? []) as PriorityFuelRawRow[]

  // 3. Aggregate rows
  const aggregated = aggregateRows(rows)

  // 4. Generate Excel
  const startDate = `01/${String(month).padStart(2, '0')}/${year}`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  const supplierName = FUEL_SUPPLIER_LABELS[supplier] ?? supplier
  const now = new Date()
  const generationDate = formatDateHebrew(now)
  const generationTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  const buffer = await generateExcel(aggregated, {
    supplierName,
    startDate,
    endDate,
    generationDate,
    generationTime,
  })

  // 5. Return file
  const monthStr = String(month).padStart(2, '0')
  const filename = `priority_${supplier}_${year}_${monthStr}.xlsx`

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Aggregation logic
// ─────────────────────────────────────────────────────────────

function aggregateRows(raw: PriorityFuelRawRow[]): PriorityFuelRow[] {
  const map = new Map<string, PriorityFuelRow>()

  for (const row of raw) {
    // Determine employee number
    let employeeNumber: string
    if (row.vehicle_category === null || row.license_plate === null) {
      // Unmatched vehicle — anomaly
      employeeNumber = ANOMALY_LABEL
    } else if (row.vehicle_category === 'camp') {
      employeeNumber = CAMP_DRIVER_CODE
    } else if (row.employee_number) {
      employeeNumber = row.employee_number
    } else {
      // No driver found (assigned vehicle with no journal/fallback)
      employeeNumber = ''
    }

    // Calculate price per liter
    const pricePerLiter =
      row.net_amount != null && row.quantity_liters > 0
        ? Math.round((row.net_amount / row.quantity_liters) * 100) / 100
        : 0

    const originalPlate = row.original_plate ?? ''

    // Project info (camp only)
    const projectNumber = row.vehicle_category === 'camp' ? (row.project_number ?? '') : ''
    const projectName = row.vehicle_category === 'camp' ? (row.project_name ?? '') : ''
    const expenseNumber = row.vehicle_category === 'camp' ? (row.expense_number ?? '') : ''

    // Aggregation key
    const key = [
      row.license_plate,
      employeeNumber,
      pricePerLiter.toFixed(2),
      projectNumber,
      originalPlate,
    ].join('|')

    const existing = map.get(key)
    if (existing) {
      existing.totalQuantity = Math.round((existing.totalQuantity + row.quantity_liters) * 100) / 100
    } else {
      map.set(key, {
        licensePlate: row.license_plate,
        employeeNumber,
        pricePerLiter,
        totalQuantity: row.quantity_liters,
        projectNumber,
        projectName,
        expenseNumber,
        originalPlate,
      })
    }
  }

  return Array.from(map.values())
}

// ─────────────────────────────────────────────────────────────
// Excel generation
// ─────────────────────────────────────────────────────────────

type ExcelMeta = {
  supplierName: string
  startDate: string
  endDate: string
  generationDate: string
  generationTime: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateExcel(rows: PriorityFuelRow[], meta: ExcelMeta): Promise<any> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ChemoSystem'

  const worksheet = workbook.addWorksheet('דוח פריוריטי')
  worksheet.views = [{ rightToLeft: true }]

  // Row 1: Title + supplier
  worksheet.mergeCells('A1:D1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = "דו''ח הוצאה לפריוריטי"
  titleCell.font = { bold: true, size: 14 }

  worksheet.mergeCells('E1:G1')
  worksheet.getCell('E1').value = `ספק: ${meta.supplierName}`
  worksheet.getCell('E1').font = { bold: true, size: 12 }

  // Row 2: Period + generation date + generator
  worksheet.mergeCells('A2:D2')
  worksheet.getCell('A2').value = `תקופת דו''ח: ${meta.startDate} - ${meta.endDate}`

  worksheet.mergeCells('E2:G2')
  worksheet.getCell('E2').value = `תאריך הפקה: ${meta.generationDate} ${meta.generationTime}`

  worksheet.mergeCells('I2:K2')
  worksheet.getCell('I2').value = 'מפיק הדו\'ח: ChemoSystem'

  // Row 3: Column headers
  const headers = [
    'מק"ט',      // A
    'רווח1',     // B — employee_number
    'רווח2',     // C — license_plate
    'רווח3',     // D — constant
    'הוצאה',     // E — constant
    'סעיף',      // F — constant
    'כמות',      // G — total_quantity
    'מחיר',      // H — price_per_liter
    'מס\' פרויקט', // I
    'שם פרויקט',   // J
    'מס\' הוצאה',  // K
    'פרטים',      // L — license_plate
    'מס\' רכב קבוע', // M — original_plate
  ]

  const headerRow = worksheet.getRow(3)
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
  })
  headerRow.font = { bold: true }
  headerRow.alignment = { horizontal: 'center' }

  // Set column widths
  const widths = [10, 18, 14, 10, 12, 14, 10, 10, 16, 22, 14, 14, 16]
  widths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w
  })

  // Row 4+: Data rows
  for (const row of rows) {
    worksheet.addRow([
      PRIORITY_MAKAT,          // A — מק"ט
      row.employeeNumber,      // B — רווח1
      row.licensePlate,        // C — רווח2
      PRIORITY_SPACE3,         // D — רווח3
      PRIORITY_EXPENSE,        // E — הוצאה
      PRIORITY_SECTION,        // F — סעיף
      row.totalQuantity,       // G — כמות
      row.pricePerLiter,       // H — מחיר
      row.projectNumber,       // I — מס' פרויקט
      row.projectName,         // J — שם פרויקט
      row.expenseNumber,       // K — מס' הוצאה
      row.licensePlate,        // L — פרטים
      row.originalPlate,       // M — מס' רכב קבוע
    ])
  }

  return await workbook.xlsx.writeBuffer()
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatDateHebrew(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}
