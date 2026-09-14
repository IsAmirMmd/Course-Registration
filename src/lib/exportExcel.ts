import type { Course, Group, PlacedSession } from '../types'
import { DAY_NAMES } from './days'
import { clashingSessionKeys, sessionKey } from './conflicts'
import { layoutWeek } from './layout'
import { faTime, fromMinutes, toMinutes } from './time'
import { toFaDigits } from './digits'
import { createZip, utf8, type ZipEntry } from './zip'

/**
 * خروجی xlsx واقعی، بدون هیچ کتابخانه‌ای.
 *
 * فایل xlsx یک ZIP از چند XML است (OOXML)، پس فقط همان چند فایلِ لازم ساخته و
 * با zip.ts بسته می‌شود. متن‌ها به‌صورت inlineStr نوشته می‌شوند تا به
 * sharedStrings نیازی نباشد، و برگه‌ها rightToLeft هستند.
 */

export interface ExcelEntry {
  course: Course
  group: Group
}

export interface ExcelInput {
  placed: PlacedSession[]
  /** درس‌های برنامه‌ی فعلی */
  entries: ExcelEntry[]
  /** کل درس‌های ارائه‌شده، برای برگه‌ی سوم */
  catalogue: Course[]
  title: string
  meta: string
}

/* ─────────────────────────────── ابزار XML ─────────────────────────────── */

/**
 * نویسه‌های کنترلیِ غیرمجاز در XML؛ تب و شکست خط می‌مانند چون در سلول لازم‌اند.
 * تطبیقِ نویسه‌ی کنترلی اینجا خودِ هدف است: اگر پاک نشوند فایل xlsx باز نمی‌شود.
 */
// eslint-disable-next-line no-control-regex
const BAD_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

function esc(text: string): string {
  return text
    .replace(BAD_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** شماره‌ی ستون → حرف ستون (۱ → A، ۲۷ → AA) */
export function colName(index: number): string {
  let n = index
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/** شماره‌ی سبک در styles.xml */
const S = {
  plain: 0,
  title: 1,
  meta: 2,
  head: 3,
  timeLabel: 4,
  block: 5,
  blockClash: 6,
  cell: 7,
  cellNum: 8,
} as const

type StyleId = (typeof S)[keyof typeof S]

interface Cell {
  /** متن؛ اگر خالی باشد سلول فقط سبک می‌گیرد */
  text?: string
  /** عدد، برای ستون‌هایی مثل واحد و ظرفیت */
  number?: number
  style?: StyleId
}

function cellXml(ref: string, cell: Cell): string {
  const style = cell.style ? ` s="${cell.style}"` : ''
  if (typeof cell.number === 'number' && Number.isFinite(cell.number)) {
    return `<c r="${ref}"${style}><v>${cell.number}</v></c>`
  }
  if (cell.text === undefined || cell.text === '') {
    return `<c r="${ref}"${style}/>`
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(cell.text)}</t></is></c>`
}

function rowXml(rowIndex: number, cells: Cell[], heightPt?: number): string {
  const body = cells.map((cell, i) => cellXml(`${colName(i + 1)}${rowIndex}`, cell)).join('')
  const h = heightPt ? ` ht="${heightPt}" customHeight="1"` : ''
  return `<row r="${rowIndex}"${h}>${body}</row>`
}

interface SheetSpec {
  name: string
  rows: string[]
  colWidths: number[]
  merges: string[]
  /** ردیفی که پنجره از آن به بعد اسکرول می‌شود */
  freezeRow?: number
}

function sheetXml(spec: SheetSpec): string {
  const cols = spec.colWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('')
  // rightToLeft: ستون A سمت راست می‌نشیند، مثل خودِ برنامه
  const pane = spec.freezeRow
    ? `<pane ySplit="${spec.freezeRow}" topLeftCell="A${spec.freezeRow + 1}" activePane="bottomLeft" state="frozen"/>`
    : ''
  const merges = spec.merges.length
    ? `<mergeCells count="${spec.merges.length}">${spec.merges
        .map((ref) => `<mergeCell ref="${ref}"/>`)
        .join('')}</mergeCells>`
    : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/><cols>${cols}</cols><sheetData>${spec.rows.join('')}</sheetData>${merges}</worksheet>`
}

/* ─────────────────────────────── برگه‌ها ─────────────────────────────── */

const SLOT = 30 // دقیقه — هر ردیفِ جدول

/** برگه‌ی ۱: جدول هفتگی، ستون = روز، ردیف = بازه‌ی نیم‌ساعته */
function buildGridSheet(input: ExcelInput): SheetSpec {
  const layout = layoutWeek(input.placed, { pxPerMin: 1 })
  const clashing = clashingSessionKeys(input.placed)
  const days = layout.days
  const colCount = days.length + 1

  const rows: string[] = []
  const merges: string[] = []

  rows.push(rowXml(1, [{ text: input.title, style: S.title }], 22))
  if (colCount > 1) merges.push(`A1:${colName(colCount)}1`)
  rows.push(rowXml(2, [{ text: input.meta, style: S.meta }]))
  if (colCount > 1) merges.push(`A2:${colName(colCount)}2`)
  rows.push(rowXml(3, []))

  const HEAD_ROW = 4
  rows.push(
    rowXml(
      HEAD_ROW,
      [
        { text: 'ساعت', style: S.head },
        ...days.map((d) => ({ text: DAY_NAMES[d], style: S.head }) as Cell),
      ],
      20,
    ),
  )

  const slotCount = Math.max(1, Math.ceil((layout.endMin - layout.startMin) / SLOT))
  const rowOf = (minutes: number) => HEAD_ROW + 1 + Math.floor((minutes - layout.startMin) / SLOT)

  // متن و سبکِ هر سلول را اول می‌چینیم، بعد ردیف‌ها را می‌سازیم
  const grid: Cell[][] = []
  for (let i = 0; i < slotCount; i++) {
    const min = layout.startMin + i * SLOT
    grid.push([
      { text: faTime(fromMinutes(min)), style: S.timeLabel },
      ...days.map(() => ({ style: S.block }) as Cell),
    ])
  }

  days.forEach((day, dayIndex) => {
    const col = dayIndex + 1 // ستون ۰ برای ساعت است
    const sessions = input.placed
      .filter((p) => p.session.day === day)
      .sort((a, b) => toMinutes(a.session.start) - toMinutes(b.session.start))
    // بازه‌های ادغام‌شده؛ هیچ دو ادغامی نباید روی هم بیفتد، وگرنه فایل خراب است
    const taken: Array<[number, number]> = []

    for (const p of sessions) {
      const startRow = rowOf(toMinutes(p.session.start))
      const endRow = Math.max(startRow, rowOf(toMinutes(p.session.end) - 1))
      const isClash = clashing.has(sessionKey(p))
      const label = [
        p.course.name,
        `گروه ${toFaDigits(p.group.groupNo ?? '')}`,
        `${faTime(p.session.start)}-${faTime(p.session.end)}`,
        p.group.instructor,
        isClash ? '⚠ تداخل' : '',
      ]
        .filter(Boolean)
        .join('\n')

      const slotIndex = startRow - (HEAD_ROW + 1)
      const cell = grid[slotIndex]?.[col]
      if (!cell) continue

      if (cell.text) {
        // دو جلسه که در یک بازه شروع می‌شوند: در همان سلول، بدون ادغام
        cell.text = `${cell.text}\n———\n${label}`
        cell.style = S.blockClash
        continue
      }

      cell.text = label
      cell.style = isClash ? S.blockClash : S.block
      const overlaps = taken.some(([s, e]) => startRow <= e && s <= endRow)
      if (!overlaps) {
        if (endRow > startRow) {
          merges.push(`${colName(col + 1)}${startRow}:${colName(col + 1)}${endRow}`)
        }
        taken.push([startRow, endRow])
      }
    }
  })

  grid.forEach((cells, i) => {
    rows.push(rowXml(HEAD_ROW + 1 + i, cells, 30))
  })

  return {
    name: 'برنامه هفتگی',
    rows,
    colWidths: [9, ...days.map(() => 30)],
    merges,
    freezeRow: HEAD_ROW,
  }
}

const PLAN_HEADERS = [
  'کد گروه',
  'کد درس',
  'گروه',
  'نام درس',
  'واحد',
  'استاد',
  'ظرفیت',
  'روز و ساعت',
  'مکان',
  'تاریخ امتحان',
  'ساعت امتحان',
]

const PLAN_WIDTHS = [15, 12, 8, 34, 7, 24, 8, 42, 30, 14, 14]

function sessionsLabel(group: Group): string {
  if (group.sessions.length === 0) return 'بدون زمان ثابت'
  return group.sessions
    .map((s) => `${DAY_NAMES[s.day]} ${faTime(s.start)}-${faTime(s.end)}`)
    .join(' / ')
}

function placeLabel(group: Group): string {
  const places = group.sessions.map((s) => (s.location ? toFaDigits(s.location) : '')).filter(Boolean)
  return Array.from(new Set(places)).join(' / ')
}

/** ردیف یک گروه؛ همان ستون‌ها برای برگه‌ی برنامه و برگه‌ی کل درس‌ها */
function groupRow(course: Course, group: Group): Cell[] {
  return [
    { text: group.id, style: S.cellNum },
    { text: course.code, style: S.cellNum },
    { text: group.groupNo ?? '', style: S.cellNum },
    { text: course.name, style: S.cell },
    { number: course.credits, style: S.cellNum },
    { text: group.instructor, style: S.cell },
    { number: group.capacity, style: S.cellNum },
    { text: sessionsLabel(group), style: S.cell },
    { text: placeLabel(group), style: S.cell },
    { text: course.exam?.date ?? '', style: S.cellNum },
    { text: course.exam?.time ?? '', style: S.cellNum },
  ]
}

/** برگه‌ی ۲: درس‌های برنامه — کدها آماده‌ی وارد‌کردن در سیستم آموزش */
function buildPlanSheet(input: ExcelInput): SheetSpec {
  const rows: string[] = []
  rows.push(rowXml(1, [{ text: 'درس‌های این برنامه', style: S.title }], 22))
  rows.push(rowXml(2, [{ text: input.meta, style: S.meta }]))
  rows.push(rowXml(3, []))
  rows.push(
    rowXml(
      4,
      PLAN_HEADERS.map((h) => ({ text: h, style: S.head }) as Cell),
      20,
    ),
  )
  input.entries.forEach((entry, i) => {
    rows.push(rowXml(5 + i, groupRow(entry.course, entry.group)))
  })
  const total = input.entries.reduce((n, e) => n + e.course.credits, 0)
  rows.push(
    rowXml(6 + input.entries.length, [
      { text: 'مجموع واحد', style: S.head },
      { style: S.head },
      { style: S.head },
      { style: S.head },
      { number: total, style: S.head },
    ]),
  )
  return {
    name: 'درس‌های برنامه',
    rows,
    colWidths: PLAN_WIDTHS,
    merges: [`A1:${colName(PLAN_HEADERS.length)}1`, `A2:${colName(PLAN_HEADERS.length)}2`],
    freezeRow: 4,
  }
}

/** برگه‌ی ۳: کل درس‌های ارائه‌شده، یک ردیف برای هر گروه */
function buildCatalogueSheet(input: ExcelInput): SheetSpec {
  const rows: string[] = []
  const groupCount = input.catalogue.reduce((n, c) => n + c.groups.length, 0)
  rows.push(rowXml(1, [{ text: 'همه‌ی درس‌های ارائه‌شده', style: S.title }], 22))
  rows.push(
    rowXml(2, [
      {
        text: `${toFaDigits(input.catalogue.length)} درس · ${toFaDigits(groupCount)} گروه`,
        style: S.meta,
      },
    ]),
  )
  rows.push(rowXml(3, []))
  rows.push(
    rowXml(
      4,
      PLAN_HEADERS.map((h) => ({ text: h, style: S.head }) as Cell),
      20,
    ),
  )
  let r = 5
  for (const course of input.catalogue) {
    for (const group of course.groups) {
      rows.push(rowXml(r++, groupRow(course, group)))
    }
  }
  return {
    name: 'همه درس‌ها',
    rows,
    colWidths: PLAN_WIDTHS,
    merges: [`A1:${colName(PLAN_HEADERS.length)}1`, `A2:${colName(PLAN_HEADERS.length)}2`],
    freezeRow: 4,
  }
}

/* ─────────────────────────── ساختِ فایلِ xlsx ─────────────────────────── */

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="15"/><color rgb="FF111B2E"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF7A889F"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF44546E"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2B4FC8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF3FB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE7EA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD3DDEC"/></left><right style="thin"><color rgb="FFD3DDEC"/></right><top style="thin"><color rgb="FFD3DDEC"/></top><bottom style="thin"><color rgb="FFD3DDEC"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const contentTypes = (count: number) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Array.from(
  { length: count },
  (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

/** ساخت بایت‌های فایل xlsx */
export function buildWorkbook(input: ExcelInput, now = new Date()): Uint8Array<ArrayBuffer> {
  const sheets: SheetSpec[] = [buildGridSheet(input), buildPlanSheet(input)]
  if (input.catalogue.length > 0) sheets.push(buildCatalogueSheet(input))

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
    .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')}</sheets></workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

  const files: ZipEntry[] = [
    { path: '[Content_Types].xml', data: utf8(contentTypes(sheets.length)) },
    { path: '_rels/.rels', data: utf8(ROOT_RELS) },
    { path: 'xl/workbook.xml', data: utf8(workbook) },
    { path: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRels) },
    { path: 'xl/styles.xml', data: utf8(STYLES_XML) },
    ...sheets.map((spec, i) => ({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      data: utf8(sheetXml(spec)),
    })),
  ]

  return createZip(files, now)
}

/** فایل xlsx را دانلود می‌کند */
export function downloadWorkbook(input: ExcelInput, filename = 'weekly-schedule.xlsx'): void {
  const bytes = buildWorkbook(input)
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** همه‌ی کدهای گروهِ برنامه، هر کدام در یک خط — برای کپی یک‌جا */
export function allGroupCodes(entries: ExcelEntry[]): string {
  return entries.map((e) => e.group.id).join('\n')
}
