/**
 * หน้าต่างลอยของแมตช์กระชับมิตร
 *
 * คอลัมน์ขวาของหน้า MATCH เปลี่ยนไปโชว์รายละเอียดรางวัลแล้ว
 * แผงจับคู่จึงย้ายมาเป็นหน้าต่างลอย โผล่เฉพาะตอนมีแมตช์ค้างอยู่จริง ๆ
 * (เจอคู่ / กำลังแข่ง / มีผล) — เวลาไม่มีอะไรเกิดขึ้นก็ไม่บังหน้าจอ
 */
import { MatchmakingPanel } from '@/components/matchmaking/MatchmakingPanel';
import { useMatchmaking } from '@/hooks/useMatchmaking';

export const MatchLiveOverlay = () => {
  const { state } = useMatchmaking();

  // ว่างอยู่ = ไม่ต้องโผล่มาเลย
  if (state.status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm">
        <MatchmakingPanel />
      </div>
    </div>
  );
};
