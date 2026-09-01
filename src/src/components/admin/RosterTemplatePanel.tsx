/**
 * ADMIN → การ์ดต้นแบบ (Roster / Card Template) — PHASE 13.5
 *
 * roster.ts เป็น "แม่แบบของการ์ด" ไม่ใช่ฐานข้อมูลของผู้เล่นแต่ละคน
 * หน้านี้จึงเป็นหน้าอ่านอย่างเดียว + ตัวตรวจความสมบูรณ์ก่อนย้ายข้อมูล
 *
 * ⚠️ PHASE 12 ห้าม migrate roster เข้า Firestore อัตโนมัติ
 * ปุ่มที่แตะข้อมูลจริงจึงไม่มีในหน้านี้โดยตั้งใจ — ผลตรวจมีไว้ให้ตัดสินใจเอง
 * ส่วนการแก้แม่แบบยังทำที่ src/data/roster.ts เหมือนเดิม (แก้แล้ว deploy)
 */
import { useMemo, useState } from 'react';
import { PLAYERS } from '@/data/players';
import { ROSTER } from '@/data/roster';
import { auditRoster } from '@/services/cardInstance';
import { cn } from '@/utils/helpers';

export const RosterTemplatePanel = () => {
  const [search, setSearch] = useState('');
  const audit = useMemo(() => auditRoster(), []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ROSTER.map((entry) => {
      const id = entry.file.replace(/\.[^.]+$/, '');
      return { entry, id, player: PLAYERS.find((item) => item.id === id) };
    })
      .filter(
        ({ id, player }) =>
          !term || id.includes(term) || (player?.name.toLowerCase().includes(term) ?? false),
      )
      .slice(0, 80);
  }, [search]);

  const problems: Array<[string, string[]]> = [
    ['id ซ้ำ', audit.duplicateIds],
    ['หานักเตะปลายทางไม่เจอ', audit.missingPlayerIds],
    ['ค่าพลังไม่ครบ', audit.missingStats],
    ['ไม่มีรูป', audit.missingImages],
    ['OVR เพี้ยน', audit.invalidOvr],
  ];

  return (
    <section className="glass-panel space-y-4 p-5">
      <div>
        <p className="panel-title">การ์ดต้นแบบ (Roster)</p>
        <p className="mt-1 text-xs text-chalk/45">
          แม่แบบของการ์ดทั้งเกม · แก้ที่ src/data/roster.ts แล้ว deploy
          ไม่ใช่ฐานข้อมูลการ์ดของผู้เล่นแต่ละคน
        </p>
      </div>

      {/* ── ผลตรวจก่อนย้ายข้อมูล ── */}
      <div className="rounded-lg border border-white/10 p-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span
            className={cn(
              'rounded px-2 py-0.5 font-bold',
              audit.ok ? 'bg-neon/20 text-neon' : 'bg-rose-500/20 text-rose-300',
            )}
          >
            {audit.ok ? 'ผ่าน' : 'พบปัญหา'}
          </span>
          <span className="font-mono text-chalk/55">
            {audit.totalRosterEntries} บรรทัด · {audit.uniquePlayerIds} id ไม่ซ้ำ ·{' '}
            {PLAYERS.length} นักเตะใน pool
          </span>
        </div>

        <ul className="mt-2 space-y-0.5 font-mono text-[11px]">
          {problems.map(([label, list]) => (
            <li key={label} className={list.length > 0 ? 'text-rose-300' : 'text-chalk/35'}>
              {label}: {list.length === 0 ? '—' : list.slice(0, 12).join(', ')}
              {list.length > 12 && ` … อีก ${list.length - 12}`}
            </li>
          ))}
        </ul>

        <p className="mt-2 text-[11px] text-chalk/40">
          ระบบไม่ย้ายข้อมูลให้อัตโนมัติโดยตั้งใจ — ผลตรวจนี้มีไว้ให้ตัดสินใจก่อนลงมือเอง
        </p>
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="ค้นหา id หรือชื่อ"
        className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
      />

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-left font-mono text-[11px]">
          <thead className="sticky top-0 bg-ink-900/90 text-chalk/45">
            <tr>
              <th className="py-1.5">ID</th>
              <th>ชื่อ</th>
              <th>ตำแหน่ง</th>
              <th>ระดับ</th>
              <th className="text-right">OVR</th>
              <th>รูป</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, id, player }) => (
              <tr key={id} className="border-t border-white/5">
                <td className="py-1.5">{id}</td>
                <td className="max-w-[10rem] truncate">{player?.name ?? '—'}</td>
                <td>{player?.position ?? '—'}</td>
                <td>{entry.rarity}</td>
                <td className="text-right">{player?.ovr ?? '—'}</td>
                <td className="max-w-[8rem] truncate text-chalk/40">{entry.file}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
