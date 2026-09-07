/**
 * ทีมพิเศษ (Squad Bonus) — ตรรกะที่พลาดแล้วเจ็บ
 *
 * สามเรื่องที่ต้องถูกเป๊ะ:
 *   1. normalizeSquadBonus ต้องกันค่าเพี้ยนจากเซิร์ฟเวอร์ไม่ให้ดัน Team OVR ของทั้งเกม
 *   2. ชุดต้องครบ "ทุกคน" ถึงจะได้โบนัส — ขาดคนเดียวต้องได้ 0
 *   3. โบนัสต้องไหลเข้า matchOvr จริง ไม่ใช่แค่โชว์บนหน้าจอ
 */
import { describe, expect, it } from 'vitest';
import { PLAYERS } from '@/data/players';
import {
  DEFAULT_SQUAD_BONUS,
  normalizeSquadBonus,
  squadBonusProgress,
  squadBonusTeamIssues,
  SQUAD_BONUS_LIMITS,
  totalSquadBonus,
} from '@/services/squadBonus';
import { calculateTeamRating, type RatedSlot } from '@/services/teamRating';
import type { SquadBonusConfig, SquadBonusTeam } from '@/types/team';

/** id นักเตะจริงจากคลัง — normalize ทิ้ง id ที่ไม่มีอยู่จริง จึงกุขึ้นเองไม่ได้ */
const ids = PLAYERS.slice(0, 12).map((player) => player.id);

const team = (overrides: Partial<SquadBonusTeam> = {}): SquadBonusTeam => ({
  id: 'set-a',
  name: 'ชุดทดสอบ',
  description: '',
  playerIds: ids.slice(0, 11),
  bonus: DEFAULT_SQUAD_BONUS,
  enabled: true,
  ...overrides,
});

const config = (teams: SquadBonusTeam[], enabled = true): SquadBonusConfig => ({ enabled, teams });

describe('normalizeSquadBonus', () => {
  it('ยังไม่เคยตั้ง = ปิดและไม่มีชุดเลย', () => {
    expect(normalizeSquadBonus(null)).toEqual({ enabled: false, teams: [] });
  });

  it('บีบโบนัสให้อยู่ในกรอบ', () => {
    const huge = normalizeSquadBonus(config([team({ bonus: 9999 })]));
    expect(huge.teams[0].bonus).toBe(SQUAD_BONUS_LIMITS.maxBonus);

    const negative = normalizeSquadBonus(config([team({ bonus: -20 })]));
    expect(negative.teams[0].bonus).toBe(SQUAD_BONUS_LIMITS.minBonus);
  });

  it('ตัดนักเตะเกิน 11 คน ชื่อซ้ำ และ id ที่ไม่มีอยู่จริงทิ้ง', () => {
    const dirty = normalizeSquadBonus(
      config([team({ playerIds: [...ids, ids[0], 'ไม่มีคนนี้จริง'] })]),
    );

    expect(dirty.teams[0].playerIds).toHaveLength(SQUAD_BONUS_LIMITS.maxPlayers);
    expect(dirty.teams[0].playerIds).not.toContain('ไม่มีคนนี้จริง');
    expect(new Set(dirty.teams[0].playerIds).size).toBe(SQUAD_BONUS_LIMITS.maxPlayers);
  });

  it('ทิ้งชุดที่ไม่มีนักเตะเลย (ไม่งั้นทุกคนได้โบนัสฟรี)', () => {
    expect(normalizeSquadBonus(config([team({ playerIds: [] })])).teams).toHaveLength(0);
  });

  it('เก็บได้ไม่เกินเพดานจำนวนชุด', () => {
    const many = Array.from({ length: SQUAD_BONUS_LIMITS.maxTeams + 5 }, (_, index) =>
      team({ id: `set-${index}` }),
    );
    expect(normalizeSquadBonus(config(many)).teams).toHaveLength(SQUAD_BONUS_LIMITS.maxTeams);
  });
});

describe('squadBonusProgress', () => {
  it('ครบทุกคน = ได้โบนัส', () => {
    const progress = squadBonusProgress(ids.slice(0, 11), config([team()]));

    expect(progress[0].complete).toBe(true);
    expect(progress[0].missing).toEqual([]);
    expect(totalSquadBonus(progress)).toBe(DEFAULT_SQUAD_BONUS);
  });

  it('ขาดคนเดียวก็ไม่ได้โบนัส แต่ยังบอกได้ว่าขาดใคร', () => {
    const progress = squadBonusProgress(ids.slice(0, 10), config([team()]));

    expect(progress[0].complete).toBe(false);
    expect(progress[0].matched).toHaveLength(10);
    expect(progress[0].missing).toEqual([ids[10]]);
    expect(totalSquadBonus(progress)).toBe(0);
  });

  it('ช่องว่างในสนามไม่นับเป็นนักเตะ', () => {
    const withHoles = [...ids.slice(0, 10), null];
    expect(squadBonusProgress(withHoles, config([team()]))[0].complete).toBe(false);
  });

  it('ปิดสวิตช์ใหญ่ หรือปิดเฉพาะชุด = ไม่มีโบนัส', () => {
    expect(squadBonusProgress(ids, config([team()], false))).toHaveLength(0);
    expect(squadBonusProgress(ids, config([team({ enabled: false })]))).toHaveLength(0);
  });

  it('เข้าเงื่อนไขหลายชุดพร้อมกันได้ แต่ไม่เกินเพดานรวม', () => {
    const shortSets = Array.from({ length: 10 }, (_, index) =>
      team({ id: `set-${index}`, playerIds: [ids[index]], bonus: SQUAD_BONUS_LIMITS.maxBonus }),
    );

    const progress = squadBonusProgress(ids, config(shortSets));
    expect(progress.every((entry) => entry.complete)).toBe(true);
    expect(totalSquadBonus(progress)).toBe(SQUAD_BONUS_LIMITS.maxTotalBonus);
  });
});

describe('squadBonusTeamIssues', () => {
  it('ชุดที่ตั้งครบถ้วนบันทึกได้', () => {
    expect(squadBonusTeamIssues(team(), [])).toEqual([]);
  });

  it('ไม่มีนักเตะ / ไม่มีชื่อ / รหัสซ้ำ = บันทึกไม่ได้', () => {
    expect(squadBonusTeamIssues(team({ playerIds: [] }), []).length).toBeGreaterThan(0);
    expect(squadBonusTeamIssues(team({ name: '  ' }), []).length).toBeGreaterThan(0);
    expect(squadBonusTeamIssues(team(), [team()]).length).toBeGreaterThan(0);
  });
});

describe('calculateTeamRating กับโบนัสทีมพิเศษ', () => {
  const slots = (): RatedSlot[] =>
    PLAYERS.slice(0, 11).map((player, index) => ({
      slot: { id: `s${index}`, position: player.position, x: 50, y: 50 },
      player,
    }));

  it('โบนัสถูกบวกเข้า matchOvr ไม่ใช่ ovr พื้นฐาน', () => {
    const base = calculateTeamRating(slots());
    const boosted = calculateTeamRating(slots(), 5);

    expect(boosted.ovr).toBe(base.ovr);
    expect(boosted.squadBonus).toBe(5);
    expect(boosted.matchOvr).toBe(base.matchOvr + 5);
  });

  it('ค่าเพี้ยน (ติดลบ/NaN) ไม่หัก Team OVR ทิ้ง', () => {
    expect(calculateTeamRating(slots(), -50).matchOvr).toBe(calculateTeamRating(slots()).matchOvr);
    expect(calculateTeamRating(slots(), Number.NaN).squadBonus).toBe(0);
  });
});
