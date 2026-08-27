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
  callPlayMatch,
  serverErrorMessage,
  SERVER_AUTHORITY,
} from '@/services/firebase/gameServer';
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
  type MatchActor,
} from '@/services/matchmaking';
import { resolveOpponentSquad } from '@/services/opponentSquad';
import { getRankTier } from '@/services/rank';
import {
  cooldownLeft,
  filterAvailable,
  formatCooldown,
  isOnCooldown,
  rememberRival,
} from '@/services/rivals';
import { playSfx } from '@/services/sound';
import type { RecentRival } from '@/types/account';
import type {
  LiveMatch,
  MatchResult,
  MatchState,
  Opponent,
  RankRecord,
} from '@/types/match';
import { buildScorerPool, SCORER_WEIGHT } from '@/services/scorers';
import { POSITION_GROUP } from '@/utils/helpers';

/** คะแนน ranking ตั้งต้นของบัญชีใหม่ — เริ่มจากศูนย์ แล้วไต่ขึ้นเอง */
const EMPTY_RECORD: RankRecord = { points: 0, wins: 0, draws: 0, losses: 0 };

/** เวลาหาคู่ (ms) — สุ่มในช่วงนี้เพื่อให้รู้สึกเหมือนคิวจริง */
const SEARCH_MS = { min: 1400, max: 2600 };

/**
 * โชว์หน้า VS นานเท่าไหร่ก่อนเริ่มแข่งเอง (มิลลิวินาที)
 *
 * เจอคู่แล้วต้องแข่งเสมอ ยกเลิกไม่ได้ — ไม่งั้นจะกลายเป็นกดหาคู่รัว ๆ
 * แล้วยกเลิกทิ้งจนกว่าจะเจอทีมที่อ่อนกว่า ซึ่งเท่ากับปั้มดาวฟรี
 * ช่วงนี้มีไว้ให้ดูว่าเจอใครเท่านั้น กดปุ่มเพื่อเริ่มทันทีก็ได้
 */
const VS_MS = 2200;

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
  /** เริ่มหาคู่แข่ง — โหมดออนไลน์เจอผู้เล่นจริงเท่านั้น (ไม่มีบอท) */
  search: () => void;
  /** ท้าทีมที่เลือกเองจากรายชื่อ ข้ามขั้นตอนหาคู่ */
  challenge: (opponentId: string) => void;
  /** เริ่มแข่งกับคู่ที่จับได้ (โหมดเซิร์ฟเวอร์จะรอผลจากฟังก์ชันก่อน) */
  kickoff: () => Promise<void>;
  /** ยกเลิกคิว หรือปิดหน้าจอผลการแข่ง */
  cancel: () => void;
  /** เริ่มซีซันใหม่: เขียนสถิติชุดใหม่ทับ (ใช้โดยระบบซีซัน) */
  applyRecord: (next: RankRecord) => void;
  /** นัดที่เพิ่งถูกผู้เล่นคนอื่นท้าขณะเราไม่อยู่ — ใช้ขึ้นแจ้งเตือน (ว่าง = ไม่มีของใหม่) */
  defenseNotices: MatchResult[];
  /** ปิดแจ้งเตือนนัดที่โดนท้า */
  clearDefenseNotices: () => void;
  /** เหตุผลที่หาคู่ไม่ได้ (มีค่าเฉพาะตอน status = 'empty') */
  emptyReason: string | null;
  /**
   * นักเตะของเราที่เพิ่งบาดเจ็บระหว่างถ่ายทอดสด รอให้เลือกตัวสำรองมาเปลี่ยนตัว
   * นาฬิกาแมตช์หยุดรออยู่จนกว่าจะเลือกเสร็จ (null = ไม่มีใครบาดเจ็บอยู่)
   */
  pendingInjury: { slotId: string; cardId: string; playerName: string } | null;
  /** เลือกตัวสำรองมาเปลี่ยนคนที่บาดเจ็บ แล้วนาฬิกาจะเดินต่อทันที */
  resolveInjury: (replacementCardId: string) => void;
  /** รหัสการ์ดฝั่งเราที่โดนใบแดงไล่ออกในแมตช์นี้ (เคลียร์เมื่อเริ่มนัดใหม่) — ใช้ทำสนามให้เห็นว่าเหลือ 10 คน */
  sentOffCardIds: Set<string>;
  /** true = มีนักเตะติดโทษแบนอยู่ในตัวจริงตอนนี้ ต้องเปลี่ยนตัวที่ MY TEAM ก่อนจึงลงแข่งได้ */
  squadHasSuspended: boolean;
}

const MatchmakingContext = createContext<MatchmakingContextValue | null>(null);

export const MatchmakingProvider = ({ children }: { children: ReactNode }) => {
  const { rating, ratedSlots, team, assignCard, suspendedCardIds } = useTeam();
  const { addCoins, reportMatch } = usePlayers();
  const { account, patchState, appendMatches } = useAuth();
  /** คู่แข่งที่เป็นผู้เล่นจริงจากเซิร์ฟเวอร์ (ว่างเมื่อเล่นออฟไลน์) */
  const { opponentPool, profileByUid } = useOnline();

  const [state, setState] = useState<MatchState>(INITIAL_STATE);
  const [record, setRecord] = useState<RankRecord>(() => account?.state.record ?? EMPTY_RECORD);
  const [live, setLive] = useState<LiveMatch | null>(null);
  const [elapsed, setElapsed] = useState(0);
  /** ผลนัดที่โดนท้าและเพิ่งบันทึกเข้าสถิติ รอขึ้นแจ้งเตือนให้ผู้เล่นเห็น */
  const [defenseNotices, setDefenseNotices] = useState<MatchResult[]>([]);
  /** เหตุผลที่หาคู่ไม่ได้ (โชว์บนแผงตอน status = 'empty') */
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  /** นักเตะของเราที่กำลังบาดเจ็บรอเปลี่ยนตัว (นาฬิกาแมตช์หยุดรออยู่) */
  const [pendingInjury, setPendingInjury] = useState<{
    slotId: string;
    cardId: string;
    playerName: string;
  } | null>(null);
  /** รหัสการ์ดฝั่งเราที่โดนใบแดงไล่ออกในนัดที่กำลังแข่งอยู่ */
  const [sentOffCardIds, setSentOffCardIds] = useState<Set<string>>(new Set());

  /** true = มีนักเตะติดโทษแบนอยู่ใน 11 ตัวจริงตอนนี้ ลงแข่งไม่ได้จนกว่าจะเปลี่ยนตัว */
  const squadHasSuspended = useMemo(
    () => team.squad.some((slot) => slot.cardId && suspendedCardIds.has(slot.cardId)),
    [suspendedCardIds, team.squad],
  );

  /** คูลดาวน์ล่าสุด — finish อ่านจาก ref เพื่อไม่ให้ identity ของมันเปลี่ยนทุกนัด */
  const latestRivals = useRef<RecentRival[]>([]);

  /** คู่แข่งที่เพิ่งเจอไป — ยังท้าซ้ำไม่ได้จนกว่าจะพ้นคูลดาวน์ */
  const recentRivals = useMemo(
    () => account?.state.recentRivals ?? [],
    [account?.state.recentRivals],
  );
  latestRivals.current = recentRivals;

  /**
   * คู่แข่งที่ท้าได้ตอนนี้จริง ๆ
   * ออนไลน์ = ผู้เล่นจริงที่ยังไม่ติดคูลดาวน์ · ออฟไลน์ = ทีมประจำระบบ
   */
  const availableRivals = useMemo(
    () => (ONLINE ? filterAvailable(opponentPool, recentRivals) : OPPONENTS),
    [opponentPool, recentRivals],
  );

  /** สถิติล่าสุด เก็บไว้ให้ตัว timer อ่านได้โดยไม่ต้องผูก record เข้า deps */
  const recordRef = useRef(record);
  recordRef.current = record;


  /** timer ที่ค้างอยู่ เก็บไว้เพื่อเคลียร์ตอนยกเลิกหรือ unmount */
  const timer = useRef<number | null>(null);
  /** นาฬิกาในเกมระหว่างถ่ายทอดสด */
  const clock = useRef<number | null>(null);
  /** ผลที่สุ่มไว้แล้วของแมตช์ที่กำลังเล่นอยู่ (ใช้ตอนกดข้าม) */
  const pending = useRef<MatchResult | null>(null);
  /**
   * สถิติชุดใหม่ที่เซิร์ฟเวอร์คิดมาให้แล้ว (null = แมตช์นี้คิดผลในเครื่อง)
   * มีค่าเมื่อไหร่แปลว่าดาวถูกบวกที่เซิร์ฟเวอร์ไปแล้ว ฝั่งนี้แค่เอามาแสดง
   */
  const serverRecord = useRef<RankRecord | null>(null);
  /** นาทีในเกมปัจจุบัน — เก็บใน ref เพื่อคำนวณนอก updater ของ setState */
  const minute = useRef(0);
  /**
   * สถานะโทษแบนล่าสุด (cardId → นัดที่เหลือ) — ต้นทางเดียวระหว่างแมตช์กำลังเล่นอยู่
   * ใช้ ref แทนอ่านจาก account.state ตรง ๆ เพราะใบแดงหลายใบอาจเกิดขึ้นเร็วกว่า React จะ re-render ทัน
   */
  const suspensionsRef = useRef<Record<string, number>>({});

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

  /**
   * โหมดเซิร์ฟเวอร์: ดาวเป็นของเซิร์ฟเวอร์ฝ่ายเดียว
   * ดึงค่าจริงจากโปรไฟล์ของตัวเองมาแสดงเสมอ ฝั่งนี้ไม่บวกเอง
   * ครอบคลุมทุกทางที่ดาวขยับ — ลงแข่งเอง โดนท้าตอนไม่อยู่ ลีกเดินรอบ หรือแอดมินรีเซ็ต
   */
  const myProfile = account?.id ? profileByUid[account.id] : undefined;
  useEffect(() => {
    if (!SERVER_AUTHORITY || !myProfile) return;

    setRecord((current) =>
      current.points === myProfile.points &&
      current.wins === myProfile.wins &&
      current.draws === myProfile.draws &&
      current.losses === myProfile.losses
        ? current
        : {
            points: myProfile.points,
            wins: myProfile.wins,
            draws: myProfile.draws,
            losses: myProfile.losses,
          },
    );
  }, [myProfile]);

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

      /*
       * โหมดเซิร์ฟเวอร์: ดาวของนัดที่โดนท้าถูกบวกให้ตั้งแต่ตอนที่อีกฝ่ายกดแข่งแล้ว
       * (ฟังก์ชัน playMatch อัปเดตสถิติของทั้งสองฝ่ายพร้อมกัน)
       * ใบในกล่องจึงเหลือหน้าที่แค่ "บอกให้รู้" ไม่ต้องบวกซ้ำ
       */
      if (!SERVER_AUTHORITY) {
        // รวมคะแนนทุกใบทีเดียว แล้วค่อยเขียนสถิติครั้งเดียว
        const current = recordRef.current;
        const delta = results.reduce((sum, result) => sum + result.rankingPoints, 0);

        setRecord({
          points: Math.max(0, current.points + delta),
          wins: current.wins + results.filter((result) => result.outcome === 'win').length,
          draws: current.draws + results.filter((result) => result.outcome === 'draw').length,
          losses: current.losses + results.filter((result) => result.outcome === 'loss').length,
        });
      }

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
  const scorerPool = useMemo(
    () =>
      ratedSlots.flatMap(({ slot, player }) => {
        if (!player) return [];
        return Array.from({ length: SCORER_WEIGHT[POSITION_GROUP[slot.position]] }, () => player.name);
      }),
    [ratedSlots],
  );

  /**
   * ตัวจริง 11 คนฝั่งเรา (ไม่ถ่วงน้ำหนัก คนละหนึ่งชื่อ) พร้อม cardId/slotId
   * ใช้สุ่มว่าใครบาดเจ็บ/โดนใบแดงในนัดนี้ — ต่างจาก scorerPool ที่ถ่วงน้ำหนักตามตำแหน่ง
   */
  const ourActors = useMemo<MatchActor[]>(
    () =>
      ratedSlots.flatMap(({ slot, player }) => {
        if (!player) return [];
        const cardId = team.squad.find((entry) => entry.slotId === slot.id)?.cardId;
        return cardId ? [{ name: player.name, cardId, slotId: slot.id }] : [];
      }),
    [ratedSlots, team.squad],
  );

  /**
   * รายชื่อคนยิงของคู่แข่ง — ดึงจากตัวจริง 11 คนจริง ๆ ของเขา
   * ไทม์ไลน์ชุดนี้ถูกส่งไปให้เขาดูด้วย จึงต้องเป็นชื่อในทีมเขาเท่านั้น
   */
  const opponentScorerPool = useCallback(
    (opponentId: string): string[] => {
      const profile = profileByUid[opponentId];
      if (!profile) return [];

      return buildScorerPool(profile.formationId, profile.squad);
    },
    [profileByUid],
  );

  /**
   * ชื่อตัวจริง 11 คนฝั่งตรงข้าม (ไม่ถ่วงน้ำหนัก) ใช้สุ่มว่าใครบาดเจ็บ/โดนใบแดงฝั่งเขา
   * มีทีมจริงก็ใช้ทีมจริง ไม่มี (บอท) ก็ปั้นทีมที่ OVR ใกล้เคียงแทน (เห็นชื่อเดิมทุกครั้งจาก resolveOpponentSquad)
   */
  const opponentActorNames = useCallback(
    (opponent: Opponent): string[] =>
      resolveOpponentSquad(opponent, profileByUid[opponent.id])
        .map((entry) => entry.player?.name)
        .filter((name): name is string => Boolean(name)),
    [profileByUid],
  );

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
    if (squadIncomplete || squadHasSuspended || state.status === 'searching' || state.status === 'playing')
      return;

    stopTimers();
    setLive(null);
    setEmptyReason(null);
    setState({ status: 'searching', opponent: null, result: null, odds: null });

    const wait = SEARCH_MS.min + Math.random() * (SEARCH_MS.max - SEARCH_MS.min);

    timer.current = window.setTimeout(() => {
      const opponent = findOpponent(rating.matchOvr, availableRivals, !ONLINE);

      if (opponent) {
        setOpponent(opponent);
        return;
      }

      // ไม่มีใครให้เจอ — แยกให้ชัดว่าเพราะคนน้อย หรือเพราะเพิ่งเจอทุกคนไปแล้ว
      const blocked = opponentPool.length > 0;
      setEmptyReason(
        blocked
          ? 'เพิ่งแข่งกับผู้เล่นทุกคนที่พลังใกล้เคียงไปแล้ว รอคูลดาวน์สักครู่แล้วลองใหม่'
          : 'ยังไม่มีผู้เล่นคนอื่นบนเซิร์ฟเวอร์ — ชวนเพื่อนมาสมัครแล้วลองอีกครั้ง',
      );
      setState({ status: 'empty', opponent: null, result: null, odds: null });
    }, wait);
  }, [
    availableRivals,
    opponentPool.length,
    rating.matchOvr,
    setOpponent,
    squadHasSuspended,
    squadIncomplete,
    state.status,
    stopTimers,
  ]);

  const challenge = useCallback(
    (opponentId: string) => {
      if (squadIncomplete || squadHasSuspended) return;

      const opponent =
        opponentPool.find((entry) => entry.id === opponentId) ??
        (ONLINE ? undefined : OPPONENTS.find((entry) => entry.id === opponentId));
      if (!opponent) return;

      // ท้าซ้ำคนเดิมเร็วเกินไป = ปั้มดาว — บอกเวลาที่เหลือแทนที่จะปล่อยผ่าน
      if (ONLINE && isOnCooldown(recentRivals, opponent.id)) {
        stopTimers();
        setEmptyReason(
          `เพิ่งแข่งกับ ${opponent.name} ไป — ท้าซ้ำได้อีกใน ${formatCooldown(
            cooldownLeft(recentRivals, opponent.id),
          )}`,
        );
        setState({ status: 'empty', opponent: null, result: null, odds: null });
        playSfx('error');
        return;
      }

      stopTimers();
      setEmptyReason(null);
      setOpponent(opponent);
    },
    [opponentPool, recentRivals, setOpponent, squadHasSuspended, squadIncomplete, stopTimers],
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

      // โหมดเซิร์ฟเวอร์: ฟังก์ชันเป็นคนเขียนใบรายงานให้อีกฝ่ายแล้ว (เชื่อถือได้กว่า)
      if (!serverRecord.current && ONLINE && uid && opponent && opponent.isBot === false) {
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

      // จำไว้ว่าเพิ่งเจอคนนี้ ห้ามท้าซ้ำจนกว่าจะพ้นคูลดาวน์ (กันปั้มดาว)
      // โหมดเซิร์ฟเวอร์: เซิร์ฟเวอร์จำให้แล้ว และเป็นฝ่ายเดียวที่แก้ค่านี้ได้
      if (opponent && !serverRecord.current) {
        patchState({ recentRivals: rememberRival(latestRivals.current, opponent.id) });
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

      // โหมดเซิร์ฟเวอร์: ใช้สถิติที่เซิร์ฟเวอร์คิดมาให้ ไม่บวกเอง
      const next = serverRecord.current ?? {
        // คะแนนรวมไม่ให้ติดลบ แม้จะแพ้ติดกันหลายนัด
        points: Math.max(0, current.points + result.rankingPoints),
        wins: current.wins + (result.outcome === 'win' ? 1 : 0),
        draws: current.draws + (result.outcome === 'draw' ? 1 : 0),
        losses: current.losses + (result.outcome === 'loss' ? 1 : 0),
      };
      const points = next.points;

      serverRecord.current = null;
      setRecord(next);

      playSfx('whistle');

      // ข้ามขั้น rank แล้วเล่นเสียงฉลองให้รู้ทันที
      if (points > current.points && getRankTier(points).id !== getRankTier(current.points).id) {
        playSfx('rankUp');
      }
    },
    [account, addCoins, appendMatches, patchState, reportMatch, state.opponent, stopTimers],
  );

  /** ประมวลผลหนึ่งนาทีในเกม: เปิดเผยประตู/บาดเจ็บ/ใบแดงของนาทีนั้น แล้วเดินต่อหรือหยุดรอ */
  const advanceMatch = useCallback(
    (result: MatchResult) => {
      minute.current += 1;
      const now = minute.current;

      // คำนวณเหตุการณ์ของนาทีนี้ไว้ก่อน แล้วค่อยส่งเข้า setState (updater ต้องไม่มี side effect)
      const eventsNow = result.events.filter((event) => event.minute === now);
      const goalsNow = eventsNow.filter((event) => event.type === 'goal');
      goalsNow.forEach((event) => playSfx(event.side === 'team' ? 'goal' : 'concede'));

      setLive((current) =>
        current
          ? {
              minute: now,
              teamScore:
                current.teamScore + goalsNow.filter((event) => event.side === 'team').length,
              opponentScore:
                current.opponentScore +
                goalsNow.filter((event) => event.side === 'opponent').length,
              events: [...[...eventsNow].reverse(), ...current.events],
            }
          : current,
      );

      // บาดเจ็บของเรา = หยุดนาฬิการอเปลี่ยนตัว ต้องเลือกก่อนถึงเดินต่อได้
      const injury = eventsNow.find(
        (event) => event.type === 'injury' && event.side === 'team' && event.cardId && event.slotId,
      );
      if (injury?.cardId && injury.slotId) {
        playSfx('whistle');
        setPendingInjury({ cardId: injury.cardId, slotId: injury.slotId, playerName: injury.scorer });
      }

      // ใบแดง — ฝั่งเราขึ้นทะเบียนโดนแบน 3 นัดถัดไปทันที และแสดงว่าเหลือ 10 คนในสนาม
      eventsNow
        .filter((event) => event.type === 'redCard')
        .forEach((event) => {
          playSfx('whistle');
          if (event.side === 'team' && event.cardId) {
            const cardId = event.cardId;
            suspensionsRef.current = { ...suspensionsRef.current, [cardId]: 3 };
            patchState({ suspensions: suspensionsRef.current });
            setSentOffCardIds((current) => new Set(current).add(cardId));
          }
        });

      if (injury) {
        // หยุดนาฬิกาไว้ตรงนี้ — resolveInjury() จะสั่งเดินต่อเองหลังเลือกตัวสำรองเสร็จ
        if (clock.current !== null) {
          window.clearInterval(clock.current);
          clock.current = null;
        }
        return;
      }

      if (now >= MATCH_MINUTES) finish(result);
    },
    [finish, patchState],
  );

  /** เริ่ม/เดินนาฬิกาแมตช์ต่อ ใช้ทั้งตอนเขี่ยบอลครั้งแรกและตอนเปลี่ยนตัวคนบาดเจ็บเสร็จแล้ว */
  const startClock = useCallback(
    (result: MatchResult) => {
      if (clock.current !== null) window.clearInterval(clock.current);
      clock.current = window.setInterval(() => advanceMatch(result), TICK_MS);
    },
    [advanceMatch],
  );

  /** เลือกตัวสำรองมาเปลี่ยนคนที่บาดเจ็บ แล้วให้นาฬิกาเดินต่อทันที */
  const resolveInjury = useCallback(
    (replacementCardId: string) => {
      if (!pendingInjury || !pending.current) return;

      const result = assignCard(pendingInjury.slotId, replacementCardId);
      if (!result.ok) return; // จัดไม่ได้ (เช่นชื่อซ้ำ) — ให้เลือกใหม่ต่อ ไม่ปิดหน้าต่าง

      setPendingInjury(null);
      playSfx('swap');
      startClock(pending.current);
    },
    [assignCard, pendingInjury, startClock],
  );

  /**
   * เริ่มแข่ง
   *
   * โหมดเซิร์ฟเวอร์: ขอผลจากฟังก์ชัน playMatch แล้วเอามา "เล่นเทป" ถ่ายทอดสด
   * ดาวถูกบวกที่เซิร์ฟเวอร์ไปแล้วตั้งแต่ก่อนภาพแรกจะขึ้นจอ ฝั่งนี้แก้อะไรไม่ได้เลย
   * (โหมดนี้เซิร์ฟเวอร์ยังไม่รู้จักเหตุการณ์บาดเจ็บ/ใบแดง จึงเห็นแค่ประตูเหมือนเดิม)
   *
   * โหมดเดิม (ยังไม่เปิด VITE_SERVER_AUTHORITY): สุ่มผลในเครื่องเหมือนเดิม รวมบาดเจ็บ/ใบแดงด้วย
   */
  const kickoff = useCallback(async () => {
    const opponent = state.opponent;
    if (!opponent || state.status !== 'found') return;

    const useServer = SERVER_AUTHORITY && ONLINE && opponent.isBot === false;
    let result: MatchResult;

    if (useServer) {
      // ระหว่างรอเซิร์ฟเวอร์ตอบ ล็อกปุ่มไว้ก่อนด้วยสถานะ playing กันกดซ้ำ
      stopTimers();
      setState((current) => ({ ...current, status: 'playing' }));

      try {
        const response = await callPlayMatch({ opponentUid: opponent.id });
        result = response.result;
        serverRecord.current = response.record;
      } catch (error) {
        console.error('[server] ลงแข่งไม่สำเร็จ', error);
        serverRecord.current = null;
        setEmptyReason(serverErrorMessage(error));
        setState({ status: 'empty', opponent: null, result: null, odds: null });
        playSfx('error');
        return;
      }
    } else {
      serverRecord.current = null;
      // สุ่มผลและไทม์ไลน์ทั้งหมดตั้งแต่ตอนนี้ แล้วค่อยเปิดเผยทีละนาที
      result = simulateMatch(
        rating.matchOvr,
        opponent,
        scorerPool,
        opponentScorerPool(opponent.id),
        ourActors,
        opponentActorNames(opponent),
      );
    }

    // แมตช์ใหม่ = เริ่มนับโทษแบนใหม่: นัดที่ค้างจากก่อนหน้าลดลง 1 (ครบแล้วหลุดทะเบียน)
    // ใบแดงที่เพิ่งเกิดในนัดนี้ (ถ้ามี) จะถูกเติมเข้าไปทีหลังตอนเกิดขึ้นจริงระหว่างถ่ายทอดสด
    const decremented: Record<string, number> = {};
    Object.entries(account?.state.suspensions ?? {}).forEach(([cardId, left]) => {
      if (left - 1 > 0) decremented[cardId] = left - 1;
    });
    suspensionsRef.current = decremented;
    patchState({ suspensions: decremented });
    setSentOffCardIds(new Set());
    setPendingInjury(null);

    stopTimers();
    pending.current = result;
    minute.current = 0;
    setLive(KICKOFF_LIVE);
    setState((current) => ({ ...current, status: 'playing' }));
    playSfx('whistle');
    startClock(result);
  }, [
    account?.state.suspensions,
    opponentActorNames,
    opponentScorerPool,
    ourActors,
    patchState,
    rating.matchOvr,
    scorerPool,
    startClock,
    state.opponent,
    state.status,
    stopTimers,
  ]);

  /**
   * เจอคู่แล้วเริ่มแข่งเองอัตโนมัติ
   *
   * ตั้งใจให้ "เจอแล้วต้องเจอ" — ถ้าเปิดให้ยกเลิกตอนเห็นค่าพลังคู่แข่งแล้ว
   * คนจะกดหาคู่รัว ๆ ทิ้งไปเรื่อย ๆ จนกว่าจะเจอทีมที่อ่อนกว่า แล้วค่อยกดแข่ง
   * ผลคือชนะรัวและปั้มดาวได้โดยไม่ต้องเก่งขึ้นเลย
   */
  useEffect(() => {
    if (state.status !== 'found') return undefined;

    const timer = window.setTimeout(() => void kickoff(), VS_MS);
    return () => window.clearTimeout(timer);
  }, [kickoff, state.status]);

  const cancel = useCallback(() => {
    stopTimers();
    pending.current = null;
    setLive(null);
    setEmptyReason(null);
    setPendingInjury(null);
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
      // รายชื่อให้ท้าเอง: ออนไลน์โชว์เฉพาะผู้เล่นจริงที่ยังไม่ติดคูลดาวน์
      opponents: availableRivals,
      record,
      history,
      live,
      elapsed,
      squadIncomplete,
      search,
      challenge,
      kickoff,
      cancel,
      applyRecord,
      defenseNotices,
      clearDefenseNotices,
      emptyReason,
      pendingInjury,
      resolveInjury,
      sentOffCardIds,
      squadHasSuspended,
    }),
    [
      applyRecord,
      availableRivals,
      cancel,
      challenge,
      clearDefenseNotices,
      defenseNotices,
      elapsed,
      emptyReason,
      history,
      kickoff,
      live,
      pendingInjury,
      record,
      resolveInjury,
      search,
      sentOffCardIds,
      squadHasSuspended,
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
