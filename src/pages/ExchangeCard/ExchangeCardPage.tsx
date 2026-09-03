/**
 * หน้า EXCHANGE CARD — แลกการ์ดนักเตะเป็นเงิน (BP)
 *
 * โครงตามแบบ: เส้นทางหน้า → หัวข้อ → แท็บระดับการ์ด → ตารางการ์ดแบบติ๊กเลือก
 *              → แผงขวา "การ์ดที่เลือกแลก" + สรุปยอด + ปุ่มแลก
 *
 * ราคาคิดจาก ระดับการ์ด × OVR × ค่าตีบวก (ดู services/cardCash.ts)
 * มีเพดานรายวันที่แอดมินปรับได้ที่ ADMIN → แลกการ์ดเป็นเงิน
 *
 * ⚠️ ระบบย่อยการ์ดเป็น "แต้ม" เดิมยังอยู่ที่หน้า Profile ไม่ได้ถูกแทนที่
 * ผู้เล่นเลือกได้ว่าจะแลกใบไหนเป็นแต้ม ใบไหนเป็นเงิน
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { useCardCash } from '@/hooks/useCardCash';
import { usePlayers, type OwnedPlayerCard } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import { getCardCashValue } from '@/services/cardCash';
import { getCardUpgrade, isCardLocked } from '@/services/cardInstance';
import { getEffectivePlayerOvr } from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import type { Rarity } from '@/types/player';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

/** การ์ดต่อหนึ่งหน้าในตาราง (4 คอลัมน์ × 3 แถว ตามแบบ) */
const PAGE_SIZE = 12;

/** ช่องพรีวิวในแผงขวา — เกินจากนี้สรุปเป็นตัวเลขแทน */
const PREVIEW_SLOTS = 4;

const TABS: Array<{ id: 'all' | Rarity; label: string }> = [
  { id: 'all', label: 'นักเตะทั้งหมด' },
  { id: 'legendary', label: 'LEGENDARY' },
  { id: 'mythical', label: 'MYTHICAL' },
  { id: 'common', label: 'ทั่วไป' },
];

/** เหรียญเงินในเกม */
const Coin = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gold text-[9px] font-bold text-ink-900',
      className,
    )}
  >
    ฿
  </span>
);

export const ExchangeCardPage = () => {
  const { ownedCards } = usePlayers();
  const { team } = useTeam();
  const { config, earnedToday, remainingToday, quote, exchange } = useCardCash();

  const [tab, setTab] = useState<'all' | Rarity>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');

  /** การ์ดที่ลงสนามอยู่ — แลกไม่ได้ ต้องเอาออกจากทีมก่อน */
  const starterIds = useMemo(
    () => new Set(team.squad.map((slot) => slot.cardId).filter(Boolean) as string[]),
    [team.squad],
  );

  /** ใบนี้แลกได้ไหม — ล็อกอยู่หรือเป็นตัวจริง = แลกไม่ได้ */
  const canExchange = (entry: OwnedPlayerCard): boolean =>
    !isCardLocked(entry.card) && !starterIds.has(entry.card.id);

  const visible = useMemo(
    () =>
      ownedCards
        .filter((entry) => {
          if (!canExchange(entry)) return false;
          // แท็บ "ทั่วไป" รวมทุกระดับที่ต่ำกว่า legendary ไว้ด้วยกัน
          if (tab === 'common') return !['legendary', 'mythical'].includes(entry.player.rarity);
          return tab === 'all' || entry.player.rarity === tab;
        })
        .sort(
          (left, right) =>
            getCardCashValue(right.player, right.card.level, config) -
            getCardCashValue(left.player, left.card.level, config),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, ownedCards, starterIds, tab],
  );

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageCards = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const picked = ownedCards.filter((entry) => selected.includes(entry.card.id));
  const summary = quote(picked.map(({ card, player }) => ({ player, level: card.level })));

  const toggle = (entry: OwnedPlayerCard) => {
    playSfx('click');
    setNotice('');
    setSelected((current) => {
      if (current.includes(entry.card.id)) {
        return current.filter((id) => id !== entry.card.id);
      }

      if (current.length >= config.maxPerExchange) {
        setNotice(`เลือกได้สูงสุด ${config.maxPerExchange} ใบต่อครั้ง`);
        return current;
      }

      return [...current, entry.card.id];
    });
  };

  /** เลือกทั้งหมดในแท็บนี้ (เท่าที่เพดานต่อครั้งจะรับได้) */
  const selectAll = () => {
    playSfx('click');
    setSelected(visible.slice(0, config.maxPerExchange).map((entry) => entry.card.id));
  };

  const confirmExchange = () => {
    const result = exchange(selected);
    setConfirm(false);
    setSelected([]);
    setNotice(result.message);
  };

  if (!config.enabled) {
    return (
      <section className="glass-panel grid min-h-[320px] place-items-center p-8 text-center">
        <p className="text-sm text-chalk/45">ตอนนี้ปิดระบบแลกการ์ดเป็นเงินชั่วคราว</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* หัวข้อ + เส้นทางหน้า */}
      <div>
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-chalk/35">
          <Link to="/profile" className="transition-colors hover:text-chalk/70">
            Profile
          </Link>
          <span>›</span>
          <span className="text-gold">Exchange Card</span>
        </p>
        <h2 className="mt-1 font-display text-2xl tracking-wide">แลกการ์ดเป็นเงิน</h2>
        <p className="mt-1 text-xs text-chalk/45">แลกการ์ดนักเตะที่ไม่ใช้งาน เป็นเงินสำหรับใช้ในเกม</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ══════════ ซ้าย: แท็บ + ตารางการ์ด ══════════ */}
        <section className="glass-panel flex flex-col overflow-hidden">
          <div className="flex overflow-x-auto border-b border-white/10">
            {TABS.map((entry) => {
              const active = entry.id === tab;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setTab(entry.id);
                    setPage(1);
                  }}
                  className={cn(
                    'relative whitespace-nowrap px-7 py-3.5 text-sm transition-colors',
                    active
                      ? 'bg-gradient-to-b from-gold/20 to-transparent font-semibold text-gold'
                      : 'text-chalk/45 hover:text-chalk/75',
                  )}
                >
                  {entry.label}
                  {active && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-gold" />}
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="grid min-h-[300px] place-items-center p-8 text-center text-sm text-chalk/45">
              ไม่มีการ์ดที่แลกได้ในหมวดนี้
              <br />
              <span className="text-[11px] text-chalk/30">
                การ์ดที่ล็อกไว้และตัวจริง 11 คนจะไม่แสดงที่นี่
              </span>
            </p>
          ) : (
            <div className="grid flex-1 grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
              {pageCards.map((entry) => {
                const { card, player } = entry;
                const checked = selected.includes(card.id);
                const value = getCardCashValue(player, card.level, config);

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => toggle(entry)}
                    className={cn(
                      'relative flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all',
                      checked
                        ? 'border-gold bg-gold/[0.07]'
                        : 'border-white/10 bg-black/25 hover:border-white/25',
                    )}
                  >
                    {/* ช่องติ๊กมุมขวาบน ตามแบบ */}
                    <span
                      className={cn(
                        'absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full border text-[11px] transition-colors',
                        checked
                          ? 'border-gold bg-gold text-ink-900'
                          : 'border-white/25 text-transparent',
                      )}
                    >
                      ✓
                    </span>

                    <PlayerCard player={player} size="sm" level={card.level} />

                    <span className="mt-0.5 w-full truncate font-display text-sm uppercase tracking-wide">
                      {player.name}
                    </span>
                    <span className="font-mono text-[10px] text-chalk/45">
                      OVR {getEffectivePlayerOvr(card)}
                      {getCardUpgrade(card) > 0 && (
                        <span className="text-gold"> · +{getCardUpgrade(card)}</span>
                      )}
                    </span>

                    <span className="mt-1 text-[10px] text-chalk/35">ราคาแลกเปลี่ยน</span>
                    <span className="flex items-center gap-1.5 font-mono text-sm text-gold">
                      <Coin />
                      {formatNumber(value)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* แถบล่าง: จำนวนที่เลือก · เลือกทั้งหมด · เปลี่ยนหน้า */}
          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 p-3">
            <p className="text-xs text-chalk/50">
              เลือกการ์ดแล้ว{' '}
              <span className="font-mono text-chalk">
                {selected.length} / {config.maxPerExchange}
              </span>{' '}
              ใบ
            </p>

            <button
              type="button"
              onClick={selectAll}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-chalk/70 transition-colors hover:text-chalk"
            >
              เลือกทั้งหมด
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                aria-label="หน้าก่อนหน้า"
                className="grid h-8 w-8 place-items-center rounded-lg text-chalk/50 hover:bg-white/5 disabled:opacity-25"
              >
                ‹
              </button>
              <span className="min-w-[64px] text-center font-mono text-xs">
                {page} / {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
                aria-label="หน้าถัดไป"
                className="grid h-8 w-8 place-items-center rounded-lg text-chalk/50 hover:bg-white/5 disabled:opacity-25"
              >
                ›
              </button>
            </div>
          </div>
        </section>

        {/* ══════════ ขวา: การ์ดที่เลือก + สรุปยอด ══════════ */}
        <section className="glass-panel flex flex-col gap-4 p-4">
          <div>
            <p className="panel-title">การ์ดที่เลือกแลก</p>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
              {Array.from({ length: PREVIEW_SLOTS }).map((_, slot) => {
                const entry = picked[slot];

                /*
                 * ช่องสุดท้ายเปลี่ยนเป็นตัวนับเมื่อเลือกเกิน 4 ใบ
                 * โชว์การ์ดทุกใบตรงนี้ไม่ไหว — เลือกได้ถึง 100 ใบ
                 */
                const isOverflow = slot === PREVIEW_SLOTS - 1 && picked.length > PREVIEW_SLOTS;

                if (isOverflow) {
                  return (
                    <div
                      key="overflow"
                      className="grid min-h-[180px] place-items-center rounded-xl border border-dashed border-gold/40 bg-gold/[0.05] p-3 text-center"
                    >
                      <span>
                        <span className="block font-display text-2xl text-gold">
                          +{picked.length - (PREVIEW_SLOTS - 1)}
                        </span>
                        <span className="text-[11px] text-chalk/45">ใบที่เหลือ</span>
                      </span>
                    </div>
                  );
                }

                if (!entry) {
                  return (
                    <div
                      key={`empty-${slot}`}
                      className="grid min-h-[180px] place-items-center rounded-xl border border-dashed border-white/15 p-3 text-center"
                    >
                      <span>
                        <span className="block text-2xl leading-none text-chalk/25">+</span>
                        <span className="mt-1 block text-[11px] text-chalk/35">เพิ่มการ์ด</span>
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={entry.card.id}
                    className="relative flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/25 p-2.5"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((current) => current.filter((id) => id !== entry.card.id))
                      }
                      aria-label="เอาออกจากรายการแลก"
                      className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-ink-900/90 text-[10px] text-chalk/60 hover:border-[#D93A3A]/60 hover:text-[#D93A3A]"
                    >
                      ×
                    </button>

                    <PlayerCard player={entry.player} size="xs" level={entry.card.level} />
                    <span className="w-full truncate text-center font-display text-xs uppercase">
                      {entry.player.name}
                    </span>
                    <span className="font-mono text-[10px] text-chalk/45">
                      OVR {getEffectivePlayerOvr(entry.card)}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-xs text-gold">
                      <Coin />
                      {formatNumber(getCardCashValue(entry.player, entry.card.level, config))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* สรุปยอด */}
          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="panel-title">สรุปการแลกเปลี่ยน</p>

            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-chalk/55">จำนวนการ์ดที่เลือก</dt>
                <dd className="font-mono">{summary.count} ใบ</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-chalk/55">รวมมูลค่าการ์ด</dt>
                <dd className="flex items-center gap-1.5 font-mono text-gold">
                  <Coin />
                  {formatNumber(summary.subtotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-chalk/55">
                  โบนัสพิเศษ ({Math.round(summary.bonusRate * 100)}%)
                </dt>
                <dd className="flex items-center gap-1.5 font-mono text-gold">
                  <Coin />
                  {formatNumber(summary.bonus)}
                </dd>
              </div>

              {summary.capped > 0 && (
                <div className="flex items-center justify-between text-rose-300">
                  <dt>เกินเพดานวันนี้</dt>
                  <dd className="font-mono">−{formatNumber(summary.capped)}</dd>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <dt className="font-display text-base text-gold">รับเงินทั้งหมด</dt>
                <dd className="flex items-center gap-2 font-display text-2xl text-neon">
                  <Coin className="h-5 w-5 text-[10px]" />
                  {formatNumber(summary.total)}
                </dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            disabled={summary.total <= 0}
            onClick={() => {
              playSfx('click');
              setConfirm(true);
            }}
            className={cn(
              'flex items-center justify-center gap-3 rounded-xl py-4 font-display text-lg tracking-wide transition-colors',
              summary.total > 0
                ? 'bg-gradient-to-r from-[#E8A82B] to-[#F5C842] text-ink-900 hover:brightness-110'
                : 'cursor-not-allowed bg-white/[0.06] text-chalk/30',
            )}
          >
            <Coin className="h-5 w-5 text-[10px]" />
            แลกเป็นเงิน {formatNumber(summary.total)}
          </button>

          <p className="text-center text-[11px] text-chalk/40">
            * การ์ดที่แลกแล้วจะหายไป ไม่สามารถกู้คืนได้
          </p>

          {/* เพดานรายวัน */}
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-chalk/55">เพดานวันนี้</span>
              <span className="font-mono">
                <span className={remainingToday > 0 ? 'text-neon' : 'text-rose-300'}>
                  {formatNumber(earnedToday)}
                </span>
                <span className="text-chalk/40"> / {formatNumber(config.dailyLimit)}</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-[width] duration-500"
                style={{
                  width: `${config.dailyLimit > 0 ? Math.min(100, (earnedToday / config.dailyLimit) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-chalk/40">
              แลกได้อีก {formatNumber(remainingToday)} วันนี้ · รีเซ็ตเที่ยงคืน
            </p>
          </div>

          {notice && <p className="text-center text-xs text-chalk/70">{notice}</p>}
        </section>
      </div>

      {/* ยืนยันก่อนแลก — การ์ดหายถาวร */}
      <Modal
        open={confirm}
        title="ยืนยันการแลกการ์ดเป็นเงิน"
        subtitle={`การ์ด ${summary.count} ใบจะหายจากคลังถาวร`}
        onClose={() => setConfirm(false)}
      >
        <div className="space-y-4 p-4">
          <p className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-[11px] text-gold/90">
            จะได้รับ {formatNumber(summary.total)} เงิน · แลกแล้วกู้คืนไม่ได้
            {summary.capped > 0 && (
              <span className="mt-1 block text-rose-300">
                ส่วนที่เกินเพดานวันนี้ {formatNumber(summary.capped)} จะไม่ได้รับ —
                เอาการ์ดออกบางใบแล้วค่อยมาแลกพรุ่งนี้จะคุ้มกว่า
              </span>
            )}
          </p>

          <ul className="max-h-56 space-y-1.5 overflow-y-auto">
            {picked.slice(0, 60).map(({ card, player }) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-ink-700/50 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {player.name}
                  <span className="ml-2 font-mono text-[10px] text-chalk/45">
                    {RARITY_STYLE[player.rarity].label} · OVR {getEffectivePlayerOvr(card)}
                  </span>
                </span>
                <span className="font-mono text-xs text-gold">
                  +{formatNumber(getCardCashValue(player, card.level, config))}
                </span>
              </li>
            ))}
            {picked.length > 60 && (
              <li className="px-3 py-1 text-center text-[11px] text-chalk/40">
                และอีก {picked.length - 60} ใบ
              </li>
            )}
          </ul>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="flex-1 rounded-lg border border-white/15 py-2.5 text-sm text-chalk/70 hover:text-chalk"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={confirmExchange}
              className="flex-1 rounded-lg bg-gradient-to-r from-[#E8A82B] to-[#F5C842] py-2.5 text-sm font-bold text-ink-900 hover:brightness-110"
            >
              แลกเลย +{formatNumber(summary.total)}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
