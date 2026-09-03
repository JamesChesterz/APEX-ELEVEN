/**
 * ลิ้นชักตัวสำรองที่มุมล่างของสนาม
 *
 * ⚠️ ม้านั่งมีแค่ BENCH_SIZE ช่อง ไม่ใช่ "การ์ดทุกใบที่ไม่ได้ลงสนาม"
 * ชุดนี้คือชุดเดียวกับที่ใช้จริงตอนเปลี่ยนตัวใน MATCHMAKING
 * (useTeam.benchCards) จัดที่นี่แล้วมีผลในสนามแข่งทันที
 *
 * - กดช่องว่าง → เลือกนักเตะจากคลังมาใส่
 * - ลากการ์ดจากช่องนี้ไปวางในสนาม = ส่งลงเล่น
 * - ลากการ์ดจากสนามมาปล่อยที่นี่ = เอาออกจากตัวจริงแล้วลงม้านั่งช่องว่างช่องแรก
 */
import { PlayerCard } from '@/components/player/PlayerCard';
import { isCardDrag, readDrag, writeDrag, type CardDragPayload } from '@/components/pitch/dragData';
import type { BenchCard } from '@/hooks/useTeam';
import { cn } from '@/utils/helpers';

interface SubsDrawerProps {
  /** ม้านั่งความยาวคงที่ (null = ช่องว่าง) */
  benchCards: Array<BenchCard | null>;
  open: boolean;
  /** การ์ดสำรองที่ถูกเลือกไว้ (รอคลิกช่องในสนาม) */
  selectedCardId?: string | null;
  onToggle: () => void;
  onSelectCard?: (cardId: string) => void;
  /** กดช่องว่างเพื่อเลือกคนใส่ */
  onPickEmpty?: (index: number) => void;
  /** เอาคนออกจากช่องม้านั่ง */
  onClearSlot?: (index: number) => void;
  onDropCard: (payload: CardDragPayload) => void;
}

export const SubsDrawer = ({
  benchCards,
  open,
  selectedCardId,
  onToggle,
  onSelectCard,
  onPickEmpty,
  onClearSlot,
  onDropCard,
}: SubsDrawerProps) => {
  const filled = benchCards.filter(Boolean).length;

  return (
    <div className="absolute inset-x-0 bottom-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="absolute bottom-full left-4 mb-3 flex items-center gap-2 rounded-lg border border-white/15 bg-black/60 px-4 py-2 text-xs font-bold uppercase tracking-wider backdrop-blur hover:border-neon/50 hover:text-neon"
      >
        <span className={cn('transition-transform', open && 'rotate-180')}>▲</span>
        Subs ({filled}/{benchCards.length})
      </button>

      {open && (
        <div
          onDragOver={(event) => {
            if (!isCardDrag(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            event.preventDefault();
            const payload = readDrag(event);
            if (payload) onDropCard(payload);
          }}
          className="border-t border-white/10 bg-black/75 px-4 py-3 backdrop-blur"
        >
          <div className="flex items-start gap-3 overflow-x-auto">
            {benchCards.map((entry, index) => {
              const number = 12 + index;

              if (!entry) {
                return (
                  <button
                    key={`empty-${index}`}
                    type="button"
                    onClick={() => onPickEmpty?.(index)}
                    className="flex h-[86px] w-[62px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 text-chalk/35 transition-colors hover:border-neon/50 hover:text-neon"
                  >
                    <span className="text-xl leading-none">+</span>
                    <span className="font-mono text-[9px]">{number}</span>
                  </button>
                );
              }

              return (
                <div key={entry.card.id} className="relative shrink-0">
                  <PlayerCard
                    player={entry.player}
                    size="xs"
                    level={entry.card.level}
                    draggable
                    onDragStart={(event) => writeDrag(event, { cardId: entry.card.id })}
                    onSelect={() => onSelectCard?.(entry.card.id)}
                    className={cn(selectedCardId === entry.card.id && 'rounded-lg ring-2 ring-neon')}
                  />
                  <span className="mt-0.5 block text-center font-mono text-[9px] text-chalk/40">
                    {number}
                  </span>

                  {/* ปุ่มเอาออก วางนอกการ์ดเพราะการ์ดเป็นตัวลากอยู่แล้ว */}
                  <button
                    type="button"
                    onClick={() => onClearSlot?.(index)}
                    aria-label="เอาออกจากม้านั่ง"
                    title="เอาออกจากม้านั่ง"
                    className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-ink-900/90 text-[10px] text-chalk/50 hover:border-[#D93A3A]/60 hover:text-[#D93A3A]"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-[10px] text-chalk/40">
            ม้านั่งใส่ได้ {benchCards.length} คน · ชุดนี้คือตัวสำรองที่ใช้เปลี่ยนตัวจริงในเมนู
            MATCHMAKING
          </p>
        </div>
      )}
    </div>
  );
};
