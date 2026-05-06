import type { DamagePacket, GameState, PlayerState, RuneType, SlotPreview, SlotState, SlotType } from './types';
import { RUNE_NAME } from '../data/runes';

type ScoringRune = Exclude<RuneType, 'wild' | 'curse'>;
type MutablePreview = SlotPreview;

const SLOT_CAPACITY: Record<SlotType, number> = { attack: 2, defense: 2, tactic: 1, discard: Number.POSITIVE_INFINITY };
const SCORING_RUNES: ScoringRune[] = ['fire', 'water', 'stone', 'thunder', 'gold', 'dark'];

export function slotCapacity(slot: SlotType) {
  return SLOT_CAPACITY[slot];
}

export function assignedSlot(slots: SlotState, dieIndex: number): SlotType | null {
  if (slots.attack.includes(dieIndex)) return 'attack';
  if (slots.defense.includes(dieIndex)) return 'defense';
  if (slots.tactic.includes(dieIndex)) return 'tactic';
  if ((slots.discard ?? []).includes(dieIndex)) return 'discard';
  return null;
}

export function assignedCount(slots: SlotState) {
  return slots.attack.length + slots.defense.length + slots.tactic.length + (slots.discard?.length ?? 0);
}

export function isFullyAssigned(state: GameState) {
  return assignedCount(state.slots) === state.dice.length;
}

export function previewAssignment(state: GameState): SlotPreview {
  return calculate(state, false);
}

export function resolveAssignment(state: GameState, log: (text: string) => void): SlotPreview {
  const preview = calculate(state, true);
  const player = state.player;
  const enemy = state.enemy;
  if (!enemy) return preview;
  const startingDarkEnergy = player.darkEnergy;

  enemy.armor = Math.max(0, enemy.armor - preview.armorDamage);
  enemy.hp = Math.max(0, enemy.hp - preview.hpDamage);
  player.hp = Math.max(0, Math.min(player.maxHp, player.hp + preview.heal) - preview.selfDamage);
  if (enemy.hp <= 0 && preview.attackRunes.includes('fire') && preview.attackRunes.includes('dark')) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
    log('献祭烈焰击杀敌人，返还 1 点生命。');
  }
  player.armor = Math.max(0, player.armor + preview.armor);
  player.gold = Math.max(0, player.gold + preview.gold);
  player.darkEnergy += preview.darkEnergyGain;
  const darkEnergyUses = Math.min(preview.attackRunes.filter((rune) => rune === 'dark').length, Math.floor(startingDarkEnergy / 3));
  if (darkEnergyUses > 0) player.darkEnergy -= darkEnergyUses * 3;
  player.nextTurnArmor += preview.nextTurnArmor;
  player.nextTurnExtraReroll += preview.nextTurnExtraReroll;
  player.nextTurnAttackMultiplierBonus = preview.nextTurnAttackMultiplierBonus;

  preview.messages.forEach(log);
  log(`总计：生命伤害 ${preview.hpDamage}，护甲 +${preview.armor}，治疗 +${preview.heal}，金币 ${signed(preview.gold)}，自伤 ${preview.selfDamage}。`);
  return preview;
}

function calculate(state: GameState, forResolve: boolean): MutablePreview {
  const preview = emptyPreview();
  const attack = materializeRunes(state, 'attack', preview);
  const defense = materializeRunes(state, 'defense', preview);
  const tactic = materializeRunes(state, 'tactic', preview);
  const discard = rawRunes(state, 'discard');

  preview.attackRunes = attack;
  preview.defenseRunes = defense;
  preview.tacticRunes = tactic;
  preview.discardRunes = discard;
  preview.tacticRune = tactic[0];

  resolveAttack(attack, state, preview);
  resolveDefense(defense, state, preview, forResolve);
  resolveTactic(tactic[0], state, preview, forResolve);
  resolveDiscard(discard, state, preview, forResolve);
  applyRelics(attack, defense, tactic, discard, state, preview);
  applyRainbowScale(state, preview);
  finalizeDamage(state, preview);
  describePreview(preview);
  return preview;
}

function rawRunes(state: GameState, slot: SlotType): RuneType[] {
  return (state.slots[slot] ?? []).map((index) => state.dice[index]?.value).filter(Boolean) as RuneType[];
}

function materializeRunes(state: GameState, slot: SlotType, preview: MutablePreview): RuneType[] {
  const runes = rawRunes(state, slot);
  return runes.map((rune, index) => {
    if (rune !== 'wild') return rune;
    const chosen = chooseWildForSlot(slot, runes, state.player, index);
    preview.messages.push(`${slotName(slot)}：万能视为 ${RUNE_NAME[chosen]}。`);
    return chosen;
  });
}

function chooseWildForSlot(slot: SlotType, runes: RuneType[], player: PlayerState, wildIndex: number): ScoringRune {
  if (slot === 'tactic') return 'gold';
  if (slot === 'discard') return 'gold';
  let bestRune: ScoringRune = slot === 'attack' ? 'dark' : 'stone';
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of SCORING_RUNES) {
    const materialized = runes.map((rune, index) => index === wildIndex ? candidate : rune).filter((rune) => rune !== 'wild') as RuneType[];
    const preview = emptyPreview();
    if (slot === 'attack') resolveAttack(materialized, { player, enemy: null } as GameState, preview);
    else resolveDefense(materialized, playerState(player), preview, false);
    const score = preview.rawDamage + preview.enemyArmorBreak * 1.5 + preview.armor + preview.heal * 2 + preview.gold - preview.selfDamage * 4;
    if (score > bestScore) {
      bestScore = score;
      bestRune = candidate;
    }
  }
  return bestRune;
}

function resolveAttack(runes: RuneType[], state: GameState, preview: MutablePreview) {
  const player = state.player;
  let darkEnergyUses = Math.floor(player.darkEnergy / 3);
  for (const rune of runes) {
    if (rune === 'fire') addDamage(preview, 'fire', 10 + player.slotBonus.attack);
    if (rune === 'thunder') {
      addDamage(preview, 'thunder', 8 + player.slotBonus.attack);
      if ((state.enemy?.armor ?? 0) > 0) preview.enemyArmorBreak += 3;
    }
    if (rune === 'dark') {
      let amount = 16 + player.slotBonus.attack;
      let selfDamage = 1;
      if (darkEnergyUses > 0) {
        amount += 8;
        darkEnergyUses--;
        preview.messages.push('暗能爆发：消耗 3 暗能，暗伤害 +8。');
      }
      if (player.relics.includes('BloodContract')) {
        amount = Math.floor(amount * 1.5);
        selfDamage += 1;
      }
      addDamage(preview, 'dark', amount);
      preview.selfDamage += selfDamage;
    }
    if (rune === 'stone') {
      addDamage(preview, 'stone', 3);
      if ((state.enemy?.armor ?? 0) > 0) preview.enemyArmorBreak += 1;
    }
    if (rune === 'water') addDamage(preview, 'water', 2);
    if (rune === 'gold') addDamage(preview, 'gold', 1);
    if (rune === 'curse') preview.selfDamage += 2;
  }

  const key = pairKey(runes);
  if (key === 'fire+fire') combo(preview, 16, 0, '双火爆燃，火焰吞没敌人！');
  if (key === 'thunder+thunder') combo(preview, 12, 4, '双雷连击，雷光撕开护甲！');
  if (key === 'fire+thunder') combo(preview, 18, (state.enemy?.armor ?? 0) > 0 ? 4 : 0, '爆燃雷击，火与雷同时爆发！');
  if (key === 'dark+fire') {
    combo(preview, 22, 0, '献祭烈焰，以生命点燃高额伤害！');
    preview.selfDamage += 1;
  }
  if (key === 'dark+thunder') combo(preview, 16, 8, '黑雷贯穿敌人的护甲！');
  if (key === 'dark+dark') {
    combo(preview, state.player.hp <= state.player.maxHp / 2 ? 48 : 32, 0, '双暗献祭，暗影爆发！');
    preview.selfDamage += 3;
  }
  if (key === 'fire+gold') {
    combo(preview, 8, 0, '熔金弹命中，金币飞溅。');
    preview.gold += 2;
  }
  if (key === 'gold+thunder') {
    combo(preview, 6, 3, '磁暴金币击穿护甲。');
    preview.gold += 2;
  }

  if (player.nextTurnAttackMultiplierBonus > 0 && preview.damagePackets.length > 0) {
    const bonus = 1 + player.nextTurnAttackMultiplierBonus;
    preview.damagePackets = preview.damagePackets.map((packet) => ({ ...packet, amount: Math.floor(packet.amount * bonus) }));
    preview.messages.push(`蓄势：本回合攻击伤害 +${Math.round(player.nextTurnAttackMultiplierBonus * 100)}%。`);
  }
}

function resolveDefense(runes: RuneType[], state: GameState, preview: MutablePreview, forResolve: boolean) {
  const player = state.player;
  let cursePenalty = 0;
  for (const rune of runes) {
    if (rune === 'stone') preview.armor += 10 + player.slotBonus.defense;
    if (rune === 'water') preview.heal += 6 + player.slotBonus.defense;
    if (rune === 'fire') {
      preview.armor += 3;
      addDamage(preview, 'fire', 2);
    }
    if (rune === 'thunder') {
      preview.armor += 4;
      preview.messages.push('防御槽：雷积蓄电荷。');
    }
    if (rune === 'gold') {
      preview.armor += 3;
      preview.gold += 1;
    }
    if (rune === 'dark') {
      preview.armor += 8;
      preview.selfDamage += 1;
    }
    if (rune === 'curse') cursePenalty += runes.includes('water') ? 2 : 4;
  }
  preview.armor = Math.max(0, preview.armor - cursePenalty);

  const key = pairKey(runes);
  if (key === 'stone+stone') {
    preview.armor += 14;
    preview.enemyAttackReduction += 2;
    preview.messages.push('坚岩壁垒，本回合敌人攻击 -2。');
  }
  if (key === 'water+water') {
    preview.heal += 10;
    preview.messages.push('双泉恢复，额外治疗并净化一个负面骰子。');
    if (forResolve) cleanseOneDie(state, 'water combo');
  }
  if (key === 'stone+water') {
    preview.armor += 8;
    preview.heal += 5;
    preview.messages.push('复苏壁垒，护甲与治疗同时生效。');
  }
  if (key === 'gold+stone') {
    preview.armor += 8;
    preview.gold += 4;
    preview.messages.push('镀金护甲，额外获得金币。');
  }
  if (key === 'dark+water') {
    preview.selfDamageReduction += 2;
    preview.darkEnergyGain += 1;
    preview.messages.push('净化暗蚀，抵消 2 点自伤并获得暗能。');
  }
  if (key === 'fire+stone') {
    preview.armor += 6;
    addDamage(preview, 'fire', 5);
    preview.messages.push('熔岩护盾，敌人攻击时反击。');
  }
}

function resolveTactic(rune: RuneType | undefined, state: GameState, preview: MutablePreview, forResolve: boolean) {
  if (!rune) return;
  const player = state.player;
  if (rune === 'fire') {
    const first = preview.damagePackets[0];
    if (first) preview.damagePackets.unshift({ ...first });
    preview.messages.push('战术火：复制攻击槽第一次伤害。');
  }
  if (rune === 'water') {
    const target = findNegativeDie(state);
    if (target) {
      preview.messages.push('战术水：净化一个负面骰子。');
      if (forResolve) cleanseDie(target);
    } else {
      preview.heal += 5;
      preview.messages.push('战术水：没有负面骰子，治疗 +5。');
    }
  }
  if (rune === 'stone') {
    preview.armor += 2;
    preview.nextTurnArmor += 8;
  }
  if (rune === 'thunder') {
    preview.nextTurnExtraReroll += 1;
    if (player.rerollsLeft > 0) preview.gold += 1;
  }
  if (rune === 'gold') preview.gold += 10 + player.slotBonus.tacticGold + (state.slots.attack.length === 0 ? 4 : 0);
  if (rune === 'dark') {
    preview.darkEnergyGain += player.hp <= player.maxHp / 2 ? 3 : 2;
    preview.selfDamage += 1;
  }
  if (rune === 'curse') {
    if (player.gold > 0) preview.gold -= 2;
    else preview.selfDamage += 2;
  }
}

function resolveDiscard(runes: RuneType[], state: GameState, preview: MutablePreview, forResolve: boolean) {
  let curseCount = 0;
  let darkCount = 0;
  for (const rune of runes) {
    if (rune === 'curse') {
      curseCount++;
      preview.selfDamageReduction += 1;
      preview.messages.push('弃掉诅咒骰，压制了诅咒。');
    }
    if (rune === 'dark') {
      darkCount++;
      preview.darkEnergyGain += 1;
      preview.messages.push('弃掉暗骰，暗能 +1。');
    }
    if (rune === 'gold' || rune === 'wild') preview.gold += 1;
  }
  if (runes.length >= 2) preview.nextTurnArmor += 1 + state.player.slotBonus.discard;
  if (runes.length >= 3) preview.nextTurnAttackMultiplierBonus += 0.1;
  if (runes.length >= 4) preview.gold += 1;
  if (darkCount >= 2) preview.darkEnergyGain += 1;
  if (curseCount >= 2 && forResolve) {
    state.dice.forEach((die) => {
      die.blocked = false;
      die.nextBlocked = false;
    });
    preview.messages.push('弃掉两个诅咒，净化了所有封印。');
  }
}

function applyRelics(attack: RuneType[], defense: RuneType[], tactic: RuneType[], discard: RuneType[], state: GameState, preview: MutablePreview) {
  const player = state.player;
  if (player.relics.includes('FlameCrown') && attack.filter((rune) => rune === 'fire').length >= 2) addRelicDamage(preview, 12, '火焰王冠额外造成 12 伤害。');
  if (player.relics.includes('StoneMask') && preview.armor >= 12) addRelicDamage(preview, 6, '石像面具反击 6 伤害。');
  if (player.relics.includes('GoldCup') && tactic[0] === 'gold') {
    preview.gold += 6;
    preview.messages.push('金杯：战术金额外获得 6 金币。');
  }
  if (player.relics.includes('BloodContract') && attack.includes('dark')) preview.messages.push('血契：暗伤害提高，自伤也提高。');
  if (player.relics.includes('CoolBoard') && discard.length >= 2) {
    preview.gold += 1;
    preview.armor += 2;
    preview.messages.push('冷静棋盘：弃骰区额外获得 1 金币和 2 护甲。');
  }
}

function applyRainbowScale(state: GameState, preview: MutablePreview) {
  if (!state.player.relics.includes('RainbowScale')) return;
  const unique = new Set<RuneType>();
  for (const slot of ['attack', 'defense', 'tactic', 'discard'] as SlotType[]) {
    for (const index of state.slots[slot] ?? []) {
      const rune = state.dice[index]?.value;
      if (rune && rune !== 'curse') unique.add(rune);
    }
  }
  if (unique.size >= 5) {
    preview.damagePackets = preview.damagePackets.map((packet) => ({ ...packet, amount: Math.floor(packet.amount * 1.3) }));
    preview.heal = Math.floor(preview.heal * 1.3);
    preview.armor = Math.floor(preview.armor * 1.3);
    preview.gold = Math.floor(preview.gold * 1.3);
    preview.messages.push('彩虹天平：五种非诅咒符文出现，所有正收益 +30%。');
  }
}

function finalizeDamage(state: GameState, preview: MutablePreview) {
  preview.selfDamage = Math.max(0, preview.selfDamage - preview.selfDamageReduction);
  preview.rawDamage = preview.damagePackets.reduce((sum, packet) => sum + packet.amount, 0);
  const enemyArmor = state.enemy?.armor ?? 0;
  const armorAfterBreak = Math.max(0, enemyArmor - preview.enemyArmorBreak);
  preview.armorDamage = Math.min(armorAfterBreak, preview.rawDamage);
  preview.hpDamage = Math.max(0, preview.rawDamage - armorAfterBreak);
}

function describePreview(preview: MutablePreview) {
  const attackCombo = comboName(preview.attackRunes);
  const defenseCombo = defenseName(preview.defenseRunes);
  preview.attackText = `攻击槽：${runeList(preview.attackRunes)}${attackCombo ? ` → ${attackCombo}` : ''}\n总伤害 ${preview.rawDamage} / 预计破甲 ${preview.enemyArmorBreak} / 打掉护甲 ${preview.armorDamage} / 生命伤害 ${preview.hpDamage}`;
  preview.defenseText = `防御槽：${runeList(preview.defenseRunes)}${defenseCombo ? ` → ${defenseCombo}` : ''}\n护甲 +${preview.armor} / 治疗 +${preview.heal} / 自伤抵消 ${preview.selfDamageReduction}`;
  preview.tacticText = `战术槽：${preview.tacticRune ? RUNE_NAME[preview.tacticRune] : '未分配'}\n${describeTactic(preview)}`;
  preview.discardText = `弃骰区：${runeList(preview.discardRunes)}\n暗能 +${preview.darkEnergyGain} / 下回合护甲 +${preview.nextTurnArmor} / 蓄势 +${Math.round(preview.nextTurnAttackMultiplierBonus * 100)}%`;
  preview.totalText = `总计：生命伤害 ${preview.hpDamage} / 护甲 +${preview.armor} / 治疗 +${preview.heal} / 金币 ${signed(preview.gold)} / 自伤 ${preview.selfDamage}`;
}

function emptyPreview(): MutablePreview {
  return {
    damagePackets: [],
    rawDamage: 0,
    armorDamage: 0,
    hpDamage: 0,
    heal: 0,
    armor: 0,
    gold: 0,
    selfDamage: 0,
    selfDamageReduction: 0,
    enemyArmorBreak: 0,
    nextTurnArmor: 0,
    nextTurnAttackMultiplierBonus: 0,
    nextTurnExtraReroll: 0,
    darkEnergyGain: 0,
    enemyAttackReduction: 0,
    attackRunes: [],
    defenseRunes: [],
    tacticRunes: [],
    discardRunes: [],
    messages: [],
    attackText: '攻击槽：未分配',
    defenseText: '防御槽：未分配',
    tacticText: '战术槽：未分配',
    discardText: '弃骰区：未分配',
    totalText: '总计：无',
  };
}

function addDamage(preview: MutablePreview, source: DamagePacket['source'], amount: number) {
  preview.damagePackets.push({ source, amount });
}

function combo(preview: MutablePreview, damage: number, breakArmor: number, message: string) {
  addDamage(preview, 'combo', damage);
  preview.enemyArmorBreak += breakArmor;
  preview.messages.push(message);
}

function addRelicDamage(preview: MutablePreview, amount: number, message: string) {
  preview.damagePackets.push({ source: 'relic', amount });
  preview.messages.push(message);
}

function cleanseOneDie(state: GameState, _reason: string) {
  const die = findNegativeDie(state);
  if (die) cleanseDie(die);
}

function findNegativeDie(state: GameState) {
  return state.dice.find((die) => die.forced) ?? state.dice.find((die) => die.blocked) ?? state.dice.find((die) => die.value === 'curse') ?? null;
}

function cleanseDie(die: { forced: boolean; blocked: boolean; value: RuneType; faces: RuneType[] }) {
  die.forced = false;
  die.blocked = false;
  if (die.value === 'curse') die.value = die.faces.find((face) => face !== 'curse') ?? 'fire';
}

function playerState(player: PlayerState): GameState {
  return { player, enemy: null } as GameState;
}

function pairKey(runes: RuneType[]) {
  return [...runes].sort().join('+');
}

function runeList(runes: RuneType[]) {
  return runes.length ? runes.map((rune) => RUNE_NAME[rune]).join(' + ') : '未分配';
}

function comboName(runes: RuneType[]) {
  const key = pairKey(runes);
  return new Map([
    ['fire+fire', '双火爆燃'],
    ['thunder+thunder', '双雷连击'],
    ['fire+thunder', '爆燃雷击'],
    ['dark+fire', '献祭烈焰'],
    ['dark+thunder', '黑雷'],
    ['dark+dark', '双暗献祭'],
    ['fire+gold', '熔金弹'],
    ['gold+thunder', '磁暴金币'],
  ]).get(key);
}

function defenseName(runes: RuneType[]) {
  const key = pairKey(runes);
  return new Map([
    ['stone+stone', '坚岩壁垒'],
    ['water+water', '双泉恢复'],
    ['stone+water', '复苏壁垒'],
    ['gold+stone', '镀金护甲'],
    ['dark+water', '净化暗蚀'],
    ['fire+stone', '熔岩护盾'],
  ]).get(key);
}

function describeTactic(preview: MutablePreview) {
  const rune = preview.tacticRune;
  if (!rune) return '无';
  if (rune === 'fire') return '复制攻击槽第一次伤害';
  if (rune === 'water') return preview.heal > 0 ? '净化或治疗 +5' : '净化负面骰子';
  if (rune === 'stone') return '当前护甲 +2，下回合护甲 +8';
  if (rune === 'thunder') return `下回合重掷 +1${preview.gold > 0 ? '，金币补偿 +1' : ''}`;
  if (rune === 'gold') return '金币 +10，空攻击时额外 +4';
  if (rune === 'dark') return '暗能 +2，自伤 1';
  if (rune === 'curse') return '失去 2 金币，不足则失去生命';
  return '万能视为金';
}

function slotName(slot: SlotType) {
  if (slot === 'attack') return '攻击槽';
  if (slot === 'defense') return '防御槽';
  if (slot === 'tactic') return '战术槽';
  return '弃骰区';
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}
