import { getAuth } from 'firebase-admin/auth'
import type { VercelRequest } from '@vercel/node'
import { adminApp } from './admin.js'
import { HttpError } from './http.js'

/**
 * อ่าน Firebase ID token จาก header แล้ว verify กับ Firebase
 * ห้ามรับ uid ที่ client ส่งมาตรง ๆ เด็ดขาด เพราะปลอมได้
 */
export async function requireUid(req: VercelRequest): Promise<string> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'กรุณาเข้าสู่ระบบก่อนเติมเงิน', 'UNAUTHENTICATED')
  }

  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(header.slice(7))
    return decoded.uid
  } catch {
    throw new HttpError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'INVALID_TOKEN')
  }
}
