import type { Course, Group, PlacedSession, Picks, Session } from '../types'
import { rangesOverlap, toMinutes } from './time'

export interface SessionClash {
  a: PlacedSession
  b: PlacedSession
}

/** دو جلسه در یک روز روی هم می‌افتند؟ */
export function sessionsOverlap(a: Session, b: Session): boolean {
  if (a.day !== b.day) return false
  return rangesOverlap(toMinutes(a.start), toMinutes(a.end), toMinutes(b.start), toMinutes(b.end))
}

/** آیا دو گروه (از دو درس مختلف) تداخل زمانی کلاس دارند؟ */
export function groupsOverlap(a: Group, b: Group): boolean {
  for (const sa of a.sessions) {
    for (const sb of b.sessions) {
      if (sessionsOverlap(sa, sb)) return true
    }
  }
  return false
}

/** اولین جفت جلسه‌ی متداخل بین دو گروه (برای پیام خطا) */
export function firstOverlap(a: Group, b: Group): { a: Session; b: Session } | null {
  for (const sa of a.sessions) {
    for (const sb of b.sessions) {
      if (sessionsOverlap(sa, sb)) return { a: sa, b: sb }
    }
  }
  return null
}

/** تداخل تاریخ/ساعت امتحان دو درس */
export function examsOverlap(a: Course, b: Course): boolean {
  if (!a.exam || !b.exam) return false
  if (a.exam.date !== b.exam.date) return false
  const [as, ae] = a.exam.time.split('-')
  const [bs, be] = b.exam.time.split('-')
  if (!as || !ae || !bs || !be) return a.exam.time === b.exam.time
  return rangesOverlap(toMinutes(as), toMinutes(ae), toMinutes(bs), toMinutes(be))
}

/** همه‌ی جلسه‌های یک انتخاب، به‌همراه درس و گروهشان */
export function placedSessions(courses: Course[], picks: Picks): PlacedSession[] {
  const out: PlacedSession[] = []
  for (const course of courses) {
    const groupId = picks[course.code]
    if (!groupId) continue
    const group = course.groups.find((g) => g.id === groupId)
    if (!group) continue
    for (const session of group.sessions) {
      out.push({ session, course, group })
    }
  }
  return out
}

/** همه‌ی تداخل‌های کلاسی داخل یک انتخاب */
export function findClashes(placed: PlacedSession[]): SessionClash[] {
  const clashes: SessionClash[] = []
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      if (a.course.code === b.course.code) continue
      if (sessionsOverlap(a.session, b.session)) clashes.push({ a, b })
    }
  }
  return clashes
}

/** کلید یکتای هر جلسه، برای علامت‌زدن بلاک‌های متداخل در جدول */
export function sessionKey(p: PlacedSession): string {
  return `${p.group.id}|${p.session.day}|${p.session.start}|${p.session.end}`
}

/** مجموعه‌ی کلید جلسه‌هایی که در تداخل‌اند */
export function clashingSessionKeys(placed: PlacedSession[]): Set<string> {
  const keys = new Set<string>()
  for (const { a, b } of findClashes(placed)) {
    keys.add(sessionKey(a))
    keys.add(sessionKey(b))
  }
  return keys
}

export interface ExamClash {
  a: Course
  b: Course
}

/** تداخل امتحان‌ها در یک انتخاب */
export function findExamClashes(courses: Course[], picks: Picks): ExamClash[] {
  const chosen = courses.filter((c) => picks[c.code])
  const out: ExamClash[] = []
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      if (examsOverlap(chosen[i], chosen[j])) out.push({ a: chosen[i], b: chosen[j] })
    }
  }
  return out
}

export function totalCredits(courses: Course[]): number {
  return courses.reduce((sum, c) => sum + (c.credits || 0), 0)
}
