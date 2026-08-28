/**
 * เด้งขึ้นทันทีเมื่อนักเตะของเราบาดเจ็บระหว่างถ่ายทอดสด — นาฬิกาแมตช์หยุดรออยู่
 * ต้องเลือกตัวสำรองมาเปลี่ยนก่อนถึงจะแข่งต่อได้ (ปิดหน้าต่างเฉย ๆ ไม่ได้)
 */
import type { BenchCard } from '@/hooks/useTeam';
import { PlayerCard } from '@/components/player/PlayerCard';
import { cn } from '@/utils/helpers';

interface InjurySubModalProps {
  playerName: string;
  bench: BenchCard[];
  /** เช็คว่าเอาการ์ดใบนี้ลงช่องที่ว่างได้ไหม (ปกติจะติดแค่กติกาชื่อซ้ำ) */
  canAssign: (cardId: string) => boolean;
  onPick: (cardId: string) => void;
  /**
   * ปิดหน้าต่างโดยยังไม่เลือกใคร — ใส่มาเฉพาะตอนผู้เล่นกดเปิดเอง
   * จากแผง "ผู้เล่นบาดเจ็บ" (ที่มีปุ่มเปลี่ยนตัวแบบคลิกเดียวอยู่แล้ว)
   * ถ้าไม่ใส่ = หน้าต่างบังคับ ต้องเลือกก่อนถึงจะแข่งต่อได้เหมือนเดิม
   */
  onClose?: () => void;
}

export const InjurySubModal = ({
  playerName,
  bench,
  canAssign,
  onPick,
  onClose,
}: InjurySubModalProps) => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
    <div className="glass-panel w-full max-w-sm space-y-3 p-5">
      <div className="relative text-center">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-lg text-chalk/50 hover:bg-white/10 hover:text-chalk"
          >
            ✕
          </button>
        )}
        <span className="text-2xl" aria-hidden>
          🚑
        </span>
        <p className="mt-1 font-display text-lg uppercase leading-tight text-[#F0A070]">
          {playerName} บาดเจ็บ!
        </p>
        <p className="mt-1 text-xs text-chalk/50">เลือกตัวสำรองลงแทนเพื่อแข่งต่อ</p>
      </div>

      {bench.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-ink-900/40 p-4 text-center text-xs text-chalk/50">
          ไม่มีตัวสำรองในคลัง — เปลี่ยนตัวไม่ได้ ทีมจะแข่งต่อด้วย 10 คน
        </p>
      ) : (
        <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-0.5">
          {bench.map(({ card, player }) => {
            const eligible = canAssign(card.id);
            return (
              <button
                key={card.id}
                type="button"
                disabled={!eligible}
                onClick={() => onPick(card.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                  eligible
                    ? 'border-white/10 bg-ink-900/40 hover:border-neon/40'
                    : 'cursor-not-allowed border-white/5 bg-ink-900/20 opacity-40',
                )}
              >
                <PlayerCard player={player} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{player.name}</span>
                  <span className="font-mono text-[10px] text-chalk/50">
                    {player.position} · OVR {player.ovr}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  </div>
);
