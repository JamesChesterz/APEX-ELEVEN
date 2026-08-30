/**
 * Ball Entity
 *
 * PHASE 1 บอลเป็นแค่ลูกกลิ้งที่มีแรงเสียดทานและกระดอนขอบสนาม
 * PHASE 2 เพิ่มสถานะการครองบอลเข้ามา โดยยังใช้ตัวเดิม ไม่ได้สร้างระบบบอลใหม่:
 *
 *   FREE ──(มีคนถึงตัวบอล)──▶ CONTROLLED ──(ส่งบอล)──▶ TRAVELLING ──(มีคนรับ/ตัดได้)──▶ CONTROLLED
 *                                                          └──(ไม่มีใครแตะจนบอลหมดแรง)──▶ FREE
 *
 * แหล่งความจริงของ "ใครครองบอลอยู่" มีจุดเดียวคือ ball.owner
 * MatchEngine อ่านจากที่นี่เสมอ ไม่เก็บสำเนาไว้เองอีกชุด
 *
 * ตัวคลาสนี้รู้แค่ฟิสิกส์กับสถานะของตัวเอง ไม่รู้จักนักเตะ ไม่รู้จักทีม
 * การตัดสินว่าใครได้บอลเป็นหน้าที่ของ MatchEngine
 */
import { PITCH, clampToPitch } from '@/match-engine/pitch';
import type { BallState, Vec2 } from '@/match-engine/types';

/** ค่าคงที่ของแรงเสียดทาน: ความเร็วเหลือกี่ส่วนหลังผ่านไป 1 วินาที */
const FRICTION_PER_SECOND = 0.32;

/** ความเร็วต่ำกว่านี้ถือว่าบอลหยุด */
const STOP_SPEED = 0.25;

/** ลูกที่ส่งไปแล้วช้ากว่านี้ ถือว่าไปไม่ถึง กลายเป็นลูกหลุด */
const PASS_DEAD_SPEED = 1.6;

/** กระดอนขอบสนามแล้วเหลือแรงกี่ส่วน */
const BOUNCE_DAMPING = 0.55;

/** ความเร็วสูงสุดที่บอลจะไล่ตามเท้าคนที่ครองอยู่ (เมตร/วินาที) — กันไม่ให้บอลวาร์ป */
const DRIBBLE_CATCH_UP = 14;

export class BallEntity {
  position: Vec2;
  velocity: Vec2 = { x: 0, y: 0 };

  /** ความเร็วปัจจุบัน (เมตร/วินาที) — renderer ใช้วาดเงา/หางบอล */
  speed = 0;

  state: BallState = 'FREE';

  /** id ของคนที่ครองบอลอยู่ (null เมื่อบอลไม่ได้อยู่กับใคร) — แหล่งความจริงเดียว */
  owner: string | null = null;

  /** id ของคนที่ตั้งใจส่งไปหา มีค่าเฉพาะตอน TRAVELLING */
  intendedReceiverId: string | null = null;

  /** id ของคนที่แตะบอลล่าสุด (ใช้ตัดสินว่าใครเสียบอล) */
  lastTouchId: string | null = null;

  /** จุดที่ส่งบอลออกมา ใช้วาดเส้นวิถีบอลระหว่างเดินทาง */
  passOrigin: Vec2 | null = null;

  /** เวลาที่บอลเดินทางมาแล้ว (วินาที) */
  travelElapsed = 0;

  constructor(start: Vec2) {
    this.position = { x: start.x, y: start.y };
  }

  /* ── เปลี่ยนสถานะ ─────────────────────────────────────── */

  /** ให้บอลมาอยู่กับเท้าคนนี้ — ไม่ย้ายตำแหน่งบอล การไล่ตามเท้าทำใน followOwner */
  attachTo(playerId: string): void {
    this.state = 'CONTROLLED';
    this.owner = playerId;
    this.lastTouchId = playerId;
    this.intendedReceiverId = null;
    this.passOrigin = null;
    this.travelElapsed = 0;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.speed = 0;
  }

  /** ปล่อยเป็นลูกหลุด */
  release(): void {
    this.state = 'FREE';
    this.owner = null;
    this.intendedReceiverId = null;
    this.passOrigin = null;
    this.travelElapsed = 0;
  }

  /** ส่งบอลออกไป: บอลเริ่มเดินทางจริงจากจุดที่มันอยู่ ไม่มีการวาร์ปไปที่ผู้รับ */
  launch(direction: Vec2, power: number, fromPlayerId: string, receiverId: string): void {
    this.kick(direction, power, fromPlayerId);
    this.state = 'TRAVELLING';
    this.owner = null;
    this.intendedReceiverId = receiverId;
    this.passOrigin = { x: this.position.x, y: this.position.y };
    this.travelElapsed = 0;
  }

  /** เตะบอลออกไปในทิศหนึ่งด้วยความเร็วที่กำหนด (ใช้ตอนเขี่ยบอลและตอนเคลียร์) */
  kick(direction: Vec2, power: number, byPlayerId: string | null = null): void {
    const length = Math.hypot(direction.x, direction.y) || 1;
    this.velocity.x = (direction.x / length) * power;
    this.velocity.y = (direction.y / length) * power;
    this.speed = power;
    this.lastTouchId = byPlayerId;
  }

  /** วางบอลกลับจุดหนึ่งแล้วหยุดสนิท (ใช้ตอนเขี่ยบอล) */
  reset(at: Vec2): void {
    this.position = { x: at.x, y: at.y };
    this.velocity = { x: 0, y: 0 };
    this.speed = 0;
    this.state = 'FREE';
    this.owner = null;
    this.intendedReceiverId = null;
    this.lastTouchId = null;
    this.passOrigin = null;
    this.travelElapsed = 0;
  }

  /* ── การเคลื่อนที่ ────────────────────────────────────── */

  /**
   * บอลที่อยู่กับเท้า: ไล่ตามจุดควบคุมของเจ้าของแบบมีความเร็วจำกัด
   * ไม่ set position ตรง ๆ เพราะจะกลายเป็นบอลวาร์ปติดตัวคนทุกเฟรม
   */
  followOwner(controlPoint: Vec2, dt: number): void {
    const dx = controlPoint.x - this.position.x;
    const dy = controlPoint.y - this.position.y;
    const gap = Math.hypot(dx, dy);

    if (gap < 0.0001) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.speed = 0;
      return;
    }

    const speed = Math.min(gap / Math.max(dt, 0.0001), DRIBBLE_CATCH_UP);
    this.velocity.x = (dx / gap) * speed;
    this.velocity.y = (dy / gap) * speed;
    this.speed = speed;

    this.position = clampToPitch(
      { x: this.position.x + this.velocity.x * dt, y: this.position.y + this.velocity.y * dt },
      0.4,
    );
  }

  /** ฟิสิกส์ของบอลที่ไม่ได้อยู่กับใคร (FREE หรือ TRAVELLING) */
  update(dt: number): void {
    if (this.state === 'CONTROLLED') return;
    if (this.state === 'TRAVELLING') this.travelElapsed += dt;

    // แรงเสียดทานแบบ exponential — ไม่ผูกกับ frame rate
    const decay = Math.pow(FRICTION_PER_SECOND, dt);
    this.velocity.x *= decay;
    this.velocity.y *= decay;

    let next = {
      x: this.position.x + this.velocity.x * dt,
      y: this.position.y + this.velocity.y * dt,
    };

    // กระดอนขอบสนาม — ยังไม่มีทุ่ม/เตะมุม บอลจึงไม่ออกนอกสนาม
    if (next.x < 0.5 || next.x > PITCH.length - 0.5) {
      this.velocity.x *= -BOUNCE_DAMPING;
      next = { ...next, x: Math.min(Math.max(next.x, 0.5), PITCH.length - 0.5) };
      // ลูกที่ชนขอบสนามถือว่าหลุดจากการส่งแล้ว
      if (this.state === 'TRAVELLING') this.release();
    }
    if (next.y < 0.5 || next.y > PITCH.width - 0.5) {
      this.velocity.y *= -BOUNCE_DAMPING;
      next = { ...next, y: Math.min(Math.max(next.y, 0.5), PITCH.width - 0.5) };
      if (this.state === 'TRAVELLING') this.release();
    }

    this.position = clampToPitch(next, 0.4);
    this.speed = Math.hypot(this.velocity.x, this.velocity.y);

    if (this.speed < STOP_SPEED) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.speed = 0;
    }

    // ส่งไปแล้วหมดแรงก่อนถึงคนรับ = กลายเป็นลูกหลุด ใครอยู่ใกล้ก็เก็บได้
    if (this.state === 'TRAVELLING' && this.speed < PASS_DEAD_SPEED) this.release();
  }
}
