import { useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { TOPUP_PACKAGES } from '@/services/topup/rates'
import { TopUpError } from '@/services/topup/api'

type Feedback = { tone: 'success' | 'error'; text: string }

export default function TopUpPage() {
  const { wallet, loading, error, redeem } = useWallet()
  const [voucher, setVoucher] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function handleRedeem() {
    if (!voucher.trim() || submitting) return
    setSubmitting(true)
    setFeedback(null)
    try {
      const result = await redeem(voucher)
      setVoucher('')
      setFeedback({
        tone: 'success',
        text: `เติม ${result.amountTHB.toLocaleString()} บาท ได้ ${result.points.toLocaleString()} พ้อยต์${
          result.bonusPercent > 0 ? ` (รวมโบนัส ${result.bonusPercent}%)` : ''
        }`,
      })
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err instanceof TopUpError ? err.message : 'เติมไม่สำเร็จ ลองใหม่อีกครั้ง',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 text-slate-100">
      <header className="rounded-2xl border border-amber-400/25 bg-slate-900/60 p-6 backdrop-blur">
        <p className="text-sm text-slate-400">พ้อยต์คงเหลือ</p>
        <p className="mt-1 font-bold tabular-nums text-5xl text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.35)]">
          {loading ? '—' : (wallet?.balance ?? 0).toLocaleString()}
        </p>
        {wallet && wallet.totalToppedUpTHB > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            เติมสะสม {wallet.totalToppedUpTHB.toLocaleString()} บาท
          </p>
        )}
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">เรตแลกพ้อยต์</h2>
        <p className="mt-1 text-sm text-slate-400">
          ยอดเงินในซองกำหนดพ้อยต์ที่ได้ ยิ่งซองใหญ่ยิ่งได้โบนัสมาก
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TOPUP_PACKAGES.map((pkg) => (
            <div
              key={pkg.baht}
              className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-4 backdrop-blur"
            >
              <p className="text-sm text-slate-400">{pkg.baht.toLocaleString()} บาท</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-300">
                {pkg.points.toLocaleString()}
              </p>
              {pkg.bonusPercent > 0 && (
                <p className="mt-1 text-xs font-medium text-lime-300">โบนัส +{pkg.bonusPercent}%</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-700/70 bg-slate-900/50 p-6 backdrop-blur">
        <h2 className="text-lg font-semibold">เติมด้วยซองอั่งเปา TrueMoney</h2>
        <ol className="mt-3 space-y-1 text-sm text-slate-400">
          <li>1. เปิดแอป TrueMoney แล้วสร้างซองของขวัญตามยอดที่ต้องการ</li>
          <li>2. คัดลอกลิงก์ซอง แล้ววางในช่องด้านล่าง</li>
          <li>3. กดเติม พ้อยต์จะเข้าทันทีเมื่อระบบรับซองสำเร็จ</li>
        </ol>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={voucher}
            onChange={(event) => setVoucher(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleRedeem()}
            placeholder="https://gift.truemoney.com/campaign/?v=..."
            spellCheck={false}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-lime-400/70 focus:ring-2 focus:ring-lime-400/20"
          />
          <button
            type="button"
            onClick={handleRedeem}
            disabled={submitting || !voucher.trim()}
            className="rounded-lg bg-lime-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            {submitting ? 'กำลังเติม…' : 'เติมพ้อยต์'}
          </button>
        </div>

        {feedback && (
          <p
            role="status"
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              feedback.tone === 'success'
                ? 'bg-lime-400/10 text-lime-300'
                : 'bg-rose-500/10 text-rose-300'
            }`}
          >
            {feedback.text}
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">ประวัติการเติม</h2>
        {!wallet?.history.length ? (
          <p className="mt-3 text-sm text-slate-500">ยังไม่มีรายการ เติมครั้งแรกได้จากช่องด้านบน</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
            {wallet.history.map((item) => (
              <li key={item.id} className="flex items-center justify-between bg-slate-900/40 px-4 py-3">
                <div>
                  <p className="text-sm">
                    {item.amountTHB ? `${item.amountTHB.toLocaleString()} บาท` : 'ไม่สำเร็จ'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : ''}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    item.status === 'success' ? 'text-amber-300' : 'text-slate-500'
                  }`}
                >
                  {item.status === 'success'
                    ? `+${(item.points ?? 0).toLocaleString()}`
                    : item.status === 'review'
                      ? 'รอตรวจสอบ'
                      : 'ไม่สำเร็จ'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
