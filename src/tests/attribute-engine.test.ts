/**
 * PHASE 11 — เทส Player Attribute Engine
 *
 * ครอบ: ค่าพื้นฐาน → ค่าจริง → โบนัสตีบวก → โบนัสฝึกซ้อม → OVR → OVR ตามตำแหน่ง → Team OVR
 * ทดสอบที่ +0 / +1 / +4 / +8 และตำแหน่ง GK / CB / CM / CAM / ST ตามที่โจทย์กำหนด
 */
import { afterEach, describe, expect, it } from 'vitest';
import { getFormationById } from '@/data/formations';
import { PLAYERS, getPlayerById } from '@/data/players';
import {
  MAX_UPGRADE,
  UPGRADE_STEPS,
  getUpgradeBonus,
  getUpgradeStep,
  validateUpgradeSteps,
} from '@/data/upgradeConfig';
import {
  MAX_STAT,
  MAX_TRAINING,
  MIN_STAT,
  TRAINING_BONUS_PER_LEVEL,
  clearPlayerOverrides,
  getBasePlayerStats,
  getCardBonus,
  getEffectivePlayer,
  getEffectivePlayerOvr,
  getEffectivePlayerStats,
  getPositionOvr,
  getTrainingBonus,
  previewNextUpgrade,
  setPlayerOverrides,
} from '@/services/playerAttributes';
import { calculateTeamRating, type RatedSlot } from '@/services/teamRating';
import { MAX_LEVEL, MAX_PLUS, OVR_PER_LEVEL, getLevelBonus } from '@/services/upgrade';
import type { CardInstance } from '@/types/card';
import type { Position } from '@/types/player';

/** การ์ดทดสอบหนึ่งใบ — plus คือค่าบวก (0–8) ไม่ใช่ level */
const card = (playerId: string, plus = 0, training = 0): CardInstance => ({
  id: `card_${playerId}_${plus}_${training}`,
  playerId,
  acquiredAt: '2026-01-01T00:00:00.000Z',
  level: plus + 1,
  inSquad: false,
  training,
});

/** นักเตะตัวอย่างของแต่ละตำแหน่งที่โจทย์สั่งให้เทส */
const samplePlayerAt = (position: Position): string => {
  const found = PLAYERS.find((player) => player.position === position);
  if (!found) throw new Error(`ไม่มีนักเตะตำแหน่ง ${position} ใน pool`);
  return found.id;
};

afterEach(() => clearPlayerOverrides());

/* ── ตารางตีบวกกลาง ────────────────────────────────────────── */

describe('ตารางตีบวกกลาง (upgradeConfig)', () => {
  it('มีครบ 8 ขั้นและต่อกันเป็นสายเดียวจาก +0 ถึง +8', () => {
    expect(validateUpgradeSteps(UPGRADE_STEPS)).toEqual([]);
    expect(UPGRADE_STEPS[0].from).toBe(0);
    expect(UPGRADE_STEPS[UPGRADE_STEPS.length - 1].to).toBe(MAX_UPGRADE);
  });

  it('ยิ่งบวกสูงยิ่งยากขึ้นและแพงขึ้น ไม่มีขั้นไหนย้อนกลับ', () => {
    UPGRADE_STEPS.slice(1).forEach((step, index) => {
      const previous = UPGRADE_STEPS[index];
      expect(step.successRate).toBeLessThanOrEqual(previous.successRate);
      expect(step.materialCost).toBeGreaterThanOrEqual(previous.materialCost);
      expect(step.coinCost).toBeGreaterThanOrEqual(previous.coinCost);
    });
  });

  it('ตีบวกจนสุดแล้วไม่มีขั้นถัดไปให้ทำอีก', () => {
    expect(getUpgradeStep(MAX_UPGRADE)).toBeNull();
    expect(getUpgradeStep(MAX_UPGRADE + 5)).toBeNull();
  });

  it('บริการตีบวกเดิมยังอ่านตัวเลขชุดเดียวกับ config', () => {
    expect(MAX_PLUS).toBe(MAX_UPGRADE);
    expect(MAX_LEVEL).toBe(MAX_UPGRADE + 1);
    expect(getLevelBonus(MAX_LEVEL)).toBe(MAX_PLUS * OVR_PER_LEVEL);
  });
});

/* ── โบนัสแต่ละทาง ─────────────────────────────────────────── */

describe('โบนัสตีบวกและฝึกซ้อม', () => {
  it.each([0, 1, 4, 8])('โบนัสตีบวกที่ +%i คิดจากผลรวมของทุกขั้นที่ผ่านมา', (plus) => {
    expect(getUpgradeBonus(plus)).toBe(plus * OVR_PER_LEVEL);
  });

  it('ค่าบวกที่เกิน +8 ถูกบีบลงมาไม่ให้ได้โบนัสฟรี', () => {
    expect(getUpgradeBonus(99)).toBe(getUpgradeBonus(MAX_UPGRADE));
    expect(getUpgradeBonus(-5)).toBe(0);
  });

  it('โบนัสฝึกซ้อมตันที่ระดับสูงสุด', () => {
    expect(getTrainingBonus(0)).toBe(0);
    expect(getTrainingBonus(3)).toBe(3 * TRAINING_BONUS_PER_LEVEL);
    expect(getTrainingBonus(99)).toBe(MAX_TRAINING * TRAINING_BONUS_PER_LEVEL);
    expect(getTrainingBonus(undefined)).toBe(0);
  });

  it('โบนัสรวมของการ์ด = ตีบวก + ฝึกซ้อม', () => {
    expect(getCardBonus(card('p001', 4, 3))).toBe(getUpgradeBonus(4) + getTrainingBonus(3));
  });
});

/* ── Effective Stats ───────────────────────────────────────── */

describe('ค่าพลังจริงของการ์ด', () => {
  const playerId = 'p001';

  it('+0 และไม่ได้ฝึก = ค่าพื้นฐานเป๊ะ ๆ', () => {
    expect(getEffectivePlayerStats(card(playerId))).toEqual(getBasePlayerStats(playerId));
  });

  it.each([1, 4, 8])('ตีบวก +%i แล้วค่าพลังทุกด้านขยับขึ้นตามโบนัส', (plus) => {
    const base = getBasePlayerStats(playerId);
    const effective = getEffectivePlayerStats(card(playerId, plus));
    if (!base || !effective) throw new Error('ไม่พบนักเตะทดสอบ');

    const bonus = getUpgradeBonus(plus);
    expect(effective.shooting).toBe(Math.min(MAX_STAT, base.shooting + bonus));
    expect(effective.defending).toBe(Math.min(MAX_STAT, base.defending + bonus));
  });

  it('ค่าพลังไม่ทะลุเพดาน 99 ต่อให้ตีบวกจนสุดและฝึกจนเต็ม', () => {
    const effective = getEffectivePlayerStats(card(playerId, MAX_UPGRADE, MAX_TRAINING));
    if (!effective) throw new Error('ไม่พบนักเตะทดสอบ');

    Object.values(effective).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(MIN_STAT);
      expect(value).toBeLessThanOrEqual(MAX_STAT);
    });
  });

  it('การ์ดที่ชี้ไปนักเตะที่ไม่มีอยู่จริงไม่ทำให้ระบบพัง', () => {
    expect(getEffectivePlayerStats(card('ไม่มีอยู่จริง'))).toBeUndefined();
    expect(getEffectivePlayer(card('ไม่มีอยู่จริง'))).toBeNull();
    expect(getEffectivePlayerOvr(card('ไม่มีอยู่จริง'))).toBe(0);
  });
});

/* ── Effective OVR ─────────────────────────────────────────── */

describe('OVR จริงของการ์ด', () => {
  const playerId = 'p001';

  it.each([0, 1, 4, 8])('OVR ที่ +%i = OVR พื้นฐาน + โบนัส', (plus) => {
    const base = getPlayerById(playerId);
    if (!base) throw new Error('ไม่พบนักเตะทดสอบ');
    expect(getEffectivePlayerOvr(card(playerId, plus))).toBe(base.ovr + getUpgradeBonus(plus));
  });

  it('OVR ไม่ถูกบีบที่ 99 เพราะการ์ดใน roster แรงเกินนั้นอยู่แล้ว', () => {
    const strongest = PLAYERS.reduce((best, player) => (player.ovr > best.ovr ? player : best));
    expect(getEffectivePlayerOvr(card(strongest.id, MAX_UPGRADE))).toBeGreaterThan(MAX_STAT);
  });

  it('การฝึกซ้อมดัน OVR ขึ้นด้วย ไม่ใช่แค่ค่าพลัง', () => {
    expect(getEffectivePlayerOvr(card(playerId, 0, 3))).toBe(
      getEffectivePlayerOvr(card(playerId, 0)) + getTrainingBonus(3),
    );
  });
});

/* ── OVR ตามตำแหน่ง ────────────────────────────────────────── */

describe('OVR เมื่อยืนตำแหน่งต่าง ๆ', () => {
  const positions: Position[] = ['GK', 'CB', 'CM', 'CAM', 'ST'];

  it.each(positions)('%s ยืนตำแหน่งหลักของตัวเองได้ OVR เต็ม', (position) => {
    const playerId = samplePlayerAt(position);
    const instance = card(playerId, 4);
    expect(getPositionOvr(instance, position)).toBe(getEffectivePlayerOvr(instance));
  });

  it.each(positions)('%s ยืนผิดตำแหน่งแล้ว OVR ต้องลดลงจริง', (position) => {
    const playerId = samplePlayerAt(position);
    const instance = card(playerId, 4);
    const wrong: Position = position === 'GK' ? 'ST' : 'GK';

    expect(getPositionOvr(instance, wrong)).toBeLessThan(getEffectivePlayerOvr(instance));
  });

  it('ตีบวกแล้ว OVR ตามตำแหน่งขยับขึ้นตามด้วย', () => {
    const playerId = samplePlayerAt('ST');
    expect(getPositionOvr(card(playerId, 8), 'ST')).toBeGreaterThan(
      getPositionOvr(card(playerId, 0), 'ST'),
    );
  });
});

/* ── ต่อยอดไปถึง Team OVR ───────────────────────────────────── */

describe('Team OVR ใช้ค่าจาก Attribute Engine', () => {
  const buildSlots = (plus: number): RatedSlot[] => {
    const formation = getFormationById('4-3-3');
    return formation.slots.map((slot, index) => {
      const instance = card(PLAYERS[index % PLAYERS.length].id, plus);
      return { slot, player: getEffectivePlayer(instance), level: instance.level };
    });
  };

  it('ทีมที่ตีบวกจนสุดต้องแรงกว่าทีมชุดเดียวกันที่ยังไม่ได้ตีบวก', () => {
    const base = calculateTeamRating(buildSlots(0));
    const maxed = calculateTeamRating(buildSlots(MAX_UPGRADE));

    expect(maxed.ovr).toBeGreaterThan(base.ovr);
    expect(maxed.matchOvr).toBeGreaterThan(base.matchOvr);
    // เคมีไม่เกี่ยวกับการตีบวก จัดตัวชุดเดิมเคมีต้องเท่าเดิม
    expect(maxed.chemistry).toBe(base.chemistry);
  });

  it.each([0, 1, 4, 8])('Team OVR ที่ +%i ขยับขึ้นเป็นขั้นบันได ไม่กระโดดข้าม', (plus) => {
    const rating = calculateTeamRating(buildSlots(plus));
    expect(rating.ovr).toBeGreaterThan(0);
    expect(rating.matchOvr).toBeGreaterThanOrEqual(1);
  });
});

/* ── ค่าที่แอดมินแก้ทับ ─────────────────────────────────────── */

describe('แอดมินแก้ค่าพื้นฐานแล้วไหลไปทั้งระบบ', () => {
  it('แก้ค่าพลังพื้นฐานแล้วค่าจริงของการ์ดขยับตาม', () => {
    const base = getBasePlayerStats('p001');
    if (!base) throw new Error('ไม่พบนักเตะทดสอบ');

    setPlayerOverrides({ p001: { stats: { shooting: 50 } } });

    expect(getBasePlayerStats('p001')?.shooting).toBe(50);
    expect(getEffectivePlayerStats(card('p001', 4))?.shooting).toBe(50 + getUpgradeBonus(4));
    // ด้านที่ไม่ได้แก้ต้องเท่าเดิม
    expect(getBasePlayerStats('p001')?.pace).toBe(base.pace);
  });

  it('แก้ OVR พื้นฐานแล้ว OVR จริงและ Team OVR เห็นค่าใหม่ทันที', () => {
    setPlayerOverrides({ p001: { ovr: 60 } });
    expect(getEffectivePlayerOvr(card('p001', 1))).toBe(60 + getUpgradeBonus(1));
  });
});

/* ── พรีวิวขั้นถัดไป ───────────────────────────────────────── */

describe('พรีวิวค่าที่จะได้ถ้าตีบวกติด', () => {
  it('บอกค่าพลังและ OVR ของขั้นถัดไปได้ถูกต้อง', () => {
    const preview = previewNextUpgrade(card('p001', 7));
    expect(preview?.ovr).toBe(getEffectivePlayerOvr(card('p001', 8)));
    expect(preview?.stats).toEqual(getEffectivePlayerStats(card('p001', 8)));
  });

  it('การ์ดที่ +8 แล้วไม่มีขั้นถัดไปให้พรีวิว', () => {
    expect(previewNextUpgrade(card('p001', MAX_UPGRADE))).toBeNull();
  });
});
