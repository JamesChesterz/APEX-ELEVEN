/**
 * ประกาศ route ทั้งหมดของเกม
 *
 * กำลังตรวจสอบการล็อกอิน → จอโหลด (โหมดออนไลน์ต้องรอ Firebase ตอบก่อน)
 * ยังไม่ได้เข้าสู่ระบบ → เห็นหน้า AuthPage อย่างเดียว
 * เข้าสู่ระบบแล้ว → โหลด Provider ของคลังการ์ด/ทีม/ออนไลน์/การแข่ง โดยอ่านค่าเริ่มต้นจากบัญชีนั้น
 * (key={account.id} บังคับให้ state ทั้งชุดถูกสร้างใหม่เมื่อสลับบัญชี)
 *
 * ลำดับ Provider สำคัญ: OnlineProvider ต้องอยู่ใต้ TeamProvider (ใช้ค่าพลังทีมไปประกาศตัว)
 * แต่ต้องอยู่เหนือ MatchmakingProvider (ระบบจับคู่หยิบคู่แข่งจริงจากตรงนั้น)
 * ส่วน GiftsProvider ต้องอยู่ใต้ InventoryProvider เพราะต้องเพิ่มของเข้าคลัง
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { GameConfigProvider } from '@/hooks/useGameConfig';
import { GiftsProvider } from '@/hooks/useGifts';
import { LeagueProvider } from '@/hooks/useLeague';
import { MatchmakingProvider } from '@/hooks/useMatchmaking';
import { OnlineProvider } from '@/hooks/useOnline';
import { RankRewardsProvider } from '@/hooks/useRankRewards';
import { InventoryProvider } from '@/hooks/usePlayers';
import { TeamProvider } from '@/hooks/useTeam';
import { AdminPage } from '@/pages/Admin/AdminPage';
import { AuthPage } from '@/pages/Auth/AuthPage';
import { HomePage } from '@/pages/Home/HomePage';
import { MyTeamPage } from '@/pages/MyTeam/MyTeamPage';
import { SubstitutionPage } from '@/pages/Substitution/SubstitutionPage';
import { CardPackPage } from '@/pages/CardPack/CardPackPage';
import { ExchangePage } from '@/pages/Exchange/ExchangePage';
import { ExchangeCardPage } from '@/pages/ExchangeCard/ExchangeCardPage';
import { InventoryPage } from '@/pages/Inventory/InventoryPage';
import { LoginBonusPage } from '@/pages/LoginBonus/LoginBonusPage';
import { LuckyBoxPage } from '@/pages/Lucky/LuckyBoxPage';
import { PassPage } from '@/pages/Pass/PassPage';
import { MatchmakingPage } from '@/pages/Matchmaking/MatchmakingPage';
import { MatchPage } from '@/pages/Match/MatchPage';
import { LeaderboardPage } from '@/pages/Leaderboard/LeaderboardPage';
import { ProfilePage } from '@/pages/Profile/ProfilePage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';
import { UpgradePage } from '@/pages/Upgrade/UpgradePage';

/** จอคั่นระหว่างรอเซิร์ฟเวอร์ตอบว่ายังล็อกอินค้างอยู่ไหม */
const BootScreen = () => (
  <div className="stadium-bg flex min-h-screen flex-col items-center justify-center gap-4">
    <h1 className="font-display text-4xl uppercase">
      FC <span className="text-neon">ALLSTAR</span>
    </h1>
    <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.25em] text-chalk/40">
      กำลังเชื่อมต่อเซิร์ฟเวอร์…
    </p>
  </div>
);

const GameRoutes = () => {
  const { account, booting } = useAuth();

  if (booting) return <BootScreen />;
  if (!account) return <AuthPage />;

  return (
    <BrowserRouter>
      <InventoryProvider key={account.id}>
        <GiftsProvider>
        <GameConfigProvider>
        <TeamProvider>
          <OnlineProvider>
            <MatchmakingProvider>
              <LeagueProvider>
                <RankRewardsProvider>
                  <Routes>
                    <Route element={<MainLayout />}>
                      <Route index element={<HomePage />} />
                      <Route path="my-team" element={<MyTeamPage />} />
                      <Route path="substitution" element={<SubstitutionPage />} />
                      <Route path="card-pack" element={<CardPackPage />} />
                      <Route path="exchange" element={<ExchangePage />} />
                      <Route path="lucky" element={<LuckyBoxPage />} />
                      <Route path="pass" element={<PassPage />} />
                      <Route path="matchmaking" element={<MatchmakingPage />} />
                      <Route path="match" element={<MatchPage />} />
                      <Route path="leaderboard" element={<LeaderboardPage />} />
                      <Route path="exchange-card" element={<ExchangeCardPage />} />
                      <Route path="inventory" element={<InventoryPage />} />
                      <Route path="login-bonus" element={<LoginBonusPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="upgrade" element={<UpgradePage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      {/* หน้าผู้ดูแล — คนที่ไม่ใช่เจ้าของเปิดเข้ามาจะเห็นแค่ข้อความปฏิเสธ */}
                      <Route path="admin" element={<AdminPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                </RankRewardsProvider>
              </LeagueProvider>
            </MatchmakingProvider>
          </OnlineProvider>
        </TeamProvider>
        </GameConfigProvider>
        </GiftsProvider>
      </InventoryProvider>
    </BrowserRouter>
  );
};

const App = () => (
  <AuthProvider>
    <GameRoutes />
  </AuthProvider>
);

export default App;
