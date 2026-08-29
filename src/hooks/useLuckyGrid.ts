/**
 * กล่องสุ่มรางวัลแบบตาราง ฝั่งผู้เล่น (ขนาดตารางแอดมินตั้งเอง)
 *
 * หนึ่งครั้งที่กดสุ่ม = หักเหรียญ → สุ่มเปิดหนึ่งช่องที่ยังไม่เปิด → จ่ายรางวัลเข้าคลังทันที
 * ราคาสุ่มแพงขึ้นทุกครั้ง (ดู drawCost) และแต่ละช่องเปิดได้ครั้งเดียวต่อรอบ
 *
 * ความคืบหน้าเก็บลงบัญชีผ่าน patchState จึงไม่หายเวลารีเฟรชหรือย้ายเครื่อง
 * แอดมินกด "เริ่มรอบใหม่" (round +1) เมื่อไหร่ ความคืบหน้าของทุกคนถูกล้างอัตโนมัติ
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPlayerById } from '@/data/players';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import {
  createProgress,
  drawCost,
  grandIndexOf,
  isGridClosed,
  normalizeProgress,
  rewardAt,
  secondsUntilClose,
  totalSlotsOf,
} from '@/services/luckyGrid';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { LuckyReward } from '@/types/lucky';
import type { Player } from '@/types/player';
import { createId } from '@/utils/helpers';

/** ผลของการสุ่มหนึ่งครั้ง ใช้เปิดฉากเผยรางวัล */
export interface LuckyDrawResult {
  /** ช่องที่เปิดได้ (เท่ากับ grandIndex = การ์ดใหญ่กลางตาราง) */
  index: number;
  reward: LuckyReward;
  /** นักเตะที่ได้ — มีเฉพาะตอนรางวัลเป็นการ์ด */
  player?: Player;
  card?: PlayerCardData;
  /** เหรียญที่จ่ายไปในครั้งนี้ */
  cost: number;
  /** เวลาที่สุ่ม ใช้เป็น key ให้แอนิเมชันเริ่มใหม่ทุกครั้ง */
  at: string;
}

export const useLuckyGrid = () => {
  const { account, patchState } = useAuth();
  const { luckyGrid: config } = useGameConfig();
  const { coins, spendCoins, addCoins, addPoints, addUpgradePoints, addCards } = usePlayers();

  /*
   * จำนวนช่องทั้งหมดขึ้นกับขนาดตารางที่แอดมินตั้งไว้ จึงต้องคิดใหม่ทุกครั้งที่ config เปลี่ยน
   * และใช้เป็นกรอบตัดช่องที่หลุดนอกตาราง เผื่อแอดมินย่อตารางกลางรอบ
   */
  const grandIndex = grandIndexOf(config);
  const totalSlots = totalSlotsOf(config);

  const [progress, setProgress] = useState(() =>
    normalizeProgress(account?.state.luckyGrid, config.round, totalSlots),
  );
  const [result, setResult] = useState<LuckyDrawResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** นาฬิกาเดินทุกวินาที ใช้นับถอยหลังเวลาปิดกล่อง */
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  /** แอดมินขึ้นรอบใหม่ = ล้างความคืบหน้าเก่าทิ้งแล้วเซฟทับ */
  useEffect(() => {
    if (progress.round === config.round) return;
    const fresh = createProgress(config.round);
    setProgress(fresh);
    patchState({ luckyGrid: fresh });
  }, [config.round, patchState, progress.round]);

  /* ตัดช่องที่เกินตารางออกตอนแสดงผลด้วย เผื่อ config เพิ่งย่อลงแต่ยังไม่ได้ขึ้นรอบใหม่ */
  const opened = useMemo(
    () => new Set(progress.opened.filter((index) => index < totalSlots)),
    [progress.opened, totalSlots],
  );

  const now = nowSeconds * 1000;
  const closed = isGridClosed(config, now);
  const secondsLeft = secondsUntilClose(config, now);
  const cost = drawCost(config, progress.draws);
  const remaining = totalSlots - opened.size;
  const complete = remaining === 0;

  /** จ่ายรางวัลหนึ่งช่องเข้าคลัง คืนข้อมูลการ์ดถ้ารางวัลเป็นการ์ด */
  const grant = useCallback(
    (reward: LuckyReward): { player?: Player; card?: PlayerCardData } => {
      if (reward.type === 'card') {
        const player = getPlayerById(reward.playerId ?? '');
        if (!player) return {};

        const card: PlayerCardData = {
          id: createId('lucky'),
          playerId: player.id,
          acquiredAt: new Date().toISOString(),
          level: 1,
          // ไม่ลงตัวจริงอัตโนมัติ ให้ผู้เล่นเลือกจัดเอง (กันชนกฎห้ามชื่อซ้ำ)
          inSquad: false,
        };

        addCards([card]);
        return { player, card };
      }

      const amount = reward.amount ?? 0;
      if (reward.type === 'coins') addCoins(amount);
      else if (reward.type === 'points') addPoints(amount);
      else addUpgradePoints(amount);

      return {};
    },
    [addCards, addCoins, addPoints, addUpgradePoints],
  );

  const draw = useCallback(() => {
    if (!config.enabled) {
      setError('ตอนนี้กล่องสุ่มปิดอยู่');
      playSfx('error');
      return false;
    }

    if (isGridClosed(config, Date.now())) {
      setError('กล่องใบนี้หมดเวลาแล้ว');
      playSfx('error');
      return false;
    }

    if (!config.grandPlayerId) {
      setError('กล่องนี้ยังตั้งค่าไม่เสร็จ — รอทีมงานอีกสักครู่');
      playSfx('error');
      return false;
    }

    /*
     * เก็บครบทุกช่องแล้ว = จบรอบ ห้ามสุ่มต่อเด็ดขาด
     * ต้องรอแอดมินกด "เริ่มรอบใหม่" (round +1) เท่านั้น ไม่มีการรีเซ็ตเองอัตโนมัติ
     * ถ้าปล่อยให้รีเซ็ตเอง ผู้เล่นจะวนเก็บรางวัลชุดเดิมซ้ำได้ไม่จำกัด
     */
    const base = progress;
    if (base.opened.length >= totalSlots) {
      setError('เก็บรางวัลครบทุกช่องแล้ว — รอทีมงานเปิดกล่องรอบใหม่');
      playSfx('error');
      return false;
    }

    const price = drawCost(config, base.draws);
    if (!spendCoins(price)) {
      setError(`เหรียญไม่พอ — ต้องใช้ ${price.toLocaleString('en-US')} เหรียญ`);
      playSfx('error');
      return false;
    }

    // สุ่มจาก "ช่องที่ยังไม่เปิด" เท่านั้น ทุกช่องจึงมีโอกาสเท่ากันและไม่มีวันสุ่มซ้ำ
    const taken = new Set(base.opened);
    const pool: number[] = [];
    for (let index = 0; index < totalSlots; index += 1) {
      if (!taken.has(index)) pool.push(index);
    }

    const index = pool[Math.floor(Math.random() * pool.length)];
    const reward = rewardAt(config, index);
    const granted = grant(reward);

    const next = { round: config.round, opened: [...base.opened, index], draws: base.draws + 1 };
    setProgress(next);
    patchState({ luckyGrid: next });

    setError(null);
    setResult({ index, reward, ...granted, cost: price, at: new Date().toISOString() });
    /*
     * ไม่เล่นเสียงผลลัพธ์ตรงนี้ — หน้าเกมจะหมุนไฟแบบรูเล็ตก่อนแล้วค่อยเผยผล
     * ถ้าเล่นเสียง "ได้ของใหญ่" ตั้งแต่ตอนนี้ก็เท่ากับสปอยล์ก่อนไฟจะหยุด
     */
    return true;
  }, [config, grant, patchState, progress, spendCoins, totalSlots]);

  return {
    config,
    coins,
    /** index ของการ์ดใหญ่กลางตาราง (ขึ้นกับขนาดตาราง) */
    grandIndex,
    /** true = แอดมินเปิดเมนูนี้ไว้ และยังไม่หมดเวลา */
    open: config.enabled && !closed,
    closed,
    /** วินาทีที่เหลือก่อนกล่องปิด — null = ไม่มีกำหนด */
    secondsLeft,
    /** index ของช่องที่เปิดไปแล้ว */
    opened,
    /** สุ่มไปแล้วกี่ครั้งในรอบนี้ */
    draws: progress.draws,
    /** ราคาสุ่มครั้งถัดไป */
    cost,
    /** ยังเหลือรางวัลอีกกี่ช่อง */
    remaining,
    /** true = เก็บครบทุกช่องแล้ว */
    complete,
    /** จ่ายไหวไหม */
    affordable: coins >= cost,
    result,
    error,
    draw,
    dismissResult: () => setResult(null),
    clearError: () => setError(null),
  };
};
