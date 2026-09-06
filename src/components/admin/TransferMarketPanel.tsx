/**
 * ADMIN → ตลาดซื้อขาย
 *
 * คุมได้ทุกอย่างของ Transfer Market จากที่เดียว: เปิด/ปิด · รอบเวลา · ปริมาณของ ·
 * ใครมีสิทธิ์ขึ้นตลาด · ราคาทุกระดับ · ใบเด่นประจำวัน · ประวัติการซื้อ
 *
 * ค่าที่บันทึกไปอยู่ในเอกสาร config/market ซึ่งทุกเครื่องอ่านแบบเรียลไทม์
 * และเพราะของในตลาดถูก "คำนวณ" จากค่าเหล่านี้ (ไม่ได้เก็บไว้ในฐานข้อมูล)
 * กดบันทึกปุ๊บตลาดของผู้เล่นทุกคนเปลี่ยนทันทีโดยไม่ต้อง deploy อะไรเลย
 *
 * ⚠️ ระวังสองอย่างที่พังเศรษฐกิจได้ทันที:
 *   1. ตัวคูณราคาต่ำเกินไป → ซื้อจากตลาดแล้วขายคืนได้กำไร = ปั๊มเหรียญไม่จำกัด
 *      (แผงนี้เตือนให้เห็นทันทีในตารางตัวอย่างราคา และ normalize บังคับขั้นต่ำไว้ที่ 1)
 *   2. ของเข้าเยอะเกินไป → การ์ดหายากกลายเป็นของถูก
 */
import { useEffect, useMemo, useState } from 'react';
import { CardMultiPicker } from '@/components/admin/CardMultiPicker';
import { PLAYERS, getPlayerById } from '@/data/players';
import { useGameConfig } from '@/hooks/useGameConfig';
import { DEFAULT_CARD_CASH, getCardCashValue } from '@/services/cardCash';
import { formatCountdown } from '@/services/exchangeRotation';
import {
  releaseMarketClaim,
  watchRecentClaims,
  type MarketClaimRecord,
} from '@/services/firebase/marketClaims';
import {
  getLiveListings,
  getMarketPool,
  getMarketPrice,
  getMarketWindowIndex,
  getWindowSpan,
  normalizeMarketConfig,
} from '@/services/market';
import { playSfx } from '@/services/sound';
import type { MarketConfig } from '@/types/market';
import { RARITY_ORDER, type Rarity } from '@/types/player';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

const FIELD =
  'mt-1 w-full rounded-lg bg-white/5 px-3 py-2 font-mono text-xs outline-none focus:bg-white/10';

const NumberField = ({
  label,
  hint,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) => (
  <label className="block">
    <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
      {label}
    </span>
    <input
      type="number"
      min={0}
      step={step}
      value={value}
      onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      className={FIELD}
    />
    {hint && <span className="mt-1 block text-[10px] text-chalk/35">{hint}</span>}
  </label>
);

const Block = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-white/10 bg-black/25 p-4">
    <p className="panel-title">{title}</p>
    {hint && <p className="mt-1 text-[11px] text-chalk/40">{hint}</p>}
    <div className="mt-3">{children}</div>
  </div>
);

export const TransferMarketPanel = () => {
  const { market, saveMarket } = useGameConfig();
  const [draft, setDraft] = useState<MarketConfig>(market);
  const [status, setStatus] = useState('');
  const [claims, setClaims] = useState<MarketClaimRecord[]>([]);
  const [tab, setTab] = useState<'config' | 'players' | 'claims'>('config');

  // ค่าจากเซิร์ฟเวอร์มาทีหลัง (onSnapshot) จึงต้องซิงก์ลงช่องแก้ไขเมื่อมันเปลี่ยน
  useEffect(() => setDraft(market), [market]);

  /** ประวัติการซื้อของรอบที่ยังใหม่ — เรียลไทม์ */
  useEffect(() => {
    const since = getMarketWindowIndex(new Date(), market) - getWindowSpan(market) * 4;
    return watchRecentClaims(since, setClaims);
  }, [market]);

  const clean = useMemo(() => normalizeMarketConfig(draft), [draft]);

  /** ตัวอย่างราคาจริงของแต่ละระดับ — เห็นผลของทุกตัวคูณก่อนกดบันทึก */
  const priceTable = useMemo(
    () =>
      RARITY_ORDER.map((rarity) => {
        const group = PLAYERS.filter((player) => player.rarity === rarity);
        if (group.length === 0) return null;

        const prices = group.map((player) => getMarketPrice(player, DEFAULT_CARD_CASH, clean));
        const resale = group.map((player) => getCardCashValue(player, 1, DEFAULT_CARD_CASH));

        return {
          rarity,
          count: group.length,
          low: Math.min(...prices),
          high: Math.max(...prices),
          // ขายคืนแพงสุดต้องต่ำกว่าราคาซื้อถูกสุดเสมอ ไม่งั้นมีช่องปั๊มเหรียญ
          risky: Math.max(...resale) >= Math.min(...prices),
        };
      }).filter(Boolean) as Array<{
        rarity: Rarity;
        count: number;
        low: number;
        high: number;
        risky: boolean;
      }>,
    [clean],
  );

  /** ของที่ผู้เล่นจะเห็นในตลาดตอนนี้ ถ้าบันทึกค่าชุดนี้ */
  const preview = useMemo(() => getLiveListings(new Date(), { config: clean }), [clean]);
  const poolSize = useMemo(() => getMarketPool(clean).length, [clean]);

  const save = async () => {
    playSfx('click');
    setStatus('กำลังบันทึก…');
    const error = await saveMarket(clean);
    setStatus(error ?? 'บันทึกแล้ว — ผู้เล่นทุกคนเห็นตลาดชุดใหม่ทันที');
  };

  const release = async (listingId: string) => {
    playSfx('click');
    const error = await releaseMarketClaim(listingId);
    setStatus(error ?? 'ปล่อยคืนตลาดแล้ว (การ์ดที่คนซื้อได้ไปแล้วไม่ได้ถูกดึงคืน)');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-title">ตลาดซื้อขาย (Transfer Market)</p>
          <p className="mt-1 text-xs text-chalk/45">
            ของในตลาดคำนวณจากค่าตั้งชุดนี้ทั้งหมด · ตอนนี้มีนักเตะที่ขึ้นตลาดได้{' '}
            {formatNumber(poolSize)} คน · ในตลาดตอนนี้ {preview.length} ใบ
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setDraft((prev) => ({ ...prev, enabled: !prev.enabled }));
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-xs font-bold uppercase transition-colors',
            draft.enabled ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/50',
          )}
        >
          {draft.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
        </button>
      </div>

      {/* ── แท็บย่อย ── */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'config', label: 'ค่าตั้ง & ราคา' },
            { id: 'players', label: 'นักเตะในตลาด' },
            { id: 'claims', label: `ประวัติการซื้อ (${claims.length})` },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              playSfx('click');
              setTab(entry.id);
            }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs uppercase tracking-wide transition-colors',
              tab === entry.id ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/55',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="space-y-4">
          <label className="block">
            <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
              ข้อความตอนตลาดปิด
            </span>
            <input
              type="text"
              maxLength={300}
              value={draft.closedMessage}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, closedMessage: event.target.value }))
              }
              className={FIELD}
            />
          </label>

          <Block
            title="รอบเวลาและปริมาณของ"
            hint={`ของในตลาดพร้อมกันโดยประมาณ = ของต่อรอบ × อายุเฉลี่ย ≈ ${Math.round(
              clean.listingsPerWindow *
                (((clean.minLifetimeHours + clean.maxLifetimeHours) / 2) * 60) /
                clean.windowMinutes,
            )} ใบ`}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <NumberField
                label="หนึ่งรอบกี่นาที"
                hint="ของชุดใหม่เข้าทุกเท่านี้"
                step={15}
                value={draft.windowMinutes}
                onChange={(value) => setDraft((prev) => ({ ...prev, windowMinutes: value }))}
              />
              <NumberField
                label="ของใหม่ต่อรอบ (ใบ)"
                value={draft.listingsPerWindow}
                onChange={(value) => setDraft((prev) => ({ ...prev, listingsPerWindow: value }))}
              />
              <NumberField
                label="อายุขั้นต่ำ (ชม.)"
                step={0.5}
                value={draft.minLifetimeHours}
                onChange={(value) => setDraft((prev) => ({ ...prev, minLifetimeHours: value }))}
              />
              <NumberField
                label="อายุสูงสุด (ชม.)"
                step={0.5}
                value={draft.maxLifetimeHours}
                onChange={(value) => setDraft((prev) => ({ ...prev, maxLifetimeHours: value }))}
              />
            </div>
          </Block>

          <Block title="ช่วง OVR และโอกาสออกของแต่ละระดับ" hint="น้ำหนักรวมกันเท่าไรก็ได้ ระบบหารสัดส่วนให้เอง · 0 = ไม่ออกเลย">
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="OVR ต่ำสุด"
                value={draft.minOvr}
                onChange={(value) => setDraft((prev) => ({ ...prev, minOvr: value }))}
              />
              <NumberField
                label="OVR สูงสุด"
                value={draft.maxOvr}
                onChange={(value) => setDraft((prev) => ({ ...prev, maxOvr: value }))}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-5">
              {RARITY_ORDER.map((rarity) => (
                <NumberField
                  key={rarity}
                  label={`น้ำหนัก ${RARITY_STYLE[rarity].label}`}
                  value={draft.rarityWeights[rarity]}
                  onChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      rarityWeights: { ...prev.rarityWeights, [rarity]: value },
                    }))
                  }
                />
              ))}
            </div>
          </Block>

          <Block
            title="ราคา"
            hint="ราคา = ราคาขายการ์ดคืน × ส่วนต่างตลาด × ตัวคูณระดับ × ตัวคูณตำแหน่ง แล้วปัดเศษ"
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <NumberField
                label="ส่วนต่างตลาด (เท่า)"
                hint="ต้องมากกว่า 1 เสมอ"
                step={0.1}
                value={draft.priceMarkup}
                onChange={(value) => setDraft((prev) => ({ ...prev, priceMarkup: value }))}
              />
              <NumberField
                label="ราคาต่ำสุด"
                step={1000}
                value={draft.priceMin}
                onChange={(value) => setDraft((prev) => ({ ...prev, priceMin: value }))}
              />
              <NumberField
                label="ราคาสูงสุด"
                step={100_000}
                value={draft.priceMax}
                onChange={(value) => setDraft((prev) => ({ ...prev, priceMax: value }))}
              />
              <NumberField
                label="ปัดราคาทีละ"
                step={100}
                value={draft.priceRoundTo}
                onChange={(value) => setDraft((prev) => ({ ...prev, priceRoundTo: value }))}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-5">
              {RARITY_ORDER.map((rarity) => (
                <NumberField
                  key={rarity}
                  label={`ตัวคูณ ${RARITY_STYLE[rarity].label}`}
                  step={0.5}
                  value={draft.rarityMultiplier[rarity]}
                  onChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      rarityMultiplier: { ...prev.rarityMultiplier, [rarity]: value },
                    }))
                  }
                />
              ))}
            </div>

            {/* ตารางราคาจริง — เห็นผลทันทีก่อนกดบันทึก */}
            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase text-chalk/35">
                <span className="w-24">ระดับ</span>
                <span className="w-16 text-right">จำนวน</span>
                <span className="flex-1 text-right">ช่วงราคาในตลาด</span>
              </div>

              {priceTable.map((row) => (
                <div key={row.rarity} className="flex items-center gap-3">
                  <span className={cn('w-24 font-mono text-[11px]', RARITY_STYLE[row.rarity].text)}>
                    {RARITY_STYLE[row.rarity].label}
                  </span>
                  <span className="w-16 text-right font-mono text-chalk/40">{row.count}</span>
                  <span
                    className={cn(
                      'flex-1 text-right font-mono',
                      row.risky ? 'text-gem' : 'text-gold',
                    )}
                  >
                    {formatNumber(row.low)} – {formatNumber(row.high)}
                    {row.risky && <span className="ml-2 text-[10px]">⚠ ถูกกว่าราคาขายคืน</span>}
                  </span>
                </div>
              ))}
            </div>
          </Block>

          <Block title="นักเตะเด่นประจำวัน" hint="ทุกคนเห็นคนเดียวกันทั้งวัน · เปลี่ยนตอนขึ้นวันแข่งใหม่ (06:00)">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  playSfx('click');
                  setDraft((prev) => ({ ...prev, featuredEnabled: !prev.featuredEnabled }));
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold uppercase',
                  draft.featuredEnabled ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/50',
                )}
              >
                {draft.featuredEnabled ? 'เปิดอยู่' : 'ปิดอยู่'}
              </button>

              {RARITY_ORDER.map((rarity) => {
                const on = draft.featuredRarities.includes(rarity);
                return (
                  <button
                    key={rarity}
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      setDraft((prev) => ({
                        ...prev,
                        featuredRarities: on
                          ? prev.featuredRarities.filter((entry) => entry !== rarity)
                          : [...prev.featuredRarities, rarity],
                      }));
                    }}
                    className={cn(
                      'rounded-lg border px-2.5 py-1.5 text-[11px] uppercase',
                      on
                        ? cn(RARITY_STYLE[rarity].text, RARITY_STYLE[rarity].border)
                        : 'border-white/10 text-chalk/35',
                    )}
                  >
                    {RARITY_STYLE[rarity].label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <NumberField
                label="ส่วนลด (0.15 = ลด 15%)"
                step={0.05}
                value={draft.featuredDiscount}
                onChange={(value) => setDraft((prev) => ({ ...prev, featuredDiscount: value }))}
              />

              <label className="block">
                <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
                  บังคับให้เป็นคนนี้
                </span>
                <select
                  value={draft.featuredPlayerId ?? ''}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, featuredPlayerId: event.target.value || null }))
                  }
                  className={cn(FIELD, 'bg-ink-800')}
                >
                  <option value="">— สุ่มตามวัน —</option>
                  {[...PLAYERS]
                    .sort((left, right) => right.ovr - left.ovr)
                    .map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} · OVR {player.ovr} · {RARITY_STYLE[player.rarity].label}
                      </option>
                    ))}
                </select>
                <span className="mt-1 block text-[10px] text-chalk/35">
                  เลือกไว้ = คนนี้เป็นใบเด่นทุกวันจนกว่าจะเปลี่ยน
                </span>
              </label>
            </div>
          </Block>
        </div>
      )}

      {tab === 'players' && (
        <div className="space-y-4">
          <Block
            title={`ห้ามขึ้นตลาด (${draft.blockedPlayers.length})`}
            hint="ใช้กันการ์ดอีเวนต์หรือการ์ดที่อยากให้ได้จากซองเท่านั้น · การ์ดรางวัลอันดับ 1–3 ถูกกันไว้ให้อยู่แล้วโดยอัตโนมัติ"
          >
            <CardMultiPicker
              selected={draft.blockedPlayers}
              max={200}
              onChange={(next) => setDraft((prev) => ({ ...prev, blockedPlayers: next }))}
            />
          </Block>

          <Block
            title={`เอาเฉพาะรายชื่อนี้ (${draft.allowedPlayers.length})`}
            hint="ว่างไว้ = ใช้ทุกคนตามปกติ · ใส่รายชื่อเมื่อไร ตลาดจะมีแค่คนในรายชื่อนี้ (ใช้ทำอีเวนต์ตลาดเฉพาะกิจ)"
          >
            <CardMultiPicker
              selected={draft.allowedPlayers}
              max={200}
              onChange={(next) => setDraft((prev) => ({ ...prev, allowedPlayers: next }))}
            />
          </Block>

          <Block title="ของในตลาดตอนนี้ (ตามค่าที่กำลังแก้)" hint="ยังไม่ได้บันทึก = ผู้เล่นยังไม่เห็นชุดนี้">
            <div className="space-y-1.5 text-xs">
              {preview.length === 0 && <p className="text-chalk/40">ไม่มีของเลย — ตรวจค่าตั้งอีกครั้ง</p>}

              {preview.map((listing) => {
                const player = getPlayerById(listing.playerId);
                const left = Math.max(
                  0,
                  Math.floor((new Date(listing.expiresAt).getTime() - Date.now()) / 1000),
                );

                return (
                  <div key={listing.id} className="flex items-center gap-3">
                    <span className={cn('w-20 font-mono text-[10px]', RARITY_STYLE[listing.rarity].text)}>
                      {RARITY_STYLE[listing.rarity].label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-chalk/60">
                      {listing.featured && <span className="mr-1 text-gold">★</span>}
                      {player?.name ?? listing.playerId}
                      <span className="ml-1.5 font-mono text-[10px] text-chalk/35">
                        {listing.position} · OVR {listing.ovr}
                      </span>
                    </span>
                    <span className="w-28 text-right font-mono text-gold">
                      {formatNumber(listing.price)}
                    </span>
                    <span className="w-20 text-right font-mono text-[10px] text-chalk/35">
                      {formatCountdown(left)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Block>
        </div>
      )}

      {tab === 'claims' && (
        <Block
          title="ใบจองล่าสุด"
          hint="ใบจองหนึ่งใบ = การซื้อหนึ่งครั้ง · ปล่อยคืนแล้วประกาศนั้นกลับมาซื้อได้อีก แต่การ์ดที่คนซื้อได้ไปแล้วไม่ถูกดึงคืน"
        >
          {claims.length === 0 ? (
            <p className="text-xs text-chalk/40">ยังไม่มีใครซื้อในช่วงนี้</p>
          ) : (
            <div className="space-y-1.5 text-xs">
              {claims.map((claim) => {
                const player = getPlayerById(claim.playerId);

                return (
                  <div key={claim.listingId} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-chalk/60">
                      {player?.name ?? claim.playerId}
                      <span className="ml-1.5 font-mono text-[10px] text-chalk/35">
                        {claim.buyerUid.slice(0, 10)}…
                      </span>
                    </span>
                    <span className="w-28 text-right font-mono text-gold">
                      {formatNumber(claim.price)}
                    </span>
                    <span className="w-32 text-right font-mono text-[10px] text-chalk/35">
                      {claim.atMs ? new Date(claim.atMs).toLocaleString('th-TH') : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void release(claim.listingId)}
                      className="shrink-0 rounded border border-white/10 px-2 py-1 text-[10px] uppercase text-chalk/50 hover:border-gem/50 hover:text-gem"
                    >
                      ปล่อยคืน
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Block>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-lg bg-neon px-6 py-2 text-sm font-bold uppercase text-ink-900 hover:bg-neon-dim"
        >
          บันทึก
        </button>
        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setDraft(market);
            setStatus('ย้อนกลับเป็นค่าที่บันทึกไว้แล้ว');
          }}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs uppercase text-chalk/60 hover:text-chalk"
        >
          ยกเลิกการแก้
        </button>
        {status && <span className="text-xs text-chalk/50">{status}</span>}
      </div>
    </section>
  );
};
