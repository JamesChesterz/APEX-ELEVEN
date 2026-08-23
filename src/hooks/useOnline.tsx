/**
 * ชั้นออนไลน์ของเกม — ตัวเชื่อมระหว่างบัญชีของเรากับผู้เล่นคนอื่นทั้งเซิร์ฟเวอร์
 *
 * ทำสองหน้าที่:
 *   1. ประกาศตัวเอง — ส่งชื่อทีม/ค่าพลัง/คะแนนขึ้น Firestore เมื่อมีอะไรเปลี่ยน
 *   2. รับข้อมูลคนอื่น — ติดตามตารางอันดับแบบเรียลไทม์ แล้วแปลงเป็น
 *      (ก) แถวในตารางอันดับ  (ข) รายชื่อคู่แข่งจริงสำหรับระบบจับคู่
 *
 * วาง Provider นี้ไว้ใต้ TeamProvider (ต้องรู้ค่าพลังทีม) แต่เหนือ MatchmakingProvider
 * (ระบบจับคู่ต้องหยิบคู่แข่งจากตรงนี้ไปใช้)
 *
 * โหมดออฟไลน์: ทุกอย่างในนี้กลายเป็นค่าว่าง แล้วระบบเดิม (mock data + บอท) ทำงานแทน
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { ONLINE } from '@/services/accountStore';
import {
  publishProfile,
  watchTopProfiles,
  type PublicProfile,
  type PublicSquadSlot,
} from '@/services/firebase/profiles';
import { difficultyFromGap, rewardForOpponent } from '@/services/matchmaking';
import type { LeaderboardEntry, Opponent } from '@/types/match';

/** หน่วงเวลาก่อนประกาศโปรไฟล์ (ms) — กันไม่ให้เขียนรัวตอนลากตัวผู้เล่นสลับตำแหน่ง */
const PUBLISH_DELAY = 4000;

interface OnlineContextValue {
  /** true = โหมดออนไลน์ (ตั้งค่า Firebase แล้ว) */
  enabled: boolean;
  /** true = ต่อกับเซิร์ฟเวอร์ได้และได้รับข้อมูลแล้ว */
  connected: boolean;
  /** จำนวนผู้เล่นจริงที่อยู่ในตารางอันดับตอนนี้ (รวมตัวเราเอง) */
  playerCount: number;
  /** ผู้เล่นคนอื่นในตารางอันดับ (ยังไม่ได้เรียงอันดับรวมกับเรา) */
  rivals: LeaderboardEntry[];
  /** คู่แข่งจริงที่ระบบจับคู่หยิบไปใช้ได้ */
  opponentPool: Opponent[];
  /** โปรไฟล์สาธารณะรายคน (uid → ข้อมูล) ใช้เปิดดูตัวจริง 11 คนของคนอื่น */
  profileByUid: Record<string, PublicProfile>;
}

const OnlineContext = createContext<OnlineContextValue>({
  enabled: false,
  connected: false,
  playerCount: 0,
  rivals: [],
  opponentPool: [],
  profileByUid: {},
});

export const OnlineProvider = ({ children }: { children: ReactNode }) => {
  const { account } = useAuth();
  const { team, rating, ratedSlots } = useTeam();

  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [connected, setConnected] = useState(false);

  const uid = account?.id ?? null;
  const record = account?.state.record;

  /* ── 1. ติดตามตารางอันดับของทั้งเซิร์ฟเวอร์ ───────────────── */
  useEffect(() => {
    if (!ONLINE || !uid) return undefined;

    const unsubscribe = watchTopProfiles(
      (next) => {
        setProfiles(next);
        setConnected(true);
      },
      () => setConnected(false),
    );

    return unsubscribe;
  }, [uid]);

  /* ── 2. ประกาศโปรไฟล์ของตัวเองเมื่อมีอะไรเปลี่ยน ─────────── */

  /** ลายเซ็นของค่าที่ประกาศไปแล้ว — เท่าเดิมก็ไม่ต้องเขียนซ้ำ */
  const published = useRef('');

  useEffect(() => {
    if (!ONLINE || !uid || !record) return undefined;

    // ตัวจริงที่จัดไว้ ณ ตอนนี้ — ช่องที่ยังว่างไม่ต้องส่ง
    const squad: PublicSquadSlot[] = ratedSlots
      .filter((entry) => entry.player !== null)
      .map((entry) => ({
        slotId: entry.slot.id,
        playerId: entry.player!.id,
        level: entry.level ?? 1,
      }));

    const update = {
      managerName: account?.managerName ?? 'ผู้จัดการ',
      teamName: team.name,
      teamOvr: rating.matchOvr,
      formationId: team.formationId,
      points: record.points,
      wins: record.wins,
      draws: record.draws,
      losses: record.losses,
      squad,
    };

    const signature = JSON.stringify(update);
    if (signature === published.current) return undefined;

    const timer = window.setTimeout(() => {
      published.current = signature;
      publishProfile(uid, update).catch((error) => {
        published.current = ''; // ล้มเหลว → ให้ลองใหม่รอบหน้า
        console.error('[firebase] ประกาศโปรไฟล์ไม่สำเร็จ', error);
      });
    }, PUBLISH_DELAY);

    return () => window.clearTimeout(timer);
  }, [
    account?.managerName,
    ratedSlots,
    record,
    rating.matchOvr,
    team.formationId,
    team.name,
    uid,
  ]);

  /* ── 3. แปลงข้อมูลคนอื่นให้พร้อมใช้ ───────────────────────── */

  const others = useMemo(
    () => profiles.filter((profile) => profile.uid !== uid),
    [profiles, uid],
  );

  const profileByUid = useMemo<Record<string, PublicProfile>>(
    () => Object.fromEntries(profiles.map((profile) => [profile.uid, profile])),
    [profiles],
  );

  const rivals = useMemo<LeaderboardEntry[]>(
    () =>
      others.map((profile) => ({
        rank: 0, // อันดับจริงคำนวณตอนรวมกับแถวของเราใน buildLeaderboard
        uid: profile.uid,
        managerName: profile.managerName,
        teamName: profile.teamName,
        teamOvr: profile.teamOvr,
        points: profile.points,
        wins: profile.wins,
        draws: profile.draws,
        losses: profile.losses,
      })),
    [others],
  );

  const opponentPool = useMemo<Opponent[]>(
    () =>
      others
        // ทีมที่ยังจัดตัวไม่เสร็จ (ค่าพลัง 0) ไม่ควรถูกจับมาเป็นคู่แข่ง
        .filter((profile) => profile.teamOvr > 0)
        .map((profile) => ({
          id: profile.uid,
          name: profile.teamName,
          manager: profile.managerName,
          ovr: profile.teamOvr,
          formationId: profile.formationId,
          difficulty: difficultyFromGap(profile.teamOvr - rating.matchOvr),
          rewardCoins: rewardForOpponent(profile.teamOvr, profile.teamOvr - rating.matchOvr),
          isBot: false,
        })),
    [others, rating.matchOvr],
  );

  const value = useMemo<OnlineContextValue>(
    () => ({
      enabled: ONLINE,
      connected: ONLINE && connected,
      playerCount: profiles.length,
      rivals,
      opponentPool,
      profileByUid,
    }),
    [connected, opponentPool, profileByUid, profiles.length, rivals],
  );

  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
};

export const useOnline = (): OnlineContextValue => useContext(OnlineContext);
