/**
 * สถานะทีมของผู้เล่น (แหล่งความจริงเดียวของทั้งแอป)
 *
 * ใช้ Context เพราะทั้งสนาม แผงขวา และหน้าอื่น ๆ ต้องเห็นทีมชุดเดียวกัน
 * เก็บสถานะเป็น map ของ slotId → cardId เพื่อให้สลับตัวเป็นการแก้ค่าสองช่องเท่านั้น
 *
 * กติกาสำคัญ: ห้ามนักเตะ "ชื่อเดียวกัน" ลงสนามพร้อมกันเกิน 1 คน
 * (มีการ์ดชื่อซ้ำในคลังได้ แต่เลือกลง 11 ตัวจริงได้ใบเดียว)
 * ตรวจที่ assignCard และ buildSquad — ทุกเส้นทางที่จัดตัวต้องผ่านสองฟังก์ชันนี้
 *
 * ไม่มีคูลดาวน์เปลี่ยนตัวแล้ว: ทีมที่ลงแข่ง (ทั้งลีกประจำวันและแมตช์กระชับมิตร)
 * คือทีมชุดล่าสุดในหน้า MY TEAM เสมอ แก้เมื่อไหร่ก็มีผลทันที
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
import { DEFAULT_FORMATION_ID, getFormationById } from '@/data/formations';
import { useGameConfig } from '@/hooks/useGameConfig';
import { getPlayerById } from '@/data/players';
import { useAuth } from '@/hooks/useAuth';
import { usePlayers } from '@/hooks/usePlayers';
import { calculateTeamRating, type RatedSlot } from '@/services/teamRating';
import { canPlaySlot, positionFit, slotBlockReason } from '@/services/lineup';
import { playSfx } from '@/services/sound';
import { getEffectivePlayer } from '@/services/playerAttributes';
import type { PlayerCard as PlayerCardData } from '@/types/card';
import type { Player } from '@/types/player';
import type { Formation, FormationId, Team } from '@/types/team';

/** การ์ดหนึ่งใบพร้อมข้อมูลนักเตะ ใช้ในรายการตัวสำรอง */
export interface BenchCard {
  card: PlayerCardData;
  player: Player;
}

/** slotId → cardId (null = ช่องว่าง) */
type SquadMap = Record<string, string | null>;

/** ผลของการพยายามจัดนักเตะลงช่อง */
export interface AssignResult {
  ok: boolean;
  /** เหตุผลที่จัดไม่ได้ ใช้แสดงเป็นข้อความเตือนบนสนาม */
  reason?: string;
}

interface TeamContextValue {
  team: Team;
  formation: Formation;
  ratedSlots: RatedSlot[];
  rating: ReturnType<typeof calculateTeamRating>;
  /** การ์ดที่ยังไม่ได้ลงสนาม (ทั้งคลัง ไม่ใช่แค่ม้านั่งที่จัดไว้) */
  bench: BenchCard[];
  /**
   * ม้านั่งสำรองที่ผู้เล่นจัดเอง — ยาว BENCH_SIZE ช่องเสมอ (null = ช่องว่าง)
   * แยกจาก `bench` ตรงที่อันนั้นคือ "การ์ดทุกใบที่ไม่ได้ลงสนาม"
   * ส่วนอันนี้คือ "ทีม 16 คนที่ประกาศลงแข่ง" ซึ่งห้ามมีชื่อซ้ำกับตัวจริงเด็ดขาด
   */
  benchCards: Array<BenchCard | null>;
  /** การ์ดที่ยังไม่ได้อยู่ทั้งในตัวจริงและม้านั่ง — ใช้เป็นรายการให้เลือกใส่ม้านั่ง */
  reserves: BenchCard[];
  /** จัดการ์ดลงม้านั่งช่องที่ index (ปฏิเสธถ้าชื่อซ้ำกับใครในทีม) */
  assignBench: (index: number, cardId: string) => AssignResult;
  /** เช็คก่อนว่าใส่การ์ดใบนี้ลงม้านั่งได้ไหม */
  canAssignBench: (index: number, cardId: string) => AssignResult;
  /** เอาการ์ดออกจากม้านั่ง */
  clearBench: (index: number) => AssignResult;
  /** เปลี่ยนตัว: สลับคนในช่องตัวจริงกับคนบนม้านั่งช่องที่ index */
  substitute: (slotId: string, benchIndex: number) => AssignResult;
  /** ชื่อนักเตะที่ลงสนามอยู่แล้ว (ตัวพิมพ์ใหญ่) ใช้เช็คชื่อซ้ำใน UI */
  namesInSquad: Set<string>;
  /**
   * รหัสการ์ดที่ติดโทษแบนจากใบแดงอยู่ (นับถอยหลังทีละนัด ดู AccountState.suspensions)
   * จัดลงสนามไม่ได้จนกว่าจะครบโทษ
   */
  suspendedCardIds: Set<string>;
  /** จำนวนนัดที่เหลือต้องแบนของการ์ดใบนี้ (0/undefined = ไม่ติดโทษ) */
  suspensionRemaining: (cardId: string) => number;
  changeFormation: (id: FormationId) => AssignResult;
  /** วางการ์ดลงช่อง ถ้าการ์ดอยู่ช่องอื่นอยู่แล้วจะสลับให้ — ปฏิเสธถ้าชื่อซ้ำ */
  assignCard: (slotId: string, cardId: string) => AssignResult;
  /** เช็คก่อนว่าจัดการ์ดใบนี้ลงช่องนี้ได้ไหม (ใช้ทำปุ่มจาง/ป้ายเตือน) */
  canAssign: (slotId: string, cardId: string) => AssignResult;
  /**
   * สลับตำแหน่งของนักเตะสองคนที่อยู่บนสนามอยู่แล้ว
   * ไม่นับเป็น "การเปลี่ยนตัว" เพราะ 11 คนชุดเดิม จึงไม่โดนล็อกของลีก
   */
  swapSlots: (slotA: string, slotB: string) => AssignResult;
  /** เอาการ์ดออกจากช่อง กลับไปเป็นตัวสำรอง */
  clearSlot: (slotId: string) => AssignResult;
  /**
   * สถานะล็อกการเปลี่ยนตัว
   * ตอนนี้เกมไม่มีคูลดาวน์แล้ว (ดูหมายเหตุหัวไฟล์) จึงปลดล็อกเสมอ
   * แต่คงฟิลด์นี้ไว้เพราะหน้าเปลี่ยนตัวใช้แสดงผล และถ้าจะเปิดคูลดาวน์อีกครั้ง
   * ให้แก้ค่าที่นี่ที่เดียว UI ทั้งหมดจะทำงานตามทันที
   */
  squadLock: { locked: boolean; remainingMs: number };
}

/** ค่าคงที่ของสถานะ "เปลี่ยนตัวได้ตลอดเวลา" */
const UNLOCKED = { locked: false, remainingMs: 0 } as const;

/** จำนวนช่องม้านั่งสำรองที่ประกาศลงแข่งได้ (11 ตัวจริง + 5 = ทีม 16 คน) */
export const BENCH_SIZE = 5;

/** ม้านั่งว่างเปล่าความยาวคงที่ */
const emptyBench = (): Array<string | null> => Array.from({ length: BENCH_SIZE }, () => null);

const TeamContext = createContext<TeamContextValue | null>(null);

/** กุญแจเทียบชื่อนักเตะ — ตัดช่องว่างและตัวพิมพ์ออก เพื่อให้ "HAALAND" กับ "Haaland" นับเป็นคนเดียวกัน */
const nameKey = (player: Player): string => player.name.trim().toUpperCase();

/**
 * จัดตัวอัตโนมัติ: ตำแหน่งตรงก่อน แล้วค่อยตำแหน่งรอง
 * ข้ามนักเตะที่ชื่อซ้ำกับคนที่ถูกเลือกไปแล้ว และนักเตะที่ยังติดโทษแบนอยู่เสมอ
 */
const buildSquad = (
  formation: Formation,
  allCards: PlayerCardData[],
  suspended: Set<string> = new Set(),
): SquadMap => {
  const pool = allCards.filter((card) => card.inSquad && !suspended.has(card.id));
  const usedCards = new Set<string>();
  const usedNames = new Set<string>();

  /** การ์ดใบนี้ยังเลือกได้ไหม (ยังไม่ถูกใช้ และชื่อยังไม่ซ้ำ) */
  const available = (card: PlayerCardData): Player | null => {
    if (usedCards.has(card.id)) return null;
    const player = getPlayerById(card.playerId);
    if (!player || usedNames.has(nameKey(player))) return null;
    return player;
  };

  return Object.fromEntries(
    formation.slots.map((slot) => {
      /*
       * ทุกทางเลือกต้องผ่านกติกาตำแหน่งก่อน — ช่อง GK จึงไม่มีวันถูกเติมด้วยกองหน้า
       * และช่องในสนามก็ไม่มีวันได้ผู้รักษาประตูมายืน แม้ตอนจัดตัวอัตโนมัติ
       */
      const eligible = (card: PlayerCardData): Player | null => {
        const player = available(card);
        return player && canPlaySlot(player, slot.position) ? player : null;
      };

      const exact = pool.find((card) => eligible(card)?.position === slot.position);
      const alternative = pool.find((card) => eligible(card)?.altPositions.includes(slot.position));
      // ไม่มีตำแหน่งตรงเลย ค่อยไล่ตามความเข้ากัน (จำพวกเดียวกันมาก่อนคนละจำพวก)
      const nearest = [...pool]
        .filter((card) => eligible(card) !== null)
        .sort((a, b) => {
          const left = getPlayerById(a.playerId);
          const right = getPlayerById(b.playerId);
          if (!left || !right) return 0;
          return (
            positionFit(right, slot.position) - positionFit(left, slot.position) ||
            right.ovr - left.ovr
          );
        })[0];

      const chosen = exact ?? alternative ?? nearest;

      if (chosen) {
        usedCards.add(chosen.id);
        const player = getPlayerById(chosen.playerId);
        if (player) usedNames.add(nameKey(player));
      }

      return [slot.id, chosen?.id ?? null];
    }),
  );
};

/** ตัดช่องที่อ้างถึงการ์ดที่ไม่มีอยู่แล้ว (เช่นถูกย่อยไป) และช่องที่ชื่อซ้ำออก */
const sanitizeSquad = (
  saved: SquadMap,
  formation: Formation,
  allCards: PlayerCardData[],
): SquadMap => {
  const byId = new Map(allCards.map((card) => [card.id, card]));
  const usedCards = new Set<string>();
  const usedNames = new Set<string>();

  return Object.fromEntries(
    formation.slots.map((slot) => {
      const cardId = saved[slot.id] ?? null;
      const card = cardId ? byId.get(cardId) : undefined;
      const player = card ? getPlayerById(card.playerId) : undefined;

      /*
       * เซฟเก่าอาจมีกองหน้ายืนโกลอยู่ (ตอนนั้นยังไม่มีกติกานี้) — ปล่อยช่องว่างไว้
       * ให้ผู้เล่นเห็นแล้วจัดใหม่เอง ดีกว่าเก็บทีมที่ผิดกติกาไว้เงียบ ๆ
       */
      if (
        !card ||
        !player ||
        usedCards.has(card.id) ||
        usedNames.has(nameKey(player)) ||
        !canPlaySlot(player, slot.position)
      ) {
        return [slot.id, null];
      }

      usedCards.add(card.id);
      usedNames.add(nameKey(player));
      return [slot.id, card.id];
    }),
  );
};

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  const { rawCards } = usePlayers();
  const { account, patchState } = useAuth();

  const [formationId, setFormationId] = useState<FormationId>(
    () => account?.state.formationId ?? DEFAULT_FORMATION_ID,
  );

  /**
   * รหัสการ์ดที่ยังติดโทษแบนอยู่ (นับถอยหลังจาก AccountState.suspensions ที่เซิร์ฟเวอร์/บัญชีเก็บไว้)
   *
   * ต้อง useMemo ตรงนี้: `?? {}` สร้างอ็อบเจกต์ใหม่ทุก render
   * ถ้าปล่อยไว้ suspendedCardIds/suspensionRemaining จะเปลี่ยน identity ตลอด
   * แล้วทุก useMemo/useCallback ที่พึ่งมันก็คำนวณใหม่ทุกครั้งโดยไม่จำเป็น
   */
  const suspensions = useMemo(
    () => account?.state.suspensions ?? {},
    [account?.state.suspensions],
  );
  const suspendedCardIds = useMemo(
    () => new Set(Object.entries(suspensions).filter(([, left]) => left > 0).map(([id]) => id)),
    [suspensions],
  );
  const suspensionRemaining = useCallback(
    (cardId: string): number => suspensions[cardId] ?? 0,
    [suspensions],
  );

  /**
   * ตอนเปิดเกม: ถ้าบัญชีเคยจัดทีมไว้ให้ใช้ชุดนั้น (หลังกรองการ์ดที่หายไปออก)
   * ถ้ายังไม่เคยจัด (บัญชีที่เพิ่งสมัคร) ให้จัดตัวอัตโนมัติจากนักเตะเริ่มต้น
   */
  const [squad, setSquad] = useState<SquadMap>(() => {
    const startingFormation = getFormationById(account?.state.formationId ?? DEFAULT_FORMATION_ID);
    const saved = account?.state.squad ?? {};
    const hasSaved = Object.values(saved).some(Boolean);

    return hasSaved
      ? sanitizeSquad(saved, startingFormation, rawCards)
      : buildSquad(startingFormation, rawCards, suspendedCardIds);
  });

  /**
   * ม้านั่งสำรองที่ประกาศลงแข่ง — เก็บเป็น array ความยาวคงที่ (index = เบอร์ 12, 13, ...)
   * บัญชีเก่าที่ยังไม่มีค่านี้จะได้ม้านั่งว่าง แล้วถูกเติมให้อัตโนมัติด้านล่าง
   */
  const [benchSlots, setBenchSlots] = useState<Array<string | null>>(() => {
    const saved = account?.state.benchSlots;
    if (!saved?.length) return emptyBench();
    // ความยาวอาจไม่ตรงถ้าเคยตั้ง BENCH_SIZE ไว้ต่างกัน — ตัด/เติมให้พอดีเสมอ
    return emptyBench().map((_, index) => saved[index] ?? null);
  });

  /*
   * ต้องผูกกับ formations ของ useGameConfig ด้วย ไม่ใช่แค่ formationId
   * เพราะแผนที่แอดมินสร้างมาถึงทีหลัง (โหลดจาก Firestore แบบเรียลไทม์)
   * ถ้าดูแค่ formationId ทีมที่ใช้แผนนั้นจะค้างอยู่ที่แผนสำรองจนกว่าจะรีเฟรชหน้า
   */
  const { formations: allFormations } = useGameConfig();
  const formation = useMemo(
    () => allFormations.find((entry) => entry.id === formationId) ?? getFormationById(formationId),
    [allFormations, formationId],
  );

  // เซฟการจัดทีมลงบัญชีทุกครั้งที่เปลี่ยน
  useEffect(() => {
    patchState({ formationId, squad, benchSlots });
  }, [benchSlots, formationId, patchState, squad]);

  /**
   * นักเตะที่อยู่ในการ์ดใบหนึ่ง (อ่านจากคลังปัจจุบัน จึงรองรับการ์ดที่เพิ่งเปิดซองได้)
   *
   * PHASE 11: ค่าพลังมาจาก Attribute Engine จุดเดียว (ตีบวก + ฝึกซ้อม + ค่าที่แอดมินแก้)
   * Team OVR เคมี โอกาสชนะ และ Match Engine จึงเห็นตัวเลขชุดเดียวกันทั้งหมดโดยอัตโนมัติ
   */
  const cardPlayer = useCallback(
    (cardId: string | null): Player | null => {
      const card = rawCards.find((entry) => entry.id === cardId);
      if (!card) return null;
      return getEffectivePlayer(card);
    },
    [rawCards],
  );

  const changeFormation = useCallback(
    (id: FormationId): AssignResult => {
      setFormationId(id);
      setSquad(buildSquad(getFormationById(id), rawCards, suspendedCardIds));
      playSfx('click');
      return { ok: true };
    },
    [rawCards, suspendedCardIds],
  );

  /** สลับตำแหน่งกันระหว่างสองช่องบนสนาม (ใช้ตอนคลิกการ์ดสองใบหรือลากวาง) */
  /**
   * สลับที่กันสองช่องบนสนาม
   *
   * ต้องเช็คกติกาตำแหน่งทั้งสองฝั่ง — ทางนี้ไม่ได้ผ่าน assignCard จึงเคยเป็นช่องโหว่
   * ที่ลากกองหน้าไปทับช่องโกลได้ทั้งที่ canAssign ห้ามไว้แล้ว
   */
  const swapSlots = useCallback(
    (slotA: string, slotB: string): AssignResult => {
      if (slotA === slotB) return { ok: true };

      const from = formation.slots.find((entry) => entry.id === slotA);
      const to = formation.slots.find((entry) => entry.id === slotB);

      const moving = cardPlayer(squad[slotA] ?? '');
      const swapped = cardPlayer(squad[slotB] ?? '');

      const blocked =
        (moving && to ? slotBlockReason(moving, to.position) : null) ??
        (swapped && from ? slotBlockReason(swapped, from.position) : null);

      if (blocked) {
        playSfx('error');
        return { ok: false, reason: blocked };
      }

      setSquad((current) => ({
        ...current,
        [slotA]: current[slotB] ?? null,
        [slotB]: current[slotA] ?? null,
      }));
      playSfx('swap');
      return { ok: true };
    },
    [cardPlayer, formation.slots, squad],
  );

  /**
   * ตรวจว่าจัดการ์ดใบนี้ลงช่องนี้ได้ไหม
   * ผ่านเสมอถ้าการ์ดอยู่บนสนามอยู่แล้ว (เพราะเป็นการสลับที่ ไม่ได้เพิ่มชื่อใหม่)
   */
  const canAssign = useCallback(
    (slotId: string, cardId: string): AssignResult => {
      const player = cardPlayer(cardId);
      if (!player) return { ok: false, reason: 'ไม่พบการ์ดใบนี้ในคลัง' };

      /*
       * กติกาตำแหน่ง — เช็คก่อนเรื่องอื่นทั้งหมด เพราะเป็นข้อห้ามที่ตายตัวที่สุด
       * ต่อให้การ์ดอยู่บนสนามอยู่แล้ว (กรณีสลับที่) ก็ยังต้องผ่านข้อนี้
       */
      const slot = formation.slots.find((entry) => entry.id === slotId);
      const blocked = slot ? slotBlockReason(player, slot.position) : null;
      if (blocked) return { ok: false, reason: blocked };

      const banLeft = suspensionRemaining(cardId);
      if (banLeft > 0) {
        return {
          ok: false,
          reason: `${player.name} โดนใบแดงติดโทษแบนอีก ${banLeft} นัด — ลงสนามไม่ได้`,
        };
      }

      // การ์ดอยู่ในสนามอยู่แล้ว = สลับตำแหน่งกัน ไม่ทำให้ชื่อซ้ำเพิ่ม
      const alreadyOnPitch = Object.values(squad).includes(cardId);
      if (alreadyOnPitch) return { ok: true };

      const clash = Object.entries(squad).find(([otherSlotId, otherCardId]) => {
        if (otherSlotId === slotId || !otherCardId) return false;
        const other = cardPlayer(otherCardId);
        return other ? nameKey(other) === nameKey(player) : false;
      });

      if (clash) {
        return {
          ok: false,
          reason: `${player.name} ลงสนามอยู่แล้วในช่อง ${clash[0]} — ห้ามใช้นักเตะชื่อเดียวกันซ้ำใน 11 ตัวจริง`,
        };
      }

      return { ok: true };
    },
    /*
     * suspensionRemaining ต้องอยู่ใน deps ด้วย ไม่งั้น canAssign จะจำโทษแบน
     * "ชุดตอนที่ squad เปลี่ยนครั้งล่าสุด" ค้างไว้ตลอด — พอโทษหมดแล้ว
     * (kickoff นับถอยหลังให้ทุกนัด แต่ squad ไม่ได้เปลี่ยน) มันก็ยังตอบว่า
     * "โดนใบแดงติดโทษแบนอีก 3 นัด" อยู่เหมือนเดิม ทำให้จัดคนนั้นลงสนามไม่ได้อีกเลย
     */
    [cardPlayer, formation.slots, squad, suspensionRemaining],
  );

  const assignCard = useCallback(
    (slotId: string, cardId: string): AssignResult => {
      const check = canAssign(slotId, cardId);

      if (!check.ok) {
        playSfx('error');
        return check;
      }

      const outgoing = squad[slotId] ?? null;

      setSquad((current) => {
        const next = { ...current };
        // ถ้าการ์ดใบนี้อยู่ช่องอื่นอยู่แล้ว ให้สลับที่กัน แทนที่จะโคลนการ์ด
        const origin = Object.keys(next).find((key) => next[key] === cardId);
        if (origin) next[origin] = next[slotId] ?? null;
        next[slotId] = cardId;
        return next;
      });

      /*
       * การ์ดที่ถูกส่งลงมาจากม้านั่ง = เปลี่ยนตัวเต็มรูปแบบ
       * คนที่ถูกเปลี่ยนออกต้องไปนั่งช่องม้านั่งที่ว่างลงพอดี ไม่ใช่หายไปเฉย ๆ
       * (ถ้าการ์ดมาจากในสนามด้วยกัน ม้านั่งไม่เกี่ยว จึงไม่ต้องแตะ)
       */
      setBenchSlots((current) => {
        const index = current.indexOf(cardId);
        if (index < 0) return current;
        const next = [...current];
        next[index] = outgoing;
        return next;
      });

      playSfx('swap');
      return { ok: true };
    },
    [canAssign],
  );

  /* ── ม้านั่งสำรอง ─────────────────────────────────────────── */

  /**
   * เช็คว่าใส่การ์ดใบนี้ลงม้านั่งช่องนี้ได้ไหม
   *
   * กติกาชื่อห้ามซ้ำครอบทั้งทีม 16 คน ไม่ใช่แค่ 11 ตัวจริง — เพราะม้านั่งคือคนที่
   * "พร้อมลงแทน" ถ้าปล่อยให้ชื่อซ้ำได้ พอเปลี่ยนตัวจริงจะกลายเป็นสองคนชื่อเดียวกันในสนามทันที
   */
  const canAssignBench = useCallback(
    (index: number, cardId: string): AssignResult => {
      const player = cardPlayer(cardId);
      if (!player) return { ok: false, reason: 'ไม่พบการ์ดใบนี้ในคลัง' };

      const onPitch = Object.entries(squad).find(([, otherCardId]) => {
        if (!otherCardId) return false;
        const other = cardPlayer(otherCardId);
        return other ? nameKey(other) === nameKey(player) : false;
      });
      if (onPitch) {
        return {
          ok: false,
          reason: `${player.name} เป็นตัวจริงอยู่แล้ว (ช่อง ${onPitch[0]}) — ห้ามชื่อซ้ำในทีม`,
        };
      }

      const onBench = benchSlots.findIndex((otherCardId, otherIndex) => {
        if (otherIndex === index || !otherCardId) return false;
        const other = cardPlayer(otherCardId);
        return other ? nameKey(other) === nameKey(player) : false;
      });
      if (onBench >= 0) {
        return {
          ok: false,
          reason: `${player.name} นั่งสำรองอยู่แล้วในช่อง ${12 + onBench} — ห้ามชื่อซ้ำในทีม`,
        };
      }

      return { ok: true };
    },
    [benchSlots, cardPlayer, squad],
  );

  const assignBench = useCallback(
    (index: number, cardId: string): AssignResult => {
      const check = canAssignBench(index, cardId);
      if (!check.ok) {
        playSfx('error');
        return check;
      }

      setBenchSlots((current) => {
        const next = [...current];
        // อยู่ม้านั่งช่องอื่นอยู่แล้ว = สลับช่องกัน ไม่ใช่โคลนการ์ด
        const origin = next.indexOf(cardId);
        if (origin >= 0) next[origin] = next[index] ?? null;
        next[index] = cardId;
        return next;
      });

      playSfx('swap');
      return { ok: true };
    },
    [canAssignBench],
  );

  const clearBench = useCallback((index: number): AssignResult => {
    setBenchSlots((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
    playSfx('click');
    return { ok: true };
  }, []);

  /** เปลี่ยนตัว: คนบนม้านั่งขึ้นสนาม คนในสนามลงไปนั่งช่องนั้นแทน */
  const substitute = useCallback(
    (slotId: string, benchIndex: number): AssignResult => {
      const incoming = benchSlots[benchIndex];
      if (!incoming) return { ok: false, reason: 'ช่องม้านั่งนี้ว่างอยู่' };

      // assignCard จัดการย้ายคนที่ถูกเปลี่ยนออกไปนั่งม้านั่งให้เองแล้ว
      return assignCard(slotId, incoming);
    },
    [assignCard, benchSlots],
  );

  const clearSlot = useCallback((slotId: string): AssignResult => {
    setSquad((current) => ({ ...current, [slotId]: null }));
    playSfx('click');
    return { ok: true };
  }, []);

  /** เลเวลของการ์ดในช่องหนึ่ง ใช้ส่งต่อให้ UI ขึ้นป้ายค่าตีบวก */
  const cardLevel = useCallback(
    (cardId: string | null): number | undefined =>
      rawCards.find((entry) => entry.id === cardId)?.level,
    [rawCards],
  );

  const ratedSlots = useMemo<RatedSlot[]>(
    () =>
      formation.slots.map((slot) => {
        const cardId = squad[slot.id] ?? null;
        return { slot, player: cardPlayer(cardId), level: cardLevel(cardId) };
      }),
    [cardLevel, cardPlayer, formation, squad],
  );

  /** ชื่อทั้งหมดที่ลงสนามอยู่ ใช้ให้ UI ทำปุ่มจางของนักเตะชื่อซ้ำ */
  const namesInSquad = useMemo(
    () =>
      new Set(
        ratedSlots.flatMap(({ player }) => (player ? [nameKey(player)] : [])),
      ),
    [ratedSlots],
  );

  const bench = useMemo<BenchCard[]>(() => {
    const inSquad = new Set(Object.values(squad).filter(Boolean));
    return rawCards
      .filter((card) => !inSquad.has(card.id))
      .flatMap((card) => {
        const player = getPlayerById(card.playerId);
        return player ? [{ card, player }] : [];
      });
  }, [rawCards, squad]);

  /**
   * ม้านั่งที่ประกาศไว้ พร้อมข้อมูลนักเตะ (null = ช่องว่าง)
   * กรองทิ้งเองถ้าการ์ดหายจากคลัง ถูกดันขึ้นเป็นตัวจริงไปแล้ว หรือชื่อซ้ำกับใครในทีม
   * — จึงไม่ต้องมีขั้นตอน sanitize แยกตอนโหลดบัญชี
   */
  const benchCards = useMemo<Array<BenchCard | null>>(() => {
    const inSquad = new Set(Object.values(squad).filter(Boolean));
    const usedNames = new Set(
      Object.values(squad).flatMap((cardId) => {
        const player = cardPlayer(cardId);
        return player ? [nameKey(player)] : [];
      }),
    );
    const usedCards = new Set<string>();

    return benchSlots.map((cardId) => {
      if (!cardId || inSquad.has(cardId) || usedCards.has(cardId)) return null;

      const card = rawCards.find((entry) => entry.id === cardId);
      const player = card ? getPlayerById(card.playerId) : null;
      if (!card || !player || usedNames.has(nameKey(player))) return null;

      usedCards.add(card.id);
      usedNames.add(nameKey(player));
      return { card, player };
    });
  }, [benchSlots, cardPlayer, rawCards, squad]);

  /** คนที่ยังไม่ได้อยู่ทั้งในสนามและบนม้านั่ง — รายการให้เลือกใส่ม้านั่ง */
  const reserves = useMemo<BenchCard[]>(() => {
    const taken = new Set(benchCards.flatMap((entry) => (entry ? [entry.card.id] : [])));
    return bench.filter((entry) => !taken.has(entry.card.id));
  }, [bench, benchCards]);

  /**
   * บัญชีที่ยังไม่เคยจัดม้านั่ง (หรือเพิ่งสมัคร) — เติมให้อัตโนมัติจากคนค่าพลังสูงสุดที่เหลือ
   * ทำครั้งเดียวเท่านั้น เพราะพอเติมแล้ว benchSlots จะไม่ว่างอีก เงื่อนไขจึงไม่เข้าอีกรอบ
   * (คลังว่างจริง ๆ ก็จะไม่ setState เลย ไม่มีทางวนลูป)
   */
  const benchEmpty = benchSlots.every((cardId) => !cardId);
  useEffect(() => {
    if (!benchEmpty || reserves.length === 0) return;

    const usedNames = new Set<string>();
    const picks: Array<string | null> = emptyBench();
    const ranked = [...reserves].sort((a, b) => b.player.ovr - a.player.ovr);

    let index = 0;
    for (const entry of ranked) {
      if (index >= BENCH_SIZE) break;
      const key = nameKey(entry.player);
      if (usedNames.has(key)) continue;
      usedNames.add(key);
      picks[index] = entry.card.id;
      index += 1;
    }

    if (picks.some(Boolean)) setBenchSlots(picks);
  }, [benchEmpty, reserves]);

  const value = useMemo<TeamContextValue>(() => {
    const team: Team = {
      id: account?.id ?? 'team-user',
      name: account?.teamName ?? 'My Club',
      formationId,
      squad: formation.slots.map((slot) => ({ slotId: slot.id, cardId: squad[slot.id] ?? null })),
      bench: benchCards.flatMap((entry) => (entry ? [entry.card.id] : [])),
    };

    return {
      team,
      formation,
      ratedSlots,
      rating: calculateTeamRating(ratedSlots),
      bench,
      benchCards,
      reserves,
      assignBench,
      canAssignBench,
      clearBench,
      substitute,
      namesInSquad,
      suspendedCardIds,
      suspensionRemaining,
      changeFormation,
      assignCard,
      canAssign,
      swapSlots,
      clearSlot,
      squadLock: UNLOCKED,
    };
  }, [
    account,
    assignBench,
    assignCard,
    bench,
    benchCards,
    canAssign,
    canAssignBench,
    clearBench,
    reserves,
    substitute,
    changeFormation,
    clearSlot,
    formation,
    formationId,
    namesInSquad,
    ratedSlots,
    squad,
    suspendedCardIds,
    suspensionRemaining,
    swapSlots,
  ]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};

export const useTeam = (): TeamContextValue => {
  const context = useContext(TeamContext);
  if (!context) throw new Error('useTeam ต้องถูกใช้ภายใน <TeamProvider>');
  return context;
};
