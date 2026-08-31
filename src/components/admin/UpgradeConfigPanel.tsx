/**
 * ADMIN → ตารางตีบวก + พรีวิว (PHASE 13.5)
 *
 * ตารางที่แก้ตรงนี้คือ "ตารางเดียวกับที่เกมใช้จริง" ไม่ใช่สำเนา:
 * บันทึกแล้วค่าถูกส่งเข้า setUpgradeSteps() ทั้งฝั่งหน้าเว็บ (useGameConfig)
 * และฝั่ง Cloud Function (อ่าน config/upgradeConfig ก่อนตัดสินทุกครั้ง)
 *
 * พรีวิวข้างล่างเรียก Attribute Engine ตัวจริง ไม่ได้คำนวณเองซ้ำ
 * ตัวเลขที่เห็นตรงนี้จึงเป็นตัวเลขเดียวกับที่ผู้เล่นจะเห็นเป๊ะ ๆ
 */
import { useEffect, useMemo, useState } from 'react';
import { PLAYERS } from '@/data/players';
import { UPGRADE_STEPS, validateUpgradeSteps, type UpgradeStep } from '@/data/upgradeConfig';
import { useGameConfig } from '@/hooks/useGameConfig';
import {
  getEffectivePlayerOvr,
  getEffectivePlayerStats,
  previewNextUpgrade,
} from '@/services/playerAttributes';
import { playSfx } from '@/services/sound';
import type { CardInstance } from '@/types/card';
import type { PlayerStats } from '@/types/player';
import { cn, formatNumber } from '@/utils/helpers';

const STAT_ROWS: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: 'pace', label: 'PAC' },
  { key: 'shooting', label: 'SHO' },
  { key: 'passing', label: 'PAS' },
  { key: 'dribbling', label: 'DRI' },
  { key: 'defending', label: 'DEF' },
  { key: 'physical', label: 'PHY' },
];

/** การ์ดสมมติสำหรับพรีวิว — ไม่ได้แตะการ์ดจริงของใคร */
const previewCard = (playerId: string, upgrade: number): CardInstance => ({
  id: 'preview',
  playerId,
  acquiredAt: new Date(0).toISOString(),
  level: upgrade + 1,
  inSquad: false,
});

export const UpgradeConfigPanel = () => {
  const { upgradeSteps, upgradeStepsFromServer, saveUpgradeSteps } = useGameConfig();
  const [draft, setDraft] = useState<UpgradeStep[]>(upgradeSteps);
  const [status, setStatus] = useState('');
  const [playerId, setPlayerId] = useState(PLAYERS[0]?.id ?? '');
  const [previewUpgrade, setPreviewUpgrade] = useState(0);

  // ตารางจากเซิร์ฟเวอร์มาทีหลัง (onSnapshot) จึงต้องซิงก์ลงช่องแก้ไขเมื่อมันเปลี่ยน
  useEffect(() => setDraft(upgradeSteps), [upgradeSteps]);

  const problems = useMemo(() => validateUpgradeSteps(draft), [draft]);

  const edit = (index: number, patch: Partial<UpgradeStep>) =>
    setDraft((prev) => prev.map((step, at) => (at === index ? { ...step, ...patch } : step)));

  const save = async () => {
    playSfx('click');
    setStatus('กำลังบันทึก…');
    const error = await saveUpgradeSteps(draft);
    setStatus(error ?? 'บันทึกแล้ว — ทั้งหน้าเว็บและเซิร์ฟเวอร์ใช้ตารางนี้ทันที');
  };

  /* ── พรีวิว: เรียก Attribute Engine ตัวจริง ── */
  const card = previewCard(playerId, previewUpgrade);
  const currentStats = getEffectivePlayerStats(card);
  const preview = previewNextUpgrade(card);
  const step = draft.find((entry) => entry.from === previewUpgrade);

  return (
    <div className="space-y-4">
      <section className="glass-panel space-y-4 p-5">
        <div>
          <p className="panel-title">ตารางตีบวก +0 → +8</p>
          <p className="mt-1 text-xs text-chalk/45">
            ตารางเดียวกับที่เกมและเซิร์ฟเวอร์ใช้จริง ·{' '}
            {upgradeStepsFromServer ? 'ตอนนี้ใช้ตารางจากเซิร์ฟเวอร์' : 'ตอนนี้ใช้ค่าเริ่มต้นในโค้ด'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="text-chalk/45">
              <tr>
                <th className="py-1.5">ขั้น</th>
                <th>โอกาสสำเร็จ (%)</th>
                <th>เหรียญ</th>
                <th>แต้มตีบวก</th>
                <th>ค่าพลังที่ได้</th>
              </tr>
            </thead>
            <tbody>
              {draft.map((entry, index) => (
                <tr key={entry.from} className="border-t border-white/5">
                  <td className="py-1.5 text-neon">
                    +{entry.from} → +{entry.to}
                  </td>
                  <td>
                    <input
                      type="number"
                      value={Math.round(entry.successRate * 100)}
                      onChange={(event) =>
                        edit(index, { successRate: (Number(event.target.value) || 0) / 100 })
                      }
                      className="w-16 rounded bg-white/5 px-2 py-1 outline-none focus:bg-white/10"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={entry.coinCost}
                      onChange={(event) => edit(index, { coinCost: Number(event.target.value) || 0 })}
                      className="w-24 rounded bg-white/5 px-2 py-1 outline-none focus:bg-white/10"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={entry.materialCost}
                      onChange={(event) =>
                        edit(index, { materialCost: Number(event.target.value) || 0 })
                      }
                      className="w-24 rounded bg-white/5 px-2 py-1 outline-none focus:bg-white/10"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={entry.statBonus}
                      onChange={(event) =>
                        edit(index, { statBonus: Number(event.target.value) || 0 })
                      }
                      className="w-16 rounded bg-white/5 px-2 py-1 outline-none focus:bg-white/10"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {problems.length > 0 && (
          <ul className="space-y-0.5 text-[11px] text-rose-300">
            {problems.map((problem) => (
              <li key={problem}>· {problem}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={problems.length > 0}
            className="rounded-lg bg-neon px-4 py-2 text-xs font-bold uppercase text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            บันทึกตาราง
          </button>
          <button
            type="button"
            onClick={() => setDraft(UPGRADE_STEPS)}
            className="rounded-lg bg-white/5 px-4 py-2 text-xs uppercase text-chalk/60 hover:bg-white/10"
          >
            คืนค่าเริ่มต้น
          </button>
        </div>

        {status && <p className="text-xs text-chalk/55">{status}</p>}
      </section>

      {/* ── พรีวิว ── */}
      <section className="glass-panel space-y-3 p-5">
        <div>
          <p className="panel-title">พรีวิวการตีบวก</p>
          <p className="mt-1 text-xs text-chalk/45">
            ตัวเลขทั้งหมดเรียก Attribute Engine ตัวจริง ไม่ได้คำนวณซ้ำในหน้านี้
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={playerId}
            onChange={(event) => setPlayerId(event.target.value)}
            className="rounded-lg bg-white/5 px-3 py-2 text-xs outline-none"
          >
            {PLAYERS.slice(0, 200).map((player) => (
              <option key={player.id} value={player.id} className="bg-ink-900">
                {player.id} · {player.name} ({player.position} {player.ovr})
              </option>
            ))}
          </select>

          <select
            value={previewUpgrade}
            onChange={(event) => setPreviewUpgrade(Number(event.target.value))}
            className="rounded-lg bg-white/5 px-3 py-2 text-xs outline-none"
          >
            {draft.map((entry) => (
              <option key={entry.from} value={entry.from} className="bg-ink-900">
                จาก +{entry.from}
              </option>
            ))}
          </select>
        </div>

        {currentStats && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between text-chalk/45">
                <span>OVR</span>
                <span>
                  {getEffectivePlayerOvr(card)}
                  <span className="text-chalk/30"> → </span>
                  <span className="text-neon">{preview?.ovr ?? '—'}</span>
                </span>
              </div>
              {STAT_ROWS.map(({ key, label }) => {
                const now = currentStats[key];
                const next = preview?.stats[key] ?? now;
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-chalk/50">{label}</span>
                    <span>
                      {now}
                      <span className="text-chalk/30"> → </span>
                      <span className={cn(next > now ? 'text-neon' : 'text-chalk/40')}>{next}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-chalk/50">SUCCESS RATE</span>
                <span className="text-neon">
                  {step ? `${Math.round(step.successRate * 100)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-chalk/50">COINS</span>
                <span>{formatNumber(step?.coinCost ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-chalk/50">MATERIAL</span>
                <span>{formatNumber(step?.materialCost ?? 0)}</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
