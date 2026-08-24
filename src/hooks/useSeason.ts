/**
 * สถานะซีซันของผู้เล่น: นับเวลาถอยหลัง ตรวจว่าจบซีซันหรือยัง และจ่ายรางวัลตอนกดรับ
 *
 * ตรวจตอนเปิดแอปหนึ่งครั้ง แล้วตรวจซ้ำทุกนาที — ผู้เล่นที่เปิดค้างไว้ข้ามเที่ยงคืน
 * จึงเห็นหน้าจอสรุปซีซันขึ้นเองโดยไม่ต้องรีเฟรช
 *
 * รางวัล (เหรียญ + แต้ม + การ์ดตามอันดับ) จะยังไม่เข้าจนกว่าจะกดรับ
 * และซีซันใหม่เริ่มนับเวลาตอนกดรับเช่นกัน
 * (ถ้าหายไปหนึ่งเดือนแล้วกลับมา จะไม่โดนข้ามซีซันรวดเดียวหลายรอบ)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { usePlayers } from '@/hooks/usePlayers';
import { useMyRank } from '@/hooks/useLeaderboard';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useRankRewards } from '@/hooks/useRankRewards';
import {
  buildSeasonSummary,
  createSeasonState,
  getDaysLeft,
  isSeasonOver,
  nextSeason,
  resolveSeasonDays,
  type SeasonSummary,
} from '@/services/season';
import { playSfx } from '@/services/sound';

/** ความถี่ในการตรวจว่าซีซันจบหรือยัง (ms) */
const CHECK_MS = 60_000;

export const useSeason = () => {
  const { account, patchState } = useAuth();
  const { record, applyRecord } = useMatchmaking();
  const { addCoins, addPoints, addCards } = usePlayers();
  /** การ์ดรางวัลของอันดับ 1–10 ที่เจ้าของโปรเจคตั้งไว้ */
  const { cards: rankRewardCards } = useRankRewards();
  /** ความยาวซีซันที่แอดมินตั้งไว้ (ไม่ได้ตั้ง = ใช้ค่าเริ่มต้นในโค้ด) */
  const { ladder } = useGameConfig();
  const seasonDays = resolveSeasonDays(ladder.seasonDays);
  // (ค่าพลังทีมถูกใช้ผ่าน useMyRank แล้ว จึงไม่ต้องอ่านซ้ำที่นี่)
  /** อันดับปัจจุบันในตาราง (รวมผู้เล่นจริงจากเซิร์ฟเวอร์) ใช้ตัดสินโบนัสของผู้จบอันดับ 1 */
  const currentRank = useMyRank();

  /** บัญชีเก่าที่สมัครก่อนมีระบบซีซันจะยังไม่มีค่านี้ — เติมให้จากวันที่สมัคร */
  const season = useMemo(
    () => account?.state.season ?? createSeasonState(account?.createdAt),
    [account?.createdAt, account?.state.season],
  );

  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [daysLeft, setDaysLeft] = useState(() => getDaysLeft(season, new Date(), seasonDays));

  // ตรวจตอนเปิดแอป แล้วตรวจซ้ำเรื่อย ๆ ระหว่างเปิดค้างไว้
  useEffect(() => {
    const check = () => {
      setDaysLeft(getDaysLeft(season, new Date(), seasonDays));
      if (isSeasonOver(season, new Date(), seasonDays)) {
        // ตั้งครั้งเดียว: ถ้ามีสรุปค้างอยู่แล้วอย่าทับ เพราะเลขอันดับอาจขยับระหว่างรอกดรับ
        setSummary(
          (current) => current ?? buildSeasonSummary(season, record, currentRank, rankRewardCards),
        );
      }
    };

    check();
    const id = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(id);
  }, [currentRank, rankRewardCards, record, season, seasonDays]);

  /** กดรับรางวัล: เงินและแต้มเข้าบัญชี คะแนนรีเซ็ตบางส่วน แล้วขึ้นซีซันใหม่ */
  const claim = useCallback(() => {
    if (!summary) return;

    addCoins(summary.reward.coins);
    addPoints(summary.reward.points);
    // การ์ดตามอันดับเข้าคลังตอนกดรับเท่านั้น ไม่ได้เข้าตั้งแต่ตอนสรุป
    addCards(summary.cardReward.cards);
    applyRecord(summary.nextRecord);
    patchState({ season: nextSeason(season) });
    setSummary(null);
    playSfx('rankUp');
  }, [addCards, addCoins, addPoints, applyRecord, patchState, season, summary]);

  return { season, daysLeft, summary, claim };
};
