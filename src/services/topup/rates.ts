/**
 * ตารางเรตสำหรับ "แสดงผล" บนหน้าเติมเงินเท่านั้น
 * การคำนวณจริงเกิดที่ api/_lib/rates.ts ฝั่งเซิร์ฟเวอร์ — ถ้าแก้เรต ต้องแก้ทั้งสองไฟล์
 */

export type TopUpPackage = {
  baht: number
  points: number
  bonusPercent: number
}

export const TOPUP_PACKAGES: TopUpPackage[] = [
  { baht: 20, points: 200, bonusPercent: 0 },
  { baht: 50, points: 550, bonusPercent: 10 },
  { baht: 100, points: 1200, bonusPercent: 20 },
  { baht: 300, points: 3900, bonusPercent: 30 },
  { baht: 500, points: 7000, bonusPercent: 40 },
]

export const POINTS_PER_BAHT = 10
