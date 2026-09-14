import type { Course, Picks } from '../types'
import type { AuditReport } from './parseAudit'

const KEY = 'scheduleplanner.v1'

export type PlannerMode = 'auto' | 'manual'

export interface PlannerState {
  courses: Course[]
  selected: string[]
  manualPicks: Picks
  mode: PlannerMode
  considerExams: boolean
  /** کارنامه‌ی تطبیقِ خوانده‌شده (بدون هیچ داده‌ی هویتی) */
  audit: AuditReport | null
}

export interface BackupFile {
  app: 'SchedulePlanner'
  version: 1
  savedAt: string
  state: PlannerState
}

export function loadState(): Partial<PlannerState> | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PlannerState>
    return sanitize(parsed)
  } catch {
    return null
  }
}

export function saveState(state: PlannerState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* حافظه پر است یا دسترسی نداریم — بی‌سر‌و‌صدا رد می‌شویم */
  }
}

function sanitize(input: Partial<PlannerState>): Partial<PlannerState> {
  const out: Partial<PlannerState> = {}
  if (Array.isArray(input.courses)) out.courses = input.courses
  if (Array.isArray(input.selected)) out.selected = input.selected.filter((s) => typeof s === 'string')
  if (input.manualPicks && typeof input.manualPicks === 'object') out.manualPicks = input.manualPicks
  if (input.mode === 'auto' || input.mode === 'manual') out.mode = input.mode
  if (typeof input.considerExams === 'boolean') out.considerExams = input.considerExams
  if (input.audit && typeof input.audit === 'object' && Array.isArray(input.audit.groups)) {
    out.audit = input.audit
  }
  return out
}

export function buildBackup(state: PlannerState): BackupFile {
  return { app: 'SchedulePlanner', version: 1, savedAt: new Date().toISOString(), state }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** خواندن فایل پشتیبان؛ هم فایل کامل و هم فقط آرایه‌ی درس‌ها را می‌پذیرد */
export function readBackup(text: string): Partial<PlannerState> {
  const parsed: unknown = JSON.parse(text)
  if (Array.isArray(parsed)) return { courses: parsed as Course[] }
  const obj = parsed as Record<string, unknown>
  if (obj && typeof obj === 'object' && obj.state) {
    return sanitize(obj.state as Partial<PlannerState>)
  }
  return sanitize(obj as Partial<PlannerState>)
}
