/**
 * หน้าแลกนักเตะด้วยแต้ม (เมนูอยู่ใต้ Card Pack)
 *
 * แต้มมาจากการย่อยการ์ดที่หน้า My Cards → เอามาแลกนักเตะที่อยากได้ตรง ๆ
 * ต่างจากการเปิดซองตรงที่ "เลือกได้ว่าจะเอาใคร" แต่แลกเปลี่ยนกับราคาที่แพงกว่าดวง
 *
 * แลกสำเร็จแล้วใช้เอฟเฟกต์เผยการ์ดชุดเดียวกับการเปิดซอง (พร้อมเสียง)
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PackRevealOverlay } from '@/components/pack/PackRevealOverlay';
import { PlayerCard } from '@/components/player/PlayerCard';
import { useExchange } from '@/hooks/useExchange';
import { EXCHANGE_RATE, RARITY_TABS } from '@/services/exchange';
import { playSfx } from '@/services/sound';
import type { Player, Rarity } from '@/types/player';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

export const ExchangePage = () => {
  const { points, offers, result, error, exchange, dismissResult, clearError } = useExchange();

  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [search, setSearch] = useState('');
  /** true = แสดงเฉพาะคนที่แต้มพอแลกได้ตอนนี้ */
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  /** นักเตะที่กำลังจะยืนยันการแลก */
  const [pending, setPending] = useState<Player | null>(null);

  const visible = useMemo(
    () =>
      offers.filter((offer) => {
        if (rarity !== 'all' && offer.player.rarity !== rarity) return false;
        if (onlyAffordable && !offer.affordable) return false;
        if (search && !offer.player.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [offers, onlyAffordable, rarity, search],
  );

  /** จำนวนคนที่แลกได้ตอนนี้ ใช้บอกสถานะรวมด้านบน */
  const affordableCount = offers.filter((offer) => offer.affordable).length;

  const confirmExchange = () => {
    if (!pending) return;
    if (exchange(pending)) setPending(null);
  };

  return (
    <div className="space-y-4">
      {/* ── หัวข้อ + ยอดแต้ม ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">แลกนักเตะด้วยแต้ม</h2>
          <p className="text-sm text-chalk/50">
            เลือกนักเตะที่อยากได้ตรง ๆ ไม่ต้องลุ้นดวง · แต้มได้จากการย่อยการ์ดที่หน้า My Cards
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-token/40 bg-token/10 px-4 py-2">
          <span className="eyebrow">แต้มคงเหลือ</span>
          <span className="font-display text-2xl text-token">{formatNumber(points)}</span>
        </div>
      </div>

      {error && (
        <p className="flex items-center justify-between gap-3 rounded-lg border border-gem/40 bg-gem/10 px-4 py-2 text-sm text-gem">
          {error}
          <button type="button" onClick={clearError} className="text-xs uppercase tracking-wider">
            ปิด
          </button>
        </p>
      )}

      {/* ── ตัวกรอง ── */}
      <div className="flex flex-wrap items-center gap-2">
        {RARITY_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              playSfx('click');
              setRarity(tab.key);
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
              rarity === tab.key ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/60 hover:text-chalk',
            )}
          >
            {tab.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setOnlyAffordable((current) => !current);
          }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
            onlyAffordable
              ? 'bg-token text-ink-900'
              : 'bg-white/5 text-chalk/60 hover:text-chalk',
          )}
        >
          แลกได้ตอนนี้ ({affordableCount})
        </button>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาชื่อนักเตะ"
          className="ml-auto w-full rounded-lg border border-white/10 bg-ink-900/70 px-3 py-2 text-sm outline-none placeholder:text-chalk/25 focus:border-neon/60 sm:w-56"
        />
      </div>

      {/* ── การ์ดที่มีให้แลก ── */}
      {visible.length === 0 ? (
        <p className="panel py-12 text-center text-sm text-chalk/45">
          ไม่มีนักเตะตรงเงื่อนไขนี้ — ลองเปลี่ยนตัวกรอง หรือย่อยการ์ดเพิ่มเพื่อสะสมแต้ม
        </p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {visible.map(({ player, price, ownedCount, affordable }) => (
            <article
              key={player.id}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border bg-ink-800/60 p-3 transition-colors',
                affordable ? 'border-white/10 hover:border-token/50' : 'border-white/5 opacity-70',
              )}
            >
              <div className="relative">
                <PlayerCard player={player} size="sm" />
                {ownedCount > 0 && (
                  // เตือนว่ามีอยู่แล้ว เพราะนักเตะชื่อซ้ำลงตัวจริงพร้อมกันไม่ได้
                  <span className="absolute -right-1 -top-1 rounded-full bg-neon px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink-900">
                    มีแล้ว {ownedCount}
                  </span>
                )}
              </div>

              <p className="w-full truncate text-center text-[11px] font-semibold">{player.name}</p>

              <p className="font-mono text-[10px] text-chalk/45">
                {player.position} · OVR {player.ovr}
              </p>

              <span className={cn('font-mono text-[9px] uppercase', RARITY_STYLE[player.rarity].text)}>
                {RARITY_STYLE[player.rarity].label}
              </span>

              <button
                type="button"
                disabled={!affordable}
                onClick={() => {
                  playSfx('click');
                  setPending(player);
                }}
                className={cn(
                  'mt-auto w-full rounded-lg py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors',
                  affordable
                    ? 'bg-token text-ink-900 hover:brightness-110'
                    : 'cursor-not-allowed bg-white/5 text-chalk/35',
                )}
              >
                {formatNumber(price)} แต้ม
              </button>
            </article>
          ))}
        </div>
      )}

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.15em] text-chalk/30">
        ราคาแลก = แต้มที่ได้จากการย่อยการ์ดใบนั้น × {EXCHANGE_RATE}
      </p>

      {/* ── ยืนยันก่อนแลก ── */}
      <Modal
        open={pending !== null}
        title="ยืนยันการแลกนักเตะ"
        subtitle={pending ? `${pending.name} · ${pending.position} · OVR ${pending.ovr}` : ''}
        onClose={() => setPending(null)}
      >
        {pending && (
          <div className="flex flex-col items-center gap-4">
            <PlayerCard player={pending} size="lg" />

            <div className="w-full max-w-sm space-y-1.5 rounded-xl border border-white/10 bg-ink-700/50 p-4 text-sm">
              <p className="flex justify-between">
                <span className="text-chalk/55">ราคา</span>
                <span className="font-mono text-token">
                  −{formatNumber(pending ? offers.find((o) => o.player.id === pending.id)!.price : 0)} แต้ม
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-chalk/55">แต้มคงเหลือหลังแลก</span>
                <span className="font-mono">
                  {formatNumber(
                    points - (offers.find((o) => o.player.id === pending.id)?.price ?? 0),
                  )}
                </span>
              </p>
            </div>

            <div className="flex w-full max-w-sm gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="flex-1 rounded-lg border border-white/15 py-2.5 text-xs font-bold uppercase tracking-wider text-chalk/70 hover:text-chalk"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmExchange}
                className="flex-1 rounded-lg bg-token py-2.5 text-xs font-bold uppercase tracking-wider text-ink-900 hover:brightness-110"
              >
                แลกเลย
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* แลกสำเร็จ → ใช้ฉากเผยการ์ดชุดเดียวกับการเปิดซอง (ได้เสียงและเอฟเฟกต์ครบ) */}
      {result && (
        <PackRevealOverlay
          key={result.at}
          entries={[{ card: result.card, player: result.player }]}
          packName="แลกด้วยแต้ม"
          onClose={dismissResult}
        />
      )}
    </div>
  );
};
