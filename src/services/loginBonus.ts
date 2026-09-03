/**
 * กติกาของรางวัลล็อกอิน — คิดวันที่ ปฏิทิน และช่องที่กดรับได้
 *
 * แยกออกจาก hook เพราะเป็นตรรกะล้วน เทสได้โดยไม่ต้องมี React
 * และหน้าแอดมินกับหน้าผู้เล่นต้องเห็นกติกาเดียวกันเป๊ะ
 */
import { normalizeReward } from '@/services/rewards';
import {
  MONTHLY_DAYS,
  WEEKLY_DAYS,
  type LoginBonusConfig,
  type LoginBonusState,
} from '@/types/loginBonus';
import type { GameReward } from '@/types/reward';

/** วันที่ท้องถิ่นในรูป YYYY-MM-DD */
export const dateKey = (now = new Date()): string => {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/** เดือนในรูป YYYY-MM */
export const monthKeyOf = (now = new Date()): string =>
  `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;

/**
 * สัปดาห์ในรูป YYYY-Www (สัปดาห์เริ่มวันจันทร์)
 *
 * คิดจาก "วันจันทร์ของสัปดาห์นั้น" แทนที่จะใช้เลขสัปดาห์ ISO
 * เพราะเราต้องการแค่คีย์ที่เปลี่ยนทุกวันจันทร์ ไม่ได้ต้องการเลขสัปดาห์ที่ถูกตามมาตรฐาน
 * และการคิดแบบนี้ไม่มีปัญหาคาบเกี่ยวปีเหมือนเลข ISO
 */
export const weekKeyOf = (now = new Date()): string => {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // getDay(): 0 = อาทิตย์ → ถอยไป 6 วัน, 1 = จันทร์ → ถอย 0 วัน
  const back = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - back);

  return `W${dateKey(monday)}`;
};

/** รางวัลว่างเปล่าใช้เติมช่องที่แอดมินยังไม่ได้ตั้ง */
const fallbackReward = (index: number): GameReward => ({
  kind: 'coins',
  // ช่องท้าย ๆ ให้มากขึ้นตามลำดับ เพื่อให้ค่าเริ่มต้นยังพอมีแรงจูงใจ
  amount: 1_000 * (index + 1),
});

/** บีบค่าตั้งจากเซิร์ฟเวอร์ให้มีความยาวครบและทุกช่องใช้งานได้ */
export const normalizeLoginBonus = (
  raw: Partial<LoginBonusConfig> | null | undefined,
): LoginBonusConfig => {
  const fill = (list: unknown, length: number): GameReward[] =>
    Array.from({ length }, (_, index) => {
      const entry = Array.isArray(list) ? list[index] : undefined;
      return entry ? normalizeReward(entry) : fallbackReward(index);
    });

  return {
    enabled: raw?.enabled !== false,
    title: raw?.title?.trim() || 'รางวัลล็อกอิน',
    weekly: fill(raw?.weekly, WEEKLY_DAYS),
    monthly: fill(raw?.monthly, MONTHLY_DAYS),
  };
};

/** ความคืบหน้าเปล่าของวันนี้ */
export const emptyLoginState = (now = new Date()): LoginBonusState => ({
  weekKey: weekKeyOf(now),
  weeklyClaimed: [],
  monthKey: monthKeyOf(now),
  monthlyClaimed: [],
});

/**
 * บีบความคืบหน้าให้ตรงกับสัปดาห์/เดือนปัจจุบัน
 * คนละสัปดาห์ = ล้างของรายสัปดาห์ทิ้ง · คนละเดือน = ล้างของรายเดือน
 * (สองอย่างนี้รีเซ็ตคนละจังหวะ จึงต้องเช็คแยกกัน)
 */
export const normalizeLoginState = (
  raw: Partial<LoginBonusState> | null | undefined,
  now = new Date(),
): LoginBonusState => {
  const week = weekKeyOf(now);
  const month = monthKeyOf(now);

  const list = (value: unknown, max: number): number[] =>
    Array.isArray(value)
      ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < max))].sort(
          (a, b) => a - b,
        )
      : [];

  const sameWeek = raw?.weekKey === week;
  const sameMonth = raw?.monthKey === month;

  return {
    weekKey: week,
    weeklyClaimed: sameWeek ? list(raw?.weeklyClaimed, WEEKLY_DAYS) : [],
    monthKey: month,
    monthlyClaimed: sameMonth ? list(raw?.monthlyClaimed, MONTHLY_DAYS) : [],
    lastWeeklyDate: sameWeek ? raw?.lastWeeklyDate : undefined,
    lastMonthlyDate: sameMonth ? raw?.lastMonthlyDate : undefined,
  };
};

/** ช่องถัดไปที่จะได้รับของปฏิทินนั้น (= จำนวนที่กดไปแล้ว) */
export const nextIndex = (claimed: number[]): number => claimed.length;

export type Track = 'weekly' | 'monthly';

export interface TrackStatus {
  /** ช่องที่จะได้ถ้ากดตอนนี้ (−1 = เก็บครบปฏิทินแล้ว) */
  next: number;
  /** กดรับได้ตอนนี้ไหม */
  claimable: boolean;
  /** เหตุผลที่กดไม่ได้ (undefined = กดได้) */
  reason?: string;
}

/** สถานะของปฏิทินหนึ่งอันในวันนี้ */
export const getTrackStatus = (
  state: LoginBonusState,
  track: Track,
  now = new Date(),
): TrackStatus => {
  const claimed = track === 'weekly' ? state.weeklyClaimed : state.monthlyClaimed;
  const total = track === 'weekly' ? WEEKLY_DAYS : MONTHLY_DAYS;
  const last = track === 'weekly' ? state.lastWeeklyDate : state.lastMonthlyDate;
  const next = nextIndex(claimed);

  if (next >= total) {
    return { next: -1, claimable: false, reason: 'เก็บครบทุกช่องแล้ว รอรอบถัดไป' };
  }

  // กดได้วันละครั้งต่อปฏิทิน — เข้าเกมสิบรอบก็ยังได้ช่องเดียว
  if (last === dateKey(now)) {
    return { next, claimable: false, reason: 'วันนี้รับไปแล้ว — พรุ่งนี้เข้ามารับต่อได้' };
  }

  return { next, claimable: true };
};

/** ความคืบหน้าชุดใหม่หลังกดรับช่องของปฏิทินนั้น */
export const claimTrack = (
  state: LoginBonusState,
  track: Track,
  now = new Date(),
): LoginBonusState => {
  const status = getTrackStatus(state, track, now);
  if (!status.claimable) return state;

  const today = dateKey(now);

  return track === 'weekly'
    ? {
        ...state,
        weeklyClaimed: [...state.weeklyClaimed, status.next],
        lastWeeklyDate: today,
      }
    : {
        ...state,
        monthlyClaimed: [...state.monthlyClaimed, status.next],
        lastMonthlyDate: today,
      };
};
