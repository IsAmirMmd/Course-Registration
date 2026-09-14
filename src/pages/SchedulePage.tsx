import { useCallback, useMemo, useRef, useState } from 'react'
import type { Course, DayIndex, Picks } from '../types'
import { ALL_DAYS, DAY_NAMES } from '../lib/days'
import { toFaDigits } from '../lib/digits'
import { diagnose, solve } from '../lib/solver'
import { findClashes, findExamClashes, placedSessions, totalCredits } from '../lib/conflicts'
import { WeeklyGrid } from '../components/WeeklyGrid'
import { CourseDetail } from '../components/CourseDetail'
import { Diagnosis } from '../components/Diagnosis'
import { CreditMeter, Notice } from '../components/ui'
import { ExportImageButtons } from '../components/ExportImageButtons'
import type { PlannerMode } from '../lib/storage'

interface Props {
  selectedCourses: Course[]
  mode: PlannerMode
  onModeChange: (mode: PlannerMode) => void
  manualPicks: Picks
  onManualPick: (courseCode: string, groupId: string) => void
  considerExams: boolean
  onConsiderExamsChange: (value: boolean) => void
  onDropCourse: (code: string) => void
  onGoCourses: () => void
}

/** چند ترکیب اول نشان داده شود، پیش از «نمایش بیشتر» */
const PAGE = 12
const SOLVE_LIMIT = 500

export function SchedulePage(props: Props) {
  const {
    selectedCourses,
    mode,
    onModeChange,
    manualPicks,
    onManualPick,
    considerExams,
    onConsiderExamsChange,
    onDropCourse,
    onGoCourses,
  } = props

  const [comboIndex, setComboIndex] = useState(0)
  const [shown, setShown] = useState(PAGE)
  const [focusCode, setFocusCode] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const detailRefs = useRef(new Map<string, HTMLDivElement>())

  const result = useMemo(
    () => (mode === 'auto' ? solve(selectedCourses, { limit: SOLVE_LIMIT, considerExams }) : null),
    [mode, selectedCourses, considerExams],
  )

  // با تغییر درس‌ها یا گزینه‌ها، به ترکیب اول برگرد.
  // تنظیم در زمان رندر (نه در effect) تا رندرِ آبشاری راه نیفتد.
  const signature = `${selectedCourses.map((c) => c.code).join(',')}|${considerExams}|${mode}`
  const [lastSignature, setLastSignature] = useState(signature)
  if (lastSignature !== signature) {
    setLastSignature(signature)
    setComboIndex(0)
    setShown(PAGE)
  }

  const combos = useMemo(() => result?.combinations ?? [], [result])
  const safeIndex = combos.length ? Math.min(comboIndex, combos.length - 1) : 0
  const activePicks: Picks = useMemo(
    () => (mode === 'auto' ? (combos[safeIndex]?.picks ?? {}) : manualPicks),
    [mode, combos, safeIndex, manualPicks],
  )

  const placed = useMemo(() => placedSessions(selectedCourses, activePicks), [selectedCourses, activePicks])
  const clashes = useMemo(() => findClashes(placed), [placed])
  const examClashes = useMemo(
    () => findExamClashes(selectedCourses, activePicks),
    [selectedCourses, activePicks],
  )
  const pickedCourses = selectedCourses.filter((c) => activePicks[c.code])
  const credits = totalCredits(pickedCourses)
  const placedCourseCount = pickedCourses.length

  // ورودیِ خروجیِ تصویری — راهنمای پایین تصویر از همین می‌آید.
  // حافظه‌سپاری لازم نیست: چند ده درس، و فقط وقتی کاربر دکمه را بزند مصرف می‌شود.
  const imageEntries = pickedCourses.flatMap((course) => {
    const group = course.groups.find((g) => g.id === activePicks[course.code])
    return group ? [{ course, group }] : []
  })
  const imageMeta = [
    `${toFaDigits(credits)} واحد`,
    `${toFaDigits(placedCourseCount)} درس`,
    mode === 'auto' && combos.length > 0
      ? `ترکیب ${toFaDigits(safeIndex + 1)} از ${toFaDigits(combos.length)}`
      : 'چیدمان دستی',
    clashes.length > 0 ? `${toFaDigits(clashes.length)} تداخل زمانی` : 'بدون تداخل زمانی',
  ].join(' · ')
  const imageFile =
    mode === 'auto' && combos.length > 0
      ? `weekly-schedule-${safeIndex + 1}.png`
      : 'weekly-schedule.png'

  const registerRef = useCallback((code: string, el: HTMLDivElement | null) => {
    if (el) detailRefs.current.set(code, el)
    else detailRefs.current.delete(code)
  }, [])

  const scrollToCourse = useCallback((code: string) => {
    setFocusCode(code)
    const el = detailRefs.current.get(code)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const diagnosis = useMemo(
    () => (mode === 'auto' && combos.length === 0 && selectedCourses.length > 0
      ? diagnose(selectedCourses, considerExams)
      : null),
    [mode, combos.length, selectedCourses, considerExams],
  )

  // در حالت دستی ستون‌ها ثابت می‌مانند تا با هر تغییر گروه نجهند
  const manualDays = useMemo<DayIndex[]>(() => {
    const present = new Set<DayIndex>()
    for (const c of selectedCourses) {
      for (const g of c.groups) for (const s of g.sessions) present.add(s.day)
    }
    return ALL_DAYS.filter((d) => present.has(d))
  }, [selectedCourses])

  if (selectedCourses.length === 0) {
    return (
      <div className="page">
        <Notice kind="warn">
          هنوز درسی برای این ترم انتخاب نکرده‌اید.{' '}
          <button type="button" className="btn btn--sm" onClick={onGoCourses} style={{ marginInlineStart: 8 }}>
            انتخاب درس‌ها
          </button>
        </Notice>
      </div>
    )
  }

  const grid = (
    <WeeklyGrid
      placed={placed}
      fixedDays={mode === 'manual' ? manualDays : undefined}
      selectedCode={focusCode}
      onBlockClick={(p) => scrollToCourse(p.course.code)}
      emptyLabel={
        mode === 'manual'
          ? 'برای هر درس یک گروه انتخاب کنید تا در جدول ظاهر شود.'
          : 'این ترکیب هیچ جلسه‌ی زمان‌داری ندارد.'
      }
    />
  )

  return (
    <div className="page">
      {/* خلاصه‌ی وضعیت پیش از جزئیات — تاگل حالت همیشه در دسترس */}
      <div className="summary">
        <div className="tabs" role="group" aria-label="حالت چیدن برنامه">
          <button
            type="button"
            className={`tabs__btn${mode === 'auto' ? ' is-active' : ''}`}
            onClick={() => onModeChange('auto')}
            aria-pressed={mode === 'auto'}
          >
            حالت خودکار
          </button>
          <button
            type="button"
            className={`tabs__btn${mode === 'manual' ? ' is-active' : ''}`}
            onClick={() => onModeChange('manual')}
            aria-pressed={mode === 'manual'}
          >
            حالت دستی
          </button>
        </div>

        <span className="chip">{toFaDigits(placedCourseCount)} درس در برنامه</span>

        {clashes.length > 0 ? (
          <span className="chip chip--danger">{toFaDigits(clashes.length)} تداخل زمانی</span>
        ) : (
          <span className="chip chip--good">بدون تداخل زمانی</span>
        )}

        {examClashes.length > 0 && (
          <span className="chip chip--warn">{toFaDigits(examClashes.length)} تداخل امتحان</span>
        )}

        <span className="spacer" />

        <button
          type="button"
          className={`btn btn--sm${considerExams ? ' is-active' : ''}`}
          onClick={() => onConsiderExamsChange(!considerExams)}
          aria-pressed={considerExams}
          title="تداخل تاریخ و ساعت امتحان هم مانع ساخت ترکیب شود"
        >
          احتساب تداخل امتحان
        </button>
        <CreditMeter credits={credits} label="واحد این برنامه" />
      </div>

      {mode === 'auto' && combos.length > 0 && (
        <div className="card">
          <div className="combo-nav" style={{ marginBottom: 14 }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              ترکیب‌های بدون تداخل
            </h2>
            <span className="combo-nav__pos">
              ترکیب {toFaDigits(safeIndex + 1)} از {toFaDigits(combos.length)}
              {result?.truncated ? '+' : ''}
            </span>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setComboIndex((i) => Math.max(0, (i || 0) - 1))}
              disabled={safeIndex === 0}
            >
              قبلی
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setComboIndex((i) => Math.min(combos.length - 1, (i || 0) + 1))}
              disabled={safeIndex >= combos.length - 1}
            >
              بعدی
            </button>
            <span className="spacer" />
            <ExportImageButtons
              placed={placed}
              entries={imageEntries}
              meta={imageMeta}
              filename={imageFile}
            />
            <button type="button" className="btn btn--sm" onClick={() => setFullscreen(true)}>
              نمایش تمام‌صفحه
            </button>
          </div>

          {result?.truncated && (
            <p className="section-hint">
              ترکیب‌های ممکن بیش از {toFaDigits(SOLVE_LIMIT)} تاست؛ فقط {toFaDigits(SOLVE_LIMIT)}{' '}
              ترکیبِ اول ساخته شد. برای کم‌کردن گزینه‌ها درس یا فیلتر بیشتری اضافه کنید.
            </p>
          )}

          {/* ریلِ ترکیب‌ها کنارِ جدولِ همان ترکیب، تا مقایسه و انتخاب یک‌جا باشد */}
          <div className="plan">
            <div className="plan__rail">
              <div className="combo-strip">
                {combos.slice(0, shown).map((combo, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`combo-card${i === safeIndex ? ' is-active' : ''}`}
                    onClick={() => setComboIndex(i)}
                    aria-pressed={i === safeIndex}
                    aria-label={`ترکیب ${i + 1}`}
                  >
                    <WeeklyGrid placed={placedSessions(selectedCourses, combo.picks)} mini />
                    <span className="combo-card__label">ترکیب {toFaDigits(i + 1)}</span>
                  </button>
                ))}
              </div>

              {shown < combos.length && (
                <button
                  type="button"
                  className="btn btn--sm"
                  style={{ width: '100%' }}
                  onClick={() => setShown((n) => n + PAGE * 2)}
                >
                  نمایش بیشتر ({toFaDigits(combos.length - shown)} ترکیب دیگر)
                </button>
              )}
            </div>

            <div className="plan__grid fade-swap" key={`auto-${safeIndex}`}>
              {grid}
            </div>
          </div>
        </div>
      )}

      {diagnosis && <Diagnosis data={diagnosis} onDrop={onDropCourse} />}

      {mode === 'manual' && (
        <div className="card">
          <h2 className="section-title">انتخاب دستی گروه‌ها</h2>
          <p className="section-hint">
            گروه هر درس را خودتان بچینید. تداخل جلوی شما را نمی‌گیرد؛ فقط بلاک‌های متصادم در
            جدول هاشور می‌خورند و حاشیه‌ی هشدار می‌گیرند.
          </p>
          <div className="pick-grid">
            {selectedCourses.map((course) => (
              <div key={course.code} className="pick">
                <label className="pick__label" htmlFor={`pick-${course.code}`}>
                  {course.name}
                  <span className="pick__credits num">{toFaDigits(course.credits)} واحد</span>
                </label>
                <select
                  id={`pick-${course.code}`}
                  className="field pick__select"
                  value={manualPicks[course.code] ?? ''}
                  onChange={(e) => onManualPick(course.code, e.target.value)}
                >
                  <option value="">— بدون انتخاب —</option>
                  {course.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      گروه {toFaDigits(g.groupNo ?? '')}
                      {g.instructor ? ` · ${g.instructor}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {(mode === 'manual' || combos.length > 0) && (
        <>
          {clashes.length > 0 && (
            <Notice kind="danger">
              {toFaDigits(clashes.length)} تداخل زمانی در این برنامه هست:{' '}
              {clashes
                .slice(0, 4)
                .map(
                  (c) =>
                    `${c.a.course.name} × ${c.b.course.name} (${DAY_NAMES[c.a.session.day]})`,
                )
                .join('، ')}
              {clashes.length > 4 ? ' …' : ''}
            </Notice>
          )}

          {examClashes.length > 0 && (
            <Notice kind="warn">
              تداخل تاریخ امتحان:{' '}
              {examClashes.map((c) => `${c.a.name} × ${c.b.name}`).join('، ')}
            </Notice>
          )}

          {mode === 'manual' && (
            <div className="card">
              <div className="row row--wrap" style={{ marginBottom: 14 }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>
                  جدول هفتگی
                </h2>
                <span className="spacer" />
                <ExportImageButtons
                  placed={placed}
                  entries={imageEntries}
                  meta={imageMeta}
                  filename={imageFile}
                />
                <button type="button" className="btn btn--sm" onClick={() => setFullscreen(true)}>
                  نمایش تمام‌صفحه
                </button>
              </div>
              {grid}
            </div>
          )}

          <div>
            <h2 className="section-title" style={{ marginBottom: 12 }}>
              جزئیات درس‌ها
            </h2>
            <div className="detail-grid">
              {selectedCourses.map((course) => (
                <CourseDetail
                  key={course.code}
                  course={course}
                  courses={selectedCourses}
                  picks={activePicks}
                  focused={focusCode === course.code}
                  onPickGroup={mode === 'manual' ? onManualPick : undefined}
                  registerRef={registerRef}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {fullscreen && (
        <div className="fullscreen" role="dialog" aria-modal="true" aria-label="جدول هفتگی تمام‌صفحه">
          <div className="fullscreen__bar">
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              جدول هفتگی
            </h2>
            {mode === 'auto' && (
              <>
                <span className="combo-nav__pos">
                  ترکیب {toFaDigits(safeIndex + 1)} از {toFaDigits(combos.length)}
                </span>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setComboIndex((i) => Math.max(0, (i || 0) - 1))}
                  disabled={safeIndex === 0}
                >
                  قبلی
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setComboIndex((i) => Math.min(combos.length - 1, (i || 0) + 1))}
                  disabled={safeIndex >= combos.length - 1}
                >
                  بعدی
                </button>
              </>
            )}
            <CreditMeter credits={credits} label="واحد" />
            <span className="spacer" />
            <ExportImageButtons
              placed={placed}
              entries={imageEntries}
              meta={imageMeta}
              filename={imageFile}
            />
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setFullscreen(false)}>
              بستن
            </button>
          </div>
          <div className="fade-swap" key={`fs-${safeIndex}`}>
            {grid}
          </div>
        </div>
      )}
    </div>
  )
}
