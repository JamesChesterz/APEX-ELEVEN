/**
 * หน้าตลาดซื้อขาย — ตัวกลางระหว่าง UI กับเซิร์ฟเวอร์
 *
 * ของทุกใบในตลาดมาจาก Cloud Functions เท่านั้น เครื่องผู้เล่นไม่ได้สร้างเอง
 * และตอนกดซื้อก็แค่ "ส่ง listingId ไปขอ" — เหรียญกับการ์ดเซิร์ฟเวอร์จัดการให้หมด
 * หน้าเว็บมีหน้าที่เดียวคือเอาผลที่ได้กลับมาตั้งทับค่าในเครื่องทันที (applyMarketPurchase)
 *
 * ถ้าเล่นแบบออฟไลน์หรือยังไม่ได้ deploy functions ตลาดจะปิด (ดู MARKET_AVAILABLE)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPlayerById } from '@/data/players';
import { usePlayers } from '@/hooks/usePlayers';
import {
  MARKET_AVAILABLE,
  callBuyMarketListing,
  callGetMarketListings,
  createMarketRequestId,
} from '@/services/firebase/marketServer';
import { serverErrorMessage } from '@/services/firebase/gameServer';
import { filterListings, isListingLive, sortListings } from '@/services/market';
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
  const { coins, ownedCards, applyMarketPurchase, reportMarketPurchase } = usePlayers();

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<MarketPurchaseView | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<string | null>(null);

  const [filter, setFilter] = useState<MarketFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<MarketSort>('expiry-asc');

  /** นาฬิกาเดินทีละวินาที ใช้ทำนับถอยหลังและเขี่ยใบที่หมดเวลาออกเอง */
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const now = nowSeconds * 1000;

  /** กันยิงซ้อนกันเวลาผู้เล่นกดรีเฟรชรัว ๆ */
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!MARKET_AVAILABLE) {
      setLoading(false);
      setError('ตลาดซื้อขายเปิดเฉพาะตอนเล่นออนไลน์ — เข้าสู่ระบบบนเซิร์ฟเวอร์ก่อน');
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const response = await callGetMarketListings({});
      setListings(Array.isArray(response.listings) ? response.listings : []);
      setNextRefreshAt(response.nextRefreshAt ?? null);
      setError(null);
    } catch (caught) {
      setError(serverErrorMessage(caught));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** ถึงรอบเติมของแล้วโหลดใหม่ให้เอง ผู้เล่นไม่ต้องกดรีเฟรชเอง */
  useEffect(() => {
    if (!nextRefreshAt) return;
    if (new Date(nextRefreshAt).getTime() > now) return;
    void load();
  }, [load, now, nextRefreshAt]);

  /** นับจำนวนใบที่มีอยู่แล้วของนักเตะแต่ละคน ไว้โชว์ป้าย "มีแล้ว" */
  const ownedByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    ownedCards.forEach(({ player }) => {
      counts.set(player.id, (counts.get(player.id) ?? 0) + 1);
    });
    return counts;
  }, [ownedCards]);

  /** ของทั้งหมดที่ยังซื้อได้ (ตัดใบที่หมดเวลาระหว่างเปิดหน้าค้างไว้ออกด้วย) */
  const allOffers = useMemo<MarketOffer[]>(
    () =>
      listings
        .filter((listing) => isListingLive(listing, now))
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
    [coins, listings, now, ownedByPlayer],
  );

  /** ใบเด่นประจำวัน (ทุกคนเห็นใบเดียวกัน) */
  const featured = useMemo(
    () => allOffers.find((offer) => offer.listing.featured) ?? null,
    [allOffers],
  );

  /** ของในตลาดหลังกรองและเรียงแล้ว (ไม่รวมใบเด่นที่โชว์แยกอยู่ข้างบน) */
  const offers = useMemo(() => {
    const normal = allOffers.filter((offer) => !offer.listing.featured);
    const kept = new Set(
      filterListings(
        normal.map((offer) => offer.listing),
        filter,
      ).map((listing) => listing.id),
    );

    const order = sortListings(
      normal.filter((offer) => kept.has(offer.listing.id)).map((offer) => offer.listing),
      sort,
    );

    return order.flatMap((listing) => {
      const found = normal.find((offer) => offer.listing.id === listing.id);
      return found ? [found] : [];
    });
  }, [allOffers, filter, sort]);

  /**
   * ซื้อหนึ่งใบ — คืน true เมื่อเซิร์ฟเวอร์ยืนยันแล้วเท่านั้น
   *
   * ทุกกรณีที่ล้มเหลว (โดนคนอื่นตัดหน้า / หมดเวลา / เงินไม่พอ) เซิร์ฟเวอร์เป็นคนบอก
   * หน้าเว็บแค่เอาข้อความมาแสดงแล้วโหลดของใหม่ให้ตรงกับความจริง
   */
  const buy = useCallback(
    async (offer: MarketOffer): Promise<boolean> => {
      if (buyingId) return false;

      setBuyingId(offer.listing.id);
      setError(null);

      try {
        const response = await callBuyMarketListing({
          listingId: offer.listing.id,
          requestId: createMarketRequestId(),
        });

        applyMarketPurchase({ coins: response.coins, card: response.card });

        // ปิดใบนี้ในจอทันที ไม่ต้องรอโหลดรอบใหม่
        setListings((current) =>
          current.map((entry) =>
            entry.id === offer.listing.id ? { ...entry, status: 'SOLD' as const } : entry,
          ),
        );

        reportMarketPurchase({
          playerId: response.result.playerId,
          listingId: response.result.listingId,
          price: response.result.price,
          cardId: response.result.cardId,
          at: response.result.at,
        });

        setPurchase({ player: offer.player, price: response.result.price, at: response.result.at });
        playSfx('coin');
        return true;
      } catch (caught) {
        setError(serverErrorMessage(caught));
        playSfx('error');
        // ของอาจถูกคนอื่นซื้อไปแล้ว — ดึงของจริงมาใหม่เพื่อไม่ให้จอค้างกับข้อมูลเก่า
        void load();
        return false;
      } finally {
        setBuyingId(null);
      }
    },
    [applyMarketPurchase, buyingId, load, reportMarketPurchase],
  );

  return {
    /** true = ตลาดใช้งานได้ (ต่อออนไลน์อยู่) */
    available: MARKET_AVAILABLE,
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
    nextRefreshAt,
    /** วินาทีที่เหลือก่อนของชุดใหม่จะเข้า */
    secondsToRefresh: nextRefreshAt
      ? Math.max(0, Math.floor((new Date(nextRefreshAt).getTime() - now) / 1000))
      : 0,
    reload: load,
    buy,
    dismissPurchase: () => setPurchase(null),
    clearError: () => setError(null),
    resetFilter: () => setFilter(DEFAULT_FILTER),
  };
};
