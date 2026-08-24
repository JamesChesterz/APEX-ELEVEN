/**
 * ลิ้นชักตัวสำรองที่มุมล่างของสนาม
 * - ลากการ์ดจากที่นี่ไปวางในช่องบนสนามเพื่อเปลี่ยนตัว
 * - ลากการ์ดจากสนามมาปล่อยที่นี่เพื่อเอาออกจากทีม
 */
import { PlayerCard } from '@/components/player/PlayerCard';
import { isCardDrag, readDrag, writeDrag, type CardDragPayload } from '@/components/pitch/dragData';
import type { BenchCard } from '@/hooks/useTeam';
import { cn } from '@/utils/helpers';

interface SubsDrawerProps {
  bench: BenchCard[];
  open: boolean;
  /** การ์ดสำรองที่ถูกเลือกไว้ (รอคลิกช่องในสนาม) */
  selectedCardId?: string | null;
  onToggle: () => void;
  onSelectCard?: (cardId: string) => void;
  onDropCard: (payload: CardDragPayload) => void;
}

export const SubsDrawer = ({
  bench,
  open,
  selectedCardId,
  onToggle,
  onSelectCard,
  onDropCard,
}: SubsDrawerProps) => (
  <div className="absolute inset-x-0 bottom-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="absolute bottom-full left-4 mb-3 flex items-center gap-2 rounded-lg border border-white/15 bg-black/60 px-4 py-2 text-xs font-bold uppercase tracking-wider backdrop-blur hover:border-neon/50 hover:text-neon"
    >
      <span className={cn('transition-transform', open && 'rotate-180')}>▲</span>
      Subs ({bench.length})
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
        className="flex items-center gap-3 overflow-x-auto border-t border-white/10 bg-black/75 px-4 py-3 backdrop-blur"
      >
        {bench.length === 0 ? (
          <p className="py-6 text-xs text-chalk/45">ไม่มีตัวสำรอง — ลากการ์ดจากสนามมาปล่อยที่นี่เพื่อเอาออกจากทีม</p>
        ) : (
          bench.map(({ card, player }) => (
            <PlayerCard
              key={card.id}
              player={player}
              size="xs"
              level={card.level}
              draggable
              onDragStart={(event) => writeDrag(event, { cardId: card.id })}
              onSelect={() => onSelectCard?.(card.id)}
              className={cn(
                selectedCardId === card.id && 'rounded-lg ring-2 ring-neon',
              )}
            />
          ))
        )}
      </div>
    )}
  </div>
);
