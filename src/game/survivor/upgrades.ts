import Phaser from 'phaser';
import type { PassiveId, Stats, Upgrade, WeaponId } from './types';

export const MAX_WEAPON_LEVEL = 8;
export const MAX_PASSIVE_LEVEL = 5;
export const MAX_WEAPON_SLOTS = 6;
export const MAX_PASSIVE_SLOTS = 6;

export const WEAPON_NAMES: Record<WeaponId, string> = {
  laser: '追光铃',
  claw: '猫爪飞镖',
  purr: '呼噜结界',
  yarn: '星环毛线',
  droplet: '夜露水碟',
  crescent: '月牙玩具',
};

export const EVOLVED_WEAPON_NAMES: Record<WeaponId, string> = {
  laser: '彩虹追光铃',
  claw: '连珠猫爪',
  purr: '梦魇呼噜',
  yarn: '星环毛线阵',
  droplet: '流光水碟阵',
  crescent: '满月回旋',
};

const WEAPON_DESCS: Record<WeaponId, string> = {
  laser: '自动锁定最近敌人，提升伤害和攻击频率。',
  claw: '朝移动方向连射，提升数量、伤害和穿透。',
  purr: '在身边形成持续伤害区域，提升范围和伤害。',
  yarn: '毛线球围绕猫猫旋转，提升数量和伤害。',
  droplet: '在敌人附近留下持续伤害区域，提升范围和持续时间。',
  crescent: '向上抛出穿透弹体，提升数量、范围和伤害。',
};

const PASSIVE_DEFS: Record<PassiveId, { name: string; desc: string; apply: (stats: Stats) => void }> = {
  catnip: {
    name: '猫薄荷',
    desc: '所有武器伤害提升。',
    apply: (stats) => {
      stats.damage *= 1.12;
    },
  },
  bell: {
    name: '铃铛项圈',
    desc: '武器触发频率提升。',
    apply: (stats) => {
      stats.attackSpeed *= 1.1;
    },
  },
  slippers: {
    name: '软底拖鞋',
    desc: '移动速度提升。',
    apply: (stats) => {
      stats.speed *= 1.08;
    },
  },
  snack: {
    name: '小鱼干磁力',
    desc: '经验拾取范围提升。',
    apply: (stats) => {
      stats.pickup *= 1.18;
    },
  },
  cushion: {
    name: '温热奶碗',
    desc: '缓慢恢复生命。',
    apply: (stats) => {
      stats.regen += 0.18;
    },
  },
  spring: {
    name: '发条铃扣',
    desc: '投射物飞行速度提升。',
    apply: (stats) => {
      stats.projectileSpeed *= 1.12;
    },
  },
  lantern: {
    name: '小夜灯',
    desc: '武器范围提升。',
    apply: (stats) => {
      stats.aura *= 1.12;
    },
  },
  ribbon: {
    name: '长尾缎带',
    desc: '武器持续时间提升。',
    apply: (stats) => {
      stats.duration *= 1.15;
    },
  },
};

export const EVOLUTION_PASSIVE: Record<WeaponId, PassiveId> = {
  laser: 'bell',
  claw: 'spring',
  purr: 'cushion',
  yarn: 'ribbon',
  droplet: 'snack',
  crescent: 'lantern',
};

export function createUpgradeOptions(stats: Stats): Upgrade[] {
  const ownedWeapons = (Object.keys(stats.weapons) as WeaponId[]).filter((id) => stats.weapons[id] > 0).length;
  const ownedPassives = (Object.keys(stats.passives) as PassiveId[]).filter((id) => stats.passives[id] > 0).length;
  const weaponOptions = (Object.keys(stats.weapons) as WeaponId[])
    .filter((id) => stats.weapons[id] < MAX_WEAPON_LEVEL && (stats.weapons[id] > 0 || ownedWeapons < MAX_WEAPON_SLOTS))
    .map((id) => weaponUpgrade(id, stats.weapons[id] + 1));
  const passiveOptions = (Object.keys(stats.passives) as PassiveId[])
    .filter((id) => stats.passives[id] < MAX_PASSIVE_LEVEL && (stats.passives[id] > 0 || ownedPassives < MAX_PASSIVE_SLOTS))
    .map((id) => passiveUpgrade(id, stats.passives[id] + 1));
  const fallback: Upgrade = {
    title: '夜宵补给',
    desc: '恢复 25 点生命。',
    kind: 'heal',
    currentLevel: 0,
    maxLevel: 0,
    isNew: false,
    apply: (stats) => {
      stats.hp = Math.min(stats.maxHp, stats.hp + 25);
    },
  };
  return Phaser.Utils.Array.Shuffle([...weaponOptions, ...passiveOptions, fallback]).slice(0, 3);
}

function weaponUpgrade(id: WeaponId, nextLevel: number): Upgrade {
  return {
    title: `${WEAPON_NAMES[id]} Lv.${nextLevel}`,
    desc: WEAPON_DESCS[id],
    kind: 'weapon',
    currentLevel: nextLevel - 1,
    maxLevel: MAX_WEAPON_LEVEL,
    isNew: nextLevel === 1,
    apply: (stats) => {
      upgradeWeapon(stats, id);
    },
  };
}

export function getUpgradeableWeapons(stats: Stats): WeaponId[] {
  return (Object.keys(stats.weapons) as WeaponId[]).filter((id) => stats.weapons[id] > 0 && stats.weapons[id] < MAX_WEAPON_LEVEL);
}

export function upgradeWeapon(stats: Stats, id: WeaponId): boolean {
  if (stats.weapons[id] >= MAX_WEAPON_LEVEL) return false;
  stats.weapons[id] = Math.min(MAX_WEAPON_LEVEL, stats.weapons[id] + 1);
  return true;
}

function passiveUpgrade(id: PassiveId, nextLevel: number): Upgrade {
  const passive = PASSIVE_DEFS[id];
  return {
    title: `${passive.name} Lv.${nextLevel}`,
    desc: passive.desc,
    kind: 'passive',
    currentLevel: nextLevel - 1,
    maxLevel: MAX_PASSIVE_LEVEL,
    isNew: nextLevel === 1,
    apply: (stats) => {
      if (stats.passives[id] >= MAX_PASSIVE_LEVEL) return;
      stats.passives[id]++;
      passive.apply(stats);
    },
  };
}

export function canEvolveWeapon(stats: Stats, id: WeaponId): boolean {
  return stats.weapons[id] >= MAX_WEAPON_LEVEL && stats.passives[EVOLUTION_PASSIVE[id]] > 0 && !stats.evolved[id];
}

export function getEvolvableWeapons(stats: Stats): WeaponId[] {
  return (Object.keys(stats.weapons) as WeaponId[]).filter((id) => canEvolveWeapon(stats, id));
}

export function evolveWeapon(stats: Stats, id: WeaponId): boolean {
  if (!canEvolveWeapon(stats, id)) return false;
  stats.evolved[id] = true;
  return true;
}
