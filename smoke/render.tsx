/**
 * ทดสอบว่าคอมโพเนนต์ render ได้จริงโดยไม่ crash
 * รันบน node (react-dom/server) จึงไม่ต้องมีเบราว์เซอร์ — จับ error ตอน render
 * เช่น อ่านค่าจาก undefined, ข้อมูลไม่ครบ, id ที่ไม่มีอยู่จริง
 */
import { renderToString } from 'react-dom/server';
import { Avatar } from '@/components/profile/Avatar';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { LeagueStandingsTable } from '@/components/league/LeagueStandingsTable';
import { Pagination } from '@/components/leaderboard/Pagination';
import { SquadPreviewModal } from '@/components/leaderboard/SquadPreviewModal';
import { buildDailyStandings, buildLeagueMembers, EMPTY_DAILY, LEAGUE_SIZE, type LeagueMember } from '@/services/league';
import { buildDefenseResult, findOpponent, getRankingPoints } from '@/services/matchmaking';
import { buildRankReward, getRewardPlayer, normalizeRankRewards, SHOWCASE_ORDER } from '@/services/rankRewards';
import { filterAvailable, isOnCooldown, rememberRival } from '@/services/rivals';
import { AVATAR_MAX_CHARS, isSafeAvatar } from '@/services/avatar';
import type { PublicProfile } from '@/services/firebase/profiles';
import { getFormationById } from '@/data/formations';
import { PLAYERS } from '@/data/players';
import type { LeaderboardEntry, Opponent } from '@/types/match';

let failed = 0;
const check = (label: string, condition: boolean) => {
  console.log(`${condition ? 'ผ่าน' : 'ไม่ผ่าน'}  ${label}`);
  if (!condition) failed += 1;
};

/* ── 1. ตารางอันดับ ─────────────────────────────────────── */

const entries: LeaderboardEntry[] = [
  { rank: 1, uid: 'u1', managerName: 'jameskrub', teamName: 'James Chester', teamOvr: 84, points: 12, wins: 12, draws: 0, losses: 0 },
  { rank: 2, managerName: 'ทีมจำลอง', teamName: 'ชื่อทีมที่ยาวมากจนต้องตัดคำบนจอมือถือ', teamOvr: 80, points: 5, wins: 6, draws: 1, losses: 1 },
  { rank: 3, uid: 'u3', managerName: 'ผู้เล่นที่ดาวติดลบ', teamName: 'Zero FC', teamOvr: 70, points: 0, wins: 0, draws: 0, losses: 9, isCurrentUser: true },
];

check('ตารางอันดับ render ได้', renderToString(<LeaderboardTable entries={entries} />).length > 0);
check('ตารางอันดับว่างเปล่าไม่พัง', renderToString(<LeaderboardTable entries={[]} />).length > 0);

/* ── 2. หน้าต่างดูตัวจริง ───────────────────────────────── */

const formation = getFormationById('4-3-3');
const full: PublicProfile = {
  uid: 'u1', managerName: 'ทดสอบ', teamName: 'Test FC', teamOvr: 84, formationId: '4-3-3',
  points: 12, wins: 12, draws: 0, losses: 0, updatedAtMs: Date.now(),
  squad: formation.slots.map((slot, index) => ({ slotId: slot.id, playerId: PLAYERS[index].id, level: (index % 5) + 1 })),
};

check('ตัวจริงครบ 11', renderToString(<SquadPreviewModal profile={full} onClose={() => {}} />).length > 0);
check('จัดไม่ครบ', renderToString(<SquadPreviewModal profile={{ ...full, squad: full.squad.slice(0, 4) }} onClose={() => {}} />).length > 0);
check('ยังไม่ประกาศตัวจริง', renderToString(<SquadPreviewModal profile={{ ...full, squad: [] }} onClose={() => {}} />).length > 0);
check(
  'playerId ที่ไม่มีในเกมแล้ว (นักเตะถูกลบ)',
  renderToString(<SquadPreviewModal profile={{ ...full, squad: full.squad.map((e) => ({ ...e, playerId: 'ไม่มีจริง' })) }} onClose={() => {}} />).length > 0,
);
check('ปิดอยู่ = ไม่ render อะไรเลย', renderToString(<SquadPreviewModal profile={null} onClose={() => {}} />) === '');

/* ── 3. กติกาดาว ────────────────────────────────────────── */

check('ชนะได้ +1 ดาว', getRankingPoints('win') === 1);
check('เสมอได้ 0 ดาว', getRankingPoints('draw') === 0);
check('แพ้เสีย -1 ดาว', getRankingPoints('loss') === -1);

const defense = buildDefenseResult({
  id: 'r1', fromUid: 'u9', fromTeamName: 'ผู้มาท้า', fromTeamOvr: 80, toTeamOvr: 84,
  teamScore: 2, opponentScore: 1, events: [], playedAt: new Date().toISOString(),
});
check('ถูกท้าแล้วชนะ ก็ได้ +1 ดาวเหมือนกัน', defense.rankingPoints === 1 && defense.mode === 'defense');

const cheat = buildDefenseResult({
  id: 'r2', fromUid: 'u9', fromTeamName: 'โกง', fromTeamOvr: 9999, toTeamOvr: -50,
  teamScore: 999, opponentScore: -5, events: [], playedAt: new Date().toISOString(),
});
check(
  'สกอร์/ค่าพลังเกินจริงถูกบีบให้อยู่ในช่วงที่ยอมรับได้',
  cheat.teamScore === 20 && cheat.opponentScore === 0 && cheat.opponentOvr === 120 && cheat.teamOvr === 0,
);

/* ── 4. จับคู่เฉพาะคนจริง + คูลดาวน์กันปั้มดาว ──────────── */

const human: Opponent = { id: 'u2', name: 'คนจริง', manager: 'm', ovr: 84, formationId: '4-3-3', difficulty: 'normal', rewardCoins: 1000, isBot: false };

check('ไม่มีคนให้เจอ = คืน null (ไม่แอบยัดบอท)', findOpponent(84, [], false) === null);
check('มีคนจริง = เจอคนจริง', findOpponent(84, [human], false)?.id === 'u2');
check('โหมดออฟไลน์เท่านั้นที่ยอมให้เจอบอท', findOpponent(84, [], true) !== null);

const after = rememberRival([], 'u2');
check('เพิ่งเจอคนนี้ = ติดคูลดาวน์', isOnCooldown(after, 'u2'));
check('คนที่ติดคูลดาวน์ถูกตัดออกจากคิว', filterAvailable([human], after).length === 0);
check(
  'พ้น 31 นาทีแล้วเจอได้อีก',
  !isOnCooldown([{ id: 'u2', at: new Date(Date.now() - 31 * 60 * 1000).toISOString() }], 'u2'),
);

/* ── 5. รูปโปรไฟล์ ──────────────────────────────────────── */

const realAvatar = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4H';

check('รูปที่ย่อมาถูกต้อง ใช้ได้', isSafeAvatar(realAvatar));
check('ไม่มีรูป = ไม่ใช้', !isSafeAvatar(undefined) && !isSafeAvatar(''));
check('ลิงก์ javascript: ถูกปฏิเสธ', !isSafeAvatar('javascript:alert(1)'));
check('ลิงก์เว็บนอกถูกปฏิเสธ (กันดึงรูปจากเซิร์ฟเวอร์คนอื่น)', !isSafeAvatar('https://example.com/a.png'));
check('svg ถูกปฏิเสธ (ฝัง script ได้)', !isSafeAvatar('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='));
check('รูปที่ใหญ่เกินเพดานถูกปฏิเสธ', !isSafeAvatar(`data:image/webp;base64,${'A'.repeat(AVATAR_MAX_CHARS)}`));

check('รูปโปรไฟล์ render ได้', renderToString(<Avatar src={realAvatar} name="james" size="lg" />).includes('<img'));
check(
  'ไม่มีรูป = ใช้ตัวอักษรแรกแทน',
  renderToString(<Avatar src={null} name="james" size="sm" />).includes('J'),
);
check(
  'รูปอันตรายไม่ถูกนำไปแสดง',
  !renderToString(<Avatar src="javascript:alert(1)" name="hacker" />).includes('javascript'),
);
check(
  'ตารางอันดับที่มีรูป render ได้',
  renderToString(<LeaderboardTable entries={entries.map((e) => ({ ...e, avatar: realAvatar }))} />).includes('<img'),
);

/* ── 6. แบ่งหน้าตารางอันดับ ─────────────────────────────── */

const pagerHtml = (page: number, total: number) =>
  renderToString(<Pagination page={page} totalPages={total} onChange={() => {}} />);

check('มีหน้าเดียว = ไม่ต้องโชว์แถบแบ่งหน้า', pagerHtml(1, 1) === '');
check('หลายหน้า = โชว์แถบแบ่งหน้า', pagerHtml(1, 5).includes('<button'));
check('หน้าน้อยกว่า 8 หน้า ไม่ต้องย่อ', !pagerHtml(3, 7).includes('…'));
check('หน้าเยอะ = ย่อด้วยจุดไข่ปลา', pagerHtml(10, 40).includes('…'));
check('หน้าแรกกับหน้าสุดท้ายโชว์เสมอ', pagerHtml(10, 40).includes('>40<') && pagerHtml(10, 40).includes('>1<'));

// อันดับที่โชว์ต้องเป็นอันดับจริงของทั้งเซิร์ฟเวอร์ ไม่ใช่ลำดับในหน้านั้น
const many: LeaderboardEntry[] = Array.from({ length: 45 }, (_, index) => ({
  rank: index + 1,
  uid: `u${index}`,
  managerName: `ผู้เล่น ${index + 1}`,
  teamName: `ทีม ${index + 1}`,
  teamOvr: 90 - index,
  points: 45 - index,
  wins: 45 - index,
  draws: 0,
  losses: index,
}));

const pageTwo = renderToString(<LeaderboardTable entries={many.slice(20, 40)} />);
check('หน้า 2 เริ่มที่อันดับ 21', pageTwo.includes('ทีม 21') && !pageTwo.includes('ทีม 20<'));
check('หน้า 2 จบที่อันดับ 40', pageTwo.includes('ทีม 40') && !pageTwo.includes('ทีม 41'));

/* ── 7. ลีกประจำวันจากผู้เล่นจริง ───────────────────────── */

const leagueMember = (id: string, ovr: number): LeagueMember => ({
  id, teamName: `ทีม ${id}`, managerName: `ผู้จัดการ ${id}`, ovr, formationId: '4-3-3', isReal: true,
});

const crowd = Array.from({ length: 24 }, (_, index) => leagueMember(`u${index}`, 70 + index));
const myLeague = buildLeagueMembers(leagueMember('me', 85), crowd);
const standings = buildDailyStandings(myLeague, 'me', { ...EMPTY_DAILY, points: 9, wins: 3 }, '2026-1-1', 6);

check('ลีกได้ครบ 10 ทีม', myLeague.length === LEAGUE_SIZE);
check('ตารางลีก render ได้', renderToString(<LeagueStandingsTable standings={standings} />).length > 0);
check('ตารางลีกว่างเปล่าไม่พัง', renderToString(<LeagueStandingsTable standings={[]} />).length > 0);
check('แถวของเราถูกทำเครื่องหมายไว้', standings.some((row) => row.isCurrentUser && row.id === 'me'));
check(
  'ทีมสำรอง (ไม่ใช่คนจริง) กดดูทีมไม่ได้',
  !renderToString(
    <LeagueStandingsTable
      standings={standings.map((row) => ({ ...row, isReal: false }))}
      onSelect={() => {}}
    />,
  ).includes('ดูทีม'),
);
check(
  'ผู้เล่นจริงในลีกกดดูทีมได้',
  renderToString(<LeagueStandingsTable standings={standings} onSelect={() => {}} />).includes('ดูทีม'),
);

/* ── 8. รางวัลการ์ดตามอันดับ ────────────────────────────── */

const rewardCards = normalizeRankRewards();

check('รางวัลมีครบ 10 อันดับ', rewardCards.length === 10);
check('ทุกอันดับชี้ไปที่การ์ดที่มีอยู่จริง', rewardCards.every((_, index) => getRewardPlayer(index + 1, rewardCards) !== undefined));
check('อันดับ 1 อยู่ตรงกลางแถวโชว์', SHOWCASE_ORDER[5] === 1);
check('id ที่ตั้งผิดถอยไปใช้ค่าเริ่มต้น', getRewardPlayer(1, normalizeRankRewards(['ไม่มีจริง'])) !== undefined);
check('อันดับ 1 ได้การ์ดที่กำหนดไว้ 1 ใบ', buildRankReward(1, rewardCards).cards.length === 1);
check('ไม่ติดอันดับได้แพ็คสุ่ม 10 ใบ', buildRankReward(50, rewardCards).cards.length === 10);

console.log(failed === 0 ? '\nทั้งหมดผ่าน' : `\nไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
