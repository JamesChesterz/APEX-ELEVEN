/**
 * เทสของ PHASE 5 — เอนจินตัวเดียว การควบคุมนาฬิกา ความสอดคล้องของผล และการรัน 100 นัด
 */
import { describe, expect, it } from 'vitest';
import { getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import type { MatchEngine, MatchTeamInput } from '@/match-engine';
import type { Tactics } from '@/match-engine/tactics';
import { buildResultFromEngine, simulateMatchWithEngine } from '@/services/matchResult';
import {
  MATCH_REAL_SECONDS,
  MINUTES_PER_SECOND,
  SPEED_OPTIONS,
  createMatchSession,
} from '@/services/matchSession';
import type { Opponent } from '@/types/match';

const STEP = 1 / 60;

const buildTeam = (formationId: string, side: 'home' | 'away'): MatchTeamInput => {
  const formation = getFormationById(formationId);

  return {
    id: `${side}-team`,
    name: side === 'home' ? 'ทีมเรา' : 'ทีมคู่แข่ง',
    formationName: formation.name,
    color: '#3ED2A0',
    accent: '#04241A',
    players: formation.slots.map((slot, index) => {
      const player = PLAYERS[index % PLAYERS.length];
      return {
        id: `${side}-${slot.id}`,
        name: player.name,
        shirtNumber: index + 1,
        position: slot.position,
        ovr: player.ovr,
        pace: player.stats.pace,
        stats: player.stats,
        slotId: slot.id,
        formationX: slot.x,
        formationY: slot.y,
      };
    }),
  };
};

const opponent: Opponent = {
  id: 'opp-1',
  name: 'คู่แข่งทดสอบ',
  manager: 'ผู้จัดการ',
  ovr: 80,
  formationId: '4-4-2',
  difficulty: 'normal',
  rewardCoins: 500,
};

const newSession = (matchId: string, tactics?: { home?: Partial<Tactics> }) =>
  createMatchSession({
    matchId,
    home: buildTeam('4-3-3', 'home'),
    away: buildTeam('4-4-2', 'away'),
    tactics,
  });

/**
 * เดินการจำลองเหมือนที่ลูปจริงทำ: เวลาจริง × ความเร็ว แล้วซอยเป็นก้าวคงที่
 * @returns จำนวนก้าวที่เดินไปทั้งหมด
 */
const advance = (engine: MatchEngine, realSeconds: number): number => {
  let accumulator = realSeconds * engine.speed;
  let steps = 0;

  while (accumulator >= STEP && engine.period !== 'FULL_TIME') {
    engine.tick(STEP);
    accumulator -= STEP;
    steps += 1;
  }

  return steps;
};

const runToFullTime = (engine: MatchEngine): void => {
  for (let index = 0; index < 60 * 400 && engine.period !== 'FULL_TIME'; index += 1) {
    engine.tick(STEP);
  }
};

/* ══ เอนจินตัวเดียว ═══════════════════════════════════════ */

describe('เอนจินตัวเดียวต่อหนึ่งนัด', () => {
  it('เซสชันถือเอนจินตัวเดียว และผลมาจากตัวนั้น', () => {
    const session = newSession('single');
    runToFullTime(session.engine);

    const result = buildResultFromEngine(session.engine, {
      matchId: session.matchId,
      opponent,
      teamOvr: 80,
      injuryEvent: null,
    });

    expect(result.teamScore).toBe(session.engine.score.home);
    expect(result.opponentScore).toBe(session.engine.score.away);
    expect(result.id).toBe(session.matchId);
    expect(session.engine.matchId).toBe(session.matchId);
  });

  it('สร้างผลจากเอนจินตัวเดิมกี่ครั้งก็ได้สกอร์เดิม — ไม่มีการจำลองรอบสอง', () => {
    const session = newSession('no-resim');
    runToFullTime(session.engine);

    const context = { matchId: session.matchId, opponent, teamOvr: 80, injuryEvent: null };
    const first = buildResultFromEngine(session.engine, context);
    const second = buildResultFromEngine(session.engine, context);

    expect(first.teamScore).toBe(second.teamScore);
    expect(first.opponentScore).toBe(second.opponentScore);
    expect(first.engineStats).toEqual(second.engineStats);
    expect(first.events.length).toBe(second.events.length);
  });

  it('ความเร็วของการดูสดกับการคิดผลเป็นค่าเดียวกัน', () => {
    // ก่อน PHASE 5 การถ่ายทอดสดใช้ 12 วินาที ส่วนการคิดผลใช้ 240 วินาที
    expect(MINUTES_PER_SECOND).toBeCloseTo(90 / MATCH_REAL_SECONDS, 10);

    const session = newSession('speed-parity');
    const headless = simulateMatchWithEngine({
      matchId: 'speed-parity',
      teamOvr: 80,
      opponent,
      home: buildTeam('4-3-3', 'home'),
      away: buildTeam('4-4-2', 'away'),
    });

    runToFullTime(session.engine);

    // seed เดียวกัน ความเร็วเดียวกัน ก้าวเดียวกัน → แมตช์เดียวกันเป๊ะ
    expect(session.engine.score).toEqual(headless.engine.score);
  });
});

/* ══ นาฬิกาและการควบคุม ══════════════════════════════════ */

describe('นาฬิกาและการควบคุม', () => {
  it('ความเร็ว 1x เดินครบ 90 นาทีในเวลาที่กำหนด', () => {
    const { engine } = newSession('clock-1x');
    expect(engine.speed).toBe(1);

    advance(engine, MATCH_REAL_SECONDS * 1.3);
    expect(engine.period).toBe('FULL_TIME');
    expect(engine.clock.minute).toBe(90);
  });

  it('2x และ 4x เดินนาฬิกาการจำลองเร็วขึ้นจริงตามสัดส่วน', () => {
    // วัดเป็นวินาทีในเกมทั้งหมด ไม่ใช่นาทีปัดเศษ ไม่งั้นคลาดกันได้ 1 นาทีจากการปัด
    const gameSecondsAfter = (speed: number) => {
      const { engine } = newSession(`speed-${speed}`);
      engine.setSpeed(speed);
      advance(engine, 20);
      return engine.clock.minute * 60 + engine.clock.second;
    };

    const base = gameSecondsAfter(1);
    expect(base).toBeGreaterThan(0);
    expect(gameSecondsAfter(2) / base).toBeCloseTo(2, 1);
    expect(gameSecondsAfter(4) / base).toBeCloseTo(4, 1);
  });

  it('ตัวเลือกความเร็วมีครบ 1x / 2x / 4x', () => {
    expect([...SPEED_OPTIONS]).toEqual([1, 2, 4]);
  });

  it('หยุดแล้วนาฬิกา คน บอล และการตัดสินใจหยุดหมด', () => {
    const { engine } = newSession('pause');
    advance(engine, 20);

    engine.setPaused(true);
    const frozen = {
      minute: engine.clock.minute,
      players: engine.players.map((agent) => ({ ...agent.position2d })),
      ball: { ...engine.ball.position },
      events: engine.emittedCount,
      passes: engine.stats.home.passes,
    };

    advance(engine, 10);

    expect(engine.clock.minute).toBe(frozen.minute);
    expect(engine.emittedCount).toBe(frozen.events);
    expect(engine.stats.home.passes).toBe(frozen.passes);
    engine.players.forEach((agent, index) => {
      expect(agent.position2d.x).toBeCloseTo(frozen.players[index].x, 10);
    });
    expect(engine.ball.position.x).toBeCloseTo(frozen.ball.x, 10);
  });

  it('เล่นต่อแล้วการจำลองเดินต่อจากจุดเดิม', () => {
    const { engine } = newSession('resume');
    advance(engine, 20);
    engine.setPaused(true);

    const minute = engine.clock.minute;
    advance(engine, 5);
    engine.setPaused(false);
    advance(engine, 10);

    expect(engine.clock.minute).toBeGreaterThan(minute);
  });

  it('เร่งความเร็วไม่ทำให้ฟิสิกส์เพี้ยน — ไม่มีใคร teleport', () => {
    const { engine } = newSession('fast-physics');
    engine.setSpeed(4);

    for (let index = 0; index < 60 * 60 && engine.period !== 'FULL_TIME'; index += 1) {
      const before = new Map(engine.players.map((agent) => [agent.id, { ...agent.position2d }]));
      const seen = engine.events.length;
      engine.tick(STEP);

      if (engine.events.slice(seen).some((event) => event.type === 'kickoff')) continue;

      engine.players.forEach((agent) => {
        const start = before.get(agent.id);
        if (!start) return;
        const step = Math.hypot(agent.position2d.x - start.x, agent.position2d.y - start.y);
        expect(step).toBeLessThanOrEqual(agent.topSpeed * STEP + 0.001);
      });
    }
  });
});

/* ══ ภาพนิ่งและเหตุการณ์สำหรับ UI ════════════════════════ */

describe('ภาพนิ่งและเหตุการณ์', () => {
  it('snapshot มีข้อมูลครบตามที่ HUD ต้องใช้ และตรงกับเอนจิน', () => {
    const { engine } = newSession('snapshot');
    advance(engine, 30);

    const snapshot = engine.snapshot();
    expect(snapshot.matchId).toBe(engine.matchId);
    expect(snapshot.score).toEqual(engine.score);
    expect(snapshot.minute).toBe(Math.floor(engine.clock.minute));
    expect(snapshot.period).toBe(engine.period);
    expect(snapshot.stats.home.shots).toBe(engine.stats.home.shots);
    expect(snapshot.onPitch.home).toBe(engine.home.players.length);
  });

  it('แก้ snapshot แล้วไม่กระทบเอนจิน', () => {
    const { engine } = newSession('snapshot-copy');
    const snapshot = engine.snapshot();

    snapshot.score.home = 99;
    snapshot.stats.home.shots = 99;

    expect(engine.score.home).not.toBe(99);
    expect(engine.stats.home.shots).not.toBe(99);
  });

  it('eventsSince คืนเฉพาะเหตุการณ์ใหม่ และไม่ตกหล่น', () => {
    const { engine } = newSession('cursor');
    let cursor = engine.emittedCount;
    let collected = 0;

    for (let round = 0; round < 40; round += 1) {
      advance(engine, 3);
      collected += engine.eventsSince(cursor).length;
      cursor = engine.emittedCount;
    }

    expect(collected).toBe(engine.emittedCount - 1); // ลบเหตุการณ์ kickoff แรกที่อ่านไปก่อนเริ่มนับ
  });

  it('เหตุการณ์ที่ฟีดใช้กับที่ผลใช้มาจาก store เดียวกัน', () => {
    const { engine, matchId } = newSession('feed');
    runToFullTime(engine);

    const goalsInEngine = engine.events.filter((event) => event.type === 'goal').length;
    const result = buildResultFromEngine(engine, {
      matchId,
      opponent,
      teamOvr: 80,
      injuryEvent: null,
    });
    const goalsInResult = result.events.filter((event) => event.type === 'goal').length;

    expect(goalsInResult).toBe(goalsInEngine);
    expect(goalsInResult).toBe(result.teamScore + result.opponentScore);
  });

  it('บันทึกการเปลี่ยนแทคติกลงฟีดเหตุการณ์', () => {
    const { engine } = newSession('tactical-event');
    advance(engine, 20);

    engine.updateTactics('home', { mentality: 'ATTACKING' });
    engine.emitTacticalChange(engine.tactics.home);

    const event = engine.events.find((entry) => entry.type === 'tactical_change');
    expect(event?.side).toBe('home');
    expect(event?.detail?.mentality).toBe('ATTACKING');
  });
});

/* ══ เปลี่ยนแทคติกกลางเกม ════════════════════════════════ */

describe('เปลี่ยนแทคติกกลางเกม', () => {
  it('เปลี่ยนแล้ว tick ถัดไปใช้ค่าใหม่ และแนวรับขยับตาม', () => {
    const { engine } = newSession('live-tactics');
    advance(engine, 40);

    const lineNow = () => {
      const line = engine.home.players.filter((agent) => agent.role === 'defence');
      return line.reduce((sum, agent) => sum + agent.position2d.x, 0) / line.length;
    };

    engine.updateTactics('home', { mentality: 'DEFENSIVE', defensiveLine: 'DEEP' });
    expect(engine.modifiersFor('home').lineOffset).toBeLessThan(-10);
    advance(engine, 25);
    const deep = lineNow();

    engine.updateTactics('home', { mentality: 'ATTACKING', defensiveLine: 'HIGH' });
    expect(engine.modifiersFor('home').lineOffset).toBeGreaterThan(10);
    advance(engine, 25);

    expect(lineNow()).toBeGreaterThan(deep);
  });
});

/* ══ การรัน 100 นัด ═══════════════════════════════════════ */

describe('ความเสถียรของการจำลอง 100 นัด', () => {
  it('รัน 100 นัดแล้วไม่มีค่าพัง ไม่มีนัดไหน crash', () => {
    const totals = { goals: 0, shots: 0, passes: 0, cards: 0, fouls: 0 };

    for (let index = 0; index < 100; index += 1) {
      const { engine } = newSession(`bulk-${index}`);
      runToFullTime(engine);

      expect(engine.period).toBe('FULL_TIME');
      expect(engine.clock.minute).toBe(90);

      (['home', 'away'] as const).forEach((side) => {
        const stats = engine.stats[side];

        Object.values(stats).forEach((value) => {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        });

        expect(stats.shotsOnTarget).toBeLessThanOrEqual(stats.shots);
        expect(stats.completedPasses).toBeLessThanOrEqual(stats.passes);
        expect(stats.successfulTackles).toBeLessThanOrEqual(stats.tackles);

        const onPitch = engine[side].players.length;
        expect(onPitch).toBeGreaterThan(0);
        expect(onPitch).toBeLessThanOrEqual(11);
      });

      const possession = engine.possessionShare('home');
      expect(Number.isFinite(possession)).toBe(true);
      expect(possession).toBeGreaterThanOrEqual(0);
      expect(possession).toBeLessThanOrEqual(1);

      totals.goals += engine.score.home + engine.score.away;
      totals.shots += engine.stats.home.shots + engine.stats.away.shots;
      totals.passes += engine.stats.home.passes + engine.stats.away.passes;
      totals.cards += engine.stats.home.yellowCards + engine.stats.away.yellowCards;
      totals.fouls += engine.stats.home.fouls + engine.stats.away.fouls;
    }

    // ต้องมีอะไรเกิดขึ้นจริงในสนาม ไม่ใช่ 100 นัดที่นิ่งสนิท
    expect(totals.goals).toBeGreaterThan(0);
    expect(totals.shots).toBeGreaterThan(50);
    expect(totals.passes).toBeGreaterThan(1000);
  }, 240_000);
});

/* ══ แนวโน้มของแทคติก ════════════════════════════════════ */

describe('แนวโน้มของแทคติก', () => {
  it('บุกดันแนวรับสูงกว่าและยิงมากกว่าตั้งรับอย่างมีนัย', () => {
    const measure = (tactics: Partial<Tactics>, label: string) => {
      let line = 0;
      let samples = 0;
      let shots = 0;

      for (let seed = 0; seed < 12; seed += 1) {
        const { engine } = newSession(`${label}-${seed}`, { home: tactics });

        for (let index = 0; index < 60 * 400 && engine.period !== 'FULL_TIME'; index += 1) {
          engine.tick(STEP);
          if (index % 120 !== 0 || engine.period === 'HALF_TIME') continue;

          const back = engine.home.players.filter((agent) => agent.role === 'defence');
          if (back.length === 0) continue;

          line += back.reduce((sum, agent) => sum + agent.position2d.x, 0) / back.length;
          samples += 1;
        }

        shots += engine.stats.home.shots;
      }

      return { line: line / samples, shots };
    };

    const defensive = measure({ mentality: 'DEFENSIVE', defensiveLine: 'DEEP' }, 'def');
    const attacking = measure({ mentality: 'ATTACKING', defensiveLine: 'HIGH' }, 'atk');

    expect(attacking.line).toBeGreaterThan(defensive.line + 8);
    expect(attacking.shots).toBeGreaterThan(defensive.shots);
  }, 240_000);
});
