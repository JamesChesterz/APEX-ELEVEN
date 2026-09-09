/**
 * หน้า FUSION — ผสมการ์ดนักเตะ 3 ใบเป็นการ์ดใหม่ 1 ใบ
 *
 * โครงหน้า: ช่องวัสดุ 3 ช่อง (ซ้าย) → ตารางโอกาส + ปุ่มผสม (ขวา)
 * กติกาทั้งหมดอยู่ที่ services/fusion.ts หน้านี้ไม่มีตัวเลขของตัวเองเลย
 * อยากปรับความยากหรือช่วงเงินรางวัล ให้ไปแก้ที่ไฟล์นั้นที่เดียว
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FusionCardPicker } from '@/components/fusion/FusionCardPicker';
import { FusionRevealOverlay } from '@/components/fusion/FusionRevealOverlay';
import { PlayerCard } from '@/components/player/PlayerCard';
import { useFusion } from '@/hooks/useFusion';
import { usePlayers, type OwnedPlayerCard } from '@/hooks/usePlayers';
import {
  FUSION_CANDIDATES,
  FUSION_CASH_CHANCE,
  FUSION_CASH_MAX,
  FUSION_CASH_MIN,
  FUSION_CASH_MIN_PLUS,
  FUSION_MATERIALS,
} from '@/services/fusion';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

/** ช่องวัสดุหนึ่งช่อง — ว่างอยู่ก็กดเพื่อเปิดหน้าเลือกการ์ด */
const MaterialSlot = ({
  index,
  entry,
  onOpen,
  onRemove,
}: {
  index: number;
  entry?: OwnedPlayerCard;
  onOpen: () => void;
  onRemove: () => void;
}) => {
  if (!entry) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/15 bg-black/25 text-chalk/35 transition-colors hover:border-neon/50 hover:text-neon"
      >
        <span className="font-display text-3xl">+</span>
        <span className="text-[10px] uppercase tracking-widest">ช่อง {index + 1}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onRemove}
      title="กดเพื่อเอาการ์ดออกจากช่อง"
      className="group relative flex aspect-[3/4] w-full flex-col items-center justify-center rounded-xl border-2 border-neon/50 bg-neon/5 p-1.5"
    >
      <PlayerCard player={entry.player} size="md" level={entry.card.level} className="w-full" />
      <span className="mt-1 truncate text-[10px] text-chalk/60">{entry.player.name}</span>
      <span className="absolute right-1 top-1 hidden rounded bg-gem px-1 text-[10px] font-bold text-white group-hover:block">
        ✕
      </span>
    </button>
  );
};

export const FusionPage = () => {
  const { rawCards } = usePlayers();
  const fusion = useFusion();
  const [pickerOpen, setPickerOpen] = useState(false);

  const remaining = FUSION_MATERIALS - fusion.materials.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-chalk/35">
        <Link to="/" className="hover:text-neon">
          Home
        </Link>
        <span>/</span>
        <span className="text-chalk/70">Fusion</span>
      </div>

      <header className="panel p-4">
        <h1 className="font-display text-2xl uppercase tracking-wide">ผสมการ์ดนักเตะ</h1>
        <p className="mt-1 text-xs leading-relaxed text-chalk/55">
          ใช้การ์ด <span className="text-neon">ระดับเดียวกัน {FUSION_MATERIALS} ใบ</span>{' '}
          ผสมเป็นการ์ดใหม่ 1 ใบในระดับเดิม พร้อมค่าตีบวก +1 ถึง +8 · ยิ่งวัสดุบวกสูง โอกาสได้ผลบวกสูงยิ่งขึ้น
          · การ์ดที่ล็อกไว้หรืออยู่ในทีมใช้ผสมไม่ได้
        </p>
        <p className="mt-1 text-xs text-gold/80">
          ใช้การ์ด +{FUSION_CASH_MIN_PLUS} ขึ้นไปครบทั้ง {FUSION_MATERIALS} ใบ มีโอกาส{' '}
          {Math.round(FUSION_CASH_CHANCE * 100)}% ได้เงินโบนัส {formatNumber(FUSION_CASH_MIN)}–
          {formatNumber(FUSION_CASH_MAX)} ฿
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* ── ช่องวัสดุ ─────────────────────────────────────── */}
        <section className="panel flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="panel-title">การ์ดที่จะผสม</h2>
            {fusion.rarity && (
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wide',
                  RARITY_STYLE[fusion.rarity].text,
                  RARITY_STYLE[fusion.rarity].border,
                )}
              >
                ล็อกระดับ {RARITY_STYLE[fusion.rarity].label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: FUSION_MATERIALS }, (_, index) => (
              <MaterialSlot
                key={index}
                index={index}
                entry={fusion.materials[index]}
                onOpen={() => setPickerOpen(true)}
                onRemove={() => fusion.toggle(fusion.materials[index].card.id)}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={remaining === 0}
              className={cn(
                'flex-1 rounded-lg border border-white/15 py-2.5 font-display text-sm uppercase tracking-wide transition-colors',
                remaining === 0
                  ? 'cursor-not-allowed text-chalk/25'
                  : 'text-chalk/75 hover:bg-white/5',
              )}
            >
              เลือกการ์ด {remaining > 0 && `(อีก ${remaining} ใบ)`}
            </button>
            <button
              type="button"
              onClick={fusion.clear}
              disabled={fusion.materials.length === 0}
              className="rounded-lg border border-white/15 px-4 py-2.5 font-display text-sm uppercase tracking-wide text-chalk/60 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:text-chalk/25"
            >
              ล้าง
            </button>
          </div>

          {fusion.error && (
            <p className="rounded-lg border border-gem/40 bg-gem/10 px-3 py-2 text-xs text-gem">
              {fusion.error}
            </p>
          )}
        </section>

        {/* ── ตารางโอกาส ────────────────────────────────────── */}
        <section className="panel flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="panel-title">โอกาสที่จะออก</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-chalk/40">
              วัสดุต่ำสุด +{fusion.materialPlus}
            </span>
          </div>

          <ul className="flex flex-col gap-1">
            {fusion.odds.map(({ plus, chance }) => (
              <li key={plus} className="flex items-center gap-2">
                <span
                  className={cn(
                    'w-8 shrink-0 font-mono text-[11px]',
                    plus >= 7 ? 'text-gold' : 'text-chalk/60',
                  )}
                >
                  +{plus}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={cn('h-full rounded-full', plus >= 7 ? 'bg-gold' : 'bg-neon/70')}
                    style={{ width: `${Math.min(100, chance * 2.5)}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[11px] text-chalk/50">
                  {chance}%
                </span>
              </li>
            ))}
          </ul>

          <p
            className={cn(
              'rounded-lg border px-3 py-2 text-[11px]',
              fusion.cashUnlocked
                ? 'border-gold/40 bg-gold/10 text-gold'
                : 'border-white/10 text-chalk/40',
            )}
          >
            {fusion.cashUnlocked
              ? `ปลดล็อกโบนัสเงินแล้ว — โอกาส ${Math.round(FUSION_CASH_CHANCE * 100)}% ได้ ${formatNumber(FUSION_CASH_MIN)}–${formatNumber(FUSION_CASH_MAX)} ฿`
              : `โบนัสเงินต้องใช้การ์ด +${FUSION_CASH_MIN_PLUS} ขึ้นไปครบทั้ง ${FUSION_MATERIALS} ใบ`}
          </p>

          <button
            type="button"
            onClick={fusion.startFusion}
            disabled={!fusion.ready}
            className={cn(
              'mt-auto rounded-lg py-3 font-display text-base uppercase tracking-wide transition-colors',
              fusion.ready
                ? 'bg-neon text-ink-900 hover:brightness-110'
                : 'cursor-not-allowed bg-white/5 text-chalk/30',
            )}
          >
            ผสมการ์ด
          </button>
          <p className="text-center text-[10px] text-chalk/35">
            กดแล้วจะมีการ์ดคว่ำ {FUSION_CANDIDATES} ใบให้เปิด — ใบแรกที่เปิดคือใบที่ได้
          </p>
        </section>
      </div>

      <FusionCardPicker
        open={pickerOpen}
        cards={rawCards}
        pickedIds={fusion.pickedIds}
        rarity={fusion.rarity}
        remaining={remaining}
        blockReasonOf={fusion.blockReasonOf}
        onToggle={fusion.toggle}
        onClose={() => setPickerOpen(false)}
      />

      <FusionRevealOverlay
        open={fusion.phase !== 'select'}
        candidates={fusion.candidates}
        openedIndexes={fusion.openedIndexes}
        outcome={fusion.outcome}
        onOpenCandidate={fusion.openCandidate}
        onRevealRest={fusion.revealRest}
        onClose={fusion.close}
      />
    </div>
  );
};
