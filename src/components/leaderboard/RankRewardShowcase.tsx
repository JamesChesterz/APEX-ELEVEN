/**
 * แถวการ์ดรางวัลของอันดับ 1–10 — อยู่บนสุดของหน้า Leaderboard
 *
 * การจัดวาง: อันดับ 1 อยู่ตรงกลาง แล้วไล่ออกซ้าย-ขวาสลับกันไปจนถึงอันดับ 10
 * (ลำดับจริงอยู่ที่ SHOWCASE_ORDER ใน services/rankRewards.ts)
 * ใบของอันดับ 1 ตัวใหญ่สุดและมีแสงทอง เพื่อให้เห็นชัดว่าเป็นรางวัลสูงสุด
 *
 * จอแคบเลื่อนแนวนอนได้ และถูกเลื่อนมาให้ใบอันดับ 1 อยู่กลางจอตั้งแต่เปิดหน้า
 */
import { useEffect, useRef, useState } from 'react';
import { PlayerCard, type PlayerCardSize } from '@/components/player/PlayerCard';
import { RankRewardPicker } from '@/components/leaderboard/RankRewardPicker';
import { CONSOLATION_CARD_COUNT } from '@/data/rankRewards';
import { useRankRewards } from '@/hooks/useRankRewards';
import { getRewardPlayer, SHOWCASE_ORDER } from '@/services/rankRewards';
import { playSfx } from '@/services/sound';
import { cn } from '@/utils/helpers';

interface RankRewardShowcaseProps {
  /** อันดับปัจจุบันของผู้เล่น ใช้ไฮไลต์ใบที่กำลังจะได้ (0 = ยังไม่มีอันดับ) */
  myRank: number;
}

/** เหรียญของสามอันดับแรก */
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** ขนาดการ์ดตามอันดับ — ยิ่งอันดับสูงยิ่งใหญ่ */
const sizeForRank = (rank: number): PlayerCardSize => {
  if (rank === 1) return 'md';
  if (rank <= 3) return 'sm';
  return 'xs';
};

export const RankRewardShowcase = ({ myRank }: RankRewardShowcaseProps) => {
  const { cards, isOwner } = useRankRewards();
  const [editing, setEditing] = useState(false);

  /** ใบอันดับ 1 — ใช้เลื่อนแถวให้มาอยู่กลางจอตอนเปิดหน้า */
  const scroller = useRef<HTMLDivElement>(null);
  const champion = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = scroller.current;
    const target = champion.current;
    if (!row || !target) return;

    row.scrollLeft = target.offsetLeft - row.clientWidth / 2 + target.clientWidth / 2;
  }, [cards]);

  return (
    <section className="panel overflow-hidden p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">รางวัลปลายซีซัน</p>
          <p className="mt-1 text-xs text-chalk/45">
            จบซีซันที่อันดับ 1–10 รับการ์ดใบที่กำหนดไว้ของอันดับนั้นทันที
          </p>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setEditing(true);
            }}
            className="rounded-lg border border-gold/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gold transition-colors hover:bg-gold/10"
          >
            ตั้งค่ารางวัล
          </button>
        )}
      </div>

      {/* แถวการ์ด: อันดับ 1 ตรงกลาง ซ้าย-ขวาเป็นอันดับ 2–10 */}
      <div
        ref={scroller}
        className="-mx-1 mt-4 flex items-end justify-start gap-2 overflow-x-auto px-1 pb-2 lg:justify-center"
      >
        {SHOWCASE_ORDER.map((rank) => {
          const player = getRewardPlayer(rank, cards);
          const isChampion = rank === 1;
          const isMine = myRank === rank;

          return (
            <div
              key={rank}
              ref={isChampion ? champion : undefined}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-1.5 py-2 transition-colors',
                isChampion && 'bg-gradient-to-b from-gold/20 to-transparent',
                isMine && 'ring-1 ring-neon/60',
              )}
            >
              {/* ป้ายอันดับ */}
              <span
                className={cn(
                  'whitespace-nowrap rounded-full px-2 py-0.5 font-display text-[11px] leading-none',
                  isChampion
                    ? 'bg-gold text-ink-900'
                    : rank <= 3
                      ? 'bg-white/15 text-chalk'
                      : 'bg-white/5 text-chalk/60',
                )}
              >
                {MEDAL[rank] ?? ''} อันดับ {rank}
              </span>

              {player ? (
                <PlayerCard
                  player={player}
                  size={sizeForRank(rank)}
                  className={isChampion ? 'drop-shadow-[0_0_18px_rgba(240,190,90,0.45)]' : undefined}
                />
              ) : (
                <div className="flex h-[86px] w-[62px] items-center justify-center rounded-lg border border-dashed border-white/20 text-[10px] text-chalk/40">
                  ยังไม่ตั้ง
                </div>
              )}

              <span className="max-w-[7rem] truncate font-mono text-[9px] text-chalk/45">
                {player?.name ?? '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* รางวัลของคนที่ไม่ติดอันดับ */}
      <p className="mt-1 rounded-lg border border-white/10 bg-ink-700/50 px-3 py-2 text-center text-xs text-chalk/60">
        อันดับ 11 ลงไป — ได้ <span className="font-bold text-neon">แพ็คสุ่มการ์ด {CONSOLATION_CARD_COUNT} ใบ</span>{' '}
        เท่ากันทุกคน
      </p>

      {isOwner && <RankRewardPicker open={editing} onClose={() => setEditing(false)} />}
    </section>
  );
};
