/**
 * ทีมพิเศษ (Squad Bonus) — ชุด 11 ตัวจริงที่แอดมินตั้งไว้ล่วงหน้า
 *
 * แอดมินตั้งได้หลายชุด แต่ละชุดคือรายชื่อนักเตะที่ต้องอยู่ใน 11 ตัวจริง "ครบทุกคน"
 * จัดครบเมื่อไหร่ทีมนั้นได้โบนัส Team OVR (ค่าเริ่มต้น +5) ทันที
 * ขาดไปคนเดียวก็ไม่ได้ — ไม่มีโบนัสบางส่วน เพราะจะกลายเป็นโบนัสฟรีของทุกทีม
 *
 * เทียบด้วย playerId (นักเตะ) ไม่ใช่ cardId (การ์ดของผู้เล่นแต่ละใบ)
 * ผู้เล่นจึงใช้การ์ดใบไหนของนักเตะคนนั้นก็ได้ ตีบวกมาแค่ไหนก็ยังเข้าเงื่อนไข
 *
 * ข้อมูลจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizeSquadBonus บีบทุกค่าให้อยู่ในกรอบก่อนใช้
 * ตั้งค่าเพี้ยนแค่ไหนก็ไม่ทำให้ Team OVR ของทั้งเซิร์ฟเวอร์บวม
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { getPlayerById } from '@/data/players';
import type { SquadBonusConfig, SquadBonusTeam } from '@/types/team';

/** กรอบที่ยอมให้ตั้งได้ */
export const SQUAD_BONUS_LIMITS = {
  /** จำนวนชุดทีมที่แอดมินสร้างได้ */
  maxTeams: 20,
  /** หนึ่งชุดมีได้ไม่เกิน 11 คน = 11 ตัวจริงพอดี */
  maxPlayers: 11,
  maxNameChars: 28,
  maxDescriptionChars: 80,
  minBonus: 1,
  maxBonus: 30,
  /**
   * เพดานโบนัสรวมเมื่อเข้าเงื่อนไขหลายชุดพร้อมกัน
   *
   * ชุดที่ครบ 11 คนเข้าได้ทีละชุดอยู่แล้ว (11 ช่องหมดไปกับชุดนั้น)
   * แต่ชุดสั้น ๆ ที่แอดมินตั้งไว้ 3–4 คนซ้อนกันได้หลายชุด เพดานนี้จึงกันตัวเลขวิ่งหนี
   */
  maxTotalBonus: 30,
} as const;

/** โบนัสตั้งต้นของชุดใหม่ (ตามที่ตกลงกันไว้: ครบทีม +5) */
export const DEFAULT_SQUAD_BONUS = 5;

/** ชุดทีมว่างไว้เป็นจุดตั้งต้นตอนกด "เพิ่มทีม" */
export const createEmptySquadBonusTeam = (): SquadBonusTeam => ({
  id: `set-${Date.now().toString(36)}`,
  name: 'ทีมพิเศษใหม่',
  description: '',
  playerIds: [],
  bonus: DEFAULT_SQUAD_BONUS,
  enabled: true,
});

const clampText = (value: unknown, max: number, fallback: string): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, max);
};

const clampBonus = (value: unknown): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_SQUAD_BONUS;
  return Math.min(SQUAD_BONUS_LIMITS.maxBonus, Math.max(SQUAD_BONUS_LIMITS.minBonus, parsed));
};

/**
 * รายชื่อนักเตะของหนึ่งชุด — ตัดชื่อซ้ำและ id ที่ไม่มีอยู่จริงทิ้ง
 *
 * ชื่อซ้ำในชุดเดียวกันเป็นไปไม่ได้อยู่แล้วบนสนาม (useTeam ห้ามชื่อซ้ำใน 11 ตัวจริง)
 * ถ้าปล่อยผ่าน ชุดนั้นจะกลายเป็นชุดที่ไม่มีวันครบ — เท่ากับโบนัสที่แจกไม่ได้เลย
 */
const normalizePlayerIds = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();

  return raw
    .flatMap((entry): string[] => {
      const id = typeof entry === 'string' ? entry.trim() : '';
      if (!id || seen.has(id) || !getPlayerById(id)) return [];
      seen.add(id);
      return [id];
    })
    .slice(0, SQUAD_BONUS_LIMITS.maxPlayers);
};

/** บีบค่าตั้งทั้งก้อนจากเซิร์ฟเวอร์ให้ปลอดภัย (ยังไม่เคยตั้ง = ปิดและไม่มีชุดเลย) */
export const normalizeSquadBonus = (raw: unknown): SquadBonusConfig => {
  const source = (raw ?? {}) as Partial<SquadBonusConfig>;
  const usedIds = new Set<string>();

  const teams = Array.isArray(source.teams)
    ? source.teams
        .slice(0, SQUAD_BONUS_LIMITS.maxTeams)
        .flatMap((entry, index): SquadBonusTeam[] => {
          if (!entry || typeof entry !== 'object') return [];

          const team = entry as Partial<SquadBonusTeam>;
          const rawId = typeof team.id === 'string' ? team.id.trim().slice(0, 40) : '';
          const id = rawId && !usedIds.has(rawId) ? rawId : `set-${index}`;
          if (usedIds.has(id)) return [];

          const playerIds = normalizePlayerIds(team.playerIds);
          // ชุดที่ไม่มีนักเตะเลยคือชุดที่ทุกคนได้โบนัสฟรี — ทิ้งทั้งชุดดีกว่า
          if (playerIds.length === 0) return [];

          usedIds.add(id);
          return [
            {
              id,
              name: clampText(team.name, SQUAD_BONUS_LIMITS.maxNameChars, id),
              description: clampText(team.description, SQUAD_BONUS_LIMITS.maxDescriptionChars, ''),
              playerIds,
              bonus: clampBonus(team.bonus),
              enabled: team.enabled !== false,
            },
          ];
        })
    : [];

  return { enabled: source.enabled === true, teams };
};

/** ความคืบหน้าของหนึ่งชุด เทียบกับ 11 ตัวจริงชุดปัจจุบัน */
export interface SquadBonusProgress {
  team: SquadBonusTeam;
  /** playerId ที่จัดลงสนามแล้ว */
  matched: string[];
  /** playerId ที่ยังขาด */
  missing: string[];
  /** true = ครบทุกคน ได้โบนัสแล้ว */
  complete: boolean;
}

/**
 * เทียบ 11 ตัวจริงกับทุกชุดที่แอดมินเปิดไว้
 *
 * รับ playerId ของคนที่ "ลงสนามจริง" เท่านั้น (ช่องว่างและตัวสำรองไม่นับ)
 * คืนความคืบหน้าของทุกชุดที่เปิดอยู่ ไม่ใช่เฉพาะชุดที่ครบ — เพราะหน้าเกม
 * ต้องบอกผู้เล่นได้ว่ายังขาดใครถึงจะได้โบนัส ไม่ใช่รอให้ครบแล้วค่อยโผล่มา
 */
export const squadBonusProgress = (
  playerIdsOnPitch: Array<string | null | undefined>,
  config: SquadBonusConfig,
): SquadBonusProgress[] => {
  if (!config.enabled) return [];

  const onPitch = new Set(playerIdsOnPitch.filter((id): id is string => Boolean(id)));

  return config.teams
    .filter((team) => team.enabled)
    .map((team) => {
      const matched = team.playerIds.filter((id) => onPitch.has(id));
      const missing = team.playerIds.filter((id) => !onPitch.has(id));
      return { team, matched, missing, complete: missing.length === 0 };
    });
};

/** โบนัส Team OVR รวมจากชุดที่จัดครบแล้ว (บีบไม่ให้เกินเพดาน) */
export const totalSquadBonus = (progress: SquadBonusProgress[]): number => {
  const total = progress
    .filter((entry) => entry.complete)
    .reduce((sum, entry) => sum + entry.team.bonus, 0);

  return Math.min(SQUAD_BONUS_LIMITS.maxTotalBonus, total);
};

/** ชื่อนักเตะจาก playerId ไว้แสดงบน UI (หาไม่เจอ = คืน id ไปตรง ๆ) */
export const squadBonusPlayerName = (playerId: string): string =>
  getPlayerById(playerId)?.name ?? playerId;

/** ปัญหาที่ต้องแก้ก่อนบันทึกได้ (array ว่าง = บันทึกได้) */
export const squadBonusTeamIssues = (team: SquadBonusTeam, others: SquadBonusTeam[]): string[] => {
  const issues: string[] = [];

  if (!team.name.trim()) issues.push('ยังไม่ได้ตั้งชื่อทีม');
  if (team.playerIds.length === 0) issues.push('ยังไม่ได้เลือกนักเตะสักคน');
  if (team.playerIds.length > SQUAD_BONUS_LIMITS.maxPlayers) {
    issues.push(`เลือกได้ไม่เกิน ${SQUAD_BONUS_LIMITS.maxPlayers} คน`);
  }
  if (team.bonus < SQUAD_BONUS_LIMITS.minBonus || team.bonus > SQUAD_BONUS_LIMITS.maxBonus) {
    issues.push(`โบนัสต้องอยู่ระหว่าง ${SQUAD_BONUS_LIMITS.minBonus}–${SQUAD_BONUS_LIMITS.maxBonus}`);
  }
  if (others.some((other) => other.id === team.id)) issues.push('รหัสทีมซ้ำกับทีมที่มีอยู่แล้ว');

  /*
   * ชื่อซ้ำในชุดเดียวกันทำให้ชุดนั้นไม่มีวันครบ (สนามห้ามนักเตะชื่อเดียวกันลงพร้อมกัน)
   * เตือนตั้งแต่ตอนตั้งค่า ดีกว่าปล่อยให้แอดมินงงว่าทำไมไม่มีใครได้โบนัสสักคน
   */
  const names = team.playerIds.map((id) => squadBonusPlayerName(id).trim().toUpperCase());
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) issues.push(`มีนักเตะชื่อซ้ำในชุด (${duplicate}) — ชุดนี้จะไม่มีวันครบ`);

  return issues;
};
