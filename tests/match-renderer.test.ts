/**
 * เทสของ PHASE 7 — การฉายภาพ 2.5D กล้อง ความลึก ความสูงลูกบอล และการคลิกเลือกนักเตะ
 *
 * ชั้นการแสดงผลไม่มีสิทธิ์แตะตรรกะฟุตบอล เทสชุดนี้จึงตรวจสองเรื่อง:
 * (1) คณิตศาสตร์ของการฉายภาพถูกต้องและผกผันได้
 * (2) การวาดภาพไม่ทำให้สถานะของเอนจินเปลี่ยนแม้แต่นิดเดียว
 */
import { describe, expect, it } from 'vitest';
import { getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import { PITCH, type MatchTeamInput } from '@/match-engine';
import { BallRenderer, poseFor } from '@/match-renderer';
import {
  createProjection,
  depthAt,
  heightToPixels,
  metresToPixels,
  toScreen,
  toWorld,
} from '@/match-renderer/projection';
import { DEFAULT_CAMERA, withCamera } from '@/match-renderer/types';
import { createMatchSession } from '@/services/matchSession';

const VIEWPORT = { width: 1280, height: 720 };

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

const newEngine = (matchId = 'render') =>
  createMatchSession({
    matchId,
    home: buildTeam('4-3-3', 'home'),
    away: buildTeam('4-4-2', 'away'),
  }).engine;

/** จุดตัวอย่างครอบคลุมทั้งสนาม รวมมุมทั้งสี่ */
const SAMPLES = [
  { x: 0, y: 0 },
  { x: PITCH.length, y: 0 },
  { x: 0, y: PITCH.width },
  { x: PITCH.length, y: PITCH.width },
  { x: PITCH.length / 2, y: PITCH.width / 2 },
  { x: 12.5, y: 51 },
  { x: 92, y: 17 },
];

/* ══ การฉายภาพ ════════════════════════════════════════════ */

describe('การฉายภาพ 2.5D', () => {
  it('แปลงไปแล้วแปลงกลับได้ค่าเดิม (ผกผันแม่นยำ)', () => {
    const projection = createProjection(VIEWPORT, DEFAULT_CAMERA);

    SAMPLES.forEach((point) => {
      const screen = toScreen(projection, point);
      const back = toWorld(projection, screen.x, screen.y);

      expect(back.x).toBeCloseTo(point.x, 6);
      expect(back.y).toBeCloseTo(point.y, 6);
    });
  });

  it('ผกผันได้ทุกค่ากล้อง ทั้งซูม เลื่อน และเอียง', () => {
    const cameras = [
      withCamera(DEFAULT_CAMERA, { zoom: 0.6 }),
      withCamera(DEFAULT_CAMERA, { zoom: 2.4 }),
      withCamera(DEFAULT_CAMERA, { offsetX: 180, offsetY: -95 }),
      withCamera(DEFAULT_CAMERA, { tilt: 0.4, spread: 0.5 }),
      withCamera(DEFAULT_CAMERA, { tilt: 1, spread: 0 }),
    ];

    cameras.forEach((camera) => {
      const projection = createProjection(VIEWPORT, camera);

      SAMPLES.forEach((point) => {
        const screen = toScreen(projection, point);
        const back = toWorld(projection, screen.x, screen.y);
        expect(back.x).toBeCloseTo(point.x, 5);
        expect(back.y).toBeCloseTo(point.y, 5);
      });
    });
  });

  it('สนามอยู่ในกรอบจอเสมอ และไม่ถูกยืดผิดสัดส่วน', () => {
    const shapes = [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
      { width: 1024, height: 1366 },
      { width: 800, height: 480 },
    ];

    shapes.forEach((viewport) => {
      const projection = createProjection(viewport, DEFAULT_CAMERA);
      const corners = [
        toScreen(projection, { x: 0, y: 0 }),
        toScreen(projection, { x: PITCH.length, y: PITCH.width }),
      ];

      corners.forEach((corner) => {
        expect(corner.x).toBeGreaterThanOrEqual(0);
        expect(corner.x).toBeLessThanOrEqual(viewport.width);
        expect(corner.y).toBeGreaterThanOrEqual(0);
        expect(corner.y).toBeLessThanOrEqual(viewport.height);
      });

      // สัดส่วนความยาว/ความกว้างที่เห็นต้องคงที่ ไม่เปลี่ยนตามรูปร่างหน้าต่าง
      const acrossPitch =
        toScreen(projection, { x: PITCH.length, y: PITCH.width / 2 }).x -
        toScreen(projection, { x: 0, y: PITCH.width / 2 }).x;
      const downPitch =
        toScreen(projection, { x: PITCH.length / 2, y: PITCH.width }).y -
        toScreen(projection, { x: PITCH.length / 2, y: 0 }).y;

      const ratio = acrossPitch / downPitch;
      const expected = PITCH.length / (PITCH.width * DEFAULT_CAMERA.tilt);
      expect(ratio).toBeCloseTo(expected, 4);
    });
  });

  it('มุมกล้องเอียงจริง — แกนลึกถูกย่อเทียบกับแกนยาว', () => {
    const projection = createProjection(VIEWPORT, DEFAULT_CAMERA);

    const oneMetreAcross =
      toScreen(projection, { x: 1, y: PITCH.width / 2 }).x -
      toScreen(projection, { x: 0, y: PITCH.width / 2 }).x;
    const oneMetreDeep =
      toScreen(projection, { x: 0, y: PITCH.width / 2 + 1 }).y -
      toScreen(projection, { x: 0, y: PITCH.width / 2 }).y;

    expect(oneMetreDeep).toBeLessThan(oneMetreAcross);
    // แต่ต้องไม่แบนจนอ่านตำแหน่งไม่ออก
    expect(oneMetreDeep / oneMetreAcross).toBeGreaterThan(0.4);
  });
});

/* ══ กล้อง ════════════════════════════════════════════════ */

describe('กล้อง', () => {
  it('ค่าที่เกินขอบเขตถูกบีบให้อยู่ในช่วงที่ยังดูรู้เรื่อง', () => {
    expect(withCamera(DEFAULT_CAMERA, { zoom: 99 }).zoom).toBeLessThanOrEqual(3);
    expect(withCamera(DEFAULT_CAMERA, { zoom: 0.01 }).zoom).toBeGreaterThanOrEqual(0.5);
    expect(withCamera(DEFAULT_CAMERA, { tilt: 0 }).tilt).toBeGreaterThanOrEqual(0.35);
    expect(withCamera(DEFAULT_CAMERA, { tilt: 5 }).tilt).toBeLessThanOrEqual(1);
    expect(withCamera(DEFAULT_CAMERA, { spread: -1 }).spread).toBe(0);
  });

  it('ซูมทำให้สนามใหญ่ขึ้นตามสัดส่วน', () => {
    const single = createProjection(VIEWPORT, DEFAULT_CAMERA);
    const doubled = createProjection(VIEWPORT, withCamera(DEFAULT_CAMERA, { zoom: 2 }));

    expect(doubled.scale / single.scale).toBeCloseTo(2, 6);
  });

  it('เลื่อนกล้องแล้วภาพเลื่อนตามเป๊ะ ๆ', () => {
    const base = createProjection(VIEWPORT, DEFAULT_CAMERA);
    const moved = createProjection(
      VIEWPORT,
      withCamera(DEFAULT_CAMERA, { offsetX: 40, offsetY: -25 }),
    );

    const point = { x: 30, y: 20 };
    const from = toScreen(base, point);
    const to = toScreen(moved, point);

    expect(to.x - from.x).toBeCloseTo(40, 6);
    expect(to.y - from.y).toBeCloseTo(-25, 6);
  });

  it('เปลี่ยนขนาดจอแล้วสนามยังพอดีอยู่', () => {
    const small = createProjection({ width: 640, height: 360 }, DEFAULT_CAMERA);
    const large = createProjection({ width: 1920, height: 1080 }, DEFAULT_CAMERA);

    expect(large.scale).toBeGreaterThan(small.scale);
    expect(Number.isFinite(small.scale)).toBe(true);
  });
});

/* ══ ความลึก ══════════════════════════════════════════════ */

describe('ความลึก', () => {
  it('คนใกล้กล้องตัวใหญ่กว่าคนไกลกล้อง แต่ไม่เว่อร์', () => {
    const projection = createProjection(VIEWPORT, DEFAULT_CAMERA);

    const far = depthAt(projection, 0);
    const middle = depthAt(projection, PITCH.width / 2);
    const near = depthAt(projection, PITCH.width);

    expect(near).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(far);
    expect(middle).toBeCloseTo(1, 6);

    // ต่างกันไม่เกิน 30% ระหว่างสองริมเส้น — เห็นระยะแต่ยังอ่านตำแหน่งง่าย
    expect(near / far).toBeLessThan(1.3);
    expect(near / far).toBeGreaterThan(1.05);
  });

  it('ระยะ 1 เมตรใกล้กล้องกินพื้นที่จอมากกว่าไกลกล้อง', () => {
    const projection = createProjection(VIEWPORT, DEFAULT_CAMERA);

    expect(metresToPixels(projection, 1, PITCH.width)).toBeGreaterThan(
      metresToPixels(projection, 1, 0),
    );
  });

  it('เรียงลำดับการวาดจากค่า y จริง ไม่ใช่ลำดับในอาเรย์', () => {
    const engine = newEngine('depth');
    const order = [...engine.players].sort((a, b) => a.position2d.y - b.position2d.y);

    for (let index = 1; index < order.length; index += 1) {
      expect(order[index].position2d.y).toBeGreaterThanOrEqual(order[index - 1].position2d.y);
    }

    // ลำดับต้องไม่ผูกกับตำแหน่งในอาเรย์ของเอนจิน (ซึ่งเปลี่ยนได้เมื่อมีคนโดนใบแดง)
    const byArray = engine.players.map((agent) => agent.id);
    const byDepth = order.map((agent) => agent.id);
    expect(byDepth).not.toEqual(byArray);
  });
});

/* ══ ลูกบอล ═══════════════════════════════════════════════ */

describe('ความสูงของลูกบอล', () => {
  it('ลูกที่อยู่กับเท้าหรือกลิ้งอยู่ ความสูงเป็นศูนย์', () => {
    const engine = newEngine('ball-ground');
    const renderer = new BallRenderer();

    engine.ball.reset({ x: 50, y: 34 });
    expect(renderer.heightOf(engine)).toBe(0);

    engine.ball.attachTo(engine.home.players[5].id);
    expect(renderer.heightOf(engine)).toBe(0);
  });

  it('ลูกยิงแรงลอยขึ้นแล้วตกกลับถึงพื้น', () => {
    const engine = newEngine('ball-air');
    const renderer = new BallRenderer();

    engine.ball.reset({ x: 80, y: 34 });
    engine.ball.shoot({ x: 1, y: 0 }, 30, engine.home.players[10].id);

    const heights: number[] = [];
    for (let index = 0; index < 60 && engine.ball.state === 'SHOT'; index += 1) {
      engine.tick(1 / 60);
      heights.push(renderer.heightOf(engine));
    }

    const peak = Math.max(...heights);
    expect(peak).toBeGreaterThan(0.5);
    expect(peak).toBeLessThanOrEqual(3.4);
    expect(heights[0]).toBeLessThan(peak);
  });

  it('ลูกส่งสั้นแทบไม่ลอย', () => {
    const engine = newEngine('ball-short');
    const renderer = new BallRenderer();

    engine.ball.reset({ x: 50, y: 34 });
    engine.ball.launch({ x: 1, y: 0 }, 10, 'a', 'b');
    engine.tick(1 / 60);

    expect(renderer.heightOf(engine)).toBe(0);
  });

  it('ความสูงบนจอแปรผันตรงกับความสูงจริง', () => {
    const projection = createProjection(VIEWPORT, DEFAULT_CAMERA);
    expect(heightToPixels(projection, 2)).toBeCloseTo(heightToPixels(projection, 1) * 2, 6);

    // ลูกที่ลอยอยู่ต้องถูกวาดสูงกว่าเงาของมันบนพื้น
    const ground = toScreen(projection, { x: 50, y: 34, z: 0 });
    const airborne = toScreen(projection, { x: 50, y: 34, z: 3 });
    expect(airborne.y).toBeLessThan(ground.y);
    expect(airborne.x).toBeCloseTo(ground.x, 6);
  });
});

/* ══ ท่าทาง ═══════════════════════════════════════════════ */

describe('ท่าทางของนักเตะ', () => {
  it('เลือกท่าจากสถานะจริงของเอนจิน', () => {
    const engine = newEngine('pose');
    const agent = engine.home.players[7];

    agent.speed = 0;
    agent.decision = 'MOVE';
    agent.state = 'POSITIONING';
    expect(poseFor(agent, false)).toBe('IDLE');

    agent.speed = 5;
    expect(poseFor(agent, false)).toBe('RUN');

    agent.decision = 'SHOOT';
    expect(poseFor(agent, false)).toBe('KICK');

    agent.decision = 'TACKLE';
    expect(poseFor(agent, false)).toBe('TACKLE');

    agent.decision = 'MOVE';
    agent.state = 'RECEIVING';
    expect(poseFor(agent, false)).toBe('RECEIVE');

    expect(poseFor(agent, true)).toBe('CELEBRATE');
  });

  it('การเลือกท่าไม่เปลี่ยนสถานะของนักเตะ', () => {
    const engine = newEngine('pose-pure');
    const agent = engine.home.players[3];

    const before = { state: agent.state, decision: agent.decision, speed: agent.speed };
    poseFor(agent, false);
    poseFor(agent, true);

    expect(agent.state).toBe(before.state);
    expect(agent.decision).toBe(before.decision);
    expect(agent.speed).toBe(before.speed);
  });
});

/* ══ การคลิกเลือก (การฉายกลับ) ═══════════════════════════ */

describe('การคลิกเลือกนักเตะผ่านการฉายกลับ', () => {
  /**
   * จำลองสิ่งที่ MatchRenderer.hitTest ทำ โดยไม่ต้องมี DOM:
   * พิกัด CSS → พิกัดอุปกรณ์ → ฉายกลับเป็นพิกัดสนาม → หาคนที่ใกล้ที่สุด
   */
  const pick = (
    engine: ReturnType<typeof newEngine>,
    projection: ReturnType<typeof createProjection>,
    cssX: number,
    cssY: number,
    dpr: number,
  ) => {
    const world = toWorld(projection, cssX * dpr, cssY * dpr);

    let best: string | null = null;
    let bestGap = 2.4;
    for (const agent of engine.players) {
      const gap = Math.hypot(agent.position2d.x - world.x, agent.position2d.y - world.y);
      if (gap <= bestGap) {
        bestGap = gap;
        best = agent.id;
      }
    }
    return best;
  };

  it('คลิกตรงตัวนักเตะแล้วได้คนนั้น ทุกคนในสนาม', () => {
    const engine = newEngine('hit');
    const dpr = 1;
    const projection = createProjection(VIEWPORT, DEFAULT_CAMERA);

    engine.players.forEach((agent) => {
      const screen = toScreen(projection, agent.position2d);
      expect(pick(engine, projection, screen.x / dpr, screen.y / dpr, dpr)).toBe(agent.id);
    });
  });

  it('ทำงานถูกต้องบนจอความละเอียดสูง (DPR 2)', () => {
    const engine = newEngine('hit-dpr');
    const dpr = 2;
    // ผืนผ้าใบเป็นพิกเซลอุปกรณ์ = ขนาด CSS × dpr
    const projection = createProjection(
      { width: VIEWPORT.width * dpr, height: VIEWPORT.height * dpr },
      DEFAULT_CAMERA,
    );

    engine.players.forEach((agent) => {
      const screen = toScreen(projection, agent.position2d);
      expect(pick(engine, projection, screen.x / dpr, screen.y / dpr, dpr)).toBe(agent.id);
    });
  });

  it('ทำงานถูกต้องเมื่อซูมและเลื่อนกล้อง', () => {
    const engine = newEngine('hit-camera');
    const camera = withCamera(DEFAULT_CAMERA, { zoom: 1.8, offsetX: 120, offsetY: -60 });
    const projection = createProjection(VIEWPORT, camera);

    engine.players.forEach((agent) => {
      const screen = toScreen(projection, agent.position2d);
      expect(pick(engine, projection, screen.x, screen.y, 1)).toBe(agent.id);
    });
  });

  it('คลิกที่พื้นสนามเปล่าไม่ได้ใคร', () => {
    const engine = newEngine('hit-empty');
    const projection = createProjection(VIEWPORT, DEFAULT_CAMERA);

    // มุมสนามฝั่งที่ไม่มีใครยืนตอนเขี่ยบอล
    const corner = toScreen(projection, { x: 2, y: 2 });
    expect(pick(engine, projection, corner.x, corner.y, 1)).toBeNull();
  });

  it('การคลิกเลือกไม่เปลี่ยนสถานะของเอนจินเลย', () => {
    const engine = newEngine('hit-pure');
    const projection = createProjection(VIEWPORT, DEFAULT_CAMERA);

    for (let index = 0; index < 60 * 10; index += 1) engine.tick(1 / 60);

    const before = {
      score: { ...engine.score },
      minute: engine.clock.minute,
      events: engine.emittedCount,
      positions: engine.players.map((agent) => ({ ...agent.position2d })),
    };

    engine.players.forEach((agent) => {
      const screen = toScreen(projection, agent.position2d);
      pick(engine, projection, screen.x, screen.y, 1);
    });

    expect(engine.score).toEqual(before.score);
    expect(engine.clock.minute).toBe(before.minute);
    expect(engine.emittedCount).toBe(before.events);
    engine.players.forEach((agent, index) => {
      expect(agent.position2d.x).toBeCloseTo(before.positions[index].x, 10);
    });
  });
});

/* ══ ความเร็วและการหยุด ══════════════════════════════════ */

describe('ชั้นการแสดงผลไม่มีนาฬิกาของตัวเอง', () => {
  it('การคำนวณความสูงลูกบอลไม่เดินเวลาเอง', () => {
    const engine = newEngine('no-clock');
    const renderer = new BallRenderer();

    engine.ball.reset({ x: 60, y: 34 });
    engine.ball.shoot({ x: 1, y: 0 }, 28, engine.home.players[9].id);
    engine.tick(1 / 60);

    // เรียกซ้ำหลายครั้งโดยไม่ tick — ค่าต้องไม่ขยับ เพราะเวลามาจากเอนจินอย่างเดียว
    const first = renderer.heightOf(engine);
    expect(renderer.heightOf(engine)).toBe(first);
    expect(renderer.heightOf(engine)).toBe(first);

    engine.tick(1 / 60);
    expect(renderer.heightOf(engine)).not.toBe(first);
  });

  it('หยุดเกมแล้วภาพหยุดตาม เพราะอ่านจากเอนจินตัวเดียว', () => {
    const engine = newEngine('paused');
    const renderer = new BallRenderer();
    for (let index = 0; index < 60 * 5; index += 1) engine.tick(1 / 60);

    engine.setPaused(true);
    const height = renderer.heightOf(engine);
    const ball = { ...engine.ball.position };

    for (let index = 0; index < 60; index += 1) engine.tick(1 / 60);

    expect(renderer.heightOf(engine)).toBe(height);
    expect(engine.ball.position.x).toBeCloseTo(ball.x, 10);
  });

  it('ความเร็ว 1x/2x/4x ยังคุมโดยเอนจิน ไม่ใช่ตัววาดภาพ', () => {
    [1, 2, 4].forEach((speed) => {
      const engine = newEngine(`speed-${speed}`);
      engine.setSpeed(speed);
      expect(engine.speed).toBe(speed);
    });
  });
});
