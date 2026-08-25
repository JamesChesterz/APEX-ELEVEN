/**
 * แถวแดชบอร์ดด้านล่างของหน้า MY TEAM
 * 4 การ์ด: Live แชท, คลังการ์ด, จับคู่แข่งขัน, ตารางอันดับ
 *
 * ภารกิจประจำวันถูกถอดออกและแทนที่ด้วยแชท ส่วนแผงจับคู่ย้ายจากช่องแรกมาช่องที่สาม
 */
import { LiveChatPanel } from '@/components/chat/LiveChatPanel';
import { LeaderboardWidget } from '@/components/leaderboard/LeaderboardWidget';
import { MatchmakingPanel } from '@/components/matchmaking/MatchmakingPanel';
import { MyCardsWidget } from '@/components/player/MyCardsWidget';
import type { LeaderboardEntry } from '@/types/match';

interface BottomDashboardProps {
  /** ตารางอันดับทั้งหมด — วิดเจ็ตตัด 3 อันดับแรกมาแสดงเอง */
  leaders: LeaderboardEntry[];
}

export const BottomDashboard = ({ leaders }: BottomDashboardProps) => (
  // shrink-0: แถวนี้ห้ามถูกบีบ และห้ามดันสนามด้านบน — แต่ละการ์ดคุมความสูงของตัวเอง
  <div className="grid shrink-0 items-stretch gap-3 md:grid-cols-2 2xl:grid-cols-4">
    {/* แชทอ่านทุกอย่างจากฮุกของตัวเองแล้ว จึงไม่ต้องส่ง props */}
    <LiveChatPanel />
    <MyCardsWidget />
    {/* แผงนี้อ่านสถานะจาก MatchmakingProvider เองแล้ว จึงไม่ต้องส่ง props */}
    <MatchmakingPanel compact />
    <LeaderboardWidget entries={leaders} />
  </div>
);
