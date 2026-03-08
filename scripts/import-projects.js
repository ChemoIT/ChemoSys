/**
 * import-projects.js — Import projects from SystemProject.top into Supabase.
 *
 * Prerequisites:
 *   - Migration 00033 (pm_sm_free_text) must be run in Supabase first
 *   - .env.local must contain NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - iconv-lite must be installed (npm install --save-dev iconv-lite)
 *
 * Usage:
 *   node scripts/import-projects.js              # dry-run (default)
 *   node scripts/import-projects.js --execute    # actually insert into DB
 *
 * What it does:
 *   1. Parse SystemProject.top (Windows-1255, 50-column CSV)
 *   2. Match PM/SM/CVC names to employees using MANUAL_MAP
 *   3. For matched: set is_employee=true, link employee UUID, pull email/phone from employees table
 *   4. For unmatched: set is_employee=false, store name/email/phone from .top file
 *   5. Upsert into projects table by project_number
 *   6. Replace-all attendance_clocks for each project
 */

const fs = require('fs');
const iconv = require('iconv-lite');

// ---------------------------------------------------------------------------
// Load env
// ---------------------------------------------------------------------------
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const DRY_RUN = !process.argv.includes('--execute');

// ---------------------------------------------------------------------------
// Manual mapping: manager name → employee_number (null = free text)
// Built from analysis in match-project-managers-v2.js + Sharon's decisions
// ---------------------------------------------------------------------------
const MANUAL_MAP = {
  // ── PM names (English) ──
  'Asaf Rolnicki':       227,
  'Asaf':                227,
  'Eli Biton':           27,
  'Israel Biton':        30,
  'Eldad Goldshmidt':    702,
  'Haim Dahan':          1645,
  'Tomer Baruch':        256,
  'Yuval Soberano':      302,
  'Nati Efargan':        1500,
  'Nati Ifergan':        1500,
  'Mofid Hamdan':        35,
  'Mufid Hamdan':        35,
  'Shay Swissa':         3248,
  'Shay Shimon Swissa':  3248,
  'Shahar Poran':        2291,
  'Natale Falco':        1441,
  'Liron Panker':        4006,
  'Shimon Malul':        4189,
  'Esten':               95,
  'Esten / Yoav':        95,
  // Free text (NOT IN DB)
  'Eli Arviv':           null,
  'Simone Ruginenti':    null,
  'Keisi Sigron':        null,
  'Yishai Porat':        null,
  'Eyal Nachman':        null,
  'Yoav Ben-Natan':      null,
  'Keisi \\ Yoav':       null,

  // ── PM names (Hebrew) ──
  'אלי ביטון':           27,
  'ישראל ביטון':         30,
  'אלדד גולדשמיט':      702,
  'אלדד גולדשמידט':     702,
  'אסף רוליצקי':        227,
  'יובל סוברנו':        302,
  'נתי איפרגן':         1500,
  'תומר ברוך':          256,
  'מופיד':              35,
  // Free text (NOT IN DB)
  'אלי ארביב':           null,
  'אלדד אמריליו':       null,
  'אלדד אמנריליו':      null,
  'אייל נחמן':          null,
  'ישי פורט':           null,
  'קייסי':              null,
  'שמוליק':             null,
  'אסי הראל':           null,

  // ── SM / Work Manager names (Hebrew) ──
  'אליאב דהן':          1613,
  'אסטן עזיזוב':        95,
  // Free text (NOT IN DB)
  'אבי אבו רבן':        null,
  'אחיק':               null,
  'אילן אינהורן':       null,
  'אלירן סאסי':         null,
  'זוהר עקרי':          null,
  'חיים איפרגן':        null,
  'טופיק רישה':         null,
  'יחיאל דורון':        null,
  'ראמי סוועד':         null,

  // ── CVC names (Hebrew) ──
  'אודליה משה':         3941,   // = אודליה חלף (Sharon confirmed)
  'איתמר עמר':          3566,
  'אסף גבאי':           3661,
  'וויסאם עבדו':        2376,
  'יוסי ציון':          5038,
  'ליאור כהן':          2957,
  'מאור מועלם':         2523,
  'מתן בן חמו':         3685,
  'שמעון מלול':          4189,
  'לירון פנקר':          4006,
  // English with single backslash
  'Keisi \\ Yoav':       null,
};

// ---------------------------------------------------------------------------
// Parse SplitStr (step=1 for attendance clocks)
// ---------------------------------------------------------------------------
function parseSplitStr(str) {
  if (!str || str.trim() === '') return [];
  const parts = str.split('~');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts.filter(p => p.trim() !== '');
}

// ---------------------------------------------------------------------------
// Normalise phone (same logic as src/lib/format.ts normalizePhone)
// ---------------------------------------------------------------------------
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('972')) digits = digits.slice(3);
  if (digits.length === 9 && !digits.startsWith('0')) digits = '0' + digits;
  if (digits.length !== 10 || !digits.startsWith('05')) return null;
  return digits;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== EXECUTING IMPORT ===');
  console.log('');

  // ── 1. Fetch all employees ──
  let allEmps = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('employees')
      .select('id, employee_number, first_name, last_name, email, mobile_phone, company_id')
      .range(page * 1000, (page + 1) * 1000 - 1)
      .order('employee_number');
    allEmps = allEmps.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`Loaded ${allEmps.length} employees from DB`);

  const empByNumber = new Map();
  for (const e of allEmps) empByNumber.set(Number(e.employee_number), e);

  // ── 2. Parse SystemProject.top ──
  const buf = fs.readFileSync('SystemProject.top');
  const content = iconv.decode(buf, 'windows-1255');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  console.log(`Parsed ${lines.length} lines from SystemProject.top`);

  const projects = [];
  let skipped = 0;

  for (const line of lines) {
    const f = line.split(',');

    // Skip end-of-file marker
    if (f[0] && f[0].includes('ChemoEndFile')) { skipped++; continue; }

    // Skip deleted rows
    if (f[46] && f[46].trim() === '1') { skipped++; continue; }

    // Skip rows without project number
    const projectNumber = (f[1] || '').trim();
    if (!projectNumber) { skipped++; continue; }

    // ── Resolve PM ──
    const pmName = (f[10] || '').trim();
    const pmEmail = (f[11] || '').trim();
    const pmPhone = (f[12] || '').trim();
    const pmNotify = f[13] === '1';
    const pmResolved = resolveManager(pmName, pmEmail, pmPhone, empByNumber);

    // ── Resolve SM ──
    const smName = (f[14] || '').trim();
    const smEmail = (f[15] || '').trim();
    const smPhone = (f[16] || '').trim();
    const smNotify = f[17] === '1';
    const smResolved = resolveManager(smName, smEmail, smPhone, empByNumber);

    // ── Resolve CVC ──
    const cvcName = (f[43] || '').trim();
    const cvcPhone = (f[44] || '').trim();
    const cvcResolved = resolveManager(cvcName, '', cvcPhone, empByNumber);

    // ── Status ──
    const statusCode = (f[34] || '').trim();
    const status = statusCode === '1' ? 'active' : 'inactive';

    // ── Project type (col7/8/9 flags) ──
    let projectType = null;
    if (f[7] === '1') projectType = 'project';
    else if (f[8] === '1') projectType = 'staging_area';
    else if (f[9] === '1') projectType = 'storage_area';

    // ── Location ──
    const lat = f[28] ? parseFloat(f[28]) : null;
    const lng = f[29] ? parseFloat(f[29]) : null;
    const radius = f[30] ? parseInt(f[30], 10) : null;

    // ── Attendance clocks ──
    const clocks = parseSplitStr(f[35] || '');

    projects.push({
      name:             (f[0] || '').trim(),
      project_number:   projectNumber,
      description:      (f[2] || '').trim() || null,
      client_name:      (f[3] || '').trim() || null,
      supervision_company: (f[4] || '').trim() || null,
      expense_number:   (f[5] || '').trim() || null,
      project_type:     projectType,
      status,
      // PM
      pm_is_employee:     pmResolved.isEmployee,
      project_manager_id: pmResolved.employeeId,
      pm_name:            pmResolved.name,
      pm_email:           pmResolved.email,
      pm_phone:           pmResolved.phone,
      pm_notifications:   pmNotify,
      // SM
      sm_is_employee:     smResolved.isEmployee,
      site_manager_id:    smResolved.employeeId,
      sm_name:            smResolved.name,
      sm_email:           smResolved.email,
      sm_phone:           smResolved.phone,
      sm_notifications:   smNotify,
      // CVC
      cvc_is_employee:             cvcResolved.isEmployee,
      camp_vehicle_coordinator_id: cvcResolved.employeeId,
      cvc_name:                    cvcResolved.name,
      cvc_phone:                   cvcResolved.phone,
      // Location
      latitude:  isNaN(lat) ? null : lat,
      longitude: isNaN(lng) ? null : lng,
      radius:    isNaN(radius) || radius === null ? 100 : radius,
      // Clocks
      _clocks: clocks,
    });
  }

  console.log(`Projects to import: ${projects.length}, Skipped: ${skipped}`);
  console.log('');

  // ── 3. Summary ──
  const activeCount = projects.filter(p => p.status === 'active').length;
  const inactiveCount = projects.filter(p => p.status === 'inactive').length;
  const pmEmployee = projects.filter(p => p.pm_is_employee && p.project_manager_id).length;
  const pmFreeText = projects.filter(p => !p.pm_is_employee && p.pm_name).length;
  const pmEmpty = projects.filter(p => !p.project_manager_id && !p.pm_name).length;
  const smEmployee = projects.filter(p => p.sm_is_employee && p.site_manager_id).length;
  const smFreeText = projects.filter(p => !p.sm_is_employee && p.sm_name).length;
  const cvcEmployee = projects.filter(p => p.cvc_is_employee && p.camp_vehicle_coordinator_id).length;
  const cvcFreeText = projects.filter(p => !p.cvc_is_employee && p.cvc_name).length;
  const withClocks = projects.filter(p => p._clocks.length > 0).length;

  console.log('=== IMPORT SUMMARY ===');
  console.log(`  Active: ${activeCount} | Inactive: ${inactiveCount}`);
  console.log(`  PM: ${pmEmployee} employee, ${pmFreeText} free-text, ${pmEmpty} empty`);
  console.log(`  SM: ${smEmployee} employee, ${smFreeText} free-text`);
  console.log(`  CVC: ${cvcEmployee} employee, ${cvcFreeText} free-text`);
  console.log(`  With clocks: ${withClocks}`);
  console.log('');

  if (DRY_RUN) {
    // Print first 5 projects as sample
    console.log('=== SAMPLE (first 5) ===');
    for (const p of projects.slice(0, 5)) {
      console.log(`  ${p.project_number} | ${p.name} | ${p.status}`);
      console.log(`    PM: ${p.pm_is_employee ? 'employee' : 'free'} ${p.pm_name || '(none)'} | ${p.pm_email || '-'} | ${p.pm_phone || '-'}`);
      console.log(`    SM: ${p.sm_is_employee ? 'employee' : 'free'} ${p.sm_name || '(none)'} | ${p.sm_email || '-'} | ${p.sm_phone || '-'}`);
      if (p.cvc_name) console.log(`    CVC: ${p.cvc_is_employee ? 'employee' : 'free'} ${p.cvc_name} | ${p.cvc_phone || '-'}`);
      if (p._clocks.length) console.log(`    Clocks: ${p._clocks.join(', ')}`);
    }
    console.log('');
    console.log('Dry run complete. Run with --execute to import.');
    return;
  }

  // ── 4. Upsert into DB ──
  let inserted = 0, updated = 0, errors = 0;

  for (const p of projects) {
    const clocks = p._clocks;
    const row = { ...p, deleted_at: null };
    delete row._clocks;

    // Check if project_number already exists
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('project_number', p.project_number)
      .maybeSingle();

    let projectId;

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('projects')
        .update(row)
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) {
        console.error(`✗ UPDATE ${p.project_number} ${p.name}: ${error.message}`);
        errors++;
        continue;
      }
      projectId = data.id;
      updated++;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('projects')
        .insert(row)
        .select('id')
        .single();

      if (error) {
        console.error(`✗ INSERT ${p.project_number} ${p.name}: ${error.message}`);
        errors++;
        continue;
      }
      projectId = data.id;
      inserted++;
    }

    // Replace-all attendance clocks
    if (projectId) {
      await supabase.from('attendance_clocks').delete().eq('project_id', projectId);

      if (clocks.length > 0) {
        const clockRows = clocks.map(clockId => ({
          project_id: projectId,
          clock_id: clockId.trim(),
        }));
        const { error: clockErr } = await supabase.from('attendance_clocks').insert(clockRows);
        if (clockErr) {
          console.error(`  ⚠ Clocks for ${p.project_number}: ${clockErr.message}`);
        }
      }
    }
  }

  console.log('');
  console.log('=== IMPORT COMPLETE ===');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Total:    ${projects.length}`);
}

// ---------------------------------------------------------------------------
// resolveManager — match name to employee or return free-text data
// ---------------------------------------------------------------------------
function resolveManager(name, fileEmail, filePhone, empByNumber) {
  if (!name) {
    return { isEmployee: true, employeeId: null, name: null, email: null, phone: null };
  }

  const empNum = MANUAL_MAP[name];

  // Matched to employee
  if (empNum !== undefined && empNum !== null) {
    const emp = empByNumber.get(empNum);
    if (emp) {
      return {
        isEmployee: true,
        employeeId: emp.id,
        name: null,   // not needed when linked to employee
        email: emp.email || null,
        phone: normalizePhone(emp.mobile_phone) || null,
      };
    }
    // Employee number in map but not found in DB — fallback to free text
    console.warn(`  ⚠ emp#${empNum} (${name}) not found in DB — using free text`);
  }

  // Free text (null in map OR not in map at all)
  return {
    isEmployee: false,
    employeeId: null,
    name: name,
    email: fileEmail || null,
    phone: normalizePhone(filePhone) || filePhone || null,
  };
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
