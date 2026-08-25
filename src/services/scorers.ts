/**
 * รายชื่อคนยิงประตูสำหรับไทม์ไลน์ (pure function ล้วน)
 *
 * ไทม์ไลน์ต้องใช้ "ชื่อนักเตะจริงจากตัวจริง 11 คน" ของทั้งสองฝั่ง
 * ไม่ใช่ชื่อสมมติ — ไม่งั้นฝ่ายที่โดนท้าจะเห็นคนที่ไม่มีในทีมตัวเองยิงประตูให้
 *
 * ยิ่งเล่นตำแหน่งบุกยิ่งมีชื่ออยู่ในรายการหลายครั้ง โอกาสถูกสุ่มจึงสูงกว่า
 * (น้ำหนักชุดเดียวกันทุกที่ที่สร้างไทม์ไลน์ — หน้าเว็บ ลีก และเซิร์ฟเวอร์)
 */
import { getFormationById } from '@/data/formations';
import { getPlayerById } from '@/data/players';
import type { PublicSquadSlot } from '@/types/profile';
import type { FormationId } from '@/types/team';
import { POSITION_GROUP } from '@/utils/helpers';

/** จำนวนครั้งที่ชื่อนักเตะแต่ละตำแหน่งถูกใส่ลงในรายการสุ่ม */
export const SCORER_WEIGHT = { attack: 4, midfield: 2, defence: 1, gk: 0 } as const;

/**
 * สร้างรายชื่อคนยิงจากตัวจริงของทีมหนึ่ง
 *
 * ใช้ได้กับทั้งทีมเราและทีมคู่แข่ง ขอแค่รู้แผนและว่าช่องไหนใครยืน
 * ช่องที่ว่างหรือชี้ไปหานักเตะที่ไม่มีอยู่จริงจะถูกข้ามไปเงียบ ๆ
 */
export const buildScorerPool = (
  formationId: FormationId,
  squad: PublicSquadSlot[] | undefined,
): string[] => {
  if (!Array.isArray(squad) || squad.length === 0) return [];

  const formation = getFormationById(formationId);
  const bySlot = new Map(squad.map((entry) => [entry.slotId, entry.playerId]));

  return formation.slots.flatMap((slot) => {
    const player = getPlayerById(bySlot.get(slot.id) ?? '');
    if (!player) return [];

    return Array.from({ length: SCORER_WEIGHT[POSITION_GROUP[slot.position]] }, () => player.name);
  });
};
