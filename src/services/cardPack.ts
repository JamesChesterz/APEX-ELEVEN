/**
 * ระบบเปิดซองการ์ด
 *
 * ซองหนึ่งใบมีสองส่วน:
 *   odds  โอกาสได้แต่ละระดับ (common → mythical) รวมกันได้ 100 ต่อการ์ด 1 ใบ
 *   pool  รายชื่อนักเตะที่ใส่ไว้ในซองนั้นโดยเฉพาะ (ไม่ใส่ = สุ่มจากนักเตะทั้งเกม)
 *
 * เวลาเปิดซองจะสุ่ม rarity ก่อน แล้วค่อยสุ่มคนจาก pool ของซองในระดับนั้น
 * ทั้งไฟล์เป็น pure function — ผู้เรียก (useCardPack) เป็นคนหักเหรียญและบันทึกลงคลัง
 */
import { CARD_PACKS } from '@/data/cards';
import { PLAYERS } from '@/data/players';
import type { CardPack, PackOpenResult, PlayerCard as PlayerCardData } from '@/types/card';
import { RARITY_ORDER, type Player, type Rarity } from '@/types/player';
import { createId, pickRandom } from '@/utils/helpers';

export const getPackById = (packId: string): CardPack | undefined =>
  CARD_PACKS.find((pack) => pack.id === packId);

/** ระดับที่ซองนี้มีโอกาสออก เรียงจากดีที่สุดลงมา */
export const getPackRarities = (pack: CardPack): Rarity[] =>
  [...RARITY_ORDER].reverse().filter((rarity) => (pack.odds[rarity] ?? 0) > 0);

/**
 * นักเตะทุกคนที่ซองนี้มีโอกาสออก
 * ถ้าซองกำหนด pool ไว้ จะจำกัดอยู่แค่คนในรายชื่อนั้น
 * เรียงจาก OVR สูงไปต่ำ เพื่อให้หยิบใบเด่นไปโชว์หน้าซองได้ทันที
 */
export const getPackPlayers = (pack: CardPack): Player[] => {
  const rarities = new Set(getPackRarities(pack));
  const allowed = pack.pool ? new Set(pack.pool) : null;

  return PLAYERS.filter(
    (player) => rarities.has(player.rarity) && (!allowed || allowed.has(player.id)),
  ).sort((a, b) => b.ovr - a.ovr);
};

/**
 * ใบเด่นที่โชว์อยู่หน้าซอง = คนที่ OVR สูงที่สุดในซองนี้
 *
 * ถ้ามีหลายคน OVR เท่ากันสูงสุด จะเลือกด้วยชื่อซองเป็นตัวตั้ง (ไม่สุ่ม)
 * เพื่อให้ซองแต่ละใบในร้านโชว์คนละหน้า และหน้าซองไม่เปลี่ยนไปมาทุกครั้งที่รีเฟรช
 */
export const getPackHighlight = (pack: CardPack): Player | undefined => {
  const players = getPackPlayers(pack);
  if (players.length === 0) return undefined;

  const top = players.filter((player) => player.ovr === players[0].ovr);
  const seed = [...pack.id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973, 7);

  return top[seed % top.length];
};

/** จัดนักเตะในซองเป็นกลุ่มตามระดับ ใช้ในหน้าต่าง "ดูนักเตะในซอง" */
export const getPackPlayersByRarity = (
  pack: CardPack,
): Array<{ rarity: Rarity; chance: number; players: Player[] }> => {
  const players = getPackPlayers(pack);

  return getPackRarities(pack).map((rarity) => ({
    rarity,
    chance: pack.odds[rarity] ?? 0,
    players: players.filter((player) => player.rarity === rarity),
  }));
};

/**
 * แปลง odds เป็นข้อความสำหรับโชว์บนหน้าร้าน เช่น "rare 5% · epic 2.5%"
 * ตัด common ออกเพราะเป็นค่าที่เหลือเสมอ และตอนนี้มี 5 ระดับแล้ว บรรทัดจะยาวเกินช่อง
 */
export const formatOdds = (pack: CardPack): string =>
  (Object.entries(pack.odds) as Array<[Rarity, number]>)
    .filter(([rarity, chance]) => chance > 0 && rarity !== 'common')
    .map(([rarity, chance]) => `${rarity} ${chance}%`)
    .join(' · ');

/** โอกาสได้การ์ดระดับ mythical ของซองนี้ (0 = ซองนี้ไม่มีทางออก) */
export const getMythicalChance = (pack: CardPack): number => pack.odds.mythical ?? 0;

/** สุ่มระดับความหายากหนึ่งใบตามน้ำหนักใน odds */
export const rollRarity = (pack: CardPack): Rarity => {
  const entries = (Object.entries(pack.odds) as Array<[Rarity, number]>).filter(
    ([, chance]) => chance > 0,
  );
  const total = entries.reduce((sum, [, chance]) => sum + chance, 0);

  let ticket = Math.random() * total;
  for (const [rarity, chance] of entries) {
    ticket -= chance;
    if (ticket <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
};

/**
 * เปิดซอง: สุ่ม rarity ต่อการ์ด แล้วสุ่มคนจากนักเตะในซองระดับนั้น
 * ถ้าซองไม่มีคนในระดับที่สุ่มได้ (เช่น pool ใส่มาไม่ครบ) จะถอยไปหยิบใบใดก็ได้ในซองแทน
 *
 * @param pack      ซองที่จะเปิด
 * @param packCount จำนวนซองที่เปิดพร้อมกัน (ได้การ์ด packCount × cardCount ใบ)
 */
export const openPack = (pack: CardPack, packCount = 1): PackOpenResult => {
  const openedAt = new Date().toISOString();
  const available = getPackPlayers(pack);
  // กันกรณีตั้งค่าซองผิดจนไม่มีนักเตะเลย — ยังเปิดได้ ไม่ให้เกมค้าง
  const fallbackPool = available.length > 0 ? available : PLAYERS;

  /*
   * ซื้อทีละหลายซอง = สุ่มทีละใบเหมือนเปิดทีละซองทุกประการ
   * ไม่มีการรับประกันของดีหรือปรับโอกาสให้ต่างจากการเปิดทีละซอง
   * โอกาสของผู้เล่นจึงเท่ากันไม่ว่าจะซื้อแบบไหน
   */
  const opened = Math.max(1, Math.round(packCount));
  const total = opened * pack.cardCount;

  const cards: PlayerCardData[] = Array.from({ length: total }, () => {
    const rarity = rollRarity(pack);
    const pool = available.filter((player) => player.rarity === rarity);
    const player = pickRandom(pool.length > 0 ? pool : fallbackPool);

    return {
      id: createId('c'),
      playerId: player.id,
      acquiredAt: openedAt,
      level: 1,
      inSquad: false,
    };
  });

  return { packId: pack.id, cards, openedAt, packCount: opened };
};
