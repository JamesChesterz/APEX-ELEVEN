/**
 * ทะเบียนรางวัลกลาง — แปลงรางวัลเป็นข้อความ/ไอคอน และจ่ายเข้าคลังผู้เล่น
 *
 * ทุกระบบที่แจกของ (ล็อกอินรายวัน · ของขวัญแอดมิน · ระบบใหม่ในอนาคต)
 * ควรเรียกผ่านไฟล์นี้ที่เดียว จะได้ไม่ต้องไล่แก้หลายที่ตอนเพิ่มของใหม่
 *
 * เพิ่ม "ไอเทม" ใหม่ในเกม → เพิ่มรายการใน ITEM_REGISTRY อย่างเดียว
 * ทั้งหน้าแอดมิน หน้ารางวัล และการจ่ายของ จะรองรับทันทีโดยไม่ต้องแก้อะไรเพิ่ม
 *
 * เป็น pure function ล้วน ห้าม import React หรือแตะ state
 */
import { UPGRADE_ITEMS, type UpgradeItemId } from '@/data/upgradeConfig';
import { getPlayerById } from '@/data/players';
import type { GameReward, RewardKind } from '@/types/reward';

/* ── ทะเบียนไอเทม ───────────────────────────────────────────── */

export interface ItemDefinition {
  id: string;
  name: string;
  /** คำอธิบายสั้น ๆ ใช้ในหน้าแอดมิน */
  hint: string;
  /** ไฟล์ไอคอน (ไม่มี = ใช้ไอคอนตัวอักษรของประเภทรางวัล) */
  icon?: string;
}

/**
 * ไอเทมทั้งหมดที่แจกได้ในตอนนี้
 *
 * ดึงจาก UPGRADE_ITEMS โดยตรง ไม่ก๊อปชื่อ/ไอคอนมาเขียนซ้ำ
 * เพิ่มไอเทมช่วยอัปเกรดตัวใหม่ใน upgradeConfig.ts แล้วที่นี่เห็นเองทันที
 *
 * ไอเทมประเภทอื่นในอนาคต (เช่น ตั๋วอีเวนต์ · การ์ดฝึก) ต่อท้ายอาร์เรย์นี้ได้เลย
 */
export const ITEM_REGISTRY: ItemDefinition[] = [
  ...UPGRADE_ITEMS.map((item) => ({
    id: item.id as string,
    name: item.name,
    hint: item.hint,
    icon: item.icon,
  })),
];

export const getItemDefinition = (itemId?: string): ItemDefinition | undefined =>
  ITEM_REGISTRY.find((item) => item.id === itemId);

/** ไอเทมนี้เป็นไอเทมช่วยอัปเกรดไหม (ตัวที่คลัง upgradeItems รู้จัก) */
const isUpgradeItemId = (itemId: string): itemId is UpgradeItemId =>
  UPGRADE_ITEMS.some((item) => item.id === itemId);

/* ── ประเภทรางวัล ───────────────────────────────────────────── */

export interface RewardKindDefinition {
  kind: RewardKind;
  label: string;
  /** ไอคอนตัวอักษรสำรอง ใช้เมื่อรางวัลไม่มีรูปของตัวเอง */
  glyph: string;
  /** คลาสสีของตัวเลข */
  tone: string;
  /** true = ต้องกรอกจำนวน */
  needsAmount: boolean;
}

export const REWARD_KINDS: RewardKindDefinition[] = [
  { kind: 'coins', label: 'เหรียญ (BP)', glyph: 'B', tone: 'text-gold', needsAmount: true },
  { kind: 'points', label: 'แต้มแลกนักเตะ', glyph: 'P', tone: 'text-token', needsAmount: true },
  { kind: 'upgradePoints', label: 'แต้มตีบวก', glyph: 'U', tone: 'text-kit', needsAmount: true },
  { kind: 'passTicket', label: 'ตั๋วพาส', glyph: '★', tone: 'text-rarity-legendary', needsAmount: true },
  { kind: 'item', label: 'ไอเทม', glyph: '◆', tone: 'text-rarity-epic', needsAmount: true },
  { kind: 'card', label: 'การ์ดนักเตะ', glyph: '▣', tone: 'text-neon', needsAmount: false },
];

export const getRewardKind = (kind: RewardKind): RewardKindDefinition =>
  REWARD_KINDS.find((entry) => entry.kind === kind) ?? REWARD_KINDS[0];

/* ── อ่านค่า / แสดงผล ───────────────────────────────────────── */

/** บีบรางวัลที่อ่านมาจากเซิร์ฟเวอร์ให้ใช้งานได้เสมอ */
export const normalizeReward = (raw: Partial<GameReward> | null | undefined): GameReward => {
  const kind = REWARD_KINDS.some((entry) => entry.kind === raw?.kind)
    ? (raw!.kind as RewardKind)
    : 'coins';

  const amount = Math.max(1, Math.trunc(Number(raw?.amount)) || 1);

  return {
    kind,
    amount,
    // ไอเทมที่ไม่รู้จัก (เช่นถูกถอดออกจากเกมไปแล้ว) ถอยไปใช้ตัวแรกในทะเบียน
    itemId:
      kind === 'item'
        ? (getItemDefinition(raw?.itemId)?.id ?? ITEM_REGISTRY[0]?.id)
        : undefined,
    playerId: kind === 'card' ? (raw?.playerId ?? '') : undefined,
    upgrade: kind === 'card' ? Math.max(0, Math.trunc(Number(raw?.upgrade)) || 0) : undefined,
    image: raw?.image,
  };
};

/** ชื่อรางวัลแบบอ่านออก เช่น "เหรียญ ×5,000" หรือ "Ronaldo (+3)" */
export const describeReward = (reward: GameReward): string => {
  const amount = reward.amount ?? 1;

  switch (reward.kind) {
    case 'card': {
      const player = reward.playerId ? getPlayerById(reward.playerId) : null;
      const name = player?.name ?? 'การ์ดนักเตะ';
      return reward.upgrade ? `${name} (+${reward.upgrade})` : name;
    }
    case 'item': {
      const item = getItemDefinition(reward.itemId);
      return `${item?.name ?? 'ไอเทม'} ×${amount.toLocaleString('en-US')}`;
    }
    default:
      return `${getRewardKind(reward.kind).label} ×${amount.toLocaleString('en-US')}`;
  }
};

/** รูปของรางวัลนี้ (ไม่มี = ให้ผู้เรียกใช้ glyph แทน) */
export const rewardImage = (reward: GameReward): string | undefined =>
  reward.image ?? (reward.kind === 'item' ? getItemDefinition(reward.itemId)?.icon : undefined);

/** รางวัลใบนี้ตั้งค่าครบพอจะแจกได้ไหม */
export const isRewardValid = (reward: GameReward): boolean => {
  if (reward.kind === 'card') return Boolean(reward.playerId && getPlayerById(reward.playerId));
  if (reward.kind === 'item') return Boolean(getItemDefinition(reward.itemId));
  return (reward.amount ?? 0) > 0;
};

/* ── จ่ายรางวัล ─────────────────────────────────────────────── */

/**
 * ช่องทางจ่ายของ — ผู้เรียกส่งฟังก์ชันจาก usePlayers เข้ามา
 *
 * ทำเป็นพารามิเตอร์แทนที่จะ import hook ตรง ๆ เพื่อให้ไฟล์นี้ยังเป็น pure
 * และเทสได้โดยไม่ต้องมี React
 */
export interface RewardGrantApi {
  addCoins: (amount: number) => void;
  addPoints: (amount: number) => void;
  addUpgradePoints: (amount: number) => void;
  addPassTickets: (amount: number) => void;
  addUpgradeItems: (amounts: Partial<Record<UpgradeItemId, number>>) => void;
  addCard: (playerId: string, upgrade: number) => void;
}

/** จ่ายรางวัลหนึ่งชิ้น — คืน false เมื่อรางวัลตั้งค่าไม่ครบจนจ่ายไม่ได้ */
export const grantReward = (reward: GameReward, api: RewardGrantApi): boolean => {
  const clean = normalizeReward(reward);
  if (!isRewardValid(clean)) return false;

  const amount = clean.amount ?? 1;

  switch (clean.kind) {
    case 'coins':
      api.addCoins(amount);
      return true;
    case 'points':
      api.addPoints(amount);
      return true;
    case 'upgradePoints':
      api.addUpgradePoints(amount);
      return true;
    case 'passTicket':
      api.addPassTickets(amount);
      return true;
    case 'card':
      api.addCard(clean.playerId!, clean.upgrade ?? 0);
      return true;
    case 'item': {
      const itemId = clean.itemId!;
      /*
       * ตอนนี้ทะเบียนมีแต่ไอเทมช่วยอัปเกรด จึงลงคลัง upgradeItems ได้ตรง ๆ
       * ถ้าอนาคตเพิ่มไอเทมประเภทอื่นที่เก็บคนละที่ ให้แตกสาขาเพิ่มตรงนี้จุดเดียว
       */
      if (isUpgradeItemId(itemId)) {
        api.addUpgradeItems({ [itemId]: amount });
        return true;
      }
      return false;
    }
    default:
      return false;
  }
};

/** จ่ายหลายชิ้นรวดเดียว — คืนจำนวนชิ้นที่จ่ายสำเร็จ */
export const grantRewards = (rewards: GameReward[], api: RewardGrantApi): number =>
  rewards.reduce((count, reward) => count + (grantReward(reward, api) ? 1 : 0), 0);
