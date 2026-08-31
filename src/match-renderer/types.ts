/**
 * ชนิดข้อมูลของชั้นการแสดงผล 2.5D
 *
 * ชั้นนี้แยกจาก match-engine โดยสิ้นเชิง: อ่านสถานะออกมาวาด ไม่เคยเขียนกลับ
 * พิกัดของเกม (position2d.x / y เป็นเมตร) ยังเป็นความจริงเพียงหนึ่งเดียวเสมอ
 * มุมกล้องและเปอร์สเปกทีฟทั้งหมดอยู่แค่ตอนแปลงเป็นพิกัดบนจอ
 *
 *   MatchEngine World State → Projection → Screen
 */

/** จุดในโลกของเกม (เมตร) — z คือความสูงจากพื้นสนาม ใช้เฉพาะการแสดงผล */
export interface WorldPoint {
  x: number;
  y: number;
  /** ความสูงจากพื้น (เมตร) ไม่ใส่ = อยู่บนพื้น */
  z?: number;
}

/** จุดบนผืนผ้าใบ พร้อมตัวคูณขนาดตามระยะ */
export interface ScreenPoint {
  x: number;
  y: number;
  /**
   * ตัวคูณขนาดของวัตถุที่จุดนี้ — ใกล้กล้องใหญ่กว่า ไกลกล้องเล็กกว่า
   * เป็นสัดส่วน ไม่ใช่พิกเซล คูณกับ pixelsPerMetre เมื่อจะวาดจริง
   */
  depth: number;
}

/**
 * กล้อง — เรื่องของการแสดงผลล้วน ไม่มีทางกระทบพิกัดของเกม
 *
 * zoom    ตัวคูณการซูม (1 = พอดีจอ)
 * offsetX เลื่อนภาพซ้าย/ขวา (พิกเซลอุปกรณ์)
 * offsetY เลื่อนภาพขึ้น/ลง
 * tilt    ความเอียงของกล้อง 0–1 (1 = มองจากด้านบนตรง ๆ, ต่ำลง = ก้มมองมากขึ้น)
 * spread  ความแรงของเปอร์สเปกทีฟ (0 = ไม่มี, สูงขึ้น = ขอบใกล้กล้องกว้างกว่าขอบไกล)
 */
export interface MatchCamera {
  zoom: number;
  offsetX: number;
  offsetY: number;
  tilt: number;
  spread: number;
}

/** ค่ากล้องเริ่มต้น — มุมกล้องแบบถ่ายทอดสดฟุตบอล ไม่ใช่มุมไอโซเมตริกจัด ๆ */
export const DEFAULT_CAMERA: MatchCamera = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  // ย่อแกนลึกเหลือ 62% ทำให้เห็นว่ากล้องยกสูงขึ้นมาจากระดับสนาม
  tilt: 0.62,
  // ขอบสนามฝั่งใกล้กล้องกว้างกว่าฝั่งไกลราว 11% ต่อข้าง — พอให้รู้สึกมีระยะ แต่ยังอ่านตำแหน่งง่าย
  spread: 0.22,
};

/** ปรับค่ากล้องโดยคุมไม่ให้หลุดช่วงที่ยังดูรู้เรื่อง */
export const withCamera = (
  camera: MatchCamera,
  patch: Partial<MatchCamera>,
): MatchCamera => {
  const next = { ...camera, ...patch };

  return {
    zoom: Math.min(Math.max(next.zoom, 0.5), 3),
    offsetX: next.offsetX,
    offsetY: next.offsetY,
    // เอียงเกินนี้สนามจะแบนจนอ่านตำแหน่งไม่ออก
    tilt: Math.min(Math.max(next.tilt, 0.35), 1),
    spread: Math.min(Math.max(next.spread, 0), 0.6),
  };
};

/** สิ่งที่ต้องวาดหนึ่งชิ้น พร้อมค่าที่ใช้เรียงลำดับความลึก */
export interface Drawable {
  /** ยิ่งมากยิ่งอยู่ใกล้กล้อง วาดทีหลัง */
  depthKey: number;
  draw: () => void;
}

/** ตัวเลือกของการแสดงผล */
export interface MatchRenderOptions {
  /** โชว์ชื่อนักเตะใต้ตัว */
  showNames?: boolean;
  /** โชว์นาฬิกากลางบนสนาม */
  showClock?: boolean;
  /** แผงตรวจสอบ (เปิดจากปุ่ม D ตอน dev เท่านั้น) */
  debug?: boolean;
  /** id ของนักเตะที่ถูกเลือก */
  selectedId?: string | null;
  /** id ของนักเตะที่เมาส์ชี้อยู่ */
  hoveredId?: string | null;
}
