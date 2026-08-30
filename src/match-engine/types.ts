/**
 * โครงสร้างข้อมูลของ Match Engine (PHASE 1)
 *
 * ไฟล์ทั้งโฟลเดอร์ match-engine/ ห้าม import React หรือแตะ DOM
 * มันคือเครื่องจำลองล้วน ๆ — UI มีหน้าที่อ่าน state ออกไปวาดเท่านั้น
 * ทำแบบนี้เพื่อให้ PHASE 2 (ส่งบอล/ยิง/เซฟ/ฟาวล์) เพิ่มเข้ามาได้โดยไม่ต้องแตะ React เลย
 *
 * ระบบพิกัด "โลกจริง" ของเอนจิน (หน่วยเป็นเมตร ไม่ใช่พิกเซล):
 *   x = ความยาวสนาม 0 → 105  (0 = เส้นประตูฝั่ง home, 105 = เส้นประตูฝั่ง away)
 *   y = ความกว้างสนาม 0 → 68 (0 = ริมเส้นข้างบน, 68 = ริมเส้นข้างล่าง)
 * ทีม home บุกไปทาง +x, ทีม away บุกไปทาง −x
 *
 * ต่างจากพิกัดของ FormationSlot ในเกม (x/y เป็น 0–100 และ y คือความยาวสนาม)
 * การแปลงอยู่ที่ pitch.ts เพียงที่เดียว
 */
import type { Position } from '@/types/player';

/** เวกเตอร์ 2 มิติ — ใช้ซ้ำทั้งตำแหน่ง ความเร็ว และเป้าหมาย */
export interface Vec2 {
  x: number;
  y: number;
}

/** ฝั่งของทีมในแมตช์ */
export type MatchSide = 'home' | 'away';

/** จำพวกของนักเตะที่เอนจินใช้ตัดสินพฤติกรรม (แปลงมาจาก Position ของเกม) */
export type AgentRole = 'gk' | 'defence' | 'midfield' | 'attack';

/**
 * สถานะการเคลื่อนที่ของนักเตะหนึ่งคน
 *
 * IDLE           ยืนอยู่กับที่ (ถึงตำแหน่งแล้วและบอลอยู่ไกล)
 * POSITIONING    เดินกลับเข้าตำแหน่งตามแผน
 * MOVING_TO_BALL คนที่ใกล้บอลที่สุดของทีม — วิ่งเข้าไปหาบอล
 * SUPPORT        คนใกล้บอลรองลงมา — ขยับเข้าไปรับช่วงต่อ
 * DEFENDING      ทีมไม่ได้ครองบอล — ถอยลงมารักษาแนว
 * ATTACKING      ทีมได้ครองบอล — เติมขึ้นไปหาพื้นที่ว่างข้างหน้า
 */
export type MovementState =
  | 'IDLE'
  | 'POSITIONING'
  | 'MOVING_TO_BALL'
  | 'SUPPORT'
  | 'DEFENDING'
  | 'ATTACKING';

/** ช่วงของแมตช์ — PHASE 1 ใช้แค่ kickoff → live → fulltime */
export type MatchPhase = 'kickoff' | 'live' | 'paused' | 'fulltime';

/* ── ข้อมูลนำเข้า (มาจากระบบเดิมของเกม) ───────────────────── */

/**
 * นักเตะหนึ่งคนที่ส่งเข้าเอนจิน
 *
 * ทุกฟิลด์มาจากข้อมูลจริงของเกม (Player + FormationSlot + การ์ดของผู้เล่น)
 * เอนจินไม่รู้จัก Firestore, ไม่รู้จักการ์ด, ไม่รู้จักค่าตีบวก — รู้แค่ที่เห็นตรงนี้
 */
export interface MatchPlayerInput {
  /** ไม่ซ้ำกันภายในแมตช์ (ใช้ cardId ฝั่งเรา / playerId ฝั่งคู่แข่ง) */
  id: string;
  name: string;
  /** เบอร์เสื้อที่โชว์บนตัวนักเตะ (ใช้ลำดับช่องในแผน 1–11 เหมือนแผงรายชื่อ) */
  shirtNumber: number;
  /** ตำแหน่งของ "ช่อง" ที่เขายืน ไม่ใช่ตำแหน่งถนัดของตัวนักเตะ */
  position: Position;
  ovr: number;
  /** ค่าความเร็วจาก PlayerStats — ไม่มีก็ถอยไปใช้ ovr */
  pace?: number;
  /** รหัสช่องในแผน เช่น 'CB1' — ผูกกลับไปหาข้อมูลเดิมได้ */
  slotId: string;
  /** พิกัดช่องตามแผน (0–100 ตามระบบเดิม: y คือความยาวสนาม) */
  formationX: number;
  formationY: number;
}

/** ทีมหนึ่งทีมที่ส่งเข้าเอนจิน */
export interface MatchTeamInput {
  id: string;
  name: string;
  /** ชื่อแผน ใช้แค่โชว์ — ตำแหน่งจริงมาจาก formationX/Y ของนักเตะแต่ละคน */
  formationName: string;
  /** สีหลักของชุดแข่ง (hex) */
  color: string;
  /** สีตัวเลข/ขอบ ให้อ่านเบอร์ออกบนสีหลัก */
  accent: string;
  players: MatchPlayerInput[];
}

/* ── เหตุการณ์ (ยังไม่ได้ใช้ใน PHASE 1) ────────────────────── */

/**
 * เหตุการณ์ที่เอนจินปล่อยออกมา
 *
 * PHASE 1 ปล่อยแค่ kickoff — ช่องนี้มีไว้ให้ PHASE 2 เติม
 * 'pass' | 'shot' | 'goal' | 'save' | 'tackle' | 'foul' โดยไม่ต้องแก้สัญญาของ UI
 */
export interface MatchSimEvent {
  type: string;
  /** นาทีในเกมที่เกิด */
  minute: number;
  side?: MatchSide;
  playerId?: string;
  /** ข้อมูลเพิ่มเติมแล้วแต่ประเภทเหตุการณ์ */
  detail?: Record<string, number | string>;
}

/** นาฬิกาแมตช์ */
export interface MatchClock {
  /** นาทีในเกม 0–90 */
  minute: number;
  /** วินาทีภายในนาทีนั้น 0–59 (ใช้ให้เข็มเดินลื่นไหล ไม่กระตุกทีละนาที) */
  second: number;
  running: boolean;
}

/** ค่าตั้งต้นของเอนจิน */
export interface MatchEngineOptions {
  /** ความยาวแมตช์ (นาทีในเกม) — ค่าปกติ 90 */
  totalMinutes?: number;
  /**
   * นาทีในเกมที่เดินต่อ 1 วินาทีจริง
   * เกมนี้ถ่ายทอดสด 90 นาทีในราว 12 วินาที จึงประมาณ 7.7
   */
  minutesPerSecond?: number;
  /** ค่า seed ให้การสุ่มคงที่ (ทีมเดิมจะขยับเหมือนเดิมทุกครั้ง) */
  seed?: string;
  /**
   * แหล่งความจริงของนาฬิกา
   *
   * 'internal' (ค่าปกติ) — เอนจินเดินนาฬิกาเอง ใช้ตอนรันเดี่ยว ๆ หรือในเทส
   * 'external' — นาทีมาจากข้างนอกทั้งหมด (useMatchmaking) เอนจินไม่นับเวลาเอง
   *              ใช้ในเกมจริง เพื่อไม่ให้มีนาฬิกาสองเรือนแข่งกัน
   */
  clockSource?: 'internal' | 'external';
}
