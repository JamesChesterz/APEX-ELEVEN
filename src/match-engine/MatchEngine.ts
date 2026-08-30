/**
 * Match Engine — หัวใจของการจำลองแมตช์
 *
 *   Match
 *   ├── teams   (home / away)
 *   ├── players (PlayerAgent × 22)
 *   ├── ball    (BallEntity)
 *   ├── clock   (MatchClock)
 *   ├── state   (MatchPhase)
 *   └── events  (MatchSimEvent[])
 *
 * เป็น TypeScript ล้วน ไม่มี React ไม่มี DOM ไม่มี requestAnimationFrame
 * ผู้เรียกต้องเดินลูปเอง แล้วเรียก tick(dt) ให้ (ดู LiveMatchCanvas)
 * ทำแบบนี้เพื่อให้ทดสอบด้วย vitest ได้ตรง ๆ และให้ renderer อ่าน state ไปวาดโดยไม่ต้องมี React state ต่อเฟรม
 *
 * PHASE 1 ทำแค่: จัดคนตามแผน, เดินตามบอล, รักษารูปทีม, นาฬิกาเดิน
 * ยังไม่มี ส่งบอล / ยิง / เซฟ / แท็กเกิล / ฟาวล์ — จุดต่อของทั้งหมดนั้นทำเครื่องหมาย PHASE 2 ไว้แล้ว
 */
import { BallEntity } from '@/match-engine/ball';
import {
  interceptTarget,
  leashToZone,
  shapeTarget,
  supportTarget,
  type ShapeContext,
} from '@/match-engine/formationSystem';
import {
  PITCH,
  centreSpot,
  distanceSq,
  formationToWorld,
  ownGoalLine,
  targetGoalLine,
} from '@/match-engine/pitch';
import { PlayerAgent, SEPARATION_RADIUS } from '@/match-engine/playerAgent';
import type {
  MatchClock,
  MatchEngineOptions,
  MatchPhase,
  MatchSide,
  MatchSimEvent,
  MatchTeamInput,
  Vec2,
} from '@/match-engine/types';
import { hashString, seededRandom } from '@/utils/seededRandom';

/** ระยะที่ถือว่านักเตะแตะบอลได้ (เมตร) */
const CONTROL_RADIUS = 1.1;

/** เวลาขั้นต่ำระหว่างการแตะบอลสองครั้ง (วินาที) — กันบอลสั่นติดเท้า */
const TOUCH_COOLDOWN = 0.45;

/** ความแรงของการเขี่ยบอลออกไป (เมตร/วินาที) */
const KICK_POWER = { min: 8, max: 15 } as const;

/** น้ำหนักของ "บอลอยู่ในเขตใคร" ตอนเลือกคนไล่บอล (0 = ดูแค่ระยะปัจจุบัน) */
const ZONE_WEIGHT = 0.6;

/** ผู้รักษาประตูจะออกไปไล่บอลเองก็ต่อเมื่อบอลอยู่ในเขตโทษของตัวเอง */
const KEEPER_ENGAGE_DEPTH = PITCH.penaltyDepth;

export interface MatchTeamState {
  id: string;
  name: string;
  side: MatchSide;
  formationName: string;
  color: string;
  accent: string;
  players: PlayerAgent[];
}

export class MatchEngine {
  readonly home: MatchTeamState;
  readonly away: MatchTeamState;

  /** นักเตะทั้ง 22 คนรวมกัน — renderer วนอันนี้อันเดียว */
  readonly players: PlayerAgent[];

  readonly ball: BallEntity;

  clock: MatchClock = { minute: 0, second: 0, running: false };
  phase: MatchPhase = 'kickoff';

  /** เหตุการณ์ที่เกิดขึ้นแล้ว — PHASE 1 มีแค่ kickoff/fulltime */
  readonly events: MatchSimEvent[] = [];

  /** id ของคนที่กำลังไล่บอลของแต่ละฝั่ง — renderer เอาไปวาดวงไฮไลต์ */
  chaserIds: { home: string | null; away: string | null } = { home: null, away: null };

  /** ฝั่งที่ถือว่าเป็นฝ่ายได้เปรียบในจังหวะนี้ (ใกล้บอลกว่า) */
  initiative: MatchSide = 'home';

  private readonly totalMinutes: number;
  private readonly minutesPerSecond: number;
  private readonly random: () => number;

  /** เวลาที่จำลองไปแล้ว (วินาทีจริง) ใช้ทำคลื่นการหาพื้นที่ว่าง */
  private elapsed = 0;
  private touchCooldown = 0;

  constructor(home: MatchTeamInput, away: MatchTeamInput, options: MatchEngineOptions = {}) {
    this.totalMinutes = options.totalMinutes ?? 90;
    this.minutesPerSecond = options.minutesPerSecond ?? 1;
    this.random = seededRandom(hashString(options.seed ?? `${home.id}-${away.id}`));

    this.home = this.buildTeam(home, 'home');
    this.away = this.buildTeam(away, 'away');
    this.players = [...this.home.players, ...this.away.players];
    this.ball = new BallEntity(centreSpot());

    this.kickoff();
  }

  /* ── การตั้งทีม ───────────────────────────────────────── */

  private buildTeam(input: MatchTeamInput, side: MatchSide): MatchTeamState {
    return {
      id: input.id,
      name: input.name,
      side,
      formationName: input.formationName,
      color: input.color,
      accent: input.accent,
      players: input.players.map((player) => {
        const home = formationToWorld(player.formationX, player.formationY, side);
        return new PlayerAgent(player, side, home, this.random());
      }),
    };
  }

  /* ── วงจรชีวิตของแมตช์ ────────────────────────────────── */

  /** เขี่ยบอล: คืนทุกคนกลับตำแหน่งบ้าน วางบอลกลางสนาม แล้วเริ่มนาฬิกา */
  kickoff(): void {
    this.players.forEach((agent) => {
      agent.position2d = { ...agent.formationPosition };
      agent.velocity = { x: 0, y: 0 };
      agent.targetPosition = { ...agent.formationPosition };
      agent.state = 'POSITIONING';
      agent.speed = 0;
    });

    this.ball.reset(centreSpot());
    // เขี่ยเบา ๆ ให้บอลไม่นิ่งสนิทตั้งแต่วินาทีแรก จะได้เห็นคนวิ่งเข้าหาทันที
    const angle = this.random() * Math.PI * 2;
    this.ball.kick({ x: Math.cos(angle), y: Math.sin(angle) }, 6);

    this.clock = { minute: 0, second: 0, running: true };
    this.phase = 'live';
    this.elapsed = 0;
    this.touchCooldown = 0;
    this.events.push({ type: 'kickoff', minute: 0 });
  }

  /** หยุด/เดินนาฬิกาต่อ (ใช้ตอนเกมหยุดรอเปลี่ยนตัวคนบาดเจ็บ) */
  setPaused(paused: boolean): void {
    if (this.phase === 'fulltime') return;
    this.phase = paused ? 'paused' : 'live';
    this.clock.running = !paused;
  }

  /**
   * ปรับนาฬิกาให้ตรงกับนาทีจากระบบถ่ายทอดสดเดิม (useMatchmaking)
   *
   * เอนจินเดินนาฬิกาเองแบบต่อเนื่องเพื่อให้เข็มลื่น แต่ตัวเลขนาทีที่เป็นทางการ
   * ยังเป็นของระบบเดิมอยู่ ฟังก์ชันนี้ดึงกลับให้ตรงเมื่อคลาดกันเกิน 1 นาที
   */
  syncClock(minute: number): void {
    if (Math.abs(minute - this.clock.minute) < 1) return;
    this.clock.minute = Math.min(Math.max(Math.round(minute), 0), this.totalMinutes);
    this.clock.second = 0;
  }

  /** เวลารวมเป็นข้อความ MM:SS สำหรับโชว์บนสนาม */
  clockLabel(): string {
    const minute = String(Math.floor(this.clock.minute)).padStart(2, '0');
    const second = String(Math.floor(this.clock.second)).padStart(2, '0');
    return `${minute}:${second}`;
  }

  /* ── หนึ่ง tick ของการจำลอง ───────────────────────────── */

  /**
   * เดินการจำลองไปข้างหน้า dt วินาที (เวลาจริง)
   * ผู้เรียกควรตรึง dt ไว้ให้คงที่ (ดู FIXED_STEP ใน LiveMatchCanvas)
   */
  tick(dt: number): void {
    if (this.phase !== 'live') return;

    this.elapsed += dt;
    this.advanceClock(dt);

    this.decide();
    this.moveEveryone(dt);

    this.ball.update(dt);
    this.resolveTouches(dt);
  }

  private advanceClock(dt: number): void {
    if (!this.clock.running) return;

    const gained = dt * this.minutesPerSecond * 60; // เป็นวินาทีในเกม
    this.clock.second += gained;

    while (this.clock.second >= 60) {
      this.clock.second -= 60;
      this.clock.minute += 1;
    }

    if (this.clock.minute >= this.totalMinutes) {
      this.clock.minute = this.totalMinutes;
      this.clock.second = 0;
      this.clock.running = false;
      this.phase = 'fulltime';
      this.events.push({ type: 'fulltime', minute: this.totalMinutes });
    }
  }

  /* ── การตัดสินใจ: ใครทำอะไร แล้วเป้าหมายอยู่ตรงไหน ─────── */

  private decide(): void {
    const homeChaser = this.pickChaser(this.home);
    const awayChaser = this.pickChaser(this.away);

    this.chaserIds = {
      home: homeChaser?.id ?? null,
      away: awayChaser?.id ?? null,
    };

    // ฝั่งที่คนใกล้บอลที่สุดอยู่ใกล้กว่า = ฝ่ายที่ถือว่าได้เปรียบในจังหวะนี้
    const homeGap = homeChaser ? homeChaser.distanceTo(this.ball.position) : Infinity;
    const awayGap = awayChaser ? awayChaser.distanceTo(this.ball.position) : Infinity;
    this.initiative = homeGap <= awayGap ? 'home' : 'away';

    this.assignTargets(this.home, homeChaser);
    this.assignTargets(this.away, awayChaser);
  }

  /**
   * คนที่จะวิ่งไปหาบอลของทีมนี้ = คนที่ใกล้บอลที่สุด
   * ผู้รักษาประตูจะถูกเลือกก็ต่อเมื่อบอลเข้ามาในเขตโทษของตัวเองแล้วเท่านั้น
   */
  private pickChaser(team: MatchTeamState): PlayerAgent | null {
    const line = ownGoalLine(team.side);
    const ballInOwnBox = Math.abs(this.ball.position.x - line) < KEEPER_ENGAGE_DEPTH;

    let best: PlayerAgent | null = null;
    let bestGap = Infinity;

    for (const agent of team.players) {
      if (agent.role === 'gk' && !ballInOwnBox) continue;

      /*
       * ไม่ได้เลือกแค่ "คนที่ใกล้บอลที่สุดตอนนี้" แต่ถ่วงน้ำหนักด้วยว่า
       * บอลอยู่ในเขตของใคร กองหลังที่บังเอิญเดินเลยขึ้นมาจึงไม่ถูกดูดขึ้นไปไล่บอลหน้าประตูคู่แข่ง
       */
      const toBall = Math.sqrt(distanceSq(agent.position2d, this.ball.position));
      const zoneGap = Math.sqrt(distanceSq(agent.formationPosition, this.ball.position));
      const score = toBall + zoneGap * ZONE_WEIGHT;

      if (score < bestGap) {
        bestGap = score;
        best = agent;
      }
    }

    return best;
  }

  private assignTargets(team: MatchTeamState, chaser: PlayerAgent | null): void {
    const hasInitiative = this.initiative === team.side;

    // คนที่ใกล้บอลรองลงมาเป็นตัว support (เฉพาะฝั่งที่ได้เปรียบ)
    const supporter = hasInitiative ? this.pickSupporter(team, chaser) : null;

    team.players.forEach((agent) => {
      if (chaser && agent.id === chaser.id) {
        agent.state = 'MOVING_TO_BALL';
        // ไล่บอลได้ แต่ไม่ทิ้งเขตของตัวเอง — ไม่งั้นรูปทีมจะพังทุกครั้งที่บอลลอยไกล
        agent.targetPosition = leashToZone(
          interceptTarget(this.ball.position, this.ball.velocity),
          agent.formationPosition,
          agent.role,
        );
        return;
      }

      if (supporter && agent.id === supporter.id) {
        agent.state = 'SUPPORT';
        agent.targetPosition = leashToZone(
          supportTarget(this.ball.position, team.side, agent.formationPosition),
          agent.formationPosition,
          agent.role,
        );
        return;
      }

      const context: ShapeContext = {
        side: team.side,
        role: agent.role,
        home: agent.formationPosition,
        ball: this.ball.position,
        hasInitiative,
        jitter: agent.jitter,
        elapsed: this.elapsed,
      };

      agent.targetPosition = shapeTarget(context);
      agent.state =
        agent.role === 'gk' ? 'POSITIONING' : hasInitiative ? 'ATTACKING' : 'DEFENDING';
    });
  }

  /** ตัว support = คนใกล้บอลรองจากคนไล่บอล (ไม่เอาผู้รักษาประตู) */
  private pickSupporter(team: MatchTeamState, chaser: PlayerAgent | null): PlayerAgent | null {
    let best: PlayerAgent | null = null;
    let bestGap = Infinity;

    for (const agent of team.players) {
      if (agent.role === 'gk') continue;
      if (chaser && agent.id === chaser.id) continue;

      const gap = distanceSq(agent.position2d, this.ball.position);
      if (gap < bestGap) {
        bestGap = gap;
        best = agent;
      }
    }

    return best;
  }

  /* ── การเคลื่อนที่ ────────────────────────────────────── */

  private moveEveryone(dt: number): void {
    this.players.forEach((agent) => {
      agent.update(dt, this.separationFor(agent), this.ball.position);
    });
  }

  /**
   * แรงผลักออกจากเพื่อนร่วมทีมที่ยืนชิดเกินไป
   * มีแค่กับเพื่อนร่วมทีม — คู่แข่งยืนทับกันได้ (PHASE 2 ค่อยทำการประกบตัวจริง ๆ)
   */
  private separationFor(agent: PlayerAgent): Vec2 {
    const team = agent.side === 'home' ? this.home : this.away;
    const push: Vec2 = { x: 0, y: 0 };

    team.players.forEach((other) => {
      if (other.id === agent.id) return;

      const dx = agent.position2d.x - other.position2d.x;
      const dy = agent.position2d.y - other.position2d.y;
      const gap = Math.hypot(dx, dy);
      if (gap >= SEPARATION_RADIUS || gap === 0) return;

      // ยิ่งชิดยิ่งผลักแรง
      const strength = (SEPARATION_RADIUS - gap) / SEPARATION_RADIUS;
      push.x += (dx / gap) * strength * 2.2;
      push.y += (dy / gap) * strength * 2.2;
    });

    return push;
  }

  /* ── การแตะบอล ────────────────────────────────────────── */

  /**
   * คนที่วิ่งถึงบอลจะเขี่ยบอลออกไปทางฝั่งที่ทีมตัวเองบุก
   *
   * นี่ยังไม่ใช่ระบบส่งบอล — เป็นแค่การทำให้บอลเคลื่อนที่ต่อ นักเตะจึงมีอะไรให้ไล่
   * PHASE 2 จะเข้ามาแทนที่ตรงนี้ด้วยการตัดสินใจจริง (ส่งให้ใคร / ยิง / เลี้ยงต่อ)
   * โดยเปลี่ยนแค่เมธอดนี้เมธอดเดียว
   */
  private resolveTouches(dt: number): void {
    this.touchCooldown = Math.max(0, this.touchCooldown - dt);
    if (this.touchCooldown > 0) return;

    const toucher = this.players.find(
      (agent) => agent.distanceTo(this.ball.position) <= CONTROL_RADIUS,
    );
    if (!toucher) return;

    const goalX = targetGoalLine(toucher.side);
    const toGoal: Vec2 = {
      x: goalX - this.ball.position.x,
      y: PITCH.width / 2 - this.ball.position.y,
    };

    // เบี่ยงทิศแบบสุ่มเล็กน้อย ไม่งั้นบอลจะวิ่งเป็นเส้นตรงเข้าประตูทุกครั้ง
    const spread = (this.random() - 0.5) * 1.6;
    const angle = Math.atan2(toGoal.y, toGoal.x) + spread;
    const power = KICK_POWER.min + this.random() * (KICK_POWER.max - KICK_POWER.min);

    this.ball.kick({ x: Math.cos(angle), y: Math.sin(angle) }, power, toucher.id);
    this.touchCooldown = TOUCH_COOLDOWN;
  }
}

/**
 * สร้างแมตช์ใหม่จากข้อมูลทีมสองทีม
 *
 * นี่คือหน้าประตูเดียวที่ระบบอื่นต้องรู้จัก:
 *   const match = createMatch(homeTeam, awayTeam)
 * ที่เหลือเอนจินจัดการเองทั้งหมด
 */
export const createMatch = (
  homeTeam: MatchTeamInput,
  awayTeam: MatchTeamInput,
  options?: MatchEngineOptions,
): MatchEngine => new MatchEngine(homeTeam, awayTeam, options);
