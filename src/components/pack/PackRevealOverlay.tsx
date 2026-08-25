/**
 * เอฟเฟกต์เปิดซองแบบเต็มจอ (walkout)
 *
 * ไทม์ไลน์ของการ์ดหนึ่งใบ แบ่งเป็น 4 ช่วงตามสตอรี่บอร์ดอ้างอิง:
 *   pack  ซองลอยอยู่กลางจอ มีแสงใต้ซอง
 *   tear  ซองสั่น พลังงานวิ่งตามรอยแตก (ยิ่งการ์ดดี ยิ่งสั่นนาน)
 *   burst ซองแตก แสงวาบเต็มจอ + คลื่นกระแทก + ประกายพุ่ง
 *   card  การ์ดโผล่ขึ้นจากเงามืดบนแท่นเวที พร้อมลำแสงและประกาย
 *
 * ตัวเอฟเฟกต์แต่ละชั้นอยู่ที่ PackFxLayers.tsx และเปิด/ปิดตามค่าใน rarityFx.ts
 * การ์ดถูกเรียงจากแย่ไปดี ใบที่ดีที่สุดจึงถูกเปิดเป็นใบสุดท้ายเสมอ
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CardAura,
  Confetti,
  EmberField,
  LightBeams,
  LightRays,
  MythicAurora,
  PackShell,
  Shockwave,
  SparkBurst,
  StadiumLights,
  StagePodium,
} from '@/components/pack/PackFxLayers';
import { alpha, RARITY_FX, RARITY_RANK } from '@/components/pack/rarityFx';
import { PlayerCard } from '@/components/player/PlayerCard';
import { playCharge, playReveal, playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { Player } from '@/types/player';
import { cn, nationCode } from '@/utils/helpers';

/** การ์ดหนึ่งใบที่รอเผย */
export interface RevealEntry {
  card: PlayerCardData;
  player: Player;
}

interface PackRevealOverlayProps {
  entries: RevealEntry[];
  packName: string;
  onClose: () => void;
}

/** ช่วงของการเผยการ์ดหนึ่งใบ */
type Phase = 'pack' | 'tear' | 'burst' | 'card';

/** ซองลอยนิ่งก่อนเริ่มสั่น (ms) */
const PACK_MS = 620;
/** แสงวาบก่อนการ์ดโผล่ (ms) */
const BURST_MS = 460;

export const PackRevealOverlay = ({ entries, packName, onClose }: PackRevealOverlayProps) => {
  /** เรียงจากแย่ไปดี เพื่อให้ไคลแมกซ์อยู่ใบสุดท้าย */
  const ordered = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          RARITY_RANK[a.player.rarity] - RARITY_RANK[b.player.rarity] ||
          a.player.ovr - b.player.ovr,
      ),
    [entries],
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('pack');
  /** true = ข้ามแอนิเมชันทั้งหมด ไปหน้าสรุปเลย */
  const [summary, setSummary] = useState(false);

  const entry = ordered[index];
  const fx = entry ? RARITY_FX[entry.player.rarity] : RARITY_FX.common;
  const { layers } = fx;
  const isLast = index === ordered.length - 1;

  /** ตัวหยุดเสียงไต่ระดับ เก็บไว้เพื่อตัดเสียงตอนผู้เล่นกดข้าม */
  const stopCharge = useRef<(() => void) | null>(null);

  /**
   * ใบที่กำลังเผย เก็บไว้ใน ref เพื่อให้ไทม์ไลน์อ่านค่าล่าสุดได้
   * โดยไม่ต้องเอา entry (ซึ่งเป็นอ็อบเจกต์ใหม่ทุกครั้งที่วาดจอ) ไปเป็น dependency
   */
  const current = useRef(entry);
  current.current = entry;

  /**
   * กุญแจที่บอกว่า "เปลี่ยนใบแล้วจริง ๆ" — ใช้เป็น dependency แทนตัวอ็อบเจกต์
   *
   * เดิมใช้ entry ตรง ๆ ซึ่งพังเมื่อหน้าที่เรียกสร้างอาร์เรย์ใหม่ทุกครั้งที่วาดจอ
   * (เช่นหน้าแลกนักเตะที่มีนาฬิกาถอยหลังเดินทุกวินาที) ไทม์ไลน์จะถูกรีเซ็ตกลับไป
   * เริ่มใหม่ทุกวินาที การ์ดจึงไม่มีวันโผล่ ต้องกดข้ามอย่างเดียว
   */
  const entryKey = entry ? `${entry.card.id}:${index}` : '';

  // เดินไทม์ไลน์ของการ์ดใบปัจจุบัน พร้อมยิงเสียงให้ตรงกับแต่ละจังหวะ
  useEffect(() => {
    const showing = current.current;
    if (summary || !showing) return undefined;

    const tearMs = RARITY_FX[showing.player.rarity].tearMs;

    setPhase('pack');
    playSfx('packAppear');

    const toTear = window.setTimeout(() => {
      setPhase('tear');
      // เสียงไต่ระดับยาวเท่ากับเวลาที่ซองสั่นจริง ยิ่งการ์ดดี ยิ่งไต่สูงและนาน
      stopCharge.current = playCharge(showing.player.rarity, tearMs);
    }, PACK_MS);

    const toBurst = window.setTimeout(() => {
      setPhase('burst');
      playSfx('packBurst');
    }, PACK_MS + tearMs);

    const toCard = window.setTimeout(() => {
      setPhase('card');
      playReveal(showing.player.rarity);
    }, PACK_MS + tearMs + BURST_MS);

    return () => {
      [toTear, toBurst, toCard].forEach(window.clearTimeout);
      stopCharge.current?.();
      stopCharge.current = null;
    };
  }, [entryKey, summary]);

  /** แตะจอ: ถ้าการ์ดโผล่แล้วให้ไปใบถัดไป (หรือหน้าสรุปถ้าหมดแล้ว) */
  const advance = () => {
    if (phase !== 'card') return;
    stopCharge.current?.();

    if (isLast) {
      setSummary(true);
      playSfx('summary');
    } else {
      setIndex((current) => current + 1);
    }
  };

  if (ordered.length === 0) return null;

  /* ── หน้าสรุปหลังเปิดครบทุกใบ ─────────────────────────────── */
  if (summary) {
    const best = ordered[ordered.length - 1];

    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-black/92 p-6 backdrop-blur-sm">
        <div className="text-center">
          <p className="eyebrow">{packName}</p>
          <h2 className="text-2xl uppercase">ได้การ์ด {ordered.length} ใบ</h2>
          <p
            className="mt-1 font-mono text-sm"
            style={{ color: RARITY_FX[best.player.rarity].color }}
          >
            ดีที่สุด: {best.player.name} · OVR {best.player.ovr}
          </p>
        </div>

        <div className="flex max-h-[55vh] flex-wrap items-start justify-center gap-4 overflow-y-auto">
          {ordered.map(({ card, player }) => (
            <div key={card.id} className="text-center">
              <PlayerCard player={player} size="md" />
              <p
                className="mt-1 font-mono text-[9px] uppercase tracking-wider"
                style={{ color: RARITY_FX[player.rarity].color }}
              >
                {RARITY_FX[player.rarity].label}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            playSfx('coin');
            onClose();
          }}
          className="rounded-lg bg-neon px-8 py-3 text-sm font-bold uppercase tracking-wider text-ink-900 hover:bg-neon-dim"
        >
          เก็บเข้าคลัง
        </button>
      </div>
    );
  }

  /* ── หน้าจอเผยการ์ดทีละใบ ─────────────────────────────────── */
  const tone = { color: fx.color, accent: fx.accent, intensity: fx.intensity };
  const showPack = phase === 'pack' || phase === 'tear';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="แตะเพื่อดูการ์ดใบถัดไป"
      onClick={advance}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') advance();
      }}
      className={cn(
        'fixed inset-0 z-[60] flex select-none flex-col items-center justify-center overflow-hidden bg-black',
        phase === 'card' && layers.shake && 'animate-screen-shake',
      )}
    >
      {/* แสงพื้นหลังที่เข้มขึ้นตามระดับการ์ด */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: showPack ? 0.5 : 1,
          background: `radial-gradient(circle at 50% 52%, ${alpha(fx.color, 0.32 * fx.intensity)} 0%, ${alpha(fx.color, 0.1 * fx.intensity)} 35%, transparent 68%)`,
        }}
      />

      {/* ── เลเยอร์ฉากหลัง (เปิดตามระดับการ์ด) ── */}
      {/* ออโรราของ mythical อยู่หลังสุด เพื่อไม่ให้กลบเลเยอร์อื่น */}
      {phase !== 'pack' && layers.aurora && <MythicAurora {...tone} />}
      {phase === 'card' && layers.floodlights && <StadiumLights {...tone} />}
      {phase !== 'pack' && layers.rays && <LightRays {...tone} fast={fx.intensity > 0.75} />}
      {phase === 'card' && layers.beams && <LightBeams {...tone} />}
      {phase === 'card' && layers.podium && <StagePodium {...tone} />}
      {phase === 'card' && layers.confetti && <Confetti {...tone} />}

      {/* ── จังหวะซองแตก ── */}
      {phase === 'burst' && (
        <>
          <div
            key={`flash-${index}`}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 animate-burst-flash rounded-full"
            style={{
              background: `radial-gradient(circle, #FFFFFF 0%, ${alpha(fx.color, 0.9)} 28%, ${alpha(fx.color, 0)} 70%)`,
            }}
          />
          {layers.shockwave && <Shockwave key={`wave-${index}`} {...tone} />}
          {layers.sparks && (
            <SparkBurst key={`spark-${index}`} {...tone} count={fx.sparkCount} />
          )}
        </>
      )}

      {/* ── ช่วงซอง: ลอยนิ่งแล้วเริ่มสั่น ── */}
      {showPack && (
        <div className="relative flex flex-col items-center gap-8">
          <PackShell {...tone} tearing={phase === 'tear'} />
          <p className="font-display text-lg uppercase tracking-[0.3em] text-chalk/70">
            {phase === 'tear' ? fx.teaser : 'กำลังเปิดซอง'}
          </p>
        </div>
      )}

      {/* ── ช่วงเผย: การ์ดโผล่ขึ้นจากเงามืด ── */}
      {phase === 'card' && entry && (
        <div className="relative flex flex-col items-center">
          <CardAura {...tone} />

          <p
            key={`label-${index}`}
            className="relative animate-rise-in font-display text-3xl uppercase tracking-[0.25em] drop-shadow-[0_0_18px_rgba(0,0,0,0.9)]"
            style={{ color: fx.color, animationDelay: '350ms', opacity: 0 }}
          >
            {fx.label}
          </p>

          <div
            key={`card-${index}`}
            className="relative my-4 animate-walkout-in"
            style={{ filter: `drop-shadow(0 0 34px ${alpha(fx.color, 0.65)})` }}
          >
            <PlayerCard player={entry.player} size="lg" />
          </div>

          <div
            key={`info-${index}`}
            className="relative animate-rise-in text-center"
            style={{ animationDelay: '520ms', opacity: 0 }}
          >
            <p className="font-display text-2xl">{entry.player.name}</p>
            <p className="mt-1 font-mono text-xs text-chalk/60">
              {entry.player.position} · OVR {entry.player.ovr} · {entry.player.club} ·{' '}
              {nationCode(entry.player.nation)}
            </p>
            <p className="mt-2 text-sm font-bold" style={{ color: fx.color }}>
              {fx.verdict}
            </p>
          </div>
        </div>
      )}

      {/* ประกายลอยรอบการ์ด วางไว้นอกกล่องเนื้อหาเพื่อให้ลอยทั่วจอ */}
      {phase === 'card' && fx.emberCount > 0 && <EmberField {...tone} count={fx.emberCount} />}

      {/* ตัวนับใบและปุ่มลัด */}
      <p className="absolute top-6 font-mono text-xs uppercase tracking-[0.2em] text-chalk/45">
        {packName} · {index + 1} / {ordered.length}
      </p>

      {phase === 'card' && (
        <p className="absolute bottom-16 animate-pulse font-mono text-[11px] uppercase tracking-[0.2em] text-chalk/50">
          {isLast ? 'แตะเพื่อดูสรุป' : 'แตะเพื่อดูใบถัดไป'}
        </p>
      )}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          stopCharge.current?.();
          setSummary(true);
          playSfx('summary');
        }}
        className="absolute bottom-6 right-6 rounded-lg border border-white/15 bg-black/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-chalk/60 backdrop-blur hover:border-white/40 hover:text-chalk"
      >
        ข้ามทั้งหมด
      </button>
    </div>
  );
};
