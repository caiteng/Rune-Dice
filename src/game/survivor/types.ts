export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;
export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 2400;
export const MATCH_TIME_SECONDS = 600;

export type GameMode = 'start' | 'playing' | 'upgrade' | 'gameover';

export type Enemy = {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  color: number;
  elite: boolean;
  hurtFlash: number;
  yarnCooldown: number;
};

export type Gem = {
  x: number;
  y: number;
  value: number;
  radius: number;
};

export type Chest = {
  x: number;
  y: number;
  radius: number;
};

export type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  color: number;
  pierce: number;
  hit: Set<number>;
};

export type FloatingText = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
};

export type WeaponId = 'laser' | 'claw' | 'purr' | 'yarn';

export type Stats = {
  maxHp: number;
  hp: number;
  speed: number;
  level: number;
  exp: number;
  nextExp: number;
  damage: number;
  attackSpeed: number;
  pickup: number;
  projectiles: number;
  aura: number;
  weapons: Record<WeaponId, number>;
};

export type Upgrade = {
  title: string;
  desc: string;
  apply: (stats: Stats) => void;
};

export function createBaseStats(): Stats {
  return {
    maxHp: 100,
    hp: 100,
    speed: 175,
    level: 1,
    exp: 0,
    nextExp: 8,
    damage: 1,
    attackSpeed: 1,
    pickup: 1,
    projectiles: 1,
    aura: 1,
    weapons: {
      laser: 1,
      claw: 1,
      purr: 1,
      yarn: 0,
    },
  };
}
