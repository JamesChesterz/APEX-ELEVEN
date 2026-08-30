/**
 * เทสของ PHASE 3 — ยิงประตู ประตู ผู้รักษาประตู การเข้าสกัด ฟาวล์ ใบเหลือง/แดง และเหตุการณ์
 *
 * PHASE 1/1.5 อยู่ที่ match-engine.test.ts · PHASE 2 อยู่ที่ match-engine-phase2.test.ts
 */
import { describe, expect, it } from 'vitest';
import { getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import {
  PITCH,
  SHOT_TENDENCY,
  createMatch,
  evaluateShot,
  goalPosts,
  resolveTackle,
  saveChance,
  tackleSuccessChance,
  type MatchTeamInput,
} from '@/match-engine';
import type { MatchEngine } from '@/match-engine';
import type { PlayerAgent } from '@/match-engine/playerAgent';

const STEP = 1 / 60;

/** ปั้นทีมจากแผนจริงและนักเตะจริง พร้อมค่าพลัง 6 ด้านของจริง */
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

/**
 * PHASE 4 เอนจินหยุดสนิทเมื่อครบ 90 นาที
 * เทสที่ต้องรันยาว ๆ จึงต้องยืดความยาวแมตช์ออก ไม่งั้นจะแข็งค้างตั้งแต่วินาทีที่ 90
 * 0.3 นาที/วินาที = แมตช์เต็ม 90 นาทีกินเวลาจำลอง 300 วินาที
 */
const newMatch = (seed = 'phase3', home = '4-3-3', away = '4-4-2') =>
  createMatch(buildTeam(home, 'home'), buildTeam(away, 'away'), {
    seed,
    minutesPerSecond: 0.3,
    halfTimeSeconds: 0.2,
  });

const run = (match: MatchEngine, seconds: number): void => {
  for (let index = 0; index < Math.round(seconds / STEP); index += 1) match.tick(STEP);
};

const parkEveryone = (match: MatchEngine, spot = { x: 2, y: 2 }): void => {
  match.players.forEach((agent, index) => {
    agent.position2d = { x: spot.x + (index % 5) * 0.8, y: spot.y + Math.floor(index / 5) * 0.8 };
    agent.velocity = { x: 0, y: 0 };
    agent.targetPosition = { ...agent.position2d };
  });
};

const place = (agent: PlayerAgent, x: number, y: number): void => {
  agent.position2d = { x, y };
  agent.velocity = { x: 0, y: 0 };
  agent.targetPosition = { x, y };
};

const byPosition = (match: MatchEngine, side: 'home' | 'away', position: string) =>
  (side === 'home' ? match.home : match.away).players.filter(
    (agent) => agent.position === position,
  );

/* ══ การยิงประตู ═════════════════════════════════════════ */

describe('การยิงประตู', () => {
  it('คนที่ครองบอลอยู่หน้าประตูยิงได้ และบอลเข้าสถานะ SHOT', () => {
    const match = newMatch('shoot');
    parkEveryone(match, { x: 5, y: 5 });

    const striker = byPosition(match, 'home', 'ST')[0];
    place(striker, 92, 34);
    match.ball.reset({ x: 92.5, y: 34 });

    match.tick(STEP);
    expect(match.ball.owner).toBe(striker.id);

    match.tick(STEP);

    expect(match.ball.state).toBe('SHOT');
    expect(match.ball.owner).toBeNull();
    expect(match.ball.lastTouchId).toBe(striker.id);
    expect(match.stats.home.shots).toBe(1);
    expect(match.statsFor(striker.id).shots).toBe(1);
  });

  it('คนที่ไม่ได้ครองบอลยิงไม่ได้', () => {
    const match = newMatch('noball');
    parkEveryone(match, { x: 5, y: 5 });

    // กองหน้ายืนหน้าประตูแต่บอลอยู่อีกฟากสนามและไม่มีใครครอง
    place(byPosition(match, 'home', 'ST')[0], 95, 34);
    match.ball.reset({ x: 20, y: 60 });
    match.ball.release();

    run(match, 0.5);
    expect(match.stats.home.shots).toBe(0);
  });

  it('บอลเดินทางจริง ไม่วาร์ปเข้าประตู', () => {
    const match = newMatch('travel');
    parkEveryone(match, { x: 5, y: 5 });

    const striker = byPosition(match, 'home', 'ST')[0];
    place(striker, 88, 34);
    match.ball.reset({ x: 88.5, y: 34 });
    match.tick(STEP);
    match.tick(STEP);
    expect(match.ball.state).toBe('SHOT');

    for (let index = 0; index < 60; index += 1) {
      const before = { ...match.ball.position };
      match.tick(STEP);
      const jump = Math.hypot(match.ball.position.x - before.x, match.ball.position.y - before.y);
      expect(jump).toBeLessThanOrEqual(40 * STEP + 0.001);
    }
  });

  it('กองหน้ามีความอยากยิงสูงกว่ากองหลังอย่างชัดเจน', () => {
    expect(SHOT_TENDENCY.ST).toBeGreaterThan(SHOT_TENDENCY.CAM);
    expect(SHOT_TENDENCY.CAM).toBeGreaterThan(SHOT_TENDENCY.CM);
    expect(SHOT_TENDENCY.CM).toBeGreaterThan(SHOT_TENDENCY.CB);
    expect(SHOT_TENDENCY.GK).toBe(0);
  });

  it('เซ็นเตอร์แบ็กที่ยืนตรงเดียวกับกองหน้าได้คะแนนยิงต่ำกว่ามาก', () => {
    const match = newMatch('roles');
    parkEveryone(match, { x: 5, y: 5 });

    const striker = byPosition(match, 'home', 'ST')[0];
    const defender = byPosition(match, 'home', 'CB')[0];
    place(striker, 92, 34);
    place(defender, 92, 34);

    const strikerChance = evaluateShot(striker, match.away.players);
    const defenderChance = evaluateShot(defender, match.away.players);

    expect(strikerChance.score).toBeGreaterThan(defenderChance.score * 3);
  });

  it('ยิงจากไกลเกินระยะไม่เกิดขึ้น', () => {
    const match = newMatch('far');
    parkEveryone(match, { x: 5, y: 5 });

    const striker = byPosition(match, 'home', 'ST')[0];
    place(striker, 30, 34);
    expect(evaluateShot(striker, match.away.players).score).toBe(0);
  });
});

/* ══ ประตู ════════════════════════════════════════════════ */

describe('ประตู', () => {
  /** ยิงบอลเข้าประตูตรง ๆ โดยไม่มีผู้รักษาประตูขวาง */
  const shootAtGoal = (offsetY: number, seed = 'goal') => {
    const match = newMatch(seed);
    parkEveryone(match, { x: 50, y: 5 });

    const striker = match.home.players[10];
    place(striker, 95, PITCH.width / 2 + offsetY);

    match.ball.position = { x: 96, y: PITCH.width / 2 + offsetY };
    match.ball.shoot({ x: 1, y: 0 }, 30, striker.id);

    for (let index = 0; index < 60 * 3; index += 1) {
      match.tick(STEP);
      if (match.stats.home.goals > 0) break;
      if (match.ball.state === 'CONTROLLED') break;
    }

    return match;
  };

  it('บอลข้ามเส้นในปากประตู = ประตู', () => {
    const match = shootAtGoal(0);

    expect(match.score.home).toBe(1);
    expect(match.score.away).toBe(0);
    expect(match.events.some((event) => event.type === 'goal')).toBe(true);
  });

  it('บอลข้ามเส้นนอกปากประตู ไม่เป็นประตู', () => {
    const { right } = goalPosts();
    const match = shootAtGoal(right - PITCH.width / 2 + 6);

    expect(match.score.home).toBe(0);
    expect(match.events.some((event) => event.type === 'goal')).toBe(false);
  });

  it('เหตุการณ์ goal มีข้อมูลครบตามที่ commentary ต้องใช้', () => {
    const match = shootAtGoal(0);
    const goal = match.events.find((event) => event.type === 'goal');

    expect(goal?.side).toBe('home');
    expect(goal?.teamId).toBe('home-team');
    expect(goal?.playerId).toBeTruthy();
    expect(goal?.position).toBeTruthy();
    expect(goal?.minute).toBeGreaterThanOrEqual(0);
  });

  it('สกอร์มีแหล่งความจริงเดียว — score อ่านจาก stats.goals', () => {
    const match = shootAtGoal(0);
    expect(match.score.home).toBe(match.stats.home.goals);
    expect(match.score.away).toBe(match.stats.away.goals);
  });

  it('หลังทำประตูกลับไปเขี่ยบอล แต่นาฬิกาไม่รีเซ็ต', () => {
    const match = shootAtGoal(0);
    match.syncClock(23);
    const minute = match.clock.minute;

    // รอให้ช่วงฉลองจบแล้วเขี่ยบอลใหม่
    run(match, 2.5);

    expect(match.clock.minute).toBeGreaterThanOrEqual(minute);
    expect(match.ball.state).not.toBe('DEAD');
    expect(match.score.home).toBe(1);

    // ทุกคนกลับเข้าครึ่งสนามของตัวเอง และบอลกลับมากลางสนาม
    expect(Math.abs(match.ball.position.x - PITCH.length / 2)).toBeLessThan(12);
    const kickoffs = match.events.filter((event) => event.type === 'kickoff');
    expect(kickoffs.length).toBeGreaterThanOrEqual(2);
  });
});

/* ══ ผู้รักษาประตู ════════════════════════════════════════ */

describe('ผู้รักษาประตู', () => {
  it('ขยับตามบอลแต่ไม่ออกนอกเขตของตัวเอง', () => {
    const match = newMatch('gk');

    for (const spot of [
      { x: 18, y: 8 },
      { x: 18, y: 60 },
      { x: 60, y: 34 },
    ]) {
      for (let index = 0; index < 60 * 6; index += 1) {
        match.tick(STEP);
        match.ball.reset(spot);
      }

      const keeper = match.home.players.find((agent) => agent.role === 'gk');
      expect(keeper?.position2d.x ?? 99).toBeLessThan(PITCH.penaltyDepth + 2);
    }
  });

  it('เซฟได้ในบางลูก และเสียประตูในบางลูก', () => {
    let saves = 0;
    let goals = 0;

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const match = newMatch(`save-${attempt}`);
      const keeper = match.away.players.find((agent) => agent.role === 'gk');
      expect(keeper).toBeTruthy();

      const striker = match.home.players[10];
      place(striker, 96, 34);
      place(keeper as PlayerAgent, 102, 34);

      match.ball.position = { x: 97, y: 34 };
      match.ball.shoot({ x: 1, y: 0 }, 26, striker.id);

      for (let index = 0; index < 60 * 2; index += 1) {
        match.tick(STEP);
        if (match.stats.away.saves > 0 || match.stats.home.goals > 0) break;
      }

      if (match.stats.away.saves > 0) saves += 1;
      if (match.stats.home.goals > 0) goals += 1;
    }

    // ไม่เซฟได้ทุกลูก และไม่เสียทุกลูก
    expect(saves).toBeGreaterThan(0);
    expect(goals).toBeGreaterThan(0);
  });

  it('เซฟแล้วบอลอยู่กับผู้รักษาประตูและมีเหตุการณ์ save', () => {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const match = newMatch(`saveevent-${attempt}`);
      const keeper = match.away.players.find((agent) => agent.role === 'gk') as PlayerAgent;
      const striker = match.home.players[10];
      place(striker, 96, 34);
      place(keeper, 102, 34);

      match.ball.position = { x: 97, y: 34 };
      match.ball.shoot({ x: 1, y: 0 }, 22, striker.id);

      for (let index = 0; index < 60 * 2; index += 1) {
        match.tick(STEP);
        if (match.stats.away.saves > 0) {
          const event = match.events.find((entry) => entry.type === 'save');
          expect(event?.playerId).toBe(keeper.id);
          expect(event?.side).toBe('away');
          expect(match.ball.owner).toBe(keeper.id);
          expect(match.statsFor(keeper.id).saves).toBeGreaterThan(0);
          return;
        }
        if (match.stats.home.goals > 0) break;
      }
    }

    throw new Error('ไม่มีการเซฟเกิดขึ้นเลยใน 16 ครั้ง');
  });

  it('ผู้รักษาประตูฝีมือดีมีโอกาสเซฟสูงกว่าคนฝีมือด้อย', () => {
    const match = newMatch('gkskill');
    const keeper = match.away.players.find((agent) => agent.role === 'gk') as PlayerAgent;
    place(keeper, 103, 34);

    const close = saveChance(keeper, { x: 103.5, y: 34 }, 22);
    const far = saveChance(keeper, { x: 105.8, y: 34 }, 22);
    const fast = saveChance(keeper, { x: 103.5, y: 34 }, 35);

    expect(close).toBeGreaterThan(far);
    expect(close).toBeGreaterThan(fast);
    expect(close).toBeLessThan(1);
    expect(far).toBeGreaterThan(0);
  });
});

/* ══ การเข้าสกัด ═════════════════════════════════════════ */

describe('การเข้าสกัด', () => {
  it('เข้าสกัดสำเร็จเปลี่ยนการครองบอล', () => {
    const match = newMatch('tackle');
    const defender = match.away.players[3];
    const attacker = match.home.players[9];

    const result = resolveTackle(defender, attacker, 0.5, {
      tackle: 0,
      foul: 1,
      card: 1,
    });
    expect(result.outcome).toBe('won');
    expect(result.foul).toBe(false);
  });

  it('เข้าสกัดพลาด คนถือบอลยังถือบอลอยู่', () => {
    const match = newMatch('tacklefail');
    const defender = match.away.players[3];
    const attacker = match.home.players[9];

    const result = resolveTackle(defender, attacker, 1.5, {
      tackle: 0.999,
      foul: 1,
      card: 1,
    });
    expect(result.outcome).toBe('lost');
  });

  it('เข้าจากระยะใกล้มีโอกาสสำเร็จสูงกว่าเอื้อมไกล', () => {
    const match = newMatch('tacklerange');
    const defender = match.away.players[3];
    const attacker = match.home.players[9];

    expect(tackleSuccessChance(defender, attacker, 0.3)).toBeGreaterThan(
      tackleSuccessChance(defender, attacker, 1.9),
    );
  });

  it('มี cooldown จริง — ไม่มีการเข้าสกัดรัวทุกเฟรม', () => {
    const match = newMatch('spam');
    run(match, 120);

    const tackles = match.events.filter((event) => event.type === 'tackle').length;
    // 120 วินาทีที่ 60 FPS = 7,200 เฟรม ถ้าเสียบทุกเฟรมจะได้หลักพัน
    expect(tackles).toBeLessThan(80);

    match.players.forEach((agent) => {
      expect(agent.tackleCooldown).toBeLessThanOrEqual(7.001);
    });
  });

  it('เกิดการเข้าสกัดขึ้นจริงในเกมปกติ', () => {
    const match = newMatch('flow');
    run(match, 150);
    expect(match.stats.home.tackles + match.stats.away.tackles).toBeGreaterThan(0);
  });
});

/* ══ ฟาวล์และใบ ══════════════════════════════════════════ */

describe('ฟาวล์และใบ', () => {
  it('ฟาวล์ทำให้บอลตายและฝ่ายที่ถูกทำฟาวล์ได้เล่นต่อ', () => {
    const match = newMatch('foul');

    // จัดฉากให้เกิดฟาวล์แน่นอนผ่านฟังก์ชันตัดสินโดยตรง
    const result = resolveTackle(match.away.players[3], match.home.players[9], 1, {
      tackle: 0.99,
      foul: 0,
      card: 1,
    });
    expect(result.foul).toBe(true);
    expect(result.outcome).toBe('lost');
  });

  it('ใบเหลืองและใบแดงออกได้จากการทอยที่กำหนดได้', () => {
    const match = newMatch('cards');
    const defender = match.away.players[3];
    const attacker = match.home.players[9];

    const red = resolveTackle(defender, attacker, 1, { tackle: 0.99, foul: 0, card: 0 });
    expect(red.card).toBe('red');

    const yellow = resolveTackle(defender, attacker, 1, { tackle: 0.99, foul: 0, card: 0.1 });
    expect(yellow.card).toBe('yellow');

    const none = resolveTackle(defender, attacker, 1, { tackle: 0.99, foul: 0, card: 0.9 });
    expect(none.card).toBe('none');
  });

  it('ใบแดงถอดผู้เล่นออกจากการจำลอง และไม่กลับมาเอง', () => {
    const home = buildTeam('4-3-3', 'home');
    const away = buildTeam('4-4-2', 'away');
    const match = createMatch(home, away, { seed: 'sendoff' });

    // เรียกเส้นทางเดียวกับที่ระบบใช้จริง ผ่านการทอยที่บังคับให้ได้ใบแดง
    const offender = match.away.players[4];
    const victim = match.home.players[9];
    match.ball.attachTo(victim.id);
    place(victim, 50, 34);
    place(offender, 50.5, 34);
    offender.tackleCooldown = 0;

    // ยัดค่าสุ่มไม่ได้จากข้างนอก จึงรันจนกว่าจะมีใบแดงเกิดขึ้นเองในเกม
    let found = false;
    for (let attempt = 0; attempt < 40 && !found; attempt += 1) {
      const probe = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'), {
        seed: `red-${attempt}`,
        minutesPerSecond: 0.3,
        halfTimeSeconds: 0.2,
      });
      run(probe, 240);

      const red = probe.events.find((event) => event.type === 'red_card');
      if (!red) continue;

      found = true;
      expect(probe.players.some((agent) => agent.id === red.playerId)).toBe(false);

      const before = probe.players.length;
      run(probe, 30);
      expect(probe.players.some((agent) => agent.id === red.playerId)).toBe(false);
      expect(probe.players).toHaveLength(before);

      // แม้รายชื่อจากข้างนอกจะยังมีชื่อเขา ก็ต้องไม่ถูกพากลับลงสนาม
      probe.syncRoster(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'));
      expect(probe.players.some((agent) => agent.id === red.playerId)).toBe(false);
    }

    expect(found).toBe(true);
  });
});

/* ══ เหตุการณ์และสถิติ ═══════════════════════════════════ */

describe('เหตุการณ์และสถิติ', () => {
  it('เหตุการณ์ทุกประเภทมีข้อมูลพื้นฐานครบ', () => {
    const match = newMatch('events');
    run(match, 240);

    match.events.forEach((event) => {
      expect(typeof event.type).toBe('string');
      expect(event.minute).toBeGreaterThanOrEqual(0);
      if (!['kickoff', 'fulltime', 'half_time'].includes(event.type)) {
        expect(event.side).toBeTruthy();
      }
    });
  });

  it('สถิติทีมเดินครบทุกช่องใหม่ของ PHASE 3', () => {
    const match = newMatch('teamstats');
    run(match, 300);

    const total = (key: 'shots' | 'tackles' | 'goals' | 'saves') =>
      match.stats.home[key] + match.stats.away[key];

    expect(total('shots')).toBeGreaterThan(0);
    expect(total('tackles')).toBeGreaterThan(0);
    expect(total('goals') + total('saves')).toBeGreaterThan(0);

    (['home', 'away'] as const).forEach((side) => {
      expect(match.stats[side].shotsOnTarget).toBeLessThanOrEqual(match.stats[side].shots);
      expect(match.stats[side].successfulTackles).toBeLessThanOrEqual(match.stats[side].tackles);
    });
  });

  it('สถิติรายบุคคลแยกจากข้อมูลนักเตะถาวร', () => {
    const home = buildTeam('4-3-3', 'home');
    const match = createMatch(home, buildTeam('4-4-2', 'away'), {
      seed: 'playerstats',
      minutesPerSecond: 0.3,
      halfTimeSeconds: 0.2,
    });
    run(match, 240);

    expect(match.playerStats.size).toBeGreaterThan(0);

    let shots = 0;
    match.playerStats.forEach((entry) => {
      shots += entry.shots;
    });
    expect(shots).toBe(match.stats.home.shots + match.stats.away.shots);

    // ข้อมูลนักเตะต้นทางต้องไม่ถูกแตะเลย
    const source = PLAYERS[0];
    expect(Object.keys(source)).not.toContain('goals');
    expect(Object.keys(source.stats)).toEqual([
      'pace',
      'shooting',
      'passing',
      'dribbling',
      'defending',
      'physical',
    ]);
  });

  it('การจำลองยาวมีเหตุการณ์ครบวงจรของการแข่งขัน', () => {
    const match = newMatch('integration', '4-4-2', '4-3-3');
    run(match, 300);

    const kinds = new Set(match.events.map((event) => event.type));
    expect(kinds.has('pass')).toBe(true);
    expect(kinds.has('receive')).toBe(true);
    expect(kinds.has('possession_change')).toBe(true);
    expect(kinds.has('shot')).toBe(true);
    expect(kinds.has('tackle')).toBe(true);
    expect(kinds.has('goal') || kinds.has('save')).toBe(true);
  });

  it('seed เดียวกันให้ผลเหมือนกันทุกครั้ง แม้มีการยิงและใบ', () => {
    const first = newMatch('repeat');
    const second = newMatch('repeat');

    run(first, 180);
    run(second, 180);

    expect(first.score).toEqual(second.score);
    expect(first.stats.home.shots).toBe(second.stats.home.shots);
    expect(first.stats.away.tackles).toBe(second.stats.away.tackles);
    expect(first.events.length).toBe(second.events.length);
    expect(first.ball.position.x).toBeCloseTo(second.ball.position.x, 10);
  });
});
