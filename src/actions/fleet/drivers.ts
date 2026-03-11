'use server'

/**
 * fleet/drivers.ts — Server Actions for Fleet Driver Card module.
 *
 * Guard: ALL actions start with verifyAppUser() — ChemoSys employee-facing app.
 * Pattern: verifyAppUser -> validate -> mutate DB -> revalidate
 *
 * Key behaviours:
 *   - A driver card can only be created for an ACTIVE employee without an existing card.
 *   - phone_override: if set, wins over employees.mobile_phone in all display contexts.
 *     Excel bulk import (bulk_upsert_employees RPC) must NOT overwrite phone_override.
 *   - Driver status (active/inactive) is computed — not stored.
 *     See driver_computed_status view in migration 00018.
 *   - Soft-delete: drivers, driver_documents, driver_violations use deleted_at.
 *     driver_licenses are hard-deleted (no soft-delete needed — only one per driver).
 *   - document_name autocomplete: every new name is upserted into driver_document_names.
 *   - Fitness status (rמzor) is computed client-side by FitnessLight using
 *     expiry dates and threshold values from .env.local (FLEET_*_DAYS).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { verifyAppUser } from '@/lib/dal'
import { normalizePhone } from '@/lib/format'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type DriverListItem = {
  id: string
  employeeId: string
  fullName: string
  employeeNumber: string
  companyName: string
  isOccasionalCampDriver: boolean
  isEquipmentOperator: boolean
  computedStatus: 'active' | 'inactive'
  licenseExpiryDate: string | null
  hasDocuments: boolean
  // returned for FitnessLight to compute color client-side
  documentMinExpiry: string | null  // nearest upcoming expiry across all documents
  openedAt: string
}

export type DriverFull = {
  // driver record
  id: string
  employeeId: string
  phoneOverride: string | null
  isOccasionalCampDriver: boolean
  isEquipmentOperator: boolean
  openedAt: string
  notes: string | null
  // employee data (read-only display)
  fullName: string
  employeeNumber: string
  companyName: string
  companyId: string
  startDate: string | null
  citizenship: string | null
  idNumber: string | null
  passportNumber: string | null
  dateOfBirth: string | null
  street: string | null
  houseNumber: string | null
  city: string | null
  employeePhone: string | null   // employees.mobile_phone (may be overridden)
  effectivePhone: string | null  // phone_override ?? employeePhone
  // computed status
  computedStatus: 'active' | 'inactive'
}

export type DriverLicense = {
  id: string
  driverId: string
  licenseNumber: string | null
  licenseCategories: string[]
  categoryIssueYears: Record<string, number>  // e.g. {"B": 2005, "C1": 2010}
  expiryDate: string | null
  frontImageUrl: string | null
  backImageUrl: string | null
}

export type DriverDocument = {
  id: string
  driverId: string
  documentName: string
  fileUrl: string | null
  expiryDate: string | null
  alertEnabled: boolean
  notes: string | null
  createdAt: string
}

export type DriverViolation = {
  id: string
  driverId: string
  violationNumber: string | null
  violationDate: string | null
  violationType: 'traffic' | 'parking' | 'accident' | null
  vehicleNumber: string | null
  location: string | null
  points: number
  amount: number | null
  description: string | null
  notes: string | null
  fileUrl: string | null
  createdAt: string
}

export type ActionResult = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

// ─────────────────────────────────────────────────────────────
// DRIVER LIST
// ─────────────────────────────────────────────────────────────

/**
 * Returns all driver cards with computed status and nearest expiry dates.
 * Used by the drivers list page.
 */
export async function getDriversList(): Promise<DriverListItem[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('drivers')
    .select(`
      id,
      employee_id,
      is_occasional_camp_driver,
      is_equipment_operator,
      opened_at,
      employees!inner (
        first_name,
        last_name,
        employee_number,
        status,
        deleted_at,
        companies ( name )
      ),
      driver_licenses ( expiry_date ),
      driver_documents ( expiry_date )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const emp = (row.employees as unknown) as {
      first_name: string
      last_name: string
      employee_number: string
      status: string
      deleted_at: string | null
      companies: { name: string } | null
    }

    const isEmpActive = emp.status === 'active' && emp.deleted_at === null
    const computedStatus: 'active' | 'inactive' =
      isEmpActive && (row.is_occasional_camp_driver || row.is_equipment_operator)
        ? 'active'
        : 'inactive'

    const licenses = (row.driver_licenses ?? []) as { expiry_date: string | null }[]
    const docs = (row.driver_documents ?? []) as { expiry_date: string | null }[]

    // Nearest document expiry (for fitness light)
    const docExpiries = docs
      .map((d) => d.expiry_date)
      .filter(Boolean) as string[]
    const documentMinExpiry = docExpiries.sort()[0] ?? null

    return {
      id: row.id,
      employeeId: row.employee_id,
      fullName: `${emp.first_name} ${emp.last_name}`,
      employeeNumber: emp.employee_number,
      companyName: emp.companies?.name ?? '',
      isOccasionalCampDriver: row.is_occasional_camp_driver,
      isEquipmentOperator: row.is_equipment_operator,
      computedStatus,
      licenseExpiryDate: licenses[0]?.expiry_date ?? null,
      hasDocuments: docs.length > 0,
      documentMinExpiry,
      openedAt: row.opened_at,
    }
  })
}

// ─────────────────────────────────────────────────────────────
// DRIVER FULL (card)
// ─────────────────────────────────────────────────────────────

/** Returns full driver data including joined employee fields. */
export async function getDriverById(driverId: string): Promise<DriverFull | null> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('drivers')
    .select(`
      id,
      employee_id,
      phone_override,
      is_occasional_camp_driver,
      is_equipment_operator,
      opened_at,
      notes,
      employees!inner (
        first_name,
        last_name,
        employee_number,
        status,
        deleted_at,
        start_date,
        citizenship,
        id_number,
        passport_number,
        date_of_birth,
        street,
        house_number,
        city,
        mobile_phone,
        companies ( id, name )
      )
    `)
    .eq('id', driverId)
    .is('deleted_at', null)
    .single()

  if (error || !data) return null

  const emp = (data.employees as unknown) as {
    first_name: string
    last_name: string
    employee_number: string
    status: string
    deleted_at: string | null
    start_date: string | null
    citizenship: string | null
    id_number: string | null
    passport_number: string | null
    date_of_birth: string | null
    street: string | null
    house_number: string | null
    city: string | null
    mobile_phone: string | null
    companies: { id: string; name: string } | null
  }

  const isEmpActive = emp.status === 'active' && emp.deleted_at === null
  const computedStatus: 'active' | 'inactive' =
    isEmpActive && (data.is_occasional_camp_driver || data.is_equipment_operator)
      ? 'active'
      : 'inactive'

  return {
    id: data.id,
    employeeId: data.employee_id,
    phoneOverride: data.phone_override,
    isOccasionalCampDriver: data.is_occasional_camp_driver,
    isEquipmentOperator: data.is_equipment_operator,
    openedAt: data.opened_at,
    notes: data.notes,
    fullName: `${emp.first_name} ${emp.last_name}`,
    employeeNumber: emp.employee_number,
    companyName: emp.companies?.name ?? '',
    companyId: emp.companies?.id ?? '',
    startDate: emp.start_date,
    citizenship: emp.citizenship,
    idNumber: emp.id_number,
    passportNumber: emp.passport_number,
    dateOfBirth: emp.date_of_birth,
    street: emp.street,
    houseNumber: emp.house_number,
    city: emp.city,
    employeePhone: emp.mobile_phone,
    effectivePhone: data.phone_override ?? emp.mobile_phone,
    computedStatus,
  }
}

// ─────────────────────────────────────────────────────────────
// ACTIVE EMPLOYEES WITHOUT A DRIVER CARD
// ─────────────────────────────────────────────────────────────

export type EmployeeOption = {
  id: string
  fullName: string
  employeeNumber: string
  companyName: string
}

/**
 * Returns active employees who do NOT yet have a driver card.
 * Used by AddDriverDialog to populate the employee search/select.
 */
export async function getActiveEmployeesWithoutDriver(): Promise<EmployeeOption[]> {
  await verifyAppUser()
  const supabase = await createClient()

  // IRON RULE: fetchAllRows — Supabase 1000-row limit
  const { fetchAllRows } = await import('@/lib/supabase/fetch-all')

  // Fetch all active employees
  const employees = await fetchAllRows<{ id: string; first_name: string; last_name: string; employee_number: string; companies: { name: string } | null }>(
    supabase, 'employees',
    'id, first_name, last_name, employee_number, companies ( name )', {
    filters: (q: any) => q.eq('status', 'active').is('deleted_at', null),
    order: { column: 'last_name', ascending: true },
  })

  // Fetch employee IDs that already have a driver card
  const drivers = await fetchAllRows(supabase, 'drivers', 'employee_id', {
    filters: (q: any) => q.is('deleted_at', null),
  })

  const driverEmployeeIds = new Set(drivers.map((d: any) => d.employee_id))

  return employees
    .filter((e) => !driverEmployeeIds.has(e.id))
    .map((e) => ({
      id: e.id,
      fullName: `${e.first_name} ${e.last_name}`,
      employeeNumber: e.employee_number,
      companyName: e.companies?.name ?? '',
    }))
}

// ─────────────────────────────────────────────────────────────
// CREATE DRIVER
// ─────────────────────────────────────────────────────────────

export async function createDriver(employeeId: string): Promise<ActionResult & { driverId?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Guard: employee must be active
  const { data: emp } = await supabase
    .from('employees')
    .select('id, status, deleted_at')
    .eq('id', employeeId)
    .single()

  if (!emp || emp.status !== 'active' || emp.deleted_at) {
    return { success: false, error: 'לא ניתן לפתוח כרטיס נהג לעובד שאינו פעיל' }
  }

  // Guard: no existing driver card
  const { data: existing } = await supabase
    .from('drivers')
    .select('id')
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'לעובד זה כבר קיים כרטיס נהג' }
  }

  const { data: driver, error } = await supabase
    .from('drivers')
    .insert({ employee_id: employeeId, created_by: userId, updated_by: userId })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה ביצירת כרטיס הנהג' }

  revalidatePath('/app/fleet/drivers')
  return { success: true, driverId: driver.id }
}

// ─────────────────────────────────────────────────────────────
// UPDATE DRIVER FLAGS
// ─────────────────────────────────────────────────────────────

export async function updateDriverFlags(
  driverId: string,
  flags: { isOccasionalCampDriver: boolean; isEquipmentOperator: boolean }
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('drivers')
    .update({
      is_occasional_camp_driver: flags.isOccasionalCampDriver,
      is_equipment_operator: flags.isEquipmentOperator,
      updated_by: userId,
    })
    .eq('id', driverId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'שגיאה בעדכון' }

  revalidatePath(`/app/fleet/driver-card/${driverId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UPDATE DRIVER PHONE OVERRIDE
// ─────────────────────────────────────────────────────────────

/**
 * Sets phone_override on the driver card.
 * Pass null to clear the override and revert to employee phone.
 */
export async function updateDriverPhone(
  driverId: string,
  phone: string | null
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('drivers')
    .update({ phone_override: phone || null, updated_by: userId })
    .eq('id', driverId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'שגיאה בעדכון הטלפון' }

  revalidatePath(`/app/fleet/driver-card/${driverId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UPDATE DRIVER NOTES
// ─────────────────────────────────────────────────────────────

export async function updateDriverNotes(driverId: string, notes: string): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('drivers')
    .update({ notes: notes || null, updated_by: userId })
    .eq('id', driverId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'שגיאה בעדכון הערות' }

  revalidatePath(`/app/fleet/driver-card/${driverId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// SOFT DELETE DRIVER
// ─────────────────────────────────────────────────────────────

export async function softDeleteDriver(driverId: string): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Must use RPC — direct .update({ deleted_at }) fails due to PostgREST + RLS interaction
  const { error } = await supabase.rpc('soft_delete_driver', {
    p_id: driverId,
    p_user_id: userId,
  })

  if (error) return { success: false, error: 'שגיאה במחיקת כרטיס הנהג' }

  revalidatePath('/app/fleet/drivers')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DELETE DRIVER WITH ADMIN PASSWORD
// ─────────────────────────────────────────────────────────────

/**
 * Verifies the admin delete password then soft-deletes the driver card.
 * Password is compared server-side against FLEET_ADMIN_PASSWORD in .env.local.
 * SECURITY: verifyAppUser() + env-based password — never exposed to client.
 */
export async function deleteDriverWithPassword(
  driverId: string,
  password: string
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()

  const stored = process.env['FLEET_ADMIN_PASSWORD'] ?? ''
  if (!stored) return { success: false, error: 'סיסמת מחיקה לא מוגדרת בהגדרות המערכת' }
  if (password !== stored) return { success: false, error: 'סיסמה שגויה' }

  const supabase = await createClient()

  // Must use RPC — direct .update({ deleted_at }) fails due to PostgREST + RLS interaction
  const { error } = await supabase.rpc('soft_delete_driver', {
    p_id: driverId,
    p_user_id: userId,
  })

  if (error) return { success: false, error: 'שגיאה במחיקת כרטיס הנהג' }

  revalidatePath('/app/fleet/driver-card')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UPDATE DRIVER DETAILS (consolidated save)
// ─────────────────────────────────────────────────────────────

/**
 * Saves phone_override, flags, and notes in a single DB update.
 * Called by the "שמור שינויים" button in the driver card details tab.
 */
export async function updateDriverDetails(
  driverId: string,
  data: {
    phone: string | null
    isOccasionalCampDriver: boolean
    isEquipmentOperator: boolean
    notes: string
  }
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Validate phone if provided
  if (data.phone) {
    const normalized = normalizePhone(data.phone)
    if (!normalized) {
      return { success: false, error: 'מספר טלפון לא תקין — נדרש פורמט 05X-XXXXXXX' }
    }
    data.phone = normalized
  }

  const { error } = await supabase
    .from('drivers')
    .update({
      phone_override: data.phone || null,
      is_occasional_camp_driver: data.isOccasionalCampDriver,
      is_equipment_operator: data.isEquipmentOperator,
      notes: data.notes || null,
      updated_by: userId,
    })
    .eq('id', driverId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'שגיאה בשמירת הפרטים' }

  revalidatePath(`/app/fleet/driver-card/${driverId}`)
  revalidatePath('/app/fleet/driver-card')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// SEND DRIVER SMS
// ─────────────────────────────────────────────────────────────

/**
 * Sends an SMS to the driver's effective phone number via Micropay API.
 * Phone number is resolved server-side from DB — never trusts client.
 * SECURITY: verifyAppUser() guard. SMS_TOKEN never exposed to client.
 */
export async function sendDriverSms(
  driverId: string,
  message: string
): Promise<ActionResult> {
  await verifyAppUser()

  const token = process.env['SMS_TOKEN'] ?? ''
  const fromName = process.env['SMS_FROM_NAME'] ?? 'ChemoSys'

  if (!token) return { success: false, error: 'שירות SMS אינו מוגדר בהגדרות המערכת' }
  if (!message.trim()) return { success: false, error: 'יש להזין תוכן הודעה' }

  // Fetch phone from DB (server-side — not from client)
  const supabase = await createClient()
  const { data: driver } = await supabase
    .from('drivers')
    .select('phone_override, employees!inner(mobile_phone)')
    .eq('id', driverId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!driver) return { success: false, error: 'נהג לא נמצא' }

  const emp = driver.employees as unknown as { mobile_phone: string | null }
  const rawPhone = driver.phone_override ?? emp.mobile_phone ?? ''
  const phone = rawPhone.replace(/\D/g, '')

  if (!phone) return { success: false, error: 'אין מספר טלפון רשום לנהג' }

  try {
    const url = new URL('http://www.micropay.co.il/ExtApi/ScheduleSms.php')
    url.searchParams.set('get', '1')
    url.searchParams.set('token', token)
    url.searchParams.set('msg', message.trim())
    url.searchParams.set('list', phone)
    url.searchParams.set('charset', 'utf-8')
    url.searchParams.set('from', fromName)

    const res = await fetch(url.toString(), { method: 'GET' })
    const text = (await res.text()).trim()

    // Micropay returns a numeric message ID on success
    if (/^\d+/.test(text)) {
      return { success: true }
    }
    return { success: false, error: `שגיאה ממערכת SMS: ${text}` }
  } catch (err) {
    return { success: false, error: `שגיאת רשת: ${err instanceof Error ? err.message : 'Unknown'}` }
  }
}

// ─────────────────────────────────────────────────────────────
// DRIVER LICENSE
// ─────────────────────────────────────────────────────────────

export async function getDriverLicense(driverId: string): Promise<DriverLicense | null> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('driver_licenses')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    driverId: data.driver_id,
    licenseNumber: data.license_number,
    licenseCategories: data.license_categories ?? [],
    categoryIssueYears: (data.category_issue_years as Record<string, number>) ?? {},
    expiryDate: data.expiry_date,
    frontImageUrl: data.front_image_url,
    backImageUrl: data.back_image_url,
  }
}

export type UpsertLicenseInput = {
  driverId: string
  licenseNumber?: string
  licenseCategories: string[]
  categoryIssueYears?: Record<string, number>
  expiryDate?: string | null
  frontImageUrl?: string | null
  backImageUrl?: string | null
}

export async function upsertDriverLicense(input: UpsertLicenseInput): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('driver_licenses')
    .select('id')
    .eq('driver_id', input.driverId)
    .maybeSingle()

  const payload = {
    driver_id: input.driverId,
    license_number: input.licenseNumber || null,
    license_categories: input.licenseCategories,
    category_issue_years: input.categoryIssueYears ?? {},
    expiry_date: input.expiryDate || null,
    front_image_url: input.frontImageUrl ?? null,
    back_image_url: input.backImageUrl ?? null,
    updated_by: userId,
  }

  const error = existing
    ? (await supabase.from('driver_licenses').update(payload).eq('id', existing.id)).error
    : (await supabase.from('driver_licenses').insert({ ...payload, created_by: userId })).error

  if (error) return { success: false, error: 'שגיאה בשמירת פרטי הרשיון' }

  revalidatePath(`/app/fleet/driver-card/${input.driverId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DRIVER DOCUMENTS
// ─────────────────────────────────────────────────────────────

export async function getDriverDocuments(driverId: string): Promise<DriverDocument[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('driver_id', driverId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((d) => ({
    id: d.id,
    driverId: d.driver_id,
    documentName: d.document_name,
    fileUrl: d.file_url,
    expiryDate: d.expiry_date,
    alertEnabled: d.alert_enabled ?? false,
    notes: d.notes,
    createdAt: d.created_at,
  }))
}

export type AddDocumentInput = {
  driverId: string
  documentName: string
  fileUrl?: string | null
  expiryDate?: string | null
  alertEnabled?: boolean
  notes?: string | null
}

export async function addDriverDocument(input: AddDocumentInput): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('driver_documents')
    .insert({
      driver_id: input.driverId,
      document_name: input.documentName.trim(),
      file_url: input.fileUrl ?? null,
      expiry_date: input.expiryDate || null,
      alert_enabled: input.alertEnabled ?? false,
      notes: input.notes || null,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת המסמך' }

  // Upsert document name for autocomplete suggestions (fire-and-forget)
  void supabase.rpc('increment_document_name_usage', { p_name: input.documentName.trim() })

  revalidatePath(`/app/fleet/driver-card/${input.driverId}`)
  return { success: true, id: data.id }
}

export async function deleteDriverDocument(docId: string, driverId: string): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Must use RPC — direct .update({ deleted_at }) fails due to PostgREST + RLS interaction
  const { error } = await supabase.rpc('soft_delete_driver_document', {
    p_id: docId,
    p_user_id: userId,
  })

  if (error) return { success: false, error: 'שגיאה במחיקת המסמך' }

  revalidatePath(`/app/fleet/driver-card/${driverId}`)
  return { success: true }
}

export type UpdateDocumentInput = {
  docId: string
  driverId: string
  documentName: string
  fileUrl?: string | null
  expiryDate?: string | null
  alertEnabled?: boolean
  notes?: string | null
}

export async function updateDriverDocument(input: UpdateDocumentInput): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Use RPC to bypass RLS interaction on UPDATE
  const { error } = await supabase.rpc('update_driver_document', {
    p_id: input.docId,
    p_user_id: userId,
    p_document_name: input.documentName.trim(),
    p_file_url: input.fileUrl ?? null,
    p_expiry_date: input.expiryDate || null,
    p_alert_enabled: input.alertEnabled ?? false,
    p_notes: input.notes || null,
  })

  if (error) return { success: false, error: 'שגיאה בעדכון המסמך' }

  revalidatePath(`/app/fleet/driver-card/${input.driverId}`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DOCUMENT NAME AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────

export async function getDocumentNameSuggestions(query: string): Promise<string[]> {
  await verifyAppUser()
  const supabase = await createClient()

  if (!query.trim()) {
    // Return most frequently used names when no query
    const { data } = await supabase
      .from('driver_document_names')
      .select('name')
      .order('usage_count', { ascending: false })
      .limit(10)
    return (data ?? []).map((d) => d.name)
  }

  const { data } = await supabase
    .from('driver_document_names')
    .select('name')
    .ilike('name', `%${query}%`)
    .order('usage_count', { ascending: false })
    .limit(8)

  return (data ?? []).map((d) => d.name)
}

// ─────────────────────────────────────────────────────────────
// DRIVER VIOLATIONS (תרבות נהיגה)
// ─────────────────────────────────────────────────────────────

export async function getDriverViolations(driverId: string): Promise<DriverViolation[]> {
  await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('driver_violations')
    .select('*')
    .eq('driver_id', driverId)
    .is('deleted_at', null)
    .order('violation_date', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((v) => ({
    id: v.id,
    driverId: v.driver_id,
    violationNumber: v.violation_number,
    violationDate: v.violation_date,
    violationType: v.violation_type as 'traffic' | 'parking' | 'accident' | null,
    vehicleNumber: v.vehicle_number,
    location: v.location,
    points: v.points,
    amount: v.amount,
    description: v.description,
    notes: v.notes,
    fileUrl: v.file_url,
    createdAt: v.created_at,
  }))
}

export type AddViolationInput = {
  driverId: string
  violationNumber?: string
  violationDate?: string
  violationType?: 'traffic' | 'parking' | 'accident'
  vehicleNumber?: string
  location?: string
  points?: number
  amount?: number
  description?: string
  notes?: string
  fileUrl?: string | null
}

export async function addDriverViolation(
  input: AddViolationInput
): Promise<ActionResult & { id?: string }> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('driver_violations')
    .insert({
      driver_id: input.driverId,
      violation_number: input.violationNumber || null,
      violation_date: input.violationDate || null,
      violation_type: input.violationType ?? null,
      vehicle_number: input.vehicleNumber || null,
      location: input.location || null,
      points: input.points ?? 0,
      amount: input.amount ?? null,
      description: input.description || null,
      notes: input.notes || null,
      file_url: input.fileUrl ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'שגיאה בהוספת הדוח' }

  revalidatePath(`/app/fleet/driver-card/${input.driverId}`)
  return { success: true, id: data.id }
}

export async function deleteDriverViolation(
  violationId: string,
  driverId: string
): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  // Must use RPC — direct .update({ deleted_at }) fails due to PostgREST + RLS interaction
  const { error } = await supabase.rpc('soft_delete_driver_violation', {
    p_id: violationId,
    p_user_id: userId,
  })

  if (error) return { success: false, error: 'שגיאה במחיקת הדוח' }

  revalidatePath(`/app/fleet/driver-card/${driverId}`)
  return { success: true }
}

export type UpdateViolationInput = {
  violationId: string
  driverId: string
  violationNumber?: string
  violationDate?: string
  violationType?: 'traffic' | 'parking' | 'accident'
  vehicleNumber?: string
  location?: string
  points?: number
  amount?: number
  description?: string
  notes?: string
  fileUrl?: string | null
}

export async function updateDriverViolation(input: UpdateViolationInput): Promise<ActionResult> {
  const { userId } = await verifyAppUser()
  const supabase = await createClient()

  const { error } = await supabase.rpc('update_driver_violation', {
    p_id: input.violationId,
    p_user_id: userId,
    p_violation_number: input.violationNumber || null,
    p_violation_date: input.violationDate || null,
    p_violation_type: input.violationType ?? null,
    p_vehicle_number: input.vehicleNumber || null,
    p_location: input.location || null,
    p_points: input.points ?? 0,
    p_amount: input.amount ?? null,
    p_description: input.description || null,
    p_notes: input.notes || null,
    p_file_url: input.fileUrl ?? null,
  })

  if (error) return { success: false, error: 'שגיאה בעדכון הדוח' }

  revalidatePath(`/app/fleet/driver-card/${input.driverId}`)
  return { success: true }
}
