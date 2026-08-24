/**
 * ทำตามคำสั่งรีเซ็ตดาว/ซีซันที่แอดมินสั่งไว้
 *
 * แอดมินเขียนบัญชีของคนอื่นไม่ได้ (กฎ Firestore ล็อกไว้) การรีเซ็ตจึงทำแบบ
 * "แอดมินประทับเวลาคำสั่งไว้ที่ config/ladder แล้วเครื่องของแต่ละคนมารีเซ็ตตัวเอง"
 * เข้าเกมช้าแค่ไหนก็ยังโดนรีเซ็ตแน่นอนหนึ่งครั้งต่อคำสั่งหนึ่งใบ
 *
 * เรียกครั้งเดียวที่ MainLayout พอ
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { hasPendingReset, pointsAfterReset } from '@/services/admin';
import { playSfx } from '@/services/sound';

export const useLadderReset = (): void => {
  const { account, patchState } = useAuth();
  const { record, applyRecord } = useMatchmaking();
  const { ladder } = useGameConfig();

  /** ค่าล่าสุด เก็บใน ref เพื่อไม่ให้ effect วิ่งใหม่ทุกครั้งที่ดาวขยับ */
  const latest = useRef({ record, account });
  latest.current = { record, account };

  useEffect(() => {
    const current = latest.current.account;
    if (!current) return;
    if (!hasPendingReset(ladder, current.state.ladderResetAt)) return;

    // ดาวถูกหักตามสัดส่วนที่แอดมินตั้งไว้ · สถิติแพ้-ชนะเริ่มนับใหม่เสมอ
    applyRecord({
      points: pointsAfterReset(latest.current.record.points, ladder),
      wins: 0,
      draws: 0,
      losses: 0,
    });

    // จำว่าทำตามคำสั่งใบนี้ไปแล้ว ไม่งั้นจะรีเซ็ตซ้ำทุกครั้งที่เปิดเกม
    patchState({
      ladderResetAt: ladder.resetAt,
      ...(ladder.resetSeason
        ? {
            season: {
              number: (current.state.season?.number ?? 1) + 1,
              startedAt: new Date().toISOString(),
            },
          }
        : {}),
    });

    playSfx('whistle');
  }, [applyRecord, ladder, patchState]);
};
