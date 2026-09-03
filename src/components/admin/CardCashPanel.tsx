/**
 * ADMIN → แลกการ์ดเป็นเงิน
 *
 * ปรับได้: เปิด/ปิดระบบ · เพดานเงินต่อวันต่อบัญชี · ตัวคูณราคาทั้งระบบ ·
 * จำนวนการ์ดที่เลือกได้ต่อครั้ง
 *
 * ⚠️ สูตรตีราคา (ระดับการ์ด × OVR × ค่าตีบวก) ไม่ได้เปิดให้แก้ที่นี่
 * เพราะเป็นสมดุลเศรษฐกิจของทั้งเกม แก้ที่ services/cardCash.ts ที่เดียว
 * ตัวคูณ rate มีไว้ปรับทั้งกระดานพร้อมกันโดยไม่ทำให้สัดส่วนระหว่างระดับเพี้ยน
 */
import { useEffect, useMemo, useState } from 'react';
import { PLAYERS } from '@/data/players';
import { useGameConfig } from '@/hooks/useGameConfig';
import { DEFAULT_CARD_CASH, getCardCashValue, normalizeCardCash } from '@/services/cardCash';
import { playSfx } from '@/services/sound';
import type { CardCashConfig } from '@/types/cardCash';
import type { Rarity } from '@/types/player';
import { cn, formatNumber, RARITY_STYLE } from '@/utils/helpers';

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
      className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 font-mono text-xs outline-none focus:bg-white/10"
    />
    {hint && <span className="mt-1 block text-[10px] text-chalk/35">{hint}</span>}
  </label>
);

export const CardCashPanel = () => {
  const { cardCash, saveCardCash } = useGameConfig();
  const [draft, setDraft] = useState<CardCashConfig>(cardCash);
  const [status, setStatus] = useState('');

  // ค่าจากเซิร์ฟเวอร์มาทีหลัง (onSnapshot) จึงต้องซิงก์ลงช่องแก้ไขเมื่อมันเปลี่ยน
  useEffect(() => setDraft(cardCash), [cardCash]);

  /**
   * ตัวอย่างราคาจริงของแต่ละระดับ — ใช้การ์ด OVR สูงสุดที่มีจริงในเกมของระดับนั้น
   * ตั้งเพดานหรือ rate แล้วเห็นผลทันทีว่าการ์ดใบเก่งสุดจะขายได้เท่าไร
   */
  const samples = useMemo(() => {
    const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythical'];
    const clean = normalizeCardCash(draft);

    return rarities
      .map((rarity) => {
        const best = PLAYERS.filter((player) => player.rarity === rarity).sort(
          (left, right) => right.ovr - left.ovr,
        )[0];
        if (!best) return null;

        return {
          rarity,
          player: best,
          plain: getCardCashValue(best, 1, clean),
          // level 9 = +8 (ค่าบวกสูงสุดของเกม)
          maxed: getCardCashValue(best, 9, clean),
        };
      })
      .filter(Boolean) as Array<{
      rarity: Rarity;
      player: (typeof PLAYERS)[number];
      plain: number;
      maxed: number;
    }>;
  }, [draft]);

  const save = async () => {
    playSfx('click');
    setStatus('กำลังบันทึก…');
    const error = await saveCardCash(normalizeCardCash(draft));
    setStatus(error ?? 'บันทึกแล้ว — ผู้เล่นเห็นราคาใหม่ทันที');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-title">แลกการ์ดเป็นเงิน</p>
          <p className="mt-1 text-xs text-chalk/45">
            ผู้เล่นขายการ์ดที่ไม่ใช้เป็นเงิน (BP) · ราคาคิดจาก ระดับการ์ด × OVR × ค่าตีบวก
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

      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="เพดานเงินต่อวัน (ต่อบัญชี)"
          hint="รีเซ็ตเที่ยงคืนตามเวลาเครื่องผู้เล่น · 0 = แลกไม่ได้เลย"
          step={10_000}
          value={draft.dailyLimit}
          onChange={(value) => setDraft((prev) => ({ ...prev, dailyLimit: value }))}
        />
        <NumberField
          label="ตัวคูณราคาทั้งระบบ"
          hint="1 = ราคามาตรฐาน · 1.5 = แพงขึ้น 50% ทุกใบ"
          step={0.1}
          value={draft.rate}
          onChange={(value) => setDraft((prev) => ({ ...prev, rate: value }))}
        />
        <NumberField
          label="เลือกได้สูงสุดต่อครั้ง"
          hint="กันการกดแลกทีเดียวทั้งคลังโดยไม่ตั้งใจ"
          value={draft.maxPerExchange}
          onChange={(value) => setDraft((prev) => ({ ...prev, maxPerExchange: value }))}
        />
      </div>

      {/* ตัวอย่างราคาจริง — เห็นผลของ rate ทันทีก่อนกดบันทึก */}
      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
        <p className="panel-title">ตัวอย่างราคา (การ์ด OVR สูงสุดของแต่ละระดับ)</p>

        <div className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase text-chalk/35">
            <span className="w-24">ระดับ</span>
            <span className="flex-1">นักเตะ</span>
            <span className="w-24 text-right">+0</span>
            <span className="w-28 text-right">+8</span>
          </div>

          {samples.map((sample) => (
            <div key={sample.rarity} className="flex items-center gap-3">
              <span className={cn('w-24 font-mono text-[11px]', RARITY_STYLE[sample.rarity].text)}>
                {RARITY_STYLE[sample.rarity].label}
              </span>
              <span className="min-w-0 flex-1 truncate text-chalk/60">
                {sample.player.name}
                <span className="ml-1.5 font-mono text-[10px] text-chalk/35">
                  OVR {sample.player.ovr}
                </span>
              </span>
              <span className="w-24 text-right font-mono text-chalk/60">
                {formatNumber(sample.plain)}
              </span>
              <span className="w-28 text-right font-mono text-gold">
                {formatNumber(sample.maxed)}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-chalk/40">
          การ์ด mythical +8 ตั้งใจให้ราคาสูงมาก — ถ้าราคาใบเดียวเกินเพดานรายวัน
          ผู้เล่นจะได้แค่เท่าเพดาน ส่วนเกินหายไป หน้าเว็บเตือนก่อนกดยืนยันแล้ว
          แต่ควรตั้งเพดานให้สูงกว่าราคาใบแพงสุดอย่างน้อยหนึ่งใบ
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900"
        >
          บันทึก
        </button>
        <button
          type="button"
          onClick={() => {
            playSfx('click');
            setDraft(DEFAULT_CARD_CASH);
          }}
          className="rounded-lg bg-white/5 px-4 py-2 text-xs uppercase text-chalk/60 hover:bg-white/10"
        >
          คืนค่าเริ่มต้น
        </button>
        {status && <p className="text-xs text-chalk/55">{status}</p>}
      </div>
    </section>
  );
};
