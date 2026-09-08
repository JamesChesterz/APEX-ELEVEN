import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../_lib/admin.js'
import { requireUid } from '../_lib/auth.js'
import { HttpError, fail } from '../_lib/http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'ใช้ได้เฉพาะ GET', 'METHOD_NOT_ALLOWED')

    const uid = await requireUid(req)
    const firestore = db()

    // ไม่ใส่ orderBy ในคิวรี เพื่อเลี่ยงการต้องสร้าง composite index ใน Firebase Console
    const [wallet, topups] = await Promise.all([
      firestore.collection('wallets').doc(uid).get(),
      firestore.collection('topups').where('uid', '==', uid).limit(50).get(),
    ])

    const history = topups.docs
      .map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          status: data.status as string,
          amountTHB: (data.amountTHB ?? null) as number | null,
          points: (data.points ?? null) as number | null,
          createdAt: data.createdAt?.toMillis?.() ?? 0,
        }
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)

    return res.status(200).json({
      ok: true,
      balance: wallet.data()?.points ?? 0,
      totalToppedUpTHB: wallet.data()?.totalToppedUpTHB ?? 0,
      history,
    })
  } catch (error) {
    return fail(res, error)
  }
}
