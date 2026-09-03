/**
 * ตัวแก้ "รางวัลหนึ่งชิ้น" ของหน้าแอดมิน
 *
 * เลือกได้ทุกอย่างที่มีในเกม: เหรียญ · แต้มแลกนักเตะ · แต้มตีบวก · ตั๋วพาส ·
 * ไอเทม (ทุกตัวในทะเบียน) · การ์ดนักเตะ (ทุกใบใน roster พร้อมตั้งค่าบวกได้)
 *
 * ⚠️ ตัวเลือกทั้งหมดอ่านจาก services/rewards.ts และ data/players.ts โดยตรง
 * เพิ่มไอเทมหรือนักเตะใหม่ในเกม แล้วหน้านี้เห็นเองทันที ไม่ต้องมาแก้ที่นี่
 */
import { useMemo, useState } from 'react';
import { RewardChip } from '@/components/rewards/RewardChip';
import { PLAYERS } from '@/data/players';
import { ITEM_REGISTRY, REWARD_KINDS, isRewardValid, normalizeReward } from '@/services/rewards';
import type { GameReward, RewardKind } from '@/types/reward';
import { cn, RARITY_STYLE } from '@/utils/helpers';

interface RewardEditorProps {
  value: GameReward;
  onChange: (reward: GameReward) => void;
  /** ป้ายกำกับด้านบน เช่น "วันที่ 3" */
  label?: string;
  className?: string;
}

export const RewardEditor = ({ value, onChange, label, className }: RewardEditorProps) => {
  const reward = normalizeReward(value);
  const [search, setSearch] = useState('');

  /** รายชื่อนักเตะสำหรับ dropdown — เรียงแรงสุดขึ้นก่อน แล้วกรองด้วยคำค้น */
  const players = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return [...PLAYERS]
      .filter((player) => !keyword || player.name.toLowerCase().includes(keyword))
      .sort((left, right) => right.ovr - left.ovr)
      .slice(0, 300);
  }, [search]);

  const patch = (next: Partial<GameReward>) => onChange(normalizeReward({ ...reward, ...next }));

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        isRewardValid(reward) ? 'border-white/10 bg-black/25' : 'border-rose-400/40 bg-rose-500/5',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <RewardChip reward={reward} size={42} showLabel={false} />

        <div className="min-w-0 flex-1 space-y-2">
          {label && <p className="font-mono text-[10px] uppercase text-chalk/40">{label}</p>}

          <select
            value={reward.kind}
            onChange={(event) => patch({ kind: event.target.value as RewardKind })}
            className="w-full rounded-lg bg-white/5 px-2.5 py-1.5 text-xs outline-none focus:bg-white/10"
          >
            {REWARD_KINDS.map((entry) => (
              <option key={entry.kind} value={entry.kind}>
                {entry.label}
              </option>
            ))}
          </select>

          {/* ไอเทม: เลือกตัวไหน + จำนวน */}
          {reward.kind === 'item' && (
            <select
              value={reward.itemId}
              onChange={(event) => patch({ itemId: event.target.value })}
              className="w-full rounded-lg bg-white/5 px-2.5 py-1.5 text-xs outline-none focus:bg-white/10"
            >
              {ITEM_REGISTRY.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}

          {/* การ์ด: ค้นหา + เลือกนักเตะ + ค่าบวกที่แจกมาพร้อมกัน */}
          {reward.kind === 'card' ? (
            <div className="space-y-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาชื่อนักเตะ"
                className="w-full rounded-lg bg-white/5 px-2.5 py-1.5 text-xs outline-none placeholder:text-chalk/30 focus:bg-white/10"
              />
              <select
                value={reward.playerId}
                onChange={(event) => patch({ playerId: event.target.value })}
                className="w-full rounded-lg bg-white/5 px-2.5 py-1.5 text-xs outline-none focus:bg-white/10"
              >
                <option value="">— เลือกนักเตะ —</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} · {player.position} · OVR {player.ovr} ·{' '}
                    {RARITY_STYLE[player.rarity].label}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase text-chalk/40">ค่าบวก</span>
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={reward.upgrade ?? 0}
                  onChange={(event) =>
                    patch({ upgrade: Math.min(8, Math.max(0, Number(event.target.value) || 0)) })
                  }
                  className="w-20 rounded-lg bg-white/5 px-2.5 py-1.5 font-mono text-xs outline-none focus:bg-white/10"
                />
              </label>
            </div>
          ) : (
            <label className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase text-chalk/40">จำนวน</span>
              <input
                type="number"
                min={1}
                value={reward.amount ?? 1}
                onChange={(event) => patch({ amount: Math.max(1, Number(event.target.value) || 1) })}
                className="w-full rounded-lg bg-white/5 px-2.5 py-1.5 font-mono text-xs outline-none focus:bg-white/10"
              />
            </label>
          )}

          {!isRewardValid(reward) && (
            <p className="text-[10px] text-rose-300">ยังตั้งค่าไม่ครบ — ช่องนี้จะแจกไม่ได้</p>
          )}
        </div>
      </div>
    </div>
  );
};
