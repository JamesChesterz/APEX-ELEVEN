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
  useCallback,
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
  fetchProfile,
  fetchTopProfiles,
  type PublicProfile,
  type PublicSquadSlot,
} from '@/services/firebase/profiles';
import { difficultyFromGap, rewardForOpponent } from '@/services/matchmaking';
import type { LeaderboardEntry, Opponent } from '@/types/match';

/** หน่วงเวลาก่อนประกาศโปรไฟล์ (ms) — กันไม่ให้เขียนรัวตอนลากตัวผู้เล่นสลับตำแหน่ง */
const PUBLISH_DELAY = 15_000;

/** ดึงตารางอันดับใหม่ทุกกี่มิลลิวินาที */
const REFRESH_MS = 180_000;

/** ประกาศโปรไฟล์ล้มเหลวติดกันกี่ครั้งถึงจะหยุดลองใหม่ */
const MAX_PUBLISH_RETRIES = 3;

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
  /**
   * ดึงโปรไฟล์ของคนเดียวใหม่แบบสด ๆ แล้วอัปเดตข้อมูลในมือ
   * ใช้ตอนกดเปิดดูทีมของใครสักคน — ตารางอันดับดึงเป็นรอบ ข้อมูลจึงอาจเก่าไปนิด
   */
  refreshProfile: (uid: string) => Promise<void>;
  /**
   * true = ประกาศโปรไฟล์ขึ้นเซิร์ฟเวอร์ไม่สำเร็จติดกันหลายครั้ง
   * ผู้เล่นยังเล่นได้ปกติ แต่คนอื่นจะเห็นทีมชุดเก่าของเขา
   */
  publishFailed: boolean;
  /** สั่งประกาศโปรไฟล์ใหม่ทันที โดยไม่ต้องรอให้ค่าในทีมเปลี่ยน */
  retryPublish: () => void;
}

const OnlineContext = createContext<OnlineContextValue>({
  enabled: false,
  connected: false,
  playerCount: 0,
  rivals: [],
  opponentPool: [],
  profileByUid: {},
  refreshProfile: async () => undefined,
  publishFailed: false,
  retryPublish: () => undefined,
});

export const OnlineProvider = ({ children }: { children: ReactNode }) => {
  const { account } = useAuth();
  const { team, rating, ratedSlots } = useTeam();

  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [connected, setConnected] = useState(false);

  const uid = account?.id ?? null;
  const record = account?.state.record;

  /* ── 1. ดึงตารางอันดับของทั้งเซิร์ฟเวอร์เป็นรอบ ──────────── */

  /**
   * ดึงใหม่ทุก REFRESH_MS แทนการติดตามแบบเรียลไทม์
   *
   * เดิมใช้ onSnapshot ทั้ง collection ผลคือทุกครั้งที่ใครสักคนอัปเดตโปรไฟล์
   * Firestore ส่งเอกสารนั้นให้ทุกเครื่องที่เปิดอยู่ และนับเป็นค่าอ่านของทุกคน
   * ยิ่งคนเยอะยิ่งโตแบบกำลังสองจนโควตาหมดภายในวันเดียว
   *
   * ตารางอันดับไม่ต้องสดระดับวินาที ช้าไปไม่กี่นาทีไม่มีใครรู้สึก
   * แต่ประหยัดค่าอ่านได้เป็นสิบเท่า
   */
  useEffect(() => {
    if (!ONLINE || !uid) return undefined;

    let alive = true;

    const load = async () => {
      try {
        const next = await fetchTopProfiles();
        if (!alive) return;

        setProfiles(next);
        setConnected(true);
      } catch (error) {
        console.error('[firebase] ดึงตารางอันดับไม่สำเร็จ', error);
        if (alive) setConnected(false);
      }
    };

    void load();
    const timer = window.setInterval(load, REFRESH_MS);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [uid]);

  /* ── 2. ประกาศโปรไฟล์ของตัวเองเมื่อมีอะไรเปลี่ยน ─────────── */

  /** ลายเซ็นของค่าที่ประกาศไปแล้ว — เท่าเดิมก็ไม่ต้องเขียนซ้ำ */
  const published = useRef('');
  /** ประกาศล้มเหลวติดกันกี่ครั้งแล้ว ใช้หยุดการวนลองใหม่ */
  const failures = useRef(0);
  /** true = ยอมแพ้แล้ว ต้องขึ้นเตือนให้ผู้เล่นรู้ว่าข้อมูลทีมค้าง */
  const [publishFailed, setPublishFailed] = useState(false);
  /** เพิ่มค่านี้เพื่อบังคับให้ effect ประกาศใหม่ (ใช้กับปุ่ม "ลองใหม่") */
  const [retryToken, setRetryToken] = useState(0);

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
      // Firestore ไม่รับค่า undefined — บัญชีที่ยังไม่ตั้งรูปจึงส่งสตริงว่างไปแทน
      avatar: account?.state.avatar ?? '',
    };

    const signature = JSON.stringify(update);
    if (signature === published.current) return undefined;

    const timer = window.setTimeout(() => {
      published.current = signature;

      publishProfile(uid, update)
        .then(() => {
          failures.current = 0;
          setPublishFailed(false);
        })
        .catch((error) => {
          failures.current += 1;
          console.error('[firebase] ประกาศโปรไฟล์ไม่สำเร็จ', error);

          /*
           * ล้มเหลวเพราะกฎปฏิเสธ (หรือโควตาหมด) แล้วล้าง signature ทิ้งทุกครั้ง
           * จะกลายเป็นวนลองใหม่ไม่จบ — เผาโควตาฟรีทั้งวันโดยไม่มีอะไรสำเร็จเลย
           * จึงยอมแพ้หลังพลาดติดกันครบจำนวน แล้วรอให้ค่าเปลี่ยนจริงค่อยลองใหม่
           */
          if (failures.current < MAX_PUBLISH_RETRIES) {
            published.current = '';
            return;
          }

          // ยอมแพ้แล้ว — ขึ้นเตือนให้ผู้เล่นรู้ ไม่ปล่อยให้ข้อมูลค้างแบบเงียบ ๆ
          setPublishFailed(true);
        });
    }, PUBLISH_DELAY);

    return () => window.clearTimeout(timer);
  }, [
    account?.managerName,
    account?.state.avatar,
    ratedSlots,
    record,
    rating.matchOvr,
    team.formationId,
    team.name,
    uid,
    // กดปุ่ม "ลองใหม่" = ค่านี้เปลี่ยน effect จึงวิ่งใหม่ทั้งที่ทีมยังเหมือนเดิม
    retryToken,
  ]);

  /** สั่งประกาศใหม่ทันที — ล้างลายเซ็นเดิมเพื่อให้ effect ยอมเขียนซ้ำ */
  const retryPublish = useCallback(() => {
    published.current = '';
    failures.current = 0;
    setPublishFailed(false);
    setRetryToken((current) => current + 1);
  }, []);

  /* ── 3. แปลงข้อมูลคนอื่นให้พร้อมใช้ ───────────────────────── */

  const others = useMemo(
    () => profiles.filter((profile) => profile.uid !== uid),
    [profiles, uid],
  );

  const profileByUid = useMemo<Record<string, PublicProfile>>(
    () => Object.fromEntries(profiles.map((profile) => [profile.uid, profile])),
    [profiles],
  );

  /**
   * ดึงโปรไฟล์ใบเดียวใหม่แล้วยัดกลับเข้ารายการเดิม
   * ราคาแค่ 1 การอ่านต่อครั้ง เทียบกับการดึงทั้งตารางที่เป็นร้อยใบ
   */
  const refreshProfile = useCallback(async (target: string) => {
    if (!ONLINE || !target) return;

    try {
      const fresh = await fetchProfile(target);
      if (!fresh) return;

      setProfiles((current) => {
        const index = current.findIndex((profile) => profile.uid === target);
        if (index === -1) return [...current, fresh];

        // ของเดิมเท่ากันทุกอย่างก็ไม่ต้องสร้างอาร์เรย์ใหม่ให้ React วาดซ้ำเปล่า ๆ
        if (current[index].updatedAtMs === fresh.updatedAtMs) return current;

        const next = [...current];
        next[index] = fresh;
        return next;
      });
    } catch (error) {
      console.error('[firebase] ดึงโปรไฟล์ไม่สำเร็จ', error);
    }
  }, []);

  const rivals = useMemo<LeaderboardEntry[]>(
    () =>
      others.map((profile) => ({
        rank: 0, // อันดับจริงคำนวณตอนรวมกับแถวของเราใน buildLeaderboard
        uid: profile.uid,
        avatar: profile.avatar,
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
      refreshProfile,
      publishFailed,
      retryPublish,
    }),
    [
      connected,
      opponentPool,
      profileByUid,
      profiles.length,
      publishFailed,
      refreshProfile,
      retryPublish,
      rivals,
    ],
  );

  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
};

export const useOnline = (): OnlineContextValue => useContext(OnlineContext);
