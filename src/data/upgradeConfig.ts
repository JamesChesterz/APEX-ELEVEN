/**
 * ═══════════════════════════════════════════════════════════════
 *  ตารางตีบวก +0 → +8 — แหล่งข้อมูลเดียวของทั้งเกม
 * ═══════════════════════════════════════════════════════════════
 *
 * ทุกระบบที่เกี่ยวกับการตีบวก (UI, Attribute Engine, Cloud Function, Admin)
 * ต้องอ่านตัวเลขจากไฟล์นี้เท่านั้น ห้ามเขียนสูตรของตัวเองแยกไว้ที่ไหน
 * เคยเจอมาแล้วว่าตัวเลขสองที่ไม่ตรงกันแล้วหาไม่เจอว่าใครถูก
 *
 * ⚠️ เรื่องสกุลเงิน — เกมนี้มีสามกอง ไม่มี "material" แยกต่างหาก:
 *   coins         = เหรียญ (ใช้ซื้อซอง)
 *   points        = แต้มแลกนักเตะ (ได้จากย่อยการ์ด)
 *   upgradePoints = แต้มตีบวก (ได้จากลีก/ภารกิจ/ชนะ Matchmaking)
 *
 * จึง map ตามนี้:  materialCost → แต้มตีบวก · coinCost → เหรียญ
 * ขั้น +1 ถึง +5 คิดแต้มตีบวกเท่าเดิมเป๊ะและ coinCost = 0
 * เพื่อไม่ให้สมดุลเดิมของผู้เล่นที่ตีบวกค้างไว้เปลี่ยนไปเลย
 * ส่วนขั้น +6 ถึง +8 ที่เพิ่งเปิดใหม่ ถึงเริ่มคิดเหรียญด้วย
 *
 * เป็น pure data ล้วน ห้าม import React หรือแตะ state
 */

/** หนึ่งขั้นของการตีบวก (จาก from ไป to) */
export interface UpgradeStep {
  /** ค่าบวกก่อนตี */
  from: number;
  /** ค่าบวกหลังตีสำเร็จ (= from + 1 เสมอ) */
  to: number;
  /** โอกาสสำเร็จ 0–1 (1 = การันตี) */
  successRate: number;
  /** เหรียญที่ต้องจ่าย */
  coinCost: number;
  /**
   * แต้มตีบวกที่ต้องจ่าย
   *
   * ⚠️ เลิกใช้เป็นค่าอัปเกรดแล้ว (เปลี่ยนไปใช้การ์ดนักเตะแทน)
   * ยังเก็บฟิลด์ไว้เพื่อไม่ให้ค่าตั้งเดิมของแอดมินและ Cloud Function พัง
   * และเผื่ออยากเปิดกลับมาใช้ทีหลัง
   */
  materialCost: number;
  /**
   * จำนวนการ์ดนักเตะที่ขั้นนี้บังคับต้องใส่
   * ไม่ใส่ = ใช้ตารางเริ่มต้น (ดู getRequiredMaterialCards)
   */
  materialCards?: number;
  /** ค่าพลังทั้ง 6 ด้านที่เพิ่มขึ้นเมื่อขั้นนี้สำเร็จ */
  statBonus: number;
  /**
   * ตีไม่ติดแล้วค่าบวกลดลงกี่ขั้น (0 = ไม่ลด)
   *
   * ขั้นต้น ๆ ตั้งเป็น 0 ไว้ตามกติกาเดิมของเกม — ตีไม่ติดก็แค่เสียของ
   * ขั้นสูงถึงเริ่มลดระดับ ซึ่งเป็นจุดที่ "การ์ดป้องกัน" มีค่าขึ้นมา
   */
  dropOnFail: number;
}

/* ── การ์ดนักเตะที่ใช้อัปเกรด ───────────────────────────────── */

/**
 * ช่อง "นักเตะในการอัปเกรด" มีกี่ช่อง (ตามแบบหน้าจอ = 5 ช่อง)
 *
 * ⚠️ การอัปเกรดไม่ใช้ "แต้มตีบวก" เป็นค่าวัตถุดิบแล้ว
 * ค่ากดคือเหรียญ/BP อย่างเดียว ส่วนการ์ดนักเตะเป็น "ตัวเลือก" ล้วน ๆ:
 * ไม่ใส่เลยก็กดอัปเกรดได้ ใส่แล้วได้โบนัสโอกาสสำเร็จเป็นการแลก
 * ส่วนแต้มตีบวกถูกย้ายไปซื้อไอเทมช่วยอัปเกรดแทน (ดู UPGRADE_ITEMS ข้างล่าง)
 * ของเดิมจึงไม่ถูกทิ้ง แค่เปลี่ยนหน้าที่ — เซฟเก่าที่มีแต้มค้างอยู่ยังใช้ได้ทันที
 */
export const MATERIAL_CARD_SLOTS = 5;

/** การ์ดที่ใส่ในช่อง เพิ่มโอกาสสำเร็จใบละเท่าไร (0.05 = +5%) */
export const MATERIAL_CARD_BOOST = 0.05;

/**
 * จำนวนการ์ดที่แต่ละขั้น "บังคับ" ต้องใส่ (คีย์ = ค่าบวกก่อนตี)
 *
 * ค่าเริ่มต้นคือ 0 ทุกขั้น = ไม่บังคับ ผู้เล่นกดอัปเกรดมือเปล่าได้
 * ตารางนี้เก็บไว้เพราะแอดมินยังตั้งทับรายขั้นได้ผ่าน step.materialCards
 * (เช่น อยากให้ +7 ขึ้นไปต้องมีต้นทุนการ์ดจริง ค่อยใส่เลขที่ขั้นนั้น)
 */
const DEFAULT_MATERIAL_CARDS: Record<number, number> = {};

/**
 * ต้องใส่การ์ดกี่ใบถึงจะกดอัปเกรดขั้นนี้ได้ (0 = ไม่บังคับ)
 * อ่านจาก step.materialCards ก่อน (แอดมินตั้งทับได้) ไม่มีค่อยใช้ตารางเริ่มต้น
 */
export const getRequiredMaterialCards = (step: UpgradeStep | null): number => {
  if (!step) return 0;
  const override = Math.trunc(step.materialCards ?? 0);
  if (override > 0) return Math.min(override, MATERIAL_CARD_SLOTS);

  return DEFAULT_MATERIAL_CARDS[step.from] ?? 0;
};

/**
 * โอกาสสำเร็จหลังใส่การ์ดเกินจำนวนที่บังคับ
 * บีบไม่ให้เกิน 100% และไม่ให้ต่ำกว่าอัตราพื้นฐานของขั้นนั้น
 */
export const getBoostedSuccessRate = (baseRate: number, extraCards: number): number => {
  const used = Math.min(Math.max(Math.trunc(extraCards) || 0, 0), MATERIAL_CARD_SLOTS);
  return Math.min(1, baseRate + used * MATERIAL_CARD_BOOST);
};

/* ── ไอเทมช่วยอัปเกรด (การ์ดกันแตก ฯลฯ) ─────────────────────── */

/** ไอเทมช่วยอัปเกรดมีสามชนิด ตรงตามแบบหน้าจอ */
export type UpgradeItemId = 'boost' | 'protect' | 'guarantee';

/** จำนวนไอเทมที่ถืออยู่ แยกตามชนิด */
export type UpgradeItemStock = Record<UpgradeItemId, number>;

export interface UpgradeItemDef {
  id: UpgradeItemId;
  /** ชื่อที่ขึ้นใต้ไอคอนหกเหลี่ยม */
  name: string;
  /** คำอธิบายสั้น ๆ ใน tooltip / ร้านค้า */
  hint: string;
  /** ราคาเป็น "แต้มตีบวก" (สกุลเงินเดิมที่ถูกย้ายมาใช้ตรงนี้) */
  price: number;
  /** ใส่ได้สูงสุดกี่ชิ้นต่อการกดอัปเกรดหนึ่งครั้ง */
  maxPerAttempt: number;
  /**
   * สีประจำไอเทม — ทอง / ฟ้า / ม่วง ตามแบบ
   *
   * ⚠️ ต้องเขียนชื่อคลาส Tailwind เต็ม ๆ ตรงนี้เท่านั้น ห้ามประกอบสตริงตอนรันไทม์
   * (เช่น ring.replace('border-','bg-')) เพราะ Tailwind สแกนหาคลาสจากซอร์ส
   * คลาสที่ถูกสร้างตอนรันไทม์จะไม่ถูก build ออกมา = สีหาย
   */
  edge: string;
  text: string;
  glow: string;
}

/** ไอเทม "เพิ่มโอกาส" หนึ่งชิ้นดันโอกาสสำเร็จขึ้นเท่าไร */
export const ITEM_BOOST_RATE = 0.05;

export const UPGRADE_ITEMS: UpgradeItemDef[] = [
  {
    id: 'boost',
    name: 'เพิ่มโอกาส',
    hint: `ดันโอกาสสำเร็จ +${Math.round(ITEM_BOOST_RATE * 100)}% ต่อชิ้น (ใส่ได้ 3 ชิ้น)`,
    price: 1_500,
    maxPerAttempt: 3,
    edge: 'bg-gold/70',
    text: 'text-gold',
    glow: 'shadow-[0_0_18px_-4px_rgba(245,185,62,0.85)]',
  },
  {
    id: 'protect',
    name: 'ป้องกันลดขั้น',
    hint: 'การ์ดกันแตก — อัปเกรดไม่ติดแล้วค่าบวกจะไม่ลด (ใช้เฉพาะตอนที่มันกันได้จริง)',
    price: 4_000,
    maxPerAttempt: 1,
    edge: 'bg-sky-400/70',
    text: 'text-sky-300',
    glow: 'shadow-[0_0_18px_-4px_rgba(56,189,248,0.85)]',
  },
  {
    id: 'guarantee',
    name: 'การันตีขั้น',
    hint: 'อัปเกรดขั้นนี้สำเร็จ 100% (ใช้ได้ครั้งละชิ้น)',
    price: 20_000,
    maxPerAttempt: 1,
    edge: 'bg-fuchsia-400/70',
    text: 'text-fuchsia-300',
    glow: 'shadow-[0_0_18px_-4px_rgba(232,121,249,0.85)]',
  },
];

/** หานิยามไอเทมจาก id */
export const getUpgradeItem = (id: UpgradeItemId): UpgradeItemDef =>
  UPGRADE_ITEMS.find((item) => item.id === id) ?? UPGRADE_ITEMS[0];

/* ── ร้านค้าไอเทม (แอดมินตั้งได้) ───────────────────────────── */

/**
 * ไอเทมหนึ่งชิ้นที่วางขายอยู่ในร้าน
 *
 * ชื่อ/คำอธิบาย/ผลของไอเทมอยู่ใน UPGRADE_ITEMS (แก้ในโค้ด เพราะผูกกับกติกา)
 * ส่วนที่แอดมินปรับได้คือ "ขายไหม ราคาเท่าไร จ่ายด้วยอะไร ซื้อทีละกี่ชิ้น"
 */
export interface UpgradeItemOffer {
  id: UpgradeItemId;
  /** false = ซ่อนไอเทมนี้จากร้าน (ผู้เล่นที่มีอยู่แล้วยังใช้ได้ตามปกติ) */
  enabled: boolean;
  /** ราคาเป็นแต้มตีบวก (0 = ไม่ขายด้วยแต้ม) */
  price: number;
  /** ราคาเป็นเหรียญ/BP (0 = ไม่ขายด้วยเหรียญ) */
  coinPrice: number;
  /** ซื้อได้สูงสุดกี่ชิ้นต่อการกดหนึ่งครั้ง */
  bundle: number;
}

/** ค่าตั้งทั้งหมดของร้านไอเทม (config/upgradeItemShop) */
export interface UpgradeItemShopConfig {
  /** false = ปิดร้านทั้งร้าน ผู้เล่นกดเข้าไปจะเห็นข้อความว่าปิดอยู่ */
  enabled: boolean;
  offers: UpgradeItemOffer[];
}

/** ร้านเริ่มต้นที่ใช้เมื่อแอดมินยังไม่เคยตั้งค่า — ราคามาจากนิยามไอเทมในโค้ด */
export const DEFAULT_ITEM_SHOP: UpgradeItemShopConfig = {
  enabled: true,
  offers: UPGRADE_ITEMS.map((item) => ({
    id: item.id,
    enabled: true,
    price: item.price,
    coinPrice: 0,
    bundle: 1,
  })),
};

/**
 * บีบค่าที่อ่านมาจากเซิร์ฟเวอร์ให้อยู่ในกรอบที่ใช้งานได้เสมอ
 *
 * ⚠️ ต้องคืนรายการครบทุกไอเทมตามลำดับใน UPGRADE_ITEMS เสมอ
 * ไม่งั้นแอดมินที่บันทึกไว้ตอนมีไอเทมสองชนิด จะทำให้ชนิดที่สามหายจากหน้าจอไปเงียบ ๆ
 */
export const normalizeItemShop = (
  raw: Partial<UpgradeItemShopConfig> | null | undefined,
): UpgradeItemShopConfig => {
  const saved = Array.isArray(raw?.offers) ? raw.offers : [];
  const safe = (value: unknown, fallback = 0): number => {
    const number = Math.trunc(Number(value));
    return Number.isFinite(number) && number > 0 ? number : fallback;
  };

  return {
    enabled: raw?.enabled !== false,
    offers: UPGRADE_ITEMS.map((item) => {
      const found = saved.find((entry) => entry?.id === item.id);
      const fallback = DEFAULT_ITEM_SHOP.offers.find((entry) => entry.id === item.id)!;

      if (!found) return { ...fallback };

      return {
        id: item.id,
        enabled: found.enabled !== false,
        // ราคา 0 = ปิดช่องทางจ่ายนั้น จึงต้องยอมให้เป็นศูนย์ได้จริง
        price: Math.max(0, safe(found.price, 0)),
        coinPrice: Math.max(0, safe(found.coinPrice, 0)),
        bundle: Math.min(99, safe(found.bundle, 1)),
      };
    }),
  };
};

/** ช่องไอเทมเปล่า */
export const emptyItemStock = (): UpgradeItemStock => ({ boost: 0, protect: 0, guarantee: 0 });

/**
 * ปัดข้อมูลไอเทมจากเซฟให้อยู่ในรูปที่ใช้ได้เสมอ
 * บัญชีเก่าที่มีแต่ protectCards จะถูกยกมาเป็นไอเทม protect ให้อัตโนมัติ
 */
export const normalizeItemStock = (
  raw: Partial<UpgradeItemStock> | undefined,
  legacyProtectCards = 0,
): UpgradeItemStock => {
  const safe = (value: unknown): number => Math.max(0, Math.trunc(Number(value) || 0));

  return {
    boost: safe(raw?.boost),
    protect: raw?.protect === undefined ? safe(legacyProtectCards) : safe(raw.protect),
    guarantee: safe(raw?.guarantee),
  };
};

/* ── โบนัสสะสมจากการอัปเกรดพลาด ─────────────────────────────── */

/** โบนัสสะสมมีกี่ขั้น (ตามแบบ: โล่ 1–5) */
export const MAX_STREAK_STAGE = 5;

/** โบนัสสะสมหนึ่งขั้นดันโอกาสสำเร็จขึ้นเท่าไร */
export const STREAK_BONUS_RATE = 0.02;

/**
 * ระบบชดเชยคนดวงไม่ดี: อัปเกรดพลาดสะสมทีละขั้น (สูงสุด 5)
 * ทุกขั้นที่สะสมไว้ดันโอกาสสำเร็จของครั้งถัดไปขึ้น แล้วรีเซ็ตเมื่อสำเร็จ
 * เก็บไว้ที่การ์ดแต่ละใบ (card.upgradeStreak) จึงไม่ปนกันระหว่างใบ
 */
export const clampStreak = (streak: number | undefined): number =>
  Math.min(Math.max(Math.trunc(streak ?? 0) || 0, 0), MAX_STREAK_STAGE);

export const getStreakBonus = (streak: number | undefined): number =>
  clampStreak(streak) * STREAK_BONUS_RATE;

/* ── ตารางโอกาสที่โชว์ในแผงขวา ─────────────────────────────── */

/**
 * โอกาสของผลลัพธ์ทั้งห้าแบบ รวมกันได้ 1 เสมอ
 * (ชื่อฟิลด์ตรงกับหัวข้อในแผง "ข้อมูลอัปเกรด")
 *
 *   success  = เพิ่มโอกาส  → ขึ้น 1 ขั้น
 *   bigDrop  = ลดโอกาส    → ลดมากกว่า 1 ขั้น (เกมนี้ยังไม่ใช้ = 0)
 *   stay     = คงที่       → ไม่ติด แต่ค่าบวกเท่าเดิม
 *   drop     = ลดขั้น      → ไม่ติด แล้วค่าบวกลด 1 ขั้น
 *   destroy  = ล้มเหลว     → การ์ดหาย (เกมนี้ไม่ทำลายการ์ด = 0 ตลอด)
 */
export interface UpgradeOdds {
  success: number;
  bigDrop: number;
  stay: number;
  drop: number;
  destroy: number;
}

export interface UpgradeOddsInput {
  /** การ์ดที่ใส่เกินจากจำนวนที่บังคับ */
  extraCards?: number;
  /** ไอเทมเพิ่มโอกาสที่ใส่ */
  boostItems?: number;
  /** ติดไอเทมป้องกันลดขั้นไว้ไหม */
  useProtect?: boolean;
  /** ใช้ไอเทมการันตีขั้นไหม */
  useGuarantee?: boolean;
  /** โบนัสสะสมของการ์ดใบนี้ */
  streak?: number;
}

/** โอกาสสำเร็จจริงหลังรวมทุกตัวช่วยแล้ว */
export const getFinalSuccessRate = (
  step: UpgradeStep | null,
  input: UpgradeOddsInput = {},
): number => {
  if (!step) return 0;
  if (input.useGuarantee) return 1;

  const extras = Math.min(Math.max(Math.trunc(input.extraCards ?? 0) || 0, 0), MATERIAL_CARD_SLOTS);
  const items = Math.min(Math.max(Math.trunc(input.boostItems ?? 0) || 0, 0), 3);

  const total =
    step.successRate +
    extras * MATERIAL_CARD_BOOST +
    items * ITEM_BOOST_RATE +
    getStreakBonus(input.streak);

  return Math.min(1, Math.max(0, total));
};

/** ตารางโอกาสทั้งห้าแถวของแผงขวา */
export const getUpgradeOdds = (
  step: UpgradeStep | null,
  input: UpgradeOddsInput = {},
): UpgradeOdds => {
  if (!step) return { success: 0, bigDrop: 0, stay: 1, drop: 0, destroy: 0 };

  const success = getFinalSuccessRate(step, input);
  const rest = Math.max(0, 1 - success);

  // ขั้นที่ไม่ลดระดับอยู่แล้ว หรือกันไว้ด้วยไอเทม → ที่เหลือทั้งหมดเป็น "คงที่"
  const willDrop = step.dropOnFail > 0 && !input.useProtect;

  return {
    success,
    bigDrop: 0,
    stay: willDrop ? 0 : rest,
    drop: willDrop ? rest : 0,
    destroy: 0,
  };
};

/* ── ฉากหลังของหน้าตีบวก ────────────────────────────────────── */

/** ค่าตั้งหน้าตาของหน้าตีบวก ที่แอดมินปรับได้ */
export interface UpgradeSceneConfig {
  /**
   * ลิงก์รูปพื้นหลังของหน้าตีบวก (ว่าง = ใช้พื้นหลังเริ่มต้นของเกม)
   * ใส่ได้ทั้งไฟล์ใน public/ (เช่น /upgrade-bg.webp) และ URL เต็ม
   */
  backgroundUrl?: string;
}

/** ตีบวกได้สูงสุด +8 */
export const MAX_UPGRADE = 8;

/**
 * ค่าพลังที่เพิ่มต่อหนึ่งขั้น — ต้องเท่ากันทุกขั้น
 * ถ้าวันหนึ่งอยากให้ขั้นสูง ๆ ได้ค่าพลังเยอะกว่า ให้แก้ statBonus รายขั้นได้เลย
 * ตัวคำนวณโบนัสรวม (getUpgradeBonus) บวกทีละขั้นอยู่แล้ว ไม่ได้คูณตรง ๆ
 */
const STAT_BONUS_PER_STEP = 2;

/**
 * ตารางกลาง +0 → +8
 *
 * ตัวเลขของ +1..+5 คือของเดิมที่ใช้กันมาตั้งแต่ระบบตีบวกเวอร์ชันแรก
 * (โอกาส 100% / 80% / 70% / 40% / 30% · แต้ม 500 / 1,000 / 2,000 / 3,000 / 5,000)
 */
export const UPGRADE_STEPS: UpgradeStep[] = [
  { from: 0, to: 1, successRate: 1.0, coinCost: 0, materialCost: 500, statBonus: STAT_BONUS_PER_STEP, dropOnFail: 0 },
  { from: 1, to: 2, successRate: 0.8, coinCost: 0, materialCost: 1_000, statBonus: STAT_BONUS_PER_STEP, dropOnFail: 0 },
  { from: 2, to: 3, successRate: 0.7, coinCost: 0, materialCost: 2_000, statBonus: STAT_BONUS_PER_STEP, dropOnFail: 0 },
  { from: 3, to: 4, successRate: 0.4, coinCost: 0, materialCost: 3_000, statBonus: STAT_BONUS_PER_STEP, dropOnFail: 0 },
  { from: 4, to: 5, successRate: 0.3, coinCost: 0, materialCost: 5_000, statBonus: STAT_BONUS_PER_STEP, dropOnFail: 0 },
  { from: 5, to: 6, successRate: 0.22, coinCost: 25_000, materialCost: 8_000, statBonus: STAT_BONUS_PER_STEP, dropOnFail: 1 },
  { from: 6, to: 7, successRate: 0.15, coinCost: 50_000, materialCost: 12_000, statBonus: STAT_BONUS_PER_STEP, dropOnFail: 1 },
  { from: 7, to: 8, successRate: 0.1, coinCost: 100_000, materialCost: 20_000, statBonus: STAT_BONUS_PER_STEP, dropOnFail: 1 },
];

/** บีบค่าบวกให้อยู่ในช่วง 0–8 เสมอ (กันข้อมูลเพี้ยนจากเซฟเก่า) */
export const clampUpgrade = (upgrade: number): number => {
  if (!Number.isFinite(upgrade)) return 0;
  return Math.min(Math.max(Math.trunc(upgrade), 0), MAX_UPGRADE);
};

/**
 * ขั้นถัดไปของค่าบวกนี้ — null = ตีบวกจนสุดแล้ว
 * ทุกที่ที่อยากรู้ราคา/โอกาส ต้องผ่านฟังก์ชันนี้ ห้ามไปหยิบจาก UPGRADE_STEPS ตรง ๆ
 */
export const getUpgradeStep = (upgrade: number): UpgradeStep | null =>
  ACTIVE_STEPS.find((step) => step.from === clampUpgrade(upgrade)) ?? null;

/** ตีบวกต่อได้อีกไหม */
export const canUpgrade = (upgrade: number): boolean => getUpgradeStep(upgrade) !== null;

/**
 * ค่าพลังรวมที่ได้จากการตีบวกถึงระดับนี้ (+0 = 0)
 * บวกทีละขั้นจากตาราง จึงรองรับกรณีที่แต่ละขั้นให้ค่าพลังไม่เท่ากันในอนาคต
 */
export const getUpgradeBonus = (upgrade: number): number => {
  const target = clampUpgrade(upgrade);
  return ACTIVE_STEPS.filter((step) => step.to <= target).reduce(
    (sum, step) => sum + step.statBonus,
    0,
  );
};

/** แต้มตีบวกรวมที่ต้องใช้ถ้าตีสำเร็จรวดเดียวจากตรงนี้จนถึง +8 */
export const getRemainingMaterialCost = (upgrade: number): number =>
  ACTIVE_STEPS.filter((step) => step.from >= clampUpgrade(upgrade)).reduce(
    (sum, step) => sum + step.materialCost,
    0,
  );

/** เหรียญรวมที่ต้องใช้ถ้าตีสำเร็จรวดเดียวจากตรงนี้จนถึง +8 */
export const getRemainingCoinCost = (upgrade: number): number =>
  ACTIVE_STEPS.filter((step) => step.from >= clampUpgrade(upgrade)).reduce(
    (sum, step) => sum + step.coinCost,
    0,
  );

/**
 * ตรวจว่าตารางที่แอดมินแก้มายังใช้งานได้จริงไหม
 * คืนรายการปัญหาเป็นข้อความ (ว่าง = ผ่าน) ใช้ทั้งในหน้า ADMIN และในเทส
 */
export const validateUpgradeSteps = (steps: UpgradeStep[]): string[] => {
  const problems: string[] = [];

  if (steps.length !== MAX_UPGRADE) {
    problems.push(`ต้องมีครบ ${MAX_UPGRADE} ขั้น (ตอนนี้มี ${steps.length})`);
  }

  steps.forEach((step, index) => {
    if (step.from !== index) problems.push(`ขั้นที่ ${index + 1}: from ต้องเป็น ${index}`);
    if (step.to !== step.from + 1) problems.push(`+${step.from}: to ต้องเป็น ${step.from + 1}`);
    if (step.successRate <= 0 || step.successRate > 1) {
      problems.push(`+${step.from} → +${step.to}: โอกาสสำเร็จต้องอยู่ในช่วง 0–1`);
    }
    if (step.coinCost < 0 || step.materialCost < 0) {
      problems.push(`+${step.from} → +${step.to}: ราคาติดลบไม่ได้`);
    }
    if (step.statBonus < 0) problems.push(`+${step.from} → +${step.to}: ค่าพลังที่ได้ติดลบไม่ได้`);
    if (step.dropOnFail < 0 || step.dropOnFail > step.from) {
      // ลดเกินค่าบวกที่มีอยู่ไม่ได้ ไม่งั้นจะติดลบ
      problems.push(`+${step.from} → +${step.to}: ขั้นที่ลดตอนไม่ติดต้องอยู่ระหว่าง 0–${step.from}`);
    }
  });

  return problems;
};

/**
 * ตารางที่ "ใช้งานอยู่จริงตอนนี้"
 *
 * ปกติคือ UPGRADE_STEPS ข้างบน แต่ถ้าแอดมินตั้งตารางไว้ที่ config/upgradeConfig
 * ตัวโหลดค่าตั้ง (useGameConfig ฝั่งหน้าเว็บ / upgradeCard ฝั่งเซิร์ฟเวอร์)
 * จะเรียก setUpgradeSteps() มาทับให้ตอนเริ่มทำงาน
 *
 * ผลคือ Admin ไม่มีสูตรของตัวเอง — ทั้ง UI, Attribute Engine และ Cloud Function
 * อ่านจากตัวแปรตัวเดียวกันนี้เสมอ
 */
let ACTIVE_STEPS: UpgradeStep[] = UPGRADE_STEPS;

/** ตารางที่ใช้งานอยู่ตอนนี้ */
export const getUpgradeSteps = (): UpgradeStep[] => ACTIVE_STEPS;

/**
 * ตั้งตารางที่จะใช้งาน — ตารางที่ไม่ผ่านการตรวจถูกปฏิเสธและกลับไปใช้ค่าในโค้ด
 * ยอมให้ตั้งไม่สำเร็จ ดีกว่าปล่อยให้ทั้งเกมตีบวกด้วยตัวเลขที่พัง
 * คืนรายการปัญหา (ว่าง = ตั้งสำเร็จ)
 */
export const setUpgradeSteps = (steps: UpgradeStep[] | null): string[] => {
  if (!steps) {
    ACTIVE_STEPS = UPGRADE_STEPS;
    return [];
  }

  const problems = validateUpgradeSteps(steps);
  ACTIVE_STEPS = problems.length === 0 ? steps : UPGRADE_STEPS;
  return problems;
};
