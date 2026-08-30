/**
 * Match Engine — หัวใจของการจำลองแมตช์
 *
 *   Match
 *   ├── teams   (home / away)
 *   ├── players (PlayerAgent × 22)
 *   ├── ball    (BallEntity — เป็นเจ้าของสถานะการครองบอล)
 *   ├── clock   (MatchClock)
 *   ├── state   (MatchPhase)
 *   ├── events  (MatchSimEvent[])
 *   └── stats   (TeamMatchStats ต่อทีม)
 *
 * เป็น TypeScript ล้วน ไม่มี React ไม่มี DOM ไม่มี requestAnimationFrame
 * ผู้เรียกต้องเดินลูปเอง แล้วเรียก tick(dt) ให้ (ดู LiveMatchCanvas)
 *
 * ลำดับงานในหนึ่ง tick:
 *   นาฬิกา → ตัดสินใจ (ส่งบอล?) → กำหนดเป้าหมายการเดิน → คนขยับ → บอลขยับ → ใครได้บอล → นับสถิติ
 *
 * PHASE 1  : จัดคนตามแผน เดินตามบอล รักษารูปทีม นาฬิกาเดิน
 * PHASE 1.5: นาฬิกาแหล่งเดียว ปรับรายชื่อกลางเกมได้ การแตะบอลไม่สุ่ม
 * PHASE 2  : ครองบอล ส่งบอล รับบอล เปลี่ยนการครองบอล ตัดบอล support movement การกดดัน
 *
 * ยังไม่มี: ยิงประตู · ประตู · เซฟ · แท็กเกิลเต็มระบบ · ฟาวล์ · ใบเหลือง/แดง · เปลี่ยนตัว
 */
import { BallEntity } from '@/match-engine/ball';
import {
  interceptTarget,
  leashToZone,
  receiveTarget,
  shapeTarget,
  supportTarget,
  type ShapeContext,
  type SupportContext,
} from '@/match-engine/formationSystem';
import {
  TACKLE_ATTEMPT_RATE,
  TACKLE_COOLDOWN,
  TACKLE_RANGE,
  resolveTackle,
} from '@/match-engine/defense';
import { SAVE_REACH, saveChance, shotCoverTarget } from '@/match-engine/goalkeeper';
import { passSpeed, selectPassTarget } from '@/match-engine/passing';
import { MIN_SHOT_SCORE, calculateShot, evaluateShot } from '@/match-engine/shooting';
import {
  PITCH,
  attackDirection,
  centreSpot,
  distanceSq,
  formationToWorld,
  goalCrossed,
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
  PlayerMatchStats,
  TeamMatchStats,
  Vec2,
} from '@/match-engine/types';
import { hashString, seededRandom } from '@/utils/seededRandom';

/** ระยะที่เก็บลูกหลุดขึ้นมาครองได้ (เมตร) */
const CONTROL_RADIUS = 1.3;

/** ระยะที่ผู้รับที่ตั้งใจไว้เก็บลูกที่ส่งมาได้ — กว้างกว่านิดหน่อยเพราะบอลวิ่งเร็ว */
const RECEIVE_RADIUS = 1.9;

/** ระยะที่คู่แข่งเข้าตัดลูกที่กำลังเดินทางได้ */
const INTERCEPT_RADIUS = 2.4;

/** โอกาสตัดบอลต่อวินาทีเมื่อยืนทับเส้นทางพอดี (ลดลงตามระยะ) */
const INTERCEPT_RATE = 2.8;

/** ช่วงเวลาที่ห้ามใครเก็บบอลหลังส่งออกไป (วินาที) — กันคนส่งเก็บคืนเองทันที */
const PASS_LOCK = 0.3;

/** ช่วงเวลาที่คนถือบอลได้ถือก่อนตัดสินใจ (วินาที) */
const HOLD_TIME = { min: 0.8, max: 2 } as const;

/** ไม่มีจังหวะส่ง — เลี้ยงต่อแล้วมองใหม่อีกครั้งในอีกกี่วินาที */
const HOLD_RETRY = 0.45;

/**
 * ถือบอลได้นานสุดกี่วินาที
 * เกินนี้ต้องปล่อยบอลไม่ว่าจังหวะจะดีหรือไม่ — ไม่งั้นคนถือบอลจะยืนกอดบอลอยู่มุมสนามได้ทั้งครึ่ง
 */
const MAX_HOLD = 3.2;

/** คู่แข่งเข้ามาใกล้กว่านี้ถือว่าโดนกดดัน ต้องรีบตัดสินใจ (เมตร) */
const PRESSED_RADIUS = 3;

/** โดนกดดันแล้วนาฬิกาตัดสินใจเดินเร็วขึ้นกี่เท่า */
const PRESSED_URGENCY = 2.4;

/** บอลอยู่ห่างจากเท้าคนที่ครองอยู่เท่าไร (เมตร) */
const DRIBBLE_LEAD = 0.95;

/** ระยะที่คนถือบอลเล็งจะเลี้ยงไปข้างหน้าต่อครั้ง (เมตร) */
const DRIBBLE_RANGE = 9;

/** ผู้รักษาประตูจะออกมายุ่งกับบอลก็ต่อเมื่อบอลอยู่ในเขตโทษของตัวเอง */
const KEEPER_ENGAGE_DEPTH = PITCH.penaltyDepth;

/** น้ำหนักของ "บอลอยู่ในเขตใคร" ตอนเลือกคนไล่บอล (0 = ดูแค่ระยะปัจจุบัน) */
const ZONE_WEIGHT = 0.6;

/** เก็บเหตุการณ์ล่าสุดไว้กี่รายการ — กันหน่วยความจำบวมในแมตช์ยาว */
const MAX_EVENTS = 300;

/** บอลตายหลังฟาวล์นานกี่วินาทีก่อนเริ่มเล่นใหม่ */
const DEAD_BALL_SECONDS = 1.2;

/** หลังทำประตู หยุดฉลองกี่วินาทีก่อนกลับไปเขี่ยบอล */
const CELEBRATION_SECONDS = 1.5;

/** หลังฟาวล์ ฝ่ายที่ถูกทำฟาวล์ได้สิทธิ์แตะบอลคนเดียวกี่วินาที */
const RESTART_EXCLUSIVE_SECONDS = 2;

const emptyStats = (): TeamMatchStats => ({
  passes: 0,
  completedPasses: 0,
  interceptions: 0,
  touches: 0,
  possessionSeconds: 0,
  shots: 0,
  shotsOnTarget: 0,
  goals: 0,
  saves: 0,
  tackles: 0,
  successfulTackles: 0,
  fouls: 0,
  yellowCards: 0,
  redCards: 0,
});

const emptyPlayerStats = (playerId: string): PlayerMatchStats => ({
  playerId,
  goals: 0,
  assists: 0,
  shots: 0,
  shotsOnTarget: 0,
  passes: 0,
  completedPasses: 0,
  interceptions: 0,
  tackles: 0,
  saves: 0,
  fouls: 0,
  yellowCards: 0,
  redCards: 0,
});

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

  /** เหตุการณ์ที่เกิดขึ้นแล้ว ใหม่สุดอยู่ท้าย */
  readonly events: MatchSimEvent[] = [];

  /** ตัวนับสถิติของสองทีม */
  readonly stats: Record<MatchSide, TeamMatchStats> = { home: emptyStats(), away: emptyStats() };

  /**
   * สถิติรายบุคคลของแมตช์นี้ (key = id ของผู้เล่นในแมตช์)
   * แยกจากข้อมูลนักเตะถาวรโดยสิ้นเชิง เอนจินไม่เคยเขียนกลับไปที่ Player
   */
  readonly playerStats = new Map<string, PlayerMatchStats>();

  /** id ของคนที่กำลังยุ่งกับบอลของแต่ละฝั่ง (คนถือบอล / คนเข้ากดดัน / คนไล่ลูกหลุด) */
  chaserIds: { home: string | null; away: string | null } = { home: null, away: null };

  /** ฝั่งที่ถือว่าเป็นฝ่ายได้เปรียบในจังหวะนี้ */
  initiative: MatchSide = 'home';

  private readonly totalMinutes: number;
  private readonly minutesPerSecond: number;
  private readonly clockSource: 'internal' | 'external';
  private readonly random: () => number;

  /** เวลาที่จำลองไปแล้ว (วินาทีจริง) ใช้ทำคลื่นการหาพื้นที่ว่าง */
  private elapsed = 0;

  /** เวลาที่เหลือก่อนจะมีใครเก็บบอลได้อีกครั้ง */
  private claimCooldown = 0;

  /** ฝั่งที่ครองบอลล่าสุด ใช้ตัดสินว่าเกิดการเปลี่ยนการครองบอลหรือไม่ */
  private lastPossessionSide: MatchSide | null = null;

  /** คนปัจจุบันถือบอลมานานเท่าไรแล้ว (วินาที) */
  private holdElapsed = 0;

  /** เวลาที่เหลือก่อนบอลตายจะกลับมาเล่นต่อ (วินาที) */
  private deadBallTimer = 0;

  /** ทอยเซฟไปแล้วสำหรับลูกยิงลูกนี้หรือยัง — หนึ่งลูกยิงทอยครั้งเดียว */
  private saveAttempted = false;

  /** ช่วงเริ่มเล่นใหม่หลังฟาวล์: มีแค่ฝั่งนี้ที่แตะบอลได้ */
  private claimSide: MatchSide | null = null;
  private claimSideTimer = 0;

  /** ฝั่งที่จะได้เล่นต่อเมื่อบอลตายหมดเวลา */
  private restartFor: MatchSide | null = null;

  /** จุดที่จะวางบอลตอนเริ่มเล่นใหม่ (null = เขี่ยกลางสนาม) */
  private restartSpot: Vec2 | null = null;

  /** ผู้จ่ายบอลคนล่าสุดให้คนที่ครองบอลอยู่ ใช้บันทึกแอสซิสต์ตอนทำประตู */
  private assistCandidate: { receiverId: string; passerId: string } | null = null;

  /** id ของคนที่โดนใบแดงไปแล้ว — กัน syncRoster พาเขากลับลงสนาม */
  private readonly sentOffIds = new Set<string>();

  constructor(home: MatchTeamInput, away: MatchTeamInput, options: MatchEngineOptions = {}) {
    this.totalMinutes = options.totalMinutes ?? 90;
    this.minutesPerSecond = options.minutesPerSecond ?? 1;
    this.clockSource = options.clockSource ?? 'internal';
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

  /* ── ตัวช่วยอ่านสถานะ ─────────────────────────────────── */

  /** คนที่ครองบอลอยู่ (null = บอลไม่ได้อยู่กับใคร) — อ่านจาก ball.owner เสมอ */
  ownerAgent(): PlayerAgent | null {
    if (!this.ball.owner) return null;
    return this.players.find((agent) => agent.id === this.ball.owner) ?? null;
  }

  /** ฝั่งที่ครองบอลอยู่ตอนนี้ (null = ลูกหลุดหรือบอลกำลังเดินทาง) */
  get possessionTeam(): MatchSide | null {
    return this.ownerAgent()?.side ?? null;
  }

  private teamOf(side: MatchSide): MatchTeamState {
    return side === 'home' ? this.home : this.away;
  }

  private opponentsOf(side: MatchSide): MatchTeamState {
    return side === 'home' ? this.away : this.home;
  }

  private agentById(id: string | null): PlayerAgent | null {
    if (!id) return null;
    return this.players.find((agent) => agent.id === id) ?? null;
  }

  private emit(event: MatchSimEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }

  /* ── วงจรชีวิตของแมตช์ ────────────────────────────────── */

  /**
   * เขี่ยบอลเริ่มแมตช์ — รีเซ็ตทุกอย่างรวมถึงนาฬิกา
   * ใช้ตอนสร้างเอนจินเท่านั้น หลังทำประตูให้ใช้ restart() ที่ไม่แตะนาฬิกา
   */
  kickoff(): void {
    this.resetToKickoff();
    this.clock = { minute: 0, second: 0, running: true };
    this.phase = 'live';
    this.elapsed = 0;
    this.emit({ type: 'kickoff', minute: 0 });
  }

  /**
   * เริ่มเล่นใหม่หลังทำประตู — คนกลับเข้าแผน บอลกลับกลางสนาม
   * แต่ **นาฬิกาเดินต่อ** ไม่รีเซ็ตเป็น 0 (23:14 ยิงประตู → เขี่ยบอล → ยังเป็น 23:14)
   */
  restart(): void {
    this.resetToKickoff();
    this.emit({ type: 'kickoff', minute: Math.floor(this.clock.minute) });
  }

  /** คืนคนและบอลกลับตำแหน่งตั้งต้น พร้อมล้างสถานะชั่วคราวทั้งหมด (ไม่แตะนาฬิกาและสกอร์) */
  private resetToKickoff(): void {
    this.players.forEach((agent) => {
      agent.position2d = { ...agent.formationPosition };
      agent.velocity = { x: 0, y: 0 };
      agent.targetPosition = { ...agent.formationPosition };
      agent.state = 'POSITIONING';
      agent.decision = 'MOVE';
      agent.decisionTimer = 0;
      agent.tackleCooldown = 0;
      agent.speed = 0;
    });

    this.ball.reset(centreSpot());
    // เขี่ยเบา ๆ ให้บอลไม่นิ่งสนิทตั้งแต่วินาทีแรก จะได้เห็นคนวิ่งเข้าหาทันที
    const angle = this.random() * Math.PI * 2;
    this.ball.kick({ x: Math.cos(angle), y: Math.sin(angle) }, 6);

    this.claimCooldown = 0;
    this.holdElapsed = 0;
    this.deadBallTimer = 0;
    this.restartFor = null;
    this.restartSpot = null;
    this.assistCandidate = null;
    this.lastPossessionSide = null;
    this.saveAttempted = false;
    this.claimSide = null;
    this.claimSideTimer = 0;
  }

  /** หยุด/เดินนาฬิกาต่อ (ใช้ตอนเกมหยุดรอเปลี่ยนตัวคนบาดเจ็บ) */
  setPaused(paused: boolean): void {
    if (this.phase === 'fulltime') return;
    this.phase = paused ? 'paused' : 'live';
    this.clock.running = !paused;
  }

  /**
   * รับนาทีจากระบบถ่ายทอดสดเดิม (useMatchmaking)
   *
   * โหมด 'external' — นาทีนี้คือความจริงเพียงหนึ่งเดียว เอนจินไม่นับเวลาเอง
   * โหมด 'internal' — เอนจินนับเอง ฟังก์ชันนี้เป็นแค่การดึงกลับเมื่อคลาดเกิน 1 นาที
   */
  syncClock(minute: number): void {
    const value = Math.min(Math.max(Math.round(minute), 0), this.totalMinutes);

    if (this.clockSource === 'internal') {
      if (Math.abs(value - this.clock.minute) < 1) return;
      this.clock.minute = value;
      this.clock.second = 0;
      return;
    }

    this.clock.minute = value;
    this.clock.second = 0;

    if (value >= this.totalMinutes && this.phase !== 'fulltime') {
      this.clock.running = false;
      this.phase = 'fulltime';
      this.emit({ type: 'fulltime', minute: this.totalMinutes });
    }
  }

  /** ข้อความนาฬิกาสำหรับโชว์บนสนาม */
  clockLabel(): string {
    if (this.clockSource === 'external') return `${Math.floor(this.clock.minute)}'`;

    const minute = String(Math.floor(this.clock.minute)).padStart(2, '0');
    const second = String(Math.floor(this.clock.second)).padStart(2, '0');
    return `${minute}:${second}`;
  }

  /**
   * สกอร์ปัจจุบัน
   * เป็น getter ที่อ่านจาก stats.goals ไม่ได้เก็บซ้ำอีกที่ — มีแหล่งความจริงเดียว
   */
  get score(): { home: number; away: number } {
    return { home: this.stats.home.goals, away: this.stats.away.goals };
  }

  /** สถิติรายบุคคล สร้างให้อัตโนมัติเมื่อถูกเรียกครั้งแรก */
  statsFor(playerId: string): PlayerMatchStats {
    let entry = this.playerStats.get(playerId);
    if (!entry) {
      entry = emptyPlayerStats(playerId);
      this.playerStats.set(playerId, entry);
    }
    return entry;
  }

  /** สัดส่วนการครองบอล 0–1 ของฝั่งหนึ่ง (0.5 เมื่อยังไม่มีใครได้ครองเลย) */
  possessionShare(side: MatchSide): number {
    const total = this.stats.home.possessionSeconds + this.stats.away.possessionSeconds;
    return total > 0 ? this.stats[side].possessionSeconds / total : 0.5;
  }

  /* ── หนึ่ง tick ของการจำลอง ───────────────────────────── */

  tick(dt: number): void {
    // มีแค่ 'paused' เท่านั้นที่หยุดทุกอย่าง — หมดเวลาแล้วคนยังเดินอยู่ในสนามได้ตามปกติ
    if (this.phase === 'paused' || this.phase === 'kickoff') return;

    this.elapsed += dt;
    this.advanceClock(dt);
    this.coolDownTimers(dt);

    // บอลตาย (ฟาวล์ / ฉลองประตู) — คนเดินกลับเข้าแผน รอเริ่มเล่นใหม่
    if (this.ball.state === 'DEAD') {
      this.updateDeadBall(dt);
      this.moveEveryone(dt);
      return;
    }

    this.updateDecisions(dt);
    this.assignMovement();
    this.moveEveryone(dt);
    this.updateBall(dt);

    /*
     * ลำดับความสำคัญของเหตุการณ์ในหนึ่ง tick — ตัวไหนเกิดแล้วตัวถัดไปไม่ต้องทำงาน
     * ป้องกันกรณีอย่าง "เข้าประตูแล้วยังโดนเข้าสกัดในเฟรมเดียวกัน"
     *   1. เซฟ (ต้องเช็คก่อน เพราะการเซฟคือสิ่งที่กันไม่ให้เป็นประตู)
     *   2. ประตู
     *   3. การได้ครองบอล (เก็บลูกหลุด / รับบอล / ตัดบอล)
     *   4. การเข้าสกัด
     */
    if (this.resolveSave(dt)) return;
    if (this.resolveGoal()) return;

    this.resolveContacts(dt);
    this.resolveTackles(dt);
    this.trackPossession(dt);
  }

  /** เดินนาฬิกาย่อยต่าง ๆ ที่นับถอยหลังอยู่ */
  private coolDownTimers(dt: number): void {
    this.players.forEach((agent) => {
      agent.tackleCooldown = Math.max(0, agent.tackleCooldown - dt);
    });

    this.claimSideTimer = Math.max(0, this.claimSideTimer - dt);
    if (this.claimSideTimer === 0) this.claimSide = null;
  }

  /** ระหว่างบอลตาย: นับถอยหลังแล้วเริ่มเล่นใหม่ */
  private updateDeadBall(dt: number): void {
    this.deadBallTimer -= dt;
    this.assignMovement();
    if (this.deadBallTimer > 0) return;

    if (!this.restartFor || !this.restartSpot) {
      // ฉลองประตูเสร็จ — กลับไปเขี่ยบอลกลางสนาม (นาฬิกาเดินต่อ ไม่รีเซ็ต)
      this.restart();
      return;
    }

    /*
     * เริ่มเล่นใหม่หลังฟาวล์: บอลอยู่ตรงจุดที่ตายอยู่แล้ว แค่ปลุกให้เล่นต่อ
     * ไม่ย้ายตัวใครไปวางที่ลูกบอล — การวาร์ปตัวผู้เล่นเป็นสิ่งที่ห้ามมาตั้งแต่ PHASE 1
     * แทนที่ด้วยการล็อกให้เฉพาะฝ่ายที่ถูกทำฟาวล์เท่านั้นที่แตะบอลได้ในช่วงสั้น ๆ
     * ยังไม่ใช่ระบบลูกตั้งเตะเต็มรูปแบบ (กำแพง ระยะ 9.15 ม.) นั่นเป็นเรื่องของ PHASE ถัดไป
     */
    this.ball.release();
    this.claimSide = this.restartFor;
    this.claimSideTimer = RESTART_EXCLUSIVE_SECONDS;

    this.deadBallTimer = 0;
    this.restartFor = null;
    this.restartSpot = null;
  }

  private advanceClock(dt: number): void {
    // นาฬิกามาจากข้างนอก — เอนจินห้ามนับเองเด็ดขาด ไม่งั้นเป็นนาฬิกาเรือนที่สอง
    if (this.clockSource === 'external') return;
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
      this.emit({ type: 'fulltime', minute: this.totalMinutes });
    }
  }

  /* ── ชั้นตัดสินใจ: คนถือบอลจะทำอะไรต่อ ────────────────── */

  /**
   * คนถือบอลไม่ได้ตัดสินใจใหม่ทุกเฟรม — เขาได้ถือบอลไว้ช่วงหนึ่งก่อน (0.8–2.0 วินาที)
   * แล้วค่อยประเมินว่าจะส่งให้ใคร ถ้าไม่มีจังหวะดีก็เลี้ยงต่อแล้วมองใหม่
   *
   *   ได้บอล → HOLD → ประเมิน → PASS หรือ MOVE (เลี้ยงต่อ)
   */
  private updateDecisions(dt: number): void {
    const owner = this.ownerAgent();
    if (!owner) {
      this.holdElapsed = 0;
      return;
    }

    this.holdElapsed += dt;

    const foes = this.opponentsOf(owner.side).players;

    /*
     * การยิงประเมินทุก tick ไม่ต้องรอจังหวะตัดสินใจ
     *
     * ตอนแรกผมเอาไปไว้หลังนาฬิกาตัดสินใจเหมือนการส่งบอล ผลคือทีมที่เล่น 4-3-3
     * ยิงไม่ออกเลยสักลูกใน 5 นาที ทั้งที่กองหน้าถือบอลอยู่ในกรอบเขตโทษเป็นสิบวินาที
     * เพราะช่วงที่โอกาสดีจริง ๆ กินเวลาแค่เสี้ยววินาที แล้วไม่ตรงกับจังหวะที่นาฬิกาหมดพอดี
     * ฟุตบอลจริงก็เป็นแบบนี้ — โอกาสยิงมาเมื่อไรก็ยิงตอนนั้น ไม่ได้รอคิด
     * ส่วนการส่งบอลยังต้องรอจังหวะเหมือนเดิม เพราะเป็นการตัดสินใจที่ตั้งใจทำ
     * คนที่ไม่ได้ครองบอลยิงไม่ได้อยู่แล้ว เพราะโค้ดทั้งก้อนนี้อยู่หลัง ownerAgent()
     */
    const chance = evaluateShot(owner, foes);
    if (chance.score >= MIN_SHOT_SCORE) {
      this.executeShot(owner, chance);
      return;
    }

    // โดนคู่แข่งไล่ประชิด = มีเวลาคิดน้อยลง นี่คือผลจริงของการเข้ากดดันใน PHASE 2
    const pressure = this.nearestDistance(owner.position2d, foes);
    owner.decisionTimer -= dt * (pressure < PRESSED_RADIUS ? PRESSED_URGENCY : 1);

    if (owner.decisionTimer > 0) {
      owner.decision = 'HOLD';
      return;
    }

    const mates = this.teamOf(owner.side).players;
    const overdue = this.holdElapsed >= MAX_HOLD;

    /*
     * ปกติส่งเฉพาะจังหวะที่คะแนนถึงเกณฑ์
     * แต่ถ้าถือบอลเกิน MAX_HOLD แล้วต้องปล่อยแล้ว ให้เลือกคนที่ดีที่สุดเท่าที่มี
     * ฟุตบอลจริงก็เป็นแบบนี้ ไม่มีใครกอดบอลไว้ได้ตลอด
     */
    const choice = overdue
      ? selectPassTarget(owner, mates, foes, -Infinity)
      : selectPassTarget(owner, mates, foes);

    if (choice) {
      this.executePass(owner, choice.receiver);
      return;
    }

    if (overdue) {
      // ไม่มีแม้แต่คนเดียวที่ส่งถึง — เขี่ยบอลหลุดออกไปข้างหน้า กลายเป็นลูก 50/50
      this.loseControl(owner);
      return;
    }

    // ยังพอมีเวลา — เลี้ยงต่อแล้วมองใหม่อีกที
    owner.decision = 'MOVE';
    owner.decisionTimer = HOLD_RETRY;
  }

  /** ระยะจากจุดหนึ่งถึงคนที่ใกล้ที่สุดในกลุ่ม */
  private nearestDistance(spot: Vec2, group: PlayerAgent[]): number {
    let best = Infinity;
    for (const agent of group) best = Math.min(best, agent.distanceTo(spot));
    return best;
  }

  /**
   * ปล่อยบอลหลุดจากเท้า — ยังไม่ใช่การแย่งบอล (แท็กเกิลเป็นเรื่องของ PHASE ต่อไป)
   * เป็นแค่ทางออกเมื่อไม่มีตัวเลือกส่งเลย บอลกลายเป็นลูก 50/50 ที่ใครใกล้ก็ได้ไป
   */
  private loseControl(owner: PlayerAgent): void {
    const direction = attackDirection(owner.side);
    this.ball.release();
    this.ball.kick({ x: direction, y: (this.random() - 0.5) * 0.8 }, 9, owner.id);
    this.claimCooldown = PASS_LOCK;

    owner.decision = 'MOVE';
    owner.state = 'SUPPORT';
    this.holdElapsed = 0;
  }

  /**
   * ส่งบอลจริง — บอลเดินทางออกจากจุดที่มันอยู่ ไม่มีการวาร์ปไปหาผู้รับ
   * เล็งไปข้างหน้าผู้รับเล็กน้อยตามความเร็วของเขา จะได้ไม่ส่งไปหลังตัว
   */
  private executePass(passer: PlayerAgent, receiver: PlayerAgent): void {
    const lead: Vec2 = {
      x: receiver.position2d.x + receiver.velocity.x * 0.3,
      y: receiver.position2d.y + receiver.velocity.y * 0.3,
    };
    const direction: Vec2 = {
      x: lead.x - this.ball.position.x,
      y: lead.y - this.ball.position.y,
    };
    const distance = Math.hypot(direction.x, direction.y);

    this.ball.launch(direction, passSpeed(distance), passer.id, receiver.id);
    this.claimCooldown = PASS_LOCK;

    passer.decision = 'PASS';
    passer.state = 'SUPPORT';
    passer.decisionTimer = 0;

    this.stats[passer.side].passes += 1;
    this.statsFor(passer.id).passes += 1;
    this.emit({
      type: 'pass',
      minute: Math.floor(this.clock.minute),
      side: passer.side,
      playerId: passer.id,
      targetPlayerId: receiver.id,
      detail: { distance: Math.round(distance * 10) / 10 },
    });
  }

  /* ── ชั้นการเดิน: ใครไปยืนตรงไหน ──────────────────────── */

  private assignMovement(): void {
    const owner = this.ownerAgent();

    if (owner) {
      this.initiative = owner.side;
      this.assignAttackingShape(this.teamOf(owner.side), owner);
      this.assignDefendingShape(this.opponentsOf(owner.side), owner.position2d);
    } else {
      this.assignLooseBallShape();
    }

    // บอลกำลังเดินทาง — คนที่ถูกส่งให้ต้องออกไปรับ ไม่ใช่ยืนรออยู่เฉย ๆ
    const receiver = this.agentById(this.ball.intendedReceiverId);
    if (this.ball.state === 'TRAVELLING' && receiver) {
      receiver.state = 'RECEIVING';
      receiver.decision = 'RECEIVE';
      receiver.targetPosition = receiveTarget(this.ball.position, this.ball.velocity);
      this.chaserIds[receiver.side] = receiver.id;
    }
  }

  /** ทีมที่ครองบอล: คนถือบอลเลี้ยงไปข้างหน้า คนอื่นไปยืนตำแหน่ง support ตามบทบาท */
  private assignAttackingShape(team: MatchTeamState, owner: PlayerAgent): void {
    this.chaserIds[team.side] = owner.id;

    team.players.forEach((agent) => {
      if (agent.id === owner.id) {
        agent.state = 'ON_BALL';
        agent.targetPosition = this.dribbleTarget(agent);
        return;
      }

      const context: SupportContext = {
        side: team.side,
        role: agent.role,
        position: agent.position,
        home: agent.formationPosition,
        ball: this.ball.position,
        ballOwner: owner.position2d,
        jitter: agent.jitter,
        elapsed: this.elapsed,
      };

      agent.state = agent.role === 'gk' ? 'POSITIONING' : 'SUPPORT';
      agent.decision = agent.role === 'defence' || agent.role === 'gk' ? 'MOVE' : 'SUPPORT';
      agent.targetPosition = leashToZone(
        supportTarget(context),
        agent.formationPosition,
        agent.role,
      );
    });
  }

  /**
   * ทีมที่เสียการครองบอล: คนใกล้ที่สุดคนเดียวเข้าไปกดดัน ที่เหลือรักษารูปทีม
   * นี่คือกติกา "ไม่ให้ทั้งทีมวิ่งไล่บอล" ที่ PHASE 2 กำหนด
   */
  private assignDefendingShape(team: MatchTeamState, ballOwner: Vec2): void {
    const presser = this.pickClosest(team, ballOwner);
    this.chaserIds[team.side] = presser?.id ?? null;

    team.players.forEach((agent) => {
      if (presser && agent.id === presser.id) {
        agent.state = 'PRESSING';
        agent.decision = 'PRESS';
        agent.targetPosition = leashToZone(
          interceptTarget(ballOwner, { x: 0, y: 0 }),
          agent.formationPosition,
          agent.role,
        );
        return;
      }

      agent.state = agent.role === 'gk' ? 'POSITIONING' : 'DEFENDING';
      agent.decision = 'MOVE';
      agent.targetPosition = this.defensiveTarget(agent);
    });
  }

  /**
   * ตำแหน่งเกมรับของหนึ่งคน
   * ผู้รักษาประตูที่กำลังเจอลูกยิงจะไปยืนที่จุดตัดของวิถีบอลกับเส้นประตูแทนตำแหน่งปกติ
   */
  private defensiveTarget(agent: PlayerAgent): Vec2 {
    if (agent.role === 'gk' && this.ball.state === 'SHOT') {
      return shotCoverTarget(agent.side, this.ball.position, this.ball.velocity);
    }
    return shapeTarget(this.shapeContextFor(agent, false));
  }

  /** ลูกหลุด: กลับไปใช้กติกาของ PHASE 1 — ฝั่งละหนึ่งคนไล่บอล ที่เหลือรักษารูป */
  private assignLooseBallShape(): void {
    const homeChaser = this.pickChaser(this.home);
    const awayChaser = this.pickChaser(this.away);

    this.chaserIds = { home: homeChaser?.id ?? null, away: awayChaser?.id ?? null };

    const homeGap = homeChaser ? homeChaser.distanceTo(this.ball.position) : Infinity;
    const awayGap = awayChaser ? awayChaser.distanceTo(this.ball.position) : Infinity;
    this.initiative = homeGap <= awayGap ? 'home' : 'away';

    this.assignFreeTargets(this.home, homeChaser);
    this.assignFreeTargets(this.away, awayChaser);
  }

  private assignFreeTargets(team: MatchTeamState, chaser: PlayerAgent | null): void {
    const hasInitiative = this.initiative === team.side;
    const supporter = hasInitiative ? this.pickSupporter(team, chaser) : null;

    team.players.forEach((agent) => {
      if (chaser && agent.id === chaser.id) {
        agent.state = 'MOVING_TO_BALL';
        agent.decision = 'MOVE';
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
        agent.decision = 'SUPPORT';
        agent.targetPosition = leashToZone(
          supportTarget({
            side: team.side,
            role: agent.role,
            position: agent.position,
            home: agent.formationPosition,
            ball: this.ball.position,
            ballOwner: this.ball.position,
            jitter: agent.jitter,
            elapsed: this.elapsed,
          }),
          agent.formationPosition,
          agent.role,
        );
        return;
      }

      agent.targetPosition = shapeTarget(this.shapeContextFor(agent, hasInitiative));
      agent.decision = 'MOVE';
      agent.state =
        agent.role === 'gk' ? 'POSITIONING' : hasInitiative ? 'ATTACKING' : 'DEFENDING';
    });
  }

  private shapeContextFor(agent: PlayerAgent, hasInitiative: boolean): ShapeContext {
    return {
      side: agent.side,
      role: agent.role,
      home: agent.formationPosition,
      ball: this.ball.position,
      hasInitiative,
      jitter: agent.jitter,
      elapsed: this.elapsed,
    };
  }

  /** คนถือบอลเลี้ยงไปทางประตูคู่แข่ง แต่ไม่ออกนอกเขตรับผิดชอบของตัวเอง */
  private dribbleTarget(owner: PlayerAgent): Vec2 {
    const direction = attackDirection(owner.side);
    const goal = targetGoalLine(owner.side);

    /*
     * ยังไม่มีระบบยิงประตูใน PHASE 2 การเลี้ยงเข้าไปถึงเส้นประตูจึงไม่มีความหมาย
     * และจะกลายเป็นคนยืนกอดบอลอยู่มุมสนาม จึงหยุดไว้แค่ขอบเขตโทษ
     */
    const edge = goal - direction * PITCH.penaltyDepth;
    // เข้าไปในกรอบแล้วก็อยู่ตรงนั้นได้ ไม่ต้องถูกดึงถอยหลังออกมา
    const limit = direction > 0 ? Math.max(edge, owner.position2d.x) : Math.min(edge, owner.position2d.x);
    const ahead = owner.position2d.x + direction * DRIBBLE_RANGE;
    const capped = direction > 0 ? Math.min(ahead, limit) : Math.max(ahead, limit);

    return leashToZone(
      {
        x: capped,
        y: owner.position2d.y + (PITCH.width / 2 - owner.position2d.y) * 0.18,
      },
      owner.formationPosition,
      owner.role,
    );
  }

  /* ── การเลือกคน ───────────────────────────────────────── */

  /** คนของทีมนี้ที่ใกล้จุดหนึ่งที่สุด (ผู้รักษาประตูเข้าร่วมเฉพาะตอนบอลอยู่ในเขตตัวเอง) */
  private pickClosest(team: MatchTeamState, spot: Vec2): PlayerAgent | null {
    const line = ownGoalLine(team.side);
    const inOwnBox = Math.abs(this.ball.position.x - line) < KEEPER_ENGAGE_DEPTH;

    let best: PlayerAgent | null = null;
    let bestScore = Infinity;

    for (const agent of team.players) {
      if (agent.role === 'gk' && !inOwnBox) continue;

      const toSpot = Math.sqrt(distanceSq(agent.position2d, spot));
      const zoneGap = Math.sqrt(distanceSq(agent.formationPosition, spot));
      const score = toSpot + zoneGap * ZONE_WEIGHT;

      if (score < bestScore) {
        bestScore = score;
        best = agent;
      }
    }

    return best;
  }

  /** คนที่จะวิ่งไปเก็บลูกหลุดของทีมนี้ */
  private pickChaser(team: MatchTeamState): PlayerAgent | null {
    return this.pickClosest(team, this.ball.position);
  }

  /** ตัว support ตอนลูกหลุด = คนใกล้บอลรองจากคนไล่บอล (ไม่เอาผู้รักษาประตู) */
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
   * มีแค่กับเพื่อนร่วมทีม — คู่แข่งยืนทับกันได้ (การประกบตัวจริง ๆ เป็นเรื่องของ PHASE ต่อไป)
   */
  private separationFor(agent: PlayerAgent): Vec2 {
    const team = this.teamOf(agent.side);
    const push: Vec2 = { x: 0, y: 0 };

    team.players.forEach((other) => {
      if (other.id === agent.id) return;

      const dx = agent.position2d.x - other.position2d.x;
      const dy = agent.position2d.y - other.position2d.y;
      const gap = Math.hypot(dx, dy);
      if (gap >= SEPARATION_RADIUS || gap === 0) return;

      const strength = (SEPARATION_RADIUS - gap) / SEPARATION_RADIUS;
      push.x += (dx / gap) * strength * 2.2;
      push.y += (dy / gap) * strength * 2.2;
    });

    return push;
  }

  /* ── ลูกบอล ───────────────────────────────────────────── */

  private updateBall(dt: number): void {
    const owner = this.ownerAgent();

    if (this.ball.state === 'CONTROLLED') {
      if (!owner) {
        // เจ้าของหายไปจากสนาม (โดนเอาออกกลางเกม) — บอลกลายเป็นลูกหลุด
        this.ball.release();
        return;
      }

      // บอลอยู่หน้าเท้าเขาเล็กน้อย ตามทิศที่เขาหันหน้า
      this.ball.followOwner(
        {
          x: owner.position2d.x + Math.cos(owner.facing) * DRIBBLE_LEAD,
          y: owner.position2d.y + Math.sin(owner.facing) * DRIBBLE_LEAD,
        },
        dt,
      );
      return;
    }

    this.ball.update(dt);
  }

  /**
   * ใครได้บอลไป — ตรวจหลังจากทั้งคนและบอลขยับเสร็จแล้ว
   *
   *   TRAVELLING → คู่แข่งที่อยู่ใกล้วิถีบอลมีโอกาสตัด · ผู้รับที่ตั้งใจไว้เก็บได้เมื่อถึงตัว
   *   FREE       → ใครอยู่ในระยะควบคุมและใกล้ที่สุดได้ไป
   */
  private resolveContacts(dt: number): void {
    this.claimCooldown = Math.max(0, this.claimCooldown - dt);
    if (this.ball.state === 'CONTROLLED') return;

    if (this.ball.state === 'TRAVELLING') {
      if (this.tryIntercept(dt)) return;

      const receiver = this.agentById(this.ball.intendedReceiverId);
      if (receiver && receiver.distanceTo(this.ball.position) <= RECEIVE_RADIUS) {
        this.giveBall(receiver, 'receive');
      }
      return;
    }

    // ลูกยิงที่ยังลอยอยู่เป็นเรื่องของผู้รักษาประตูเท่านั้น ไม่ให้ใครวิ่งไปคว้ากลางอากาศ
    if (this.ball.state !== 'FREE') return;
    if (this.claimCooldown > 0) return;

    let closest: PlayerAgent | null = null;
    let bestGap = CONTROL_RADIUS;

    for (const agent of this.players) {
      // ช่วงเริ่มเล่นใหม่หลังฟาวล์ — อีกฝ่ายยังแตะบอลไม่ได้
      if (this.claimSide && agent.side !== this.claimSide) continue;

      const gap = agent.distanceTo(this.ball.position);
      if (gap <= bestGap) {
        bestGap = gap;
        closest = agent;
      }
    }

    if (closest) this.giveBall(closest, 'loose');
  }

  /**
   * ตัดบอลระหว่างทาง
   *
   * ใช้ความน่าจะเป็นต่อวินาที ยิ่งยืนใกล้วิถีบอลยิ่งมีโอกาสสูง
   * คูณด้วย dt เพื่อให้ผลลัพธ์ไม่ขึ้นกับ frame rate และยังคงเดินซ้ำได้เพราะใช้ตัวสุ่มที่มี seed
   * ตัดได้แล้วบอลเปลี่ยนเจ้าของอยู่ที่เดิม ไม่มีการวาร์ป
   */
  private tryIntercept(dt: number): boolean {
    const passerSide = this.agentById(this.ball.lastTouchId)?.side ?? null;
    if (!passerSide) return false;

    const defenders = this.opponentsOf(passerSide).players;
    const line = ownGoalLine(this.opponentsOf(passerSide).side);
    const inOwnBox = Math.abs(this.ball.position.x - line) < KEEPER_ENGAGE_DEPTH;

    for (const agent of defenders) {
      if (agent.role === 'gk' && !inOwnBox) continue;

      const gap = agent.distanceTo(this.ball.position);
      if (gap > INTERCEPT_RADIUS) continue;

      const chance = INTERCEPT_RATE * dt * (1 - gap / INTERCEPT_RADIUS);
      if (this.random() < chance) {
        this.giveBall(agent, 'interception');
        return true;
      }
    }

    return false;
  }

  /** ยกบอลให้คนคนหนึ่ง พร้อมบันทึกเหตุการณ์และสถิติที่เกี่ยวข้อง */
  private giveBall(
    agent: PlayerAgent,
    reason: 'receive' | 'interception' | 'loose' | 'save' | 'tackle',
  ): void {
    const previous = this.lastPossessionSide;
    const minute = Math.floor(this.clock.minute);

    this.ball.attachTo(agent.id);
    this.holdElapsed = 0;
    this.saveAttempted = false;

    agent.state = 'ON_BALL';
    agent.decision = 'HOLD';
    agent.decisionTimer = HOLD_TIME.min + this.random() * (HOLD_TIME.max - HOLD_TIME.min);

    this.stats[agent.side].touches += 1;

    if (reason === 'receive') {
      this.stats[agent.side].completedPasses += 1;
      const passerId = this.ball.lastTouchId;
      if (passerId) this.statsFor(passerId).completedPasses += 1;
      this.emit({
        type: 'receive',
        minute,
        side: agent.side,
        teamId: this.teamOf(agent.side).id,
        playerId: agent.id,
        secondaryPlayerId: passerId ?? undefined,
      });
      // จำไว้ว่าใครจ่ายให้ ถ้าคนนี้ยิงเข้าเลยจะได้บันทึกแอสซิสต์ได้จริง ไม่ต้องเดา
      this.assistCandidate = passerId ? { receiverId: agent.id, passerId } : null;
    } else {
      this.assistCandidate = null;
    }

    if (reason === 'interception') {
      this.stats[agent.side].interceptions += 1;
      this.statsFor(agent.id).interceptions += 1;
      this.emit({
        type: 'interception',
        minute,
        side: agent.side,
        teamId: this.teamOf(agent.side).id,
        playerId: agent.id,
      });
    }

    if (previous !== agent.side) {
      this.emit({ type: 'possession_change', minute, side: agent.side, playerId: agent.id });
    }

    this.lastPossessionSide = agent.side;
  }

  private trackPossession(dt: number): void {
    const side = this.possessionTeam;
    if (side) this.stats[side].possessionSeconds += dt;
  }

  /* ── การยิงประตู ──────────────────────────────────────── */

  /** ยิงจริง: บอลออกจากเท้าแล้วเดินทางไปเอง ไม่มีการวาร์ปไปที่ประตู */
  private executeShot(shooter: PlayerAgent, chance: ReturnType<typeof evaluateShot>): void {
    const keeper = this.opponentsOf(shooter.side).players.find((agent) => agent.role === 'gk');
    const plan = calculateShot(shooter, keeper ?? null, chance, this.random());

    const direction: Vec2 = {
      x: plan.aim.x - this.ball.position.x,
      y: plan.aim.y - this.ball.position.y,
    };

    this.ball.shoot(direction, plan.speed, shooter.id);
    this.claimCooldown = PASS_LOCK;

    shooter.decision = 'SHOOT';
    shooter.state = 'SUPPORT';
    shooter.decisionTimer = 0;
    this.holdElapsed = 0;

    this.stats[shooter.side].shots += 1;
    this.statsFor(shooter.id).shots += 1;
    if (plan.onTarget) {
      this.stats[shooter.side].shotsOnTarget += 1;
      this.statsFor(shooter.id).shotsOnTarget += 1;
    }

    this.emit({
      type: 'shot',
      minute: Math.floor(this.clock.minute),
      side: shooter.side,
      teamId: this.teamOf(shooter.side).id,
      playerId: shooter.id,
      position: { ...this.ball.position },
      detail: { onTarget: plan.onTarget ? 1 : 0, speed: Math.round(plan.speed) },
    });
  }

  /* ── ผู้รักษาประตู ────────────────────────────────────── */

  /**
   * ผู้รักษาประตูเข้าจังหวะลูกยิง
   *
   * ทอยครั้งเดียวต่อหนึ่งลูกยิงเมื่อบอลเข้ามาในระยะเอื้อม — ไม่ได้ทอยทุกเฟรม
   * เซฟได้ = บอลอยู่กับ GK · เซฟไม่ได้ = บอลวิ่งต่อไปหาการตรวจประตู
   */
  private resolveSave(dt: number): boolean {
    if (this.ball.state !== 'SHOT') {
      this.saveAttempted = false;
      return false;
    }
    if (this.saveAttempted) return false;

    const shooterSide = this.agentById(this.ball.lastTouchId)?.side;
    if (!shooterSide) return false;

    const keeper = this.opponentsOf(shooterSide).players.find((agent) => agent.role === 'gk');
    if (!keeper) return false;
    if (keeper.distanceTo(this.ball.position) > SAVE_REACH) return false;

    this.saveAttempted = true;
    const chance = saveChance(keeper, this.ball.position, this.ball.speed);
    if (this.random() >= chance) return false;

    this.stats[keeper.side].saves += 1;
    this.statsFor(keeper.id).saves += 1;
    this.emit({
      type: 'save',
      minute: Math.floor(this.clock.minute),
      side: keeper.side,
      teamId: this.teamOf(keeper.side).id,
      playerId: keeper.id,
      secondaryPlayerId: this.ball.lastTouchId ?? undefined,
      position: { ...this.ball.position },
    });

    this.giveBall(keeper, 'save');
    // dt ไม่ได้ใช้ตรงนี้ แต่รับไว้ให้เข้ารูปกับ stage อื่นในไปป์ไลน์
    void dt;
    return true;
  }

  /* ── ประตู ────────────────────────────────────────────── */

  /**
   * ตรวจว่าบอลข้ามเส้นประตูในปากประตูหรือยัง
   * ข้ามเส้นหลังนอกกรอบประตูไม่นับ (ball.ts ปล่อยบอลผ่านได้เฉพาะช่วงปากประตู)
   */
  private resolveGoal(): boolean {
    const conceded = goalCrossed(this.ball.position);
    if (!conceded) return false;

    const scoringSide: MatchSide = conceded === 'home' ? 'away' : 'home';
    const scorer = this.agentById(this.ball.lastTouchId);
    const minute = Math.floor(this.clock.minute);

    this.stats[scoringSide].goals += 1;

    if (scorer) {
      this.statsFor(scorer.id).goals += 1;

      // แอสซิสต์นับเฉพาะกรณีที่คนยิงเป็นคนที่เพิ่งรับบอลจากเพื่อนจริง ๆ ไม่มีการเดา
      const assist =
        this.assistCandidate?.receiverId === scorer.id ? this.assistCandidate.passerId : null;
      if (assist) this.statsFor(assist).assists += 1;

      this.emit({
        type: 'goal',
        minute,
        side: scoringSide,
        teamId: this.teamOf(scoringSide).id,
        playerId: scorer.id,
        secondaryPlayerId: assist ?? undefined,
        position: { ...this.ball.position },
      });
    } else {
      this.emit({ type: 'goal', minute, side: scoringSide, teamId: this.teamOf(scoringSide).id });
    }

    // หยุดฉลองสั้น ๆ แล้วกลับไปเขี่ยบอล — นาฬิกาเดินต่อตลอด
    this.ball.kill();
    this.deadBallTimer = CELEBRATION_SECONDS;
    this.restartFor = null;
    this.restartSpot = null;
    this.assistCandidate = null;
    this.saveAttempted = false;
    return true;
  }

  /* ── การเข้าสกัด ฟาวล์ และใบ ──────────────────────────── */

  /**
   * คนที่กำลังเข้ากดดันอยู่ (จาก PHASE 2) คือคนที่มีสิทธิ์เข้าสกัด
   * มี cooldown รายคน จึงไม่มีทางเกิดการเข้าสกัด 60 ครั้งต่อวินาที
   */
  private resolveTackles(dt: number): void {
    const carrier = this.ownerAgent();
    if (!carrier) return;

    /*
     * เข้าสกัดได้เฉพาะคนที่ระบบมอบหมายให้เข้ากดดันอยู่แล้ว (chaserIds จาก PHASE 2)
     * ไม่ใช่ใครก็ได้ที่บังเอิญเดินผ่านมาใกล้ — ไม่งั้นจะกลายเป็นทั้งทีมรุมเสียบ
     */
    const defenderId = this.chaserIds[this.opponentsOf(carrier.side).side];
    const defender = this.agentById(defenderId);
    if (!defender || defender.role === 'gk') return;
    if (defender.tackleCooldown > 0) return;

    const gap = defender.distanceTo(carrier.position2d);
    if (gap > TACKLE_RANGE) return;

    // ประชิดแล้วก็ยังไม่ได้พุ่งเข้าเสียบทุกครั้ง
    if (this.random() >= TACKLE_ATTEMPT_RATE * dt) return;

    this.attemptTackle(defender, carrier, gap);
  }

  private attemptTackle(defender: PlayerAgent, carrier: PlayerAgent, gap: number): void {
    const result = resolveTackle(defender, carrier, gap, {
      tackle: this.random(),
      foul: this.random(),
      card: this.random(),
    });

    defender.tackleCooldown =
      TACKLE_COOLDOWN.min + this.random() * (TACKLE_COOLDOWN.max - TACKLE_COOLDOWN.min);
    defender.decision = 'TACKLE';

    const minute = Math.floor(this.clock.minute);
    this.stats[defender.side].tackles += 1;
    this.statsFor(defender.id).tackles += 1;

    this.emit({
      type: 'tackle',
      minute,
      side: defender.side,
      teamId: this.teamOf(defender.side).id,
      playerId: defender.id,
      secondaryPlayerId: carrier.id,
      position: { ...carrier.position2d },
      detail: { outcome: result.outcome },
    });

    if (result.foul) {
      this.awardFoul(defender, carrier, result.card);
      return;
    }

    if (result.outcome === 'won') {
      this.stats[defender.side].successfulTackles += 1;
      this.giveBall(defender, 'tackle');
    }
    // เข้าสกัดไม่สำเร็จ = คนถือบอลยังถือบอลอยู่ ไม่มีอะไรเปลี่ยน
  }

  /** ฟาวล์: บอลตาย ฝ่ายที่ถูกทำฟาวล์ได้เล่นต่อ พร้อมทอยใบเหลือง/ใบแดง */
  private awardFoul(
    offender: PlayerAgent,
    victim: PlayerAgent,
    card: 'none' | 'yellow' | 'red',
  ): void {
    const minute = Math.floor(this.clock.minute);
    const spot: Vec2 = { ...victim.position2d };

    this.stats[offender.side].fouls += 1;
    this.statsFor(offender.id).fouls += 1;

    this.emit({
      type: 'foul',
      minute,
      side: offender.side,
      teamId: this.teamOf(offender.side).id,
      playerId: offender.id,
      secondaryPlayerId: victim.id,
      position: spot,
    });

    this.ball.kill();
    this.deadBallTimer = DEAD_BALL_SECONDS;
    this.restartFor = victim.side;
    this.restartSpot = spot;
    this.assistCandidate = null;

    if (card === 'yellow') this.bookPlayer(offender, minute);
    if (card === 'red') this.sendOff(offender, minute, 'red_card');
  }

  /** ใบเหลือง — ใบที่สองในแมตช์เดียวกลายเป็นใบแดงทันที */
  private bookPlayer(agent: PlayerAgent, minute: number): void {
    agent.yellowCards += 1;
    this.stats[agent.side].yellowCards += 1;
    this.statsFor(agent.id).yellowCards += 1;

    this.emit({
      type: 'yellow_card',
      minute,
      side: agent.side,
      teamId: this.teamOf(agent.side).id,
      playerId: agent.id,
    });

    if (agent.yellowCards >= 2) this.sendOff(agent, minute, 'second_yellow');
  }

  /**
   * ใบแดง — ถอดออกจากการจำลองทันที
   * ใช้ทางเดินเดียวกับการถอดผู้เล่นของ PHASE 1.5 (removePlayer) ไม่ได้สร้างระบบซ้ำ
   * และจำ id ไว้ใน sentOffIds เพื่อไม่ให้ syncRoster พาเขากลับลงสนามอีก
   */
  private sendOff(agent: PlayerAgent, minute: number, reason: string): void {
    agent.availability = 'sent_off';
    this.sentOffIds.add(agent.id);

    this.stats[agent.side].redCards += 1;
    this.statsFor(agent.id).redCards += 1;

    this.emit({
      type: 'red_card',
      minute,
      side: agent.side,
      teamId: this.teamOf(agent.side).id,
      playerId: agent.id,
      detail: { reason },
    });

    this.removePlayer(agent.id);
  }

  /** ถอดผู้เล่นหนึ่งคนออกจากการจำลอง (ใบแดง หรือรายชื่อจากข้างนอกเปลี่ยน) */
  private removePlayer(playerId: string): void {
    this.home.players = this.home.players.filter((agent) => agent.id !== playerId);
    this.away.players = this.away.players.filter((agent) => agent.id !== playerId);
    this.players.length = 0;
    this.players.push(...this.home.players, ...this.away.players);

    if (this.ball.owner === playerId || this.ball.intendedReceiverId === playerId) {
      this.ball.release();
    }
  }

  /* ── ปรับรายชื่อกลางเกม (ใบแดง / เปลี่ยนตัว) ──────────── */

  /**
   * ปรับผู้เล่นในสนามให้ตรงกับรายชื่อล่าสุด โดยไม่รีเซ็ตแมตช์
   *
   * คนหายไปจากรายชื่อ → เอาออกจากสนามทันที และไม่มีทางกลับมาเอง
   * id ใหม่โผล่มา → ลงสนามที่ตำแหน่งตามแผนของช่องนั้น
   * คนที่ยังอยู่จะไม่ถูกแตะเลย ตำแหน่ง ความเร็ว และสถานะทั้งหมดคงเดิม
   *
   * @returns true ถ้ามีการเปลี่ยนแปลงจริง
   */
  syncRoster(home: MatchTeamInput, away: MatchTeamInput): boolean {
    const changedHome = this.syncTeamRoster(this.home, home);
    const changedAway = this.syncTeamRoster(this.away, away);
    if (!changedHome && !changedAway) return false;

    this.players.length = 0;
    this.players.push(...this.home.players, ...this.away.players);

    // คนที่ถือบอลหรือกำลังรอรับบอลอยู่ถูกเอาออก — บอลต้องกลายเป็นลูกหลุด ไม่ใช่ค้างกับผี
    const ownerGone = this.ball.owner !== null && !this.agentById(this.ball.owner);
    const receiverGone =
      this.ball.intendedReceiverId !== null && !this.agentById(this.ball.intendedReceiverId);
    if (ownerGone || receiverGone) this.ball.release();

    return true;
  }

  private syncTeamRoster(team: MatchTeamState, input: MatchTeamInput): boolean {
    // คนที่โดนใบแดงในแมตช์นี้จะไม่ถูกพากลับลงสนาม แม้รายชื่อจากข้างนอกจะยังมีชื่อเขาอยู่
    const eligible = input.players.filter((player) => !this.sentOffIds.has(player.id));

    const wanted = new Map(eligible.map((player) => [player.id, player]));
    const present = new Set(team.players.map((agent) => agent.id));

    const kept = team.players.filter((agent) => wanted.has(agent.id));
    const added = eligible.filter((player) => !present.has(player.id));
    if (kept.length === team.players.length && added.length === 0) return false;

    added.forEach((player) => {
      const spot = formationToWorld(player.formationX, player.formationY, team.side);
      kept.push(new PlayerAgent(player, team.side, spot, this.random()));
    });

    team.players = kept;
    return true;
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
