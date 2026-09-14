import { SEED_COURSES } from '../../src/data/seed'
import { lastDay, parseDayName, scanDays } from '../../src/lib/days'
import { orderTimePair, toMinutes } from '../../src/lib/time'
import { parseTimeCell, rowsToCourses, type DraftRow } from '../../src/lib/parseTable'
import { formatSessions, parseSessionsText } from '../../src/lib/sessionText'
import { diagnose, solve, alternativesFor } from '../../src/lib/solver'
import { findClashes, placedSessions, totalCredits } from '../../src/lib/conflicts'
import { fitText, wrapText, type TextMeasurer } from '../../src/lib/exportImage'
import { allGroupCodes, colName } from '../../src/lib/exportExcel'
import { createZip, utf8 } from '../../src/lib/zip'
import {
  buildStatus,
  isDone,
  makeGroup,
  matchOffered,
  planForGroups,
  type AuditCourse,
  type AuditGroup,
  type AuditReport,
} from '../../src/lib/parseAudit'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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
eq('تعداد درس‌های seed', SEED_COURSES.length, 169)
eq('تعداد گروه‌های seed', SEED_COURSES.reduce((n, c) => n + c.groups.length, 0), 271)

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

// ── کمکی‌های متنیِ خروجیِ تصویری (اندازه‌گیرِ ساختگی: هر نویسه ۱۰ واحد)
const measurer: TextMeasurer = { measureText: (t: string) => ({ width: t.length * 10 }) }
eq('متن جا می‌شود، دست‌نخورده', fitText(measurer, 'abcd', 100), 'abcd')
eq('متن بلند کوتاه و «…» می‌شود', fitText(measurer, 'abcdefghij', 50), 'abcd…')
eq('یک خط کامل', wrapText(measurer, 'aa bb', 60, 2), ['aa bb'])
eq('شکستن به دو خط', wrapText(measurer, 'aaa bbb ccc', 70, 2), ['aaa bbb', 'ccc'])
// کلمه‌ی جامانده باید با «…» علامت بخورد، نه بی‌صدا حذف شود
eq('کلمه‌ی جامانده علامت می‌خورد', wrapText(measurer, 'aaa bbb ccc', 40, 2), ['aaa', 'bbb…'])
// تک‌کلمه‌ی بلندتر از عرض هم باید چیزی برگرداند
eq('تک‌کلمه‌ی بلند خالی برنمی‌گردد', wrapText(measurer, 'abcdefghij', 50, 1), ['abcd…'])
eq('متن خالی', wrapText(measurer, '   ', 50, 2), [])

// ── حرف ستون در اکسل
eq('ستون A', colName(1), 'A')
eq('ستون Z', colName(26), 'Z')
eq('ستون AA', colName(27), 'AA')
eq('ستون AB', colName(28), 'AB')
eq('ستون AZ', colName(52), 'AZ')
eq('ستون BA', colName(53), 'BA')

// ── نویسنده‌ی ZIP: ساختار آرشیو درست است
const zip = createZip(
  [
    { path: 'a.txt', data: utf8('سلام') },
    { path: 'dir/b.xml', data: utf8('<x/>') },
  ],
  new Date('2026-09-14T10:30:00Z'),
)
const sig = (at: number) => zip[at] | (zip[at + 1] << 8) | (zip[at + 2] << 16) | (zip[at + 3] << 24)
eq('سرصفحه‌ی محلی در ابتدا', sig(0) >>> 0, 0x04034b50)
// پایانِ فهرست مرکزی: ۲۲ بایت آخر (بدون توضیح)
const eocd = zip.length - 22
eq('امضای پایان فهرست', sig(eocd) >>> 0, 0x06054b50)
eq('تعداد مدخل‌ها', zip[eocd + 10] | (zip[eocd + 11] << 8), 2)
eq('امضای فهرست مرکزی هست', Array.from(zip).some((_, i) => i + 4 <= zip.length && (sig(i) >>> 0) === 0x02014b50), true)
// نامِ فایل با پرچم UTF-8 نوشته شده (بیت ۱۱ در پرچم‌های عمومی)
eq('پرچم UTF-8 نام فایل', (zip[6] | (zip[7] << 8)) & 0x0800, 0x0800)
eq('روش ذخیره = store', zip[8] | (zip[9] << 8), 0)

// ── کپی یک‌جای کدهای گروه: همان چیزی که در سیستم آموزش وارد می‌شود
const codesTerm = ['1221005', '1221019'].map(byCode)
eq(
  'کدهای گروه، هر کدام یک خط',
  allGroupCodes(codesTerm.map((c) => ({ course: c, group: c.groups[0] }))),
  '1221005_01\n1221019_01',
)
eq('کدها ارقام لاتین‌اند', /^[0-9_\n]+$/.test(allGroupCodes(codesTerm.map((c) => ({ course: c, group: c.groups[0] })))), true)

// ── هر var(--x) باید جایی تعریف شده باشد.
// این تست وجود دارد چون توکنی که در طراحی دوباره حذف شد، بی‌صدا رنگ را
// از کار انداخت (تیکِ چک‌باکس نامرئی شده بود) و بیلد هم چیزی نگفت.
function walk(dir: string): string[] {
  const out: string[] = []
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, item.name)
    if (item.isDirectory()) out.push(...walk(full))
    else if (/\.(css|tsx|ts)$/.test(item.name)) out.push(full)
  }
  return out
}

const sources = walk('src').map((f) => ({ file: f, text: readFileSync(f, 'utf8') }))
const defined = new Set<string>()
const used = new Map<string, string>()
for (const { file, text } of sources) {
  // تعریف در CSS: «--x:» — و تعریف درجا در TSX: «'--x'»
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1])
  for (const m of text.matchAll(/'(--[a-z0-9-]+)'/g)) defined.add(m[1])
  for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
    if (!used.has(m[1])) used.set(m[1], file)
  }
}
const undefinedTokens = [...used.entries()].filter(([name]) => !defined.has(name))
eq(
  'همه‌ی توکن‌های CSS تعریف شده‌اند',
  undefinedTokens.map(([name, file]) => `${name} (${file})`),
  [],
)

// ── قاعده‌ی «اشباع گروه» در کارنامه‌ی تطبیق
function withCourses(group: AuditGroup, rows: Array<[string, boolean]>): AuditGroup {
  group.courses = rows.map(([code, passed]) => ({
    code,
    name: code,
    credits: 2,
    passed,
    groupId: group.id,
  })) as AuditCourse[]
  return group
}

// گروهی که حد پایینش پر شده: هر دو انتخاب را گرفته‌ام، ولی گروه ۵ گزینه دارد.
// باید همه‌ی گزینه‌های نگرفته «بی‌نیاز» شوند، نه «لازم».
const fullGroup = withCourses(
  makeGroup('g1', 'اخلاق اسلامي', {
    doneCourses: 1,
    minCourses: 1,
    maxCourses: 1,
    doneCredits: 2,
    minCredits: 2,
    maxCredits: 2,
  }),
  [['1611007', true], ['1611004', false], ['1611005', false]],
)
const fullStatus = buildStatus([fullGroup])
eq('گروهِ کامل: درسِ گرفته‌شده «پاس‌شده»', fullStatus['1611007'], 'passed')
eq('گروهِ کامل: بقیه «بی‌نیاز»', [fullStatus['1611004'], fullStatus['1611005']], ['covered', 'covered'])
eq('هر دو زیر دسته‌ی «انجام‌شده»', [isDone('passed'), isDone('covered')], [true, true])

// گروهی که کمبود دارد: درس‌های نگرفته «لازم»اند
const shortGroup = withCourses(
  makeGroup('g2', 'دروس اصلي', {
    doneCourses: 21,
    minCourses: 24,
    maxCourses: 24,
    doneCredits: 55,
    minCredits: 60,
    maxCredits: 60,
  }),
  [['1221005', true], ['1221019', false], ['1221132', false]],
)
eq('گروهِ ناتمام شناسایی شد', shortGroup.satisfied, false)
eq('کمبود واحد', shortGroup.missingCredits, 5)
const shortStatus = buildStatus([shortGroup])
eq('گروهِ ناتمام: نگرفته‌ها «لازم»', [shortStatus['1221019'], shortStatus['1221132']], ['needed', 'needed'])
eq('لازم زیر «قابل اخذ» است', isDone('needed'), false)

// گروهِ اختیاری با بازه: حد پایین صفر ولی سقف دارد → «اختیاری» نه «بی‌نیاز»
const optionalGroup = withCourses(
  makeGroup('g3', 'دروس تخصصي مشترك', {
    doneCourses: 1,
    minCourses: 0,
    maxCourses: 6,
    doneCredits: 3,
    minCredits: 0,
    maxCredits: 11,
  }),
  [['1221024', true], ['1221101', false]],
)
eq('گروهِ بازه‌دار پر است ولی جا دارد', [optionalGroup.satisfied, optionalGroup.hasRoom], [true, true])
eq('گروهِ بازه‌دار: نگرفته «اختیاری»', buildStatus([optionalGroup])['1221101'], 'optional')

// یک درس در دو گروه: سخت‌گیرانه‌ترین حالت برنده است
const both = buildStatus([
  withCourses(makeGroup('a', 'کامل', { doneCourses: 1, minCourses: 1, maxCourses: 1, doneCredits: 2, minCredits: 2, maxCredits: 2 }), [['9001', false]]),
  withCourses(makeGroup('b', 'ناتمام', { doneCourses: 0, minCourses: 2, maxCourses: 2, doneCredits: 0, minCredits: 4, maxCredits: 4 }), [['9001', false]]),
])
eq('درسِ مشترک: «لازم» برنده می‌شود', both['9001'], 'needed')

// تطبیق با درس‌های ارائه‌شده‌ی واقعی
const auditReport: AuditReport = {
  summary: {},
  groups: [shortGroup],
  status: shortStatus,
  passedCount: 1,
  warnings: [],
}
const offeredNeeded = matchOffered(SEED_COURSES, auditReport).filter((m) => m.status === 'needed')
eq('درس‌های لازمِ ارائه‌شده', offeredNeeded.map((m) => m.course.code).sort(), ['1221019', '1221132'])
eq(
  'درس‌های بیرون از کارنامه «نامشخص»',
  matchOffered(SEED_COURSES, auditReport).find((m) => m.course.code === '1211003')?.status,
  'unknown',
)
const plan = planForGroups(SEED_COURSES, auditReport, true)
eq('برنامه‌ی گروهِ ناتمام', plan.length, 1)
eq('پیشنهادهای گروه', plan[0].offered.map((c) => c.code).sort(), ['1221019', '1221132'])
eq('بدون کارنامه، همه نامشخص', matchOffered(SEED_COURSES, null).every((m) => m.status === 'unknown'), true)

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`)
if (fails > 0) process.exit(1)
