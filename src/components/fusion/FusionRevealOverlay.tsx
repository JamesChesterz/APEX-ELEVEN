/**
 * ฉากลุ้นผลการผสม — การ์ดคว่ำ 5 ใบ เปิดทีละใบ
 *
 * กติกาที่ผู้เล่นต้องเข้าใจตั้งแต่เห็นจอนี้:
 *   ใบแรกที่เปิด = การ์ดที่ได้จริง ใบที่เหลือเปิดดูได้ทีหลังแบบไม่มีผลอะไร
 *
 * ทุกใบสุ่มจากตารางเดียวกันและเป็นอิสระต่อกัน เปิดช่องไหนก่อนโอกาสก็เท่ากัน
 * จึงไม่มีการซ่อน "ใบที่ดีที่สุด" ไว้ให้เดา — ป้ายบนจอบอกตรง ๆ ว่าเลือกช่องไหนก็เหมือนกัน
 */
import { levelForUpgrade } from '@/services/cardInstance';
import type { FusionCandidate } from '@/services/fusion';
import { getEffectivePlayer } from '@/services/playerAttributes';
import { PlayerCard } from '@/components/player/PlayerCard';
import type { FusionOutcome } from '@/hooks/useFusion';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

interface FusionRevealOverlayProps {
  open: boolean;
  candidates: FusionCandidate[];
  openedIndexes: number[];
  outcome: FusionOutcome | null;
  onOpenCandidate: (index: number) => void;
  onRevealRest: () => void;
  onClose: () => void;
}

/** หลังการ์ดตอนยังไม่เปิด */
const CardBack = ({ index, disabled }: { index: number; disabled: boolean }) => (
  <div
    className={cn(
      'relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border-2 transition-transform',
      disabled
        ? 'border-white/10 bg-ink-800'
        : 'border-neon/50 bg-gradient-to-br from-ink-600 to-ink-900 shadow-neon hover:-translate-y-2',
    )}
  >
    <div
      className={cn(
        'absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(49,224,109,0.28),transparent_65%)]',
        !disabled && 'animate-charge-pulse',
      )}
    />
    <span className="font-display text-4xl text-neon/70">?</span>
    <span className="absolute bottom-2 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk/35">
      0{index + 1}
    </span>
  </div>
);

export const FusionRevealOverlay = ({
  open,
  candidates,
  openedIndexes,
  outcome,
  onOpenCandidate,
  onRevealRest,
  onClose,
}: FusionRevealOverlayProps) => {
  if (!open) return null;

  const allOpened = openedIndexes.length === candidates.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-black/90 p-4 backdrop-blur-sm">
      <div className="text-center">
        <h2 className="font-display text-2xl uppercase tracking-wide sm:text-3xl">
          {outcome ? 'ผลการผสม' : 'เลือกเปิดการ์ด'}
        </h2>
        <p className="mt-1 text-xs text-chalk/50">
          {outcome
            ? 'ใบที่เปิดใบแรกเข้าคลังแล้ว · เปิดใบที่เหลือดูได้ ไม่มีผลกับของที่ได้'
            : 'ใบแรกที่เปิดคือการ์ดที่ได้จริง — ทุกช่องโอกาสเท่ากัน'}
        </p>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-3 gap-3 sm:grid-cols-5">
        {candidates.map((candidate, index) => {
          const opened = openedIndexes.includes(index);
          const isPrize = outcome?.index === index;
          const player = getEffectivePlayer({
            playerId: candidate.playerId,
            level: levelForUpgrade(candidate.plus),
          });

          return (
            <button
              key={candidate.id}
              type="button"
              disabled={opened}
              onClick={() => onOpenCandidate(index)}
              className={cn(
                'group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all',
                opened ? 'cursor-default' : 'cursor-pointer',
                isPrize && 'bg-neon/10 ring-2 ring-neon',
                opened && !isPrize && 'opacity-45',
              )}
            >
              {!opened || !player ? (
                <CardBack index={index} disabled={opened} />
              ) : (
                <div className="w-full animate-walkout-in">
                  <PlayerCard
                    player={player}
                    size="md"
                    level={levelForUpgrade(candidate.plus)}
                    className="mx-auto w-full"
                  />
                </div>
              )}

              {opened && player && (
                <div className="animate-rise-in text-center">
                  <p className="truncate text-[11px] font-semibold">{player.name}</p>
                  <p className={cn('text-[10px] uppercase', RARITY_STYLE[player.rarity].text)}>
                    +{candidate.plus} · OVR {player.ovr}
                  </p>
                  {candidate.cash > 0 && (
                    <p className="text-[10px] font-bold text-gold">
                      + {formatNumber(candidate.cash)} ฿
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {outcome && (
        <div className="w-full max-w-md rounded-xl border border-neon/40 bg-ink-800/90 p-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neon">ได้รับแล้ว</p>
          <p className="mt-1 font-display text-xl uppercase">
            {outcome.player.name} <span className="text-neon">+{outcome.plus}</span>
          </p>
          <p className="text-xs text-chalk/55">
            {RARITY_STYLE[outcome.player.rarity].label} · OVR {outcome.player.ovr}
          </p>
          {outcome.cash > 0 && (
            <p className="mt-2 font-display text-lg text-gold">
              โบนัสเงิน {formatNumber(outcome.cash)} ฿
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {outcome && !allOpened && (
          <button
            type="button"
            onClick={onRevealRest}
            className="rounded-lg border border-white/15 px-5 py-2.5 font-display text-sm uppercase tracking-wide text-chalk/70 hover:bg-white/5"
          >
            เปิดใบที่เหลือ
          </button>
        )}
        {outcome && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-neon px-8 py-2.5 font-display text-sm uppercase tracking-wide text-ink-900 hover:brightness-110"
          >
            เสร็จสิ้น
          </button>
        )}
      </div>
    </div>
  );
};
