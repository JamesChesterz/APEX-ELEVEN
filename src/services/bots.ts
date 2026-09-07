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
 *   - ค่าอ่าน/เขียน Firestore = 0 ครั้ง (บอทไม่มีเอกสารในฐานข้อมูลเลย)
 *   - ทุกเครื่องเห็นตารางเดียวกันเป๊ะ เพราะสุ่มด้วย PRNG ที่มี seed
 *     (ห้ามใช้ Math.random ในไฟล์นี้เด็ดขาด — จะทำให้แต่ละเครื่องเห็นไม่ตรงกัน)
 *   - หายไปสามวันแล้วกลับมา จะเห็นบอทขยับอันดับไปแล้วจริง ๆ
 *
 * ═══ เวลาเดินเป็นขั้น ไม่ใช่ต่อเนื่อง ═══
 * ค่าถูกล็อกเป็นช่วงละ 6 ชั่วโมง (BOT_TICK_MS) เพื่อ (1) ตัวเลขไม่กระตุกคาหน้าจอ
 * และ (2) นาฬิกาเครื่องผู้เล่นที่เพี้ยนกันไม่กี่นาทีไม่ทำให้เห็นตารางคนละแบบ
 */
import { BOT_MANAGERS, BOT_TEAM_NAMES } from '@/data/bots';
import type { BotSeed, BotState } from '@/types/bot';
import type { LeaderboardEntry } from '@/types/match';
import { clamp } from '@/utils/helpers';

/* ── ค่าคงที่ที่ปรับสมดุลได้ ─────────────────────────────────── */

/** จุดเริ่มเวลาของโลกบอท — ต้องเป็นค่าคงที่ตายตัว ห้ามใช้วันที่ผู้เล่นสมัคร */
export const BOT_EPOCH_MS = Date.UTC(2026, 0, 1);

/** ความถี่ที่ค่าของบอทขยับหนึ่งครั้ง (6 ชั่วโมง) */
export const BOT_TICK_MS = 6 * 60 * 60 * 1000;

/** จำนวนบอททั้งเซิร์ฟเวอร์ */
export const BOT_ROSTER_SIZE = 40;

/** จำนวนแถวที่อยากให้ตารางอันดับมี — ผู้เล่นจริงมาก่อน เหลือเท่าไหร่บอทเติม */
export const BOT_TABLE_ROWS = 30;

/**
 * รอบลาดเดอร์ของบอท (วัน) — ครบรอบแล้วคะแนนรีเซ็ตกลับไปเริ่มใหม่
 * มีไว้กันคะแนนบอทวิ่งหนีไปเรื่อย ๆ จนไม่มีวันตามทัน
 * (ผู้เล่นจริงก็มีซีซันรีเซ็ตเหมือนกัน ดู services/season.ts)
 *
 * แต่ละทีมเริ่มรอบคนละวัน (cycleOffset) ตารางจึงไม่ตกฮวบพร้อมกันทั้งกระดาน
 */
export const BOT_CYCLE_DAYS = 30;

/**
 * เพดานคะแนนบอทเทียบกับผู้เล่นจริงที่คะแนนสูงสุด (0.9 = ไม่เกิน 90%)
 * บอทจึงเบียดกลางตารางได้ แต่ไม่แย่งบัลลังก์อันดับ 1 ของคนจริง
 * — สำคัญเพราะรางวัลปลายซีซันจ่ายตามอันดับ (ดู services/season.ts)
 */
export const BOT_TOP_SHARE = 0.9;

/**
 * คะแนนอ้างอิงขั้นต่ำตอนเซิร์ฟเวอร์ยังใหม่
 * ถ้าไม่มีค่านี้ วันแรกที่ทุกคนคะแนน 0 บอทจะถูกบีบเหลือ 0 ตามกันหมดจนตารางดูตาย
 */
export const BOT_MIN_ANCHOR = 12;

/**
 * คลื่นฟอร์มระยะยาว: บางสัปดาห์ทีมนี้ขยันลงแข่ง บางสัปดาห์หายไป
 * มีไว้เพื่อให้ลำดับในตารางสลับกันเองจริง ๆ ไม่ใช่เรียงเหมือนเดิมทุกสัปดาห์
 * แค่ต่างกันที่ตัวเลข (แต่ละทีมมีเฟสของตัวเอง จึงไม่ขึ้น-ลงพร้อมกันทั้งตาราง)
 */
const FORM_WAVE_DAYS = 9;
const FORM_WAVE_AMOUNT = 0.22;

const DAY_MS = 24 * 60 * 60 * 1000;

/* ── สุ่มแบบมี seed (deterministic) ──────────────────────────── */

/** FNV-1a: แปลงข้อความเป็นตัวเลข 32 บิตแบบเดิมทุกครั้ง */
const hashString = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
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

/* ── รายชื่อบอททั้งเซิร์ฟเวอร์ ───────────────────────────────── */

/**
 * สร้างเมล็ดพันธุ์ของบอททั้งหมดหนึ่งครั้งตอนโหลดโมดูล
 * ทุกค่างอกจาก seed เดียว จึงเพิ่มบอทได้โดยไม่กระทบตัวเดิม
 */
const buildRoster = (): BotSeed[] =>
  Array.from({ length: BOT_ROSTER_SIZE }, (_unused, index) => {
    const teamName = BOT_TEAM_NAMES[index % BOT_TEAM_NAMES.length];
    // เดินคนละก้าวกับชื่อทีม (คูณ 7) เพื่อไม่ให้ทีมกับผู้จัดการจับคู่ซ้ำแพตเทิร์นเดิม
    const managerName = BOT_MANAGERS[(index * 7 + 3) % BOT_MANAGERS.length];
    const seed = hashString(`${teamName}|${managerName}|${index}`);
    const random = mulberry32(seed);

    const baseOvr = 74 + random() * 16;

    return {
      id: `bot-${String(index + 1).padStart(3, '0')}`,
      teamName,
      managerName,
      seed,
      baseOvr,
      // เพดานสูงสุดต่ำกว่าทีมเต็มยศของคนจริงเล็กน้อย (การ์ด legendary ≈ 122)
      capOvr: clamp(baseOvr + 10 + random() * 36, 88, 124),
      growthDays: 40 + random() * 120,
      ageDays: random() * 260,
      matchesPerDay: 0.8 + random() * 4.2,
      cycleOffset: random() * BOT_CYCLE_DAYS,
      formPhase: random(),
      winRate: 0.34 + random() * 0.3,
      drawRate: 0.12 + random() * 0.14,
    };
  });

/** บอททั้งหมดของเซิร์ฟเวอร์ (คงที่ตลอดอายุแอป) */
export const BOT_ROSTER: BotSeed[] = buildRoster();

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
 */
export const botStateAt = (bot: BotSeed, tick: number): BotState => {
  const days = Math.max(0, (tick * BOT_TICK_MS) / DAY_MS);
  const age = bot.ageDays + days;

  // ค่าสุ่มประจำช่วงเวลานี้ของบอทตัวนี้ — เปลี่ยนทุก 6 ชม. แต่ทุกเครื่องได้ค่าเดียวกัน
  const wobble = mulberry32((bot.seed ^ Math.imul(tick, 0x9e3779b1)) >>> 0)();

  const curve = bot.capOvr - (bot.capOvr - bot.baseOvr) * Math.exp(-age / bot.growthDays);
  // ±1 เพื่อให้เห็นทีมสลับตำแหน่งกันเองบ้าง ไม่ใช่เรียงแช่อยู่กับที่
  const ovr = Math.round(curve + (wobble - 0.5) * 2);

  // คะแนนสะสมภายในรอบลาดเดอร์ปัจจุบัน (ครบ 30 วันแล้วเริ่มนับใหม่)
  const cycleDay = (days + bot.cycleOffset) % BOT_CYCLE_DAYS;
  const form =
    1 +
    FORM_WAVE_AMOUNT * Math.sin((days / FORM_WAVE_DAYS + bot.formPhase) * Math.PI * 2);
  const matches = Math.max(0, Math.round(cycleDay * bot.matchesPerDay * form));
  // ฟอร์มขึ้นลงเล็กน้อย ±1.5 นัด คะแนนจึงมีทั้งวันที่บวกและวันที่ลบ
  const wins = clamp(Math.round(matches * bot.winRate + (wobble - 0.5) * 3), 0, matches);
  const draws = clamp(Math.round(matches * bot.drawRate), 0, matches - wins);

  return {
    ovr,
    wins,
    draws,
    losses: matches - wins - draws,
    // ต้องตรงกับ getRankingPoints ใน services/matchmaking.ts (ชนะ +1, เสมอ 0, แพ้ −1)
    points: wins - (matches - wins - draws),
  };
};

/* ── แปลงเป็นแถวในตารางอันดับ ────────────────────────────────── */

const toEntry = (bot: BotSeed, state: BotState): LeaderboardEntry => ({
  rank: 0, // อันดับจริงคำนวณตอนรวมกับแถวอื่นใน buildLeaderboard
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
 */
const scaleToAnchor = (
  entries: LeaderboardEntry[],
  anchorPoints: number,
): LeaderboardEntry[] => {
  const top = entries.reduce((max, entry) => Math.max(max, entry.points), 0);
  const target = Math.max(anchorPoints, BOT_MIN_ANCHOR) * BOT_TOP_SHARE;
  if (top <= target) return entries;

  const factor = target / top;
  return entries.map((entry) => {
    const wins = Math.round(entry.wins * factor);
    const draws = Math.round(entry.draws * factor);
    const losses = Math.round(entry.losses * factor);
    return { ...entry, wins, draws, losses, points: wins - losses };
  });
};

/**
 * แถวบอทที่พร้อมเสียบเข้าตารางอันดับ
 *
 * @param anchorPoints คะแนนของผู้เล่นจริงที่สูงสุดในตาราง (ใช้กำหนดเพดานบอท)
 * @param rows         จำนวนแถวที่ต้องการ (ผู้เล่นจริงเยอะขึ้น บอทก็ถอยออกไปเอง)
 * @param tick         นาฬิกาโลกบอท ส่งเข้ามาเพื่อให้เทสล็อกเวลาได้
 */
export const buildBotEntries = (
  anchorPoints: number,
  rows: number,
  tick: number = botTickAt(),
): LeaderboardEntry[] => {
  if (rows <= 0) return [];

  const entries = BOT_ROSTER.map((bot) => toEntry(bot, botStateAt(bot, tick)));

  return scaleToAnchor(entries, anchorPoints)
    .sort((a, b) => b.points - a.points || b.teamOvr - a.teamOvr)
    .slice(0, rows);
};
