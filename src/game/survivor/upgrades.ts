import Phaser from 'phaser';
import type { Stats, Upgrade, WeaponId } from './types';

export const MAX_WEAPON_LEVEL = 8;

export const WEAPON_NAMES: Record<WeaponId, string> = {
  laser: '追光铃',
  claw: '猫爪飞镖',
  purr: '呼噜结界',
  yarn: '星环毛线',
};

const WEAPON_DESCS: Record<WeaponId, string> = {
  laser: '自动锁定最近敌人，提升伤害和攻击频率。',
  claw: '朝移动方向连射，提升数量、伤害和穿透。',
  purr: '在身边形成持续伤害区域，提升范围和伤害。',
  yarn: '毛线球围绕猫猫旋转，提升数量和伤害。',
};

const PASSIVE_POOL: Upgrade[] = [
  {
    title: '猫爪更锋利',
    desc: '所有武器伤害 +18%。',
    apply: (stats) => {
      stats.damage *= 1.18;
    },
  },
  {
    title: '追光更快',
    desc: '自动攻击频率 +16%。',
    apply: (stats) => {
      stats.attackSpeed *= 1.16;
    },
  },
  {
    title: '灵巧脚步',
    desc: '移动速度 +12%。',
    apply: (stats) => {
      stats.speed *= 1.12;
    },
  },
  {
    title: '小鱼干磁力',
    desc: '经验拾取范围 +25%。',
    apply: (stats) => {
      stats.pickup *= 1.25;
    },
  },
  {
    title: '软垫护身',
    desc: '最大生命 +20，并恢复 20 点。',
    apply: (stats) => {
      stats.maxHp += 20;
      stats.hp = Math.min(stats.maxHp, stats.hp + 20);
    },
  },
];

export function createUpgradeOptions(stats: Stats): Upgrade[] {
  const weaponOptions = (Object.keys(stats.weapons) as WeaponId[])
    .filter((id) => stats.weapons[id] < MAX_WEAPON_LEVEL)
    .map((id) => weaponUpgrade(id, stats.weapons[id] + 1));
  return Phaser.Utils.Array.Shuffle([...weaponOptions, ...PASSIVE_POOL]).slice(0, 3);
}

function weaponUpgrade(id: WeaponId, nextLevel: number): Upgrade {
  return {
    title: `${WEAPON_NAMES[id]} Lv.${nextLevel}`,
    desc: WEAPON_DESCS[id],
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
