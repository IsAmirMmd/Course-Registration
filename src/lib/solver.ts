import type { Course, Group, Picks, Session } from '../types'
import { examsOverlap, firstOverlap, groupsOverlap } from './conflicts'

export interface Combination {
  /** کد درس → گروه انتخاب‌شده */
  picks: Picks
}

export interface SolveResult {
  combinations: Combination[]
  /** آیا به سقف رسیدیم و ترکیب‌های بیشتری هم وجود دارد؟ */
  truncated: boolean
  /** تعداد گره‌های بررسی‌شده (برای شفافیت عملکرد) */
  visited: number
}

export interface SolveOptions {
  /** حداکثر تعداد ترکیبِ تولیدی */
  limit?: number
  /** تداخل تاریخ امتحان هم مانع شود؟ */
  considerExams?: boolean
}

/** سقف پیش‌فرض: بیشتر از این در عمل برای کاربر بی‌فایده است و حافظه می‌برد */
const DEFAULT_LIMIT = 500

/**
 * تولید ترکیب‌های بدون تداخل با عقب‌گرد (backtracking).
 * درس‌ها به ترتیب کم‌ترین تعداد گروه چیده می‌شوند (fail-fast) و هر گروه پیش از
 * پذیرش فقط با گروه‌های همین شاخه سنجیده می‌شود؛ پس هیچ‌وقت ضرب دکارتیِ کامل
 * ساخته نمی‌شود.
 */
export function solve(courses: Course[], options: SolveOptions = {}): SolveResult {
  const limit = options.limit ?? DEFAULT_LIMIT
  const considerExams = options.considerExams ?? false
  const combinations: Combination[] = []
  let visited = 0
  let truncated = false

  const ordered = [...courses].sort((a, b) => a.groups.length - b.groups.length)
  if (ordered.some((c) => c.groups.length === 0)) {
    return { combinations: [], truncated: false, visited: 0 }
  }

  const chosen: Array<{ course: Course; group: Group }> = []

  const compatible = (course: Course, group: Group): boolean => {
    for (const prev of chosen) {
      if (groupsOverlap(prev.group, group)) return false
      if (considerExams && examsOverlap(prev.course, course)) return false
    }
    return true
  }

  const step = (depth: number): void => {
    if (combinations.length >= limit) {
      truncated = true
      return
    }
    if (depth === ordered.length) {
      const picks: Picks = {}
      for (const { course, group } of chosen) picks[course.code] = group.id
      combinations.push({ picks })
      return
    }
    const course = ordered[depth]
    for (const group of course.groups) {
      visited++
      if (!compatible(course, group)) continue
      chosen.push({ course, group })
      step(depth + 1)
      chosen.pop()
      if (combinations.length >= limit) {
        truncated = true
        return
      }
    }
  }

  step(0)
  return { combinations, truncated, visited }
}

/** آیا این مجموعه درس دست‌کم یک ترکیب دارد؟ (ارزان‌تر از شمردن همه) */
function isFeasible(courses: Course[], considerExams: boolean): boolean {
  return solve(courses, { limit: 1, considerExams }).combinations.length > 0
}

/* ─────────────────────────── تشخیص علتِ «ترکیبی نیست» ─────────────────────────── */

export interface BlockingPair {
  courseA: Course
  courseB: Course
  /** نمونه‌ی تداخل برای هر جفت‌گروه، تا کاربر دقیقاً مقصر را ببیند */
  samples: Array<{
    groupA: Group
    groupB: Group
    sessionA: Session
    sessionB: Session
  }>
  reason: 'time' | 'exam'
}

export interface Diagnosis {
  /** درس‌هایی که هیچ گروهی ندارند */
  emptyCourses: Course[]
  /** جفت‌درس‌هایی که هیچ ترکیبی از گروه‌هایشان با هم جمع نمی‌شود */
  blockingPairs: BlockingPair[]
  /** کم‌ترین مجموعه‌ی درسی که اگر حذف شود بقیه جواب می‌دهند */
  dropSuggestions: Course[][]
  /** بزرگ‌ترین زیرمجموعه‌ی شدنی (تعداد درس) */
  maxFeasibleSize: number
}

/**
 * وقتی هیچ ترکیبی پیدا نشد، دقیقاً مقصر را پیدا می‌کند:
 *  ۱) درس بدون گروه
 *  ۲) جفت‌درس‌هایی که همه‌ی گروه‌هایشان دوبه‌دو تداخل دارند (علت قطعی)
 *  ۳) کوچک‌ترین مجموعه‌ای که حذفش مسئله را حل می‌کند
 */
export function diagnose(courses: Course[], considerExams = false): Diagnosis {
  const emptyCourses = courses.filter((c) => c.groups.length === 0)
  const usable = courses.filter((c) => c.groups.length > 0)

  const blockingPairs: BlockingPair[] = []
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i]
      const b = usable[j]
      const samples: BlockingPair['samples'] = []
      let allClash = true
      let examOnly = true
      for (const ga of a.groups) {
        for (const gb of b.groups) {
          const timeClash = groupsOverlap(ga, gb)
          const examClash = considerExams && examsOverlap(a, b)
          if (!timeClash && !examClash) {
            allClash = false
            break
          }
          if (timeClash) {
            examOnly = false
            const ov = firstOverlap(ga, gb)
            if (ov && samples.length < 6) {
              samples.push({ groupA: ga, groupB: gb, sessionA: ov.a, sessionB: ov.b })
            }
          }
        }
        if (!allClash) break
      }
      if (allClash) {
        blockingPairs.push({ courseA: a, courseB: b, samples, reason: examOnly ? 'exam' : 'time' })
      }
    }
  }

  const { drops, maxSize } = findMinimalDrops(usable, considerExams)
  return {
    emptyCourses,
    blockingPairs,
    dropSuggestions: drops,
    maxFeasibleSize: maxSize,
  }
}

/**
 * کوچک‌ترین مجموعه‌های حذفی را پیدا می‌کند: اول تک‌درس، بعد دو‌درس، ...
 * جست‌وجو به عمق ۳ و تعداد پیشنهاد محدود است تا روی داده‌ی واقعی سریع بماند.
 */
function findMinimalDrops(
  courses: Course[],
  considerExams: boolean,
  maxDrop = 3,
  maxSuggestions = 6,
): { drops: Course[][]; maxSize: number } {
  if (courses.length === 0) return { drops: [], maxSize: 0 }
  if (isFeasible(courses, considerExams)) return { drops: [], maxSize: courses.length }

  for (let k = 1; k <= Math.min(maxDrop, courses.length - 1); k++) {
    const found: Course[][] = []
    const combo: number[] = []
    const walk = (start: number): void => {
      if (found.length >= maxSuggestions) return
      if (combo.length === k) {
        const keep = courses.filter((_, i) => !combo.includes(i))
        if (keep.length > 0 && isFeasible(keep, considerExams)) {
          found.push(combo.map((i) => courses[i]))
        }
        return
      }
      for (let i = start; i < courses.length; i++) {
        combo.push(i)
        walk(i + 1)
        combo.pop()
        if (found.length >= maxSuggestions) return
      }
    }
    walk(0)
    if (found.length > 0) return { drops: found, maxSize: courses.length - k }
  }
  return { drops: [], maxSize: 0 }
}

/* ──────────────── گروه‌های جایگزین، علامت‌خورده بر اساس تداخل ──────────────── */

export interface AlternativeGroup {
  group: Group
  /** با بقیه‌ی برنامه (به‌جز خود این درس) تداخل دارد؟ */
  conflicts: boolean
  /** با کدام درس/گروه‌ها تداخل دارد */
  conflictsWith: Array<{ course: Course; group: Group; sessionA: Session; sessionB: Session }>
  isCurrent: boolean
}

/**
 * برای یک درس، همه‌ی گروه‌هایش را در کنار برنامه‌ی فعلی می‌سنجد؛
 * پایه‌ی کارتِ «گروه‌های جایگزین» در صفحه‌ی جدول.
 */
export function alternativesFor(course: Course, courses: Course[], picks: Picks): AlternativeGroup[] {
  const others = courses
    .filter((c) => c.code !== course.code && picks[c.code])
    .map((c) => ({ course: c, group: c.groups.find((g) => g.id === picks[c.code]) }))
    .filter((x): x is { course: Course; group: Group } => Boolean(x.group))

  return course.groups.map((group) => {
    const conflictsWith: AlternativeGroup['conflictsWith'] = []
    for (const other of others) {
      const ov = firstOverlap(group, other.group)
      if (ov) conflictsWith.push({ course: other.course, group: other.group, sessionA: ov.a, sessionB: ov.b })
    }
    return {
      group,
      conflicts: conflictsWith.length > 0,
      conflictsWith,
      isCurrent: picks[course.code] === group.id,
    }
  })
}
