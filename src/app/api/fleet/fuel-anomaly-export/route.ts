/**
 * /api/fleet/fuel-anomaly-export — Generate fuel anomaly report Excel file.
 *
 * GET /api/fleet/fuel-anomaly-export?month=2&year=2026
 *
 * Replicates the Liberty Basic CdExt anomaly report:
 *   1. Fetch all fuel records for the month via RPC (enriched with vehicle/driver/project)
 *   2. Detect anomalies:
 *      - Vehicle not in fleet (vehicle_id IS NULL)
 *      - Vehicle not active at fueling date
 *      - Monthly quantity exceeds monthly_fuel_limit_liters
 *   3. Propagate "כן" flag to all rows of a plate that has any anomaly
 *   4. Generate Excel with color-coded rows and cell comments
 *
 * Security: verifySession() — admin-only
 */

import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { formatLicensePlate } from '@/lib/format'
import { FUEL_SUPPLIER_LABELS, FUEL_TYPE_LABELS, HEBREW_MONTHS } from '@/lib/fleet/fuel-types'
import type { FuelAnomalyRawRow } from '@/lib/fleet/fuel-types'

// ─────────────────────────────────────────────────────────────
// Anomaly codes (match Liberty Basic color index mapping)
// ─────────────────────────────────────────────────────────────
const CODE_OK = 0          // green — no anomaly
const CODE_RED = 3         // red + white text — vehicle unknown / inactive
const CODE_QUANTITY = 40   // orange — quantity exceeded

// ─────────────────────────────────────────────────────────────
// Processed row after anomaly detection
// ─────────────────────────────────────────────────────────────
type AnomalyRow = {
  date: string               // dd/mm/yyyy
  supplier: string           // Hebrew label
  licensePlate: string       // raw digits
  hasAnomaly: string         // "כן" or ""
  ownerOrReplacement: string // owner name / "רכב חלופי"
  vehicleInfo: string        // vehicle_group or card info
  makeModel: string          // tozeret + degem
  driverName: string
  employeeNumber: string
  projectName: string
  fuelType: string           // Hebrew label
  quantity: number
  netAmount: number | null
  anomalyDescription: string
  anomalyCode: number
  // For comment tooltip
  fuelingTime: string | null
  stationName: string | null
  grossAmount: number | null
  odometerKm: number | null
  fuelingMethod: string | null
  fuelCardNumber: string | null
  // For limit tracking
  monthlyFuelLimit: number | null
}

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

  if (!month || month < 1 || month > 12) {
    return new Response('Invalid month', { status: 400 })
  }
  if (!year || year < 2020 || year > 2100) {
    return new Response('Invalid year', { status: 400 })
  }

  // 2. Call RPC
  const supabase = await createClient()
  const { data: rawRows, error } = await supabase.rpc('get_fuel_anomaly_report', {
    p_month: month,
    p_year: year,
  })

  if (error) {
    console.error('[fuel-anomaly-export] RPC error:', error.message)
    return new Response('Export failed', { status: 500 })
  }

  const rows = (rawRows ?? []) as FuelAnomalyRawRow[]

  // 3. Process rows + detect anomalies
  const processed = processRows(rows)

  // 4. Generate Excel
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `01/${String(month).padStart(2, '0')}/${year}`
  const endDate = `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  const now = new Date()
  const genDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  const genTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const buffer = await generateExcel(processed, { startDate, endDate, genDate, genTime })

  // 5. Return file
  const monthStr = String(month).padStart(2, '0')
  const filename = `fuel_anomalies_${year}_${monthStr}.xlsx`

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Step 3: Process rows and detect anomalies
// ─────────────────────────────────────────────────────────────

function processRows(raw: FuelAnomalyRawRow[]): AnomalyRow[] {
  // Step 1: Build initial rows with per-row anomalies
  const rows: AnomalyRow[] = raw.map((r) => {
    let anomalyDescription = ''
    let anomalyCode = CODE_OK

    // Anomaly: vehicle not in fleet
    if (!r.vehicle_id) {
      anomalyDescription = 'רכב לא מוכר בצי חמו'
      anomalyCode = CODE_RED
    }
    // Anomaly: vehicle not active at fueling date
    else if (r.vehicle_status && r.vehicle_status !== 'active' && r.vehicle_status !== 'suspended') {
      anomalyDescription = 'רכב לא אקטיבי בזמן התדלוק'
      anomalyCode = CODE_RED
    }

    // Owner/replacement info
    let ownerOrReplacement = ''
    if (!r.vehicle_id) {
      ownerOrReplacement = ''
    } else if (r.original_plate) {
      ownerOrReplacement = 'רכב חלופי'
    } else {
      ownerOrReplacement = r.owner_name ?? ''
    }

    // Vehicle info — overridden by card info later if applicable
    let vehicleInfo = r.vehicle_group ?? ''

    // Card info override (like Liberty Basic: if card, replace vehicle_group with card info)
    if (r.fueling_method === 'card' && r.fuel_card_number) {
      vehicleInfo = `כרטיס    מס' כרטיס: ${r.fuel_card_number}`
    }

    const makeModel = [r.tozeret_nm, r.degem_nm].filter(Boolean).join(' ')

    return {
      date: formatDateDDMMYYYY(r.fueling_date),
      supplier: FUEL_SUPPLIER_LABELS[r.fuel_supplier] ?? r.fuel_supplier,
      licensePlate: r.license_plate,
      hasAnomaly: '',
      ownerOrReplacement,
      vehicleInfo,
      makeModel,
      driverName: r.driver_name ?? '',
      employeeNumber: r.employee_number ?? '',
      projectName: r.project_name ?? '',
      fuelType: FUEL_TYPE_LABELS[r.fuel_type] ?? r.fuel_type,
      quantity: r.quantity_liters,
      netAmount: r.net_amount,
      anomalyDescription,
      anomalyCode,
      fuelingTime: r.fueling_time,
      stationName: r.station_name,
      grossAmount: r.gross_amount,
      odometerKm: r.odometer_km,
      fuelingMethod: r.fueling_method,
      fuelCardNumber: r.fuel_card_number,
      monthlyFuelLimit: r.monthly_fuel_limit,
    }
  })

  // Step 2: Quantity limit check — accumulate per plate, compare to limit
  const plateQuantities = new Map<string, number>()
  for (const row of rows) {
    if (row.monthlyFuelLimit != null && row.monthlyFuelLimit > 0) {
      const prev = plateQuantities.get(row.licensePlate) ?? 0
      const newTotal = prev + row.quantity
      plateQuantities.set(row.licensePlate, newTotal)

      const exceeded = newTotal - row.monthlyFuelLimit
      if (exceeded > 0 && row.anomalyCode === CODE_OK) {
        row.anomalyDescription = `חריגת כמות ${Math.round(exceeded)} ל'`
        row.anomalyCode = CODE_QUANTITY
      }
    }
  }

  // Step 3: Flag propagation — if any row for a plate has anomaly, mark all rows "כן"
  const platesWithAnomalies = new Set<string>()
  for (const row of rows) {
    if (row.anomalyDescription) {
      platesWithAnomalies.add(row.licensePlate)
    }
  }
  for (const row of rows) {
    if (platesWithAnomalies.has(row.licensePlate)) {
      row.hasAnomaly = 'כן'
    }
  }

  return rows
}

// ─────────────────────────────────────────────────────────────
// Excel generation
// ─────────────────────────────────────────────────────────────

type ExcelMeta = {
  startDate: string
  endDate: string
  genDate: string
  genTime: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateExcel(rows: AnomalyRow[], meta: ExcelMeta): Promise<any> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ChemoSystem'

  const ws = workbook.addWorksheet('דוח חריגים דלק')
  ws.views = [{ rightToLeft: true }]

  // Row 2: Title
  ws.mergeCells('G2:O2')
  const titleCell = ws.getCell('G2')
  titleCell.value = `דו"ח חריגים דלק רכבים לתקופה ${meta.startDate} - ${meta.endDate}`
  titleCell.font = { bold: true, size: 13 }

  // Row 5: Generation info
  ws.mergeCells('G5:O5')
  ws.getCell('G5').value = `הופק ע"י: ChemoSystem   ${meta.genDate}  ${meta.genTime}`
  ws.getCell('G5').font = { size: 10, color: { argb: 'FF666666' } }

  // Row 6: Column headers
  const headers = [
    'תאריך',       // B
    'ספק',         // C
    'מספר רישוי',   // D
    'חריגה?',      // E
    'בעלות',       // F
    'פרטי רכב',    // G
    'יצרן / דגם',  // H
    'שם נהג',      // I
    'מס\' עובד',   // J
    'פרויקט',      // K
    'סוג דלק',     // L
    'כמות (ל\')',  // M
    'סכום נטו',    // N
    'תיאור חריגה', // O
  ]

  const headerRow = ws.getRow(6)
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 2) // Start at column B
    cell.value = h
    cell.font = { bold: true, size: 10 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF333333' },
    }
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
  })

  // Column widths (B through O)
  const widths = [12, 8, 14, 8, 14, 22, 18, 18, 12, 20, 10, 10, 12, 26]
  widths.forEach((w, i) => {
    ws.getColumn(i + 2).width = w
  })

  // Data rows starting at row 7
  const GREEN_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFCC' } }
  const RED_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
  const ORANGE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } }
  const WHITE_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, size: 10 }
  const BLACK_FONT: Partial<ExcelJS.Font> = { size: 10 }
  const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const exRow = ws.getRow(7 + i)

    const values = [
      r.date,                           // B
      r.supplier,                       // C
      formatLicensePlate(r.licensePlate), // D
      r.hasAnomaly,                     // E
      r.ownerOrReplacement,             // F
      r.vehicleInfo,                    // G
      r.makeModel,                      // H
      r.driverName,                     // I
      r.employeeNumber,                 // J
      r.projectName,                    // K
      r.fuelType,                       // L
      r.quantity,                       // M
      r.netAmount ?? '',                // N
      r.anomalyDescription,            // O
    ]

    values.forEach((val, ci) => {
      const cell = exRow.getCell(ci + 2) // Start at column B
      cell.value = val as ExcelJS.CellValue
      cell.border = THIN_BORDER
    })

    // Row coloring based on anomaly code
    let fill: ExcelJS.Fill
    let font: Partial<ExcelJS.Font>

    switch (r.anomalyCode) {
      case CODE_RED:
        fill = RED_FILL
        font = WHITE_FONT
        break
      case CODE_QUANTITY:
        fill = ORANGE_FILL
        font = BLACK_FONT
        break
      default:
        fill = GREEN_FILL
        font = BLACK_FONT
    }

    for (let ci = 2; ci <= 15; ci++) {
      const cell = exRow.getCell(ci)
      cell.fill = fill
      cell.font = font
    }

    // Add comment on date cell (column B) with detailed info
    const commentLines = [
      'מידע מפורט:',
      `תאריך תדלוק: ${r.date}`,
      `שעת תדלוק: ${r.fuelingTime ?? ''}`,
      `שם התחנה: ${r.stationName ?? ''}`,
      `עלות תדלוק לפני הנחה: ${r.grossAmount ?? ''} ש'ח`,
      `מונה ק'מ: ${r.odometerKm ?? ''}`,
    ]
    const dateCell = exRow.getCell(2) // Column B
    dateCell.note = {
      texts: [{ text: commentLines.join('\n'), font: { size: 9 } }],
      margins: { insetmode: 'custom', inset: [0.25, 0.25, 0.35, 0.35] },
    }
  }

  // Auto-fit: select cell B7 equivalent (first data cell)
  ws.getCell('B7').value = ws.getCell('B7').value // ensure it exists

  return await workbook.xlsx.writeBuffer()
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatDateDDMMYYYY(dateStr: string): string {
  // Input: yyyy-mm-dd → Output: dd/mm/yyyy
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
