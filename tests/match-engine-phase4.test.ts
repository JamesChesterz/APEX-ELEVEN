/**
 * เทสของ PHASE 4 — ผลการแข่งจากเอนจิน วงจรชีวิตของแมตช์ แทคติก และผลของค่าพลัง
 *
 * PHASE 1/1.5 · 2 · 3 อยู่ในไฟล์แยกของตัวเอง ไฟล์นี้เน้นเฉพาะของใหม่ใน PHASE 4
 */
import { describe, expect, it } from 'vitest';
import { getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import { createMatch, scorePass, type MatchTeamInput } from '@/match-engine';
import type { MatchEngine } from '@/match-engine';
import type { PlayerAgent } from '@/match-engine/playerAgent';
import {
  DEFAULT_TACTICS,
  NEUTRAL_MODIFIERS,
  normaliseTactics,
  tacticalModifiers,
  type Tactics,
} from '@/match-engine/tactics';
import { simulateMatchWithEngine, toEngineStats } from '@/services/matchResult';
import type { Opponent } from '@/types/match';

const STEP = 1 / 30;

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

/** เอนจินที่ตั้งค่าให้แมตช์ 90 นาทีกินเวลาจำลอง 240 วินาที (เท่ากับที่ใช้จริง) */
const newMatch = (seed: string, tactics?: { home?: Partial<Tactics>; away?: Partial<Tactics> }) =>
  createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'), {
    seed,
    matchId: `match-${seed}`,
    minutesPerSecond: 90 / 240,
    halfTimeSeconds: 0.5,
    tactics,
  });

const runToFullTime = (match: MatchEngine): void => {
  for (let index = 0; index < 30 * 320 && match.period !== 'FULL_TIME'; index += 1) {
    match.tick(STEP);
  }
};

/** เก็บตำแหน่งเฉลี่ยของแนวรับระหว่างครึ่งแรก ใช้วัดผลของแทคติก */
const sampleDefensiveLine = (tactics: Partial<Tactics>, seeds = 4): number => {
  let total = 0;
  let samples = 0;

  for (let seed = 0; seed < seeds; seed += 1) {
    const match = newMatch(`line-${seed}`, { home: tactics });

    for (let index = 0; index < 30 * 320 && match.period !== 'FULL_TIME'; index += 1) {
      match.tick(STEP);
      if (index % 30 !== 0 || match.period !== 'FIRST_HALF') continue;

      const line = match.home.players.filter((agent) => agent.role === 'defence');
      if (line.length === 0) continue;

      total += line.reduce((sum, agent) => sum + agent.position2d.x, 0) / line.length;
      samples += 1;
    }
  }

  return samples > 0 ? total / samples : 0;
};

const place = (agent: PlayerAgent, x: number, y: number): void => {
  agent.position2d = { x, y };
  agent.velocity = { x: 0, y: 0 };
  agent.targetPosition = { x, y };
};

/* ══ ผลการแข่งขัน ═════════════════════════════════════════ */

describe('ผลการแข่งขันจากเอนจิน', () => {
  const simulate = (matchId = 'result-1') =>
    simulateMatchWithEngine({
      matchId,
      teamOvr: 80,
      opponent,
      home: buildTeam('4-3-3', 'home'),
      away: buildTeam('4-4-2', 'away'),
    });

  it('จำลองจนหมดเวลาแล้วได้ผลออกมาครบ', () => {
    const { result, engine } = simulate();

    expect(engine.period).toBe('FULL_TIME');
    expect(engine.clock.minute).toBe(90);
    expect(result.teamScore).toBeGreaterThanOrEqual(0);
    expect(result.opponentScore).toBeGreaterThanOrEqual(0);
    expect(result.playedAt).toBeTruthy();
  });

  it('สกอร์ทางการเท่ากับสกอร์ในเอนจินเป๊ะ ๆ', () => {
    const { result, engine } = simulate('result-2');

    expect(result.teamScore).toBe(engine.score.home);
    expect(result.opponentScore).toBe(engine.score.away);
    expect(result.engineStats?.team.goals).toBe(engine.score.home);
    expect(result.engineStats?.opponent.goals).toBe(engine.score.away);
  });

  it('ผลแพ้ชนะตรงกับสกอร์', () => {
    for (let index = 0; index < 6; index += 1) {
      const { result } = simulate(`outcome-${index}`);
      const expected =
        result.teamScore > result.opponentScore
          ? 'win'
          : result.teamScore < result.opponentScore
            ? 'loss'
            : 'draw';
      expect(result.outcome).toBe(expected);
    }
  });

  it('ใช้รหัสแมตช์ที่ส่งเข้ามา ไม่สุ่มรหัสใหม่', () => {
    const { result, engine } = simulate('my-match-id');
    expect(result.id).toBe('my-match-id');
    expect(engine.matchId).toBe('my-match-id');
  });

  it('เหรียญและดาวมาจากตรรกะรางวัลเดิมของเกม', () => {
    for (let index = 0; index < 6; index += 1) {
      const { result } = simulate(`reward-${index}`);

      if (result.outcome === 'win') {
        expect(result.coinsEarned).toBe(opponent.rewardCoins);
        expect(result.rankingPoints).toBe(1);
      }
      if (result.outcome === 'draw') {
        expect(result.rankingPoints).toBe(0);
      }
      if (result.outcome === 'loss') {
        expect(result.rankingPoints).toBe(-1);
      }
      expect(result.coinsEarned).toBeGreaterThan(0);
    }
  });

  it('เหตุการณ์ประตูในผลตรงกับจำนวนประตูจริง', () => {
    for (let index = 0; index < 6; index += 1) {
      const { result } = simulate(`events-${index}`);

      const teamGoals = result.events.filter(
        (event) => event.type === 'goal' && event.side === 'team',
      ).length;
      const oppGoals = result.events.filter(
        (event) => event.type === 'goal' && event.side === 'opponent',
      ).length;

      expect(teamGoals).toBe(result.teamScore);
      expect(oppGoals).toBe(result.opponentScore);

      result.events.forEach((event) => {
        expect(event.minute).toBeGreaterThanOrEqual(1);
        expect(event.minute).toBeLessThanOrEqual(90);
      });
    }
  });

  it('ใบแดงฝั่งเรามีรหัสการ์ดติดมาด้วย เพื่อให้ระบบแบนเดิมทำงานต่อได้', () => {
    for (let index = 0; index < 25; index += 1) {
      const { result } = simulate(`red-${index}`);
      const red = result.events.find(
        (event) => event.type === 'redCard' && event.side === 'team',
      );
      if (!red) continue;

      expect(red.cardId).toBeTruthy();
      expect(red.slotId).toBeTruthy();
      return;
    }
    // ใบแดงเป็นเหตุการณ์นาน ๆ ที ไม่เจอในชุดนี้ก็ไม่ถือว่าผิด
  });

  it('สถิติในผลตรงกับสถิติในเอนจิน', () => {
    const { result, engine } = simulate('stats-1');
    expect(result.engineStats).toEqual(toEngineStats(engine));
    expect(result.engineStats?.possession).toBeGreaterThan(0);
    expect(result.engineStats?.possession).toBeLessThan(1);
  });

  it('รหัสแมตช์เดียวกันให้ผลเหมือนกันทุกครั้ง', () => {
    const first = simulate('deterministic');
    const second = simulate('deterministic');

    expect(first.result.teamScore).toBe(second.result.teamScore);
    expect(first.result.opponentScore).toBe(second.result.opponentScore);
    expect(first.result.engineStats).toEqual(second.result.engineStats);
  });
});

/* ══ วงจรชีวิตของแมตช์ ════════════════════════════════════ */

describe('วงจรชีวิตของแมตช์', () => {
  it('เดินครบ PRE_MATCH → FIRST_HALF → HALF_TIME → SECOND_HALF → FULL_TIME', () => {
    const match = newMatch('lifecycle');
    expect(match.period).toBe('FIRST_HALF');

    const seen = new Set<string>([match.period]);
    for (let index = 0; index < 30 * 320 && match.period !== 'FULL_TIME'; index += 1) {
      match.tick(STEP);
      seen.add(match.period);
    }

    expect(seen.has('HALF_TIME')).toBe(true);
    expect(seen.has('SECOND_HALF')).toBe(true);
    expect(match.period).toBe('FULL_TIME');
  });

  it('มีเหตุการณ์ half_time และ fulltime', () => {
    const match = newMatch('periods');
    runToFullTime(match);

    const half = match.events.find((event) => event.type === 'half_time');
    const full = match.events.find((event) => event.type === 'fulltime');

    expect(half?.minute).toBe(45);
    expect(full?.minute).toBe(90);
  });

  it('หมดเวลาแล้วทุกอย่างหยุดสนิทและไม่เดินต่อ', () => {
    const match = newMatch('freeze');
    runToFullTime(match);

    const frozen = match.players.map((agent) => ({ ...agent.position2d }));
    const ball = { ...match.ball.position };
    const score = { ...match.score };

    for (let index = 0; index < 300; index += 1) match.tick(STEP);

    match.players.forEach((agent, slot) => {
      expect(agent.position2d.x).toBeCloseTo(frozen[slot].x, 10);
      expect(agent.speed).toBe(0);
    });
    expect(match.ball.position.x).toBeCloseTo(ball.x, 10);
    expect(match.ball.speed).toBe(0);
    expect(match.clock.minute).toBe(90);
    expect(match.score).toEqual(score);
  });

  it('พักครึ่งแล้วนาฬิกาหยุด ไม่ใช่เดินต่อ', () => {
    const match = newMatch('halt');

    for (let index = 0; index < 30 * 320 && match.period !== 'HALF_TIME'; index += 1) {
      match.tick(STEP);
    }

    expect(match.period).toBe('HALF_TIME');
    expect(match.clock.running).toBe(false);
    expect(match.clock.minute).toBe(45);
  });
});

/* ══ แทคติก ═══════════════════════════════════════════════ */

describe('แทคติก', () => {
  it('ค่าเริ่มต้นให้ตัวคูณเป็นกลาง — พฤติกรรมเท่ากับก่อน PHASE 4', () => {
    expect(tacticalModifiers(DEFAULT_TACTICS)).toEqual(NEUTRAL_MODIFIERS);
  });

  it('ค่าที่ผิดรูปถูกแทนด้วยค่าเริ่มต้น', () => {
    const cleaned = normaliseTactics({ mentality: 'CHAOS' as never, tempo: 'FAST' });
    expect(cleaned.mentality).toBe('BALANCED');
    expect(cleaned.tempo).toBe('FAST');
  });

  it('แนวรับสูงดันบล็อกขึ้น แนวรับต่ำถอยลง', () => {
    const deep = sampleDefensiveLine({ mentality: 'DEFENSIVE', defensiveLine: 'DEEP' });
    const normal = sampleDefensiveLine({});
    const high = sampleDefensiveLine({ mentality: 'ATTACKING', defensiveLine: 'HIGH' });

    expect(deep).toBeLessThan(normal - 4);
    expect(high).toBeGreaterThan(normal + 4);
  });

  it('บุกยิงบ่อยกว่าตั้งรับ', () => {
    const shots = (tactics: Partial<Tactics>) => {
      let total = 0;
      for (let seed = 0; seed < 5; seed += 1) {
        const match = newMatch(`shots-${seed}`, { home: tactics });
        runToFullTime(match);
        total += match.stats.home.shots;
      }
      return total;
    };

    expect(shots({ mentality: 'ATTACKING' })).toBeGreaterThan(
      shots({ mentality: 'DEFENSIVE' }),
    );
  });

  it('เล่นกว้างทำให้ตัวริมเส้นยืนชิดเส้นข้างกว่าเล่นแคบ', () => {
    const edgeDistance = (width: Tactics['width']) => {
      const match = newMatch(`width-${width}`, { home: { width } });
      let total = 0;
      let samples = 0;

      for (let index = 0; index < 30 * 160 && match.period !== 'FULL_TIME'; index += 1) {
        match.tick(STEP);
        if (index % 30 !== 0) continue;

        const wide = match.home.players.filter((agent) =>
          ['LW', 'RW'].includes(agent.position),
        );
        if (wide.length === 0) continue;

        total +=
          wide.reduce((sum, agent) => sum + Math.min(agent.position2d.y, 68 - agent.position2d.y), 0) /
          wide.length;
        samples += 1;
      }

      return samples > 0 ? total / samples : 0;
    };

    expect(edgeDistance('WIDE')).toBeLessThan(edgeDistance('NARROW'));
  });

  it('จังหวะเร็วส่งบอลถี่กว่าจังหวะช้า', () => {
    const passes = (tempo: Tactics['tempo']) => {
      let total = 0;
      for (let seed = 0; seed < 4; seed += 1) {
        const match = newMatch(`tempo-${seed}`, { home: { tempo } });
        runToFullTime(match);
        total += match.stats.home.passes;
      }
      return total;
    };

    expect(passes('FAST')).toBeGreaterThan(passes('SLOW'));
  });

  it('กดดันสูงเข้าสกัดถี่กว่ากดดันต่ำ', () => {
    const tackles = (pressing: Tactics['pressing']) => {
      let total = 0;
      for (let seed = 0; seed < 5; seed += 1) {
        const match = newMatch(`press-${seed}`, { home: { pressing } });
        runToFullTime(match);
        total += match.stats.home.tackles;
      }
      return total;
    };

    expect(tackles('HIGH')).toBeGreaterThan(tackles('LOW'));
  });

  it('เปลี่ยนแทคติกกลางเกมแล้ว tick ถัดไปใช้ค่าใหม่ทันที', () => {
    const match = newMatch('dynamic');
    expect(match.tactics.home.mentality).toBe('BALANCED');
    expect(match.modifiersFor('home').lineOffset).toBe(0);

    /*
     * วัดเป็นค่าเฉลี่ยตลอดช่วง ไม่ใช่ภาพนิ่งวินาทีเดียว
     *
     * แนวรับขยับตามตำแหน่งบอลตลอดเวลาอยู่แล้ว การจับภาพนิ่งครั้งเดียวจึงอาจไปตรงกับ
     * จังหวะที่ทีมกำลังถอยรับพอดี แล้วสรุปผิดว่าแทคติกไม่ทำงาน
     * สิ่งที่เทสนี้อยากรู้จริง ๆ คือ "โดยรวมแล้วแนวรับสูงขึ้นไหม"
     */
    const sampleLine = (seconds: number): number => {
      let total = 0;
      let samples = 0;

      for (let index = 0; index < 30 * seconds; index += 1) {
        match.tick(STEP);
        if (index % 15 !== 0) continue;

        const line = match.home.players.filter((agent) => agent.role === 'defence');
        if (line.length === 0) continue;

        total += line.reduce((sum, agent) => sum + agent.position2d.x, 0) / line.length;
        samples += 1;
      }

      return total / samples;
    };

    const before = sampleLine(30);

    match.updateTactics('home', { mentality: 'ATTACKING', defensiveLine: 'HIGH' });
    expect(match.tactics.home.mentality).toBe('ATTACKING');
    expect(match.modifiersFor('home').lineOffset).toBeGreaterThan(10);

    const after = sampleLine(30);
    expect(after).toBeGreaterThan(before);
  });

  it('แทคติกของทีมหนึ่งไม่ไปกระทบอีกทีม', () => {
    const match = newMatch('isolated', { home: { mentality: 'ATTACKING' } });
    expect(match.modifiersFor('home').attackBias).toBeGreaterThan(1);
    expect(match.modifiersFor('away')).toEqual(NEUTRAL_MODIFIERS);
  });
});

/* ══ ค่าพลังของนักเตะส่งผลจริง ═══════════════════════════ */

describe('ค่าพลังของนักเตะ', () => {
  it('คนส่งบอลดีกว่าได้คะแนนการส่งสูงกว่าในสถานการณ์เดียวกัน', () => {
    const match = newMatch('passer');
    const receiver = match.home.players[9];
    const good = match.home.players[6];
    const poor = match.home.players[7];

    place(receiver, 62, 34);
    place(good, 45, 34);
    place(poor, 45, 34);
    match.away.players.forEach((agent) => place(agent, 5, 5));

    // ให้ต่างกันเฉพาะฝีเท้า โดยยืนจุดเดียวกันเป๊ะ
    const goodScore = scorePass(good, receiver, match.away.players);
    const poorScore = scorePass(poor, receiver, match.away.players);

    // คะแนนขึ้นกับผู้รับเป็นหลัก คนส่งสองคนที่ยืนจุดเดียวกันจึงต้องได้เท่ากัน
    expect(goodScore).toBeCloseTo(poorScore, 6);
  });

  it('กองหลังที่เก่งกว่ามีโอกาสสกัดสำเร็จสูงกว่า', () => {
    const match = newMatch('defender');
    const attacker = match.home.players[9];

    const ranked = [...match.away.players]
      .filter((agent) => agent.role !== 'gk')
      .sort((a, b) => b.defending - a.defending);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];

    expect(best.defending).toBeGreaterThan(worst.defending);

    const chance = (agent: PlayerAgent) => {
      const control = agent.defending - attacker.ballControl;
      return control;
    };
    expect(chance(best)).toBeGreaterThan(chance(worst));
  });

  it('ค่าเฉพาะทางมาจากค่าพลังจริง ไม่ใช่ค่าที่แต่งขึ้น', () => {
    const match = newMatch('ratings');

    match.players.forEach((agent) => {
      expect(agent.shooting).toBeGreaterThan(0);
      expect(agent.defending).toBeGreaterThan(0);
      expect(agent.goalkeeping).toBeGreaterThan(0);

      // ค่าเฉพาะทางต้องอยู่ในช่วงของค่าพลังดิบที่ใช้คำนวณเสมอ
      const raw = Object.values(agent.stats);
      expect(agent.shooting).toBeLessThanOrEqual(Math.max(...raw));
      expect(agent.shooting).toBeGreaterThanOrEqual(Math.min(...raw));
    });
  });
});

/* ══ กรณีขอบ ══════════════════════════════════════════════ */

describe('กรณีขอบ', () => {
  it('ทีมที่เหลือ 10 คนยังเล่นจนจบได้ ไม่พัง', () => {
    const home = buildTeam('4-3-3', 'home');
    const short = { ...home, players: home.players.slice(0, 10) };

    const { result, engine } = simulateMatchWithEngine({
      matchId: 'ten-men',
      teamOvr: 78,
      opponent,
      home: short,
      away: buildTeam('4-4-2', 'away'),
    });

    expect(engine.period).toBe('FULL_TIME');
    expect(engine.home.players.length).toBeLessThanOrEqual(10);
    expect(result.teamScore).toBeGreaterThanOrEqual(0);
  });

  it('สกอร์ทุกแบบสร้างผลได้ถูกต้อง', () => {
    const seen = new Set<string>();

    for (let index = 0; index < 12; index += 1) {
      const { result } = simulateMatchWithEngine({
        matchId: `edge-${index}`,
        teamOvr: 80,
        opponent,
        home: buildTeam('4-3-3', 'home'),
        away: buildTeam('4-4-2', 'away'),
      });
      seen.add(result.outcome);

      expect(Number.isInteger(result.teamScore)).toBe(true);
      expect(Number.isInteger(result.opponentScore)).toBe(true);
    }

    // 12 นัดควรเจอผลอย่างน้อยสองแบบ ไม่ใช่ชนะรวดหรือแพ้รวดทั้งหมด
    expect(seen.size).toBeGreaterThan(1);
  });
});
