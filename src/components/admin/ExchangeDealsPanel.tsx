/**
 * สร้าง/แก้ดีลแลกเปลี่ยนการ์ด (แท็บ "แลกเปลี่ยนการ์ด" ของหน้า ADMIN)
 *
 * บันทึกแล้วเมนู Exchange ของทุกคนเปลี่ยนทันที ไม่ต้อง deploy ใหม่
 * ยังไม่เคยบันทึก = ยังไม่มีดีลให้แลกเลย (ต่างจากซองการ์ดที่มีค่าเริ่มต้นในโค้ด)
 *
 * แต่ละดีล: การ์ดรางวัล 1 ใบ + เงื่อนไขที่ผู้เล่นต้องเข้าอย่างใดอย่างหนึ่ง
 * (จำนวนเฉย ๆ / OVR ขั้นต่ำ / ตำแหน่ง / นักเตะคนเดียวกันซ้ำ)
 */
import { useState } from 'react';
import { CardMultiPicker } from '@/components/admin/CardMultiPicker';
import { PlayerCard } from '@/components/player/PlayerCard';
import { getPlayerById } from '@/data/players';
import { useGameConfig } from '@/hooks/useGameConfig';
import {
  createEmptyDeal,
  describeRequirement,
  EXCHANGE_DEAL_LIMITS,
  POSITIONS,
  REQUIREMENT_LABELS,
  REQUIREMENT_TYPES,
} from '@/services/exchangeDeals';
import { playSfx } from '@/services/sound';
import type { ExchangeDeal, ExchangeRequirementType } from '@/types/card';
import type { Position } from '@/types/player';
import { cn } from '@/utils/helpers';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="eyebrow">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const inputClass =
  'w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm outline-none focus:border-neon/50';

export const ExchangeDealsPanel = () => {
  const { exchangeDeals, saveExchangeDeals } = useGameConfig();

  /** ชุดที่กำลังแก้อยู่ (ยังไม่บันทึก) */
  const [draft, setDraft] = useState<ExchangeDeal[]>(exchangeDeals);
  const [editing, setEditing] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** ค่าจากเซิร์ฟเวอร์เปลี่ยน = ดึงมาเป็นจุดตั้งต้นใหม่ */
  const [syncedWith, setSyncedWith] = useState(exchangeDeals);
  if (syncedWith !== exchangeDeals) {
    setSyncedWith(exchangeDeals);
    setDraft(exchangeDeals);
    setEditing(0);
  }

  const deal = draft[editing];

  const patch = (changes: Partial<ExchangeDeal>) => {
    setDraft((current) =>
      current.map((entry, index) => (index === editing ? { ...entry, ...changes } : entry)),
    );
  };

  const patchRequirementType = (type: ExchangeRequirementType) => {
    if (!deal) return;
    const count = deal.requirement.count;
    if (type === 'minOvr') {
      patch({ requirement: { type, count, minOvr: EXCHANGE_DEAL_LIMITS.minOvrFloor } });
    } else if (type === 'position') {
      patch({ requirement: { type, count, position: 'ST' } });
    } else if (type === 'samePlayer') {
      patch({ requirement: { type, count, samePlayerId: deal.rewardPlayerId } });
    } else {
      patch({ requirement: { type: 'quantity', count } });
    }
  };

  const addDeal = () => {
    if (draft.length >= EXCHANGE_DEAL_LIMITS.maxDeals) return;
    playSfx('click');
    setDraft((current) => [...current, createEmptyDeal()]);
    setEditing(draft.length);
  };

  const removeDeal = () => {
    if (draft.length <= 0) return;
    playSfx('click');
    setDraft((current) => current.filter((_, index) => index !== editing));
    setEditing((current) => Math.max(0, current - 1));
  };

  const submit = async () => {
    setSaving(true);
    setStatus(null);
    const error = await saveExchangeDeals(draft);
    setSaving(false);
    setStatus(error ?? 'บันทึกแล้ว — เมนู Exchange ของทุกคนเปลี่ยนทันที');
    if (!error) playSfx('rankUp');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="panel-title">ดีลแลกเปลี่ยนการ์ด</p>
          <p className="mt-1 text-xs text-chalk/45">
            {draft.length}/{EXCHANGE_DEAL_LIMITS.maxDeals} ดีล · ผู้เล่นเอาการ์ดที่เข้าเงื่อนไขมาแลกการ์ดรางวัลของดีลนั้น
          </p>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={draft.length >= EXCHANGE_DEAL_LIMITS.maxDeals}
            onClick={addDeal}
            className="rounded-lg border border-neon/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neon hover:bg-neon/10 disabled:opacity-40"
          >
            + เพิ่มดีล
          </button>
          <button
            type="button"
            disabled={draft.length === 0}
            onClick={removeDeal}
            className="rounded-lg border border-[#F0A070]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F0A070] hover:bg-[#F0A070]/10 disabled:opacity-40"
          >
            ลบดีลนี้
          </button>
        </div>
      </div>

      {draft.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-ink-900/40 p-4 text-center text-xs text-chalk/50">
          ยังไม่มีดีล — กด “+ เพิ่มดีล” เพื่อเริ่มสร้างดีลแรก
        </p>
      )}

      {draft.length > 0 && deal && (
        <>
          {/* ── เลือกดีลที่จะแก้ ── */}
          <div className="flex flex-wrap gap-1.5">
            {draft.map((entry, index) => {
              const rewardPlayer = getPlayerById(entry.rewardPlayerId);
              return (
                <button
                  key={`${entry.id}-${index}`}
                  type="button"
                  onClick={() => {
                    playSfx('click');
                    setEditing(index);
                  }}
                  className={cn(
                    'max-w-[14rem] truncate rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    index === editing
                      ? 'bg-neon text-ink-900'
                      : entry.enabled
                        ? 'bg-white/5 text-chalk/55 hover:text-chalk'
                        : 'bg-white/5 text-chalk/25 hover:text-chalk/50',
                  )}
                >
                  {rewardPlayer?.name ?? 'ยังไม่เลือกการ์ด'}
                  {!entry.enabled && ' (ปิด)'}
                </button>
              );
            })}
          </div>

          {/* ── รายละเอียดดีล ── */}
          <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
            <div className="flex flex-col items-center gap-2">
              <p className="eyebrow">การ์ดรางวัล</p>
              {getPlayerById(deal.rewardPlayerId) ? (
                <PlayerCard player={getPlayerById(deal.rewardPlayerId)!} size="md" />
              ) : (
                <div className="flex h-32 w-24 items-center justify-center rounded-lg border border-dashed border-white/15 text-[10px] text-chalk/40">
                  ยังไม่เลือก
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Field label="เลือกการ์ดรางวัล (เลือกได้ 1 ใบ — ลบชิปเดิมก่อนถ้าจะเปลี่ยน)">
                <CardMultiPicker
                  selected={deal.rewardPlayerId ? [deal.rewardPlayerId] : []}
                  onChange={(ids) => patch({ rewardPlayerId: ids[ids.length - 1] ?? '' })}
                  max={1}
                />
              </Field>

              <Field label="เปิดใช้งานดีลนี้">
                <button
                  type="button"
                  onClick={() => patch({ enabled: !deal.enabled })}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    deal.enabled
                      ? 'bg-neon text-ink-900'
                      : 'bg-white/10 text-chalk/50 hover:text-chalk',
                  )}
                >
                  {deal.enabled ? 'เปิดอยู่ — ผู้เล่นแลกได้' : 'ปิดอยู่ — ซ่อนจากผู้เล่น'}
                </button>
              </Field>

              <Field label="คำโปรย (ไม่บังคับ)">
                <input
                  value={deal.description}
                  maxLength={EXCHANGE_DEAL_LIMITS.maxDescriptionChars}
                  placeholder="เช่น ดีลจำกัดเวลา แลกได้ถึงสิ้นเดือน"
                  onChange={(event) => patch({ description: event.target.value })}
                  className={cn(inputClass, 'placeholder:text-chalk/30')}
                />
              </Field>
            </div>
          </div>

          {/* ── เงื่อนไข ── */}
          <div className="space-y-3 rounded-lg border border-white/10 bg-ink-700/50 p-3">
            <p className="eyebrow">เงื่อนไขการแลก (เลือกได้อย่างเดียว)</p>

            <div className="flex flex-wrap gap-1.5">
              {REQUIREMENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => patchRequirementType(type)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                    deal.requirement.type === type
                      ? 'bg-kit text-ink-900'
                      : 'bg-white/5 text-chalk/55 hover:text-chalk',
                  )}
                >
                  {REQUIREMENT_LABELS[type]}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`จำนวนการ์ดที่ต้องใช้แลก (${EXCHANGE_DEAL_LIMITS.minCount}–${EXCHANGE_DEAL_LIMITS.maxCount})`}>
                <input
                  type="number"
                  min={EXCHANGE_DEAL_LIMITS.minCount}
                  max={EXCHANGE_DEAL_LIMITS.maxCount}
                  value={deal.requirement.count}
                  onChange={(event) =>
                    patch({
                      requirement: {
                        ...deal.requirement,
                        count: Math.min(
                          Math.max(Number(event.target.value) || EXCHANGE_DEAL_LIMITS.minCount, EXCHANGE_DEAL_LIMITS.minCount),
                          EXCHANGE_DEAL_LIMITS.maxCount,
                        ),
                      },
                    })
                  }
                  className={cn(inputClass, 'font-mono')}
                />
              </Field>

              {deal.requirement.type === 'minOvr' && (
                <Field label={`OVR ขั้นต่ำ (${EXCHANGE_DEAL_LIMITS.minOvrFloor}–${EXCHANGE_DEAL_LIMITS.minOvrCeil})`}>
                  <input
                    type="number"
                    min={EXCHANGE_DEAL_LIMITS.minOvrFloor}
                    max={EXCHANGE_DEAL_LIMITS.minOvrCeil}
                    value={deal.requirement.minOvr ?? EXCHANGE_DEAL_LIMITS.minOvrFloor}
                    onChange={(event) =>
                      patch({
                        requirement: {
                          ...deal.requirement,
                          minOvr: Math.min(
                            Math.max(
                              Number(event.target.value) || EXCHANGE_DEAL_LIMITS.minOvrFloor,
                              EXCHANGE_DEAL_LIMITS.minOvrFloor,
                            ),
                            EXCHANGE_DEAL_LIMITS.minOvrCeil,
                          ),
                        },
                      })
                    }
                    className={cn(inputClass, 'font-mono')}
                  />
                </Field>
              )}

              {deal.requirement.type === 'position' && (
                <Field label="ตำแหน่งที่ต้องการ">
                  <select
                    value={deal.requirement.position ?? 'ST'}
                    onChange={(event) =>
                      patch({
                        requirement: { ...deal.requirement, position: event.target.value as Position },
                      })
                    }
                    className={inputClass}
                  >
                    {POSITIONS.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            {deal.requirement.type === 'samePlayer' && (
              <Field label="นักเตะที่ต้องใช้ (เลือกได้ 1 ใบ — ลบชิปเดิมก่อนถ้าจะเปลี่ยน)">
                <CardMultiPicker
                  selected={deal.requirement.samePlayerId ? [deal.requirement.samePlayerId] : []}
                  onChange={(ids) =>
                    patch({
                      requirement: { ...deal.requirement, samePlayerId: ids[ids.length - 1] ?? '' },
                    })
                  }
                  max={1}
                />
              </Field>
            )}

            <p className="text-[11px] text-chalk/50">สรุป: {describeRequirement(deal.requirement)}</p>
          </div>
        </>
      )}

      {/* ── บันทึก ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        {status && <p className="min-w-0 text-xs text-chalk/70">{status}</p>}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setDraft(exchangeDeals)}
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
            {saving ? 'กำลังบันทึก…' : 'บันทึกดีลแลกเปลี่ยน'}
          </button>
        </div>
      </div>
    </section>
  );
};
