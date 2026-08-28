/**
 * ตั้งค่าร้าน "แลกด้วยแต้ม" (แท็บ "แลกด้วยแต้ม" ของหน้า ADMIN)
 *
 * เดิมร้านนี้สุ่มของเองทุก 3 ชั่วโมง ตอนนี้แอดมินคุมเองทั้งหมด:
 *   • สวิตช์เดียวเปิด/ปิดทั้งเมนู (ปิดแล้วผู้เล่นไม่เห็นแท็บนี้เลย)
 *   • เลือกเองว่าจะเอาการ์ดใบไหนเข้าร้าน
 *   • ตั้งราคาแต้มของแต่ละใบ (มีปุ่มราคาอัตโนมัติตามสูตรเดิมให้กดได้)
 *   • ตั้งเวลาที่แต่ละใบจะหายไปจากหน้าแลก — ไม่ตั้ง = อยู่ยาวจนกว่าจะเอาออกเอง
 *
 * บันทึกแล้วหน้า Exchange ของทุกคนเปลี่ยนทันที ไม่ต้อง deploy ใหม่
 */
import { useMemo, useState } from 'react';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById, PLAYERS } from '@/data/players';
import { SHOP_PROTECTED_RANKS } from '@/data/rankRewards';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useRankRewards } from '@/hooks/useRankRewards';
import {
  createExchangeItem,
  formatRemaining,
  fromLocalInputValue,
  hoursFromNow,
  isExpired,
  POINTS_EXCHANGE_LIMITS,
  secondsUntilExpiry,
  suggestedPrice,
  toLocalInputValue,
} from '@/services/pointsExchange';
import { getShopProtectedCards } from '@/services/rankRewards';
import { playSfx } from '@/services/sound';
import type { PointsExchangeConfig, PointsExchangeItem } from '@/types/card';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none focus:border-neon/50';

/** ปุ่มลัดตั้งเวลาหมดอายุ (ชั่วโมง) */
const QUICK_EXPIRY = [
  { label: '+6 ชม.', hours: 6 },
  { label: '+1 วัน', hours: 24 },
  { label: '+3 วัน', hours: 72 },
  { label: '+7 วัน', hours: 168 },
] as const;

/** จำนวนการ์ดที่แสดงในตารางเลือกต่อครั้ง */
const PICKER_VISIBLE = 48;

export const PointsExchangePanel = () => {
  const { pointsExchange, savePointsExchange } = useGameConfig();
  const { cards: rewardCards } = useRankRewards();
  /** การ์ดรางวัลอันดับ 1–3 — ต่อให้เลือกมาก็ไม่ขึ้นร้าน ต้องเตือนให้แอดมินเห็น */
  const protectedCards = useMemo(() => getShopProtectedCards(rewardCards), [rewardCards]);

  /** ชุดที่กำลังแก้อยู่ (ยังไม่บันทึก) */
  const [draft, setDraft] = useState<PointsExchangeConfig>(pointsExchange);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
  const [syncedWith, setSyncedWith] = useState(pointsExchange);
  if (syncedWith !== pointsExchange) {
    setSyncedWith(pointsExchange);
    setDraft(pointsExchange);
  }

  const results = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    const list = term
      ? PLAYERS.filter(
          (player) =>
            player.name.toLowerCase().includes(term) ||
            player.position.toLowerCase().includes(term) ||
            player.rarity.toLowerCase().includes(term),
        )
      : PLAYERS;

    return [...list].sort((a, b) => b.ovr - a.ovr).slice(0, PICKER_VISIBLE);
  }, [keyword]);

  const full = draft.items.length >= POINTS_EXCHANGE_LIMITS.maxItems;

  const addItem = (playerId: string) => {
    if (full) return;
    playSfx('click');
    setDraft((current) => ({ ...current, items: [...current.items, createExchangeItem(playerId)] }));
  };

  const patchItem = (itemId: string, changes: Partial<PointsExchangeItem>) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...changes } : item)),
    }));
  };

  /** ลบ expiresAt ทิ้งทั้งคีย์ ไม่ใช่ตั้งเป็น undefined (Firestore ไม่รับ undefined) */
  const clearExpiry = (itemId: string) => {
    playSfx('click');
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        const { expiresAt: _drop, ...rest } = item;
        return rest;
      }),
    }));
  };

  const removeItem = (itemId: string) => {
    playSfx('click');
    setDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));
  };

  /** เอาเฉพาะใบที่หมดเวลาไปแล้วออกทีเดียว — ใช้เก็บกวาดหลังจบอีเวนต์ */
  const removeExpired = () => {
    playSfx('click');
    setDraft((current) => ({
      ...current,
      items: current.items.filter((item) => !isExpired(item)),
    }));
  };

  /** ตั้งเวลาหมดอายุให้ทุกใบพร้อมกัน — ใช้ตอนจัดร้านเป็นรอบ ๆ */
  const setExpiryForAll = (hours: number) => {
    playSfx('click');
    const expiresAt = hoursFromNow(hours);
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => ({ ...item, expiresAt })),
    }));
  };

  const submit = async () => {
    setSaving(true);
    setStatus(null);
    const error = await savePointsExchange(draft);
    setSaving(false);
    setStatus(error ?? 'บันทึกแล้ว — หน้า Exchange ของทุกคนเปลี่ยนทันที');
    if (!error) playSfx('rankUp');
  };

  const expiredCount = draft.items.filter((item) => isExpired(item)).length;

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">ร้านแลกนักเตะด้วยแต้ม</p>
          <p className="mt-1 text-xs text-chalk/45">
            {draft.items.length}/{POINTS_EXCHANGE_LIMITS.maxItems} ใบ · เลือกการ์ดเอง ตั้งราคาเอง
            ตั้งเวลาที่การ์ดจะหายไปเอง (ไม่ตั้ง = อยู่ยาว)
          </p>
        </div>

        {/* ── สวิตช์เปิด/ปิดทั้งเมนู ── */}
        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setDraft((current) => ({ ...current, enabled: !current.enabled }));
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors',
            draft.enabled ? 'bg-neon text-ink-900' : 'bg-white/10 text-chalk/50 hover:text-chalk',
          )}
        >
          {draft.enabled ? 'เปิดอยู่ — ผู้เล่นเห็นเมนูนี้' : 'ปิดอยู่ — ซ่อนเมนูนี้ทั้งแท็บ'}
        </button>
      </div>

      {!draft.enabled && (
        <p className="rounded-lg border border-[#F0A070]/30 bg-[#F0A070]/10 p-3 text-xs text-[#F0A070]">
          ปิดอยู่: แท็บ “แลกด้วยแต้ม” จะหายไปจากหน้า Exchange ของผู้เล่นทุกคน (แท็บแลกด้วยการ์ดยังใช้ได้ตามปกติ)
        </p>
      )}

      {/* ── เลือกการ์ดเข้าร้าน ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">เพิ่มการ์ดเข้าร้าน (กดที่การ์ดเพื่อเพิ่ม · ใบเดิมเพิ่มซ้ำได้)</p>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="ค้นหาชื่อ / ตำแหน่ง / ระดับ"
            className="w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-1.5 text-sm outline-none placeholder:text-chalk/30 focus:border-neon/50 sm:w-56"
          />
        </div>

        <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-white/10 bg-ink-900/40 p-2 sm:grid-cols-6 lg:grid-cols-8">
          {results.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => addItem(player.id)}
              disabled={full}
              className="flex flex-col items-center gap-1 rounded-lg border border-transparent p-1 transition-colors hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlayerCard player={player} size="xs" />
              <span className="w-full truncate text-center font-mono text-[9px] text-chalk/50">
                {player.name}
              </span>
              <span className={cn('font-mono text-[8px]', RARITY_STYLE[player.rarity].text)}>
                {player.ovr}
              </span>
            </button>
          ))}
        </div>

        {full && (
          <p className="text-[11px] text-[#F0A070]">
            ⚠️ เต็มแล้ว ({POINTS_EXCHANGE_LIMITS.maxItems} ใบ) — เอาใบเก่าออกก่อนถึงจะเพิ่มใหม่ได้
          </p>
        )}
      </div>

      {/* ── ตั้งค่ารวมทุกใบ ── */}
      {draft.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-ink-700/40 p-3">
          <span className="eyebrow mr-1">ตั้งเวลาหมดอายุให้ทุกใบ</span>
          {QUICK_EXPIRY.map((entry) => (
            <button
              key={entry.hours}
              type="button"
              onClick={() => setExpiryForAll(entry.hours)}
              className="rounded-lg border border-kit/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-kit hover:bg-kit/10"
            >
              {entry.label}
            </button>
          ))}

          {expiredCount > 0 && (
            <button
              type="button"
              onClick={removeExpired}
              className="ml-auto rounded-lg border border-[#F0A070]/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10"
            >
              ล้างใบที่หมดเวลาแล้ว ({expiredCount})
            </button>
          )}
        </div>
      )}

      {/* ── รายการในร้าน ── */}
      {draft.items.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-ink-900/40 p-4 text-center text-xs text-chalk/50">
          ยังไม่มีการ์ดในร้าน — กดเลือกจากตารางด้านบนเพื่อเพิ่มใบแรก
        </p>
      ) : (
        <div className="space-y-2">
          {draft.items.map((item) => {
            const player = getPlayerById(item.playerId);
            if (!player) return null;

            const expired = isExpired(item);
            const secondsLeft = secondsUntilExpiry(item);
            const isProtected = protectedCards.has(item.playerId);

            return (
              <div
                key={item.id}
                className={cn(
                  'grid gap-3 rounded-lg border bg-ink-900/40 p-3 lg:grid-cols-[auto,1fr,auto]',
                  expired || !item.enabled ? 'border-white/5 opacity-60' : 'border-white/10',
                )}
              >
                <div className="flex items-center gap-3">
                  <PlayerCard player={player} size="xs" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{player.name}</p>
                    <p className="font-mono text-[10px] text-chalk/45">
                      {player.position} · OVR {player.ovr} · {RARITY_STYLE[player.rarity].label}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {/* ราคา */}
                  <label className="block">
                    <span className="eyebrow">ราคา (แต้ม)</span>
                    <div className="mt-1 flex gap-1.5">
                      <input
                        type="number"
                        min={POINTS_EXCHANGE_LIMITS.minPrice}
                        max={POINTS_EXCHANGE_LIMITS.maxPrice}
                        value={item.price}
                        onChange={(event) =>
                          patchItem(item.id, {
                            price: Math.min(
                              Math.max(Number(event.target.value) || 0, POINTS_EXCHANGE_LIMITS.minPrice),
                              POINTS_EXCHANGE_LIMITS.maxPrice,
                            ),
                          })
                        }
                        className={cn(inputClass, 'font-mono')}
                      />
                      <button
                        type="button"
                        title={`ราคาอัตโนมัติตามสูตรเดิม = ${formatNumber(suggestedPrice(item.playerId))}`}
                        onClick={() => patchItem(item.id, { price: suggestedPrice(item.playerId) })}
                        className="shrink-0 rounded-lg border border-white/15 px-2.5 font-mono text-[10px] uppercase tracking-wider text-chalk/60 hover:text-chalk"
                      >
                        อัตโนมัติ
                      </button>
                    </div>
                  </label>

                  {/* เวลาที่การ์ดจะหายไปจากหน้าแลก */}
                  <label className="block">
                    <span className="eyebrow">หายจากร้านเมื่อ (ว่าง = อยู่ยาว)</span>
                    <div className="mt-1 flex gap-1.5">
                      <input
                        type="datetime-local"
                        value={toLocalInputValue(item.expiresAt)}
                        onChange={(event) => {
                          const next = fromLocalInputValue(event.target.value);
                          if (next) patchItem(item.id, { expiresAt: next });
                          else clearExpiry(item.id);
                        }}
                        className={cn(inputClass, 'font-mono text-xs')}
                      />
                      {item.expiresAt && (
                        <button
                          type="button"
                          onClick={() => clearExpiry(item.id)}
                          className="shrink-0 rounded-lg border border-white/15 px-2.5 font-mono text-[10px] uppercase tracking-wider text-chalk/60 hover:text-chalk"
                        >
                          ล้าง
                        </button>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {QUICK_EXPIRY.map((entry) => (
                        <button
                          key={entry.hours}
                          type="button"
                          onClick={() => patchItem(item.id, { expiresAt: hoursFromNow(entry.hours) })}
                          className="rounded-lg bg-white/5 px-2 py-0.5 font-mono text-[10px] text-chalk/55 hover:text-chalk"
                        >
                          {entry.label}
                        </button>
                      ))}

                      {secondsLeft !== null && (
                        <span
                          className={cn(
                            'font-mono text-[10px]',
                            expired ? 'text-[#F0A070]' : 'text-chalk/45',
                          )}
                        >
                          {expired ? 'หมดเวลาแล้ว' : `เหลือ ${formatRemaining(secondsLeft)}`}
                        </span>
                      )}
                    </div>
                  </label>

                  {isProtected && (
                    <p className="text-[11px] text-[#F0A070] sm:col-span-2">
                      ⚠️ ใบนี้เป็นการ์ดรางวัลอันดับ 1–{SHOP_PROTECTED_RANKS} ของซีซัน —
                      ระบบจะไม่แสดงในร้านให้ผู้เล่น (กติกาเดิม: ต้องขึ้นอันดับเอาเท่านั้น)
                    </p>
                  )}
                </div>

                {/* เปิด/ปิดรายใบ + ลบ */}
                <div className="flex flex-row items-start gap-1.5 lg:flex-col">
                  <button
                    type="button"
                    onClick={() => patchItem(item.id, { enabled: !item.enabled })}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
                      item.enabled
                        ? 'bg-neon/15 text-neon hover:bg-neon/25'
                        : 'bg-white/10 text-chalk/45 hover:text-chalk',
                    )}
                  >
                    {item.enabled ? 'แสดงอยู่' : 'ซ่อนอยู่'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-lg border border-[#F0A070]/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10"
                  >
                    เอาออก
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── บันทึก ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        {status && <p className="min-w-0 text-xs text-chalk/70">{status}</p>}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setDraft(pointsExchange)}
            className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-chalk/60 hover:text-chalk"
          >
            คืนค่าเดิม
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="rounded-lg bg-neon px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:bg-white/10 disabled:text-chalk/40"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกร้านแลกด้วยแต้ม'}
          </button>
        </div>
      </div>
    </section>
  );
};
