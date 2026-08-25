/**
 * รางวัลการ์ดตามอันดับในตารางอันดับ (จ่ายตอนจบซีซัน)
 *
 *   อันดับ 1–10 → ได้การ์ดใบที่เจ้าของโปรเจคเลือกไว้ให้อันดับนั้น (ดู data/rankRewards.ts)
 *   อันดับ 11 ลงไป → ได้แพ็คสุ่ม 10 ใบเท่ากันทุกคน
 *
 * ทั้งไฟล์เป็น pure function ห้าม import React หรือแตะ state
 */
import {
  CONSOLATION_PACK,
  DEFAULT_RANK_REWARDS,
  OWNER_USERNAMES,
  REWARD_RANKS,
  REWARD_RANKS_RANGE,
} from '@/data/rankRewards';
import { getPlayerById } from '@/data/players';
import { openPack } from '@/services/cardPack';
import type { PlayerCard } from '@/types/card';
import type { Player } from '@/types/player';

/**
 * ลำดับการวางการ์ดบนแถวโชว์รางวัล
 *
 * อันดับ 1 อยู่ตรงกลาง แล้วไล่ออกซ้าย-ขวาสลับกันไปจนถึงอันดับสุดท้าย
 * เช่น 10 รางวัล → [10, 8, 6, 4, 2, 1, 3, 5, 7, 9]
 *
 * รับจำนวนรางวัลเป็นพารามิเตอร์ เพราะเจ้าของโปรเจคตั้งจำนวนได้เอง
 */
export const buildShowcaseOrder = (count: number): number[] => {
  const left: number[] = [];
  const right: number[] = [];

  for (let rank = 2; rank <= count; rank += 1) {
    // อันดับคู่ไปทางซ้าย อันดับคี่ไปทางขวา — ยิ่งอันดับดียิ่งใกล้กลาง
    if (rank % 2 === 0) left.unshift(rank);
    else right.push(rank);
  }

  return [...left, 1, ...right];
};

/** จำนวนรางวัลที่ใช้ได้จริง — ตั้งเกินช่วงที่ยอมรับก็ถูกบีบกลับมา */
export const resolveRewardCount = (count?: number): number => {
  if (!Number.isFinite(count)) return REWARD_RANKS;

  return Math.min(
    Math.max(Math.round(count as number), REWARD_RANKS_RANGE.min),
    REWARD_RANKS_RANGE.max,
  );
};

/** เป็นเจ้าของโปรเจคไหม (ดูจากไอดีที่ใช้ล็อกอิน) */
export const isOwnerUsername = (username?: string): boolean =>
  Boolean(username) && OWNER_USERNAMES.some((owner) => owner.toLowerCase() === username!.toLowerCase());

/**
 * ทำให้รายการรางวัลมีความยาวตามจำนวนที่ตั้งไว้ และทุกช่องชี้ไปที่นักเตะที่มีอยู่จริง
 *
 * ช่องไหนว่าง/ชี้ผิด จะถอยไปใช้ค่าเริ่มต้นของอันดับนั้น (หรือใบสุดท้ายของค่าเริ่มต้น
 * ถ้าตั้งจำนวนรางวัลมากกว่าค่าเริ่มต้นที่มี) เกมจึงไม่พังเพราะพิมพ์ id ผิด
 *
 * ไม่ระบุ count = ใช้ความยาวของรายการที่ส่งมา (นั่นคือจำนวนที่แอดมินตั้งไว้)
 */
export const normalizeRankRewards = (
  cards?: Array<string | null | undefined>,
  count?: number,
): string[] => {
  const length = resolveRewardCount(count ?? cards?.length);
  const fallback = DEFAULT_RANK_REWARDS[DEFAULT_RANK_REWARDS.length - 1];

  return Array.from({ length }, (_, index) => {
    const candidate = cards?.[index];
    if (candidate && getPlayerById(candidate)) return candidate;
    return DEFAULT_RANK_REWARDS[index] ?? fallback;
  });
};

/** นักเตะที่เป็นรางวัลของอันดับนี้ (undefined = อันดับนี้ไม่มีรางวัลการ์ด) */
export const getRewardPlayer = (rank: number, cards: string[]): Player | undefined => {
  if (rank < 1 || rank > cards.length) return undefined;
  return getPlayerById(cards[rank - 1]);
};

/** อันดับนี้ติดรางวัลการ์ดพิเศษไหม */
export const isRewardRank = (rank: number, cards: string[]): boolean =>
  rank >= 1 && rank <= cards.length;

/** ผลรางวัลการ์ดปลายซีซันของอันดับหนึ่ง */
export interface RankRewardResult {
  /** true = ติดอันดับ 1–10 (ได้การ์ดที่กำหนดไว้) */
  featured: boolean;
  /** การ์ดที่จะเข้าคลังจริง */
  cards: PlayerCard[];
  /** นักเตะในรางวัล ใช้โชว์รูปบนหน้าจอสรุป */
  players: Player[];
}

/**
 * สร้างการ์ดรางวัลของอันดับที่จบซีซัน
 * เรียกตอนสรุปซีซัน แล้วส่ง cards ไปเข้าคลังตอนผู้เล่นกดรับ
 */
export const buildRankReward = (rank: number, cards: string[]): RankRewardResult => {
  const featuredPlayer = getRewardPlayer(rank, cards);
  const now = new Date().toISOString();

  if (featuredPlayer) {
    return {
      featured: true,
      players: [featuredPlayer],
      cards: [
        {
          id: `c_rank${rank}_${Date.now().toString(36)}`,
          playerId: featuredPlayer.id,
          acquiredAt: now,
          level: 1,
          inSquad: false,
        },
      ],
    };
  }

  // ไม่ติดอันดับ — แพ็คสุ่มเท่ากันทุกคน
  const opened = openPack(CONSOLATION_PACK);

  return {
    featured: false,
    cards: opened.cards,
    players: opened.cards
      .map((card) => getPlayerById(card.playerId))
      .filter((player): player is Player => Boolean(player)),
  };
};
