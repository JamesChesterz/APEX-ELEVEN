/**
 * แผงข้อมูลนักเตะที่ถูกเลือกบนสนาม
 *
 * ทุกค่าอ่านจาก PlayerAgent ตัวจริงในเอนจิน ไม่มีการปั้นข้อมูลนักเตะขึ้นใหม่
 * การเลือกเป็นเรื่องของ UI ล้วน — คอมโพเนนต์นี้ไม่เขียนอะไรกลับเข้าเอนจินเลย
 *
 * อัปเดตเป็นจังหวะเหมือน HUD (ไม่ใช่ทุกเฟรม) เพราะสถานะการเคลื่อนที่และการตัดสินใจ
 * เปลี่ยนเร็วมาก ถ้า re-render ตามทุกครั้งจะกลายเป็น React 60 FPS ซึ่งห้ามไว้ตั้งแต่ PHASE 1
 */
import { useEffect, useState } from 'react';
import type { MatchEngine } from '@/match-engine';
import { cn } from '@/utils/helpers';

/** อัปเดตข้อมูลกี่ครั้งต่อวินาที */
const REFRESH_HZ = 4;

/** ป้ายภาษาไทยของสถานะการเคลื่อนที่ */
const MOVEMENT_LABEL: Record<string, string> = {
  IDLE: 'ยืนรอ',
  POSITIONING: 'เข้าตำแหน่ง',
  MOVING_TO_BALL: 'ไล่บอล',
  SUPPORT: 'สนับสนุน',
  DEFENDING: 'ตั้งรับ',
  ATTACKING: 'เติมเกมรุก',
  ON_BALL: 'ครองบอล',
  RECEIVING: 'รอรับบอล',
  PRESSING: 'เข้ากดดัน',
};

/** ป้ายภาษาไทยของการตัดสินใจ */
const DECISION_LABEL: Record<string, string> = {
  HOLD: 'ถือบอล',
  PASS: 'ส่งบอล',
  MOVE: 'เคลื่อนที่',
  SUPPORT: 'หาพื้นที่',
  PRESS: 'ไล่บี้',
  RECEIVE: 'รับบอล',
  SHOOT: 'ยิง',
  TACKLE: 'เข้าสกัด',
};

/** ป้ายภาษาไทยของบทบาท */
const ROLE_LABEL: Record<string, string> = {
  gk: 'ผู้รักษาประตู',
  defence: 'กองหลัง',
  midfield: 'กองกลาง',
  attack: 'กองหน้า',
};

interface PlayerMatchPanelProps {
  engine: MatchEngine;
  playerId: string;
  onClose: () => void;
  className?: string;
}

export const PlayerMatchPanel = ({
  engine,
  playerId,
  onClose,
  className,
}: PlayerMatchPanelProps) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000 / REFRESH_HZ);
    return () => window.clearInterval(id);
  }, []);

  // อ่านสด ๆ ทุกครั้งที่ re-render — tick มีไว้กระตุ้นให้อ่านใหม่เท่านั้น
  void tick;
  const agent = engine.players.find((entry) => entry.id === playerId);

  if (!agent) {
    // โดนใบแดงไล่ออกไปแล้วก็ไม่มีตัวให้ดูอีก
    return (
      <div
        className={cn(
          'rounded-xl border border-white/10 bg-ink-700/60 p-3 text-center font-mono text-[11px] text-chalk/50',
          className,
        )}
      >
        นักเตะคนนี้ไม่อยู่ในสนามแล้ว
        <button
          type="button"
          onClick={onClose}
          className="mt-2 block w-full rounded-lg border border-white/10 py-1 text-chalk/70 hover:border-white/25"
        >
          ปิด
        </button>
      </div>
    );
  }

  const rows = [
    { label: 'ตำแหน่ง', value: agent.position },
    { label: 'บทบาท', value: ROLE_LABEL[agent.role] ?? agent.role },
    { label: 'ทีม', value: agent.side === 'home' ? 'ทีมเรา' : 'คู่แข่ง' },
    { label: 'กำลังทำ', value: MOVEMENT_LABEL[agent.state] ?? agent.state },
    { label: 'ตัดสินใจ', value: DECISION_LABEL[agent.decision] ?? agent.decision },
    { label: 'ความเร็วตอนนี้', value: `${agent.speed.toFixed(1)} m/s` },
    { label: 'ใบเหลือง', value: `${agent.yellowCards}` },
  ];

  const match = engine.statsFor(agent.id);

  return (
    <div className={cn('rounded-xl border border-white/10 bg-ink-700/60 p-3', className)}>
      <div className="flex items-start gap-2">
        <span className="font-display text-2xl leading-none text-neon">#{agent.shirtNumber}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-chalk">{agent.name}</p>
          <p className="font-mono text-[10px] text-chalk/45">OVR {agent.ovr}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดแผงนักเตะ"
          className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-chalk/60 hover:border-white/25"
        >
          ✕
        </button>
      </div>

      <dl className="mt-2 space-y-0.5 font-mono text-[10px]">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-2">
            <dt className="w-24 shrink-0 text-chalk/40">{row.label}</dt>
            <dd className="min-w-0 flex-1 truncate text-chalk/75">{row.value}</dd>
          </div>
        ))}
      </dl>

      {/* สถิติของเขาในนัดนี้ — แยกจากข้อมูลนักเตะถาวรเสมอ */}
      <p className="mt-2 font-mono text-[10px] text-chalk/45">
        ยิง {match.shots} · ประตู {match.goals} · ส่ง {match.completedPasses}/{match.passes} · สกัด{' '}
        {match.tackles}
      </p>
    </div>
  );
};
