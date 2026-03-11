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
import { normalizePhone, lbSerialToDate } from '@/lib/format'

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
  monthlyFuelLimitAlert: boolean
  serviceIntervalKm: number | null
  serviceIntervalAlert: boolean
  annualKmLimit: number | null
  annualKmLimitAlert: boolean
  // Responsible (f[30] type + f[25] SplitStr for custom)
  campResponsibleType: 'project_manager' | 'other'
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

// lbSerialToDate imported from format.ts — all .top files use Liberty Basic serial dates

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
      const result = lbSerialToDate(serial)
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
      date: dateStr?.trim() ? lbSerialToDate(parseInt(dateStr.trim(), 10)) : null,
      amount: costStr?.trim() ? parseFloat(costStr.trim()) : 0,
    })).filter(c => c.amount > 0)

    // ── SplitStr: Driver history (col 27, step=3) ──
    const driverHistory: ParsedDriverHistoryEntry[] = parseSplitStr(f[27] ?? '', 3).map(([dateStr, companyNum, empNum]) => ({
      date: dateStr?.trim() ? lbSerialToDate(parseInt(dateStr.trim(), 10)) : null,
      companyNum: (companyNum ?? '').trim(),
      empNum: (empNum ?? '').trim(),
    })).filter(d => d.empNum)

    // ── SplitStr: Project assignments (col 34, step=3) ──
    const projectAssignments: ParsedProjectAssignment[] = parseSplitStr(f[34] ?? '', 3).map(([dateStr, projectNum]) => ({
      date: dateStr?.trim() ? lbSerialToDate(parseInt(dateStr.trim(), 10)) : null,
      projectNum: (projectNum ?? '').trim(),
    })).filter(p => p.projectNum)

    // ── SplitStr: Documents (col 37, step=7) ──
    const documents: ParsedVehicleDocument[] = parseSplitStr(f[37] ?? '', 7).map(([name, , , , expiryStr]) => ({
      name: (name ?? '').trim(),
      expiryDate: expiryStr?.trim() ? lbSerialToDate(parseInt(expiryStr.trim(), 10)) : null,
    })).filter(d => d.name)

    // ── SplitStr: Replacement vehicles (col 39, step=8) ──
    const replacementVehicles: ParsedReplacement[] = parseSplitStr(f[39] ?? '', 8).map(([vehNum, entryDateStr, entryKmStr, exitDateStr, exitKmStr, reason, rvNotes, fuelCard]) => ({
      vehNum: (vehNum ?? '').trim(),
      entryDate: entryDateStr?.trim() ? lbSerialToDate(parseInt(entryDateStr.trim(), 10)) : null,
      entryKm: entryKmStr?.trim() ? parseInt(entryKmStr.trim(), 10) : null,
      exitDate: exitDateStr?.trim() ? lbSerialToDate(parseInt(exitDateStr.trim(), 10)) : null,
      exitKm: exitKmStr?.trim() ? parseInt(exitKmStr.trim(), 10) : null,
      reason: (reason ?? '').trim(),
      notes: (rvNotes ?? '').trim(),
      fuelCard: (fuelCard ?? '').trim(),
    })).filter(r => r.vehNum)

    // ── SplitStr: Alert~Value~ pattern (single pair) ──
    // f[23] = הגבלת דלק בליטרים, f[40] = תדירות טיפולים בק"מ, f[48] = הגבלת ק"מ
    function parseAlertValue(fieldIdx: number): { alert: boolean; value: number | null } {
      const entries = parseSplitStr(f[fieldIdx] ?? '', 2)
      if (entries.length === 0) return { alert: false, value: null }
      const [alertStr, valStr] = entries[entries.length - 1]
      const alert = alertStr?.trim() === '1'
      const val = valStr?.trim() ? parseInt(valStr.trim(), 10) : 0
      return { alert, value: val > 0 ? val : null }
    }

    const fuelLimit = parseAlertValue(23)
    const serviceInterval = parseAlertValue(40)
    const kmLimit = parseAlertValue(48)

    // ── Camp responsible: f[30] = type, f[25] = custom name/phone ──
    // f[30]='1' → project_manager (use project's main manager)
    // f[30]='' → custom (take name+phone from f[25] SplitStr: date~Name~Phone~)
    const campResponsibleType = (f[30] ?? '').trim() === '1' ? 'project_manager' : 'other'
    let campResponsibleName: string | null = null
    let campResponsiblePhone: string | null = null
    if (campResponsibleType === 'other') {
      const responsibleEntries = parseSplitStr(f[25] ?? '', 3)
      if (responsibleEntries.length > 0) {
        const last = responsibleEntries[responsibleEntries.length - 1]
        campResponsibleName = (last[1] ?? '').trim() || null
        campResponsiblePhone = normalizePhone((last[2] ?? '').trim())
      }
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
      monthlyFuelLimitLiters: fuelLimit.value,
      monthlyFuelLimitAlert: fuelLimit.alert,
      serviceIntervalKm: serviceInterval.value,
      serviceIntervalAlert: serviceInterval.alert,
      annualKmLimit: kmLimit.value,
      annualKmLimitAlert: kmLimit.alert,
      campResponsibleType,
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

  // ── 2. Separate by mode ──
  const toUpdate = deduped.filter(i => i.mode === 'update' && i.existingVehicleId)
  const toInsert = deduped.filter(i => i.mode === 'insert')

  // Helper: build vehicleData object from parsed record
  function buildVehicleData(parsed: ParsedVehicle) {
    const supplierId = parsed.owner ? (supplierMap.get(parsed.owner) ?? null) : null
    return {
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
      monthly_fuel_limit_alert: parsed.monthlyFuelLimitAlert,
      service_interval_km: parsed.serviceIntervalKm,
      service_interval_alert: parsed.serviceIntervalAlert,
      annual_km_limit: parsed.annualKmLimit,
      annual_km_limit_alert: parsed.annualKmLimitAlert,
      camp_responsible_type: parsed.campResponsibleType,
      camp_responsible_name: parsed.campResponsibleName,
      camp_responsible_phone: parsed.campResponsiblePhone,
      updated_by: userId,
    }
  }

  // ── 3. Soft-delete cleanup (batch — replaces per-vehicle sequential deletes) ──
  const softDeletedIds = toInsert
    .filter(i => i.existingVehicleId)
    .map(i => i.existingVehicleId!)

  if (softDeletedIds.length > 0) {
    // Get all replacement record IDs for fuel card cleanup
    const { data: allRecs } = await admin
      .from('vehicle_replacement_records').select('id').in('vehicle_id', softDeletedIds)
    const allRecIds = allRecs?.map((r: { id: string }) => r.id) ?? []

    await Promise.all([
      admin.from('vehicle_monthly_costs').delete().in('vehicle_id', softDeletedIds),
      admin.from('vehicle_documents').delete().in('vehicle_id', softDeletedIds),
      allRecIds.length > 0
        ? admin.from('vehicle_fuel_cards').delete().in('replacement_record_id', allRecIds)
        : Promise.resolve(),
      admin.from('vehicle_driver_journal').delete().in('vehicle_id', softDeletedIds),
      admin.from('vehicle_project_journal').delete().in('vehicle_id', softDeletedIds),
      admin.from('vehicle_images').delete().in('vehicle_id', softDeletedIds),
    ])
    await admin.from('vehicle_replacement_records').delete().in('vehicle_id', softDeletedIds)
    await admin.from('vehicles').delete().in('id', softDeletedIds)
  }

  // ── 4. Batch INSERT new vehicles (one call instead of N) ──
  const vehicleIdMap = new Map<string, string>() // "plate|contract" → vehicleId

  if (toInsert.length > 0) {
    const insertRows = toInsert.map(i => ({ ...buildVehicleData(i.parsed), created_by: userId }))
    const { data: inserted, error: insertErr } = await admin
      .from('vehicles')
      .insert(insertRows)
      .select('id, license_plate, contract_number')

    if (insertErr) {
      result.errors.push(`הוספת רכבים: ${insertErr.message}`)
    } else {
      for (const v of inserted ?? []) {
        const key = `${v.license_plate}|${v.contract_number ?? ''}`
        vehicleIdMap.set(key, v.id)
      }
      result.vehiclesCreated = inserted?.length ?? 0
    }
  }

  // ── 5. Parallel UPDATE existing vehicles (chunks of 50) ──
  const CHUNK = 50
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const chunk = toUpdate.slice(i, i + CHUNK)
    const updateResults = await Promise.all(
      chunk.map(item =>
        admin.from('vehicles')
          .update(buildVehicleData(item.parsed))
          .eq('id', item.existingVehicleId!)
      )
    )
    for (let j = 0; j < updateResults.length; j++) {
      if (updateResults[j].error) {
        result.errors.push(`עדכון רכב ${chunk[j].parsed.licensePlate}: ${updateResults[j].error!.message}`)
      } else {
        result.vehiclesUpdated++
        const key = `${chunk[j].parsed.licensePlate}|${chunk[j].parsed.contractNumber}`
        vehicleIdMap.set(key, chunk[j].existingVehicleId!)
      }
    }
  }

  // ── 6. Batch delete child records for ALL processed vehicles ──
  // Only delete tables that have data in CarList (preserve manually-added data)
  const idsWithCosts: string[] = []
  const idsWithDocs: string[] = []
  const idsWithDrivers: string[] = []
  const idsWithProjects: string[] = []
  const idsWithReplacements: string[] = []

  for (const item of deduped) {
    const key = `${item.parsed.licensePlate}|${item.parsed.contractNumber}`
    const vid = vehicleIdMap.get(key)
    if (!vid) continue
    if (item.parsed.monthlyCosts.length > 0) idsWithCosts.push(vid)
    if (item.parsed.documents.length > 0) idsWithDocs.push(vid)
    if (item.parsed.driverHistory.length > 0) idsWithDrivers.push(vid)
    if (item.parsed.projectAssignments.length > 0) idsWithProjects.push(vid)
    if (item.parsed.replacementVehicles.length > 0) idsWithReplacements.push(vid)
  }

  // Replacement cleanup: need to delete fuel_cards before replacement_records
  if (idsWithReplacements.length > 0) {
    const { data: existingRecs } = await admin
      .from('vehicle_replacement_records').select('id').in('vehicle_id', idsWithReplacements)
    const recIds = existingRecs?.map((r: { id: string }) => r.id) ?? []
    if (recIds.length > 0) {
      await admin.from('vehicle_fuel_cards').delete().in('replacement_record_id', recIds)
    }
  }

  // Delete all child records in parallel (one call per table instead of per-vehicle)
  await Promise.all([
    idsWithCosts.length > 0
      ? admin.from('vehicle_monthly_costs').delete().in('vehicle_id', idsWithCosts)
      : Promise.resolve(),
    idsWithDocs.length > 0
      ? admin.from('vehicle_documents').delete().in('vehicle_id', idsWithDocs)
      : Promise.resolve(),
    idsWithDrivers.length > 0
      ? admin.from('vehicle_driver_journal').delete().in('vehicle_id', idsWithDrivers)
      : Promise.resolve(),
    idsWithProjects.length > 0
      ? admin.from('vehicle_project_journal').delete().in('vehicle_id', idsWithProjects)
      : Promise.resolve(),
    idsWithReplacements.length > 0
      ? admin.from('vehicle_replacement_records').delete().in('vehicle_id', idsWithReplacements)
      : Promise.resolve(),
  ])

  // ── 7. Build ALL child rows ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCostRows: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allDocRows: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allDriverRows: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allProjectRows: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allReplacementRows: any[] = []
  const allDocNames = new Set<string>()

  type FuelCardPending = { vehicleId: string; plate: string; entryDate: string; fuelCard: string }
  const pendingFuelCards: FuelCardPending[] = []

  for (const item of deduped) {
    const key = `${item.parsed.licensePlate}|${item.parsed.contractNumber}`
    const vehicleId = vehicleIdMap.get(key)
    if (!vehicleId) continue
    const parsed = item.parsed

    // Monthly costs
    for (let i = 0; i < parsed.monthlyCosts.length; i++) {
      const cost = parsed.monthlyCosts[i]
      if (!cost.date) continue
      const endDate = i < parsed.monthlyCosts.length - 1 ? parsed.monthlyCosts[i + 1].date : null
      allCostRows.push({
        vehicle_id: vehicleId, start_date: cost.date, end_date: endDate,
        amount: cost.amount, created_by: userId, updated_by: userId,
      })
    }

    // Documents
    for (const doc of parsed.documents) {
      allDocRows.push({
        vehicle_id: vehicleId, document_name: doc.name, expiry_date: doc.expiryDate,
        alert_enabled: !!doc.expiryDate, created_by: userId, updated_by: userId,
      })
      allDocNames.add(doc.name)
    }

    // Driver journal
    for (let i = 0; i < parsed.driverHistory.length; i++) {
      const entry = parsed.driverHistory[i]
      const driverId = resolveDriverId(entry.empNum, entry.companyNum)
      if (!driverId || !entry.date) continue
      const endDate = i < parsed.driverHistory.length - 1 ? parsed.driverHistory[i + 1].date : null
      allDriverRows.push({
        vehicle_id: vehicleId, driver_id: driverId, start_date: entry.date,
        end_date: endDate, created_by: userId,
      })
    }

    // Project journal
    for (let i = 0; i < parsed.projectAssignments.length; i++) {
      const entry = parsed.projectAssignments[i]
      const projectId = projectLookup.get(entry.projectNum)
      if (!projectId || !entry.date) continue
      const endDate = i < parsed.projectAssignments.length - 1 ? parsed.projectAssignments[i + 1].date : null
      allProjectRows.push({
        vehicle_id: vehicleId, project_id: projectId, start_date: entry.date,
        end_date: endDate, created_by: userId,
      })
    }

    // Replacement vehicles
    for (const rv of parsed.replacementVehicles) {
      if (!rv.entryDate) continue
      allReplacementRows.push({
        vehicle_id: vehicleId, license_plate: rv.vehNum, entry_date: rv.entryDate,
        entry_km: rv.entryKm, return_date: rv.exitDate, return_km: rv.exitKm,
        reason: 'other', reason_other: rv.reason || null,
        status: rv.exitDate ? 'returned' : 'active',
        notes: rv.notes || null, created_by: userId, updated_by: userId,
      })
      if (rv.fuelCard) {
        pendingFuelCards.push({ vehicleId, plate: rv.vehNum, entryDate: rv.entryDate, fuelCard: rv.fuelCard })
      }
    }
  }

  // ── 8. Batch INSERT all child records (6 calls instead of ~11,000) ──
  const [costRes, docRes, drvRes, projRes] = await Promise.all([
    allCostRows.length > 0
      ? admin.from('vehicle_monthly_costs').insert(allCostRows)
      : { error: null },
    allDocRows.length > 0
      ? admin.from('vehicle_documents').insert(allDocRows)
      : { error: null },
    allDriverRows.length > 0
      ? admin.from('vehicle_driver_journal').insert(allDriverRows)
      : { error: null },
    allProjectRows.length > 0
      ? admin.from('vehicle_project_journal').insert(allProjectRows)
      : { error: null },
  ])

  if (!costRes.error) result.monthlyCostsCreated = allCostRows.length
  else result.errors.push(`עלויות: ${costRes.error.message}`)
  if (!docRes.error) result.documentsCreated = allDocRows.length
  else result.errors.push(`מסמכים: ${docRes.error.message}`)
  if (!drvRes.error) result.driverJournalCreated = allDriverRows.length
  else result.errors.push(`יומן נהגים: ${drvRes.error.message}`)
  if (!projRes.error) result.projectJournalCreated = allProjectRows.length
  else result.errors.push(`יומן פרויקטים: ${projRes.error.message}`)

  // Replacement vehicles — need IDs back for fuel cards
  if (allReplacementRows.length > 0) {
    const { data: repData, error: repErr } = await admin
      .from('vehicle_replacement_records')
      .insert(allReplacementRows)
      .select('id, vehicle_id, license_plate, entry_date')

    if (repErr || !repData) {
      result.errors.push(`רכבים חלופיים: ${repErr?.message ?? 'שגיאה'}`)
    } else {
      result.replacementsCreated = repData.length

      // Map fuel cards using composite key
      if (pendingFuelCards.length > 0) {
        const recLookup = new Map<string, string>()
        for (const rec of repData) {
          recLookup.set(`${rec.vehicle_id}|${rec.license_plate}|${rec.entry_date}`, rec.id)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fuelCardRows: any[] = []
        for (const fc of pendingFuelCards) {
          const recId = recLookup.get(`${fc.vehicleId}|${fc.plate}|${fc.entryDate}`)
          if (recId) {
            fuelCardRows.push({ replacement_record_id: recId, card_number: fc.fuelCard, created_by: userId })
          }
        }
        if (fuelCardRows.length > 0) {
          await admin.from('vehicle_fuel_cards').insert(fuelCardRows)
        }
      }
    }
  }

  // ── 9. Document name autocomplete (batch — moved out of per-vehicle loop) ──
  if (allDocNames.size > 0) {
    await Promise.all([...allDocNames].map(name =>
      admin.rpc('increment_vehicle_document_name_usage', { p_name: name })
    ))
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
