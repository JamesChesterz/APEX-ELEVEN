/**
 * แจ้งเตือน "ทีมของคุณถูกท้า" — ขึ้นมุมขวาบนตอนเปิดเกมแล้วเจอผลที่ค้างอยู่ในกล่อง
 *
 * ผลพวกนี้เกิดขึ้นตอนเราไม่ได้อยู่หน้าจอ (คนอื่นกดท้าทีมเราแล้วระบบจำลองผลที่เครื่องเขา)
 * คะแนนกับเหรียญถูกบันทึกไปแล้วตั้งแต่ตอนโหลด กล่องนี้แค่บอกให้รู้ว่าเกิดอะไรขึ้นบ้าง
 */
import { useEffect } from 'react';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { cn } from '@/utils/helpers';

/** ปิดเองหลังกี่มิลลิวินาที */
const AUTO_HIDE_MS = 9000;

const OUTCOME_TEXT = {
  win: { label: 'ป้องกันสำเร็จ', tone: 'text-neon' },
  draw: { label: 'เสมอ', tone: 'text-gold' },
  loss: { label: 'เสียท่า', tone: 'text-[#F07070]' },
} as const;

export const DefenseNotice = () => {
  const { defenseNotices, clearDefenseNotices } = useMatchmaking();

  useEffect(() => {
    if (defenseNotices.length === 0) return undefined;
    const timer = window.setTimeout(clearDefenseNotices, AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [clearDefenseNotices, defenseNotices]);

  if (defenseNotices.length === 0) return null;

  return (
    /*
     * top เผื่อรอยบากของ iPhone ด้วย (แถบหัวมี pt-[env(safe-area-inset-top)] อยู่แล้ว
     * ถ้าไม่บวกตรงนี้ด้วย แจ้งเตือนจะไปทับปุ่มโปรไฟล์บนเครื่องที่มีรอยบาก)
     * z-40 = ต่ำกว่า modal (z-50) เพื่อไม่ให้บังหน้าต่างรับรางวัลปลายซีซัน
     */
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.5rem)] z-40 space-y-2 sm:inset-x-auto sm:right-4 sm:w-80">
      <div className="pointer-events-auto overflow-hidden rounded-xl border border-white/10 bg-ink-800/95 shadow-glass backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <span className="eyebrow text-chalk/60">ทีมของคุณถูกท้า</span>
          <button
            type="button"
            onClick={clearDefenseNotices}
            className="text-xs text-chalk/40 transition-colors hover:text-chalk"
            aria-label="ปิดแจ้งเตือน"
          >
            ✕
          </button>
        </div>

        <ul className="divide-y divide-white/5">
          {defenseNotices.map((match) => {
            const outcome = OUTCOME_TEXT[match.outcome];

            return (
              <li key={match.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {match.opponentName}
                  </span>
                  <span className={cn('block font-mono text-[10px]', outcome.tone)}>
                    {outcome.label} · OVR {match.opponentOvr}
                  </span>
                </span>

                <span className="font-display text-base">
                  {match.teamScore}–{match.opponentScore}
                </span>

                <span
                  className={cn(
                    'w-10 text-right font-mono text-xs',
                    match.rankingPoints >= 0 ? 'text-neon' : 'text-[#F07070]',
                  )}
                >
                  {match.rankingPoints >= 0 ? '+' : ''}
                  {match.rankingPoints}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
