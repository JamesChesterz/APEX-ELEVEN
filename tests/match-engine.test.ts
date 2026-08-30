/**
 * เทสของ Match Engine — รันแบบไม่มี DOM ได้ เพราะเอนจินไม่แตะ canvas เลย
 * เช็คสิ่งที่ Acceptance Criteria ของ PHASE 1 กำหนดไว้ทีละข้อ
 */
import { describe, expect, it } from 'vitest';
import { FORMATIONS, getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import { createMatch, formationToWorld, PITCH } from '@/match-engine';
import type { MatchTeamInput } from '@/match-engine';

/** ปั้นทีมทดสอบจากแผนจริงและนักเตะจริงในเกม (ไม่ hardcode นักเตะ 22 คน) */
const buildTeam = (formationId: string, side: 'home' | 'away'): MatchTeamInput => {
  const formation = getFormationById(formationId);

  return {
    id: `${side}-team`,
    name: side === 'home' ? 'ทีมเรา' : 'ทีมคู่แข่ง',
    formationName: formation.name,
    color: '#3ED2A0',
    accent: '#04241A',
    players: formation.slots.map((slot, index) => {
      const player = PLAYERS[index % PLAYERS.length];
      return {
        id: `${side}-${slot.id}`,
        name: player.name,
        shirtNumber: index + 1,
        position: slot.position,
        ovr: player.ovr,
        pace: player.stats.pace,
        slotId: slot.id,
        formationX: slot.x,
        formationY: slot.y,
      };
    }),
  };
};

/** เดินการจำลองไปข้างหน้าตามจำนวนวินาทีที่กำหนด ด้วย timestep คงที่ */
const run = (match: ReturnType<typeof createMatch>, seconds: number): void => {
  const step = 1 / 60;
  for (let index = 0; index < Math.round(seconds / step); index += 1) match.tick(step);
};

describe('MatchEngine (PHASE 1)', () => {
  it('ลงสนาม 22 คนจากแผนจริงของทั้งสองทีม', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'));

    expect(match.players).toHaveLength(22);
    expect(match.home.players).toHaveLength(11);
    expect(match.away.players).toHaveLength(11);
  });

  it('ตำแหน่งเริ่มต้นตรงกับ formation และแต่ละทีมอยู่คนละครึ่งสนาม', () => {
    const home = buildTeam('4-3-3', 'home');
    const match = createMatch(home, buildTeam('4-3-3', 'away'));

    home.players.forEach((input) => {
      const agent = match.home.players.find((entry) => entry.slotId === input.slotId);
      const expected = formationToWorld(input.formationX, input.formationY, 'home');
      expect(agent?.position2d.x).toBeCloseTo(expected.x, 5);
      expect(agent?.position2d.y).toBeCloseTo(expected.y, 5);
    });

    // ผู้รักษาประตูของสองทีมต้องอยู่คนละปลายสนาม
    const homeKeeper = match.home.players.find((agent) => agent.role === 'gk');
    const awayKeeper = match.away.players.find((agent) => agent.role === 'gk');
    expect(homeKeeper?.position2d.x).toBeLessThan(PITCH.length / 2);
    expect(awayKeeper?.position2d.x).toBeGreaterThan(PITCH.length / 2);
  });

  it('นักเตะเคลื่อนที่จริง แต่ยังอยู่ในสนามและไม่หลุดรูปทีม', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-2-3-1', 'away'));
    const before = match.players.map((agent) => ({ ...agent.position2d }));

    run(match, 20);

    const moved = match.players.filter((agent, index) => {
      const start = before[index];
      return Math.hypot(agent.position2d.x - start.x, agent.position2d.y - start.y) > 1;
    });
    expect(moved.length).toBeGreaterThan(15);

    match.players.forEach((agent) => {
      expect(agent.position2d.x).toBeGreaterThanOrEqual(0);
      expect(agent.position2d.x).toBeLessThanOrEqual(PITCH.length);
      expect(agent.position2d.y).toBeGreaterThanOrEqual(0);
      expect(agent.position2d.y).toBeLessThanOrEqual(PITCH.width);

      // ห่างจากตำแหน่งบ้านได้ แต่ไม่ใช่วิ่งไปคนละมุมสนาม
      const drift = Math.hypot(
        agent.position2d.x - agent.formationPosition.x,
        agent.position2d.y - agent.formationPosition.y,
      );
      expect(drift).toBeLessThan(38);
    });
  });

  it('ผู้รักษาประตูอยู่ในเขตของตัวเองเสมอ', () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('3-5-2', 'away'));
    run(match, 45);

    const homeKeeper = match.home.players.find((agent) => agent.role === 'gk');
    const awayKeeper = match.away.players.find((agent) => agent.role === 'gk');

    expect(homeKeeper?.position2d.x ?? 99).toBeLessThan(PITCH.penaltyDepth + 2);
    expect(awayKeeper?.position2d.x ?? 0).toBeGreaterThan(PITCH.length - PITCH.penaltyDepth - 2);
  });

  it('มีคนไล่บอลฝั่งละหนึ่งคน และนักเตะตอบสนองต่อตำแหน่งบอล', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-3-3', 'away'));
    run(match, 8);

    expect(match.chaserIds.home).toBeTruthy();
    expect(match.chaserIds.away).toBeTruthy();

    const chaser = match.players.find((agent) => agent.id === match.chaserIds.home);
    expect(chaser?.state).toBe('MOVING_TO_BALL');
    // คนไล่บอลต้องอยู่ใกล้บอลกว่าเพื่อนร่วมทีมคนอื่น
    const gaps = match.home.players.map((agent) => agent.distanceTo(match.ball.position));
    expect(chaser?.distanceTo(match.ball.position)).toBeCloseTo(Math.min(...gaps), 5);
  });

  it('นาฬิกาเดินตามเวลาจริงและหยุดที่นาที 90', () => {
    const match = createMatch(buildTeam('4-4-2', 'home'), buildTeam('4-4-2', 'away'), {
      minutesPerSecond: 10,
    });

    run(match, 3);
    expect(match.clock.minute).toBeGreaterThanOrEqual(29);
    expect(match.clock.minute).toBeLessThanOrEqual(31);

    run(match, 10);
    expect(match.clock.minute).toBe(90);
    expect(match.phase).toBe('fulltime');
  });

  it('หยุดเกมแล้วทุกคนหยุดนิ่ง', () => {
    const match = createMatch(buildTeam('4-3-3', 'home'), buildTeam('4-4-2', 'away'));
    run(match, 5);

    match.setPaused(true);
    const frozen = match.players.map((agent) => ({ ...agent.position2d }));
    run(match, 3);

    match.players.forEach((agent, index) => {
      expect(agent.position2d.x).toBeCloseTo(frozen[index].x, 8);
      expect(agent.position2d.y).toBeCloseTo(frozen[index].y, 8);
    });
  });

  it('รองรับทุกแผนที่มีในเกมโดยไม่พัง', () => {
    FORMATIONS.forEach((formation) => {
      const match = createMatch(buildTeam(formation.id, 'home'), buildTeam(formation.id, 'away'));
      run(match, 10);
      expect(match.players).toHaveLength(22);
    });
  });
});
