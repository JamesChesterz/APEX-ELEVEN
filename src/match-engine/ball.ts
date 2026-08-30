/**
 * Ball Entity
 *
 * PHASE 1 บอลเป็นแค่ "ลูกกลิ้ง" ที่มีแรงเสียดทานและกระดอนขอบสนาม
 * ยังไม่มีระบบครองบอล ส่งบอล หรือยิงประตู — บอลมีไว้เพื่อให้นักเตะ
 * มีจุดอ้างอิงในการหันหน้า เข้าประกบ และขยับรูปทีมตามสถานการณ์
 *
 * ช่อง owner / lastTouchId เตรียมไว้ให้ PHASE 2 ต่อระบบ possession
 * โดยไม่ต้องเปลี่ยนสัญญาของ renderer หรือ UI
 */
import { PITCH, clampToPitch } from '@/match-engine/pitch';
import type { Vec2 } from '@/match-engine/types';

/** ค่าคงที่ของแรงเสียดทาน: ความเร็วเหลือกี่ส่วนหลังผ่านไป 1 วินาที */
const FRICTION_PER_SECOND = 0.32;

/** ความเร็วต่ำกว่านี้ถือว่าบอลหยุด */
const STOP_SPEED = 0.25;

/** กระดอนขอบสนามแล้วเหลือแรงกี่ส่วน */
const BOUNCE_DAMPING = 0.55;

export class BallEntity {
  position: Vec2;
  velocity: Vec2 = { x: 0, y: 0 };

  /** ความเร็วปัจจุบัน (เมตร/วินาที) — renderer ใช้วาดเงา/หางบอล */
  speed = 0;

  /** id ของคนที่แตะบอลล่าสุด (PHASE 2 จะใช้ตัดสินการครองบอล) */
  lastTouchId: string | null = null;

  /** PHASE 2: id ของคนที่ครองบอลอยู่ — PHASE 1 เป็น null เสมอ */
  owner: string | null = null;

  constructor(start: Vec2) {
    this.position = { x: start.x, y: start.y };
  }

  /** เตะบอลออกไปในทิศหนึ่งด้วยความเร็วที่กำหนด */
  kick(direction: Vec2, power: number, byPlayerId: string | null = null): void {
    const length = Math.hypot(direction.x, direction.y) || 1;
    this.velocity.x = (direction.x / length) * power;
    this.velocity.y = (direction.y / length) * power;
    this.lastTouchId = byPlayerId;
  }

  /** วางบอลกลับจุดหนึ่งแล้วหยุดสนิท (ใช้ตอนเขี่ยบอล) */
  reset(at: Vec2): void {
    this.position = { x: at.x, y: at.y };
    this.velocity = { x: 0, y: 0 };
    this.speed = 0;
    this.lastTouchId = null;
    this.owner = null;
  }

  update(dt: number): void {
    // แรงเสียดทานแบบ exponential — ไม่ผูกกับ frame rate
    const decay = Math.pow(FRICTION_PER_SECOND, dt);
    this.velocity.x *= decay;
    this.velocity.y *= decay;

    let next = {
      x: this.position.x + this.velocity.x * dt,
      y: this.position.y + this.velocity.y * dt,
    };

    // กระดอนขอบสนาม — PHASE 1 ยังไม่มีทุ่ม/เตะมุม บอลจึงไม่ออกนอกสนาม
    if (next.x < 0.5 || next.x > PITCH.length - 0.5) {
      this.velocity.x *= -BOUNCE_DAMPING;
      next = { ...next, x: Math.min(Math.max(next.x, 0.5), PITCH.length - 0.5) };
    }
    if (next.y < 0.5 || next.y > PITCH.width - 0.5) {
      this.velocity.y *= -BOUNCE_DAMPING;
      next = { ...next, y: Math.min(Math.max(next.y, 0.5), PITCH.width - 0.5) };
    }

    this.position = clampToPitch(next, 0.4);
    this.speed = Math.hypot(this.velocity.x, this.velocity.y);

    if (this.speed < STOP_SPEED) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.speed = 0;
    }
  }
}
