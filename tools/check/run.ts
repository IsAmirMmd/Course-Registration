import { SEED_COURSES } from '../../src/data/seed'
import { lastDay, parseDayName, scanDays } from '../../src/lib/days'
import { orderTimePair, toMinutes } from '../../src/lib/time'
import { parseTimeCell, rowsToCourses, type DraftRow } from '../../src/lib/parseTable'
import { formatSessions, parseSessionsText } from '../../src/lib/sessionText'
import { diagnose, solve, alternativesFor } from '../../src/lib/solver'
import { findClashes, placedSessions, totalCredits } from '../../src/lib/conflicts'

let fails = 0
function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}

function eq(label: string, got: unknown, want: unknown) {
  const g = stable(got)
  const w = stable(want)
  if (g !== w) {
    fails++
    console.log(`FAIL ${label}\n  got  ${g}\n  want ${w}`)
  } else {
    console.log(`ok   ${label}`)
  }
}

// ── نام روزها
eq('یکشنبه ≠ شنبه', parseDayName('یک شنبه'), 1)
eq('یک‌شنبه با نیم‌فاصله', parseDayName('یک‌شنبه'), 1)
eq('سه‌شنبه', parseDayName('سه شنبه'), 3)
eq('چهارشنبه', parseDayName('چهار شنبه'), 4)
eq('شنبه', parseDayName('شنبه'), 0)
eq('جمعه', parseDayName('جمعه'), 6)
eq('آخرین روز در متن', lastDay('درس(ت): شنبه ... درس(ت): سه شنبه'), 3)
eq('شمارش روزها', scanDays('شنبه و یکشنبه و جمعه').map((h) => h.day), [0, 1, 6])

// ── ساعت
eq('جفت ساعت مرتب', orderTimePair('۱۷:۰۰', '۱۵:۳۰'), { start: '15:30', end: '17:00' })
eq('جفت ساعت مستقیم', orderTimePair('۱۰:۰۵', '۱۱:۳۰'), { start: '10:05', end: '11:30' })
eq('دقیقه', toMinutes('۰۸:۳۰'), 510)

// ── سلول زمان: قالبِ واقعی سیستم آموزش، چند جلسه در یک سلول + امتحان
const cell = `درس(ت): شنبه(۱۰:۰۵-۱۱:۳۰ مکان: کلاس ۲۰۲ دانشکده برق
درس(ت): دوشنبه (۱۰:۰۵-۱۱:۳۰ مکان: کلاس ۲۰۲ دانشکده برق
امتحان(۱۴۰۵.۱۰.۲۹) ساعت: ۰۸:۳۰-۱۰:۳۰`
const parsed = parseTimeCell(cell)
eq('دو جلسه از یک سلول', parsed.sessions.map((s) => [s.day, s.start, s.end]), [[0, '10:05', '11:30'], [2, '10:05', '11:30']])
eq('نوع جلسه نظری', parsed.sessions[0].kind, 'theory')
eq('مکان', parsed.sessions[0].location, 'کلاس 202 دانشکده برق')
eq('امتحان', parsed.exam, { date: '1405/10/29', time: '08:30-10:30' })
eq('بدون هشدار', parsed.warnings, [])

const labCell = 'درس(ع): یک شنبه (۱۳:۳۰-۱۵:۳۰'
const lab = parseTimeCell(labCell)
eq('جلسه عملی', lab.sessions.map((s) => [s.day, s.start, s.end, s.kind]), [[1, '13:30', '15:30', 'practical']])
eq('بدون امتحان', lab.exam, null)

eq('سلول خالی (پروژه پایانی)', parseTimeCell('').sessions, [])

// ── رفت‌وبرگشت متن جلسه‌ها
const rt = parseSessionsText(formatSessions(parsed.sessions))
eq('round-trip جلسه‌ها', rt.sessions, parsed.sessions)
eq('round-trip بی‌خطا', rt.errors, [])

// ── ساخت Course از ردیف‌ها: گروه‌های هم‌کد زیر یک درس
const rows: DraftRow[] = [
  { key: 'a', courseCode: '۱۲۲۱۰۱۹', groupNo: '۰۱', name: 'آزمایشگاه شبکه', credits: '۱', capacity: '۱۲', instructor: 'الف', sessionsText: 'یک‌شنبه ۱۳:۳۰-۱۵:۳۰', examDate: '', examTime: '', warnings: [] },
  { key: 'b', courseCode: '۱۲۲۱۰۱۹', groupNo: '۰۲', name: 'آزمایشگاه شبکه', credits: '۱', capacity: '۱۲', instructor: 'الف', sessionsText: 'یک‌شنبه ۱۷:۳۰-۱۹:۳۰', examDate: '', examTime: '', warnings: [] },
  { key: 'c', courseCode: '۱۲۲۱۰۰۵', groupNo: '۰۱', name: 'ساختمان داده', credits: '۳', capacity: '۴۰', instructor: 'ب', sessionsText: 'شنبه ۱۵:۳۰-۱۷:۰۰', examDate: '۱۴۰۵/۱۰/۲۰', examTime: '۰۸:۳۰-۱۰:۳۰', warnings: [] },
]
const built = rowsToCourses(rows)
eq('دسته‌بندی زیر یک درس', built.courses.length, 2)
eq('دو گروه هم‌کد', built.courses[0].groups.map((g) => g.id), ['1221019_01', '1221019_02'])
eq('ارقام فارسی → عدد', [built.courses[1].credits, built.courses[1].groups[0].capacity], [3, 40])
eq('امتحان روی درس', built.courses[1].exam, { date: '1405/10/20', time: '08:30-10:30' })
eq('بدون مشکل', built.problems, [])

// ── داده‌ی واقعی
eq('تعداد درس‌های seed', SEED_COURSES.length, 101)
eq('تعداد گروه‌های seed', SEED_COURSES.reduce((n, c) => n + c.groups.length, 0), 197)

const byCode = (code: string) => SEED_COURSES.find((c) => c.code === code)!

// حلال روی یک ترم واقعیِ کارشناسی کامپیوتر
const term = ['1221005', '1221008', '1221012', '1221013', '1221021', '1221019'].map(byCode)
eq('واحد ترم', totalCredits(term), 16)
const res = solve(term)
console.log(`   ترکیب‌ها: ${res.combinations.length} (بررسی ${res.visited} گره، truncated=${res.truncated})`)
eq('ترکیب پیدا شد', res.combinations.length > 0, true)
// هر ترکیب واقعاً بی‌تداخل است؟
let dirty = 0
for (const comb of res.combinations) {
  if (findClashes(placedSessions(term, comb.picks)).length > 0) dirty++
}
eq('همه‌ی ترکیب‌ها بی‌تداخل', dirty, 0)
// هر ترکیب یک گروه از هر درس دارد؟
eq('یک گروه از هر درس', res.combinations.every((c) => Object.keys(c.picks).length === term.length), true)
// ترکیب‌ها تکراری نیستند؟
eq('ترکیب‌های یکتا', new Set(res.combinations.map((c) => JSON.stringify(c.picks))).size, res.combinations.length)

// سقف و truncation
const big = SEED_COURSES.filter((c) => c.groups.length >= 4).slice(0, 6)
const capped = solve(big, { limit: 50 })
eq('سقف رعایت شد', capped.combinations.length <= 50, true)
console.log(`   با سقف ۵۰: ${capped.combinations.length}, truncated=${capped.truncated}`)

// درس‌های بدون جلسه هرگز تداخل نمی‌سازند
const thesis = byCode('1211102')
eq('پایان‌نامه بدون جلسه', thesis.groups[0].sessions.length, 0)
const withThesis = solve([...term, thesis])
eq('درس بی‌زمان مانع نیست', withThesis.combinations.length, res.combinations.length)

// ── تشخیص علتِ نبودِ ترکیب: دو درسِ تک‌گروهی با ساعت یکسان
const clashA = byCode('1221008') // شنبه/دوشنبه ۱۰:۰۰-۱۱:۳۰
const clashB: typeof clashA = {
  code: '9999001',
  name: 'درس ساختگی متداخل',
  credits: 3,
  groups: [{ id: '9999001_01', groupNo: '01', instructor: 'ت', capacity: 10, sessions: [{ day: 0, start: '10:00', end: '11:30' }] }],
}
const bad = solve([clashA, clashB])
eq('ترکیبی نیست', bad.combinations.length, 0)
const dg = diagnose([clashA, clashB])
eq('یک جفت مقصر', dg.blockingPairs.length, 1)
eq('مقصر درست', [dg.blockingPairs[0].courseA.code, dg.blockingPairs[0].courseB.code], ['1221008', '9999001'])
eq('علت زمانی', dg.blockingPairs[0].reason, 'time')
eq('نمونه‌ی تداخل دارد', dg.blockingPairs[0].samples.length > 0, true)
eq('پیشنهاد حذف تک‌درسی', dg.dropSuggestions.length > 0 && dg.dropSuggestions[0].length === 1, true)
eq('بزرگ‌ترین زیرمجموعه', dg.maxFeasibleSize, 1)

// لبه‌ی مشترک تداخل نیست: ۱۰:۰۰-۱۲:۰۰ و ۱۲:۰۰-۱۴:۰۰
const touchA = { code: 'T1', name: 'الف', credits: 1, groups: [{ id: 'T1_01', instructor: '', capacity: 1, sessions: [{ day: 0 as const, start: '10:00', end: '12:00' }] }] }
const touchB = { code: 'T2', name: 'ب', credits: 1, groups: [{ id: 'T2_01', instructor: '', capacity: 1, sessions: [{ day: 0 as const, start: '12:00', end: '14:00' }] }] }
eq('پشت‌سرهم تداخل نیست', solve([touchA, touchB]).combinations.length, 1)

// گروه‌های جایگزین علامت‌خورده
const first = res.combinations[0]
const alts = alternativesFor(byCode('1221019'), term, first.picks)
eq('همه‌ی گروه‌های جایگزین فهرست شدند', alts.length, byCode('1221019').groups.length)
eq('گروه فعلی علامت دارد', alts.filter((a) => a.isCurrent).length, 1)
eq('گروه فعلی بی‌تداخل است', alts.find((a) => a.isCurrent)!.conflicts, false)

// درس بدون گروه
const orphan = { code: 'X', name: 'بی‌گروه', credits: 3, groups: [] }
eq('درس بی‌گروه → بی‌ترکیب', solve([orphan]).combinations.length, 0)
eq('درس بی‌گروه تشخیص داده شد', diagnose([orphan]).emptyCourses.map((c) => c.code), ['X'])

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`)
if (fails > 0) process.exit(1)
