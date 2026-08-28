/**
 * แผนการเล่นที่แอดมินสร้างเอง — ตรรกะล้วน ๆ ที่พลาดแล้วเจ็บ
 *
 * สองเรื่องที่ต้องถูกเป๊ะ:
 *   1. normalizeFormations ต้องกันข้อมูลเพี้ยนจากเซิร์ฟเวอร์ไม่ให้หลุดเข้าเกม
 *      (แผนที่มีคนไม่ครบ 11 หลุดเข้าไป = ทีมของผู้เล่นพังทันที)
 *   2. unprojectMatchday ต้องเป็นผกผันของ projectMatchday จริง ๆ
 *      ไม่งั้นแอดมินคลิกจุดหนึ่ง แล้วนักเตะไปโผล่อีกจุดตอนลงแข่ง
 */
import { describe, expect, it } from 'vitest';
import {
  projectMatchday,
  unprojectMatchday,
} from '@/components/matchmaking/matchdayProjection';
import { FORMATIONS } from '@/data/formations';
import {
  createEmptyFormation,
  formationIssues,
  nextSlotId,
  normalizeFormations,
  SLOTS_PER_FORMATION,
} from '@/services/formationConfig';
import type { Formation } from '@/types/team';

/** แผนที่ถูกต้องครบถ้วน ใช้เป็นฐานแล้วค่อยบิดให้พังทีละอย่าง */
const validFormation = (): Formation => ({
  ...createEmptyFormation(),
  id: 'custom-test',
  name: '4-2-4',
});

describe('normalizeFormations', () => {
  it('ผ่านแผนที่ครบถ้วน', () => {
    const [result] = normalizeFormations([validFormation()]);
    expect(result.id).toBe('custom-test');
    expect(result.slots).toHaveLength(SLOTS_PER_FORMATION);
  });

  it('ทิ้งแผนที่มีตำแหน่งไม่ครบ 11', () => {
    const broken = validFormation();
    broken.slots = broken.slots.slice(0, 9);
    expect(normalizeFormations([broken])).toHaveLength(0);
  });

  it('ทิ้งแผนที่รหัสชนกับแผนพื้นฐาน', () => {
    const clash = { ...validFormation(), id: FORMATIONS[0].id };
    expect(normalizeFormations([clash])).toHaveLength(0);
  });

  it('บีบพิกัดที่หลุดกรอบให้กลับมาอยู่ใน 0–100', () => {
    const wild = validFormation();
    wild.slots = wild.slots.map((slot, index) =>
      index === 0 ? { ...slot, x: -50, y: 999 } : slot,
    );

    const [result] = normalizeFormations([wild]);
    expect(result.slots[0].x).toBe(0);
    expect(result.slots[0].y).toBe(100);
  });

  it('ไม่พังเมื่อข้อมูลไม่ใช่ array', () => {
    expect(normalizeFormations(null)).toEqual([]);
    expect(normalizeFormations('พัง')).toEqual([]);
  });
});

describe('formationIssues', () => {
  it('แผนที่ถูกต้องไม่มีปัญหา', () => {
    expect(formationIssues(validFormation(), [])).toEqual([]);
  });

  it('เตือนเมื่อไม่มีผู้รักษาประตูพอดีหนึ่งคน', () => {
    const noKeeper = validFormation();
    noKeeper.slots = noKeeper.slots.map((slot) =>
      slot.position === 'GK' ? { ...slot, position: 'CB' as const } : slot,
    );

    expect(formationIssues(noKeeper, []).some((issue) => issue.includes('ผู้รักษาประตู'))).toBe(
      true,
    );
  });

  it('เตือนเมื่อรหัสซ้ำกับแผนอื่นที่สร้างไว้แล้ว', () => {
    const formation = validFormation();
    const issues = formationIssues(formation, [formation]);
    expect(issues.some((issue) => issue.includes('รหัสแผนซ้ำ'))).toBe(true);
  });
});

describe('nextSlotId', () => {
  it('ใช้ชื่อตำแหน่งตรง ๆ ถ้ายังไม่มีใครใช้', () => {
    expect(nextSlotId('CB', new Set())).toBe('CB');
  });

  it('ต่อเลขให้เมื่อชื่อซ้ำ', () => {
    expect(nextSlotId('CB', new Set(['CB']))).toBe('CB2');
    expect(nextSlotId('CB', new Set(['CB', 'CB2']))).toBe('CB3');
  });
});

describe('unprojectMatchday', () => {
  it('เป็นผกผันของ projectMatchday ฝั่ง home ทุกจุด', () => {
    for (const x of [0, 15, 38, 50, 62, 85, 100]) {
      for (const y of [0, 6, 22, 44, 68, 88, 100]) {
        const point = projectMatchday(x, y, 'home');
        const back = unprojectMatchday(point.x, point.y);

        expect(back.x).toBeCloseTo(x, 1);
        expect(back.y).toBeCloseTo(y, 1);
      }
    }
  });

  it('คลิกนอกกรอบสนามยังได้พิกัดที่อยู่ใน 0–100', () => {
    const low = unprojectMatchday(-20, -20);
    const high = unprojectMatchday(140, 140);

    expect(low.x).toBe(0);
    expect(low.y).toBe(0);
    expect(high.x).toBe(100);
    expect(high.y).toBe(100);
  });
});
