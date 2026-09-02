/**
 * ADMIN → ร้านไอเทม
 *
 * ตั้งได้ว่าไอเทมช่วยอัปเกรดแต่ละชนิด "ขายไหม ราคาเท่าไร จ่ายด้วยอะไร ทีละกี่ชิ้น"
 * บันทึกแล้วหน้าร้านฝั่งผู้เล่นเห็นทันที (config/upgradeItemShop → useGameConfig)
 *
 * ⚠️ ชื่อ คำอธิบาย และ "ผล" ของไอเทมไม่ได้ตั้งตรงนี้
 * เพราะผลของไอเทมผูกกับกติกาการอัปเกรด ต้องแก้ที่ src/data/upgradeConfig.ts
 * (ถ้าเปิดให้แอดมินแก้ผลได้ ตัวเลขบนหน้าจอกับที่ระบบคิดจริงจะหลุดจากกันทันที)
 */
import { useEffect, useState } from 'react';
import {
  DEFAULT_ITEM_SHOP,
  ITEM_BOOST_RATE,
  getUpgradeItem,
  normalizeItemShop,
  type UpgradeItemOffer,
  type UpgradeItemShopConfig,
} from '@/data/upgradeConfig';
import { useGameConfig } from '@/hooks/useGameConfig';
import { playSfx } from '@/services/sound';
import { cn, formatNumber } from '@/utils/helpers';

/** ช่องกรอกตัวเลขแบบเดียวกับแผงแอดมินอื่น ๆ */
const NumberField = ({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <label className="block">
    <span className="block font-mono text-[10px] uppercase tracking-wide text-chalk/45">
      {label}
    </span>
    <input
      type="number"
      min={0}
      value={value}
      onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 font-mono text-xs outline-none focus:bg-white/10"
    />
    {hint && <span className="mt-1 block text-[10px] text-chalk/35">{hint}</span>}
  </label>
);

export const UpgradeItemShopPanel = () => {
  const { itemShop, saveItemShop } = useGameConfig();
  const [draft, setDraft] = useState<UpgradeItemShopConfig>(itemShop);
  const [status, setStatus] = useState('');

  // ค่าจากเซิร์ฟเวอร์มาทีหลัง (onSnapshot) จึงต้องซิงก์ลงช่องแก้ไขเมื่อมันเปลี่ยน
  useEffect(() => setDraft(itemShop), [itemShop]);

  const editOffer = (id: string, patch: Partial<UpgradeItemOffer>) =>
    setDraft((prev) => ({
      ...prev,
      offers: prev.offers.map((offer) => (offer.id === id ? { ...offer, ...patch } : offer)),
    }));

  const save = async () => {
    playSfx('click');
    setStatus('กำลังบันทึก…');
    const error = await saveItemShop(normalizeItemShop(draft));
    setStatus(error ?? 'บันทึกแล้ว — หน้าร้านของผู้เล่นเห็นราคาใหม่ทันที');
  };

  /** ไอเทมที่ยังขายอยู่ ใช้เตือนตอนปิดหมดทุกชิ้น */
  const sellingCount = draft.offers.filter(
    (offer) => offer.enabled && (offer.price > 0 || offer.coinPrice > 0),
  ).length;

  return (
    <div className="space-y-4">
      <section className="glass-panel space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="panel-title">ร้านไอเทมช่วยอัปเกรด</p>
            <p className="mt-1 text-xs text-chalk/45">
              ผู้เล่นเข้าได้จากหน้า "อัปเกรดนักเตะ" — กดยอดแต้มตีบวกมุมขวาบน หรือช่อง + ในแถวไอเทม
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
            {draft.enabled ? 'ร้านเปิดอยู่' : 'ร้านปิดอยู่'}
          </button>
        </div>

        {!draft.enabled && (
          <p className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-[11px] text-gold/90">
            ปิดร้านแล้วผู้เล่นจะซื้อไม่ได้ แต่ไอเทมที่มีอยู่ในคลังยังใช้อัปเกรดได้ตามปกติ
          </p>
        )}

        {draft.enabled && sellingCount === 0 && (
          <p className="rounded-lg border border-rose-400/25 bg-rose-400/5 px-3 py-2 text-[11px] text-rose-200">
            ตอนนี้ไม่มีไอเทมชิ้นไหนขายได้เลย (ปิดไว้ หรือราคาเป็น 0 ทั้งสองช่องทาง)
          </p>
        )}

        <div className="space-y-3">
          {draft.offers.map((offer) => {
            const item = getUpgradeItem(offer.id);
            const noPrice = offer.price <= 0 && offer.coinPrice <= 0;

            return (
              <div
                key={offer.id}
                className={cn(
                  'rounded-xl border border-white/10 bg-black/25 p-4',
                  !offer.enabled && 'opacity-50',
                )}
              >
                <div className="flex flex-wrap items-center gap-4">
                  <img src={item.icon} alt="" className="h-[68px] w-auto shrink-0 object-contain" />

                  <div className="min-w-[180px] flex-1">
                    <p className={cn('font-display text-sm', item.text)}>{item.name}</p>
                    <p className="text-[11px] leading-snug text-chalk/45">{item.hint}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-chalk/30">
                      id: {offer.id} · ใส่ได้สูงสุด {item.maxPerAttempt} ชิ้นต่อการอัปเกรดหนึ่งครั้ง
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playSfx('click');
                      editOffer(offer.id, { enabled: !offer.enabled });
                    }}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase transition-colors',
                      offer.enabled ? 'bg-neon/90 text-ink-900' : 'bg-white/5 text-chalk/50',
                    )}
                  >
                    {offer.enabled ? 'ขายอยู่' : 'ซ่อนไว้'}
                  </button>
                </div>

                <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-3">
                  <NumberField
                    label="ราคา (แต้มตีบวก)"
                    hint="0 = ไม่ขายด้วยแต้ม"
                    value={offer.price}
                    onChange={(value) => editOffer(offer.id, { price: value })}
                  />
                  <NumberField
                    label="ราคา (BP / เหรียญ)"
                    hint="0 = ไม่ขายด้วย BP"
                    value={offer.coinPrice}
                    onChange={(value) => editOffer(offer.id, { coinPrice: value })}
                  />
                  <NumberField
                    label="ได้กี่ชิ้นต่อการกดซื้อ"
                    hint="ราคาที่โชว์ = ราคาต่อชิ้น × จำนวนนี้"
                    value={offer.bundle}
                    onChange={(value) => editOffer(offer.id, { bundle: Math.max(1, value) })}
                  />
                </div>

                {noPrice && offer.enabled && (
                  <p className="mt-2 text-[11px] text-rose-300">
                    ราคาเป็น 0 ทั้งสองช่องทาง — ไอเทมนี้จะไม่โผล่ในร้าน
                  </p>
                )}

                {/* พรีวิวราคาที่ผู้เล่นจะเห็นจริง */}
                <p className="mt-2 font-mono text-[11px] text-chalk/40">
                  ผู้เล่นเห็น:{' '}
                  {offer.enabled && !noPrice
                    ? [
                        offer.price > 0 &&
                          `${formatNumber(offer.price * Math.max(1, offer.bundle))} แต้ม`,
                        offer.coinPrice > 0 &&
                          `${formatNumber(offer.coinPrice * Math.max(1, offer.bundle))} BP`,
                      ]
                        .filter(Boolean)
                        .join(' / ') + ` → ได้ ${Math.max(1, offer.bundle)} ชิ้น`
                    : '— (ไม่แสดงในร้าน)'}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-chalk/40">
          ผลของไอเทมแก้ที่ src/data/upgradeConfig.ts · ตอนนี้ "เพิ่มโอกาส" ให้ +
          {Math.round(ITEM_BOOST_RATE * 100)}% ต่อชิ้น
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900"
          >
            บันทึกร้าน
          </button>
          <button
            type="button"
            onClick={() => {
              playSfx('click');
              setDraft(DEFAULT_ITEM_SHOP);
            }}
            className="rounded-lg bg-white/5 px-4 py-2 text-xs uppercase text-chalk/60 hover:bg-white/10"
          >
            คืนค่าเริ่มต้น
          </button>
        </div>

        {status && <p className="text-xs text-chalk/55">{status}</p>}
      </section>
    </div>
  );
};
