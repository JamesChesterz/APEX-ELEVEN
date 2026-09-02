/**
 * หน้าต่างเลือกการ์ดของหน้าอัปเกรด — ใช้สองงาน
 *
 *   mode="target"   เลือกนักเตะที่จะอัปเกรด
 *   mode="material" เลือกการ์ดที่จะเผาใส่ช่อง (เลือกได้หลายใบรวดเดียว)
 *
 * แยกออกมาเป็นไฟล์ของตัวเองเพราะหน้าอัปเกรดหลักยาวพอแล้ว
 * และตัวกรอง "ใบไหนใส่ได้" เป็นกติกาก้อนเดียวที่อยากให้อ่านจบในที่เดียว
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getCardUpgrade, isCardLocked } from '@/services/cardInstance';
import { getEffectivePlayer, getEffectivePlayerOvr } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import { cn } from '@/utils/helpers';

interface CardPickerModalProps {
  open: boolean;
  mode: 'target' | 'material';
  /** ทุกใบในคลัง */
  cards: PlayerCardData[];
  /** ใบที่กำลังอัปเกรดอยู่ (โหมด material ใช้กันไม่ให้เผาตัวเอง) */
  targetId?: string | null;
  /** id ที่ถูกใส่ช่องไปแล้ว — เลือกซ้ำไม่ได้ */
  usedIds?: string[];
  /** โหมด material เลือกได้อีกกี่ใบ */
  remaining?: number;
  /** ใบนี้เอามาเผาได้ไหม (กติกา OVR อยู่ที่ผู้เรียก) */
  canUse?: (card: PlayerCardData) => boolean;
  onPick: (cardIds: string[]) => void;
  onClose: () => void;
}

export const CardPickerModal = ({
  open,
  mode,
  cards,
  targetId,
  usedIds = [],
  remaining = 1,
  canUse,
  onPick,
  onClose,
}: CardPickerModalProps) => {
  /** ใบที่ติ๊กไว้ในรอบนี้ (โหมด material เท่านั้น) */
  const [checked, setChecked] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return cards
      .filter((card) => {
        if (mode === 'material' && (card.id === targetId || usedIds.includes(card.id))) return false;
        if (!keyword) return true;

        const player = getEffectivePlayer(card);
        return player ? player.name.toLowerCase().includes(keyword) : false;
      })
      .sort((left, right) => getEffectivePlayerOvr(right) - getEffectivePlayerOvr(left));
  }, [cards, mode, search, targetId, usedIds]);

  const toggle = (card: PlayerCardData) => {
    if (mode === 'target') {
      playSfx('click');
      onPick([card.id]);
      return;
    }

    if (canUse && !canUse(card)) {
      playSfx('error');
      return;
    }

    playSfx('click');
    setChecked((current) =>
      current.includes(card.id)
        ? current.filter((id) => id !== card.id)
        : current.length >= remaining
          ? current
          : [...current, card.id],
    );
  };

  const close = () => {
    setChecked([]);
    setSearch('');
    onClose();
  };

  const confirm = () => {
    if (checked.length === 0) return;
    onPick(checked);
    setChecked([]);
    setSearch('');
  };

  return (
    <Modal
      open={open}
      title={mode === 'target' ? 'เลือกนักเตะที่จะอัปเกรด' : 'เลือกนักเตะในการอัปเกรด'}
      subtitle={
        mode === 'target'
          ? `คลังทั้งหมด ${list.length} ใบ`
          : `เลือกได้อีก ${remaining - checked.length} ใบ · การ์ดที่ใส่จะหายไปทุกกรณี`
      }
      onClose={close}
    >
      <div className="flex flex-col gap-3 overflow-hidden p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาชื่อนักเตะ"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50"
        />

        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-chalk/45">ไม่มีการ์ดที่ตรงเงื่อนไข</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 lg:grid-cols-7">
            {list.map((card) => {
              const player = getEffectivePlayer(card);
              if (!player) return null;

              const blocked = mode === 'material' && canUse ? !canUse(card) : false;
              const picked = checked.includes(card.id);

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggle(card)}
                  disabled={blocked}
                  title={`${player.name} · OVR ${getEffectivePlayerOvr(card)} · +${getCardUpgrade(card)}${
                    isCardLocked(card) ? ' (ล็อกอยู่)' : ''
                  }`}
                  className={cn(
                    'relative flex flex-col items-center rounded-lg border p-1 transition-colors',
                    picked
                      ? 'border-neon bg-neon/10'
                      : 'border-transparent hover:border-white/20 hover:bg-white/5',
                    blocked && 'cursor-not-allowed opacity-25',
                  )}
                >
                  <PlayerCard player={player} size="sm" level={card.level} />
                  <span className="mt-1 truncate text-[10px] text-chalk/60">{player.name}</span>
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

        {mode === 'material' && (
          <button
            type="button"
            disabled={checked.length === 0}
            onClick={confirm}
            className={cn(
              'shrink-0 rounded-lg py-2.5 font-display text-sm uppercase tracking-wide transition-colors',
              checked.length > 0
                ? 'bg-neon text-ink-900 hover:brightness-110'
                : 'cursor-not-allowed bg-white/5 text-chalk/35',
            )}
          >
            ใส่ในช่อง {checked.length} ใบ
          </button>
        )}
      </div>
    </Modal>
  );
};
