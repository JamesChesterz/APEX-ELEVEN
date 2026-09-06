/**
 * หน้า TRANSFER MARKET — ตลาดซื้อขายนักเตะ
 *
 * ของในตลาดตอนนี้มาจากระบบ (NPC) ทั้งหมด จึงมีของให้ซื้อตลอดเวลา
 * แม้ไม่มีผู้เล่นคนอื่นออนไลน์เลย — เซิร์ฟเวอร์เติมของให้เองทุกชั่วโมง
 *
 * ของในตลาดคำนวณในเครื่องจากรอบเวลา (ทุกคนได้ชุดเดียวกัน) ส่วน "ใครซื้อใบไหนไปแล้ว"
 * ตัดสินที่ Firestore ด้วยใบจองที่สร้างได้ครั้งเดียวต่อใบ — สองคนกดพร้อมกันได้ไปคนเดียว
 */
import { useState } from 'react';
import { FeaturedListing } from '@/components/market/FeaturedListing';
import { MarketFilters } from '@/components/market/MarketFilters';
import { CoinIcon, MarketListingCard } from '@/components/market/MarketListingCard';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { useMarket, type MarketOffer } from '@/hooks/useMarket';
import { formatCountdown } from '@/services/exchangeRotation';
import { playSfx } from '@/services/sound';
import { cn, formatNumber } from '@/utils/helpers';

/** โครงการ์ดเปล่าระหว่างรอข้อมูล — กันหน้ากระตุกตอนของมาถึง */
const SkeletonCard = () => (
  <div className="glass-panel h-[188px] animate-pulse border border-white/5 p-3">
    <div className="h-full w-full rounded bg-white/5" />
  </div>
);

export const TransferMarketPage = () => {
  const {
    enabled,
    closedMessage,
    coins,
    offers,
    featured,
    totalCount,
    loading,
    error,
    buyingId,
    purchase,
    filter,
    setFilter,
    sort,
    setSort,
    secondsToRefresh,
    reload,
    buy,
    dismissPurchase,
    clearError,
    resetFilter,
  } = useMarket();

  /** ใบที่กำลังถามยืนยันอยู่ (null = ไม่ได้เปิดหน้าต่าง) */
  const [confirming, setConfirming] = useState<MarketOffer | null>(null);

  const askBuy = (offer: MarketOffer) => {
    playSfx('click');
    setConfirming(offer);
  };

  const confirmBuy = async () => {
    if (!confirming) return;
    const target = confirming;
    setConfirming(null);
    await buy(target);
  };

  return (
    <div className="space-y-4">
      {/* ══════════ หัวข้อ + เหรียญ + นาฬิการอบเติมของ ══════════ */}
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-2xl uppercase leading-none">
            Transfer <span className="text-neon">Market</span>
          </h1>
          <p className="mt-1 text-xs text-chalk/45">
            ซื้อนักเตะจากตลาดกลาง — ของชุดใหม่เข้าทุกชั่วโมง ทุกคนเห็นชุดเดียวกัน
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-chalk/40">เหรียญของคุณ</p>
            <p className="flex items-center justify-end gap-1.5 font-mono text-lg font-bold text-gold">
              <CoinIcon />
              {formatNumber(coins)}
            </p>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-[10px] uppercase tracking-[0.2em] text-chalk/40">ของใหม่ใน</p>
            <p className="font-mono text-lg tabular-nums text-chalk/70">
              {formatCountdown(secondsToRefresh)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              playSfx('click');
              void reload();
            }}
            disabled={loading}
            className={cn(
              'rounded-lg border border-white/10 px-3 py-2 text-xs uppercase tracking-wide',
              'text-chalk/70 hover:border-white/25 hover:text-chalk disabled:opacity-40',
            )}
          >
            {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
          </button>
        </div>
      </header>

      {/* ══════════ ข้อความผิดพลาด ══════════ */}
      {error && (
        <div className="glass-panel flex items-center justify-between gap-3 border border-gem/40 p-3">
          <p className="text-sm text-gem">{error}</p>
          <button
            type="button"
            onClick={clearError}
            className="shrink-0 rounded px-2 py-1 text-xs uppercase text-chalk/50 hover:text-chalk"
          >
            ปิด
          </button>
        </div>
      )}

      {!enabled ? (
        /* ══════════ แอดมินสั่งปิดตลาดชั่วคราว ══════════ */
        <section className="glass-panel p-10 text-center">
          <p className="text-lg uppercase">ตลาดปิดชั่วคราว</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-chalk/50">{closedMessage}</p>
        </section>
      ) : (
      <>
          {featured && (
            <FeaturedListing
              offer={featured}
              busy={buyingId === featured.listing.id}
              locked={Boolean(buyingId)}
              onBuy={askBuy}
            />
          )}

          <MarketFilters
            filter={filter}
            sort={sort}
            onChange={setFilter}
            onSort={setSort}
            onReset={resetFilter}
          />

          {loading && offers.length === 0 ? (
            /* ══════════ กำลังโหลด ══════════ */
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : offers.length === 0 ? (
            /* ══════════ ไม่มีของ ══════════ */
            <section className="glass-panel p-10 text-center">
              <p className="text-lg uppercase">
                {totalCount === 0 ? 'ตลาดกำลังเติมของ' : 'ไม่มีนักเตะที่ตรงกับตัวกรอง'}
              </p>
              <p className="mt-2 text-sm text-chalk/50">
                {totalCount === 0
                  ? 'ของชุดใหม่กำลังเข้ามา ลองกดรีเฟรชอีกครั้งในอีกสักครู่'
                  : 'ลองลดเงื่อนไขลง หรือกดปุ่ม "ล้าง" เพื่อดูของทั้งหมด'}
              </p>
            </section>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {offers.map((offer) => (
                <MarketListingCard
                  key={offer.listing.id}
                  offer={offer}
                  busy={buyingId === offer.listing.id}
                  locked={Boolean(buyingId) && buyingId !== offer.listing.id}
                  onBuy={askBuy}
                />
              ))}
            </div>
          )}
      </>
      )}

      {/* ══════════ ยืนยันก่อนซื้อ ══════════ */}
      <Modal
        open={Boolean(confirming)}
        title="ยืนยันการซื้อ"
        subtitle="ตรวจราคาให้เรียบร้อยก่อนกดยืนยัน"
        onClose={() => setConfirming(null)}
      >
        {confirming && (
          <div className="flex flex-col items-center gap-4 text-center">
            <PlayerCard player={confirming.player} size="md" />

            <p className="text-base">
              ซื้อ <span className="font-bold uppercase">{confirming.player.name}</span> ในราคา{' '}
              <span className="inline-flex items-center gap-1 font-mono font-bold text-gold">
                <CoinIcon />
                {formatNumber(confirming.listing.price)}
              </span>{' '}
              เหรียญ?
            </p>

            <p className="text-xs text-chalk/45">
              เหลือหลังซื้อ {formatNumber(Math.max(0, coins - confirming.listing.price))} เหรียญ
            </p>

            <div className="flex w-full gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="flex-1 rounded-lg border border-white/15 py-2 text-sm uppercase text-chalk/70 hover:text-chalk"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void confirmBuy()}
                className="flex-1 rounded-lg bg-neon py-2 text-sm font-bold uppercase text-ink-900 hover:bg-neon-dim"
              >
                ยืนยันซื้อ
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════ ซื้อสำเร็จ ══════════ */}
      <Modal
        open={Boolean(purchase)}
        title="ซื้อสำเร็จ"
        subtitle="นักเตะเข้าคลังของคุณเรียบร้อยแล้ว"
        onClose={dismissPurchase}
      >
        {purchase && (
          <div className="flex flex-col items-center gap-4 text-center">
            <PlayerCard player={purchase.player} size="lg" />
            <p className="text-lg uppercase">{purchase.player.name}</p>
            <p className="flex items-center gap-1.5 font-mono text-sm text-gold">
              <CoinIcon />
              {formatNumber(purchase.price)}
            </p>
            <button
              type="button"
              onClick={dismissPurchase}
              className="rounded-lg bg-neon px-8 py-2 text-sm font-bold uppercase text-ink-900 hover:bg-neon-dim"
            >
              ตกลง
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};
