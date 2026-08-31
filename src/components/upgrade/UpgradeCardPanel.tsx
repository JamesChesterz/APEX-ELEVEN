/**
 * PHASE 13.5 — หน้าตีบวกการ์ด
 *
 * โชว์การ์ดปัจจุบันเทียบกับการ์ดหลังตีบวกติด พร้อมค่าพลังทีละด้าน
 * ตัวเลขทุกตัวมาจาก Attribute Engine กับตารางตีบวกกลาง ไม่มี hardcode สักตัว
 *
 * เมื่อ VITE_SERVER_AUTHORITY=1 การกดปุ่มจะยิงไปที่ Cloud Function
 * เครื่องผู้เล่นจึงกำหนดผลเองไม่ได้ — ปิดอยู่ = ใช้ระบบเดิมที่ตีบวกในเครื่อง
 */
import { useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getUpgradeStep } from '@/data/upgradeConfig';
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
import { MAX_PLUS } from '@/services/upgrade';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { PlayerStats } from '@/types/player';
import { cn, formatNumber } from '@/utils/helpers';

/** สถานะของหน้าจอ ณ ตอนนี้ */
type PanelState =
  | 'loading'
  | 'ready'
  | 'insufficient-coins'
  | 'insufficient-material'
  | 'locked'
  | 'maxed'
  | 'working'
  | 'success'
  | 'fail'
  | 'error';

/** ชื่อย่อของค่าพลังตามลำดับที่โชว์บนการ์ด */
const STAT_ROWS: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: 'pace', label: 'PAC' },
  { key: 'shooting', label: 'SHO' },
  { key: 'passing', label: 'PAS' },
  { key: 'dribbling', label: 'DRI' },
  { key: 'defending', label: 'DEF' },
  { key: 'physical', label: 'PHY' },
];

interface UpgradeCardPanelProps {
  /** การ์ดที่เลือกอยู่ — null = ยังไม่ได้เลือก */
  card: PlayerCardData | null;
}

export const UpgradeCardPanel = ({ card }: UpgradeCardPanelProps) => {
  const { coins, upgradePoints, upgradeCard, applyServerUpgrade } = usePlayers();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'success' | 'fail' | null>(null);
  const [message, setMessage] = useState('');

  if (!card) {
    return (
      <section className="glass-panel p-8 text-center">
        <p className="panel-title">Upgrade</p>
        <p className="mt-2 text-sm text-chalk/50">เลือกการ์ดจากคลังทางซ้ายก่อน</p>
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

  /** สถานะที่ต้องโชว์ — เรียงตามลำดับความสำคัญ อันแรกที่จริงชนะ */
  const state: PanelState = busy
    ? 'working'
    : message
      ? 'error'
      : outcome === 'success'
        ? 'success'
        : outcome === 'fail'
          ? 'fail'
          : isCardLocked(card)
            ? 'locked'
            : !step || !preview
              ? 'maxed'
              : upgradePoints < step.materialCost
                ? 'insufficient-material'
                : coins < step.coinCost
                  ? 'insufficient-coins'
                  : 'ready';

  const canPress = state === 'ready' || state === 'success' || state === 'fail';

  const handleUpgrade = async () => {
    if (!step || busy) return;

    setBusy(true);
    setMessage('');
    setOutcome(null);

    try {
      if (SERVER_AUTHORITY) {
        /*
         * รหัสคำขอสร้างครั้งเดียวต่อการกดหนึ่งครั้ง
         * ถ้าเน็ตหลุดแล้วผู้เล่นกดใหม่ จะเป็นคนละรหัส = คนละรายการ ซึ่งถูกต้องแล้ว
         * ส่วนการยิงซ้ำอัตโนมัติของ SDK ใช้รหัสเดิม เซิร์ฟเวอร์จึงไม่หักเงินซ้ำ
         */
        const response = await callUpgradeCard({
          cardId: card.id,
          requestId: createUpgradeRequestId(),
        });

        applyServerUpgrade({
          cardId: card.id,
          coins: response.coins,
          upgradePoints: response.upgradePoints,
          card: response.card,
        });

        setOutcome(response.result.success ? 'success' : 'fail');
        playSfx(response.result.success ? 'levelUp' : 'error');
      } else {
        const result = upgradeCard(card.id);
        if (!result.ok) {
          setMessage(result.reason ?? 'ตีบวกไม่สำเร็จ');
          return;
        }
        setOutcome(result.success ? 'success' : 'fail');
      }
    } catch (error) {
      setMessage(serverErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-panel p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="panel-title">Upgrade Card</p>
        <p className="font-mono text-[11px] text-chalk/45">
          {SERVER_AUTHORITY ? 'ตัดสินที่เซิร์ฟเวอร์' : 'โหมดออฟไลน์'}
        </p>
      </div>

      {/* ── การ์ดปัจจุบัน เทียบกับ การ์ดหลังตีบวกติด ── */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex flex-col items-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-chalk/45">Current</p>
          <PlayerCard player={player} size="md" level={card.level} />
          <p className="font-display text-2xl leading-none">OVR {currentOvr}</p>
          <p className="font-mono text-xs text-kit">+{upgrade}</p>
        </div>

        <span className="font-display text-2xl text-neon" aria-hidden>
          →
        </span>

        <div className={cn('flex flex-col items-center gap-2', !preview && 'opacity-35')}>
          <p className="font-mono text-[10px] uppercase tracking-wider text-chalk/45">Next</p>
          <PlayerCard player={player} size="md" level={card.level + 1} />
          <p className="font-display text-2xl leading-none text-neon">
            OVR {preview?.ovr ?? currentOvr}
          </p>
          <p className="font-mono text-xs text-neon">+{step?.to ?? upgrade}</p>
        </div>
      </div>

      {/* ── ค่าพลังทีละด้าน ── */}
      <div className="mt-4 space-y-1 border-y border-white/10 py-3">
        {STAT_ROWS.map(({ key, label }) => {
          const now = currentStats[key];
          const next = preview?.stats[key] ?? now;

          return (
            <div key={key} className="flex items-center gap-3 font-mono text-xs">
              <span className="w-10 text-chalk/50">{label}</span>
              <span className="w-8 text-right">{now}</span>
              <span className="text-chalk/30" aria-hidden>
                →
              </span>
              <span className={cn('w-8 text-right', next > now ? 'text-neon' : 'text-chalk/40')}>
                {next}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── โอกาสสำเร็จและค่าใช้จ่าย ── */}
      <div className="mt-3 space-y-1.5 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-chalk/50">SUCCESS RATE</span>
          <span className={cn(step ? 'text-neon' : 'text-chalk/40')}>
            {step ? `${Math.round(step.successRate * 100)}%` : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-chalk/50">COINS</span>
          <span className={state === 'insufficient-coins' ? 'text-rose-300' : ''}>
            {formatNumber(step?.coinCost ?? 0)}
            <span className="text-chalk/35"> / {formatNumber(coins)}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-chalk/50">MATERIAL (แต้มตีบวก)</span>
          <span className={state === 'insufficient-material' ? 'text-rose-300' : ''}>
            {formatNumber(step?.materialCost ?? 0)}
            <span className="text-chalk/35"> / {formatNumber(upgradePoints)}</span>
          </span>
        </div>
      </div>

      {/* ── ปุ่มและสถานะ ── */}
      <button
        type="button"
        disabled={!canPress || busy}
        onClick={handleUpgrade}
        className={cn(
          'mt-4 w-full rounded-lg py-3 font-display text-lg uppercase tracking-wide transition-colors',
          canPress && !busy
            ? 'bg-neon text-ink-900 hover:brightness-110'
            : 'cursor-not-allowed bg-white/5 text-chalk/35',
        )}
      >
        {busy ? 'กำลังตีบวก…' : `🔨 Upgrade +${step?.to ?? MAX_PLUS}`}
      </button>

      <p
        role="status"
        className={cn(
          'mt-2 min-h-[1.25rem] text-center text-xs',
          state === 'success' ? 'text-neon' : state === 'ready' ? 'text-chalk/45' : 'text-rose-300',
        )}
      >
        {state === 'working' && 'กำลังรอผลจากเซิร์ฟเวอร์…'}
        {state === 'error' && message}
        {state === 'success' && `ตีบวกติด! ตอนนี้ +${getCardUpgrade(card)}`}
        {state === 'fail' && 'ตีบวกไม่ติด — ค่าบวกเดิมไม่ลด แต่ค่าใช้จ่ายเสียไปแล้ว'}
        {state === 'locked' && 'การ์ดใบนี้ถูกล็อกไว้'}
        {state === 'maxed' && `ตีบวกจนสุดแล้ว (+${MAX_PLUS})`}
        {state === 'insufficient-coins' && 'เหรียญไม่พอ'}
        {state === 'insufficient-material' && 'แต้มตีบวกไม่พอ'}
        {state === 'ready' && 'ตีบวกไม่ติดก็เสียค่าใช้จ่าย แต่ค่าบวกเดิมไม่ลด'}
      </p>
    </section>
  );
};
