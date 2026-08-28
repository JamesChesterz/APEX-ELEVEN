/**
 * เลย์เอาต์หลัก: พื้นหลังสนามกีฬา + Sidebar ซ้าย + Header บน + พื้นที่เนื้อหา
 * ทุกหน้าใน pages/ ถูก render ผ่าน <Outlet /> ตรงกลาง
 */
import { Outlet, useLocation } from 'react-router-dom';
import { AnnouncementModal } from '@/components/admin/AnnouncementModal';
import { BannedScreen } from '@/components/admin/BannedScreen';
import { GiftNotice } from '@/components/admin/GiftNotice';
import { Header } from '@/components/header/Header';
import { SyncWarningBar } from '@/components/layout/SyncWarningBar';
import { DefenseNotice } from '@/components/matchmaking/DefenseNotice';
import { MatchLiveOverlay } from '@/components/matchmaking/MatchLiveOverlay';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { DailyRewardModal } from '@/components/league/DailyRewardModal';
import { SeasonSummaryModal } from '@/components/season/SeasonSummaryModal';
import { getPageTitle } from '@/components/sidebar/navItems';
import { useAuth } from '@/hooks/useAuth';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { usePlayers } from '@/hooks/usePlayers';
import { useLeague } from '@/hooks/useLeague';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useLadderReset } from '@/hooks/useLadderReset';
import { useSeason } from '@/hooks/useSeason';
import { isBanned } from '@/services/admin';
import { useTeam } from '@/hooks/useTeam';
import { useMyRank } from '@/hooks/useLeaderboard';

export const MainLayout = () => {
  const { pathname } = useLocation();
  const { account, logout } = useAuth();
  const { coins, points, upgradePoints } = usePlayers();
  const { record, matchLocked } = useMatchmaking();
  const { team } = useTeam();
  const { summary, claim } = useSeason();
  const { summary: dailySummary, claimDaily } = useLeague();

  // ทำตามคำสั่งรีเซ็ตดาว/ซีซันของแอดมิน (ถ้ามีค้างอยู่) — ต้องเรียกที่เดียวเท่านั้น
  useLadderReset();

  /** บัญชีถูกระงับ = บังทุกอย่างไว้ ไม่ให้เล่นต่อ */
  const { bans } = useGameConfig();
  const suspended = isBanned(bans, account?.id);

  if (suspended) return <BannedScreen />;

  /** อยู่อันดับ 1 ของตารางไหม — ใช้ตัดสินว่าจะโชว์ฉายา 1ST CHAMPION หรือป้ายระดับปกติ */
  const isChampion = useMyRank() === 1;

  /**
   * หน้าที่ขอพื้นที่เต็ม ๆ และมีแถบหัวของตัวเอง (ชื่อ + สกอร์บอร์ด + โปรไฟล์ + ปุ่มออก)
   * จึงซ่อน Header กลางและตัดระยะขอบของ <main> ทิ้ง — แต่ยังเห็นเมนูซ้ายกับเมนูล่างตามปกติ
   */
  const immersive = pathname === '/matchmaking';

  return (
    /*
     * --app-height ปกติเท่ากับ 100dvh (ไม่ใช่ h-screen: บน iOS Safari ค่า 100vh รวมความสูงของแถบ URL ที่ซ่อนอยู่
     * ทำให้แถบเมนูล่างถูกดันตกจอ ส่วน dvh วัดพื้นที่ที่มองเห็นจริงและปรับตามตอนเลื่อน)
     * โหมดคอมพิวเตอร์ที่ต้องย่อด้วย transform จะเขียนทับตัวแปรนี้เป็นความสูงก่อนย่อ
     */
    <div className="stadium-bg flex h-[var(--app-height)] overflow-hidden">
      <Sidebar locked={matchLocked} />

      <div className="flex min-w-0 flex-1 flex-col">
        {!immersive && (
          <Header
            title={getPageTitle(pathname)}
            coins={coins}
            points={points}
            upgradePoints={upgradePoints}
            rankPoints={record.points}
            isChampion={isChampion}
            username={account?.username ?? 'ผู้เล่น'}
            teamName={team.name}
            avatar={account?.state.avatar}
            onLogout={logout}
          />
        )}

        {/* ขึ้นเฉพาะตอนข้อมูลทีมเขียนขึ้นเซิร์ฟเวอร์ไม่สำเร็จ ปกติจะไม่มีอะไรตรงนี้ */}
        <SyncWarningBar />

        <main className={`flex-1 overflow-y-auto overscroll-contain ${immersive ? 'p-0' : 'p-3 lg:p-4'}`}>
          <Outlet />
        </main>

        <MobileNav locked={matchLocked} />
      </div>

      {/* ผลนัดที่โดนท้าตอนไม่อยู่ — ขึ้นทับทุกหน้า */}
      <DefenseNotice />

      {/* ของที่แอดมินเสกให้ — เด้งบอกตอนของเข้าบัญชีแล้ว */}
      <GiftNotice />

      {/* แมตช์ที่กดหาคู่จากแดชบอร์ด MY TEAM — อยู่ตรงนี้เพื่อให้ดูต่อได้แม้เปลี่ยนหน้า */}
      <MatchLiveOverlay />

      {/* จบซีซันแล้วต้องกดรับรางวัลก่อนถึงจะเล่นต่อได้ (มาก่อนรางวัลรายวัน) */}
      {summary ? (
        <SeasonSummaryModal summary={summary} onClaim={claim} />
      ) : (
        dailySummary && <DailyRewardModal summary={dailySummary} onClaim={claimDaily} />
      )}

      {/* ประกาศจากผู้ดูแล — มาหลังสุดเพื่อไม่ให้บังหน้าจอรับรางวัล */}
      <AnnouncementModal />
    </div>
  );
};
