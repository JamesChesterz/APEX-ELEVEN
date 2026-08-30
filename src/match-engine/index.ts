/**
 * หน้าประตูของ Match Engine
 *
 * ระบบอื่นควร import จากที่นี่ที่เดียว จะได้เปลี่ยนโครงข้างในได้อิสระ
 *   import { createMatch, PitchRenderer } from '@/match-engine';
 */
export { BallEntity } from '@/match-engine/ball';
export { createMatch, MatchEngine, type MatchTeamState } from '@/match-engine/MatchEngine';
export {
  MIN_PASS_SCORE,
  passSpeed,
  scorePass,
  selectPassTarget,
  type PassCandidate,
} from '@/match-engine/passing';
export { PITCH, formationToWorld, roleOf } from '@/match-engine/pitch';
export { PlayerAgent } from '@/match-engine/playerAgent';
export { PitchRenderer, type RendererOptions } from '@/match-engine/renderer';
export type {
  AgentRole,
  BallState,
  MatchClock,
  MatchEngineOptions,
  MatchPhase,
  MatchPlayerInput,
  MatchSide,
  MatchSimEvent,
  MatchTeamInput,
  MovementState,
  PlayerDecision,
  TeamMatchStats,
  Vec2,
} from '@/match-engine/types';
