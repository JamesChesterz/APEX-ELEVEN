/**
 * หน้าแลกนักเตะ (เมนูอยู่ใต้ Card Pack) — มีสองแท็บ
 *   • แลกด้วยแต้ม  — จ่ายด้วยแต้มที่ได้จากการย่อยการ์ด
 *   • แลกด้วยการ์ด — จ่ายด้วยการ์ดที่มีอยู่ ตามดีลที่แอดมินสร้าง
 *
 * แท็บ "แลกด้วยแต้ม" ตอนนี้แอดมินคุมทั้งหมด (หน้า ADMIN → แลกด้วยแต้ม):
 * เปิด/ปิดทั้งแท็บได้ · เลือกการ์ดเอง · ตั้งราคาเอง · ตั้งเวลาที่การ์ดจะหายไปเอง
 * ระบบหมุนเวียนของทุก 3 ชั่วโมงและแท็บ "รอบถัดไป" ถูกยกเลิกไปแล้ว
 *
 * แลกสำเร็จแล้วใช้เอฟเฟกต์เผยการ์ดชุดเดียวกับการเปิดซอง (พร้อมเสียง)
 */
import { useMemo, useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PackRevealOverlay } from '@/components/pack/PackRevealOverlay';
import { PlayerCard } from '@/components/player/PlayerCard';
import { useExchange } from '@/hooks/useExchange';
import { useGameConfig } from '@/hooks/useGameConfig';
import { RARITY_TABS } from '@/services/exchange';
import { formatRemaining } from '@/services/pointsExchange';
import { SHOP_PROTECTED_RANKS } from '@/data/rankRewards';
import { playSfx } from '@/services/sound';
import { CardExchangeSection } from './CardExchangeSection';
import type { Rarity } from '@/types/player';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

/** สลับได้สองโหมด: แลกด้วยแต้ม (แอดมินเลือกการ์ดเอง) กับแลกด้วยการ์ด (ดีลที่แอดมินสร้างเอง) */
const EXCHANGE_MODES = [
  { key: 'points', label: 'แลกด้วยแต้ม' },
  { key: 'cards', label: 'แลกด้วยการ์ด' },
] as const;

type ExchangeMode = (typeof EXCHANGE_MODES)[number]['key'];

export const ExchangePage = () => {
  const [mode, setMode] = useState<ExchangeMode>('points');
  /* อ่านสวิตช์เปิด/ปิดร้านตรงจากค่าตั้งกลาง ไม่เรียก useExchange ซ้ำ (มันเดินนาฬิกาของมันเอง) */
  const { pointsExchange } = useGameConfig();
  const shopOpen = pointsExchange.enabled;

  /*
   * แอดมินปิดร้านแลกด้วยแต้ม = ซ่อนแท็บนั้นไปเลย ไม่ใช่โชว์แท็บเปล่า ๆ
   * และถ้าผู้เล่นค้างอยู่แท็บนั้นตอนแอดมินกดปิด ให้เด้งมาแท็บการ์ดเอง
   */
  const modes = EXCHANGE_MODES.filter((entry) => entry.key !== 'points' || shopOpen);
  const activeMode: ExchangeMode = mode === 'points' && !shopOpen ? 'cards' : mode;

  return (
    <div className="space-y-4">
      {modes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {modes.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                playSfx('click');
                setMode(entry.key);
              }}
              className={cn(
                'rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
                activeMode === entry.key
                  ? 'bg-neon text-ink-900'
                  : 'bg-white/5 text-chalk/60 hover:text-chalk',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {activeMode === 'points' ? <PointsExchangeSection /> : <CardExchangeSection />}
    </div>
  );
};

/** แท็บแลกด้วยแต้ม — ของในร้านมาจากหน้า ADMIN ล้วน ๆ */
const PointsExchangeSection = () => {
  const { points, offers, result, error, exchange, dismissResult, clearError } = useExchange();

  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [search, setSearch] = useState('');
  /** true = แสดงเฉพาะคนที่แต้มพอแลกได้ตอนนี้ */
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  /**
   * id ของรายการที่กำลังจะยืนยันการแลก (เก็บเป็น id ไม่ใช่ทั้งก้อน
   * เพื่อให้นาฬิกาในโมดัลเดินต่อ และถ้าใบนั้นหมดเวลากลางคัน โมดัลจะปิดเอง)
   */
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pending = offers.find((offer) => offer.itemId === pendingId) ?? null;

  /*
   * อาร์เรย์นี้ต้องคงตัวระหว่างที่ฉากเผยการ์ดเปิดอยู่
   * หน้านี้มีนาฬิกาเดินทุกวินาที ถ้าสร้างใหม่ทุกครั้งที่วาดจอ
   * ฉากเผยจะถูกรีเซ็ตทุกวินาทีจนการ์ดไม่มีวันโผล่
   */
  const revealEntries = useMemo(
    () => (result ? [{ card: result.card, player: result.player }] : []),
    [result],
  );

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
    if (exchange(pending)) setPendingId(null);
  };

  return (
    <div className="space-y-4">
      {/* ── หัวข้อ + ยอดแต้ม ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">แลกนักเตะด้วยแต้ม</h2>
          <p className="text-sm text-chalk/50">
            การ์ดในร้านคัดมาโดยทีมงาน · บางใบมีเวลาจำกัด ดูนาฬิกาบนการ์ดได้เลย ·
            แต้มได้จากการย่อยการ์ดที่หน้า INVENTORY
            <span className="mt-0.5 block text-gold/80">
              การ์ดรางวัลอันดับ 1–{SHOP_PROTECTED_RANKS} ของซีซันไม่เข้าร้านนี้ — ต้องขึ้นอันดับเอาเท่านั้น
            </span>
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
      {offers.length === 0 ? (
        <p className="panel py-12 text-center text-sm text-chalk/45">
          ตอนนี้ยังไม่มีการ์ดวางในร้าน — รอทีมงานเอาของเข้าร้านรอบใหม่ได้เลย
        </p>
      ) : visible.length === 0 ? (
        <p className="panel py-12 text-center text-sm text-chalk/45">
          ไม่มีนักเตะตรงเงื่อนไขนี้ — ลองเปลี่ยนตัวกรอง หรือย่อยการ์ดเพิ่มเพื่อสะสมแต้ม
        </p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {visible.map((offer) => {
            const { player, price, ownedCount, affordable, secondsLeft } = offer;
            /** เหลือไม่ถึงชั่วโมง = เปลี่ยนป้ายเป็นสีเตือน */
            const urgent = secondsLeft !== null && secondsLeft <= 3600;

            return (
              <article
                key={offer.itemId}
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

                {/* นาฬิกาถอยหลังเฉพาะใบที่แอดมินตั้งเวลาหมดอายุไว้ */}
                {secondsLeft !== null && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-mono text-[9px] tabular-nums',
                      urgent ? 'bg-gem/15 text-gem' : 'bg-white/5 text-chalk/55',
                    )}
                  >
                    เหลือ {formatRemaining(secondsLeft)}
                  </span>
                )}

                <button
                  type="button"
                  disabled={!affordable}
                  onClick={() => {
                    playSfx('click');
                    setPendingId(offer.itemId);
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
            );
          })}
        </div>
      )}

      {/* ── ยืนยันก่อนแลก ── */}
      <Modal
        open={pending !== null}
        title="ยืนยันการแลกนักเตะ"
        subtitle={
          pending ? `${pending.player.name} · ${pending.player.position} · OVR ${pending.player.ovr}` : ''
        }
        onClose={() => setPendingId(null)}
      >
        {pending && (
          <div className="flex flex-col items-center gap-4">
            <PlayerCard player={pending.player} size="lg" />

            <div className="w-full max-w-sm space-y-1.5 rounded-xl border border-white/10 bg-ink-700/50 p-4 text-sm">
              <p className="flex justify-between">
                <span className="text-chalk/55">ราคา</span>
                <span className="font-mono text-token">−{formatNumber(pending.price)} แต้ม</span>
              </p>
              <p className="flex justify-between">
                <span className="text-chalk/55">แต้มคงเหลือหลังแลก</span>
                <span className="font-mono">{formatNumber(points - pending.price)}</span>
              </p>
              {pending.secondsLeft !== null && (
                <p className="flex justify-between">
                  <span className="text-chalk/55">หายจากร้านในอีก</span>
                  <span className="font-mono tabular-nums">{formatRemaining(pending.secondsLeft)}</span>
                </p>
              )}
            </div>

            <div className="flex w-full max-w-sm gap-2">
              <button
                type="button"
                onClick={() => setPendingId(null)}
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
          entries={revealEntries}
          packName="แลกด้วยแต้ม"
          onClose={dismissResult}
        />
      )}
    </div>
  );
};
