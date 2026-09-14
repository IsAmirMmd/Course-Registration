import { useState } from 'react'
import type { Course, Picks } from '../types'
import { DAY_NAMES } from '../lib/days'
import { courseHue } from '../lib/layout'
import { toFaDigits } from '../lib/digits'
import { faTime } from '../lib/time'
import { alternativesFor } from '../lib/solver'
import { Chevron, Collapse } from './ui'
import { CopyCode } from './CopyCode'

interface Props {
  course: Course
  courses: Course[]
  picks: Picks
  focused: boolean
  /** اگر داده شود، گروه‌های جایگزین قابل انتخاب می‌شوند (حالت دستی) */
  onPickGroup?: (courseCode: string, groupId: string) => void
  registerRef?: (code: string, el: HTMLDivElement | null) => void
}

/**
 * کارت جزئیات یک درس: جلسه‌ها، امتحان، و گروه‌های جایگزین که بر اساس
 * تداخل داشتن/نداشتن با بقیه‌ی برنامه علامت خورده‌اند.
 */
export function CourseDetail({ course, courses, picks, focused, onPickGroup, registerRef }: Props) {
  const [open, setOpen] = useState(false)
  const groupId = picks[course.code]
  const group = course.groups.find((g) => g.id === groupId)
  const alts = alternativesFor(course, courses, picks)
  const freeAlts = alts.filter((a) => !a.conflicts && !a.isCurrent).length

  return (
    <div
      className={`detail${focused ? ' is-focus' : ''}`}
      ref={(el) => registerRef?.(course.code, el)}
    >
      <div className="detail__top">
        <span
          className="detail__dot"
          style={{
            background: `hsl(${courseHue(course.code)} var(--block-mark-s) var(--block-mark-l))`,
          }}
        />
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div className="detail__name">{course.name}</div>
          <div className="detail__sub detail__ids">
            <span>{toFaDigits(course.credits)} واحد</span>
            {/* همان کدی که در سیستم انتخاب‌واحد وارد می‌شود — یک کلیک، کپی */}
            {group ? (
              <CopyCode
                value={group.id}
                label="کد گروه"
                title={`کپی «${group.id}» برای ورود در سیستم انتخاب واحد`}
              />
            ) : (
              <CopyCode value={course.code} label="کد درس" title={`کپی کد درس ${course.code}`} />
            )}
          </div>
          {group?.instructor && <div className="detail__sub">{group.instructor}</div>}
        </div>
        {group && group.capacity > 0 && (
          <span className="chip">ظرفیت {toFaDigits(group.capacity)}</span>
        )}
      </div>

      {group && (
        <ul className="detail__sessions">
          {group.sessions.length === 0 && (
            <li className="muted">بدون زمان کلاسی ثابت</li>
          )}
          {group.sessions.map((s, i) => (
            <li key={`${s.day}-${s.start}-${i}`}>
              <span className="detail__day">{DAY_NAMES[s.day]}</span>
              <span className="num">
                {faTime(s.start)}–{faTime(s.end)}
              </span>
              {s.kind && <span className="muted">{s.kind === 'practical' ? 'عملی' : 'نظری'}</span>}
              {s.location && <span className="muted">{toFaDigits(s.location)}</span>}
            </li>
          ))}
          {course.exam && (
            <li>
              <span className="detail__day">امتحان</span>
              <span className="num">
                {toFaDigits(course.exam.date)}
                {course.exam.time ? ` · ${toFaDigits(course.exam.time)}` : ''}
              </span>
            </li>
          )}
        </ul>
      )}

      {course.groups.length > 1 && (
        <>
          <button
            type="button"
            className={`btn btn--sm alt-toggle${open ? ' is-active' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <span>
              گروه‌های این درس ({toFaDigits(course.groups.length)})
              {freeAlts > 0 && (
                <span className="muted"> · {toFaDigits(freeAlts)} جایگزینِ بی‌تداخل</span>
              )}
            </span>
            <Chevron open={open} />
          </button>
          <Collapse open={open}>
            <ul className="alt-list">
              {alts.map((alt) => {
                const clashNames = alt.conflictsWith.map((c) => c.course.name).join('، ')
                const canPick = Boolean(onPickGroup) && !alt.isCurrent
                return (
                  <li key={alt.group.id}>
                    <button
                      type="button"
                      className={`alt${alt.isCurrent ? ' is-current' : ''}${alt.conflicts ? ' is-clash' : ''}`}
                      onClick={() => onPickGroup?.(course.code, alt.group.id)}
                      disabled={!canPick}
                      title={
                        alt.conflicts
                          ? `تداخل با: ${clashNames}`
                          : alt.isCurrent
                            ? 'گروه فعلی'
                            : 'بی‌تداخل با بقیه‌ی برنامه'
                      }
                    >
                      <span className="alt__no">{toFaDigits(alt.group.groupNo ?? '')}</span>
                      <span className="alt__body">
                        <span className="alt__time">
                          {alt.group.sessions.length === 0
                            ? 'بدون زمان ثابت'
                            : alt.group.sessions
                                .map((s) => `${DAY_NAMES[s.day]} ${faTime(s.start)}–${faTime(s.end)}`)
                                .join(' · ')}
                        </span>
                        {alt.group.instructor && <span className="alt__who"> · {alt.group.instructor}</span>}
                        {alt.conflicts && (
                          <span className="alt__who" style={{ color: 'var(--crit)' }}>
                            {' '}
                            · تداخل با {clashNames}
                          </span>
                        )}
                      </span>
                      {alt.isCurrent && <span className="chip chip--primary">فعلی</span>}
                      {!alt.isCurrent && !alt.conflicts && (
                        <span className="chip chip--good">بی‌تداخل</span>
                      )}
                      {!alt.isCurrent && alt.conflicts && <span className="chip chip--danger">تداخل</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Collapse>
        </>
      )}
    </div>
  )
}
