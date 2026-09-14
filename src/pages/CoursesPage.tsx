import { useMemo, useState } from 'react'
import type { Course, DayIndex } from '../types'
import { ALL_DAYS, DAY_NAMES } from '../lib/days'
import { normalizeFa, toFaDigits } from '../lib/digits'
import { faTime } from '../lib/time'
import { CreditMeter, Notice, Tick } from '../components/ui'

interface Props {
  courses: Course[]
  selected: string[]
  onToggle: (code: string) => void
  onClear: () => void
  onGoNext: () => void
}

/** صفحه‌ی «انتخاب درس‌های مورد نیاز» — با جست‌وجو و فیلتر استاد/روز */
export function CoursesPage({ courses, selected, onToggle, onClear, onGoNext }: Props) {
  const [query, setQuery] = useState('')
  const [day, setDay] = useState<'all' | DayIndex>('all')
  const [onlySelected, setOnlySelected] = useState(false)

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const credits = useMemo(
    () => courses.filter((c) => selectedSet.has(c.code)).reduce((n, c) => n + c.credits, 0),
    [courses, selectedSet],
  )

  const visible = useMemo(() => {
    const q = normalizeFa(query).toLowerCase()
    return courses.filter((c) => {
      if (onlySelected && !selectedSet.has(c.code)) return false
      if (day !== 'all' && !c.groups.some((g) => g.sessions.some((s) => s.day === day))) return false
      if (!q) return true
      // جست‌وجو روی نام درس، نام استاد و کد درس
      if (normalizeFa(c.name).toLowerCase().includes(q)) return true
      if (c.code.includes(q)) return true
      return c.groups.some((g) => normalizeFa(g.instructor).toLowerCase().includes(q))
    })
  }, [courses, query, day, onlySelected, selectedSet])

  return (
    <div className="page">
      <div className="card">
        <div className="row row--wrap" style={{ marginBottom: 14 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            این ترم چه درس‌هایی لازم دارید؟
          </h2>
          <span className="spacer" />
          <CreditMeter credits={credits} />
          <span className="chip">{toFaDigits(selected.length)} درس</span>
        </div>

        <div className="toolbar">
          <input
            className="field"
            placeholder="جست‌وجو در نام درس، استاد یا کد درس…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="جست‌وجوی درس"
          />
          <select
            className="field"
            value={String(day)}
            onChange={(e) => setDay(e.target.value === 'all' ? 'all' : (Number(e.target.value) as DayIndex))}
            aria-label="فیلتر روز"
          >
            <option value="all">همه‌ی روزها</option>
            {ALL_DAYS.map((d) => (
              <option key={d} value={d}>
                کلاس در {DAY_NAMES[d]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`btn${onlySelected ? ' is-active' : ''}`}
            onClick={() => setOnlySelected((v) => !v)}
          >
            فقط انتخاب‌شده‌ها
          </button>
        </div>

        <div className="row row--wrap" style={{ marginTop: 12 }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {toFaDigits(visible.length)} درس از {toFaDigits(courses.length)} درس نمایش داده می‌شود
          </span>
          <span className="spacer" />
          <button type="button" className="btn btn--sm" onClick={onClear} disabled={selected.length === 0}>
            پاک‌کردن انتخاب‌ها
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onGoNext}
            disabled={selected.length === 0}
          >
            ساختن برنامه
          </button>
        </div>
      </div>

      {courses.length === 0 && (
        <Notice kind="warn">
          هنوز درسی ذخیره نشده است. از صفحه‌ی «افزودن درس‌ها» جدول دانشگاه را ایمپورت کنید.
        </Notice>
      )}

      {courses.length > 0 && visible.length === 0 && (
        <Notice kind="info">درسی با این جست‌وجو/فیلتر پیدا نشد.</Notice>
      )}

      <div className="course-list">
        {visible.map((course) => {
          const on = selectedSet.has(course.code)
          const noFixedTime = course.groups.every((g) => g.sessions.length === 0)
          return (
            <button
              key={course.code}
              type="button"
              className={`course-row${on ? ' is-on' : ''}`}
              onClick={() => onToggle(course.code)}
              aria-pressed={on}
            >
              <Tick on={on} />
              <span className="course-row__body">
                <span className="course-row__name">{course.name}</span>
                <span className="course-row__meta">
                  <span>{toFaDigits(course.credits)} واحد</span>
                  <span>
                    {toFaDigits(course.groups.length)} گروه
                  </span>
                  <span className="num">کد {toFaDigits(course.code)}</span>
                  {course.exam && <span className="num">امتحان {toFaDigits(course.exam.date)}</span>}
                  {noFixedTime && <span>بدون زمان ثابت</span>}
                </span>
                <span className="course-row__meta">
                  {course.groups.slice(0, 3).map((g) => (
                    <span key={g.id}>
                      {g.instructor || 'بدون استاد'}
                      {g.sessions.length > 0 && (
                        <span className="num">
                          {' · '}
                          {g.sessions
                            .map((s) => `${DAY_NAMES[s.day]} ${faTime(s.start)}`)
                            .join('، ')}
                        </span>
                      )}
                    </span>
                  ))}
                  {course.groups.length > 3 && <span>…</span>}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
