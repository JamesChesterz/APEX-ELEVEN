/**
 * แผงทีมพิเศษบนหน้า MY TEAM
 *
 * บอกว่าแอดมินตั้งชุดไหนไว้บ้าง จัดไปแล้วกี่คน และยังขาดใคร
 * ชุดที่ครบแล้วขึ้นป้าย "+N" สีนีออน = โบนัสนี้ถูกบวกเข้า "พลังตอนลงแข่ง" อยู่จริง
 *
 * อ่านข้อมูลจาก useTeam เอง (เหมือน LiveChatPanel) จึงไม่ต้องส่ง props ผ่านหลายชั้น
 */
import { useTeam } from '@/hooks/useTeam';
import { squadBonusPlayerName } from '@/services/squadBonus';
import { cn } from '@/utils/helpers';

/** ชื่อที่ยังขาดที่ยอมโชว์ก่อนจะย่อเป็น "อีก N คน" */
const NAMES_SHOWN = 4;

export const SquadBonusProgress = () => {
  const { squadBonusTeams } = useTeam();

  if (squadBonusTeams.length === 0) {
    return (
      <section className="glass-panel p-4">
        <p className="panel-title">ทีมพิเศษ</p>
        <p className="mt-2 text-xs text-chalk/45">
          ตอนนี้ยังไม่มีชุดทีมพิเศษเปิดอยู่ — รอประกาศจากผู้ดูแลเกม
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel p-4">
      <p className="panel-title">ทีมพิเศษ</p>
      <p className="mt-1 text-[11px] text-chalk/45">จัดครบทั้งชุดใน 11 ตัวจริง รับโบนัสพลังทีม</p>

      <ul className="mt-3 space-y-2">
        {squadBonusTeams.map(({ team, matched, missing, complete }) => (
          <li
            key={team.id}
            className={cn(
              'rounded-lg border p-2.5',
              complete ? 'border-neon/50 bg-neon/10' : 'border-white/10 bg-ink-900/40',
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold">{team.name}</p>
              <span
                className={cn(
                  'shrink-0 font-mono text-[11px]',
                  complete ? 'text-neon' : 'text-chalk/40',
                )}
              >
                +{team.bonus} OVR
              </span>
            </div>

            {team.description && (
              <p className="mt-0.5 truncate text-[11px] text-chalk/45">{team.description}</p>
            )}

            {/* แถบความคืบหน้า — เห็นได้ทันทีว่าเหลืออีกไกลแค่ไหน */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <span
                className={cn('block h-full rounded-full', complete ? 'bg-neon' : 'bg-gold/70')}
                style={{ width: `${(matched.length / team.playerIds.length) * 100}%` }}
              />
            </div>

            <p className="mt-1.5 font-mono text-[10px] text-chalk/45">
              {matched.length}/{team.playerIds.length} คน
              {complete ? (
                <span className="text-neon"> · ครบแล้ว โบนัสทำงานอยู่</span>
              ) : (
                <>
                  {' · ยังขาด '}
                  {missing.slice(0, NAMES_SHOWN).map(squadBonusPlayerName).join(', ')}
                  {missing.length > NAMES_SHOWN && ` อีก ${missing.length - NAMES_SHOWN} คน`}
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};
