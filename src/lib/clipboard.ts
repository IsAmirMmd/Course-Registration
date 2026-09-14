/**
 * کپی متن در کلیپ‌بورد.
 * Clipboard API فقط در «بستر امن» (https یا localhost) کار می‌کند، پس اگر نبود
 * به روش قدیمیِ textarea + execCommand برمی‌گردیم تا روی http هم کار کند.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      /* رد می‌شویم به روش جانشین */
    }
  }

  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  // بیرون از دید، ولی قابل انتخاب — display:none کپی را خراب می‌کند
  area.style.position = 'fixed'
  area.style.top = '-1000px'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  area.setSelectionRange(0, text.length)
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('کپی در کلیپ‌بورد ممکن نشد.')
}
