import type { Course, Exam, Group, Session } from '../types'
import { findDay, lastDay } from './days'
import { normalizeFa, toFaDigits, toLatinDigits } from './digits'
import { orderTimePair } from './time'
import { formatSessions, parseSessionsText } from './sessionText'

/** یک ردیف جدولِ خام = یک گروه از یک درس. مقادیر رشته‌اند تا در پیش‌نمایش ویرایش شوند. */
export interface DraftRow {
  key: string
  courseCode: string
  groupNo: string
  name: string
  credits: string
  capacity: string
  instructor: string
  /** جلسه‌ها به قالب متنیِ قابل‌ویرایش (هر خط یک جلسه) */
  sessionsText: string
  examDate: string
  examTime: string
  warnings: string[]
}

export interface ParseReport {
  rows: DraftRow[]
  /** خطاهای کلی (مثلاً جدولی پیدا نشد) */
  errors: string[]
  notes: string[]
  source: 'html' | 'text'
  headerFound: boolean
}

/* ─────────────────────────── الگوهای متن جدول دانشگاه ─────────────────────────── */

const DIGIT = '[0-9۰-۹٠-٩]'
const TIME = `${DIGIT}{1,2}:${DIGIT}{2}`
const TIME_RANGE_G = new RegExp(`(${TIME})\\s*-\\s*(${TIME})`, 'g')
/** «۱۲۲۱۰۱۹_۰۱» یا «۱۲۲۱۰۱۹-۰۱» */
const CODE_RE = new RegExp(`(${DIGIT}{4,10})\\s*[-_\u2013]\\s*(${DIGIT}{1,3})`)
/** «امتحان(۱۴۰۵.۱۰.۲۹) ساعت: ۰۸:۳۰-۱۰:۳۰» */
const EXAM_RE = new RegExp(
  `امتحان\\s*[()\\[\\]]?\\s*(${DIGIT}{4}[./-]${DIGIT}{1,2}[./-]${DIGIT}{1,2})\\s*[()\\[\\]]?` +
    `(?:[^0-9۰-۹٠-٩]{0,20}(${TIME})\\s*-\\s*(${TIME}))?`,
)

/* ───────────────────────────── ابزار متنِ سلول ───────────────────────────── */

/** متن سلول با حفظ شکست خط (<br> و بلاک‌ها) — innerText در DOMParser موجود نیست */
function cellText(el: Element): string {
  let out = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const tag = (node as Element).tagName.toLowerCase()
    if (tag === 'br') {
      out += '\n'
      return
    }
    if (tag === 'script' || tag === 'style') return
    const block = /^(div|p|tr|li|table|tbody|thead)$/.test(tag)
    if (block) out += '\n'
    node.childNodes.forEach(walk)
    if (block) out += '\n'
  }
  el.childNodes.forEach(walk)
  return normalizeLines(out)
}

/** نرمال‌سازی هر خط جداگانه، تا ساختار خطوط (چند جلسه در یک سلول) حفظ شود */
function normalizeLines(text: string): string {
  return text
    .split('\n')
    .map((l) => normalizeFa(l))
    .filter((l, i, arr) => l !== '' || (i > 0 && i < arr.length - 1))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/* ─────────────────────── شبکه‌ی جدول با احتساب rowspan ─────────────────────── */

/**
 * جدول HTML را به شبکه‌ی دوبعدی تبدیل می‌کند و rowspan/colspan را باز می‌کند،
 * چون در جدول‌های سیستم آموزش نام درس معمولاً روی چند ردیف کشیده شده است.
 */
function tableToGrid(table: HTMLTableElement): string[][] {
  const grid: string[][] = []
  const rows = Array.from(table.rows)
  rows.forEach((tr, r) => {
    if (!grid[r]) grid[r] = []
    let c = 0
    for (const cell of Array.from(tr.cells)) {
      while (grid[r][c] !== undefined) c++
      const text = cellText(cell)
      const rowSpan = Math.min(cell.rowSpan || 1, rows.length - r)
      const colSpan = Math.min(cell.colSpan || 1, 40)
      for (let dr = 0; dr < rowSpan; dr++) {
        const rr = r + dr
        if (!grid[rr]) grid[rr] = []
        for (let dc = 0; dc < colSpan; dc++) {
          grid[rr][c + dc] = dc === 0 ? text : ''
        }
      }
      c += colSpan
    }
  })
  for (const row of grid) {
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = ''
  }
  return grid
}

/* ────────────────────────── تشخیص ستون‌ها از سرصفحه ────────────────────────── */

type ColKey = 'code' | 'name' | 'credits' | 'capacity' | 'instructor' | 'time'

const HEADER_HINTS: Array<[ColKey, string[]]> = [
  ['code', ['شماره و گروه', 'شماره درس', 'کد درس', 'شماره وگروه', 'کد و گروه']],
  ['name', ['نام درس', 'عنوان درس']],
  ['credits', ['واحد']],
  ['capacity', ['ظرفیت', 'ظر فیت']],
  ['instructor', ['نام استاد', 'استاد', 'مدرس']],
  ['time', ['زمان و مکان', 'زمان', 'ساعت و مکان', 'ارائه/ امتحان', 'زمان ارائه']],
]

function detectHeader(grid: string[][]): { rowIndex: number; map: Partial<Record<ColKey, number>> } | null {
  const limit = Math.min(grid.length, 8)
  let best: { rowIndex: number; map: Partial<Record<ColKey, number>>; score: number } | null = null
  for (let r = 0; r < limit; r++) {
    const map: Partial<Record<ColKey, number>> = {}
    let score = 0
    grid[r].forEach((cell, c) => {
      const flat = cell.replace(/\s/g, '')
      for (const [key, hints] of HEADER_HINTS) {
        if (map[key] !== undefined) continue
        if (hints.some((h) => flat.includes(h.replace(/\s/g, '')))) {
          map[key] = c
          score++
          break
        }
      }
    })
    if (score >= 3 && (best === null || score > best.score)) best = { rowIndex: r, map, score }
  }
  return best ? { rowIndex: best.rowIndex, map: best.map } : null
}

/* ───────────────────────── استخراج جلسه‌ها از یک سلول ───────────────────────── */

export interface TimeCellResult {
  sessions: Session[]
  exam: Exam | null
  warnings: string[]
}

/**
 * چند جلسه را از یک سلول جدا می‌کند.
 * روش: ابتدا بخش امتحان بیرون کشیده می‌شود، سپس هر بازه‌ی «شروع-پایان» پیدا شده و
 * نزدیک‌ترین نام روزِ قبل از آن به آن بازه نسبت داده می‌شود. این کار با هر دو قالبِ
 * «درس(ت): شنبه(۱۰:۰۵-۱۱:۳۰» و «شنبه ۱۰:۰۵-۱۱:۳۰» و چند خط پشت‌سرهم سازگار است.
 */
export function parseTimeCell(raw: string): TimeCellResult {
  const warnings: string[] = []
  let text = normalizeLines(raw)
  let exam: Exam | null = null

  const em = EXAM_RE.exec(text)
  if (em) {
    const date = toLatinDigits(em[1]).replace(/[.-]/g, '/')
    let time = ''
    if (em[2] && em[3]) {
      const p = orderTimePair(em[2], em[3])
      time = `${p.start}-${p.end}`
    }
    exam = { date, time }
    text = `${text.slice(0, em.index)}\n${text.slice(em.index + em[0].length)}`
  }

  const sessions: Session[] = []
  const matches = Array.from(text.matchAll(TIME_RANGE_G))
  let cursor = 0
  matches.forEach((m, i) => {
    const at = m.index ?? 0
    const before = text.slice(cursor, at)
    const nextAt = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    const after = text.slice(at + m[0].length, nextAt)

    const day = lastDay(before)
    if (day === null) {
      warnings.push(`برای ساعت «${m[0]}» نام روزی پیدا نشد`)
      cursor = at + m[0].length
      return
    }
    const { start, end } = orderTimePair(m[1], m[2])
    const session: Session = { day, start, end }
    const kind = /\(\s*ع\s*\)/.test(before) ? 'practical' : /\(\s*ت\s*\)/.test(before) ? 'theory' : undefined
    if (kind) session.kind = kind
    const loc = /مکان\s*:?\s*([^\n]*)/.exec(after)
    if (loc) {
      const cleaned = normalizeFa(loc[1])
        .replace(/درس\s*\(.*$/, '')
        .replace(/امتحان.*$/, '')
        .trim()
      // ادامه‌ی نام مکان ممکن است به خط بعد رفته باشد (مثل «کلاس ۲۰۲ / دانشکده برق»)
      const tail = after.split('\n').slice(1).join(' ')
      const extra = normalizeFa(tail).replace(/درس\s*\(.*$/, '').replace(/امتحان.*$/, '').trim()
      const full = [cleaned, extra].filter(Boolean).join(' ').trim()
      if (full) session.location = toLatinDigits(full)
    }
    sessions.push(session)
    cursor = at + m[0].length
  })

  return { sessions, exam, warnings }
}

/* ──────────────────────────────── ورودی HTML ──────────────────────────────── */

export function parseRawTable(input: string): ParseReport {
  const trimmed = input.trim()
  if (!trimmed) return { rows: [], errors: ['ورودی خالی است.'], notes: [], source: 'text', headerFound: false }

  if (/<\s*(table|tr|td)\b/i.test(trimmed)) return parseHtml(trimmed)
  return parseText(trimmed)
}

function parseHtml(html: string): ParseReport {
  const errors: string[] = []
  const notes: string[] = []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let tables = Array.from(doc.querySelectorAll('table'))
  if (tables.length === 0) {
    // کاربر ممکن است فقط چند <tr> کپی کرده باشد
    const orphanRows = doc.querySelectorAll('tr')
    if (orphanRows.length > 0) {
      const wrapper = doc.createElement('table')
      const body = doc.createElement('tbody')
      orphanRows.forEach((tr) => body.appendChild(tr.cloneNode(true)))
      wrapper.appendChild(body)
      tables = [wrapper as HTMLTableElement]
    } else {
      return { rows: [], errors: ['در ورودی هیچ جدولی پیدا نشد.'], notes, source: 'html', headerFound: false }
    }
  }

  const rows: DraftRow[] = []
  let headerFound = false
  for (const table of tables) {
    const grid = tableToGrid(table as HTMLTableElement)
    if (grid.length === 0) continue
    const header = detectHeader(grid)
    if (header) headerFound = true
    const startRow = header ? header.rowIndex + 1 : 0
    const map = header?.map ?? {}
    for (let r = startRow; r < grid.length; r++) {
      const row = buildRow(grid[r], map, rows.length)
      if (row) rows.push(row)
    }
  }

  if (rows.length === 0) errors.push('جدول خوانده شد اما هیچ ردیفی با «کد درس_گروه» در آن پیدا نشد.')
  if (!headerFound && rows.length > 0) {
    notes.push('سرصفحه‌ی جدول شناسایی نشد؛ ستون‌ها حدسی پر شده‌اند. پیش‌نمایش را حتماً بازبینی کنید.')
  }
  return { rows, errors, notes, source: 'html', headerFound }
}

/**
 * ساخت یک ردیف از یک سطر شبکه.
 * سلول کد و سلول زمان همیشه با الگو پیدا می‌شوند (حتی اگر سرصفحه اشتباه بود)،
 * چون قابل‌اعتمادترین نشانه‌های ردیف‌اند.
 */
function buildRow(cells: string[], map: Partial<Record<ColKey, number>>, seq: number): DraftRow | null {
  const codeIdx = pickCodeCell(cells, map.code)
  if (codeIdx === -1) return null
  const cm = CODE_RE.exec(cells[codeIdx])
  if (!cm) return null

  const timeIdx = pickTimeCell(cells, map.time, codeIdx)
  const warnings: string[] = []

  const timeText = timeIdx >= 0 ? cells[timeIdx] : ''
  const { sessions, exam, warnings: tw } = parseTimeCell(timeText)
  warnings.push(...tw)

  const used = new Set<number>([codeIdx, timeIdx])
  const textCells = cells
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => !used.has(i) && /[؀-ۿ]/.test(c) && !/^مختلط$|^مرد$|^زن$/.test(c.trim()))

  const name = pick(cells, map.name) ?? textCells[0]?.c ?? ''
  const instructor = pick(cells, map.instructor) ?? textCells[textCells.length - 1]?.c ?? ''
  const numeric = cells
    .map((c, i) => ({ c: toLatinDigits(c).trim(), i }))
    .filter(({ c, i }) => !used.has(i) && /^\d{1,4}$/.test(c))

  const credits = firstNumber(pick(cells, map.credits)) ?? numeric[0]?.c ?? ''
  const capacity = firstNumber(pick(cells, map.capacity)) ?? pickCapacity(numeric) ?? ''

  if (!name) warnings.push('نام درس خوانده نشد')
  if (!credits) warnings.push('تعداد واحد خوانده نشد')
  if (sessions.length === 0 && timeText) warnings.push('هیچ جلسه‌ای از سلول زمان استخراج نشد')

  // ارقام برای «نمایش» فارسی می‌شوند؛ rowsToCourses دوباره به لاتین برمی‌گرداند
  return {
    key: `r${seq}`,
    courseCode: toFaDigits(toLatinDigits(cm[1])),
    groupNo: toFaDigits(toLatinDigits(cm[2])),
    name: normalizeFa(name.split('\n')[0]),
    credits: toFaDigits(credits),
    capacity: toFaDigits(capacity),
    instructor: normalizeFa(instructor.replace(/\n/g, ' ')),
    sessionsText: formatSessions(sessions),
    examDate: toFaDigits(exam?.date ?? ''),
    examTime: toFaDigits(exam?.time ?? ''),
    warnings,
  }
}

function pick(cells: string[], idx: number | undefined): string | null {
  if (idx === undefined || idx < 0 || idx >= cells.length) return null
  const v = cells[idx].trim()
  return v ? v : null
}

function firstNumber(value: string | null): string | null {
  if (!value) return null
  const m = /\d{1,4}/.exec(toLatinDigits(value))
  return m ? m[0] : null
}

/** ظرفیت معمولاً بزرگ‌ترین عدد ردیف است (واحد ۱-۶، ظرفیت ۸-۲۰۰) */
function pickCapacity(numeric: Array<{ c: string; i: number }>): string | null {
  const candidates = numeric.map((n) => Number(n.c)).filter((n) => n >= 5)
  if (candidates.length === 0) return null
  return String(Math.max(...candidates))
}

function pickCodeCell(cells: string[], mapped: number | undefined): number {
  if (mapped !== undefined && cells[mapped] && CODE_RE.test(cells[mapped])) return mapped
  return cells.findIndex((c) => CODE_RE.test(c))
}

function pickTimeCell(cells: string[], mapped: number | undefined, codeIdx: number): number {
  const looksLikeTime = (c: string) => /امتحان/.test(c) || (new RegExp(TIME).test(c) && findDay(c) !== null)
  if (mapped !== undefined && cells[mapped] && looksLikeTime(cells[mapped])) return mapped
  const found = cells.findIndex((c, i) => i !== codeIdx && looksLikeTime(c))
  if (found >= 0) return found
  return mapped ?? -1
}

/* ─────────────────────── ورودی متنی (کپی سادهٔ جدول) ─────────────────────── */

/**
 * اگر کاربر متن ساده (نه HTML) پیست کند: هر خطی که کد درس دارد ردیف تازه‌ای
 * شروع می‌کند و خطوط بعدی (ادامه‌ی جلسه‌ها/مکان) به همان ردیف می‌چسبند.
 */
function parseText(text: string): ParseReport {
  const lines = text.split('\n')
  const chunks: string[][] = []
  for (const line of lines) {
    if (CODE_RE.test(line)) chunks.push([line])
    else if (chunks.length > 0 && line.trim()) chunks[chunks.length - 1].push(line)
  }
  const rows: DraftRow[] = []
  chunks.forEach((chunk, i) => {
    const blob = chunk.join('\n')
    const cm = CODE_RE.exec(blob)
    if (!cm) return
    const { sessions, exam, warnings } = parseTimeCell(blob)
    const cleaned = normalizeFa(
      blob
        .replace(CODE_RE, ' ')
        .replace(EXAM_RE, ' ')
        .replace(/درس\s*\([تع]\)\s*:?/g, ' ')
        .replace(new RegExp(`${TIME}\\s*-\\s*${TIME}`, 'g'), ' ')
        .replace(/مکان\s*:[^\n]*/g, ' ')
        .replace(/(یک|دو|سه|چهار|پنج)?\s*شنبه|جمعه/g, ' '),
    )
    const nums = (toLatinDigits(cleaned).match(/\b\d{1,4}\b/g) ?? []).map(Number)
    const words = cleaned.replace(/[0-9]/g, ' ').replace(/\s+/g, ' ').trim()
    rows.push({
      key: `t${i}`,
      courseCode: toFaDigits(toLatinDigits(cm[1])),
      groupNo: toFaDigits(toLatinDigits(cm[2])),
      name: words,
      credits: toFaDigits(nums.find((n) => n >= 1 && n <= 24)?.toString() ?? ''),
      capacity: toFaDigits(
        nums.filter((n) => n >= 5).length ? String(Math.max(...nums.filter((n) => n >= 5))) : '',
      ),
      instructor: '',
      sessionsText: formatSessions(sessions),
      examDate: toFaDigits(exam?.date ?? ''),
      examTime: toFaDigits(exam?.time ?? ''),
      warnings: [
        ...warnings,
        'ورودی متنی بود؛ نام درس و استاد از هم جدا نشده‌اند. لطفاً در پیش‌نمایش اصلاح کنید.',
      ],
    })
  })
  return {
    rows,
    errors: rows.length ? [] : ['در متن ورودی ردیفی با «کد درس_گروه» پیدا نشد.'],
    notes: [],
    source: 'text',
    headerFound: false,
  }
}

/* ──────────────────── تبدیل ردیف‌های ویرایش‌شده به Course[] ──────────────────── */

export interface BuildResult {
  courses: Course[]
  problems: string[]
}

/** گروه‌های هم‌کد (قبل از «_») زیر یک Course دسته‌بندی می‌شوند */
export function rowsToCourses(rows: DraftRow[]): BuildResult {
  const problems: string[] = []
  const byCode = new Map<string, Course>()
  const seenGroupIds = new Set<string>()

  for (const row of rows) {
    const code = toLatinDigits(row.courseCode).trim()
    if (!code) {
      problems.push(`ردیفی بدون کد درس نادیده گرفته شد (${row.name || 'بی‌نام'})`)
      continue
    }
    const { sessions, errors } = parseSessionsText(row.sessionsText)
    for (const e of errors) problems.push(`${row.name || code}: ${e}`)

    let course = byCode.get(code)
    if (!course) {
      course = { code, name: row.name.trim() || code, credits: Number(toLatinDigits(row.credits)) || 0, groups: [] }
      byCode.set(code, course)
    }
    const examDate = toLatinDigits(row.examDate).trim()
    if (examDate && !course.exam) course.exam = { date: examDate, time: toLatinDigits(row.examTime).trim() }

    const groupNo = toLatinDigits(row.groupNo).trim() || String(course.groups.length + 1).padStart(2, '0')
    let id = `${code}_${groupNo}`
    if (seenGroupIds.has(id)) {
      problems.push(`گروه تکراری «${id}» با شناسه‌ی تازه ذخیره شد`)
      let n = 2
      while (seenGroupIds.has(`${id}#${n}`)) n++
      id = `${id}#${n}`
    }
    seenGroupIds.add(id)

    const group: Group = {
      id,
      groupNo,
      instructor: row.instructor.trim(),
      capacity: Number(toLatinDigits(row.capacity)) || 0,
      sessions,
    }
    course.groups.push(group)
  }

  return { courses: Array.from(byCode.values()), problems }
}

/** Course[] → ردیف‌های قابل‌ویرایش (برای ویرایش دوباره‌ی داده‌ی ذخیره‌شده) */
export function coursesToRows(courses: Course[]): DraftRow[] {
  const rows: DraftRow[] = []
  courses.forEach((c) => {
    c.groups.forEach((g, gi) => {
      rows.push({
        key: `${g.id}-${gi}`,
        courseCode: toFaDigits(c.code),
        groupNo: toFaDigits(g.groupNo ?? String(gi + 1).padStart(2, '0')),
        name: c.name,
        credits: toFaDigits(c.credits),
        capacity: toFaDigits(g.capacity),
        instructor: g.instructor,
        sessionsText: formatSessions(g.sessions),
        examDate: toFaDigits(c.exam?.date ?? ''),
        examTime: toFaDigits(c.exam?.time ?? ''),
        warnings: [],
      })
    })
  })
  return rows
}
