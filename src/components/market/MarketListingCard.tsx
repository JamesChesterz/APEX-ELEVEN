/**
 * การ์ดหนึ่งใบในตลาดซื้อขาย
 *
 * ใช้รูปการ์ดตัวเดียวกับทั้งเกม (components/player/PlayerCard) แล้วเติมข้อมูล
 * ที่คนซื้อต้องใช้ตัดสินใจไว้ข้างล่าง: ตำแหน่ง · OVR · ระดับการ์ด · ราคา · เวลาที่เหลือ
 */
import { PlayerCard } from '@/components/player/PlayerCard';
import { formatCountdown } from '@/services/exchangeRotation';
import type { MarketOffer } from '@/hooks/useMarket';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

/** เหรียญเงินในเกม (ใช้สัญลักษณ์เดียวกับหน้าแลกการ์ดเป็นเงิน) */
export const CoinIcon = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gold text-[9px] font-bold text-ink-900',
      className,
    )}
  >
    ฿
  </span>
);

interface MarketListingCardProps {
  offer: MarketOffer;
  /** true = กำลังรอเซิร์ฟเวอร์ตอบคำขอซื้อของใบนี้ */
  busy?: boolean;
  /** true = กำลังซื้อใบอื่นอยู่ ปิดปุ่มไว้ก่อนกันกดซ้อน */
  locked?: boolean;
  onBuy: (offer: MarketOffer) => void;
}

export const MarketListingCard = ({ offer, busy, locked, onBuy }: MarketListingCardProps) => {
  const { listing, player, affordable, ownedCount, secondsLeft } = offer;
  const rarity = RARITY_STYLE[player.rarity];
  /** ใกล้หมดเวลา (ต่ำกว่า 10 นาที) — เน้นสีให้เห็นชัด */
  const urgent = secondsLeft <= 600;

  return (
    <article
      className={cn(
        'glass-panel flex flex-col gap-3 p-3 transition-colors',
        'border border-white/10 hover:border-white/25',
      )}
    >
      <div className="flex items-start gap-3">
        <PlayerCard player={player} size="sm" className="shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold uppercase leading-tight">{player.name}</p>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide">
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-bold text-chalk/80">
              {player.position}
            </span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-bold text-chalk/80">
              OVR {player.ovr}
            </span>
            <span className={cn('rounded border px-1.5 py-0.5 font-bold', rarity.text, rarity.border)}>
              {rarity.label}
            </span>
          </div>

          {ownedCount > 0 && (
            <p className="mt-1 text-[10px] text-chalk/40">มีอยู่แล้ว {ownedCount} ใบ</p>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-chalk/40">ราคา</p>
          <p
            className={cn(
              'flex items-center gap-1 font-mono text-base font-bold',
              affordable ? 'text-gold' : 'text-chalk/35',
            )}
          >
            <CoinIcon />
            {formatNumber(listing.price)}
          </p>
        </div>

        <p
          className={cn(
            'font-mono text-[11px] tabular-nums',
            urgent ? 'text-gem' : 'text-chalk/45',
          )}
          title="เวลาที่เหลือก่อนประกาศนี้หมดอายุ"
        >
          {formatCountdown(secondsLeft)}
        </p>
      </div>

      <button
        type="button"
        disabled={!affordable || busy || locked}
        onClick={() => onBuy(offer)}
        className={cn(
          'rounded-lg py-2 text-sm font-bold uppercase tracking-wide transition-colors',
          affordable && !locked
            ? 'bg-neon text-ink-900 hover:bg-neon-dim'
            : 'cursor-not-allowed bg-white/10 text-chalk/35',
        )}
      >
        {busy ? 'กำลังซื้อ…' : affordable ? 'ซื้อ' : 'เหรียญไม่พอ'}
      </button>
    </article>
  );
};
