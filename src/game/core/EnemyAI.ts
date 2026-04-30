import type { Die, EnemyState, PlayerState } from './types';
import { Random } from './Random';

export function enemyIntent(enemy: EnemyState) {
  if (enemy.traits?.includes('stone_armor') && enemy.turn % 2 === 0) return '获得 6 护甲';
  if (enemy.traits?.includes('thief') && enemy.turn % 3 === 0) return '偷取 4 金币';
  if (enemy.traits?.includes('curse_mage') && enemy.turn % 3 === 0) return '诅咒一个骰子';
  if (enemy.traits?.includes('fate_boss') && enemy.turn % 3 === 0) return '封印一个骰子的重掷';
  return `攻击 ${enemy.baseAttack}`;
}

export function advanceEnemyIntent(enemy: EnemyState) {
  enemy.turn++;
  enemy.intent = enemyIntent(enemy);
}

export function enemyAct(enemy: EnemyState, player: PlayerState, dice: Die[], rng: Random, log: (s: string) => void) {
  const intent = enemy.intent;
  if (intent.startsWith('获得')) {
    enemy.armor += 6;
    log(`${enemy.name} 获得 6 点护甲。`);
    return;
  }
  if (intent.startsWith('偷取')) {
    const value = Math.min(4, player.gold);
    player.gold -= value;
    log(`${enemy.name} 偷取了 ${value} 枚金币。`);
    return;
  }
  if (intent.startsWith('诅咒')) {
    const die = dice[rng.int(0, dice.length - 1)];
    die.nextForcedValue = 'curse';
    log(`${enemy.name} 诅咒了一个骰子，下回合它会显示为诅咒。`);
    return;
  }
  if (intent.startsWith('封印')) {
    const die = dice[rng.int(0, dice.length - 1)];
    die.nextBlocked = true;
    log(`${enemy.name} 封印了一个骰子的下回合重掷。`);
    return;
  }
  const damage = Math.max(0, enemy.baseAttack - player.armor);
  player.armor = Math.max(0, player.armor - enemy.baseAttack);
  player.hp -= damage;
  log(`${enemy.name} 攻击，造成 ${damage} 点伤害。`);
}
