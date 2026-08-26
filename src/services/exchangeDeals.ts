/**
 * ดีลแลกเปลี่ยนการ์ดที่แอดมินสร้างเอง (pure function ล้วน ห้าม import React หรือแตะ state)
 *
 * ต่างจากร้านแลกด้วยแต้ม (services/exchange.ts): ดีลนี้ผู้เล่นจ่ายด้วย "การ์ดที่มีอยู่"
 * ไม่ใช่แต้ม แอดมินกำหนดว่าการ์ดที่ใช้แลกต้องเข้าเงื่อนไขอย่างใดอย่างหนึ่ง
 * (จำนวนเฉย ๆ / OVR ขั้นต่ำ / ตำแหน่ง / ต้องเป็นนักเตะคนเดียวกันซ้ำ ๆ)
 * แล้วได้การ์ดนักเตะที่แอดมินตั้งไว้เป็นรางวัลกลับไปหนึ่งใบ
 *
 * ยังไม่เคยตั้งค่าบนเซิร์ฟเวอร์ = ไม่มีดีลให้แลกเลย (ต่างจากซองการ์ดที่มีชุดค่าเริ่มต้นในโค้ด)
 * ข้อมูลที่มาจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizeExchangeDeals บีบทุกค่าให้อยู่ในกรอบก่อนใช้
 */
import { getPlayerById, PLAYERS } from '@/data/players';
import type { ExchangeDeal, ExchangeRequirement, ExchangeRequirementType } from '@/types/card';
import type { Player, Position } from '@/types/player';

/** กรอบที่ยอมให้ตั้งได้ */
export const EXCHANGE_DEAL_LIMITS = {
  maxDeals: 30,
  minCount: 1,
  maxCount: 20,
  minOvrFloor: 40,
  minOvrCeil: 99,
  maxDescriptionChars: 120,
} as const;

/** ตำแหน่งทั้งหมดที่เลือกได้ในเงื่อนไข position */
export const POSITIONS: Position[] = [
  'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST',
];

export const REQUIREMENT_TYPES: ExchangeRequirementType[] = [
  'quantity',
  'minOvr',
  'position',
  'samePlayer',
];

/** ป้ายชื่อเงื่อนไขแต่ละแบบ ใช้ทั้งฝั่งแอดมินและฝั่งผู้เล่น */
export const REQUIREMENT_LABELS: Record<ExchangeRequirementType, string> = {
  quantity: 'จำนวนการ์ดที่ต้องการ',
  minOvr: 'OVR ที่ต้องการ',
  position: 'ตำแหน่งการ์ดที่ต้องการ',
  samePlayer: 'การ์ดใบเดียวกัน',
};

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
  rewardPlayerId: PLAYERS[0]?.id ?? '',
  requirement: { type: 'quantity', count: 5 },
  enabled: true,
  description: '',
});

/**
 * การ์ดของนักเตะคนนี้เข้าเงื่อนไขของดีล "รายใบ" ไหม (ยังไม่นับเรื่องจำนวนรวม)
 * ใช้กรองว่าการ์ดใบไหนในคลังผู้เล่นหยิบมาใช้แลกดีลนี้ได้บ้าง
 */
export const cardMatchesRequirement = (player: Player, requirement: ExchangeRequirement): boolean => {
  switch (requirement.type) {
    case 'quantity':
      return true;
    case 'minOvr':
      return player.ovr >= (requirement.minOvr ?? EXCHANGE_DEAL_LIMITS.minOvrFloor);
    case 'position':
      return player.position === requirement.position;
    case 'samePlayer':
      return player.id === requirement.samePlayerId;
    default:
      return false;
  }
};

/** สรุปเงื่อนไขเป็นข้อความให้ผู้เล่นอ่านหน้าร้าน */
export const describeRequirement = (requirement: ExchangeRequirement): string => {
  const count = requirement.count;

  switch (requirement.type) {
    case 'quantity':
      return `ใช้การ์ดอะไรก็ได้ ${count} ใบ`;
    case 'minOvr':
      return `ใช้การ์ด OVR ${requirement.minOvr}+ จำนวน ${count} ใบ`;
    case 'position':
      return `ใช้การ์ดตำแหน่ง ${requirement.position} จำนวน ${count} ใบ`;
    case 'samePlayer': {
      const player = requirement.samePlayerId ? getPlayerById(requirement.samePlayerId) : undefined;
      return `ใช้การ์ด "${player?.name ?? 'นักเตะที่กำหนด'}" ซ้ำกัน ${count} ใบ`;
    }
    default:
      return '';
  }
};

/** บีบเงื่อนไขให้อยู่ในกรอบที่ปลอดภัย พร้อมค่า default ของแต่ละประเภท */
const normalizeRequirement = (raw: Partial<ExchangeRequirement> | undefined): ExchangeRequirement => {
  const type = REQUIREMENT_TYPES.includes(raw?.type as ExchangeRequirementType)
    ? (raw?.type as ExchangeRequirementType)
    : 'quantity';
  const count = clampNumber(raw?.count, EXCHANGE_DEAL_LIMITS.minCount, EXCHANGE_DEAL_LIMITS.maxCount, 1);

  if (type === 'minOvr') {
    return {
      type,
      count,
      minOvr: clampNumber(
        raw?.minOvr,
        EXCHANGE_DEAL_LIMITS.minOvrFloor,
        EXCHANGE_DEAL_LIMITS.minOvrCeil,
        EXCHANGE_DEAL_LIMITS.minOvrFloor,
      ),
    };
  }

  if (type === 'position') {
    return { type, count, position: POSITIONS.includes(raw?.position as Position) ? (raw?.position as Position) : 'ST' };
  }

  if (type === 'samePlayer') {
    const samePlayerId =
      typeof raw?.samePlayerId === 'string' && getPlayerById(raw.samePlayerId)
        ? raw.samePlayerId
        : PLAYERS[0]?.id;
    return { type, count, samePlayerId };
  }

  return { type: 'quantity', count };
};

/** บีบดีลหนึ่งใบให้อยู่ในกรอบที่ปลอดภัยก่อนใช้งานจริง */
const normalizeDeal = (raw: Partial<ExchangeDeal>, index: number): ExchangeDeal => {
  const rewardPlayerId =
    typeof raw.rewardPlayerId === 'string' && getPlayerById(raw.rewardPlayerId)
      ? raw.rewardPlayerId
      : PLAYERS[0]?.id ?? '';

  return {
    id: cleanText(raw.id, 40) || `deal-${index + 1}`,
    rewardPlayerId,
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
