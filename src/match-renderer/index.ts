/**
 * หน้าประตูของชั้นการแสดงผลแมตช์แบบ 2.5D
 *
 * ระบบอื่นควร import จากที่นี่ที่เดียว:
 *   import { MatchRenderer } from '@/match-renderer';
 *
 * ชั้นนี้ขึ้นกับ match-engine ทางเดียวเสมอ (อ่านสถานะไปวาด)
 * match-engine ไม่รู้จักไฟล์ในโฟลเดอร์นี้เลยแม้แต่ไฟล์เดียว
 */
export { MatchRenderer } from '@/match-renderer/MatchRenderer';
export { BallRenderer, MAX_FLIGHT_HEIGHT } from '@/match-renderer/ballLayer';
export { poseFor, type PlayerPose } from '@/match-renderer/playerLayer';
export {
  createProjection,
  depthAt,
  heightToPixels,
  metresToPixels,
  toScreen,
  toWorld,
  type ProjectionState,
  type Viewport,
} from '@/match-renderer/projection';
export {
  DEFAULT_CAMERA,
  withCamera,
  type Drawable,
  type MatchCamera,
  type MatchRenderOptions,
  type ScreenPoint,
  type WorldPoint,
} from '@/match-renderer/types';
