/**
 * Match Session — สะพานระหว่างข้อมูลเดิมของเกมกับ Match Engine
 *
 * เกมนี้มีระบบจับคู่จริงอยู่แล้ว (useMatchmaking + Firestore) จึงไม่สร้างระบบซ้ำ
 * ไฟล์นี้ทำหน้าที่เดียว: แปลง "ทีมในภาษาของเกม" (การ์ด + ช่องในแผน + โปรไฟล์คู่แข่ง)
 * ให้เป็น "ทีมในภาษาของเอนจิน" (MatchTeamInput) แล้วส่งเข้า createMatch(home, away)
 *
 * เส้นแบ่งอยู่ตรงนี้เพื่อว่าเมื่อ matchmaking เปลี่ยนไปเป็นแบบ realtime เต็มรูปแบบ
 * (ทั้งสองเครื่องจำลองพร้อมกัน) เราแก้แค่ฝั่งที่ผลิต MatchSessionInput
 * โดยไม่ต้องเขียน Match Engine ใหม่เลย
 *
 * เป็น pure function ล้วน ห้าม import React
 */
import type { MatchPlayerInput, MatchTeamInput } from '@/match-engine';
import type { OpponentSlot } from '@/services/opponentSquad';
import type { Opponent } from '@/types/match';
import type { Player, Position } from '@/types/player';
import type { Formation } from '@/types/team';

/** ชุดแข่งของแต่ละฝั่ง — ใช้สีจากจานสีเดิมของเกมเพื่อให้เข้ากับหน้าอื่น */
export const KIT = {
  home: { color: '#3ED2A0', accent: '#04241A' },
  away: { color: '#E24A6E', accent: '#2A0712' },
} as const;

/** ช่องหนึ่งช่องของทีมเราเท่าที่การสร้างแมตช์ต้องใช้ (ตรงกับ OurPitchSlot ของหน้า Matchmaking) */
export interface HomeSlotInput {
  slotId: string;
  x: number;
  y: number;
  player: Player | null;
  cardId: string | null;
  position: Position;
}

/** ทีมสองทีมที่พร้อมส่งเข้า createMatch */
export interface MatchSessionInput {
  /** รหัสประจำแมตช์ ใช้เป็น seed ให้การจำลองซ้ำได้ */
  sessionId: string;
  home: MatchTeamInput;
  away: MatchTeamInput;
}

/**
 * แปลงทีมของผู้เล่นเป็นข้อมูลสำหรับเอนจิน
 *
 * @param excludeCardIds การ์ดที่ไม่ต้องลงสนาม (โดนใบแดงไล่ออกไปแล้ว) — เหลือ 10 คนได้จริง
 */
export const buildHomeTeam = (params: {
  teamId: string;
  teamName: string;
  formation: Formation;
  slots: HomeSlotInput[];
  excludeCardIds?: ReadonlySet<string>;
}): MatchTeamInput => {
  const { teamId, teamName, formation, slots, excludeCardIds } = params;

  const players = slots.flatMap<MatchPlayerInput>((slot, index) => {
    if (!slot.player) return [];
    if (slot.cardId && excludeCardIds?.has(slot.cardId)) return [];

    return [
      {
        id: slot.cardId ?? `${teamId}-${slot.slotId}`,
        name: slot.player.name,
        shirtNumber: index + 1,
        position: slot.position,
        ovr: slot.player.ovr,
        pace: slot.player.stats.pace,
        // ค่าพลัง 6 ด้านจริงของการ์ดใบนี้ — เอนจินใช้คิดการยิง การสกัด และการเซฟ
        stats: slot.player.stats,
        slotId: slot.slotId,
        formationX: slot.x,
        formationY: slot.y,
      },
    ];
  });

  return {
    id: teamId,
    name: teamName,
    formationName: formation.name,
    color: KIT.home.color,
    accent: KIT.home.accent,
    players,
  };
};

/**
 * แปลงทีมคู่แข่งเป็นข้อมูลสำหรับเอนจิน
 *
 * slots มาจาก resolveOpponentSquad ซึ่งใช้ทีมจริงของเขาถ้ามีโปรไฟล์
 * ไม่มีก็ปั้นจากนักเตะจริงใน PLAYERS ที่ OVR ใกล้เคียง — ไม่ว่าทางไหนก็เป็นข้อมูลจริงของเกม
 */
export const buildAwayTeam = (params: {
  opponent: Opponent;
  formation: Formation;
  slots: OpponentSlot[];
}): MatchTeamInput => {
  const { opponent, formation, slots } = params;

  const players = slots.flatMap<MatchPlayerInput>((entry, index) => {
    if (!entry.player) return [];

    return [
      {
        id: `${opponent.id}-${entry.slot.id}`,
        name: entry.player.name,
        shirtNumber: index + 1,
        position: entry.slot.position,
        ovr: entry.player.ovr,
        pace: entry.player.stats.pace,
        stats: entry.player.stats,
        slotId: entry.slot.id,
        formationX: entry.slot.x,
        formationY: entry.slot.y,
      },
    ];
  });

  return {
    id: opponent.id,
    name: opponent.name,
    formationName: formation.name,
    color: KIT.away.color,
    accent: KIT.away.accent,
    players,
  };
};

/**
 * true = ข้อมูลครบพอจะเริ่มจำลองได้จริง
 * ไม่ครบก็ให้ UI ถอยไปแสดงสนามการ์ดแบบเดิมแทนการโชว์สนามโล่ง ๆ
 */
export const isPlayableSession = (session: MatchSessionInput | null): boolean =>
  Boolean(session && session.home.players.length >= 7 && session.away.players.length >= 7);
