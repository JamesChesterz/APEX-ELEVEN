/**
 * ═══════════════════════════════════════════════════════════════
 *  APEX ELEVEN — ฝั่งเซิร์ฟเวอร์ (Cloud Functions)
 * ═══════════════════════════════════════════════════════════════
 *
 * ทำไมต้องมี: เดิมเครื่องผู้เล่นเป็นคนสุ่มผลแมตช์แล้วเขียนดาวลงฐานข้อมูลเอง
 * ใครเปิด DevTools ก็ยัดดาวได้ตามใจ กฎ Firestore ได้แค่ "จำกัดความเร็ว" เท่านั้น
 *
 * ตอนนี้ย้ายการตัดสินผลมาไว้ที่นี่ทั้งหมด:
 *   เครื่องผู้เล่นทำได้อย่างเดียวคือ "ขอลงแข่งหนึ่งนัด"
 *   เซิร์ฟเวอร์เป็นคนคำนวณค่าพลังทีมจากคลังการ์ดจริง สุ่มผล แล้วบวกดาวให้เอง
 *   ผลที่ได้ถูกส่งกลับไปให้หน้าเว็บ "เล่นเทป" ถ่ายทอดสดเท่านั้น
 *
 * คู่กับ firestore.rules ที่ล็อกไม่ให้เครื่องผู้เล่นแก้ดาวได้เลย
 * (ดูหัวข้อ "ดาวเป็นของเซิร์ฟเวอร์" ในไฟล์นั้น) — สองอย่างนี้ต้องมาคู่กันเสมอ
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import {
  getScorerPool,
  getServerRating,
  isSquadComplete,
  matchCooldownLeft,
} from './gameplay';
import {
  isValidRequestId,
  resolveUpgrade,
  type UpgradeRequestRecord,
  type UpgradeResult,
} from './upgrade';
import { resolveMarketPurchase, type MarketPurchaseRecord } from './market';
import { normalizeCardCash } from '@/services/cardCash';
import {
  buildFeaturedListing,
  buildNpcListings,
  getFeaturedDayKey,
  getMarketWindowEnd,
  getMarketWindowIndex,
  isListingLive,
  planMarketRefill,
} from '@/services/market';
import { setPlayerOverrides, type PlayerOverride } from '@/services/playerAttributes';
import { getShopProtectedCards, normalizeRankRewards } from '@/services/rankRewards';
import type { CardCashConfig } from '@/types/cardCash';
import type { MarketListing, MarketPurchaseResult } from '@/types/market';
import {
  addResultToDaily,
  buildDailyStandings,
  buildLeagueMembers,
  createLeagueState,
  EMPTY_DAILY,
  getDailyReward,
  getDayKey,
  getDayStart,
  getRoundIndex,
  getRoundRival,
  getRoundsBetween,
  memberToOpponent,
  type DailySummary,
  type LeagueMember,
} from '@/services/league';
import { difficultyFromGap, rewardForOpponent, simulateMatch } from '@/services/matchmaking';
import { buildScorerPool } from '@/services/scorers';
import { isOnCooldown, rememberRival, RIVAL_COOLDOWN_MS } from '@/services/rivals';
import type { PublicSquadSlot } from '@/types/profile';
import type { AccountState, LeagueState } from '@/types/account';
import type { CardInstance } from '@/types/card';
import { setUpgradeSteps, type UpgradeStep } from '@/data/upgradeConfig';
import type { MatchResult, Opponent } from '@/types/match';

initializeApp();

const db = getFirestore();

/**
 * ให้ทำงานใกล้ผู้เล่นที่สุด (สิงคโปร์คือภูมิภาคที่ใกล้ไทยที่สุดของ Cloud Functions)
 * maxInstances คุมไม่ให้ค่าใช้จ่ายบานปลายถ้ามีคนยิงถล่ม
 */
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

/* ── ตัวช่วย ───────────────────────────────────────────────── */

/** อ่าน uid ของคนที่เรียก ไม่ได้ล็อกอิน = ปฏิเสธทันที */
const requireUid = (auth: { uid?: string } | undefined): string => {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'ต้องเข้าสู่ระบบก่อน');
  return auth.uid;
};

/** โปรไฟล์สาธารณะเท่าที่เซิร์ฟเวอร์ต้องใช้ */
interface ProfileLite {
  uid: string;
  teamName?: string;
  managerName?: string;
  teamOvr?: number;
  formationId?: string;
  points?: number;
  /** ตัวจริง 11 คนของเขา — ใช้ดึงชื่อคนยิงจริงมาทำไทม์ไลน์ */
  squad?: PublicSquadSlot[];
}

/* ── ลงแข่งหนึ่งนัด ────────────────────────────────────────── */

/**
 * playMatch — เซิร์ฟเวอร์ตัดสินผลแมตช์และแจกดาว
 *
 * เครื่องผู้เล่นส่งมาได้อย่างเดียวคือ "อยากเจอ uid ไหน"
 * ทุกตัวเลขที่มีผลกับแพ้ชนะถูกอ่านจากฐานข้อมูลฝั่งเซิร์ฟเวอร์เองทั้งหมด
 *
 * ด่านที่ต้องผ่านก่อนได้ดาว:
 *   1. ล็อกอินจริง
 *   2. จัดตัวครบ 11 คน โดยการ์ดต้องมีอยู่จริงในคลัง
 *   3. ไม่ยิงถี่เกิน (คูลดาวน์ 15 วินาที — เร็วกว่าเวลาถ่ายทอดสดหนึ่งนัดไม่ได้)
 *   4. ไม่ท้าคนเดิมซ้ำภายในเวลาที่กำหนด (กันจับคู่กันปั้มดาว)
 *   5. ไม่ท้าตัวเอง
 */
export const playMatch = onCall<{ opponentUid?: string }>(async (request) => {
  const uid = requireUid(request.auth);
  const opponentUid = String(request.data?.opponentUid ?? '');

  if (!opponentUid) throw new HttpsError('invalid-argument', 'ไม่ได้ระบุคู่แข่ง');
  if (opponentUid === uid) throw new HttpsError('failed-precondition', 'ท้าตัวเองไม่ได้');

  const accountRef = db.collection('accounts').doc(uid);
  const profileRef = db.collection('profiles').doc(uid);
  const rivalProfileRef = db.collection('profiles').doc(opponentUid);

  const [accountSnap, rivalSnap] = await Promise.all([accountRef.get(), rivalProfileRef.get()]);

  if (!accountSnap.exists) throw new HttpsError('not-found', 'ไม่พบบัญชีของคุณ');
  if (!rivalSnap.exists) throw new HttpsError('not-found', 'ไม่พบทีมคู่แข่ง');

  const account = accountSnap.data() as { state?: AccountState; teamName?: string; managerName?: string };
  const state = account.state;
  if (!state) throw new HttpsError('failed-precondition', 'บัญชียังไม่มีข้อมูลเกม');

  // ── ด่านที่ 2: จัดตัวครบไหม ──
  if (!isSquadComplete(state)) {
    throw new HttpsError('failed-precondition', 'จัดตัวจริงให้ครบ 11 คนก่อนลงแข่ง');
  }

  const now = Date.now();

  // ── ด่านที่ 3: คูลดาวน์รายนัด ──
  const wait = matchCooldownLeft((state as { lastMatchAt?: string }).lastMatchAt, now);
  if (wait > 0) {
    throw new HttpsError(
      'resource-exhausted',
      `รออีก ${Math.ceil(wait / 1000)} วินาทีก่อนลงแข่งนัดถัดไป`,
    );
  }

  // ── ด่านที่ 4: คูลดาวน์รายคู่แข่ง ──
  const recentRivals = Array.isArray(state.recentRivals) ? state.recentRivals : [];
  if (isOnCooldown(recentRivals, opponentUid, now)) {
    throw new HttpsError(
      'resource-exhausted',
      `เพิ่งเจอทีมนี้ไป รออีกสักพักค่อยท้าใหม่ (คูลดาวน์ ${Math.round(RIVAL_COOLDOWN_MS / 60000)} นาที)`,
    );
  }

  // ── ตัดสินผล ──
  const rival = rivalSnap.data() as ProfileLite;
  const rating = getServerRating(state);
  const rivalOvr = Math.max(1, Math.round(Number(rival.teamOvr) || 1));
  const gap = rivalOvr - rating.matchOvr;

  const opponent: Opponent = {
    id: opponentUid,
    name: rival.teamName ?? 'Unknown FC',
    manager: rival.managerName ?? 'ผู้จัดการ',
    ovr: rivalOvr,
    formationId: (rival.formationId as Opponent['formationId']) ?? '4-3-3',
    difficulty: difficultyFromGap(gap),
    rewardCoins: rewardForOpponent(rivalOvr, gap),
    isBot: false,
  };

  /*
   * ไทม์ไลน์ต้องใช้ชื่อจริงของทั้งสองฝั่ง เพราะใบรายงานถูกส่งไปให้อีกฝ่ายดูด้วย
   * ถ้าใช้ชื่อสมมติ ฝ่ายที่โดนท้าจะเห็นคนที่ไม่มีอยู่ในทีมตัวเองเป็นคนยิงประตูให้
   */
  const result: MatchResult = simulateMatch(
    rating.matchOvr,
    opponent,
    getScorerPool(state),
    buildScorerPool(opponent.formationId, rival.squad),
  );

  // ── บันทึกผล ──
  const record = state.record ?? { points: 0, wins: 0, draws: 0, losses: 0 };
  const nextRecord = {
    // ดาวไม่ติดลบ ต่อให้แพ้รวดจนคะแนนจะต่ำกว่าศูนย์
    points: Math.max(0, record.points + result.rankingPoints),
    wins: record.wins + (result.outcome === 'win' ? 1 : 0),
    draws: record.draws + (result.outcome === 'draw' ? 1 : 0),
    losses: record.losses + (result.outcome === 'loss' ? 1 : 0),
  };

  /*
   * เซิร์ฟเวอร์เขียนเฉพาะของที่ตัวเองเป็นเจ้าของ (ดาว + ด่านกันโกง)
   * เหรียญ/แต้ม/ประวัติยังเป็นของเครื่องผู้เล่นในขั้นนี้ จึงส่งกลับไปให้บวกเอง
   * ถ้าเซิร์ฟเวอร์เขียนด้วยจะชนกับเซฟที่เครื่องผู้เล่นทยอยเขียนอยู่แล้ว
   */
  await accountRef.update({
    'state.record': nextRecord,
    'state.recentRivals': rememberRival(recentRivals, opponentUid, now),
    'state.lastMatchAt': new Date(now).toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await profileRef.set(
    {
      uid,
      points: nextRecord.points,
      wins: nextRecord.wins,
      draws: nextRecord.draws,
      losses: nextRecord.losses,
      teamOvr: rating.matchOvr,
      pointsUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  /*
   * ใบรายงานผลไปหาอีกฝ่าย — เขียนจากเซิร์ฟเวอร์จึงเชื่อถือได้เต็มร้อย
   * (เดิมเครื่องผู้ท้าเป็นคนเขียน แปลว่าปลอมสกอร์ให้คู่แข่งแพ้ได้)
   */
  await db.collection('matchInbox').doc(opponentUid).collection('items').doc(result.id).set({
    id: result.id,
    fromUid: uid,
    fromTeamName: account.teamName ?? 'Unknown FC',
    fromManagerName: account.managerName ?? 'ผู้จัดการ',
    fromTeamOvr: rating.matchOvr,
    toTeamOvr: rivalOvr,
    teamScore: result.opponentScore,
    opponentScore: result.teamScore,
    events: result.events.map((event) => ({
      ...event,
      side: event.side === 'team' ? 'opponent' : 'team',
    })),
    playedAt: result.playedAt,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { result, record: nextRecord, teamOvr: rating.matchOvr };
});

/* ── ตีบวกการ์ด (PHASE 13) ─────────────────────────────────── */

/**
 * upgradeCard — เซิร์ฟเวอร์เป็นคนตัดสินว่าตีบวกติดหรือไม่ติด
 *
 * เครื่องผู้เล่นส่งมาได้แค่สองอย่าง: cardId กับ requestId
 * ห้ามส่ง success / newUpgrade / newOvr / coinsSpent มาเด็ดขาด —
 * ต่อให้ส่งมาก็ถูกเมิน เพราะฟังก์ชันนี้อ่านทุกอย่างจากเอกสารบัญชีเองทั้งหมด
 *
 * กันกดรัว/ยิงซ้ำ/เน็ตหลุดแล้วยิงใหม่ ด้วยสองชั้น:
 *   1. Firestore transaction — อ่านและเขียนบัญชีในรายการเดียว ชนกันไม่ได้
 *   2. requestId — จดไว้ที่ accounts/{uid}/upgradeRequests/{requestId}
 *      คำขอรหัสเดิมยิงมาอีกกี่ครั้งก็คืนผลใบเดิม ไม่หักเงินซ้ำและไม่สุ่มใหม่
 */
export const upgradeCard = onCall<{
  cardId?: string;
  requestId?: string;
  /** id ของการ์ดที่ใส่มาช่วยเพิ่มโอกาสสำเร็จ (สูงสุด 3 ใบ) */
  materialCardIds?: string[];
  /** true = ขอติดการ์ดป้องกัน */
  useProtect?: boolean;
}>(async (request) => {
  const uid = requireUid(request.auth);
  const cardId = String(request.data?.cardId ?? '');
  const requestId = request.data?.requestId;
  const materialCardIds = Array.isArray(request.data?.materialCardIds)
    ? request.data.materialCardIds.map((entry) => String(entry))
    : [];
  const useProtect = request.data?.useProtect === true;

  if (!cardId) throw new HttpsError('invalid-argument', 'ไม่ได้ระบุการ์ด');
  if (!isValidRequestId(requestId)) {
    throw new HttpsError('invalid-argument', 'รหัสคำขอไม่ถูกต้อง');
  }

  /*
   * ตารางตีบวกที่แอดมินตั้งไว้ต้องถูกใช้ที่เซิร์ฟเวอร์ด้วย ไม่งั้นแอดมินแก้ราคาแล้ว
   * หน้าเว็บโชว์เลขใหม่ แต่เซิร์ฟเวอร์ยังหักเลขเก่า
   * ตารางที่ไม่ผ่านการตรวจถูกปฏิเสธเองใน setUpgradeSteps แล้วถอยไปใช้ค่าในโค้ด
   */
  const configSnap = await db.collection('config').doc('upgradeConfig').get();
  const configuredSteps = configSnap.exists
    ? (configSnap.data() as { steps?: UpgradeStep[] }).steps ?? null
    : null;
  setUpgradeSteps(Array.isArray(configuredSteps) ? configuredSteps : null);

  const accountRef = db.collection('accounts').doc(uid);
  const requestRef = accountRef.collection('upgradeRequests').doc(requestId);

  const outcome = await db.runTransaction(async (tx) => {
    const [accountSnap, requestSnap] = await Promise.all([tx.get(accountRef), tx.get(requestRef)]);

    // ── ชั้นกันคำขอซ้ำ: เคยทำไปแล้วก็คืนผลใบเดิม ไม่ทำรายการใหม่ ──
    if (requestSnap.exists) {
      const record = requestSnap.data() as UpgradeRequestRecord;
      return { result: record.result, replayed: true as const };
    }

    if (!accountSnap.exists) throw new HttpsError('not-found', 'ไม่พบบัญชีของคุณ');

    const state = (accountSnap.data() as { state?: AccountState }).state;
    if (!state) throw new HttpsError('failed-precondition', 'บัญชียังไม่มีข้อมูลเกม');

    const cards: CardInstance[] = Array.isArray(state.cards) ? state.cards : [];
    const card = cards.find((entry) => entry.id === cardId);

    /*
     * การ์ดช่วยถูกหาจากคลังจริงเสมอ — เครื่องผู้เล่นส่งมาได้แค่ id
     * id ที่ไม่มีอยู่จริงจะกลายเป็น undefined แล้วโดน resolveUpgrade ปฏิเสธ
     */
    const materialCards = materialCardIds.map(
      (id) => cards.find((entry) => entry.id === id) as CardInstance,
    );

    const resolved = resolveUpgrade({
      card,
      requesterId: uid,
      coins: Number(state.coins) || 0,
      materials: Number(state.upgradePoints) || 0,
      materialCards,
      useProtect,
      protectCards: Number(state.protectCards) || 0,
      // สุ่มที่เซิร์ฟเวอร์เท่านั้น เครื่องผู้เล่นไม่มีทางแตะค่านี้ได้
      roll: Math.random(),
    });

    if (!resolved.ok) {
      const code =
        resolved.reason === 'card-not-found' || resolved.reason === 'player-not-found'
          ? 'not-found'
          : resolved.reason === 'wrong-owner'
            ? 'permission-denied'
            : 'failed-precondition';
      throw new HttpsError(code, resolved.message);
    }

    // การ์ดช่วยหายจากคลังทุกกรณี ทั้งติดและไม่ติด
    const burned = new Set(resolved.result.consumedCardIds);
    const nextCards = cards
      .filter((entry) => !burned.has(entry.id))
      .map((entry) => (entry.id === cardId ? resolved.nextCard : entry));
    const at = new Date().toISOString();

    tx.update(accountRef, {
      'state.cards': nextCards,
      'state.coins': resolved.coinsLeft,
      'state.upgradePoints': resolved.materialsLeft,
      'state.protectCards': resolved.protectCardsLeft,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const record: UpgradeRequestRecord = {
      requestId,
      cardId,
      result: resolved.result,
      at,
    };
    tx.set(requestRef, { ...record, createdAt: FieldValue.serverTimestamp() });

    return {
      result: resolved.result,
      replayed: false as const,
      coins: resolved.coinsLeft,
      upgradePoints: resolved.materialsLeft,
      protectCards: resolved.protectCardsLeft,
      card: resolved.nextCard,
      consumedCardIds: resolved.result.consumedCardIds,
    };
  });

  return outcome as {
    result: UpgradeResult;
    replayed: boolean;
    coins?: number;
    upgradePoints?: number;
    protectCards?: number;
    card?: CardInstance;
    consumedCardIds?: string[];
  };
});

/* ── สถานะสุขภาพ ──────────────────────────────────────────── */

/** ping — ไว้เช็คว่า deploy สำเร็จและหน้าเว็บเรียกฟังก์ชันได้จริง */
export const ping = onCall(() => ({ ok: true, at: new Date().toISOString() }));

/* ── ลีกประจำวัน ───────────────────────────────────────────── */

/** อ่านผู้เล่นคนอื่นมาจัดลีก — เอาเท่าที่จำเป็น ไม่ต้องโหลดทั้งฐานข้อมูล */
const LEAGUE_POOL_LIMIT = 300;

/**
 * setLeagueJoined — เข้าร่วม/ออกจากลีก
 *
 * สถานะลีกเป็นของเซิร์ฟเวอร์แล้ว (เพราะลีกเป็นตัวแจกดาว) เครื่องผู้เล่นจึงแก้เองไม่ได้
 * ต้องขอผ่านทางนี้ทางเดียว
 */
export const setLeagueJoined = onCall<{ joined?: boolean }>(async (request) => {
  const uid = requireUid(request.auth);
  const joined = Boolean(request.data?.joined);

  const accountRef = db.collection('accounts').doc(uid);
  const snap = await accountRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'ไม่พบบัญชีของคุณ');

  const state = (snap.data() as { state?: AccountState }).state;
  if (!state) throw new HttpsError('failed-precondition', 'บัญชียังไม่มีข้อมูลเกม');

  const now = new Date();
  const league: LeagueState = state.league ?? createLeagueState(now);

  const next: LeagueState = joined
    ? {
        ...league,
        joined: true,
        joinedAt: now.toISOString(),
        // เข้าร่วมกลางวัน = เริ่มนับรอบจากตอนนี้ ไม่ย้อนไปคิดรอบที่ยังไม่ได้เข้าร่วม
        lastRoundAt: now.toISOString(),
        dayStartedAt: getDayStart(now).toISOString(),
      }
    : { ...league, joined: false };

  await accountRef.update({
    'state.league': next,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { league: next };
});

/**
 * syncLeague — เดินรอบลีกที่ค้างอยู่ทั้งหมดจนถึงตอนนี้ แล้วบวกดาวให้
 *
 * นี่คือช่องที่ใหญ่กว่า Matchmaking เพราะลีกเดินเองทุก 30 นาทีตลอดวัน
 * เดิมเครื่องผู้เล่นเป็นคนคิดผลแล้วบวกดาวเอง = โกงได้เต็มที่
 *
 * ตอนนี้เซิร์ฟเวอร์เป็นคนตัดสินทั้งหมด และ "เวลา" ก็อ่านจากนาฬิกาเซิร์ฟเวอร์
 * ปรับนาฬิกาเครื่องตัวเองให้เดินเร็วเพื่อรีดรอบเพิ่มจึงไม่ได้ผล
 *
 * เหรียญ/ประวัติการแข่ง/สรุปรางวัลปลายวัน ส่งกลับไปให้เครื่องผู้เล่นจัดการต่อ
 * (ยังเป็นของเครื่องผู้เล่นในขั้นนี้ — ดูขั้นที่ 2 ใน UPDATE-NOTES.md)
 */
export const syncLeague = onCall(async (request) => {
  const uid = requireUid(request.auth);

  const accountRef = db.collection('accounts').doc(uid);
  const snap = await accountRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'ไม่พบบัญชีของคุณ');

  const account = snap.data() as { state?: AccountState; teamName?: string; managerName?: string };
  const state = account.state;
  if (!state) throw new HttpsError('failed-precondition', 'บัญชียังไม่มีข้อมูลเกม');

  const league = state.league;
  // ยังไม่ได้เข้าร่วม = ไม่มีอะไรให้คิด (ไม่ถือว่าผิดพลาด)
  if (!league?.joined) return { skipped: true as const };

  const now = new Date();
  const rating = getServerRating(state);
  const record = state.record ?? { points: 0, wins: 0, draws: 0, losses: 0 };

  let current: LeagueState = league;
  let summary: DailySummary | null = null;

  /* ── ข้ามวันแล้ว: ปิดยอดของเมื่อวานก่อน ── */
  const today = getDayStart(now);
  const storedDay = new Date(current.dayStartedAt);

  if (today.getTime() > storedDay.getTime()) {
    const played = current.daily.wins + current.daily.draws + current.daily.losses;

    if (played > 0) {
      const yesterday = await buildMembers(uid, account, rating.matchOvr);
      const standings = buildDailyStandings(
        yesterday,
        uid,
        current.daily,
        getDayKey(storedDay),
        played,
      );
      const rank = standings.find((row) => row.isCurrentUser)?.rank ?? standings.length;

      summary = {
        dayStartedAt: current.dayStartedAt,
        rank,
        totalTeams: standings.length,
        daily: current.daily,
        reward: getDailyReward(rank),
      };
    }

    current = {
      ...current,
      dayStartedAt: today.toISOString(),
      lastRoundAt: today.toISOString(),
      daily: { ...EMPTY_DAILY },
    };
  }

  /* ── แข่งรอบที่ผ่านไปแล้วแต่ยังไม่ได้คิด ── */
  const since = new Date(current.lastRoundAt ?? current.joinedAt ?? current.dayStartedAt);
  const rounds = getRoundsBetween(since, now);

  if (rounds.length === 0) {
    // ไม่มีรอบใหม่ แต่ถ้าเพิ่งข้ามวันก็ต้องเขียนสถานะที่รีเซ็ตแล้วลงไปด้วย
    if (current !== league) {
      await accountRef.update({ 'state.league': current, updatedAt: FieldValue.serverTimestamp() });
    }
    return { league: current, summary, matches: [], record, coinsEarned: 0 };
  }

  const members = await buildMembers(uid, account, rating.matchOvr);
  const scorers = getScorerPool(state);

  const matches: MatchResult[] = [];
  let daily = current.daily;
  let coinsEarned = 0;
  let points = record.points;
  let wins = record.wins;
  let draws = record.draws;
  let losses = record.losses;

  rounds.forEach((roundAt) => {
    const rival = getRoundRival(members, uid, getRoundIndex(roundAt));
    if (!rival) return;

    const opponent = memberToOpponent(rival, rating.matchOvr);
    const result = simulateMatch(
      rating.matchOvr,
      opponent,
      scorers,
      buildScorerPool(rival.formationId, squadByUid.get(rival.id)),
    );
    const leaguePoints =
      result.teamScore > result.opponentScore ? 3 : result.teamScore === result.opponentScore ? 1 : 0;

    matches.unshift({ ...result, mode: 'league', leaguePoints, playedAt: roundAt.toISOString() });

    daily = addResultToDaily(daily, result.teamScore, result.opponentScore);
    coinsEarned += result.coinsEarned;
    points = Math.max(0, points + result.rankingPoints);
    if (result.outcome === 'win') wins += 1;
    else if (result.outcome === 'draw') draws += 1;
    else losses += 1;
  });

  // ทุกรอบถูกข้าม (ลีกยังไม่มีคู่แข่ง) — ไม่ต้องเขียนอะไร รอรอบหน้า
  if (matches.length === 0) {
    return { league: current, summary, matches: [], record, coinsEarned: 0 };
  }

  const nextLeague: LeagueState = {
    ...current,
    lastRoundAt: rounds[rounds.length - 1].toISOString(),
    daily,
  };
  const nextRecord = { points, wins, draws, losses };

  await accountRef.update({
    'state.league': nextLeague,
    'state.record': nextRecord,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection('profiles').doc(uid).set(
    {
      uid,
      points: nextRecord.points,
      wins: nextRecord.wins,
      draws: nextRecord.draws,
      losses: nextRecord.losses,
      teamOvr: rating.matchOvr,
      pointsUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { league: nextLeague, summary, matches, record: nextRecord, coinsEarned };
});

/**
 * คัดสมาชิกลีก 10 คนที่ค่าพลังใกล้เคียงเราที่สุด จากผู้เล่นจริงบนเซิร์ฟเวอร์
 * ใช้ตรรกะชุดเดียวกับหน้าเว็บ (buildLeagueMembers) เพื่อให้ตารางอันดับตรงกัน
 */
const squadByUid = new Map<string, PublicSquadSlot[]>();

const buildMembers = async (
  uid: string,
  account: { teamName?: string; managerName?: string },
  myOvr: number,
): Promise<LeagueMember[]> => {
  const snapshot = await db
    .collection('profiles')
    .orderBy('teamOvr', 'desc')
    .limit(LEAGUE_POOL_LIMIT)
    .get();

  const others: LeagueMember[] = snapshot.docs
    .filter((entry) => entry.id !== uid)
    .map((entry) => {
      const profile = entry.data() as ProfileLite & { avatar?: string };
      // เก็บตัวจริงของเขาไว้ใช้ทำไทม์ไลน์ตอนแข่งรอบนี้
      squadByUid.set(entry.id, Array.isArray(profile.squad) ? profile.squad : []);

      return {
        id: entry.id,
        teamName: profile.teamName ?? 'Unknown FC',
        managerName: profile.managerName ?? 'ผู้จัดการ',
        ovr: Math.max(1, Math.round(Number(profile.teamOvr) || 1)),
        formationId: (profile.formationId as LeagueMember['formationId']) ?? '4-3-3',
        isReal: true,
      };
    })
    .filter((member) => member.ovr > 0);

  const me: LeagueMember = {
    id: uid,
    teamName: account.teamName ?? 'Unknown FC',
    managerName: account.managerName ?? 'ผู้จัดการ',
    ovr: myOvr,
    formationId: '4-3-3',
    isReal: true,
  };

  return buildLeagueMembers(me, others);
};

/* ══════════════════════════════════════════════════════════════
 *  TRANSFER MARKET (NPC) — ตลาดซื้อขายนักเตะ
 * ══════════════════════════════════════════════════════════════
 *
 * ทำไมทุกอย่างต้องอยู่ที่นี่:
 *   • ถ้าเครื่องผู้เล่นเป็นคนสร้างประกาศเอง ก็สร้างการ์ด mythical ราคา 1 เหรียญได้
 *   • ถ้าเครื่องผู้เล่นเป็นคนหักเหรียญเอง ก็ซื้อฟรีได้
 *   • ถ้าเครื่องผู้เล่นเป็นคนเช็คเวลาหมดอายุเอง ก็ปรับนาฬิกาแล้วซื้อของหมดอายุได้
 * เครื่องผู้เล่นจึงส่งมาได้แค่ listingId กับ requestId เท่านั้น
 *
 * การเติมของใช้แบบ "lazy" — เติมตอนมีคนเปิดตลาด ไม่ต้องพึ่ง Cloud Scheduler
 * ถ้าวันหนึ่งอยากย้ายไป scheduled function ให้เรียก refreshMarket() ตัวเดิมได้เลย
 * โดยไม่ต้องแก้โครงสร้างข้อมูล
 */

const MARKET_LISTINGS = 'marketListings';
const MARKET_CONTROL = 'marketControl';

/** เว้นระยะขั้นต่ำระหว่างการตรวจเติมของสองครั้ง (กันยิงถล่มแล้วเปิด transaction รัว ๆ) */
const MARKET_CHECK_MS = 60_000;

/** เพดานจำนวนประกาศที่ดึงมาต่อครั้ง — กันเผลออ่านทั้ง collection ถ้าข้อมูลบวม */
const MARKET_QUERY_LIMIT = 80;

interface MarketControlDoc {
  lastWindow?: number;
  lastFeaturedDay?: string;
  lastCheckedAt?: number;
}

/**
 * ค่าตั้งที่มีผลกับ "ราคา" และ "ใครเข้าตลาดได้บ้าง"
 * อ่านจาก config เดียวกับที่หน้าแอดมินใช้ เพื่อไม่ให้ราคาสองที่หลุดกัน
 */
const loadMarketContext = async (): Promise<{
  cash: CardCashConfig;
  excluded: Set<string>;
}> => {
  const [cashSnap, rewardSnap, overrideSnap] = await Promise.all([
    db.collection('config').doc('cardCash').get(),
    db.collection('config').doc('rankRewards').get(),
    db.collection('config').doc('playerOverrides').get(),
  ]);

  /*
   * ค่าพลังที่แอดมินแก้ทับต้องถูกใช้ตอนตั้งราคาด้วย ไม่งั้นแอดมินดัน OVR ขึ้น
   * แล้วตลาดยังขายราคาเดิม กลายเป็นช่องซื้อของถูกทันที
   */
  const overrides = overrideSnap.exists
    ? ((overrideSnap.data() as { players?: Record<string, PlayerOverride> }).players ?? null)
    : null;
  setPlayerOverrides(overrides);

  const rewardCards = normalizeRankRewards(
    rewardSnap.exists ? ((rewardSnap.data() as { cards?: string[] }).cards ?? []) : [],
  );

  return {
    cash: normalizeCardCash(cashSnap.exists ? (cashSnap.data() as Partial<CardCashConfig>) : null),
    // การ์ดรางวัลอันดับ 1–3 ห้ามเข้าตลาด เหมือนกฎของร้านแลกด้วยแต้ม
    excluded: getShopProtectedCards(rewardCards),
  };
};

/** อ่านประกาศทั้งหมดที่ยังมีชีวิต (ACTIVE) */
const readActiveListings = async (): Promise<MarketListing[]> => {
  const snapshot = await db
    .collection(MARKET_LISTINGS)
    .where('status', '==', 'ACTIVE')
    .limit(MARKET_QUERY_LIMIT)
    .get();

  return snapshot.docs.map((entry) => entry.data() as MarketListing);
};

/**
 * เติมของให้ตลาด: ปิดใบที่หมดเวลา สร้างใบใหม่ให้ครบ และสร้างใบเด่นของวัน
 *
 * ทั้งหมดอยู่ใน transaction เดียว สองเครื่องเปิดตลาดพร้อมกันจึงไม่ได้ของซ้ำ
 * และต่อให้ชนกันจริง ข้อมูลที่สร้างก็เหมือนกันเป๊ะ เพราะสุ่มจาก seed ของรอบ
 */
const refreshMarket = async (now: Date): Promise<void> => {
  const { cash, excluded } = await loadMarketContext();
  const controlRef = db.collection(MARKET_CONTROL).doc('state');

  await db.runTransaction(async (tx) => {
    const listingsSnap = await tx.get(
      db.collection(MARKET_LISTINGS).where('status', '==', 'ACTIVE').limit(MARKET_QUERY_LIMIT),
    );
    const listings = listingsSnap.docs.map((entry) => entry.data() as MarketListing);

    const plan = planMarketRefill({ listings, now });
    const windowIndex = getMarketWindowIndex(now);

    plan.expiredIds.forEach((id) => {
      tx.update(db.collection(MARKET_LISTINGS).doc(id), {
        status: 'EXPIRED',
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const fresh = buildNpcListings({
      windowIndex,
      slots: plan.slots,
      now,
      cash,
      excluded,
    });

    if (plan.needsFeatured) {
      const featured = buildFeaturedListing({ now, cash, excluded });
      if (featured) fresh.push(featured);
    }

    fresh.forEach((listing) => {
      /*
       * merge: false โดยตั้งใจ — ถ้ามีเอกสาร id เดิมอยู่แล้ว (สร้างซ้อนกัน)
       * ข้อมูลที่เขียนทับจะเหมือนเดิมทุกฟิลด์อยู่แล้ว เพราะสุ่มจาก seed เดียวกัน
       */
      tx.set(db.collection(MARKET_LISTINGS).doc(listing.id), {
        ...listing,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    tx.set(
      controlRef,
      {
        lastWindow: windowIndex,
        lastFeaturedDay: getFeaturedDayKey(now),
        lastCheckedAt: now.getTime(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
};

/**
 * getMarketListings — ของที่ซื้อได้ตอนนี้
 *
 * ทางลัด: ถ้าเพิ่งตรวจไปไม่ถึงหนึ่งนาที และยังอยู่รอบเดิม/วันเดิม จะข้ามการเติมของ
 * เปิดตลาดจึงใช้แค่การอ่านเอกสารไม่กี่ใบ ไม่ต้องเปิด transaction ทุกครั้ง
 */
export const getMarketListings = onCall(async (request) => {
  requireUid(request.auth);

  const now = new Date();
  const controlSnap = await db.collection(MARKET_CONTROL).doc('state').get();
  const control = (controlSnap.data() as MarketControlDoc | undefined) ?? {};

  const staleWindow = control.lastWindow !== getMarketWindowIndex(now);
  const staleFeatured = control.lastFeaturedDay !== getFeaturedDayKey(now);
  const dueForCheck = now.getTime() - (control.lastCheckedAt ?? 0) >= MARKET_CHECK_MS;

  if (staleWindow || staleFeatured || dueForCheck) {
    await refreshMarket(now);
  }

  const listings = readMarketResponse(await readActiveListings(), now);

  return {
    listings,
    /** เวลาที่รอบเติมของถัดไปจะมาถึง — หน้าเว็บใช้ทำนาฬิกานับถอยหลัง */
    nextRefreshAt: getMarketWindowEnd(now).toISOString(),
    serverTime: now.toISOString(),
  };
});

/**
 * ตัดใบที่หมดเวลาออกก่อนส่งให้หน้าเว็บ (เผื่อรอบเติมของยังไม่ทันปิดสถานะให้)
 * แล้วส่งเฉพาะฟิลด์ที่หน้าตลาดใช้จริง — ฟิลด์ของเซิร์ฟเวอร์ (updatedAt) ไม่ต้องข้ามสายไป
 */
const readMarketResponse = (listings: MarketListing[], now: Date): MarketListing[] =>
  listings
    .filter((listing) => isListingLive(listing, now.getTime()))
    .map((listing) => ({
      id: listing.id,
      playerId: listing.playerId,
      sellerType: listing.sellerType,
      sellerUid: listing.sellerUid ?? null,
      price: listing.price,
      rarity: listing.rarity,
      ovr: listing.ovr,
      position: listing.position,
      status: listing.status,
      featured: listing.featured === true,
      windowIndex: listing.windowIndex,
      createdAt: listing.createdAt,
      expiresAt: listing.expiresAt,
      buyerUid: listing.buyerUid ?? null,
      soldAt: listing.soldAt ?? null,
    }));

/**
 * buyMarketListing — ซื้อนักเตะหนึ่งคนจากตลาด
 *
 * ทุกอย่างอยู่ใน transaction เดียว: ตรวจประกาศ → ตรวจเหรียญ → หักเงิน →
 * เพิ่มการ์ด → ปิดประกาศเป็น SOLD
 * สองคนกดใบเดียวกันพร้อมกัน Firestore จะให้คนหนึ่งชนะแล้วอีกคนอ่านใหม่
 * ซึ่งจะเห็นสถานะ SOLD และถูกปฏิเสธ — เป็นไปไม่ได้ที่ทั้งคู่จะได้การ์ด
 *
 * requestId ทำหน้าที่เหมือนใน upgradeCard: ยิงซ้ำรหัสเดิมได้ผลใบเดิม ไม่หักเงินซ้ำ
 */
export const buyMarketListing = onCall<{ listingId?: string; requestId?: string }>(
  async (request) => {
    const uid = requireUid(request.auth);
    const listingId = String(request.data?.listingId ?? '');
    const requestId = request.data?.requestId;

    if (!listingId) throw new HttpsError('invalid-argument', 'ไม่ได้ระบุประกาศ');
    if (!isValidRequestId(requestId)) {
      throw new HttpsError('invalid-argument', 'รหัสคำขอไม่ถูกต้อง');
    }
    if (!isValidRequestId(listingId)) {
      throw new HttpsError('invalid-argument', 'รหัสประกาศไม่ถูกต้อง');
    }

    // ค่าพลังที่แอดมินแก้ทับต้องถูกโหลดก่อน ไม่งั้นการ์ดที่ได้จะคิด OVR จากค่าดิบ
    await loadMarketContext();

    const accountRef = db.collection('accounts').doc(uid);
    const listingRef = db.collection(MARKET_LISTINGS).doc(listingId);
    const requestRef = accountRef.collection('marketPurchases').doc(requestId);

    const outcome = await db.runTransaction(async (tx) => {
      const [requestSnap, listingSnap, accountSnap] = await Promise.all([
        tx.get(requestRef),
        tx.get(listingRef),
        tx.get(accountRef),
      ]);

      // ── ชั้นกันคำขอซ้ำ: เคยทำไปแล้วก็คืนผลใบเดิม ──
      if (requestSnap.exists) {
        const record = requestSnap.data() as MarketPurchaseRecord;
        return { result: record.result, replayed: true as const };
      }

      if (!accountSnap.exists) throw new HttpsError('not-found', 'ไม่พบบัญชีของคุณ');

      const state = (accountSnap.data() as { state?: AccountState }).state;
      if (!state) throw new HttpsError('failed-precondition', 'บัญชียังไม่มีข้อมูลเกม');

      const cards: CardInstance[] = Array.isArray(state.cards) ? state.cards : [];
      const now = new Date();

      const resolved = resolveMarketPurchase({
        listing: listingSnap.exists ? (listingSnap.data() as MarketListing) : undefined,
        buyerUid: uid,
        coins: Number(state.coins) || 0,
        cardCount: cards.length,
        now,
      });

      if (!resolved.ok) {
        const code =
          resolved.reason === 'listing-not-found' || resolved.reason === 'player-not-found'
            ? 'not-found'
            : resolved.reason === 'own-listing'
              ? 'permission-denied'
              : 'failed-precondition';
        throw new HttpsError(code, resolved.message);
      }

      tx.update(listingRef, {
        status: 'SOLD',
        buyerUid: uid,
        soldAt: resolved.result.at,
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.update(accountRef, {
        'state.coins': resolved.coinsLeft,
        'state.cards': [...cards, resolved.card],
        updatedAt: FieldValue.serverTimestamp(),
      });

      const record: MarketPurchaseRecord = {
        requestId,
        listingId,
        result: resolved.result,
        at: resolved.result.at,
      };
      tx.set(requestRef, { ...record, createdAt: FieldValue.serverTimestamp() });

      return {
        result: resolved.result,
        replayed: false as const,
        coins: resolved.coinsLeft,
        card: resolved.card,
      };
    });

    return outcome as {
      result: MarketPurchaseResult;
      replayed: boolean;
      coins?: number;
      card?: CardInstance;
    };
  },
);
