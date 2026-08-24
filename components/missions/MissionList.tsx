/** รายการภารกิจพร้อมแถบความคืบหน้า */
import type { Mission } from '@/types/match';
import { clamp, formatNumber } from '@/utils/helpers';

interface MissionListProps {
  missions: Mission[];
}

export const MissionList = ({ missions }: MissionListProps) => (
  <ul className="space-y-3">
    {missions.map((mission) => {
      const percent = clamp((mission.progress / mission.goal) * 100, 0, 100);

      return (
        <li key={mission.id} className="panel p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">{mission.type}</p>
              <p className="font-semibold">{mission.title}</p>
              <p className="text-xs text-chalk/45">{mission.description}</p>
            </div>
            <p className="shrink-0 font-mono text-xs text-kit">
              +{formatNumber(mission.rewardCoins)}
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-kit" style={{ width: `${percent}%` }} />
            </div>
            <span className="font-mono text-[11px] text-chalk/50">
              {mission.progress}/{mission.goal}
            </span>
          </div>
        </li>
      );
    })}
  </ul>
);
