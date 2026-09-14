/**
 * نویسنده‌ی ZIP بدونِ فشرده‌سازی (روش store).
 *
 * فایل xlsx در واقع یک ZIP از چند XML است. برای همین به‌جای افزودن یک
 * کتابخانه‌ی چند‌صد‌کیلوبایتی، همین حداقلِ لازم نوشته شده است: store یعنی
 * داده بی‌تغییر ذخیره می‌شود، پس به deflate نیازی نیست و فایل کاملاً معتبر است.
 */

export interface ZipEntry {
  /** مسیر داخل آرشیو، مثل «xl/worksheets/sheet1.xml» */
  path: string
  data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

export function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text)
}

/** نویسنده‌ی کوچکِ little-endian */
class Writer {
  private parts: Uint8Array[] = []
  length = 0

  bytes(value: Uint8Array): void {
    this.parts.push(value)
    this.length += value.length
  }

  u16(value: number): void {
    const b = new Uint8Array(2)
    b[0] = value & 0xff
    b[1] = (value >>> 8) & 0xff
    this.bytes(b)
  }

  u32(value: number): void {
    const b = new Uint8Array(4)
    b[0] = value & 0xff
    b[1] = (value >>> 8) & 0xff
    b[2] = (value >>> 16) & 0xff
    b[3] = (value >>> 24) & 0xff
    this.bytes(b)
  }

  finish(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(this.length)
    let at = 0
    for (const part of this.parts) {
      out.set(part, at)
      at += part.length
    }
    return out
  }
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f)
  const d = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, date: d }
}

/** آرشیو ZIP را به‌صورت بایت برمی‌گرداند */
export function createZip(entries: ZipEntry[], now = new Date()): Uint8Array<ArrayBuffer> {
  const { time, date } = dosDateTime(now)
  const body = new Writer()
  const central = new Writer()

  for (const entry of entries) {
    const name = utf8(entry.path)
    const crc = crc32(entry.data)
    const offset = body.length

    // سرصفحه‌ی محلی
    body.u32(0x04034b50)
    body.u16(20) // نسخه‌ی لازم
    body.u16(0x0800) // نام فایل UTF-8 است
    body.u16(0) // روش: store
    body.u16(time)
    body.u16(date)
    body.u32(crc)
    body.u32(entry.data.length)
    body.u32(entry.data.length)
    body.u16(name.length)
    body.u16(0)
    body.bytes(name)
    body.bytes(entry.data)

    // مدخل فهرست مرکزی
    central.u32(0x02014b50)
    central.u16(20) // ساخته‌شده با
    central.u16(20) // نسخه‌ی لازم
    central.u16(0x0800)
    central.u16(0)
    central.u16(time)
    central.u16(date)
    central.u32(crc)
    central.u32(entry.data.length)
    central.u32(entry.data.length)
    central.u16(name.length)
    central.u16(0) // extra
    central.u16(0) // comment
    central.u16(0) // شماره‌ی دیسک
    central.u16(0) // ویژگی‌های داخلی
    central.u32(0) // ویژگی‌های خارجی
    central.u32(offset)
    central.bytes(name)
  }

  const centralBytes = central.finish()
  const bodyBytes = body.finish()

  const end = new Writer()
  end.u32(0x06054b50)
  end.u16(0) // دیسک این
  end.u16(0) // دیسک آغاز فهرست
  end.u16(entries.length)
  end.u16(entries.length)
  end.u32(centralBytes.length)
  end.u32(bodyBytes.length)
  end.u16(0) // طول توضیح
  const endBytes = end.finish()

  const out = new Uint8Array(bodyBytes.length + centralBytes.length + endBytes.length)
  out.set(bodyBytes, 0)
  out.set(centralBytes, bodyBytes.length)
  out.set(endBytes, bodyBytes.length + centralBytes.length)
  return out
}
