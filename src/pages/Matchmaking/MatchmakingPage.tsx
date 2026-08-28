/**
 * หน้า MATCHMAKING — เต็มจอ ไม่มี sidebar/header ของเกม (กดปุ่ม "ออก" เพื่อกลับ)
 *
 * เลย์เอาต์ 3 คอลัมน์: รายชื่อทีมเรา | สนามที่ทั้งสองทีมยืนหันหน้าเข้าหากัน | รายชื่อทีมคู่แข่ง
 * แถวล่างอีก 3 ช่อง: ผู้เล่นบาดเจ็บ | ศูนย์กลางการหาคู่ | ผู้เล่นติดโทษแบน
 *
 * ฝั่งเรา (ครึ่งซ้าย) = 11 ตัวจริงล่าสุดจากหน้า MY TEAM เรียงตามแผนที่ใช้อยู่
 * ฝั่งคู่แข่ง (ครึ่งขวา) = ทีมจริงของเขาถ้ามีโปรไฟล์ ไม่มีก็ปั้นให้ใกล้เคียง OVR
 *
 * ต่างจากลีกประจำวัน (เมนู MATCH) ตรงที่ลีกเดินรอบให้เองทุก 30 นาที
 * ส่วนหน้านี้คือการลงแข่งเมื่อไหร่ก็ได้ที่อยากลง — รวมถึงเหตุการณ์บาดเจ็บ/ใบแดง
 * ที่อาจเกิดขึ้นกลางแมตช์ (บาดเจ็บต้องเปลี่ยนตัวก่อนแข่งต่อ, ใบแดงติดโทษแบน 3 นัดถัดไป)
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveChatPanel } from '@/components/chat/LiveChatPanel';
import { Modal } from '@/components/layout/Modal';
import { InjuryPanel, type InjuryEntry } from '@/components/matchmaking/InjuryPanel';
import { InjurySubModal } from '@/components/matchmaking/InjurySubModal';
import { MatchdayPitch, type OurPitchSlot } from '@/components/matchmaking/MatchdayPitch';
import { MatchHub } from '@/components/matchmaking/MatchHub';
import { MatchmakingTopBar } from '@/components/matchmaking/MatchmakingTopBar';
import { SquadListPanel, type SquadRow } from '@/components/matchmaking/SquadListPanel';
import { slotLabel } from '@/components/matchmaking/squadLabels';
import {
  SuspensionPanel,
  type SuspensionEntry,
} from '@/components/matchmaking/SuspensionPanel';
import { getFormationById } from '@/data/formations';
import { getPlayerById } from '@/data/players';
import { useAuth } from '@/hooks/useAuth';
import { useMyRank } from '@/hooks/useLeaderboard';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useOnline } from '@/hooks/useOnline';
import { usePlayers } from '@/hooks/usePlayers';
import { useTeam } from '@/hooks/useTeam';
import { resolveOpponentBench, resolveOpponentSquad } from '@/services/opponentSquad';
import { cn } from '@/utils/helpers';

/** จำนวนตัวสำรองที่โชว์ในรายชื่อข้างสนาม (เท่ากันทั้งสองฝั่ง) */
const BENCH_SHOWN = 5;

export const MatchmakingPage = () => {
  const navigate = useNavigate();
  const {
    state,
    live,
    elapsed,
    squadIncomplete,
    squadHasSuspended,
    search,
    cancel,
    emptyReason,
    pendingInjury,
    resolveInjury,
    sentOffCardIds,
    record,
  } = useMatchmaking();
  const {
    rating,
    ratedSlots,
    team,
    formation,
    bench,
    canAssign,
    suspendedCardIds,
    suspensionRemaining,
  } = useTeam();
  const { profileByUid } = useOnline();
  const { rawCards } = usePlayers();
  const { account } = useAuth();
  const isChampion = useMyRank() === 1;

  /** เปิดรายชื่อตัวสำรองทั้งหมด (แผงบาดเจ็บมีปุ่มเปลี่ยนตัวแบบคลิกเดียวอยู่แล้ว) */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  /* ── ทีมของเรา ─────────────────────────────────────────── */

  const ourSlots = useMemo<OurPitchSlot[]>(
    () =>
      ratedSlots.map(({ slot, player }) => ({
        slotId: slot.id,
        x: slot.x,
        y: slot.y,
        player,
        cardId: team.squad.find((entry) => entry.slotId === slot.id)?.cardId ?? null,
      })),
    [ratedSlots, team.squad],
  );

  /** กัปตัน = คนค่าพลังสูงสุดใน 11 ตัวจริง (เกมยังไม่มีระบบเลือกกัปตันเอง) */
  const captainCardId = useMemo(() => {
    const best = ourSlots
      .filter((slot) => slot.player && slot.cardId)
      .sort((a, b) => (b.player?.ovr ?? 0) - (a.player?.ovr ?? 0))[0];
    return best?.cardId ?? null;
  }, [ourSlots]);

  const homeStarters = useMemo<SquadRow[]>(
    () =>
      ratedSlots.map(({ slot, player }) => {
        const cardId = team.squad.find((entry) => entry.slotId === slot.id)?.cardId ?? null;
        return {
          key: slot.id,
          label: slotLabel(slot, formation.id),
          position: player?.position ?? slot.position,
          name: player?.name ?? null,
          ovr: player?.ovr ?? null,
          captain: Boolean(cardId && cardId === captainCardId),
          injured: Boolean(cardId && pendingInjury?.cardId === cardId),
          suspended: Boolean(cardId && suspendedCardIds.has(cardId)),
        };
      }),
    [captainCardId, formation.id, pendingInjury, ratedSlots, suspendedCardIds, team.squad],
  );

  /** ม้านั่งของเรา — เรียงค่าพลังมากไปน้อย แล้วตัดมาเท่าที่แผงแสดงไหว */
  const homeBench = useMemo(
    () => [...bench].sort((a, b) => b.player.ovr - a.player.ovr).slice(0, BENCH_SHOWN),
    [bench],
  );

  const homeSubs = useMemo<SquadRow[]>(
    () =>
      homeBench.map(({ card, player }) => ({
        key: card.id,
        label: player.position,
        position: player.position,
        name: player.name,
        ovr: player.ovr,
        suspended: suspendedCardIds.has(card.id),
      })),
    [homeBench, suspendedCardIds],
  );

  /* ── ทีมคู่แข่ง ─────────────────────────────────────────── */

  const opponentProfile = state.opponent ? profileByUid[state.opponent.id] : undefined;

  const opponentSlots = useMemo(
    () => (state.opponent ? resolveOpponentSquad(state.opponent, opponentProfile) : []),
    [opponentProfile, state.opponent],
  );

  /** แผนของคู่แข่ง: ใช้ของจริงจากโปรไฟล์ก่อน ไม่มีค่อยใช้ที่ผูกมากับตัวคู่แข่ง */
  const opponentFormation = useMemo(
    () =>
      state.opponent
        ? getFormationById(opponentProfile?.formationId ?? state.opponent.formationId)
        : null,
    [opponentProfile, state.opponent],
  );

  const awayCaptainName = useMemo(() => {
    const best = [...opponentSlots]
      .filter((entry) => entry.player)
      .sort((a, b) => (b.player?.ovr ?? 0) - (a.player?.ovr ?? 0))[0];
    return best?.player?.name ?? null;
  }, [opponentSlots]);

  const awayStarters = useMemo<SquadRow[]>(
    () =>
      opponentSlots.map(({ slot, player }) => ({
        key: `away-${slot.id}`,
        label: slotLabel(slot, opponentFormation?.id ?? formation.id),
        position: player?.position ?? slot.position,
        name: player?.name ?? null,
        ovr: player?.ovr ?? null,
        captain: Boolean(player && player.name === awayCaptainName),
      })),
    [awayCaptainName, formation.id, opponentFormation, opponentSlots],
  );

  const awaySubs = useMemo<SquadRow[]>(() => {
    if (!state.opponent) return [];
    return resolveOpponentBench(state.opponent, opponentSlots, BENCH_SHOWN).map((player) => ({
      key: `away-bench-${player.id}`,
      label: player.position,
      position: player.position,
      name: player.name,
      ovr: player.ovr,
    }));
  }, [opponentSlots, state.opponent]);

  /* ── บาดเจ็บ / ติดโทษแบน ───────────────────────────────── */

  /** คนที่บาดเจ็บอยู่ตอนนี้ พร้อมเบอร์และป้ายตำแหน่งของช่องที่เขายืน */
  const injuredEntry = useMemo<InjuryEntry | null>(() => {
    if (!pendingInjury) return null;

    const index = ratedSlots.findIndex(({ slot }) => slot.id === pendingInjury.slotId);
    const found = index >= 0 ? ratedSlots[index] : null;
    if (!found?.player) return null;

    return {
      cardId: pendingInjury.cardId,
      number: index + 1,
      label: slotLabel(found.slot, formation.id),
      player: found.player,
    };
  }, [formation.id, pendingInjury, ratedSlots]);

  /** ตัวสำรองที่แนะนำ: คนค่าพลังสูงสุดที่ลงช่องของคนเจ็บได้จริง */
  const suggestion = useMemo<InjuryEntry | null>(() => {
    if (!pendingInjury) return null;

    const eligible = [...bench]
      .filter(({ card }) => canAssign(pendingInjury.slotId, card.id).ok)
      .sort((a, b) => b.player.ovr - a.player.ovr)[0];
    if (!eligible) return null;

    const benchIndex = homeBench.findIndex(({ card }) => card.id === eligible.card.id);
    return {
      cardId: eligible.card.id,
      // อยู่ในม้านั่งที่โชว์อยู่ = ใช้เบอร์เดียวกับในรายชื่อ ไม่งั้นต่อท้าย
      number: benchIndex >= 0 ? 12 + benchIndex : 12 + homeBench.length,
      label: eligible.player.position,
      player: eligible.player,
    };
  }, [bench, canAssign, homeBench, pendingInjury]);

  const suspensionEntries = useMemo<SuspensionEntry[]>(() => {
    const starterIndex = new Map(
      ratedSlots.map(({ slot }, index) => [
        team.squad.find((entry) => entry.slotId === slot.id)?.cardId ?? `empty-${index}`,
        { index, slot },
      ]),
    );

    return [...suspendedCardIds]
      .flatMap((cardId) => {
        const card = rawCards.find((entry) => entry.id === cardId);
        const player = card ? getPlayerById(card.playerId) : null;
        if (!player) return [];

        const inSquad = starterIndex.get(cardId);
        const benchIndex = homeBench.findIndex((entry) => entry.card.id === cardId);

        return [
          {
            cardId,
            number: inSquad ? inSquad.index + 1 : benchIndex >= 0 ? 12 + benchIndex : 0,
            label: inSquad ? slotLabel(inSquad.slot, formation.id) : player.position,
            player,
            matchesLeft: suspensionRemaining(cardId),
          },
        ];
      })
      .sort((a, b) => b.matchesLeft - a.matchesLeft);
  }, [
    formation.id,
    homeBench,
    ratedSlots,
    rawCards,
    suspendedCardIds,
    suspensionRemaining,
    team.squad,
  ]);

  /* ── ค่าที่ใช้บนแถบบนและแผงกลาง ────────────────────────── */

  const blockedReason = squadIncomplete
    ? 'จัดตัวไม่ครบ 11 คน — ไปที่ MY TEAM ก่อนลงแข่ง'
    : squadHasSuspended
      ? 'มีนักเตะติดโทษแบนอยู่ในตัวจริง — เปลี่ยนตัวที่ MY TEAM ก่อน'
      : null;

  const filled = 11 - rating.emptySlots;

  return (
    /*
     * fixed inset-0 เพราะหน้านี้กินเต็มจอจริง ๆ (ทับ sidebar/header ของเลย์เอาต์หลัก)
     * z-40 อยู่ใต้ modal ทั้งหมด (z-50) จอรับรางวัล/ประกาศจึงยังเด้งทับได้ตามปกติ
     */
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[#070910] xl:overflow-hidden">
      {/* พื้นหลังสนามกีฬายามค่ำ */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage: 'url(/pitch/stadium-bg.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(96,60,190,0.25),transparent_55%),linear-gradient(180deg,rgba(7,9,16,0.82)_0%,rgba(7,9,16,0.94)_60%)]"
      />

      <MatchmakingTopBar
        teamName={team.name}
        teamOvr={rating.matchOvr}
        opponentName={state.opponent?.name ?? null}
        opponentOvr={state.opponent?.ovr ?? null}
        teamScore={live?.teamScore ?? 0}
        opponentScore={live?.opponentScore ?? 0}
        minute={live?.minute ?? 0}
        live={state.status === 'playing'}
        username={account?.managerName ?? account?.username ?? 'ผู้เล่น'}
        avatar={account?.state.avatar}
        rankPoints={record.points}
        isChampion={isChampion}
        onExit={() => navigate('/')}
      />

      {/* แถวบน: รายชื่อ | สนาม | รายชื่อ */}
      <div className="relative z-10 grid min-h-0 flex-1 gap-3 p-3 pt-3 xl:grid-cols-[236px_minmax(0,1fr)_236px]">
        <SquadListPanel
          formationName={formation.name}
          starters={homeStarters}
          subs={homeSubs}
          filled={filled}
          totalOvr={rating.matchOvr}
        />

        <MatchdayPitch
          ourSlots={ourSlots}
          opponentSlots={opponentSlots}
          sentOffCardIds={sentOffCardIds}
          injuredCardId={pendingInjury?.cardId ?? null}
          captainCardId={captainCardId}
          awayCaptainName={awayCaptainName}
          waiting={!state.opponent}
        />

        <SquadListPanel
          formationName={opponentFormation?.name ?? '—'}
          starters={awayStarters}
          subs={awaySubs}
          filled={awayStarters.filter((row) => row.name).length}
          totalOvr={state.opponent?.ovr ?? null}
          placeholder={
            state.opponent ? undefined : 'ยังไม่มีคู่แข่ง — กดปุ่มหาคู่แข่งด้านล่างเพื่อเข้าคิว'
          }
        />
      </div>

      {/* แถวล่าง: บาดเจ็บ | ศูนย์กลางการหาคู่ | ติดโทษแบน */}
      <div className="relative z-10 grid shrink-0 gap-3 px-3 pb-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className={cn('rounded-xl', pendingInjury && 'ring-2 ring-[#E23A3A]/50')}>
          <InjuryPanel
            injured={injuredEntry}
            suggestion={suggestion}
            onSubstitute={resolveInjury}
            onOpenPicker={() => setPickerOpen(true)}
          />
        </div>

        <MatchHub
          teamName={team.name}
          teamOvr={rating.matchOvr}
          teamFormation={formation.name}
          opponentName={state.opponent?.name ?? null}
          opponentOvr={state.opponent?.ovr ?? null}
          opponentFormation={opponentFormation?.name ?? null}
          status={state.status}
          elapsed={elapsed}
          minute={live?.minute ?? 0}
          outcome={state.result?.outcome}
          blockedReason={blockedReason}
          emptyReason={emptyReason}
          onSearch={search}
          onCancel={cancel}
        />

        <SuspensionPanel entries={suspensionEntries} />
      </div>

      {/* ปุ่มลอยมุมซ้ายล่าง — แชทรวมกับตั้งค่า */}
      <div className="relative z-10 flex shrink-0 items-center gap-2 px-3 pb-3">
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="เปิดแชท"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-base text-chalk/60 transition-colors hover:border-white/25 hover:text-chalk"
        >
          💬
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="ตั้งค่า"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-base text-chalk/60 transition-colors hover:border-white/25 hover:text-chalk"
        >
          ⚙
        </button>
      </div>

      {/* รายชื่อตัวสำรองทั้งหมด — เปิดจากแผงบาดเจ็บเมื่ออยากเลือกเอง */}
      {pendingInjury && pickerOpen && (
        <InjurySubModal
          playerName={pendingInjury.playerName}
          bench={bench}
          canAssign={(cardId) => canAssign(pendingInjury.slotId, cardId).ok}
          onPick={(cardId) => {
            resolveInjury(cardId);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <Modal
        open={chatOpen}
        title="Live แชท"
        subtitle="ห้องรวมของผู้เล่นทุกคน"
        onClose={() => setChatOpen(false)}
      >
        <LiveChatPanel />
      </Modal>

      {/* หมายเหตุ: ผลย้อนหลังของนัดที่จับคู่เองย้ายไปดูที่หน้าโปรไฟล์/เมนู MATCH
          เพื่อให้หน้านี้เหลือแต่สิ่งที่ต้องใช้ตอนกำลังจะลงแข่งจริง ๆ */}
    </div>
  );
};
