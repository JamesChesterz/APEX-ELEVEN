/**
 * เครื่องยนต์ของทีมจำลอง ("fake player") — pure function ล้วน ห้าม import React
 *
 * ═══ ทำไมต้องคำนวณสด ไม่เก็บลงฐานข้อมูล ═══
 * ถ้าจะให้บอทเก่งขึ้นเองตามเวลา วิธีปกติคือตั้ง cron บนเซิร์ฟเวอร์ให้เขียนค่าใหม่
 * ทุกชั่วโมง — แต่โปรเจกต์นี้ deploy ผ่าน Vercel อย่างเดียว ไม่มี Cloud Functions
 * ให้รัน จึงใช้วิธีตรงข้าม: ไม่เก็บค่าปัจจุบันไว้เลย แต่ให้ทุกอย่างเป็น
 * "ฟังก์ชันของเวลา" ค่าปัจจุบัน = f(seed ของบอท, เวลาตอนนี้)
 *
 * ผลที่ได้:
 *   - ค่าอ่าน/เขียน Firestore = 0 ครั้ง (บอทไม่มีเอกสารของตัวเองในฐานข้อมูลเลย
 *     มีแค่เอกสารค่าตั้งใบเดียวที่แอดมินเขียน คือ config/bots)
 *   - ทุกเครื่องเห็นตารางเดียวกันเป๊ะ เพราะสุ่มด้วย PRNG ที่มี seed
 *     (ห้ามใช้ Math.random ในไฟล์นี้เด็ดขาด — จะทำให้แต่ละเครื่องเห็นไม่ตรงกัน)
 *   - หายไปสามวันแล้วกลับมา จะเห็นบอทขยับอันดับไปแล้วจริง
 *
 * ═══ เวลาเดินเป็นขั้น ไม่ใช่ต่อเนื่อง ═══
 * ค่าถูกล็อกเป็นช่วงละ 6 ชั่วโมง (BOT_TICK_MS) เพื่อ (1) ตัวเลขไม่กระตุกคาหน้าจอ
 * และ (2) นาฬิกาเครื่องผู้เล่นที่เพี้ยนกันไม่กี่นาทีไม่ทำให้เห็นตารางคนละแบบ
 *
 * ═══ แอดมินแทรกแซงตรงไหน ═══
 * ทุกฟังก์ชันในไฟล์นี้รับ BotConfig เข้ามา ไม่มีค่าคงที่ตายตัวที่แอดมินแก้ไม่ได้
 * ค่าที่ล็อกรายตัว (ovr / ตีบวก / คะแนน / ชื่อ) ถูกทาทับตอนสร้าง roster
 * ดู components/admin/BotPanel.tsx สำหรับหน้าจอที่ใช้ตั้งค่าพวกนี้
 */
import { BOT_MANAGERS, BOT_TEAM_NAMES } from '@/data/bots';
import { getUpgradeBonus, MAX_UPGRADE } from '@/data/upgradeConfig';
import type { BotConfig, BotOverride, BotSeed, BotState } from '@/types/bot';
import type { LeaderboardEntry } from '@/types/match';
import { clamp } from '@/utils/helpers';

/* ── ค่าคงที่ของ "เวลา" (แก้ไม่ได้จากหน้าแอดมิน โดยตั้งใจ) ──── */

/**
 * จุดเริ่มเวลาของโลกบอท — ต้องเป็นค่าคงที่ตายตัว ห้ามใช้วันที่ผู้เล่นสมัคร
 * ถ้าย้ายค่านี้ อายุและคะแนนของบอททุกตัวจะกระโดดพร้อมกันทั้งเซิร์ฟเวอร์
 */
export const BOT_EPOCH_MS = Date.UTC(2026, 0, 1);

/** ความถี่ที่ค่าของบอทขยับหนึ่งครั้ง (6 ชั่วโมง) */
export const BOT_TICK_MS = 6 * 60 * 60 * 1000;

/**
 * คลื่นฟอร์มระยะยาว: บางสัปดาห์ทีมนี้ขยันลงแข่ง บางสัปดาห์หายไป
 * มีไว้เพื่อให้ลำดับในตารางสลับกันเองจริง ๆ ไม่ใช่เรียงเหมือนเดิมทุกสัปดาห์
 * แค่ต่างกันที่ตัวเลข (แต่ละทีมมีเฟสของตัวเอง จึงไม่ขึ้น-ลงพร้อมกันทั้งตาราง)
 */
const FORM_WAVE_DAYS = 9;
const FORM_WAVE_AMOUNT = 0.22;

const DAY_MS = 24 * 60 * 60 * 1000;

/* ── ค่าตั้งเริ่มต้น + ตัวตรวจค่าจากเซิร์ฟเวอร์ ──────────────── */

/** ค่าตั้งที่ใช้เมื่อแอดมินยังไม่เคยตั้งอะไรเลย */
export const DEFAULT_BOT_CONFIG: BotConfig = {
  enabled: true,
  matchmaking: true,
  rosterSize: 40,
  tableRows: 30,
  minBots: 20,
  topShare: 0.9,
  minAnchor: 12,
  cycleDays: 30,
  baseOvrMin: 74,
  baseOvrMax: 90,
  capOvrMin: 88,
  capOvrMax: 124,
  matchesMin: 0.8,
  matchesMax: 5,
  overrides: {},
};

/** ขอบเขตที่ยอมรับได้ของแต่ละค่า — ใช้ทั้งตอนตรวจค่าและตอนวาดช่องกรอกในหน้าแอดมิน */
export const BOT_LIMITS = {
  rosterSize: { min: 0, max: 120 },
  tableRows: { min: 5, max: 120 },
  minBots: { min: 0, max: 120 },
  topShare: { min: 0.1, max: 1 },
  minAnchor: { min: 0, max: 500 },
  cycleDays: { min: 3, max: 365 },
  ovr: { min: 40, max: 180 },
  matchesPerDay: { min: 0, max: 20 },
  winRate: { min: 0, max: 1 },
  points: { min: -999, max: 9999 },
  plus: { min: 0, max: MAX_UPGRADE },
} as const;

const num = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;

const optionalNum = (
  value: unknown,
  min: number,
  max: number,
): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : undefined;

const text = (value: unknown, max = 24): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

/** เก็บเฉพาะคีย์ที่มีค่าจริง — ค่า undefined ทำให้ Firestore ปฏิเสธทั้งเอกสาร */
const normalizeOverride = (raw: unknown): BotOverride | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const result: BotOverride = {};
  const teamName = text(value.teamName);
  const managerName = text(value.managerName);
  const ovr = optionalNum(value.ovr, BOT_LIMITS.ovr.min, BOT_LIMITS.ovr.max);
  const capOvr = optionalNum(value.capOvr, BOT_LIMITS.ovr.min, BOT_LIMITS.ovr.max);
  const plus = optionalNum(value.plus, BOT_LIMITS.plus.min, BOT_LIMITS.plus.max);
  const matchesPerDay = optionalNum(
    value.matchesPerDay,
    BOT_LIMITS.matchesPerDay.min,
    BOT_LIMITS.matchesPerDay.max,
  );
  const winRate = optionalNum(value.winRate, BOT_LIMITS.winRate.min, BOT_LIMITS.winRate.max);
  const points = optionalNum(value.points, BOT_LIMITS.points.min, BOT_LIMITS.points.max);

  if (teamName) result.teamName = teamName;
  if (managerName) result.managerName = managerName;
  if (ovr !== undefined) result.ovr = Math.round(ovr);
  if (capOvr !== undefined) result.capOvr = Math.round(capOvr);
  if (plus !== undefined) result.plus = Math.round(plus);
  if (matchesPerDay !== undefined) result.matchesPerDay = matchesPerDay;
  if (winRate !== undefined) result.winRate = winRate;
  if (points !== undefined) result.points = Math.round(points);
  if (value.hidden === true) result.hidden = true;

  return Object.keys(result).length ? result : null;
};

/**
 * ตรวจค่าที่อ่านมาจากเซิร์ฟเวอร์ให้ปลอดภัยก่อนใช้
 *
 * สำคัญกว่าที่คิด: เอกสาร config อ่านได้ทุกคน และค่าพวกนี้ไปกำหนดว่าตาราง
 * อันดับหน้าตาเป็นยังไง ถ้าเผลอตั้ง rosterSize เป็นหลักหมื่นจากหน้าแอดมิน
 * ผู้เล่นทุกคนจะค้างพร้อมกัน จึงบีบช่วงไว้ที่นี่จุดเดียว ไม่ใช่ที่หน้าจอ
 */
export const normalizeBotConfig = (raw: Partial<BotConfig> | null | undefined): BotConfig => {
  const value = (raw ?? {}) as Record<string, unknown>;
  const base = DEFAULT_BOT_CONFIG;

  const baseOvrMin = num(value.baseOvrMin, base.baseOvrMin, BOT_LIMITS.ovr.min, BOT_LIMITS.ovr.max);
  const capOvrMin = num(value.capOvrMin, base.capOvrMin, BOT_LIMITS.ovr.min, BOT_LIMITS.ovr.max);
  const matchesMin = num(
    value.matchesMin,
    base.matchesMin,
    BOT_LIMITS.matchesPerDay.min,
    BOT_LIMITS.matchesPerDay.max,
  );

  const overrides: Record<string, BotOverride> = {};
  const rawOverrides = value.overrides;
  if (rawOverrides && typeof rawOverrides === 'object') {
    Object.entries(rawOverrides as Record<string, unknown>).forEach(([id, entry]) => {
      const clean = normalizeOverride(entry);
      if (clean) overrides[id] = clean;
    });
  }

  return {
    enabled: value.enabled !== false,
    matchmaking: value.matchmaking !== false,
    rosterSize: Math.round(
      num(value.rosterSize, base.rosterSize, BOT_LIMITS.rosterSize.min, BOT_LIMITS.rosterSize.max),
    ),
    tableRows: Math.round(
      num(value.tableRows, base.tableRows, BOT_LIMITS.tableRows.min, BOT_LIMITS.tableRows.max),
    ),
    minBots: Math.round(
      num(value.minBots, base.minBots, BOT_LIMITS.minBots.min, BOT_LIMITS.minBots.max),
    ),
    topShare: num(value.topShare, base.topShare, BOT_LIMITS.topShare.min, BOT_LIMITS.topShare.max),
    minAnchor: Math.round(
      num(value.minAnchor, base.minAnchor, BOT_LIMITS.minAnchor.min, BOT_LIMITS.minAnchor.max),
    ),
    cycleDays: Math.round(
      num(value.cycleDays, base.cycleDays, BOT_LIMITS.cycleDays.min, BOT_LIMITS.cycleDays.max),
    ),
    baseOvrMin,
    // ค่าสูงสุดต้องไม่ต่ำกว่าค่าต่ำสุดเสมอ ไม่งั้นช่วงสุ่มจะกลับด้านแล้วได้ค่าประหลาด
    baseOvrMax: num(value.baseOvrMax, base.baseOvrMax, baseOvrMin, BOT_LIMITS.ovr.max),
    capOvrMin,
    capOvrMax: num(value.capOvrMax, base.capOvrMax, capOvrMin, BOT_LIMITS.ovr.max),
    matchesMin,
    matchesMax: num(
      value.matchesMax,
      base.matchesMax,
      matchesMin,
      BOT_LIMITS.matchesPerDay.max,
    ),
    overrides,
  };
};

/* ── สุ่มแบบมี seed (deterministic) ──────────────────────────── */

/** FNV-1a: แปลงข้อความเป็นตัวเลข 32 บิตแบบเดิมทุกครั้ง */
const hashString = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** mulberry32: ตัวสุ่มเล็ก ๆ ที่ให้ลำดับเดิมเสมอเมื่อ seed เท่ากัน */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * ตัวสุ่มประจำ seed หนึ่งค่า — เปิดให้ระบบอื่น (เช่นการปั้นตัวจริง 11 คน)
 * ใช้ตัวสุ่มตัวเดียวกัน ผลจึงตรงกันทุกเครื่องเหมือนกับค่าในตารางอันดับ
 */
export const botRng = (seed: number): (() => number) => mulberry32(seed >>> 0);

/** id ประจำตัวบอท — ผูกกับลำดับ จึงไม่เปลี่ยนเมื่อแอดมินเพิ่ม/ลดจำนวนบอท */
export const botId = (index: number): string => `bot-${String(index + 1).padStart(3, '0')}`;

/* ── รายชื่อบอททั้งเซิร์ฟเวอร์ ───────────────────────────────── */

/**
 * สร้างเมล็ดพันธุ์ของบอทหนึ่งตัว แล้วทาค่าที่แอดมินล็อกทับ
 *
 * ลำดับสำคัญ: สุ่มก่อน → แอดมินทับทีหลัง ค่าที่แอดมินไม่ได้แตะจึงยังสุ่มเหมือนเดิม
 * และลบค่าที่ล็อกออกเมื่อไหร่ ทีมนั้นก็กลับไปเป็นตัวเดิมเป๊ะ ไม่ใช่ตัวใหม่
 */
const buildSeed = (index: number, config: BotConfig): BotSeed => {
  const teamName = BOT_TEAM_NAMES[index % BOT_TEAM_NAMES.length];
  // เดินคนละก้าวกับชื่อทีม (คูณ 7) เพื่อไม่ให้ทีมกับผู้จัดการจับคู่ซ้ำแพตเทิร์นเดิม
  const managerName = BOT_MANAGERS[(index * 7 + 3) % BOT_MANAGERS.length];
  const seed = hashString(`${teamName}|${managerName}|${index}`);
  const random = mulberry32(seed);

  const baseOvr = config.baseOvrMin + random() * (config.baseOvrMax - config.baseOvrMin);
  const capOvr = clamp(
    config.capOvrMin + random() * (config.capOvrMax - config.capOvrMin),
    baseOvr,
    BOT_LIMITS.ovr.max,
  );
  const growthDays = 40 + random() * 120;
  const ageDays = random() * 260;
  const matchesPerDay = config.matchesMin + random() * (config.matchesMax - config.matchesMin);
  const cycleOffset = random() * config.cycleDays;
  const formPhase = random();
  const winRate = 0.34 + random() * 0.3;
  const drawRate = 0.12 + random() * 0.14;

  const id = botId(index);
  const override = config.overrides[id];

  return {
    id,
    teamName: override?.teamName ?? teamName,
    managerName: override?.managerName ?? managerName,
    seed,
    baseOvr,
    capOvr: override?.capOvr ?? capOvr,
    growthDays,
    ageDays,
    matchesPerDay: override?.matchesPerDay ?? matchesPerDay,
    cycleOffset,
    formPhase,
    winRate: override?.winRate ?? winRate,
    drawRate,
    plus: override?.plus ?? 0,
    lockedOvr: override?.ovr,
    lockedPoints: override?.points,
    hidden: override?.hidden,
  };
};

/**
 * บอททั้งหมดตามค่าตั้งปัจจุบัน
 *
 * มีแคชใบเดียวเพราะฟังก์ชันนี้ถูกเรียกทุกครั้งที่ตารางอันดับ render
 * (ค่าตั้งเปลี่ยนไม่บ่อย แต่ตาราง render บ่อยมาก)
 */
let rosterCache: { key: string; roster: BotSeed[] } | null = null;

export const botRoster = (config: BotConfig): BotSeed[] => {
  const key = JSON.stringify([
    config.rosterSize,
    config.baseOvrMin,
    config.baseOvrMax,
    config.capOvrMin,
    config.capOvrMax,
    config.matchesMin,
    config.matchesMax,
    config.cycleDays,
    config.overrides,
  ]);
  if (rosterCache?.key === key) return rosterCache.roster;

  const roster = Array.from({ length: config.rosterSize }, (_unused, index) =>
    buildSeed(index, config),
  );
  rosterCache = { key, roster };
  return roster;
};

/* ── เวลา ────────────────────────────────────────────────────── */

/**
 * ช่วงเวลาปัจจุบันของโลกบอท (ตัวเลขเพิ่มทีละ 1 ทุก 6 ชั่วโมง)
 * ใช้ตัวเลขนี้เป็น "นาฬิกา" แทน Date.now() ทุกที่ ค่าจึงนิ่งพอให้ React memo ได้
 */
export const botTickAt = (nowMs: number = Date.now()): number =>
  Math.max(0, Math.floor((nowMs - BOT_EPOCH_MS) / BOT_TICK_MS));

/* ── สภาพของบอท ณ เวลาหนึ่ง ──────────────────────────────────── */

/**
 * ค่าพลังและสถิติของบอทหนึ่งตัวที่ tick นั้น
 *
 * OVR โตแบบเข้าใกล้เพดาน (exponential approach) ไม่ใช่เส้นตรง:
 * ช่วงแรกพุ่งเร็วเหมือนคนเพิ่งเปิดซองได้การ์ดดี แล้วค่อย ๆ ตันเมื่อเข้าใกล้ capOvr
 *
 * ค่าตีบวกของทีมบวกทับทีหลังเสมอ โดยใช้ตารางตีบวกชุดเดียวกับผู้เล่นจริง
 * (getUpgradeBonus → ตารางที่แอดมินแก้ได้ที่ ADMIN → ตารางตีบวก)
 * แก้ตารางเมื่อไหร่ ทีมจำลองก็ขยับตามทันที ไม่ต้องมาไล่แก้สองที่
 */
export const botStateAt = (bot: BotSeed, tick: number, config: BotConfig): BotState => {
  const days = Math.max(0, (tick * BOT_TICK_MS) / DAY_MS);
  const age = bot.ageDays + days;

  // ค่าสุ่มประจำช่วงเวลานี้ของบอทตัวนี้ — เปลี่ยนทุก 6 ชม. แต่ทุกเครื่องได้ค่าเดียวกัน
  const wobble = mulberry32((bot.seed ^ Math.imul(tick, 0x9e3779b1)) >>> 0)();

  const curve = bot.capOvr - (bot.capOvr - bot.baseOvr) * Math.exp(-age / bot.growthDays);
  // ±1 เพื่อให้เห็นทีมสลับตำแหน่งกันเองบ้าง ไม่ใช่เรียงแช่อยู่กับที่
  const grown = bot.lockedOvr ?? curve + (wobble - 0.5) * 2;
  const ovr = Math.round(grown + getUpgradeBonus(bot.plus));

  // คะแนนสะสมภายในรอบลาดเดอร์ปัจจุบัน (ครบรอบแล้วเริ่มนับใหม่)
  const cycleDay = (days + bot.cycleOffset) % config.cycleDays;
  const form =
    1 + FORM_WAVE_AMOUNT * Math.sin((days / FORM_WAVE_DAYS + bot.formPhase) * Math.PI * 2);
  const matches = Math.max(0, Math.round(cycleDay * bot.matchesPerDay * form));
  // ฟอร์มขึ้นลงเล็กน้อย ±1.5 นัด คะแนนจึงมีทั้งวันที่บวกและวันที่ลบ
  const wins = clamp(Math.round(matches * bot.winRate + (wobble - 0.5) * 3), 0, matches);
  const draws = clamp(Math.round(matches * bot.drawRate), 0, matches - wins);
  const losses = matches - wins - draws;

  if (bot.lockedPoints !== undefined) {
    // คะแนนถูกล็อก — แต่งสถิติให้บวกลบกันแล้วตรงกับคะแนน ไม่งั้นผู้เล่นจับผิดได้
    const locked = bot.lockedPoints;
    const extra = Math.max(0, losses);
    return {
      ovr,
      points: locked,
      wins: Math.max(0, locked + extra),
      draws,
      losses: extra,
    };
  }

  return {
    ovr,
    wins,
    draws,
    losses,
    // ต้องตรงกับ getRankingPoints ใน services/matchmaking.ts (ชนะ +1, เสมอ 0, แพ้ −1)
    points: wins - losses,
  };
};

/* ── แปลงเป็นแถวในตารางอันดับ ────────────────────────────────── */

const toEntry = (bot: BotSeed, state: BotState): LeaderboardEntry => ({
  rank: 0, // อันดับจริงคำนวณตอนรวมกับแถวอื่นใน buildLeaderboard
  // ใส่ id ไว้ในช่อง uid ด้วย เพื่อให้กดดูตัวจริง 11 คนได้เหมือนแถวของคนจริง
  // (useFreshProfile รู้จัก id ที่ขึ้นต้นด้วย bot- แล้วปั้นโปรไฟล์ให้เองโดยไม่ยิงเซิร์ฟเวอร์)
  uid: bot.id,
  managerName: bot.managerName,
  teamName: bot.teamName,
  teamOvr: state.ovr,
  points: state.points,
  wins: state.wins,
  draws: state.draws,
  losses: state.losses,
  isBot: true,
});

/**
 * ย่อสถิติบอททั้งกลุ่มลงตามสัดส่วน ให้คะแนนสูงสุดของบอทไม่เกินเพดานที่ตั้งไว้
 *
 * ย่อ "จำนวนนัด" ไปพร้อมกันด้วย ไม่ใช่ย่อแค่ตัวเลขคะแนน — ไม่งั้นตารางจะโชว์
 * ชนะ 40 แพ้ 8 แต่คะแนน 9 ซึ่งผู้เล่นจับผิดได้ทันทีว่าเป็นของปลอม
 *
 * ทีมที่แอดมินล็อกคะแนนไว้จะไม่ถูกย่อ — ตั้งเท่าไหร่ต้องได้เท่านั้น
 */
const scaleToAnchor = (
  entries: LeaderboardEntry[],
  locked: boolean[],
  anchorPoints: number,
  config: BotConfig,
): LeaderboardEntry[] => {
  const top = entries.reduce(
    (max, entry, index) => (locked[index] ? max : Math.max(max, entry.points)),
    0,
  );
  const target = Math.max(anchorPoints, config.minAnchor) * config.topShare;
  if (top <= target) return entries;

  const factor = target / top;
  return entries.map((entry, index) => {
    if (locked[index]) return entry;
    const wins = Math.round(entry.wins * factor);
    const draws = Math.round(entry.draws * factor);
    const losses = Math.round(entry.losses * factor);
    return { ...entry, wins, draws, losses, points: wins - losses };
  });
};

/**
 * ผลจากการที่ผู้เล่นเอาชนะ (หรือแพ้) ทีมจำลองไปแล้ว
 *
 * ทีมจำลองไม่มีเอกสารในฐานข้อมูล เราจึงเก็บแค่ "ส่วนต่าง" ไว้ในบัญชีผู้เล่น
 * แล้วบวกทับผลลัพธ์ของสูตรตอนแสดงผล — ชนะแล้วเห็นเขาตกอันดับจริง
 * โดยไม่ต้องเปิดสิทธิ์ให้เครื่องผู้เล่นเขียนข้อมูลของบอทได้ (ซึ่งจะโดนปลอมทันที)
 *
 * ข้อจำกัดที่ต้องรู้: ส่วนต่างนี้เห็นเฉพาะบัญชีที่ลงแข่งเอง เพื่อนที่เปิดดูตาราง
 * ของเขาจะยังเห็นคะแนนเดิมของบอท
 *
 * ทีมที่แอดมินล็อกคะแนนไว้ไม่ขยับ — ตั้งเท่าไหร่ต้องได้เท่านั้น
 */
const applyDelta = (
  entry: LeaderboardEntry,
  delta: number,
  locked: boolean,
): LeaderboardEntry => {
  if (!delta || locked) return entry;

  // ผู้เล่นชนะ = บอทเสียแต้ม แปลว่าบอทมีนัดที่แพ้เพิ่ม (ไม่ใช่แค่ตัวเลขคะแนนลด)
  const wins = Math.max(0, entry.wins + Math.max(0, delta));
  const losses = Math.max(0, entry.losses + Math.max(0, -delta));

  return { ...entry, wins, losses, points: wins - losses };
};

/**
 * แถวบอทที่พร้อมเสียบเข้าตารางอันดับ
 *
 * @param anchorPoints คะแนนของผู้เล่นจริงที่สูงสุดในตาราง (ใช้กำหนดเพดานบอท)
 * @param rows         จำนวนแถวที่ต้องการ (ผู้เล่นจริงเยอะขึ้น บอทก็ถอยออกไปเอง)
 * @param tick         นาฬิกาโลกบอท ส่งเข้ามาเพื่อให้เทสล็อกเวลาได้
 * @param config       ค่าตั้งจากหน้าแอดมิน
 */
export const buildBotEntries = (
  anchorPoints: number,
  rows: number,
  tick: number = botTickAt(),
  config: BotConfig = DEFAULT_BOT_CONFIG,
  deltas: Record<string, number> = {},
): LeaderboardEntry[] => {
  if (!config.enabled || rows <= 0) return [];

  const roster = botRoster(config).filter((bot) => !bot.hidden);
  const entries = roster.map((bot) => toEntry(bot, botStateAt(bot, tick, config)));
  const locked = roster.map((bot) => bot.lockedPoints !== undefined);

  return scaleToAnchor(entries, locked, anchorPoints, config)
    .map((entry, index) => applyDelta(entry, deltas[roster[index].id] ?? 0, locked[index]))
    .sort((a, b) => b.points - a.points || b.teamOvr - a.teamOvr)
    .slice(0, rows);
};

/**
 * จำนวนแถวของทีมจำลองที่ควรขึ้นตาราง เมื่อมีผู้เล่นจริงอยู่แล้ว `humanCount` คน
 *
 * ⚠️ จุดที่เคยพลาด: เดิมคิดแค่ "เติมให้ครบ tableRows" (tableRows − คนจริง − 1)
 * พอจำนวนบัญชีจริงแตะ tableRows ค่านี้กลายเป็นศูนย์ ทีมจำลองเลยหายทั้งกระดาน
 * ทั้งที่ยังอยากให้มีอยู่ — ตอนนี้จึงมีพื้น minBots คอยกันไว้
 */
export const botQuota = (config: BotConfig, humanCount: number): number =>
  clamp(
    Math.max(config.minBots, config.tableRows - humanCount - 1),
    0,
    config.rosterSize,
  );

/**
 * ตารางแสดงผลสำหรับหน้าแอดมิน — บอท "ทุกตัว" รวมตัวที่ซ่อนไว้
 * (ตารางจริงกรองตัวที่ซ่อนออกแล้ว แต่หน้าแอดมินต้องเห็นเพื่อกดเปิดกลับได้)
 */
export const botAdminRows = (
  tick: number,
  config: BotConfig,
): Array<{ seed: BotSeed; state: BotState }> =>
  botRoster(config).map((seed) => ({ seed, state: botStateAt(seed, tick, config) }));
