const fs = require('fs');
const buffer = fs.readFileSync('nCarList.top');
let content;
try { content = new TextDecoder('windows-1255').decode(buffer); } catch { content = buffer.toString('latin1'); }
const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

const byPlateContract = {};
let noContract = 0;

for (const line of lines) {
  const f = line.split(',');
  if (f[46] && f[46].trim() !== '') continue;
  const plate = (f[5] || '').trim();
  if (!plate) continue;
  const contract = (f[28] || '').trim();
  if (!contract) noContract++;
  const key = plate + '|' + contract;
  if (!byPlateContract[key]) byPlateContract[key] = [];
  byPlateContract[key].push(f);
}

const stillDupes = Object.entries(byPlateContract).filter(([k,v]) => v.length > 1);
console.log('Total unique plate+contract combos:', Object.keys(byPlateContract).length);
console.log('Records without contract number:', noContract);
console.log('Still duplicates after plate+contract key:', stillDupes.length);

if (stillDupes.length > 0) {
  console.log('\nRemaining duplicates:');
  for (const [key, records] of stillDupes) {
    const [plate, contract] = key.split('|');
    console.log('  plate=' + plate + ' contract="' + contract + '" (' + records.length + ' records)');
    for (const f of records) {
      const entry = f[17] ? new Date((parseInt(f[17]) - 25569) * 86400000).toLocaleDateString('he-IL') : '?';
      const isActive = !f[20] || f[20].trim() === '';
      const exit = isActive ? 'ACTIVE' : new Date((parseInt(f[20]) - 25569) * 86400000).toLocaleDateString('he-IL');
      console.log('    entry=' + entry + ' exit=' + exit + ' owner=' + (f[12]||'') + ' group=' + (f[13]||''));
    }
  }
}
