const fs = require('fs');
const buffer = fs.readFileSync('nCarList.top');
let content;
try { content = new TextDecoder('windows-1255').decode(buffer); } catch { content = buffer.toString('latin1'); }
const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

function parseSplitStr(str, step) {
  if (!str || str.trim() === '') return [];
  const parts = str.split('~');
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  const result = [];
  for (let i = 0; i < parts.length; i += step) {
    const group = [];
    for (let j = 0; j < step && (i + j) < parts.length; j++) {
      group.push(parts[i + j]);
    }
    result.push(group);
  }
  return result;
}

function serialToDate(serial) {
  if (!serial || isNaN(parseInt(serial))) return null;
  return new Date((parseInt(serial) - 25569) * 86400 * 1000).toLocaleDateString('he-IL');
}

// Collect stats per SplitStr field
let monthlyCostsCount = 0, monthlyCostsSample = [];
let driverHistoryCount = 0, driverHistorySample = [];
let responsibleHistoryCount = 0, responsibleHistorySample = [];
let documentsCount = 0, documentsSample = [];
let replacementsCount = 0, replacementsSample = [];
let monthlyFuelCount = 0, monthlyFuelSample = [];
let projectAssignCount = 0, projectAssignSample = [];
let productModelCount = 0, productModelSample = [];
let totalRecords = 0;

// Road permissions analysis
const roadPermValues = {};

// vehicleGroup analysis
const groupValues = {};

// allocationType analysis
const allocValues = {};

for (const line of lines) {
  const f = line.split(',');
  if (f[46] && f[46].trim() !== '') continue;
  const plate = (f[5] || '').trim();
  if (!plate) continue;
  totalRecords++;

  // Col 10 - road permissions
  const rp = (f[10] || '').trim();
  if (rp) roadPermValues[rp] = (roadPermValues[rp] || 0) + 1;

  // Col 13 - vehicleGroup
  const grp = (f[13] || '').trim();
  if (grp) groupValues[grp] = (groupValues[grp] || 0) + 1;

  // Col 26 - allocationType
  const alloc = (f[26] || '').trim();
  if (alloc) allocValues[alloc] = (allocValues[alloc] || 0) + 1;

  // Col 14 - monthlyCosts (step=2)
  const mc = parseSplitStr(f[14], 2);
  if (mc.length > 0) {
    monthlyCostsCount++;
    if (monthlyCostsSample.length < 3) {
      monthlyCostsSample.push({ plate, records: mc.slice(0, 3).map(r => ({ date: serialToDate(r[0]), cost: r[1] })) });
    }
  }

  // Col 27 - driverHistory (step=3)
  const dh = parseSplitStr(f[27], 3);
  if (dh.length > 0) {
    driverHistoryCount++;
    if (driverHistorySample.length < 3) {
      driverHistorySample.push({ plate, records: dh.slice(0, 3).map(r => ({ date: serialToDate(r[0]), companyNum: r[1], empNum: r[2] })) });
    }
  }

  // Col 25 - vehicleResponsibleHistory (step=3)
  const rh = parseSplitStr(f[25], 3);
  if (rh.length > 0) {
    responsibleHistoryCount++;
    if (responsibleHistorySample.length < 3) {
      responsibleHistorySample.push({ plate, records: rh.slice(0, 3).map(r => ({ date: serialToDate(r[0]), name: r[1], phone: r[2] })) });
    }
  }

  // Col 37 - documents (step=7)
  const docs = parseSplitStr(f[37], 7);
  if (docs.length > 0) {
    documentsCount++;
    if (documentsSample.length < 3) {
      documentsSample.push({ plate, records: docs.slice(0, 2).map(r => ({ name: r[0], docNum: r[1], uploadDate: serialToDate(r[2]), desc: r[3], expiryDate: serialToDate(r[4]), f6: r[5], f7: r[6] })) });
    }
  }

  // Col 39 - replacementVehicles (step=8)
  const rv = parseSplitStr(f[39], 8);
  if (rv.length > 0) {
    replacementsCount++;
    if (replacementsSample.length < 3) {
      replacementsSample.push({ plate, records: rv.slice(0, 2).map(r => ({
        vehNum: r[0], entryDate: serialToDate(r[1]), entryKm: r[2],
        exitDate: serialToDate(r[3]), exitKm: r[4], reason: r[5], notes: r[6], fuelCard: r[7]
      })) });
    }
  }

  // Col 23 - monthlyFuelLimit (step=2)
  const mfl = parseSplitStr(f[23], 2);
  if (mfl.length > 0) {
    monthlyFuelCount++;
    if (monthlyFuelSample.length < 3) {
      monthlyFuelSample.push({ plate, records: mfl.slice(0, 3).map(r => ({ field1: r[0], maxLiters: r[1] })) });
    }
  }

  // Col 34 - projectAssignments (step=3)
  const pa = parseSplitStr(f[34], 3);
  if (pa.length > 0) {
    projectAssignCount++;
    if (projectAssignSample.length < 3) {
      projectAssignSample.push({ plate, records: pa.slice(0, 3).map(r => ({ date: serialToDate(r[0]), projectNum: r[1], field3: r[2] })) });
    }
  }

  // Col 15 - productModelCodes (step=2)
  const pm = parseSplitStr(f[15], 2);
  if (pm.length > 0) {
    productModelCount++;
    if (productModelSample.length < 3) {
      productModelSample.push({ plate, records: pm.slice(0, 3) });
    }
  }
}

console.log('=== SplitStr FIELD ANALYSIS (out of ' + totalRecords + ' records) ===\n');

console.log('--- Col 14: monthlyCosts (step=2) ---');
console.log('  Records with data:', monthlyCostsCount);
console.log('  Samples:', JSON.stringify(monthlyCostsSample, null, 2));

console.log('\n--- Col 27: driverHistory (step=3) ---');
console.log('  Records with data:', driverHistoryCount);
console.log('  Samples:', JSON.stringify(driverHistorySample, null, 2));

console.log('\n--- Col 25: vehicleResponsibleHistory (step=3) ---');
console.log('  Records with data:', responsibleHistoryCount);
console.log('  Samples:', JSON.stringify(responsibleHistorySample, null, 2));

console.log('\n--- Col 37: documents (step=7) ---');
console.log('  Records with data:', documentsCount);
console.log('  Samples:', JSON.stringify(documentsSample, null, 2));

console.log('\n--- Col 39: replacementVehicles (step=8) ---');
console.log('  Records with data:', replacementsCount);
console.log('  Samples:', JSON.stringify(replacementsSample, null, 2));

console.log('\n--- Col 23: monthlyFuelLimit (step=2) ---');
console.log('  Records with data:', monthlyFuelCount);
console.log('  Samples:', JSON.stringify(monthlyFuelSample, null, 2));

console.log('\n--- Col 34: projectAssignments (step=3) ---');
console.log('  Records with data:', projectAssignCount);
console.log('  Samples:', JSON.stringify(projectAssignSample, null, 2));

console.log('\n--- Col 15: productModelCodes (step=2) ---');
console.log('  Records with data:', productModelCount);
console.log('  Samples:', JSON.stringify(productModelSample, null, 2));

console.log('\n=== ENCODED FIELDS ===\n');

console.log('--- Col 10: roadPermissions ---');
Object.entries(roadPermValues).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  "' + k + '": ' + v));

console.log('\n--- Col 13: vehicleGroup ---');
Object.entries(groupValues).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  "' + k + '": ' + v));

console.log('\n--- Col 26: allocationType ---');
Object.entries(allocValues).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  "' + k + '": ' + v));
