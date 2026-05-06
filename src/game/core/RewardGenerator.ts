import type { GameState, Reward, RuneType } from './types';
import { Random } from './Random';
import { RELICS } from '../data/relics';
import { RUNE_NAME } from '../data/runes';

const UPGRADE_RUNES: RuneType[] = ['fire', 'water', 'stone', 'thunder', 'gold', 'dark', 'wild'];

export function generateRewards(state: GameState, rng: Random): Reward[] {
  const unownedRelics = RELICS.filter((relic) => !state.player.relics.includes(relic.id));
  const relic = unownedRelics.length > 0 ? rng.pick(unownedRelics) : null;
  const upgradeRune = rng.pick(UPGRADE_RUNES);
  const pool: Reward[] = [
    { id: 'attack-training', name: '攻击训练', desc: '攻击槽中的火 / 雷 / 暗伤害 +1。', kind: 'attack_training' },
    { id: 'defense-training', name: '防御训练', desc: '防御槽中的石 / 水效果 +1。', kind: 'defense_training' },
    { id: 'tactic-training', name: '战术训练', desc: '战术槽中的金收益 +2。', kind: 'tactic_training' },
    { id: 'discard-training', name: '弃骰训练', desc: '弃骰区至少 2 个骰子时，下回合护甲再 +1。', kind: 'discard_training' },
    { id: 'reroll', name: '重掷次数 +1', desc: '每回合最大重掷次数增加 1。', kind: 'reroll' },
    { id: 'maxhp', name: '最大生命 +8', desc: '最大生命提高 8，并立即恢复 8 生命。', kind: 'maxhp' },
    { id: `dieface-${upgradeRune}`, name: '骰面改造', desc: `选择具体骰面，将它改造成${RUNE_NAME[upgradeRune]}。`, kind: 'dieface', data: { rune: upgradeRune } },
  ];
  if (relic) {
    pool.push({ id: `relic-${relic.id}`, name: relic.name, desc: `获得遗物：${relic.desc}`, kind: 'relic', data: { relicId: relic.id } });
  }
  return pickUniqueById(pool, 3, rng);
}

export function applyReward(state: GameState, reward: Reward) {
  if (reward.kind === 'maxhp') {
    state.player.maxHp += 8;
    state.player.hp += 8;
  }
  if (reward.kind === 'reroll') state.player.rerollMax++;
  if (reward.kind === 'attack_training') state.player.slotBonus.attack++;
  if (reward.kind === 'defense_training') state.player.slotBonus.defense++;
  if (reward.kind === 'tactic_training') state.player.slotBonus.tacticGold += 2;
  if (reward.kind === 'discard_training') state.player.slotBonus.discard++;
  if (reward.kind === 'relic' && reward.data?.relicId && !state.player.relics.includes(reward.data.relicId)) {
    state.player.relics.push(reward.data.relicId);
    if (reward.data.relicId === 'LuckyCharm') state.player.rerollMax++;
  }
}

function pickUniqueById(pool: Reward[], count: number, rng: Random): Reward[] {
  const byId = new Map(pool.map((reward) => [reward.id, reward]));
  const available = Array.from(byId.values());
  const picked: Reward[] = [];
  while (available.length > 0 && picked.length < count) {
    const index = rng.int(0, available.length - 1);
    picked.push(available.splice(index, 1)[0]);
  }
  return picked;
}
