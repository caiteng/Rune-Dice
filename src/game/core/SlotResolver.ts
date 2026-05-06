import type { DamagePacket, EnemyState, GameState, PlayerState, RuneType, SlotPreview, SlotState, SlotType } from './types';
import { RUNE_NAME } from '../data/runes';

type ScoringRune = Exclude<RuneType, 'wild' | 'curse'>;
type SlotCalc = Omit<SlotPreview, 'damagePackets'> & { damagePackets: DamagePacket[] };

const SLOT_CAPACITY: Record<SlotType, number> = { attack: 2, defense: 2, tactic: 1 };
const SCORING_RUNES: ScoringRune[] = ['fire', 'water', 'stone', 'thunder', 'gold', 'dark'];

export function slotCapacity(slot: SlotType) {
  return SLOT_CAPACITY[slot];
}

export function assignedSlot(slots: SlotState, dieIndex: number): SlotType | null {
  if (slots.attack.includes(dieIndex)) return 'attack';
  if (slots.defense.includes(dieIndex)) return 'defense';
  if (slots.tactic.includes(dieIndex)) return 'tactic';
  return null;
}

export function assignedCount(slots: SlotState) {
  return slots.attack.length + slots.defense.length + slots.tactic.length;
}

export function isFullyAssigned(state: GameState) {
  return assignedCount(state.slots) === state.dice.length;
}

export function previewAssignment(state: GameState): SlotPreview {
  const calc = calculate(state, false);
  return {
    damagePackets: calc.damagePackets,
    heal: calc.heal,
    armor: calc.armor,
    gold: calc.gold,
    selfDamage: calc.selfDamage,
    enemyArmorBreak: calc.enemyArmorBreak,
    messages: calc.messages,
    attackText: calc.attackText,
    defenseText: calc.defenseText,
    tacticText: calc.tacticText,
  };
}

export function resolveAssignment(state: GameState, log: (text: string) => void): SlotPreview {
  const preview = calculate(state, true);
  const player = state.player;
  const enemy = state.enemy;
  if (!enemy) return preview;

  const totalDamage = preview.damagePackets.reduce((sum, packet) => sum + reduceDamageForEnemy(packet, enemy), 0);
  enemy.armor = Math.max(0, enemy.armor - preview.enemyArmorBreak);
  const dealt = Math.max(0, totalDamage - enemy.armor);
  enemy.armor = Math.max(0, enemy.armor - totalDamage);
  enemy.hp -= dealt;

  player.hp = Math.max(0, Math.min(player.maxHp, player.hp + preview.heal) - preview.selfDamage);
  player.armor = Math.max(0, player.armor + preview.armor);
  player.gold = Math.max(0, player.gold + preview.gold);

  preview.messages.forEach(log);
  log(`槽位结算：伤害 ${dealt}，护甲 +${preview.armor}，治疗 +${preview.heal}，金币 +${preview.gold}，自伤 ${preview.selfDamage}。`);
  return preview;
}

function calculate(state: GameState, forResolve: boolean): SlotCalc {
  const preview: SlotCalc = {
    damagePackets: [],
    heal: 0,
    armor: 0,
    gold: 0,
    selfDamage: 0,
    enemyArmorBreak: 0,
    messages: [],
    attackText: '攻击：未分配',
    defenseText: '防御：未分配',
    tacticText: '战术：未分配',
  };

  const attack = materializeRunes(state, 'attack');
  const defense = materializeRunes(state, 'defense');
  const tactic = materializeRunes(state, 'tactic');
  const attackBoost = tactic.includes('fire') ? 1.2 : 1;

  resolveAttack(attack, state.player, preview);
  resolveDefense(defense, state.player, preview);
  resolveTactic(tactic[0], state, preview, forResolve);
  applyRelics(attack, defense, tactic, state.player, preview);
  applyRainbowScale(state, preview);

  if (attackBoost > 1) {
    preview.damagePackets = preview.damagePackets.map((packet) => ({ ...packet, amount: Math.floor(packet.amount * attackBoost) }));
  }

  preview.attackText = describeAttack(attack, preview);
  preview.defenseText = describeDefense(defense, preview);
  preview.tacticText = describeTactic(tactic[0], state.player);
  return preview;
}

function materializeRunes(state: GameState, slot: SlotType): RuneType[] {
  const runes = state.slots[slot].map((index) => state.dice[index]?.value).filter(Boolean) as RuneType[];
  return runes.map((rune, index) => rune === 'wild' ? chooseWildForSlot(slot, runes, state.player, index) : rune);
}

function chooseWildForSlot(slot: SlotType, runes: RuneType[], player: PlayerState, wildIndex: number): ScoringRune {
  if (slot === 'tactic') return 'gold';
  let bestRune: ScoringRune = slot === 'attack' ? 'dark' : 'stone';
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of SCORING_RUNES) {
    const materialized = runes.map((rune, index) => index === wildIndex ? candidate : rune).filter((rune) => rune !== 'wild') as RuneType[];
    const score = slot === 'attack' ? scoreAttack(materialized, player) : scoreDefense(materialized, player);
    if (score > bestScore) {
      bestScore = score;
      bestRune = candidate;
    }
  }
  return bestRune;
}

function resolveAttack(runes: RuneType[], player: PlayerState, preview: SlotCalc) {
  for (const rune of runes) {
    if (rune === 'fire') preview.damagePackets.push({ source: 'fire', amount: 8 + player.slotBonus.attack });
    if (rune === 'thunder') preview.damagePackets.push({ source: 'thunder', amount: 6 + player.slotBonus.attack });
    if (rune === 'dark') {
      const base = 14 + player.slotBonus.attack;
      preview.damagePackets.push({ source: 'dark', amount: player.relics.includes('BloodContract') ? Math.floor(base * 1.5) : base });
      preview.selfDamage += player.relics.includes('BloodContract') ? 2 : 1;
    }
    if (rune === 'stone') preview.damagePackets.push({ source: 'stone', amount: 3 });
    if (rune === 'water') {
      preview.damagePackets.push({ source: 'water', amount: 2 });
      preview.heal += 1;
    }
    if (rune === 'gold') {
      preview.damagePackets.push({ source: 'gold', amount: 2 });
      preview.gold += 1;
    }
    if (rune === 'curse') preview.selfDamage += 1;
  }

  const names = pairKey(runes);
  if (names === 'fire+fire') {
    preview.damagePackets.push({ source: 'combo', amount: 10 });
    preview.messages.push('攻击槽：双火，额外造成 10 点火焰伤害。');
  }
  if (names === 'thunder+thunder') {
    preview.damagePackets.push({ source: 'combo', amount: 8 });
    preview.messages.push('攻击槽：双雷，额外造成 8 点雷电伤害。');
  }
  if (names === 'fire+thunder') {
    preview.damagePackets.push({ source: 'combo', amount: 12 });
    preview.messages.push('攻击槽：火 + 雷，触发爆燃雷击。');
  }
  if (names === 'dark+fire') {
    preview.damagePackets.push({ source: 'combo', amount: 16 });
    preview.selfDamage += 1;
    preview.messages.push('攻击槽：火 + 暗，触发献祭烈焰。');
  }
  if (names === 'dark+thunder') {
    preview.damagePackets.push({ source: 'combo', amount: 10 });
    preview.enemyArmorBreak += 4;
    preview.messages.push('攻击槽：雷 + 暗，触发黑雷，削减敌人 4 点护甲。');
  }
  if (names === 'dark+dark') {
    preview.damagePackets.push({ source: 'combo', amount: 24 });
    preview.selfDamage += 2;
    preview.messages.push('攻击槽：双暗，爆发高额暗影伤害。');
  }
}

function resolveDefense(runes: RuneType[], player: PlayerState, preview: SlotCalc) {
  let selfDamageToCleanse = 0;
  for (const rune of runes) {
    if (rune === 'stone') preview.armor += 8 + player.slotBonus.defense;
    if (rune === 'water') preview.heal += 5 + player.slotBonus.defense;
    if (rune === 'gold') {
      preview.armor += 2;
      preview.gold += 2;
    }
    if (rune === 'thunder') {
      preview.armor += 3;
      preview.damagePackets.push({ source: 'thunder', amount: 2 });
    }
    if (rune === 'fire') {
      preview.armor += 2;
      preview.damagePackets.push({ source: 'fire', amount: 3 });
    }
    if (rune === 'dark') {
      preview.armor += 4;
      preview.selfDamage += 1;
    }
    if (rune === 'curse') preview.armor = Math.max(0, preview.armor - 2);
  }

  const names = pairKey(runes);
  if (names === 'stone+stone') {
    preview.armor += 10;
    preview.messages.push('防御槽：双石，额外获得 10 点护甲。');
  }
  if (names === 'water+water') {
    preview.heal += 8;
    preview.messages.push('防御槽：双水，额外恢复 8 点生命。');
  }
  if (names === 'stone+water') {
    preview.armor += 6;
    preview.heal += 4;
    preview.messages.push('防御槽：水 + 石，触发坚韧恢复。');
  }
  if (names === 'gold+stone') {
    preview.armor += 5;
    preview.gold += 4;
    preview.messages.push('防御槽：石 + 金，触发镀金护甲。');
  }
  if (names === 'dark+water') {
    selfDamageToCleanse = 1;
    preview.messages.push('防御槽：水 + 暗，触发净化暗蚀，抵消 1 点自伤。');
  }
  preview.selfDamage = Math.max(0, preview.selfDamage - selfDamageToCleanse);
}

function resolveTactic(rune: RuneType | undefined, state: GameState, preview: SlotCalc, forResolve: boolean) {
  if (!rune) return;
  const player = state.player;
  if (rune === 'gold') preview.gold += 8 + player.slotBonus.tacticGold;
  if (rune === 'water') {
    const target = state.dice.find((die) => die.forced || die.blocked || die.value === 'curse');
    if (target) {
      if (forResolve) {
        target.forced = false;
        target.blocked = false;
        if (target.value === 'curse') target.value = target.faces[0] ?? 'fire';
      }
      preview.messages.push('战术槽：水，净化 1 个负面骰子。');
    } else {
      preview.heal += 4;
    }
  }
  if (rune === 'stone' && forResolve) player.nextTurnArmor += 5;
  if (rune === 'thunder' && forResolve) player.nextTurnExtraReroll += 1;
  if (rune === 'dark') {
    preview.selfDamage += 1;
    if (forResolve) player.darkEnergy += 1;
  }
  if (rune === 'curse') {
    if (player.gold > 0) preview.gold -= 1;
    else preview.selfDamage += 1;
  }
}

function applyRelics(attack: RuneType[], defense: RuneType[], tactic: RuneType[], player: PlayerState, preview: SlotCalc) {
  if (player.relics.includes('FlameCrown') && attack.filter((rune) => rune === 'fire').length >= 2) {
    preview.damagePackets.push({ source: 'relic', amount: 12 });
    preview.messages.push('火焰王冠：攻击槽有至少 2 个火，额外造成 12 点伤害。');
  }
  if (player.relics.includes('StoneMask') && preview.armor >= 12) {
    preview.damagePackets.push({ source: 'relic', amount: 6 });
    preview.messages.push('石像面具：护甲收益达到 12，反击 6 点伤害。');
  }
  if (player.relics.includes('GoldCup') && tactic[0] === 'gold') {
    preview.gold += 6;
    preview.messages.push('金杯：战术槽金符文额外获得 6 金币。');
  }
  if (player.relics.includes('BloodContract') && attack.includes('dark')) {
    preview.messages.push('血契：攻击槽暗伤害提高，但自伤增加。');
  }
}

function applyRainbowScale(state: GameState, preview: SlotCalc) {
  if (!state.player.relics.includes('RainbowScale')) return;
  const unique = new Set<RuneType>();
  for (const slot of ['attack', 'defense', 'tactic'] as SlotType[]) {
    for (const index of state.slots[slot]) {
      const rune = state.dice[index]?.value;
      if (rune && rune !== 'curse' && rune !== 'wild') unique.add(rune);
    }
  }
  if (unique.size >= 5) {
    preview.damagePackets = preview.damagePackets.map((packet) => ({ ...packet, amount: Math.floor(packet.amount * 1.3) }));
    preview.heal = Math.floor(preview.heal * 1.3);
    preview.armor = Math.floor(preview.armor * 1.3);
    preview.gold = Math.floor(preview.gold * 1.3);
    preview.messages.push('彩虹天平：三个槽位出现 5 种不同符文，所有收益提高 30%。');
  }
}

function scoreAttack(runes: RuneType[], player: PlayerState) {
  const preview = emptyPreview();
  resolveAttack(runes, player, preview);
  return preview.damagePackets.reduce((sum, packet) => sum + packet.amount, 0) + preview.gold + preview.heal - preview.selfDamage * 3;
}

function scoreDefense(runes: RuneType[], player: PlayerState) {
  const preview = emptyPreview();
  resolveDefense(runes, player, preview);
  return preview.armor + preview.heal * 1.5 + preview.gold - preview.selfDamage * 3;
}

function emptyPreview(): SlotCalc {
  return {
    damagePackets: [],
    heal: 0,
    armor: 0,
    gold: 0,
    selfDamage: 0,
    enemyArmorBreak: 0,
    messages: [],
    attackText: '',
    defenseText: '',
    tacticText: '',
  };
}

function pairKey(runes: RuneType[]) {
  return [...runes].sort().join('+');
}

function describeAttack(runes: RuneType[], preview: SlotCalc) {
  const total = preview.damagePackets.reduce((sum, packet) => sum + packet.amount, 0);
  return `攻击：${runeList(runes)}，伤害 ${total}${preview.enemyArmorBreak ? `，削甲 ${preview.enemyArmorBreak}` : ''}`;
}

function describeDefense(runes: RuneType[], preview: SlotCalc) {
  return `防御：${runeList(runes)}，护甲 +${preview.armor}，治疗 +${preview.heal}`;
}

function describeTactic(rune: RuneType | undefined, player: PlayerState) {
  if (!rune) return '战术：未分配';
  if (rune === 'gold') return `战术：金，金币 +${8 + player.slotBonus.tacticGold}`;
  if (rune === 'fire') return '战术：火，本回合攻击伤害 +20%';
  if (rune === 'water') return '战术：水，净化或治疗 +4';
  if (rune === 'stone') return '战术：石，下回合护甲 +5';
  if (rune === 'thunder') return '战术：雷，下回合重掷 +1';
  if (rune === 'dark') return '战术：暗，暗能 +1，自伤 1';
  if (rune === 'curse') return '战术：诅咒，失去金币或生命';
  return '战术：万能，视为金';
}

function runeList(runes: RuneType[]) {
  return runes.length ? runes.map((rune) => RUNE_NAME[rune]).join(' + ') : '未分配';
}

function reduceDamageForEnemy(packet: DamagePacket, _enemy: EnemyState) {
  return packet.amount;
}
