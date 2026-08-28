/**
 * แผนการเล่นที่เจ้าของโปรเจคสร้างเอง (pure function ล้วน)
 *
 * แผนพื้นฐาน 4 แบบอยู่ในโค้ด (src/data/formations.ts) ส่วนแผนที่แอดมินวาดเองเก็บบน Firestore
 * ต่างจากซองการ์ดตรงที่ "ผสมกัน" ไม่ใช่แทนที่ — เพราะทีมของผู้เล่นที่ใช้แผนพื้นฐานอยู่
 * จะพังทันทีถ้าแผนนั้นหายไปจากระบบ แผนที่แอดมินสร้างจึงเป็นของ "เพิ่มเข้ามา" เท่านั้น
 *
 * ข้อมูลจากเซิร์ฟเวอร์ไม่เชื่อทั้งดุ้น — normalizeFormations บีบทุกค่าให้อยู่ในกรอบก่อนใช้
 * ตั้งค่าเพี้ยนแค่ไหนก็ไม่ทำให้สนามพังหรือได้ทีมที่มีคนไม่ครบ 11
 */
import { FORMATIONS } from '@/data/formations';
import type { Formation, FormationSlot } from '@/types/team';
import { POSITIONS, type Position } from '@/types/player';

/** กรอบที่ยอมให้ตั้งได้ */
export const FORMATION_LIMITS = {
  /** จำนวนแผนที่แอดมินสร้างเองได้ */
  maxFormations: 20,
  maxNameChars: 24,
  maxDescriptionChars: 80,
} as const;

/** ทุกแผนต้องมี 11 ช่องพอดี ไม่ขาดไม่เกิน */
export const SLOTS_PER_FORMATION = 11;

/** id ของแผนพื้นฐานที่ห้ามให้แผนใหม่ไปทับ */
const BUILT_IN_IDS = new Set(FORMATIONS.map((formation) => formation.id));

const POSITION_SET = new Set<string>(POSITIONS);

const clampCoord = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  // ปัดเป็นทศนิยมตำแหน่งเดียว — ละเอียดพอสำหรับการวางจุด แต่ไม่ทำให้ค่าที่เก็บยาวเกินจำเป็น
  return Math.min(100, Math.max(0, Math.round(parsed * 10) / 10));
};

const clampText = (value: unknown, max: number, fallback: string): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, max);
};

/**
 * แผนเปล่าไว้เป็นจุดตั้งต้นตอนกด "สร้างแผนใหม่"
 *
 * เริ่มจาก 4-4-2 ให้เลย ไม่ใช่สนามว่าง — เพราะการลากจุดที่มีอยู่แล้วให้เข้าที่
 * เร็วกว่าการกดวางทีละ 11 จุดจากศูนย์มาก และไม่มีทางลืมวางบางตำแหน่ง
 */
export const createEmptyFormation = (): Formation => {
  const base = FORMATIONS[0];

  return {
    id: `custom-${Date.now().toString(36)}`,
    name: 'แผนใหม่',
    description: '',
    slots: base.slots.map((slot) => ({ ...slot })),
  };
};

/** สร้าง id ช่องที่ไม่ซ้ำในแผนเดียวกัน เช่น CB, CB2, CB3 */
export const nextSlotId = (position: Position, taken: Set<string>): string => {
  if (!taken.has(position)) return position;

  for (let index = 2; index < 20; index += 1) {
    const candidate = `${position}${index}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${position}-${Date.now().toString(36)}`;
};

/** บีบช่องหนึ่งช่องให้อยู่ในกรอบ — คืน null ถ้าข้อมูลใช้ไม่ได้จริง ๆ */
const normalizeSlot = (raw: unknown, taken: Set<string>): FormationSlot | null => {
  if (!raw || typeof raw !== 'object') return null;

  const source = raw as Partial<FormationSlot>;
  const position = POSITION_SET.has(source.position as string)
    ? (source.position as Position)
    : null;
  if (!position) return null;

  const id =
    typeof source.id === 'string' && source.id.trim() && !taken.has(source.id.trim())
      ? source.id.trim().slice(0, 12)
      : nextSlotId(position, taken);

  taken.add(id);
  return { id, position, x: clampCoord(source.x, 50), y: clampCoord(source.y, 50) };
};

/**
 * บีบรายการแผนจากเซิร์ฟเวอร์ให้ปลอดภัย
 * แผนที่มีช่องไม่ครบ 11 หรือ id ชนกับแผนพื้นฐาน จะถูกทิ้งทั้งแผน ไม่พยายามซ่อม
 * เพราะแผนที่ครึ่ง ๆ กลาง ๆ อันตรายกว่าไม่มีแผนนั้นเลย
 */
export const normalizeFormations = (raw: unknown): Formation[] => {
  if (!Array.isArray(raw)) return [];

  const usedIds = new Set(BUILT_IN_IDS);

  return raw
    .slice(0, FORMATION_LIMITS.maxFormations)
    .flatMap((entry): Formation[] => {
      if (!entry || typeof entry !== 'object') return [];

      const source = entry as Partial<Formation>;
      const id = typeof source.id === 'string' ? source.id.trim().slice(0, 40) : '';
      if (!id || usedIds.has(id)) return [];

      const takenSlotIds = new Set<string>();
      const slots = Array.isArray(source.slots)
        ? source.slots
            .flatMap((slot) => {
              const normalized = normalizeSlot(slot, takenSlotIds);
              return normalized ? [normalized] : [];
            })
            .slice(0, SLOTS_PER_FORMATION)
        : [];

      if (slots.length !== SLOTS_PER_FORMATION) return [];

      usedIds.add(id);
      return [
        {
          id,
          name: clampText(source.name, FORMATION_LIMITS.maxNameChars, id),
          description: clampText(source.description, FORMATION_LIMITS.maxDescriptionChars, ''),
          slots,
        },
      ];
    });
};

/** ปัญหาที่ต้องแก้ก่อนบันทึกได้ (array ว่าง = บันทึกได้) */
export const formationIssues = (formation: Formation, others: Formation[]): string[] => {
  const issues: string[] = [];

  if (formation.slots.length !== SLOTS_PER_FORMATION) {
    issues.push(`ต้องมี ${SLOTS_PER_FORMATION} ตำแหน่งพอดี (ตอนนี้ ${formation.slots.length})`);
  }

  const goalkeepers = formation.slots.filter((slot) => slot.position === 'GK').length;
  if (goalkeepers !== 1) {
    issues.push(`ต้องมีผู้รักษาประตู 1 คนพอดี (ตอนนี้ ${goalkeepers} คน)`);
  }

  if (!formation.name.trim()) issues.push('ยังไม่ได้ตั้งชื่อแผน');

  const clash = [...others, ...FORMATIONS].some((other) => other.id === formation.id);
  if (clash) issues.push('รหัสแผนซ้ำกับแผนที่มีอยู่แล้ว');

  return issues;
};
