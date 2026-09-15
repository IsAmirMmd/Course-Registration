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
import type { AuditReport } from './lib/parseAudit'
import {
  isSameSnapshot,
  makePlan,
  uniqueName,
  withSnapshot,
  type PlanSnapshot,
  type SavedPlan,
} from './lib/plans'
import { PlanBar } from './components/PlanBar'
import { LoginDialog } from './components/LoginDialog'
import { clearIdentity, fullName, loadIdentity, saveIdentity, type Identity } from './lib/identity'
import {
  buildSignInMessage,
  enqueue,
  flushQueue,
  loadQueue,
  telegramConfig,
} from './lib/notify'
import { ImportPage } from './pages/ImportPage'
import { CoursesPage } from './pages/CoursesPage'
import { SchedulePage } from './pages/SchedulePage'
import { AuditPage } from './pages/AuditPage'
import { Notice } from './components/ui'
import './App.css'

type Tab = 'import' | 'audit' | 'courses' | 'schedule'

/** شمارشِ ورودها، فقط برای اینکه پیامِ تلگرام بگوید چندمین بار است */
const VISITS_KEY = 'scheduleplanner.visits.v1'

export default function App() {
  // localStorage فقط یک بار، در همان اولین رندر، خوانده می‌شود
  const [restored] = useState(loadState)

  const [courses, setCourses] = useState<Course[]>(() => restored?.courses ?? SEED_COURSES)
  const [selected, setSelected] = useState<string[]>(() => restored?.selected ?? [])
  const [manualPicks, setManualPicks] = useState<Picks>(() => restored?.manualPicks ?? {})
  const [mode, setMode] = useState<PlannerMode>(() => restored?.mode ?? 'auto')
  const [considerExams, setConsiderExams] = useState(() => restored?.considerExams ?? true)
  const [audit, setAudit] = useState<AuditReport | null>(() => restored?.audit ?? null)
  const [plans, setPlans] = useState<SavedPlan[]>(() => restored?.plans ?? [])
  const [activePlanId, setActivePlanId] = useState<string | null>(
    () => restored?.activePlanId ?? null,
  )
  const [tab, setTab] = useState<Tab>(() => (restored?.selected?.length ? 'schedule' : 'courses'))
  const [flash, setFlash] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /* ── قفلِ ورود ───────────────────────────────────────────────────────────
     تا نام و نام خانوادگی در localStorage نباشد، هیچ صفحه‌ای رندر نمی‌شود. */
  const [identity, setIdentity] = useState<Identity | null>(loadIdentity)
  const [editingName, setEditingName] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const state: PlannerState = useMemo(
    () => ({ courses, selected, manualPicks, mode, considerExams, audit, plans, activePlanId }),
    [courses, selected, manualPicks, mode, considerExams, audit, plans, activePlanId],
  )

  /* ── برنامه‌های ذخیره‌شده ────────────────────────────────────────────────
     «پیش‌نویس» همان وضعیتِ در‌جریان است؛ یک برنامه‌ی ذخیره‌شده فقط عکسی از آن
     است. کاتالوگِ درس‌ها مشترک می‌ماند و با بازکردنِ برنامه‌ها عوض نمی‌شود. */
  const snapshot: PlanSnapshot = useMemo(
    () => ({ selected, manualPicks, mode, considerExams, audit }),
    [selected, manualPicks, mode, considerExams, audit],
  )
  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) ?? null,
    [plans, activePlanId],
  )
  const dirty = useMemo(
    () =>
      activePlan
        ? !isSameSnapshot(activePlan, snapshot)
        : selected.length > 0 || Object.keys(manualPicks).length > 0,
    [activePlan, snapshot, selected, manualPicks],
  )

  const applySnapshot = useCallback((snap: PlanSnapshot) => {
    setSelected(snap.selected)
    setManualPicks(snap.manualPicks)
    setMode(snap.mode)
    setConsiderExams(snap.considerExams)
    setAudit(snap.audit)
  }, [])

  const savePlan = useCallback(() => {
    if (!activePlanId) return
    setPlans((prev) => prev.map((p) => (p.id === activePlanId ? withSnapshot(p, snapshot) : p)))
    setFlash('تغییرها در برنامه ذخیره شد.')
  }, [activePlanId, snapshot])

  const savePlanAs = useCallback(
    (name: string) => {
      const plan = makePlan(uniqueName(name, plans), snapshot)
      setPlans((prev) => [...prev, plan])
      setActivePlanId(plan.id)
      setFlash(`برنامه‌ی «${plan.name}» ذخیره شد.`)
    },
    [plans, snapshot],
  )

  const openPlan = useCallback(
    (id: string) => {
      const plan = plans.find((p) => p.id === id)
      if (!plan) return
      applySnapshot(plan)
      setActivePlanId(plan.id)
      setFlash(`برنامه‌ی «${plan.name}» باز شد.`)
    },
    [plans, applySnapshot],
  )

  const renamePlan = useCallback((id: string, name: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name: uniqueName(name, prev, id), updatedAt: new Date().toISOString() } : p,
      ),
    )
  }, [])

  const deletePlan = useCallback(
    (id: string) => {
      setPlans((prev) => prev.filter((p) => p.id !== id))
      // حذفِ برنامه‌ی باز، انتخاب‌های روی صفحه را دست‌نخورده می‌گذارد؛ فقط
      // دیگر به جایی وصل نیست و می‌شود آن را با نام تازه ذخیره کرد.
      if (id === activePlanId) setActivePlanId(null)
      setFlash('برنامه حذف شد. انتخاب‌های روی صفحه سر جایشان هستند.')
    },
    [activePlanId],
  )

  const newDraft = useCallback(() => {
    setSelected([])
    setManualPicks({})
    setActivePlanId(null)
    setFlash('پیش‌نویسِ تازه. برنامه‌های ذخیره‌شده دست‌نخورده‌اند.')
  }, [])

  useEffect(() => {
    saveState(state)
  }, [state])

  /**
   * ورود: نام را ذخیره کن و اطلاع‌رسانی را در صف بگذار. فرستادنِ پیام هرگز جلوی
   * ورود را نمی‌گیرد — تلگرام ممکن است در دسترس نباشد، و صف در بارِ بعدی دوباره
   * تلاش می‌کند.
   */
  const signIn = useCallback(
    (next: Identity) => {
      if (!saveIdentity(next)) {
        setLoginError(
          'نام ذخیره نشد. حافظه‌ی مرورگر بسته است؟ (پنجره‌ی ناشناس، یا مسدود‌بودنِ داده‌ی سایت)',
        )
        return
      }
      setLoginError(null)
      const renaming = editingName
      setIdentity(next)
      setEditingName(false)
      if (renaming) {
        setFlash(`نام شما به «${fullName(next)}» تغییر کرد.`)
        return
      }
      let visit = 1
      try {
        visit = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1
        localStorage.setItem(VISITS_KEY, String(visit))
      } catch {
        /* شمارشِ ورود حیاتی نیست */
      }
      enqueue(
        buildSignInMessage(next, {
          userAgent: navigator.userAgent,
          courseCount: courses.length,
          groupCount: courses.reduce((n, c) => n + c.groups.length, 0),
          visit,
        }),
      )
      setFlash(`${fullName(next)} عزیز، خوش آمدید 🎓`)
    },
    [courses, editingName],
  )

  const signOut = useCallback(() => {
    if (
      !confirm(
        'از حساب خارج می‌شوید؟ برنامه‌ها و انتخاب‌هایتان پاک نمی‌شود، ولی برای ادامه باید دوباره نام وارد کنید.',
      )
    )
      return
    clearIdentity()
    setIdentity(null)
    setEditingName(false)
  }, [])

  // صفِ اطلاع‌رسانی را بعد از ورود خالی کن — و در هر بارِ بعدی، اگر چیزی مانده
  useEffect(() => {
    if (!identity) return
    const cfg = telegramConfig()
    if (!cfg || loadQueue().length === 0) return
    let cancelled = false
    void flushQueue(cfg).then(({ left }) => {
      if (!cancelled && left > 0) {
        setFlash('اطلاع‌رسانیِ ورود به تلگرام نرسید؛ در بارِ بعدی دوباره تلاش می‌شود.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [identity])

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
      if (data.audit !== undefined) setAudit(data.audit)
      if (data.plans) setPlans(data.plans)
      if (data.activePlanId !== undefined) setActivePlanId(data.activePlanId)
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
    {
      id: 'audit',
      label: 'کارنامه',
      badge: audit ? toFaDigits(audit.passedCount) : undefined,
    },
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
        {identity && (
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
        )}
      </header>

      {flash && (
        <div style={{ marginBottom: 16 }}>
          <Notice kind="info">{flash}</Notice>
        </div>
      )}

      {/* بدونِ هویت، هیچ صفحه‌ای رندر نمی‌شود — نه فقط غیرفعال، بلکه اصلاً نیست */}
      {identity ? (
        <>
          {tab === 'import' && (
            <ImportPage
              courses={courses}
              onSave={replaceCourses}
              onGoNext={() => setTab('courses')}
            />
          )}

          {tab === 'audit' && (
            <AuditPage
              courses={courses}
              report={audit}
              onReport={setAudit}
              selected={selected}
              onToggle={toggleCourse}
              onGoCourses={() => setTab('courses')}
            />
          )}

          {(tab === 'courses' || tab === 'schedule') && (
            <PlanBar
              plans={plans}
              activeId={activePlanId}
              current={snapshot}
              dirty={dirty}
              catalogue={courses}
              onSave={savePlan}
              onSaveAs={savePlanAs}
              onOpen={openPlan}
              onRename={renamePlan}
              onDelete={deletePlan}
              onNewDraft={newDraft}
            />
          )}

          {tab === 'courses' && (
            <CoursesPage
              courses={courses}
              audit={audit}
              selected={selected}
              onToggle={toggleCourse}
              onClear={() => setSelected([])}
              onGoNext={() => setTab('schedule')}
              onGoAudit={() => setTab('audit')}
            />
          )}

          {tab === 'schedule' && (
            <SchedulePage
              selectedCourses={selectedCourses}
              catalogue={courses}
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
        </>
      ) : (
        <div className="card locked">
          <span className="locked__icon" aria-hidden="true">
            🔒
          </span>
          <h2 className="locked__title">برای شروع، نام خود را وارد کنید</h2>
          <p className="locked__text">
            تا نام و نام خانوادگی‌تان ثبت نشود، برنامه‌ریز باز نمی‌شود. این نام فقط در حافظه‌ی
            همین مرورگر ذخیره می‌شود.
          </p>
        </div>
      )}

      <footer className="footer-note">
        {identity && (
          <div className="row row--wrap" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <span className="chip chip--primary">👤 {fullName(identity)}</span>
            <button type="button" className="btn btn--sm" onClick={() => setEditingName(true)}>
              تغییر نام
            </button>
            <button type="button" className="btn btn--sm btn--danger" onClick={signOut}>
              خروج
            </button>
          </div>
        )}
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

      {/* کلیدِ `editingName` باعث می‌شود فرم با مقدارهای تازه از نو ساخته شود */}
      <LoginDialog
        key={editingName ? 'rename' : 'gate'}
        open={!identity || editingName}
        initial={editingName ? identity : null}
        dismissable={editingName}
        onSubmit={signIn}
        onDismiss={() => {
          setEditingName(false)
          setLoginError(null)
        }}
        error={loginError}
      />
    </div>
  )
}
