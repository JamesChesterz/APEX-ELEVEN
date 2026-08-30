/**
 * ขนาดสนามและการแปลงพิกัด
 *
 * ที่เดียวในระบบที่รู้ว่า FormationSlot (x/y 0–100, y = ความยาวสนาม)
 * แปลงเป็นพิกัดโลกของเอนจิน (เมตร, x = ความยาวสนาม) อย่างไร
 * ถ้าวันหลังเปลี่ยนระบบพิกัดของแผน แก้ที่ไฟล์นี้ไฟล์เดียว
 */
import type { AgentRole, MatchSide, Vec2 } from '@/match-engine/types';
import type { Position } from '@/types/player';
import { POSITION_GROUP } from '@/utils/helpers';

/** ขนาดสนามมาตรฐาน FIFA (เมตร) */
export const PITCH = {
  length: 105,
  width: 68,
  /** กรอบเขตโทษ: ลึก 16.5 ม. กว้าง 40.32 ม. */
  penaltyDepth: 16.5,
  penaltyWidth: 40.32,
  /** กรอบ 6 หลา: ลึก 5.5 ม. กว้าง 18.32 ม. */
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  goalWidth: 7.32,
  centreCircleRadius: 9.15,
  penaltySpot: 11,
  cornerRadius: 1,
} as const;

/** จุดกึ่งกลางสนาม */
export const centreSpot = (): Vec2 => ({ x: PITCH.length / 2, y: PITCH.width / 2 });

/** ทิศที่ทีมนี้บุก: home ไป +x, away ไป −x */
export const attackDirection = (side: MatchSide): 1 | -1 => (side === 'home' ? 1 : -1);

/** พิกัด x ของเส้นประตูฝั่งตัวเอง */
export const ownGoalLine = (side: MatchSide): number => (side === 'home' ? 0 : PITCH.length);

/** พิกัด x ของเส้นประตูฝั่งตรงข้าม */
export const targetGoalLine = (side: MatchSide): number => (side === 'home' ? PITCH.length : 0);

/** จำพวกของนักเตะที่เอนจินใช้ (แปลงจากตำแหน่งของช่องในแผน) */
export const roleOf = (position: Position): AgentRole => POSITION_GROUP[position];

/**
 * แปลงพิกัดช่องในแผน → พิกัดโลกของเอนจิน
 *
 * ระบบเดิม: x = 0–100 จากซ้ายสนาม, y = 0–100 จากเส้นประตูฝั่งตัวเอง
 * ฝั่ง away ต้องกลับด้านทั้งสองแกน ไม่งั้นแบ็กซ้ายของเขาจะไปโผล่ฝั่งขวา
 */
export const formationToWorld = (
  formationX: number,
  formationY: number,
  side: MatchSide,
): Vec2 => {
  const depth = (formationY / 100) * PITCH.length;
  const across = (formationX / 100) * PITCH.width;

  return side === 'home'
    ? { x: depth, y: across }
    : { x: PITCH.length - depth, y: PITCH.width - across };
};

/** บีบพิกัดให้อยู่ในสนาม (เผื่อขอบไว้เล็กน้อยไม่ให้ตัวละครทับเส้น) */
export const clampToPitch = (point: Vec2, margin = 0.8): Vec2 => ({
  x: Math.min(Math.max(point.x, margin), PITCH.length - margin),
  y: Math.min(Math.max(point.y, margin), PITCH.width - margin),
});

/** ระยะห่างระหว่างสองจุด */
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** ระยะห่างยกกำลังสอง — ใช้ตอนแค่ต้องเทียบว่าใครใกล้กว่า (ไม่ต้องถอดราก) */
export const distanceSq = (a: Vec2, b: Vec2): number =>
  (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
