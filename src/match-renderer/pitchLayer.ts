/**
 * ชั้นภาพนิ่ง: สนาม เส้น ประตู และอัฒจันทร์
 *
 * ทุกอย่างในไฟล์นี้ไม่เปลี่ยนระหว่างแมตช์ จึงวาดลงผืนผ้าใบนอกจอครั้งเดียว
 * ตอนขนาดจอหรือกล้องเปลี่ยน แล้วแต่ละเฟรมก็แค่ copy ภาพนั้นมาทับ
 * ประหยัดกว่าการวาดเส้นสนามและอัฒจันทร์ใหม่ 60 ครั้งต่อวินาทีอย่างมาก
 *
 * เรขาคณิตทั้งหมดอ่านจาก PITCH ของเอนจิน — ไม่มีตัวเลขสนามชุดที่สองในโปรเจกต์นี้
 */
import { GOAL_DEPTH, PITCH, goalPosts } from '@/match-engine';
import { toScreen, type ProjectionState } from '@/match-renderer/projection';

const COLORS = {
  grassDark: '#0C1A14',
  grassLight: '#14281F',
  line: 'rgba(232, 241, 234, 0.42)',
  goalFrame: 'rgba(240, 246, 242, 0.9)',
  net: 'rgba(232, 241, 234, 0.18)',
  standBack: '#080F0C',
  standFront: '#101B16',
  crowd: 'rgba(232, 241, 234, 0.16)',
  board: '#0A1512',
  boardEdge: 'rgba(62, 210, 160, 0.35)',
  bench: '#0E1A15',
} as const;

/** จุดในสนามหนึ่งจุด แปลงเป็นพิกัดจอ */
const point = (state: ProjectionState, x: number, y: number, z = 0) =>
  toScreen(state, { x, y, z });

/** วาดรูปหลายเหลี่ยมจากจุดในพิกัดสนาม */
const polygon = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  points: Array<[number, number]>,
): void => {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const screen = point(state, x, y);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  ctx.closePath();
};

/** เส้นตรงในพิกัดสนาม (ต้องวาดเป็นเส้นตรงเสมอเพราะเปอร์สเปกทีฟเป็นเชิงเส้นในแต่ละแกน) */
const line = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  from: [number, number],
  to: [number, number],
): void => {
  const a = point(state, from[0], from[1]);
  const b = point(state, to[0], to[1]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
};

/**
 * วงกลมในสนามกลายเป็นวงรีบนจอ เพราะแกนลึกถูกย่อด้วย tilt
 * วาดทีละส่วนโค้งเพื่อให้ความกว้างเปลี่ยนตามเปอร์สเปกทีฟด้วย
 */
const ellipseOnPitch = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  cx: number,
  cy: number,
  radius: number,
  segments = 48,
): void => {
  ctx.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const screen = point(state, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  }
  ctx.stroke();
};

/** ส่วนโค้งบางส่วน (มุมสนาม / ครึ่งวงกลมหน้าเขตโทษ) */
const arcOnPitch = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  cx: number,
  cy: number,
  radius: number,
  from: number,
  to: number,
  segments = 16,
): void => {
  ctx.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const angle = from + ((to - from) * index) / segments;
    const screen = point(state, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  }
  ctx.stroke();
};

/* ── อัฒจันทร์ ─────────────────────────────────────────── */

/**
 * อัฒจันทร์รอบสนาม — ใช้รูปทรงซ้ำ ๆ ไม่กี่ชิ้น ไม่ได้วาดคนดูทีละคน
 * วาดครั้งเดียวตอนสร้างชั้นภาพนิ่ง จึงไม่มีผลกับเฟรมเรตเลย
 */
const drawStands = (ctx: CanvasRenderingContext2D, state: ProjectionState): void => {
  const outer = { x: 26, y: 18 };
  const board = { x: 4, y: 3 };

  // อัฒจันทร์: กรอบนอกใหญ่กว่าสนามทุกด้าน วาดเป็นสี่เหลี่ยมคางหมูตามเปอร์สเปกทีฟ
  const stands: Array<{ from: [number, number]; to: [number, number] }> = [
    // ฝั่งไกลกล้อง
    { from: [-outer.x, -outer.y], to: [PITCH.length + outer.x, 0] },
    // ฝั่งใกล้กล้อง
    { from: [-outer.x, PITCH.width], to: [PITCH.length + outer.x, PITCH.width + outer.y] },
    // หลังประตูสองข้าง
    { from: [-outer.x, 0], to: [0, PITCH.width] },
    { from: [PITCH.length, 0], to: [PITCH.length + outer.x, PITCH.width] },
  ];

  stands.forEach((stand) => {
    const [x0, y0] = stand.from;
    const [x1, y1] = stand.to;

    const gradient = ctx.createLinearGradient(
      0,
      point(state, x0, y0).y,
      0,
      point(state, x1, y1).y,
    );
    gradient.addColorStop(0, COLORS.standBack);
    gradient.addColorStop(1, COLORS.standFront);

    polygon(ctx, state, [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ]);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  /*
   * ความรู้สึกของฝูงชน: จุดเล็ก ๆ เรียงเป็นแถวบนอัฒจันทร์สองฝั่งยาว
   * ใช้ตำแหน่งที่คำนวณจากดัชนี ไม่ได้สุ่ม ภาพจึงเหมือนเดิมทุกครั้งที่ปรับขนาดจอ
   */
  ctx.fillStyle = COLORS.crowd;
  const rows = 6;
  const columns = 60;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = -outer.x + ((PITCH.length + outer.x * 2) * (column + 0.5)) / columns;
      const offset = (row % 2) * 0.5;

      const far = point(state, x + offset, -3 - (row / rows) * (outer.y - 4));
      const near = point(state, x + offset, PITCH.width + 3 + (row / rows) * (outer.y - 4));
      const size = Math.max(1, state.scale * 0.5);

      ctx.fillRect(far.x, far.y, size, size);
      ctx.fillRect(near.x, near.y, size, size);
    }
  }

  // ป้ายโฆษณารอบสนาม — แถบเรียบ ๆ ขอบเรืองสีของเกม
  const boards: Array<Array<[number, number]>> = [
    [
      [-board.x, -board.y],
      [PITCH.length + board.x, -board.y],
      [PITCH.length + board.x, -0.5],
      [-board.x, -0.5],
    ],
    [
      [-board.x, PITCH.width + 0.5],
      [PITCH.length + board.x, PITCH.width + 0.5],
      [PITCH.length + board.x, PITCH.width + board.y],
      [-board.x, PITCH.width + board.y],
    ],
  ];

  boards.forEach((shape) => {
    polygon(ctx, state, shape);
    ctx.fillStyle = COLORS.board;
    ctx.fill();
    ctx.strokeStyle = COLORS.boardEdge;
    ctx.lineWidth = Math.max(1, state.scale * 0.08);
    ctx.stroke();
  });

  // ม้านั่งสำรองและพื้นที่เทคนิคฝั่งใกล้กล้อง
  [PITCH.length / 2 - 20, PITCH.length / 2 + 8].forEach((benchX) => {
    polygon(ctx, state, [
      [benchX, PITCH.width + 4],
      [benchX + 12, PITCH.width + 4],
      [benchX + 12, PITCH.width + 7],
      [benchX, PITCH.width + 7],
    ]);
    ctx.fillStyle = COLORS.bench;
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 241, 234, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
};

/* ── ประตู ─────────────────────────────────────────────── */

/**
 * ประตูพร้อมเสา คาน และตาข่าย — เป็นภาพล้วน ไม่เกี่ยวกับการตรวจจับประตู
 * ความสูงคานใช้ 2.44 ม. ตามกติกา ฉายผ่านแกน z เดียวกับลูกบอล
 */
const drawGoal = (ctx: CanvasRenderingContext2D, state: ProjectionState, end: 0 | 1): void => {
  const { left, right } = goalPosts();
  const lineX = end === 0 ? 0 : PITCH.length;
  const backX = end === 0 ? -GOAL_DEPTH : PITCH.length + GOAL_DEPTH;
  const crossbar = 2.44;

  const frontLeft = point(state, lineX, left);
  const frontRight = point(state, lineX, right);
  const topLeft = point(state, lineX, left, crossbar);
  const topRight = point(state, lineX, right, crossbar);
  const backLeft = point(state, backX, left, crossbar);
  const backRight = point(state, backX, right, crossbar);
  const groundLeft = point(state, backX, left);
  const groundRight = point(state, backX, right);

  // ตาข่าย: ระนาบหลังประตูกับด้านข้าง
  ctx.fillStyle = COLORS.net;
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(backRight.x, backRight.y);
  ctx.lineTo(backLeft.x, backLeft.y);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(backLeft.x, backLeft.y);
  ctx.lineTo(backRight.x, backRight.y);
  ctx.lineTo(groundRight.x, groundRight.y);
  ctx.lineTo(groundLeft.x, groundLeft.y);
  ctx.closePath();
  ctx.fill();

  // ลายตาข่ายแบบพอเห็น ไม่ต้องถี่จนกินแรงวาด
  ctx.strokeStyle = 'rgba(232, 241, 234, 0.14)';
  ctx.lineWidth = 1;
  for (let index = 1; index < 8; index += 1) {
    const t = index / 8;
    const y = left + (right - left) * t;
    const top = point(state, lineX, y, crossbar);
    const back = point(state, backX, y, crossbar);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(back.x, back.y);
    ctx.stroke();
  }

  // เสาและคาน
  ctx.strokeStyle = COLORS.goalFrame;
  ctx.lineWidth = Math.max(2, state.scale * 0.16);
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(frontLeft.x, frontLeft.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(frontRight.x, frontRight.y);
  ctx.stroke();
};

/* ── สนามและเส้น ───────────────────────────────────────── */

const drawGrass = (ctx: CanvasRenderingContext2D, state: ProjectionState): void => {
  polygon(ctx, state, [
    [0, 0],
    [PITCH.length, 0],
    [PITCH.length, PITCH.width],
    [0, PITCH.width],
  ]);
  ctx.fillStyle = COLORS.grassDark;
  ctx.fill();

  // ลายตัดหญ้า 12 แถบตามแนวยาว ช่วยให้กะระยะและเห็นเปอร์สเปกทีฟชัดขึ้น
  const stripes = 12;
  for (let index = 0; index < stripes; index += 1) {
    if (index % 2 !== 0) continue;

    const from = (PITCH.length / stripes) * index;
    const to = from + PITCH.length / stripes;

    polygon(ctx, state, [
      [from, 0],
      [to, 0],
      [to, PITCH.width],
      [from, PITCH.width],
    ]);
    ctx.fillStyle = COLORS.grassLight;
    ctx.fill();
  }

  /*
   * ไล่เฉดจากไกลไปใกล้ ให้รู้สึกว่ามีแสงสนามส่องลงมา
   * ใช้ gradient ชิ้นเดียวคลุมทั้งสนาม ไม่ใช่ blur ต่อวัตถุซึ่งกินแรงมาก
   */
  const top = point(state, 0, 0).y;
  const bottom = point(state, 0, PITCH.width).y;
  const shade = ctx.createLinearGradient(0, top, 0, bottom);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  shade.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.18)');

  polygon(ctx, state, [
    [0, 0],
    [PITCH.length, 0],
    [PITCH.length, PITCH.width],
    [0, PITCH.width],
  ]);
  ctx.fillStyle = shade;
  ctx.fill();
};

const drawMarkings = (ctx: CanvasRenderingContext2D, state: ProjectionState): void => {
  const centre = PITCH.width / 2;
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = Math.max(1, state.scale * 0.14);

  // เส้นรอบสนาม
  polygon(ctx, state, [
    [0, 0],
    [PITCH.length, 0],
    [PITCH.length, PITCH.width],
    [0, PITCH.width],
  ]);
  ctx.stroke();

  // เส้นแบ่งแดนและวงกลมกลางสนาม
  line(ctx, state, [PITCH.length / 2, 0], [PITCH.length / 2, PITCH.width]);
  ellipseOnPitch(ctx, state, PITCH.length / 2, centre, PITCH.centreCircleRadius);

  // จุดเขี่ยบอล
  const spot = point(state, PITCH.length / 2, centre);
  ctx.fillStyle = COLORS.line;
  ctx.beginPath();
  ctx.arc(spot.x, spot.y, Math.max(1, state.scale * 0.22), 0, Math.PI * 2);
  ctx.fill();

  ([0, 1] as const).forEach((end) => {
    const lineX = end === 0 ? 0 : PITCH.length;
    const inward = end === 0 ? 1 : -1;

    const box = (depth: number, width: number) => {
      const near = lineX;
      const far = lineX + inward * depth;
      polygon(ctx, state, [
        [near, centre - width / 2],
        [far, centre - width / 2],
        [far, centre + width / 2],
        [near, centre + width / 2],
      ]);
      ctx.stroke();
    };

    box(PITCH.penaltyDepth, PITCH.penaltyWidth);
    box(PITCH.goalAreaDepth, PITCH.goalAreaWidth);

    // จุดโทษ
    const penalty = point(state, lineX + inward * PITCH.penaltySpot, centre);
    ctx.fillStyle = COLORS.line;
    ctx.beginPath();
    ctx.arc(penalty.x, penalty.y, Math.max(1, state.scale * 0.2), 0, Math.PI * 2);
    ctx.fill();

    // ส่วนโค้งหน้าเขตโทษ
    const arcCentreX = lineX + inward * PITCH.penaltySpot;
    const base = end === 0 ? 0 : Math.PI;
    arcOnPitch(ctx, state, arcCentreX, centre, PITCH.centreCircleRadius, base - 0.9, base + 0.9);

    // มุมสนามทั้งสี่
    ([0, PITCH.width] as const).forEach((cornerY) => {
      const from = end === 0 ? (cornerY === 0 ? 0 : -Math.PI / 2) : cornerY === 0 ? Math.PI / 2 : Math.PI;
      arcOnPitch(ctx, state, lineX, cornerY, PITCH.cornerRadius, from, from + Math.PI / 2, 8);
    });
  });
};

/**
 * วาดชั้นภาพนิ่งทั้งหมดลงบริบทที่ให้มา
 * เรียกครั้งเดียวต่อการเปลี่ยนขนาด/กล้อง ไม่ใช่ทุกเฟรม
 */
export const drawStaticLayer = (
  ctx: CanvasRenderingContext2D,
  state: ProjectionState,
  viewport: { width: number; height: number },
): void => {
  ctx.clearRect(0, 0, viewport.width, viewport.height);

  // พื้นหลังนอกสนาม
  ctx.fillStyle = COLORS.standBack;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  drawStands(ctx, state);
  drawGrass(ctx, state);
  drawMarkings(ctx, state);
  drawGoal(ctx, state, 0);
  drawGoal(ctx, state, 1);
};
