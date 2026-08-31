/**
 * คลังของผู้เล่น: การ์ด + เหรียญ + แต้มแลกนักเตะ + แต้มตีบวก + ตั๋วพาส + XP พาส + ตัวนับภารกิจรายวัน
 * เป็น Provider เพราะทั้งการจัดทีม การเปิดซอง และ Header ต้องเห็นข้อมูลชุดเดียวกัน
 *
 * ⚠️ แต้มมีสองกองแยกกันเด็ดขาด:
 *   points        = แต้มแลกนักเตะ (ย่อยการ์ด → ใช้ในร้านแลกนักเตะ)
 *   upgradePoints = แต้มตีบวก (ภารกิจ/ลีก/ชนะ Matchmaking → ใช้ตีบวกเท่านั้น)
 *
 * ค่าเริ่มต้นทั้งหมดมาจากบัญชีที่ล็อกอินอยู่ (useAuth) และทุกการเปลี่ยนแปลง
 * ถูกเขียนกลับลงบัญชีทันทีผ่าน patchState จึงไม่หายเวลารีเฟรชหน้า
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getPlayerById, PLAYERS } from '@/data/players';
import { useAuth } from '@/hooks/useAuth';
import { getSalvageValue } from '@/services/salvage';
import { playSfx } from '@/services/sound';
import { allMissionsDone, buildDailyMissions, missionCoinTotal } from '@/services/missions';
import { canLevelUp, MAX_PLUS } from '@/services/upgrade';
import { isCardLocked } from '@/services/cardInstance';
import { getBoostedSuccessRate, getUpgradeStep, MATERIAL_CARD_SLOTS } from '@/data/upgradeConfig';
import {
  canEarnMatchPoints,
  MATCH_WIN_POINTS,
  MISSION_CLEAR_POINTS,
  rollDaily,
} from '@/services/upgradePoints';
import { emptyTotals, normalizeTotals } from '@/services/passMissions';
import type { UpgradeDaily } from '@/types/account';
import type { PassTotals } from '@/types/pass';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { Mission, MatchOutcome } from '@/types/match';
import type { Player, PlayerFilter } from '@/types/player';

/** ผลของการตีบวก/รวมร่างการ์ด */
export interface CardActionResult {
  /** true = ทำรายการได้ (หักแต้มแล้ว) — ไม่ได้แปลว่าตีบวกติด */
  ok: boolean;
  /** true = ตีบวกติด, false = ล้มเหลว (แต้มหายแต่ค่าบวกเท่าเดิม) */
  success?: boolean;
  /** ค่าบวกหลังจบรายการ */
  plus?: number;
  /** แต้มตีบวกที่จ่ายไป */
  cost?: number;
  /** เหรียญที่จ่ายไป (0 = ขั้นนี้ไม่คิดเหรียญ) */
  coinCost?: number;
  /** true = ตีไม่ติดแต่การ์ดป้องกันทำงาน ค่าบวกจึงไม่ลด */
  protectUsed?: boolean;
  /** ค่าบวกที่หายไปเพราะตีไม่ติด (0 = ไม่ลด) */
  droppedLevels?: number;
  /** โอกาสสำเร็จที่ใช้ตัดสินครั้งนี้ (0–1) */
  chance?: number;
  reason?: string;
}

/** ผลของการลงแข่งหนึ่งนัด ใช้ป้อนตัวนับรายวัน */
export interface MatchReport {
  outcome: MatchOutcome;
  teamOvr: number;
  opponentOvr: number;
  /** นัดในลีกไม่ได้แต้มตีบวก มีแค่ Matchmaking ที่กดเองเท่านั้น */
  mode: 'league' | 'friendly';
}

/** การ์ดหนึ่งใบที่ resolve ข้อมูลนักเตะเรียบร้อยแล้ว */
export interface OwnedPlayerCard {
  card: PlayerCardData;
  player: Player;
}

interface InventoryContextValue {
  /** การ์ดทั้งหมดในคลัง (resolve นักเตะแล้ว) */
  ownedCards: OwnedPlayerCard[];
  /** การ์ดดิบ ใช้ตอนต้องอ้าง id อย่างเดียว */
  rawCards: PlayerCardData[];
  coins: number;
  /** แต้มสะสมจากการย่อยการ์ด */
  points: number;
  /** เพิ่มการ์ดใหม่เข้าคลัง (ใช้ตอนเปิดซอง) */
  addCards: (cards: PlayerCardData[]) => void;
  /** เอาการ์ดออกจากคลังตรง ๆ โดยไม่ได้อะไรตอบแทน (ใช้ตอนจ่ายการ์ดแลกดีลของแอดมิน) */
  removeCards: (cardIds: string[]) => void;
  /** หักเหรียญ คืน false ถ้าเงินไม่พอ */
  spendCoins: (amount: number) => boolean;
  /** เพิ่มเหรียญ (รางวัลจากการแข่ง/ภารกิจ) */
  addCoins: (amount: number) => void;
  /** ย่อยการ์ดเป็นแต้ม คืนจำนวนแต้มที่ได้รับ */
  salvageCards: (cardIds: string[]) => number;
  /** หักแต้ม (ใช้ในร้านแลกนักเตะ) คืน false ถ้าแต้มไม่พอ */
  spendPoints: (amount: number) => boolean;
  /** เพิ่มแต้ม (รางวัลปลายซีซัน) */
  addPoints: (amount: number) => void;

  /* ── FC ALLSTAR PASS ───────────────────────────────────── */
  /** XP สะสมของพาสซีซันปัจจุบัน */
  passXp: number;
  /** เพิ่ม XP พาส (ลงแข่ง Matchmaking จบหนึ่งนัด) */
  addPassXp: (amount: number) => void;
  /** ล้าง XP พาสกลับเป็นศูนย์ (ใช้ตอนขึ้นซีซันใหม่) */
  resetPassXp: () => void;
  /** ยอดสะสมตลอดชีพที่ภารกิจพาสใช้นับ (ลงแข่ง / ชนะ / เปิดแพ็ค) */
  passTotals: PassTotals;
  /** ตั๋วพาสคงเหลือ ใช้ปลดล็อกสาย PREMIUM */
  passTickets: number;
  /** เพิ่มตั๋วพาส (รางวัลจากพาสหรือของขวัญแอดมิน) */
  addPassTickets: (amount: number) => void;
  /** หักตั๋วพาส คืน false ถ้าตั๋วไม่พอ */
  spendPassTickets: (amount: number) => boolean;

  /* ── แต้มตีบวก ─────────────────────────────────────────── */
  /** แต้มตีบวกคงเหลือ */
  upgradePoints: number;
  /** เพิ่มแต้มตีบวก (ลีกประจำวัน / ภารกิจ / ชนะ Matchmaking) */
  addUpgradePoints: (amount: number) => void;
  /** ตัวนับรายวัน (รีเซ็ตเองตอน 06:00) */
  upgradeDaily: UpgradeDaily;
  /** ภารกิจประจำวันพร้อมความคืบหน้าจริง */
  missions: Mission[];
  /** true = ทำภารกิจครบทุกข้อแล้วและยังไม่ได้กดรับ */
  missionsClaimable: boolean;
  /** กดรับรางวัลภารกิจครบชุด (ได้เหรียญรวม + แต้มตีบวก) */
  claimMissions: () => boolean;
  /** บันทึกผลการแข่งลงตัวนับรายวัน คืนแต้มตีบวกที่ได้จากนัดนี้ */
  reportMatch: (report: MatchReport) => number;
  /** นับซองที่เปิดวันนี้ (ใช้กับภารกิจ) */
  reportPackOpened: (count?: number) => void;

  /** การ์ดป้องกันคงเหลือ — ติดไว้แล้วตีไม่ติดค่าบวกจะไม่ลด */
  protectCards: number;
  /** เพิ่มการ์ดป้องกัน (ของขวัญแอดมิน / รางวัล) */
  addProtectCards: (amount: number) => void;
  /**
   * ตีบวกการ์ดด้วยแต้มตีบวก — มีโอกาสล้มเหลวตามอัตราของแต่ละขั้น
   * ใส่การ์ดช่วยได้สูงสุด 3 ใบ (ใบละ +5%) และติดการ์ดป้องกันกันค่าบวกลดได้
   */
  upgradeCard: (options: {
    cardId: string;
    materialCardIds?: string[];
    useProtect?: boolean;
  }) => CardActionResult;
  /** ตั้งค่าในเครื่องตามผลตีบวกที่เซิร์ฟเวอร์ตัดสินมาแล้ว (PHASE 13) */
  applyServerUpgrade: (payload: {
    cardId: string;
    coins?: number;
    upgradePoints?: number;
    protectCards?: number;
    card?: PlayerCardData;
    consumedCardIds?: string[];
  }) => void;
  /** รวมร่างการ์ดซ้ำเพื่อตีบวกฟรี (การ์ดที่ถูกใช้จะหายไป) */
  mergeCard: (cardId: string, sacrificeCardId: string) => CardActionResult;
  getCard: (cardId: string) => PlayerCardData | undefined;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const { account, patchState } = useAuth();

  const [cards, setCards] = useState<PlayerCardData[]>(() => account?.state.cards ?? []);
  const [coins, setCoins] = useState(() => account?.state.coins ?? 0);
  const [points, setPoints] = useState(() => account?.state.points ?? 0);
  const [upgradePoints, setUpgradePoints] = useState(() => account?.state.upgradePoints ?? 0);
  const [protectCards, setProtectCards] = useState(() => account?.state.protectCards ?? 0);
  const [passXp, setPassXp] = useState(() => account?.state.passXp ?? 0);
  const [passTickets, setPassTickets] = useState(() => account?.state.passTickets ?? 0);
  /** ยอดสะสมตลอดชีพ — นับต่อเนื่อง ไม่รีเซ็ตตามวันหรือซีซัน */
  const [passTotals, setPassTotals] = useState<PassTotals>(() =>
    account?.state.passTotals ? normalizeTotals(account.state.passTotals) : emptyTotals(),
  );
  /** ตัวนับรายวัน — ปัดเป็นของ "วันนี้" ตั้งแต่ตอนโหลด บัญชีเก่าจึงได้ชุดใหม่อัตโนมัติ */
  const [upgradeDaily, setUpgradeDaily] = useState<UpgradeDaily>(() =>
    rollDaily(account?.state.upgradeDaily),
  );

  /**
   * ยอดล่าสุดสำหรับ callback ที่ต้องมี identity คงที่
   * (useLeague/useMatchmaking ผูก reportMatch ไว้ใน deps ของ timer — ถ้า identity เปลี่ยนทุกครั้ง
   * interval จะถูกตั้งใหม่รัว ๆ) จึงอ่านค่าปัจจุบันผ่าน ref แทน
   */
  const upgradeRef = useRef({ upgradePoints, upgradeDaily });
  upgradeRef.current = { upgradePoints, upgradeDaily };

  // เซฟความคืบหน้าลงบัญชีทุกครั้งที่คลัง/เหรียญ/แต้มเปลี่ยน
  useEffect(() => {
    patchState({
      cards,
      coins,
      points,
      upgradePoints,
      protectCards,
      upgradeDaily,
      passXp,
      passTickets,
      passTotals,
    });
  }, [
    cards,
    coins,
    passTickets,
    passTotals,
    passXp,
    patchState,
    points,
    upgradeDaily,
    upgradePoints,
    protectCards,
  ]);

  // ข้ามวันแข่ง (06:00) ระหว่างเปิดเกมค้างไว้ — เช็คทุกนาทีแล้วรีเซ็ตตัวนับให้เอง
  useEffect(() => {
    const id = window.setInterval(() => {
      setUpgradeDaily((current) => rollDaily(current));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const addCards = useCallback((newCards: PlayerCardData[]) => {
    setCards((current) => [...current, ...newCards]);
  }, []);

  /**
   * เอาการ์ดออกจากคลังตรง ๆ ไม่ได้แต้ม/เหรียญตอบแทน (ต่างจาก salvageCards)
   * ใช้ตอนจ่ายการ์ดเป็นค่าแลกในดีลของแอดมิน — เช็คว่าการ์ดเข้าเงื่อนไขไหมที่ฝั่งเรียกใช้ก่อนเสมอ
   */
  const removeCards = useCallback((cardIds: string[]) => {
    const target = new Set(cardIds);
    setCards((current) => current.filter((card) => !target.has(card.id)));
  }, []);

  // อ่านยอดจาก state ปัจจุบันโดยตรง เพื่อให้ตอบ true/false ได้ทันทีในตัว handler
  const spendCoins = useCallback(
    (amount: number) => {
      if (coins < amount) return false;
      setCoins((current) => current - amount);
      return true;
    },
    [coins],
  );

  const addCoins = useCallback((amount: number) => {
    setCoins((current) => current + Math.max(0, amount));
  }, []);

  const addPoints = useCallback((amount: number) => {
    setPoints((current) => current + Math.max(0, amount));
  }, []);

  /* ── แต้มตีบวก ───────────────────────────────────────────── */

  const addUpgradePoints = useCallback((amount: number) => {
    if (amount <= 0) return;
    setUpgradePoints((current) => current + amount);
    playSfx('points');
  }, []);

  /**
   * บันทึกผลหนึ่งนัดลงตัวนับรายวัน แล้วจ่ายแต้มตีบวกให้ถ้าเข้าเงื่อนไข
   * คืนจำนวนแต้มที่ได้จากนัดนี้ (0 = ไม่ได้ เช่น แพ้ เป็นนัดลีก หรือชนเพดาน 30 นัด)
   *
   * อ่านตัวนับจาก ref แล้วคิดให้จบก่อน setState เสมอ
   * เพราะลีกอาจย้อนคำนวณหลายรอบติดกันก่อน React จะ re-render
   */
  const reportMatch = useCallback((report: MatchReport): number => {
    const daily = rollDaily(upgradeRef.current.upgradeDaily);
    const won = report.outcome === 'win';
    const earns = won && report.mode === 'friendly' && canEarnMatchPoints(daily);

    const next: UpgradeDaily = {
      ...daily,
      matchesPlayed: daily.matchesPlayed + 1,
      wins: daily.wins + (won ? 1 : 0),
      winsOverStronger:
        daily.winsOverStronger + (won && report.opponentOvr > report.teamOvr ? 1 : 0),
      rewardedWins: daily.rewardedWins + (earns ? 1 : 0),
    };

    upgradeRef.current = { ...upgradeRef.current, upgradeDaily: next };
    setUpgradeDaily(next);

    // ยอดสะสมตลอดชีพของภารกิจพาส — นับทุกนัดไม่ว่าแพ้ชนะ
    setPassTotals((current) => ({
      ...current,
      matches: current.matches + 1,
      wins: current.wins + (won ? 1 : 0),
    }));

    if (!earns) return 0;
    setUpgradePoints((current) => current + MATCH_WIN_POINTS);
    return MATCH_WIN_POINTS;
  }, []);

  /*
   * XP พาสไม่ได้บวกใน reportMatch เพราะจำนวน XP ต่อนัดเป็นค่าที่แอดมินตั้งได้
   * ซึ่งอยู่ใน GameConfigProvider ที่ถูกวางไว้ "ใต้" Provider นี้ (อ่านจากตรงนี้ไม่ได้)
   * ผู้เรียกที่รู้ค่าตั้ง (useMatchmaking) เป็นคนเรียก addPassXp เองหลังจบนัด
   */
  const addPassXp = useCallback((amount: number) => {
    if (amount <= 0) return;
    setPassXp((current) => current + Math.floor(amount));
  }, []);

  const resetPassXp = useCallback(() => setPassXp(0), []);

  const addPassTickets = useCallback((amount: number) => {
    if (amount <= 0) return;
    setPassTickets((current) => current + Math.floor(amount));
  }, []);

  /** อ่านยอดจาก state ปัจจุบันโดยตรง เพื่อให้ตอบ true/false ได้ทันทีในตัว handler */
  const spendPassTickets = useCallback(
    (amount: number): boolean => {
      if (amount <= 0) return true;
      if (passTickets < amount) return false;
      setPassTickets((current) => current - amount);
      return true;
    },
    [passTickets],
  );

  const reportPackOpened = useCallback((count = 1) => {
    const daily = rollDaily(upgradeRef.current.upgradeDaily);
    const next: UpgradeDaily = { ...daily, packsOpened: daily.packsOpened + count };
    upgradeRef.current = { ...upgradeRef.current, upgradeDaily: next };
    setUpgradeDaily(next);
    setPassTotals((current) => ({ ...current, packs: current.packs + count }));
  }, []);

  const missions = useMemo(() => buildDailyMissions(upgradeDaily), [upgradeDaily]);
  const missionsClaimable = !upgradeDaily.missionsClaimed && allMissionsDone(missions);

  /** กดรับรางวัลภารกิจครบชุด — ได้ครั้งเดียวต่อวันแข่ง */
  const claimMissions = useCallback((): boolean => {
    const daily = rollDaily(upgradeRef.current.upgradeDaily);
    const list = buildDailyMissions(daily);
    if (daily.missionsClaimed || !allMissionsDone(list)) {
      playSfx('error');
      return false;
    }

    const next: UpgradeDaily = { ...daily, missionsClaimed: true };
    upgradeRef.current = { ...upgradeRef.current, upgradeDaily: next };
    setUpgradeDaily(next);
    setCoins((current) => current + missionCoinTotal(list));
    setUpgradePoints((current) => current + MISSION_CLEAR_POINTS);
    playSfx('rankUp');
    return true;
  }, []);

  // อ่านยอดแต้มปัจจุบันตรง ๆ เพื่อให้ตอบ true/false ได้ทันทีในตัว handler
  const spendPoints = useCallback(
    (amount: number) => {
      if (points < amount) return false;
      setPoints((current) => current - amount);
      return true;
    },
    [points],
  );

  /**
   * ย่อยการ์ดหลายใบพร้อมกัน: คิดแต้มของแต่ละใบ (เพดานใบละ 5,000)
   * แล้วเอาการ์ดออกจากคลังในครั้งเดียว
   *
   * สำคัญ: คิดแต้มจาก state ปัจจุบันก่อนสั่ง setState เสมอ
   * ห้ามคิดข้างใน updater เพราะ React จะเรียก updater ทีหลัง (และเรียกซ้ำใน StrictMode)
   * ทำให้ได้ยอดเป็น 0 และแต้มไม่เข้าจริง
   */
  const salvageCards = useCallback(
    (cardIds: string[]) => {
      const target = new Set(cardIds);
      const removing = cards.filter((card) => target.has(card.id));
      if (removing.length === 0) return 0;

      const gained = removing.reduce((total, card) => {
        const player = getPlayerById(card.playerId);
        return player ? total + getSalvageValue(player, card.level) : total;
      }, 0);

      setCards((current) => current.filter((card) => !target.has(card.id)));

      if (gained > 0) {
        setPoints((current) => current + gained);
        playSfx('points');
      }

      return gained;
    },
    [cards],
  );

  /**
   * ตีบวกด้วยแต้มตีบวก — ตรวจเงื่อนไขให้ครบก่อนค่อยแตะ state
   *
   * แต้มถูกหักทันทีที่กด แล้วค่อยสุ่มว่าติดไหมตามอัตราของขั้นนั้น
   * (+1 = 100%, +2 = 80%, +3 = 70%, +4 = 40%, +5 = 30%)
   * ล้มเหลว = เสียแต้ม แต่ค่าบวกเดิมไม่ลด และการ์ดไม่หาย
   */
  const upgradeCard = useCallback(
    ({
      cardId,
      materialCardIds = [],
      useProtect = false,
    }: {
      cardId: string;
      materialCardIds?: string[];
      useProtect?: boolean;
    }): CardActionResult => {
      const card = cards.find((entry) => entry.id === cardId);
      const player = card ? getPlayerById(card.playerId) : undefined;
      if (!card || !player) return { ok: false, reason: 'ไม่พบการ์ดใบนี้ในคลัง' };

      // PHASE 12: การ์ดที่ล็อกไว้ห้ามตีบวก (กติกาเดียวกับที่เซิร์ฟเวอร์ตรวจ)
      if (isCardLocked(card)) {
        playSfx('error');
        return { ok: false, reason: 'การ์ดใบนี้ถูกล็อกไว้ ปลดล็อกก่อนถึงจะตีบวกได้' };
      }

      const step = getUpgradeStep(card.level - 1);
      if (!canLevelUp(card.level) || !step) {
        playSfx('error');
        return { ok: false, reason: `การ์ดใบนี้ตีบวกจนสุดแล้ว (+${MAX_PLUS})` };
      }

      /* ── การ์ดช่วย: ต้องเป็นของเราจริง ไม่ล็อก ไม่อยู่ในทีม ไม่ใช่ใบเดียวกัน ── */
      if (materialCardIds.length > MATERIAL_CARD_SLOTS) {
        playSfx('error');
        return { ok: false, reason: `ใส่การ์ดช่วยได้ไม่เกิน ${MATERIAL_CARD_SLOTS} ใบ` };
      }

      const fodder = materialCardIds.map((id) => cards.find((entry) => entry.id === id));
      const badFodder = fodder.some(
        (entry) => !entry || entry.id === cardId || isCardLocked(entry) || entry.inSquad,
      );
      if (badFodder) {
        playSfx('error');
        return { ok: false, reason: 'การ์ดที่ใส่มาช่วยใช้ไม่ได้' };
      }

      if (useProtect && protectCards < 1) {
        playSfx('error');
        return { ok: false, reason: 'ไม่มีการ์ดป้องกันเหลือ' };
      }

      const cost = step.materialCost;
      const coinCost = step.coinCost;
      const chance = getBoostedSuccessRate(step.successRate, materialCardIds.length);

      if (upgradeRef.current.upgradePoints < cost) {
        playSfx('error');
        return {
          ok: false,
          reason: `แต้มตีบวกไม่พอ — ต้องใช้ ${cost.toLocaleString('en-US')} แต้ม`,
        };
      }

      // ขั้น +6 ขึ้นไปคิดเหรียญด้วย (ดู src/data/upgradeConfig.ts)
      if (coinCost > 0 && coins < coinCost) {
        playSfx('error');
        return {
          ok: false,
          reason: `เหรียญไม่พอ — ต้องใช้ ${coinCost.toLocaleString('en-US')} เหรียญ`,
        };
      }

      // สุ่มครั้งเดียวก่อนแตะ state เพราะ StrictMode เรียก updater ซ้ำได้
      const success = Math.random() < chance;
      const plus = card.level - 1;

      /*
       * ตีไม่ติด: ค่าบวกลดตาม dropOnFail เว้นแต่ติดการ์ดป้องกันไว้
       * ป้องกันถูกใช้เฉพาะตอนที่มันได้ทำงานจริงเท่านั้น ไม่หายฟรี
       */
      const wouldDrop = !success && step.dropOnFail > 0;
      const protectUsed = wouldDrop && useProtect;
      const droppedLevels = wouldDrop && !protectUsed ? Math.min(step.dropOnFail, plus) : 0;

      setUpgradePoints((current) => current - cost);
      upgradeRef.current = {
        ...upgradeRef.current,
        upgradePoints: upgradeRef.current.upgradePoints - cost,
      };
      if (coinCost > 0) setCoins((current) => current - coinCost);
      if (protectUsed) setProtectCards((current) => Math.max(0, current - 1));

      const burned = new Set(materialCardIds);
      setCards((current) =>
        current
          // การ์ดช่วยหายทุกกรณี ทั้งติดและไม่ติด
          .filter((entry) => !burned.has(entry.id))
          .map((entry) =>
            entry.id === cardId
              ? { ...entry, level: success ? entry.level + 1 : entry.level - droppedLevels }
              : entry,
          ),
      );

      playSfx(success ? 'levelUp' : 'error');

      return {
        ok: true,
        success,
        plus: success ? plus + 1 : plus - droppedLevels,
        cost,
        coinCost,
        chance,
        protectUsed,
        droppedLevels,
      };
    },
    [cards, coins, protectCards],
  );

  const addProtectCards = useCallback((amount: number) => {
    if (amount <= 0) return;
    setProtectCards((current) => current + amount);
  }, []);

  /**
   * เอาผลตีบวกที่ "เซิร์ฟเวอร์ตัดสินมาแล้ว" มาตั้งทับค่าในเครื่อง (PHASE 13)
   *
   * ⚠️ ต้องเรียกทันทีหลังฟังก์ชันตอบกลับ เพราะเซิร์ฟเวอร์เขียนเหรียญและแต้ม
   * ลงบัญชีไปแล้ว ถ้าเครื่องยังถือค่าเก่าอยู่ เซฟรอบถัดไปจะเขียนทับของเซิร์ฟเวอร์
   */
  const applyServerUpgrade = useCallback(
    (payload: {
      cardId: string;
      coins?: number;
      upgradePoints?: number;
      protectCards?: number;
      card?: PlayerCardData;
      consumedCardIds?: string[];
    }) => {
      if (typeof payload.coins === 'number') setCoins(payload.coins);
      if (typeof payload.protectCards === 'number') setProtectCards(payload.protectCards);
      if (typeof payload.upgradePoints === 'number') {
        setUpgradePoints(payload.upgradePoints);
        upgradeRef.current = { ...upgradeRef.current, upgradePoints: payload.upgradePoints };
      }

      const next = payload.card;
      const burned = new Set(payload.consumedCardIds ?? []);

      setCards((current) =>
        current
          .filter((entry) => !burned.has(entry.id))
          .map((entry) => (next && entry.id === next.id ? next : entry)),
      );
    },
    [],
  );

  /**
   * รวมร่างการ์ดซ้ำ: การ์ดที่ถูกใช้จะหายไปจากคลัง แลกกับเลเวล +1 ของใบหลัก
   * ใช้ได้เฉพาะการ์ดของนักเตะคนเดียวกัน (playerId ตรงกัน) และไม่ใช่ใบเดียวกัน
   */
  const mergeCard = useCallback(
    (cardId: string, sacrificeCardId: string): CardActionResult => {
      const card = cards.find((entry) => entry.id === cardId);
      const sacrifice = cards.find((entry) => entry.id === sacrificeCardId);

      if (!card || !sacrifice) return { ok: false, reason: 'ไม่พบการ์ดที่จะใช้รวมร่าง' };
      if (card.id === sacrifice.id) return { ok: false, reason: 'ใช้การ์ดใบเดียวกันรวมร่างตัวเองไม่ได้' };
      if (card.playerId !== sacrifice.playerId) {
        return { ok: false, reason: 'รวมร่างได้เฉพาะการ์ดของนักเตะคนเดียวกัน' };
      }
      if (!canLevelUp(card.level)) {
        playSfx('error');
        return { ok: false, reason: `การ์ดใบนี้ตีบวกจนสุดแล้ว (+${MAX_PLUS})` };
      }

      setCards((current) =>
        current
          .filter((entry) => entry.id !== sacrificeCardId)
          .map((entry) => (entry.id === cardId ? { ...entry, level: entry.level + 1 } : entry)),
      );

      playSfx('levelUp');
      // รวมร่างการันตี 100% เพราะจ่ายด้วยการ์ดซ้ำแทนแต้ม
      return { ok: true, success: true, plus: card.level, cost: 0, chance: 1 };
    },
    [cards],
  );

  const ownedCards = useMemo<OwnedPlayerCard[]>(
    () =>
      cards.flatMap((card) => {
        const player = getPlayerById(card.playerId);
        return player ? [{ card, player }] : [];
      }),
    [cards],
  );

  const value = useMemo<InventoryContextValue>(
    () => ({
      ownedCards,
      rawCards: cards,
      coins,
      points,
      addCards,
      removeCards,
      spendCoins,
      addCoins,
      salvageCards,
      spendPoints,
      addPoints,
      upgradePoints,
      addUpgradePoints,
      passXp,
      addPassXp,
      resetPassXp,
      passTickets,
      passTotals,
      addPassTickets,
      spendPassTickets,
      upgradeDaily,
      missions,
      missionsClaimable,
      claimMissions,
      reportMatch,
      reportPackOpened,
      upgradeCard,
      applyServerUpgrade,
      protectCards,
      addProtectCards,
      mergeCard,
      getCard: (cardId: string) => cards.find((card) => card.id === cardId),
    }),
    [
      addCards,
      addCoins,
      addProtectCards,
      applyServerUpgrade,
      protectCards,
      addPassTickets,
      addPassXp,
      addPoints,
      addUpgradePoints,
      cards,
      claimMissions,
      coins,
      mergeCard,
      missions,
      missionsClaimable,
      ownedCards,
      passTickets,
      passTotals,
      passXp,
      points,
      removeCards,
      resetPassXp,
      reportMatch,
      reportPackOpened,
      salvageCards,
      spendCoins,
      spendPassTickets,
      spendPoints,
      upgradeCard,
      upgradeDaily,
      upgradePoints,
    ],
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};

const useInventory = (): InventoryContextValue => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('usePlayers ต้องถูกใช้ภายใน <InventoryProvider>');
  return context;
};

const matchesFilter = (player: Player, filter: PlayerFilter): boolean => {
  if (filter.search && !player.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
  if (filter.position && player.position !== filter.position) return false;
  if (filter.rarity && player.rarity !== filter.rarity) return false;
  if (filter.minOvr && player.ovr < filter.minOvr) return false;
  return true;
};

/** อ่านคลังการ์ด พร้อมตัวกรองสำหรับหน้าที่ต้องค้นหา */
export const usePlayers = (filter: PlayerFilter = {}) => {
  const inventory = useInventory();

  const cards = useMemo(
    () => inventory.ownedCards.filter(({ player }) => matchesFilter(player, filter)),
    [filter, inventory.ownedCards],
  );

  return { ...inventory, cards, allPlayers: PLAYERS, getPlayerById };
};
