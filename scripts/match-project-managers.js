const fs = require('fs');
const iconv = require('iconv-lite');

// Load employees from saved query result
const empDataPath = process.argv[2];
const empData = JSON.parse(fs.readFileSync(empDataPath, 'utf8'));

// Parse SystemProject.top
const buf = fs.readFileSync('SystemProject.top');
const content = iconv.decode(buf, 'windows-1255');
const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Build employee lookup maps
const empByFullName = new Map();
const empByEmail = new Map();

for (const emp of empData) {
  const fn = (emp.first_name || '').trim();
  const ln = (emp.last_name || '').trim();
  if (fn && ln) {
    // first last
    empByFullName.set((fn + ' ' + ln).toLowerCase(), emp);
    // last first (Hebrew order)
    empByFullName.set((ln + ' ' + fn).toLowerCase(), emp);
  }
  if (emp.email) {
    const prefix = emp.email.split('@')[0].toLowerCase();
    empByEmail.set(prefix, emp);
    empByEmail.set(emp.email.toLowerCase(), emp);
  }
}

function findEmployee(name, email) {
  if (!name || !name.trim()) return null;
  const nameLower = name.trim().toLowerCase();

  // 1. Direct full name match
  let emp = empByFullName.get(nameLower);
  if (emp) return { match: 'name', emp };

  // 2. Try email prefix match
  if (email) {
    const mainEmail = email.split(';')[0].trim();
    if (mainEmail) {
      const prefix = mainEmail.split('@')[0].toLowerCase();
      emp = empByEmail.get(prefix);
      if (emp) return { match: 'email', emp };
    }
  }

  // 3. Partial match - try first name only against full name map
  const parts = nameLower.split(/\s+/);
  if (parts.length === 1) {
    // Single name - search all employees for first_name match
    const matches = empData.filter(e =>
      (e.first_name || '').trim().toLowerCase() === nameLower ||
      (e.last_name || '').trim().toLowerCase() === nameLower
    );
    if (matches.length === 1) return { match: 'partial', emp: matches[0] };
  }

  return null;
}

// Collect all unique names and try to match
const allManagers = new Map();

for (const line of lines) {
  const f = line.split(',');
  if (f[0].includes('ChemoEndFile')) continue;
  if (f[46] && f[46].trim() === '1') continue;

  // PM
  if (f[10] && f[10].trim()) {
    const key = f[10].trim();
    if (!allManagers.has(key)) {
      allManagers.set(key, { role: 'PM', name: key, email: f[11] || '' });
    }
  }
  // WM/SM
  if (f[14] && f[14].trim()) {
    const key = f[14].trim();
    if (!allManagers.has(key)) {
      allManagers.set(key, { role: 'SM', name: key, email: f[15] || '' });
    }
  }
  // CVC
  if (f[43] && f[43].trim()) {
    const key = f[43].trim();
    if (!allManagers.has(key)) {
      allManagers.set(key, { role: 'CVC', name: key, email: '' });
    }
  }
}

// Special handling for compound names like "Esten / Yoav" or "Keisi \ Yoav"
// For these, try matching the first name part
for (const [name, info] of allManagers) {
  if (name.includes('/') || name.includes('\\')) {
    const firstName = name.split(/[\/\\]/)[0].trim();
    info.firstPart = firstName;
  }
}

console.log('=== MATCHED ===');
let matched = 0, unmatched = 0;

const entries = [...allManagers.entries()].sort((a, b) => a[0].localeCompare(b[0]));

for (const [name, info] of entries) {
  // Try compound name first part if applicable
  let result = findEmployee(name, info.email);
  if (!result && info.firstPart) {
    result = findEmployee(info.firstPart, info.email);
  }
  info.result = result;

  if (result) {
    matched++;
    const e = result.emp;
    console.log(`✓ ${info.role.padEnd(3)} ${name.padEnd(35)} → emp#${e.employee_number} ${e.first_name} ${e.last_name} (${result.match})`);
  }
}

console.log('\n=== UNMATCHED ===');
for (const [name, info] of entries) {
  if (!info.result) {
    unmatched++;
    console.log(`✗ ${info.role.padEnd(3)} ${name.padEnd(35)} email: ${info.email}`);
  }
}

console.log(`\nMatched: ${matched} | Unmatched: ${unmatched} | Total: ${matched + unmatched}`);
