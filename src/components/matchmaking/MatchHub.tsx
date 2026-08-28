/**
 * แผงกลางล่างของหน้า MATCHMAKING — ศูนย์กลางของทั้งหน้าจอ
 *
 * ซ้าย/ขวา = ตราทีม ชื่อ ค่าพลัง และแผนการเล่นของทั้งสองฝั่ง
 * กลาง     = ปุ่มวงกลมใบใหญ่ที่เปลี่ยนหน้าที่ไปตามสถานะของคิว
 *            (หาคู่แข่ง → ยกเลิก → กำลังแข่ง → หาคู่ใหม่)
 *
 * เจอคู่แล้วยกเลิกไม่ได้ตั้งใจให้เป็นแบบนั้น กันคนกดหาคู่รัว ๆ
 * แล้วทิ้งจนกว่าจะเจอทีมที่อ่อนกว่า (ดูหมายเหตุ VS_MS ใน useMatchmaking)
 */
import { clockText } from '@/components/matchmaking/squadLabels';
import { TeamCrest } from '@/components/matchmaking/TeamCrest';
import type { MatchOutcome, MatchStatus } from '@/types/match';
import { cn } from '@/utils/helpers';

interface MatchHubProps {
  teamName: string;
  teamOvr: number;
  teamFormation: string;
  opponentName: string | null;
  opponentOvr: number | null;
  opponentFormation: string | null;
  status: MatchStatus;
  /** วินาทีที่อยู่ในคิวมาแล้ว */
  elapsed: number;
  /** นาทีในเกม (ใช้ตอน status = playing) */
  minute: number;
  outcome?: MatchOutcome;
  /** ลงแข่งไม่ได้ตอนนี้ (จัดตัวไม่ครบ หรือมีคนติดโทษแบนอยู่ในตัวจริง) */
  blockedReason: string | null;
  /** เหตุผลที่หาคู่ไม่เจอ (มีค่าเฉพาะ status = empty) */
  emptyReason: string | null;
  onSearch: () => void;
  onCancel: () => void;
}

/** สีวงแหวนของปุ่มกลางตามสถานะ — เก็บไว้นอกคอมโพเนนต์ จะได้ไม่สร้างใหม่ทุก render */
const RING_TONE = {
  idle: 'border-neon/70 text-neon hover:bg-neon/10',
  searching: 'border-neon/70 text-neon animate-pulse hover:bg-neon/10',
  live: 'border-kit/60 text-kit',
  blocked: 'border-white/15 text-chalk/35',
} as const;

/** แว่นขยายบนปุ่ม "หาคู่แข่ง" — วาดเป็น SVG เพื่อให้คมทุกเครื่อง ไม่พึ่งฟอนต์สัญลักษณ์ */
const SearchGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden>
    <circle cx="10.5" cy="10.5" r="6.5" strokeWidth="2" />
    <path d="M15.5 15.5 21 21" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const OUTCOME_LABEL: Record<MatchOutcome, { label: string; tone: string }> = {
  win: { label: 'ชนะ!', tone: 'text-neon' },
  draw: { label: 'เสมอ', tone: 'text-kit' },
  loss: { label: 'แพ้', tone: 'text-[#F07070]' },
};

/** ทีมหนึ่งฝั่งของแผง (ตรา + ชื่อ + ค่าพลัง + แผนการเล่น) */
const HubTeam = ({
  name,
  ovr,
  formation,
  align,
}: {
  name: string;
  ovr: number | null;
  formation: string | null;
  align: 'left' | 'right';
}) => (
  <div className={cn('min-w-0 flex-1', align === 'right' && 'text-right')}>
    <div
      className={cn('flex items-center gap-3', align === 'right' && 'flex-row-reverse')}
    >
      <TeamCrest name={name} size="lg" />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-tight text-chalk">{name}</p>
        <p className="font-mono text-[11px] leading-tight tabular-nums text-chalk/45">
          OVR <span className="text-[13px] font-bold text-chalk/80">{ovr ?? '—'}</span>
        </p>
      </div>
    </div>

    <p className="mt-3 truncate text-[11px] text-chalk/40">
      แผนการเล่น <span className="font-mono text-chalk/70">{formation ?? '—'}</span>
    </p>
  </div>
);

export const MatchHub = ({
  teamName,
  teamOvr,
  teamFormation,
  opponentName,
  opponentOvr,
  opponentFormation,
  status,
  elapsed,
  minute,
  outcome,
  blockedReason,
  emptyReason,
  onSearch,
  onCancel,
}: MatchHubProps) => {
  const blocked = Boolean(blockedReason);

  /** ปุ่มกลางเปลี่ยนหน้าที่ตามสถานะ — รวมไว้ที่เดียวเพื่อไม่ให้ตรรกะกระจาย */
  const button = (() => {
    switch (status) {
      case 'searching':
        return {
          title: 'ยกเลิก',
          sub: clockText(Math.floor(elapsed / 60), elapsed % 60),
          onClick: onCancel,
          tone: 'searching' as const,
        };
      case 'found':
        return { title: 'เจอคู่แล้ว', sub: 'กำลังเริ่ม…', onClick: null, tone: 'live' as const };
      case 'playing':
        return { title: 'กำลังแข่ง', sub: `${minute}'`, onClick: null, tone: 'live' as const };
      case 'finished':
        return { title: 'หาคู่ใหม่', sub: 'อีกนัด', onClick: onSearch, tone: 'idle' as const };
      case 'empty':
        return { title: 'ลองใหม่', sub: 'ค้นหาอีกครั้ง', onClick: onSearch, tone: 'idle' as const };
      default:
        return blocked
          ? { title: 'ลงแข่งไม่ได้', sub: 'จัดตัวก่อน', onClick: null, tone: 'blocked' as const }
          : { title: 'หาคู่แข่ง', sub: null, onClick: onSearch, tone: 'idle' as const };
    }
  })();

  /** บรรทัดสถานะใต้ปุ่ม — บอกให้รู้เสมอว่าตอนนี้ระบบกำลังทำอะไรอยู่ */
  const statusLine = (() => {
    if (blockedReason && status === 'idle') return blockedReason;
    if (status === 'searching') return 'กำลังค้นหาคู่แข่งที่เหมาะสม...';
    if (status === 'empty') return emptyReason ?? 'ยังหาคู่ไม่ได้';
    if (status === 'found') return 'เจอคู่แข่งแล้ว — เตรียมเขี่ยบอล';
    if (status === 'playing') return 'กำลังถ่ายทอดสด';
    if (status === 'finished' && outcome) return `จบเกม — ${OUTCOME_LABEL[outcome].label}`;
    return 'กดปุ่มเพื่อเข้าคิวหาคู่ต่อสู้';
  })();

  return (
    <section className="flex items-center gap-4 overflow-hidden rounded-xl border border-white/10 bg-[#0A0E14]/90 px-5 py-3.5 shadow-glass backdrop-blur-md">
      <HubTeam name={teamName} ovr={teamOvr} formation={teamFormation} align="left" />

      {/* ปุ่มกลาง */}
      <div className="flex shrink-0 flex-col items-center">
        <button
          type="button"
          onClick={button.onClick ?? undefined}
          disabled={!button.onClick}
          className={cn(
            'flex h-[120px] w-[120px] flex-col items-center justify-center gap-1 rounded-full border-2 bg-[#070A0F]/80 transition-colors',
            RING_TONE[button.tone],
            !button.onClick && 'cursor-default',
          )}
        >
          <span className="text-[15px] font-bold leading-none">{button.title}</span>
          {button.sub ? (
            <span className="font-mono text-[11px] leading-none tabular-nums opacity-70">
              {button.sub}
            </span>
          ) : (
            <span className="opacity-80">
              <SearchGlyph />
            </span>
          )}
        </button>

        <p className="mt-2 max-w-[240px] text-center text-[11px] leading-snug text-chalk/45">
          {statusLine}
        </p>
      </div>

      <HubTeam
        name={opponentName ?? 'รอคู่แข่ง'}
        ovr={opponentOvr}
        formation={opponentFormation}
        align="right"
      />
    </section>
  );
};
