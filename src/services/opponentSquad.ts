/**
 * ตัวจริง 11 คนของฝ่ายตรงข้าม ใช้วาดบนสนาม Matchmaking
 *
 * คู่แข่งที่เป็นผู้เล่นจริง (มีโปรไฟล์บนเซิร์ฟเวอร์) → ใช้ทีมจริงของเขา
 * เรียงตามแผนที่เขาใช้อยู่ ณ ตอนนั้น (ดึงจาก config/profiles ที่ประกาศไว้จากหน้า MY TEAM)
 *
 * คู่แข่งที่เป็นบอท/ยังไม่มีโปรไฟล์ (โหมดออฟไลน์ หรือบอทที่สุ่มขึ้นตอนหาคู่)
 * → ไม่มีทีมจริงให้ดึง จึงปั้นตัวจริงที่ OVR ใกล้เคียงกันแทน โดย seed จาก id ของคู่แข่ง
 * เพื่อให้หน้าตาทีมเดิมคงที่ ไม่สุ่มใหม่ทุกครั้งที่ re-render
 */
import { getFormationById } from '@/data/formations';
import { getPlayerById, PLAYERS } from '@/data/players';
import type { Opponent } from '@/types/match';
import type { Player } from '@/types/player';
import type { PublicSquadSlot } from '@/types/profile';
import type { FormationId, FormationSlot } from '@/types/team';

export interface OpponentSlot {
  slot: FormationSlot;
  player: Player | null;
}

/** ข้อมูลทีมจริงเท่าที่ต้องใช้ (มาจาก PublicProfile) */
export interface OpponentProfileLike {
  formationId: FormationId;
  squad: PublicSquadSlot[];
}

/** สุ่มเทียม seed คงที่จากสตริง — ทีมบอทเดิมจึงได้นักเตะหน้าเดิมทุกครั้ง ไม่สุ่มใหม่ตอน re-render */
const seededRandom = (seed: string): (() => number) => {
  let state = 0;
  for (let i = 0; i < seed.length; i += 1) state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

/** ปั้นตัวจริง 11 คนที่ OVR ใกล้เคียงทีมคู่แข่ง ใช้ตอนไม่มีทีมจริงให้ดึง */
const buildFallbackSquad = (
  slots: FormationSlot[],
  targetOvr: number,
  seed: string,
): OpponentSlot[] => {
  const random = seededRandom(seed);
  const pool = [...PLAYERS].sort(
    (a, b) => Math.abs(a.ovr - targetOvr) - Math.abs(b.ovr - targetOvr),
  );
  const used = new Set<string>();

  return slots.map((slot) => {
    const eligible = pool.filter(
      (candidate) =>
        !used.has(candidate.id) &&
        (candidate.position === slot.position || candidate.altPositions.includes(slot.position)),
    );
    const fallback = pool.filter((candidate) => !used.has(candidate.id));
    const list = eligible.length > 0 ? eligible.slice(0, 8) : fallback.slice(0, 8);
    const chosen = list[Math.floor(random() * list.length)] ?? null;

    if (chosen) used.add(chosen.id);
    return { slot, player: chosen };
  });
};

/** ตัวจริง 11 คนของฝ่ายตรงข้าม เรียงตามช่องของแผนที่เขาใช้ */
export const resolveOpponentSquad = (
  opponent: Opponent,
  profile?: OpponentProfileLike | null,
): OpponentSlot[] => {
  const formation = getFormationById(profile?.formationId ?? opponent.formationId);
  const hasRealSquad = Boolean(profile?.squad?.length);

  if (profile && hasRealSquad) {
    const bySlot = new Map(profile.squad.map((entry) => [entry.slotId, entry.playerId]));
    return formation.slots.map((slot) => ({
      slot,
      player: getPlayerById(bySlot.get(slot.id) ?? '') ?? null,
    }));
  }

  return buildFallbackSquad(formation.slots, opponent.ovr, opponent.id);
};

/**
 * ตัวสำรองของฝ่ายตรงข้าม ใช้โชว์ในรายชื่อข้างสนาม
 *
 * โปรไฟล์สาธารณะเก็บแค่ 11 ตัวจริง (ดู PublicSquadSlot) เราจึงไม่รู้ม้านั่งจริงของเขา
 * ฝั่งนี้เลยปั้นให้ใกล้เคียงค่าพลังทีมเขาแทน โดย seed จาก id เดิม — ทีมเดิมจะได้เห็น
 * ม้านั่งหน้าเดิมทุกครั้ง ไม่สุ่มใหม่ทุก re-render และไม่ซ้ำกับ 11 ตัวจริงของเขา
 */
export const resolveOpponentBench = (
  opponent: Opponent,
  starters: OpponentSlot[],
  count = 5,
): Player[] => {
  const random = seededRandom(`${opponent.id}-bench`);
  const used = new Set(starters.map((entry) => entry.player?.id).filter(Boolean) as string[]);

  const pool = [...PLAYERS]
    .filter((candidate) => !used.has(candidate.id))
    .sort((a, b) => Math.abs(a.ovr - opponent.ovr) - Math.abs(b.ovr - opponent.ovr))
    .slice(0, count * 4);

  return Array.from({ length: count }, () => {
    const available = pool.filter((candidate) => !used.has(candidate.id));
    if (available.length === 0) return null;

    const chosen = available[Math.floor(random() * available.length)];
    used.add(chosen.id);
    return chosen;
  }).filter((player): player is Player => player !== null);
};
