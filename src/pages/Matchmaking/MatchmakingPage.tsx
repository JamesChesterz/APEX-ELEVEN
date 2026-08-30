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
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveChatPanel } from '@/components/chat/LiveChatPanel';
import { Modal } from '@/components/layout/Modal';
import { InjuryPanel, type InjuryEntry } from '@/components/matchmaking/InjuryPanel';
import { InjurySubModal } from '@/components/matchmaking/InjurySubModal';
import { type OurPitchSlot } from '@/components/matchmaking/MatchdayPitch';
import { MatchdayStage } from '@/components/matchmaking/MatchdayStage';
import { MatchHub } from '@/components/matchmaking/MatchHub';
import { MatchmakingTopBar } from '@/components/matchmaking/MatchmakingTopBar';
import { BenchPickerModal } from '@/components/matchmaking/BenchPickerModal';
import { LiveMatchControls } from '@/components/matchmaking/LiveMatchControls';
import { PlayerMatchPanel } from '@/components/matchmaking/PlayerMatchPanel';
import { SquadListPanel, type SquadRow } from '@/components/matchmaking/SquadListPanel';
import { slotLabel } from '@/components/matchmaking/squadLabels';
import {
  SuspensionPanel,
  type SuspensionEntry,
} from '@/components/matchmaking/SuspensionPanel';
import { getFormationById } from '@/data/formations';
import { getPlayerById } from '@/data/players';
import { compareForSlot } from '@/services/lineup';
import { useAuth } from '@/hooks/useAuth';
import { useMyRank } from '@/hooks/useLeaderboard';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useOnline } from '@/hooks/useOnline';
import { usePlayers } from '@/hooks/usePlayers';
import { BENCH_SIZE, useTeam } from '@/hooks/useTeam';
import { resolveOpponentBench, resolveOpponentSquad } from '@/services/opponentSquad';
import { applyLevel, getPlus } from '@/services/upgrade';
import { cn } from '@/utils/helpers';

/** จำนวนตัวสำรองของฝั่งคู่แข่งที่ปั้นขึ้นมาโชว์ (ให้เท่ากับม้านั่งของเรา) */
const AWAY_BENCH_SHOWN = BENCH_SIZE;

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
    matchLocked,
    engine,
    speed,
    setSpeed,
    paused,
    setPaused,
    tactics,
    setTactics,
    saveTactics,
    tacticsSaved,
  } = useMatchmaking();
  const {
    rating,
    ratedSlots,
    team,
    formation,
    bench,
    benchCards,
    reserves,
    canAssign,
    canAssignBench,
    assignBench,
    clearBench,
    substitute,
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
  /** ช่องม้านั่งที่เลือกไว้รอส่งลงสนาม (null = ยังไม่ได้เลือก) */
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number | null>(null);
  /** นักเตะที่คลิกเลือกไว้บนสนามระหว่างแข่ง — เป็น state ของ UI ล้วน ไม่แตะการจำลอง */
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  /** ช่องม้านั่งที่กำลังเปิดรายการเลือกคนใส่ (null = ปิดอยู่) */
  const [benchPickerIndex, setBenchPickerIndex] = useState<number | null>(null);
  /** ข้อความเตือนของแผงรายชื่อ เช่น ใส่ชื่อซ้ำ */
  const [notice, setNotice] = useState<string | null>(null);

  // ข้อความเตือนหายเองใน 3 วินาที
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ── ทีมของเรา ─────────────────────────────────────────── */

  const ourSlots = useMemo<OurPitchSlot[]>(
    () =>
      ratedSlots.map(({ slot, player, level }) => ({
        slotId: slot.id,
        x: slot.x,
        y: slot.y,
        player,
        level,
        label: slotLabel(slot, formation.id),
        // ตำแหน่งจริงของช่อง — ป้ายใต้การ์ดใช้คิดค่าปรับผิดตำแหน่งให้เลข OVR ตรงกับหน้า MY TEAM
        position: slot.position,
        cardId: team.squad.find((entry) => entry.slotId === slot.id)?.cardId ?? null,
      })),
    [formation.id, ratedSlots, team.squad],
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
      ratedSlots.map(({ slot, player, level }) => {
        const cardId = team.squad.find((entry) => entry.slotId === slot.id)?.cardId ?? null;
        return {
          key: slot.id,
          label: slotLabel(slot, formation.id),
          position: player?.position ?? slot.position,
          name: player?.name ?? null,
          ovr: player?.ovr ?? null,
          plus: level === undefined ? undefined : getPlus(level),
          captain: Boolean(cardId && cardId === captainCardId),
          injured: Boolean(cardId && pendingInjury?.cardId === cardId),
          suspended: Boolean(cardId && suspendedCardIds.has(cardId)),
        };
      }),
    [captainCardId, formation.id, pendingInjury, ratedSlots, suspendedCardIds, team.squad],
  );

  /**
   * ม้านั่งของเรา = ชุดที่ผู้เล่นจัดเอง (useTeam.benchCards) ไม่ใช่คลังทั้งกอง
   * ค่าพลังบวกโบนัสตีบวกให้เหมือนตัวจริง จะได้เทียบกันตรง ๆ ได้
   */
  const homeSubs = useMemo<Array<SquadRow | null>>(
    () =>
      benchCards.map((entry, index) => {
        if (!entry) return null;
        const { card, player } = entry;
        const upgraded = applyLevel(player, card.level);

        return {
          key: `bench-${index}-${card.id}`,
          label: player.position,
          position: player.position,
          name: player.name,
          ovr: upgraded.ovr,
          plus: getPlus(card.level),
          suspended: suspendedCardIds.has(card.id),
        };
      }),
    [benchCards, suspendedCardIds],
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
    return resolveOpponentBench(state.opponent, opponentSlots, AWAY_BENCH_SHOWN).map((player) => ({
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

  /** ช่องที่คนเจ็บยืนอยู่ ใช้ตัดสินว่าใครเข้ากับช่องนี้ที่สุด */
  const injuredSlot = useMemo(
    () => (pendingInjury ? formation.slots.find((slot) => slot.id === pendingInjury.slotId) : null),
    [formation.slots, pendingInjury],
  );

  /**
   * ตัวสำรองที่แนะนำ — เรียงตามความเข้ากับตำแหน่งก่อน แล้วค่อยดูค่าพลัง
   *
   * ลำดับ: ตำแหน่งตรงกันเป๊ะ → เป็นตำแหน่งรองที่เขาเล่นได้ → จำพวกเดียวกัน
   * (Defence / Midfield / Attack) → ที่เหลือ · เข้ากันเท่ากันค่อยเอาคนค่าพลังสูงกว่า
   *
   * เดิมเรียงด้วยค่าพลังอย่างเดียว ระบบจึงเคยเสนอกองหน้าตัวเก่งไปยืนแทนกองหลัง
   */
  const suggestion = useMemo<InjuryEntry | null>(() => {
    if (!pendingInjury) return null;

    // ม้านั่งที่ประกาศไว้มาก่อนเสมอ ถ้าไม่มีใครลงได้ค่อยถอยไปหยิบจากคลังทั้งกอง
    const declared = benchCards.flatMap((entry) => (entry ? [entry] : []));
    const pool = declared.length > 0 ? declared : bench;
    const slotPosition = injuredSlot?.position;

    const eligible = [...pool]
      .filter(({ card }) => canAssign(pendingInjury.slotId, card.id).ok)
      .sort((a, b) =>
        slotPosition ? compareForSlot(a, b, slotPosition) : b.player.ovr - a.player.ovr,
      )[0];
    if (!eligible) return null;

    const benchIndex = benchCards.findIndex((entry) => entry?.card.id === eligible.card.id);
    return {
      cardId: eligible.card.id,
      // อยู่ในม้านั่งที่ประกาศไว้ = ใช้เบอร์เดียวกับในรายชื่อ ไม่งั้นต่อท้าย
      number: benchIndex >= 0 ? 12 + benchIndex : 12 + BENCH_SIZE,
      label: eligible.player.position,
      player: eligible.player,
    };
  }, [bench, benchCards, canAssign, injuredSlot, pendingInjury]);

  /** ม้านั่งเรียงตามความเข้ากับช่องของคนเจ็บ — คนที่ควรลงที่สุดอยู่บนสุด */
  const benchForInjury = useMemo(() => {
    const slotPosition = injuredSlot?.position;
    if (!slotPosition) return bench;
    return [...bench].sort((a, b) => compareForSlot(a, b, slotPosition));
  }, [bench, injuredSlot]);

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
        const benchIndex = benchCards.findIndex((entry) => entry?.card.id === cardId);

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
    benchCards,
    formation.id,
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
      ? 'มีนักเตะติดโทษแบนอยู่ในตัวจริง — ต้องเปลี่ยนเขาออกก่อนถึงจะลงแข่งได้'
      : null;

  const filled = 11 - rating.emptySlots;

  /* ── เปลี่ยนตัวจากแผงรายชื่อ (สองคลิก: เลือกสำรอง → เลือกตัวจริง) ──── */

  /** คลิกแถวตัวสำรอง — มีคนอยู่ = เลือก/ยกเลิก · ช่องว่าง = เปิดรายการให้ใส่คน */
  const handleBenchClick = (index: number) => {
    if (!benchCards[index]) {
      setBenchPickerIndex(index);
      return;
    }
    setSelectedBenchIndex((current) => (current === index ? null : index));
  };

  /** คลิกแถวตัวจริง — ต้องเลือกตัวสำรองไว้ก่อน ถึงจะรู้ว่าจะเอาใครลงแทน */
  const handleStarterClick = (slotId: string) => {
    if (selectedBenchIndex === null) {
      setNotice('เลือกตัวสำรองก่อน แล้วค่อยแตะตัวจริงที่จะเปลี่ยนออก');
      return;
    }

    const result = substitute(slotId, selectedBenchIndex);
    setNotice(result.ok ? null : result.reason ?? 'เปลี่ยนตัวไม่ได้');
    // เปลี่ยนสำเร็จแล้วค่อยล้างตัวที่เลือกไว้ ไม่สำเร็จก็คงไว้ให้ลองช่องอื่นต่อ
    if (result.ok) setSelectedBenchIndex(null);
  };

  return (
    /*
     * เต็มพื้นที่ของ <main> (MainLayout ตัด padding ให้แล้วเมื่ออยู่หน้านี้)
     * ไม่ใช้ fixed อีกต่อไป — ไม่งั้นมันจะทับเมนูด้านซ้ายจนกดไม่ได้
     */
    <div className="relative flex h-full min-h-[680px] flex-col overflow-y-auto bg-[#070910] xl:overflow-hidden">
      {/* พื้นหลังสนามกีฬายามค่ำ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'url(/pitch/stadium-bg.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(96,60,190,0.25),transparent_55%),linear-gradient(180deg,rgba(7,9,16,0.82)_0%,rgba(7,9,16,0.94)_60%)]"
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
        matchLocked={matchLocked}
        onExit={() => navigate('/')}
      />

      {/*
        แถวบน: รายชื่อ | สนาม | รายชื่อ
        ระหว่างแข่ง คอลัมน์ซ้ายเปลี่ยนเป็นแผงควบคุมสด (สกอร์ · สถิติ · แทคติก · ฟีดเหตุการณ์)
        เพราะระหว่างแข่งจัดตัวไม่ได้อยู่แล้ว รายชื่อจึงไม่มีประโยชน์ตอนนั้น
      */}
      <div className="relative z-10 grid min-h-0 flex-1 gap-3 p-3 pt-3 xl:grid-cols-[206px_minmax(0,1fr)_206px] 2xl:grid-cols-[240px_minmax(0,1fr)_240px]">
        {engine ? (
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {/* คลิกนักเตะบนสนามแล้วข้อมูลของเขาขึ้นตรงนี้ */}
            {selectedPlayerId && (
              <PlayerMatchPanel
                engine={engine}
                playerId={selectedPlayerId}
                onClose={() => setSelectedPlayerId(null)}
              />
            )}
              <LiveMatchControls
              engine={engine}
              speed={speed}
              onSpeedChange={setSpeed}
              paused={paused}
              onPausedChange={setPaused}
              tactics={tactics}
              onTacticsChange={setTactics}
              onSaveTactics={saveTactics}
              tacticsSaved={tacticsSaved}
            />
          </div>
        ) : (
        <SquadListPanel
          formationName={formation.name}
          starters={homeStarters}
          subs={homeSubs}
          filled={filled}
          totalOvr={rating.matchOvr}
          interactive={{
            selectedBenchIndex,
            onStarterClick: handleStarterClick,
            onBenchClick: handleBenchClick,
            onBenchClear: (index) => {
              clearBench(index);
              setSelectedBenchIndex(null);
            },
          }}
        />
        )}

        {/*
          ก่อนเขี่ยบอลยังเป็นสนามการ์ดเดิมทุกอย่าง
          พอสถานะเป็น playing/finished จะสลับเป็นสนามจำลอง 2D ที่นักเตะ 22 คนวิ่งจริง
        */}
        <MatchdayStage
          ourSlots={ourSlots}
          opponentSlots={opponentSlots}
          sentOffCardIds={sentOffCardIds}
          injuredCardId={pendingInjury?.cardId ?? null}
          captainCardId={captainCardId}
          awayCaptainName={awayCaptainName}
          awayLabel={(slotId) => {
            const target = opponentSlots.find((entry) => entry.slot.id === slotId);
            return target
              ? slotLabel(target.slot, opponentFormation?.id ?? formation.id)
              : slotId;
          }}
          waiting={!state.opponent}
          engine={engine}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={setSelectedPlayerId}
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
          teamStars={record.points}
          opponentName={state.opponent?.name ?? null}
          opponentOvr={state.opponent?.ovr ?? null}
          opponentFormation={opponentFormation?.name ?? null}
          opponentStars={opponentProfile?.points ?? null}
          starDelta={state.status === 'finished' ? state.result?.rankingPoints ?? null : null}
          status={state.status}
          elapsed={elapsed}
          minute={live?.minute ?? 0}
          outcome={state.result?.outcome}
          blockedReason={blockedReason}
          emptyReason={emptyReason}
          onSearch={search}
          onCancel={cancel}
        />

        <SuspensionPanel
          entries={suspensionEntries}
          blocking={squadHasSuspended}
          onFix={() => navigate('/substitution')}
        />
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
          bench={benchForInjury}
          slotPosition={injuredSlot?.position}
          canAssign={(cardId) => canAssign(pendingInjury.slotId, cardId).ok}
          onPick={(cardId) => {
            resolveInjury(cardId);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* คำเตือนจากการจัดม้านั่ง เช่น ใส่ชื่อซ้ำ — ลอยกลางจอล่าง หายเอง */}
      {notice && (
        <p className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto w-fit max-w-[90%] rounded-full border border-[#D93A3A]/50 bg-black/85 px-4 py-2 text-center text-xs text-[#FF8A8A] backdrop-blur">
          {notice}
        </p>
      )}

      {/* เลือกนักเตะใส่ม้านั่งช่องที่กดค้างไว้ */}
      {benchPickerIndex !== null && (
        <BenchPickerModal
          open
          number={12 + benchPickerIndex}
          reserves={reserves}
          blockedReason={(cardId) => canAssignBench(benchPickerIndex, cardId).reason}
          onPick={(cardId) => {
            const result = assignBench(benchPickerIndex, cardId);
            setNotice(result.ok ? null : result.reason ?? 'ใส่ลงม้านั่งไม่ได้');
            if (result.ok) setBenchPickerIndex(null);
          }}
          onClose={() => setBenchPickerIndex(null)}
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
