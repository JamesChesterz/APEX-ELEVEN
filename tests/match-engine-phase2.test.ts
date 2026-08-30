/**
 * เทสของ PHASE 2 — ครองบอล ส่งบอล รับบอล support movement การกดดัน และการตัดบอล
 *
 * เทสของ PHASE 1/1.5 อยู่ที่ tests/match-engine.test.ts (รูปทีม นาฬิกา ใบแดง ฯลฯ)
 * ไฟล์นี้เน้นเฉพาะพฤติกรรมที่เพิ่มเข้ามาใน PHASE 2
 */
import { describe, expect, it } from 'vitest';
import { getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import { createMatch, PITCH, scorePass, type MatchTeamInput } from '@/match-engine';
import type { MatchEngine } from '@/match-engine';
import type { PlayerAgent } from '@/match-engine/playerAgent';

const STEP = 1 / 60;

/** ปั้นทีมจากแผนจริงและนักเตะจริงในเกม */
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

const run = (match: MatchEngine, seconds: number): void => {
  for (let index = 0; index < Math.round(seconds / STEP); index += 1) match.tick(STEP);
};

const newMatch = (seed = 'phase2') =>
  createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'), { seed });

/** ย้ายทุกคนไปกองไว้มุมสนาม เพื่อจัดฉากทดสอบเฉพาะคนที่สนใจ */
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

/* ══ การครองบอล ══════════════════════════════════════════ */

describe('การครองบอล', () => {
  it('คนที่เข้าถึงลูกหลุดได้ครองบอล และบอลมีเจ้าของชัดเจน', () => {
    const match = newMatch();
    parkEveryone(match);

    const striker = match.home.players[10];
    place(striker, 50, 34);
    match.ball.reset({ x: 50.6, y: 34 });

    expect(match.ball.state).toBe('FREE');
    expect(match.possessionTeam).toBeNull();

    match.tick(STEP);

    expect(match.ball.state).toBe('CONTROLLED');
    expect(match.ball.owner).toBe(striker.id);
    expect(match.possessionTeam).toBe('home');
    expect(striker.state).toBe('ON_BALL');
    expect(match.stats.home.touches).toBeGreaterThan(0);
  });

  it('บอลติดตามเท้าคนที่ครองอยู่ ไม่หลุดและไม่วาร์ป', () => {
    const match = newMatch();
    parkEveryone(match);

    const carrier = match.home.players[7];
    place(carrier, 50, 34);
    match.ball.reset({ x: 50.5, y: 34 });
    match.tick(STEP);
    expect(match.ball.owner).toBe(carrier.id);

    for (let index = 0; index < 60; index += 1) {
      const before = { ...match.ball.position };
      match.tick(STEP);
      if (match.ball.state !== 'CONTROLLED') break;

      const jump = Math.hypot(
        match.ball.position.x - before.x,
        match.ball.position.y - before.y,
      );
      expect(jump).toBeLessThanOrEqual(14 * STEP + 0.001);
      expect(carrier.distanceTo(match.ball.position)).toBeLessThan(2.5);
    }
  });

  it('ไม่เปลี่ยนเจ้าของบอลทุกเฟรม — มีช่วงถือบอลจริง', () => {
    const match = newMatch('hold');
    run(match, 60);

    // 60 วินาที ถ้าเปลี่ยนมือทุกเฟรมจะได้ 3,600 ครั้ง
    const changes = match.events.filter((event) => event.type === 'possession_change').length;
    expect(changes).toBeGreaterThan(0);
    expect(changes).toBeLessThan(120);
  });
});

/* ══ การส่งบอล ═══════════════════════════════════════════ */

describe('การส่งบอล', () => {
  /** จัดฉาก: A ถือบอลกลางสนาม มีเพื่อนคนเดียวยืนรออยู่ข้างหน้า คู่แข่งอยู่ไกล */
  const passScenario = (seed = 'pass') => {
    const match = newMatch(seed);
    parkEveryone(match, { x: 100, y: 64 });

    const passer = match.home.players[6];
    const receiver = match.home.players[9];
    place(passer, 45, 34);
    place(receiver, 63, 34);

    match.ball.reset({ x: 45.4, y: 34 });
    match.tick(STEP);
    passer.decisionTimer = 0;

    return { match, passer, receiver };
  };

  it('คนถือบอลส่งบอล แล้วบอลเดินทางจริง ไม่วาร์ปไปหาผู้รับ', () => {
    const { match, passer, receiver } = passScenario();
    expect(match.ball.owner).toBe(passer.id);

    match.tick(STEP);

    expect(match.ball.state).toBe('TRAVELLING');
    expect(match.ball.owner).toBeNull();
    expect(match.ball.intendedReceiverId).toBe(receiver.id);
    expect(match.ball.passOrigin).not.toBeNull();

    // บอลเพิ่งออกจากเท้า ต้องยังอยู่ใกล้คนส่ง ไม่ใช่ไปโผล่ที่คนรับแล้ว
    expect(passer.distanceTo(match.ball.position)).toBeLessThan(4);
    expect(receiver.distanceTo(match.ball.position)).toBeGreaterThan(10);
    expect(match.stats.home.passes).toBe(1);
  });

  it('บันทึกเหตุการณ์ pass พร้อมผู้ส่งและผู้รับ', () => {
    const { match, passer, receiver } = passScenario();
    match.tick(STEP);

    const event = match.events.find((entry) => entry.type === 'pass');
    expect(event?.playerId).toBe(passer.id);
    expect(event?.targetPlayerId).toBe(receiver.id);
    expect(event?.side).toBe('home');
  });

  it('ลูกยาวแรงกว่าลูกสั้น', () => {
    const short = newMatch('short');
    parkEveryone(short, { x: 100, y: 64 });
    place(short.home.players[6], 45, 34);
    place(short.home.players[9], 53, 34);
    short.ball.reset({ x: 45.4, y: 34 });
    short.tick(STEP);
    short.home.players[6].decisionTimer = 0;
    short.tick(STEP);
    const shortSpeed = short.ball.speed;

    const long = newMatch('long');
    parkEveryone(long, { x: 100, y: 64 });
    place(long.home.players[6], 45, 34);
    place(long.home.players[9], 75, 34);
    long.ball.reset({ x: 45.4, y: 34 });
    long.tick(STEP);
    long.home.players[6].decisionTimer = 0;
    long.tick(STEP);

    expect(long.ball.speed).toBeGreaterThan(shortSpeed);
  });

  it('การให้คะแนน: เพื่อนที่มีพื้นที่ว่างได้คะแนนสูงกว่าเพื่อนที่ถูกประกบ', () => {
    const match = newMatch();
    parkEveryone(match, { x: 100, y: 64 });

    const passer = match.home.players[6];
    const free = match.home.players[9];
    const marked = match.home.players[8];
    const marker = match.away.players[4];

    place(passer, 45, 34);
    place(free, 62, 24);
    place(marked, 62, 44);
    place(marker, 62.5, 44.5);

    const foes = match.away.players;
    expect(scorePass(passer, free, foes)).toBeGreaterThan(scorePass(passer, marked, foes));
  });
});

/* ══ การรับบอล ═══════════════════════════════════════════ */

describe('การรับบอล', () => {
  it('บอลถึงตัวผู้รับแล้วเขาได้ครองบอลต่อ', () => {
    const match = newMatch('receive');
    parkEveryone(match, { x: 100, y: 64 });

    const passer = match.home.players[6];
    const receiver = match.home.players[9];
    place(passer, 40, 34);
    place(receiver, 58, 34);

    match.ball.reset({ x: 40.4, y: 34 });
    match.tick(STEP);
    passer.decisionTimer = 0;
    match.tick(STEP);
    expect(match.ball.state).toBe('TRAVELLING');

    // ปล่อยให้บอลเดินทางไปถึง
    for (let index = 0; index < 60 * 4 && match.ball.owner !== receiver.id; index += 1) {
      match.tick(STEP);
    }

    expect(match.ball.owner).toBe(receiver.id);
    expect(match.ball.state).toBe('CONTROLLED');
    expect(match.stats.home.completedPasses).toBe(1);
    expect(match.events.some((event) => event.type === 'receive')).toBe(true);
  });

  it('รับแล้วกลับเข้าวงจรตัดสินใจ พร้อมส่งต่อได้อีก', () => {
    const match = newMatch('loop');
    run(match, 90);

    expect(match.stats.home.passes + match.stats.away.passes).toBeGreaterThan(8);
    expect(match.stats.home.completedPasses + match.stats.away.completedPasses).toBeGreaterThan(4);
  });
});

/* ══ การเปลี่ยนการครองบอล ════════════════════════════════ */

describe('การเปลี่ยนการครองบอล', () => {
  it('การครองบอลสลับกันไปมาระหว่างสองทีม', () => {
    const match = newMatch('swap');

    const seen = new Set<string>();
    for (let index = 0; index < 60 * 120; index += 1) {
      match.tick(STEP);
      const side = match.possessionTeam;
      if (side) seen.add(side);
    }

    expect(seen.has('home')).toBe(true);
    expect(seen.has('away')).toBe(true);

    const share = match.possessionShare('home');
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.85);
  });

  it('บันทึกเหตุการณ์ possession_change เมื่อบอลเปลี่ยนฝั่ง', () => {
    const match = newMatch('events');
    run(match, 90);

    const changes = match.events.filter((event) => event.type === 'possession_change');
    expect(changes.length).toBeGreaterThan(0);
    changes.forEach((event) => {
      expect(event.side).toBeTruthy();
      expect(event.playerId).toBeTruthy();
    });
  });
});

/* ══ Support movement ════════════════════════════════════ */

describe('Support movement', () => {
  /** ให้ทีมเหย้าครองบอลกลางสนามแล้วปล่อยให้ทีมจัดตัวสักพัก */
  const supportScenario = () => {
    const match = newMatch('support');
    const carrier = match.home.players[7];

    place(carrier, 52, 34);
    match.ball.reset({ x: 52.5, y: 34 });
    match.tick(STEP);

    // ตรึงบอลไว้กับคนถือ ไม่ให้เขาส่งออกไป จะได้ดูว่าคนอื่นไปยืนตรงไหน
    for (let index = 0; index < 60 * 4; index += 1) {
      carrier.decisionTimer = 5;
      match.tick(STEP);
      if (match.ball.owner !== carrier.id) break;
    }

    return { match, carrier };
  };

  it('เพื่อนร่วมทีมไม่วิ่งเข้าหาบอลกันทั้งทีม', () => {
    const { match, carrier } = supportScenario();

    const crowding = match.home.players.filter(
      (agent) => agent.id !== carrier.id && agent.distanceTo(match.ball.position) < 8,
    );
    expect(crowding.length).toBeLessThanOrEqual(1);
  });

  it('กองหลังยังรักษาแนวรับ ไม่ตามขึ้นไปกับบอล', () => {
    const { match } = supportScenario();

    match.home.players
      .filter((agent) => agent.role === 'defence')
      .forEach((agent) => {
        expect(agent.position2d.x).toBeLessThan(PITCH.length / 2);
      });
  });

  it('ตัวริมเส้นถ่างออกไปกินความกว้างของสนาม', () => {
    const { match } = supportScenario();

    const wide = match.home.players.filter((agent) =>
      ['LW', 'RW', 'LM', 'RM'].includes(agent.position),
    );
    expect(wide.length).toBeGreaterThan(0);

    wide.forEach((agent) => {
      const fromEdge = Math.min(agent.position2d.y, PITCH.width - agent.position2d.y);
      expect(fromEdge).toBeLessThan(16);
    });
  });

  it('ตัวสนับสนุนอยู่ในสถานะ SUPPORT ไม่ใช่ไล่บอล', () => {
    const { match, carrier } = supportScenario();

    const mates = match.home.players.filter(
      (agent) => agent.id !== carrier.id && agent.role !== 'gk',
    );
    const supporting = mates.filter((agent) => agent.state === 'SUPPORT');
    expect(supporting.length).toBeGreaterThan(mates.length / 2);
  });
});

/* ══ การตอบสนองเกมรับ ════════════════════════════════════ */

describe('การตอบสนองเกมรับ', () => {
  const pressScenario = () => {
    const match = newMatch('press');
    const carrier = match.home.players[7];

    place(carrier, 52, 34);
    match.ball.reset({ x: 52.5, y: 34 });
    match.tick(STEP);

    for (let index = 0; index < 60 * 3; index += 1) {
      carrier.decisionTimer = 5;
      match.tick(STEP);
      if (match.ball.owner !== carrier.id) break;
    }

    return { match, carrier };
  };

  it('มีคนเข้ากดดันคนเดียว ไม่ใช่ทั้งทีม', () => {
    const { match } = pressScenario();

    const pressing = match.away.players.filter((agent) => agent.state === 'PRESSING');
    expect(pressing).toHaveLength(1);
    expect(match.chaserIds.away).toBe(pressing[0].id);
  });

  it('คนที่เหลือรักษารูปทีม ไม่หลุดจากเขตของตัวเอง', () => {
    const { match } = pressScenario();

    match.away.players
      .filter((agent) => agent.state !== 'PRESSING')
      .forEach((agent) => {
        const drift = Math.hypot(
          agent.position2d.x - agent.formationPosition.x,
          agent.position2d.y - agent.formationPosition.y,
        );
        expect(drift).toBeLessThan(30);
      });
  });

  it('คนเข้ากดดันเข้าใกล้คนถือบอลขึ้นเรื่อย ๆ', () => {
    const match = newMatch('close');
    const carrier = match.home.players[7];
    place(carrier, 52, 34);
    match.ball.reset({ x: 52.5, y: 34 });
    // tick แรกบอลยังเป็นลูกหลุด ต้องผ่านไปอีก tick ถึงจะมีคนถือบอลและมีคนเข้ากดดัน
    match.tick(STEP);
    carrier.decisionTimer = 5;
    match.tick(STEP);

    const presser = match.away.players.find((agent) => agent.state === 'PRESSING');
    expect(presser).toBeTruthy();
    const before = presser?.distanceTo(carrier.position2d) ?? 0;

    for (let index = 0; index < 60 * 2; index += 1) {
      carrier.decisionTimer = 5;
      match.tick(STEP);
    }

    expect(presser?.distanceTo(carrier.position2d) ?? Infinity).toBeLessThan(before);
  });
});

/* ══ การตัดบอล ═══════════════════════════════════════════ */

describe('การตัดบอล', () => {
  it('คู่แข่งที่ยืนขวางวิถีบอลมีโอกาสตัดได้', () => {
    /*
     * ยิงบอลออกไปเองด้วย ball.launch แทนที่จะรอให้ AI ตัดสินใจส่ง
     * เพราะระบบให้คะแนนจะ "ไม่ส่ง" เข้าเส้นทางที่มีคนยืนขวางอยู่แล้ว (ซึ่งถูกต้อง)
     * เทสนี้ต้องการตรวจกลไกการตัดบอลล้วน ๆ จึงจัดฉากให้บอลวิ่งเข้าหาคนตัดโดยตรง
     * การตัดบอลใช้ความน่าจะเป็น จึงลองหลาย seed แล้วยืนยันว่าเกิดขึ้นได้จริง
     */
    let intercepted = 0;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const match = newMatch(`intercept-${attempt}`);
      parkEveryone(match, { x: 100, y: 64 });

      const passer = match.home.players[6];
      const receiver = match.home.players[9];
      place(passer, 40, 34);
      place(receiver, 62, 34);

      /*
       * ใช้กองกลางของฝั่งตรงข้ามเป็นคนตัด เพราะเขตรับผิดชอบของเขาอยู่แถวกลางสนามพอดี
       * ถ้าใช้กองหลัง ระบบ leash จะดึงเขากลับไปยืนแดนตัวเองทันที (ซึ่งเป็นพฤติกรรมที่ถูก)
       */
      const blockers = match.away.players.filter((agent) => agent.role === 'midfield');
      place(blockers[0], 48, 34);
      place(blockers[1], 52, 34);

      match.ball.reset({ x: 40.6, y: 34 });
      match.ball.launch({ x: 1, y: 0 }, 18, passer.id, receiver.id);
      expect(match.ball.state).toBe('TRAVELLING');

      for (let index = 0; index < 60 * 3; index += 1) {
        match.tick(STEP);
        if (match.ball.owner?.startsWith('away')) {
          intercepted += 1;
          expect(match.stats.away.interceptions).toBeGreaterThan(0);
          expect(match.events.some((event) => event.type === 'interception')).toBe(true);
          expect(match.events.some((event) => event.type === 'possession_change')).toBe(true);
          break;
        }
        if (match.ball.owner === receiver.id) break;
      }
    }

    expect(intercepted).toBeGreaterThan(0);
  });

  it('ตัดบอลแล้วบอลไม่วาร์ป — เปลี่ยนแค่เจ้าของ', () => {
    const match = newMatch('no-teleport');
    parkEveryone(match, { x: 100, y: 64 });

    const passer = match.home.players[6];
    place(passer, 35, 34);
    place(match.home.players[9], 70, 34);
    place(match.away.players[3], 52, 34);
    place(match.away.players[4], 55, 34);

    match.ball.reset({ x: 35.4, y: 34 });
    match.tick(STEP);
    passer.decisionTimer = 0;

    for (let index = 0; index < 60 * 4; index += 1) {
      const before = { ...match.ball.position };
      match.tick(STEP);
      const jump = Math.hypot(match.ball.position.x - before.x, match.ball.position.y - before.y);
      expect(jump).toBeLessThanOrEqual(30 * STEP + 0.001);
    }
  });

  it('เกมปกติมีการตัดบอลเกิดขึ้นจริง', () => {
    const match = newMatch('flow');
    run(match, 180);

    const total = match.stats.home.interceptions + match.stats.away.interceptions;
    expect(total).toBeGreaterThan(0);
  });
});

/* ══ สถิติและความเสถียร ══════════════════════════════════ */

describe('สถิติและความเสถียร', () => {
  it('ตัวนับสถิติเดินครบทุกช่อง', () => {
    const match = newMatch('stats');
    run(match, 120);

    (['home', 'away'] as const).forEach((side) => {
      expect(match.stats[side].passes).toBeGreaterThan(0);
      expect(match.stats[side].touches).toBeGreaterThan(0);
      expect(match.stats[side].possessionSeconds).toBeGreaterThan(0);
      expect(match.stats[side].completedPasses).toBeLessThanOrEqual(match.stats[side].passes);
    });

    const share = match.possessionShare('home') + match.possessionShare('away');
    expect(share).toBeCloseTo(1, 6);
  });

  it('เก็บเหตุการณ์ไม่บวมไม่จำกัด', () => {
    const match = newMatch('cap');
    run(match, 600);
    expect(match.events.length).toBeLessThanOrEqual(300);
  });

  it('ไม่มีการ teleport ของนักเตะแม้ในระบบครองบอล', () => {
    const match = newMatch('teleport');

    for (let index = 0; index < 60 * 60; index += 1) {
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

  it('seed เดียวกันให้ผลเหมือนกันทุกครั้ง', () => {
    const first = newMatch('deterministic');
    const second = newMatch('deterministic');

    run(first, 60);
    run(second, 60);

    expect(first.ball.position.x).toBeCloseTo(second.ball.position.x, 10);
    expect(first.ball.owner).toBe(second.ball.owner);
    expect(first.stats.home.passes).toBe(second.stats.home.passes);
    expect(first.stats.away.completedPasses).toBe(second.stats.away.completedPasses);

    first.players.forEach((agent, index) => {
      expect(agent.position2d.x).toBeCloseTo(second.players[index].position2d.x, 10);
    });
  });

  it('เอาคนถือบอลออกจากสนาม บอลกลายเป็นลูกหลุด ไม่ค้างกับคนที่ไม่อยู่แล้ว', () => {
    const home = buildTeam('4-3-3', 'home');
    const away = buildTeam('4-4-2', 'away');
    const match = createMatch(home, away, { seed: 'redcard' });

    for (let index = 0; index < 60 * 60 && !match.ball.owner; index += 1) match.tick(STEP);
    const ownerId = match.ball.owner;
    expect(ownerId).toBeTruthy();

    const side = ownerId?.startsWith('home') ? home : away;
    const trimmed = { ...side, players: side.players.filter((player) => player.id !== ownerId) };

    match.syncRoster(
      ownerId?.startsWith('home') ? trimmed : home,
      ownerId?.startsWith('home') ? away : trimmed,
    );

    expect(match.ball.owner).toBeNull();
    expect(match.players.some((agent) => agent.id === ownerId)).toBe(false);
  });
});
