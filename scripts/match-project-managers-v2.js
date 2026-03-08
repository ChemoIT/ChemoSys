const fs = require('fs');
const iconv = require('iconv-lite');

// Load env and connect to Supabase
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Manual mapping: file name → employee_number (built from analysis)
const MANUAL_MAP = {
  // PM names
  'Eli Arviv':           27,   // אלי ביטון? NO — אלי ארביב not in DB... wait emp#27 is אלי ביטון
  'Asaf Rolnicki':       227,  // אסף רולניצקי | asaf@chemo-aharon.com
  'Asaf':                227,
  'Eli Biton':           27,   // אלי ביטון | eli@chemo-aharon.com
  'Israel Biton':        30,   // ישראל ביטון | israel@chemo-aharon.com
  'Eldad Goldshmidt':    702,  // אלדד גולדשמידט | eldad@chemo-aharon.com
  'Simone Ruginenti':    null, // NOT IN DB — Italian employee
  'Haim Dahan':          1645, // חיים דהן
  'Tomer Baruch':        256,  // תומר ברוך | tomer@chemo-aharon.com
  'Yuval Soberano':      302,  // יובל סוברנו
  'Nati Efargan':        1500, // נתן איפרגן | nati@chemo-aharon.com
  'Nati Ifergan':        1500,
  'Mofid Hamdan':        35,   // מפיד חמדאן
  'Mufid Hamdan':        35,
  'Keisi Sigron':        null, // NOT IN DB
  'Shay Swissa':         3248, // שי שמעון סויסה | shay.s@chemo-aharon.com
  'Shay Shimon Swissa':  3248,
  'Yishai Porat':        null, // NOT IN DB (ישי פורט not found)
  'Eyal Nachman':        null, // NOT IN DB
  'Shahar Poran':        2291, // שחר פורן
  'Natale Falco':        1441, // NATALE FALCO | natale@chemo-aharon.com
  'Liron Panker':        4006, // לירון פנקר
  'Yoav Ben-Natan':      null, // NOT IN DB
  'Shimon Malul':        4189, // שמעון מלול
  'Esten':               95,   // אסטן אזיזוב | esten@chemo-aharon.com
  'Esten / Yoav':        95,   // first part = Esten
  'Keisi \\ Yoav':       null, // Keisi not in DB
  // Hebrew PM names
  'אלי ארביב':           null, // NOT IN DB — needs investigation
  'אלי ביטון':           27,
  'ישראל ביטון':         30,
  'אלדד גולדשמיט':      702,
  'אלדד גולדשמידט':     702,
  'אלדד אמריליו':       null, // NOT IN DB — eldad.a email
  'אלדד אמנריליו':      null, // same person, typo
  'אייל נחמן':          null, // NOT IN DB
  'אסף רוליצקי':        227,
  'יובל סוברנו':        302,
  'ישי פורט':           null, // NOT IN DB
  'נתי איפרגן':         1500,
  'תומר ברוך':          256,
  'מופיד':              35,
  'קייסי':              null, // NOT IN DB
  'שמוליק':             null, // could be multiple — unknown
  'אסי הראל':           2805, // אסף הראל emp#2805 ? maybe not same person
  // SM / Work Manager names
  'אבי אבו רבן':        null, // NOT IN DB
  'אחיק':               null, // partial name, unknown
  'אילן אינהורן':       null, // NOT IN DB
  'אליאב דהן':          1613, // אליאב דהן emp#1613
  'אלירן סאסי':         null, // NOT IN DB (סויסה != סאסי... wait)
  'אסטן עזיזוב':        95,
  'זוהר עקרי':          null, // NOT IN DB
  'חיים איפרגן':        null, // NOT IN DB (different from נתן/נתי)
  'טופיק רישה':         null, // NOT IN DB
  'יחיאל דורון':        null, // NOT IN DB
  'ראמי סוועד':         null, // NOT IN DB
  'יובל סוברנו_sm':     302,  // appears as both PM and SM
  'אליאב דהן_sm':       1613,
  // CVC names
  'אודליה משה':         null, // NOT IN DB (אודליה חלף emp#3941?)
  'איתמר עמר':          3566, // איתמר עמר emp#3566
  'אסף גבאי':           3661, // אסף גבאי emp#3661
  'וויסאם עבדו':        2376, // ויסאם עבדו emp#2376
  'יוסי ציון':          5038, // יוסף ציון emp#5038
  'ליאור כהן':          2957, // ליאור כהן emp#2957
  'לירון פנקר_cvc':     4006,
  'מאור מועלם':         2523, // מאור מועלם emp#2523
  'מתן בן חמו':         3685, // מתן בן חמו emp#3685
  'שמעון מלול_cvc':     4189,
};

async function main() {
  // Fetch all employees
  let allEmps = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('employees')
      .select('id, employee_number, first_name, last_name, email, mobile_phone, company_id')
      .range(page * 1000, (page + 1) * 1000 - 1).order('employee_number');
    allEmps = allEmps.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  const empByNumber = new Map();
  for (const e of allEmps) empByNumber.set(Number(e.employee_number), e);

  // Parse SystemProject.top
  const buf = fs.readFileSync('SystemProject.top');
  const content = iconv.decode(buf, 'windows-1255');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Collect unique manager names with their roles
  const managers = new Map();

  for (const line of lines) {
    const f = line.split(',');
    if (f[0].includes('ChemoEndFile')) continue;
    if (f[46] && f[46].trim() === '1') continue;

    const addManager = (name, role, email, phone) => {
      if (!name || !name.trim()) return;
      const key = name.trim() + '_' + role;
      if (!managers.has(key)) {
        managers.set(key, { name: name.trim(), role, email: email || '', phone: phone || '' });
      }
    };

    addManager(f[10], 'PM', f[11], f[12]);
    addManager(f[14], 'SM', f[15], f[16]);
    addManager(f[43], 'CVC', '', f[44]);
  }

  // Match and report
  const matched = [];
  const unmatched = [];

  for (const [key, info] of managers) {
    const name = info.name;
    // Try manual map with key (name_role) first, then just name
    let empNum = MANUAL_MAP[key] !== undefined ? MANUAL_MAP[key] : MANUAL_MAP[name];

    if (empNum === undefined) {
      // Not in manual map at all — unknown
      unmatched.push({ ...info, reason: 'NOT_IN_MAP' });
      continue;
    }

    if (empNum === null) {
      unmatched.push({ ...info, reason: 'NOT_IN_DB' });
      continue;
    }

    const emp = empByNumber.get(empNum);
    if (!emp) {
      unmatched.push({ ...info, reason: 'EMP_NOT_FOUND', empNum });
      continue;
    }

    matched.push({
      ...info,
      empNum,
      empId: emp.id,
      empName: emp.first_name + ' ' + emp.last_name,
      empEmail: emp.email,
      empPhone: emp.mobile_phone,
      companyId: emp.company_id,
    });
  }

  console.log('=== MATCHED (' + matched.length + ') ===');
  for (const m of matched.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`✓ ${m.role.padEnd(3)} ${m.name.padEnd(30)} → emp#${m.empNum} ${m.empName} | company: ${m.companyId.substring(0, 8)}...`);
  }

  console.log('\n=== UNMATCHED (' + unmatched.length + ') ===');
  for (const u of unmatched.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`✗ ${u.role.padEnd(3)} ${u.name.padEnd(30)} | ${u.reason} | email: ${u.email} | phone: ${u.phone}`);
  }

  // Find which projects have unmatched managers
  console.log('\n=== PROJECTS WITH UNMATCHED MANAGERS ===');
  const unmatchedNames = new Set(unmatched.map(u => u.name));

  for (const line of lines) {
    const f = line.split(',');
    if (f[0].includes('ChemoEndFile')) continue;
    if (f[46] && f[46].trim() === '1') continue;

    const issues = [];
    const pmName = (f[10] || '').trim();
    const wmName = (f[14] || '').trim();
    const cvcName = (f[43] || '').trim();

    if (pmName && unmatchedNames.has(pmName)) issues.push('PM: ' + pmName);
    if (wmName && unmatchedNames.has(wmName)) issues.push('SM: ' + wmName);
    if (cvcName && unmatchedNames.has(cvcName)) issues.push('CVC: ' + cvcName);

    if (issues.length > 0) {
      console.log(`  ${f[1]} ${f[0].substring(0, 40).padEnd(40)} | ${issues.join(' | ')}`);
    }
  }

  // Also check: Eli Arviv — is he emp#27 (אלי ביטון) or someone else?
  console.log('\n=== QUESTION: Who is Eli Arviv? ===');
  console.log('emp#27 = אלי ביטון (eli@chemo-aharon.com)');
  console.log('In file: Eli Arviv (arviveli@chemo-aharon.com)');
  console.log('These are DIFFERENT people! Eli Arviv is NOT in the employees DB.');

  // Check eldad.a@chemo-aharon.com
  console.log('\n=== QUESTION: Who is eldad.a@chemo-aharon.com? ===');
  console.log('emp#702 = אלדד גולדשמידט (eldad@chemo-aharon.com)');
  console.log('In file: אלדד אמריליו (eldad.a@chemo-aharon.com)');
  console.log('These are DIFFERENT people! אלדד אמריליו is NOT in the employees DB.');

  // Check asih
  console.log('\n=== QUESTION: Who is אסי הראל? ===');
  console.log('emp#2805 = אסף הראל (no email)');
  console.log('In file: אסי הראל (asih@chemo-aharon.com)');
  console.log('Could be same person? asih = אסי ה...');
}

main().catch(console.error);
