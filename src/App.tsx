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
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LeagueProvider } from '@/hooks/useLeague';
import { MatchmakingProvider } from '@/hooks/useMatchmaking';
import { OnlineProvider } from '@/hooks/useOnline';
import { InventoryProvider } from '@/hooks/usePlayers';
import { TeamProvider } from '@/hooks/useTeam';
import { AuthPage } from '@/pages/Auth/AuthPage';
import { HomePage } from '@/pages/Home/HomePage';
import { MyTeamPage } from '@/pages/MyTeam/MyTeamPage';
import { SubstitutionPage } from '@/pages/Substitution/SubstitutionPage';
import { CardPackPage } from '@/pages/CardPack/CardPackPage';
import { ExchangePage } from '@/pages/Exchange/ExchangePage';
import { MatchPage } from '@/pages/Match/MatchPage';
import { LeaderboardPage } from '@/pages/Leaderboard/LeaderboardPage';
import { ProfilePage } from '@/pages/Profile/ProfilePage';

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
        <TeamProvider>
          <OnlineProvider>
            <MatchmakingProvider>
              <LeagueProvider>
                <Routes>
                  <Route element={<MainLayout />}>
                    <Route index element={<HomePage />} />
                    <Route path="my-team" element={<MyTeamPage />} />
                    <Route path="substitution" element={<SubstitutionPage />} />
                    <Route path="card-pack" element={<CardPackPage />} />
                    <Route path="exchange" element={<ExchangePage />} />
                    <Route path="match" element={<MatchPage />} />
                    <Route path="leaderboard" element={<LeaderboardPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </LeagueProvider>
            </MatchmakingProvider>
          </OnlineProvider>
        </TeamProvider>
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
