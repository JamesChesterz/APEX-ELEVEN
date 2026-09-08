/**
 * ตัวจริง 11 คนของทีมจำลอง — pure function ล้วน ห้าม import React
 *
 * ทีมจำลองไม่มีคลังการ์ดจริง เราจึง "ปั้น" ตัวจริงขึ้นมาจาก seed เดิมของทีมนั้น
 * ผลคือทีมเดิมได้ผู้เล่นชุดเดิมทุกครั้งที่เปิดดู ไม่ว่าจะเปิดจากเครื่องไหน
 * โดยไม่ต้องเก็บอะไรลงฐานข้อมูลเลยสักช่อง
 *
 * กติกาที่ยึด: ค่าพลังเฉลี่ยของ 11 คนต้องใกล้เคียง OVR ที่โชว์ในตารางอันดับ
 * ไม่งั้นผู้เล่นกดดูแล้วจับผิดได้ทันทีว่าเป็นทีมปลอม (ตารางบอก 118 แต่ในสนามมีแต่ใบ 80)
 */
import { FORMATIONS, getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import type { Player } from '@/types/player';
import { botRng, botRoster, botStateAt } from '@/services/bots';
import { difficultyFromGap, rewardForOpponent } from '@/services/matchmaking';
import type { PublicProfile } from '@/services/firebase/profiles';
import type { BotConfig, BotSeed, BotState } from '@/types/bot';
import { clamp } from '@/utils/helpers';
import type { Opponent } from '@/types/match';
import type { PublicSquadSlot } from '@/types/profile';
import type { FormationId } from '@/types/team';

/** true = id นี้เป็นทีมจำลอง ไม่ใช่บัญชีจริงบนเซิร์ฟเวอร์ */
export const isBotId = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith('bot-');

/** แผนการเล่นประจำทีม — ผูกกับ seed จึงไม่เปลี่ยนไปมาระหว่างเปิดดู */
export const botFormationId = (bot: BotSeed): FormationId => {
  const random = botRng(bot.seed ^ 0x5f356495);
  return FORMATIONS[Math.floor(random() * FORMATIONS.length)].id;
};

/**
 * ช่วงที่ค่าพลังของแต่ละช่องกระจายออกจากค่าเฉลี่ยของทีม
 *
 * ทีมจริงไม่ได้มีนักเตะเรตเท่ากันหมด 11 คน — มีตัวเก่งสองสามคนแล้วที่เหลือรองลงมา
 * ถ้าไม่ใส่ค่านี้ ทีมจำลองจะดูปลอมทันทีเพราะการ์ดเรตเท่ากันเป๊ะทั้งแถว
 */
const SLOT_SPREAD = 14;

/** ค่าตีบวกของการ์ดรายใบห่างจากค่ากลางของทีมได้มากสุดเท่านี้ */
const PLUS_SPREAD = 2;

/**
 * เลือกนักเตะหนึ่งคนให้ช่องนั้น
 *
 * คัดจากคนที่เล่นตำแหน่งนั้นได้ก่อน (รวมตำแหน่งสำรอง) แล้วเรียงตามความใกล้เคียง
 * กับค่าพลังเป้าหมาย จากนั้นสุ่มหยิบจากกลุ่มหัวแถว — ไม่หยิบคนที่ใกล้ที่สุดตรง ๆ
 * เพราะจะได้ทีมหน้าตาเหมือนกันหมดทั้งเซิร์ฟเวอร์
 */
const pickForSlot = (
  position: string,
  target: number,
  random: () => number,
  used: Set<string>,
  allowed: Player[],
): string | null => {
  const fits = allowed.filter(
    (player) =>
      !used.has(player.id) &&
      (player.position === position || player.altPositions?.includes(position as never)),
  );

  // ไม่มีใครเล่นตำแหน่งนี้ได้เลย → ยอมใช้ใครก็ได้ที่ยังว่าง ดีกว่าปล่อยช่องโหว่
  const pool = fits.length ? fits : allowed.filter((player) => !used.has(player.id));
  if (!pool.length) return null;

  const ranked = [...pool].sort(
    (a, b) => Math.abs(a.ovr - target) - Math.abs(b.ovr - target) || a.id.localeCompare(b.id),
  );
  const shortlist = ranked.slice(0, Math.min(6, ranked.length));
  const chosen = shortlist[Math.floor(random() * shortlist.length)];

  used.add(chosen.id);
  return chosen.id;
};

/**
 * คลังการ์ดที่ทีมจำลองหยิบได้ ตามที่แอดมินตั้งไว้
 *
 * กรองสองชั้น: ช่วงค่าพลังที่อนุญาต และรายชื่อการ์ดต้องห้าม
 * (ใช้กันการ์ดหายากหรือใบที่ตั้งใจให้เป็นของผู้เล่นจริงเท่านั้นไม่ให้โผล่ในทีมบอท)
 *
 * ถ้ากรองจนไม่เหลือใครเลย ให้ถอยกลับไปใช้ทั้งคลัง — ทีมที่มีช่องว่าง 11 ช่อง
 * แย่กว่าทีมที่ค่าตั้งไม่ตรงใจ และผู้เล่นจะเห็นทีมพังทั้งเซิร์ฟเวอร์ทันที
 */
export const botCardPool = (config: BotConfig): Player[] => {
  const banned = new Set(config.bannedPlayerIds);
  const allowed = PLAYERS.filter(
    (player) =>
      !banned.has(player.id) &&
      player.ovr >= config.cardOvrMin &&
      player.ovr <= config.cardOvrMax,
  );

  return allowed.length >= 11 ? allowed : PLAYERS;
};

/**
 * ค่าตีบวกของการ์ดใบหนึ่ง — กระจายรอบค่ากลางของทีม
 *
 * ทีมจริงไม่มีใครตีบวกเท่ากันครบ 11 ใบ ใบที่รักมากจะถูกดันไปไกลกว่าใบอื่น
 * บีบให้อยู่ในช่วงที่แอดมินอนุญาตเสมอ
 */
const cardPlus = (teamPlus: number, random: () => number, config: BotConfig): number => {
  if (!config.plusRandom) return teamPlus;

  const drift = Math.round((random() - 0.5) * 2 * PLUS_SPREAD);
  return clamp(teamPlus + drift, config.plusMin, config.plusMax);
};

/**
 * ตัวจริง 11 คนของทีมจำลอง
 *
 * ค่า level ของทุกใบ = ค่าตีบวกของทีม +1 (level 1 คือ +0) ทีมที่แอดมินตั้งให้ +5
 * จึงเห็นการ์ด +5 ทั้งชุดจริง ๆ ตรงกับค่าพลังที่บวกเพิ่มไปในตาราง
 */
export const botSquadSlots = (
  bot: BotSeed,
  state: BotState,
  config: BotConfig,
): PublicSquadSlot[] => {
  const formation = getFormationById(botFormationId(bot));
  const random = botRng(bot.seed ^ 0x1b873593);
  const used = new Set<string>();
  const allowed = botCardPool(config);

  /*
   * ค่าพลังการ์ดเป้าหมาย
   *   - แอดมินกำหนดมาเอง (cardOvr) → ใช้ค่านั้นตรง ๆ
   *   - ไม่ได้กำหนด → ถอดโบนัสตีบวกออกจากค่าพลังทีม เพราะการ์ดจะไปบวกเพิ่มเองในหน้าจอ
   */
  const target = bot.cardOvr ?? state.ovr - bot.plus * 2;

  /*
   * เดินทีละช่องแล้วหักลบยอดที่เหลือทุกครั้ง (ไม่ใช่เล็งค่าเดียวกันทั้ง 11 ช่อง)
   *
   * จำเป็นเพราะคลังการ์ดไม่ได้มีทุกตำแหน่งที่ทุกค่าพลัง — บางช่องถูกบังคับให้ได้ใบ
   * ที่แรงเกินเป้า วิธีนี้จะดึงเป้าของช่องที่เหลือลงมาชดเชยเอง ค่าเฉลี่ยสุดท้าย
   * จึงยังเกาะ OVR ที่โชว์ในตารางอยู่ แทนที่จะบวมขึ้นเรื่อย ๆ ทั้งทีม
   */
  let remaining = target * formation.slots.length;
  let slotsLeft = formation.slots.length;

  return formation.slots
    .map((slot) => {
      const slotTarget = remaining / slotsLeft + (random() - 0.5) * SLOT_SPREAD;
      const playerId = pickForSlot(slot.position, slotTarget, random, used, allowed);

      slotsLeft -= 1;
      if (playerId) remaining -= allowed.find((player) => player.id === playerId)?.ovr ?? target;

      // level 1 = +0 จึงต้อง +1 เสมอตอนแปลงค่าตีบวกเป็นเลเวลการ์ด
      return playerId
        ? { slotId: slot.id, playerId, level: cardPlus(bot.plus, random, config) + 1 }
        : null;
    })
    .filter((slot): slot is PublicSquadSlot => slot !== null);
};

/**
 * โปรไฟล์สาธารณะปลอมของทีมจำลอง
 *
 * รูปร่างเหมือนของผู้เล่นจริงทุกอย่าง หน้าจอที่มีอยู่แล้ว (SquadPreviewModal)
 * จึงใช้ได้ทันทีโดยไม่ต้องแก้อะไรเลย
 */
export const botPublicProfile = (
  bot: BotSeed,
  state: BotState,
  config: BotConfig,
): PublicProfile => ({
  uid: bot.id,
  managerName: bot.managerName,
  teamName: bot.teamName,
  teamOvr: state.ovr,
  formationId: botFormationId(bot),
  points: state.points,
  wins: state.wins,
  draws: state.draws,
  losses: state.losses,
  passXp: 0,
  squad: botSquadSlots(bot, state, config),
  updatedAtMs: Date.now(),
});

/** หาทีมจำลองจาก id แล้วปั้นโปรไฟล์ให้ (null = ไม่มีทีมนี้ หรือระบบถูกปิด) */
export const botProfileById = (
  id: string,
  tick: number,
  config: BotConfig,
): PublicProfile | null => {
  const bot = botRoster(config).find((entry) => entry.id === id);
  return bot ? botPublicProfile(bot, botStateAt(bot, tick, config), config) : null;
};

/** แปลงทีมจำลองเป็นคู่แข่งในระบบจับคู่ */
export const botOpponent = (bot: BotSeed, state: BotState, myOvr: number): Opponent => {
  const gap = state.ovr - myOvr;

  return {
    id: bot.id,
    name: bot.teamName,
    manager: bot.managerName,
    ovr: state.ovr,
    formationId: botFormationId(bot),
    difficulty: difficultyFromGap(gap),
    rewardCoins: rewardForOpponent(state.ovr, gap),
    isBot: true,
  };
};

/**
 * ทีมจำลองทั้งหมดที่ลงระบบจับคู่ได้
 *
 * คืนลิสต์ว่างเมื่อแอดมินปิดระบบหรือปิดเฉพาะการจับคู่ — ตารางอันดับกับระบบจับคู่
 * เปิด/ปิดแยกกันได้ เพราะบางเซิร์ฟเวอร์อยากให้ตารางดูมีคนแต่ยังอยากให้แข่งกับคนจริงเท่านั้น
 */
export const botOpponentPool = (config: BotConfig, tick: number, myOvr: number): Opponent[] => {
  if (!config.enabled || !config.matchmaking) return [];

  return botRoster(config)
    .filter((bot) => !bot.hidden)
    .map((bot) => botOpponent(bot, botStateAt(bot, tick, config), myOvr));
};
