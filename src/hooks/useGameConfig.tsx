/**
 * ค่าตั้งกลางที่แอดมินกำหนด แล้วทุกเครื่องต้องเห็นตรงกัน
 *
 * ตอนนี้ดูแลสองเรื่อง:
 *   1. คำสั่งรีเซ็ตดาว/ซีซัน (config/ladder) — รวมถึงจำนวนวันต่อซีซัน
 *   2. ประกาศกลางจอ (config/announcement)
 *
 * ฝั่งผู้เล่นแค่ "อ่านแล้วทำตาม" ส่วนฝั่งแอดมินใช้ saveLadder/saveAnnouncement
 * เขียนค่าใหม่ (คนที่ไม่ใช่เจ้าของโปรเจคจะถูก Firestore ปฏิเสธตั้งแต่ที่เซิร์ฟเวอร์)
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ONLINE } from '@/services/accountStore';
import {
  EMPTY_LADDER,
  type Announcement,
  type BanList,
  type LadderCommand,
} from '@/services/admin';
import { normalizeExchangeDeals } from '@/services/exchangeDeals';
import { CONFIG_DOCS, saveConfigDoc, watchConfigDoc } from '@/services/firebase/gameConfig';
import { setPlayerOverrides, type PlayerOverride } from '@/services/playerAttributes';
import {
  normalizeItemShop,
  setUpgradeSteps as applyUpgradeSteps,
  UPGRADE_STEPS,
  validateUpgradeSteps,
  type UpgradeItemShopConfig,
  type UpgradeSceneConfig,
  type UpgradeStep,
} from '@/data/upgradeConfig';
import {
  normalizeFeaturedCardRows,
  normalizeNews,
  type FeaturedCardRow,
  type NewsItem,
} from '@/services/homeFeed';
import { FORMATIONS, setCustomFormations } from '@/data/formations';
import { normalizeFormations } from '@/services/formationConfig';
import { normalizeLuckyGrid } from '@/services/luckyGrid';
import { normalizePacks } from '@/services/packConfig';
import { normalizePass } from '@/services/pass';
import { normalizeLoginBonus } from '@/services/loginBonus';
import { normalizePointsExchange } from '@/services/pointsExchange';
import { isOwnerUsername } from '@/services/rankRewards';
import type { LoginBonusConfig } from '@/types/loginBonus';
import type { CardPack, ExchangeDeal, PointsExchangeConfig } from '@/types/card';
import type { LuckyGridConfig } from '@/types/lucky';
import type { PassConfig } from '@/types/pass';
import type { Formation } from '@/types/team';

interface GameConfigContextValue {
  /** คำสั่งรีเซ็ตดาว/ซีซันล่าสุดจากแอดมิน */
  ladder: LadderCommand;
  /** ประกาศกลางจอ (null = ไม่มี) */
  announcement: Announcement | null;
  /** รายชื่อบัญชีที่ถูกระงับ */
  bans: BanList;
  /** ซองการ์ดในร้าน (ยังไม่เคยตั้ง = ใช้ชุดค่าเริ่มต้นในโค้ด) */
  packs: CardPack[];
  /** true = ซองที่ใช้อยู่มาจากเซิร์ฟเวอร์ */
  packsFromServer: boolean;
  /** ดีลแลกเปลี่ยนการ์ดที่แอดมินสร้างไว้ (ยังไม่เคยตั้ง = ไม่มีดีลเลย) */
  exchangeDeals: ExchangeDeal[];
  /** ร้านแลกด้วยแต้ม: สวิตช์เปิด/ปิด + การ์ดที่แอดมินเลือกเอง (ยังไม่เคยตั้ง = ปิดและไม่มีของ) */
  pointsExchange: PointsExchangeConfig;
  /** กล่องสุ่มรางวัลแบบตาราง 8×8 (ยังไม่เคยตั้ง = ปิดและไม่มีรางวัล) */
  luckyGrid: LuckyGridConfig;
  /** FC ALLSTAR PASS ประจำซีซัน (ยังไม่เคยตั้ง = ปิดและไม่มีเลเวล) */
  pass: PassConfig;
  /** ประกาศอัปเดตล่าสุดบนหน้า HOME (ยังไม่เคยตั้ง = ไม่มีข่าวเลย) */
  news: NewsItem[];
  /** แถวการ์ด (การ์ดใหม่ล่าสุด / OVR สูงสุด / LIMITED EDITION ฯลฯ) บนหน้า HOME */
  featuredCardRows: FeaturedCardRow[];
  /** แผนการเล่นทั้งหมดที่เลือกได้ = แผนพื้นฐานในโค้ด + แผนที่แอดมินวาดเอง */
  formations: Formation[];
  /** เฉพาะแผนที่แอดมินวาดเอง (ใช้ในหน้า ADMIN — แผนพื้นฐานแก้ไม่ได้) */
  customFormations: Formation[];
  /** true = บัญชีนี้เป็นเจ้าของโปรเจค */
  isOwner: boolean;
  uid: string | null;
  /** บันทึกคำสั่งรีเซ็ต คืนข้อความ error (null = สำเร็จ) */
  saveLadder: (command: LadderCommand) => Promise<string | null>;
  /** บันทึกประกาศ คืนข้อความ error (null = สำเร็จ) */
  saveAnnouncement: (announcement: Announcement) => Promise<string | null>;
  /** บันทึกรายชื่อแบน คืนข้อความ error (null = สำเร็จ) */
  saveBans: (bans: BanList) => Promise<string | null>;
  /** บันทึกซองการ์ด คืนข้อความ error (null = สำเร็จ) */
  savePacks: (packs: CardPack[]) => Promise<string | null>;
  /** บันทึกดีลแลกเปลี่ยนการ์ด คืนข้อความ error (null = สำเร็จ) */
  saveExchangeDeals: (deals: ExchangeDeal[]) => Promise<string | null>;
  /** บันทึกค่าตั้งร้านแลกด้วยแต้ม คืนข้อความ error (null = สำเร็จ) */
  savePointsExchange: (config: PointsExchangeConfig) => Promise<string | null>;
  /** บันทึกค่าตั้งกล่องสุ่มรางวัล คืนข้อความ error (null = สำเร็จ) */
  saveLuckyGrid: (config: LuckyGridConfig) => Promise<string | null>;
  /** บันทึกค่าตั้ง FC ALLSTAR PASS คืนข้อความ error (null = สำเร็จ) */
  savePass: (config: PassConfig) => Promise<string | null>;
  /** บันทึกฟีดข่าวหน้า HOME คืนข้อความ error (null = สำเร็จ) */
  saveNews: (news: NewsItem[]) => Promise<string | null>;
  /** บันทึกแถวการ์ดหน้า HOME ทั้งหมด คืนข้อความ error (null = สำเร็จ) */
  saveFeaturedCardRows: (rows: FeaturedCardRow[]) => Promise<string | null>;
  /** บันทึกแผนการเล่นที่สร้างเองทั้งชุด คืนข้อความ error (null = สำเร็จ) */
  saveFormations: (formations: Formation[]) => Promise<string | null>;
  /** ค่าพลังพื้นฐานที่แอดมินแก้ทับรายคน (playerId → ค่าที่แก้) */
  playerOverrides: Record<string, PlayerOverride>;
  savePlayerOverrides: (players: Record<string, PlayerOverride>) => Promise<string | null>;
  /** ตารางตีบวกที่ใช้จริง (ของเซิร์ฟเวอร์ถ้าผ่านการตรวจ ไม่งั้นของในโค้ด) */
  upgradeSteps: UpgradeStep[];
  /** true = ตารางที่ใช้อยู่มาจากเซิร์ฟเวอร์ ไม่ใช่ค่าในโค้ด */
  upgradeStepsFromServer: boolean;
  saveUpgradeSteps: (steps: UpgradeStep[], scene?: UpgradeSceneConfig) => Promise<string | null>;
  /** หน้าตาของหน้าตีบวก (รูปพื้นหลัง) ที่แอดมินตั้งไว้ */
  upgradeScene: UpgradeSceneConfig;
  /** ร้านไอเทมช่วยอัปเกรดที่ใช้จริง (ของเซิร์ฟเวอร์ถ้ามี ไม่งั้นค่าเริ่มต้นในโค้ด) */
  itemShop: UpgradeItemShopConfig;
  /** รางวัลล็อกอินรายสัปดาห์/รายเดือนที่แอดมินตั้งไว้ */
  loginBonus: LoginBonusConfig;
  /** บันทึกค่าตั้งรางวัลล็อกอิน คืนข้อความ error (null = สำเร็จ) */
  saveLoginBonus: (config: LoginBonusConfig) => Promise<string | null>;
  /** บันทึกค่าตั้งร้านไอเทม คืนข้อความ error (null = สำเร็จ) */
  saveItemShop: (config: UpgradeItemShopConfig) => Promise<string | null>;
}

const GameConfigContext = createContext<GameConfigContextValue | null>(null);

/** ข้อความ error ที่เจอบ่อยที่สุด: ยังไม่ได้ใส่ uid ของตัวเองใน firestore.rules */
const DENIED =
  'บันทึกไม่สำเร็จ — ต้องเพิ่ม uid ของคุณใน firestore.rules ก่อน (ดูวิธีในไฟล์นั้น)';

/**
 * แปลง error ตอนบันทึกเป็นข้อความที่บอกสาเหตุจริง
 *
 * ⚠️ ของเดิมตอบ DENIED ทุกกรณี ทำให้ปัญหาคนละเรื่อง (เช่นข้อมูลผิดรูป หรือเน็ตหลุด)
 * ถูกรายงานว่าเป็นเรื่องสิทธิ์ แล้วไปนั่งไล่แก้ firestore.rules ทั้งที่กฎถูกอยู่แล้ว
 * ตอนนี้เช็ค code ของ Firebase ก่อน แล้วค่อยถอยไปใช้ข้อความจริงของ error
 */
const saveErrorMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return DENIED;
  if (code === 'unavailable') return 'บันทึกไม่สำเร็จ — ต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง';

  const detail = error instanceof Error ? error.message : String(error);
  return `บันทึกไม่สำเร็จ — ${detail}`;
};

export const GameConfigProvider = ({ children }: { children: ReactNode }) => {
  const { account } = useAuth();
  const [ladder, setLadder] = useState<LadderCommand>(EMPTY_LADDER);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [bans, setBans] = useState<BanList>({});
  const [serverPacks, setServerPacks] = useState<CardPack[] | null>(null);
  const [serverExchangeDeals, setServerExchangeDeals] = useState<ExchangeDeal[] | null>(null);
  const [serverPointsExchange, setServerPointsExchange] = useState<Partial<PointsExchangeConfig> | null>(
    null,
  );
  const [serverLuckyGrid, setServerLuckyGrid] = useState<Partial<LuckyGridConfig> | null>(null);
  const [serverPass, setServerPass] = useState<Partial<PassConfig> | null>(null);
  const [serverNews, setServerNews] = useState<NewsItem[] | null>(null);
  const [serverFeaturedCardRows, setServerFeaturedCardRows] = useState<{
    rows?: Array<Partial<FeaturedCardRow>>;
    cards?: unknown;
  } | null>(null);
  const [serverFormations, setServerFormations] = useState<unknown>(null);
  /** ค่าพลังพื้นฐานที่แอดมินแก้ทับรายคน (PHASE 13.5) */
  const [playerOverrideMap, setPlayerOverrideMap] = useState<Record<string, PlayerOverride>>({});
  /** ตารางตีบวกที่แอดมินปรับ — null = ยังไม่เคยตั้ง ใช้ตารางในโค้ด */
  const [serverUpgradeSteps, setServerUpgradeSteps] = useState<UpgradeStep[] | null>(null);
  /** หน้าตาของหน้าตีบวก (พื้นหลัง) ที่แอดมินตั้งได้ */
  const [upgradeScene, setUpgradeSceneState] = useState<UpgradeSceneConfig>({});
  /** ร้านไอเทมที่แอดมินตั้ง — null = ยังไม่เคยตั้ง ใช้ราคาเริ่มต้นในโค้ด */
  const [serverItemShop, setServerItemShop] = useState<Partial<UpgradeItemShopConfig> | null>(null);
  /** รางวัลล็อกอินที่แอดมินตั้ง — null = ยังไม่เคยตั้ง ใช้ค่าเริ่มต้นในโค้ด */
  const [serverLoginBonus, setServerLoginBonus] = useState<Partial<LoginBonusConfig> | null>(null);

  useEffect(() => {
    if (!ONLINE) return undefined;

    const stopLadder = watchConfigDoc<LadderCommand>(CONFIG_DOCS.ladder, (value) =>
      setLadder(value ?? EMPTY_LADDER),
    );
    const stopAnnouncement = watchConfigDoc<Announcement>(CONFIG_DOCS.announcement, setAnnouncement);
    const stopBans = watchConfigDoc<BanList>(CONFIG_DOCS.bans, (value) => setBans(value ?? {}));
    const stopPacks = watchConfigDoc<{ packs?: CardPack[] }>(CONFIG_DOCS.packs, (value) =>
      setServerPacks(Array.isArray(value?.packs) ? value.packs : null),
    );
    const stopExchangeDeals = watchConfigDoc<{ deals?: ExchangeDeal[] }>(
      CONFIG_DOCS.exchangeDeals,
      (value) => setServerExchangeDeals(Array.isArray(value?.deals) ? value.deals : null),
    );
    const stopPointsExchange = watchConfigDoc<Partial<PointsExchangeConfig>>(
      CONFIG_DOCS.pointsExchange,
      setServerPointsExchange,
    );
    const stopLuckyGrid = watchConfigDoc<Partial<LuckyGridConfig>>(
      CONFIG_DOCS.luckyGrid,
      setServerLuckyGrid,
    );
    const stopPass = watchConfigDoc<Partial<PassConfig>>(CONFIG_DOCS.pass, setServerPass);
    const stopNews = watchConfigDoc<{ items?: NewsItem[] }>(CONFIG_DOCS.news, (value) =>
      setServerNews(Array.isArray(value?.items) ? value.items : null),
    );
    const stopFeaturedCardRows = watchConfigDoc<{
      rows?: Array<Partial<FeaturedCardRow>>;
      cards?: unknown;
    }>(CONFIG_DOCS.featuredCards, setServerFeaturedCardRows);
    const stopFormations = watchConfigDoc<{ formations?: unknown }>(
      CONFIG_DOCS.formations,
      (value) => setServerFormations(value?.formations ?? null),
    );

    /*
     * PHASE 11: ค่าพลังที่แอดมินแก้ทับถูกยัดเข้า Attribute Engine ตรงนี้จุดเดียว
     * ระบบอื่นทั้งหมด (จัดทีม, Team OVR, หน้าตีบวก) จึงเห็นค่าใหม่ทันทีโดยไม่ต้องรู้ว่ามี override
     */
    const stopPlayerOverrides = watchConfigDoc<{
      players?: Record<string, PlayerOverride>;
    }>(CONFIG_DOCS.playerOverrides, (value) => {
      const next = value?.players ?? null;
      setPlayerOverrideMap(next ?? {});
      setPlayerOverrides(next);
    });

    const stopUpgradeConfig = watchConfigDoc<{
      steps?: UpgradeStep[];
      scene?: UpgradeSceneConfig;
    }>(CONFIG_DOCS.upgradeConfig, (value) => {
      setServerUpgradeSteps(Array.isArray(value?.steps) ? value.steps : null);
      setUpgradeSceneState(value?.scene ?? {});
    });

    const stopItemShop = watchConfigDoc<Partial<UpgradeItemShopConfig>>(
      CONFIG_DOCS.upgradeItemShop,
      setServerItemShop,
    );

    const stopLoginBonus = watchConfigDoc<Partial<LoginBonusConfig>>(
      CONFIG_DOCS.loginBonus,
      setServerLoginBonus,
    );

    return () => {
      stopLadder();
      stopAnnouncement();
      stopBans();
      stopPacks();
      stopExchangeDeals();
      stopPointsExchange();
      stopLuckyGrid();
      stopPass();
      stopNews();
      stopFeaturedCardRows();
      stopFormations();
      stopPlayerOverrides();
      stopUpgradeConfig();
      stopItemShop();
      stopLoginBonus();
    };
  }, []);

  const uid = account?.id ?? null;
  const isOwner = isOwnerUsername(account?.username);

  /** ตัวช่วยเขียนเอกสารตั้งค่า แปลง error เป็นข้อความไทยให้ UI แสดงได้เลย */
  const write = useCallback(
    async (docId: string, value: Record<string, unknown>): Promise<string | null> => {
      if (!uid) return 'ยังไม่ได้เข้าสู่ระบบ';
      if (!ONLINE) return 'โหมดออฟไลน์บันทึกขึ้นเซิร์ฟเวอร์ไม่ได้';

      try {
        await saveConfigDoc(docId, value, uid);
        return null;
      } catch (error) {
        console.error(`[admin] บันทึก ${docId} ไม่สำเร็จ`, error);
        return saveErrorMessage(error);
      }
    },
    [uid],
  );

  const saveLadder = useCallback(
    (command: LadderCommand) => write(CONFIG_DOCS.ladder, { ...command }),
    [write],
  );

  const saveAnnouncement = useCallback(
    (next: Announcement) => write(CONFIG_DOCS.announcement, { ...next }),
    [write],
  );

  const saveBans = useCallback(
    (next: BanList) => write(CONFIG_DOCS.bans, { ...next }),
    [write],
  );

  const savePacks = useCallback(
    (next: CardPack[]) => write(CONFIG_DOCS.packs, { packs: normalizePacks(next) }),
    [write],
  );

  const saveExchangeDeals = useCallback(
    (next: ExchangeDeal[]) =>
      write(CONFIG_DOCS.exchangeDeals, { deals: normalizeExchangeDeals(next) }),
    [write],
  );

  const savePointsExchange = useCallback(
    (next: PointsExchangeConfig) => {
      const clean = normalizePointsExchange(next);
      return write(CONFIG_DOCS.pointsExchange, { enabled: clean.enabled, items: clean.items });
    },
    [write],
  );

  const saveLuckyGrid = useCallback(
    (next: LuckyGridConfig) => write(CONFIG_DOCS.luckyGrid, { ...normalizeLuckyGrid(next) }),
    [write],
  );

  const savePass = useCallback(
    (next: PassConfig) => write(CONFIG_DOCS.pass, { ...normalizePass(next) }),
    [write],
  );

  const saveNews = useCallback(
    (next: NewsItem[]) => write(CONFIG_DOCS.news, { items: normalizeNews(next) }),
    [write],
  );

  const saveFeaturedCardRows = useCallback(
    (next: FeaturedCardRow[]) =>
      write(CONFIG_DOCS.featuredCards, { rows: normalizeFeaturedCardRows({ rows: next }) }),
    [write],
  );

  const saveFormations = useCallback(
    (next: Formation[]) =>
      write(CONFIG_DOCS.formations, { formations: normalizeFormations(next) }),
    [write],
  );

  const savePlayerOverrides = useCallback(
    (players: Record<string, PlayerOverride>) =>
      write(CONFIG_DOCS.playerOverrides, { players }),
    [write],
  );

  /**
   * บันทึกตารางตีบวก — ตรวจให้ผ่าน validateUpgradeSteps ก่อนเสมอ
   * ตารางพังหมายถึงทั้งเกมตีบวกไม่ได้ จึงยอมให้บันทึกไม่ได้ดีกว่าปล่อยผ่าน
   */
  const saveUpgradeSteps = useCallback(
    (steps: UpgradeStep[], scene?: UpgradeSceneConfig) => {
      const problems = validateUpgradeSteps(steps);
      if (problems.length > 0) return Promise.resolve(problems[0]);
      // เขียนทั้งสองส่วนพร้อมกัน เพราะอยู่ในเอกสารเดียวกันและ write ทับทั้งก้อน
      return write(CONFIG_DOCS.upgradeConfig, { steps, scene: scene ?? upgradeScene });
    },
    [upgradeScene, write],
  );

  const saveItemShop = useCallback(
    (next: UpgradeItemShopConfig) => {
      const clean = normalizeItemShop(next);
      return write(CONFIG_DOCS.upgradeItemShop, { enabled: clean.enabled, offers: clean.offers });
    },
    [write],
  );

  /** ร้านไอเทมที่ใช้จริง — บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบก่อนเสมอ */
  const itemShop = useMemo(() => normalizeItemShop(serverItemShop), [serverItemShop]);

  const saveLoginBonus = useCallback(
    (next: LoginBonusConfig) => {
      const clean = normalizeLoginBonus(next);
      return write(CONFIG_DOCS.loginBonus, {
        enabled: clean.enabled,
        title: clean.title,
        weekly: clean.weekly,
        monthly: clean.monthly,
      });
    },
    [write],
  );

  /** รางวัลล็อกอินที่ใช้จริง — เติมช่องที่ยังไม่ได้ตั้งให้ครบเสมอ */
  const loginBonus = useMemo(() => normalizeLoginBonus(serverLoginBonus), [serverLoginBonus]);

  /**
   * ตารางตีบวกที่ใช้จริง — ของเซิร์ฟเวอร์ต้องผ่านการตรวจก่อน
   * ไม่ผ่าน = ถอยกลับไปใช้ตารางในโค้ด ดีกว่าปล่อยให้ทั้งเกมตีบวกเพี้ยน
   */
  const upgradeSteps = useMemo<UpgradeStep[]>(() => {
    if (!serverUpgradeSteps) return UPGRADE_STEPS;
    return validateUpgradeSteps(serverUpgradeSteps).length === 0
      ? serverUpgradeSteps
      : UPGRADE_STEPS;
  }, [serverUpgradeSteps]);

  /*
   * ตารางที่แอดมินตั้งไว้ต้องไหลเข้า Attribute Engine ด้วย ไม่ใช่แค่โชว์บนหน้าจอ
   * ไม่งั้นตัวเลขที่แอดมินเห็นกับที่เกมใช้จริงจะเป็นคนละชุด
   */
  useEffect(() => {
    applyUpgradeSteps(serverUpgradeSteps);
  }, [serverUpgradeSteps]);

  /** ซองที่ร้านใช้จริง — บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบก่อนเสมอ */
  const packs = useMemo(() => normalizePacks(serverPacks), [serverPacks]);
  /** ดีลแลกเปลี่ยนการ์ดที่ใช้จริง — บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบก่อนเสมอ */
  const exchangeDeals = useMemo(
    () => normalizeExchangeDeals(serverExchangeDeals),
    [serverExchangeDeals],
  );
  /** ร้านแลกด้วยแต้มที่ใช้จริง — บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบก่อนเสมอ */
  const pointsExchange = useMemo(
    () => normalizePointsExchange(serverPointsExchange),
    [serverPointsExchange],
  );
  /** กล่องสุ่มรางวัลที่ใช้จริง — บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบก่อนเสมอ */
  const luckyGrid = useMemo(() => normalizeLuckyGrid(serverLuckyGrid), [serverLuckyGrid]);
  /** พาสประจำซีซันที่ใช้จริง — บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบก่อนเสมอ */
  const pass = useMemo(() => normalizePass(serverPass), [serverPass]);
  /** ฟีดข่าวหน้า HOME ที่ใช้จริง — บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบก่อนเสมอ */
  const news = useMemo(() => normalizeNews(serverNews), [serverNews]);
  /** แถวการ์ดหน้า HOME ที่ใช้จริง — บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบก่อนเสมอ */
  const featuredCardRows = useMemo(
    () => normalizeFeaturedCardRows(serverFeaturedCardRows),
    [serverFeaturedCardRows],
  );

  /** แผนที่แอดมินวาดเอง — บีบค่าจากเซิร์ฟเวอร์ให้อยู่ในกรอบก่อนเสมอ */
  const customFormations = useMemo(
    () => normalizeFormations(serverFormations),
    [serverFormations],
  );
  const formations = useMemo(
    () => [...FORMATIONS, ...customFormations],
    [customFormations],
  );

  /*
   * ป้อนแผนที่สร้างเองเข้า registry ระดับโมดูลด้วย
   * เพราะ service ที่ไม่ได้อยู่ในต้นไม้ React (opponentSquad, scorers) เรียก
   * getFormationById ตรง ๆ และใช้ hook ไม่ได้ — ถ้าไม่ทำตรงนี้ ทีมคู่แข่งที่ใช้แผน
   * ที่แอดมินสร้างจะถูกวาดด้วยแผน 4-4-2 แทน
   */
  useEffect(() => {
    setCustomFormations(customFormations);
  }, [customFormations]);

  const value = useMemo<GameConfigContextValue>(
    () => ({
      ladder,
      announcement,
      bans,
      packs,
      packsFromServer: serverPacks !== null,
      exchangeDeals,
      pointsExchange,
      luckyGrid,
      pass,
      news,
      featuredCardRows,
      formations,
      customFormations,
      playerOverrides: playerOverrideMap,
      savePlayerOverrides,
      upgradeSteps,
      upgradeStepsFromServer: upgradeSteps !== UPGRADE_STEPS,
      saveUpgradeSteps,
      upgradeScene,
      itemShop,
      saveItemShop,
      loginBonus,
      saveLoginBonus,
      isOwner,
      uid,
      saveLadder,
      saveAnnouncement,
      saveBans,
      savePacks,
      saveExchangeDeals,
      savePointsExchange,
      saveLuckyGrid,
      savePass,
      saveNews,
      saveFeaturedCardRows,
      saveFormations,
    }),
    [
      announcement,
      bans,
      customFormations,
      exchangeDeals,
      featuredCardRows,
      formations,
      isOwner,
      ladder,
      luckyGrid,
      pass,
      news,
      packs,
      pointsExchange,
      itemShop,
      saveItemShop,
      loginBonus,
      saveLoginBonus,
      saveAnnouncement,
      saveBans,
      saveExchangeDeals,
      saveFeaturedCardRows,
      saveFormations,
      saveLadder,
      saveLuckyGrid,
      savePass,
      saveNews,
      savePacks,
      savePass,
      savePointsExchange,
      serverPacks,
      uid,
    ],
  );

  return <GameConfigContext.Provider value={value}>{children}</GameConfigContext.Provider>;
};

export const useGameConfig = (): GameConfigContextValue => {
  const context = useContext(GameConfigContext);
  if (!context) throw new Error('useGameConfig ต้องถูกใช้ภายใน <GameConfigProvider>');
  return context;
};
