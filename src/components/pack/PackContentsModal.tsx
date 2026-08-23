/**
 * หน้าต่าง "ดูนักเตะในซอง" — เปิดจากปุ่มบนซองในหน้าร้าน
 *
 * โชว์รายชื่อทุกคนที่ซองนั้นมีโอกาสออก จัดกลุ่มตามระดับการ์ด (ดีที่สุดอยู่บน)
 * พร้อมโอกาสของแต่ละระดับ ผู้เล่นจึงตัดสินใจได้ก่อนจ่ายเหรียญว่าคุ้มไหม
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPackPlayersByRarity } from '@/services/cardPack';
import type { CardPack } from '@/types/card';
import type { Rarity } from '@/types/player';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

interface PackContentsModalProps {
  pack: CardPack;
  onClose: () => void;
}

export const PackContentsModal = ({ pack, onClose }: PackContentsModalProps) => {
  const groups = useMemo(() => getPackPlayersByRarity(pack), [pack]);
  const total = groups.reduce((sum, group) => sum + group.players.length, 0);

  /** null = ดูทุกระดับ */
  const [filter, setFilter] = useState<Rarity | null>(null);
  const visible = filter ? groups.filter((group) => group.rarity === filter) : groups;

  return (
    <Modal
      open
      title={`นักเตะในซอง · ${pack.name}`}
      subtitle={
        pack.pool
          ? `ซองนี้คัดไว้ ${total} คน — ออกได้เฉพาะรายชื่อนี้เท่านั้น`
          : `สุ่มจากนักเตะทั้งเกม ${total} คนที่อยู่ในระดับที่ซองนี้ออกได้`
      }
      onClose={onClose}
    >
      {/* ตัวกรองตามระดับ */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
            filter === null ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/60 hover:text-chalk',
          )}
        >
          ทั้งหมด ({total})
        </button>

        {groups.map((group) => (
          <button
            key={group.rarity}
            type="button"
            onClick={() => setFilter(group.rarity)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
              filter === group.rarity
                ? 'bg-neon text-ink-900'
                : 'bg-white/5 text-chalk/60 hover:text-chalk',
            )}
          >
            {RARITY_STYLE[group.rarity].label} ({group.players.length})
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {visible.map((group) => (
          <section key={group.rarity}>
            <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-white/10 pb-1.5">
              <p
                className={cn(
                  'font-display text-sm uppercase tracking-[0.12em]',
                  RARITY_STYLE[group.rarity].text,
                )}
              >
                {RARITY_STYLE[group.rarity].label}
              </p>
              <p className="font-mono text-[11px] text-chalk/45">
                โอกาสต่อการ์ด 1 ใบ {group.chance}% · มี {group.players.length} คน
              </p>
            </div>

            {group.players.length === 0 ? (
              <p className="py-3 text-xs text-chalk/40">
                ซองนี้ยังไม่มีนักเตะระดับนี้ — ถ้าสุ่มได้ระดับนี้ระบบจะหยิบใบอื่นในซองแทน
              </p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {group.players.map((player) => (
                  <li key={player.id} className="w-[84px] text-center">
                    <PlayerCard player={player} size="sm" />
                    <p className="mt-1 truncate text-[10px] font-semibold" title={player.name}>
                      {player.name}
                    </p>
                    <p className="font-mono text-[9px] text-chalk/45">
                      {player.position} · {player.ovr}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="mt-5 border-t border-white/10 pt-3 text-center font-mono text-[10px] text-chalk/35">
        ราคา {formatNumber(pack.price)} เหรียญ · ได้ {pack.cardCount} ใบต่อซอง
      </p>
    </Modal>
  );
};
