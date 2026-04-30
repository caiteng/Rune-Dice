import type { Die, GamePhase, PendingDieUpgrade, PlayerState, Reward } from '../core/types';
import type { EnemyState } from '../core/types';

export interface SaveData {
  version: 1;
  savedAt: string;
  seed: number;
  phase: GamePhase;
  battleIndex: number;
  player: PlayerState;
  enemy: EnemyState | null;
  dice: Die[];
  log: string[];
  pendingRewards: Reward[];
  pendingDieUpgrade: PendingDieUpgrade | null;
}
