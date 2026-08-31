/**
 * การวาดตัวนักเตะแบบ 2.5D
 *
 * วาดด้วยรูปทรงบน Canvas ล้วน ไม่มีไฟล์ภาพ ไม่มี dependency เพิ่ม
 * ตัวนักเตะประกอบจาก: เงา → ขา → กางเกง → เสื้อ → หัว → เบอร์
 * ขนาดของทุกชิ้นคูณด้วยค่าความลึกจากการฉายภาพ คนใกล้กล้องจึงตัวโตกว่านิดหน่อย
 *
 * ท่าทางทั้งหมดอ่านจากสถานะที่เอนจินมีอยู่แล้ว (state / decision / speed / runPhase)
 * เป็นการแสดงผลล้วน ไม่มีอะไรย้อนกลับไปกระทบการจำลอง
 */
import type { PlayerAgent } from '@/match-engine/playerAgent';
import {
  heightToPixels,
  metresToPixels,
  toScreen,
  type ProjectionState,
} from '@/match-renderer/projection';

/** ท่าทางที่ใช้วาด — แปลงจากสถานะของเอนจิน ไม่ใช่ระบบใหม่ */
export type PlayerPose = 'IDLE' | 'RUN' | 'KICK' | 'TACKLE' | 'RECEIVE' | 'CELEBRATE';

/** ความสูงของนักเตะที่ใช้วาด (เมตร) */
const BODY_HEIGHT = 1.82;

/** ความกว้างของลำตัว (เมตร) */
const BODY_WIDTH = 0.62;

/** เลือกท่าจากสถานะจริงของเอนจิน */
export const poseFor = (agent: PlayerAgent, celebrating: boolean): PlayerPose => {
  if (celebrating) return 'CELEBRATE';
  if (agent.decision === 'TACKLE') return 'TACKLE';
  if (agent.decision === 'SHOOT' || agent.decision === 'PASS') return 'KICK';
  if (agent.state === 'RECEIVING') return 'RECEIVE';
  if (agent.speed > 0.6) return 'RUN';
  return 'IDLE';
};

export interface PlayerStyle {
  /** สีเสื้อของทีม */
  shirt: string;
  /** สีเบอร์และขอบ */
  accent: string;
}

export interface PlayerRenderInput {
  agent: PlayerAgent;
  style: PlayerStyle;
  pose: PlayerPose;
  selected: boolean;
  hovered: boolean;
  onBall: boolean;
  showName: boolean;
}

/** เงาบนพื้น — วาดก่อนตัวเสมอ และผูกกับพิกัดพื้นของนักเตะ ไม่ใช่ตำแหน่งบนจอของหัว */
export const drawPlayerShadow = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  agent: PlayerAgent,
): void => {
  const ground = toScreen(state, { x: agent.position2d.x, y: agent.position2d.y });
  const radius = metresToPixels(state, BODY_WIDTH * 0.85, agent.position2d.y);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, radius, radius * state.tilt * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * ตัวนักเตะหนึ่งคน
 *
 * ทุกชิ้นวัดจากจุดยืนบนพื้น (ground) ขึ้นไปตามแกน z
 * ทำให้ตัวละครยืนติดพื้นเสมอไม่ว่ากล้องจะเอียงแค่ไหน
 */
export const drawPlayer = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  input: PlayerRenderInput,
): void => {
  const { agent, style, pose } = input;
  const ground = toScreen(state, { x: agent.position2d.x, y: agent.position2d.y });

  const unit = metresToPixels(state, 1, agent.position2d.y);
  const height = heightToPixels(state, BODY_HEIGHT);
  const width = unit * BODY_WIDTH;

  // จังหวะขา: วิ่งเร็วก้าวกว้าง ยืนนิ่งขาหยุด ท่าอื่นใช้แกว่งเบา ๆ
  const effort = Math.min(agent.speed / Math.max(agent.topSpeed, 0.001), 1);
  const swingBase = pose === 'RUN' ? effort : pose === 'IDLE' ? 0 : 0.35;
  const swing = Math.sin(agent.runPhase) * swingBase;

  // เอียงตัวไปตามทิศที่หันหน้า (แกน x บนจอเท่านั้น — ไม่หมุนทั้งตัวให้ดูสับสน)
  const lean = Math.cos(agent.facing) * (pose === 'RUN' ? 0.22 : 0.1);

  const legTop = ground.y - height * 0.46;
  const hip = ground.y - height * 0.44;
  const shoulder = ground.y - height * 0.82;
  const headY = ground.y - height * 0.92;

  ctx.lineCap = 'round';

  /* ── ขา ── */
  ctx.strokeStyle = 'rgba(226, 214, 196, 0.92)';
  ctx.lineWidth = Math.max(1, width * 0.26);

  const legReach = pose === 'TACKLE' ? 1.5 : 1;
  [-1, 1].forEach((side) => {
    const spread = swing * side * width * 0.9 * legReach;
    ctx.beginPath();
    ctx.moveTo(ground.x + side * width * 0.2, legTop);
    ctx.lineTo(ground.x + side * width * 0.2 + spread + lean * width, ground.y);
    ctx.stroke();
  });

  /* ── กางเกง ── */
  ctx.fillStyle = style.accent;
  ctx.beginPath();
  ctx.ellipse(
    ground.x + lean * width * 0.5,
    hip,
    width * 0.56,
    height * 0.09,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  /* ── ลำตัว/เสื้อ ── */
  const bodyTilt = pose === 'TACKLE' ? 0.35 : pose === 'KICK' ? 0.18 : 0;
  const torsoX = ground.x + lean * width * 0.8 + bodyTilt * width;

  ctx.fillStyle = style.shirt;
  ctx.beginPath();
  ctx.moveTo(torsoX - width * 0.5, shoulder);
  ctx.lineTo(torsoX + width * 0.5, shoulder);
  ctx.lineTo(ground.x + lean * width * 0.5 + width * 0.42, hip);
  ctx.lineTo(ground.x + lean * width * 0.5 - width * 0.42, hip);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = Math.max(1, width * 0.08);
  ctx.stroke();

  /* ── แขน ── */
  ctx.strokeStyle = style.shirt;
  ctx.lineWidth = Math.max(1, width * 0.2);
  const armSwing = pose === 'CELEBRATE' ? -1 : swing * 0.7;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(torsoX + side * width * 0.45, shoulder + height * 0.02);
    ctx.lineTo(
      torsoX + side * width * (0.65 + Math.abs(armSwing) * 0.25),
      pose === 'CELEBRATE' ? shoulder - height * 0.2 : shoulder + height * 0.2 - armSwing * side * height * 0.06,
    );
    ctx.stroke();
  });

  /* ── หัว ── */
  ctx.fillStyle = 'rgba(232, 219, 199, 0.96)';
  ctx.beginPath();
  ctx.arc(torsoX, headY, width * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = Math.max(1, width * 0.07);
  ctx.stroke();

  /* ── เบอร์เสื้อ ── */
  const numberSize = Math.max(7, height * 0.2);
  ctx.font = `700 ${numberSize}px "IBM Plex Sans Thai", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.accent;
  ctx.fillText(String(agent.shirtNumber), torsoX, shoulder + height * 0.13);

  if (input.showName) drawPlayerName(ctx, ground.x, ground.y, unit, agent.name);
};

/**
 * ชื่อใต้เท้านักเตะ
 *
 * ชื่อมาจาก agent.name ซึ่งไหลมาจาก player.name ของการ์ดจริงที่ผู้เล่นจัดลงสนาม
 * ไม่มีการปั้นชื่อขึ้นเองที่ไหนในชั้นการแสดงผลเลย
 *
 * ตัวหนังสือขาวล้วน ไม่มีแผ่นรองและไม่มีขีดสีทีม เพราะ 22 ชื่อพร้อมกันบนสนาม
 * ทำให้กล่องพื้นหลังทับกันจนอ่านยากกว่าเดิม
 * เหลือไว้แค่เงาเข้มบาง ๆ ใต้ตัวอักษร ไม่งั้นตัวขาวจะจมหายไปกับหญ้าลายอ่อน
 */
const drawPlayerName = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: number,
  name: string,
): void => {
  // ผูกขนาดกับสเกลของสนาม แต่ไม่ให้เล็กกว่า 8px ไม่งั้นอ่านไม่ออกตอนซูมออก
  const size = Math.max(8, unit * 0.36);
  const label = name.length > 14 ? `${name.slice(0, 13)}…` : name;
  const top = y + size * 0.9;

  ctx.font = `600 ${size}px "IBM Plex Sans Thai", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(6, 10, 8, 0.7)';
  ctx.fillText(label, x + 1, top + 1);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, x, top);
};

/**
 * วงแหวนรอบเท้า — เลือก / ชี้ / ครองบอล
 * วาดบนพื้นเป็นวงรีตามมุมกล้อง ไม่ใช่วงกลมลอย ๆ
 */
export const drawPlayerRings = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  input: PlayerRenderInput,
): void => {
  const { agent } = input;
  if (!input.selected && !input.hovered && !input.onBall) return;

  const ground = toScreen(state, { x: agent.position2d.x, y: agent.position2d.y });
  const radius = metresToPixels(state, 1.15, agent.position2d.y);

  const ring = (color: string, scale: number, weight: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, radius * weight);
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, radius * scale, radius * scale * state.tilt, 0, 0, Math.PI * 2);
    ctx.stroke();
  };

  if (input.onBall) ring('#F5B93E', 0.95, 0.14);
  if (input.hovered && !input.selected) ring('rgba(232, 241, 234, 0.5)', 1.15, 0.1);
  if (input.selected) ring('#E8F1EA', 1.25, 0.16);
};
