/**
 * แผงจับคู่แข่งขัน — ใช้ทั้งบนแดชบอร์ดล่างของหน้า MY TEAM และในหน้า MATCH
 * รวมทุกสถานะไว้ในแผงเดียว: พร้อมแข่ง → กำลังหาคู่ → เจอคู่ (VS) → กำลังแข่ง → ผลการแข่ง
 * compact = เวอร์ชันย่อสำหรับช่องแดชบอร์ด (การ์ดเตี้ยลง สูงพอ ๆ กับวิดเจ็ตข้าง ๆ)
 *
 * ── เรื่องความสูง (สำคัญ) ──────────────────────────────────
 * เนื้อหาตรงกลางของแผงนี้ "งอก" ได้เรื่อย ๆ เวลามีประตูเกิดขึ้น
 * (ไทม์ไลน์ประตูเพิ่มทีละบรรทัด) ถ้าปล่อยให้แผงสูงตามเนื้อหา
 * แถวแดชบอร์ดจะดันสูงขึ้นทุกครั้งที่ยิงประตู แล้วไปเบียดสนามด้านบนจนเลย์เอาต์ยับ
 *
 * จึงแบ่งแผงเป็น 3 ส่วนตายตัว:
 *   หัว (ชื่อแผง + แต้ม)  → ไม่ยืด
 *   ตัว (สถานะ/VS/สด/ผล)  → ยืดได้ แต่ล็อกความสูงไว้แล้วเลื่อนดูข้างในแทน
 *   ท้าย (ปุ่ม)            → ไม่ยืด อยู่ล่างสุดเสมอ
 * ผลคือความสูงของแผงคงที่ ไม่ว่าจะยิงกี่ลูกก็ตาม
 */
import { LiveMatchPanel } from '@/components/matchmaking/LiveMatchPanel';
import { WinChanceBar } from '@/components/matchmaking/WinChanceBar';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useTeam } from '@/hooks/useTeam';
import type { MatchOutcome } from '@/types/match';
import { cn, formatNumber } from '@/utils/helpers';

/** ข้อความและสีประจำผลการแข่ง */
const OUTCOME_STYLE: Record<MatchOutcome, { label: string; tone: string }> = {
  win: { label: 'ชนะ!', tone: 'text-neon' },
  draw: { label: 'เสมอ', tone: 'text-kit' },
  loss: { label: 'แพ้', tone: 'text-[#F07070]' },
};

/** ฝั่งหนึ่งของหน้าจอ VS */
const Side = ({
  name,
  ovr,
  muted = false,
  compact = false,
}: {
  name: string;
  ovr: number | null;
  muted?: boolean;
  compact?: boolean;
}) => (
  <div className="min-w-0 flex-1 text-center">
    <span
      className={cn(
        'mx-auto flex items-center justify-center rounded-full font-display ring-1',
        compact ? 'h-11 w-11 text-base' : 'h-14 w-14 text-lg',
        muted
          ? 'bg-ink-600 text-chalk/40 ring-white/10'
          : 'bg-gradient-to-b from-ink-500 to-ink-700 ring-neon/40',
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
    <p className={cn('truncate text-xs font-semibold', compact ? 'mt-1.5' : 'mt-2')}>{name}</p>
    <p className="font-mono text-[11px] text-chalk/50">{ovr === null ? 'OVR —' : `OVR ${ovr}`}</p>
  </div>
);

/** ปุ่มหลักของแผง สีนีออนเต็มใบ */
const PrimaryButton = ({
  label,
  onClick,
  disabled,
  compact = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'w-full rounded-lg bg-neon font-bold uppercase tracking-wider text-ink-900 transition-colors hover:bg-neon-dim disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-chalk/40',
      compact ? 'py-2 text-xs' : 'py-2.5 text-sm',
    )}
  >
    {label}
  </button>
);

interface MatchmakingPanelProps {
  /** เวอร์ชันย่อสำหรับวางในแถวแดชบอร์ดล่าง */
  compact?: boolean;
}

export const MatchmakingPanel = ({ compact = false }: MatchmakingPanelProps) => {
  const { team, rating } = useTeam();
  const { state, record, live, elapsed, squadIncomplete, search, kickoff, cancel, emptyReason } =
    useMatchmaking();
  const { status, opponent, odds, result } = state;

  /**
   * ระหว่างถ่ายทอดสดในโหมดย่อ ให้ซ่อนวง VS ทิ้ง
   * เพราะแผงถ่ายทอดสดโชว์ชื่อทั้งสองทีมกับสกอร์อยู่แล้ว
   * ถ้าโชว์ทั้งคู่จะเบียดกันจนอ่านไม่ออกในช่องแคบ ๆ
   */
  const showVersus = !(compact && status === 'playing');

  return (
    <section
      className={cn(
        'glass-panel flex flex-col p-4',
        // ล็อกเพดานความสูงในโหมดย่อ: เนื้อหาข้างในงอกได้ แต่ตัวแผงไม่ดันแถวให้สูงขึ้น
        compact ? 'max-h-[340px] overflow-hidden' : 'xl:max-h-[calc(100vh-8rem)]',
      )}
    >
      {/* ── หัวแผง (ความสูงคงที่) ── */}
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <p className="panel-title">Matchmaking</p>
        <p className="font-mono text-[11px] text-gold">⭐ {formatNumber(record.points)}</p>
      </div>

      {/* ── ตัวแผง: ส่วนเดียวที่เลื่อนได้ เนื้อหาที่งอกจะถูกกักไว้ในนี้ ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-0.5">
        {/* แถบสถานะ */}
        <p className="mt-3 flex shrink-0 items-center gap-2 text-sm">
          {(status === 'searching' || status === 'playing') && (
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-neon" aria-hidden />
          )}
          {status === 'idle' && (squadIncomplete ? 'จัดตัวไม่ครบ 11 คน' : 'พร้อมลงแข่ง')}
          {status === 'searching' && 'กำลังค้นหาคู่แข่ง...'}
          {status === 'empty' && 'ยังหาคู่แข่งไม่ได้'}
          {status === 'found' && 'เจอคู่แข่งแล้ว!'}
          {status === 'playing' && 'กำลังแข่งขัน...'}
          {status === 'finished' && 'จบการแข่งขัน'}
        </p>

        {status === 'searching' && (
          <p className="mt-1 shrink-0 font-mono text-xs text-chalk/45">
            อยู่ในคิว {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
            {String(elapsed % 60).padStart(2, '0')} · กำลังหาทีมของผู้เล่นจริง
          </p>
        )}
        {status === 'empty' && emptyReason && (
          <p className="mt-1 shrink-0 text-xs leading-relaxed text-[#F0A070]">{emptyReason}</p>
        )}
        {status === 'idle' && squadIncomplete && (
          <p className="mt-1 shrink-0 text-xs text-[#F0A070]">
            เหลืออีก {rating.emptySlots} ช่องที่ยังว่าง — จัดตัวให้ครบก่อนจึงลงแข่งได้
          </p>
        )}

        {/* หน้าจอ VS */}
        {showVersus && (
          <div className={cn('flex shrink-0 items-center gap-2', compact ? 'mt-3' : 'mt-4')}>
            <Side name={team.name} ovr={rating.matchOvr} compact={compact} />
            <span className="font-display text-xl text-chalk/30">VS</span>
            <Side
              name={opponent?.name ?? 'รอคู่แข่ง'}
              ovr={opponent?.ovr ?? null}
              muted={!opponent}
              compact={compact}
            />
          </div>
        )}

        {/* ถ่ายทอดสดระหว่างแข่ง */}
        {status === 'playing' && live && (
          <LiveMatchPanel
            live={live}
            teamName={team.name}
            opponentName={opponent?.name ?? 'คู่แข่ง'}
            className={cn('shrink-0', compact ? 'mt-3' : 'mt-4')}
          />
        )}

        {/* โอกาสชนะจากผลต่าง OVR */}
        {odds && status !== 'finished' && status !== 'playing' && (
          <WinChanceBar
            odds={odds}
            compact={compact}
            className={cn('shrink-0', compact ? 'mt-3' : 'mt-4')}
          />
        )}

        {/* ผลการแข่ง */}
        {status === 'finished' && result && (
          <div
            className={cn(
              'shrink-0 rounded-xl border border-white/10 bg-ink-700/60 p-3 text-center',
              compact ? 'mt-3' : 'mt-4',
            )}
          >
            <p
              className={cn(
                'font-display leading-none',
                compact ? 'text-2xl' : 'text-3xl',
                OUTCOME_STYLE[result.outcome].tone,
              )}
            >
              {result.teamScore} – {result.opponentScore}
            </p>
            <p className={cn('mt-1 text-sm font-bold', OUTCOME_STYLE[result.outcome].tone)}>
              {OUTCOME_STYLE[result.outcome].label}
            </p>
            <p className="mt-2 font-mono text-[11px] text-chalk/60">
              <span className={result.rankingPoints >= 0 ? 'text-neon' : 'text-[#F07070]'}>
                {result.rankingPoints > 0 && '+'}
                {result.rankingPoints} ⭐
              </span>
              {' · '}
              <span className="text-gold">+{formatNumber(result.coinsEarned)} เหรียญ</span>
            </p>

            {/* ใครยิงนาทีไหนบ้าง — ล็อกความสูงไว้ ยิงเยอะแค่ไหนก็เลื่อนดูในกล่องนี้ */}
            {result.events.length > 0 && (
              <ul className="mt-3 max-h-24 space-y-1 overflow-y-auto text-left">
                {result.events.map((event) => (
                  <li
                    key={`${event.minute}-${event.scorer}`}
                    className="flex items-center gap-2 font-mono text-[10px]"
                  >
                    <span className="text-chalk/45">{event.minute}'</span>
                    <span aria-hidden>⚽</span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate',
                        event.side === 'team' ? 'text-neon' : 'text-chalk/55',
                      )}
                    >
                      {event.scorer}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── ท้ายแผง: ปุ่มอยู่ล่างสุดเสมอ ไม่ถูกเนื้อหาดันหาย ── */}
      <div className={cn('shrink-0 space-y-2', compact ? 'pt-3' : 'pt-4')}>
        {status === 'idle' && (
          <PrimaryButton
            label="หาคู่แข่ง"
            onClick={search}
            disabled={squadIncomplete}
            compact={compact}
          />
        )}
        {status === 'found' && (
          <>
            <PrimaryButton label="เริ่มแข่งเลย" onClick={kickoff} compact={compact} />
            <p className="text-center text-[11px] text-chalk/45">
              เจอคู่แล้วต้องแข่ง — เริ่มเองอัตโนมัติ ยกเลิกไม่ได้
            </p>
          </>
        )}
        {status === 'playing' && (
          <PrimaryButton label="กำลังแข่ง..." onClick={() => {}} disabled compact={compact} />
        )}
        {status === 'finished' && (
          <PrimaryButton label="หาคู่แข่งใหม่" onClick={search} compact={compact} />
        )}
        {status === 'empty' && (
          <PrimaryButton label="ลองหาใหม่" onClick={search} compact={compact} />
        )}

        {/*
          * ไม่มีปุ่มยกเลิกตอน 'found' โดยตั้งใจ
          * ถ้ายกเลิกได้หลังเห็นค่าพลังคู่แข่งแล้ว จะกลายเป็นกดหาคู่รัว ๆ
          * แล้วทิ้งไปเรื่อย ๆ จนเจอทีมอ่อน ๆ ค่อยแข่ง = ปั้มดาวฟรี
          * ส่วนตอน 'searching' ยังยกเลิกได้ เพราะยังไม่รู้ว่าจะเจอใคร
          */}
        {(status === 'searching' || status === 'finished' || status === 'empty') && (
          <button
            type="button"
            onClick={cancel}
            className={cn(
              'w-full rounded-lg bg-[#D93A3A] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#C22F2F]',
              compact ? 'py-2 text-xs' : 'py-2.5 text-sm',
            )}
          >
            {status === 'finished' ? 'ปิด' : 'ยกเลิก'}
          </button>
        )}
      </div>
    </section>
  );
};
