import type { Course, Picks } from '../types'
import { toFaDigits } from './digits'
import type { AuditReport } from './parseAudit'
import type { PlannerMode } from './storage'

/**
 * «برنامه‌ی ذخیره‌شده»: یک عکسِ فوری از انتخاب‌های کاربر، نه از فهرست درس‌ها.
 * فهرست درس‌ها (کاتالوگ) مشترک است و بین برنامه‌ها جابه‌جا نمی‌شود؛ هر برنامه فقط
 * می‌گوید «کدام درس‌ها، کدام گروه‌ها، و با چه تنظیماتی». کارنامه هم داخل برنامه
 * می‌ماند تا وقتی برای یک نفر دیگر برنامه می‌چینید، کارنامه‌ی خودتان از بین نرود.
 */
export interface SavedPlan extends PlanSnapshot {
  id: string
  name: string
  /** ISO 8601 */
  createdAt: string
  updatedAt: string
}

/** همان بخشی از وضعیت که به یک برنامه تعلق دارد */
export interface PlanSnapshot {
  selected: string[]
  manualPicks: Picks
  mode: PlannerMode
  considerExams: boolean
  audit: AuditReport | null
}

export function newPlanId(): string {
  // فقط برای کلیدِ محلی است، نه امنیت؛ ولی باید بین دو ذخیره‌ی پشت‌سرهم یکتا باشد.
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * عکسِ فوری را به شکل متعارف درمی‌آورد تا مقایسه‌ی «تغییر کرده یا نه» پایدار باشد:
 * ترتیبِ انتخاب‌ها بی‌اهمیت است و گروه‌های دستیِ درس‌های انتخاب‌نشده به حساب نمی‌آیند.
 */
export function normalizeSnapshot(snap: PlanSnapshot): PlanSnapshot {
  const selected = [...new Set(snap.selected)].sort()
  const keep = new Set(selected)
  const manualPicks: Picks = {}
  for (const code of Object.keys(snap.manualPicks).sort()) {
    if (keep.has(code)) manualPicks[code] = snap.manualPicks[code]
  }
  return { selected, manualPicks, mode: snap.mode, considerExams: snap.considerExams, audit: snap.audit }
}

/**
 * امضای کارنامه — برای تشخیصِ تغییر، نه برای بازسازی. مقایسه‌ی کاملِ JSON در هر
 * رندر گران است و این چند عدد برای فرق‌گذاشتن بین دو کارنامه کافی‌اند.
 */
function auditSignature(audit: AuditReport | null): string {
  if (!audit) return '-'
  const s = audit.summary
  return [
    audit.groups.length,
    audit.passedCount,
    Object.keys(audit.status).length,
    s.field ?? '',
    s.gpa ?? '',
    s.passedCredits ?? '',
  ].join('/')
}

export function snapshotSignature(snap: PlanSnapshot): string {
  const n = normalizeSnapshot(snap)
  const picks = Object.entries(n.manualPicks)
    .map(([code, id]) => `${code}=${id}`)
    .join(',')
  return `${n.selected.join(',')}|${picks}|${n.mode}|${n.considerExams}|${auditSignature(n.audit)}`
}

export function isSameSnapshot(a: PlanSnapshot, b: PlanSnapshot): boolean {
  return snapshotSignature(a) === snapshotSignature(b)
}

export function makePlan(name: string, snap: PlanSnapshot): SavedPlan {
  const now = new Date().toISOString()
  return { id: newPlanId(), name, createdAt: now, updatedAt: now, ...normalizeSnapshot(snap) }
}

export function withSnapshot(plan: SavedPlan, snap: PlanSnapshot): SavedPlan {
  return { ...plan, ...normalizeSnapshot(snap), updatedAt: new Date().toISOString() }
}

/** نامِ یکتا: «برنامه‌ی من» → «برنامه‌ی من ۲» اگر تکراری بود */
export function uniqueName(name: string, plans: SavedPlan[], exceptId?: string): string {
  const trimmed = name.trim() || 'برنامه‌ی بی‌نام'
  const taken = new Set(plans.filter((p) => p.id !== exceptId).map((p) => p.name))
  if (!taken.has(trimmed)) return trimmed
  for (let i = 2; ; i++) {
    const candidate = `${trimmed} ${toFaDigits(i)}`
    if (!taken.has(candidate)) return candidate
  }
}

/** نامِ پیشنهادی برای برنامه‌ی تازه: «برنامه‌ی ۱»، «برنامه‌ی ۲»… */
export function suggestName(plans: SavedPlan[]): string {
  return uniqueName(`برنامه‌ی ${toFaDigits(plans.length + 1)}`, plans)
}

export interface PlanStats {
  courses: number
  credits: number
}

export function planStats(plan: PlanSnapshot, catalogue: Course[]): PlanStats {
  const byCode = new Map(catalogue.map((c) => [c.code, c]))
  let credits = 0
  let courses = 0
  for (const code of plan.selected) {
    const course = byCode.get(code)
    if (!course) continue
    courses++
    credits += course.credits
  }
  return { courses, credits }
}

/* ─────────────────────── خواندنِ امنِ داده‌ی ذخیره‌شده ─────────────────────── */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * localStorage هرچه باشد ممکن است دست‌کاری‌شده یا از نسخه‌ی قدیمی باشد؛ هر
 * برنامه‌ای که شکلش درست نباشد کنار گذاشته می‌شود، نه اینکه کلِ حافظه دور ریخته شود.
 */
export function sanitizePlans(input: unknown): SavedPlan[] {
  if (!Array.isArray(input)) return []
  const out: SavedPlan[] = []
  const seen = new Set<string>()
  for (const item of input) {
    if (!isPlainObject(item)) continue
    const { id, name, selected, manualPicks, mode, considerExams, audit, createdAt, updatedAt } = item
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    if (typeof name !== 'string') continue
    if (!Array.isArray(selected)) continue
    seen.add(id)
    const picks: Picks = {}
    if (isPlainObject(manualPicks)) {
      for (const [code, groupId] of Object.entries(manualPicks)) {
        if (typeof groupId === 'string') picks[code] = groupId
      }
    }
    out.push({
      id,
      name,
      createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
      updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date().toISOString(),
      selected: selected.filter((s): s is string => typeof s === 'string'),
      manualPicks: picks,
      mode: mode === 'manual' ? 'manual' : 'auto',
      considerExams: considerExams !== false,
      audit: isPlainObject(audit) && Array.isArray(audit.groups) ? (audit as unknown as AuditReport) : null,
    })
  }
  return out
}
