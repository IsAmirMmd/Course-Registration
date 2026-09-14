import type { Course, Group, PlacedSession } from '../types'
import { DAY_NAMES } from './days'
import { toFaDigits } from './digits'
import { clashingSessionKeys, sessionKey } from './conflicts'
import { courseHue, layoutWeek } from './layout'
import { faTime, fromMinutes } from './time'

/**
 * خروجیِ تصویریِ برنامه‌ی هفتگی.
 *
 * جدول مستقیماً روی Canvas کشیده می‌شود، نه با عکس‌گرفتن از DOM: مختصات همه‌ی
 * بلاک‌ها را از قبل layoutWeek() حساب کرده، پس نتیجه در هر مقیاسی شارپ است،
 * به هیچ کتابخانه‌ای نیاز ندارد و از سبک‌های صفحه (سایه، اسکرول، فونت‌های
 * نیم‌بارگذاری‌شده) مستقل است. رنگ‌ها از همان توکن‌های تمِ فعال خوانده می‌شوند
 * تا تصویر با چیزی که کاربر می‌بیند یکی باشد.
 */

export interface ScheduleImageEntry {
  course: Course
  group: Group
}

export interface ScheduleImageInput {
  placed: PlacedSession[]
  /** درس‌های برنامه، برای راهنمای پایین تصویر (شاملِ درس‌های بدون زمان ثابت) */
  entries: ScheduleImageEntry[]
  title: string
  /** خط دومِ سرصفحه، مثل «۱۶ واحد · ۶ درس · ترکیب ۲ از ۱۲» */
  meta: string
  /** ۲ = مناسب نمایشگرهای رتینا و چاپ */
  scale?: number
}

interface Palette {
  ground: string
  surface: string
  surface2: string
  line: string
  ink: string
  ink2: string
  ink3: string
  primary: string
  crit: string
  critWeak: string
  blockBg: (hue: number) => string
  blockLine: (hue: number) => string
  blockInk: (hue: number) => string
  blockMark: (hue: number) => string
}

const FALLBACK: Record<string, string> = {
  '--ground': '#f1f5fb',
  '--surface': '#ffffff',
  '--surface-2': '#e9eef7',
  '--line': '#d3ddec',
  '--ink': '#111b2e',
  '--ink-2': '#44546e',
  '--ink-3': '#7a889f',
  '--primary': '#2b4fc8',
  '--crit': '#c02742',
  '--crit-weak': '#fde7ea',
  '--block-bg-s': '82%',
  '--block-bg-l': '91%',
  '--block-line-s': '62%',
  '--block-line-l': '70%',
  '--block-ink-s': '62%',
  '--block-ink-l': '26%',
  '--block-mark-s': '64%',
  '--block-mark-l': '45%',
}

function readPalette(): Palette {
  const cs = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const v = (name: string): string => {
    const raw = cs?.getPropertyValue(name).trim()
    return raw && raw.length > 0 ? raw : FALLBACK[name]
  }
  // فرم کاماییِ hsl، تا در همه‌ی موتورها روی canvas قطعاً کار کند
  const hsl = (h: number, s: string, l: string) => `hsl(${h}, ${s}, ${l})`
  return {
    ground: v('--ground'),
    surface: v('--surface'),
    surface2: v('--surface-2'),
    line: v('--line'),
    ink: v('--ink'),
    ink2: v('--ink-2'),
    ink3: v('--ink-3'),
    primary: v('--primary'),
    crit: v('--crit'),
    critWeak: v('--crit-weak'),
    blockBg: (h) => hsl(h, v('--block-bg-s'), v('--block-bg-l')),
    blockLine: (h) => hsl(h, v('--block-line-s'), v('--block-line-l')),
    blockInk: (h) => hsl(h, v('--block-ink-s'), v('--block-ink-l')),
    blockMark: (h) => hsl(h, v('--block-mark-s'), v('--block-mark-l')),
  }
}

/* ─────────────────────────────── اندازه‌ها ─────────────────────────────── */

const PAD = 28
const HEAD_H = 62
const DAY_H = 30
const AXIS_W = 52
const COL_W = 176
const COL_GAP = 7
const PX_PER_MIN = 1
const LEGEND_TOP = 22
const LEGEND_ROW = 56
const FOOT_H = 26
const RADIUS = 6

const FONT = 'Vazirmatn, "Segoe UI", Tahoma, sans-serif'
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`

/** فقط همین از بافتِ ترسیم لازم است؛ پس کمکی‌های متنی مستقل و تست‌پذیرند */
export interface TextMeasurer {
  measureText: (text: string) => { width: number }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** متن را به عرض داده‌شده کوتاه می‌کند و «…» می‌گذارد */
export function fitText(ctx: TextMeasurer, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}

/**
 * شکستن متن به چند خط، با سقفِ تعداد خط.
 * اگر کلمه‌ای جا نشد، «…» به خط آخر اضافه می‌شود — متنِ بریده‌شده‌ی بی‌نشانه
 * خواننده را گمراه می‌کند.
 */
export function wrapText(
  ctx: TextMeasurer,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  let dropped = false

  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    if (lines.length + 1 === maxLines) {
      // این آخرین خط است و کلمه‌های بعدی جا نمی‌شوند.
      // اگر خط هنوز خالی است، خودِ همین کلمه‌ی بلند را می‌گیریم تا چیزی
      // برای کوتاه‌کردن باشد (وگرنه خروجی خالی می‌شد).
      if (!line) line = words[i]
      dropped = true
      break
    }
    if (line) lines.push(line)
    line = words[i]
  }

  if (line) lines.push(line)
  if (lines.length === 0) return []

  const last = lines.length - 1
  if (dropped) {
    let trimmed = lines[last]
    while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1)
    }
    lines[last] = `${trimmed}…`
  } else {
    lines[last] = fitText(ctx, lines[last], maxWidth)
  }
  return lines
}

/* ─────────────────────────────── ترسیم ─────────────────────────────── */

/** تصویر برنامه را روی یک canvas می‌کشد و برمی‌گرداند */
export async function renderScheduleCanvas(input: ScheduleImageInput): Promise<HTMLCanvasElement> {
  // بدون این، متن با فونت جانشین کشیده می‌شود
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* اگر API نبود، با فونت جانشین ادامه می‌دهیم */
    }
  }

  const scale = input.scale ?? 2
  const pal = readPalette()
  const layout = layoutWeek(input.placed, { pxPerMin: PX_PER_MIN })
  const clashing = clashingSessionKeys(input.placed)

  const dayCount = Math.max(layout.days.length, 1)
  const gridW = dayCount * COL_W + (dayCount - 1) * COL_GAP
  const width = PAD * 2 + AXIS_W + gridW
  const gridH = Math.max(layout.heightPx, 120)

  const legendCols = width > 700 ? 2 : 1
  const legendRows = Math.ceil(input.entries.length / legendCols)
  const legendH = input.entries.length > 0 ? LEGEND_TOP + legendRows * LEGEND_ROW : 0

  const height = PAD * 2 + HEAD_H + DAY_H + 6 + gridH + legendH + FOOT_H

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('امکان ساخت بافت ترسیم (canvas 2d) نبود.')

  ctx.scale(scale, scale)
  ctx.direction = 'rtl'
  ctx.textBaseline = 'alphabetic'

  // بوم
  ctx.fillStyle = pal.ground
  ctx.fillRect(0, 0, width, height)

  const right = width - PAD // لبه‌ی شروع در چیدمان راست‌به‌چپ
  const left = PAD

  /* سرصفحه */
  ctx.textAlign = 'right'
  ctx.fillStyle = pal.ink
  ctx.font = font(800, 21)
  ctx.fillText(fitText(ctx, input.title, width - PAD * 2), right, PAD + 20)

  ctx.fillStyle = pal.ink3
  ctx.font = font(500, 12.5)
  ctx.fillText(fitText(ctx, input.meta, width - PAD * 2), right, PAD + 41)

  // خط جداکننده‌ی سرصفحه
  ctx.strokeStyle = pal.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, PAD + HEAD_H - 10)
  ctx.lineTo(right, PAD + HEAD_H - 10)
  ctx.stroke()

  const gridTop = PAD + HEAD_H + DAY_H + 6
  const colX = (index: number) => right - AXIS_W - (index + 1) * COL_W - index * COL_GAP

  /* سر ستون روزها */
  ctx.textAlign = 'center'
  layout.days.forEach((day, i) => {
    const x = colX(i)
    ctx.fillStyle = pal.surface2
    roundRect(ctx, x, PAD + HEAD_H, COL_W, DAY_H, RADIUS)
    ctx.fill()
    ctx.strokeStyle = pal.line
    ctx.stroke()

    ctx.fillStyle = pal.ink2
    ctx.font = font(700, 13)
    ctx.fillText(DAY_NAMES[day], x + COL_W / 2, PAD + HEAD_H + 20)
  })

  /* محور ساعت */
  ctx.textAlign = 'center'
  ctx.fillStyle = pal.ink3
  ctx.font = font(500, 11)
  for (const mark of layout.hourMarks) {
    const y = gridTop + (mark - layout.startMin) * PX_PER_MIN
    ctx.fillText(faTime(fromMinutes(mark)), right - AXIS_W / 2, y + 4)
  }

  /* ستون‌های روز: پر، کادر و خطوط ساعت */
  layout.days.forEach((day, i) => {
    const x = colX(i)
    ctx.fillStyle = pal.surface
    roundRect(ctx, x, gridTop, COL_W, gridH, RADIUS)
    ctx.fill()
    ctx.strokeStyle = pal.line
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.save()
    roundRect(ctx, x, gridTop, COL_W, gridH, RADIUS)
    ctx.clip()
    ctx.strokeStyle = pal.line
    for (const mark of layout.hourMarks.slice(1, -1)) {
      const y = Math.round(gridTop + (mark - layout.startMin) * PX_PER_MIN) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + COL_W, y)
      ctx.stroke()
    }
    ctx.restore()

    /* بلاک‌های درس */
    for (const block of layout.blocksByDay.get(day) ?? []) {
      const p = block.placed
      const hue = courseHue(p.course.code)
      const isClash = clashing.has(sessionKey(p))
      const bw = (COL_W * block.widthPct) / 100 - 3
      const bx = x + (COL_W * block.leftPct) / 100 + 1.5
      const by = gridTop + block.topPx
      const bh = block.heightPx

      ctx.fillStyle = isClash ? pal.critWeak : pal.blockBg(hue)
      roundRect(ctx, bx, by, bw, bh, RADIUS - 1)
      ctx.fill()

      // تداخل: هاشور، تا حالت فقط با رنگ رمزگذاری نشده باشد
      if (isClash) {
        ctx.save()
        roundRect(ctx, bx, by, bw, bh, RADIUS - 1)
        ctx.clip()
        ctx.strokeStyle = pal.crit
        ctx.globalAlpha = 0.28
        ctx.lineWidth = 1.5
        for (let d = -bh; d < bw + bh; d += 8) {
          ctx.beginPath()
          ctx.moveTo(bx + d, by)
          ctx.lineTo(bx + d + bh, by + bh)
          ctx.stroke()
        }
        ctx.restore()
      }

      ctx.strokeStyle = isClash ? pal.crit : pal.blockLine(hue)
      ctx.lineWidth = isClash ? 1.5 : 1
      roundRect(ctx, bx, by, bw, bh, RADIUS - 1)
      ctx.stroke()

      /* متن بلاک */
      ctx.save()
      roundRect(ctx, bx, by, bw, bh, RADIUS - 1)
      ctx.clip()
      ctx.textAlign = 'right'
      const tx = bx + bw - 7
      const innerW = bw - 14
      const ink = isClash ? pal.crit : pal.blockInk(hue)

      ctx.fillStyle = ink
      ctx.font = font(700, 12)
      const nameLines = wrapText(ctx, p.course.name, innerW, bh > 46 ? 2 : 1)
      let ty = by + 15
      for (const lineText of nameLines) {
        ctx.fillText(lineText, tx, ty)
        ty += 15
      }

      if (bh > 34) {
        ctx.globalAlpha = 0.85
        ctx.font = font(500, 10.5)
        const time = `${faTime(p.session.start)}–${faTime(p.session.end)}`
        const kind = p.session.kind === 'practical' ? ' · عملی' : ''
        ctx.fillText(fitText(ctx, time + kind, innerW), tx, ty)
        ty += 13
        if (bh > 62 && p.group.instructor) {
          ctx.fillText(fitText(ctx, p.group.instructor, innerW), tx, ty)
        }
        ctx.globalAlpha = 1
      }
      ctx.restore()
    }
  })

  /* راهنما: هر درس با رنگ، گروه، استاد و تاریخ امتحان */
  if (input.entries.length > 0) {
    const legendTop = gridTop + gridH + LEGEND_TOP
    const cellW = (width - PAD * 2 - (legendCols - 1) * 12) / legendCols

    ctx.textAlign = 'right'
    input.entries.forEach((entry, i) => {
      const col = i % legendCols
      const row = Math.floor(i / legendCols)
      const cx = right - col * (cellW + 12)
      const cy = legendTop + row * LEGEND_ROW

      ctx.fillStyle = pal.surface
      roundRect(ctx, cx - cellW, cy, cellW, LEGEND_ROW - 8, RADIUS)
      ctx.fill()
      ctx.strokeStyle = pal.line
      ctx.lineWidth = 1
      ctx.stroke()

      // نقطه‌ی رنگی: پیوند با بلاکِ همان درس
      ctx.fillStyle = pal.blockMark(courseHue(entry.course.code))
      ctx.beginPath()
      ctx.arc(cx - 12, cy + 15, 4, 0, Math.PI * 2)
      ctx.fill()

      const textRight = cx - 23
      const textW = cellW - 34

      ctx.fillStyle = pal.ink
      ctx.font = font(700, 12)
      ctx.fillText(fitText(ctx, entry.course.name, textW), textRight, cy + 18)

      ctx.fillStyle = pal.ink3
      ctx.font = font(500, 10.5)
      const bits = [
        `${toFaDigits(entry.course.credits)} واحد`,
        `گروه ${toFaDigits(entry.group.groupNo ?? '')}`,
        entry.group.instructor || null,
        entry.course.exam ? `امتحان ${toFaDigits(entry.course.exam.date)}` : null,
        entry.group.sessions.length === 0 ? 'بدون زمان ثابت' : null,
      ].filter(Boolean)
      ctx.fillText(fitText(ctx, bits.join(' · '), textW), textRight, cy + 34)
    })
  }

  /* پاصفحه */
  ctx.textAlign = 'right'
  ctx.fillStyle = pal.ink3
  ctx.font = font(500, 10)
  ctx.fillText('ساخته‌شده با برنامه‌ریز هفتگی انتخاب واحد', right, height - PAD + 6)

  return canvas
}

/* ─────────────────────────── ذخیره و کپی ─────────────────────────── */

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('تبدیل تصویر به فایل ناموفق بود.'))
    }, 'image/png')
  })
}

/** تصویر PNG برنامه را دانلود می‌کند */
export async function downloadScheduleImage(
  input: ScheduleImageInput,
  filename = 'weekly-schedule.png',
): Promise<void> {
  const canvas = await renderScheduleCanvas(input)
  const blob = await toBlob(canvas)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** آیا کپی تصویر در این مرورگر/زمینه ممکن است؟ (نیازمند https یا localhost) */
export function canCopyImage(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof ClipboardItem !== 'undefined' &&
    Boolean(navigator.clipboard?.write)
  )
}

/** تصویر را در کلیپ‌بورد می‌گذارد، برای پیست‌کردن در پیام‌رسان‌ها */
export async function copyScheduleImage(input: ScheduleImageInput): Promise<void> {
  const canvas = await renderScheduleCanvas(input)
  const blob = await toBlob(canvas)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
