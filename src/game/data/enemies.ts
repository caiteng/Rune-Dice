import type { EnemyDef } from '../core/types';

export const ENEMY_ORDER: EnemyDef[] = [
  { id: 'slime', name: '史莱姆', maxHp: 30, baseAttack: 4 },
  { id: 'skeleton', name: '骷髅兵', maxHp: 45, baseAttack: 7 },
  { id: 'stoneguard', name: '石像守卫', maxHp: 74, baseAttack: 7, traits: ['stone_armor'] },
  { id: 'thief', name: '小偷', maxHp: 58, baseAttack: 6, traits: ['thief'] },
  { id: 'cursemage', name: '诅咒法师', maxHp: 78, baseAttack: 7, traits: ['curse_mage'] },
  { id: 'fatedealer', name: '命运庄家', maxHp: 180, baseAttack: 10, traits: ['fate_boss'] },
];
