import Phaser from 'phaser';
import type { Stats, Upgrade, WeaponId } from './types';

const MAX_WEAPON_LEVEL = 6;

const WEAPON_NAMES: Record<WeaponId, string> = {
  laser: '激光笔',
  claw: '猫爪飞镖',
  purr: '猫咪呼噜圈',
  yarn: '毛线球环绕',
};

const WEAPON_DESCS: Record<WeaponId, string> = {
  laser: '提高追踪光点伤害，并缩短冷却。',
  claw: '提高飞镖伤害，高等级增加数量。',
  purr: '提高身边持续伤害和范围。',
  yarn: '毛线球围绕猫猫旋转，碰到敌人造成伤害。',
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
      stats.weapons[id] = Math.min(MAX_WEAPON_LEVEL, stats.weapons[id] + 1);
    },
  };
}
