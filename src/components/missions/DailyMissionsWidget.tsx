/**
 * วิดเจ็ตภารกิจประจำวัน: โชว์ 3 อันแรก + ปุ่มรับรางวัลเมื่อทำครบทุกข้อ
 * ความคืบหน้าอ่านจากตัวนับจริงใน usePlayers (รีเซ็ตเองตอน 06:00 พร้อมลีก)
 */
import { useState } from 'react';
import { Modal } from '@/components/layout/Modal';
import { MissionList } from '@/components/missions/MissionList';
import { usePlayers } from '@/hooks/usePlayers';
import { missionCoinTotal, MISSION_ALL_REWARD } from '@/services/missions';
import { cn, formatNumber } from '@/utils/helpers';

export const DailyMissionsWidget = () => {
  const { missions, missionsClaimable, claimMissions, upgradeDaily } = usePlayers();
  const [open, setOpen] = useState(false);

  const preview = missions.slice(0, 3);
  const done = missions.filter((mission) => mission.progress >= mission.goal).length;

  return (
    <>
      <section className="glass-panel flex flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="panel-title">Daily Missions</p>
          <p className="font-mono text-[11px] text-chalk/45">
            {done}/{missions.length}
          </p>
        </div>

        <ul className="mt-3 flex-1 space-y-2.5">
          {preview.map((mission) => {
            const complete = mission.progress >= mission.goal;

            return (
              <li key={mission.id}>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="flex w-full items-center gap-2 text-left text-xs hover:text-neon"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]',
                      complete ? 'bg-neon text-ink-900' : 'border border-white/20 text-chalk/40',
                    )}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1 truncate">{mission.title}</span>
                  <span className="font-mono text-[11px] text-chalk/45">
                    {mission.progress}/{mission.goal}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* ทำครบแล้วปุ่มเปลี่ยนเป็นรับรางวัลทันที จะได้ไม่ต้องเปิดหน้าต่างก่อน */}
        {missionsClaimable ? (
          <button
            type="button"
            onClick={() => claimMissions()}
            className="mt-3 w-full rounded-lg bg-kit py-2 text-xs font-bold uppercase tracking-wider text-ink-900 hover:brightness-110"
          >
            รับรางวัล +{formatNumber(MISSION_ALL_REWARD)} แต้มตีบวก
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold uppercase tracking-wider text-chalk/80 hover:border-neon/40 hover:text-neon"
          >
            {upgradeDaily.missionsClaimed ? 'รับรางวัลแล้ววันนี้' : 'ดูทั้งหมด'}
          </button>
        )}
      </section>

      <Modal
        open={open}
        title="Missions"
        subtitle={`ภารกิจประจำวัน · ทำสำเร็จแล้ว ${done}/${missions.length} · ครบทุกข้อรับ ${formatNumber(
          missionCoinTotal(missions),
        )} เหรียญ + ${formatNumber(MISSION_ALL_REWARD)} แต้มตีบวก`}
        onClose={() => setOpen(false)}
      >
        <MissionList missions={missions} />

        <button
          type="button"
          disabled={!missionsClaimable}
          onClick={() => {
            if (claimMissions()) setOpen(false);
          }}
          className={cn(
            'mt-4 w-full rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-colors',
            missionsClaimable
              ? 'bg-kit text-ink-900 hover:brightness-110'
              : 'cursor-not-allowed bg-white/5 text-chalk/35',
          )}
        >
          {upgradeDaily.missionsClaimed
            ? 'รับรางวัลของวันนี้ไปแล้ว'
            : `รับรางวัลครบชุด · +${formatNumber(MISSION_ALL_REWARD)} แต้มตีบวก`}
        </button>

        <p className="mt-2 text-center text-[10px] text-chalk/40">
          ภารกิจรีเซ็ตพร้อมวันแข่งใหม่ทุก 06:00
        </p>
      </Modal>
    </>
  );
};
