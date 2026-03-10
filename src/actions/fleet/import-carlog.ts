'use server'

/**
 * import-carlog.ts — Import fuel records & km readings from legacy CarLog.top files.
 *
 * Flow:
 *   1. parseCarLogFile(buffer)     — decode Windows-1255, parse 20 columns
 *   2. dryRunCarLogImport(buffer)  — match plates to vehicles, generate report
 *   3. executeCarLogImport(buffer) — insert into fuel_records & vehicle_km_log (after approval)
 *
 * Guard: verifySession() — admin only.
 * Uses: createImportClient() — bypasses RLS for bulk inserts.
 *
 * CarLog date serial uses 1901-01-01 base (not standard Excel 1900).
 */

import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/dal'
import { lbSerialToDate } from '@/lib/format'
import {
  CARLOG_SUPPLIER_MAP,
  CARLOG_FUEL_TYPE_MAP,
  CARLOG_DEVICE_CODE_MAP,
  CARLOG_SOURCE_MAP,
  type CarLogDryRunReport,
  type CarLogImportResult,
  type FuelImportBatch,
} from '@/lib/fleet/fuel-types'

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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

// lbSerialToDate imported from format.ts — all .top files use Liberty Basic serial dates

/** Normalize time string to HH:MM:SS format */
function normalizeTime(raw: string): string | null {
  if (!raw || !raw.includes(':')) return null
  const parts = raw.split(':')
  const h = parts[0].padStart(2, '0')
  const m = parts[1].padStart(2, '0')
  return `${h}:${m}:00`
}

// ─────────────────────────────────────────────────────────────
// Parsed record type (internal)
// ─────────────────────────────────────────────────────────────

type ParsedCarLogRecord = {
  lineIndex: number
  recordType: 'fuel' | 'km'
  licensePlate: string
  fuelCardNumber: string | null
  date: string | null          // yyyy-mm-dd
  time: string | null          // HH:MM:SS
  deviceCode: string
  fuelType: string | null      // benzine/diesel/urea
  fuelSupplier: string | null  // delek/tapuz/dalkal
  fuelingMethod: string | null // device/card
  stationName: string | null
  quantityLiters: number
  grossAmount: number | null
  netAmount: number | null
  actualFuelCompany: string | null
  odometerKm: number | null
  reportSource: string         // manual/sms/fuel_device/import
}

// ─────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────

function parseCarLogFile(buffer: Buffer): {
  records: ParsedCarLogRecord[]
  parseErrors: string[]
  totalLines: number
  skippedLines: number
} {
  const decoder = new TextDecoder('windows-1255')
  const text = decoder.decode(buffer)
  const lines = text.split(/\r?\n/).filter(l => l.trim())

  const records: ParsedCarLogRecord[] = []
  const parseErrors: string[] = []
  let skippedLines = 0
  let totalLines = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Skip end marker and empty lines
    if (line.includes('ChemoEndFile') || line.includes('<InfoLine>')) {
      continue
    }

    totalLines++
    const f = line.split(',')

    // Must have at least 13 columns (through odometer)
    if (f.length < 13) {
      skippedLines++
      parseErrors.push(`שורה ${i + 1}: פחות מ-13 עמודות (${f.length})`)
      continue
    }

    const licensePlate = (f[0] ?? '').trim()
    if (!licensePlate) {
      skippedLines++
      continue
    }

    // Parse date
    const dateSerial = parseInt((f[3] ?? '').trim(), 10)
    const date = lbSerialToDate(dateSerial)
    if (!date) {
      skippedLines++
      parseErrors.push(`שורה ${i + 1}: תאריך לא תקין (serial=${f[3]})`)
      continue
    }

    // Parse time
    const time = normalizeTime((f[4] ?? '').trim())

    // Determine record type: fuel vs km-only
    const rawQuantity = parseFloat((f[8] ?? '').trim()) || 0
    const isFuelRecord = rawQuantity > 0

    // Parse device code
    const deviceCodeRaw = (f[5] ?? '').trim()
    const fuelingMethod = CARLOG_DEVICE_CODE_MAP[deviceCodeRaw] ?? null

    // Parse fuel type
    const fuelTypeRaw = (f[6] ?? '').trim()
    const fuelType = CARLOG_FUEL_TYPE_MAP[fuelTypeRaw] ?? null

    // Parse fuel supplier (field 2 = f[1])
    const supplierCodeRaw = (f[1] ?? '').trim()
    const fuelSupplier = CARLOG_SUPPLIER_MAP[supplierCodeRaw] ?? null

    // Parse amounts
    const grossAmount = parseFloat((f[9] ?? '').trim()) || null
    const netAmount = parseFloat((f[10] ?? '').trim()) || null

    // Parse odometer
    const odometerRaw = parseInt((f[12] ?? '').trim(), 10)
    const odometerKm = odometerRaw > 0 ? odometerRaw : null

    // Parse fuel card number
    const fuelCardNumber = (f[2] ?? '').trim() || null

    // Parse station name
    const stationName = (f[7] ?? '').trim() || null

    // Parse actual fuel company (field [13])
    const actualFuelCompany = (f[13] ?? '').trim() || null

    // Parse report source (field [19])
    const sourceCodeRaw = (f[19] ?? '').trim()
    const reportSource = CARLOG_SOURCE_MAP[sourceCodeRaw] ?? 'import'

    if (isFuelRecord) {
      // Validate required fields for fuel records
      if (!fuelSupplier) {
        skippedLines++
        parseErrors.push(`שורה ${i + 1}: ספק דלק לא מזוהה (קוד=${supplierCodeRaw})`)
        continue
      }
      if (!fuelType) {
        skippedLines++
        parseErrors.push(`שורה ${i + 1}: סוג דלק לא מזוהה (קוד=${fuelTypeRaw})`)
        continue
      }
    }

    records.push({
      lineIndex: i + 1,
      recordType: isFuelRecord ? 'fuel' : 'km',
      licensePlate,
      fuelCardNumber,
      date,
      time,
      deviceCode: deviceCodeRaw,
      fuelType: isFuelRecord ? fuelType : null,
      fuelSupplier: isFuelRecord ? fuelSupplier : null,
      fuelingMethod: isFuelRecord ? fuelingMethod : null,
      stationName: isFuelRecord ? stationName : null,
      quantityLiters: rawQuantity,
      grossAmount: isFuelRecord ? grossAmount : null,
      netAmount: isFuelRecord ? netAmount : null,
      actualFuelCompany: isFuelRecord ? actualFuelCompany : null,
      odometerKm,
      reportSource,
    })
  }

  return { records, parseErrors, totalLines, skippedLines }
}

// ─────────────────────────────────────────────────────────────
// Dry Run
// ─────────────────────────────────────────────────────────────

export async function dryRunCarLogImport(fileBuffer: Buffer, fileName: string): Promise<CarLogDryRunReport> {
  await verifySession()
  const admin = createImportClient()

  // 1. Parse file
  const { records, parseErrors, totalLines, skippedLines } = parseCarLogFile(fileBuffer)

  // 2. Fetch all vehicles for plate matching
  const vehicles = await fetchAllRows(admin, 'vehicles', 'id, license_plate')
  const plateToVehicle = new Map<string, string>()
  for (const v of vehicles) {
    plateToVehicle.set(v.license_plate, v.id)
  }

  // 3. Analyze matching
  const fuelRecords = records.filter(r => r.recordType === 'fuel')
  const kmRecords = records.filter(r => r.recordType === 'km')

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
  const dateRange = dates.length > 0
    ? { from: dates[0], to: dates[dates.length - 1] }
    : null

  // 5. Supplier breakdown (fuel records only)
  const supplierCounts = new Map<string, number>()
  for (const r of fuelRecords) {
    if (r.fuelSupplier) {
      supplierCounts.set(r.fuelSupplier, (supplierCounts.get(r.fuelSupplier) ?? 0) + 1)
    }
  }

  // 6. Fuel type breakdown
  const fuelTypeCounts = new Map<string, number>()
  for (const r of fuelRecords) {
    if (r.fuelType) {
      fuelTypeCounts.set(r.fuelType, (fuelTypeCounts.get(r.fuelType) ?? 0) + 1)
    }
  }

  return {
    fileName,
    totalLines,
    fuelRecords: fuelRecords.length,
    kmRecords: kmRecords.length,
    skippedLines,
    matchedPlates,
    unmatchedPlates,
    unmatchedDetails: [...unmatchedMap.entries()]
      .map(([licensePlate, count]) => ({ licensePlate, count }))
      .sort((a, b) => b.count - a.count),
    dateRange,
    supplierBreakdown: [...supplierCounts.entries()]
      .map(([supplier, count]) => ({ supplier, count }))
      .sort((a, b) => b.count - a.count),
    fuelTypeBreakdown: [...fuelTypeCounts.entries()]
      .map(([fuelType, count]) => ({ fuelType, count }))
      .sort((a, b) => b.count - a.count),
    parseErrors: parseErrors.slice(0, 50), // limit to 50
  }
}

// ─────────────────────────────────────────────────────────────
// Execute Import (optimized — batch insert + parallel chunks)
// ─────────────────────────────────────────────────────────────

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
  const paramName = 'p_records'

  const { data, error } = await client.rpc(rpcName, { [paramName]: rows })

  if (error) {
    return { inserted: 0, updated: 0, errors: [error.message] }
  }

  // RPC returns a single row: { inserted, updated }
  const result = Array.isArray(data) ? data[0] : data
  return {
    inserted: Number(result?.inserted ?? 0),
    updated: Number(result?.updated ?? 0),
    errors: [],
  }
}

export async function executeCarLogImport(fileBuffer: Buffer, fileName: string): Promise<CarLogImportResult> {
  const { userId } = await verifySession()
  const admin = createImportClient()

  // 1. Parse
  const { records } = parseCarLogFile(fileBuffer)

  // 2. Fetch vehicles
  const vehicles = await fetchAllRows(admin, 'vehicles', 'id, license_plate')
  const plateToVehicle = new Map<string, string>()
  for (const v of vehicles) {
    plateToVehicle.set(v.license_plate, v.id)
  }

  // 3. Extract source year from filename (e.g. CarLog2026.top → 2026)
  const yearMatch = fileName.match(/(\d{4})/)
  const sourceYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear()

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
      fuelInserted: 0,
      kmInserted: 0,
      recordsUpdated: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      errors: [`שגיאה ביצירת batch: ${batchErr?.message ?? 'unknown'}`],
      batchId: null,
    }
  }

  const batchId = batch.id
  let matchedCount = 0
  let unmatchedCount = 0

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

  // 6. Prepare km rows — km-only records + fuel records that have odometer
  const kmRows = records
    .filter(r => r.odometerKm && (r.recordType === 'km' || r.recordType === 'fuel'))
    .map(r => {
      const vehicleId = plateToVehicle.get(r.licensePlate) ?? null
      return {
        vehicle_id: vehicleId,
        license_plate: r.licensePlate,
        recorded_date: r.date,
        km_reading: r.odometerKm,
        source: r.recordType === 'fuel' ? 'fuel_device' : (r.reportSource || 'import'),
        is_trusted: true,
        match_status: vehicleId ? 'matched' : 'unmatched',
        import_batch_id: batchId,
        created_by: userId,
      }
    })

  // 7. Deduplicate km rows — same plate+date+reading can appear from both fuel and km-only records
  const kmDedup = new Map<string, typeof kmRows[0]>()
  for (const row of kmRows) {
    const key = `${row.license_plate}|${row.recorded_date}|${row.km_reading}`
    const existing = kmDedup.get(key)
    // Prefer fuel_device source over others (more reliable)
    if (!existing || row.source === 'fuel_device') {
      kmDedup.set(key, row)
    }
  }
  const kmRowsDeduped = [...kmDedup.values()]

  // 8. Split into chunks
  const fuelChunks: typeof fuelRows[] = []
  for (let i = 0; i < fuelRows.length; i += BATCH_SIZE) {
    fuelChunks.push(fuelRows.slice(i, i + BATCH_SIZE))
  }
  const kmChunks: typeof kmRowsDeduped[] = []
  for (let i = 0; i < kmRowsDeduped.length; i += BATCH_SIZE) {
    kmChunks.push(kmRowsDeduped.slice(i, i + BATCH_SIZE))
  }

  let fuelInserted = 0
  let fuelUpdated = 0
  let kmInserted = 0
  let kmUpdated = 0
  const errors: string[] = []

  // 8. Upsert fuel — parallel chunks (PARALLEL_CHUNKS at a time)
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

  // 9. Upsert km — parallel chunks (PARALLEL_CHUNKS at a time)
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

  // 10. Update batch with final counts
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
  }
}

// ─────────────────────────────────────────────────────────────
// Server Actions for UI (FormData-based)
// ─────────────────────────────────────────────────────────────

export type DryRunCarLogActionResult = {
  success: boolean
  report?: CarLogDryRunReport
  error?: string
}

export async function dryRunCarLogImportAction(formData: FormData): Promise<DryRunCarLogActionResult> {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { success: false, error: 'לא נבחר קובץ' }
    }
    if (!file.name.toLowerCase().endsWith('.top')) {
      return { success: false, error: 'יש לבחור קובץ .top' }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const report = await dryRunCarLogImport(buffer, file.name)
    return { success: true, report }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'שגיאה לא ידועה' }
  }
}

export async function executeCarLogImportAction(formData: FormData): Promise<CarLogImportResult> {
  const empty: CarLogImportResult = {
    success: false, fuelInserted: 0, kmInserted: 0, recordsUpdated: 0,
    matchedCount: 0, unmatchedCount: 0, errors: [], batchId: null,
  }
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { ...empty, errors: ['לא נבחר קובץ'] }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    return await executeCarLogImport(buffer, file.name)
  } catch (err) {
    return { ...empty, errors: [err instanceof Error ? err.message : 'שגיאה לא ידועה'] }
  }
}

// ─────────────────────────────────────────────────────────────
// Fetch import batches for history display
// ─────────────────────────────────────────────────────────────

export async function getCarLogImportBatches(): Promise<FuelImportBatch[]> {
  await verifySession()
  const admin = createImportClient()

  const { data, error } = await admin
    .from('fuel_import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !data) return []

  return data.map((b: Record<string, unknown>) => ({
    id: b.id as string,
    sourceFile: b.source_file as string,
    sourceYear: b.source_year as number,
    totalLines: b.total_lines as number | null,
    fuelCount: b.fuel_count as number | null,
    kmCount: b.km_count as number | null,
    matchedCount: b.matched_count as number | null,
    unmatchedCount: b.unmatched_count as number | null,
    skippedCount: b.skipped_count as number | null,
    updatedCount: b.updated_count as number | null,
    status: b.status as string | null,
    createdAt: b.created_at as string,
  }))
}

// FuelImportBatch type is imported from '@/lib/fleet/fuel-types' directly
