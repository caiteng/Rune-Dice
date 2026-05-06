export type RuneType = 'fire' | 'water' | 'stone' | 'thunder' | 'gold' | 'dark' | 'wild' | 'curse';
export type SlotType = 'attack' | 'defense' | 'tactic' | 'discard';
export type GamePhase = 'battle' | 'reward' | 'upgrade' | 'victory' | 'defeat';

export interface Die {
  faces: RuneType[];
  value: RuneType;
  locked: boolean;
  blocked: boolean;
  nextBlocked: boolean;
  nextForcedValue: RuneType | null;
  forced: boolean;
}

export interface SlotState {
  attack: number[];
  defense: number[];
  tactic: number[];
  discard: number[];
}

export interface PlayerState {
  maxHp: number;
  hp: number;
  armor: number;
  gold: number;
  rerollMax: number;
  rerollsLeft: number;
  relics: string[];
  runeBonus: Partial<Record<RuneType, number>>;
  slotBonus: {
    attack: number;
    defense: number;
    tacticGold: number;
    discard: number;
  };
  nextTurnArmor: number;
  nextTurnExtraReroll: number;
  nextTurnAttackMultiplierBonus: number;
  darkEnergy: number;
  battleFlags: {
    firstCurseDiscardUsed: boolean;
  };
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  baseAttack: number;
  traits?: string[];
}

export interface EnemyState extends EnemyDef {
  hp: number;
  armor: number;
  turn: number;
  intent: string;
  mechanism: string;
}

export interface Reward {
  id: string;
  name: string;
  desc: string;
  kind: 'maxhp' | 'reroll' | 'attack_training' | 'defense_training' | 'tactic_training' | 'discard_training' | 'dieface' | 'relic';
  data?: { rune?: RuneType; relicId?: string };
}

export interface PendingDieUpgrade {
  rune: RuneType;
  dieIndex?: number;
}

export interface DamagePacket {
  source: RuneType | 'combo' | 'relic';
  amount: number;
  tags?: string[];
}

export interface SlotPreview {
  damagePackets: DamagePacket[];
  rawDamage: number;
  armorDamage: number;
  hpDamage: number;
  heal: number;
  armor: number;
  gold: number;
  selfDamage: number;
  selfDamageReduction: number;
  enemyArmorBreak: number;
  nextTurnArmor: number;
  nextTurnAttackMultiplierBonus: number;
  nextTurnExtraReroll: number;
  darkEnergyGain: number;
  enemyAttackReduction: number;
  tacticRune?: RuneType;
  attackRunes: RuneType[];
  defenseRunes: RuneType[];
  tacticRunes: RuneType[];
  discardRunes: RuneType[];
  messages: string[];
  attackText: string;
  defenseText: string;
  tacticText: string;
  discardText: string;
  totalText: string;
}

export interface GameState {
  seed: number;
  phase: GamePhase;
  battleIndex: number;
  player: PlayerState;
  enemy: EnemyState | null;
  dice: Die[];
  slots: SlotState;
  selectedDieIndex: number | null;
  log: string[];
  pendingRewards: Reward[];
  pendingDieUpgrade: PendingDieUpgrade | null;
}
