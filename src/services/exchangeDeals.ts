/**
 * ดีลแลกเปลี่ยนการ์ดที่แอดมินสร้างเอง (pure function ล้วน ห้าม import React หรือแตะ state)
 *
 * ต่างจากร้านแลกด้วยแต้ม (services/exchange.ts): ดีลนี้ผู้เล่นจ่ายด้วย "การ์ดที่มีอยู่"
 * ไม่ใช่แต้ม แอดมินตั้งเงื่อนไขที่การ์ดแต่ละใบต้องผ่านได้พร้อมกันหลายอย่าง
 * (OVR ขั้นต่ำ / ตำแหน่ง (ได้หลายตำแหน่ง) / ต้องเป็นนักเตะคนเดียวกันซ้ำ ๆ — ไม่ตั้งข้อไหนคือไม่บังคับข้อนั้น)
 * แล้วได้การ์ดนักเตะที่แอดมินตั้งไว้เป็นรางวัลกลับไป (ตั้งได้มากกว่า 1 ใบ)
 *
 * ยังไม่เคยตั้งค่าบนเซิร์ฟเวอร์ = ไม่มีดีลให้แลกเลย (ต่างจากซองการ์ดที่มีชุดค่าเริ่มต้นในโค้ด)
 * ข้อมูลที่มาจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizeExchangeDeals บีบทุกค่าให้อยู่ในกรอบก่อนใช้
 */
import { getPlayerById, PLAYERS } from '@/data/players';
import type { ExchangeDeal, ExchangeRequirement } from '@/types/card';
import type { Player, Position } from '@/types/player';

/** กรอบที่ยอมให้ตั้งได้ */
export const EXCHANGE_DEAL_LIMITS = {
  maxDeals: 30,
  minCount: 1,
  maxCount: 20,
  minOvrFloor: 1,
  minOvrCeil: 300,
  maxDescriptionChars: 120,
  /** จำนวนการ์ดรางวัลสูงสุดต่อหนึ่งดีล */
  maxRewardCards: 20,
} as const;

/** ตำแหน่งทั้งหมดที่เลือกได้ในเงื่อนไข positions */
export const POSITIONS: Position[] = [
  'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST',
];

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const cleanText = (value: unknown, max: number, fallback = ''): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : fallback;

/** ดีลเปล่าไว้เป็นจุดตั้งต้นตอนกด "เพิ่มดีลใหม่" */
export const createEmptyDeal = (): ExchangeDeal => ({
  id: `deal-${Date.now().toString(36)}`,
  rewardPlayerIds: PLAYERS[0] ? [PLAYERS[0].id] : [],
  requirement: { count: 5 },
  enabled: true,
  description: '',
});

/**
 * การ์ดของนักเตะคนนี้เข้าเงื่อนไขของดีล "รายใบ" ไหม (ยังไม่นับเรื่องจำนวนรวม)
 * ต้องผ่านทุกเงื่อนไขที่ตั้งไว้พร้อมกัน (AND) — เงื่อนไขไหนไม่ได้ตั้งค่า ถือว่าผ่านอัตโนมัติ
 */
export const cardMatchesRequirement = (player: Player, requirement: ExchangeRequirement): boolean => {
  if (typeof requirement.minOvr === 'number' && player.ovr < requirement.minOvr) return false;
  if (requirement.positions && requirement.positions.length > 0 && !requirement.positions.includes(player.position)) {
    return false;
  }
  if (requirement.samePlayerId && player.id !== requirement.samePlayerId) return false;
  return true;
};

/** สรุปเงื่อนไขเป็นข้อความให้ผู้เล่นอ่านหน้าร้าน */
export const describeRequirement = (requirement: ExchangeRequirement): string => {
  const parts: string[] = [];

  if (typeof requirement.minOvr === 'number') {
    parts.push(`OVR ${requirement.minOvr}+`);
  }

  if (requirement.positions && requirement.positions.length > 0) {
    parts.push(`ตำแหน่ง ${requirement.positions.join('/')}`);
  }

  if (requirement.samePlayerId) {
    const player = getPlayerById(requirement.samePlayerId);
    parts.push(`นักเตะ "${player?.name ?? 'ที่กำหนด'}"`);
  }

  const condition = parts.length > 0 ? parts.join(' + ') : 'อะไรก็ได้';
  return `ใช้การ์ด ${condition} จำนวน ${requirement.count} ใบ`;
};

/** บีบเงื่อนไขให้อยู่ในกรอบที่ปลอดภัย — เก็บเฉพาะข้อที่ตั้งค่ามาจริง ๆ */
const normalizeRequirement = (raw: Partial<ExchangeRequirement> | undefined): ExchangeRequirement => {
  const count = clampNumber(raw?.count, EXCHANGE_DEAL_LIMITS.minCount, EXCHANGE_DEAL_LIMITS.maxCount, 1);
  const requirement: ExchangeRequirement = { count };

  if (typeof raw?.minOvr === 'number') {
    requirement.minOvr = clampNumber(
      raw.minOvr,
      EXCHANGE_DEAL_LIMITS.minOvrFloor,
      EXCHANGE_DEAL_LIMITS.minOvrCeil,
      EXCHANGE_DEAL_LIMITS.minOvrFloor,
    );
  }

  if (Array.isArray(raw?.positions)) {
    const positions = [...new Set(raw.positions.filter((entry): entry is Position => POSITIONS.includes(entry as Position)))];
    if (positions.length > 0) requirement.positions = positions;
  }

  if (typeof raw?.samePlayerId === 'string' && getPlayerById(raw.samePlayerId)) {
    requirement.samePlayerId = raw.samePlayerId;
  }

  return requirement;
};

/** บีบดีลหนึ่งใบให้อยู่ในกรอบที่ปลอดภัยก่อนใช้งานจริง */
const normalizeDeal = (raw: Partial<ExchangeDeal>, index: number): ExchangeDeal => {
  const rewardPlayerIds = Array.isArray(raw.rewardPlayerIds)
    ? raw.rewardPlayerIds
        .filter((id): id is string => typeof id === 'string' && !!getPlayerById(id))
        .slice(0, EXCHANGE_DEAL_LIMITS.maxRewardCards)
    : [];

  return {
    id: cleanText(raw.id, 40) || `deal-${index + 1}`,
    rewardPlayerIds: rewardPlayerIds.length > 0 ? rewardPlayerIds : (PLAYERS[0] ? [PLAYERS[0].id] : []),
    requirement: normalizeRequirement(raw.requirement),
    enabled: raw.enabled !== false,
    description: cleanText(raw.description, EXCHANGE_DEAL_LIMITS.maxDescriptionChars),
  };
};

/**
 * ทำให้รายการดีลที่มาจากเซิร์ฟเวอร์ใช้งานได้จริง
 * id ซ้ำเติมเลขต่อท้ายให้อัตโนมัติ (เหมือน normalizePacks) กันกดโดนดีลผิดใบ
 */
export const normalizeExchangeDeals = (raw?: Array<Partial<ExchangeDeal>> | null): ExchangeDeal[] => {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();

  return raw.slice(0, EXCHANGE_DEAL_LIMITS.maxDeals).map((entry, index) => {
    const deal = normalizeDeal(entry, index);

    let id = deal.id;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${deal.id}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);

    return { ...deal, id };
  });
};
