/**
 * ลีกประจำวัน: เข้าร่วม → ระบบแข่งให้เองทุก 30 นาที → ครบวันแล้วสรุปอันดับและแจกรางวัล
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
import { usePlayers } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import {
  addResultToDaily,
  buildDailyStandings,
  createLeagueState,
  EMPTY_DAILY,
  getDailyReward,
  getDayKey,
  getDayStart,
  getNextRound,
  getRoundIndex,
  getRoundOpponent,
  getRoundsBetween,
  type DailySummary,
  type LeagueStanding,
} from '@/services/league';
import { simulateMatch } from '@/services/matchmaking';
import { getRankTier } from '@/services/rank';
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
  const deps = useRef({ league, rating, ratedSlots, team, record });
  deps.current = { league, rating, ratedSlots, team, record };

  /** กันไม่ให้ประมวลผลซ้อนกันเอง (เช่น interval ยิงตอนที่รอบก่อนยังคำนวณไม่จบ) */
  const busy = useRef(false);

  /** ชื่อคนที่มีสิทธิ์ยิงประตู ถ่วงน้ำหนักตามตำแหน่ง */
  const buildScorers = useCallback((): string[] => {
    const weight = { attack: 4, midfield: 2, defence: 1, gk: 0 } as const;

    return deps.current.ratedSlots.flatMap(({ slot, player }) => {
      if (!player) return [];
      return Array.from({ length: weight[POSITION_GROUP[slot.position]] }, () => player.name);
    });
  }, []);

  /**
   * เดินรอบที่ค้างอยู่ทั้งหมดจนถึงตอนนี้
   * ทำงานทั้งตอนเปิดแอป (ย้อนรอบที่พลาดไป) และตอนถึงรอบใหม่ระหว่างเปิดค้างไว้
   */
  const runPendingRounds = useCallback(() => {
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
            current.daily,
            deps.current.team.name,
            account?.managerName ?? 'คุณผู้จัดการ',
            deps.current.rating.matchOvr,
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
        const opponent = getRoundOpponent(getRoundIndex(roundAt));
        const result = simulateMatch(deps.current.rating.matchOvr, opponent, scorers);
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
    account?.managerName,
    addCoins,
    appendMatches,
    applyRecord,
    buildScorers,
    patchLeague,
    reportMatch,
  ]);

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

  const join = useCallback(() => {
    const at = new Date();
    patchLeague({
      joined: true,
      joinedAt: at.toISOString(),
      dayStartedAt: getDayStart(at).toISOString(),
      // เริ่มนับรอบจากตอนกดเข้าร่วม ไม่ย้อนไปคิดรอบก่อนหน้าให้
      lastRoundAt: at.toISOString(),
      lastSquadChangeAt: null,
    });
    playSfx('whistle');
  }, [patchLeague]);

  const leave = useCallback(() => {
    patchLeague({ joined: false, lastSquadChangeAt: null });
    playSfx('click');
  }, [patchLeague]);

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
        league.daily,
        team.name,
        account?.managerName ?? 'คุณผู้จัดการ',
        rating.matchOvr,
        getDayKey(new Date(league.dayStartedAt)),
        roundsPlayed,
      ),
    [account?.managerName, league.dayStartedAt, league.daily, rating.matchOvr, roundsPlayed, team.name],
  );

  const nextRoundAt = useMemo(() => getNextRound(now), [now]);

  const value = useMemo<LeagueContextValue>(
    () => ({
      league,
      daily: league.daily,
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
    [claimDaily, join, league, leave, nextRoundAt, now, roundsPlayed, standings, summary],
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
