/**
 * แปลงพิกัดแผนการเล่น (x/y 0–100 ต่อทีม) เป็นตำแหน่งบนสนาม Matchmaking เดียวกัน
 * ที่ทั้งสองทีมยืนหันหน้าเข้าหากันคนละครึ่งสนาม แบบ "ซ้าย-ขวา" (ไม่ใช่บน-ล่าง)
 * เหมือนหน้าจอ lineup ของเกมฟุตบอลทั่วไปที่มองสนามจากด้านข้าง
 *
 *   home (ทีมเรา)      → อยู่ครึ่งซ้าย ประตูชิดขอบซ้ายสุด กองหน้าอยู่แถวกลางสนาม
 *   away (ทีมคู่แข่ง)   → พิกัดความลึก y ถูกกลับด้าน (100 − y) ก่อน แล้วเอาไปวางฝั่งขวา
 *                        ประตูชิดขอบขวาสุด กองหน้าอยู่แถวกลางสนามเช่นกัน
 *                        ทั้งสองฝั่งจึงมาบรรจบกันตรงเส้นกลางสนาม (แนวตั้งกึ่งกลางภาพ)
 *
 * แกน x เดิมของฟอร์เมชัน (ตำแหน่งกว้างซ้าย-ขวาในสนามจริง) ใช้กระจายเป็นแนวตั้ง (บน-ล่าง) แทน
 * แกน y เดิม (ความลึกจากประตูตัวเองไปเส้นกลาง) ใช้กระจายเป็นแนวนอน (ซ้าย-ขวา)
 */
import type { ProjectedPoint } from '@/components/pitch/FormationPositions';

/** ครึ่งซ้าย (ทีมเรา) ใช้ช่วงนี้ — เว้นจากขอบซ้ายสุดเล็กน้อยกันการ์ดล้นกรอบ */
const HOME_RANGE: [number, number] = [6, 46];
/** ครึ่งขวา (คู่แข่ง) ใช้ช่วงนี้ */
const AWAY_RANGE: [number, number] = [54, 94];

/** กระจายแนวตั้งจากตำแหน่งกว้างของฟอร์เมชัน เว้นขอบบน-ล่างเล็กน้อยกันการ์ดล้นกรอบ */
const VERTICAL_RANGE: [number, number] = [12, 88];

export const projectMatchday = (
  x: number,
  y: number,
  side: 'home' | 'away',
): ProjectedPoint => {
  const depth = side === 'away' ? 100 - y : y;
  const [from, to] = side === 'home' ? HOME_RANGE : AWAY_RANGE;
  const screenX = from + (depth / 100) * (to - from);

  const [vFrom, vTo] = VERTICAL_RANGE;
  const screenY = vFrom + (x / 100) * (vTo - vFrom);

  return { x: screenX, y: screenY, scale: 1 };
};
