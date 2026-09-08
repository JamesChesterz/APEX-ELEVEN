/**
 * ตารางเรตพ้อยต์ฝั่งเซิร์ฟเวอร์ = ตัวจริง ใช้คำนวณตอนเติมเงิน
 * ถ้าแก้ที่นี่ ต้องแก้ src/services/topup/rates.ts (ตัวแสดงผลบนหน้าเว็บ) ตามด้วย
 */

export const POINTS_PER_BAHT = 10

/** โบนัสขั้นบันได เรียงจากยอดมากไปน้อย ตัวแรกที่ยอดถึงคือตัวที่ใช้ */
const BONUS_TIERS: { minBaht: number; bonusPercent: number }[] = [
  { minBaht: 500, bonusPercent: 40 },
  { minBaht: 300, bonusPercent: 30 },
  { minBaht: 100, bonusPercent: 20 },
  { minBaht: 50, bonusPercent: 10 },
]

export function bonusPercentFor(baht: number): number {
  return BONUS_TIERS.find((tier) => baht >= tier.minBaht)?.bonusPercent ?? 0
}

export function pointsForBaht(baht: number): number {
  const bonus = bonusPercentFor(baht)
  return Math.floor(baht * POINTS_PER_BAHT * (1 + bonus / 100))
}
