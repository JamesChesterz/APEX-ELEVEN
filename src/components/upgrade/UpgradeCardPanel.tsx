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
const ROLL_DURATION_MS = 1200;

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
  /** null = ไม่ได้กำลังวิ่ง · 0–1 = ความคืบหน้าของหลอด */
  const [rolling, setRolling] = useState(false);
  const [outcome, setOutcome] = useState<'success' | 'fail' | 'protected' | null>(null);
  const [message, setMessage] = useState('');
  const timers = useRef<number[]>([]);

  // เปลี่ยนการ์ดที่เลือก = ล้างผลรอบก่อนทิ้ง ไม่ให้ค้างมาหลอกตา
  useEffect(() => {
    setOutcome(null);
    setMessage('');
  }, [card?.id]);

  // กันไม่ให้ timer ที่ค้างอยู่ยิง setState หลังคอมโพเนนต์ถูกถอดออกแล้ว
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => window.clearTimeout(id));
  }, []);

  if (!card) {
    return (
      <section className="glass-panel p-8 text-center">
        <p className="panel-title">Upgrade</p>
        <p className="mt-2 text-sm text-chalk/50">เลือกการ์ดจากคลังก่อน</p>
      </section>
    );
  }

  const player = getEffectivePlayer(card);
  const currentStats = getEffectivePlayerStats(card);

  if (!player || !currentStats) {
    return (
      <section className="glass-panel p-8 text-center">
        <p className="text-sm text-rose-300">การ์ดใบนี้ชี้ไปนักเตะที่ไม่มีอยู่ในระบบ</p>
      </section>
    );
  }

  const upgrade = getCardUpgrade(card);
  const step = getUpgradeStep(upgrade);
  const preview = previewNextUpgrade(card);
  const currentOvr = getEffectivePlayerOvr(card);

  /** อัตราติดจริงหลังใส่การ์ดช่วยแล้ว */
  const successRate = step ? getBoostedSuccessRate(step.successRate, materialCards.length) : 0;
  /** ขั้นนี้ตีไม่ติดแล้วลดระดับไหม — ตัวที่ทำให้การ์ดป้องกันมีค่า */
  const dropsOnFail = (step?.dropOnFail ?? 0) > 0;

  const locked = isCardLocked(card);
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
        ? `ตีบวกติด! ตอนนี้ +${upgrade}`
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

  /** เฉลยผลหลังหลอดวิ่งจบ เพื่อให้ภาพกับผลลัพธ์มาพร้อมกัน */
  const revealAfterRoll = (next: 'success' | 'fail' | 'protected') => {
    const id = window.setTimeout(() => {
      setRolling(false);
      setOutcome(next);
      playSfx(next === 'success' ? 'upgradeSuccess' : 'upgradeFail');
      onClearMaterials?.();
      setUseProtect(false);
    }, ROLL_DURATION_MS);

    timers.current.push(id);
  };

  const handleUpgrade = async () => {
    if (!step || rolling) return;

    setMessage('');
    setOutcome(null);
    setRolling(true);
    playSfx('upgradeRoll');

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

        revealAfterRoll(
          response.result.success ? 'success' : response.result.protectUsed ? 'protected' : 'fail',
        );
      } else {
        const result = upgradeCard({ cardId: card.id, materialCardIds, useProtect });
        if (!result.ok) {
          setRolling(false);
          setMessage(result.reason ?? 'ตีบวกไม่สำเร็จ');
          return;
        }
        revealAfterRoll(result.success ? 'success' : result.protectUsed ? 'protected' : 'fail');
      }
    } catch (error) {
      setRolling(false);
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
          <PlayerCard player={player} size="lg" level={card.level} />

          <p className="font-display text-lg">
            {player.position} · OVR {currentOvr}
          </p>

          {/* ช่องใส่การ์ดช่วย — กด + เพื่อเพิ่ม */}
          <div className="w-full">
            <p className="mb-1.5 text-center text-[10px] uppercase tracking-wide text-chalk/45">
              การ์ดช่วยตีบวก (ใบละ +5%)
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

        {/* หลอดขั้นการตีบวก — ช่องที่ผ่านมาแล้วสว่าง ช่องถัดไปกะพริบตอนกำลังลุ้น */}
        <div className="mx-auto mt-2 flex max-w-lg gap-1">
          {Array.from({ length: MAX_UPGRADE }).map((_, index) => (
            <span
              key={index}
              className={cn(
                'h-3 flex-1 rounded-sm transition-all duration-300',
                index < upgrade
                  ? 'bg-gold'
                  : index === upgrade && rolling
                    ? 'animate-pulse bg-neon'
                    : index === upgrade && outcome === 'success'
                      ? 'bg-neon'
                      : 'bg-white/10',
              )}
            />
          ))}
        </div>

        {/* หลอด progress ที่วิ่งจริงตอนกำลังลุ้น */}
        <div className="mx-auto mt-2 h-1.5 max-w-lg overflow-hidden rounded-full bg-white/10">
          <div
            role="progressbar"
            aria-label="ความคืบหน้าการตีบวก"
            className={cn(
              'h-full rounded-full bg-gradient-to-r from-gold via-neon to-gold',
              rolling ? 'w-full' : 'w-0',
            )}
            style={{ transition: rolling ? `width ${ROLL_DURATION_MS}ms linear` : 'none' }}
          />
        </div>

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
          {rolling ? 'กำลังตีบวก…' : `🔨 ตีบวก +${step?.to ?? MAX_UPGRADE}`}
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
