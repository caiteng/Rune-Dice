import { makeDice } from './Dice';
import { ENEMY_ORDER } from '../data/enemies';
import type { GameState, SlotState } from './types';
import { enemyIntent } from './EnemyAI';

export function emptySlots(): SlotState {
  return { attack: [], defense: [], tactic: [] };
}

export function createEnemy(index: number) {
  const def = ENEMY_ORDER[index];
  return {
    ...def,
    hp: def.maxHp,
    armor: 0,
    turn: 1,
    intent: enemyIntent({ ...def, hp: def.maxHp, armor: 0, turn: 1, intent: '' }),
  };
}

export function createState(seed: number): GameState {
  return {
    seed,
    phase: 'battle',
    battleIndex: 0,
    player: {
      maxHp: 40,
      hp: 40,
      armor: 0,
      gold: 0,
      rerollMax: 2,
      rerollsLeft: 2,
      relics: [],
      runeBonus: {},
      slotBonus: { attack: 0, defense: 0, tacticGold: 0 },
      nextTurnArmor: 0,
      nextTurnExtraReroll: 0,
      darkEnergy: 0,
    },
    enemy: createEnemy(0),
    dice: makeDice(5),
    slots: emptySlots(),
    selectedDieIndex: null,
    log: ['战斗开始。'],
    pendingRewards: [],
    pendingDieUpgrade: null,
  };
}
