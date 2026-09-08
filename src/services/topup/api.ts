import { getAuth } from 'firebase/auth'

/** ชั้น I/O เดียวที่คุยกับ /api ของตัวเอง ส่วนอื่นของแอปไม่ต้องรู้จัก fetch หรือ token */

export type TopUpRecord = {
  id: string
  status: 'pending' | 'success' | 'failed' | 'review'
  amountTHB: number | null
  points: number | null
  createdAt: number
}

export type WalletSnapshot = {
  balance: number
  totalToppedUpTHB: number
  history: TopUpRecord[]
}

export type RedeemSuccess = {
  amountTHB: number
  points: number
  bonusPercent: number
  balance: number
}

/** error ที่มีข้อความพร้อมแสดงบนหน้าจอ */
export class TopUpError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
  }
}

async function authHeader(): Promise<Record<string, string>> {
  let user
  try {
    user = getAuth().currentUser
  } catch {
    // Firebase ยังไม่ถูก init = โหมดออฟไลน์
    throw new TopUpError('โหมดออฟไลน์เติมเงินไม่ได้ กรุณาเข้าสู่ระบบออนไลน์', 'OFFLINE')
  }
  if (!user) throw new TopUpError('กรุณาเข้าสู่ระบบก่อนเติมเงิน', 'UNAUTHENTICATED')
  return { Authorization: `Bearer ${await user.getIdToken()}` }
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.ok) {
    throw new TopUpError(body?.message ?? 'ระบบขัดข้อง ลองใหม่อีกครั้ง', body?.code ?? 'ERROR')
  }
  return body as T
}

export async function fetchWallet(): Promise<WalletSnapshot> {
  const response = await fetch('/api/topup/wallet', { headers: await authHeader() })
  return parse<WalletSnapshot>(response)
}

export async function redeemVoucher(voucher: string): Promise<RedeemSuccess> {
  const response = await fetch('/api/topup/redeem', {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ voucher }),
  })
  return parse<RedeemSuccess>(response)
}
