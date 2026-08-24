/**
 * เลเยอร์เอฟเฟกต์ของฉากเปิดซอง — แยกเป็นชิ้น ๆ ให้ประกอบ/ปิดเปิดได้อิสระ
 *
 * ทุกชิ้นวาดด้วย CSS/SVG ล้วน ไม่ใช้ไฟล์ภาพ จึงคมทุกความละเอียด
 * เปลี่ยนสีตามระดับการ์ดได้ทันที และไม่มีปัญหาเรื่องสิทธิ์ภาพ
 *
 * ชิ้นส่วนทั้งหมด (เรียงตามลำดับที่ซ้อนกันในฉาก):
 *   StadiumLights  ไฟสปอตไลต์สเตเดียมด้านบน
 *   LightRays      ลำแสงหมุนรอบการ์ด
 *   LightBeams     ลำแสงตั้งพุ่งขึ้นจากพื้นเวที
 *   Shockwave      วงแหวนคลื่นกระแทกตอนซองแตก
 *   SparkBurst     ประกายพุ่งออกจากจุดกลางเป็นเส้น
 *   EmberField     ประกายลอยขึ้นรอบการ์ด
 *   Confetti       เศษริบบิ้นร่วงจากด้านบน
 *   MythicAurora   ม่านออโรราไล่สี + คริสตัลโคจร + วงแหวนรูน (mythical เท่านั้น)
 *   CardAura       ออร่าเรืองแสงหลังการ์ด
 *   StagePodium    แท่นเวที + เงาสะท้อนบนพื้น
 *   PackShell      ตัวซองก่อนถูกฉีก (ทรงเรียบ ไม่มีโลโก้)
 *   EnergyCracks   พลังงานวิ่งตามรอยแตกของซอง
 */
import { alpha } from '@/components/pack/rarityFx';
import { cn } from '@/utils/helpers';

interface LayerProps {
  color: string;
  accent: string;
  /** ความเข้มโดยรวม 0–1 */
  intensity: number;
  className?: string;
}

/* ── ไฟสปอตไลต์สเตเดียมด้านบน ─────────────────────────────── */

export const StadiumLights = ({ color, intensity }: LayerProps) => (
  <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 overflow-hidden">
    {[18, 38, 62, 82].map((left, index) => (
      <div
        key={left}
        className="absolute top-0 h-full w-[22vmin] origin-top animate-beam-rise"
        style={{
          left: `${left}%`,
          transform: 'translateX(-50%)',
          animationDelay: `${index * 90}ms`,
          opacity: 0,
          // กรวยแสงจากโคมไฟ: สว่างที่ปลายบน จางลงเมื่อลงมา
          background: `linear-gradient(to bottom, ${alpha('#FFFFFF', 0.35 * intensity)}, ${alpha(color, 0.12 * intensity)} 45%, transparent 100%)`,
          clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
          filter: 'blur(6px)',
        }}
      />
    ))}
  </div>
);

/* ── ลำแสงหมุนรอบการ์ด ─────────────────────────────────────── */

export const LightRays = ({ color, intensity, fast = false }: LayerProps & { fast?: boolean }) => (
  <div
    className={cn(
      'pointer-events-none absolute left-1/2 top-1/2 h-[190vmax] w-[190vmax] -translate-x-1/2 -translate-y-1/2',
      fast ? 'animate-ray-spin-fast' : 'animate-ray-spin',
    )}
    style={{
      background: `repeating-conic-gradient(from 0deg, ${alpha(color, 0.3 * intensity)} 0deg 2.5deg, transparent 2.5deg 13deg)`,
      // เจาะกลางให้โปร่ง เพื่อไม่ให้ลำแสงบังตัวการ์ด
      maskImage: 'radial-gradient(circle, transparent 8%, black 26%, transparent 62%)',
      WebkitMaskImage: 'radial-gradient(circle, transparent 8%, black 26%, transparent 62%)',
    }}
  />
);

/* ── ลำแสงตั้งพุ่งขึ้นจากพื้นเวที ───────────────────────────── */

export const LightBeams = ({ color, accent, intensity }: LayerProps) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {[-34, -22, -13, 13, 22, 34].map((offset, index) => (
      <div
        key={offset}
        className="absolute bottom-[18%] h-[62vh] origin-bottom animate-beam-rise"
        style={{
          left: `calc(50% + ${offset}vmin)`,
          width: `${Math.abs(offset) > 25 ? 3.5 : 2.2}vmin`,
          transform: `translateX(-50%) skewX(${offset / 5}deg)`,
          animationDelay: `${index * 60}ms`,
          opacity: 0,
          background: `linear-gradient(to top, ${alpha(accent, 0.55 * intensity)}, ${alpha(color, 0.22 * intensity)} 40%, transparent 100%)`,
          filter: 'blur(3px)',
        }}
      />
    ))}
  </div>
);

/* ── วงแหวนคลื่นกระแทก ─────────────────────────────────────── */

export const Shockwave = ({ color, intensity }: LayerProps) => (
  <>
    {[0, 180].map((delay) => (
      <div
        key={delay}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] animate-shockwave rounded-full"
        style={{
          animationDelay: `${delay}ms`,
          border: `2px solid ${alpha(color, 0.75 * intensity)}`,
          boxShadow: `0 0 30px ${alpha(color, 0.5 * intensity)}, inset 0 0 30px ${alpha(color, 0.35 * intensity)}`,
        }}
      />
    ))}
  </>
);

/* ── ประกายพุ่งออกจากจุดกลาง ───────────────────────────────── */

export const SparkBurst = ({ color, accent, intensity, count }: LayerProps & { count: number }) => (
  <div className="pointer-events-none absolute left-1/2 top-1/2">
    {Array.from({ length: count }, (_, index) => {
      // กระจายรอบวงเท่า ๆ กัน แล้วบิดเล็กน้อยไม่ให้ดูเป็นระเบียบเกินไป
      const angle = (index / count) * 360 + ((index * 37) % 14);

      return (
        <div
          key={index}
          className="absolute left-0 top-0 h-[2px] w-[14vmin]"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: '0 50%' }}
        >
          <div
            className="h-full w-full animate-spark-fly rounded-full"
            style={{
              animationDelay: `${(index * 23) % 260}ms`,
              opacity: 0,
              background: `linear-gradient(to right, transparent, ${alpha(accent, 0.95 * intensity)}, ${alpha(color, 0)})`,
            }}
          />
        </div>
      );
    })}
  </div>
);

/* ── ประกายลอยขึ้นรอบการ์ด ─────────────────────────────────── */

export const EmberField = ({ color, intensity, count }: LayerProps & { count: number }) => (
  <>
    {Array.from({ length: count }, (_, index) => (
      <span
        key={index}
        className="pointer-events-none absolute bottom-[26%] h-1.5 w-1.5 animate-spark-float rounded-full"
        style={{
          // กระจายซ้าย-ขวารอบกลางจอ พร้อมหน่วงเวลาไม่เท่ากันให้ดูเป็นธรรมชาติ
          left: `${50 + (index % 2 === 0 ? 1 : -1) * (6 + ((index * 37) % 26))}%`,
          backgroundColor: color,
          opacity: intensity,
          boxShadow: `0 0 8px ${alpha(color, 0.9)}`,
          animationDelay: `${(index * 137) % 2000}ms`,
        }}
      />
    ))}
  </>
);

/* ── เศษริบบิ้นร่วงจากด้านบน ───────────────────────────────── */

export const Confetti = ({ color, accent, intensity, count = 26 }: LayerProps & { count?: number }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {Array.from({ length: count }, (_, index) => (
      <span
        key={index}
        className="absolute top-0 animate-confetti-fall"
        style={{
          left: `${(index * 97) % 100}%`,
          width: `${4 + (index % 3) * 2}px`,
          height: `${8 + (index % 4) * 3}px`,
          opacity: intensity,
          backgroundColor: index % 3 === 0 ? accent : color,
          animationDelay: `${(index * 211) % 3400}ms`,
          animationDuration: `${3000 + ((index * 313) % 1600)}ms`,
        }}
      />
    ))}
  </div>
);

/* ── ม่านออโรรา + คริสตัลโคจร + วงแหวนรูน (เฉพาะ mythical) ── */

/**
 * เลเยอร์ประจำระดับ mythical โดยเฉพาะ — ประกอบด้วย 3 ชั้น
 *   1. ม่านออโรราไล่สีหมุนอยู่หลังการ์ด (hue-rotate ทำให้สีเปลี่ยนไปเรื่อย ๆ)
 *   2. วงแหวนรูนขยายออกเป็นจังหวะ ให้รู้สึกเหมือนมีพลังบางอย่างเต้นอยู่
 *   3. เศษคริสตัลโคจรรอบการ์ดเป็นวงกลม
 * ตั้งใจให้ต่างจาก legendary ตรงที่ "ไล่สี" ไม่ใช่สีเดียวทั้งฉาก
 */
export const MythicAurora = ({ color, accent, intensity }: LayerProps) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {/* ม่านออโรราหมุนไล่สีอยู่หลังสุด */}
    <div
      className="absolute left-1/2 top-1/2 h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2 animate-aurora-sweep"
      style={{
        background: `conic-gradient(from 0deg, ${alpha(color, 0.34 * intensity)}, ${alpha(accent, 0.3 * intensity)} 25%, ${alpha('#B76BFF', 0.32 * intensity)} 50%, ${alpha(accent, 0.3 * intensity)} 75%, ${alpha(color, 0.34 * intensity)})`,
        maskImage: 'radial-gradient(circle, transparent 14%, black 34%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(circle, transparent 14%, black 34%, transparent 70%)',
        filter: 'blur(22px)',
      }}
    />

    {/* วงแหวนรูน 3 วง เหลื่อมเวลากันให้เต้นต่อเนื่อง */}
    {[0, 800, 1600].map((delay) => (
      <div
        key={delay}
        className="absolute left-1/2 top-1/2 h-[58vmin] w-[58vmin] animate-rune-pulse rounded-full"
        style={{
          animationDelay: `${delay}ms`,
          opacity: 0,
          border: `1px dashed ${alpha(accent, 0.7 * intensity)}`,
          boxShadow: `0 0 34px ${alpha(color, 0.45 * intensity)}`,
        }}
      />
    ))}

    {/* เศษคริสตัลโคจรรอบการ์ด */}
    <div className="absolute left-1/2 top-1/2">
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className="absolute left-0 top-0 h-[1.6vmin] w-[1.6vmin] animate-shard-orbit"
          style={{
            // หน่วงเวลาแบบติดลบ = เริ่มกลางรอบ ทำให้คริสตัลกระจายรอบวงตั้งแต่เฟรมแรก
            animationDelay: `${-(index * 7000) / 8}ms`,
            backgroundColor: index % 2 === 0 ? accent : color,
            opacity: 0.85 * intensity,
            clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
            boxShadow: `0 0 14px ${alpha(index % 2 === 0 ? accent : color, 0.9)}`,
          }}
        />
      ))}
    </div>
  </div>
);

/* ── ออร่าเรืองแสงหลังการ์ด ────────────────────────────────── */

export const CardAura = ({ color, accent, intensity }: LayerProps) => (
  <div
    className="pointer-events-none absolute left-1/2 top-1/2 h-[46vmin] w-[34vmin] -translate-x-1/2 -translate-y-1/2 rounded-[2vmin]"
    style={{
      background: `radial-gradient(ellipse at center, ${alpha(accent, 0.55 * intensity)} 0%, ${alpha(color, 0.3 * intensity)} 45%, transparent 72%)`,
      filter: 'blur(14px)',
    }}
  />
);

/* ── แท่นเวที + เงาสะท้อนบนพื้น ────────────────────────────── */

export const StagePodium = ({ color, accent, intensity }: LayerProps) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-[16%] flex flex-col items-center">
    {/* แสงสะท้อนบนพื้นใต้การ์ด */}
    <div
      className="h-[9vmin] w-[62vmin] animate-podium-rise rounded-[50%]"
      style={{
        opacity: 0,
        background: `radial-gradient(ellipse at center, ${alpha(accent, 0.6 * intensity)} 0%, ${alpha(color, 0.25 * intensity)} 40%, transparent 70%)`,
        filter: 'blur(8px)',
      }}
    />
    {/* ขอบแท่นเรืองแสง */}
    <div
      className="-mt-[5vmin] h-[3vmin] w-[38vmin] animate-podium-rise rounded-[50%]"
      style={{
        opacity: 0,
        animationDelay: '120ms',
        border: `1px solid ${alpha(accent, 0.8 * intensity)}`,
        background: `linear-gradient(to bottom, ${alpha(color, 0.45 * intensity)}, transparent)`,
        boxShadow: `0 0 26px ${alpha(color, 0.6 * intensity)}`,
      }}
    />
  </div>
);

/* ── ตัวซองก่อนถูกฉีก ──────────────────────────────────────── */

interface PackShellProps extends LayerProps {
  /** true = เข้าสู่ช่วงสะสมพลัง ซองจะสั่นและมีรอยแตก */
  tearing: boolean;
}

export const PackShell = ({ color, accent, intensity, tearing }: PackShellProps) => (
  <div className={cn('relative', tearing ? 'animate-tear-shake' : 'animate-pack-float')}>
    {/* ตัวซอง — ทรงเรียบ ไม่มีโลโก้ ใส่ตราของเกมเองทีหลังได้ */}
    <div
      className="relative h-[38vmin] w-[27vmin] rounded-[1.5vmin]"
      style={{
        background: `linear-gradient(150deg, ${alpha(color, 0.55)} 0%, #0B1512 45%, #060B09 100%)`,
        border: `1px solid ${alpha(accent, 0.35)}`,
        boxShadow: `0 0 40px ${alpha(color, 0.4 * intensity)}, inset 0 0 40px ${alpha(color, 0.18)}`,
      }}
    >
      {/* แถบแสงพาดเฉียงให้ดูเป็นพลาสติกเงา */}
      <div
        className="absolute inset-0 rounded-[1.5vmin]"
        style={{
          background: `linear-gradient(115deg, transparent 30%, ${alpha('#FFFFFF', 0.14)} 45%, transparent 58%)`,
        }}
      />
      {tearing && <EnergyCracks color={color} accent={accent} intensity={intensity} />}
    </div>

    {/* เงาเรืองแสงใต้ซอง */}
    <div
      className="absolute -bottom-[3vmin] left-1/2 h-[4vmin] w-[34vmin] -translate-x-1/2 rounded-[50%]"
      style={{
        background: `radial-gradient(ellipse at center, ${alpha(color, 0.6 * intensity)}, transparent 70%)`,
        filter: 'blur(6px)',
      }}
    />
  </div>
);

/* ── พลังงานวิ่งตามรอยแตกของซอง ────────────────────────────── */

export const EnergyCracks = ({ color, accent, intensity }: LayerProps) => (
  <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 140" aria-hidden>
    <defs>
      <filter id="crackGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="2.4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* รอยแตกหลัก 3 เส้น วิ่งจากขอบซองเข้าหากลาง */}
    {[
      'M50 4 L44 34 L56 52 L46 78 L54 104 L48 136',
      'M8 22 L30 40 L22 62 L40 82',
      'M92 30 L70 46 L80 70 L62 92',
    ].map((path, index) => (
      <path
        key={path}
        d={path}
        fill="none"
        stroke={index === 0 ? accent : color}
        strokeWidth={index === 0 ? 2.2 : 1.4}
        strokeLinecap="round"
        opacity={intensity}
        filter="url(#crackGlow)"
        className="animate-pulse"
        style={{ animationDelay: `${index * 120}ms`, animationDuration: '420ms' }}
      />
    ))}
  </svg>
);
