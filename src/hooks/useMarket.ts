/**
 * หน้าตลาดซื้อขาย — ตัวกลางระหว่าง UI กับกติกาของตลาด
 *
 * ของในตลาดถูกคำนวณในเครื่องจากรอบเวลา (services/market.ts) ทุกคนจึงเห็น
 * ชุดเดียวกันโดยไม่ต้องมีเซิร์ฟเวอร์คอยสร้างให้ และตลาดมีของตลอดเวลา
 *
 * มีอยู่เรื่องเดียวที่ต้องคุยกับเซิร์ฟเวอร์: "ใบนี้มีคนซื้อไปหรือยัง"
 * ซึ่งทำผ่านใบจองใน Firestore ที่สร้างได้ครั้งเดียวต่อหนึ่งใบ
 * (services/firebase/marketClaims.ts) — สองคนกดพร้อมกันจึงได้ไปคนเดียวเสมอ
 *
 * ⚠️ ลำดับสำคัญตอนซื้อ: ตรวจกติกา → จองที่เซิร์ฟเวอร์ → ค่อยหักเหรียญ
 * ห้ามสลับ ไม่งั้นคนที่แพ้การแย่งจะเสียเหรียญฟรี
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPlayerById } from '@/data/players';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { useRankRewards } from '@/hooks/useRankRewards';
import { claimMarketListing, watchMarketClaims } from '@/services/firebase/marketClaims';
import {
  buildFeaturedListing,
  buildWindowListings,
  filterListings,
  getFeaturedDayKey,
  getMarketWindowEnd,
  getMarketWindowIndex,
  getWindowSpan,
  getWindowStart,
  isListingLive,
  sortListings,
} from '@/services/market';
import { resolveMarketPurchase } from '@/services/marketPurchase';
import { getShopProtectedCards } from '@/services/rankRewards';
import { playSfx } from '@/services/sound';
import type { MarketFilter, MarketListing, MarketSort } from '@/types/market';
import type { Player } from '@/types/player';

/** ประกาศหนึ่งใบที่ต่อข้อมูลนักเตะเรียบร้อยแล้ว (พร้อมใช้ใน UI) */
export interface MarketOffer {
  listing: MarketListing;
  player: Player;
  /** เหรียญพอซื้อไหม */
  affordable: boolean;
  /** มีการ์ดของนักเตะคนนี้ในคลังแล้วกี่ใบ (เกมนี้ถือใบซ้ำได้) */
  ownedCount: number;
  /** เหลืออีกกี่วินาทีก่อนหมดเวลา */
  secondsLeft: number;
}

/** ผลการซื้อครั้งล่าสุด ใช้เปิดหน้าต่างแสดงการ์ดที่เพิ่งได้ */
export interface MarketPurchaseView {
  player: Player;
  price: number;
  at: string;
}

const DEFAULT_FILTER: MarketFilter = { position: 'all', rarity: 'all' };

export const useMarket = () => {
  const { account } = useAuth();
  const { coins, rawCards, ownedCards, applyMarketPurchase, reportMarketPurchase } = usePlayers();
  const { cardCash, market } = useGameConfig();
  /** การ์ดรางวัลอันดับ 1–3 — ห้ามโผล่ในตลาด ต้องขึ้นอันดับเอาเท่านั้น */
  const { cards: rewardCards } = useRankRewards();

  const [error, setError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<MarketPurchaseView | null>(null);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<MarketFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<MarketSort>('expiry-asc');

  /** ใบที่ถูกจองแล้ว: listingId → uid ของคนซื้อ (มาจาก Firestore แบบเรียลไทม์) */
  const [claimed, setClaimed] = useState<Map<string, string>>(new Map());
  /** ใบที่เราเพิ่งซื้อไปเอง — ปิดในจอทันทีโดยไม่ต้องรอ snapshot กลับมา */
  const [justBought, setJustBought] = useState<Set<string>>(new Set());

  /** นาฬิกาเดินทีละวินาที ใช้ทำนับถอยหลังและเขี่ยใบที่หมดเวลาออกเอง */
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const now = nowSeconds * 1000;
  const windowIndex = getMarketWindowIndex(new Date(now), market);
  /** วันแข่งปัจจุบัน — ใบเด่นเปลี่ยนตามค่านี้ (ตัดรอบ 06:00 เหมือนลีก) */
  const dayKey = getFeaturedDayKey(new Date(now));

  const protectedCards = useMemo(() => getShopProtectedCards(rewardCards), [rewardCards]);

  /** ติดตามใบจองของรอบที่ยังมีของอยู่ — ต่อใหม่เมื่อขึ้นรอบใหม่ */
  useEffect(() => {
    const since = windowIndex - getWindowSpan(market);
    const stop = watchMarketClaims(since, (next) => {
      setClaimed(next);
      setLoading(false);
    });

    return stop;
  }, [market, windowIndex]);

  /**
   * ของทั้งหมดของช่วงเวลานี้ — คิดใหม่เฉพาะตอนขึ้นรอบใหม่หรือค่าตั้งเปลี่ยน
   * ไม่ได้คิดใหม่ทุกวินาที (การกรองว่าใบไหนยังไม่หมดเวลาทำแยกข้างล่าง)
   */
  const generated = useMemo<MarketListing[]>(() => {
    // ปิดตลาดจากหน้าแอดมิน = ไม่ต้องคิดของเลย
    if (!market.enabled) return [];

    const options = { cash: cardCash, excluded: protectedCards, config: market };
    const span = getWindowSpan(market);

    const rows: MarketListing[] = [];
    for (let index = windowIndex - span; index <= windowIndex; index += 1) {
      rows.push(...buildWindowListings(index, options));
    }

    // ใบเด่นผูกกับ "วันแข่ง" ไม่ใช่รอบ จึงคิดจากเวลาเริ่มของรอบปัจจุบัน
    const featured = buildFeaturedListing(getWindowStart(windowIndex, market), options);
    if (featured) rows.push(featured);

    return rows;
  }, [cardCash, dayKey, market, protectedCards, windowIndex]);

  /** นับจำนวนใบที่มีอยู่แล้วของนักเตะแต่ละคน ไว้โชว์ป้าย "มีแล้ว" */
  const ownedByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    ownedCards.forEach(({ player }) => {
      counts.set(player.id, (counts.get(player.id) ?? 0) + 1);
    });
    return counts;
  }, [ownedCards]);

  /** ของทั้งหมดที่ยังซื้อได้จริง ณ วินาทีนี้ */
  const allOffers = useMemo<MarketOffer[]>(
    () =>
      generated
        .filter(
          (listing) =>
            isListingLive(listing, now) && !claimed.has(listing.id) && !justBought.has(listing.id),
        )
        .flatMap((listing) => {
          const player = getPlayerById(listing.playerId);
          if (!player) return [];

          return [
            {
              listing,
              player,
              affordable: coins >= listing.price,
              ownedCount: ownedByPlayer.get(player.id) ?? 0,
              secondsLeft: Math.max(
                0,
                Math.floor((new Date(listing.expiresAt).getTime() - now) / 1000),
              ),
            },
          ];
        }),
    [claimed, coins, generated, justBought, now, ownedByPlayer],
  );

  /** ใบเด่นประจำวัน (ทุกคนเห็นใบเดียวกัน) */
  const featured = useMemo(
    () => allOffers.find((offer) => offer.listing.featured) ?? null,
    [allOffers],
  );

  /** ของในตลาดหลังกรองและเรียงแล้ว (ไม่รวมใบเด่นที่โชว์แยกอยู่ข้างบน) */
  const offers = useMemo(() => {
    const normal = allOffers.filter((offer) => !offer.listing.featured);
    const byId = new Map(normal.map((offer) => [offer.listing.id, offer]));

    return sortListings(
      filterListings(
        normal.map((offer) => offer.listing),
        filter,
      ),
      sort,
    ).flatMap((listing) => {
      const found = byId.get(listing.id);
      return found ? [found] : [];
    });
  }, [allOffers, filter, sort]);

  /**
   * ซื้อหนึ่งใบ — คืน true เมื่อจองที่เซิร์ฟเวอร์ผ่านและหักเหรียญเรียบร้อย
   *
   * ถ้าจองไม่ผ่าน (คนอื่นตัดหน้า) จะไม่มีการหักเหรียญเกิดขึ้นเลย
   * เพราะการหักเงินอยู่หลังการจองเสมอ
   */
  const buy = useCallback(
    async (offer: MarketOffer): Promise<boolean> => {
      if (buyingId || !account) return false;

      setBuyingId(offer.listing.id);
      setError(null);

      try {
        const outcome = resolveMarketPurchase({
          listing: offer.listing,
          buyerUid: account.id,
          coins,
          cardCount: rawCards.length,
          claimed: claimed.has(offer.listing.id) || justBought.has(offer.listing.id),
          now: new Date(),
        });

        if (!outcome.ok) {
          setError(outcome.message);
          playSfx('error');
          return false;
        }

        const claim = await claimMarketListing(offer.listing, account.id);

        if (claim === 'taken') {
          setClaimed((current) => new Map(current).set(offer.listing.id, 'other'));
          setError('นักเตะคนนี้เพิ่งถูกคนอื่นซื้อไปแล้ว');
          playSfx('error');
          return false;
        }

        if (claim === 'denied' || claim === 'error') {
          setError(
            claim === 'denied'
              ? 'ซื้อไม่สำเร็จ — อาจถูกคนอื่นตัดหน้าไปแล้ว หรือยังไม่ได้อัปเดตกฎความปลอดภัยของ Firestore (marketClaims)'
              : 'ต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง',
          );
          playSfx('error');
          return false;
        }

        // ถึงตรงนี้แปลว่าใบนี้เป็นของเราแน่นอนแล้ว (หรือกำลังเล่นออฟไลน์) จึงหักเงินได้
        applyMarketPurchase({ coins: outcome.coinsLeft, card: outcome.card });
        setJustBought((current) => new Set(current).add(offer.listing.id));

        reportMarketPurchase({
          playerId: outcome.result.playerId,
          listingId: outcome.result.listingId,
          price: outcome.result.price,
          cardId: outcome.result.cardId,
          at: outcome.result.at,
        });

        setPurchase({ player: offer.player, price: outcome.result.price, at: outcome.result.at });
        playSfx('coin');
        return true;
      } finally {
        setBuyingId(null);
      }
    },
    [
      account,
      applyMarketPurchase,
      buyingId,
      claimed,
      coins,
      justBought,
      rawCards.length,
      reportMarketPurchase,
    ],
  );

  return {
    /** ตลาดเปิดอยู่ไหม (แอดมินสั่งปิดได้จาก ADMIN → ตลาดซื้อขาย) */
    enabled: market.enabled,
    closedMessage: market.closedMessage,
    coins,
    offers,
    featured,
    /** จำนวนของทั้งหมดก่อนกรอง ใช้แยก "ตลาดว่าง" ออกจาก "กรองแล้วไม่เจอ" */
    totalCount: allOffers.filter((offer) => !offer.listing.featured).length,
    loading,
    error,
    buyingId,
    purchase,
    filter,
    setFilter,
    sort,
    setSort,
    /** เวลาที่ของชุดใหม่จะเข้ามา (ISO) */
    nextRefreshAt: getMarketWindowEnd(new Date(now), market).toISOString(),
    /** วินาทีที่เหลือก่อนของชุดใหม่จะเข้า */
    secondsToRefresh: Math.max(
      0,
      Math.floor((getMarketWindowEnd(new Date(now), market).getTime() - now) / 1000),
    ),
    /** กดรีเฟรชเอง — ของคำนวณในเครื่องอยู่แล้ว จึงแค่ขยับนาฬิกาให้คิดใหม่ */
    reload: () => setNowSeconds(Math.floor(Date.now() / 1000)),
    buy,
    dismissPurchase: () => setPurchase(null),
    clearError: () => setError(null),
    resetFilter: () => setFilter(DEFAULT_FILTER),
  };
};
