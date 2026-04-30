import type { GameState, Reward, RuneType } from './types';
import { Random } from './Random';
import { RELICS } from '../data/relics';
import { RUNE_NAME } from '../data/runes';

const UPGRADE_RUNES: RuneType[] = ['fire', 'thunder', 'gold', 'dark'];

export function generateRewards(_state: GameState, rng: Random): Reward[] {
  const relic = rng.pick(RELICS);
  const upgradeRune = rng.pick(UPGRADE_RUNES);
  const pool: Reward[] = [
    { id: 'maxhp', name: '最大生命 +8', desc: '立即恢复 8 点生命上限与生命。', kind: 'maxhp' },
    { id: 'reroll', name: '重掷次数 +1', desc: '每回合最大重掷次数增加 1。', kind: 'reroll' },
    { id: 'fireup', name: '火焰精通', desc: '每个火符文额外造成 1 点伤害。', kind: 'fireup' },
    { id: `dieface-${upgradeRune}`, name: '骰面改造', desc: `选择一个骰子，将一个面改造成${RUNE_NAME[upgradeRune]}。`, kind: 'dieface', data: { rune: upgradeRune } },
    { id: `relic-${relic.id}`, name: relic.name, desc: `获得遗物：${relic.desc}`, kind: 'relic', data: { relicId: relic.id } },
  ];
  return [rng.pick(pool), rng.pick(pool), rng.pick(pool)];
}

export function applyReward(state: GameState, reward: Reward) {
  if (reward.kind === 'maxhp') {
    state.player.maxHp += 8;
    state.player.hp += 8;
  }
  if (reward.kind === 'reroll') state.player.rerollMax++;
  if (reward.kind === 'fireup') state.player.runeBonus.fire = (state.player.runeBonus.fire || 0) + 1;
  if (reward.kind === 'relic' && reward.data?.relicId && !state.player.relics.includes(reward.data.relicId)) {
    state.player.relics.push(reward.data.relicId);
    if (reward.data.relicId === 'LuckyCharm') state.player.rerollMax++;
  }
}
