import type { DayIndex, PlacedSession } from '../types'
import { toMinutes } from './time'

export interface LaidOutBlock {
  placed: PlacedSession
  topPx: number
  heightPx: number
  /** درصدِ عرض و آفست، برای کنار‌هم‌نشینیِ بلاک‌های متداخل */
  widthPct: number
  leftPct: number
}

export interface GridLayout {
  days: DayIndex[]
  startMin: number
  endMin: number
  /** ساعت‌های تمامِ محور، برای برچسب و خط راهنما */
  hourMarks: number[]
  heightPx: number
  blocksByDay: Map<DayIndex, LaidOutBlock[]>
}

const DEFAULT_START = 7 * 60
const DEFAULT_END = 20 * 60

export interface LayoutOptions {
  pxPerMin: number
  /** روزهای بدون کلاس هم نشان داده شوند؟ */
  allDays?: DayIndex[]
}

/**
 * چیدمان جدول هفتگی: فقط روزهایی که کلاس دارند، محور ساعت از اولین تا آخرین کلاس
 * (با کمی حاشیه) و کنار‌هم‌گذاریِ بلاک‌های متداخل در «لِین»های جداگانه.
 */
export function layoutWeek(placed: PlacedSession[], options: LayoutOptions): GridLayout {
  const { pxPerMin } = options
  const present = new Set<DayIndex>()
  for (const p of placed) present.add(p.session.day)
  // پیش‌فرض: فقط روزهایی که کلاس دارند. allDays برای وقتی است که صفحه می‌خواهد
  // ستون‌های ثابت داشته باشد (مثل حالت دستی، تا ستون‌ها موقع تغییر گروه نجهند).
  const shownDays = options.allDays ?? Array.from(present).sort((a, b) => a - b)

  let minStart = Number.POSITIVE_INFINITY
  let maxEnd = Number.NEGATIVE_INFINITY
  for (const p of placed) {
    minStart = Math.min(minStart, toMinutes(p.session.start))
    maxEnd = Math.max(maxEnd, toMinutes(p.session.end))
  }
  if (!Number.isFinite(minStart)) {
    minStart = DEFAULT_START
    maxEnd = DEFAULT_END
  }
  // گرد کردن به ساعت کامل، با نیم‌ساعت حاشیه
  const startMin = Math.max(0, Math.floor((minStart - 30) / 60) * 60)
  const endMin = Math.min(24 * 60, Math.ceil((maxEnd + 30) / 60) * 60)

  const hourMarks: number[] = []
  for (let m = startMin; m <= endMin; m += 60) hourMarks.push(m)

  const blocksByDay = new Map<DayIndex, LaidOutBlock[]>()
  for (const day of shownDays) {
    const items = placed
      .filter((p) => p.session.day === day)
      .sort((a, b) => toMinutes(a.session.start) - toMinutes(b.session.start))
    blocksByDay.set(day, assignLanes(items, startMin, pxPerMin))
  }

  return {
    days: shownDays,
    startMin,
    endMin,
    hourMarks,
    heightPx: (endMin - startMin) * pxPerMin,
    blocksByDay,
  }
}

/**
 * بلاک‌های متداخل یک روز را در ستون‌های موازی می‌چیند تا هیچ‌کدام پنهان نشوند.
 * (در حالت دستی تداخل مجاز است، پس باید هر دو دیده شوند.)
 */
function assignLanes(items: PlacedSession[], startMin: number, pxPerMin: number): LaidOutBlock[] {
  // خوشه‌بندی: بلاک‌هایی که زنجیره‌وار روی هم می‌افتند یک خوشه‌اند
  const clusters: PlacedSession[][] = []
  let current: PlacedSession[] = []
  let clusterEnd = -1
  for (const item of items) {
    const s = toMinutes(item.session.start)
    if (current.length > 0 && s < clusterEnd) {
      current.push(item)
      clusterEnd = Math.max(clusterEnd, toMinutes(item.session.end))
    } else {
      if (current.length) clusters.push(current)
      current = [item]
      clusterEnd = toMinutes(item.session.end)
    }
  }
  if (current.length) clusters.push(current)

  const out: LaidOutBlock[] = []
  for (const cluster of clusters) {
    const laneEnds: number[] = []
    const laneOf = new Map<PlacedSession, number>()
    for (const item of cluster) {
      const s = toMinutes(item.session.start)
      const e = toMinutes(item.session.end)
      let lane = laneEnds.findIndex((end) => end <= s)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(e)
      } else {
        laneEnds[lane] = e
      }
      laneOf.set(item, lane)
    }
    const lanes = laneEnds.length
    for (const item of cluster) {
      const lane = laneOf.get(item) ?? 0
      const s = toMinutes(item.session.start)
      const e = toMinutes(item.session.end)
      out.push({
        placed: item,
        topPx: (s - startMin) * pxPerMin,
        heightPx: Math.max(14, (e - s) * pxPerMin),
        widthPct: 100 / lanes,
        leftPct: (lane * 100) / lanes,
      })
    }
  }
  return out
}

/** رنگِ ملایمِ هر درس — از کد درس، پایدار و بی‌درخشش */
export function courseTint(code: string): string {
  let hash = 0
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) % 360
  return `hsl(${hash} 24% 52%)`
}
