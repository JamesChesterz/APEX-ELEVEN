/**
 * หน้าตีบวกการ์ด — เลย์เอาต์สามคอลัมน์ (PHASE 13.5)
 *
 *   ซ้าย  = สเตตัสปัจจุบัน + อัตราติด + สวิตช์การ์ดป้องกัน
 *   กลาง  = การ์ดที่กำลังตี + ช่องใส่การ์ดช่วย (กด + เพื่อเพิ่ม)
 *   ขวา   = สเตตัสถัดไปพร้อมส่วนต่าง ▲
 *   ล่าง  = หลอดขั้นการตีบวก + ค่าใช้จ่าย + ปุ่มตีบวก
 *
 * ตัวเลขทุกตัวมาจาก Attribute Engine กับตารางตีบวกกลาง ไม่มี hardcode สักตัว
 * เมื่อ VITE_SERVER_AUTHORITY=1 การกดปุ่มจะยิงไปที่ Cloud Function
 */
import { useEffect, useRef, useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { MaxUpgradeFrame } from '@/components/upgrade/MaxUpgradeFrame';
import {
  MATERIAL_CARD_SLOTS,
  MAX_UPGRADE,
  getBoostedSuccessRate,
  getUpgradeStep,
} from '@/data/upgradeConfig';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePlayers } from '@/hooks/usePlayers';
import { getCardUpgrade, isCardLocked } from '@/services/cardInstance';
import { SERVER_AUTHORITY, serverErrorMessage } from '@/services/firebase/gameServer';
import { callUpgradeCard, createUpgradeRequestId } from '@/services/firebase/upgradeServer';
import {
  getBasePlayer,
  getEffectivePlayer,
  getEffectivePlayerOvr,
  getEffectivePlayerStats,
  previewNextUpgrade,
} from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { PlayerStats } from '@/types/player';
import { cn, formatNumber } from '@/utils/helpers';

/** ระยะเวลาที่หลอดวิ่งก่อนเฉลยผล (มิลลิวินาที) */
const ROLL_DURATION_MS = 4_000;

/**
 * เส้นโค้งความเร็วของหลอด — เร่งช่วงแรก หน่วงช่วงท้าย
 *
 * ที่ไม่ใช้ความเร็วคงที่เพราะช่วงกลางหลอดไม่มีอะไรให้ลุ้น ยืดไปก็แค่รอเฉย ๆ
 * เส้นโค้งนี้พาหลอดไปถึงราว 90% ในครึ่งแรกของเวลา แล้วคลานอีก 10% สุดท้าย
 * ตลอดครึ่งหลัง — ความรู้สึก "จะติดไม่ติด" ไปกองอยู่ตรงที่มันควรอยู่
 *
 * ผลคือ 4 วิให้ความลุ้นมากกว่า 10 วิแบบสม่ำเสมอ และเสียเวลาจริงน้อยกว่าครึ่ง
 */
const easeOutRoll = (t: number): number => 1 - Math.pow(1 - t, 3.2);

/** เกินจุดนี้ถือว่าเข้าโค้งสุดท้าย — หลอดเปลี่ยนสีและเต้น */
const FINAL_STRETCH = 0.88;

/** จังหวะเสียงชาร์จตอนเริ่ม และตอนใกล้สุดหลอด (ถี่ขึ้นเพื่อเร่งความตึง) */
const SFX_GAP_START_MS = 1_100;
const SFX_GAP_END_MS = 260;

/** ชื่อไทยของค่าพลังตามลำดับที่โชว์บนการ์ด */
const STAT_ROWS: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: 'pace', label: 'ความเร็ว' },
  { key: 'shooting', label: 'พลังการยิง' },
  { key: 'passing', label: 'ส่งบอล' },
  { key: 'dribbling', label: 'เลี้ยงบอล' },
  { key: 'defending', label: 'ประกบตัว' },
  { key: 'physical', label: 'ทายภาพ' },
];

interface UpgradeCardPanelProps {
  /** การ์ดที่เลือกอยู่ — null = ยังไม่ได้เลือก */
  card: PlayerCardData | null;
  /** เปิดหน้าต่างเลือกการ์ดช่วย (กด + ตรงกลาง) */
  onPickMaterial?: (slotIndex: number) => void;
  /** การ์ดที่ใส่ไว้ในช่องช่วยแล้ว (ยาวไม่เกิน MATERIAL_CARD_SLOTS) */
  materialCards?: PlayerCardData[];
  /** เอาการ์ดช่วยออกจากช่อง */
  onRemoveMaterial?: (cardId: string) => void;
  /** ล้างช่องช่วยทั้งหมด (เรียกหลังตีบวกจบ เพราะการ์ดถูกใช้ไปแล้ว) */
  onClearMaterials?: () => void;
}

export const UpgradeCardPanel = ({
  card,
  onPickMaterial,
  materialCards = [],
  onRemoveMaterial,
  onClearMaterials,
}: UpgradeCardPanelProps) => {
  const { coins, upgradePoints, protectCards, upgradeCard, applyServerUpgrade } = usePlayers();
  const { upgradeScene } = useGameConfig();

  const [useProtect, setUseProtect] = useState(false);
  const [rolling, setRolling] = useState(false);
  /** ความคืบหน้าของหลอด 0–1 หลังผ่านเส้นโค้งความเร็วแล้ว */
  const [progress, setProgress] = useState(0);
  /** เวลาที่ผ่านไปจริง 0–1 — ใช้นับถอยหลัง เพราะ progress ถูก ease จนไม่ตรงเวลา */
  const [elapsed, setElapsed] = useState(0);
  /**
   * ภาพการ์ด ณ ตอนกดปุ่ม — ค้างไว้ตลอดที่หลอดยังวิ่ง
   *
   * ⚠️ จำเป็นจริง ๆ: ทั้งทางออฟไลน์และทางเซิร์ฟเวอร์เขียนค่าบวกใหม่ลงคลังทันที
   * ที่ทำรายการเสร็จ ซึ่งเร็วกว่าหลอดมาก ถ้าเรนเดอร์จากการ์ดสด ๆ
   * ช่องหลอดกับหัวข้อ "ตีบวก +2 ▸ +3" จะเด้งเป็นค่าใหม่ตั้งแต่หลอดยังไม่ทันวิ่ง
   * = สปอยล์ผลก่อนเฉลย
   */
  const [frozen, setFrozen] = useState<PlayerCardData | null>(null);
  const [outcome, setOutcome] = useState<'success' | 'fail' | 'protected' | null>(null);
  const [message, setMessage] = useState('');

  /**
   * หลอดกับผลจากเซิร์ฟเวอร์มาถึงคนละเวลา จึงต้องรอให้ครบทั้งสองอย่างก่อนเฉลย
   *   - หลอดวิ่งจบก่อน  → ค้างเต็มหลอดรอผลอยู่
   *   - ผลมาถึงก่อน     → เก็บไว้ในกระเป๋า รอหลอดวิ่งให้สุดก่อน
   * ใช้ ref เพราะทั้งสองฝั่งเป็น callback คนละสาย มองเห็น state ล่าสุดไม่ได้
   */
  const barFilled = useRef(false);
  const pendingOutcome = useRef<'success' | 'fail' | 'protected' | null>(null);
  const frame = useRef<number | null>(null);
  /** เวลาที่ต้องเล่นเสียงชาร์จครั้งถัดไป (หน่วยเดียวกับ performance.now) */
  const nextSfxAt = useRef(0);

  // เปลี่ยนการ์ดที่เลือก = ล้างผลรอบก่อนทิ้ง ไม่ให้ค้างมาหลอกตา
  useEffect(() => {
    setOutcome(null);
    setMessage('');
  }, [card?.id]);

  // กันไม่ให้เฟรมที่ค้างอยู่ยิง setState หลังคอมโพเนนต์ถูกถอดออกแล้ว
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  if (!card) {
    return (
      <section className="glass-panel p-8 text-center">
        <p className="panel-title">Upgrade</p>
        <p className="mt-2 text-sm text-chalk/50">เลือกการ์ดจากคลังก่อน</p>
      </section>
    );
  }

  /* ระหว่างหลอดวิ่งให้ทุกอย่างอ่านจากภาพนิ่ง ไม่ใช่การ์ดสดที่เปลี่ยนไปแล้ว */
  const shown = rolling && frozen ? frozen : card;

  const player = getEffectivePlayer(shown);
  const currentStats = getEffectivePlayerStats(shown);

  if (!player || !currentStats) {
    return (
      <section className="glass-panel p-8 text-center">
        <p className="text-sm text-rose-300">การ์ดใบนี้ชี้ไปนักเตะที่ไม่มีอยู่ในระบบ</p>
      </section>
    );
  }

  const upgrade = getCardUpgrade(shown);
  const step = getUpgradeStep(upgrade);
  const preview = previewNextUpgrade(shown);
  const currentOvr = getEffectivePlayerOvr(shown);
  /**
   * เกณฑ์ OVR ของการ์ดช่วย — เทียบด้วยค่าพื้นฐาน ไม่ใช่ค่าหลังตีบวก
   * (ดูเหตุผลที่ isStrongEnoughMaterial ใน services/cardInstance.ts)
   */
  const baseOvr = getBasePlayer(shown.playerId)?.ovr ?? currentOvr;

  /** อัตราติดจริงหลังใส่การ์ดช่วยแล้ว */
  const successRate = step ? getBoostedSuccessRate(step.successRate, materialCards.length) : 0;
  /** ขั้นนี้ตีไม่ติดแล้วลดระดับไหม — ตัวที่ทำให้การ์ดป้องกันมีค่า */
  const dropsOnFail = (step?.dropOnFail ?? 0) > 0;

  /** true = หลอดเข้าโค้งสุดท้ายแล้ว ใช้เร่งความตึงทั้งสีและตัวหนังสือ */
  const finalStretch = rolling && progress >= FINAL_STRETCH;

  const locked = isCardLocked(shown);
  const maxed = !step || !preview;
  const notEnoughMaterial = step ? upgradePoints < step.materialCost : false;
  const notEnoughCoins = step ? coins < step.coinCost : false;
  const canPress = !locked && !maxed && !notEnoughMaterial && !notEnoughCoins && !rolling;

  /** ข้อความสถานะใต้ปุ่ม */
  const statusText = message
    ? message
    : rolling
      ? 'กำลังลุ้นผล…'
      : outcome === 'success'
        ? getCardUpgrade(card) >= MAX_UPGRADE
          ? `ตีบวกติด! +${MAX_UPGRADE} เต็มขั้นแล้ว`
          : `ตีบวกติด! ตอนนี้ +${getCardUpgrade(card)}`
        : outcome === 'protected'
          ? 'ไม่ติด — แต่การ์ดป้องกันทำงาน ค่าบวกไม่ลด'
          : outcome === 'fail'
            ? dropsOnFail
              ? 'ไม่ติด — ค่าบวกลดลงหนึ่งขั้น'
              : 'ไม่ติด — ค่าบวกเดิมไม่ลด แต่ค่าใช้จ่ายเสียไปแล้ว'
            : locked
              ? 'การ์ดใบนี้ถูกล็อกไว้'
              : maxed
                ? `ตีบวกจนสุดแล้ว (+${MAX_UPGRADE})`
                : notEnoughMaterial
                  ? 'แต้มตีบวกไม่พอ'
                  : notEnoughCoins
                    ? 'เหรียญไม่พอ'
                    : dropsOnFail
                      ? 'ขั้นนี้ตีไม่ติดแล้วค่าบวกจะลด — ติดการ์ดป้องกันไว้ได้'
                      : 'ตีไม่ติดก็เสียค่าใช้จ่าย แต่ค่าบวกเดิมไม่ลด';

  /** เฉลยผล — เรียกได้จากทั้งสองฝั่ง แต่ทำงานจริงตอนครบทั้งหลอดและผลเท่านั้น */
  const settle = () => {
    const next = pendingOutcome.current;
    if (!barFilled.current || !next) return;

    pendingOutcome.current = null;
    setRolling(false);
    setFrozen(null);
    setOutcome(next);
    playSfx(next === 'success' ? 'upgradeSuccess' : 'upgradeFail');
    onClearMaterials?.();
    setUseProtect(false);
  };

  /**
   * เริ่มวิ่งหลอดจากซ้ายไปจนสุดขวา
   * ใช้ requestAnimationFrame แทน CSS transition เพราะต้องรู้แน่ ๆ ว่า "ถึงปลายหลอดแล้ว"
   * ถึงจะเฉลยผลได้ ไม่ใช่เดาจากเวลาที่ตั้งไว้
   */
  const startRoll = () => {
    barFilled.current = false;
    pendingOutcome.current = null;
    setFrozen(card);
    setProgress(0);
    setElapsed(0);
    setRolling(true);

    const startedAt = performance.now();
    playSfx('upgradeRoll');
    nextSfxAt.current = startedAt + SFX_GAP_START_MS;

    const tick = (now: number) => {
      const time = Math.min(1, (now - startedAt) / ROLL_DURATION_MS);
      setElapsed(time);
      setProgress(easeOutRoll(time));

      /*
       * เสียงชาร์จถี่ขึ้นเรื่อย ๆ ตามเวลาที่ผ่านไป
       * ใช้ rAF จับเวลาแทน setInterval จะได้มีตัวจับเวลาเดียวกับหลอด ไม่หลุดจากกัน
       */
      if (now >= nextSfxAt.current) {
        playSfx('upgradeRoll');
        nextSfxAt.current =
          now + (SFX_GAP_START_MS + (SFX_GAP_END_MS - SFX_GAP_START_MS) * time);
      }

      if (time < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }

      // ถึงปลายหลอดแล้ว — ถ้าผลมาถึงก่อนหน้านี้ก็เฉลยทันที ไม่งั้นค้างเต็มหลอดรอ
      frame.current = null;
      barFilled.current = true;
      settle();
    };

    frame.current = requestAnimationFrame(tick);
  };

  /** หยุดหลอดกลางคันเมื่อคำขอถูกปฏิเสธ — ไม่ต้องวิ่งให้สุดถ้ารู้ผลแล้วว่าไม่ได้ทำรายการ */
  const abortRoll = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    barFilled.current = false;
    pendingOutcome.current = null;
    setRolling(false);
    setFrozen(null);
    setProgress(0);
    setElapsed(0);
  };

  const handleUpgrade = async () => {
    if (!step || rolling) return;

    setMessage('');
    setOutcome(null);
    startRoll();

    const materialCardIds = materialCards.map((entry) => entry.id);

    try {
      if (SERVER_AUTHORITY) {
        /*
         * รหัสคำขอสร้างครั้งเดียวต่อการกดหนึ่งครั้ง
         * ยิงซ้ำอัตโนมัติของ SDK ใช้รหัสเดิม เซิร์ฟเวอร์จึงไม่หักเงินซ้ำ
         */
        const response = await callUpgradeCard({
          cardId: card.id,
          requestId: createUpgradeRequestId(),
          materialCardIds,
          useProtect,
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
        const result = upgradeCard({ cardId: card.id, materialCardIds, useProtect });
        if (!result.ok) {
          abortRoll();
          setMessage(result.reason ?? 'ตีบวกไม่สำเร็จ');
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

  return (
    <section
      className="glass-panel relative overflow-hidden p-5"
      style={
        upgradeScene.backgroundUrl
          ? {
              backgroundImage: `linear-gradient(rgba(6,10,20,0.82), rgba(6,10,20,0.92)), url(${upgradeScene.backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,240px)_1fr]">
        {/* ══ ซ้าย: สเตตัสปัจจุบัน ══ */}
        <div className="rounded-xl border border-gold/25 bg-black/30 p-4">
          <p className="text-center font-display text-sm uppercase tracking-wide text-gold">
            สเตตัสปัจจุบัน
          </p>

          <div className="mt-3 flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-mono text-xs text-chalk/50">OVR</span>
            <span className="font-display text-3xl leading-none">{currentOvr}</span>
          </div>

          <div className="mt-2 space-y-1">
            {STAT_ROWS.map(({ key, label }) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-chalk/55">{label}</span>
                <span className="font-mono">{currentStats[key]}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-center">
            <div>
              <p className="text-[10px] uppercase text-chalk/45">อัตราติด</p>
              <p className="font-display text-2xl leading-tight text-gold">
                {Math.round(successRate * 100)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-chalk/45">ป้องกันลดระดับ</p>
              <p
                className={cn(
                  'font-display text-2xl leading-tight',
                  useProtect ? 'text-neon' : 'text-chalk/35',
                )}
              >
                {useProtect ? 'ON' : 'OFF'}
              </p>
            </div>
          </div>
        </div>

        {/* ══ กลาง: การ์ด + ช่องใส่การ์ดช่วย ══ */}
        <div className="flex flex-col items-center gap-3">
          {/* ตีบวกจนสุดแล้วมีแสงทองวิ่งรอบกรอบ — เพิ่งตีติดหมาด ๆ จะเรืองแรงกว่า */}
          <MaxUpgradeFrame active={upgrade >= MAX_UPGRADE} celebrate={outcome === 'success'}>
            <PlayerCard player={player} size="lg" level={shown.level} />
          </MaxUpgradeFrame>

          <p className="font-display text-lg">
            {player.position} · OVR {currentOvr}
          </p>

          {/* ช่องใส่การ์ดช่วย — กด + เพื่อเพิ่ม */}
          <div className="w-full">
            <p className="mb-1.5 text-center text-[10px] uppercase tracking-wide text-chalk/45">
              การ์ดช่วยตีบวก (ใบละ +5% · OVR ≥ {baseOvr})
            </p>
            <div className="flex justify-center gap-2">
              {Array.from({ length: MATERIAL_CARD_SLOTS }).map((_, slot) => {
                const filled = materialCards[slot];

                return filled ? (
                  <button
                    key={filled.id}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      onRemoveMaterial?.(filled.id);
                    }}
                    title="กดเพื่อเอาออก"
                    className="rounded-lg border border-neon/50 bg-neon/10 p-1"
                  >
                    <PlayerCard
                      player={getEffectivePlayer(filled) ?? player}
                      size="xs"
                      level={filled.level}
                    />
                  </button>
                ) : (
                  <button
                    key={`empty-${slot}`}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      onPickMaterial?.(slot);
                    }}
                    aria-label="เพิ่มการ์ดช่วยตีบวก"
                    className="flex h-[86px] w-[62px] items-center justify-center rounded-lg border border-dashed border-white/25 text-2xl text-chalk/35 transition-colors hover:border-neon/60 hover:text-neon"
                  >
                    +
                  </button>
                );
              })}
            </div>
          </div>

          {/* สวิตช์การ์ดป้องกัน */}
          <button
            type="button"
            disabled={protectCards < 1 || !dropsOnFail}
            onClick={() => {
              playSfx('click');
              setUseProtect((value) => !value);
            }}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors',
              useProtect
                ? 'border-neon/60 bg-neon/10 text-neon'
                : 'border-white/15 bg-black/25 text-chalk/55',
              (protectCards < 1 || !dropsOnFail) && 'cursor-not-allowed opacity-40',
            )}
          >
            <span>🛡 การ์ดป้องกัน</span>
            <span className="font-mono">
              {formatNumber(protectCards)} ชิ้น {useProtect ? '✓' : ''}
            </span>
          </button>

          <p className="text-center text-[10px] text-chalk/40">
            {dropsOnFail
              ? 'หากไม่ติด การ์ดป้องกันจะกันไม่ให้ลดระดับ'
              : 'ขั้นนี้ตีไม่ติดก็ไม่ลดระดับอยู่แล้ว'}
          </p>
        </div>

        {/* ══ ขวา: สเตตัสถัดไป ══ */}
        <div className={cn('rounded-xl border border-gold/25 bg-black/30 p-4', maxed && 'opacity-40')}>
          <p className="text-center font-display text-sm uppercase tracking-wide text-gold">
            สเตตัสถัดไป (ถ้าติด)
          </p>

          <div className="mt-3 flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-mono text-xs text-chalk/50">OVR</span>
            <span className="font-display text-3xl leading-none text-neon">
              {preview?.ovr ?? currentOvr}
            </span>
          </div>

          <div className="mt-2 space-y-1">
            {STAT_ROWS.map(({ key, label }) => {
              const now = currentStats[key];
              const next = preview?.stats[key] ?? now;
              const delta = next - now;

              return (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-chalk/55">{label}</span>
                  <span className="flex items-center gap-2 font-mono">
                    <span>{next}</span>
                    <span className={cn('w-8 text-right', delta > 0 ? 'text-neon' : 'text-chalk/25')}>
                      {delta > 0 ? `▲${delta}` : '—'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ ล่าง: หลอดขั้น + ค่าใช้จ่าย + ปุ่ม ══ */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-center font-display text-lg">
          ตีบวก <span className="text-gold">+{upgrade}</span>
          <span className="mx-2 text-neon">▸</span>
          <span className="text-neon">+{step?.to ?? upgrade}</span>
        </p>

        {/*
          หลอดตีบวก — ช่องที่ผ่านมาแล้วเป็นทอง ที่เหลือว่างไว้
          ตอนกดตีบวก แถบไล่สีจะวิ่งทับจากซ้ายไปจนสุดปลายหลอด แล้วค่อยเฉลยผล
        */}
        <div className="relative mx-auto mt-3 max-w-lg">
          <div className="flex gap-1">
            {Array.from({ length: MAX_UPGRADE }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-5 flex-1 rounded-sm border transition-colors duration-300',
                  index < upgrade
                    ? upgrade >= MAX_UPGRADE
                      ? // ตันแล้วทั้งแถวเป็นทองเรือง ไม่ใช่ทองด้าน ๆ เหมือนขั้นกลาง ๆ
                        'animate-max-glow border-gold bg-gold shadow-[0_0_10px_rgba(245,185,62,0.8)]'
                      : 'border-gold/60 bg-gold'
                    : index === upgrade && outcome === 'success'
                      ? 'border-neon/60 bg-neon'
                      : 'border-white/10 bg-white/5',
                )}
              />
            ))}
          </div>

          {/* แถบที่วิ่ง — ทับอยู่บนช่องทั้งแถว จึงเห็นเป็นหลอดเดียววิ่งยาวจนสุด */}
          {rolling && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm">
              <div
                role="progressbar"
                aria-label="ความคืบหน้าการตีบวก"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                className={cn(
                  'h-full rounded-sm bg-gradient-to-r transition-colors duration-300',
                  finalStretch
                    ? 'animate-pulse from-neon via-white to-neon shadow-[0_0_22px_rgba(0,255,170,0.9)]'
                    : 'from-gold/70 via-neon to-white/90 shadow-[0_0_12px_rgba(0,255,170,0.55)]',
                )}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* ตัวเลขเปอร์เซ็นต์ระหว่างวิ่ง ให้เห็นชัดว่าหลอดไปถึงไหนแล้ว */}
        <p
          className={cn(
            'mt-1 text-center font-mono text-[11px]',
            finalStretch ? 'animate-pulse font-bold text-neon' : 'text-chalk/40',
          )}
        >
          {rolling
            ? finalStretch
              ? 'ลุ้น!'
              : `${Math.round(progress * 100)}%`
            : `+${upgrade} / +${MAX_UPGRADE}`}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 font-mono text-xs">
          <span className={notEnoughCoins ? 'text-rose-300' : 'text-chalk/70'}>
            🪙 {formatNumber(step?.coinCost ?? 0)}
            <span className="text-chalk/30"> / {formatNumber(coins)}</span>
          </span>
          <span className={notEnoughMaterial ? 'text-rose-300' : 'text-chalk/70'}>
            ⚡ {formatNumber(step?.materialCost ?? 0)}
            <span className="text-chalk/30"> / {formatNumber(upgradePoints)}</span>
          </span>
        </div>

        <button
          type="button"
          disabled={!canPress}
          onClick={handleUpgrade}
          className={cn(
            'mx-auto mt-3 block w-full max-w-sm rounded-lg py-3 font-display text-lg uppercase tracking-wide transition-colors',
            canPress
              ? 'bg-gradient-to-r from-gold to-neon text-ink-900 hover:brightness-110'
              : 'cursor-not-allowed bg-white/5 text-chalk/35',
          )}
        >
          {rolling
            ? `กำลังตีบวก… ${Math.ceil((1 - elapsed) * (ROLL_DURATION_MS / 1000))} วิ`
            : `🔨 ตีบวก +${step?.to ?? MAX_UPGRADE}`}
        </button>

        <p
          role="status"
          className={cn(
            'mt-2 min-h-[1.25rem] text-center text-xs',
            outcome === 'success'
              ? 'text-neon'
              : outcome === 'protected'
                ? 'text-gold'
                : message || outcome === 'fail' || locked || maxed || notEnoughCoins || notEnoughMaterial
                  ? 'text-rose-300'
                  : 'text-chalk/45',
          )}
        >
          {statusText}
        </p>
      </div>
    </section>
  );
};
