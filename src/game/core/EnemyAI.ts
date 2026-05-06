import type { Die, EnemyState, PlayerState, SlotPreview, SlotState } from './types';
import { Random } from './Random';

export function enemyMechanism(id: string) {
  if (id === 'skeleton') return '骷髅蓄力强攻时，防御槽为空会受到额外伤害。';
  if (id === 'stoneguard') return '石像守卫会惩罚没有破甲的回合。';
  if (id === 'thief') return '小偷会惩罚没有战术金的回合。';
  if (id === 'cursemage') return '诅咒法师会强制诅咒骰，战术水可以延后诅咒。';
  if (id === 'fatedealer') return '命运赌局要求攻击槽放入两个不同符文，弃骰可抵抗封印。';
  return '史莱姆只会攻击，适合熟悉槽位。';
}

export function enemyIntent(enemy: EnemyState) {
  if (enemy.id === 'skeleton') return enemy.turn % 2 === 0 ? '蓄力强攻 14' : '普通攻击 6';
  if (enemy.id === 'stoneguard') return enemy.turn % 2 === 0 ? '获得 10 护甲' : `攻击 ${enemy.baseAttack}`;
  if (enemy.id === 'thief') return enemy.turn % 2 === 0 ? '偷取金币' : `攻击 ${enemy.baseAttack}`;
  if (enemy.id === 'cursemage') return enemy.turn % 3 === 0 ? '诅咒一个骰子' : `攻击 ${enemy.baseAttack}`;
  if (enemy.id === 'fatedealer') {
    if (enemy.turn % 4 === 0) return '命运赌局';
    if (enemy.turn % 3 === 0) return '封印一个骰子';
    return `攻击 ${enemy.baseAttack}`;
  }
  return `攻击 ${enemy.baseAttack}`;
}

export function advanceEnemyIntent(enemy: EnemyState) {
  enemy.turn++;
  enemy.intent = enemyIntent(enemy);
}

export function enemyAct(
  enemy: EnemyState,
  player: PlayerState,
  dice: Die[],
  rng: Random,
  log: (s: string) => void,
  context: { slots: SlotState; preview: SlotPreview },
) {
  const intent = enemy.intent;
  if (enemy.id === 'stoneguard' && context.preview.enemyArmorBreak <= 0 && enemy.hp > 0) {
    enemy.armor += 8;
    log('石像守卫发现你没有破甲，下回合护甲额外 +8。');
  }

  if (intent.startsWith('获得')) {
    enemy.armor += 10;
    log(`${enemy.name} 获得 10 点护甲。`);
    return;
  }
  if (intent.startsWith('偷取')) {
    if (context.preview.tacticRune === 'gold') {
      player.gold += 2;
      log('你用战术金诱导小偷失手，额外获得 2 金币。');
      return;
    }
    const value = Math.min(7, player.gold);
    player.gold -= value;
    log(`${enemy.name} 偷取了 ${value} 枚金币。`);
    return;
  }
  if (intent.startsWith('诅咒')) {
    if (context.preview.tacticRune === 'water') {
      log('战术水延后了诅咒法师的诅咒。');
      return;
    }
    const die = dice[rng.int(0, dice.length - 1)];
    die.nextForcedValue = 'curse';
    log(`${enemy.name} 诅咒了一个骰子，下回合它会显示为诅咒。`);
    return;
  }
  if (intent.startsWith('封印')) {
    if ((context.slots.discard?.length ?? 0) >= 2) {
      log('弃骰区的冷静压住了命运封印，本回合没有骰子被封印。');
      return;
    }
    const die = dice[rng.int(0, dice.length - 1)];
    die.nextBlocked = true;
    log(`${enemy.name} 封印了一个骰子的下回合重掷。`);
    return;
  }
  if (intent.startsWith('命运赌局')) {
    const attackRunes = context.preview.attackRunes.filter((rune) => rune !== 'curse');
    if (attackRunes.length >= 2 && new Set(attackRunes).size >= 2) {
      enemy.hp = Math.max(0, enemy.hp - 12);
      log('命运赌局成功：两个不同攻击符文额外造成 12 伤害。');
    } else {
      enemy.armor += 20;
      log('命运赌局失败：命运庄家获得 20 护甲。');
    }
    return;
  }

  let attack = enemy.id === 'skeleton' && intent.startsWith('蓄力') ? 14 : enemy.baseAttack;
  if (enemy.id === 'skeleton' && intent.startsWith('蓄力') && context.slots.defense.length === 0) attack += 4;
  attack = Math.max(0, attack - context.preview.enemyAttackReduction);
  const damage = Math.max(0, attack - player.armor);
  player.armor = Math.max(0, player.armor - attack);
  player.hp -= damage;
  log(`${enemy.name} 攻击，造成 ${damage} 点伤害。`);
}
