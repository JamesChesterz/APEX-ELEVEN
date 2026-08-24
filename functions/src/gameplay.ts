/**
 * กติกาฝั่งเซิร์ฟเวอร์ — ส่วนที่ไม่แตะฐานข้อมูลเลย (pure function ล้วน)
 *
 * แยกออกมาจาก index.ts เพื่อให้เทสได้โดยไม่ต้องต่อ Firebase
 * ตัวที่เขียนฐานข้อมูลจริงอยู่ที่ index.ts
 *
 * หัวใจ: ค่าพลังทีมต้อง "คำนวณจากคลังการ์ดในบัญชี" เท่านั้น
 * ห้ามรับตัวเลขค่าพลังที่เครื่องผู้เล่นส่งมาเด็ดขาด ไม่งั้นก็โกงได้เหมือนเดิม
 */
import { getFormationById } from '@/data/formations';
import { getPlayerById } from '@/data/players';
import { calculateTeamRating, type RatedSlot } from '@/services/teamRating';
import { getLevelBonus } from '@/services/upgrade';
import type { AccountState } from '@/types/account';
import type { Player } from '@/types/player';
import type { TeamRating } from '@/types/team';
import { POSITION_GROUP } from '@/utils/helpers';

/** ห้ามลงแข่งถี่กว่านี้ (มิลลิวินาที) — หนึ่งนัดใช้เวลาถ่ายทอดสดราว 12 วินาที */
export const MATCH_INTERVAL_MS = 15_000;

/** เก็บผลย้อนหลังไว้กี่นัด (ตรงกับ HISTORY_LIMIT ฝั่งหน้าเว็บ) */
export const HISTORY_LIMIT = 50;

/** ใส่โบนัสตีบวกเข้าไปในค่าพลังนักเตะ (ตรรกะเดียวกับ useTeam ฝั่งหน้าเว็บ) */
const applyLevel = (player: Player, level?: number): Player => {
  const bonus = getLevelBonus(level ?? 1);
  if (bonus === 0) return player;
  return { ...player, ovr: player.ovr + bonus };
};

/**
 * ค่าพลังทีมที่เชื่อถือได้ คำนวณจากบัญชีจริงบนเซิร์ฟเวอร์
 *
 * อ่านตัวจริงจาก state.squad (slotId → cardId) แล้วไล่หาการ์ดใน state.cards
 * การ์ดที่ไม่มีอยู่จริงในคลังจะกลายเป็นช่องว่างทันที กรอกชื่อการ์ดมั่วจึงไม่ช่วยอะไร
 */
export const getServerRating = (state: AccountState): TeamRating => {
  const formation = getFormationById(state.formationId);
  const cards = Array.isArray(state.cards) ? state.cards : [];

  const slots: RatedSlot[] = formation.slots.map((slot) => {
    const cardId = state.squad?.[slot.id] ?? null;
    const card = cards.find((entry) => entry.id === cardId);
    const player = card ? getPlayerById(card.playerId) : undefined;

    return {
      slot,
      player: player ? applyLevel(player, card?.level) : null,
      level: card?.level,
    };
  });

  return calculateTeamRating(slots);
};

/** จัดตัวครบ 11 คนหรือยัง — ไม่ครบห้ามลงแข่ง */
export const isSquadComplete = (state: AccountState): boolean => {
  const formation = getFormationById(state.formationId);
  const cards = Array.isArray(state.cards) ? state.cards : [];

  return formation.slots.every((slot) => {
    const cardId = state.squad?.[slot.id] ?? null;
    return Boolean(cardId && cards.some((entry) => entry.id === cardId));
  });
};

/** ชื่อนักเตะที่ลงสนาม ใช้เป็นคนยิงประตูในไทม์ไลน์ */
export const getSquadNames = (state: AccountState): string[] => {
  const formation = getFormationById(state.formationId);
  const cards = Array.isArray(state.cards) ? state.cards : [];

  return formation.slots
    .map((slot) => {
      const cardId = state.squad?.[slot.id] ?? null;
      const card = cards.find((entry) => entry.id === cardId);
      return card ? getPlayerById(card.playerId)?.name : undefined;
    })
    .filter((name): name is string => Boolean(name));
};

/** เหลือเวลาคูลดาวน์อีกกี่มิลลิวินาทีก่อนลงแข่งได้อีกครั้ง (0 = ลงได้เลย) */
export const matchCooldownLeft = (lastMatchAt: unknown, now: number): number => {
  if (typeof lastMatchAt !== 'string') return 0;

  const last = new Date(lastMatchAt).getTime();
  if (!Number.isFinite(last)) return 0;

  return Math.max(0, MATCH_INTERVAL_MS - (now - last));
};

/**
 * รายชื่อคนยิงประตูสำหรับไทม์ไลน์ — ยิ่งเล่นตำแหน่งบุกยิ่งมีโอกาสถูกสุ่มมากขึ้น
 * (น้ำหนักชุดเดียวกับ buildScorers ฝั่งหน้าเว็บ)
 */
export const getScorerPool = (state: AccountState): string[] => {
  const formation = getFormationById(state.formationId);
  const cards = Array.isArray(state.cards) ? state.cards : [];
  const weight = { attack: 4, midfield: 2, defence: 1, gk: 0 } as const;

  return formation.slots.flatMap((slot) => {
    const cardId = state.squad?.[slot.id] ?? null;
    const card = cards.find((entry) => entry.id === cardId);
    const player = card ? getPlayerById(card.playerId) : undefined;
    if (!player) return [];

    return Array.from({ length: weight[POSITION_GROUP[slot.position]] }, () => player.name);
  });
};
