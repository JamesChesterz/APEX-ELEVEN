/**
 * แลกเปลี่ยนการ์ดตามดีลที่แอดมินสร้างไว้ (แท็บ "แลกด้วยการ์ด" ของหน้า Exchange)
 *
 * ต่างจากแลกด้วยแต้ม: จ่ายด้วยการ์ดที่มีอยู่ในคลังโดยตรง ไม่ใช่แต้ม
 * และรายการดีลมาจากแอดมินล้วน ๆ (หน้า ADMIN → แลกเปลี่ยนการ์ด) ไม่มีหมุนเวียนอัตโนมัติ
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PackRevealOverlay } from '@/components/pack/PackRevealOverlay';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById } from '@/data/players';
import { useCardExchange } from '@/hooks/useCardExchange';
import type { OwnedPlayerCard } from '@/hooks/usePlayers';
import { describeRequirement } from '@/services/exchangeDeals';
import { playSfx } from '@/services/sound';
import type { ExchangeDeal } from '@/types/card';
import { cn } from '@/utils/helpers';

export const CardExchangeSection = () => {
  const { deals, qualifyingCards, redeem, result, error, dismissResult, clearError } =
    useCardExchange();

  /** ดีลที่กำลังเปิดโมดัลอยู่ */
  const [active, setActive] = useState<ExchangeDeal | null>(null);
  /** id การ์ดที่เลือกไว้ในโมดัล */
  const [picked, setPicked] = useState<string[]>([]);

  /*
   * อาร์เรย์นี้ต้องคงตัวระหว่างที่ฉากเผยการ์ดเปิดอยู่ เหมือนหน้าแลกด้วยแต้ม —
   * ไม่งั้น re-render จะสร้างอาร์เรย์ใหม่ทุกครั้งจนฉากเผยไม่ขึ้น
   */
  const revealEntries = useMemo(
    () => (result ? result.cards.map((card, index) => ({ card, player: result.players[index] })) : []),
    [result],
  );

  const openDeal = (deal: ExchangeDeal) => {
    playSfx('click');
    setActive(deal);
    setPicked([]);
  };

  const closeModal = () => {
    setActive(null);
    setPicked([]);
  };

  const togglePick = (card: OwnedPlayerCard, need: number) => {
    playSfx('click');
    setPicked((current) => {
      if (current.includes(card.card.id)) {
        return current.filter((id) => id !== card.card.id);
      }
      if (current.length >= need) return current;
      return [...current, card.card.id];
    });
  };

  const confirm = () => {
    if (!active) return;
    if (redeem(active, picked)) closeModal();
  };

  const activePool = active ? qualifyingCards(active) : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-chalk/50">
        แลกด้วยการ์ดที่มีอยู่ในคลังโดยตรง — เอาการ์ดที่เข้าเงื่อนไขมาแลก ได้การ์ดรางวัลของดีลนั้นกลับไปหนึ่งใบ
        (การ์ดที่อยู่ในสนามตอนนี้ใช้แลกไม่ได้ ต้องถอดออกจากสนามก่อน)
      </p>

      {error && (
        <p className="flex items-center justify-between gap-3 rounded-lg border border-gem/40 bg-gem/10 px-4 py-2 text-sm text-gem">
          {error}
          <button type="button" onClick={clearError} className="text-xs uppercase tracking-wider">
            ปิด
          </button>
        </p>
      )}

      {deals.length === 0 ? (
        <p className="panel py-12 text-center text-sm text-chalk/45">
          ตอนนี้ยังไม่มีดีลแลกเปลี่ยนการ์ด — รอแอดมินเปิดดีลใหม่
        </p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {deals.map((deal) => {
            const rewardPlayers = deal.rewardPlayerIds
              .map((id) => getPlayerById(id))
              .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
            if (rewardPlayers.length === 0) return null;

            const pool = qualifyingCards(deal);
            const ready = pool.length >= deal.requirement.count;

            return (
              <article
                key={deal.id}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border bg-ink-800/60 p-3 transition-colors',
                  ready ? 'border-white/10 hover:border-neon/50' : 'border-white/5 opacity-70',
                )}
              >
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {rewardPlayers.map((player, index) => (
                    <PlayerCard
                      key={`${player.id}-${index}`}
                      player={player}
                      size={rewardPlayers.length > 1 ? 'xs' : 'sm'}
                    />
                  ))}
                </div>
                <p className="w-full truncate text-center text-[11px] font-semibold">
                  {rewardPlayers.map((player) => player.name).join(', ')}
                </p>

                <p className="text-center text-[10px] text-chalk/55">
                  {describeRequirement(deal.requirement)}
                </p>
                {deal.description && (
                  <p className="text-center text-[10px] text-chalk/35">{deal.description}</p>
                )}

                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => openDeal(deal)}
                  className={cn(
                    'mt-auto w-full rounded-lg py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors',
                    ready
                      ? 'bg-neon text-ink-900 hover:brightness-110'
                      : 'cursor-not-allowed bg-white/5 text-chalk/35',
                  )}
                >
                  {ready ? 'แลกเลย' : `มีการ์ดใช้ได้ ${pool.length}/${deal.requirement.count}`}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* ── เลือกการ์ดที่จะใช้แลก ── */}
      <Modal
        open={active !== null}
        title="เลือกการ์ดที่จะใช้แลก"
        subtitle={active ? describeRequirement(active.requirement) : ''}
        onClose={closeModal}
      >
        {active && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-wrap justify-center gap-1">
                {active.rewardPlayerIds.map((id, index) => {
                  const player = getPlayerById(id);
                  return player ? (
                    <PlayerCard
                      key={`${id}-${index}`}
                      player={player}
                      size={active.rewardPlayerIds.length > 1 ? 'sm' : 'md'}
                    />
                  ) : null;
                })}
              </div>
              <div className="text-sm text-chalk/60">
                <p>เลือกแล้ว</p>
                <p className="font-mono text-xl text-neon">
                  {picked.length}/{active.requirement.count}
                </p>
              </div>
            </div>

            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-white/8 bg-ink-900/40 p-2 sm:grid-cols-5">
              {activePool.map((owned) => {
                const isPicked = picked.includes(owned.card.id);
                return (
                  <button
                    key={owned.card.id}
                    type="button"
                    onClick={() => togglePick(owned, active.requirement.count)}
                    disabled={!isPicked && picked.length >= active.requirement.count}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border p-1 transition-colors',
                      isPicked
                        ? 'border-neon bg-neon/10'
                        : 'border-transparent hover:border-white/20 hover:bg-white/5',
                      !isPicked && picked.length >= active.requirement.count && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <PlayerCard player={owned.player} size="xs" />
                    <span className="w-full truncate text-center font-mono text-[9px] text-chalk/50">
                      {owned.player.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-lg border border-white/15 py-2.5 text-xs font-bold uppercase tracking-wider text-chalk/70 hover:text-chalk"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={picked.length !== active.requirement.count}
                onClick={confirm}
                className={cn(
                  'flex-1 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
                  picked.length === active.requirement.count
                    ? 'bg-neon text-ink-900 hover:brightness-110'
                    : 'cursor-not-allowed bg-white/10 text-chalk/40',
                )}
              >
                ยืนยันแลก
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* แลกสำเร็จ → ใช้ฉากเผยการ์ดชุดเดียวกับการเปิดซอง (ได้เสียงและเอฟเฟกต์ครบ) */}
      {result && (
        <PackRevealOverlay
          key={result.at}
          entries={revealEntries}
          packName="แลกด้วยการ์ด"
          onClose={dismissResult}
        />
      )}
    </div>
  );
};
