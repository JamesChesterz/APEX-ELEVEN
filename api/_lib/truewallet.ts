/**
 * ตัวเชื่อมกับซองอั่งเปา TrueMoney
 *
 * หมายเหตุสำคัญ: endpoint นี้ไม่ใช่ API ที่ TrueMoney เปิดให้ใช้อย่างเป็นทางการ
 * รูปแบบ response อาจเปลี่ยนได้ และคำขอที่ยิงจากเซิร์ฟเวอร์อาจโดน Cloudflare บล็อก
 * ถ้าโดนบล็อก ให้ตั้ง TRUEWALLET_API_BASE ชี้ไปที่ relay ของตัวเองแทน โดยไม่ต้องแก้ไฟล์อื่น
 */

const DEFAULT_BASE = 'https://gift.truemoney.com/campaign/vouchers'
const TIMEOUT_MS = 20_000

export type RedeemOutcome =
  /** เงินเข้าเบอร์ร้านแล้ว */
  | { kind: 'success'; amountTHB: number; raw: unknown }
  /** ปฏิเสธชัดเจน มั่นใจว่าเงินไม่ได้ถูกตัด ให้ผู้เล่นลองใหม่ได้ */
  | { kind: 'rejected'; code: string; message: string }
  /** ไม่รู้ผล (เน็ตหลุด/timeout/อ่าน response ไม่ออก) ห้ามสรุปเอง ต้องส่งให้คนตรวจ */
  | { kind: 'unknown'; code: string; message: string }

/** รับได้ทั้งลิงก์เต็มและโค้ดเปล่า คืน null ถ้าหน้าตาไม่ใช่ซอง */
export function parseVoucherCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let candidate = trimmed
  const fromQuery = trimmed.match(/[?&]v=([a-zA-Z0-9]+)/)
  if (fromQuery) {
    candidate = fromQuery[1]
  } else if (trimmed.includes('/')) {
    // เผื่อรูปแบบ .../campaign/<code> หรือมี path ต่อท้าย
    const segments = trimmed.split(/[/?#]/).filter(Boolean)
    candidate = segments[segments.length - 1] ?? ''
  }

  return /^[a-zA-Z0-9]{15,64}$/.test(candidate) ? candidate : null
}

/** ข้อความไทยของ error code ที่เจอบ่อย */
const MESSAGES: Record<string, string> = {
  VOUCHER_NOT_FOUND: 'ไม่พบซองนี้ ตรวจสอบลิงก์อีกครั้ง',
  VOUCHER_OUT_OF_STOCK: 'ซองนี้ถูกใช้ไปแล้ว',
  VOUCHER_EXPIRED: 'ซองนี้หมดอายุแล้ว',
  VOUCHER_NOT_YET_STARTED: 'ซองนี้ยังไม่ถึงเวลาใช้งาน',
  TARGET_USER_NOT_FOUND: 'ระบบรับเงินขัดข้อง กรุณาแจ้งแอดมิน',
  TARGET_USER_REDEEMED: 'ซองนี้ถูกใช้ไปแล้ว',
  CANNOT_GET_OWN_VOUCHER: 'ใช้ซองที่สร้างจากเบอร์ของร้านเองไม่ได้',
  USER_LIMIT: 'รับซองนี้ไม่ได้ เนื่องจากถึงขีดจำกัดของ TrueMoney',
}

/** code ที่แปลว่าปฏิเสธแน่นอน เงินไม่ได้ถูกตัด */
const DEFINITE_REJECTS = new Set(Object.keys(MESSAGES))

export async function redeemVoucher(code: string, mobile: string): Promise<RedeemOutcome> {
  const base = process.env.TRUEWALLET_API_BASE || DEFAULT_BASE
  const url = `${base}/${encodeURIComponent(code)}/redeem`

  let response: Response
  let body: any
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      body: JSON.stringify({ mobile, voucher_hash: code }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    body = await response.json()
  } catch {
    // ยิงไปแล้วแต่ไม่ได้คำตอบ เงินอาจเข้าไปแล้วก็ได้ ห้ามให้ลองซ้ำเอง
    return { kind: 'unknown', code: 'NETWORK', message: 'ติดต่อระบบ TrueMoney ไม่สำเร็จ' }
  }

  const statusCode: string = body?.status?.code ?? (response.ok ? 'UNKNOWN' : `HTTP_${response.status}`)

  if (statusCode !== 'SUCCESS') {
    if (DEFINITE_REJECTS.has(statusCode)) {
      return { kind: 'rejected', code: statusCode, message: MESSAGES[statusCode] }
    }
    console.warn('[truewallet] unexpected status', statusCode, JSON.stringify(body).slice(0, 500))
    return { kind: 'unknown', code: statusCode, message: 'ระบบ TrueMoney ตอบกลับผิดปกติ' }
  }

  // ยอดเงินอยู่ได้หลายที่แล้วแต่รูปแบบ response ลองไล่ทีละอัน
  const rawAmount =
    body?.data?.my_ticket?.amount_baht ??
    body?.data?.voucher?.redeemed_amount_baht ??
    body?.data?.voucher?.amount_baht

  const amountTHB = Number(rawAmount)
  if (!Number.isFinite(amountTHB) || amountTHB <= 0) {
    // เงินเข้าแล้วแต่เราอ่านยอดไม่ออก ต้องให้คนดู ห้ามให้พ้อยต์มั่ว
    console.error('[truewallet] redeemed but amount unreadable', JSON.stringify(body).slice(0, 1000))
    return { kind: 'unknown', code: 'AMOUNT_UNREADABLE', message: 'อ่านยอดเงินจากซองไม่ได้' }
  }

  return { kind: 'success', amountTHB, raw: body?.data ?? null }
}
