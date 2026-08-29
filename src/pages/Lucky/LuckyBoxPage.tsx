/**
 * กล่องสุ่มรางวัลแบบตาราง (เมนู Lucky Box — อยู่ใต้เมนู Exchange)
 *
 * ซ้าย = การ์ดใหญ่ของกล่องนี้ + เวลาที่เหลือ · ขวา = ตารางรางวัล
 * ขนาดตาราง (คอลัมน์ × แถว) แอดมินตั้งเองได้ หน้านี้จึงวาดตามค่าที่ตั้งไว้ล้วน
 * แต่ละช่องใส่รูปเองได้ (.png .webp .gif) — ไม่ใส่ก็ใช้ไอคอนตามประเภทรางวัลเหมือนเดิม
 *
 * กดสุ่มแล้วไฟจะวิ่งไล่ไปตามช่องแบบรูเล็ตก่อน แล้วค่อย ๆ ช้าลงจนหยุดที่ช่องที่ได้
 * รางวัลถูกตัดสินไปแล้วตั้งแต่วินาทีที่กด (ที่ useLuckyGrid) — ไฟที่วิ่งเป็นแค่การนำเสนอ
 * ระหว่างที่ยังหมุน ผลจะถูกกั้นไว้ไม่ให้เด้งขึ้นมาสปอยล์
 *
 * ⚠️ หน้านี้ต้องพอดีจอเสมอ ห้ามมีแถบเลื่อน
 * ตารางจึงไม่ได้ใช้ขนาดช่องตายตัว แต่ "วัดพื้นที่ว่างจริง" ด้วย ResizeObserver
 * แล้วคำนวณขนาดช่องจากด้านที่คับกว่า (กว้างหรือสูง) — ตารางใหญ่แค่ไหน
 * หรือจอเตี้ยแค่ไหนก็ยังอยู่ในจอ ไม่ต้องเลื่อนดู
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PackRevealOverlay } from '@/components/pack/PackRevealOverlay';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById } from '@/data/players';
import { useLuckyGrid } from '@/hooks/useLuckyGrid';
import {
  buildSpinPath,
  cellPosition,
  describeReward,
  fitGrid,
  grandSpan,
  grandStart,
  rewardIcon,
  rewardImage,
  spinOrder,
  spinStepDelay,
} from '@/services/luckyGrid';
import { isSafeLuckyImage } from '@/services/luckyImage';
import { shouldAnimate } from '@/services/motion';
import { formatRemaining } from '@/services/pointsExchange';
import { playSfx } from '@/services/sound';
import type { LuckyReward } from '@/types/lucky';
import { cn, formatNumber } from '@/utils/helpers';

/** ตัวเลขก้อนใหญ่อ่านยาก ย่อเป็น 15M / 350K ให้พอดีช่องเล็ก ๆ */
const shortAmount = (value: number): string => {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  return formatNumber(value);
};

/**
 * วัดขนาดจริงของกล่องหนึ่งใบ (ไม่ใช่ขนาดจอ) แล้วอัปเดตเมื่อขนาดเปลี่ยน
 * ใช้ ResizeObserver เพราะพื้นที่ว่างเปลี่ยนได้จากหลายทาง — ย่อหน้าต่าง หมุนจอ
 * แถบแจ้งเตือนโผล่/หาย หรือแป้นพิมพ์มือถือดันขึ้นมา
 */
const useBoxSize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    measure();

    // jsdom (และเบราว์เซอร์เก่ามาก) ไม่มี ResizeObserver — ถอยไปฟัง resize ของหน้าต่างแทน
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
};

export const LuckyBoxPage = () => {
  const {
    config,
    coins,
    grandIndex,
    open,
    closed,
    secondsLeft,
    opened,
    draws,
    cost,
    remaining,
    complete,
    affordable,
    result,
    error,
    draw,
    dismissResult,
    clearError,
  } = useLuckyGrid();

  const grandPlayer = getPlayerById(config.grandPlayerId);
  const cover = isSafeLuckyImage(config.coverImage) ? config.coverImage : null;

  /* พื้นที่ว่างที่เหลือให้ตารางจริง ๆ หลังหักหัวข้อ แผงซ้าย และแถบปุ่มล่างไปแล้ว */
  const { ref: areaRef, width, height } = useBoxSize();

  /**
   * ขนาดช่อง + ระยะห่างที่ทำให้ตารางเต็มกรอบพอดี
   * ไม่มีเพดานขนาดช่อง — กี่แถวกี่คอลัมน์ก็ขยายจนชนขอบกรอบเสมอ
   */
  const { cell, gap } = useMemo(
    () => fitGrid(width, height, config.columns, config.rows),
    [config.columns, config.rows, height, width],
  );

  /** ช่องเล็กจนใส่ตัวเลขไม่ลงแล้ว — โชว์แค่ไอคอน ที่เหลือดูจากการกดค้าง/ชี้เมาส์ */
  const tight = cell < 46;

  /* ── วงวิ่งแบบรูเล็ต ── */

  /** ช่องที่ไฟกำลังส่องอยู่ตอนนี้ (null = ไม่ได้หมุน) */
  const [cursor, setCursor] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  /** at ของผลที่หมุนจบแล้ว — ผลที่ยังไม่ถึงคิวนี้จะถูกกั้นไม่ให้เด้งขึ้นมา */
  const [revealedAt, setRevealedAt] = useState<string | null>(null);

  const order = useMemo(() => spinOrder(config), [config]);

  useEffect(() => {
    if (!result) {
      setCursor(null);
      return undefined;
    }
    // ผลนี้หมุนจบไปแล้ว (เช่น re-render ระหว่างเปิดหน้าต่างรางวัล) ไม่ต้องหมุนซ้ำ
    if (result.at === revealedAt) return undefined;

    /*
     * ข้ามวงวิ่งเมื่อผู้เล่นเลือก "ปิดเอฟเฟกต์" หรือเครื่องตั้งลดการเคลื่อนไหวไว้
     * (เปลี่ยนได้เองที่หน้า SETTINGS → เอฟเฟกต์วงวิ่งรูเล็ต)
     */
    if (!shouldAnimate()) {
      setRevealedAt(result.at);
      playSfx(result.index === grandIndex ? 'rankUp' : 'coin');
      return undefined;
    }

    const path = buildSpinPath(order, result.index);
    const timers: number[] = [];
    let elapsed = 0;

    path.forEach((index, step) => {
      elapsed += spinStepDelay(step, path.length);
      timers.push(
        window.setTimeout(() => {
          setCursor(index);

          if (step < path.length - 1) {
            playSfx('click');
            return;
          }

          // ก้าวสุดท้าย = ช่องที่ได้จริง ปลดล็อกให้ผลเด้งขึ้นมาได้
          setSpinning(false);
          setRevealedAt(result.at);
          playSfx(index === grandIndex ? 'rankUp' : 'coin');
        }, elapsed),
      );
    });

    setSpinning(true);

    // ออกจากหน้าไปกลางคัน = เก็บกวาดตัวตั้งเวลาทิ้งให้หมด ไม่ให้ setState หลัง unmount
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [grandIndex, order, result, revealedAt]);

  /** ผลพร้อมเผยแล้วหรือยัง — ระหว่างไฟยังวิ่งอยู่ต้องกั้นไว้ก่อน */
  const revealReady = result !== null && revealedAt === result.at;

  /**
   * ช่องนี้ควรแสดงว่า "เก็บไปแล้ว" หรือยัง
   * รางวัลถูกบันทึกลงคลังตั้งแต่วินาทีที่กด ช่องที่ถูกรางวัลจึงกลายเป็นเก็บแล้วทันที
   * ถ้าโชว์ตามนั้นเลย ผู้เล่นจะเห็นเครื่องหมายถูกโผล่ตั้งแต่ไฟยังวิ่งไม่ถึง = สปอยล์
   * ระหว่างหมุนจึงกลั้นช่องเป้าหมายไว้ก่อน แล้วค่อยเปิดพร้อมกันตอนไฟหยุด
   */
  const looksTaken = (index: number) =>
    opened.has(index) && !(spinning && result?.index === index);

  /*
   * อาร์เรย์นี้ต้องคงตัวระหว่างที่ฉากเผยการ์ดเปิดอยู่ — หน้านี้มีนาฬิกาเดินทุกวินาที
   * ถ้าสร้างใหม่ทุกครั้งที่วาดจอ ฉากเผยจะถูกรีเซ็ตจนการ์ดไม่มีวันโผล่
   */
  const revealEntries = useMemo(
    () => (result?.card && result.player ? [{ card: result.card, player: result.player }] : []),
    [result],
  );

  if (!config.enabled) {
    return (
      <div className="glass-panel mx-auto max-w-md p-8 text-center">
        <p className="font-display text-2xl uppercase">ยังไม่เปิด</p>
        <p className="mt-2 text-sm text-chalk/50">กล่องสุ่มรางวัลยังไม่เปิดให้เล่นตอนนี้</p>
      </div>
    );
  }

  /*
   * เก็บครบทุกช่อง = จบรอบ กดสุ่มต่อไม่ได้จนกว่าแอดมินจะเปิดกล่องรอบใหม่
   * (ถ้ารีเซ็ตเองอัตโนมัติ ผู้เล่นจะวนเก็บรางวัลชุดเดิมซ้ำได้ไม่จำกัด)
   */
  const canDraw = open && affordable && !spinning && !complete;

  return (
    /* h-full + min-h-0 ทุกชั้น = ความสูงถูกส่งต่อลงไปถึงตาราง โดยไม่มีชั้นไหนดันจนเกิดแถบเลื่อน */
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* ── หัวข้อ + ยอดเหรียญ (บีบให้เตี้ยที่สุดเท่าที่ยังอ่านออก) ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="truncate text-base leading-tight sm:text-lg">{config.title}</h2>
          <p className="text-[11px] text-chalk/50">
            รางวัลแต่ละช่องได้ครั้งเดียว · เหลืออีก {remaining} ช่อง
          </p>
        </div>

        <div className="flex items-center gap-2">
          {secondsLeft !== null && (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-800/60 px-2.5 py-1">
              <span className="eyebrow">ปิดใน</span>
              <span className="font-mono text-sm tabular-nums text-neon">
                {formatRemaining(secondsLeft)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1">
            <span className="eyebrow">เหรียญ</span>
            <span className="font-display text-lg leading-none text-gold">{formatNumber(coins)}</span>
          </div>
        </div>
      </div>

      {error && (
        <p className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-gem/40 bg-gem/10 px-3 py-1.5 text-xs text-gem">
          {error}
          <button type="button" onClick={clearError} className="text-[10px] uppercase tracking-wider">
            ปิด
          </button>
        </p>
      )}

      {closed && (
        <p className="shrink-0 rounded-lg border border-[#F0A070]/30 bg-[#F0A070]/10 px-3 py-1.5 text-xs text-[#F0A070]">
          กล่องใบนี้หมดเวลาแล้ว — รอทีมงานเปิดกล่องใบใหม่
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3">
        {/* ── รางวัลใหญ่ของกล่องนี้ ── */}
        {/* มือถือ: แถบเตี้ย ๆ แนวนอน เพื่อไม่ให้กินความสูงของตาราง · จอกว้าง: แผงข้างเต็ม */}
        <section className="glass-panel flex shrink-0 items-center gap-3 p-2.5 lg:w-[196px] lg:flex-col lg:p-4">
          <div className="w-16 shrink-0 lg:w-full">
            {cover ? (
              <img
                src={cover}
                alt={config.title}
                className="mx-auto max-h-20 w-full object-contain lg:max-h-40"
              />
            ) : grandPlayer ? (
              <PlayerCard player={grandPlayer} size="sm" style={{ width: '100%' }} />
            ) : (
              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-white/15 text-[10px] text-chalk/40">
                ยังไม่ตั้งรางวัล
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 lg:w-full lg:flex-none lg:text-center">
            <p className="eyebrow">รางวัลใหญ่</p>
            <p className="truncate font-display text-lg uppercase leading-tight lg:text-xl">
              {grandPlayer?.name ?? '—'}
            </p>
            {grandPlayer && (
              <p className="font-mono text-[10px] text-chalk/45">
                {grandPlayer.position} · OVR {grandPlayer.ovr}
              </p>
            )}
          </div>

          {/* ตัวเลขสรุป: มือถือย่อเหลือบรรทัดเดียวชิดขวา · จอกว้างกางเป็นตาราง */}
          <div className="shrink-0 text-right font-mono text-[10px] text-chalk/50 lg:mt-auto lg:w-full lg:space-y-1 lg:border-t lg:border-white/10 lg:pt-2 lg:text-left">
            <p className="lg:flex lg:justify-between">
              <span className="hidden lg:inline text-chalk/50">สุ่มไปแล้ว</span>
              <span>{draws} ครั้ง</span>
            </p>
            <p className="lg:flex lg:justify-between">
              <span className="hidden lg:inline text-chalk/50">ราคาครั้งถัดไป</span>
              <span className="text-gold">{formatNumber(cost)}</span>
            </p>
          </div>
        </section>

        {/* ── ตารางรางวัล ── */}
        <section className="glass-panel flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2 sm:p-3">
          {/* กล่องที่ถูกวัด — ตารางข้างในถูกบีบให้ไม่เกินขนาดนี้เสมอ */}
          <div ref={areaRef} className="flex min-h-0 flex-1 items-center justify-center">
            <div
              className="grid"
              style={{
                gap,
                gridTemplateColumns: `repeat(${config.columns}, ${cell}px)`,
                gridTemplateRows: `repeat(${config.rows}, ${cell}px)`,
              }}
            >
              {/* การ์ดใหญ่กลางตาราง — กินกี่ช่องขึ้นกับว่าด้านนั้นเป็นเลขคู่หรือคี่ */}
              <article
                style={{
                  gridColumn: `${grandStart(config.columns)} / span ${grandSpan(config.columns)}`,
                  gridRow: `${grandStart(config.rows)} / span ${grandSpan(config.rows)}`,
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border p-0.5 transition-transform duration-100',
                  looksTaken(grandIndex)
                    ? 'border-white/10 bg-ink-900/70 opacity-45'
                    : 'border-gold/60 bg-gradient-to-b from-gold/25 to-gold/5 shadow-card',
                  // ไฟรูเล็ตกำลังส่องช่องนี้อยู่
                  cursor === grandIndex && 'z-10 scale-105 !border-neon !opacity-100 ring-2 ring-neon',
                )}
              >
                {cover ? (
                  <img src={cover} alt={config.title} className="max-h-full w-[84%] object-contain" />
                ) : grandPlayer ? (
                  <PlayerCard player={grandPlayer} size="xs" style={{ width: '84%' }} />
                ) : (
                  <span className="text-[10px] text-chalk/40">—</span>
                )}
                {!tight && (
                  <span className="font-mono text-[8px] uppercase tracking-wider text-gold">
                    {looksTaken(grandIndex) ? 'ได้แล้ว' : 'MYTHICAL'}
                  </span>
                )}
              </article>

              {/* ช่องรางวัลปกติที่เหลือทั้งหมด */}
              {config.cells.map((reward, index) => {
                const { row, column } = cellPosition(index, config);
                const taken = looksTaken(index);

                return (
                  <article
                    key={index}
                    style={{ gridColumn: column, gridRow: row }}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border p-0.5 text-center transition-transform duration-100',
                      taken ? 'border-white/5 bg-ink-900/70 opacity-40' : 'border-white/10 bg-ink-800/70',
                      // ช่องที่เพิ่งเปิดได้ในครั้งล่าสุด — เน้นให้เห็นว่าได้อันไหน (หลังไฟหยุดแล้ว)
                      revealReady && result?.index === index && 'ring-2 ring-neon',
                      // ไฟรูเล็ตกำลังส่องช่องนี้อยู่ — สว่างทับสถานะ "เปิดไปแล้ว" ให้เห็นชัด
                      cursor === index && 'z-10 scale-110 !border-neon bg-neon/20 !opacity-100 ring-2 ring-neon',
                    )}
                    title={describeReward(reward)}
                  >
                    <CellFace reward={reward} cell={cell} tight={tight} />
                    {taken && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-neon"
                        style={{ fontSize: Math.min(56, Math.max(12, cell * 0.4)) }}
                      >
                        ✓
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          </div>

          {/* ── แถบข้อมูล + ปุ่มสุ่ม ── */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2">
            {spinning ? (
              <p className="animate-pulse text-[11px] font-bold uppercase tracking-wider text-neon">
                กำลังสุ่ม…
              </p>
            ) : complete ? (
              <p className="text-[11px] font-bold text-neon">
                🏆 เก็บรางวัลครบทุกช่องแล้ว — รอทีมงานเปิดกล่องรอบใหม่
              </p>
            ) : (
              <p className="text-[11px] text-chalk/55">
                ⓘ รางวัลแต่ละช่องรับได้ครั้งเดียว · เก็บครบแล้วจบรอบ ต้องรอกล่องใหม่
              </p>
            )}

            <button
              type="button"
              disabled={!canDraw}
              onClick={() => {
                playSfx('click');
                draw();
              }}
              className={cn(
                'ml-auto rounded-full px-5 py-2 font-display text-base tracking-wide transition-colors',
                canDraw
                  ? 'bg-gold text-ink-900 hover:brightness-110'
                  : 'cursor-not-allowed bg-white/10 text-chalk/40',
              )}
            >
              {spinning ? 'กำลังสุ่ม…' : complete ? 'ครบแล้ว' : `🪙 ${formatNumber(cost)}`}
            </button>
          </div>
        </section>
      </div>

      {/* ── รางวัลที่ไม่ใช่การ์ด: โชว์เป็นหน้าต่างสรุปสั้น ๆ ── */}
      <Modal
        open={revealReady && !result?.card}
        title="ได้รางวัลแล้ว!"
        subtitle={`จ่ายไป ${formatNumber(result?.cost ?? 0)} เหรียญ`}
        onClose={dismissResult}
      >
        {result && (
          <div className="flex flex-col items-center gap-4 py-4">
            {isSafeLuckyImage(rewardImage(result.reward)) ? (
              <img
                src={rewardImage(result.reward) ?? undefined}
                alt={describeReward(result.reward)}
                className="max-h-40 object-contain"
              />
            ) : (
              <span className="text-6xl">{rewardIcon(result.reward)}</span>
            )}
            <p className="font-display text-3xl uppercase text-neon">
              {describeReward(result.reward)}
            </p>
            <button
              type="button"
              onClick={dismissResult}
              className="rounded-lg bg-neon px-8 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 hover:bg-neon-dim"
            >
              รับเลย
            </button>
          </div>
        )}
      </Modal>

      {/* รางวัลเป็นการ์ด → ใช้ฉากเผยการ์ดชุดเดียวกับการเปิดซอง (ได้เสียงและเอฟเฟกต์ครบ) */}
      {revealReady && result?.card && (
        <PackRevealOverlay
          key={result.at}
          entries={revealEntries}
          packName={config.title}
          onClose={dismissResult}
        />
      )}
    </div>
  );
};

/**
 * หน้าตาของรางวัลหนึ่งช่อง
 * มีรูปที่แอดมินใส่ไว้ → ใช้รูปนั้น · เป็นการ์ด → โชว์รูปการ์ด · ที่เหลือ → ไอคอน + จำนวน
 * ขนาดตัวอักษรผูกกับขนาดช่องจริง เพื่อให้ตารางใหญ่ ๆ ที่ช่องหดยังดูออกว่าเป็นอะไร
 */
const CellFace = ({
  reward,
  cell,
  tight,
}: {
  reward: LuckyReward;
  cell: number;
  tight: boolean;
}) => {
  // ผูกกับขนาดช่องจริง แต่มีเพดานกันตัวเลขบวมจนกลบรูปรางวัลตอนช่องใหญ่มาก
  const amountStyle = { fontSize: Math.min(22, Math.max(7, Math.round(cell * 0.16))) };

  // รูปที่แอดมินใส่เอง > รูปตั้งต้นตามประเภท > อีโมจิ
  const image = rewardImage(reward);

  if (isSafeLuckyImage(image)) {
    return (
      <>
        <img
          src={image}
          alt={describeReward(reward)}
          loading="lazy"
          className={cn('w-[78%] object-contain', tight ? 'max-h-[86%]' : 'max-h-[68%]')}
        />
        {!tight && reward.type !== 'card' && (
          <span className="font-mono font-bold text-chalk/75" style={amountStyle}>
            x{shortAmount(reward.amount ?? 0)}
          </span>
        )}
      </>
    );
  }

  if (reward.type === 'card') {
    const player = getPlayerById(reward.playerId ?? '');
    if (!player) return <span className="text-[10px] text-chalk/35">—</span>;
    return (
      <>
        <PlayerCard player={player} size="xs" style={{ width: tight ? '92%' : '78%' }} />
        {!tight && (
          <span className="w-full truncate font-mono text-chalk/50" style={amountStyle}>
            {player.name}
          </span>
        )}
      </>
    );
  }

  return (
    <>
      <span
        className="leading-none"
        style={{ fontSize: Math.min(56, Math.max(11, Math.round(cell * 0.34))) }}
      >
        {rewardIcon(reward)}
      </span>
      {!tight && (
        <span className="font-mono font-bold text-chalk/75" style={amountStyle}>
          x{shortAmount(reward.amount ?? 0)}
        </span>
      )}
    </>
  );
};
