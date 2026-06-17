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

export type Obstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'furniture' | 'box' | 'pillow';
  destructible: boolean;
  hp: number;
  maxHp: number;
  hurtFlash: number;
};

export type PickupKind = 'heal' | 'freeze' | 'magnet' | 'fish';

export type Pickup = {
  x: number;
  y: number;
  radius: number;
  kind: PickupKind;
};

export type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  radius: number;
  damage: number;
  life: number;
  color: number;
  pierce: number;
  hit: Set<number>;
};

export type Zone = {
  x: number;
  y: number;
  radius: number;
  damage: number;
  life: number;
  color: number;
};

export type FloatingText = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
};

export type WeaponId = 'laser' | 'claw' | 'purr' | 'yarn' | 'droplet' | 'crescent';
export type PassiveId = 'catnip' | 'bell' | 'slippers' | 'snack' | 'cushion' | 'spring' | 'lantern' | 'ribbon';

export type Stats = {
  maxHp: number;
  hp: number;
  speed: number;
  level: number;
  exp: number;
  nextExp: number;
  fish: number;
  damage: number;
  attackSpeed: number;
  pickup: number;
  regen: number;
  projectiles: number;
  projectileSpeed: number;
  duration: number;
  aura: number;
  weapons: Record<WeaponId, number>;
  evolved: Record<WeaponId, boolean>;
  passives: Record<PassiveId, number>;
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
    fish: 0,
    damage: 1,
    attackSpeed: 1,
    pickup: 1,
    regen: 0,
    projectiles: 1,
    projectileSpeed: 1,
    duration: 1,
    aura: 1,
    weapons: {
      laser: 1,
      claw: 0,
      purr: 0,
      yarn: 0,
      droplet: 0,
      crescent: 0,
    },
    evolved: {
      laser: false,
      claw: false,
      purr: false,
      yarn: false,
      droplet: false,
      crescent: false,
    },
    passives: {
      catnip: 0,
      bell: 0,
      slippers: 0,
      snack: 0,
      cushion: 0,
      spring: 0,
      lantern: 0,
      ribbon: 0,
    },
  };
}
