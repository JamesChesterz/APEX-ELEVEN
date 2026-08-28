/**
 * กล่องสุ่มรางวัลแบบตาราง 8×8 (เมนู Lucky Box — อยู่ใต้เมนู Exchange)
 *
 * ซ้าย = การ์ดใหญ่ของกล่องนี้ + เวลาที่เหลือ · ขวา = ตาราง 64 ช่อง
 * กลางตารางเป็นการ์ด MYTHICAL ใบเดียวที่กิน 2×2 ช่อง (ตาราง 8 ช่องไม่มีช่องกลางเดี่ยว)
 *
 * ช่องที่เปิดแล้วจะจางลงและติดเครื่องหมายถูก — รางวัลแต่ละช่องได้ครั้งเดียวต่อรอบ
 * ราคาสุ่มแพงขึ้นทุกครั้งที่กด (แอดมินตั้งราคาเริ่มต้น/ขั้นบันได/เพดานได้เอง)
 */
import { useMemo } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PackRevealOverlay } from '@/components/pack/PackRevealOverlay';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById } from '@/data/players';
import { useLuckyGrid } from '@/hooks/useLuckyGrid';
import {
  cellPosition,
  describeReward,
  GRAND_INDEX,
  GRAND_START,
  GRID_SIZE,
  rewardIcon,
} from '@/services/luckyGrid';
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

export const LuckyBoxPage = () => {
  const {
    config,
    coins,
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

  return (
    <div className="space-y-4">
      {/* ── หัวข้อ + ยอดเหรียญ ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">{config.title}</h2>
          <p className="text-sm text-chalk/50">
            สุ่มเปิดทีละช่อง · รางวัลแต่ละช่องได้ครั้งเดียว · เหลืออีก {remaining} ช่อง
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {secondsLeft !== null && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-ink-800/60 px-4 py-2">
              <span className="eyebrow">ปิดใน</span>
              <span className="font-mono text-xl tabular-nums text-neon">
                {formatRemaining(secondsLeft)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2">
            <span className="eyebrow">เหรียญ</span>
            <span className="font-display text-2xl text-gold">{formatNumber(coins)}</span>
          </div>
        </div>
      </div>

      {error && (
        <p className="flex items-center justify-between gap-3 rounded-lg border border-gem/40 bg-gem/10 px-4 py-2 text-sm text-gem">
          {error}
          <button type="button" onClick={clearError} className="text-xs uppercase tracking-wider">
            ปิด
          </button>
        </p>
      )}

      {closed && (
        <p className="rounded-lg border border-[#F0A070]/30 bg-[#F0A070]/10 px-4 py-2 text-sm text-[#F0A070]">
          กล่องใบนี้หมดเวลาแล้ว — รอทีมงานเปิดกล่องใบใหม่
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
        {/* ── รางวัลใหญ่ของกล่องนี้ ── */}
        <section className="glass-panel flex flex-col items-center gap-3 p-5">
          <p className="eyebrow">รางวัลใหญ่</p>
          {grandPlayer ? (
            <>
              <PlayerCard player={grandPlayer} size="lg" />
              <p className="text-center font-display text-2xl uppercase">{grandPlayer.name}</p>
              <p className="font-mono text-[11px] text-chalk/45">
                {grandPlayer.position} · OVR {grandPlayer.ovr}
              </p>
            </>
          ) : (
            <div className="flex h-56 w-40 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-chalk/40">
              ยังไม่ตั้งรางวัลใหญ่
            </div>
          )}

          <div className="mt-auto w-full space-y-1 border-t border-white/10 pt-3 text-xs">
            <p className="flex justify-between">
              <span className="text-chalk/50">สุ่มไปแล้ว</span>
              <span className="font-mono">{draws} ครั้ง</span>
            </p>
            <p className="flex justify-between">
              <span className="text-chalk/50">ราคาครั้งถัดไป</span>
              <span className="font-mono text-gold">{formatNumber(cost)}</span>
            </p>
            {config.maxCost > 0 && (
              <p className="flex justify-between">
                <span className="text-chalk/50">เพดานราคา</span>
                <span className="font-mono text-chalk/60">{formatNumber(config.maxCost)}</span>
              </p>
            )}
          </div>
        </section>

        {/* ── ตาราง 8×8 ── */}
        <section className="glass-panel overflow-x-auto p-3 sm:p-4">
          <div
            className="grid min-w-[560px] gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            }}
          >
            {/* การ์ดใหญ่กลางตาราง — กิน 2×2 ช่องพอดี */}
            <article
              style={{
                gridColumn: `${GRAND_START} / span 2`,
                gridRow: `${GRAND_START} / span 2`,
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg border p-1',
                opened.has(GRAND_INDEX)
                  ? 'border-white/10 bg-ink-900/70 opacity-45'
                  : 'border-gold/60 bg-gradient-to-b from-gold/25 to-gold/5 shadow-card',
              )}
            >
              {grandPlayer ? (
                <PlayerCard player={grandPlayer} size="xs" style={{ width: '82%' }} />
              ) : (
                <span className="text-[10px] text-chalk/40">—</span>
              )}
              <span className="font-mono text-[9px] uppercase tracking-wider text-gold">
                {opened.has(GRAND_INDEX) ? 'ได้แล้ว' : 'MYTHICAL'}
              </span>
            </article>

            {/* ช่องรางวัลปกติ 60 ช่อง */}
            {config.cells.map((reward, index) => {
              const { row, column } = cellPosition(index);
              const taken = opened.has(index);

              return (
                <article
                  key={index}
                  style={{ gridColumn: column, gridRow: row }}
                  className={cn(
                    'relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-center transition-colors',
                    taken
                      ? 'border-white/5 bg-ink-900/70 opacity-40'
                      : 'border-white/10 bg-ink-800/70',
                    // ช่องที่เพิ่งเปิดได้ในครั้งล่าสุด — เน้นให้เห็นว่าได้อันไหน
                    result?.index === index && 'ring-2 ring-neon',
                  )}
                  title={describeReward(reward)}
                >
                  <CellFace reward={reward} />
                  {taken && (
                    <span className="absolute inset-0 flex items-center justify-center text-lg text-neon">
                      ✓
                    </span>
                  )}
                </article>
              );
            })}
          </div>

          {/* ── แถบข้อมูล + ปุ่มสุ่ม (ล้อหน้าตาแถบล่างของกล่องสุ่มในเกมมือถือ) ── */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink-900/60 p-3">
            <p className="text-xs text-chalk/55">
              ⓘ รางวัลแต่ละช่องรับได้ครั้งเดียว
              {config.autoReset && ' · เก็บครบแล้วเริ่มรอบใหม่อัตโนมัติ'}
            </p>

            <button
              type="button"
              disabled={!open || (complete && !config.autoReset) || !affordable}
              onClick={() => {
                playSfx('click');
                draw();
              }}
              className={cn(
                'rounded-full px-6 py-2.5 font-display text-lg tracking-wide transition-colors',
                open && affordable && (!complete || config.autoReset)
                  ? 'bg-gold text-ink-900 hover:brightness-110'
                  : 'cursor-not-allowed bg-white/10 text-chalk/40',
              )}
            >
              🪙 {formatNumber(cost)}
            </button>
          </div>
        </section>
      </div>

      {/* ── รางวัลที่ไม่ใช่การ์ด: โชว์เป็นหน้าต่างสรุปสั้น ๆ ── */}
      <Modal
        open={result !== null && !result.card}
        title="ได้รางวัลแล้ว!"
        subtitle={`จ่ายไป ${formatNumber(result?.cost ?? 0)} เหรียญ`}
        onClose={dismissResult}
      >
        {result && (
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="text-6xl">{rewardIcon(result.reward)}</span>
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
      {result?.card && (
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

/** หน้าตาของรางวัลหนึ่งช่อง — การ์ดโชว์รูปการ์ด ที่เหลือโชว์ไอคอน + จำนวน */
const CellFace = ({ reward }: { reward: LuckyReward }) => {
  if (reward.type === 'card') {
    const player = getPlayerById(reward.playerId ?? '');
    if (!player) return <span className="text-[10px] text-chalk/35">—</span>;
    return (
      <>
        <PlayerCard player={player} size="xs" style={{ width: '76%' }} />
        <span className="w-full truncate font-mono text-[8px] text-chalk/50">{player.name}</span>
      </>
    );
  }

  return (
    <>
      <span className="text-xl leading-none sm:text-2xl">{rewardIcon(reward)}</span>
      <span className="font-mono text-[9px] font-bold text-chalk/75 sm:text-[10px]">
        x{shortAmount(reward.amount ?? 0)}
      </span>
    </>
  );
};
