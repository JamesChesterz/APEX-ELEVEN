/**
 * ภารกิจของ FC ALLSTAR PASS — ทางหลักที่ผู้เล่นเก็บ XP นอกจากการลงแข่ง
 *
 * มีสองชุด:
 *   daily  — รีเซ็ตพร้อมวันแข่ง (06:00) ใช้ตัวนับรายวันที่เกมมีอยู่แล้ว (UpgradeDaily)
 *   season — สะสมยาวทั้งซีซัน คิดจาก "ยอดสะสมตลอดชีพ ลบด้วยยอด ณ วันเปิดซีซัน"
 *
 * ทำไมต้องใช้วิธีลบยอดตั้งต้น: เกมไม่ได้เก็บตัวนับแยกรายซีซันไว้ก่อนหน้านี้
 * ถ้าเก็บตัวนับใหม่แยกอีกชุดจะต้องไปแก้ทุกที่ที่นับ แล้วยังพลาดของเก่าอยู่ดี
 * การจดยอดตั้งต้นไว้ตอนเปิดซีซันแล้วลบกันจึงตรงและแก้ที่เดียว
 *
 * รางวัลเป็น XP ล้วน ๆ ไม่มีของอื่น เพื่อไม่ให้ทับกับรางวัลในรางพาส
 * และเพื่อให้ผู้เล่นฟรีเดินหน้าพาสได้เร็วพอ ๆ กับคนที่ปลดล็อกพรีเมียม
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import type { PassMissionClaims, PassTotals } from '@/types/pass';
import type { UpgradeDaily } from '@/types/account';

/** ตัวนับที่ภารกิจอ้างถึงได้ */
export type MissionMetric = 'login' | 'matches' | 'wins' | 'packs' | 'cards';

/** นิยามภารกิจหนึ่งข้อ */
export interface MissionDef {
  id: string;
  label: string;
  metric: MissionMetric;
  /** ต้องทำให้ถึงเท่าไรถึงจะกดรับได้ */
  target: number;
  /** XP ที่ได้ตอนกดรับ */
  xp: number;
}

/** ภารกิจประจำวัน — รีเซ็ตทุก 06:00 พร้อมวันแข่งของลีก */
export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'd-login', label: 'ล็อกอินวันนี้', metric: 'login', target: 1, xp: 50 },
  { id: 'd-match', label: 'เล่นแมตช์ 1 นัด', metric: 'matches', target: 1, xp: 100 },
  { id: 'd-win', label: 'เก็บชัยชนะ 1 ครั้ง', metric: 'wins', target: 1, xp: 160 },
  { id: 'd-pack', label: 'เปิดการ์ดแพ็ค 1 ครั้ง', metric: 'packs', target: 1, xp: 50 },
];

/** ภารกิจพาส — สะสมยาวทั้งซีซัน กดรับได้ครั้งเดียวต่อซีซัน */
export const SEASON_MISSIONS: MissionDef[] = [
  { id: 's-match', label: 'ลงแข่งครบ 30 นัดในซีซันนี้', metric: 'matches', target: 30, xp: 300 },
  { id: 's-win', label: 'ชนะครบ 10 นัดในซีซันนี้', metric: 'wins', target: 10, xp: 250 },
  { id: 's-pack', label: 'เปิดการ์ดแพ็คครบ 5 ครั้ง', metric: 'packs', target: 5, xp: 200 },
  { id: 's-card', label: 'สะสมการ์ดในคลังครบ 40 ใบ', metric: 'cards', target: 40, xp: 250 },
];

/** ยอดสะสมเปล่า */
export const emptyTotals = (): PassTotals => ({ matches: 0, wins: 0, packs: 0 });

/** บีบยอดสะสมที่อ่านมาจากบัญชีให้เป็นตัวเลขที่ใช้ได้ */
export const normalizeTotals = (raw?: Partial<PassTotals> | null): PassTotals => {
  const safe = (value: unknown): number => {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 9_999_999) : 0;
  };

  return { matches: safe(raw?.matches), wins: safe(raw?.wins), packs: safe(raw?.packs) };
};

/** บีบบันทึกการกดรับภารกิจ */
export const normalizeClaims = (raw?: Partial<PassMissionClaims> | null): PassMissionClaims => {
  const list = (value: unknown): string[] =>
    Array.isArray(value)
      ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))].slice(0, 60)
      : [];

  return {
    dayKey: typeof raw?.dayKey === 'string' ? raw.dayKey.slice(0, 20) : '',
    daily: list(raw?.daily),
    season: list(raw?.season),
  };
};

/**
 * ล้างรายการที่กดรับของ "เมื่อวาน" ทิ้งเมื่อข้ามวันแข่งแล้ว
 * ภารกิจประจำวันจึงกลับมากดรับได้ใหม่โดยไม่ต้องมีตัวจับเวลาแยก
 */
export const rollClaims = (claims: PassMissionClaims, dayKey: string): PassMissionClaims =>
  claims.dayKey === dayKey ? claims : { dayKey, daily: [], season: claims.season };

/** ภารกิจหนึ่งข้อพร้อมความคืบหน้าจริง ใช้วาด UI ได้เลย */
export interface MissionView extends MissionDef {
  scope: 'daily' | 'season';
  /** ทำไปแล้วเท่าไร (ไม่เกิน target) */
  progress: number;
  done: boolean;
  claimed: boolean;
  claimable: boolean;
}

/** ตัวนับดิบทั้งหมดที่ภารกิจต้องใช้ */
export interface MissionCounters {
  daily: UpgradeDaily;
  /** ยอดสะสมของซีซันนี้ (ตลอดชีพ ลบ ยอดตั้งต้นตอนเปิดซีซัน) */
  season: PassTotals;
  /** จำนวนการ์ดในคลังตอนนี้ */
  cards: number;
}

const dailyValue = (metric: MissionMetric, counters: MissionCounters): number => {
  switch (metric) {
    case 'login':
      // เปิดเกมมาเห็นภารกิจนี้ก็คือทำสำเร็จแล้ว
      return 1;
    case 'matches':
      return counters.daily.matchesPlayed;
    case 'wins':
      return counters.daily.wins;
    case 'packs':
      return counters.daily.packsOpened;
    default:
      return counters.cards;
  }
};

const seasonValue = (metric: MissionMetric, counters: MissionCounters): number => {
  switch (metric) {
    case 'login':
      return 1;
    case 'matches':
      return counters.season.matches;
    case 'wins':
      return counters.season.wins;
    case 'packs':
      return counters.season.packs;
    default:
      return counters.cards;
  }
};

/** ประกอบภารกิจหนึ่งชุดพร้อมความคืบหน้า */
export const buildMissions = (
  scope: 'daily' | 'season',
  counters: MissionCounters,
  claims: PassMissionClaims,
): MissionView[] => {
  const defs = scope === 'daily' ? DAILY_MISSIONS : SEASON_MISSIONS;
  const claimed = new Set(scope === 'daily' ? claims.daily : claims.season);

  return defs.map((def) => {
    const raw = scope === 'daily' ? dailyValue(def.metric, counters) : seasonValue(def.metric, counters);
    const progress = Math.min(def.target, Math.max(0, raw));
    const done = progress >= def.target;
    const already = claimed.has(def.id);

    return { ...def, scope, progress, done, claimed: already, claimable: done && !already };
  });
};

/** XP รวมของภารกิจที่กดรับได้อยู่ตอนนี้ */
export const claimableXp = (missions: MissionView[]): number =>
  missions.filter((mission) => mission.claimable).reduce((sum, mission) => sum + mission.xp, 0);

/** หาภารกิจตาม id จากทั้งสองชุด */
export const findMission = (id: string): MissionDef | undefined =>
  [...DAILY_MISSIONS, ...SEASON_MISSIONS].find((mission) => mission.id === id);
