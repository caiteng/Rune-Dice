import type { EnemyState, PlayerState, RuneType } from './types';
import { RUNE_NAME } from '../data/runes';

export type DamagePacket = { source: 'fire' | 'thunder' | 'dark' | 'rainbow' | 'relic'; amount: number };
type ScoringRune = Exclude<RuneType, 'wild' | 'curse'>;
const SCORING_RUNES: ScoringRune[] = ['fire', 'water', 'stone', 'thunder', 'gold', 'dark'];

export function resolveRunes(runes: RuneType[], player: PlayerState, enemy: EnemyState, log: (s: string) => void) {
  const baseCount = (r: RuneType) => runes.filter((x) => x === r).length;
  const wild = baseCount('wild');
  const wildTarget = wild > 0 ? chooseWildTarget(runes, player) : null;
  const count = (r: ScoringRune) => baseCount(r) + (r === wildTarget ? wild : 0);
  const packets: DamagePacket[] = [];
  let heal = 0;
  let armor = 0;
  let gold = 0;
  let self = 0;

  log(`你掷出了：${runes.map((r) => RUNE_NAME[r]).join('、')}`);
  if (wildTarget) log(`万能符文转化为${RUNE_NAME[wildTarget]}。`);

  const fire = count('fire');
  const fireDamage = ([0, 3, 8, 18, 40, 100][fire] || 0) + fire * (player.runeBonus.fire || 0);
  if (fireDamage > 0) packets.push({ source: 'fire', amount: fireDamage });

  const water = count('water');
  heal += water * 2 + (water >= 2 ? 3 : 0);

  const stone = count('stone');
  armor += stone * 3 + (stone >= 3 ? 8 : 0);

  const thunder = count('thunder');
  const thunderDamage = thunder * 4 + (thunder >= 3 ? 6 : 0);
  if (thunderDamage > 0) packets.push({ source: 'thunder', amount: thunderDamage });

  const goldRunes = count('gold');
  gold += goldRunes * 2 + (goldRunes >= 3 ? 8 : 0);

  const dark = count('dark');
  const darkDamage = dark * 8 + (dark >= 3 ? 20 : 0);
  if (darkDamage > 0) packets.push({ source: 'dark', amount: darkDamage });
  self += dark;

  const uniqueColors = new Set(runes.filter((r): r is ScoringRune => r !== 'curse' && r !== 'wild'));
  const isRainbow = uniqueColors.size + wild >= 5;
  if (isRainbow) {
    packets.push({ source: 'rainbow', amount: 20 });
    heal += 5;
    armor += 5;
    gold += 5;
    if (player.relics.includes('RainbowScale')) {
      packets.push({ source: 'rainbow', amount: 20 });
      heal += 5;
      armor += 5;
      gold += 5;
      log('彩虹天平让五色组合效果翻倍。');
    }
  }

  if (player.relics.includes('FlameCrown') && fire >= 3) {
    packets.push({ source: 'relic', amount: 10 });
    log('火焰王冠额外造成 10 点伤害。');
  }
  if (player.relics.includes('GoldCup')) gold += goldRunes;
  if (player.relics.includes('BloodContract') && dark > 0) {
    packets.push({ source: 'dark', amount: Math.floor(dark * 8 * 0.5) });
    self += dark;
    log('血契强化暗符文，但你承受了额外自伤。');
  }

  player.hp = Math.max(0, Math.min(player.maxHp, player.hp + heal) - self);
  player.armor += armor;
  player.gold += gold;

  const rawDamage = packets.reduce((sum, packet) => sum + reduceDamageForEnemy(packet, enemy), 0);
  const dealt = Math.max(0, rawDamage - enemy.armor);
  enemy.armor = Math.max(0, enemy.armor - rawDamage);
  enemy.hp -= dealt;

  if (player.relics.includes('StoneMask') && armor >= 10) {
    enemy.hp -= 4;
    log('石像面具反击，造成 4 点伤害。');
  }

  describeCombo(fire, thunder, dark, dealt, log);
  log(`结算：伤害 ${dealt}，治疗 ${heal}，护甲 +${armor}，金币 +${gold}，自伤 ${self}。`);
}

function chooseWildTarget(runes: RuneType[], player: PlayerState): ScoringRune {
  const wild = runes.filter((r) => r === 'wild').length;
  let bestRune: ScoringRune = 'fire';
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const rune of SCORING_RUNES) {
    const counts = Object.fromEntries(SCORING_RUNES.map((candidate) => {
      const base = runes.filter((r) => r === candidate).length;
      return [candidate, base + (candidate === rune ? wild : 0)];
    })) as Record<ScoringRune, number>;
    const score = scoreRuneChoice(counts, player);
    if (score > bestScore) {
      bestScore = score;
      bestRune = rune;
    }
  }
  return bestRune;
}

function scoreRuneChoice(counts: Record<ScoringRune, number>, player: PlayerState) {
  const fire = ([0, 3, 8, 18, 40, 100][counts.fire] || 0) + counts.fire * (player.runeBonus.fire || 0);
  const water = counts.water * 2 + (counts.water >= 2 ? 3 : 0);
  const stone = counts.stone * 3 + (counts.stone >= 3 ? 8 : 0);
  const thunder = counts.thunder * 4 + (counts.thunder >= 3 ? 6 : 0);
  const gold = counts.gold * 2 + (counts.gold >= 3 ? 8 : 0);
  const dark = counts.dark * 8 + (counts.dark >= 3 ? 20 : 0) - counts.dark * 2;
  const relic = player.relics.includes('FlameCrown') && counts.fire >= 3 ? 10 : 0;
  return fire + water * 1.5 + stone * 1.2 + thunder + gold + dark + relic;
}

function reduceDamageForEnemy(packet: DamagePacket, enemy: EnemyState) {
  if (enemy.id === 'firespirit' && packet.source === 'fire') return Math.floor(packet.amount * 0.7);
  return packet.amount;
}

function describeCombo(fire: number, thunder: number, dark: number, dealt: number, log: (s: string) => void) {
  if (fire >= 4) log(`四火组合，造成 ${dealt} 点伤害。`);
  else if (fire >= 3) log(`三火组合，造成 ${dealt} 点伤害。`);
  else if (thunder >= 3) log(`雷鸣组合，造成 ${dealt} 点伤害。`);
  else if (dark >= 3) log(`暗影组合，造成 ${dealt} 点伤害。`);
}
