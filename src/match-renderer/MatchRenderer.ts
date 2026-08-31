/**
 * MatchRenderer — ตัววาดแมตช์แบบ 2.5D
 *
 * แทนที่ PitchRenderer เดิมของ PHASE 1–6 (ไม่ได้วางซ้อนกัน — ของเดิมถูกถอดออกไป
 * เพื่อไม่ให้มีตัววาดสองระบบในโปรเจกต์เดียว) สัญญาที่ฝั่ง React ใช้ยังเหมือนเดิมทุกอย่าง:
 * `new MatchRenderer(canvas, options)` · `draw(engine)` · `resize()` · `setOptions()` · `hitTest()`
 *
 * ลำดับการวาดหนึ่งเฟรม:
 *
 *   ชั้นภาพนิ่งที่แคชไว้ (สนาม เส้น ประตู อัฒจันทร์)
 *        ↓
 *   เงาทั้งหมด (คนและลูกบอล)
 *        ↓
 *   วงแหวนบนพื้น (เลือก / ชี้ / ครองบอล)
 *        ↓
 *   คนและลูกบอล เรียงตามความลึก — ไกลกล้องวาดก่อน ใกล้กล้องวาดทีหลัง
 *        ↓
 *   HUD (นาฬิกา สกอร์ ป้ายเหตุการณ์) และแผงตรวจสอบ
 *
 * เอนจินถูกอ่านอย่างเดียวเสมอ ไม่มีบรรทัดไหนในโฟลเดอร์นี้เขียนกลับเข้าไป
 */
import { PITCH, type MatchEngine, type MatchSimEvent } from '@/match-engine';
import type { PlayerAgent } from '@/match-engine/playerAgent';
import { BallRenderer, drawBall, drawBallShadow } from '@/match-renderer/ballLayer';
import { drawStaticLayer } from '@/match-renderer/pitchLayer';
import {
  drawPlayer,
  drawPlayerRings,
  drawPlayerShadow,
  poseFor,
  type PlayerRenderInput,
} from '@/match-renderer/playerLayer';
import {
  createProjection,
  toScreen,
  toWorld,
  type ProjectionState,
} from '@/match-renderer/projection';
import {
  DEFAULT_CAMERA,
  withCamera,
  type MatchCamera,
  type MatchRenderOptions,
} from '@/match-renderer/types';

/** ระยะที่ยอมให้คลิกพลาดจากตัวนักเตะ (เมตร) — นิ้วและเมาส์ไม่ได้แม่นระดับเมตร */
const HIT_RADIUS = 2.4;

/** ป้ายแจ้งเหตุการณ์ */
const BANNERS: Record<string, { text: string; color: string }> = {
  goal: { text: 'GOAL', color: '#F5B93E' },
  save: { text: 'SAVE', color: '#7FD4F5' },
  tackle: { text: 'TACKLE', color: '#E8F1EA' },
  foul: { text: 'FOUL', color: '#E24A6E' },
  yellow_card: { text: 'YELLOW CARD', color: '#F5D63E' },
  red_card: { text: 'RED CARD', color: '#E24A6E' },
};

const BANNER_SECONDS: Record<string, number> = { goal: 2.4, red_card: 2.2 };
const BANNER_DEFAULT_SECONDS = 0.9;

/** ตัวย่อของสถานะ ใช้บนแผงตรวจสอบ */
const STATE_SHORT: Record<string, string> = {
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

export class MatchRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private options: MatchRenderOptions;
  private camera: MatchCamera;

  private projection: ProjectionState;
  private readonly ball = new BallRenderer();

  /** ชั้นภาพนิ่งที่วาดไว้ล่วงหน้า — วาดใหม่เฉพาะตอนขนาดจอหรือกล้องเปลี่ยน */
  private staticLayer: HTMLCanvasElement | null = null;
  private staticDirty = true;

  /** ป้ายเหตุการณ์ที่กำลังแสดงอยู่ */
  private lastEvent: MatchSimEvent | null = null;
  private bannerType: string | null = null;
  private bannerUntil = 0;

  constructor(canvas: HTMLCanvasElement, options: MatchRenderOptions = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับ canvas 2d');

    this.canvas = canvas;
    this.ctx = ctx;
    this.options = options;
    this.camera = { ...DEFAULT_CAMERA };
    this.projection = createProjection({ width: 1, height: 1 }, this.camera);

    this.resize();
  }

  setOptions(options: MatchRenderOptions): void {
    this.options = { ...this.options, ...options };
  }

  /** ปรับกล้อง (ซูม/เลื่อน/เอียง) — เป็นการแสดงผลล้วน ไม่แตะพิกัดของเกม */
  setCamera(patch: Partial<MatchCamera>): void {
    this.camera = withCamera(this.camera, patch);
    this.projection = createProjection(this.viewport(), this.camera);
    this.staticDirty = true;
  }

  getCamera(): MatchCamera {
    return { ...this.camera };
  }

  /** สถานะการฉายภาพปัจจุบัน (ใช้ในเทสและการวางหมุดยุทธวิธี) */
  getProjection(): ProjectionState {
    return this.projection;
  }

  private viewport() {
    return { width: this.canvas.width, height: this.canvas.height };
  }

  /**
   * ปรับขนาดผืนผ้าใบให้ตรงกับกล่องจริงบนหน้าจอ พร้อมคูณ devicePixelRatio
   * ถ้าไม่ทำภาพจะเบลอบนจอความละเอียดสูง และพิกัดคลิกจะเพี้ยน
   */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.staticDirty = true;
    }

    this.projection = createProjection({ width, height }, this.camera);
  }

  /* ── การคลิกเลือกนักเตะ ───────────────────────────────── */

  /**
   * หานักเตะใต้จุดที่คลิก/ชี้
   *
   *   พิกัด CSS → พิกัดอุปกรณ์ → ฉายกลับเป็นพิกัดสนาม → หาคนที่ใกล้ที่สุด
   *
   * ใช้การฉายกลับของ projection.ts ตัวเดียวกับตอนวาด ตำแหน่งจึงตรงกันเสมอ
   * ไม่แตะ DOM ไม่วนหา element และเป็น O(จำนวนผู้เล่น) = O(22)
   */
  hitTest(cssX: number, cssY: number, match: MatchEngine): PlayerAgent | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const deviceX = (cssX / rect.width) * this.canvas.width;
    const deviceY = (cssY / rect.height) * this.canvas.height;
    const world = toWorld(this.projection, deviceX, deviceY);

    let best: PlayerAgent | null = null;
    let bestGap = HIT_RADIUS;

    for (const agent of match.players) {
      const gap = Math.hypot(agent.position2d.x - world.x, agent.position2d.y - world.y);
      if (gap <= bestGap) {
        bestGap = gap;
        best = agent;
      }
    }

    return best;
  }

  /* ── หนึ่งเฟรม ────────────────────────────────────────── */

  draw(match: MatchEngine): void {
    const { ctx } = this;
    const viewport = this.viewport();

    this.paintStaticLayer(viewport);
    ctx.drawImage(this.staticLayer as HTMLCanvasElement, 0, 0);

    const ballHeight = this.ball.heightOf(match);

    // เงาทั้งหมดวาดก่อน จะได้ไม่มีเงาทับตัวใคร
    match.players.forEach((agent) => drawPlayerShadow(ctx, this.projection, agent));
    drawBallShadow(ctx, this.projection, match, ballHeight);

    // วงแหวนอยู่บนพื้น จึงวาดก่อนตัวละครทั้งหมดเช่นกัน
    match.players.forEach((agent) => {
      drawPlayerRings(ctx, this.projection, this.inputFor(agent, match));
    });

    /*
     * เรียงตามความลึก: y ในสนามมากกว่า = อยู่ใกล้กล้องกว่า = วาดทีหลัง
     * ลูกบอลถูกจัดเข้าคิวเดียวกันด้วยตำแหน่งพื้นของมัน ไม่ใช่ตำแหน่งที่ลอยอยู่
     * เรียงจากค่าจริงเสมอ ไม่ได้อิงลำดับในอาเรย์ (ซึ่งเปลี่ยนได้เมื่อมีคนโดนใบแดง)
     */
    const queue: Array<{ depth: number; paint: () => void }> = match.players.map((agent) => ({
      depth: agent.position2d.y,
      paint: () => drawPlayer(ctx, this.projection, this.inputFor(agent, match)),
    }));

    queue.push({
      depth: match.ball.position.y + 0.01,
      paint: () => drawBall(ctx, this.projection, match, ballHeight),
    });

    queue.sort((a, b) => a.depth - b.depth);
    queue.forEach((item) => item.paint());

    if (this.options.showClock !== false) this.drawClock(match);
    this.drawScoreboard(match);
    this.drawBanner(match);
    if (this.options.debug) this.drawDebug(match);
  }

  private inputFor(agent: PlayerAgent, match: MatchEngine): PlayerRenderInput {
    const team = agent.side === 'home' ? match.home : match.away;
    const celebrating = this.bannerType === 'goal' && agent.id === match.ball.lastTouchId;

    return {
      agent,
      style: { shirt: team.color, accent: team.accent },
      pose: poseFor(agent, celebrating),
      selected: this.options.selectedId === agent.id,
      hovered: this.options.hoveredId === agent.id,
      onBall: match.ball.owner === agent.id,
      showName: Boolean(this.options.showNames),
    };
  }

  /** วาดชั้นภาพนิ่งใหม่เมื่อจำเป็น แล้วเก็บไว้ใช้ซ้ำ */
  private paintStaticLayer(viewport: { width: number; height: number }): void {
    if (!this.staticDirty && this.staticLayer) return;

    const layer = this.staticLayer ?? document.createElement('canvas');
    layer.width = viewport.width;
    layer.height = viewport.height;

    const layerCtx = layer.getContext('2d');
    if (!layerCtx) return;

    drawStaticLayer(layerCtx, this.projection, viewport);
    this.staticLayer = layer;
    this.staticDirty = false;
  }

  /* ── HUD ──────────────────────────────────────────────── */

  private drawClock(match: MatchEngine): void {
    const { ctx } = this;
    const anchor = toScreen(this.projection, { x: PITCH.length / 2, y: 0 });
    const size = Math.max(10, this.projection.scale * 2.4);

    ctx.font = `700 ${size}px "IBM Plex Sans Thai", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(match.clockLabel(), anchor.x + 1, anchor.y - size * 0.5 + 1);
    ctx.fillStyle = '#E8F1EA';
    ctx.fillText(match.clockLabel(), anchor.x, anchor.y - size * 0.5);
  }

  private drawScoreboard(match: MatchEngine): void {
    const { ctx } = this;
    const anchor = toScreen(this.projection, { x: PITCH.length / 2, y: PITCH.width });
    const size = Math.max(11, this.projection.scale * 2.6);
    const text = `${match.home.name}  ${match.score.home} - ${match.score.away}  ${match.away.name}`;

    ctx.font = `700 ${size}px "IBM Plex Sans Thai", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(text, anchor.x + 1, anchor.y + size * 1.6 + 1);
    ctx.fillStyle = '#E8F1EA';
    ctx.fillText(text, anchor.x, anchor.y + size * 1.6);
  }

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
    const anchor = toScreen(this.projection, { x: PITCH.length / 2, y: PITCH.width / 2 });
    const size = Math.max(14, this.projection.scale * 5.5);

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = `800 ${size}px "IBM Plex Sans Thai", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(banner.text, anchor.x + 2, anchor.y + 2);
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text, anchor.x, anchor.y);
    ctx.restore();
  }

  /* ── แผงตรวจสอบ (dev เท่านั้น) ────────────────────────── */

  /**
   * หมุดยุทธวิธีใช้การฉายภาพตัวเดียวกับตัวละครทุกจุด
   * ไม่มีการคำนวณตำแหน่งบนจอด้วยสูตรอื่นที่ไหนเลยในไฟล์นี้
   */
  private drawDebug(match: MatchEngine): void {
    const { ctx } = this;

    match.players.forEach((agent) => {
      const here = toScreen(this.projection, agent.position2d);
      const home = toScreen(this.projection, agent.formationPosition);
      const target = toScreen(this.projection, agent.targetPosition);
      const tick = this.projection.scale * 0.7;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(home.x - tick, home.y);
      ctx.lineTo(home.x + tick, home.y);
      ctx.moveTo(home.x, home.y - tick);
      ctx.lineTo(home.x, home.y + tick);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(245, 185, 62, 0.55)';
      ctx.setLineDash([this.projection.scale * 0.6, this.projection.scale * 0.6]);
      ctx.beginPath();
      ctx.moveTo(here.x, here.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const velocity = toScreen(this.projection, {
        x: agent.position2d.x + agent.velocity.x * 0.4,
        y: agent.position2d.y + agent.velocity.y * 0.4,
      });
      ctx.strokeStyle = 'rgba(62, 210, 160, 0.9)';
      ctx.lineWidth = Math.max(1, this.projection.scale * 0.12);
      ctx.beginPath();
      ctx.moveTo(here.x, here.y);
      ctx.lineTo(velocity.x, velocity.y);
      ctx.stroke();

      const size = Math.max(6, this.projection.scale * 1.1);
      ctx.font = `600 ${size}px "IBM Plex Sans Thai", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(232, 241, 234, 0.85)';
      ctx.fillText(
        `${STATE_SHORT[agent.state] ?? agent.state}·${agent.decision.toLowerCase()}`,
        here.x,
        here.y + this.projection.scale * 1.4,
      );
    });

    this.drawDebugPanel(match);
  }

  private drawDebugPanel(match: MatchEngine): void {
    const { ctx } = this;
    const nameOf = (id: string | null) =>
      match.players.find((agent) => agent.id === id)?.name ?? '—';

    const lines = [
      `clock ${match.clockLabel()}  ${match.period}  running ${match.clock.running}`,
      `initiative ${match.initiative}  on pitch ${match.home.players.length}v${match.away.players.length}`,
      `ball ${match.ball.state} ${match.ball.position.x.toFixed(1)},${match.ball.position.y.toFixed(1)} v ${match.ball.speed.toFixed(1)}`,
      `owner ${nameOf(match.ball.owner)}`,
      `shots ${match.stats.home.shots}/${match.stats.home.shotsOnTarget} - ${match.stats.away.shots}/${match.stats.away.shotsOnTarget}`,
      `camera zoom ${this.camera.zoom.toFixed(2)} tilt ${this.camera.tilt.toFixed(2)} scale ${this.projection.scale.toFixed(2)}`,
    ];

    const size = Math.max(9, this.projection.scale * 1.5);
    const padding = size * 0.7;
    const lineHeight = size * 1.45;

    ctx.font = `500 ${size}px ui-monospace, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + padding * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
    ctx.fillRect(padding, padding, width, lineHeight * lines.length + padding);

    ctx.fillStyle = '#E8F1EA';
    lines.forEach((line, index) => {
      ctx.fillText(line, padding * 2, padding * 1.5 + index * lineHeight);
    });
  }
}
