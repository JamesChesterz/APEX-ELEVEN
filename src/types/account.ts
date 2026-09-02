/**
 * โครงสร้างข้อมูลบัญชีผู้เล่น (ระบบสมัคร/เข้าสู่ระบบ)
 *
 * เฟสนี้เก็บทุกอย่างไว้ใน localStorage ของเครื่องผู้เล่นเอง
 * ตอนต่อ backend จริงให้ย้าย AccountState ไปเป็น response ของ API
 * แล้วเปลี่ยนเฉพาะ services/accountStore.ts — ส่วนอื่นของแอปไม่ต้องแก้
 */
import type { PlayerCard } from './card';
import type { LuckyGridState } from './lucky';
import type { PassProgress, PassTotals } from './pass';
import type { MatchResult, RankRecord } from './match';
import type { FormationId } from './team';
import type { Tactics } from '@/match-engine/tactics';

/** ซีซันที่กำลังเล่นอยู่ */
export interface SeasonState {
  /** เลขซีซัน เริ่มที่ 1 */
  number: number;
  /** เวลาที่ซีซันนี้เริ่ม (ISO string) — ใช้คำนวณวันหมดอายุ */
  startedAt: string;
}

/** สถิติของผู้เล่นในลีกประจำวัน (คะแนนลีกใช้ระบบ 3-1-0) */
export interface LeagueDaily {
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

/** สถานะการเข้าร่วมลีกประจำวัน */
export interface LeagueState {
  /** เข้าร่วมลีกอยู่หรือไม่ */
  joined: boolean;
  /** เวลาที่กดเข้าร่วมครั้งล่าสุด (ISO) */
  joinedAt: string | null;
  /** เวลาเริ่มของวันแข่งปัจจุบัน = 06:00 (ISO) */
  dayStartedAt: string;
  /** เวลาของรอบล่าสุดที่ประมวลผลไปแล้ว (ISO) */
  lastRoundAt: string | null;
  /** เวลาที่เปลี่ยนตัวครั้งล่าสุด ใช้นับคูลดาวน์ 1 ชั่วโมง (null = ยังไม่เคยเปลี่ยน) */
  lastSquadChangeAt: string | null;
  daily: LeagueDaily;
}

/**
 * ตัวนับรายวันของภารกิจและแต้มตีบวก
 * ผูกกับ "วันแข่ง" ชุดเดียวกับลีก (เริ่ม 06:00) — ข้ามวันแล้วเริ่มนับใหม่จากศูนย์
 */
export interface UpgradeDaily {
  /** กุญแจของวันแข่งที่ตัวเลขชุดนี้เป็นของ */
  dayKey: string;
  /** ลงแข่งไปแล้วกี่นัดวันนี้ (ทุกโหมด) */
  matchesPlayed: number;
  /** ชนะไปแล้วกี่นัดวันนี้ */
  wins: number;
  /** ชนะทีมที่ค่าพลังสูงกว่าไปแล้วกี่นัด */
  winsOverStronger: number;
  /** เปิดซองไปแล้วกี่ซองวันนี้ */
  packsOpened: number;
  /** ชนะแล้วได้แต้มตีบวกไปแล้วกี่นัด (เพดาน 30 นัดต่อวัน) */
  rewardedWins: number;
  /** กดรับรางวัล "ทำภารกิจครบ" ของวันนี้ไปแล้วหรือยัง */
  missionsClaimed: boolean;
}

/** ความคืบหน้าทั้งหมดของบัญชีหนึ่ง (เซฟลงเครื่องทุกครั้งที่เปลี่ยน) */
export interface AccountState {
  /** เหรียญคงเหลือ */
  coins: number;
  /** แต้มแลกนักเตะ — ได้จากการย่อยการ์ด ใช้ในร้านแลกนักเตะ */
  points: number;
  /**
   * แต้มตีบวก — ได้จากภารกิจ/ลีก/ชนะ Matchmaking
   *
   * ⚠️ ไม่ใช่ค่าอัปเกรดแล้ว (การอัปเกรดใช้ "การ์ดนักเตะ" แทน)
   * ตอนนี้ใช้ซื้อไอเทมช่วยอัปเกรดในหน้าอัปเกรด — แต้มที่ผู้เล่นเก็บไว้เดิมไม่หายไปไหน
   */
  upgradePoints?: number;
  /**
   * การ์ดป้องกันคงเหลือ (ของเดิม)
   *
   * ⚠️ เก็บไว้เพื่อความเข้ากันได้กับเซฟเก่าและ Cloud Function เท่านั้น
   * ระบบใหม่อ่าน/เขียนที่ upgradeItems.protect แล้วมิเรอร์ค่ากลับมาที่ฟิลด์นี้ให้
   */
  protectCards?: number;
  /**
   * ไอเทมช่วยอัปเกรดที่ถืออยู่ (เพิ่มโอกาส / ป้องกันลดขั้น / การันตีขั้น)
   * ไม่มี = บัญชีเก่า ระบบจะยก protectCards เดิมมาเป็น protect ให้เอง
   */
  upgradeItems?: {
    boost?: number;
    protect?: number;
    guarantee?: number;
  };
  /** ตัวนับรายวันของภารกิจและแต้มตีบวก */
  upgradeDaily?: UpgradeDaily;
  /** ความคืบหน้าในกล่องสุ่มรางวัลแบบตาราง (เมนู Lucky Box) */
  luckyGrid?: LuckyGridState;
  /** XP สะสมของ FC ALLSTAR PASS ซีซันปัจจุบัน (ได้จากการลงแข่ง Matchmaking) */
  passXp?: number;
  /** ตั๋วพาสคงเหลือ — ใช้ปลดล็อกสาย PREMIUM / PREMIUM+ */
  passTickets?: number;
  /**
   * ยอดสะสมตลอดชีพ (ลงแข่ง / ชนะ / เปิดแพ็ค) — ใช้คิดความคืบหน้าภารกิจพาส
   * นับต่อเนื่องไม่รีเซ็ต ส่วนการแยกรายซีซันทำโดยลบยอดตั้งต้นที่จดไว้ใน PassProgress
   */
  passTotals?: PassTotals;
  /** สายที่ปลดล็อกไว้และรางวัลที่รับไปแล้วในพาสซีซันปัจจุบัน */
  pass?: PassProgress;
  /** การ์ดทั้งหมดในคลัง */
  cards: PlayerCard[];
  /** สถิติซีซัน ใช้คิดคะแนน ranking และระดับ */
  record: RankRecord;
  /** แผนการเล่นล่าสุดที่เลือกไว้ */
  formationId: FormationId;
  /**
   * แทคติกที่ผู้จัดการทีมตั้งไว้ (ไม่มี = บัญชีเก่าที่ยังไม่เคยตั้ง ใช้ค่ากลางทั้งหมด)
   * เป็น optional เพื่อให้เซฟเดิมของผู้เล่นทุกคนโหลดต่อได้โดยไม่ต้องแปลงข้อมูล
   */
  tactics?: Tactics;
  /** ตัวจริงที่จัดไว้: slotId → cardId (null = ช่องว่าง) */
  squad: Record<string, string | null>;
  /**
   * ม้านั่งสำรองที่ประกาศลงแข่ง เรียงตามเบอร์ (index 0 = เบอร์ 12)
   * null = ช่องว่าง · บัญชีเก่าที่ยังไม่มีค่านี้จะถูกเติมให้อัตโนมัติจากคนค่าพลังสูงสุดที่เหลือ
   */
  benchSlots?: Array<string | null>;
  /** ซีซันปัจจุบัน — บัญชีเก่าที่ยังไม่มีค่านี้จะถูกเติมให้อัตโนมัติตอนโหลด */
  season?: SeasonState;
  /** สถานะลีกประจำวัน — บัญชีเก่าจะถูกเติมให้อัตโนมัติตอนโหลด */
  league?: LeagueState;
  /** ผลการแข่งย้อนหลัง ใหม่สุดอยู่บน (จำกัดจำนวนตาม HISTORY_LIMIT) */
  matchHistory?: MatchResult[];
  /**
   * เวลาของคำสั่งรีเซ็ตดาวจากแอดมินที่บัญชีนี้ทำตามไปแล้ว (ISO)
   * ใช้เทียบกับ config/ladder.resetAt — ยังไม่ถึงเวลานั้น = ต้องรีเซ็ตตัวเองหนึ่งครั้ง
   */
  ladderResetAt?: string;
  /**
   * คู่แข่งที่เพิ่งเจอไป — ใช้กันการรัวท้าคนเดิมเพื่อปั้มดาว
   * เก็บลงบัญชีเพื่อให้คูลดาวน์ตามไปทุกเครื่อง เลี่ยงด้วยการรีเฟรชไม่ได้
   */
  recentRivals?: RecentRival[];
  /**
   * รูปโปรไฟล์เป็น data URL ที่ย่อแล้ว (ดู services/avatar.ts)
   * เก็บไว้ในบัญชีตรง ๆ แทนการใช้ Firebase Storage ซึ่งต้องเปิดแพลนแบบผูกบัตร
   */
  avatar?: string;
  /**
   * นักเตะที่โดนใบแดงแล้วติดโทษแบน: cardId → จำนวนนัดที่เหลือต้องเว้น (เริ่มที่ 3)
   * นับถอยหลังทีละ 1 ทุกครั้งที่จบนัด Matchmaking หนึ่งนัด แล้วลบทิ้งเมื่อครบ
   * ระหว่างติดโทษ จัดนักเตะคนนี้ลง 11 ตัวจริงไม่ได้ (บังคับที่ useTeam)
   */
  suspensions?: Record<string, number>;
}

/** บันทึกว่าเจอคู่แข่งคนนี้ครั้งล่าสุดเมื่อไหร่ */
export interface RecentRival {
  /** uid ของผู้เล่น (หรือ id ของทีมระบบในโหมดออฟไลน์) */
  id: string;
  /** เวลาที่เจอ (ISO) */
  at: string;
}

/** บัญชีหนึ่งบัญชี */
export interface Account {
  id: string;
  /** ไอดีที่ใช้เข้าสู่ระบบ (ไม่ซ้ำกัน ตัวพิมพ์เล็ก-ใหญ่ไม่มีผล) */
  username: string;
  /**
   * รหัสผ่านที่ผ่านการแปลงแล้ว
   * หมายเหตุ: เป็นการแปลงฝั่ง client เพื่อไม่ให้เก็บรหัสดิบใน localStorage เท่านั้น
   * ไม่ใช่ระบบความปลอดภัยจริง — ของจริงต้อง hash ที่ฝั่งเซิร์ฟเวอร์
   */
  passwordHash: string;
  /** ชื่อผู้จัดการทีมที่แสดงในตารางอันดับ */
  managerName: string;
  /** ชื่อสโมสร */
  teamName: string;
  createdAt: string;
  state: AccountState;
}

/** บัญชีแบบไม่มีข้อมูลลับ ใช้ส่งต่อใน UI */
export type PublicAccount = Omit<Account, 'passwordHash'>;
