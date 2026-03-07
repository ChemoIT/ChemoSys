import * as fs from 'fs'

const csv = fs.readFileSync('demo_files/duplicate-employees-comparison.csv', 'utf-8')
const lines = csv.replace(/^\uFEFF/, '').split('\n').slice(1).filter(l => l.trim())

function parseCSV(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += line[i]
    }
  }
  result.push(current)
  return result
}

interface Row { empNum:string; company:string; status:string; deleted:boolean }
const groups = new Map<string, {type:string; key:string; diffs:string; rows:Row[]}>()

for (const line of lines) {
  const cols = parseCSV(line)
  const [type, key, , diffs, , empNum, company, , , , status, deleted] = cols
  const gKey = type + '|' + key
  if (!groups.has(gKey)) groups.set(gKey, {type, key, diffs, rows:[]})
  groups.get(gKey)!.rows.push({empNum, company, status, deleted: deleted !== ''})
}

let oneActiveOneInactive = 0, allInactive = 0, allActive = 0
let crossCompany = 0, sameCompany = 0

for (const [, g] of groups) {
  const companies = new Set(g.rows.map(r => r.company))
  if (companies.size > 1) crossCompany++; else sameCompany++
  const activeCount = g.rows.filter(r => r.status === 'active').length
  if (activeCount > 0 && activeCount < g.rows.length) oneActiveOneInactive++
  else if (activeCount === 0) allInactive++
  else allActive++
}

console.log('=== סיווג דפוסי כפילויות ===')
console.log(`סה"כ קבוצות: ${groups.size}`)
console.log()
console.log('לפי סטטוס:')
console.log(`  פעיל + לא-פעיל: ${oneActiveOneInactive}`)
console.log(`  כולם לא-פעילים: ${allInactive}`)
console.log(`  כולם פעילים (בעייתי!): ${allActive}`)
console.log()
console.log('לפי חברה:')
console.log(`  חברות שונות (אותו אדם עבר חברה): ${crossCompany}`)
console.log(`  אותה חברה: ${sameCompany}`)
console.log()

const diffPatterns = new Map<string, number>()
for (const [, g] of groups) {
  diffPatterns.set(g.diffs, (diffPatterns.get(g.diffs) || 0) + 1)
}
console.log('דפוסי הבדלים (מה שונה בין הרשומות):')
const sorted = [...diffPatterns.entries()].sort((a,b) => b[1] - a[1])
for (const [p, c] of sorted) {
  console.log(`  ${c}x | ${p}`)
}
