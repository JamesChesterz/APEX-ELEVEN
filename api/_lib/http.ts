import type { VercelResponse } from '@vercel/node'

/** error ที่ตั้งใจส่งกลับให้ผู้ใช้เห็น (ข้อความเป็นภาษาไทย ปลอดภัยที่จะแสดงบนหน้าเว็บ) */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
  ) {
    super(message)
  }
}

export function fail(res: VercelResponse, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ ok: false, code: error.code, message: error.message })
  }
  // error ที่ไม่คาดคิด: log ไว้ดูใน Vercel แต่ไม่ส่งรายละเอียดออกไปให้ client
  console.error('[api] unhandled', error)
  return res.status(500).json({
    ok: false,
    code: 'INTERNAL',
    message: 'ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง',
  })
}
