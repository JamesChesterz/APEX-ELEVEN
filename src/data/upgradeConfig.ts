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
  /** แต้มตีบวกที่ต้องจ่าย */
  materialCost: number;
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

/* ── ของช่วยตีบวก ───────────────────────────────────────────── */

/** ใส่การ์ดมาช่วยตีบวกได้สูงสุดกี่ใบต่อครั้ง */
export const MATERIAL_CARD_SLOTS = 3;

/** การ์ดที่ใส่มาช่วยเพิ่มโอกาสสำเร็จใบละเท่าไร (0.05 = +5%) */
export const MATERIAL_CARD_BOOST = 0.05;

/**
 * โอกาสสำเร็จจริงหลังใส่การ์ดช่วย
 * บีบไม่ให้เกิน 100% และไม่ให้ต่ำกว่าอัตราพื้นฐานของขั้นนั้น
 */
export const getBoostedSuccessRate = (baseRate: number, materialCards: number): number => {
  const used = Math.min(Math.max(Math.trunc(materialCards) || 0, 0), MATERIAL_CARD_SLOTS);
  return Math.min(1, baseRate + used * MATERIAL_CARD_BOOST);
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
