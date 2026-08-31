/**
 * การฉายภาพ 2.5D
 *
 * หัวใจของ PHASE 7 อยู่ที่ไฟล์นี้ และข้อกำหนดสำคัญที่สุดคือ **ต้องผกผันได้แม่นยำ**
 * เพราะการคลิกเลือกนักเตะต้องแปลงจากพิกัดบนจอกลับเป็นพิกัดในสนามให้ตรงเป๊ะ
 *
 *   โลก (x, y, z เป็นเมตร) → toScreen() → จอ (พิกเซลอุปกรณ์)
 *   จอ → toWorld() → โลก
 *
 * สูตรที่ใช้ตั้งใจเลือกให้ผกผันได้แบบปิด (closed form) ไม่ต้องวนหาคำตอบ:
 *
 *   screenY = cy + (y − W/2) · s · tilt − z · s · Z_SCALE
 *   screenX = cx + (x − L/2) · s · k(y)
 *   โดย k(y) = 1 + ((y − W/2) / W) · spread
 *
 * เพราะ screenY ขึ้นกับ y แบบเชิงเส้น จึงแก้หา y ได้ตรง ๆ แล้วค่อยเอา k(y) ไปหาค่า x
 * (ตอนแปลงกลับถือว่า z = 0 เสมอ เพราะการคลิกเป็นการคลิกลงบนพื้นสนาม)
 *
 * k(y) ทำหน้าที่สองอย่างพร้อมกัน: ยืดสนามด้านใกล้กล้องให้กว้างกว่าด้านไกล
 * และเป็นตัวคูณขนาดของวัตถุ (คนใกล้กล้องตัวใหญ่กว่าคนไกลกล้องเล็กน้อย)
 */
import { PITCH } from '@/match-engine';
import type { MatchCamera, ScreenPoint, WorldPoint } from '@/match-renderer/types';

/** ความสูง 1 เมตรของลูกบอลกินพื้นที่จอกี่เท่าของ 1 เมตรแนวราบ */
const Z_SCALE = 0.85;

/** พื้นที่รอบสนามที่กันไว้ให้อัฒจันทร์และป้ายโฆษณา (เป็นสัดส่วนของขนาดสนาม) */
const STADIUM_MARGIN = { x: 0.16, y: 0.42 } as const;

export interface Viewport {
  /** ขนาดผืนผ้าใบเป็นพิกเซลอุปกรณ์ (คูณ devicePixelRatio แล้ว) */
  width: number;
  height: number;
}

/**
 * ค่าที่คำนวณครั้งเดียวตอนขนาดจอหรือกล้องเปลี่ยน แล้วใช้ซ้ำทุกเฟรม
 * ไม่ได้คิดใหม่ต่อวัตถุ ต่อเฟรม
 */
export interface ProjectionState {
  /** พิกเซลต่อเมตร (หลังคูณ zoom แล้ว) */
  scale: number;
  /** จุดกึ่งกลางสนามบนจอ */
  centreX: number;
  centreY: number;
  tilt: number;
  spread: number;
}

/**
 * คำนวณสเกลและจุดกึ่งกลางให้สนามพอดีกับผืนผ้าใบ โดยคงสัดส่วนจริงของสนามไว้
 * สนามไม่ถูกยืดผิดส่วนไม่ว่าหน้าต่างจะรูปร่างอย่างไร
 */
export const createProjection = (
  viewport: Viewport,
  camera: MatchCamera,
): ProjectionState => {
  // ด้านที่กว้างที่สุดของสนามคือขอบใกล้กล้อง ต้องเผื่อให้พอดี
  const widest = PITCH.length * (1 + camera.spread / 2);
  const usableWidth = widest * (1 + STADIUM_MARGIN.x * 2);
  const usableHeight = PITCH.width * camera.tilt * (1 + STADIUM_MARGIN.y * 2);

  const fit = Math.min(viewport.width / usableWidth, viewport.height / usableHeight);
  const scale = Math.max(fit, 0.0001) * camera.zoom;

  return {
    scale,
    centreX: viewport.width / 2 + camera.offsetX,
    centreY: viewport.height / 2 + camera.offsetY,
    tilt: camera.tilt,
    spread: camera.spread,
  };
};

/**
 * ตัวคูณเปอร์สเปกทีฟที่ความลึก y
 * ริมเส้นฝั่งไกลกล้อง (y = 0) ได้ 1 − spread/2 · ริมเส้นฝั่งใกล้ (y = W) ได้ 1 + spread/2
 */
export const depthAt = (state: ProjectionState, y: number): number =>
  1 + ((y - PITCH.width / 2) / PITCH.width) * state.spread;

/** โลก → จอ */
export const toScreen = (state: ProjectionState, point: WorldPoint): ScreenPoint => {
  const depth = depthAt(state, point.y);
  const height = (point.z ?? 0) * state.scale * Z_SCALE;

  return {
    x: state.centreX + (point.x - PITCH.length / 2) * state.scale * depth,
    y: state.centreY + (point.y - PITCH.width / 2) * state.scale * state.tilt - height,
    depth,
  };
};

/**
 * จอ → โลก (ผกผันของสูตรข้างบน โดยถือว่าจุดที่คลิกอยู่บนพื้นสนาม z = 0)
 *
 * แก้หา y ก่อนเพราะ screenY ไม่ขึ้นกับ x เลย จากนั้น k(y) ก็เป็นค่าที่รู้แล้ว
 * ทำให้หาค่า x ได้ตรง ๆ ไม่ต้องวนประมาณ
 */
export const toWorld = (state: ProjectionState, screenX: number, screenY: number): WorldPoint => {
  const y = PITCH.width / 2 + (screenY - state.centreY) / (state.scale * state.tilt);
  const depth = depthAt(state, y);
  const x = PITCH.length / 2 + (screenX - state.centreX) / (state.scale * depth);

  return { x, y, z: 0 };
};

/** ความยาวบนจอของระยะ 1 เมตรแนวราบ ณ ความลึกนั้น */
export const metresToPixels = (state: ProjectionState, metres: number, y: number): number =>
  metres * state.scale * depthAt(state, y);

/** ความยาวบนจอของความสูง 1 เมตร (แกน z) */
export const heightToPixels = (state: ProjectionState, metres: number): number =>
  metres * state.scale * Z_SCALE;
