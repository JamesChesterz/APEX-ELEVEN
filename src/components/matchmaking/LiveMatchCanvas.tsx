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
 *
 * สำคัญ: เอนจินถูกสร้างใหม่เฉพาะตอนเปลี่ยน "แมตช์" เท่านั้น (sessionId เปลี่ยน)
 * รายชื่อที่เปลี่ยนกลางเกม (ใบแดง / เปลี่ยนตัวคนบาดเจ็บ) ส่งผ่าน syncRoster
 * ไม่งั้นทุกคนจะเด้งกลับตำแหน่งตั้งต้นทุกครั้งที่มีคนโดนไล่ออก
 */
import { useEffect, useRef, useState } from 'react';
import { createMatch, PitchRenderer, type MatchEngine, type MatchTeamInput } from '@/match-engine';
import { cn } from '@/utils/helpers';

/** ช่วงเวลาคงที่ของการจำลองหนึ่งก้าว (วินาที) */
const FIXED_STEP = 1 / 60;

/** จำกัดเวลาที่ประมวลผลย้อนหลังได้ต่อเฟรม กันไม่ให้ลูปค้างตอนสลับแท็บกลับมา */
const MAX_FRAME_DELTA = 0.25;

/** ปุ่มเปิด/ปิดแผงตรวจสอบ (เฉพาะตอน dev) */
const DEBUG_KEY = 'd';

interface LiveMatchCanvasProps {
  home: MatchTeamInput;
  away: MatchTeamInput;
  /** รหัสแมตช์ — เปลี่ยนค่านี้เมื่อไหร่ถึงจะสร้างเอนจินใหม่ */
  sessionId: string;
  /** นาทีจาก useMatchmaking — เป็นแหล่งความจริงเดียวของนาฬิกา */
  minute: number;
  /** true = หยุดเกมชั่วคราว (เช่นรอเปลี่ยนตัวคนบาดเจ็บ) */
  paused?: boolean;
  showNames?: boolean;
  className?: string;
}

export const LiveMatchCanvas = ({
  home,
  away,
  sessionId,
  minute,
  paused = false,
  showNames = false,
  className,
}: LiveMatchCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const rendererRef = useRef<PitchRenderer | null>(null);

  /**
   * ทีมล่าสุด เก็บใน ref เพื่อให้ effect ที่สร้างเอนจินไม่ต้องผูกกับ home/away
   * (สองก้อนนี้เป็น object ใหม่ทุกครั้งที่รายชื่อเปลี่ยน)
   */
  const teamsRef = useRef({ home, away });
  teamsRef.current = { home, away };

  const [debug, setDebug] = useState(false);

  // สร้างเอนจิน + เดินลูป — ผูกกับ sessionId เท่านั้น
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = createMatch(teamsRef.current.home, teamsRef.current.away, {
      seed: sessionId,
      // นาทีมาจาก useMatchmaking ทั้งหมด เอนจินไม่นับเวลาเอง
      clockSource: 'external',
    });
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
  }, [sessionId, showNames]);

  // รายชื่อเปลี่ยนกลางเกม — ปรับคนในสนามโดยไม่รีเซ็ตแมตช์
  useEffect(() => {
    engineRef.current?.syncRoster(home, away);
  }, [away, home]);

  // หยุด/เดินต่อโดยไม่ต้องสร้างเอนจินใหม่
  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  // นาฬิกา: รับค่าจากระบบเดิมอย่างเดียว
  useEffect(() => {
    engineRef.current?.syncClock(minute);
  }, [minute]);

  useEffect(() => {
    rendererRef.current?.setOptions({ debug });
  }, [debug]);

  /**
   * แผงตรวจสอบเปิดได้เฉพาะตอนรัน dev เท่านั้น
   * ตอน build production เงื่อนไขนี้เป็นเท็จคงที่ Vite จึงตัดโค้ดทิ้งไปเลย
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== DEBUG_KEY) return;

      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      setDebug((current) => !current);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
