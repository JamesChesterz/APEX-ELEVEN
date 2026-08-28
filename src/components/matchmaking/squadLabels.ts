/**
 * ป้ายกำกับตำแหน่งของรายชื่อ 11 ตัวจริงในหน้า MATCHMAKING
 *
 * ในสนามจริงตำแหน่งกลางมีสองคน (CB คู่, CDM คู่) แต่ในรายชื่อควรแยกซ้าย-ขวาให้เห็น
 * ว่าใครยืนฝั่งไหน จึงแปลง id ของช่อง (CB1/CB2/CDM1/CDM2) เป็น LCB/RCB/LDM/RDM
 * ส่วนแผน 4-2-3-1 ที่ตัวริมยืนสูงเกือบเท่าปีก จะโชว์เป็น LW/RW ตามที่คนเล่นเรียกกันจริง
 */
import type { Position } from '@/types/player';
import type { FormationId, FormationSlot } from '@/types/team';
import { POSITION_GROUP } from '@/utils/helpers';

/** ช่องที่ต้องแยกซ้าย-ขวาในรายชื่อ (ใช้กับทุกแผน) */
const SLOT_LABEL: Record<string, string> = {
  CB1: 'LCB',
  CB2: 'RCB',
  CDM1: 'LDM',
  CDM2: 'RDM',
  CM1: 'LCM',
  CM2: 'RCM',
  ST1: 'ST',
  ST2: 'ST',
};

/** แผนที่ตัวริมยืนสูงจนเรียกว่าปีก — โชว์ LW/RW แทน LM/RM */
const WIDE_FORMATIONS: FormationId[] = ['4-2-3-1'];

export const slotLabel = (slot: FormationSlot, formationId: FormationId): string => {
  if (WIDE_FORMATIONS.includes(formationId)) {
    if (slot.id === 'LM') return 'LW';
    if (slot.id === 'RM') return 'RW';
  }
  return SLOT_LABEL[slot.id] ?? slot.position;
};

export type PositionGroup = 'gk' | 'defence' | 'midfield' | 'attack';

/** สีป้ายตำแหน่ง — ไล่จากผู้รักษาประตู (ทอง) ไปกองหน้า (แดง) ให้กวาดตาแล้วอ่านแผนออกทันที */
export const GROUP_TONE: Record<PositionGroup, string> = {
  gk: 'text-[#F5C445]',
  defence: 'text-[#5AA9F0]',
  midfield: 'text-[#31E06D]',
  attack: 'text-[#F0705A]',
};

export const positionTone = (position: Position): string => GROUP_TONE[POSITION_GROUP[position]];

/** "Marco Belline" → "M. Belline" — รูปแบบเดียวกับใบรายชื่อตัวจริงในสนามจริง */
export const shortName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
};

/** เวลาแบบนาฬิกาสกอร์บอร์ด mm:ss */
export const clockText = (minutes: number, seconds = 0): string =>
  `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
