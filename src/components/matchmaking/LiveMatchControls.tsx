/**
 * แผงควบคุมและติดตามนัดที่กำลังแข่งอยู่
 *
 * ทุกตัวเลขในนี้อ่านมาจากเอนจินตัวเดียวกับที่ตัดสินผลการแข่ง ไม่มีตัวเลขที่ปั้นขึ้นเอง
 * และไม่มีการอ่านทุกเฟรม — ดึงภาพนิ่ง (snapshot) วินาทีละไม่กี่ครั้งก็พอสำหรับ HUD
 * ส่วนสนามที่ต้องลื่น 60 FPS วาดผ่าน canvas แยกต่างหาก
 */
import { useEffect, useState } from 'react';
import type { MatchEngine, MatchSimEvent, MatchSnapshot } from '@/match-engine';
import type { Tactics } from '@/match-engine/tactics';
import { SPEED_OPTIONS, type MatchSpeed } from '@/services/matchSession';
import { cn } from '@/utils/helpers';

/** ดึงภาพนิ่งกี่ครั้งต่อวินาที — พอให้นาฬิกาเดินดูลื่นโดยไม่ re-render ถี่เกินจำเป็น */
const HUD_HZ = 5;

/** จำนวนเหตุการณ์ล่าสุดที่โชว์ในฟีด */
const FEED_LENGTH = 8;

/** ตัวเลือกของแต่ละหมวดแทคติก พร้อมป้ายภาษาไทย */
const TACTIC_GROUPS: Array<{
  key: keyof Tactics;
  label: string;
  options: Array<{ value: string; label: string }>;
}> = [
  {
    key: 'mentality',
    label: 'แนวทางเล่น',
    options: [
      { value: 'DEFENSIVE', label: 'ตั้งรับ' },
      { value: 'BALANCED', label: 'สมดุล' },
      { value: 'ATTACKING', label: 'บุก' },
    ],
  },
  {
    key: 'tempo',
    label: 'จังหวะ',
    options: [
      { value: 'SLOW', label: 'ช้า' },
      { value: 'NORMAL', label: 'ปกติ' },
      { value: 'FAST', label: 'เร็ว' },
    ],
  },
  {
    key: 'width',
    label: 'ความกว้าง',
    options: [
      { value: 'NARROW', label: 'แคบ' },
      { value: 'NORMAL', label: 'ปกติ' },
      { value: 'WIDE', label: 'กว้าง' },
    ],
  },
  {
    key: 'pressing',
    label: 'การกดดัน',
    options: [
      { value: 'LOW', label: 'ต่ำ' },
      { value: 'NORMAL', label: 'ปกติ' },
      { value: 'HIGH', label: 'สูง' },
    ],
  },
  {
    key: 'defensiveLine',
    label: 'แนวรับ',
    options: [
      { value: 'DEEP', label: 'ลึก' },
      { value: 'NORMAL', label: 'ปกติ' },
      { value: 'HIGH', label: 'สูง' },
    ],
  },
];

/** ป้ายภาษาไทยของเหตุการณ์ในฟีด */
const EVENT_LABEL: Record<string, string> = {
  kickoff: 'เขี่ยบอล',
  goal: 'ประตู',
  shot: 'ยิง',
  save: 'เซฟ',
  tackle: 'เข้าสกัด',
  foul: 'ฟาวล์',
  yellow_card: 'ใบเหลือง',
  red_card: 'ใบแดง',
  interception: 'ตัดบอล',
  possession_change: 'เปลี่ยนการครองบอล',
  half_time: 'พักครึ่ง',
  fulltime: 'หมดเวลา',
  tactical_change: 'เปลี่ยนแทคติก',
};

/** เหตุการณ์ที่ควรขึ้นฟีด — ที่เหลือ (ส่งบอล/รับบอล) ถี่เกินกว่าจะอ่านทัน */
const FEED_TYPES = new Set([
  'kickoff',
  'goal',
  'shot',
  'save',
  'foul',
  'yellow_card',
  'red_card',
  'half_time',
  'fulltime',
  'tactical_change',
]);

const TONE: Record<string, string> = {
  goal: 'text-gold',
  red_card: 'text-[#F07070]',
  yellow_card: 'text-[#F5D63E]',
  save: 'text-[#7FD4F5]',
  tactical_change: 'text-neon',
};

interface LiveMatchControlsProps {
  engine: MatchEngine;
  speed: MatchSpeed;
  onSpeedChange: (speed: MatchSpeed) => void;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  tactics: Tactics;
  onTacticsChange: (tactics: Partial<Tactics>) => void;
  className?: string;
}

export const LiveMatchControls = ({
  engine,
  speed,
  onSpeedChange,
  paused,
  onPausedChange,
  tactics,
  onTacticsChange,
  className,
}: LiveMatchControlsProps) => {
  const [snapshot, setSnapshot] = useState<MatchSnapshot>(() => engine.snapshot());
  const [feed, setFeed] = useState<MatchSimEvent[]>([]);

  /*
   * อ่านสถานะจากเอนจินเป็นจังหวะ ไม่ใช่ทุกเฟรม
   * 5 ครั้งต่อวินาทีพอให้นาฬิกาและสถิติดูมีชีวิต แต่ React re-render แค่ 5 ครั้ง
   * ไม่ใช่ 60 ครั้ง ซึ่งเป็นข้อกำหนดตั้งแต่ PHASE 1 ที่ยังต้องรักษาไว้
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      setSnapshot(engine.snapshot());
      setFeed(
        engine.events
          .filter((event) => FEED_TYPES.has(event.type))
          .slice(-FEED_LENGTH)
          .reverse(),
      );
    }, 1000 / HUD_HZ);

    return () => window.clearInterval(id);
  }, [engine]);

  const possession = Math.round(snapshot.possession * 100);
  const { home, away } = snapshot.stats;

  const rows = [
    { label: 'ครองบอล', ours: `${possession}%`, theirs: `${100 - possession}%` },
    { label: 'ยิง', ours: `${home.shots}`, theirs: `${away.shots}` },
    { label: 'เข้ากรอบ', ours: `${home.shotsOnTarget}`, theirs: `${away.shotsOnTarget}` },
    {
      label: 'ส่งบอลแม่น',
      ours: `${home.passes > 0 ? Math.round((home.completedPasses / home.passes) * 100) : 0}%`,
      theirs: `${away.passes > 0 ? Math.round((away.completedPasses / away.passes) * 100) : 0}%`,
    },
    { label: 'เข้าสกัด', ours: `${home.tackles}`, theirs: `${away.tackles}` },
    { label: 'ฟาวล์', ours: `${home.fouls}`, theirs: `${away.fouls}` },
  ];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* สกอร์และนาฬิกา */}
      <div className="rounded-xl border border-white/10 bg-ink-700/60 p-3 text-center">
        <p className="font-display text-3xl leading-none text-chalk">
          {snapshot.score.home} – {snapshot.score.away}
        </p>
        <p className="mt-1 font-mono text-sm text-chalk/70">{snapshot.clockLabel}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-chalk/45">
          {snapshot.period.replace('_', ' ')} · {snapshot.onPitch.home}v{snapshot.onPitch.away}
        </p>
      </div>

      {/* ปุ่มหยุดและความเร็ว */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPausedChange(!paused)}
          className="rounded-lg border border-white/10 bg-ink-700/60 px-3 py-1.5 font-mono text-[11px] text-chalk hover:border-white/25"
        >
          {paused ? 'เล่นต่อ' : 'หยุด'}
        </button>

        <div className="flex flex-1 gap-1">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSpeedChange(option)}
              className={cn(
                'flex-1 rounded-lg border px-2 py-1.5 font-mono text-[11px]',
                option === speed
                  ? 'border-neon/60 bg-neon/15 text-neon'
                  : 'border-white/10 bg-ink-700/60 text-chalk/60 hover:border-white/25',
              )}
            >
              {option}x
            </button>
          ))}
        </div>
      </div>

      {/* สถิติสด */}
      <dl className="rounded-xl border border-white/10 bg-ink-700/40 p-3 font-mono text-[10px]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 py-0.5">
            <dd className="w-12 text-right text-neon">{row.ours}</dd>
            <dt className="min-w-0 flex-1 truncate text-center text-chalk/45">{row.label}</dt>
            <dd className="w-12 text-chalk/55">{row.theirs}</dd>
          </div>
        ))}
      </dl>

      {/* แทคติก — เปลี่ยนได้ระหว่างแข่ง มีผลตั้งแต่ tick ถัดไป */}
      <div className="rounded-xl border border-white/10 bg-ink-700/40 p-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-chalk/45">แทคติก</p>

        <div className="space-y-2">
          {TACTIC_GROUPS.map((group) => (
            <div key={group.key}>
              <p className="mb-1 font-mono text-[9px] text-chalk/35">{group.label}</p>
              <div className="flex gap-1">
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onTacticsChange({ [group.key]: option.value } as Partial<Tactics>)}
                    className={cn(
                      'flex-1 rounded-md border px-1 py-1 font-mono text-[10px]',
                      tactics[group.key] === option.value
                        ? 'border-neon/60 bg-neon/15 text-neon'
                        : 'border-white/10 bg-ink-800/60 text-chalk/55 hover:border-white/25',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ฟีดเหตุการณ์ — มาจาก event store เดียวกับผลการแข่ง ไม่ได้สร้างขึ้นที่นี่ */}
      {feed.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-ink-700/40 p-3">
          {feed.map((event, index) => (
            <li
              key={`${event.type}-${event.minute}-${index}`}
              className="flex items-center gap-2 font-mono text-[10px]"
            >
              <span className="w-7 shrink-0 text-chalk/40">{event.minute}'</span>
              <span className={cn('shrink-0', TONE[event.type] ?? 'text-chalk/70')}>
                {EVENT_LABEL[event.type] ?? event.type}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  event.side === 'home' ? 'text-neon/70' : 'text-chalk/45',
                )}
              >
                {event.playerId
                  ? (engine.players.find((agent) => agent.id === event.playerId)?.name ?? '')
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
