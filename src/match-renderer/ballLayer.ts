/**
 * การวาดลูกบอลแบบมีความสูง
 *
 * ฟิสิกส์ของลูกบอลในเอนจินเป็นแบบ 2 มิติล้วนและ **ไม่ถูกแตะเลย**
 * ความสูง (z) ที่เห็นบนจอเป็นค่าที่ชั้นการแสดงผลคิดเองจากสิ่งที่เอนจินบอกอยู่แล้ว:
 * สถานะของบอล จุดที่ออกตัว และเวลาที่เดินทางมาแล้ว
 *
 *   ลูกยิงแรง → โค้งสูง · ลูกส่งสั้น → แทบไม่ลอย · ลูกกลิ้ง → z = 0
 *
 * เก็บ state ของการลอยไว้ในตัว renderer เอง ไม่ได้เพิ่มฟิลด์ให้ BallEntity
 * เพราะถ้าเพิ่มเข้าไปในเอนจิน มันจะกลายเป็นข้อมูลเกมที่ไม่มีใครในเกมใช้
 */
import type { MatchEngine } from '@/match-engine';
import {
  metresToPixels,
  toScreen,
  type ProjectionState,
} from '@/match-renderer/projection';

/** ความสูงสูงสุดของลูกที่ลอยแรงที่สุด (เมตร) */
const MAX_FLIGHT_HEIGHT = 3.4;

/** ความเร็วออกตัวที่เริ่มทำให้ลูกลอย (เมตร/วินาที) */
const LIFT_THRESHOLD = 13;

/** ค่าคงที่แรงเสียดทานเดียวกับ ball.ts ใช้ประมาณว่าลูกจะวิ่งนานแค่ไหน */
const FRICTION_PER_SECOND = 0.32;

interface Flight {
  /** อ้างอิงจุดออกตัวของลูกนั้น ใช้ดูว่าเป็นลูกใหม่หรือลูกเดิม */
  originX: number;
  originY: number;
  /** ความสูงสูงสุดของลูกนี้ (เมตร) */
  peak: number;
  /** ระยะเวลาที่คาดว่าลูกจะเดินทาง (วินาที) */
  duration: number;
}

export class BallRenderer {
  private flight: Flight | null = null;

  /**
   * ความสูงของลูกบอลที่ควรวาด (เมตร)
   *
   * ลูกที่อยู่กับเท้าหรือกลิ้งอยู่ = 0 เสมอ
   * ลูกที่กำลังเดินทางจะโค้งขึ้นแล้วลงตามสัดส่วนของเวลาที่ผ่านไป
   */
  heightOf(match: MatchEngine): number {
    const { ball } = match;

    if (ball.state !== 'TRAVELLING' && ball.state !== 'SHOT') {
      this.flight = null;
      return 0;
    }

    const origin = ball.passOrigin;
    if (!origin) return 0;

    // ลูกใหม่หรือเปล่า — ดูจากจุดออกตัว ไม่ต้องพึ่งตัวนับใด ๆ ในเอนจิน
    if (!this.flight || this.flight.originX !== origin.x || this.flight.originY !== origin.y) {
      /*
       * ประมาณความเร็วออกตัวย้อนกลับจากความเร็วปัจจุบันและเวลาที่ผ่านไป
       * (เอนจินลดความเร็วแบบ exponential ตามค่าคงที่เดียวกันนี้)
       */
      const elapsed = Math.max(ball.travelElapsed, 0.0001);
      const launchSpeed = ball.speed / Math.pow(FRICTION_PER_SECOND, elapsed);

      const lift = Math.min(Math.max((launchSpeed - LIFT_THRESHOLD) / 18, 0), 1);

      this.flight = {
        originX: origin.x,
        originY: origin.y,
        peak: lift * MAX_FLIGHT_HEIGHT,
        // ลูกแรงกว่าอยู่ในอากาศนานกว่า แต่ไม่เกินสองวินาที
        duration: Math.min(0.45 + lift * 1.1, 2),
      };
    }

    if (this.flight.peak <= 0) return 0;

    const progress = Math.min(ball.travelElapsed / this.flight.duration, 1);
    // โค้งพาราโบลาแบบง่าย: ขึ้นแล้วลงกลับถึงพื้นพอดีตอนจบ
    return this.flight.peak * Math.sin(Math.PI * progress);
  }

  /** ล้างสถานะการลอย (ใช้ตอนเริ่มแมตช์ใหม่) */
  reset(): void {
    this.flight = null;
  }
}

/** เงาของลูกบอลอยู่บนพื้นเสมอ ไม่ว่าลูกจะลอยสูงแค่ไหน */
export const drawBallShadow = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  match: MatchEngine,
  height: number,
): void => {
  const { position } = match.ball;
  const ground = toScreen(state, { x: position.x, y: position.y });
  const radius = metresToPixels(state, 0.5, position.y);

  // ลอยสูงขึ้น เงาเล็กลงและจางลง
  const lift = Math.min(height / MAX_FLIGHT_HEIGHT, 1);
  const scale = 1 - lift * 0.45;

  ctx.fillStyle = `rgba(0, 0, 0, ${0.4 - lift * 0.2})`;
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, radius * scale, radius * scale * state.tilt, 0, 0, Math.PI * 2);
  ctx.fill();
};

/** ตัวลูกบอล วาดที่ความสูง z */
export const drawBall = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  match: MatchEngine,
  height: number,
): void => {
  const { position, state: ballState, speed } = match.ball;
  const screen = toScreen(state, { x: position.x, y: position.y, z: height });
  const radius = Math.max(2, metresToPixels(state, 0.42, position.y));

  // เส้นวิถีของลูกที่กำลังส่ง/ยิง — จางหายไปเอง ไม่ใช่เส้นถาวร
  if ((ballState === 'TRAVELLING' || ballState === 'SHOT') && match.ball.passOrigin) {
    const fade = Math.max(0, 1 - match.ball.travelElapsed / 1.1);
    if (fade > 0) {
      const from = toScreen(state, match.ball.passOrigin);
      ctx.save();
      ctx.strokeStyle =
        ballState === 'SHOT'
          ? `rgba(245, 185, 62, ${0.6 * fade})`
          : `rgba(247, 250, 248, ${0.35 * fade})`;
      ctx.lineWidth = Math.max(1, radius * 0.4);
      ctx.setLineDash([radius * 2, radius * 1.6]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(screen.x, screen.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.fillStyle = '#F7FAF8';
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, ballState === 'SHOT' ? radius * 1.15 : radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = Math.max(1, radius * 0.28);
  ctx.stroke();

  // ลูกที่วิ่งเร็วมีแถบไฮไลต์เล็ก ๆ ให้เห็นว่ากำลังหมุน
  if (speed > 6) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.arc(screen.x - radius * 0.3, screen.y - radius * 0.2, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
};

export { MAX_FLIGHT_HEIGHT };
