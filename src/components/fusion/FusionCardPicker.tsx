/**
 * หน้าต่างเลือกการ์ดของหน้าผสม
 *
 * ต่างจากตัวเลือกการ์ดของหน้าอัปเกรดตรงที่กติกา "ระดับต้องตรงกัน" ทำให้พอเลือกใบแรกแล้ว
 * ใบระดับอื่นจะจางลงทันที ผู้เล่นจึงเห็นตั้งแต่แรกว่าเหลือใบไหนให้เลือกจริง ๆ บ้าง
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getCardUpgrade } from '@/services/cardInstance';
import { FUSION_BLOCK_TEXT, type FusionBlockReason } from '@/services/fusion';
import { getEffectivePlayer, getEffectivePlayerOvr } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { Rarity } from '@/types/player';
import { cn, RARITY_STYLE } from '@/utils/helpers';

interface FusionCardPickerProps {
  open: boolean;
  /** การ์ดทั้งคลัง */
  cards: PlayerCardData[];
  /** id ที่หย่อนลงช่องไปแล้ว */
  pickedIds: string[];
  /** ระดับที่ล็อกไว้แล้ว — null = ยังเลือกได้ทุกระดับ */
  rarity: Rarity | null;
  /** เหลือช่องว่างอีกกี่ใบ */
  remaining: number;
  blockReasonOf: (card: PlayerCardData) => FusionBlockReason | null;
  onToggle: (cardId: string) => void;
  onClose: () => void;
}

export const FusionCardPicker = ({
  open,
  cards,
  pickedIds,
  rarity,
  remaining,
  blockReasonOf,
  onToggle,
  onClose,
}: FusionCardPickerProps) => {
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return cards
      .map((card) => ({ card, player: getEffectivePlayer(card) }))
      .filter(({ player }) => {
        if (!player) return false;
        return !keyword || player.name.toLowerCase().includes(keyword);
      })
      .sort((left, right) => getEffectivePlayerOvr(right.card) - getEffectivePlayerOvr(left.card));
  }, [cards, search]);

  const handle = (card: PlayerCardData, blocked: FusionBlockReason | null) => {
    if (blocked && !pickedIds.includes(card.id)) {
      playSfx('error');
      return;
    }
    onToggle(card.id);
  };

  return (
    <Modal
      open={open}
      title="เลือกการ์ดที่จะผสม"
      subtitle={
        rarity
          ? `ล็อกระดับ ${RARITY_STYLE[rarity].label} แล้ว · เลือกได้อีก ${remaining} ใบ`
          : `ใบแรกที่เลือกจะเป็นตัวล็อกระดับ · เลือกได้อีก ${remaining} ใบ`
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาชื่อนักเตะ"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50"
        />

        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-chalk/45">ไม่มีการ์ดที่ตรงเงื่อนไข</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {list.map(({ card, player }) => {
              if (!player) return null;

              const picked = pickedIds.includes(card.id);
              const blocked = picked ? null : blockReasonOf(card);
              const plus = getCardUpgrade(card);

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handle(card, blocked)}
                  disabled={Boolean(blocked)}
                  title={
                    blocked
                      ? FUSION_BLOCK_TEXT[blocked]
                      : `${player.name} · OVR ${getEffectivePlayerOvr(card)} · +${plus}`
                  }
                  className={cn(
                    'relative flex flex-col items-center rounded-lg border p-1 transition-colors',
                    picked
                      ? 'border-neon bg-neon/10'
                      : 'border-transparent hover:border-white/20 hover:bg-white/5',
                    blocked && 'cursor-not-allowed opacity-25',
                  )}
                >
                  <PlayerCard player={player} size="sm" level={card.level} />
                  <span className="mt-1 w-full truncate text-center text-[10px] text-chalk/60">
                    {player.name}
                  </span>
                  <span className={cn('text-[9px] uppercase', RARITY_STYLE[player.rarity].text)}>
                    {RARITY_STYLE[player.rarity].label}
                  </span>
                  {picked && (
                    <span className="absolute right-1 top-1 rounded bg-neon px-1 text-[10px] font-bold text-ink-900">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
