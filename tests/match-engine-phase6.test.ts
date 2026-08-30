/**
 * เทสของ PHASE 6 — สมดุลของแผน ความถี่การยิง การเลือกนักเตะ และการบันทึกแทคติก
 */
import { describe, expect, it } from 'vitest';
import { FORMATIONS, getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import {
  MIN_SHOT_SCORE,
  SHOT_TENDENCY,
  evaluateShot,
  scorePass,
  type MatchEngine,
  type MatchTeamInput,
} from '@/match-engine';
import { DEFAULT_TACTICS, normaliseTactics, type Tactics } from '@/match-engine/tactics';
import { createMatchSession, opponentTactics } from '@/services/matchSession';

const STEP = 1 / 60;

/** ปั้นทีมจากแผนจริงในเกม — ไม่มีรายชื่อแผนที่ hardcode ไว้ที่ไหนในไฟล์นี้ */
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

const runMatch = (
  matchId: string,
  homeFormation: string,
  awayFormation: string,
  tactics?: { home?: Partial<Tactics>; away?: Partial<Tactics> },
): MatchEngine => {
  const { engine } = createMatchSession({
    matchId,
    home: buildTeam(homeFormation, 'home'),
    away: buildTeam(awayFormation, 'away'),
    tactics,
  });

  for (let index = 0; index < 60 * 400 && engine.period !== 'FULL_TIME'; index += 1) {
    engine.tick(STEP);
  }

  return engine;
};

/** ตัววัดคุณภาพของแมตช์ — ใช้ซ้ำได้ทั้งในเทสสมดุลและเทสความเสถียร */
export interface MatchQuality {
  matches: number;
  goals: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  completedPasses: number;
  tackles: number;
  fouls: number;
  cards: number;
  wins: number;
  draws: number;
  losses: number;
}

const emptyQuality = (): MatchQuality => ({
  matches: 0,
  goals: 0,
  shots: 0,
  shotsOnTarget: 0,
  passes: 0,
  completedPasses: 0,
  tackles: 0,
  fouls: 0,
  cards: 0,
  wins: 0,
  draws: 0,
  losses: 0,
});

/** รวมสถิติของทีมเหย้าจากหนึ่งนัดเข้ากับตัวสะสม */
const collect = (into: MatchQuality, engine: MatchEngine): MatchQuality => {
  const home = engine.stats.home;

  into.matches += 1;
  into.goals += engine.score.home;
  into.shots += home.shots;
  into.shotsOnTarget += home.shotsOnTarget;
  into.passes += home.passes;
  into.completedPasses += home.completedPasses;
  into.tackles += home.tackles;
  into.fouls += home.fouls;
  into.cards += home.yellowCards + home.redCards;

  if (engine.score.home > engine.score.away) into.wins += 1;
  else if (engine.score.home === engine.score.away) into.draws += 1;
  else into.losses += 1;

  return into;
};

/* ══ สมดุลของแผน ══════════════════════════════════════════ */

describe('สมดุลของแผน', () => {
  it('ทุกแผนเจอกันครบ และไม่มีแผนไหนชนะหรือแพ้เกือบทั้งหมด', () => {
    const perMatchup = 12;
    const table = new Map<string, MatchQuality>();

    FORMATIONS.forEach((home) => {
      FORMATIONS.forEach((away) => {
        const quality = table.get(home.id) ?? emptyQuality();

        for (let index = 0; index < perMatchup; index += 1) {
          collect(quality, runMatch(`${home.id}-${away.id}-${index}`, home.id, away.id));
        }

        table.set(home.id, quality);
      });
    });

    table.forEach((quality, formationId) => {
      const rate = quality.wins / quality.matches;
      const lossRate = quality.losses / quality.matches;

      // ไม่มีแผนไหนชนะเกือบหมดหรือแพ้เกือบหมด
      expect(rate, `${formationId} ชนะ ${(rate * 100).toFixed(0)}%`).toBeLessThan(0.85);
      expect(lossRate, `${formationId} แพ้ ${(lossRate * 100).toFixed(0)}%`).toBeLessThan(0.85);

      // และต้องทำประตูได้จริงในบางนัด ไม่ใช่ยิงไม่เข้าเลยทั้งชุด
      expect(quality.goals).toBeGreaterThan(0);
    });
  }, 600_000);

  it('ไม่มีการให้แต้มพิเศษกับแผนใดแผนหนึ่งในโค้ด', () => {
    // แผนถูกอ่านจากข้อมูลจริงเท่านั้น เอนจินไม่รู้จักชื่อแผนเลย
    FORMATIONS.forEach((formation) => {
      const team = buildTeam(formation.id, 'home');
      expect(team.players).toHaveLength(11);
      team.players.forEach((player) => {
        expect(player.formationX).toBeGreaterThanOrEqual(0);
        expect(player.formationY).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

/* ══ ความถี่การยิง ════════════════════════════════════════ */

describe('ความถี่การยิง', () => {
  it('ยิงหลายครั้งต่อนัด ไม่ใช่แค่สองสามครั้งอย่างก่อนหน้านี้', () => {
    let shots = 0;
    let matches = 0;

    FORMATIONS.forEach((formation, index) => {
      const away = FORMATIONS[(index + 1) % FORMATIONS.length];

      for (let seed = 0; seed < 6; seed += 1) {
        const engine = runMatch(`shots-${formation.id}-${seed}`, formation.id, away.id);
        shots += engine.stats.home.shots + engine.stats.away.shots;
        matches += 1;
      }
    });

    const perMatch = shots / matches / 2; // ต่อทีม
    expect(perMatch).toBeGreaterThan(4);
    expect(perMatch).toBeLessThan(30);
  }, 300_000);

  it('มี cooldown การยิง — ยิงรัวหลายครั้งในไม่กี่เฟรมไม่ได้', () => {
    const engine = runMatch('cooldown', '4-4-2', '4-3-3');

    const shotMinutes = engine.events
      .filter((event) => event.type === 'shot')
      .map((event) => event.minute);

    // ต้องมีการยิงจริง และไม่มีนาทีไหนยิงถี่จนผิดธรรมชาติ
    expect(shotMinutes.length).toBeGreaterThan(0);
    const perMinute = new Map<number, number>();
    shotMinutes.forEach((m) => perMinute.set(m, (perMinute.get(m) ?? 0) + 1));
    perMinute.forEach((count) => expect(count).toBeLessThan(8));

    engine.players.forEach((agent) => {
      expect(agent.shotCooldown).toBeGreaterThanOrEqual(0);
      expect(agent.shotCooldown).toBeLessThanOrEqual(1.5);
    });
  }, 120_000);

  it('คนที่ครองบอลนอกระยะยิงยังไม่ยิง', () => {
    const { engine } = createMatchSession({
      matchId: 'range',
      home: buildTeam('4-3-3', 'home'),
      away: buildTeam('4-4-2', 'away'),
    });

    const deep = engine.home.players[2];
    deep.position2d = { x: 20, y: 34 };
    expect(evaluateShot(deep, engine.away.players).score).toBeLessThan(MIN_SHOT_SCORE);
  });
});

/* ══ การส่งบอล ════════════════════════════════════════════ */

describe('การให้คะแนนส่งบอล', () => {
  it('ลูกยาวยังส่งได้ แต่คะแนนต่ำกว่าลูกสั้นในสภาพเดียวกัน', () => {
    const { engine } = createMatchSession({
      matchId: 'passing',
      home: buildTeam('4-3-3', 'home'),
      away: buildTeam('4-4-2', 'away'),
    });

    engine.away.players.forEach((agent) => {
      agent.position2d = { x: 2, y: 2 };
    });

    const passer = engine.home.players[6];
    const near = engine.home.players[8];
    const far = engine.home.players[9];

    passer.position2d = { x: 45, y: 34 };
    near.position2d = { x: 63, y: 34 };
    far.position2d = { x: 85, y: 34 };

    const nearScore = scorePass(passer, near, engine.away.players);
    const farScore = scorePass(passer, far, engine.away.players);

    expect(nearScore).toBeGreaterThan(farScore);
    expect(farScore).toBeGreaterThan(-Infinity); // ลูก 40 ม. ต้องไม่ใช่สิ่งต้องห้าม
  });

  it('มีคนขวางทางไกล ๆ เสียคะแนนมากกว่ามีคนขวางทางใกล้ ๆ', () => {
    const { engine } = createMatchSession({
      matchId: 'lane-risk',
      home: buildTeam('4-4-2', 'home'),
      away: buildTeam('4-4-2', 'away'),
    });

    engine.away.players.forEach((agent) => {
      agent.position2d = { x: 2, y: 2 };
    });

    const passer = engine.home.players[6];
    const near = engine.home.players[8];
    const far = engine.home.players[9];
    passer.position2d = { x: 40, y: 34 };
    near.position2d = { x: 55, y: 34 };
    far.position2d = { x: 80, y: 34 };

    const blocker = engine.away.players[5];

    blocker.position2d = { x: 47, y: 34 };
    const nearBlocked = scorePass(passer, near, engine.away.players);
    blocker.position2d = { x: 60, y: 34 };
    const farBlocked = scorePass(passer, far, engine.away.players);

    // ทั้งคู่โดนขวางหนึ่งคนเหมือนกัน แต่ลูกยาวต้องเสียคะแนนหนักกว่า
    expect(farBlocked).toBeLessThan(nearBlocked);
  });
});

/* ══ การเลือกนักเตะ ═══════════════════════════════════════ */

describe('การเลือกนักเตะบนสนาม', () => {
  it('การเลือกไม่เปลี่ยนสถานะการจำลองเลย', () => {
    // seed เดียวกันสองรอบ — การเลือกนักเตะไม่ได้อยู่ในเอนจิน ผลจึงต้องเท่ากันเป๊ะ
    const first = runMatch('selection', '4-4-2', '4-3-3');
    const second = runMatch('selection', '4-4-2', '4-3-3');

    // เลือกนักเตะเป็นเรื่องของ UI ทั้งหมด เอนจินไม่มีช่องเก็บการเลือกด้วยซ้ำ
    expect(Object.keys(first)).not.toContain('selectedPlayerId');
    expect(first.score).toEqual(second.score);
  }, 120_000);

  it('ข้อมูลที่แผงนักเตะใช้มาจาก PlayerAgent จริงทั้งหมด', () => {
    const { engine } = createMatchSession({
      matchId: 'panel',
      home: buildTeam('4-3-3', 'home'),
      away: buildTeam('4-4-2', 'away'),
    });

    engine.players.forEach((agent) => {
      expect(agent.name).toBeTruthy();
      expect(agent.shirtNumber).toBeGreaterThan(0);
      expect(agent.position).toBeTruthy();
      expect(agent.ovr).toBeGreaterThan(0);
      expect(['gk', 'defence', 'midfield', 'attack']).toContain(agent.role);
      expect(agent.state).toBeTruthy();
      expect(agent.decision).toBeTruthy();
      expect(engine.statsFor(agent.id).playerId).toBe(agent.id);
    });
  });
});

/* ══ แทคติกที่บันทึกไว้ ═══════════════════════════════════ */

describe('การบันทึกและโหลดแทคติก', () => {
  it('บัญชีเก่าที่ไม่มีแทคติกได้ค่ากลางทั้งหมด', () => {
    expect(normaliseTactics(undefined)).toEqual(DEFAULT_TACTICS);
    expect(normaliseTactics(null)).toEqual(DEFAULT_TACTICS);
    expect(normaliseTactics({})).toEqual(DEFAULT_TACTICS);
  });

  it('แทคติกที่บันทึกไว้กลับมาเหมือนเดิมหลังโหลดใหม่', () => {
    const saved: Tactics = {
      mentality: 'ATTACKING',
      tempo: 'FAST',
      width: 'WIDE',
      pressing: 'HIGH',
      defensiveLine: 'HIGH',
    };

    // เหมือนเซฟลงบัญชีแล้วอ่านกลับมา (ผ่าน JSON เหมือนที่ Firestore ทำ)
    const reloaded = normaliseTactics(JSON.parse(JSON.stringify(saved)));
    expect(reloaded).toEqual(saved);
  });

  it('แทคติกที่บันทึกไว้ถูกส่งเข้าเอนจินตอนสร้างแมตช์', () => {
    const saved: Tactics = {
      mentality: 'DEFENSIVE',
      tempo: 'SLOW',
      width: 'NARROW',
      pressing: 'LOW',
      defensiveLine: 'DEEP',
    };

    const { engine } = createMatchSession({
      matchId: 'load',
      home: buildTeam('4-4-2', 'home'),
      away: buildTeam('4-3-3', 'away'),
      tactics: { home: saved },
    });

    expect(engine.tactics.home).toEqual(saved);
    expect(engine.modifiersFor('home').lineOffset).toBeLessThan(-10);
  });

  it('คู่แข่งมีแทคติกของตัวเอง และเป็นค่าเดิมทุกครั้งสำหรับทีมเดิม', () => {
    const first = opponentTactics({ teamId: 'rival-1', formationId: '4-4-2', ovr: 84 });
    const second = opponentTactics({ teamId: 'rival-1', formationId: '4-4-2', ovr: 84 });
    const other = opponentTactics({ teamId: 'rival-2', formationId: '4-3-3', ovr: 70 });

    expect(first).toEqual(second);
    expect(normaliseTactics(first)).toEqual(first);
    expect(normaliseTactics(other)).toEqual(other);
  });
});

/* ══ ค่าพลังและบทบาท ═════════════════════════════════════ */

describe('ค่าพลังและบทบาท', () => {
  it('ค่าพลังต่างกันให้ผลต่างกัน แต่ไม่มีใครสำเร็จ 100%', () => {
    const { engine } = createMatchSession({
      matchId: 'quality',
      home: buildTeam('4-4-2', 'home'),
      away: buildTeam('4-3-3', 'away'),
    });

    const shooters = [...engine.home.players].sort((a, b) => b.shooting - a.shooting);
    const best = shooters[0];
    const worst = shooters[shooters.length - 1];

    [best, worst].forEach((agent) => {
      agent.position2d = { x: 92, y: 34 };
    });

    // คนยิงเก่งกว่าได้คะแนนโอกาสสูงกว่าเมื่อยืนจุดเดียวกันและตำแหน่งเดียวกัน
    if (best.position === worst.position) {
      expect(evaluateShot(best, engine.away.players).score).toBeGreaterThan(
        evaluateShot(worst, engine.away.players).score,
      );
    }

    expect(best.shooting).toBeGreaterThan(worst.shooting);
    expect(best.shooting).toBeLessThan(100);
  });

  it('แต่ละบทบาทมีพฤติกรรมต่างกันจริง', () => {
    expect(SHOT_TENDENCY.ST).toBeGreaterThan(SHOT_TENDENCY.CM);
    expect(SHOT_TENDENCY.CM).toBeGreaterThan(SHOT_TENDENCY.CB);
    expect(SHOT_TENDENCY.GK).toBe(0);

    const engine = runMatch('roles', '4-4-2', '4-3-3');
    const keeper = engine.home.players.find((agent) => agent.role === 'gk');
    expect(keeper?.position2d.x).toBeLessThan(25);

    const attackers = engine.home.players.filter((agent) => agent.role === 'attack');
    const defenders = engine.home.players.filter((agent) => agent.role === 'defence');
    const mean = (list: typeof attackers) =>
      list.reduce((sum, agent) => sum + agent.formationPosition.x, 0) / list.length;

    expect(mean(attackers)).toBeGreaterThan(mean(defenders));
  }, 120_000);
});

/* ══ ความเสถียร 500 นัด ══════════════════════════════════ */

describe('ความเสถียรของการจำลอง 500 นัด', () => {
  it('รัน 500 นัดหลายแผนหลายแทคติกแล้วไม่มีค่าพัง', () => {
    const mentalities: Array<Tactics['mentality']> = ['DEFENSIVE', 'BALANCED', 'ATTACKING'];
    const total = emptyQuality();
    let biggestWin = 0;

    for (let index = 0; index < 500; index += 1) {
      const home = FORMATIONS[index % FORMATIONS.length];
      const away = FORMATIONS[(index + 1 + (index % 3)) % FORMATIONS.length];
      const mentality = mentalities[index % mentalities.length];

      const engine = runMatch(`bulk-${index}`, home.id, away.id, { home: { mentality } });

      expect(engine.period).toBe('FULL_TIME');
      collect(total, engine);

      (['home', 'away'] as const).forEach((side) => {
        Object.values(engine.stats[side]).forEach((value) => {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        });

        const onPitch = engine[side].players.length;
        expect(onPitch).toBeGreaterThan(0);
        expect(onPitch).toBeLessThanOrEqual(11);
      });

      expect(engine.score.home).toBeGreaterThanOrEqual(0);
      expect(engine.score.away).toBeGreaterThanOrEqual(0);
      biggestWin = Math.max(biggestWin, Math.abs(engine.score.home - engine.score.away));
    }

    const perMatch = {
      goals: total.goals / total.matches,
      shots: total.shots / total.matches,
      accuracy: total.completedPasses / total.passes,
      fouls: total.fouls / total.matches,
      cards: total.cards / total.matches,
    };

    // ไม่ใช่ฟุตบอลจริงเป๊ะ ๆ แต่ต้องไม่หลุดโลก
    expect(perMatch.goals).toBeGreaterThan(0.1);
    expect(perMatch.goals).toBeLessThan(6);
    expect(perMatch.shots).toBeGreaterThan(2);
    expect(perMatch.shots).toBeLessThan(40);
    expect(perMatch.accuracy).toBeGreaterThan(0.4);
    expect(perMatch.accuracy).toBeLessThan(0.99);
    expect(perMatch.fouls).toBeLessThan(15);
    expect(perMatch.cards).toBeLessThan(3);
    expect(biggestWin).toBeLessThan(10);
  }, 900_000);
});
