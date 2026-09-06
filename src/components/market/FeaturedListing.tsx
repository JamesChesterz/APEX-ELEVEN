/**
 * ใบเด่นประจำวัน (TODAY'S FEATURED)
 *
 * เซิร์ฟเวอร์เป็นคนเลือกจาก "วันแข่ง" ปัจจุบัน ผู้เล่นทุกคนจึงเห็นคนเดียวกันทั้งวัน
 * และราคาถูกกว่าราคาตลาดปกติของนักเตะคนนั้น (ดู featuredDiscount ใน services/market.ts)
 */
import { CoinIcon } from '@/components/market/MarketListingCard';
import { PlayerCard } from '@/components/player/PlayerCard';
import { formatCountdown } from '@/services/exchangeRotation';
import type { MarketOffer } from '@/hooks/useMarket';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

interface FeaturedListingProps {
  offer: MarketOffer;
  busy?: boolean;
  locked?: boolean;
  onBuy: (offer: MarketOffer) => void;
}

export const FeaturedListing = ({ offer, busy, locked, onBuy }: FeaturedListingProps) => {
  const { player, listing, affordable, secondsLeft } = offer;
  const rarity = RARITY_STYLE[player.rarity];

  return (
    <section className="glass-panel relative overflow-hidden border border-gold/30 p-4">
      {/* แสงทองจาง ๆ ให้แผงนี้เด่นกว่าการ์ดปกติในตลาด */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-gold/10 via-transparent to-transparent" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <PlayerCard player={player} size="md" className="mx-auto shrink-0 sm:mx-0" />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
            ★ นักเตะเด่นประจำวัน
          </p>
          <h2 className="mt-1 truncate text-2xl uppercase leading-tight">{player.name}</h2>

          <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[10px] uppercase tracking-wide sm:justify-start">
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

          <p className="mt-2 font-mono text-[11px] tabular-nums text-chalk/45">
            หมดเวลาใน {formatCountdown(secondsLeft)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2 sm:items-end">
          <p
            className={cn(
              'flex items-center gap-1.5 font-mono text-xl font-bold',
              affordable ? 'text-gold' : 'text-chalk/35',
            )}
          >
            <CoinIcon className="h-5 w-5 text-[11px]" />
            {formatNumber(listing.price)}
          </p>

          <button
            type="button"
            disabled={!affordable || busy || locked}
            onClick={() => onBuy(offer)}
            className={cn(
              'w-full rounded-lg px-6 py-2 text-sm font-bold uppercase tracking-wide transition-colors sm:w-auto',
              affordable && !locked
                ? 'bg-gold text-ink-900 hover:brightness-110'
                : 'cursor-not-allowed bg-white/10 text-chalk/35',
            )}
          >
            {busy ? 'กำลังซื้อ…' : affordable ? 'ซื้อเลย' : 'เหรียญไม่พอ'}
          </button>
        </div>
      </div>
    </section>
  );
};
