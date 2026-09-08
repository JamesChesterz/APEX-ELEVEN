import { useCallback, useEffect, useState } from 'react'
import {
  TopUpError,
  fetchWallet,
  redeemVoucher,
  type RedeemSuccess,
  type WalletSnapshot,
} from '@/services/topup/api'

export function useWallet() {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setWallet(await fetchWallet())
      setError(null)
    } catch (err) {
      setError(err instanceof TopUpError ? err.message : 'โหลดข้อมูลกระเป๋าไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** คืนผลลัพธ์ให้หน้าจอเอาไปแสดง แล้วรีเฟรชยอดตามหลังเสมอ */
  const redeem = useCallback(
    async (voucher: string): Promise<RedeemSuccess> => {
      try {
        const result = await redeemVoucher(voucher)
        setWallet((current) =>
          current ? { ...current, balance: result.balance } : current,
        )
        return result
      } finally {
        void refresh()
      }
    },
    [refresh],
  )

  return { wallet, loading, error, refresh, redeem }
}
