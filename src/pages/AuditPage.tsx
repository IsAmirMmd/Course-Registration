import { useMemo, useRef, useState } from 'react'
import type { Course } from '../types'
import {
  isDone,
  matchOffered,
  parseAudit,
  planForGroups,
  STATUS_LABEL,
  type AuditReport,
  type CourseAuditStatus,
} from '../lib/parseAudit'
import { toFaDigits } from '../lib/digits'
import { CopyCode } from '../components/CopyCode'
import { Notice } from '../components/ui'

interface Props {
  /** درس‌های ارائه‌شده‌ی این ترم */
  courses: Course[]
  report: AuditReport | null
  onReport: (report: AuditReport | null) => void
  selected: string[]
  onToggle: (code: string) => void
  onGoCourses: () => void
}

const STATUS_CHIP: Record<CourseAuditStatus, string> = {
  passed: 'chip chip--good',
  needed: 'chip chip--primary',
  optional: 'chip',
  covered: 'chip chip--quiet',
  unknown: 'chip chip--quiet',
}

/**
 * صفحه‌ی «کارنامه»: کارنامه‌ی تطبیقِ گلستان را می‌گیرد و درس‌های ارائه‌شده‌ی
 * این ترم را به «پاس‌شده» و «قابل اخذ» تقسیم می‌کند.
 */
export function AuditPage({ courses, report, onReport, selected, onToggle, onGoCourses }: Props) {
  const [raw, setRaw] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [showOutside, setShowOutside] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = (text: string) => {
    const next = parseAudit(text)
    if (next.groups.length === 0) {
      onReport(null)
      setFlash(next.warnings[0] ?? 'کارنامه خوانده نشد.')
      return
    }
    onReport(next)
    const passed = next.passedCount
    setFlash(
      `${toFaDigits(next.groups.length)} گروهِ نیاز و ${toFaDigits(passed)} درسِ گذرانده خوانده شد.`,
    )
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setRaw(text)
    run(text)
  }

  const matches = useMemo(() => matchOffered(courses, report), [courses, report])
  const plans = useMemo(() => planForGroups(courses, report, true), [courses, report])

  const buckets = useMemo(() => {
    const takeable = matches.filter((m) => !isDone(m.status))
    const done = matches.filter((m) => isDone(m.status))
    const order: CourseAuditStatus[] = ['needed', 'optional', 'unknown']
    takeable.sort(
      (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.course.credits - a.course.credits,
    )
    const count = (st: CourseAuditStatus) => matches.filter((m) => m.status === st).length
    return {
      takeable,
      inProgram: takeable.filter((m) => m.status !== 'unknown'),
      outside: takeable.filter((m) => m.status === 'unknown'),
      done,
      needed: count('needed'),
      optional: count('optional'),
      unknown: count('unknown'),
      passed: count('passed'),
      covered: count('covered'),
    }
  }, [matches])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const summary = report?.summary

  return (
    <div className="page">
      <div className="card">
        <h2 className="section-title">کارنامه‌ی تطبیق برنامه‌ی آموزشی</h2>
        <p className="section-hint">
          در گلستان کارنامه‌ی «تطبیق برنامه‌ی آموزشی» را باز کنید، کل جدول را کپی و اینجا
          پیست کنید. اپ از آن می‌خواند چه درس‌هایی را گذرانده‌اید و هر گروهِ نیاز چقدر
          کمبود دارد، بعد درس‌های ارائه‌شده‌ی این ترم را به <b>پاس‌شده</b> و{' '}
          <b>قابل اخذ</b> تقسیم می‌کند.
        </p>
        <p className="section-hint">
          فقط رشته، مقطع، معدل و واحدها خوانده می‌شود؛ نام، شماره دانشجو، شماره ملی و عکس
          نه خوانده و نه ذخیره می‌شوند.
        </p>

        <textarea
          className="field"
          rows={6}
          dir="ltr"
          placeholder="<table> ... </table>"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />

        <div className="row row--wrap" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => run(raw)}
            disabled={!raw.trim()}
          >
            خواندن کارنامه
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            آپلود فایل HTML
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,.txt,text/html,text/plain"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <span className="spacer" />
          {report && (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                onReport(null)
                setRaw('')
                setFlash('کارنامه پاک شد.')
              }}
            >
              پاک‌کردن کارنامه
            </button>
          )}
        </div>
      </div>

      {flash && <Notice kind="info">{flash}</Notice>}
      {report?.warnings.map((w, i) => (
        <Notice key={i} kind="warn">
          {w}
        </Notice>
      ))}

      {!report && (
        <Notice kind="warn">
          تا وقتی کارنامه‌ای وارد نشده، همه‌ی درس‌ها «نامشخص» می‌مانند.
        </Notice>
      )}

      {report && (
        <>
          {/* چکیده‌ی وضعیت تحصیلی */}
          <div className="summary">
            {summary?.field && <span className="chip">{summary.field}</span>}
            {summary?.level && <span className="chip chip--quiet">{summary.level}</span>}
            {summary?.gpa && (
              <span className="chip">معدل {toFaDigits(summary.gpa)}</span>
            )}
            {summary?.passedCredits !== undefined && (
              <span className="chip chip--good">
                {toFaDigits(summary.passedCredits)} واحد گذرانده
              </span>
            )}
            {summary?.remainingCredits !== undefined && (
              <span className="chip chip--primary">
                {toFaDigits(summary.remainingCredits)} واحد باقی‌مانده
              </span>
            )}
            {summary?.incompleteCredits ? (
              <span className="chip chip--warn">
                {toFaDigits(summary.incompleteCredits)} واحد ناتمام
              </span>
            ) : null}
            <span className="spacer" />
            <span className="chip chip--primary">
              {toFaDigits(buckets.needed)} درسِ لازم این ترم ارائه شده
            </span>
          </div>

          {/* گروه‌های ناتمام و درس‌های ارائه‌شده‌ای که به آن‌ها کمک می‌کنند */}
          <div className="card">
            <h2 className="section-title">چه چیزی لازم دارید</h2>
            <p className="section-hint">
              فقط گروه‌هایی که هنوز کمبود دارند. زیر هر گروه، درس‌های ارائه‌شده‌ی همین ترم
              که به آن گروه حساب می‌شوند آمده — کلیک روی هر درس آن را به انتخاب‌های ترم
              اضافه می‌کند.
            </p>

            {plans.length === 0 && (
              <Notice kind="info">همه‌ی گروه‌های نیاز کامل‌اند. 🎓</Notice>
            )}

            <div className="stack">
              {plans.map(({ group, offered }) => (
                <div key={group.id} className="panel">
                  <div className="row row--wrap" style={{ marginBottom: 8 }}>
                    <strong style={{ fontSize: 13.5, flex: '1 1 auto', minWidth: 0 }}>
                      {group.name}
                    </strong>
                    <span className="chip chip--danger num">
                      {toFaDigits(group.missingCredits)} واحد کمبود
                    </span>
                    <span className="chip chip--quiet num">
                      {toFaDigits(group.doneCredits)} از{' '}
                      {group.minCredits === group.maxCredits
                        ? toFaDigits(group.minCredits)
                        : `${toFaDigits(group.minCredits)}–${toFaDigits(group.maxCredits)}`}{' '}
                      واحد
                    </span>
                  </div>

                  <div className="meter" aria-hidden="true">
                    <div
                      className="meter__fill"
                      style={{
                        width: `${Math.min(100, group.minCredits > 0 ? (group.doneCredits / group.minCredits) * 100 : 100)}%`,
                      }}
                    />
                  </div>

                  {offered.length === 0 ? (
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                      هیچ درسی از این گروه این ترم ارائه نشده است.
                    </div>
                  ) : (
                    <ul className="pick-list">
                      {offered.map((course) => {
                        const on = selectedSet.has(course.code)
                        return (
                          <li key={course.code} className={`pick-row${on ? ' is-on' : ''}`}>
                            <button
                              type="button"
                              className="pick-row__add"
                              onClick={() => onToggle(course.code)}
                              title={on ? 'حذف از انتخاب‌های ترم' : 'افزودن به انتخاب‌های ترم'}
                            >
                              {on ? '−' : '+'}
                            </button>
                            <span className="pick-row__body">
                              <span className="pick-row__name">{course.name}</span>
                              <span className="pick-row__meta num">
                                {toFaDigits(course.credits)} واحد ·{' '}
                                {toFaDigits(course.groups.length)} گروه
                              </span>
                            </span>
                            <CopyCode value={course.code} label="کد" />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* درس‌های ارائه‌شده، دسته‌بندی‌شده */}
          <div className="card">
            <div className="row row--wrap" style={{ marginBottom: 12 }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>
                درس‌های ارائه‌شده‌ی این ترم
              </h2>
              <span className="chip chip--primary">{toFaDigits(buckets.needed)} لازم</span>
              {buckets.optional > 0 && (
                <span className="chip">{toFaDigits(buckets.optional)} اختیاری</span>
              )}
              {buckets.unknown > 0 && (
                <span className="chip chip--quiet">
                  {toFaDigits(buckets.unknown)} بیرون از برنامه‌ی شما
                </span>
              )}
              <span className="chip chip--good">
                {toFaDigits(buckets.done.length)} پاس‌شده / بی‌نیاز
              </span>
              <span className="spacer" />
              <button type="button" className="btn btn--sm" onClick={onGoCourses}>
                رفتن به انتخاب درس‌ها
              </button>
            </div>

            <div className="audit-list">
              {buckets.inProgram.map((m) => {
                const on = selectedSet.has(m.course.code)
                return (
                  <div key={m.course.code} className={`audit-row${on ? ' is-on' : ''}`}>
                    <button
                      type="button"
                      className="pick-row__add"
                      onClick={() => onToggle(m.course.code)}
                      title={on ? 'حذف از انتخاب‌های ترم' : 'افزودن به انتخاب‌های ترم'}
                    >
                      {on ? '−' : '+'}
                    </button>
                    <span className="pick-row__body">
                      <span className="pick-row__name">{m.course.name}</span>
                      <span className="pick-row__meta">
                        <span className="num">{toFaDigits(m.course.credits)} واحد</span>
                        {m.groups[0] && <span> · {m.groups[0].name}</span>}
                      </span>
                    </span>
                    <span className={STATUS_CHIP[m.status]}>{STATUS_LABEL[m.status]}</span>
                    <CopyCode value={m.course.code} label="کد" />
                  </div>
                )
              })}
            </div>

            {/* درس‌های بیرون از برنامه‌ی تحصیلی کاربر: پیش‌فرض بسته، چون نویزند */}
            <div className="row row--wrap" style={{ marginTop: 14 }}>
              {buckets.outside.length > 0 && (
                <button
                  type="button"
                  className={`btn btn--sm${showOutside ? ' is-active' : ''}`}
                  onClick={() => setShowOutside((v) => !v)}
                  aria-expanded={showOutside}
                  title="درس‌هایی که در کارنامه‌ی تطبیق شما نیستند — معمولاً مربوط به رشته‌های دیگر"
                >
                  {showOutside ? 'پنهان‌کردن' : 'نمایش'} درس‌های بیرون از برنامه (
                  {toFaDigits(buckets.outside.length)})
                </button>
              )}
            </div>

            {showOutside && (
              <div className="audit-list" style={{ marginTop: 12 }}>
                {buckets.outside.map((m) => {
                  const on = selectedSet.has(m.course.code)
                  return (
                    <div key={m.course.code} className={`audit-row${on ? ' is-on' : ''}`}>
                      <button
                        type="button"
                        className="pick-row__add"
                        onClick={() => onToggle(m.course.code)}
                        title={on ? 'حذف از انتخاب‌های ترم' : 'افزودن به انتخاب‌های ترم'}
                      >
                        {on ? '−' : '+'}
                      </button>
                      <span className="pick-row__body">
                        <span className="pick-row__name">{m.course.name}</span>
                        <span className="pick-row__meta num">
                          {toFaDigits(m.course.credits)} واحد
                        </span>
                      </span>
                      <span className={STATUS_CHIP[m.status]}>{STATUS_LABEL[m.status]}</span>
                      <CopyCode value={m.course.code} label="کد" />
                    </div>
                  )
                })}
              </div>
            )}

            <button
              type="button"
              className={`btn btn--sm${showDone ? ' is-active' : ''}`}
              style={{ marginTop: 10 }}
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
            >
              {showDone ? 'پنهان‌کردن' : 'نمایش'} پاس‌شده‌ها و موارد بی‌نیاز (
              {toFaDigits(buckets.done.length)})
            </button>

            {showDone && (
              <div className="audit-list" style={{ marginTop: 12 }}>
                {buckets.done.map((m) => (
                  <div key={m.course.code} className="audit-row is-muted">
                    <span className="pick-row__body">
                      <span className="pick-row__name">{m.course.name}</span>
                      <span className="pick-row__meta">
                        <span className="num">{toFaDigits(m.course.credits)} واحد</span>
                        {m.entry?.grade && (
                          <span className="num"> · نمره {toFaDigits(m.entry.grade)}</span>
                        )}
                        {m.entry?.term && (
                          <span className="num"> · ترم {toFaDigits(m.entry.term)}</span>
                        )}
                        {!m.entry?.grade && m.groups[0] && <span> · {m.groups[0].name}</span>}
                      </span>
                    </span>
                    <span className={STATUS_CHIP[m.status]}>{STATUS_LABEL[m.status]}</span>
                    <CopyCode value={m.course.code} label="کد" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
