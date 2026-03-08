const fs = require('fs');
const { TextDecoder } = require('util');

const buffer = fs.readFileSync('nCarList.top');
// Try windows-1255 via TextDecoder, fallback to latin1
let content;
try {
  const decoder = new TextDecoder('windows-1255');
  content = decoder.decode(buffer);
} catch {
  // Node may not support windows-1255, use latin1 as fallback
  content = buffer.toString('latin1');
}
const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

console.log('Total lines:', lines.length);

const CONTRACT_TYPES = { '1': 'company_owned', '2': 'company_rented', '3': 'company_leasing', '4': 'employee_private' };

let active = 0, skipped = 0, hasExitDate = 0, noExitDate = 0;
const vehicleTypes = {}, fuelTypes = {}, contractTypes = {}, manufacturers = {};
let withNotes = 0, withPascal = 0, withRoadPerms = 0, withMonthlyCosts = 0;
let withDriverHistory = 0, withDocuments = 0, withReplacements = 0;
let withResponsibleHistory = 0, withMonthlyFuelLimit = 0;
const plates = [];

for (const line of lines) {
  const f = line.split(',');

  if (f[46] && f[46].trim() !== '') { skipped++; continue; }
  active++;

  if (f[20] && f[20].trim() !== '') hasExitDate++;
  else noExitDate++;

  const vt = f[0] || '(empty)';
  vehicleTypes[vt] = (vehicleTypes[vt] || 0) + 1;

  const ft = f[4] || '(empty)';
  fuelTypes[ft] = (fuelTypes[ft] || 0) + 1;

  const ct = CONTRACT_TYPES[f[11]] || f[11] || '(empty)';
  contractTypes[ct] = (contractTypes[ct] || 0) + 1;

  const mfr = f[1] || '(empty)';
  manufacturers[mfr] = (manufacturers[mfr] || 0) + 1;

  if (f[31] && f[31].trim()) withNotes++;
  if (f[33] && f[33].trim()) withPascal++;
  if (f[10] && f[10].trim()) withRoadPerms++;
  if (f[14] && f[14].trim()) withMonthlyCosts++;
  if (f[27] && f[27].trim()) withDriverHistory++;
  if (f[37] && f[37].trim()) withDocuments++;
  if (f[39] && f[39].trim()) withReplacements++;
  if (f[25] && f[25].trim()) withResponsibleHistory++;
  if (f[23] && f[23].trim()) withMonthlyFuelLimit++;

  plates.push(f[5]);
}

console.log('\n=== SUMMARY ===');
console.log('Active records:', active);
console.log('Skipped (deleted):', skipped);
console.log('With exit date (inactive):', hasExitDate);
console.log('Without exit date (active in fleet):', noExitDate);

console.log('\n=== VEHICLE TYPES ===');
Object.entries(vehicleTypes).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));

console.log('\n=== FUEL TYPES ===');
Object.entries(fuelTypes).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));

console.log('\n=== CONTRACT TYPES ===');
Object.entries(contractTypes).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));

console.log('\n=== TOP 15 MANUFACTURERS ===');
Object.entries(manufacturers).sort((a,b) => b[1]-a[1]).slice(0,15).forEach(([k,v]) => console.log('  ' + k + ': ' + v));

console.log('\n=== DATA RICHNESS ===');
console.log('  With notes:', withNotes);
console.log('  With pascal number:', withPascal);
console.log('  With road permissions:', withRoadPerms);
console.log('  With monthly costs:', withMonthlyCosts);
console.log('  With driver history:', withDriverHistory);
console.log('  With documents:', withDocuments);
console.log('  With replacement vehicles:', withReplacements);
console.log('  With responsible history:', withResponsibleHistory);
console.log('  With monthly fuel limit:', withMonthlyFuelLimit);

// Duplicate plates
const plateCounts = {};
plates.forEach(p => { plateCounts[p] = (plateCounts[p] || 0) + 1; });
const dupes = Object.entries(plateCounts).filter(([k,v]) => v > 1);
console.log('\n=== DUPLICATES ===');
console.log('Unique plates:', Object.keys(plateCounts).length);
console.log('Duplicate plates:', dupes.length);
if (dupes.length > 0) dupes.forEach(([k,v]) => console.log('  ' + k + ' x' + v));

// Sample first 3 records
console.log('\n=== SAMPLE (first 3) ===');
let count = 0;
for (const line of lines) {
  const f = line.split(',');
  if (f[46] && f[46].trim() !== '') continue;
  if (count >= 3) break;
  console.log(`\n--- Vehicle ${count + 1} ---`);
  console.log('  type:', f[0]);
  console.log('  manufacturer:', f[1]);
  console.log('  model:', f[2]);
  console.log('  plate:', f[5]);
  console.log('  year:', f[6]);
  console.log('  fuel:', f[4]);
  console.log('  contract:', CONTRACT_TYPES[f[11]] || f[11]);
  console.log('  owner:', f[12]);
  console.log('  group:', f[13]);
  console.log('  entryDate:', f[17]);
  console.log('  exitDate:', f[20] || '(none - active)');
  console.log('  pascal:', f[33] || '(none)');
  console.log('  notes:', (f[31] || '').substring(0, 80));
  count++;
}
