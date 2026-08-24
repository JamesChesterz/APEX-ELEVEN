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
} from '@/data/rankRewards';
import { getPlayerById } from '@/data/players';
import { openPack } from '@/services/cardPack';
import type { PlayerCard } from '@/types/card';
import type { Player } from '@/types/player';

/**
 * ลำดับการวางการ์ดบนแถวโชว์รางวัล
 * อันดับ 1 อยู่ตรงกลาง แล้วไล่ออกซ้าย-ขวาสลับกันไปจนถึงอันดับ 10
 */
export const SHOWCASE_ORDER = [10, 8, 6, 4, 2, 1, 3, 5, 7, 9];

/** เป็นเจ้าของโปรเจคไหม (ดูจากไอดีที่ใช้ล็อกอิน) */
export const isOwnerUsername = (username?: string): boolean =>
  Boolean(username) && OWNER_USERNAMES.some((owner) => owner.toLowerCase() === username!.toLowerCase());

/**
 * ทำให้รายการรางวัลมีความยาว 10 เสมอ และทุกช่องชี้ไปที่นักเตะที่มีอยู่จริง
 * ช่องไหนว่าง/ชี้ผิด จะถอยไปใช้ค่าเริ่มต้นของอันดับนั้นแทน เกมจึงไม่พังเพราะพิมพ์ id ผิด
 */
export const normalizeRankRewards = (cards?: Array<string | null | undefined>): string[] =>
  Array.from({ length: REWARD_RANKS }, (_, index) => {
    const candidate = cards?.[index];
    if (candidate && getPlayerById(candidate)) return candidate;
    return DEFAULT_RANK_REWARDS[index];
  });

/** นักเตะที่เป็นรางวัลของอันดับนี้ (undefined = อันดับนี้ไม่มีรางวัลการ์ด) */
export const getRewardPlayer = (rank: number, cards: string[]): Player | undefined => {
  if (rank < 1 || rank > REWARD_RANKS) return undefined;
  return getPlayerById(cards[rank - 1]);
};

/** อันดับนี้ติดรางวัลการ์ดพิเศษไหม */
export const isRewardRank = (rank: number): boolean => rank >= 1 && rank <= REWARD_RANKS;

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
