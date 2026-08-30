/**
 * ตัววาดสนามลง HTML Canvas
 *
 * แยกจาก MatchEngine โดยสิ้นเชิง: renderer อ่าน state ออกมาวาดอย่างเดียว
 * ไม่แก้ค่าอะไรในเอนจินเลย และไม่มี React state ต่อเฟรม
 * (นักเตะ 22 คนที่ 60 FPS = 1,320 การอัปเดตต่อวินาที — ถ้าใช้ setState จะกระตุกแน่นอน)
 *
 *   Game State → Simulation Tick → Renderer
 *
 * มุมมองจากด้านบน สนามวางแนวนอน ทีมเจ้าบ้านบุกไปทางขวา
 */
import { PITCH } from '@/match-engine/pitch';
import type { MatchEngine } from '@/match-engine/MatchEngine';
import type { PlayerAgent } from '@/match-engine/playerAgent';
import type { MatchSimEvent, MovementState } from '@/match-engine/types';

/** เหตุการณ์ที่ควรขึ้นป้ายแจ้งบนสนาม พร้อมข้อความและสี */
const BANNERS: Record<string, { text: string; color: string }> = {
  goal: { text: 'GOAL', color: '#F5B93E' },
  save: { text: 'SAVE', color: '#7FD4F5' },
  tackle: { text: 'TACKLE', color: '#E8F1EA' },
  foul: { text: 'FOUL', color: '#E24A6E' },
  yellow_card: { text: 'YELLOW CARD', color: '#F5D63E' },
  red_card: { text: 'RED CARD', color: '#E24A6E' },
};

/** ป้ายแจ้งเหตุการณ์ค้างอยู่กี่วินาที */
const BANNER_SECONDS: Record<string, number> = { goal: 2.2, red_card: 2.2 };
const BANNER_DEFAULT_SECONDS = 0.9;

/** ตัวย่อของสถานะ ใช้บนแผงตรวจสอบ */
const STATE_SHORT: Record<MovementState, string> = {
  IDLE: 'idle',
  POSITIONING: 'pos',
  MOVING_TO_BALL: 'BALL',
  SUPPORT: 'sup',
  DEFENDING: 'def',
  ATTACKING: 'atk',
  ON_BALL: 'BALL',
  RECEIVING: 'recv',
  PRESSING: 'press',
};

/** สีของสนาม — อิงจานสีเดิมของเกม (pitch.* ใน tailwind.config.js) */
const COLORS = {
  grassDark: '#0C1A14',
  grassLight: '#12241C',
  line: 'rgba(232, 241, 234, 0.34)',
  ball: '#F7FAF8',
  ballShadow: 'rgba(0, 0, 0, 0.45)',
  chalk: '#E8F1EA',
  possession: '#F5B93E',
} as const;

/** ระยะขอบรอบสนาม (เมตร) เผื่อไว้ให้ไม่ชิดขอบ canvas */
const MARGIN = 3;

/** รัศมีตัวนักเตะ (เมตร) */
const PLAYER_RADIUS = 1.15;

export interface RendererOptions {
  /** true = โชว์ชื่อนักเตะใต้ตัว (ปิดได้เมื่อสนามเล็ก) */
  showNames?: boolean;
  /** true = โชว์นาฬิกามุมบนของสนาม */
  showClock?: boolean;
  /**
   * true = วาดแผงตรวจสอบทับสนาม (เป้าหมาย, ตำแหน่งตามแผน, เวกเตอร์ความเร็ว,
   * สถานะของแต่ละคน, คนไล่บอล, ฝ่ายที่ได้เปรียบ, ข้อมูลบอลและนาฬิกา)
   * เปิดจาก LiveMatchCanvas ด้วยปุ่ม D เฉพาะตอนรัน dev เท่านั้น
   */
  debug?: boolean;
}

export class PitchRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private options: RendererOptions;

  /** พิกเซลต่อเมตร คำนวณใหม่ทุกครั้งที่ canvas เปลี่ยนขนาด */
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  /** เหตุการณ์ล่าสุดที่เคยขึ้นป้ายไปแล้ว — เทียบด้วย object reference ไม่ใช่ index */
  private lastEvent: MatchSimEvent | null = null;
  private bannerType: string | null = null;
  private bannerUntil = 0;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับ canvas 2d');

    this.canvas = canvas;
    this.ctx = ctx;
    this.options = options;
    this.resize();
  }

  setOptions(options: RendererOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * ปรับขนาด canvas ให้ตรงกับกล่องจริงบนหน้าจอ พร้อมคูณ devicePixelRatio
   * ไม่ทำแบบนี้ภาพจะเบลอบนจอความละเอียดสูง
   */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    // ย่อสนามให้พอดีกล่อง โดยคงสัดส่วนจริง แล้ววางไว้ตรงกลาง
    const usableLength = PITCH.length + MARGIN * 2;
    const usableWidth = PITCH.width + MARGIN * 2;
    this.scale = Math.min(width / usableLength, height / usableWidth);
    this.offsetX = (width - PITCH.length * this.scale) / 2;
    this.offsetY = (height - PITCH.width * this.scale) / 2;
  }

  /** แปลงพิกัดโลก (เมตร) → พิกัด canvas (พิกเซล) */
  private toScreenX(x: number): number {
    return this.offsetX + x * this.scale;
  }

  private toScreenY(y: number): number {
    return this.offsetY + y * this.scale;
  }

  /** แปลงระยะทาง (เมตร) → พิกเซล */
  private px(meters: number): number {
    return meters * this.scale;
  }

  /* ── วาดหนึ่งเฟรม ─────────────────────────────────────── */

  draw(match: MatchEngine): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawGrass();
    this.drawMarkings();
    this.drawPassFlight(match);

    // วาดคนไล่บอลทีหลังสุด จะได้ไม่โดนคนอื่นบัง
    const chasers = new Set(
      [match.chaserIds.home, match.chaserIds.away].filter((id): id is string => Boolean(id)),
    );
    match.players.forEach((agent) => {
      if (!chasers.has(agent.id)) this.drawPlayer(agent, match, false);
    });
    match.players.forEach((agent) => {
      if (chasers.has(agent.id)) this.drawPlayer(agent, match, true);
    });

    // บอลวาดทับตัวคน ไม่งั้นลูกที่อยู่กับเท้าจะหายไปใต้ตัวนักเตะ
    this.drawBall(match);

    if (this.options.showClock !== false) this.drawClock(match);
    this.drawScoreboard(match);
    this.drawBanner(match);
    if (this.options.debug) this.drawDebug(match);
  }

  /** สกอร์บอร์ด — อ่านจาก match.score ซึ่งเป็น getter ของ stats.goals ไม่ได้เก็บซ้ำ */
  private drawScoreboard(match: MatchEngine): void {
    const { ctx } = this;
    const size = Math.max(11, this.px(2.6));
    const text = `${match.home.name}  ${match.score.home} - ${match.score.away}  ${match.away.name}`;
    const x = this.toScreenX(PITCH.length / 2);
    const y = this.toScreenY(PITCH.width) + this.px(2.6);

    ctx.font = `700 ${size}px "IBM Plex Sans Thai", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = COLORS.chalk;
    ctx.fillText(text, x, y);
  }

  /**
   * ป้ายแจ้งเหตุการณ์ (GOAL / SAVE / TACKLE / FOUL / การ์ด)
   * renderer เก็บตัวจับเวลาของตัวเอง ไม่ได้ไปเพิ่ม state ให้เอนจินเพื่อการแสดงผล
   */
  private drawBanner(match: MatchEngine): void {
    const latest = match.events[match.events.length - 1] ?? null;

    if (latest && latest !== this.lastEvent) {
      this.lastEvent = latest;
      if (BANNERS[latest.type]) {
        this.bannerType = latest.type;
        this.bannerUntil =
          performance.now() / 1000 + (BANNER_SECONDS[latest.type] ?? BANNER_DEFAULT_SECONDS);
      }
    }

    if (!this.bannerType) return;
    const remaining = this.bannerUntil - performance.now() / 1000;
    if (remaining <= 0) {
      this.bannerType = null;
      return;
    }

    const banner = BANNERS[this.bannerType];
    const fade = Math.min(remaining, 0.4) / 0.4;
    const { ctx } = this;
    const size = Math.max(14, this.px(5.5));

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = `800 ${size}px "IBM Plex Sans Thai", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(banner.text, this.toScreenX(PITCH.length / 2) + 2, this.toScreenY(24) + 2);
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text, this.toScreenX(PITCH.length / 2), this.toScreenY(24));
    ctx.restore();
  }

  /* ── แผงตรวจสอบ (dev เท่านั้น) ────────────────────────── */

  /**
   * วาดข้อมูลภายในของเอนจินทับสนาม ใช้ยืนยันด้วยตาว่า AI ทำงานตามที่ออกแบบ
   * ไม่มีผลกับการจำลองเลย — อ่านค่าอย่างเดียวเหมือนส่วนอื่นของ renderer
   */
  private drawDebug(match: MatchEngine): void {
    const { ctx } = this;

    match.players.forEach((agent) => {
      const x = this.toScreenX(agent.position2d.x);
      const y = this.toScreenY(agent.position2d.y);

      // ตำแหน่งตามแผน — กากบาทเล็ก ๆ ที่ตัวเขา "ควร" กลับไป
      const hx = this.toScreenX(agent.formationPosition.x);
      const hy = this.toScreenY(agent.formationPosition.y);
      const tick = this.px(0.7);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx - tick, hy);
      ctx.lineTo(hx + tick, hy);
      ctx.moveTo(hx, hy - tick);
      ctx.lineTo(hx, hy + tick);
      ctx.stroke();

      // เส้นไปยังเป้าหมายปัจจุบัน
      ctx.strokeStyle = 'rgba(245, 185, 62, 0.55)';
      ctx.setLineDash([this.px(0.6), this.px(0.6)]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(this.toScreenX(agent.targetPosition.x), this.toScreenY(agent.targetPosition.y));
      ctx.stroke();
      ctx.setLineDash([]);

      // เวกเตอร์ความเร็ว (คูณ 0.4 วินาทีเพื่อให้ยาวพอมองเห็น)
      ctx.strokeStyle = 'rgba(62, 210, 160, 0.9)';
      ctx.lineWidth = Math.max(1, this.px(0.12));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        this.toScreenX(agent.position2d.x + agent.velocity.x * 0.4),
        this.toScreenY(agent.position2d.y + agent.velocity.y * 0.4),
      );
      ctx.stroke();

      // ตัวย่อสถานะ
      const size = Math.max(6, this.px(1.1));
      ctx.font = `600 ${size}px "IBM Plex Sans Thai", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(232, 241, 234, 0.85)';
      ctx.fillText(`${STATE_SHORT[agent.state]}·${agent.decision.toLowerCase()}`, x, y + this.px(1.6));
    });

    this.drawDebugPanel(match);
  }

  private drawDebugPanel(match: MatchEngine): void {
    const { ctx } = this;
    const chaserName = (id: string | null) =>
      match.players.find((agent) => agent.id === id)?.name ?? '—';

    const lines = [
      `clock ${match.clockLabel()}  phase ${match.phase}  running ${match.clock.running}`,
      `initiative ${match.initiative}  on pitch ${match.home.players.length}v${match.away.players.length}`,
      `ball ${match.ball.position.x.toFixed(1)}, ${match.ball.position.y.toFixed(1)}  v ${match.ball.speed.toFixed(1)} m/s`,
      `ball ${match.ball.state}  owner ${chaserName(match.ball.owner)}`,
      `chaser home ${chaserName(match.chaserIds.home)}`,
      `chaser away ${chaserName(match.chaserIds.away)}`,
      `pass H ${match.stats.home.completedPasses}/${match.stats.home.passes} int ${match.stats.home.interceptions}  poss ${Math.round(match.possessionShare('home') * 100)}%`,
      `pass A ${match.stats.away.completedPasses}/${match.stats.away.passes} int ${match.stats.away.interceptions}`,
      `shots ${match.stats.home.shots}/${match.stats.home.shotsOnTarget} - ${match.stats.away.shots}/${match.stats.away.shotsOnTarget}  saves ${match.stats.home.saves}-${match.stats.away.saves}`,
      `tackles ${match.stats.home.tackles}-${match.stats.away.tackles}  fouls ${match.stats.home.fouls}-${match.stats.away.fouls}  cards ${match.stats.home.yellowCards + match.stats.away.yellowCards}/${match.stats.home.redCards + match.stats.away.redCards}`,
    ];

    const size = Math.max(9, this.px(1.5));
    const padding = size * 0.7;
    const lineHeight = size * 1.45;

    ctx.font = `500 ${size}px ui-monospace, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + padding * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.66)';
    ctx.fillRect(padding, padding, width, lineHeight * lines.length + padding);

    ctx.fillStyle = COLORS.chalk;
    lines.forEach((line, index) => {
      ctx.fillText(line, padding * 2, padding * 1.5 + index * lineHeight);
    });
  }

  private drawGrass(): void {
    const { ctx } = this;
    const left = this.toScreenX(0);
    const top = this.toScreenY(0);
    const width = this.px(PITCH.length);
    const height = this.px(PITCH.width);

    ctx.fillStyle = COLORS.grassDark;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // ลายตัดหญ้าแนวตั้ง 10 แถบ — ช่วยให้กะระยะบนสนามได้ด้วยตา
    const stripes = 10;
    const stripeWidth = width / stripes;
    for (let index = 0; index < stripes; index += 1) {
      ctx.fillStyle = index % 2 === 0 ? COLORS.grassLight : COLORS.grassDark;
      ctx.fillRect(left + index * stripeWidth, top, stripeWidth + 1, height);
    }
  }

  private drawMarkings(): void {
    const { ctx } = this;
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = Math.max(1, this.px(0.16));

    // เส้นรอบสนาม
    ctx.strokeRect(this.toScreenX(0), this.toScreenY(0), this.px(PITCH.length), this.px(PITCH.width));

    // เส้นแบ่งแดน
    ctx.beginPath();
    ctx.moveTo(this.toScreenX(PITCH.length / 2), this.toScreenY(0));
    ctx.lineTo(this.toScreenX(PITCH.length / 2), this.toScreenY(PITCH.width));
    ctx.stroke();

    // วงกลมกลางสนาม + จุดเขี่ยบอล
    ctx.beginPath();
    ctx.arc(
      this.toScreenX(PITCH.length / 2),
      this.toScreenY(PITCH.width / 2),
      this.px(PITCH.centreCircleRadius),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    this.dot(PITCH.length / 2, PITCH.width / 2);

    // กรอบเขตโทษ · กรอบ 6 หลา · จุดโทษ · ประตู — ทำทั้งสองฝั่ง
    this.drawGoalEnd(0);
    this.drawGoalEnd(1);
  }

  /** @param end 0 = ฝั่งซ้าย (ประตู home), 1 = ฝั่งขวา (ประตู away) */
  private drawGoalEnd(end: 0 | 1): void {
    const { ctx } = this;
    const line = end === 0 ? 0 : PITCH.length;
    const inward = end === 0 ? 1 : -1;
    const centre = PITCH.width / 2;

    const box = (depth: number, boxWidth: number) => {
      const x = end === 0 ? this.toScreenX(0) : this.toScreenX(PITCH.length - depth);
      ctx.strokeRect(
        x,
        this.toScreenY(centre - boxWidth / 2),
        this.px(depth),
        this.px(boxWidth),
      );
    };

    box(PITCH.penaltyDepth, PITCH.penaltyWidth);
    box(PITCH.goalAreaDepth, PITCH.goalAreaWidth);
    this.dot(line + inward * PITCH.penaltySpot, centre);

    // ประตู — วาดยื่นออกนอกเส้นหลังเล็กน้อยให้เห็นชัดว่าเป็นกรอบประตู
    const depth = 1.8;
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 241, 234, 0.7)';
    ctx.lineWidth = Math.max(1.5, this.px(0.24));
    const goalX = end === 0 ? this.toScreenX(-depth) : this.toScreenX(PITCH.length);
    ctx.strokeRect(
      goalX,
      this.toScreenY(centre - PITCH.goalWidth / 2),
      this.px(depth),
      this.px(PITCH.goalWidth),
    );
    ctx.restore();
  }

  private dot(x: number, y: number): void {
    const { ctx } = this;
    ctx.fillStyle = COLORS.line;
    ctx.beginPath();
    ctx.arc(this.toScreenX(x), this.toScreenY(y), Math.max(1, this.px(0.25)), 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── ตัวละคร ──────────────────────────────────────────── */

  private drawPlayer(agent: PlayerAgent, match: MatchEngine, highlight: boolean): void {
    const { ctx } = this;
    const team = agent.side === 'home' ? match.home : match.away;
    const x = this.toScreenX(agent.position2d.x);
    const y = this.toScreenY(agent.position2d.y);
    const radius = this.px(PLAYER_RADIUS);

    /*
     * แอนิเมชันวิ่ง: ขาสองข้างสลับกันตาม runPhase ที่เดินตามระยะทางจริง
     * ยิ่งวิ่งเร็วก้าวยิ่งกว้าง ยืนนิ่งขาก็หยุด — ได้ความรู้สึกวิ่งโดยไม่ต้องมี sprite sheet
     */
    const stride = Math.min(agent.speed / agent.topSpeed, 1);
    const swing = Math.sin(agent.runPhase) * stride * radius * 0.85;
    const perpendicular = agent.facing + Math.PI / 2;

    if (stride > 0.05) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = Math.max(1, radius * 0.42);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(perpendicular) * swing, y + Math.sin(perpendicular) * swing);
      ctx.lineTo(x - Math.cos(perpendicular) * swing, y - Math.sin(perpendicular) * swing);
      ctx.stroke();
    }

    // เงาใต้ตัว ช่วยให้ตัวละครดูลอยเหนือสนาม
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.35, radius * 0.95, radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // ตัวนักเตะ
    ctx.fillStyle = team.color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = highlight ? COLORS.chalk : 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = highlight ? Math.max(1.5, radius * 0.28) : Math.max(1, radius * 0.16);
    ctx.stroke();

    // วงแหวนรอบคนที่ครองบอลอยู่ — ดูออกทันทีว่าบอลอยู่กับใคร
    if (match.ball.owner === agent.id) {
      ctx.strokeStyle = COLORS.possession;
      ctx.lineWidth = Math.max(1.5, radius * 0.3);
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ลิ่มบอกทิศที่หันหน้า
    ctx.fillStyle = team.accent;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(agent.facing) * radius * 1.45, y + Math.sin(agent.facing) * radius * 1.45);
    ctx.lineTo(
      x + Math.cos(agent.facing + 2.5) * radius * 0.8,
      y + Math.sin(agent.facing + 2.5) * radius * 0.8,
    );
    ctx.lineTo(
      x + Math.cos(agent.facing - 2.5) * radius * 0.8,
      y + Math.sin(agent.facing - 2.5) * radius * 0.8,
    );
    ctx.closePath();
    ctx.fill();

    // เบอร์เสื้อ
    const numberSize = Math.max(7, radius * 1.15);
    ctx.fillStyle = team.accent;
    ctx.font = `700 ${numberSize}px "IBM Plex Sans Thai", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(agent.shirtNumber), x, y);

    if (this.options.showNames) {
      const labelSize = Math.max(6, radius * 0.92);
      ctx.font = `500 ${labelSize}px "IBM Plex Sans Thai", system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillText(agent.name, x, y + radius * 2.2 + 1);
      ctx.fillStyle = 'rgba(232, 241, 234, 0.82)';
      ctx.fillText(agent.name, x, y + radius * 2.2);
    }
  }

  private drawBall(match: MatchEngine): void {
    const { ctx } = this;
    const { position, speed, state } = match.ball;
    const x = this.toScreenX(position.x);
    const y = this.toScreenY(position.y);
    const radius = Math.max(2, this.px(0.55));

    // ยิ่งบอลเร็ว เงายิ่งยาว — อ่านทิศทางบอลออกแม้ตัวบอลจะเล็ก
    if (speed > 1) {
      ctx.fillStyle = COLORS.ballShadow;
      ctx.beginPath();
      ctx.ellipse(x, y + radius, radius * 1.6, radius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = COLORS.ball;
    ctx.beginPath();
    ctx.arc(x, y, state === 'SHOT' ? radius * 1.35 : state === 'TRAVELLING' ? radius * 1.15 : radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = Math.max(1, radius * 0.3);
    ctx.stroke();
  }

  /**
   * เส้นวิถีของลูกที่กำลังถูกส่ง — จางลงเรื่อย ๆ ตามเวลาที่บอลเดินทาง
   * ไม่ใช่เส้นถาวร พอบอลถึงเท้าคนรับเส้นก็หายไปเอง
   */
  private drawPassFlight(match: MatchEngine): void {
    const { ball } = match;
    if ((ball.state !== 'TRAVELLING' && ball.state !== 'SHOT') || !ball.passOrigin) return;

    const fade = Math.max(0, 1 - ball.travelElapsed / 1.1);
    if (fade <= 0) return;

    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle =
      ball.state === 'SHOT'
        ? `rgba(245, 185, 62, ${0.65 * fade})`
        : `rgba(247, 250, 248, ${0.4 * fade})`;
    ctx.lineWidth = Math.max(1, this.px(0.18));
    ctx.setLineDash([this.px(1.2), this.px(1)]);
    ctx.beginPath();
    ctx.moveTo(this.toScreenX(ball.passOrigin.x), this.toScreenY(ball.passOrigin.y));
    ctx.lineTo(this.toScreenX(ball.position.x), this.toScreenY(ball.position.y));
    ctx.stroke();
    ctx.restore();
  }

  private drawClock(match: MatchEngine): void {
    const { ctx } = this;
    const x = this.toScreenX(PITCH.length / 2);
    const y = this.toScreenY(0) - this.px(1.6);
    const size = Math.max(10, this.px(2.4));

    ctx.font = `700 ${size}px "IBM Plex Sans Thai", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillText(match.clockLabel(), x + 1, y + 1);
    ctx.fillStyle = COLORS.chalk;
    ctx.fillText(match.clockLabel(), x, y);
  }
}
