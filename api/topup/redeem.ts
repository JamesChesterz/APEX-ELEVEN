import crypto from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../_lib/admin.js'
import { requireUid } from '../_lib/auth.js'
import { HttpError, fail } from '../_lib/http.js'
import { bonusPercentFor, pointsForBaht } from '../_lib/rates.js'
import { parseVoucherCode, redeemVoucher } from '../_lib/truewallet.js'

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'ใช้ได้เฉพาะ POST', 'METHOD_NOT_ALLOWED')

    const uid = await requireUid(req)
    const receivingMobile = process.env.TRUEWALLET_PHONE
    if (!receivingMobile) throw new HttpError(503, 'ระบบเติมเงินยังไม่พร้อมใช้งาน', 'NOT_CONFIGURED')

    const code = parseVoucherCode(String(req.body?.voucher ?? ''))
    if (!code) throw new HttpError(400, 'ลิงก์ซองไม่ถูกต้อง วางลิงก์เต็มจากแอป TrueMoney', 'BAD_VOUCHER')

    await consumeRateLimit(uid)

    // ใช้ hash ของโค้ดซองเป็น document id การเติมซ้ำจากซองเดิมจึงเป็นไปไม่ได้ตั้งแต่ระดับฐานข้อมูล
    const txId = crypto.createHash('sha256').update(code).digest('hex').slice(0, 40)
    const txRef = db().collection('topups').doc(txId)

    try {
      await txRef.create({
        uid,
        channel: 'truewallet_gift',
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      })
    } catch (error: any) {
      if (error?.code === 6 /* ALREADY_EXISTS */) {
        throw await describeExisting(txId)
      }
      throw error
    }

    const outcome = await redeemVoucher(code, receivingMobile)

    if (outcome.kind === 'rejected') {
      // ไม่มีเงินเคลื่อนไหว ลบทิ้งเพื่อให้ลองใหม่ได้ถ้าซองกลับมาใช้ได้ภายหลัง
      await txRef.delete()
      throw new HttpError(400, outcome.message, outcome.code)
    }

    if (outcome.kind === 'unknown') {
      // เงินอาจถูกตัดไปแล้ว ห้ามลบ ห้ามให้พ้อยต์ ต้องให้แอดมินตรวจ
      await txRef.update({
        status: 'review',
        error: `${outcome.code}: ${outcome.message}`,
        completedAt: FieldValue.serverTimestamp(),
      })
      throw new HttpError(
        502,
        'ตรวจสอบซองไม่สำเร็จ ระบบบันทึกรายการไว้ให้แอดมินตรวจสอบแล้ว อย่าเพิ่งใช้ซองนี้ซ้ำ',
        'NEEDS_REVIEW',
      )
    }

    const amountTHB = outcome.amountTHB
    const points = pointsForBaht(amountTHB)
    const balance = await creditWallet({ uid, txId, txRef, amountTHB, points })

    return res.status(200).json({
      ok: true,
      amountTHB,
      points,
      bonusPercent: bonusPercentFor(amountTHB),
      balance,
    })
  } catch (error) {
    return fail(res, error)
  }
}

/** เพิ่มพ้อยต์ + เขียนสมุดบัญชี + ปิดรายการ ในทรานแซกชันเดียว */
async function creditWallet(input: {
  uid: string
  txId: string
  txRef: FirebaseFirestore.DocumentReference
  amountTHB: number
  points: number
}): Promise<number> {
  const { uid, txId, txRef, amountTHB, points } = input
  const firestore = db()
  const walletRef = firestore.collection('wallets').doc(uid)
  const ledgerRef = firestore.collection('pointsLedger').doc()

  return firestore.runTransaction(async (tx) => {
    const wallet = await tx.get(walletRef)
    const balance = (wallet.data()?.points ?? 0) + points

    tx.set(
      walletRef,
      {
        points: balance,
        totalToppedUpTHB: FieldValue.increment(amountTHB),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    tx.set(ledgerRef, {
      uid,
      delta: points,
      balanceAfter: balance,
      reason: 'topup',
      refId: txId,
      createdAt: FieldValue.serverTimestamp(),
    })

    tx.update(txRef, {
      status: 'success',
      amountTHB,
      points,
      completedAt: FieldValue.serverTimestamp(),
    })

    return balance
  })
}

/** ซองนี้เคยถูกยิงมาแล้ว บอกให้ตรงกับสถานะจริง */
async function describeExisting(txId: string): Promise<HttpError> {
  const snapshot = await db().collection('topups').doc(txId).get()
  const status = snapshot.data()?.status

  if (status === 'review') {
    return new HttpError(409, 'ซองนี้อยู่ระหว่างตรวจสอบ กรุณารอแอดมิน', 'NEEDS_REVIEW')
  }
  if (status === 'pending') {
    return new HttpError(409, 'ซองนี้กำลังดำเนินการอยู่ รอสักครู่แล้วลองใหม่', 'IN_PROGRESS')
  }
  return new HttpError(409, 'ซองนี้ถูกใช้เติมไปแล้ว', 'ALREADY_REDEEMED')
}

/** กันยิงรัว ๆ เพื่อเดาโค้ดซองของคนอื่น */
async function consumeRateLimit(uid: string) {
  const ref = db().collection('topupLimits').doc(uid)
  const now = Date.now()

  const allowed = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    const data = snapshot.data()
    const windowStart: number = data?.windowStart ?? 0
    const expired = now - windowStart > RATE_LIMIT_WINDOW_MS
    const count = expired ? 0 : (data?.count ?? 0)

    if (count >= RATE_LIMIT_MAX) return false

    tx.set(ref, { count: count + 1, windowStart: expired ? now : windowStart }, { merge: true })
    return true
  })

  if (!allowed) {
    throw new HttpError(429, 'ลองเติมถี่เกินไป กรุณารอสักครู่แล้วลองใหม่', 'RATE_LIMITED')
  }
}
