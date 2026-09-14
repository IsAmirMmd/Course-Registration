import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Course, Picks } from './types'
import { SEED_COURSES } from './data/seed'
import { toFaDigits } from './lib/digits'
import {
  buildBackup,
  downloadJson,
  loadState,
  readBackup,
  saveState,
  type PlannerMode,
  type PlannerState,
} from './lib/storage'
import { ImportPage } from './pages/ImportPage'
import { CoursesPage } from './pages/CoursesPage'
import { SchedulePage } from './pages/SchedulePage'
import { Notice } from './components/ui'
import './App.css'

type Tab = 'import' | 'courses' | 'schedule'

export default function App() {
  // localStorage فقط یک بار، در همان اولین رندر، خوانده می‌شود
  const [restored] = useState(loadState)

  const [courses, setCourses] = useState<Course[]>(() => restored?.courses ?? SEED_COURSES)
  const [selected, setSelected] = useState<string[]>(() => restored?.selected ?? [])
  const [manualPicks, setManualPicks] = useState<Picks>(() => restored?.manualPicks ?? {})
  const [mode, setMode] = useState<PlannerMode>(() => restored?.mode ?? 'auto')
  const [considerExams, setConsiderExams] = useState(() => restored?.considerExams ?? true)
  const [tab, setTab] = useState<Tab>(() => (restored?.selected?.length ? 'schedule' : 'courses'))
  const [flash, setFlash] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const state: PlannerState = useMemo(
    () => ({ courses, selected, manualPicks, mode, considerExams }),
    [courses, selected, manualPicks, mode, considerExams],
  )

  useEffect(() => {
    saveState(state)
  }, [state])

  const selectedCourses = useMemo(() => {
    const set = new Set(selected)
    return courses.filter((c) => set.has(c.code))
  }, [courses, selected])

  const toggleCourse = useCallback((code: string) => {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }, [])

  const dropCourse = useCallback((code: string) => {
    setSelected((prev) => prev.filter((c) => c !== code))
  }, [])

  const pickGroup = useCallback((courseCode: string, groupId: string) => {
    setManualPicks((prev) => {
      const next = { ...prev }
      if (groupId) next[courseCode] = groupId
      else delete next[courseCode]
      return next
    })
  }, [])

  const replaceCourses = useCallback((next: Course[]) => {
    setCourses(next)
    // انتخاب‌هایی که دیگر وجود ندارند پاک می‌شوند
    const codes = new Set(next.map((c) => c.code))
    setSelected((prev) => prev.filter((c) => codes.has(c)))
    setManualPicks((prev) => {
      const validIds = new Set(next.flatMap((c) => c.groups.map((g) => g.id)))
      return Object.fromEntries(Object.entries(prev).filter(([, id]) => validIds.has(id)))
    })
  }, [])

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = readBackup(await file.text())
      if (data.courses) replaceCourses(data.courses)
      if (data.selected) setSelected(data.selected)
      if (data.manualPicks) setManualPicks(data.manualPicks)
      if (data.mode) setMode(data.mode)
      if (typeof data.considerExams === 'boolean') setConsiderExams(data.considerExams)
      setFlash('پشتیبان با موفقیت بازگردانی شد.')
    } catch {
      setFlash('فایل پشتیبان خوانده نشد — مطمئن شوید JSON معتبر است.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const resetToSeed = () => {
    if (!confirm('فهرست درس‌ها به داده‌ی پیش‌فرض دانشگاه برگردد؟ انتخاب‌های شما پاک می‌شود.')) return
    replaceCourses(SEED_COURSES)
    setSelected([])
    setManualPicks({})
    setFlash('فهرست درس‌ها به داده‌ی پیش‌فرض برگشت.')
  }

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 6000)
    return () => clearTimeout(t)
  }, [flash])

  const tabs: Array<{ id: Tab; label: string; badge?: string }> = [
    { id: 'import', label: 'افزودن درس‌ها', badge: toFaDigits(courses.length) },
    { id: 'courses', label: 'انتخاب درس‌ها', badge: toFaDigits(selected.length) },
    { id: 'schedule', label: 'برنامه‌ی هفتگی' },
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {/* نشان: شبکه‌ی کوچکِ خودِ جدول هفتگی، با چند خانه‌ی پرشده */}
          <span className="brand__mark" aria-hidden="true">
            <i className="on" />
            <i />
            <i className="on" />
            <i />
            <i className="on" />
            <i />
            <i className="on" />
            <i className="on" />
            <i />
          </span>
          <span className="brand__text">
            <h1 className="brand__title">برنامه‌ریز هفتگی انتخاب واحد</h1>
            <span className="brand__sub">
              چیدن برنامه‌ی بدون تداخل — کاملاً روی مرورگر خودتان، بدون سرور
            </span>
          </span>
        </div>
        <span className="spacer" />
        <nav className="tabs" aria-label="بخش‌های برنامه">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tabs__btn${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.label}
              {t.badge && <span className="tabs__badge num">{t.badge}</span>}
            </button>
          ))}
        </nav>
      </header>

      {flash && (
        <div style={{ marginBottom: 16 }}>
          <Notice kind="info">{flash}</Notice>
        </div>
      )}

      {tab === 'import' && (
        <ImportPage courses={courses} onSave={replaceCourses} onGoNext={() => setTab('courses')} />
      )}

      {tab === 'courses' && (
        <CoursesPage
          courses={courses}
          selected={selected}
          onToggle={toggleCourse}
          onClear={() => setSelected([])}
          onGoNext={() => setTab('schedule')}
        />
      )}

      {tab === 'schedule' && (
        <SchedulePage
          selectedCourses={selectedCourses}
          mode={mode}
          onModeChange={setMode}
          manualPicks={manualPicks}
          onManualPick={pickGroup}
          considerExams={considerExams}
          onConsiderExamsChange={setConsiderExams}
          onDropCourse={dropCourse}
          onGoCourses={() => setTab('courses')}
        />
      )}

      <footer className="footer-note">
        <div className="row row--wrap" style={{ justifyContent: 'center', marginBottom: 10 }}>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => downloadJson('scheduleplanner-backup.json', buildBackup(state))}
          >
            خروجی JSON (پشتیبان)
          </button>
          <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()}>
            بازگردانی از JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => void onImportFile(e.target.files?.[0])}
          />
          <button type="button" className="btn btn--sm" onClick={resetToSeed}>
            بازگشت به داده‌ی پیش‌فرض
          </button>
        </div>
        داده‌ها فقط در حافظه‌ی مرورگر شما (localStorage) ذخیره می‌شوند.
        <br />
        داده‌ی پیش‌فرض: دروس ارائه‌شده‌ی نیمسال اول ۱۴۰۵–۱۴۰۶، دانشگاه صنعتی نوشیروانی بابل
        ({toFaDigits(SEED_COURSES.length)} درس، {toFaDigits(SEED_COURSES.reduce((n, c) => n + c.groups.length, 0))} گروه).
      </footer>
    </div>
  )
}
