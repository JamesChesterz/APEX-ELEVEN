/**
 * สนามถ่ายทอดสดแบบ 2D มุมมองจากด้านบน
 *
 * คอมโพเนนต์นี้ทำแค่สามอย่าง: สร้างเอนจิน, เดินลูป requestAnimationFrame, สั่ง renderer วาด
 * ไม่มี state ของ React ที่เปลี่ยนทุกเฟรมแม้แต่ตัวเดียว — นักเตะ 22 คนที่ 60 FPS
 * ถ้าใช้ setState จะ re-render ทั้งต้นไม้วินาทีละ 60 ครั้งจนกระตุก
 *
 *   Game State (MatchEngine) → Simulation Tick (fixed step) → Renderer (canvas)
 *
 * การจำลองใช้ timestep คงที่ 1/60 วินาที ส่วนการวาดวาดตามเฟรมจริงของจอ
 * เครื่องช้าเครื่องเร็วจึงเห็นการเคลื่อนที่ด้วยความเร็วเท่ากัน
 */
import { useEffect, useRef } from 'react';
import { createMatch, PitchRenderer, type MatchEngine, type MatchTeamInput } from '@/match-engine';
import { cn } from '@/utils/helpers';

/** ช่วงเวลาคงที่ของการจำลองหนึ่งก้าว (วินาที) */
const FIXED_STEP = 1 / 60;

/** จำกัดเวลาที่ประมวลผลย้อนหลังได้ต่อเฟรม กันไม่ให้ลูปค้างตอนสลับแท็บกลับมา */
const MAX_FRAME_DELTA = 0.25;

interface LiveMatchCanvasProps {
  home: MatchTeamInput;
  away: MatchTeamInput;
  /** รหัสแมตช์ — ใช้เป็น seed และเป็นตัวบอกว่าต้องสร้างเอนจินใหม่เมื่อไหร่ */
  sessionId: string;
  /** นาทีจากระบบถ่ายทอดสดเดิม ใช้ดึงนาฬิกาของเอนจินให้ตรงกัน */
  minute: number;
  /** true = หยุดเกมชั่วคราว (เช่นรอเปลี่ยนตัวคนบาดเจ็บ) */
  paused?: boolean;
  /** นาทีในเกมต่อ 1 วินาทีจริง — ต้องตรงกับจังหวะของ useMatchmaking */
  minutesPerSecond?: number;
  showNames?: boolean;
  className?: string;
}

export const LiveMatchCanvas = ({
  home,
  away,
  sessionId,
  minute,
  paused = false,
  minutesPerSecond = 1,
  showNames = false,
  className,
}: LiveMatchCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const rendererRef = useRef<PitchRenderer | null>(null);

  // สร้างเอนจิน + เดินลูป — ทำใหม่เฉพาะตอนเปลี่ยนแมตช์เท่านั้น
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = createMatch(home, away, { seed: sessionId, minutesPerSecond });
    const renderer = new PitchRenderer(canvas, { showNames });
    engineRef.current = engine;
    rendererRef.current = renderer;

    let frame = 0;
    let last = performance.now();
    let accumulator = 0;

    const loop = (now: number) => {
      const delta = Math.min((now - last) / 1000, MAX_FRAME_DELTA);
      last = now;
      accumulator += delta;

      while (accumulator >= FIXED_STEP) {
        engine.tick(FIXED_STEP);
        accumulator -= FIXED_STEP;
      }

      renderer.draw(engine);
      frame = window.requestAnimationFrame(loop);
    };

    frame = window.requestAnimationFrame(loop);

    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      engineRef.current = null;
      rendererRef.current = null;
    };
  }, [away, home, minutesPerSecond, sessionId, showNames]);

  // หยุด/เดินต่อโดยไม่ต้องสร้างเอนจินใหม่
  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  // ดึงนาฬิกาให้ตรงกับนาทีทางการของระบบถ่ายทอดสด
  useEffect(() => {
    engineRef.current?.syncClock(minute);
  }, [minute]);

  return (
    <div
      className={cn(
        'relative h-full min-h-[340px] w-full overflow-hidden rounded-xl border border-white/10 bg-pitch-900 shadow-glass',
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label={`ถ่ายทอดสด ${home.name} พบ ${away.name}`}
      />
    </div>
  );
};
