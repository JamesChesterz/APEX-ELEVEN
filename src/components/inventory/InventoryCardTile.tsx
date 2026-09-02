/**
 * การ์ดหนึ่งช่องในตารางคลัง — รูปการ์ด + ปุ่มล็อกมุมขวาบน + หลอดเลเวลใต้การ์ด
 *
 * ตัวการ์ดโชว์ตรง ๆ ไม่มีกรอบครอบ (แนวเดียวกับช่องนักเตะในหน้าอัปเกรด)
 * เพราะการ์ดมีกรอบระดับความหายากมาในรูปอยู่แล้ว ครอบทับจะกลายเป็นกรอบซ้อนกรอบ
 */
import { PlayerCard } from '@/components/player/PlayerCard';
import { MAX_UPGRADE } from '@/data/upgradeConfig';
import type { OwnedPlayerCard } from '@/hooks/usePlayers';
import { getCardUpgrade } from '@/services/cardInstance';
import { cn } from '@/utils/helpers';

interface InventoryCardTileProps {
  entry: OwnedPlayerCard;
  locked: boolean;
  inSquad: boolean;
  /** โหมดเลือกหลายใบเปิดอยู่ไหม */
  picking: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleLock: () => void;
}

export const InventoryCardTile = ({
  entry,
  locked,
  inSquad,
  picking,
  selected,
  onOpen,
  onToggleLock,
}: InventoryCardTileProps) => {
  const { card, player } = entry;
  const upgrade = getCardUpgrade(card);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        title={`${player.name} · ${player.position} · OVR ${player.ovr}`}
        className={cn(
          'flex w-full flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all',
          selected
            ? 'bg-neon/15 ring-1 ring-inset ring-neon'
            : 'hover:-translate-y-0.5 hover:bg-white/[0.04]',
          picking && locked && 'cursor-not-allowed opacity-40',
        )}
      >
        {/*
          PlayerCard ตั้งความกว้างผ่าน inline style ตามขนาดที่เลือก
          คลาส w-full จึงเอาชนะไม่ได้ ต้องส่ง style ทับเข้าไปตรง ๆ
          เพื่อให้การ์ดยืดเต็มช่องกริดแทนที่จะค้างที่ความกว้างคงที่
        */}
        <PlayerCard
          player={player}
          size="md"
          level={card.level}
          style={{ width: '100%' }}
        />

        {/* บรรทัดเลเวล + หลอดความคืบหน้าของค่าบวก ตามแบบ */}
        <div className="flex w-full items-center gap-2 px-0.5">
          <span className="shrink-0 font-mono text-[10px] text-chalk/45">Lv. {card.level}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className={cn(
                'block h-full rounded-full',
                upgrade >= MAX_UPGRADE
                  ? 'bg-gradient-to-r from-gold to-rarity-mythical'
                  : 'bg-gradient-to-r from-neon/70 to-neon',
              )}
              style={{ width: `${(upgrade / MAX_UPGRADE) * 100}%` }}
            />
          </span>
        </div>
      </button>

      {/* ปุ่มล็อก — วางนอกปุ่มหลักเพราะปุ่มซ้อนปุ่มกดไม่ได้ */}
      <button
        type="button"
        onClick={onToggleLock}
        aria-label={locked ? 'ปลดล็อกการ์ด' : 'ล็อกการ์ด'}
        title={locked ? 'ล็อกอยู่ — ขายหรือใช้เป็นวัตถุดิบไม่ได้' : 'กดเพื่อล็อกกันขายพลาด'}
        className={cn(
          'absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-md border text-[11px] backdrop-blur transition-colors',
          locked
            ? 'border-gold/60 bg-ink-900/80 text-gold'
            : 'border-white/15 bg-ink-900/60 text-chalk/30 hover:text-chalk/70',
        )}
      >
        {locked ? '🔒' : '🔓'}
      </button>

      {inSquad && (
        <span className="pointer-events-none absolute left-2.5 bottom-8 rounded bg-neon/90 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-ink-900">
          ตัวจริง
        </span>
      )}
    </div>
  );
};
