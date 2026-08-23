/**
 * ผลการแข่งย้อนหลัง — กดแต่ละนัดเพื่อดูไทม์ไลน์ประตูของนัดนั้น
 * ประวัติถูกเก็บลงบัญชี จึงไม่หายเมื่อรีเฟรชหรือปิดเกม
 */
import { useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import type { MatchOutcome, MatchResult } from '@/types/match';
import { cn, formatNumber } from '@/utils/helpers';

interface MatchHistoryListProps {
  matches: MatchResult[];
  /** จำกัดจำนวนที่แสดง (ไม่ใส่ = แสดงทั้งหมดที่ส่งมา) */
  limit?: number;
}

const OUTCOME_TONE: Record<MatchOutcome, string> = {
  win: 'text-neon',
  draw: 'text-kit',
  loss: 'text-[#F07070]',
};

const OUTCOME_LABEL: Record<MatchOutcome, string> = { win: 'ช', draw: 'ส', loss: 'พ' };

/** เวลาแบบสั้น: วันที่ + ชั่วโมง:นาที */
const playedLabel = (iso: string): string => {
  const date = new Date(iso);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return sameDay ? `วันนี้ ${time}` : `${date.getDate()}/${date.getMonth() + 1} ${time}`;
};

export const MatchHistoryList = ({ matches, limit }: MatchHistoryListProps) => {
  const [detail, setDetail] = useState<MatchResult | null>(null);
  const visible = limit ? matches.slice(0, limit) : matches;

  if (visible.length === 0) {
    return (
      <p className="panel py-10 text-center text-sm text-chalk/45">
        ยังไม่มีผลการแข่ง — เข้าร่วมลีกหรือลงแมตช์กระชับมิตรเพื่อเริ่มเก็บสถิติ
      </p>
    );
  }

  return (
    <>
      <ul className="panel divide-y divide-white/5">
        {visible.map((match) => (
          <li key={match.id}>
            <button
              type="button"
              onClick={() => setDetail(match)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-600 font-display text-xs',
                  OUTCOME_TONE[match.outcome],
                )}
              >
                {OUTCOME_LABEL[match.outcome]}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{match.opponentName}</span>
                  {match.mode === 'league' && (
                    <span className="shrink-0 rounded bg-neon/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-neon">
                      ลีก
                    </span>
                  )}
                </span>
                <span className="block font-mono text-[10px] text-chalk/45">
                  {playedLabel(match.playedAt)} · OVR {match.opponentOvr}
                </span>
              </span>

              <span className="font-display text-lg">
                {match.teamScore}–{match.opponentScore}
              </span>

              <span
                className={cn(
                  'w-14 text-right font-mono text-xs',
                  match.rankingPoints >= 0 ? 'text-neon' : 'text-[#F07070]',
                )}
              >
                {match.rankingPoints >= 0 ? '+' : ''}
                {match.rankingPoints}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* รายละเอียดนัดที่เลือก */}
      <Modal
        open={detail !== null}
        title={detail ? `${detail.teamScore} – ${detail.opponentScore}` : ''}
        subtitle={
          detail
            ? `พบ ${detail.opponentName} · ${playedLabel(detail.playedAt)} · ${
                detail.mode === 'league' ? 'ลีกประจำวัน' : 'แมตช์กระชับมิตร'
              }`
            : ''
        }
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'พลังทีมเรา', value: String(detail.teamOvr) },
                { label: 'พลังคู่แข่ง', value: String(detail.opponentOvr) },
                {
                  label: 'เหรียญที่ได้',
                  value: `+${formatNumber(detail.coinsEarned)}`,
                  tone: 'text-gold',
                },
                {
                  label: 'คะแนนซีซัน',
                  value: `${detail.rankingPoints >= 0 ? '+' : ''}${detail.rankingPoints}`,
                  tone: detail.rankingPoints >= 0 ? 'text-neon' : 'text-[#F07070]',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-ink-700/50 px-2 py-2 text-center">
                  <p className="eyebrow">{item.label}</p>
                  <p className={cn('font-display text-lg leading-none', item.tone)}>{item.value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="eyebrow mb-2">ไทม์ไลน์ประตู</p>
              {detail.events.length === 0 ? (
                <p className="text-sm text-chalk/45">นัดนี้ไม่มีประตูเกิดขึ้น</p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.events.map((event) => (
                    <li
                      key={`${event.minute}-${event.scorer}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                        event.side === 'team' ? 'bg-neon/10' : 'bg-white/5',
                      )}
                    >
                      <span className="font-mono text-xs text-chalk/50">{event.minute}'</span>
                      <span aria-hidden>⚽</span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate',
                          event.side === 'team' ? 'text-neon' : 'text-chalk/60',
                        )}
                      >
                        {event.scorer}
                      </span>
                      <span className="font-mono text-[10px] text-chalk/40">
                        {event.side === 'team' ? 'ทีมเรา' : detail.opponentName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="font-mono text-[10px] text-chalk/35">
              โอกาสชนะก่อนเริ่มแข่ง {Math.round(detail.odds.win * 100)}% · เสมอ{' '}
              {Math.round(detail.odds.draw * 100)}% · แพ้ {Math.round(detail.odds.loss * 100)}%
            </p>
          </div>
        )}
      </Modal>
    </>
  );
};
