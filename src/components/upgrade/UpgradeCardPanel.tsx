/**
 * หน้าอัปเกรดนักเตะ — เลย์เอาต์สามคอลัมน์ตามแบบที่ให้มา
 *
 *   ซ้าย  = การ์ด + OVR ปัจจุบัน ▸ OVR ถัดไป + ค่าพลังพร้อมส่วนต่าง + ข้อมูลการ์ด
 *   กลาง  = โบนัสสะสม (โล่ 1–5) · ช่องนักเตะในการอัปเกรด · ไอเทมช่วยอัปเกรด · ปุ่มอัปเกรด
 *   ขวา   = โล่โอกาสสำเร็จ · ตารางข้อมูลอัปเกรด · กฎการอัปเกรด
 *
 * ⚠️ ค่าอัปเกรดคือ "การ์ดนักเตะ" ไม่ใช่แต้มตีบวกแล้ว (ดู src/data/upgradeConfig.ts)
 * ตัวเลขทุกตัวมาจาก Attribute Engine กับตารางอัปเกรดกลาง ไม่มี hardcode สักตัว
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { StreakTrack } from '@/components/upgrade/StreakTrack';
import { Hex, SHIELD_CLIP } from '@/components/upgrade/UpgradeShapes';
import {
  MATERIAL_CARD_BOOST,
  MATERIAL_CARD_SLOTS,
  MAX_UPGRADE,
  ITEM_SHOP_ICON,
  UPGRADE_ITEMS,
  clampStreak,
  getFinalSuccessRate,
  getRequiredMaterialCards,
  getUpgradeOdds,
  getUpgradeStep,
  type UpgradeItemId,
  type UpgradeItemStock,
} from '@/data/upgradeConfig';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { getCardUpgrade, isCardLocked } from '@/services/cardInstance';
import { SERVER_AUTHORITY, serverErrorMessage } from '@/services/firebase/gameServer';
import { callUpgradeCard, createUpgradeRequestId } from '@/services/firebase/upgradeServer';
import {
  getEffectivePlayer,
  getEffectivePlayerOvr,
  getEffectivePlayerStats,
  previewNextUpgrade,
} from '@/services/playerAttributes';
import { getSalvageValue } from '@/services/salvage';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { PlayerStats } from '@/types/player';
import { cn, formatNumber } from '@/utils/helpers';

/** ระยะเวลาที่หลอดวิ่งก่อนเฉลยผล (มิลลิวินาที) */
const ROLL_DURATION_MS = 3_200;

/** เส้นโค้งความเร็ว — เร่งช่วงแรก คลานช่วงท้าย ให้ความลุ้นไปกองอยู่ตอนจบ */
const easeOutRoll = (t: number): number => 1 - Math.pow(1 - t, 3.2);

/** ชื่อไทยของค่าพลังตามลำดับที่โชว์ในแบบ */
const STAT_ROWS: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: 'pace', label: 'ความเร็ว' },
  { key: 'shooting', label: 'พลังการยิง' },
  { key: 'passing', label: 'ส่งบอล' },
  { key: 'dribbling', label: 'เลี้ยงบอล' },
  { key: 'defending', label: 'ป้องกัน' },
  { key: 'physical', label: 'พละกำลัง' },
];

interface UpgradeCardPanelProps {
  /** การ์ดที่เลือกอยู่ — null = ยังไม่ได้เลือก */
  card: PlayerCardData | null;
  /** การ์ดที่ใส่ไว้ในช่องแล้ว (ยาวไม่เกิน MATERIAL_CARD_SLOTS) */
  materialCards?: PlayerCardData[];
  /** เปิดหน้าต่างเลือกนักเตะที่จะอัปเกรด */
  onPickTarget?: () => void;
  /** เปิดหน้าต่างเลือกการ์ดใส่ช่อง */
  onPickMaterial?: () => void;
  /** เอาการ์ดออกจากช่อง */
  onRemoveMaterial?: (cardId: string) => void;
  /** ล้างช่องทั้งหมด (เรียกหลังอัปเกรดจบ เพราะการ์ดถูกใช้ไปแล้ว) */
  onClearMaterials?: () => void;
  /** เปิดร้านไอเทม */
  onOpenShop?: () => void;
}

export const UpgradeCardPanel = ({
  card,
  materialCards = [],
  onPickTarget,
  onPickMaterial,
  onRemoveMaterial,
  onClearMaterials,
  onOpenShop,
}: UpgradeCardPanelProps) => {
  const { coins, upgradeItems, upgradeCard, applyServerUpgrade } = usePlayers();
  const { upgradeScene } = useGameConfig();

  /** ไอเทมที่ติดไว้สำหรับการกดครั้งนี้ */
  const [picked, setPicked] = useState<UpgradeItemStock>({ boost: 0, protect: 0, guarantee: 0 });
  const [rolling, setRolling] = useState(false);
  const [progress, setProgress] = useState(0);
  /**
   * ภาพการ์ด ณ ตอนกดปุ่ม — ค้างไว้ตลอดที่หลอดยังวิ่ง
   *
   * ⚠️ จำเป็นจริง ๆ: ทั้งทางออฟไลน์และทางเซิร์ฟเวอร์เขียนค่าใหม่ลงคลังทันที
   * ที่ทำรายการเสร็จ ซึ่งเร็วกว่าหลอดมาก ถ้าเรนเดอร์จากการ์ดสด ๆ
   * ตัวเลข OVR จะเด้งเป็นค่าใหม่ตั้งแต่หลอดยังไม่ทันวิ่ง = สปอยล์ผลก่อนเฉลย
   */
  const [frozen, setFrozen] = useState<PlayerCardData | null>(null);
  const [outcome, setOutcome] = useState<'success' | 'fail' | 'protected' | null>(null);
  const [message, setMessage] = useState('');

  /**
   * หลอดกับผลจากเซิร์ฟเวอร์มาถึงคนละเวลา จึงต้องรอให้ครบทั้งสองอย่างก่อนเฉลย
   * ใช้ ref เพราะทั้งสองฝั่งเป็น callback คนละสาย มองเห็น state ล่าสุดไม่ได้
   */
  const barFilled = useRef(false);
  const pendingOutcome = useRef<'success' | 'fail' | 'protected' | null>(null);
  const frame = useRef<number | null>(null);

  // เปลี่ยนการ์ดที่เลือก = ล้างผลรอบก่อนกับไอเทมที่ติดไว้ทิ้ง
  useEffect(() => {
    setOutcome(null);
    setMessage('');
    setPicked({ boost: 0, protect: 0, guarantee: 0 });
  }, [card?.id]);

  // กันไม่ให้เฟรมที่ค้างอยู่ยิง setState หลังคอมโพเนนต์ถูกถอดออกแล้ว
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /* ระหว่างหลอดวิ่งให้ทุกอย่างอ่านจากภาพนิ่ง ไม่ใช่การ์ดสดที่เปลี่ยนไปแล้ว */
  const shown = rolling && frozen ? frozen : card;

  const player = shown ? getEffectivePlayer(shown) : null;
  const currentStats = shown ? getEffectivePlayerStats(shown) : null;

  const upgrade = shown ? getCardUpgrade(shown) : 0;
  const step = useMemo(() => (shown ? getUpgradeStep(upgrade) : null), [shown, upgrade]);
  const preview = shown ? previewNextUpgrade(shown) : null;
  const currentOvr = shown ? getEffectivePlayerOvr(shown) : 0;
  const streak = clampStreak(shown?.upgradeStreak);

  const required = getRequiredMaterialCards(step);
  /**
   * การ์ดที่ใส่เกินจากที่ขั้นนั้นบังคับ = ส่วนที่แปลงเป็นโบนัสโอกาส
   * ค่าเริ่มต้นตอนนี้ไม่บังคับสักใบ (required = 0) การ์ดทุกใบที่ใส่จึงเป็นโบนัสล้วน
   */
  const bonusCards = Math.max(0, materialCards.length - required);
  const extraCards = bonusCards;

  const successRate = getFinalSuccessRate(step, {
    extraCards,
    boostItems: picked.boost,
    useGuarantee: picked.guarantee > 0,
    streak,
  });
  const odds = getUpgradeOdds(step, {
    extraCards,
    boostItems: picked.boost,
    useProtect: picked.protect > 0,
    useGuarantee: picked.guarantee > 0,
    streak,
  });

  const locked = shown ? isCardLocked(shown) : false;
  const maxed = !step || !preview;
  const enoughCards = materialCards.length >= required;
  const notEnoughCoins = step ? coins < step.coinCost : false;
  const canPress = Boolean(card) && !locked && !maxed && enoughCards && !notEnoughCoins && !rolling;

  /** ข้อความสถานะใต้ปุ่ม */
  const statusText = message
    ? message
    : rolling
      ? 'กำลังลุ้นผล…'
      : outcome === 'success'
        ? `อัปเกรดสำเร็จ! ตอนนี้ +${card ? getCardUpgrade(card) : upgrade}`
        : outcome === 'protected'
          ? 'ไม่สำเร็จ — แต่ไอเทมป้องกันทำงาน ขั้นไม่ลด'
          : outcome === 'fail'
            ? (step?.dropOnFail ?? 0) > 0
              ? 'ไม่สำเร็จ — ขั้นลดลง 1'
              : 'ไม่สำเร็จ — ขั้นเท่าเดิม แต่การ์ดที่ใส่หายไปแล้ว'
            : !card
              ? 'เลือกนักเตะที่จะอัปเกรดก่อน'
              : locked
                ? 'การ์ดใบนี้ถูกล็อกไว้'
                : maxed
                  ? `อัปเกรดจนสุดแล้ว (+${MAX_UPGRADE})`
                  : !enoughCards
                    ? `ใส่นักเตะให้ครบ ${required} ใบก่อน`
                    : notEnoughCoins
                      ? 'BP ไม่พอ'
                      : materialCards.length > 0
                        ? 'การ์ดที่ใส่ในช่องจะหายไปทุกกรณี ไม่ว่าจะสำเร็จหรือไม่'
                        : 'ไม่ใส่การ์ดก็อัปเกรดได้ · ใส่แล้วเพิ่มโอกาสใบละ ' +
                          `${Math.round(MATERIAL_CARD_BOOST * 100)}%`;

  /** เฉลยผล — ทำงานจริงตอนครบทั้งหลอดและผลเท่านั้น */
  const settle = () => {
    const next = pendingOutcome.current;
    if (!barFilled.current || !next) return;

    pendingOutcome.current = null;
    setRolling(false);
    setFrozen(null);
    setOutcome(next);
    playSfx(next === 'success' ? 'upgradeSuccess' : 'upgradeFail');
    onClearMaterials?.();
    setPicked({ boost: 0, protect: 0, guarantee: 0 });
  };

  /**
   * เริ่มวิ่งหลอด — ใช้ requestAnimationFrame แทน CSS transition
   * เพราะต้องรู้แน่ ๆ ว่า "ถึงปลายหลอดแล้ว" ถึงจะเฉลยผลได้ ไม่ใช่เดาจากเวลา
   */
  const startRoll = () => {
    barFilled.current = false;
    pendingOutcome.current = null;
    setFrozen(card);
    setProgress(0);
    setRolling(true);

    const startedAt = performance.now();
    playSfx('upgradeRoll');

    const tick = (now: number) => {
      const time = Math.min(1, (now - startedAt) / ROLL_DURATION_MS);
      setProgress(easeOutRoll(time));

      if (time < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }

      frame.current = null;
      barFilled.current = true;
      settle();
    };

    frame.current = requestAnimationFrame(tick);
  };

  /** หยุดหลอดกลางคันเมื่อคำขอถูกปฏิเสธ */
  const abortRoll = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    barFilled.current = false;
    pendingOutcome.current = null;
    setRolling(false);
    setFrozen(null);
    setProgress(0);
  };

  const handleUpgrade = async () => {
    if (!card || !step || rolling) return;

    setMessage('');
    setOutcome(null);
    startRoll();

    const materialCardIds = materialCards.map((entry) => entry.id);

    try {
      if (SERVER_AUTHORITY) {
        /*
         * รหัสคำขอสร้างครั้งเดียวต่อการกดหนึ่งครั้ง
         * ยิงซ้ำอัตโนมัติของ SDK ใช้รหัสเดิม เซิร์ฟเวอร์จึงไม่หักซ้ำ
         */
        const response = await callUpgradeCard({
          cardId: card.id,
          requestId: createUpgradeRequestId(),
          materialCardIds,
          useProtect: picked.protect > 0,
        });

        applyServerUpgrade({
          cardId: card.id,
          coins: response.coins,
          upgradePoints: response.upgradePoints,
          protectCards: response.protectCards,
          card: response.card,
          consumedCardIds: response.consumedCardIds,
        });

        pendingOutcome.current = response.result.success
          ? 'success'
          : response.result.protectUsed
            ? 'protected'
            : 'fail';
        settle();
      } else {
        const result = upgradeCard({ cardId: card.id, materialCardIds, items: picked });
        if (!result.ok) {
          abortRoll();
          setMessage(result.reason ?? 'อัปเกรดไม่สำเร็จ');
          return;
        }

        pendingOutcome.current = result.success
          ? 'success'
          : result.protectUsed
            ? 'protected'
            : 'fail';
        settle();
      }
    } catch (error) {
      abortRoll();
      setMessage(serverErrorMessage(error));
    }
  };

  /** ปุ่ม "เลือกอัตโนมัติ" — ใส่ไอเทมที่มีให้เต็มเพดานของแต่ละชนิด */
  const autoPickItems = () => {
    playSfx('click');
    setPicked({
      boost: Math.min(upgradeItems.boost, 3),
      protect: Math.min(upgradeItems.protect, 1),
      // การันตีขั้นเป็นของหายาก ไม่ใส่ให้เองเด็ดขาด ต้องกดเลือกเอง
      guarantee: 0,
    });
  };

  /** กดไอเทมหนึ่งครั้ง = ใส่เพิ่มหนึ่งชิ้น กดจนเกินเพดานแล้ววนกลับเป็นศูนย์ */
  const toggleItem = (id: UpgradeItemId, max: number) => {
    if (upgradeItems[id] < 1) {
      playSfx('error');
      onOpenShop?.();
      return;
    }

    playSfx('click');
    setPicked((current) => {
      const ceiling = Math.min(max, upgradeItems[id]);
      const next = current[id] + 1;
      return { ...current, [id]: next > ceiling ? 0 : next };
    });
  };

  return (
    <section
      className="glass-panel relative overflow-hidden p-3 sm:p-4"
      style={
        upgradeScene.backgroundUrl
          ? {
              backgroundImage: `linear-gradient(rgba(6,10,20,0.86), rgba(6,10,20,0.94)), url(${upgradeScene.backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,290px)]">
        {/* ══════════ ซ้าย: การ์ด + ค่าพลัง + ข้อมูล ══════════ */}
        <div className="rounded-xl border border-white/10 bg-black/35 p-4">
          {!player || !currentStats || !shown ? (
            <div className="flex h-full min-h-[340px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-chalk/45">ยังไม่ได้เลือกนักเตะ</p>
              <button
                type="button"
                onClick={onPickTarget}
                className="rounded-lg bg-neon px-4 py-2 text-sm font-bold text-ink-900"
              >
                เลือกนักเตะ
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start gap-4">
                <button
                  type="button"
                  onClick={onPickTarget}
                  title="กดเพื่อเปลี่ยนนักเตะ"
                  className={cn(
                    'relative shrink-0 rounded-lg transition-transform hover:-translate-y-0.5',
                    rolling && 'animate-pulse',
                  )}
                >
                  <PlayerCard player={player} size="lg" level={shown.level} />
                  <span className="mt-1 block text-center text-[10px] uppercase tracking-wide text-chalk/40">
                    เปลี่ยนนักเตะ
                  </span>
                </button>

                <div className="min-w-[190px] flex-1">
                  {/* OVR ปัจจุบัน ▸ OVR หลังอัปเกรด */}
                  <div className="flex items-end gap-3 border-b border-white/10 pb-3">
                    <div>
                      <p className="eyebrow">OVR</p>
                      <p className="font-display text-4xl leading-none">{currentOvr}</p>
                    </div>
                    <span className="pb-1 text-2xl leading-none text-neon">›</span>
                    <div>
                      <p className="eyebrow text-neon/80">OVR {maxed ? '' : '+1'}</p>
                      <p className="font-display text-4xl leading-none text-neon">
                        {preview?.ovr ?? currentOvr}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {STAT_ROWS.map(({ key, label }) => {
                      const now = currentStats[key];
                      const next = preview?.stats[key] ?? now;
                      const delta = next - now;

                      return (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-chalk/55">{label}</span>
                          <span className="flex items-center gap-3 font-mono">
                            <span className="text-chalk/90">{now}</span>
                            <span
                              className={cn(
                                'w-7 text-right',
                                delta > 0 ? 'text-neon' : 'text-chalk/20',
                              )}
                            >
                              {delta > 0 ? `+${delta}` : '—'}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ข้อมูลการ์ด — สี่บรรทัดตามแบบ */}
              <dl className="mt-4 divide-y divide-white/[0.07] border-t border-white/10 text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-chalk/55">มูลค่านักเตะ</dt>
                  <dd className="flex items-center gap-1.5 font-mono">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-gold text-[9px] font-bold text-ink-900">
                      B
                    </span>
                    {formatNumber(getSalvageValue(player, shown.level))}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-chalk/55">อัปเกรดครั้งก่อน</dt>
                  <dd className="font-mono text-chalk/70">
                    {outcome === 'success'
                      ? 'สำเร็จ'
                      : outcome === 'protected'
                        ? 'ป้องกันไว้'
                        : outcome === 'fail'
                          ? 'ล้มเหลว'
                          : '-'}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-chalk/55">ระดับอัปเกรด</dt>
                  <dd>
                    <span className="rounded border border-gold/60 bg-gold/10 px-2 py-0.5 font-display text-xs text-gold">
                      +{upgrade}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-chalk/55">สิทธิ์อัปเกรด</dt>
                  <dd className="text-chalk/70">ไม่จำกัด</dd>
                </div>
              </dl>
            </>
          )}
        </div>

        {/* ══════════ กลาง: โบนัสสะสม + ช่องนักเตะ + ไอเทม + ปุ่ม ══════════ */}
        <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/25 p-4">
          {/* โบนัสสะสม (โล่ 1–5) — ดู components/upgrade/StreakTrack.tsx */}
          <StreakTrack streak={streak} />

          {/* ช่องนักเตะในการอัปเกรด */}
          <div className="border-t border-white/10 pt-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-sm text-chalk/75">นักเตะในการอัปเกรด</p>
              <p
                className={cn(
                  'font-mono text-[11px]',
                  !enoughCards ? 'text-rose-300' : bonusCards > 0 ? 'text-neon' : 'text-chalk/40',
                )}
              >
                {required > 0
                  ? `${materialCards.length}/${required} ใบ`
                  : `${materialCards.length}/${MATERIAL_CARD_SLOTS} ใบ`}
                {bonusCards > 0 && (
                  <span className="text-neon">
                    {' '}
                    · +{Math.round(bonusCards * MATERIAL_CARD_BOOST * 100)}%
                  </span>
                )}
              </p>
            </div>

            {/* ชิดล่าง เพราะการ์ดจริงกับกรอบหกเหลี่ยมสูงไม่เท่ากัน — ชิดล่างแล้วบรรทัดคำอธิบายตรงกัน */}
            <div className="flex items-end justify-between gap-1.5">
              {Array.from({ length: MATERIAL_CARD_SLOTS }).map((_, slot) => {
                const filled = materialCards[slot];
                /** ช่องที่เกินจำนวนบังคับ = ใส่ก็ได้ ไม่ใส่ก็ได้ (ใส่แล้วได้โบนัสโอกาส) */
                const optional = slot >= required;

                /*
                 * ช่องที่มีการ์ดแล้วโชว์ "ตัวการ์ดเลย" ไม่ครอบหกเหลี่ยม
                 * กรอบหกเหลี่ยมมีไว้บอกว่าช่องยังว่างเท่านั้น พอมีการ์ดจริงแล้ว
                 * กรอบจะบังหน้าการ์ดจนดูไม่ออกว่าใส่ใครไป
                 */
                if (filled) {
                  const facePlayer = getEffectivePlayer(filled);

                  return (
                    <button
                      key={filled.id}
                      type="button"
                      onClick={() => {
                        playSfx('click');
                        onRemoveMaterial?.(filled.id);
                      }}
                      title={`${facePlayer?.name ?? ''} — กดเพื่อเอาออก`}
                      className="group min-w-0 flex-1"
                    >
                      <span className="flex justify-center">
                        {facePlayer && (
                          <PlayerCard
                            player={facePlayer}
                            size="xs"
                            level={filled.level}
                            className="transition-transform group-hover:-translate-y-0.5"
                          />
                        )}
                      </span>
                      <span className="mt-1 block truncate text-center text-[10px] text-neon/80">
                        เอาออก
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={`empty-${slot}`}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      onPickMaterial?.();
                    }}
                    aria-label="เลือกนักเตะใส่ช่องอัปเกรด"
                    className="min-w-0 flex-1"
                  >
                    <span className="flex justify-center">
                      <Hex
                        width={68}
                        edgeClass={optional ? 'bg-white/10' : 'bg-white/25'}
                        fillClass="bg-white/[0.04]"
                      >
                        <span className="text-2xl leading-none text-chalk/30">+</span>
                      </Hex>
                    </span>
                    <span className="mt-1 block truncate text-center text-[10px] text-chalk/40">
                      {optional ? 'เพิ่มโอกาส' : 'เลือกนักเตะ'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ไอเทมช่วยอัปเกรด */}
          <div className="border-t border-white/10 pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm text-chalk/75">ไอเทมช่วยอัปเกรด</p>
              <button
                type="button"
                onClick={autoPickItems}
                className="rounded-full border border-neon/50 px-3 py-1 text-[11px] text-neon transition-colors hover:bg-neon/10"
              >
                เลือกอัตโนมัติ
              </button>
            </div>

            <div className="flex items-start gap-2">
              {UPGRADE_ITEMS.map((item) => {
                const owned = upgradeItems[item.id];
                const used = picked[item.id];
                const active = used > 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(item.id, item.maxPerAttempt)}
                    title={`${item.name} — ${item.hint}`}
                    className="min-w-0 flex-1"
                  >
                    {/*
                      ไอคอนไอเทมมีกรอบและแสงมาในตัวรูปอยู่แล้ว จึงโชว์รูปตรง ๆ
                      ไม่ครอบหกเหลี่ยมทับ — เหมือนช่องการ์ดนักเตะด้านบน
                      ที่ยังใส่ไม่ครบจึงจางลง ส่วนที่ติดไว้แล้วเรืองแสงขึ้นมา
                    */}
                    <span className="relative flex h-[76px] items-center justify-center">
                      <img
                        src={item.icon}
                        alt=""
                        className={cn(
                          'h-[76px] w-auto object-contain transition-all',
                          active ? cn('scale-105', item.glow) : 'opacity-80 saturate-[0.85]',
                          owned < 1 && 'opacity-30 grayscale',
                        )}
                      />
                      {active && (
                        <span className="absolute -right-0.5 bottom-1 rounded bg-neon px-1 font-mono text-[10px] font-bold text-ink-900">
                          ×{used}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'mt-1 block truncate text-center text-[10px]',
                        active ? item.text : 'text-chalk/45',
                      )}
                    >
                      {item.name}
                    </span>
                    <span className="block text-center font-mono text-[10px] text-chalk/35">
                      x{formatNumber(owned)}
                    </span>
                  </button>
                );
              })}

              {/* ช่อง + = ไปร้านไอเทม */}
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  onOpenShop?.();
                }}
                aria-label="ร้านไอเทมช่วยอัปเกรด"
                className="min-w-0 flex-1"
              >
                <span className="flex h-[76px] items-center justify-center">
                  <img
                    src={ITEM_SHOP_ICON}
                    alt=""
                    className="h-[70px] w-auto object-contain opacity-85 transition-transform hover:scale-105"
                  />
                </span>
                <span className="mt-1 block text-center text-[10px] text-chalk/40">ร้านไอเทม</span>
              </button>
            </div>
          </div>

          {/* ปุ่มอัปเกรด */}
          <div className="mt-auto pt-1">
            <button
              type="button"
              aria-label="ยืนยันอัปเกรด"
              disabled={!canPress}
              onClick={handleUpgrade}
              className={cn(
                'relative w-full overflow-hidden rounded-lg py-3.5 font-display text-lg tracking-wide transition-colors',
                canPress
                  ? 'text-ink-900 hover:brightness-110'
                  : 'cursor-not-allowed bg-white/[0.06] text-chalk/30',
              )}
              style={
                canPress
                  ? { backgroundImage: 'linear-gradient(90deg, #1E9E4A 0%, #31E06D 100%)' }
                  : undefined
              }
            >
              {/* หลอดลุ้นผลวิ่งทับตัวปุ่ม */}
              {rolling && (
                <span
                  role="progressbar"
                  aria-label="ความคืบหน้าการอัปเกรด"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  className="absolute inset-y-0 left-0 bg-white/25"
                  style={{ width: `${progress * 100}%` }}
                />
              )}

              <span className="relative flex items-center justify-center gap-3">
                {rolling ? 'กำลังอัปเกรด…' : 'อัปเกรด'}
                {!rolling && (
                  <span className="flex items-center gap-1.5 font-mono text-sm">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-ink-900/40 text-[9px] font-bold">
                      B
                    </span>
                    {formatNumber(step?.coinCost ?? 0)}
                  </span>
                )}
              </span>
            </button>

            {/*
             * หลอดโหลดแยกใต้ปุ่ม
             *
             * ปุ่มถูกปิด (disabled) ระหว่างกำลังตี สีจึงจางลงจนหลอดที่วิ่งทับตัวปุ่ม
             * แทบมองไม่เห็น — หลอดนี้เลยเป็นตัวบอกความคืบหน้าตัวจริง
             * โผล่เฉพาะตอนกำลังตี แล้วยุบหายไปเองตอนเฉลยผล
             */}
            {rolling && (
              <div className="mt-2">
                <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neon/60 to-neon"
                    style={{ width: `${progress * 100}%` }}
                  />
                  {/* แถบวาว: บอกว่ายังทำงานอยู่ แม้หลอดจะคลานเกือบนิ่งช่วงท้าย */}
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                </div>
                <p className="mt-1 text-center font-mono text-[10px] text-neon/80">
                  {Math.round(progress * 100)}%
                </p>
              </div>
            )}

            <p
              role="status"
              className={cn(
                'mt-2 min-h-[1.1rem] text-center text-[11px]',
                outcome === 'success'
                  ? 'text-neon'
                  : outcome === 'protected'
                    ? 'text-sky-300'
                    : message || outcome === 'fail' || locked || notEnoughCoins
                      ? 'text-rose-300'
                      : 'text-chalk/45',
              )}
            >
              {statusText}
            </p>
          </div>
        </div>

        {/* ══════════ ขวา: โอกาส + ข้อมูล + กฎ ══════════ */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="mb-3 text-sm text-chalk/75">โอกาสอัปเกรด</p>

            <div className="relative mx-auto w-[142px]">
              <div style={SHIELD_CLIP} className="h-[158px] bg-gradient-to-b from-neon/70 to-neon/20" />
              <div
                style={SHIELD_CLIP}
                className="absolute inset-[2px] bg-gradient-to-b from-[#0d2a1a] to-[#071410]"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-display text-5xl leading-none text-neon drop-shadow-[0_0_12px_rgba(49,224,109,0.6)]">
                  {Math.round(successRate * 100)}%
                </p>
                <p className="mt-1 text-[11px] text-chalk/55">โอกาสสำเร็จ</p>
              </div>
            </div>
          </div>

          {/* ข้อมูลอัปเกรด — ห้าแถวตามแบบ */}
          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="mb-2 text-sm text-chalk/75">ข้อมูลอัปเกรด</p>
            <dl className="space-y-1.5 text-xs">
              {[
                { label: 'เพิ่มโอกาส', value: odds.success, tone: 'text-neon' },
                { label: 'ลดโอกาส', value: odds.bigDrop, tone: 'text-chalk/70' },
                { label: 'คงที่', value: odds.stay, tone: 'text-chalk/70' },
                { label: 'ลดขั้น', value: odds.drop, tone: 'text-chalk/70' },
                { label: 'ล้มเหลว', value: odds.destroy, tone: 'text-chalk/70' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <dt className="text-chalk/50">{row.label}</dt>
                  <dd className={cn('font-mono', row.tone)}>{Math.round(row.value * 100)}%</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* กฎการอัปเกรด */}
          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="mb-2 text-sm text-chalk/75">กฎการอัปเกรด</p>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-chalk/50">
              <li>อัปเกรดสำเร็จ +1 ขั้น</li>
              <li>อัปเกรดล้มเหลว ลดลง 1 ขั้น</li>
              <li>ใช้ไอเทมป้องกัน ลดโอกาสลดขั้น</li>
              <li>การ์ดนักเตะที่ใส่ในช่องหายทุกกรณี</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
