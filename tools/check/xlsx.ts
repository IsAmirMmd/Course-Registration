// تولید یک فایل xlsx نمونه، برای بازبینی با ابزار بیرونی (openpyxl)
import { writeFileSync } from 'node:fs'
import { SEED_COURSES } from '../../src/data/seed'
import { placedSessions } from '../../src/lib/conflicts'
import { buildWorkbook } from '../../src/lib/exportExcel'

const out = process.argv[2] ?? 'sample.xlsx'
const byCode = (code: string) => SEED_COURSES.find((c) => c.code === code)!

// یک ترم واقعی، با یک تداخل عمدی (آزمایشگاه گروه ۰۱ با شبکه‌های کامپیوتری)
const term = ['1221005', '1221008', '1221012', '1221013', '1221021', '1221019'].map(byCode)
const picks: Record<string, string> = {}
for (const c of term) picks[c.code] = c.groups[0].id

const placed = placedSessions(term, picks)
const entries = term.map((course) => ({
  course,
  group: course.groups.find((g) => g.id === picks[course.code])!,
}))

const bytes = buildWorkbook(
  {
    placed,
    entries,
    catalogue: SEED_COURSES,
    title: 'برنامه‌ی هفتگی',
    meta: '۱۶ واحد · ۶ درس · آزمون خروجی',
  },
  new Date('2026-09-14T10:30:00Z'),
)
writeFileSync(out, bytes)
console.log(`wrote ${out} (${bytes.length} bytes)`)
