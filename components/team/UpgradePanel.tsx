/**
 * แผงสรุปการตีบวกของ 11 ตัวจริง (หน้า MY TEAM)
 * บอกสองอย่าง: แต้มตีบวกที่มี และตอนนี้ทีมตีบวกไปแล้วแค่ไหน
 */
import { usePlayers } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import { getPlus, MAX_PLUS, OVR_PER_LEVEL } from '@/services/upgrade';
import { remainingMatchQuota } from '@/services/upgradePoints';
import { cn, formatNumber } from '@/utils/helpers';

export const UpgradePanel = () => {
  const { ratedSlots } = useTeam();
  const { upgradePoints, upgradeDaily } = usePlayers();

  /** ค่าบวกของแต่ละช่องที่มีนักเตะอยู่ (ช่องว่างไม่นับ) */
  const plusList = ratedSlots.flatMap(({ player, level }) =>
    player && level !== undefined ? [getPlus(level)] : [],
  );

  const totalPlus = plusList.reduce((sum, plus) => sum + plus, 0);
  const upgraded = plusList.filter((plus) => plus > 0).length;
  const maxed = plusList.filter((plus) => plus >= MAX_PLUS).length;

  return (
    <section className="glass-panel p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="panel-title">Upgrade</p>
        <p className="font-mono text-[11px] text-kit">
          {formatNumber(upgradePoints)} แต้มตีบวก
        </p>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <p className="font-display text-4xl leading-none text-kit">+{totalPlus}</p>
        <p className="pb-0.5 text-xs leading-tight text-chalk/55">
          ตีบวกรวมของ 11 ตัวจริง
          <span className="block font-mono text-[11px] text-neon">
            ค่าพลัง +{totalPlus * OVR_PER_LEVEL} จากการตีบวก
          </span>
        </p>
      </div>

      {/* แถบเล็ก ๆ ทีละคน — เห็นทั้งทีมว่าใครยังไม่ได้ตีบวก */}
      <div className="mt-3 flex gap-1">
        {plusList.map((plus, index) => (
          <span
            key={index}
            title={`+${plus}`}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              plus >= MAX_PLUS ? 'bg-gold' : plus > 0 ? 'bg-kit' : 'bg-white/10',
            )}
          />
        ))}
      </div>

      <p className="mt-2 font-mono text-[10px] text-chalk/45">
        ตีบวกแล้ว {upgraded}/{plusList.length} คน
        {maxed > 0 && ` · เต็ม +${MAX_PLUS} ${maxed} คน`}
        {' · '}
        ชนะได้แต้มอีก {remainingMatchQuota(upgradeDaily)} นัดวันนี้
      </p>
    </section>
  );
};
