/**
 * ADMIN → รางวัลล็อกอิน
 *
 * ตั้งรางวัลได้ทุกช่องของทั้งสองปฏิทิน (รายสัปดาห์ 7 ช่อง · รายเดือน 30 ช่อง)
 * ทุกช่องเลือกได้ทุกอย่างที่มีในเกมผ่าน RewardEditor ตัวเดียวกับที่หน้าของขวัญใช้
 *
 * บันทึกแล้วผู้เล่นเห็นทันทีผ่าน onSnapshot (config/loginBonus)
 */
import { useEffect, useState } from 'react';
import { RewardEditor } from '@/components/admin/RewardEditor';
import { useGameConfig } from '@/hooks/useGameConfig';
import { playSfx } from '@/services/sound';
import { MONTHLY_DAYS, WEEKLY_DAYS, type LoginBonusConfig } from '@/types/loginBonus';
import type { GameReward } from '@/types/reward';
import { cn } from '@/utils/helpers';

export const LoginBonusPanel = () => {
  const { loginBonus, saveLoginBonus } = useGameConfig();
  const [draft, setDraft] = useState<LoginBonusConfig>(loginBonus);
  const [tab, setTab] = useState<'weekly' | 'monthly'>('weekly');
  const [status, setStatus] = useState('');

  // ค่าจากเซิร์ฟเวอร์มาทีหลัง (onSnapshot) จึงต้องซิงก์ลงช่องแก้ไขเมื่อมันเปลี่ยน
  useEffect(() => setDraft(loginBonus), [loginBonus]);

  const rewards = tab === 'weekly' ? draft.weekly : draft.monthly;

  const editReward = (index: number, reward: GameReward) =>
    setDraft((prev) => {
      const list = [...(tab === 'weekly' ? prev.weekly : prev.monthly)];
      list[index] = reward;
      return tab === 'weekly' ? { ...prev, weekly: list } : { ...prev, monthly: list };
    });

  /** ก๊อปรางวัลช่องแรกไปทุกช่องที่เหลือ — ตั้ง 30 ช่องทีละช่องมันทรมาน */
  const fillFromFirst = () => {
    playSfx('click');
    setDraft((prev) => {
      const list = tab === 'weekly' ? prev.weekly : prev.monthly;
      const filled = list.map(() => ({ ...list[0] }));
      return tab === 'weekly' ? { ...prev, weekly: filled } : { ...prev, monthly: filled };
    });
  };

  const save = async () => {
    playSfx('click');
    setStatus('กำลังบันทึก…');
    const error = await saveLoginBonus(draft);
    setStatus(error ?? 'บันทึกแล้ว — ผู้เล่นเห็นรางวัลใหม่ทันที');
  };

  return (
    <section className="glass-panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-title">รางวัลล็อกอิน</p>
          <p className="mt-1 text-xs text-chalk/45">
            ผู้เล่นกดรับได้ปฏิทินละ 1 ช่องต่อวัน · รายสัปดาห์รีเซ็ตทุกวันจันทร์ ·
            รายเดือนรีเซ็ตวันที่ 1
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

      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-wide text-chalk/45">
          หัวข้อที่โชว์บนหน้า
        </span>
        <input
          value={draft.title}
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        {(
          [
            ['weekly', `รายสัปดาห์ (${WEEKLY_DAYS} ช่อง)`],
            ['monthly', `รายเดือน (${MONTHLY_DAYS} ช่อง)`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-xs font-bold uppercase transition-colors',
              tab === id ? 'bg-neon text-ink-900' : 'bg-white/5 text-chalk/60 hover:text-chalk',
            )}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          onClick={fillFromFirst}
          title="ก๊อปรางวัลของช่องที่ 1 ไปทุกช่องในปฏิทินนี้"
          className="ml-auto rounded-lg border border-white/15 px-3 py-1.5 text-xs text-chalk/60 hover:text-chalk"
        >
          เติมทุกช่องจากช่องแรก
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rewards.map((reward, index) => (
          <RewardEditor
            key={index}
            label={`วันที่ ${index + 1}`}
            value={reward}
            onChange={(next) => editReward(index, next)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900"
        >
          บันทึกรางวัล
        </button>
        {status && <p className="text-xs text-chalk/55">{status}</p>}
      </div>
    </section>
  );
};
