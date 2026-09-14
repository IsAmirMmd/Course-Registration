import type { Course } from '../types'
import { normalizeFa, toLatinDigits } from './digits'

/**
 * خواندن «کارنامه‌ی تطبیق برنامه‌ی آموزشی» سیستم گلستان.
 *
 * ساختار کارنامه: یک جدول بیرونی که هر ردیفش یک «بلوک» است؛ بلوک‌ها سه نوع‌اند:
 *  ۱) سرصفحه‌ی گروهِ نیاز، مثل «دروس اصلي-مشترك | ۲۱ درس از ۲۴ درس برنامه |
 *     ۵۵ واحد از ۶۰ واحد برنامه» (اگر کمبود داشته باشد قرمز است)
 *  ۲) ردیف درس: کد، نام، واحد، حالت («مصوب» = گذرانده) و جدولِ تودرتوی
 *     معادل/ترم/نمره/نوع درس
 *  ۳) بلوک‌های خلاصه (واحد تطبيقي/ناتمام/باقيمانده و جدول‌های جمع‌بندی)
 *
 * نکته‌ی مهمِ منطقِ «پاس‌شده»: بعضی گروه‌ها بازه دارند («۱ درس از ۰ تا ۶ درس»).
 * پس «کامل بودن» گروه دو مرحله دارد: رسیدن به حد پایین (لازم نیست بیشتر
 * بگیری) و رسیدن به سقف (بیشتر گرفتن هم دیگر حساب نمی‌شود).
 *
 * حریم خصوصی: از بخش مشخصاتِ دانشجو فقط رشته/مقطع/معدل/واحد خوانده می‌شود.
 * نام، شماره دانشجو، شماره ملی، شناسنامه، تاریخ تولد و عکس عمداً خوانده و
 * ذخیره نمی‌شوند، چون این ویژگی به هیچ‌کدامشان نیازی ندارد.
 */

export type CourseAuditStatus =
  | 'passed' // خودِ این درس را گذرانده‌اید
  | 'needed' // گروهش کمبود دارد → لازم
  | 'optional' // حد پایین گروه پر است ولی ظرفیت دارد → اختیاریِ مجاز
  | 'covered' // گروه به سقف رسیده → گرفتنش چیزی اضافه نمی‌کند
  | 'unknown' // در کارنامه پیدا نشد

export interface AuditCourse {
  code: string
  name: string
  credits: number
  passed: boolean
  term?: string
  grade?: string
  kind?: string
  groupId: string
}

export interface AuditGroup {
  id: string
  name: string
  doneCourses: number
  minCourses: number
  maxCourses: number
  doneCredits: number
  minCredits: number
  maxCredits: number
  /** حد پایین گروه پر شده است؟ */
  satisfied: boolean
  /** جای واحد بیشتری در این گروه هست؟ */
  hasRoom: boolean
  /** چند واحد تا حد پایین کم است */
  missingCredits: number
  /** در کارنامه قرمز علامت خورده بود */
  flagged: boolean
  courses: AuditCourse[]
}

export interface AuditSummary {
  field?: string
  level?: string
  faculty?: string
  department?: string
  gpa?: string
  passedCredits?: number
  /** «واحد تطبيقي: ۱۲۰ واحد از ۱۴۰ تا ۱۴۱ واحد برنامه» */
  totalMin?: number
  totalMax?: number
  remainingCredits?: number
  incompleteCredits?: number
}

export interface AuditReport {
  summary: AuditSummary
  groups: AuditGroup[]
  /** کد درس → وضعیت (یکتاشده روی همه‌ی گروه‌ها) */
  status: Record<string, CourseAuditStatus>
  passedCount: number
  warnings: string[]
}

/* ─────────────────────────────── ابزار ─────────────────────────────── */

function cellsOf(row: Element): Element[] {
  return Array.from(row.children).filter((el) => el.tagName === 'TD')
}

function text(el: Element | null | undefined): string {
  if (!el) return ''
  return normalizeFa(el.textContent ?? '')
}

function latin(el: Element | null | undefined): string {
  return toLatinDigits(text(el))
}

const COURSE_COUNT = /(\d+)\s*درس\s*از\s*(\d+)(?:\s*تا\s*(\d+))?\s*درس/
const CREDIT_COUNT = /(\d+)\s*واحد\s*از\s*(\d+)(?:\s*تا\s*(\d+))?\s*واحد/
const CODE_ONLY = /^\d{6,8}$/
const SMALL_NUMBER = /^\d{1,2}$/

function isRed(el: Element | null | undefined): boolean {
  if (!el) return false
  const style = (el.getAttribute('style') ?? '').toLowerCase()
  return style.includes('red')
}

/* ───────────────────── مشخصات (فقط فیلدهای لازم) ───────────────────── */

/** برچسب‌هایی که می‌خوانیم — بقیه‌ی مشخصات فردی عمداً خوانده نمی‌شود */
const WANTED_LABELS: Array<[keyof AuditSummary, string[]]> = [
  ['field', ['رشته']],
  ['level', ['مقطع']],
  ['faculty', ['دانشکده']],
  ['department', ['گروه آموزشی']],
  ['gpa', ['معدل کل']],
]

function readSummaryRow(cells: Element[], summary: AuditSummary): void {
  for (let i = 0; i < cells.length; i++) {
    const label = normalizeFa(cells[i].querySelector('strong, b')?.textContent ?? '')
    if (!label) continue
    for (const [key, names] of WANTED_LABELS) {
      if (names.includes(label)) {
        const value = text(cells[i + 2])
        if (value && value !== ':') {
          summary[key] = value as never
        }
      }
    }
    if (label === 'واحد گذرانده') {
      const n = Number(latin(cells[i + 2]))
      if (Number.isFinite(n)) summary.passedCredits = n
    }
  }
}

/** «واحد تطبيقي : ۱۲۰ واحد از ۱۴۰ تا ۱۴۱ واحد برنامه | ناتمام | باقيمانده» */
function readTotalsRow(cells: Element[], summary: AuditSummary): boolean {
  const first = latin(cells[0])
  if (!first.includes('واحد تطبیقی')) return false
  const m = CREDIT_COUNT.exec(first)
  if (m) {
    summary.totalMin = Number(m[2])
    summary.totalMax = m[3] ? Number(m[3]) : Number(m[2])
  }
  for (const cell of cells) {
    const t = latin(cell)
    const incomplete = /واحد ناتمام\s*:?\s*(\d+)/.exec(t)
    if (incomplete) summary.incompleteCredits = Number(incomplete[1])
    const remaining = /واحد باقیمانده\s*:?\s*(\d+)/.exec(t)
    if (remaining) summary.remainingCredits = Number(remaining[1])
  }
  return true
}

/* ─────────────────────────────── پارس ─────────────────────────────── */

export interface GroupCounts {
  doneCourses: number
  minCourses: number
  maxCourses: number
  doneCredits: number
  minCredits: number
  maxCredits: number
  flagged?: boolean
}

/**
 * ساختِ گروه از عددهای «X از Y تا Z».
 * دو مفهوم جدا: satisfied یعنی حد پایین پر شده (لازم نیست بیشتر بگیری) و
 * hasRoom یعنی هنوز جای واحد بیشتری هست (گرفتنِ بیشتر هم حساب می‌شود).
 */
export function makeGroup(id: string, name: string, counts: GroupCounts): AuditGroup {
  return {
    id,
    name,
    doneCourses: counts.doneCourses,
    minCourses: counts.minCourses,
    maxCourses: counts.maxCourses,
    doneCredits: counts.doneCredits,
    minCredits: counts.minCredits,
    maxCredits: counts.maxCredits,
    satisfied: counts.doneCredits >= counts.minCredits && counts.doneCourses >= counts.minCourses,
    hasRoom: counts.doneCredits < counts.maxCredits,
    missingCredits: Math.max(0, counts.minCredits - counts.doneCredits),
    flagged: counts.flagged ?? false,
    courses: [],
  }
}

export function parseAudit(html: string): AuditReport {
  const warnings: string[] = []
  const summary: AuditSummary = {}
  const groups: AuditGroup[] = []
  let current: AuditGroup | null = null

  if (!/<\s*(table|tr|td)\b/i.test(html)) {
    return {
      summary,
      groups,
      status: {},
      passedCount: 0,
      warnings: ['ورودی HTML نیست. کل جدول کارنامه را از گلستان کپی کنید.'],
    }
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')

  for (const row of Array.from(doc.querySelectorAll('tr'))) {
    const cells = cellsOf(row)
    if (cells.length === 0) continue

    // بلوک خلاصه‌ی واحدها
    if (cells.length >= 2 && readTotalsRow(cells, summary)) continue

    // مشخصات: ردیف‌هایی با برچسبِ پررنگ و مقدار دو سلول بعد
    if (cells.length >= 3 && cells[0].querySelector('strong')) {
      readSummaryRow(cells, summary)
      // ممکن است همین ردیف سرصفحه‌ی گروه نباشد؛ ادامه می‌دهیم
    }

    // سرصفحه‌ی گروهِ نیاز
    if (cells.length >= 3 && cells[0].querySelector('b')) {
      const courseText = latin(cells[1])
      const creditText = latin(cells[2])
      const cm = COURSE_COUNT.exec(courseText)
      const um = CREDIT_COUNT.exec(creditText)
      const name = normalizeFa(cells[0].querySelector('b')?.textContent ?? '')
      if (cm && um && name) {
        const minCourses = Number(cm[2])
        const maxCourses = cm[3] ? Number(cm[3]) : minCourses
        const minCredits = Number(um[2])
        const maxCredits = um[3] ? Number(um[3]) : minCredits
        const doneCourses = Number(cm[1])
        const doneCredits = Number(um[1])
        const group = makeGroup(`g${groups.length}`, name, {
          doneCourses,
          minCourses,
          maxCourses,
          doneCredits,
          minCredits,
          maxCredits,
          flagged: isRed(cells[1]) || isRed(cells[2]),
        })
        groups.push(group)
        current = group
        continue
      }
    }

    // ردیف درس
    const code = latin(cells[0])
    if (
      CODE_ONLY.test(code) &&
      cells.length >= 4 &&
      SMALL_NUMBER.test(latin(cells[2]).trim())
    ) {
      if (!current) {
        warnings.push(`درس ${code} پیش از هر گروهی آمده و نادیده گرفته شد.`)
        continue
      }
      const sub = Array.from(cells[4]?.querySelectorAll('td') ?? [])
      const subText = sub.map((c) => text(c))
      const entry: AuditCourse = {
        code,
        name: text(cells[1]),
        credits: Number(latin(cells[2])) || 0,
        passed: text(cells[3]).includes('مصوب'),
        groupId: current.id,
      }
      if (subText.length >= 6) {
        entry.term = toLatinDigits(subText[3]) || undefined
        entry.grade = toLatinDigits(subText[4]) || undefined
        entry.kind = subText[5] || undefined
      }
      current.courses.push(entry)
    }
  }

  if (groups.length === 0) {
    warnings.push('هیچ گروهِ نیازی در کارنامه پیدا نشد. مطمئن شوید کل جدول کپی شده است.')
  }

  const status = buildStatus(groups)
  const passedCount = Object.values(status).filter((s) => s === 'passed').length

  return { summary, groups, status, passedCount, warnings }
}

/**
 * وضعیتِ هر کد درس، یکتاشده روی همه‌ی گروه‌ها.
 * یک درس می‌تواند در چند گروه فهرست شده باشد؛ سخت‌گیرانه‌ترین حالت برنده است:
 * گذرانده > لازم > اختیاری > پوشیده‌شده.
 */
export function buildStatus(groups: AuditGroup[]): Record<string, CourseAuditStatus> {
  const status: Record<string, CourseAuditStatus> = {}
  const rank: Record<CourseAuditStatus, number> = {
    passed: 4,
    needed: 3,
    optional: 2,
    covered: 1,
    unknown: 0,
  }

  for (const group of groups) {
    for (const entry of group.courses) {
      let next: CourseAuditStatus
      if (entry.passed) next = 'passed'
      else if (!group.satisfied) next = 'needed'
      else if (group.hasRoom) next = 'optional'
      else next = 'covered'

      const prev = status[entry.code]
      if (!prev || rank[next] > rank[prev]) status[entry.code] = next
    }
  }
  return status
}

/* ───────────────── تطبیق کارنامه با درس‌های ارائه‌شده ───────────────── */

export interface OfferedMatch {
  course: Course
  status: CourseAuditStatus
  /** گروه‌های کارنامه که این درس در آن‌ها فهرست شده */
  groups: AuditGroup[]
  /** ردیف کارنامه (برای نشان‌دادن نمره و ترم) */
  entry?: AuditCourse
}

/** وضعیت هر درسِ ارائه‌شده‌ی این ترم بر اساس کارنامه */
export function matchOffered(courses: Course[], report: AuditReport | null): OfferedMatch[] {
  if (!report) return courses.map((course) => ({ course, status: 'unknown', groups: [] }))
  return courses.map((course) => {
    const groups = report.groups.filter((g) => g.courses.some((c) => c.code === course.code))
    const entries = groups.flatMap((g) => g.courses.filter((c) => c.code === course.code))
    return {
      course,
      status: report.status[course.code] ?? 'unknown',
      groups,
      entry: entries.find((e) => e.passed) ?? entries[0],
    }
  })
}

export interface GroupPlan {
  group: AuditGroup
  /** درس‌های ارائه‌شده‌ی این ترم که در این گروه‌اند و گذرانده نشده‌اند */
  offered: Course[]
}

/**
 * برای هر گروهِ ناتمام، درس‌های ارائه‌شده‌ی همین ترم که به آن گروه کمک می‌کنند.
 * همین جواب سؤالِ «دقیقاً چه انتخاب‌هایی دارم» است.
 */
export function planForGroups(
  courses: Course[],
  report: AuditReport | null,
  onlyUnsatisfied = true,
): GroupPlan[] {
  if (!report) return []
  const byCode = new Map(courses.map((c) => [c.code, c]))
  return report.groups
    .filter((g) => (onlyUnsatisfied ? !g.satisfied : true))
    .map((group) => ({
      group,
      offered: group.courses
        .filter((entry) => !entry.passed && byCode.has(entry.code))
        .map((entry) => byCode.get(entry.code) as Course)
        .filter((course, i, arr) => arr.findIndex((c) => c.code === course.code) === i),
    }))
}

export const STATUS_LABEL: Record<CourseAuditStatus, string> = {
  passed: 'پاس‌شده',
  needed: 'لازم',
  optional: 'اختیاری',
  covered: 'نیازی نیست',
  unknown: 'بیرون از برنامه',
}

/** برای دسته‌بندی دوتاییِ «پاس‌شده / قابل اخذ» */
export function isDone(status: CourseAuditStatus): boolean {
  return status === 'passed' || status === 'covered'
}
