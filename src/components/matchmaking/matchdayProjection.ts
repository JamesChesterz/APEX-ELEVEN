/**
 * แปลงพิกัดแผนการเล่น (x/y 0–100 ต่อทีม) เป็นตำแหน่งบนสนาม Matchmaking เดียวกัน
 * ที่ทั้งสองทีมยืนหันหน้าเข้าหากันคนละครึ่งสนาม เหมือนหน้าจอ lineup ของเกมฟุตบอลทั่วไป
 *
 * ใช้ projectToPitch เดิม (มี perspective ตามระยะกล้อง) แล้วบีบผลลัพธ์ให้อยู่ในครึ่งบน/ล่างของภาพ:
 *   home (ทีมเรา)      → ประตูอยู่ขอบล่างสุด กองหน้าอยู่แถวกลางสนาม
 *   away (ทีมคู่แข่ง)   → พิกัด y ถูกกลับด้าน (100 − y) ก่อน แล้วโปรเจกต์ ให้ประตูอยู่ขอบบนสุด
 *                        กองหน้าอยู่แถวกลางสนามเช่นกัน ทั้งสองฝั่งจึงมาบรรจบกันตรงเส้นกลางสนาม
 */
import { projectToPitch, type ProjectedPoint } from '@/components/pitch/FormationPositions';

/** ครึ่งล่าง (ทีมเรา) ใช้ช่วงนี้ — เว้นจากขอบล่างสุดเล็กน้อยกันการ์ดล้นกรอบ */
const HOME_RANGE: [number, number] = [54, 96];
/** ครึ่งบน (คู่แข่ง) ใช้ช่วงนี้ */
const AWAY_RANGE: [number, number] = [4, 46];

export const projectMatchday = (
  x: number,
  y: number,
  side: 'home' | 'away',
): ProjectedPoint => {
  const point = projectToPitch(x, side === 'away' ? 100 - y : y);
  const [from, to] = side === 'home' ? HOME_RANGE : AWAY_RANGE;
  const screenY = from + (point.y / 100) * (to - from);

  return { x: point.x, y: screenY, scale: point.scale };
};
