/**
 * สถานะบัญชีผู้เล่น: สมัคร / เข้าสู่ระบบ / ออกจากระบบ / เซฟความคืบหน้า
 *
 * Provider นี้อยู่นอกสุดของแอป เพราะ Provider อื่น (คลังการ์ด, ทีม, การแข่ง)
 * ต้องอ่านค่าเริ่มต้นจากบัญชีที่ล็อกอินอยู่ และเขียนความคืบหน้ากลับผ่าน patchState
 *
 * โหมดออนไลน์ (ตั้งค่า Firebase แล้ว): register/login เป็น async เพราะต้องรอเซิร์ฟเวอร์
 * และตอนเปิดแอปจะมีช่วง "กำลังตรวจสอบการล็อกอิน" สั้น ๆ ก่อนรู้ว่าล็อกอินค้างอยู่ไหม
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
import {
  flushAccount,
  loginAccount,
  ONLINE,
  registerAccount,
  rememberSession,
  saveAccount,
  signOutAccount,
  watchSession,
} from '@/services/accountStore';
import { HISTORY_LIMIT } from '@/services/league';
import { playSfx } from '@/services/sound';
import type { Account, AccountState, LeagueState } from '@/types/account';
import type { MatchResult } from '@/types/match';

interface AuthContextValue {
  /** บัญชีที่ล็อกอินอยู่ — null = ยังไม่ได้เข้าสู่ระบบ */
  account: Account | null;
  /** true = ยังตรวจสอบสถานะล็อกอินไม่เสร็จ (โหมดออนไลน์ต้องรอเซิร์ฟเวอร์ตอบ) */
  booting: boolean;
  /** true = กำลังสมัคร/เข้าสู่ระบบอยู่ ใช้ปิดปุ่มกันกดซ้ำ */
  pending: boolean;
  /** true = เล่นแบบออนไลน์ (บัญชีและเซฟอยู่บนคลาวด์) */
  online: boolean;
  /** ข้อความผิดพลาดล่าสุดจากการสมัคร/เข้าสู่ระบบ */
  error: string | null;
  register: (username: string, password: string, teamName: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  /** อัปเดตความคืบหน้าบางส่วนแล้วเซฟทันที (ลงเครื่อง + ขึ้นคลาวด์แบบหน่วงเวลา) */
  patchState: (patch: Partial<AccountState>) => void;
  /** แก้เฉพาะบางฟิลด์ของสถานะลีก โดยไม่ทับค่าที่ตัวอื่นเพิ่งเขียนไป */
  patchLeague: (patch: Partial<LeagueState>) => void;
  /** เพิ่มผลการแข่งเข้าประวัติ (ใหม่สุดอยู่บน ตัดให้เหลือตามเพดาน) */
  appendMatches: (matches: MatchResult[]) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [booting, setBooting] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * เก็บบัญชีล่าสุดไว้ใน ref ด้วย เพื่อให้ patchState เป็นฟังก์ชันที่ identity ไม่เปลี่ยน
   * ถ้าไม่ทำแบบนี้ Provider ลูกจะ re-run effect ทุกครั้งที่เหรียญขยับ
   */
  const latest = useRef(account);
  latest.current = account;

  /**
   * ตอนเปิดแอป: ถามว่ามีการล็อกอินค้างอยู่ไหม
   * ออนไลน์ = ถาม Firebase (async) · ออฟไลน์ = อ่าน localStorage (ทันที)
   *
   * ระวัง: callback นี้ถูกเรียกซ้ำได้ทุกครั้งที่สถานะล็อกอินเปลี่ยน จึงข้ามการเขียนทับ
   * เมื่อได้บัญชีเดิมที่ถืออยู่แล้ว ไม่งั้นความคืบหน้าที่เพิ่งเล่นจะถูกเซฟเก่าทับ
   */
  useEffect(() => {
    const unsubscribe = watchSession((next) => {
      setBooting(false);
      if (next && latest.current?.id === next.id) return;
      setAccount(next);
    });

    return unsubscribe;
  }, []);

  /** ปิดแท็บ/สลับแอปเมื่อไหร่ ให้ยิงเซฟที่ค้างอยู่ขึ้นคลาวด์ก่อน */
  useEffect(() => {
    const flush = () => void flushAccount();
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);

    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  const patchState = useCallback((patch: Partial<AccountState>) => {
    const current = latest.current;
    if (!current) return;

    const next: Account = { ...current, state: { ...current.state, ...patch } };
    latest.current = next;
    setAccount(next);
    saveAccount(next);
  }, []);

  /**
   * ทั้งสองฟังก์ชันนี้อ่านค่าล่าสุดจาก latest.current เสมอ
   * เพราะลีกกับหน้าจัดทีมเขียนลง state ก้อนเดียวกัน ถ้าอ่านจาก closure จะทับกันเอง
   */
  const patchLeague = useCallback(
    (patch: Partial<LeagueState>) => {
      const league = latest.current?.state.league;
      if (!league) return;
      patchState({ league: { ...league, ...patch } });
    },
    [patchState],
  );

  const appendMatches = useCallback(
    (matches: MatchResult[]) => {
      if (matches.length === 0) return;
      const history = latest.current?.state.matchHistory ?? [];
      patchState({ matchHistory: [...matches, ...history].slice(0, HISTORY_LIMIT) });
    },
    [patchState],
  );

  const register = useCallback(
    async (username: string, password: string, teamName: string) => {
      setPending(true);
      const result = await registerAccount(username, password, teamName);
      setPending(false);

      if (!result.account) {
        setError(result.error);
        playSfx('error');
        return false;
      }

      setError(null);
      latest.current = result.account;
      setAccount(result.account);
      rememberSession(result.account.id);
      playSfx('login');
      return true;
    },
    [],
  );

  const login = useCallback(async (username: string, password: string) => {
    setPending(true);
    const result = await loginAccount(username, password);
    setPending(false);

    if (!result.account) {
      setError(result.error);
      playSfx('error');
      return false;
    }

    setError(null);
    latest.current = result.account;
    setAccount(result.account);
    rememberSession(result.account.id);
    playSfx('login');
    return true;
  }, []);

  const logout = useCallback(() => {
    // เซฟครั้งสุดท้ายก่อนออก เผื่อมีอะไรค้างอยู่ แล้วค่อยตัด session ฝั่งเซิร์ฟเวอร์
    const current = latest.current;
    if (current) saveAccount(current);

    void flushAccount().then(() => signOutAccount());

    latest.current = null;
    setAccount(null);
    playSfx('click');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      booting,
      pending,
      online: ONLINE,
      error,
      register,
      login,
      logout,
      patchState,
      patchLeague,
      appendMatches,
      clearError: () => setError(null),
    }),
    [account, appendMatches, booting, error, login, logout, patchLeague, patchState, pending, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth ต้องถูกใช้ภายใน <AuthProvider>');
  return context;
};

/** ใช้ในหน้าที่แน่ใจว่าล็อกอินแล้ว (อยู่ใต้ MainLayout) — ตัด null ออกให้ TypeScript */
export const useAccount = (): Account => {
  const { account } = useAuth();
  if (!account) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  return account;
};
