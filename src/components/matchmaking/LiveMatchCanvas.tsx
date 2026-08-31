/**
 * สนามถ่ายทอดสดแบบ 2D มุมมองจากด้านบน
 *
 * ตั้งแต่ PHASE 5 คอมโพเนนต์นี้ **ไม่เป็นเจ้าของเอนจินและไม่เดินการจำลองเอง**
 * เอนจินตัวเดียวของนัดนั้นถูกสร้างและเดินโดย useMatchmaking แล้วส่งมาที่นี่เพื่อวาดอย่างเดียว
 *
 *   MatchEngine (useMatchmaking เดินลูป)
 *         ↓ อ่านอย่างเดียว
 *   MatchRenderer (2.5D) → canvas
 *
 * ก่อนหน้านี้คอมโพเนนต์นี้สร้างเอนจินของตัวเอง = มีสองการจำลองต่อหนึ่งนัด
 * ภาพบนจอกับผลการแข่งจึงเป็นคนละเกม ตรงนี้คือจุดที่แก้
 *
 * ยังไม่มี React state ที่เปลี่ยนทุกเฟรมแม้แต่ตัวเดียว — 22 คนที่ 60 FPS วาดผ่าน canvas ล้วน
 */
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { MatchEngine } from '@/match-engine';
import { MatchRenderer } from '@/match-renderer';
import { cn } from '@/utils/helpers';

/** ปุ่มเปิด/ปิดแผงตรวจสอบ (เฉพาะตอน dev) */
const DEBUG_KEY = 'd';

interface LiveMatchCanvasProps {
  /** เอนจินของนัดที่กำลังแข่ง — ตัวเดียวกับที่ตัดสินผลการแข่ง */
  engine: MatchEngine;
  showNames?: boolean;
  className?: string;
  /** id ของนักเตะที่ถูกเลือกอยู่ (ควบคุมจากข้างนอกเพื่อให้แผงข้อมูลอยู่คนละที่ได้) */
  selectedId?: string | null;
  onSelect?: (playerId: string | null) => void;
}

export const LiveMatchCanvas = ({
  engine,
  showNames = false,
  className,
  selectedId = null,
  onSelect,
}: LiveMatchCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<MatchRenderer | null>(null);
  const [debug, setDebug] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ลูปวาดภาพล้วน ๆ — ไม่มีการเรียก engine.tick() ที่นี่เลย
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const renderer = new MatchRenderer(canvas, { showNames });
    rendererRef.current = renderer;

    let frame = 0;
    const draw = () => {
      renderer.draw(engine);
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);

    // สนามปรับขนาดตามกล่องเสมอ ไม่ต้องมีสนามคนละชุดสำหรับจอคนละขนาด
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      rendererRef.current = null;
    };
  }, [engine, showNames]);

  useEffect(() => {
    rendererRef.current?.setOptions({ debug, selectedId, hoveredId });
  }, [debug, hoveredId, selectedId]);

  /*
   * การเลือกนักเตะเป็นเรื่องของ UI ล้วน ไม่แตะสถานะการจำลองเลย
   * และ setState เกิดเฉพาะตอนคลิกหรือตอนที่ "ตัวที่ชี้อยู่เปลี่ยน" เท่านั้น
   * ไม่ใช่ทุกครั้งที่เมาส์ขยับ จึงไม่กลายเป็น React re-render ถี่ ๆ
   */
  const pickAt = (event: ReactMouseEvent<HTMLCanvasElement>) =>
    rendererRef.current?.hitTest(event.nativeEvent.offsetX, event.nativeEvent.offsetY, engine) ??
    null;

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
        onClick={(event) => {
          const hit = pickAt(event);
          onSelect?.(hit && hit.id === selectedId ? null : (hit?.id ?? null));
        }}
        onMouseMove={(event) => {
          const hit = pickAt(event);
          const next = hit?.id ?? null;
          if (next !== hoveredId) setHoveredId(next);
        }}
        onMouseLeave={() => setHoveredId(null)}
        className="block h-full w-full"
        role="img"
        aria-label={`ถ่ายทอดสด ${engine.home.name} พบ ${engine.away.name}`}
      />
    </div>
  );
};
