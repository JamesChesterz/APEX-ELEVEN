/**
 * หน้าต่างลอยของแมตช์ที่กดหาคู่เอง (ระบบ Matchmaking)
 *
 * แผงจับคู่ตัวจริงอยู่ที่หน้า MATCHMAKING
 * ตัวนี้เป็นตัวสำรองไว้ให้ "ดูแมตช์ต่อได้แม้เปลี่ยนหน้าไประหว่างแข่ง"
 * จึงโผล่เฉพาะตอนมีแมตช์ค้างอยู่จริง ๆ และตอนอยู่นอกหน้า MY TEAM เท่านั้น
 * (ถ้าโผล่ทับหน้า MATCHMAKING ด้วยจะกลายเป็นแผงซ้อนแผงสองอันพร้อมกัน)
 */
import { useLocation } from 'react-router-dom';
import { MatchmakingPanel } from '@/components/matchmaking/MatchmakingPanel';
import { useMatchmaking } from '@/hooks/useMatchmaking';

/** หน้าที่มีแผงจับคู่ของตัวเองอยู่แล้ว */
const OWNS_PANEL = ['/matchmaking'];

export const MatchLiveOverlay = () => {
  const { state } = useMatchmaking();
  const { pathname } = useLocation();

  // ว่างอยู่ = ไม่ต้องโผล่มาเลย
  if (state.status === 'idle') return null;
  if (OWNS_PANEL.includes(pathname)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm">
        <MatchmakingPanel />
      </div>
    </div>
  );
};
