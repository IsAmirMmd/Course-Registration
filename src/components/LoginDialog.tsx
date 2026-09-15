import { useEffect, useRef, useState } from 'react'
import { cleanName, makeIdentity, validateName, NAME_MAX, type Identity } from '../lib/identity'
import './LoginDialog.css'

interface Props {
  open: boolean
  /** مقدارهای اولیه، وقتی کاربر «تغییر نام» را زده */
  initial?: Identity | null
  /** فقط در حالتِ «تغییر نام» می‌شود بست؛ در حالتِ قفل، بستن معنا ندارد */
  dismissable?: boolean
  onSubmit: (identity: Identity) => void
  onDismiss?: () => void
  /** خطای بیرونی، مثلاً وقتی نوشتن در localStorage ممکن نشد */
  error?: string | null
}

/**
 * فرمِ ورود، به‌صورت پاپ‌آپ. از `<dialog>` بومی با `showModal()` استفاده می‌شود
 * تا حلقه‌ی فوکوس و بی‌اثر‌شدنِ پشتِ صفحه را خودِ مرورگر بدهد؛ در حالتِ قفل،
 * Esc و کلیک روی پس‌زمینه کاری نمی‌کنند چون بدونِ نام اجازه‌ی فعالیت نیست.
 */
export function LoginDialog({
  open,
  initial = null,
  dismissable = false,
  onSubmit,
  onDismiss,
  error = null,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [firstName, setFirstName] = useState(initial?.firstName ?? '')
  const [lastName, setLastName] = useState(initial?.lastName ?? '')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const firstError = touched ? validateName(firstName, 'firstName') : null
  const lastError = touched ? validateName(lastName, 'lastName') : null
  const valid = !validateName(firstName, 'firstName') && !validateName(lastName, 'lastName')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    onSubmit(makeIdentity(firstName, lastName))
  }

  return (
    <dialog
      ref={ref}
      className="login"
      aria-labelledby="login-title"
      // بدونِ نام اجازه‌ی فعالیت نیست، پس Esc در نمی‌رود
      onCancel={(e) => {
        e.preventDefault()
        if (dismissable) onDismiss?.()
      }}
    >
      <form className="login__box" onSubmit={submit}>
        <span className="login__mark" aria-hidden="true">
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

        <h2 className="login__title" id="login-title">
          {initial ? 'تغییر نام' : 'خوش آمدید'}
        </h2>
        <p className="login__sub">
          {initial
            ? 'نام تازه‌ای وارد کنید. برنامه‌ها و انتخاب‌هایتان دست‌نخورده می‌مانند.'
            : 'برای شروع، نام و نام خانوادگی خود را وارد کنید. همین روی مرورگر خودتان ذخیره می‌شود.'}
        </p>

        <label className="login__label" htmlFor="login-first">
          نام
        </label>
        <input
          id="login-first"
          className={`field${firstError ? ' is-bad' : ''}`}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={NAME_MAX}
          autoComplete="given-name"
          spellCheck={false}
          aria-invalid={!!firstError}
          aria-describedby={firstError ? 'login-first-err' : undefined}
          placeholder="مثلاً امیر"
          // پاپ‌آپ همین حالا باز شده و تنها کاری که هست، پر‌کردنِ همین کادر است
          autoFocus
        />
        {firstError && (
          <p className="login__err" id="login-first-err">
            {firstError}
          </p>
        )}

        <label className="login__label" htmlFor="login-last">
          نام خانوادگی
        </label>
        <input
          id="login-last"
          className={`field${lastError ? ' is-bad' : ''}`}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={NAME_MAX}
          autoComplete="family-name"
          spellCheck={false}
          aria-invalid={!!lastError}
          aria-describedby={lastError ? 'login-last-err' : undefined}
          placeholder="مثلاً محمدی"
        />
        {lastError && (
          <p className="login__err" id="login-last-err">
            {lastError}
          </p>
        )}

        {error && <div className="notice notice--danger login__notice">{error}</div>}

        <div className="login__actions">
          <button type="submit" className="btn btn--primary" disabled={touched && !valid}>
            {initial ? 'ثبت نام تازه' : 'ورود به برنامه‌ریز'}
          </button>
          {dismissable && (
            <button type="button" className="btn" onClick={onDismiss}>
              انصراف
            </button>
          )}
        </div>

        <p className="login__foot">
          🔒 نام شما فقط در حافظه‌ی همین مرورگر می‌ماند. برای اطلاع‌رسانیِ ورود، نام و زمانِ ورود
          به کانال تلگرامِ سازنده فرستاده می‌شود.
          {/* پیش‌نمایش فقط وقتی نام پذیرفتنی است — وگرنه نامِ نامعتبر را
              تأیید‌شده جلوه می‌دهد */}
          {valid ? (
            <>
              {' '}
              به‌عنوان <strong>{`${cleanName(firstName)} ${cleanName(lastName)}`}</strong> وارد
              می‌شوید.
            </>
          ) : null}
        </p>
      </form>
    </dialog>
  )
}
