/**
 * ลีกประจำวัน: เข้าร่วม → ระบบแข่งให้เองทุก 30 นาที → ครบวันแล้วสรุปอันดับและแจกรางวัล
 *
 * คู่แข่งทั้งลีกเป็น "ผู้เล่นจริง" ที่ค่าพลังใกล้เคียงกัน 10 ทีม (ไม่ใช่บอท)
 * รายชื่อถูกคัดใหม่ทุกครั้งที่ประมวลผลรอบ ค่าพลังทีมขยับเมื่อไหร่ก็ย้ายลีกให้เองทันที
 *
 * รอบที่ผ่านไปตอนผู้เล่นปิดแอปจะถูกย้อนคำนวณตอนเปิดกลับมา (catch-up)
 * ทุกครั้งที่ประมวลผลจะเลื่อน lastRoundAt ไปข้างหน้า รอบเดิมจึงไม่ถูกนับซ้ำ
 * แม้ React จะเรียก effect ซ้ำใน StrictMode
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
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useOnline } from '@/hooks/useOnline';
import { usePlayers } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import {
  addResultToDaily,
  buildDailyStandings,
  buildLeagueMembers,
  createLeagueState,
  EMPTY_DAILY,
  FALLBACK_MEMBERS,
  getDailyReward,
  getDayKey,
  getDayStart,
  getNextRound,
  getRoundIndex,
  getRoundRival,
  getRoundsBetween,
  memberToOpponent,
  type DailySummary,
  type LeagueMember,
  type LeagueStanding,
} from '@/services/league';
import { simulateMatch } from '@/services/matchmaking';
import { getRankTier } from '@/services/rank';
import {
  callSetLeagueJoined,
  callSyncLeague,
  SERVER_AUTHORITY,
} from '@/services/firebase/gameServer';
import { buildScorerPool, SCORER_WEIGHT } from '@/services/scorers';
import { playSfx } from '@/services/sound';
import type { LeagueDaily, LeagueState } from '@/types/account';
import type { MatchResult } from '@/types/match';
import { POSITION_GROUP } from '@/utils/helpers';

/** ตรวจว่าถึงรอบใหม่หรือยังทุกกี่มิลลิวินาที */
const CHECK_MS = 15_000;

interface LeagueContextValue {
  league: LeagueState;
  /** สถิติวันนี้ของผู้เล่น */
  daily: LeagueDaily;
  /** ทีมทั้งหมดในลีกของเราตอนนี้ (รวมตัวเราเอง) */
  members: LeagueMember[];
  /** จำนวนผู้เล่นจริงในลีกนี้ (รวมตัวเราเอง) */
  realCount: number;
  /** ตารางอันดับประจำวัน (ผู้เล่น + ทีมในลีก) */
  standings: LeagueStanding[];
  /** อันดับของผู้เล่นตอนนี้ */
  rank: number;
  /** รอบถัดไปจะแข่งกี่โมง */
  nextRoundAt: Date;
  /** เหลืออีกกี่วินาทีถึงรอบถัดไป */
  secondsToNextRound: number;
  /** จำนวนรอบที่แข่งไปแล้ววันนี้ */
  roundsPlayed: number;
  /** สถานะล็อกการเปลี่ยนตัว */
  /** สรุปของเมื่อวานที่รอกดรับรางวัล */
  summary: DailySummary | null;
  join: () => void;
  leave: () => void;
  claimDaily: () => void;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

export const LeagueProvider = ({ children }: { children: ReactNode }) => {
  const { account, patchState, patchLeague, appendMatches } = useAuth();
  const { rating, ratedSlots, team } = useTeam();
  const { addCoins, addPoints, addUpgradePoints, reportMatch } = usePlayers();
  const { record, applyRecord } = useMatchmaking();
  /** โปรไฟล์สาธารณะของผู้เล่นทุกคนบนเซิร์ฟเวอร์ (ว่างเมื่อเล่นออฟไลน์) */
  const { profileByUid } = useOnline();

  const myId = account?.id ?? 'me';

  /** ทีมของเราในรูปแบบสมาชิกลีก */
  const me = useMemo<LeagueMember>(
    () => ({
      id: myId,
      teamName: team.name,
      managerName: account?.managerName ?? 'คุณผู้จัดการ',
      ovr: rating.matchOvr,
      formationId: team.formationId,
      avatar: account?.state.avatar,
      isReal: true,
    }),
    [account?.managerName, account?.state.avatar, myId, rating.matchOvr, team.formationId, team.name],
  );

  /**
   * ลีกของรอบนี้ = ผู้เล่นจริง 10 คนที่ OVR ใกล้เราที่สุด
   * คำนวณใหม่ทุกครั้งที่ค่าพลังของเราหรือของคนอื่นเปลี่ยน → ย้ายลีกให้เองอัตโนมัติ
   *
   * ทีมสำรอง (FALLBACK_MEMBERS) ถูกใช้เฉพาะตอนยังไม่มีผู้เล่นจริงคนอื่นเลย
   * ไม่อย่างนั้นลีกจะเดินต่อไม่ได้เพราะไม่มีคู่ให้แข่ง
   */
  const members = useMemo<LeagueMember[]>(() => {
    const others = Object.values(profileByUid)
      .filter((profile) => profile.uid !== myId && profile.teamOvr > 0)
      .map<LeagueMember>((profile) => ({
        id: profile.uid,
        teamName: profile.teamName,
        managerName: profile.managerName,
        ovr: profile.teamOvr,
        formationId: profile.formationId,
        avatar: profile.avatar,
        isReal: true,
      }));

    return buildLeagueMembers(me, others.length > 0 ? others : FALLBACK_MEMBERS);
  }, [me, myId, profileByUid]);

  const league = useMemo(
    () => account?.state.league ?? createLeagueState(),
    [account?.state.league],
  );

  const [summary, setSummary] = useState<DailySummary | null>(null);
  /** ใช้บังคับให้นาฬิกานับถอยหลังอัปเดตทุกวินาที */
  const [now, setNow] = useState(() => new Date());

  /**
   * ทุกอย่างที่ตัว timer ต้องอ่าน เก็บไว้ใน ref
   * เพื่อให้ effect ตั้ง interval แค่รอบเดียว ไม่ต้องรีสตาร์ททุกครั้งที่ค่าพลังทีมขยับ
   */
  const deps = useRef({ league, rating, ratedSlots, team, record, members, myId, profileByUid });
  deps.current = { league, rating, ratedSlots, team, record, members, myId, profileByUid };

  /** กันไม่ให้ประมวลผลซ้อนกันเอง (เช่น interval ยิงตอนที่รอบก่อนยังคำนวณไม่จบ) */
  const busy = useRef(false);

  /** ชื่อคนที่มีสิทธิ์ยิงประตู ถ่วงน้ำหนักตามตำแหน่ง */
  const buildScorers = useCallback(
    (): string[] =>
      deps.current.ratedSlots.flatMap(({ slot, player }) => {
        if (!player) return [];
        return Array.from(
          { length: SCORER_WEIGHT[POSITION_GROUP[slot.position]] },
          () => player.name,
        );
      }),
    [],
  );

  /** รายชื่อคนยิงของเพื่อนร่วมลีก — ดึงจากตัวจริงจริง ๆ ของเขา ไม่ใช่ชื่อสมมติ */
  const rivalScorers = useCallback(
    (rivalId: string): string[] => {
      const profile = deps.current.profileByUid[rivalId];
      if (!profile) return [];

      return buildScorerPool(profile.formationId, profile.squad);
    },
    [],
  );

  /**
   * เดินรอบที่ค้างอยู่ทั้งหมดจนถึงตอนนี้
   * ทำงานทั้งตอนเปิดแอป (ย้อนรอบที่พลาดไป) และตอนถึงรอบใหม่ระหว่างเปิดค้างไว้
   */
  /**
   * โหมดเซิร์ฟเวอร์: ให้ฟังก์ชัน syncLeague เป็นคนคิดรอบและบวกดาว
   * ฝั่งนี้แค่รับผลมาแสดง — เหรียญกับประวัติยังเป็นของเครื่องผู้เล่นในขั้นนี้
   */
  const runServerRounds = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;

    try {
      const response = await callSyncLeague({});
      if (response.skipped || !response.league) return;

      deps.current.league = response.league;
      patchLeague(response.league);

      if (response.summary) setSummary(response.summary);

      if (response.matches?.length) {
        appendMatches(response.matches);
        response.matches.forEach((match) =>
          reportMatch({
            outcome: match.outcome,
            teamOvr: match.teamOvr,
            opponentOvr: match.opponentOvr,
            mode: 'league',
          }),
        );
      }

      if (response.coinsEarned) addCoins(response.coinsEarned);

      if (response.record) {
        const before = deps.current.record;
        deps.current.record = response.record;
        applyRecord(response.record);

        if (
          response.record.points > before.points &&
          getRankTier(response.record.points).id !== getRankTier(before.points).id
        ) {
          playSfx('rankUp');
        }
      }
    } catch (error) {
      // ต่อเซิร์ฟเวอร์ไม่ได้ = ไม่ต้องคิดรอบเอง (ไม่งั้นก็เท่ากับเปิดช่องโกงกลับมา)
      console.error('[server] เดินรอบลีกไม่สำเร็จ', error);
    } finally {
      busy.current = false;
    }
  }, [addCoins, appendMatches, applyRecord, patchLeague, reportMatch]);

  const runLocalRounds = useCallback(() => {
    const current = deps.current.league;
    if (!current.joined || busy.current) return;

    const at = new Date();
    const today = getDayStart(at);
    const storedDay = new Date(current.dayStartedAt);

    busy.current = true;

    try {
      // ── ข้ามวันแล้ว: ปิดยอดของเมื่อวานก่อน ──
      if (today.getTime() > storedDay.getTime()) {
        const played = current.daily.wins + current.daily.draws + current.daily.losses;

        if (played > 0) {
          const standings = buildDailyStandings(
            deps.current.members,
            deps.current.myId,
            current.daily,
            getDayKey(storedDay),
            played,
          );
          const rank = standings.find((row) => row.isCurrentUser)?.rank ?? standings.length;

          setSummary({
            dayStartedAt: current.dayStartedAt,
            rank,
            totalTeams: standings.length,
            daily: current.daily,
            reward: getDailyReward(rank),
          });
        }

        // เริ่มวันใหม่จาก 06:00 ของวันนี้ ไม่ลากรอบเก่าข้ามวันมาด้วย
        const reset: LeagueState = {
          ...current,
          dayStartedAt: today.toISOString(),
          lastRoundAt: today.toISOString(),
          daily: { ...EMPTY_DAILY },
        };
        deps.current.league = reset;
        patchLeague(reset);
      }

      // ── แข่งรอบที่ผ่านไปแล้วแต่ยังไม่ได้คิด ──
      const state = deps.current.league;
      const since = new Date(
        state.lastRoundAt ?? state.joinedAt ?? state.dayStartedAt,
      );
      const rounds = getRoundsBetween(since, at);
      if (rounds.length === 0) return;

      const scorers = buildScorers();
      const matches: MatchResult[] = [];
      let daily = state.daily;
      let coins = 0;
      let rankingPoints = 0;
      let wins = 0;
      let draws = 0;
      let losses = 0;

      rounds.forEach((roundAt) => {
        // คู่แข่งของรอบนี้มาจากตารางแข่งของลีก (round-robin) — เป็นผู้เล่นจริงในลีกเดียวกัน
        const rival = getRoundRival(deps.current.members, deps.current.myId, getRoundIndex(roundAt));
        if (!rival) return;

        const opponent = memberToOpponent(rival, deps.current.rating.matchOvr);
        const result = simulateMatch(
          deps.current.rating.matchOvr,
          opponent,
          scorers,
          rivalScorers(rival.id),
        );
        const leaguePoints =
          result.teamScore > result.opponentScore ? 3 : result.teamScore === result.opponentScore ? 1 : 0;

        matches.unshift({
          ...result,
          mode: 'league',
          leaguePoints,
          playedAt: roundAt.toISOString(),
        });

        daily = addResultToDaily(daily, result.teamScore, result.opponentScore);
        // นัดในลีกนับเข้าภารกิจประจำวัน แต่ไม่ได้แต้มตีบวกรายนัด (mode: 'league')
        reportMatch({
          outcome: result.outcome,
          teamOvr: result.teamOvr,
          opponentOvr: result.opponentOvr,
          mode: 'league',
        });
        coins += result.coinsEarned;
        rankingPoints += result.rankingPoints;
        if (result.outcome === 'win') wins += 1;
        else if (result.outcome === 'draw') draws += 1;
        else losses += 1;
      });

      // ทุกรอบถูกข้าม (ลีกยังไม่มีคู่แข่ง) — ไม่ต้องเขียนอะไรลงบัญชี รอรอบหน้า
      if (matches.length === 0) return;

      const next: LeagueState = {
        ...state,
        lastRoundAt: rounds[rounds.length - 1].toISOString(),
        daily,
      };
      deps.current.league = next;
      patchLeague(next);
      appendMatches(matches);
      addCoins(coins);

      // ผลลีกนับรวมเข้าสถิติซีซันด้วย (คะแนนซีซันคนละชุดกับคะแนนลีก 3-1-0)
      //
      // สำคัญ: ต้องเขียนค่าที่คิดได้กลับลง deps.current ด้วย
      // เพราะถ้ามีหลายรอบถูกประมวลผลติด ๆ กันก่อน React จะ re-render
      // รอบถัดไปจะอ่าน record ตัวเก่าแล้วนับผลทับกันเอง (นับได้แค่รอบสุดท้าย)
      const before = deps.current.record;
      const updated = {
        points: Math.max(0, before.points + rankingPoints),
        wins: before.wins + wins,
        draws: before.draws + draws,
        losses: before.losses + losses,
      };
      deps.current.record = updated;
      applyRecord(updated);
      const points = updated.points;

      if (points > before.points && getRankTier(points).id !== getRankTier(before.points).id) {
        playSfx('rankUp');
      }
    } finally {
      busy.current = false;
    }
  }, [
    addCoins,
    appendMatches,
    applyRecord,
    buildScorers,
    patchLeague,
    reportMatch,
    rivalScorers,
  ]);

  /** เดินรอบที่ค้างอยู่ — เลือกทางตามว่าเปิดโหมดเซิร์ฟเวอร์ไว้หรือยัง */
  const runPendingRounds = useCallback(() => {
    if (!deps.current.league.joined) return;

    if (SERVER_AUTHORITY) {
      void runServerRounds();
      return;
    }

    runLocalRounds();
  }, [runLocalRounds, runServerRounds]);

  // ตรวจตอนเปิดแอป แล้วตรวจซ้ำเรื่อย ๆ ระหว่างเปิดค้างไว้
  useEffect(() => {
    runPendingRounds();
    const id = window.setInterval(() => {
      setNow(new Date());
      runPendingRounds();
    }, CHECK_MS);
    return () => window.clearInterval(id);
  }, [runPendingRounds]);

  // นาฬิกานับถอยหลังของรอบถัดไป
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /**
   * เข้าร่วม/ออกจากลีก
   *
   * โหมดเซิร์ฟเวอร์: สถานะลีกเป็นของเซิร์ฟเวอร์ (เพราะลีกเป็นตัวแจกดาว)
   * เครื่องผู้เล่นแก้เองไม่ได้ ต้องขอผ่านฟังก์ชัน setLeagueJoined ทางเดียว
   */
  const setJoined = useCallback(
    async (joined: boolean) => {
      if (!SERVER_AUTHORITY) {
        const at = new Date();
        patchLeague(
          joined
            ? {
                joined: true,
                joinedAt: at.toISOString(),
                dayStartedAt: getDayStart(at).toISOString(),
                // เริ่มนับรอบจากตอนกดเข้าร่วม ไม่ย้อนไปคิดรอบก่อนหน้าให้
                lastRoundAt: at.toISOString(),
                lastSquadChangeAt: null,
              }
            : { joined: false, lastSquadChangeAt: null },
        );
        playSfx(joined ? 'whistle' : 'click');
        return;
      }

      try {
        const response = await callSetLeagueJoined({ joined });
        deps.current.league = response.league;
        patchLeague(response.league);
        playSfx(joined ? 'whistle' : 'click');
      } catch (error) {
        console.error('[server] เปลี่ยนสถานะลีกไม่สำเร็จ', error);
        playSfx('error');
      }
    },
    [patchLeague],
  );

  const join = useCallback(() => void setJoined(true), [setJoined]);
  const leave = useCallback(() => void setJoined(false), [setJoined]);

  const claimDaily = useCallback(() => {
    if (!summary) return;
    addCoins(summary.reward.coins);
    addPoints(summary.reward.points);
    addUpgradePoints(summary.reward.upgradePoints);
    setSummary(null);
    playSfx('rankUp');
  }, [addCoins, addPoints, addUpgradePoints, summary]);

  const roundsPlayed = league.daily.wins + league.daily.draws + league.daily.losses;

  const standings = useMemo(
    () =>
      buildDailyStandings(
        members,
        myId,
        league.daily,
        getDayKey(new Date(league.dayStartedAt)),
        roundsPlayed,
      ),
    [league.dayStartedAt, league.daily, members, myId, roundsPlayed],
  );

  /** ผู้เล่นจริงในลีกนี้มีกี่คน (รวมเรา) — ใช้บอกสถานะว่าลีกเต็มหรือยัง */
  const realCount = useMemo(
    () => members.filter((member) => member.isReal).length,
    [members],
  );

  const nextRoundAt = useMemo(() => getNextRound(now), [now]);

  const value = useMemo<LeagueContextValue>(
    () => ({
      league,
      daily: league.daily,
      members,
      realCount,
      standings,
      rank: standings.find((row) => row.isCurrentUser)?.rank ?? standings.length,
      nextRoundAt,
      secondsToNextRound: Math.max(
        0,
        Math.round((nextRoundAt.getTime() - now.getTime()) / 1000),
      ),
      roundsPlayed,
      summary,
      join,
      leave,
      claimDaily,
    }),
    [claimDaily, join, league, leave, members, nextRoundAt, now, realCount, roundsPlayed, standings, summary],
  );

  // บัญชีเก่าที่สมัครก่อนมีระบบลีก — เติมสถานะให้ครั้งเดียว
  useEffect(() => {
    if (account && !account.state.league) patchState({ league: createLeagueState() });
  }, [account, patchState]);

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
};

export const useLeague = (): LeagueContextValue => {
  const context = useContext(LeagueContext);
  if (!context) throw new Error('useLeague ต้องถูกใช้ภายใน <LeagueProvider>');
  return context;
};
