/**
 * เทสของ Match Engine (PHASE 1 + 1.5)
 *
 * รันแบบไม่มี DOM ได้ เพราะเอนจินไม่แตะ canvas เลย
 * ครอบคลุมทุกข้อของ Acceptance Criteria และสถานการณ์ที่ PHASE 1.5 กำหนดให้ตรวจ
 */
import { describe, expect, it } from 'vitest';
import { FORMATIONS, getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import { createMatch, formationToWorld, PITCH, type MatchTeamInput } from '@/match-engine';
import type { MatchEngine } from '@/match-engine';
import type { Vec2 } from '@/match-engine';

/** ปั้นทีมทดสอบจากแผนจริงและนักเตะจริงในเกม (ไม่ hardcode นักเตะ 22 คน) */
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
        slotId: slot.id,
        formationX: slot.x,
        formationY: slot.y,
      };
    }),
  };
};

const STEP = 1 / 60;

/** เดินการจำลองไปข้างหน้าตามจำนวนวินาทีที่กำหนด ด้วย timestep คงที่ */
const run = (match: MatchEngine, seconds: number): void => {
  for (let index = 0; index < Math.round(seconds / STEP); index += 1) match.tick(STEP);
};

/**
 * เดินการจำลองโดยตรึงบอลไว้ที่จุดหนึ่ง
 * ใช้ตรวจว่าเมื่อบอลอยู่ตรงนั้น ทีมจัดตัวกันอย่างไร โดยไม่ต้องลุ้นให้บอลกลิ้งไปเอง
 */
const runWithBallAt = (match: MatchEngine, spot: Vec2, seconds: number): void => {
  for (let index = 0; index < Math.round(seconds / STEP); index += 1) {
    match.tick(STEP);
    match.ball.reset(spot);
  }
};

const outfield = (match: MatchEngine, side: 'home' | 'away') =>
  (side === 'home' ? match.home : match.away).players.filter((agent) => agent.role !== 'gk');

const byRole = (match: MatchEngine, side: 'home' | 'away', role: string) =>
  (side === 'home' ? match.home : match.away).players.filter((agent) => agent.role === role);

const mean = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length;

/* ══ พื้นฐาน ══════════════════════════════════════════════ */

describe('การตั้งทีม', () => {
  it('ลงสนาม 22 คนจากแผนจริงของทั้งสองทีม', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'));

    expect(match.players).toHaveLength(22);
    expect(match.home.players).toHaveLength(11);
    expect(match.away.players).toHaveLength(11);
  });

  it('ตำแหน่งเริ่มต้นตรงกับ formation และแต่ละทีมอยู่คนละครึ่งสนาม', () => {
    const home = buildTeam('4-3-3', 'home');
    const match = createMatch(home, buildTeam('4-3-3', 'away'));

    home.players.forEach((input) => {
      const agent = match.home.players.find((entry) => entry.slotId === input.slotId);
      const expected = formationToWorld(input.formationX, input.formationY, 'home');
      expect(agent?.position2d.x).toBeCloseTo(expected.x, 5);
      expect(agent?.position2d.y).toBeCloseTo(expected.y, 5);
    });

    const homeKeeper = match.home.players.find((agent) => agent.role === 'gk');
    const awayKeeper = match.away.players.find((agent) => agent.role === 'gk');
    expect(homeKeeper?.position2d.x).toBeLessThan(PITCH.length / 2);
    expect(awayKeeper?.position2d.x).toBeGreaterThan(PITCH.length / 2);
  });

  it('รองรับทุกแผนที่มีในเกมโดยไม่พัง', () => {
    FORMATIONS.forEach((formation) => {
      const match = createMatch(buildTeam(formation.id, 'home'), buildTeam(formation.id, 'away'));
      run(match, 10);
      expect(match.players).toHaveLength(22);
    });
  });

  it('แผนเดียวกันของสองทีมกลับด้านกันเป๊ะ (mapping จุดเดียวใน pitch.ts)', () => {
    ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'].forEach((id) => {
      const match = createMatch(buildTeam(id, 'home'), buildTeam(id, 'away'));

      match.home.players.forEach((agent) => {
        const mirror = match.away.players.find((entry) => entry.slotId === agent.slotId);
        // ช่องเดียวกันของสองทีมต้องบวกกันได้ความยาว/ความกว้างสนามพอดี
        expect((mirror?.formationPosition.x ?? 0) + agent.formationPosition.x).toBeCloseTo(
          PITCH.length,
          6,
        );
        expect((mirror?.formationPosition.y ?? 0) + agent.formationPosition.y).toBeCloseTo(
          PITCH.width,
          6,
        );
      });
    });
  });
});

/* ══ การเคลื่อนที่ ════════════════════════════════════════ */

describe('การเคลื่อนที่', () => {
  it('นักเตะเคลื่อนที่จริง แต่ยังอยู่ในสนามและไม่หลุดรูปทีม', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-2-3-1', 'away'));
    const before = match.players.map((agent) => ({ ...agent.position2d }));

    run(match, 20);

    const moved = match.players.filter((agent, index) => {
      const start = before[index];
      return Math.hypot(agent.position2d.x - start.x, agent.position2d.y - start.y) > 1;
    });
    expect(moved.length).toBeGreaterThan(15);

    match.players.forEach((agent) => {
      expect(agent.position2d.x).toBeGreaterThanOrEqual(0);
      expect(agent.position2d.x).toBeLessThanOrEqual(PITCH.length);
      expect(agent.position2d.y).toBeGreaterThanOrEqual(0);
      expect(agent.position2d.y).toBeLessThanOrEqual(PITCH.width);

      const drift = Math.hypot(
        agent.position2d.x - agent.formationPosition.x,
        agent.position2d.y - agent.formationPosition.y,
      );
      expect(drift).toBeLessThan(38);
    });
  });

  it('ไม่มีการ teleport — ระยะที่ขยับต่อ tick ไม่เกินความเร็วสูงสุดของตัวเอง', () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-3-3', 'away'));

    for (let index = 0; index < 60 * 30; index += 1) {
      const before = match.players.map((agent) => ({ ...agent.position2d }));
      match.tick(STEP);

      match.players.forEach((agent, slot) => {
        const step = Math.hypot(
          agent.position2d.x - before[slot].x,
          agent.position2d.y - before[slot].y,
        );
        expect(step).toBeLessThanOrEqual(agent.topSpeed * STEP + 0.001);
      });
    }
  });

  it('เอนจินเดินซ้ำได้เหมือนเดิมทุกครั้งเมื่อ seed เท่ากัน', () => {
    const first = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'), {
      seed: 'verify',
    });
    const second = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'), {
      seed: 'verify',
    });

    run(first, 25);
    run(second, 25);

    first.players.forEach((agent, index) => {
      expect(agent.position2d.x).toBeCloseTo(second.players[index].position2d.x, 10);
      expect(agent.position2d.y).toBeCloseTo(second.players[index].position2d.y, 10);
    });
    expect(first.ball.position.x).toBeCloseTo(second.ball.position.x, 10);
  });
});

/* ══ Player AI ตามสถานการณ์ ══════════════════════════════ */

describe('Player AI: บอลอยู่กลางสนาม', () => {
  const setup = () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-3-3', 'away'));
    runWithBallAt(match, { x: PITCH.length / 2, y: PITCH.width / 2 }, 12);
    return match;
  };

  it('กองหลังรักษาแนวรับเป็นเส้นเดียวกันและอยู่ในแดนตัวเอง', () => {
    const match = setup();
    const line = byRole(match, 'home', 'defence').map((agent) => agent.position2d.x);

    expect(Math.max(...line) - Math.min(...line)).toBeLessThan(9);
    line.forEach((x) => expect(x).toBeLessThan(PITCH.length / 2));
  });

  it('กองกลางอยู่ใกล้บอลกว่ากองหลัง และกองหน้ายังยืนสูง', () => {
    const match = setup();
    const centre = { x: PITCH.length / 2, y: PITCH.width / 2 };

    const midGap = mean(byRole(match, 'home', 'midfield').map((a) => a.distanceTo(centre)));
    const defGap = mean(byRole(match, 'home', 'defence').map((a) => a.distanceTo(centre)));
    expect(midGap).toBeLessThan(defGap);

    byRole(match, 'home', 'attack').forEach((agent) => {
      expect(agent.position2d.x).toBeGreaterThan(PITCH.length / 2);
    });
  });

  it('มีคนยุ่งกับบอลฝั่งละหนึ่งคนเท่านั้น ไม่ใช่ทั้งทีมรุมบอล', () => {
    const match = setup();

    // PHASE 2 มีสถานะที่เกี่ยวกับบอลหลายแบบ นับรวมกันแล้วต้องได้ฝั่งละคนเดียว
    const engaged = new Set(['MOVING_TO_BALL', 'ON_BALL', 'PRESSING', 'RECEIVING']);

    (['home', 'away'] as const).forEach((side) => {
      const busy = (side === 'home' ? match.home : match.away).players.filter((agent) =>
        engaged.has(agent.state),
      );
      expect(busy).toHaveLength(1);
    });

    expect(match.chaserIds.home).toBeTruthy();
    expect(match.chaserIds.away).toBeTruthy();
  });
});

describe('Player AI: บอลเข้าเขตป้องกันของเรา', () => {
  const spot = { x: 14, y: 30 };

  const setup = () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-3-3', 'away'));
    runWithBallAt(match, spot, 14);
    return match;
  };

  it('มีคนเข้าไปสกัดคนเดียว ที่เหลือรักษารูปแนวรับ', () => {
    const match = setup();

    const chasers = match.home.players.filter((agent) => agent.state === 'MOVING_TO_BALL');
    expect(chasers).toHaveLength(1);

    // กองหลังที่ไม่ได้ไล่บอลต้องไม่ถูกดูดเข้าไปกองรวมกันที่ลูกบอล
    const others = byRole(match, 'home', 'defence').filter(
      (agent) => agent.id !== chasers[0]?.id,
    );
    others.forEach((agent) => {
      expect(agent.distanceTo(spot)).toBeGreaterThan(4);
    });
  });

  it('กองหน้าไม่วิ่งกลับมาช่วยเกมรับทั้งแผง', () => {
    const match = setup();
    const forwards = byRole(match, 'home', 'attack');

    forwards.forEach((agent) => {
      expect(agent.position2d.x).toBeGreaterThan(PITCH.length / 2 - 12);
      expect(agent.distanceTo(spot)).toBeGreaterThan(25);
    });
  });

  it('ทั้งทีมถอยลงต่ำกว่าตอนบอลอยู่กลางสนาม', () => {
    const deep = setup();

    const high = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-3-3', 'away'));
    runWithBallAt(high, { x: PITCH.length / 2, y: PITCH.width / 2 }, 14);

    expect(mean(outfield(deep, 'home').map((a) => a.position2d.x))).toBeLessThan(
      mean(outfield(high, 'home').map((a) => a.position2d.x)),
    );
  });
});

describe('Player AI: บอลไปริมสนาม', () => {
  it('ทั้งบล็อกเลื่อนตามฝั่งที่บอลอยู่', () => {
    const left = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'));
    runWithBallAt(left, { x: PITCH.length / 2, y: 6 }, 14);

    const right = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'));
    runWithBallAt(right, { x: PITCH.length / 2, y: PITCH.width - 6 }, 14);

    expect(mean(outfield(left, 'home').map((a) => a.position2d.y))).toBeLessThan(
      mean(outfield(right, 'home').map((a) => a.position2d.y)) - 4,
    );
  });

  it('ขยับต่อเนื่อง ไม่มีใครหลุดออกนอกสนาม', () => {
    const match = createMatch(buildTeam('4-2-3-1', 'home'), buildTeam('3-5-2', 'away'));
    runWithBallAt(match, { x: 88, y: 2 }, 16);

    match.players.forEach((agent) => {
      expect(agent.position2d.x).toBeGreaterThanOrEqual(0);
      expect(agent.position2d.x).toBeLessThanOrEqual(PITCH.length);
      expect(agent.position2d.y).toBeGreaterThanOrEqual(0);
      expect(agent.position2d.y).toBeLessThanOrEqual(PITCH.width);
    });
  });
});

/* ══ ผู้รักษาประตู ════════════════════════════════════════ */

describe('ผู้รักษาประตู', () => {
  it('อยู่ในเขตของตัวเองไม่ว่าบอลจะอยู่ตรงไหน', () => {
    const spots: Vec2[] = [
      { x: 5, y: 34 },
      { x: 52, y: 4 },
      { x: 100, y: 60 },
      { x: 20, y: 66 },
    ];

    spots.forEach((spot) => {
      const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('3-5-2', 'away'));
      runWithBallAt(match, spot, 12);

      const homeKeeper = match.home.players.find((agent) => agent.role === 'gk');
      const awayKeeper = match.away.players.find((agent) => agent.role === 'gk');

      expect(homeKeeper?.position2d.x ?? 99).toBeLessThan(PITCH.penaltyDepth + 2);
      expect(awayKeeper?.position2d.x ?? 0).toBeGreaterThan(PITCH.length - PITCH.penaltyDepth - 2);
    });
  });

  it('ขยับตามบอลด้านกว้าง แต่ไม่ทิ้งกรอบประตู', () => {
    const low = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-4-2', 'away'));
    runWithBallAt(low, { x: 18, y: 8 }, 12);

    const high = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-4-2', 'away'));
    runWithBallAt(high, { x: 18, y: PITCH.width - 8 }, 12);

    const lowKeeper = low.home.players.find((agent) => agent.role === 'gk');
    const highKeeper = high.home.players.find((agent) => agent.role === 'gk');

    expect(lowKeeper?.position2d.y ?? 0).toBeLessThan(highKeeper?.position2d.y ?? 0);

    [lowKeeper, highKeeper].forEach((keeper) => {
      const offset = Math.abs((keeper?.position2d.y ?? 0) - PITCH.width / 2);
      expect(offset).toBeLessThan(PITCH.goalWidth / 2 + 4);
    });
  });
});

/* ══ ลูกบอล ═══════════════════════════════════════════════ */

describe('ลูกบอล', () => {
  it('อยู่ในสนามเสมอ', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-3-3', 'away'));

    for (let index = 0; index < 60 * 60; index += 1) {
      match.tick(STEP);
      expect(match.ball.position.x).toBeGreaterThanOrEqual(0);
      expect(match.ball.position.x).toBeLessThanOrEqual(PITCH.length);
      expect(match.ball.position.y).toBeGreaterThanOrEqual(0);
      expect(match.ball.position.y).toBeLessThanOrEqual(PITCH.width);
    }
  });

  it('มีแรงเสียดทาน — ไม่มีใครแตะแล้วบอลหยุดเอง', () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-4-2', 'away'));
    match.setPaused(true);
    match.ball.kick({ x: 1, y: 0 }, 14);

    // ให้เฉพาะบอลเดินต่อ (คนหยุดอยู่แล้วเพราะ pause)
    for (let index = 0; index < 60 * 6; index += 1) match.ball.update(STEP);
    expect(match.ball.speed).toBe(0);
  });

  it('บอลไหลไปทั่วสนาม ไม่ค้างอยู่มุมใดมุมหนึ่ง', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-3-3', 'away'));

    const samples: number[] = [];
    for (let index = 0; index < 60 * 120; index += 1) {
      match.tick(STEP);
      if (index % 60 === 0) samples.push(match.ball.position.x);
    }

    // ถ้ามีคนกอดบอลอยู่มุมสนามได้ ค่าพวกนี้จะกระจุกกันหมด
    const spread = Math.max(...samples) - Math.min(...samples);
    expect(spread).toBeGreaterThan(30);
    expect(mean(samples)).toBeGreaterThan(20);
    expect(mean(samples)).toBeLessThan(85);
  });

  it('ยังไม่มีการยิงประตู ฟาวล์ หรือใบเหลือง/แดง (นอกขอบเขต PHASE 2)', () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-4-2', 'away'));
    run(match, 120);

    const forbidden = ['shot', 'goal', 'save', 'foul', 'card', 'tackle', 'substitution'];
    match.events.forEach((event) => {
      expect(forbidden).not.toContain(event.type);
    });
  });
});

/* ══ นาฬิกา ═══════════════════════════════════════════════ */

describe('นาฬิกา', () => {
  it('โหมด internal: เดินเองตามเวลาจริงและหยุดที่นาที 90', () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-4-2', 'away'), {
      minutesPerSecond: 10,
    });

    run(match, 3);
    expect(match.clock.minute).toBeGreaterThanOrEqual(29);
    expect(match.clock.minute).toBeLessThanOrEqual(31);

    run(match, 10);
    expect(match.clock.minute).toBe(90);
    expect(match.phase).toBe('fulltime');
  });

  it('โหมด external: เอนจินไม่นับเวลาเอง มีนาฬิกาเรือนเดียว', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-3-3', 'away'), {
      clockSource: 'external',
      minutesPerSecond: 10,
    });

    run(match, 5);
    expect(match.clock.minute).toBe(0);

    match.syncClock(37);
    expect(match.clock.minute).toBe(37);

    run(match, 5);
    expect(match.clock.minute).toBe(37);
  });

  it('โหมด external: นาทีเดินหน้าอย่างเดียว ไม่กระโดดเอง', () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-4-2', 'away'), {
      clockSource: 'external',
    });

    for (let minute = 0; minute <= 90; minute += 1) {
      match.syncClock(minute);
      run(match, 0.13);
      expect(match.clock.minute).toBe(minute);
    }

    expect(match.phase).toBe('fulltime');
  });

  it('หมดเวลาแล้วนักเตะยังเดินอยู่ ไม่ค้างกลางก้าว', () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-4-2', 'away'), {
      clockSource: 'external',
    });
    run(match, 5);
    match.syncClock(90);

    const before = match.players.map((agent) => ({ ...agent.position2d }));
    run(match, 3);
    const moved = match.players.some(
      (agent, index) =>
        Math.hypot(agent.position2d.x - before[index].x, agent.position2d.y - before[index].y) >
        0.5,
    );
    expect(moved).toBe(true);
  });
});

/* ══ หยุดเกม / ใบแดง / เปลี่ยนตัว ════════════════════════ */

describe('หยุดเกม และการเปลี่ยนรายชื่อกลางเกม', () => {
  it('pause แล้วคน บอล และนาฬิกาหยุดหมด · resume แล้วเดินต่อ', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'));
    run(match, 5);

    match.setPaused(true);
    const frozen = match.players.map((agent) => ({ ...agent.position2d }));
    const ball = { ...match.ball.position };
    const minute = match.clock.minute;

    run(match, 3);

    match.players.forEach((agent, index) => {
      expect(agent.position2d.x).toBeCloseTo(frozen[index].x, 8);
      expect(agent.position2d.y).toBeCloseTo(frozen[index].y, 8);
    });
    expect(match.ball.position.x).toBeCloseTo(ball.x, 8);
    expect(match.clock.minute).toBe(minute);
    expect(match.clock.running).toBe(false);

    match.setPaused(false);
    run(match, 3);
    expect(match.clock.running).toBe(true);
    const moved = match.players.some(
      (agent, index) =>
        Math.hypot(agent.position2d.x - frozen[index].x, agent.position2d.y - frozen[index].y) >
        0.5,
    );
    expect(moved).toBe(true);
  });

  it('ใบแดง: คนหายจากสนาม เหลือ 10 คน และไม่กลับมาเอง', () => {
    const home = buildTeam('4-4-2', 'home');
    const away = buildTeam('4-3-3', 'away');
    const match = createMatch(home, away);
    run(match, 6);

    const sentOff = home.players[5];
    const survivors = match.home.players
      .filter((agent) => agent.id !== sentOff.id)
      .map((agent) => ({ id: agent.id, ...agent.position2d }));

    const changed = match.syncRoster(
      { ...home, players: home.players.filter((player) => player.id !== sentOff.id) },
      away,
    );

    expect(changed).toBe(true);
    expect(match.home.players).toHaveLength(10);
    expect(match.players).toHaveLength(21);

    // คนที่เหลือต้องไม่ถูกรีเซ็ตกลับตำแหน่งตั้งต้น
    survivors.forEach((entry) => {
      const agent = match.home.players.find((player) => player.id === entry.id);
      expect(agent?.position2d.x).toBeCloseTo(entry.x, 8);
      expect(agent?.position2d.y).toBeCloseTo(entry.y, 8);
    });

    run(match, 20);
    expect(match.home.players.some((agent) => agent.id === sentOff.id)).toBe(false);
    expect(match.players).toHaveLength(21);
  });

  it('เปลี่ยนตัว: คนใหม่ลงที่ตำแหน่งตามแผน คนอื่นไม่ขยับ', () => {
    const home = buildTeam('4-4-2', 'home');
    const away = buildTeam('4-4-2', 'away');
    const match = createMatch(home, away);
    run(match, 6);

    const outgoing = home.players[8];
    const incoming = { ...outgoing, id: 'home-substitute', name: 'ตัวสำรอง', shirtNumber: 12 };
    const nextHome = {
      ...home,
      players: home.players.map((player) => (player.id === outgoing.id ? incoming : player)),
    };

    expect(match.syncRoster(nextHome, away)).toBe(true);
    expect(match.home.players).toHaveLength(11);

    const agent = match.home.players.find((entry) => entry.id === incoming.id);
    const expected = formationToWorld(incoming.formationX, incoming.formationY, 'home');
    expect(agent?.position2d.x).toBeCloseTo(expected.x, 5);
    expect(agent?.position2d.y).toBeCloseTo(expected.y, 5);
  });

  it('รายชื่อเดิมเป๊ะ ๆ ไม่ทำให้เกิดการเปลี่ยนแปลงใด ๆ', () => {
    const home = buildTeam('4-3-3', 'home');
    const away = buildTeam('4-3-3', 'away');
    const match = createMatch(home, away);
    run(match, 8);

    const before = match.players.map((agent) => ({ ...agent.position2d }));
    expect(match.syncRoster({ ...home }, { ...away })).toBe(false);

    match.players.forEach((agent, index) => {
      expect(agent.position2d.x).toBeCloseTo(before[index].x, 10);
      expect(agent.position2d.y).toBeCloseTo(before[index].y, 10);
    });
  });
});
