/**
 * วิดเจ็ตคลังการ์ดบนแดชบอร์ด: โชว์การ์ดล่าสุด 3 ใบ + เปิดดูทั้งคลังได้
 * แท็บในหน้าต่างแยกเป็น ทั้งหมด / ตัวจริง / สำรอง โดยอ่านตัวจริงจากทีมปัจจุบัน
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { usePlayers } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import { cn } from '@/utils/helpers';

const TABS = ['ทั้งหมด', 'ตัวจริง', 'สำรอง'] as const;
type Tab = (typeof TABS)[number];

/** ความจุคลังการ์ด */
const CAPACITY = 500;

export const MyCardsWidget = () => {
  const { ownedCards } = usePlayers();
  const { team } = useTeam();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('ทั้งหมด');

  const starterIds = useMemo(
    () => new Set(team.squad.map((slot) => slot.cardId).filter(Boolean)),
    [team.squad],
  );

  const visible = ownedCards.filter(({ card }) => {
    if (tab === 'ตัวจริง') return starterIds.has(card.id);
    if (tab === 'สำรอง') return !starterIds.has(card.id);
    return true;
  });

  const recent = ownedCards.slice(-3);

  return (
    <>
      <section className="glass-panel flex flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="panel-title">Inventory</p>
          <p className="font-mono text-[11px] text-chalk/45">
            {ownedCards.length}/{CAPACITY}
          </p>
        </div>

        <div className="mt-3 flex flex-1 items-center justify-center gap-2">
          {recent.map(({ card, player }) => (
            <PlayerCard
              key={card.id}
              player={player}
              size="xs"
              level={card.level}
              onSelect={() => setOpen(true)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold uppercase tracking-wider text-chalk/80 hover:border-neon/40 hover:text-neon"
        >
          ดูทั้งหมด
        </button>
      </section>

      <Modal
        open={open}
        title="คลังการ์ดของฉัน"
        subtitle={`มีการ์ดทั้งหมด ${ownedCards.length} ใบ · ตัวจริง ${starterIds.size} ใบ`}
        onClose={() => setOpen(false)}
      >
        <div className="mb-4 flex gap-2">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
                item === tab ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/60 hover:text-chalk',
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {visible.map(({ card, player }) => (
            <div key={card.id} className="relative">
              <PlayerCard player={player} size="md" level={card.level} />
              {starterIds.has(card.id) && (
                <span className="absolute -top-1 left-1 rounded bg-neon px-1.5 font-mono text-[9px] font-bold text-ink-900">
                  XI
                </span>
              )}
            </div>
          ))}
          {visible.length === 0 && <p className="text-sm text-chalk/45">ไม่มีการ์ดในหมวดนี้</p>}
        </div>
      </Modal>
    </>
  );
};
