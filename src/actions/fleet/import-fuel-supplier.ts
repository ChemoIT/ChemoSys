'use server'

/**
 * import-fuel-supplier.ts — Import monthly fuel records from supplier CSV/XLSX files.
 *
 * Supports:
 *   - Delek (CSV, UTF-8) — identified by "מספר אמצעי" header
 *   - Dalkal/Gnergy R1 (XLSX, UTF-8) — early month, quantities only
 *   - Dalkal/Gnergy R2 (CSV, Windows-1255) — final monthly with prices
 *
 * Flow:
 *   1. detectEncoding(buffer, fileName)    — BOM check, fallback to windows-1255
 *   2. parseSupplierFile(buffer, fileName) — detect supplier, map columns, parse rows
 *   3. dryRunSupplierImport(buffer, name)  — match plates, generate report
 *   4. executeSupplierImport(buffer, name) — upsert via RPC
 *
 * Guard: verifySession() — admin only.
 * Uses: service_role client for bulk inserts.
 */

import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { verifySession } from '@/lib/dal'
import {
  DELEK_HEADER_MAP,
  DALKAL_HEADER_MAP,
  DELEK_DEVICE_PREFIX_MAP,
  CARLOG_FUEL_TYPE_MAP,
  type HeaderPattern,
  type SupplierDryRunReport,
  type SupplierImportResult,
  type SupplierImportOptions,
  type SupplierPreviewRecord,
} from '@/lib/fleet/fuel-types'

// ─────────────────────────────────────────────────────────────
// Supabase client (service_role for bulk inserts)
// ─────────────────────────────────────────────────────────────

function createImportClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      db: { schema: 'public' },
    }
  )
}

/** Supabase 1000-row pagination helper */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows(client: any, table: string, select: string): Promise<any[]> {
  const PAGE = 1000
  const all: unknown[] = []
  let offset = 0
  while (true) {
    const { data } = await client.from(table).select(select).range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

/** Supabase 1000-row pagination helper with date range filter */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRowsFiltered(client: any, table: string, select: string, dateCol: string, from: string, to: string): Promise<any[]> {
  const PAGE = 1000
  const all: unknown[] = []
  let offset = 0
  while (true) {
    const { data } = await client.from(table).select(select)
      .gte(dateCol, from).lte(dateCol, to)
      .range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

const BATCH_SIZE = 500
const PARALLEL_CHUNKS = 3

/** Upsert rows via RPC — insert new, update existing (matched by dedup key) */
async function batchUpsert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  table: 'fuel_records' | 'vehicle_km_log',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[],
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const rpcName = table === 'fuel_records' ? 'upsert_fuel_records' : 'upsert_km_records'
  const { data, error } = await client.rpc(rpcName, { p_records: rows })
  if (error) {
    return { inserted: 0, updated: 0, errors: [error.message] }
  }
  const result = Array.isArray(data) ? data[0] : data
  return {
    inserted: Number(result?.inserted ?? 0),
    updated: Number(result?.updated ?? 0),
    errors: [],
  }
}

// ─────────────────────────────────────────────────────────────
// Encoding Detection
// ─────────────────────────────────────────────────────────────

function detectEncoding(buffer: Buffer, fileName: string): 'utf-8' | 'windows-1255' {
  // XLSX = always UTF-8 (ZIP-based)
  if (fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')) {
    return 'utf-8'
  }
  // UTF-8 BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf-8'
  }
  // Check for Windows-1255 Hebrew byte range (0xE0-0xFA = Hebrew letters)
  let hebrewWin1255 = 0
  const checkLen = Math.min(buffer.length, 500)
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] >= 0xE0 && buffer[i] <= 0xFA) hebrewWin1255++
  }
  if (hebrewWin1255 > 5) return 'windows-1255'

  return 'utf-8'
}

function decodeBuffer(buffer: Buffer, encoding: 'utf-8' | 'windows-1255'): string {
  const decoder = new TextDecoder(encoding)
  return decoder.decode(buffer)
}

// ─────────────────────────────────────────────────────────────
// Dynamic Column Detection (adapting employees.ts pattern)
// ─────────────────────────────────────────────────────────────

type ColumnMap = Record<string, number>

function detectColumnsFromHeaders(headers: string[], headerMap: HeaderPattern[]): ColumnMap {
  const colMap: ColumnMap = {}
  const claimed = new Set<number>()

  // Normalize headers: trim whitespace and remove quotes
  const normalized = headers.map(h => h.replace(/^["']|["']$/g, '').trim())

  for (const { field, patterns, exact } of headerMap) {
    for (const pattern of patterns) {
      const idx = normalized.findIndex((h, i) =>
        !claimed.has(i) && (exact ? h === pattern : h.includes(pattern))
      )
      if (idx >= 0) {
        colMap[field] = idx
        claimed.add(idx)
        break
      }
    }
  }
  return colMap
}

// ─────────────────────────────────────────────────────────────
// Supplier Auto-Detection
// ─────────────────────────────────────────────────────────────

function detectSupplier(headers: string[]): 'delek' | 'dalkal' | null {
  const joined = headers.join(' ')
  if (joined.includes('מספר אמצעי')) return 'delek'
  if (joined.includes('קוד חברת דלק')) return 'dalkal'
  return null
}

// ─────────────────────────────────────────────────────────────
// Date/Time Helpers
// ─────────────────────────────────────────────────────────────

/** Parse dd/mm/yyyy or dd/mm/yy → yyyy-mm-dd */
function parseDateDDMMYYYY(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // Support both 4-digit and 2-digit year
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return null
  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  let year = match[3]
  // Convert 2-digit year: 00-49 → 2000s, 50-99 → 1900s
  if (year.length === 2) {
    year = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`
  }
  const iso = `${year}-${month}-${day}`
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  if (d.getFullYear() < 2015 || d.getFullYear() > 2030) return null
  return iso
}

/** Normalize time to HH:MM:SS */
function normalizeTime(raw: string): string | null {
  if (!raw || !raw.includes(':')) return null
  const parts = raw.trim().split(':')
  const h = parts[0].padStart(2, '0')
  const m = parts[1].padStart(2, '0')
  return `${h}:${m}:00`
}

// ─────────────────────────────────────────────────────────────
// Parsed Record Type
// ─────────────────────────────────────────────────────────────

type ParsedSupplierRecord = {
  rowIndex: number
  recordType: 'fuel' | 'km'
  licensePlate: string
  customerName: string | null
  fuelCardNumber: string | null
  date: string | null
  time: string | null
  fuelType: string | null
  fuelSupplier: 'delek' | 'dalkal'
  fuelingMethod: string | null
  stationName: string | null
  quantityLiters: number
  grossAmount: number | null
  netAmount: number | null
  actualFuelCompany: string | null
  odometerKm: number | null
}

// ─────────────────────────────────────────────────────────────
// CSV Parser (handles quoted fields with commas)
// ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  let fieldStart = true // true when at the very start of a new field

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"' && fieldStart) {
        // Only enter quote mode if " is at the start of a field
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
        fieldStart = true
        continue
      } else {
        // Regular character (including mid-field " like בע"מ)
        current += ch
      }
      fieldStart = false
    }
  }
  fields.push(current)
  return fields
}

// ─────────────────────────────────────────────────────────────
// Delek-specific: extract device number and determine method
// ─────────────────────────────────────────────────────────────

function parseDelekDeviceNumber(raw: string): {
  method: string | null
  cardNumber: string | null
} {
  // Strip ="..." wrapping: ="8562000011137323" → 8562000011137323
  let num = raw.trim()
  num = num.replace(/^="?/, '').replace(/"?$/, '')
  num = num.replace(/\D/g, '') // keep digits only

  if (!num || num.length < 3) return { method: null, cardNumber: null }

  const prefix = num.substring(0, 3)
  const config = DELEK_DEVICE_PREFIX_MAP[prefix]
  if (!config) return { method: null, cardNumber: null }

  const cardNumber = config.hasCard ? num.slice(-6) : null
  return { method: config.method, cardNumber }
}

// ─────────────────────────────────────────────────────────────
// Fuel type mapping (supports both codes and Hebrew text)
// ─────────────────────────────────────────────────────────────

function mapFuelType(codeOrText: string): string | null {
  const trimmed = codeOrText.trim()
  // Try direct match first
  if (CARLOG_FUEL_TYPE_MAP[trimmed]) return CARLOG_FUEL_TYPE_MAP[trimmed]
  // Try without leading zero (e.g., "95" → "095")
  const padded = trimmed.padStart(3, '0')
  if (CARLOG_FUEL_TYPE_MAP[padded]) return CARLOG_FUEL_TYPE_MAP[padded]
  // Try extracting from description (e.g., "בנזין דלקנים" → "בנזין")
  if (trimmed.includes('בנזין')) return 'benzine'
  if (trimmed.includes('סולר')) return 'diesel'
  if (trimmed.includes('אוריאה')) return 'urea'
  return null
}

// ─────────────────────────────────────────────────────────────
// Main Parser
// ─────────────────────────────────────────────────────────────

type ParseResult = {
  records: ParsedSupplierRecord[]
  supplier: 'delek' | 'dalkal'
  encoding: string
  parseErrors: string[]
  totalRows: number
  skippedRows: number
  customerWarnings: number
}

async function parseSupplierFile(buffer: Buffer, fileName: string): Promise<ParseResult> {
  const isXlsx = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')
  const encoding = detectEncoding(buffer, fileName)

  let headers: string[] = []
  let dataRows: string[][] = []

  if (isXlsx) {
    // Parse with ExcelJS
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) throw new Error('הקובץ לא מכיל גיליון נתונים')

    const headerRow = worksheet.getRow(1)
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      while (headers.length < colNumber - 1) headers.push('')
      headers.push(String(cell.value ?? '').trim())
    })

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i)
      const cells: string[] = []
      for (let j = 1; j <= headers.length; j++) {
        const val = row.getCell(j).value
        if (val instanceof Date) {
          // Format dates as dd/mm/yyyy
          const d = val.getDate().toString().padStart(2, '0')
          const m = (val.getMonth() + 1).toString().padStart(2, '0')
          const y = val.getFullYear()
          cells.push(`${d}/${m}/${y}`)
        } else {
          cells.push(String(val ?? '').trim())
        }
      }
      dataRows.push(cells)
    }
  } else {
    // Parse CSV
    const text = decodeBuffer(buffer, encoding)
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length === 0) throw new Error('קובץ ריק')

    headers = parseCSVLine(lines[0]).map(h => h.trim())
    for (let i = 1; i < lines.length; i++) {
      dataRows.push(parseCSVLine(lines[i]))
    }
  }

  // Detect supplier
  const supplier = detectSupplier(headers)
  if (!supplier) {
    throw new Error('לא זוהה ספק דלק — הכותרות לא מתאימות לדלק או לדלקל. ודא שהקובץ מכיל את כותרות הספק.')
  }

  // Map columns dynamically
  const headerMap = supplier === 'delek' ? DELEK_HEADER_MAP : DALKAL_HEADER_MAP
  const colMap = detectColumnsFromHeaders(headers, headerMap)

  // Verify critical columns exist
  const requiredFields = ['LICENSE_PLATE', 'FUELING_DATE', 'QUANTITY']
  const missingFields = requiredFields.filter(f => colMap[f] === undefined)
  if (missingFields.length > 0) {
    throw new Error(`עמודות חסרות בקובץ: ${missingFields.join(', ')}. ייתכן שהספק שינה את פורמט הדוח.`)
  }

  // Parse rows
  const records: ParsedSupplierRecord[] = []
  const parseErrors: string[] = []
  let skippedRows = 0
  let customerWarnings = 0

  const getField = (row: string[], field: string): string => {
    const idx = colMap[field]
    if (idx === undefined) return ''
    return (row[idx] ?? '').trim()
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNum = i + 2 // +2 because row 1 is headers, 0-indexed

    // Get license plate
    const licensePlate = getField(row, 'LICENSE_PLATE').replace(/\D/g, '')
    if (!licensePlate) {
      skippedRows++
      continue // Skip summary rows and empty rows
    }

    // Get customer name and validate
    const customerName = getField(row, 'CUSTOMER_NAME')
    if (customerName && !customerName.includes('חמו אהרון')) {
      customerWarnings++
    }

    // Parse date
    const dateRaw = getField(row, 'FUELING_DATE')
    const date = parseDateDDMMYYYY(dateRaw)
    if (!date) {
      skippedRows++
      if (dateRaw) parseErrors.push(`שורה ${rowNum}: תאריך לא תקין (${dateRaw})`)
      continue
    }

    // Parse time
    const timeRaw = getField(row, 'FUELING_TIME')
    const time = normalizeTime(timeRaw)

    // Parse quantity
    const quantityRaw = getField(row, 'QUANTITY').replace(/,/g, '')
    const quantityLiters = parseFloat(quantityRaw) || 0

    // Determine record type
    const odometerRaw = parseInt(getField(row, 'ODOMETER').replace(/,/g, ''), 10)
    const odometerKm = odometerRaw > 0 ? odometerRaw : null
    const isFuelRecord = quantityLiters > 0

    // Skip records with no fuel and no odometer
    if (!isFuelRecord && !odometerKm) {
      skippedRows++
      continue
    }

    // Supplier-specific parsing
    let fuelType: string | null = null
    let fuelingMethod: string | null = null
    let fuelCardNumber: string | null = null
    let grossAmount: number | null = null
    let netAmount: number | null = null
    let stationName: string | null = null
    let actualFuelCompany: string | null = null

    if (supplier === 'delek') {
      // Fuel type from Hebrew text
      const fuelTypeRaw = getField(row, 'FUEL_TYPE')
      fuelType = mapFuelType(fuelTypeRaw)
      if (isFuelRecord && !fuelType) {
        skippedRows++
        parseErrors.push(`שורה ${rowNum}: סוג דלק לא מזוהה (${fuelTypeRaw})`)
        continue
      }

      // Device/card detection
      const deviceRaw = getField(row, 'DEVICE_NUMBER')
      const { method, cardNumber } = parseDelekDeviceNumber(deviceRaw)
      fuelingMethod = method
      fuelCardNumber = cardNumber

      // Amounts
      const grossRaw = getField(row, 'GROSS_AMOUNT').replace(/,/g, '')
      grossAmount = parseFloat(grossRaw) || null
      const netRaw = getField(row, 'NET_AMOUNT').replace(/,/g, '')
      netAmount = parseFloat(netRaw) || null

      // Station
      stationName = getField(row, 'STATION_NAME') || null

    } else {
      // Dalkal/Gnergy
      // Fuel type from code (מק'ט) or description (תאור מק'ט)
      const fuelCode = getField(row, 'FUEL_CODE')
      const fuelDesc = getField(row, 'FUEL_DESC')
      fuelType = mapFuelType(fuelCode) || mapFuelType(fuelDesc)
      if (isFuelRecord && !fuelType) {
        skippedRows++
        parseErrors.push(`שורה ${rowNum}: סוג דלק לא מזוהה (קוד=${fuelCode}, תיאור=${fuelDesc})`)
        continue
      }

      // All dalkal is device, no cards
      fuelingMethod = 'device'

      // Net amount (may be empty in R1)
      const netRaw = getField(row, 'NET_AMOUNT').replace(/,/g, '')
      netAmount = parseFloat(netRaw) || null
      // Dalkal has no gross
      grossAmount = null

      // Station
      stationName = getField(row, 'STATION_NAME') || null

      // Actual fuel company
      actualFuelCompany = getField(row, 'FUEL_COMPANY') || null
    }

    records.push({
      rowIndex: rowNum,
      recordType: isFuelRecord ? 'fuel' : 'km',
      licensePlate,
      customerName,
      fuelCardNumber,
      date,
      time,
      fuelType: isFuelRecord ? fuelType : null,
      fuelSupplier: supplier,
      fuelingMethod: isFuelRecord ? fuelingMethod : null,
      stationName: isFuelRecord ? stationName : null,
      quantityLiters,
      grossAmount: isFuelRecord ? grossAmount : null,
      netAmount: isFuelRecord ? netAmount : null,
      actualFuelCompany: isFuelRecord ? actualFuelCompany : null,
      odometerKm,
    })
  }

  return {
    records,
    supplier,
    encoding,
    parseErrors: parseErrors.slice(0, 50),
    totalRows: dataRows.length,
    skippedRows,
    customerWarnings,
  }
}

// ─────────────────────────────────────────────────────────────
// Dry Run
// ─────────────────────────────────────────────────────────────

export async function dryRunSupplierImport(
  fileBuffer: Buffer,
  fileName: string,
  options: SupplierImportOptions = { skipKm: false, deleteBeforeImport: false },
): Promise<SupplierDryRunReport> {
  await verifySession()
  const admin = createImportClient()

  // 1. Parse file
  const { records, supplier, encoding, parseErrors, totalRows, skippedRows, customerWarnings } =
    await parseSupplierFile(fileBuffer, fileName)

  // 2. Fetch vehicles for plate matching
  const vehicles = await fetchAllRows(admin, 'vehicles', 'id, license_plate')
  const plateToVehicle = new Map<string, string>()
  for (const v of vehicles) {
    plateToVehicle.set(v.license_plate, v.id)
  }

  // 3. Analyze
  const fuelRecords = records.filter(r => r.recordType === 'fuel')
  // km records: odometer-only rows + fuel rows that also have odometer
  const kmRecords = options.skipKm ? [] : records.filter(r =>
    (r.recordType === 'km' && r.odometerKm) ||
    (r.recordType === 'fuel' && r.odometerKm)
  )

  const unmatchedMap = new Map<string, number>()
  let matchedPlates = 0
  let unmatchedPlates = 0

  for (const r of records) {
    if (plateToVehicle.has(r.licensePlate)) {
      matchedPlates++
    } else {
      unmatchedPlates++
      unmatchedMap.set(r.licensePlate, (unmatchedMap.get(r.licensePlate) ?? 0) + 1)
    }
  }

  // 4. Date range
  const dates = records.map(r => r.date).filter(Boolean) as string[]
  dates.sort()
  const dateRange = dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null

  // 5. Fuel type breakdown
  const fuelTypeCounts = new Map<string, number>()
  for (const r of fuelRecords) {
    if (r.fuelType) {
      fuelTypeCounts.set(r.fuelType, (fuelTypeCounts.get(r.fuelType) ?? 0) + 1)
    }
  }

  // 6. Check existing records to determine new vs update counts
  let newFuelRecords = fuelRecords.length
  let updatedFuelRecords = 0
  let newKmRecords = kmRecords.length
  let updatedKmRecords = 0
  let deleteInfo: { existingFuelCount: number; existingKmCount: number } | undefined
  let fuelKeySet: Set<string> | null = null
  let kmKeySet: Set<string> | null = null

  if (dateRange) {
    // Query existing fuel records in the date range for this supplier (paginated)
    const existingFuel = await fetchAllRowsFiltered(
      admin, 'fuel_records',
      'license_plate, fueling_date, fueling_time, quantity_liters, fuel_supplier',
      'fueling_date', dateRange.from, dateRange.to
    )
    // Filter to same supplier for delete-info
    const supplierFuel = existingFuel.filter(
      (r: { fuel_supplier: string }) => r.fuel_supplier === supplier
    )

    // Build dedup key sets for fuel (used in both modes)
    if (existingFuel.length > 0) {
      fuelKeySet = new Set(
        existingFuel.map((r: { license_plate: string; fueling_date: string; fueling_time: string | null }) =>
          `${r.license_plate}|${r.fueling_date}|${r.fueling_time ?? '00:00:00'}`
        )
      )
    }

    if (options.deleteBeforeImport) {
      // In delete mode: all records are "new" (existing will be deleted first)
      const existingKmAll = !options.skipKm ? await fetchAllRowsFiltered(
        admin, 'vehicle_km_log',
        'license_plate, recorded_date, km_reading, source',
        'recorded_date', dateRange.from, dateRange.to
      ) : []
      const supplierKm = existingKmAll.filter(
        (r: { source: string }) => r.source === `${supplier}_import`
      )
      deleteInfo = {
        existingFuelCount: supplierFuel.length,
        existingKmCount: supplierKm.length,
      }
      // All imported records will be new (since existing are deleted)
      newFuelRecords = fuelRecords.length
      updatedFuelRecords = 0
      newKmRecords = kmRecords.length
      updatedKmRecords = 0
    } else {
      // Normal upsert mode: compare dedup keys
      if (fuelKeySet) {
        updatedFuelRecords = fuelRecords.filter(r =>
          fuelKeySet!.has(`${r.licensePlate}|${r.date}|${r.time ?? '00:00:00'}`)
        ).length
        newFuelRecords = fuelRecords.length - updatedFuelRecords
      }

      // Query existing km records in the date range (paginated)
      if (kmRecords.length > 0) {
        const existingKm = await fetchAllRowsFiltered(
          admin, 'vehicle_km_log',
          'license_plate, recorded_date, km_reading',
          'recorded_date', dateRange.from, dateRange.to
        )
        if (existingKm.length > 0) {
          kmKeySet = new Set(
            existingKm.map((r: { license_plate: string; recorded_date: string; km_reading: number }) =>
              `${r.license_plate}|${r.recorded_date}|${r.km_reading}`
            )
          )
          updatedKmRecords = kmRecords.filter(r =>
            kmKeySet!.has(`${r.licensePlate}|${r.date}|${r.odometerKm}`)
          ).length
          newKmRecords = kmRecords.length - updatedKmRecords
        }
      }
    }
  }

  // 7. Build preview records (up to 100 for display)
  const PREVIEW_LIMIT = 100
  const isNewFuel = (r: ParsedSupplierRecord) =>
    options.deleteBeforeImport || !fuelKeySet ||
    !fuelKeySet.has(`${r.licensePlate}|${r.date}|${r.time ?? '00:00:00'}`)
  const isNewKm = (r: ParsedSupplierRecord) =>
    options.deleteBeforeImport || !kmKeySet ||
    !kmKeySet.has(`${r.licensePlate}|${r.date}|${r.odometerKm}`)

  const newRecordsPreview: SupplierPreviewRecord[] = []
  for (const r of fuelRecords) {
    if (newRecordsPreview.length >= PREVIEW_LIMIT) break
    if (!isNewFuel(r)) continue
    newRecordsPreview.push({
      type: 'fuel',
      licensePlate: r.licensePlate,
      date: r.date!,
      time: r.time,
      fuelType: r.fuelType,
      quantityLiters: r.quantityLiters,
      netAmount: r.netAmount,
      odometerKm: r.odometerKm,
      stationName: r.stationName,
      isNew: true,
    })
  }
  for (const r of kmRecords) {
    if (newRecordsPreview.length >= PREVIEW_LIMIT) break
    if (!isNewKm(r)) continue
    newRecordsPreview.push({
      type: 'km',
      licensePlate: r.licensePlate,
      date: r.date!,
      time: r.time,
      fuelType: null,
      quantityLiters: 0,
      netAmount: null,
      odometerKm: r.odometerKm,
      stationName: null,
      isNew: true,
    })
  }

  return {
    fileName,
    detectedSupplier: supplier,
    detectedEncoding: encoding,
    totalRows,
    fuelRecords: fuelRecords.length,
    kmRecords: kmRecords.length,
    skippedRows,
    matchedPlates,
    unmatchedPlates,
    unmatchedDetails: [...unmatchedMap.entries()]
      .map(([licensePlate, count]) => ({ licensePlate, count }))
      .sort((a, b) => b.count - a.count),
    dateRange,
    fuelTypeBreakdown: [...fuelTypeCounts.entries()]
      .map(([fuelType, count]) => ({ fuelType, count }))
      .sort((a, b) => b.count - a.count),
    customerWarnings,
    parseErrors,
    newFuelRecords,
    updatedFuelRecords,
    newKmRecords,
    updatedKmRecords,
    deleteInfo,
    newRecordsPreview,
  }
}

// ─────────────────────────────────────────────────────────────
// Execute Import
// ─────────────────────────────────────────────────────────────

export async function executeSupplierImport(
  fileBuffer: Buffer,
  fileName: string,
  options: SupplierImportOptions = { skipKm: false, deleteBeforeImport: false },
): Promise<SupplierImportResult> {
  const { userId } = await verifySession()
  const admin = createImportClient()

  // 1. Parse
  const { records, supplier } = await parseSupplierFile(fileBuffer, fileName)

  // 2. Fetch vehicles
  const vehicles = await fetchAllRows(admin, 'vehicles', 'id, license_plate')
  const plateToVehicle = new Map<string, string>()
  for (const v of vehicles) {
    plateToVehicle.set(v.license_plate, v.id)
  }

  // 3. Determine source year from date range
  const dates = records.map(r => r.date).filter(Boolean) as string[]
  dates.sort()
  const dateRange = dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null
  const sourceYear = dates.length > 0
    ? parseInt(dates[0].substring(0, 4), 10)
    : new Date().getFullYear()

  // 4. Create import batch
  const { data: batch, error: batchErr } = await admin
    .from('fuel_import_batches')
    .insert({
      source_file: fileName,
      source_year: sourceYear,
      total_lines: records.length,
      status: 'partial',
      created_by: userId,
    })
    .select('id')
    .single()

  if (batchErr || !batch) {
    return {
      success: false,
      fuelInserted: 0, kmInserted: 0, recordsUpdated: 0,
      matchedCount: 0, unmatchedCount: 0,
      errors: [`שגיאה ביצירת batch: ${batchErr?.message ?? 'unknown'}`],
      batchId: null,
    }
  }

  const batchId = batch.id
  let matchedCount = 0
  let unmatchedCount = 0
  let deletedFuelCount = 0
  let deletedKmCount = 0

  // 4b. Delete existing records if requested
  if (options.deleteBeforeImport && dateRange) {
    // Delete fuel records for this supplier in the date range
    const { count: fuelDeleted } = await admin
      .from('fuel_records')
      .delete({ count: 'exact' })
      .eq('fuel_supplier', supplier)
      .gte('fueling_date', dateRange.from)
      .lte('fueling_date', dateRange.to)
    deletedFuelCount = fuelDeleted ?? 0

    // Delete km records from this supplier in the date range
    if (!options.skipKm) {
      const { count: kmDeleted } = await admin
        .from('vehicle_km_log')
        .delete({ count: 'exact' })
        .eq('source', `${supplier}_import`)
        .gte('recorded_date', dateRange.from)
        .lte('recorded_date', dateRange.to)
      deletedKmCount = kmDeleted ?? 0
    }
  }

  // 5. Prepare fuel rows
  const fuelRows = records
    .filter(r => r.recordType === 'fuel')
    .map(r => {
      const vehicleId = plateToVehicle.get(r.licensePlate) ?? null
      if (vehicleId) matchedCount++
      else unmatchedCount++
      return {
        vehicle_id: vehicleId,
        license_plate: r.licensePlate,
        fueling_date: r.date,
        fueling_time: r.time,
        fuel_supplier: r.fuelSupplier,
        fuel_type: r.fuelType,
        fueling_method: r.fuelingMethod,
        fuel_card_number: r.fuelCardNumber,
        quantity_liters: r.quantityLiters,
        station_name: r.stationName,
        gross_amount: r.grossAmount,
        net_amount: r.netAmount,
        actual_fuel_company: r.actualFuelCompany,
        odometer_km: r.odometerKm,
        match_status: vehicleId ? 'matched' : 'unmatched',
        import_batch_id: batchId,
        created_by: userId,
      }
    })

  // 6. Prepare km rows (any record with odometer — both fuel+odometer and odometer-only)
  const kmRows = options.skipKm ? [] : records
    .filter(r => r.odometerKm)
    .map(r => {
      const vehicleId = plateToVehicle.get(r.licensePlate) ?? null
      return {
        vehicle_id: vehicleId,
        license_plate: r.licensePlate,
        recorded_date: r.date,
        km_reading: r.odometerKm,
        source: `${supplier}_import`,
        is_trusted: true,
        match_status: vehicleId ? 'matched' : 'unmatched',
        import_batch_id: batchId,
        created_by: userId,
      }
    })

  // 7. Batch upsert — fuel
  const fuelChunks: typeof fuelRows[] = []
  for (let i = 0; i < fuelRows.length; i += BATCH_SIZE) {
    fuelChunks.push(fuelRows.slice(i, i + BATCH_SIZE))
  }

  const kmChunks: typeof kmRows[] = []
  for (let i = 0; i < kmRows.length; i += BATCH_SIZE) {
    kmChunks.push(kmRows.slice(i, i + BATCH_SIZE))
  }

  let fuelInserted = 0
  let fuelUpdated = 0
  let kmInserted = 0
  let kmUpdated = 0
  const errors: string[] = []

  for (let i = 0; i < fuelChunks.length; i += PARALLEL_CHUNKS) {
    const wave = fuelChunks.slice(i, i + PARALLEL_CHUNKS)
    const results = await Promise.all(
      wave.map(chunk => batchUpsert(admin, 'fuel_records', chunk))
    )
    for (const r of results) {
      fuelInserted += r.inserted
      fuelUpdated += r.updated
      errors.push(...r.errors)
    }
  }

  for (let i = 0; i < kmChunks.length; i += PARALLEL_CHUNKS) {
    const wave = kmChunks.slice(i, i + PARALLEL_CHUNKS)
    const results = await Promise.all(
      wave.map(chunk => batchUpsert(admin, 'vehicle_km_log', chunk))
    )
    for (const r of results) {
      kmInserted += r.inserted
      kmUpdated += r.updated
      errors.push(...r.errors)
    }
  }

  const recordsUpdated = fuelUpdated + kmUpdated

  // 8. Update batch
  await admin
    .from('fuel_import_batches')
    .update({
      fuel_count: fuelInserted,
      km_count: kmInserted,
      matched_count: matchedCount,
      unmatched_count: unmatchedCount,
      skipped_count: records.length - fuelRows.length - kmRows.length,
      updated_count: recordsUpdated,
      status: errors.length > 0 ? 'partial' : 'completed',
    })
    .eq('id', batchId)

  return {
    success: errors.length === 0,
    fuelInserted,
    kmInserted,
    recordsUpdated,
    matchedCount,
    unmatchedCount,
    errors: errors.slice(0, 100),
    batchId,
    deletedFuelCount: deletedFuelCount > 0 ? deletedFuelCount : undefined,
    deletedKmCount: deletedKmCount > 0 ? deletedKmCount : undefined,
  }
}

// ─────────────────────────────────────────────────────────────
// FormData-based Server Actions (for UI)
// ─────────────────────────────────────────────────────────────

export type DryRunSupplierActionResult = {
  success: boolean
  report?: SupplierDryRunReport
  error?: string
}

/** Parse import options from FormData */
function parseOptionsFromFormData(formData: FormData): SupplierImportOptions {
  return {
    skipKm: formData.get('skipKm') === 'true',
    deleteBeforeImport: formData.get('deleteBeforeImport') === 'true',
  }
}

export async function dryRunSupplierImportAction(
  formData: FormData,
): Promise<DryRunSupplierActionResult> {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { success: false, error: 'לא נבחר קובץ' }
    }
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      return { success: false, error: 'יש לבחור קובץ CSV או XLSX' }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const options = parseOptionsFromFormData(formData)
    const report = await dryRunSupplierImport(buffer, file.name, options)
    return { success: true, report }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'שגיאה לא ידועה' }
  }
}

export async function executeSupplierImportAction(
  formData: FormData,
): Promise<SupplierImportResult> {
  const empty: SupplierImportResult = {
    success: false, fuelInserted: 0, kmInserted: 0, recordsUpdated: 0,
    matchedCount: 0, unmatchedCount: 0, errors: [], batchId: null,
  }
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { ...empty, errors: ['לא נבחר קובץ'] }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const options = parseOptionsFromFormData(formData)
    return await executeSupplierImport(buffer, file.name, options)
  } catch (err) {
    return { ...empty, errors: [err instanceof Error ? err.message : 'שגיאה לא ידועה'] }
  }
}
