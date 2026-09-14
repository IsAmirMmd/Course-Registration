import type { DayIndex } from '../types'
import { normalizeFa } from './digits'

export const DAY_NAMES: Record<DayIndex, string> = {
  0: 'شنبه',
  1: 'یک‌شنبه',
  2: 'دوشنبه',
  3: 'سه‌شنبه',
  4: 'چهارشنبه',
  5: 'پنج‌شنبه',
  6: 'جمعه',
}

export const DAY_SHORT: Record<DayIndex, string> = {
  0: 'ش', 1: 'ی', 2: 'د', 3: 'س', 4: 'چ', 5: 'پ', 6: 'ج',
}

export const ALL_DAYS: DayIndex[] = [0, 1, 2, 3, 4, 5, 6]

/**
 * الگوهای نام روز، از بلند به کوتاه.
 * ترتیب مهم است: «شنبه» پسوندِ «یکشنبه» است، پس باید آخر بیاید.
 */
const DAY_PATTERNS: Array<readonly [string, DayIndex]> = [
  ['چهارشنبه', 4],
  ['پنجشنبه', 5],
  ['یکشنبه', 1],
  ['دوشنبه', 2],
  ['سهشنبه', 3],
  ['جمعه', 6],
  ['شنبه', 0],
]

/** متن را برای تطبیق نام روز آماده می‌کند: بی‌فاصله، بی‌نیم‌فاصله، ی/ک یکسان */
function flatten(text: string): string {
  return normalizeFa(text).replace(/\s/g, '')
}

/**
 * همه‌ی نام‌های روز در متن، به ترتیب ظهور.
 * از چپ به راست اسکن می‌کند و در هر جا بلندترین الگوی ممکن را می‌گیرد،
 * تا «یکشنبه» به اشتباه «شنبه» خوانده نشود.
 */
export function scanDays(text: string): Array<{ day: DayIndex; index: number }> {
  const flat = flatten(text)
  const hits: Array<{ day: DayIndex; index: number }> = []
  let i = 0
  while (i < flat.length) {
    let step = 1
    for (const [name, day] of DAY_PATTERNS) {
      if (flat.startsWith(name, i)) {
        hits.push({ day, index: i })
        step = name.length
        break
      }
    }
    i += step
  }
  return hits
}

/** نام روز فارسی → ایندکس عددی (اولین تطابق) */
export function parseDayName(text: string): DayIndex | null {
  return scanDays(text)[0]?.day ?? null
}

/** اولین نام روز در متن، همراه با محل آن */
export function findDay(text: string): { day: DayIndex; index: number } | null {
  return scanDays(text)[0] ?? null
}

/** آخرین (نزدیک‌ترین به انتهای متن) نام روز — برای نسبت‌دادن روز به ساعتِ بعد از آن */
export function lastDay(text: string): DayIndex | null {
  const hits = scanDays(text)
  return hits.length ? hits[hits.length - 1].day : null
}
