'use server'

/**
 * import-vehicles.ts — Import vehicles from legacy CarList.top file.
 *
 * Flow:
 *   1. parseCarListFile(buffer) — decode Windows-1255, parse 50 columns + SplitStr
 *   2. dryRunVehicleImport()    — match owners, detect insert/update, generate report
 *   3. executeVehicleImport()   — upsert vehicles + child tables (after approval)
 *
 * Guard: verifySession() — admin only.
 * Uses: createImportClient() — SERVICE_ROLE_KEY bypasses RLS for bulk inserts.
 */

import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/dal'
import { normalizePhone } from '@/lib/format'

function createImportClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ParsedMonthlyCost = { date: string | null; amount: number }
type ParsedDriverHistoryEntry = { date: string | null; companyNum: string; empNum: string }
type ParsedProjectAssignment = { date: string | null; projectNum: string }
type ParsedVehicleDocument = { name: string; expiryDate: string | null }
type ParsedReplacement = {
  vehNum: string
  entryDate: string | null
  entryKm: number | null
  exitDate: string | null
  exitKm: number | null
  reason: string
  notes: string
  fuelCard: string
}

export type ParsedVehicle = {
  rowIndex: number
  licensePlate: string
  vehicleType: string | null
  manufacturer: string
  model: string
  trim: string
  fuelType: string
  yearManufactured: number | null
  contractType: string | null
  owner: string
  vehicleGroup: number | null
  allocationType: string | null
  contractNumber: string
  notes: string | null
  pascalNumber: string
  fleetEntryDate: string | null
  fleetEntryKm: number | null
  fleetExitDate: string | null
  fleetExitKm: number | null
  isActive: boolean
  // Road permissions
  tollRoadPermits: string[]
  weekendHolidayPermit: boolean
  // SplitStr data
  monthlyCosts: ParsedMonthlyCost[]
  driverHistory: ParsedDriverHistoryEntry[]
  projectAssignments: ParsedProjectAssignment[]
  documents: ParsedVehicleDocument[]
  replacementVehicles: ParsedReplacement[]
  monthlyFuelLimitLiters: number | null
  // Responsible (last entry from SplitStr)
  campResponsibleName: string | null
  campResponsiblePhone: string | null
}

export type VehicleDryRunReport = {
  totalRows: number
  skippedRows: {
    deletedFlag: number
    headerRow: number
    emptyPlate: number
  }
  validRows: number
  matched: {
    total: number
    toInsert: number
    toUpdate: number
    activeVehicles: number
    inactiveVehicles: number
  }
  owners: {
    uniqueOwners: string[]
    existingInDb: number
    toCreate: number
  }
  dataRichness: {
    withMonthlyCosts: number
    withDriverHistory: number
    withProjectAssignments: number
    withDocuments: number
    withReplacementVehicles: number
    withNotes: number
    withPascal: number
    withRoadPermissions: number
    withFuelLimit: number
  }
  dataQuality: {
    invalidDates: { plate: string; field: string; rawValue: string }[]
    duplicatePlateContracts: number
  }
  importReady: ImportReadyVehicle[]
}

type ImportReadyVehicle = {
  parsed: ParsedVehicle
  mode: 'insert' | 'update'
  existingVehicleId?: string
  ownerSupplierName: string
}

export type VehicleImportResult = {
  success: boolean
  vehiclesCreated: number
  vehiclesUpdated: number
  monthlyCostsCreated: number
  documentsCreated: number
  replacementsCreated: number
  driverJournalCreated: number
  projectJournalCreated: number
  suppliersCreated: number
  errors: string[]
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

/** Convert Excel serial date to yyyy-mm-dd string */
function serialToDate(serial: number): string | null {
  if (!serial || serial < 1) return null
  const ms = (serial - 25569) * 86400 * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  const year = d.getFullYear()
  if (year < 1990 || year > 2060) return null
  return d.toISOString().split('T')[0]
}

/** Parse SplitStr: tilde-delimited groups of `step` fields */
function parseSplitStr(raw: string, step: number): string[][] {
  if (!raw || raw.trim() === '') return []
  const parts = raw.split('~')
  if (parts[parts.length - 1] === '') parts.pop()
  const result: string[][] = []
  for (let i = 0; i < parts.length; i += step) {
    const group: string[] = []
    for (let j = 0; j < step && (i + j) < parts.length; j++) {
      group.push(parts[i + j] ?? '')
    }
    result.push(group)
  }
  return result
}

// Field mappings
const VEHICLE_TYPE_MAP: Record<string, string> = {
  'פרטי': 'private',
  'מסחרי': 'commercial',
  'משאית': 'truck',
  'נגרר': 'trailer',
}

const OWNERSHIP_TYPE_MAP: Record<string, string> = {
  '1': 'company',
  '2': 'rental',
  '3': 'operational_leasing',
  '4': 'mini_leasing',
}

const ALLOCATION_TYPE_MAP: Record<string, string> = {
  '1': 'assigned',
  '2': 'camp',
}

/** Parse road permissions from col[10] encoded string */
function parseRoadPermissions(str: string): { permits: string[]; weekend: boolean } {
  if (!str || str.trim() === '') return { permits: [], weekend: false }
  const permits: string[] = []
  if (str.includes('1')) permits.push('kvish6')
  if (str.includes('2')) permits.push('hotzefon')
  if (str.includes('3')) permits.push('carmel')
  const weekend = str.includes('W')
  return { permits, weekend }
}

// ─────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────

export type CarListParseResult = {
  parsed: ParsedVehicle[]
  skipped: { deletedFlag: number; headerRow: number; emptyPlate: number }
  invalidDates: { plate: string; field: string; rawValue: string }[]
}

/** Parse CarList.top buffer (Windows-1255 encoded, 50 columns) */
export async function parseCarListFile(buffer: Buffer): Promise<CarListParseResult> {
  const decoder = new TextDecoder('windows-1255')
  const text = decoder.decode(buffer)
  const lines = text.split(/\r?\n/).filter((l) => l.trim())

  const parsed: ParsedVehicle[] = []
  const skipped = { deletedFlag: 0, headerRow: 0, emptyPlate: 0 }
  const invalidDates: CarListParseResult['invalidDates'] = []

  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].split(',')

    // Skip deleted rows (col 46 not empty)
    if (f[46] && f[46].trim() !== '') { skipped.deletedFlag++; continue }

    const plate = (f[5] ?? '').trim()

    // Skip header/metadata rows and end-of-file marker
    if (!plate || plate === 'undefined') { skipped.emptyPlate++; continue }
    if ((f[0] ?? '').trim() === '1213') { skipped.headerRow++; continue }
    if ((f[0] ?? '').includes('<InfoLine>') || (f[0] ?? '').includes('ChemoEndFile')) { skipped.headerRow++; continue }

    // ── Simple fields ──
    const vehicleType = VEHICLE_TYPE_MAP[(f[0] ?? '').trim()] ?? null
    const contractType = OWNERSHIP_TYPE_MAP[(f[11] ?? '').trim()] ?? null
    const allocationType = ALLOCATION_TYPE_MAP[(f[26] ?? '').trim()] ?? null

    const rawGroup = parseInt((f[13] ?? '').trim(), 10)
    const vehicleGroup = (!isNaN(rawGroup) && rawGroup >= 1 && rawGroup <= 7) ? rawGroup : null

    const rawYear = parseInt((f[6] ?? '').trim(), 10)
    const yearManufactured = (!isNaN(rawYear) && rawYear > 1950 && rawYear <= 2030) ? rawYear : null

    // ── Date fields ──
    function parseDateField(fieldIdx: number, fieldName: string): string | null {
      const raw = (f[fieldIdx] ?? '').trim()
      if (!raw) return null
      const serial = parseInt(raw, 10)
      if (isNaN(serial)) return null
      const result = serialToDate(serial)
      if (serial > 0 && !result) {
        invalidDates.push({ plate, field: fieldName, rawValue: raw })
      }
      return result
    }

    const fleetEntryDate = parseDateField(17, 'fleetEntryDate')
    const fleetExitDate = parseDateField(20, 'fleetExitDate')

    const rawEntryKm = parseInt((f[18] ?? '').trim(), 10)
    const rawExitKm = parseInt((f[21] ?? '').trim(), 10)

    // ── Road permissions ──
    const { permits: tollRoadPermits, weekend: weekendHolidayPermit } = parseRoadPermissions((f[10] ?? '').trim())

    // ── Notes ──
    const rawNotes = (f[31] ?? '').trim()
    const notes = rawNotes ? rawNotes.replace(/\^/g, '\n').replace(/~+$/, '').trim() || null : null

    // ── SplitStr: Monthly costs (col 14, step=2) ──
    const monthlyCosts: ParsedMonthlyCost[] = parseSplitStr(f[14] ?? '', 2).map(([dateStr, costStr]) => ({
      date: dateStr?.trim() ? serialToDate(parseInt(dateStr.trim(), 10)) : null,
      amount: costStr?.trim() ? parseFloat(costStr.trim()) : 0,
    })).filter(c => c.amount > 0)

    // ── SplitStr: Driver history (col 27, step=3) ──
    const driverHistory: ParsedDriverHistoryEntry[] = parseSplitStr(f[27] ?? '', 3).map(([dateStr, companyNum, empNum]) => ({
      date: dateStr?.trim() ? serialToDate(parseInt(dateStr.trim(), 10)) : null,
      companyNum: (companyNum ?? '').trim(),
      empNum: (empNum ?? '').trim(),
    })).filter(d => d.empNum)

    // ── SplitStr: Project assignments (col 34, step=3) ──
    const projectAssignments: ParsedProjectAssignment[] = parseSplitStr(f[34] ?? '', 3).map(([dateStr, projectNum]) => ({
      date: dateStr?.trim() ? serialToDate(parseInt(dateStr.trim(), 10)) : null,
      projectNum: (projectNum ?? '').trim(),
    })).filter(p => p.projectNum)

    // ── SplitStr: Documents (col 37, step=7) ──
    const documents: ParsedVehicleDocument[] = parseSplitStr(f[37] ?? '', 7).map(([name, , , , expiryStr]) => ({
      name: (name ?? '').trim(),
      expiryDate: expiryStr?.trim() ? serialToDate(parseInt(expiryStr.trim(), 10)) : null,
    })).filter(d => d.name)

    // ── SplitStr: Replacement vehicles (col 39, step=8) ──
    const replacementVehicles: ParsedReplacement[] = parseSplitStr(f[39] ?? '', 8).map(([vehNum, entryDateStr, entryKmStr, exitDateStr, exitKmStr, reason, rvNotes, fuelCard]) => ({
      vehNum: (vehNum ?? '').trim(),
      entryDate: entryDateStr?.trim() ? serialToDate(parseInt(entryDateStr.trim(), 10)) : null,
      entryKm: entryKmStr?.trim() ? parseInt(entryKmStr.trim(), 10) : null,
      exitDate: exitDateStr?.trim() ? serialToDate(parseInt(exitDateStr.trim(), 10)) : null,
      exitKm: exitKmStr?.trim() ? parseInt(exitKmStr.trim(), 10) : null,
      reason: (reason ?? '').trim(),
      notes: (rvNotes ?? '').trim(),
      fuelCard: (fuelCard ?? '').trim(),
    })).filter(r => r.vehNum)

    // ── SplitStr: Monthly fuel limit (col 23, step=2) — take last non-zero value ──
    const fuelEntries = parseSplitStr(f[23] ?? '', 2)
    let monthlyFuelLimitLiters: number | null = null
    for (const [, maxLiters] of fuelEntries) {
      const val = maxLiters?.trim() ? parseInt(maxLiters.trim(), 10) : 0
      if (val > 0) monthlyFuelLimitLiters = val
    }

    // ── SplitStr: Responsible history (col 25, step=3) — take last entry ──
    const responsibleEntries = parseSplitStr(f[25] ?? '', 3)
    let campResponsibleName: string | null = null
    let campResponsiblePhone: string | null = null
    if (responsibleEntries.length > 0) {
      const last = responsibleEntries[responsibleEntries.length - 1]
      campResponsibleName = (last[1] ?? '').trim() || null
      campResponsiblePhone = normalizePhone((last[2] ?? '').trim())
    }

    const isActive = !f[20] || f[20].trim() === ''

    parsed.push({
      rowIndex: i + 1,
      licensePlate: plate,
      vehicleType,
      manufacturer: (f[1] ?? '').trim(),
      model: (f[2] ?? '').trim(),
      trim: (f[3] ?? '').trim(),
      fuelType: (f[4] ?? '').trim(),
      yearManufactured,
      contractType,
      owner: (f[12] ?? '').trim(),
      vehicleGroup,
      allocationType,
      contractNumber: (f[28] ?? '').trim(),
      notes,
      pascalNumber: (f[33] ?? '').trim(),
      fleetEntryDate,
      fleetEntryKm: !isNaN(rawEntryKm) ? rawEntryKm : null,
      fleetExitDate,
      fleetExitKm: !isNaN(rawExitKm) ? rawExitKm : null,
      isActive,
      tollRoadPermits,
      weekendHolidayPermit,
      monthlyCosts,
      driverHistory,
      projectAssignments,
      documents,
      replacementVehicles,
      monthlyFuelLimitLiters,
      campResponsibleName,
      campResponsiblePhone,
    })
  }

  return { parsed, skipped, invalidDates }
}

// ─────────────────────────────────────────────────────────────
// Dry-Run
// ─────────────────────────────────────────────────────────────

/** Run dry-run: parse file, match existing vehicles, produce report (no writes) */
export async function dryRunVehicleImport(fileBuffer: Buffer): Promise<VehicleDryRunReport> {
  await verifySession()
  const admin = createImportClient()

  // 1. Parse file
  const { parsed, skipped, invalidDates } = await parseCarListFile(fileBuffer)

  // 2. Fetch existing vehicles (including soft-deleted)
  const existingVehicles = await fetchAllRows(admin, 'vehicles', 'id, license_plate, contract_number, deleted_at')

  // Build lookup: "plate|contract" → { id, deletedAt }
  const vehicleLookup = new Map<string, { id: string; deletedAt: string | null }>()
  for (const v of existingVehicles) {
    const key = `${v.license_plate}|${v.contract_number ?? ''}`
    const existing = vehicleLookup.get(key)
    if (!existing || (existing.deletedAt && !v.deleted_at)) {
      vehicleLookup.set(key, { id: v.id, deletedAt: v.deleted_at })
    }
  }

  // 3. Fetch existing ownership suppliers
  const { data: suppliers } = await admin
    .from('vehicle_suppliers')
    .select('id, name')
    .eq('supplier_type', 'ownership')
    .is('deleted_at', null)

  const supplierNames = new Set((suppliers ?? []).map((s: { name: string }) => s.name))

  // 4. Match each parsed vehicle
  const matched: ImportReadyVehicle[] = []
  let toInsert = 0
  let toUpdate = 0
  let activeVehicles = 0
  let inactiveVehicles = 0

  // Collect unique owners
  const ownerNames = new Set<string>()
  // Track plate+contract for duplicate detection
  const seenKeys = new Map<string, number>()
  let duplicatePlateContracts = 0

  for (const p of parsed) {
    if (p.owner) ownerNames.add(p.owner)

    const key = `${p.licensePlate}|${p.contractNumber}`
    const prevCount = seenKeys.get(key) ?? 0
    seenKeys.set(key, prevCount + 1)
    if (prevCount > 0) { duplicatePlateContracts++; continue }

    if (p.isActive) activeVehicles++
    else inactiveVehicles++

    const existing = vehicleLookup.get(key)
    if (existing && !existing.deletedAt) {
      toUpdate++
      matched.push({ parsed: p, mode: 'update', existingVehicleId: existing.id, ownerSupplierName: p.owner })
    } else {
      toInsert++
      matched.push({ parsed: p, mode: 'insert', existingVehicleId: existing?.id, ownerSupplierName: p.owner })
    }
  }

  // Owner stats
  const uniqueOwners = [...ownerNames].filter(Boolean)
  const existingInDb = uniqueOwners.filter(n => supplierNames.has(n)).length
  const toCreate = uniqueOwners.length - existingInDb

  // Data richness
  const dr = {
    withMonthlyCosts: 0, withDriverHistory: 0, withProjectAssignments: 0,
    withDocuments: 0, withReplacementVehicles: 0, withNotes: 0,
    withPascal: 0, withRoadPermissions: 0, withFuelLimit: 0,
  }
  for (const m of matched) {
    if (m.parsed.monthlyCosts.length > 0) dr.withMonthlyCosts++
    if (m.parsed.driverHistory.length > 0) dr.withDriverHistory++
    if (m.parsed.projectAssignments.length > 0) dr.withProjectAssignments++
    if (m.parsed.documents.length > 0) dr.withDocuments++
    if (m.parsed.replacementVehicles.length > 0) dr.withReplacementVehicles++
    if (m.parsed.notes) dr.withNotes++
    if (m.parsed.pascalNumber) dr.withPascal++
    if (m.parsed.tollRoadPermits.length > 0 || m.parsed.weekendHolidayPermit) dr.withRoadPermissions++
    if (m.parsed.monthlyFuelLimitLiters) dr.withFuelLimit++
  }

  return {
    totalRows: parsed.length + skipped.deletedFlag + skipped.headerRow + skipped.emptyPlate,
    skippedRows: skipped,
    validRows: parsed.length,
    matched: { total: matched.length, toInsert, toUpdate, activeVehicles, inactiveVehicles },
    owners: { uniqueOwners, existingInDb, toCreate },
    dataRichness: dr,
    dataQuality: { invalidDates, duplicatePlateContracts },
    importReady: matched,
  }
}

// ─────────────────────────────────────────────────────────────
// Execute Import
// ─────────────────────────────────────────────────────────────

/** Execute the actual import. Must be called after dry-run approval. */
export async function executeVehicleImport(fileBuffer: Buffer): Promise<VehicleImportResult> {
  const { userId } = await verifySession()
  const admin = createImportClient()

  // Parse file once (dry-run already ran on client side — no need to repeat)
  const { parsed: allParsed, skipped } = await parseCarListFile(fileBuffer)

  const result: VehicleImportResult = {
    success: true,
    vehiclesCreated: 0,
    vehiclesUpdated: 0,
    monthlyCostsCreated: 0,
    documentsCreated: 0,
    replacementsCreated: 0,
    driverJournalCreated: 0,
    projectJournalCreated: 0,
    suppliersCreated: 0,
    errors: [],
  }

  // ── 1. Fetch ALL lookup tables in parallel ──
  const [existingVehicles, existingSuppliers, employees, drivers, companiesResult, projects] = await Promise.all([
    fetchAllRows(admin, 'vehicles', 'id, license_plate, contract_number, deleted_at'),
    admin.from('vehicle_suppliers').select('id, name').eq('supplier_type', 'ownership').is('deleted_at', null),
    fetchAllRows(admin, 'employees', 'id, employee_number, company_id'),
    fetchAllRows(admin, 'drivers', 'id, employee_id, deleted_at'),
    admin.from('companies').select('id, internal_number').is('deleted_at', null),
    fetchAllRows(admin, 'projects', 'id, project_number'),
  ])

  // ── Vehicle lookup ──
  const vehicleLookup = new Map<string, { id: string; deletedAt: string | null }>()
  for (const v of existingVehicles) {
    const key = `${v.license_plate}|${v.contract_number ?? ''}`
    const existing = vehicleLookup.get(key)
    if (!existing || (existing.deletedAt && !v.deleted_at)) {
      vehicleLookup.set(key, { id: v.id, deletedAt: v.deleted_at })
    }
  }

  // ── Supplier map ──
  const supplierMap = new Map<string, string>()
  for (const s of existingSuppliers.data ?? []) {
    supplierMap.set(s.name, s.id)
  }

  // Collect unique owners and create missing suppliers (one batch)
  const ownerNames = new Set<string>()
  for (const p of allParsed) { if (p.owner) ownerNames.add(p.owner) }
  const suppliersToCreate = [...ownerNames].filter(n => n && !supplierMap.has(n))
  if (suppliersToCreate.length > 0) {
    const { data: newSuppliers, error: supErr } = await admin
      .from('vehicle_suppliers')
      .insert(suppliersToCreate.map(name => ({ supplier_type: 'ownership', name, is_active: true, created_by: userId })))
      .select('id, name')
    if (supErr) {
      result.errors.push(`יצירת ספקים: ${supErr.message}`)
    } else {
      for (const s of newSuppliers ?? []) {
        supplierMap.set(s.name, s.id)
        result.suppliersCreated++
      }
    }
  }

  // ── Driver lookup ──
  const empToDriver = new Map<string, string>()
  for (const d of drivers) {
    if (d.deleted_at) continue
    empToDriver.set(d.employee_id, d.id)
  }

  const companyCodeToId = new Map<string, string>()
  for (const c of companiesResult.data ?? []) {
    companyCodeToId.set(c.internal_number, c.id)
  }

  const empLookup = new Map<string, string>()
  const empByNumber = new Map<string, string[]>()
  for (const e of employees) {
    empLookup.set(`${e.employee_number}__${e.company_id}`, e.id)
    const list = empByNumber.get(e.employee_number) ?? []
    list.push(e.id)
    empByNumber.set(e.employee_number, list)
  }

  function resolveDriverId(empNum: string, companyNum: string): string | null {
    const companyId = companyCodeToId.get(companyNum)
    let empId: string | undefined
    if (companyId) empId = empLookup.get(`${empNum}__${companyId}`)
    if (!empId) {
      const candidates = empByNumber.get(empNum)
      if (candidates?.length === 1) empId = candidates[0]
    }
    if (!empId) return null
    return empToDriver.get(empId) ?? null
  }

  // ── Project lookup ──
  const projectLookup = new Map<string, string>()
  for (const p of projects) {
    if (p.project_number) projectLookup.set(p.project_number, p.id)
  }

  // ── Deduplicate parsed vehicles ──
  const seenKeys = new Set<string>()
  const deduped: { parsed: ParsedVehicle; mode: 'insert' | 'update'; existingVehicleId?: string }[] = []
  for (const p of allParsed) {
    const key = `${p.licensePlate}|${p.contractNumber}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    const existing = vehicleLookup.get(key)
    if (existing && !existing.deletedAt) {
      deduped.push({ parsed: p, mode: 'update', existingVehicleId: existing.id })
    } else {
      deduped.push({ parsed: p, mode: 'insert', existingVehicleId: existing?.id })
    }
  }

  // ── 2. Process each vehicle ──
  for (const item of deduped) {
    const { parsed, mode, existingVehicleId } = item

    const supplierId = parsed.owner ? (supplierMap.get(parsed.owner) ?? null) : null

    const vehicleData = {
      license_plate: parsed.licensePlate,
      vehicle_type: parsed.vehicleType,
      tozeret_nm: parsed.manufacturer || null,
      degem_nm: parsed.model || null,
      ramat_gimur: parsed.trim || null,
      sug_delek_nm: parsed.fuelType || null,
      shnat_yitzur: parsed.yearManufactured,
      ownership_type: parsed.contractType,
      ownership_supplier_id: supplierId,
      vehicle_group: parsed.vehicleGroup,
      vehicle_category: parsed.allocationType,
      contract_number: parsed.contractNumber || null,
      notes: parsed.notes,
      pascal_number: parsed.pascalNumber || null,
      fleet_entry_date: parsed.fleetEntryDate,
      fleet_entry_km: parsed.fleetEntryKm,
      fleet_exit_date: parsed.fleetExitDate,
      fleet_exit_km: parsed.fleetExitKm,
      is_active: parsed.isActive,
      vehicle_status: parsed.isActive ? 'active' : 'returned',
      toll_road_permits: parsed.tollRoadPermits,
      weekend_holiday_permit: parsed.weekendHolidayPermit,
      monthly_fuel_limit_liters: parsed.monthlyFuelLimitLiters,
      camp_responsible_name: parsed.campResponsibleName,
      camp_responsible_phone: parsed.campResponsiblePhone,
      updated_by: userId,
    }

    let vehicleId: string

    if (mode === 'update' && existingVehicleId) {
      const { error: updateErr } = await admin
        .from('vehicles')
        .update(vehicleData)
        .eq('id', existingVehicleId)

      if (updateErr) {
        result.errors.push(`עדכון רכב ${parsed.licensePlate}: ${updateErr.message}`)
        continue
      }
      result.vehiclesUpdated++
      vehicleId = existingVehicleId

    } else {
      // If soft-deleted exists, hard-delete first — all deletions in parallel
      if (existingVehicleId) {
        // Fuel cards need replacement_record_ids first
        const { data: existingRecs } = await admin
          .from('vehicle_replacement_records').select('id').eq('vehicle_id', existingVehicleId)
        const recIds = existingRecs?.map((r: { id: string }) => r.id) ?? []

        await Promise.all([
          admin.from('vehicle_monthly_costs').delete().eq('vehicle_id', existingVehicleId),
          admin.from('vehicle_documents').delete().eq('vehicle_id', existingVehicleId),
          recIds.length > 0
            ? admin.from('vehicle_fuel_cards').delete().in('replacement_record_id', recIds)
            : Promise.resolve(),
          admin.from('vehicle_driver_journal').delete().eq('vehicle_id', existingVehicleId),
          admin.from('vehicle_project_journal').delete().eq('vehicle_id', existingVehicleId),
          admin.from('vehicle_images').delete().eq('vehicle_id', existingVehicleId),
        ])
        // These must be sequential: replacement_records after fuel_cards, then vehicles
        await admin.from('vehicle_replacement_records').delete().eq('vehicle_id', existingVehicleId)
        await admin.from('vehicles').delete().eq('id', existingVehicleId)
      }

      const { data: vehicleRow, error: vehicleErr } = await admin
        .from('vehicles')
        .insert({ ...vehicleData, created_by: userId })
        .select('id')
        .single()

      if (vehicleErr || !vehicleRow) {
        result.errors.push(`רכב ${parsed.licensePlate}: ${vehicleErr?.message ?? 'שגיאה'}`)
        continue
      }
      result.vehiclesCreated++
      vehicleId = vehicleRow.id
    }

    // ── Child records — batch delete then batch insert ──

    // Build all batch arrays first, then delete+insert per table
    const deletePromises: PromiseLike<unknown>[] = []

    // Monthly costs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const costRows: any[] = []
    if (parsed.monthlyCosts.length > 0) {
      deletePromises.push(admin.from('vehicle_monthly_costs').delete().eq('vehicle_id', vehicleId))
      for (let i = 0; i < parsed.monthlyCosts.length; i++) {
        const cost = parsed.monthlyCosts[i]
        if (!cost.date) continue
        const endDate = i < parsed.monthlyCosts.length - 1 ? parsed.monthlyCosts[i + 1].date : null
        costRows.push({
          vehicle_id: vehicleId, start_date: cost.date, end_date: endDate,
          amount: cost.amount, created_by: userId, updated_by: userId,
        })
      }
    }

    // Documents
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docRows: any[] = []
    const docNames = new Set<string>()
    if (parsed.documents.length > 0) {
      deletePromises.push(admin.from('vehicle_documents').delete().eq('vehicle_id', vehicleId))
      for (const doc of parsed.documents) {
        docRows.push({
          vehicle_id: vehicleId, document_name: doc.name, expiry_date: doc.expiryDate,
          alert_enabled: !!doc.expiryDate, created_by: userId, updated_by: userId,
        })
        docNames.add(doc.name)
      }
    }

    // Driver journal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const driverRows: any[] = []
    if (parsed.driverHistory.length > 0) {
      deletePromises.push(admin.from('vehicle_driver_journal').delete().eq('vehicle_id', vehicleId))
      for (let i = 0; i < parsed.driverHistory.length; i++) {
        const entry = parsed.driverHistory[i]
        const driverId = resolveDriverId(entry.empNum, entry.companyNum)
        if (!driverId || !entry.date) continue
        const endDate = i < parsed.driverHistory.length - 1 ? parsed.driverHistory[i + 1].date : null
        driverRows.push({
          vehicle_id: vehicleId, driver_id: driverId, start_date: entry.date,
          end_date: endDate, created_by: userId,
        })
      }
    }

    // Project journal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectRows: any[] = []
    if (parsed.projectAssignments.length > 0) {
      deletePromises.push(admin.from('vehicle_project_journal').delete().eq('vehicle_id', vehicleId))
      for (let i = 0; i < parsed.projectAssignments.length; i++) {
        const entry = parsed.projectAssignments[i]
        const projectId = projectLookup.get(entry.projectNum)
        if (!projectId || !entry.date) continue
        const endDate = i < parsed.projectAssignments.length - 1 ? parsed.projectAssignments[i + 1].date : null
        projectRows.push({
          vehicle_id: vehicleId, project_id: projectId, start_date: entry.date,
          end_date: endDate, created_by: userId,
        })
      }
    }

    // Replacement vehicles — need IDs back for fuel cards, so handle separately
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const replacementRows: any[] = []
    const replacementFuelCards: { index: number; fuelCard: string }[] = []
    if (parsed.replacementVehicles.length > 0) {
      const { data: existingRecs } = await admin
        .from('vehicle_replacement_records').select('id').eq('vehicle_id', vehicleId)
      if (existingRecs?.length) {
        await admin.from('vehicle_fuel_cards').delete().in('replacement_record_id',
          existingRecs.map((r: { id: string }) => r.id))
      }
      deletePromises.push(admin.from('vehicle_replacement_records').delete().eq('vehicle_id', vehicleId))

      for (const rv of parsed.replacementVehicles) {
        if (!rv.entryDate) continue
        const idx = replacementRows.length
        replacementRows.push({
          vehicle_id: vehicleId, license_plate: rv.vehNum, entry_date: rv.entryDate,
          entry_km: rv.entryKm, return_date: rv.exitDate, return_km: rv.exitKm,
          reason: 'other', reason_other: rv.reason || null,
          status: rv.exitDate ? 'returned' : 'active',
          notes: rv.notes || null, created_by: userId, updated_by: userId,
        })
        if (rv.fuelCard) replacementFuelCards.push({ index: idx, fuelCard: rv.fuelCard })
      }
    }

    // Execute all deletes in parallel
    if (deletePromises.length > 0) await Promise.all(deletePromises)

    // Execute all batch inserts in parallel
    const insertPromises: PromiseLike<void>[] = []

    if (costRows.length > 0) {
      insertPromises.push(
        admin.from('vehicle_monthly_costs').insert(costRows).then(({ error }: { error: unknown }) => {
          if (!error) result.monthlyCostsCreated += costRows.length
          else result.errors.push(`עלויות ${parsed.licensePlate}: ${(error as { message: string }).message}`)
        })
      )
    }

    if (docRows.length > 0) {
      insertPromises.push(
        admin.from('vehicle_documents').insert(docRows).then(({ error }: { error: unknown }) => {
          if (!error) result.documentsCreated += docRows.length
          else result.errors.push(`מסמכים ${parsed.licensePlate}: ${(error as { message: string }).message}`)
        })
      )
    }

    if (driverRows.length > 0) {
      insertPromises.push(
        admin.from('vehicle_driver_journal').insert(driverRows).then(({ error }: { error: unknown }) => {
          if (!error) result.driverJournalCreated += driverRows.length
          else result.errors.push(`נהגים ${parsed.licensePlate}: ${(error as { message: string }).message}`)
        })
      )
    }

    if (projectRows.length > 0) {
      insertPromises.push(
        admin.from('vehicle_project_journal').insert(projectRows).then(({ error }: { error: unknown }) => {
          if (!error) result.projectJournalCreated += projectRows.length
          else result.errors.push(`פרויקטים ${parsed.licensePlate}: ${(error as { message: string }).message}`)
        })
      )
    }

    // Replacement vehicles — need IDs for fuel cards
    if (replacementRows.length > 0) {
      insertPromises.push(
        admin.from('vehicle_replacement_records').insert(replacementRows).select('id').then(async ({ data, error }: { data: { id: string }[] | null; error: unknown }) => {
          if (error || !data) {
            result.errors.push(`חלופיים ${parsed.licensePlate}: ${(error as { message: string })?.message ?? 'שגיאה'}`)
            return
          }
          result.replacementsCreated += data.length
          // Batch insert fuel cards
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fuelCardRows: any[] = []
          for (const fc of replacementFuelCards) {
            if (data[fc.index]) {
              fuelCardRows.push({
                replacement_record_id: data[fc.index].id,
                card_number: fc.fuelCard,
                created_by: userId,
              })
            }
          }
          if (fuelCardRows.length > 0) {
            await admin.from('vehicle_fuel_cards').insert(fuelCardRows)
          }
        })
      )
    }

    // Document name autocomplete — batch unique names
    if (docNames.size > 0) {
      insertPromises.push(
        Promise.all([...docNames].map(name =>
          admin.rpc('increment_vehicle_document_name_usage', { p_name: name })
        )).then(() => {})
      )
    }

    if (insertPromises.length > 0) await Promise.all(insertPromises)
  }

  if (result.errors.length > 0) result.success = false
  return result
}

// ─────────────────────────────────────────────────────────────
// Server Actions for UI (FormData-based)
// ─────────────────────────────────────────────────────────────

export type VehicleDryRunActionResult = {
  success: boolean
  report?: VehicleDryRunReport
  error?: string
}

/** Server Action: dry-run from uploaded file */
export async function dryRunVehicleImportAction(formData: FormData): Promise<VehicleDryRunActionResult> {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { success: false, error: 'לא נבחר קובץ' }
    }
    if (!file.name.toLowerCase().endsWith('.top')) {
      return { success: false, error: 'יש לבחור קובץ .top' }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const report = await dryRunVehicleImport(buffer)
    return { success: true, report }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'שגיאה לא ידועה' }
  }
}

/** Server Action: execute import from uploaded file */
export async function executeVehicleImportAction(formData: FormData): Promise<VehicleImportResult> {
  const empty: VehicleImportResult = {
    success: false, vehiclesCreated: 0, vehiclesUpdated: 0,
    monthlyCostsCreated: 0, documentsCreated: 0, replacementsCreated: 0,
    driverJournalCreated: 0, projectJournalCreated: 0, suppliersCreated: 0, errors: [],
  }
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { ...empty, errors: ['לא נבחר קובץ'] }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    return await executeVehicleImport(buffer)
  } catch (err) {
    return { ...empty, errors: [err instanceof Error ? err.message : 'שגיאה לא ידועה'] }
  }
}
