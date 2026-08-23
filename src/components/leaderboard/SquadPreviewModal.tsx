/**
 * ดูตัวจริง 11 คนของผู้เล่นคนอื่น (เปิดจากตารางอันดับ)
 *
 * ข้อมูลมาจากโปรไฟล์สาธารณะบน Firestore ซึ่งเก็บแค่ "ใครอยู่ช่องไหน + ตีบวกเท่าไหร่"
 * รายละเอียดนักเตะทั้งหมดอ่านจาก data/players.ts ของเครื่องคนดูเอง
 *
 * สนามในนี้เป็นเวอร์ชันอ่านอย่างเดียว: ใช้ perspective ชุดเดียวกับหน้า MY TEAM
 * (projectToPitch) แต่ตัดเรื่องลากวาง/สลับตัวออกทั้งหมด
 */
import { useMemo } from 'react';
import { Modal } from '@/components/layout/Modal';
import { PlayerCard } from '@/components/player/PlayerCard';
import { projectToPitch } from '@/components/pitch/FormationPositions';
import { getFormationById } from '@/data/formations';
import { getPlayerById } from '@/data/players';
import type { PublicProfile } from '@/services/firebase/profiles';
import { getEffectiveOvr } from '@/services/teamRating';
import { cn } from '@/utils/helpers';

interface SquadPreviewModalProps {
  /** null = ปิดอยู่ */
  profile: PublicProfile | null;
  onClose: () => void;
}

/** เผื่อขอบบน-ล่างไม่ให้การ์ดล้นกรอบสนาม (ค่าเดียวกับหน้า MY TEAM) */
const SAFE_TOP = 13;
const SAFE_BOTTOM = 8;

export const SquadPreviewModal = ({ profile, onClose }: SquadPreviewModalProps) => {
  /** จับคู่ช่องในแผนการเล่นกับนักเตะที่เจ้าของทีมจัดไว้ */
  const slots = useMemo(() => {
    if (!profile) return [];
    const formation = getFormationById(profile.formationId);

    return formation.slots.map((slot) => {
      const entry = profile.squad.find((item) => item.slotId === slot.id);
      const player = entry ? getPlayerById(entry.playerId) ?? null : null;

      return { slot, player, level: entry?.level ?? 1 };
    });
  }, [profile]);

  const filled = slots.filter((entry) => entry.player !== null);

  if (!profile) return null;

  const formation = getFormationById(profile.formationId);

  return (
    <Modal
      open
      title={profile.teamName}
      subtitle={`${profile.managerName} · แผน ${formation.name} · OVR ${profile.teamOvr} · ตัวจริง ${filled.length}/11`}
      onClose={onClose}
    >
      {filled.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-ink-900/50 px-4 py-8 text-center text-sm text-chalk/50">
          ทีมนี้ยังไม่ได้ประกาศตัวจริง — เจ้าของทีมต้องเข้าเกมอีกครั้งหลังอัปเดตระบบ
        </p>
      ) : (
        <div className="space-y-4">
          {/* ── สนามอ่านอย่างเดียว ── */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(120%_80%_at_50%_100%,#1B4B2A,#0B2416_70%)]">
            {/* เส้นสนามแบบย่อ: วงกลมกลางสนาม + เส้นแบ่งแดน */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <g fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.4" vectorEffect="non-scaling-stroke">
                <polygon points={[[4, 3], [96, 3], [96, 97], [4, 97]]
                  .map(([x, y]) => {
                    const point = projectToPitch(x, y);
                    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
                  })
                  .join(' ')} />
                <polyline points={[[4, 50], [96, 50]]
                  .map(([x, y]) => {
                    const point = projectToPitch(x, y);
                    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
                  })
                  .join(' ')} />
                <polygon points={Array.from({ length: 48 }, (_, index) => {
                  const angle = (index / 48) * Math.PI * 2;
                  return [50 + Math.cos(angle) * 11, 50 + Math.sin(angle) * 8] as [number, number];
                })
                  .map(([x, y]) => {
                    const point = projectToPitch(x, y);
                    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
                  })
                  .join(' ')} />
              </g>
            </svg>

            {slots.map(({ slot, player, level }) => {
              const point = projectToPitch(slot.x, slot.y);
              const top = SAFE_TOP + (point.y / 100) * (100 - SAFE_TOP - SAFE_BOTTOM);
              // การ์ดที่อยู่ไกลกล้องย่อลงตามระยะ เหมือนสนามหน้า MY TEAM
              const depth = 0.72 + point.scale * 0.28;

              return (
                <div
                  key={slot.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${point.x}%`, top: `${top}%`, transform: `translate(-50%, -50%) scale(${depth})` }}
                >
                  {player ? (
                    <div className="flex flex-col items-center">
                      <PlayerCard player={player} size="xs" level={level} />
                      <span className="mt-0.5 rounded bg-black/60 px-1 font-mono text-[8px] text-chalk/70">
                        {slot.position}
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-lg border border-dashed border-white/30 bg-black/40">
                      <span className="font-mono text-[9px] text-white/50">{slot.position}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── รายชื่อแบบตาราง อ่านง่ายกว่าบนมือถือ ── */}
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {slots.map(({ slot, player, level }) => (
              <li
                key={slot.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border border-white/5 bg-ink-900/40 px-3 py-2 text-sm',
                  !player && 'opacity-40',
                )}
              >
                <span className="w-10 shrink-0 font-mono text-[10px] text-chalk/45">
                  {slot.position}
                </span>
                <span className="min-w-0 flex-1 truncate">{player?.name ?? '— ว่าง —'}</span>
                {player && level > 1 && (
                  <span className="shrink-0 font-mono text-[10px] text-gold">+{level - 1}</span>
                )}
                {player && (
                  <span className="w-7 shrink-0 text-right font-display">
                    {getEffectiveOvr({ slot, player })}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <p className="text-center text-xs text-chalk/35">
            ข้อมูลอัปเดตล่าสุดตอนเจ้าของทีมเข้าเกมครั้งล่าสุด — ทีมอาจเปลี่ยนได้ตลอด
          </p>
        </div>
      )}
    </Modal>
  );
};
