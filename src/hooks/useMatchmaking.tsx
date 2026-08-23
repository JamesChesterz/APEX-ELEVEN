/**
 * สถานะระบบจับคู่แข่งขัน (แหล่งความจริงเดียวของทั้งแอป)
 *
 * ใช้ Context เพราะทั้งแผงขวาในหน้า MY TEAM, หน้า Match และตารางอันดับ
 * ต้องเห็นคิว/ผลการแข่ง/คะแนน ranking ชุดเดียวกัน
 *
 * การแข่งเป็นการ "ถ่ายทอดสด" ผลที่สุ่มไว้แล้ว:
 * simulateMatch ตัดสินสกอร์และไทม์ไลน์ประตูตั้งแต่วินาทีแรก
 * จากนั้นนาฬิกาในเกมเดินจากนาที 0 ถึง 90 แล้วค่อยเปิดเผยประตูทีละลูกตามนาทีของมัน
 * จึงไม่มีทางที่ไทม์ไลน์กับผลสุดท้ายจะไม่ตรงกัน และผู้เล่นกดข้ามได้ตลอด
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
import { OPPONENTS } from '@/data/opponents';
import { useAuth } from '@/hooks/useAuth';
import { useOnline } from '@/hooks/useOnline';
import { usePlayers } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import { ONLINE } from '@/services/accountStore';
import {
  clearMatchReports,
  sendMatchReport,
  watchMatchInbox,
  type MatchReportDoc,
} from '@/services/firebase/matchInbox';
import {
  buildDefenseResult,
  findOpponent,
  getMatchOdds,
  MATCH_MINUTES,
  simulateMatch,
} from '@/services/matchmaking';
import { getRankTier } from '@/services/rank';
import { playSfx } from '@/services/sound';
import type {
  LiveMatch,
  MatchResult,
  MatchState,
  Opponent,
  RankRecord,
} from '@/types/match';
import { POSITION_GROUP } from '@/utils/helpers';

/** คะแนน ranking ตั้งต้นของบัญชีใหม่ — เริ่มจากศูนย์ แล้วไต่ขึ้นเอง */
const EMPTY_RECORD: RankRecord = { points: 0, wins: 0, draws: 0, losses: 0 };

/** เวลาหาคู่ (ms) — สุ่มในช่วงนี้เพื่อให้รู้สึกเหมือนคิวจริง */
const SEARCH_MS = { min: 1400, max: 2600 };

/** เวลาจริงต่อ 1 นาทีในเกม (ms) — 90 นาทีจึงใช้เวลาราว 12 วินาที */
const TICK_MS = 130;

const INITIAL_STATE: MatchState = { status: 'idle', opponent: null, result: null, odds: null };
const KICKOFF_LIVE: LiveMatch = { minute: 0, teamScore: 0, opponentScore: 0, events: [] };

interface MatchmakingContextValue {
  state: MatchState;
  /** ทีมคู่แข่งประจำระบบ (ใช้ในหน้า Match ให้เลือกท้าเอง) */
  opponents: Opponent[];
  /** สถิติสะสมของผู้เล่น */
  record: RankRecord;
  /** ผลการแข่งย้อนหลังทุกโหมด ใหม่สุดอยู่บน (เก็บลงบัญชี ไม่หายเมื่อรีเฟรช) */
  history: MatchResult[];
  /** สถานะถ่ายทอดสด (null เมื่อยังไม่ได้เริ่มแข่ง) */
  live: LiveMatch | null;
  /** วินาทีที่ใช้ค้นหาไปแล้ว ใช้โชว์นาฬิกาในคิว */
  elapsed: number;
  /** true เมื่อจัดตัวไม่ครบ 11 คน — ลงแข่งไม่ได้ */
  squadIncomplete: boolean;
  /** เริ่มหาคู่แข่ง (ไม่มีผู้เล่นจริงในคิว → เจอบอท) */
  search: () => void;
  /** ท้าทีมที่เลือกเองจากรายชื่อ ข้ามขั้นตอนหาคู่ */
  challenge: (opponentId: string) => void;
  /** เริ่มแข่งกับคู่ที่จับได้ */
  kickoff: () => void;
  /** ข้ามการถ่ายทอดสด ไปดูผลเลย */
  skip: () => void;
  /** ยกเลิกคิว หรือปิดหน้าจอผลการแข่ง */
  cancel: () => void;
  /** เริ่มซีซันใหม่: เขียนสถิติชุดใหม่ทับ (ใช้โดยระบบซีซัน) */
  applyRecord: (next: RankRecord) => void;
  /** นัดที่เพิ่งถูกผู้เล่นคนอื่นท้าขณะเราไม่อยู่ — ใช้ขึ้นแจ้งเตือน (ว่าง = ไม่มีของใหม่) */
  defenseNotices: MatchResult[];
  /** ปิดแจ้งเตือนนัดที่โดนท้า */
  clearDefenseNotices: () => void;
}

const MatchmakingContext = createContext<MatchmakingContextValue | null>(null);

export const MatchmakingProvider = ({ children }: { children: ReactNode }) => {
  const { rating, ratedSlots } = useTeam();
  const { addCoins, reportMatch } = usePlayers();
  const { account, patchState, appendMatches } = useAuth();
  /** คู่แข่งที่เป็นผู้เล่นจริงจากเซิร์ฟเวอร์ (ว่างเมื่อเล่นออฟไลน์) */
  const { opponentPool } = useOnline();

  const [state, setState] = useState<MatchState>(INITIAL_STATE);
  const [record, setRecord] = useState<RankRecord>(() => account?.state.record ?? EMPTY_RECORD);
  const [live, setLive] = useState<LiveMatch | null>(null);
  const [elapsed, setElapsed] = useState(0);
  /** ผลนัดที่โดนท้าและเพิ่งบันทึกเข้าสถิติ รอขึ้นแจ้งเตือนให้ผู้เล่นเห็น */
  const [defenseNotices, setDefenseNotices] = useState<MatchResult[]>([]);

  /** สถิติล่าสุด เก็บไว้ให้ตัว timer อ่านได้โดยไม่ต้องผูก record เข้า deps */
  const recordRef = useRef(record);
  recordRef.current = record;

  /** timer ที่ค้างอยู่ เก็บไว้เพื่อเคลียร์ตอนยกเลิกหรือ unmount */
  const timer = useRef<number | null>(null);
  /** นาฬิกาในเกมระหว่างถ่ายทอดสด */
  const clock = useRef<number | null>(null);
  /** ผลที่สุ่มไว้แล้วของแมตช์ที่กำลังเล่นอยู่ (ใช้ตอนกดข้าม) */
  const pending = useRef<MatchResult | null>(null);
  /** นาทีในเกมปัจจุบัน — เก็บใน ref เพื่อคำนวณนอก updater ของ setState */
  const minute = useRef(0);

  const stopTimers = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (clock.current !== null) window.clearInterval(clock.current);
    timer.current = null;
    clock.current = null;
  }, []);

  useEffect(() => stopTimers, [stopTimers]);

  // เซฟสถิติซีซันลงบัญชีทุกครั้งที่ผลการแข่งเปลี่ยน
  useEffect(() => {
    patchState({ record });
  }, [patchState, record]);

  const squadIncomplete = rating.emptySlots > 0;

  /* ── ฝั่งตั้งรับ: รับผลนัดที่คนอื่นมาท้าตอนเราไม่อยู่ ───────── */

  /** ใบที่บันทึกไปแล้วในเซสชันนี้ — กันบันทึกซ้ำระหว่างรอ Firestore ลบใบทิ้งจริง */
  const applied = useRef(new Set<string>());

  /**
   * ด่านที่สอง: ไอดีนัดที่อยู่ในประวัติแล้ว
   * ถ้าลบใบไม่สำเร็จหรือเปิดเกมใหม่ก่อนลบทัน ใบเดิมจะถูกส่งมาอีกรอบ — ด่านนี้กันไม่ให้นับซ้ำ
   */
  const historyIds = useRef(new Set<string>());
  historyIds.current = new Set((account?.state.matchHistory ?? []).map((match) => match.id));

  useEffect(() => {
    const uid = account?.id;
    if (!ONLINE || !uid) return undefined;

    return watchMatchInbox(uid, (reports: MatchReportDoc[]) => {
      const fresh = reports.filter(
        (report) => !applied.current.has(report.id) && !historyIds.current.has(report.id),
      );
      if (fresh.length === 0) return;

      fresh.forEach((report) => applied.current.add(report.id));
      const results = fresh.map((report) => buildDefenseResult(report));

      // บันทึกลงประวัติ + แจกเหรียญ (คิดที่ฝั่งเราเอง ไม่เชื่อตัวเลขรางวัลจากผู้ส่ง)
      appendMatches(results);
      const coins = results.reduce((sum, result) => sum + result.coinsEarned, 0);
      if (coins > 0) addCoins(coins);

      // รวมคะแนนทุกใบทีเดียว แล้วค่อยเขียนสถิติครั้งเดียว
      const current = recordRef.current;
      const delta = results.reduce((sum, result) => sum + result.rankingPoints, 0);

      setRecord({
        points: Math.max(0, current.points + delta),
        wins: current.wins + results.filter((result) => result.outcome === 'win').length,
        draws: current.draws + results.filter((result) => result.outcome === 'draw').length,
        losses: current.losses + results.filter((result) => result.outcome === 'loss').length,
      });

      setDefenseNotices((notices) => [...results, ...notices].slice(0, 5));
      playSfx(results.some((result) => result.outcome === 'win') ? 'whistle' : 'click');

      // เก็บกวาดกล่องให้ว่าง ครั้งหน้าเปิดเกมจะได้ไม่เจอใบเดิม
      clearMatchReports(uid, fresh.map((report) => report.id)).catch((error) =>
        console.error('[firebase] ลบใบรายงานไม่สำเร็จ', error),
      );
    });
  }, [account?.id, addCoins, appendMatches]);

  const clearDefenseNotices = useCallback(() => setDefenseNotices([]), []);

  /** นับเวลาตอนอยู่ในคิว */
  useEffect(() => {
    if (state.status !== 'searching') {
      setElapsed(0);
      return undefined;
    }
    const id = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  /**
   * รายชื่อคนที่มีสิทธิ์ยิงประตู เรียงจากกองหน้าไปกองหลัง
   * ใส่ชื่อกองหน้าซ้ำหลายรอบ เพื่อให้สุ่มแล้วกองหน้ายิงบ่อยกว่ากองหลังตามจริง
   */
  const scorerPool = useMemo(() => {
    const weight = { attack: 4, midfield: 2, defence: 1, gk: 0 } as const;

    return ratedSlots.flatMap(({ slot, player }) => {
      if (!player) return [];
      const times = weight[POSITION_GROUP[slot.position]];
      return Array.from({ length: times }, () => player.name);
    });
  }, [ratedSlots]);

  /** ตั้งคู่แข่งพร้อมคำนวณโอกาสชนะให้เลย */
  const setOpponent = useCallback(
    (opponent: Opponent) => {
      setState({
        status: 'found',
        opponent,
        result: null,
        odds: getMatchOdds(rating.matchOvr, opponent.ovr),
      });
      setLive(null);
    },
    [rating.matchOvr],
  );

  const search = useCallback(() => {
    if (squadIncomplete || state.status === 'searching' || state.status === 'playing') return;

    stopTimers();
    setLive(null);
    setState({ status: 'searching', opponent: null, result: null, odds: null });

    // หน่วงเวลาให้เหมือนกำลังหาผู้เล่นจริง ก่อนจับคู่กับบอท
    const wait = SEARCH_MS.min + Math.random() * (SEARCH_MS.max - SEARCH_MS.min);
    timer.current = window.setTimeout(
      () => setOpponent(findOpponent(rating.matchOvr, opponentPool)),
      wait,
    );
  }, [opponentPool, rating.matchOvr, setOpponent, squadIncomplete, state.status, stopTimers]);

  const challenge = useCallback(
    (opponentId: string) => {
      if (squadIncomplete) return;
      const opponent =
        opponentPool.find((entry) => entry.id === opponentId) ??
        OPPONENTS.find((entry) => entry.id === opponentId);
      if (!opponent) return;

      stopTimers();
      setOpponent(opponent);
    },
    [opponentPool, setOpponent, squadIncomplete, stopTimers],
  );

  /** ปิดเกม: บันทึกผล แจกเหรียญ อัปเดตสถิติ แล้วเล่นเสียงนกหวีดจบ */
  const finish = useCallback(
    (result: MatchResult) => {
      stopTimers();
      pending.current = null;

      setLive({
        minute: MATCH_MINUTES,
        teamScore: result.teamScore,
        opponentScore: result.opponentScore,
        events: [...result.events].reverse(),
      });
      setState((current) => ({ ...current, status: 'finished', result }));
      appendMatches([{ ...result, mode: 'friendly' }]);
      addCoins(result.coinsEarned);

      // คู่แข่งเป็นผู้เล่นจริง → ส่งผลไปเข้ากล่องของเขาด้วย
      // (สกอร์กลับด้านให้เรียบร้อย เพราะฝั่งนั้นมองจากมุมตัวเอง)
      const opponent = state.opponent;
      const uid = account?.id;

      if (ONLINE && uid && opponent && opponent.isBot === false) {
        sendMatchReport(opponent.id, {
          id: result.id,
          fromUid: uid,
          fromTeamName: account?.teamName ?? 'Unknown FC',
          fromManagerName: account?.managerName ?? 'ผู้จัดการ',
          fromTeamOvr: result.teamOvr,
          toTeamOvr: result.opponentOvr,
          teamScore: result.opponentScore,
          opponentScore: result.teamScore,
          events: result.events.map((event) => ({
            ...event,
            side: event.side === 'team' ? 'opponent' : 'team',
          })),
          playedAt: result.playedAt,
        }).catch((error) => console.error('[firebase] ส่งผลการแข่งไม่สำเร็จ', error));
      }

      // ชนะ Matchmaking ได้แต้มตีบวกนัดละ 20 (สูงสุด 30 นัดต่อวัน) และนับเข้าภารกิจด้วย
      reportMatch({
        outcome: result.outcome,
        teamOvr: result.teamOvr,
        opponentOvr: result.opponentOvr,
        mode: 'friendly',
      });

      // อ่านสถิติล่าสุดจาก ref แล้วคิดให้เสร็จก่อน setState
      // จะได้เล่นเสียงนอก updater ได้อย่างปลอดภัย (StrictMode เรียก updater ซ้ำ)
      const current = recordRef.current;
      // คะแนนรวมไม่ให้ติดลบ แม้จะแพ้ติดกันหลายนัด
      const points = Math.max(0, current.points + result.rankingPoints);

      setRecord({
        points,
        wins: current.wins + (result.outcome === 'win' ? 1 : 0),
        draws: current.draws + (result.outcome === 'draw' ? 1 : 0),
        losses: current.losses + (result.outcome === 'loss' ? 1 : 0),
      });

      playSfx('whistle');

      // ข้ามขั้น rank แล้วเล่นเสียงฉลองให้รู้ทันที
      if (points > current.points && getRankTier(points).id !== getRankTier(current.points).id) {
        playSfx('rankUp');
      }
    },
    [account, addCoins, appendMatches, reportMatch, state.opponent, stopTimers],
  );

  const kickoff = useCallback(() => {
    const opponent = state.opponent;
    if (!opponent || state.status !== 'found') return;

    // สุ่มผลและไทม์ไลน์ทั้งหมดตั้งแต่ตอนนี้ แล้วค่อยเปิดเผยทีละนาที
    const result = simulateMatch(rating.matchOvr, opponent, scorerPool);

    stopTimers();
    pending.current = result;
    minute.current = 0;
    setLive(KICKOFF_LIVE);
    setState((current) => ({ ...current, status: 'playing' }));
    playSfx('whistle');

    clock.current = window.setInterval(() => {
      minute.current += 1;
      const now = minute.current;

      // คำนวณประตูของนาทีนี้ไว้ก่อน แล้วค่อยส่งเข้า setState (updater ต้องไม่มี side effect)
      const scored = result.events.filter((event) => event.minute === now);
      scored.forEach((event) => playSfx(event.side === 'team' ? 'goal' : 'concede'));

      setLive((current) =>
        current
          ? {
              minute: now,
              teamScore:
                current.teamScore + scored.filter((event) => event.side === 'team').length,
              opponentScore:
                current.opponentScore +
                scored.filter((event) => event.side === 'opponent').length,
              events: [...[...scored].reverse(), ...current.events],
            }
          : current,
      );

      if (now >= MATCH_MINUTES) finish(result);
    }, TICK_MS);
  }, [finish, rating.matchOvr, scorerPool, state.opponent, state.status, stopTimers]);

  /** กดข้าม: จบเกมทันทีด้วยผลเดิมที่สุ่มไว้แล้ว */
  const skip = useCallback(() => {
    if (state.status !== 'playing' || !pending.current) return;
    finish(pending.current);
  }, [finish, state.status]);

  const cancel = useCallback(() => {
    stopTimers();
    pending.current = null;
    setLive(null);
    setState(INITIAL_STATE);
  }, [stopTimers]);

  /** ใช้โดยระบบซีซันตอนรีเซ็ตคะแนนขึ้นซีซันใหม่ */
  const applyRecord = useCallback((next: RankRecord) => {
    setRecord(next);
  }, []);

  /** ประวัติอ่านจากบัญชีโดยตรง จึงเห็นทั้งนัดกระชับมิตรและนัดในลีกชุดเดียวกัน */
  const history = account?.state.matchHistory ?? [];

  const value = useMemo<MatchmakingContextValue>(
    () => ({
      state,
      opponents: OPPONENTS,
      record,
      history,
      live,
      elapsed,
      squadIncomplete,
      search,
      challenge,
      kickoff,
      skip,
      cancel,
      applyRecord,
      defenseNotices,
      clearDefenseNotices,
    }),
    [
      applyRecord,
      cancel,
      challenge,
      clearDefenseNotices,
      defenseNotices,
      elapsed,
      history,
      kickoff,
      live,
      record,
      search,
      skip,
      squadIncomplete,
      state,
    ],
  );

  return <MatchmakingContext.Provider value={value}>{children}</MatchmakingContext.Provider>;
};

export const useMatchmaking = (): MatchmakingContextValue => {
  const context = useContext(MatchmakingContext);
  if (!context) throw new Error('useMatchmaking ต้องถูกใช้ภายใน <MatchmakingProvider>');
  return context;
};
