export type EnemySpawnStats = {
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  color: number;
};

export type EnemyKind = 'basic' | 'fast' | 'tank' | 'swarm';

export function spawnIntervalForMinute(minute: number): number {
  return Math.max(0.18, Math.min(0.86, 0.86 - minute * 0.062));
}

export function spawnCountForMinute(minute: number): number {
  let count = 1 + Math.floor(minute * 1.02);
  if (minute >= 4) count += 1;
  if (minute >= 7) count += 2;
  if (minute >= 9) count += 2;
  return count;
}

export function chooseEnemyKind(minute: number): EnemyKind {
  const roll = Math.random();
  const fastChance = minute < 3 ? 0 : minute < 6 ? 0.08 : minute < 8 ? 0.16 : 0.24;
  const tankChance = minute < 2 ? 0 : minute < 5 ? 0.14 : Math.min(0.3, 0.18 + minute * 0.018);
  if (roll < fastChance) return 'fast';
  if (roll < fastChance + tankChance) return 'tank';
  return 'basic';
}

export function createEnemySpawnStats(minute: number, elite: boolean, kind: EnemyKind = chooseEnemyKind(minute)): EnemySpawnStats {
  const pressure = 1 + Math.max(0, minute - 4) * 0.065 + Math.max(0, minute - 8) * 0.11;
  let hp = (24 + minute * 8.5 + Math.max(0, minute - 5) * 7) * pressure;
  let speed = 60 + minute * 6;
  let radius = 11;
  let damage = 9 + Math.floor(minute * 0.9);
  let color = 0xcbd5e1;

  if (kind === 'swarm') {
    hp = (12 + minute * 4.2) * pressure;
    speed = 92 + minute * 3.2;
    radius = 8.5;
    damage = 6 + Math.floor(minute * 0.55);
    color = 0x93c5fd;
  }

  if (kind === 'fast') {
    hp = (16 + minute * 5.6) * pressure;
    speed = 104 + minute * 4.2;
    radius = 9.5;
    color = 0xfacc15;
  }

  if (kind === 'tank') {
    hp = (64 + minute * 18 + Math.max(0, minute - 6) * 15) * pressure;
    speed = 38 + minute * 1.2;
    radius = 20;
    damage = 12 + Math.floor(minute * 1.05);
    color = 0xa78bfa;
  }

  if (elite) {
    hp = (230 + minute * 74 + Math.max(0, minute - 5) * 64) * pressure;
    speed = 50 + minute * 1.5;
    radius = 25;
    damage = 22 + Math.floor(minute * 1.8);
    color = 0xfb7185;
  }

  return { hp: Math.floor(hp), speed, radius, damage, color };
}
