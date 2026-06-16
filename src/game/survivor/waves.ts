export type EnemySpawnStats = {
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  color: number;
};

export function spawnIntervalForMinute(minute: number): number {
  return Math.max(0.11, Math.min(0.76, 0.76 - minute * 0.085));
}

export function spawnCountForMinute(minute: number): number {
  let count = 1 + Math.floor(minute * 1.15);
  if (minute >= 4) count += 1;
  if (minute >= 7) count += 2;
  if (minute >= 9) count += 2;
  return count;
}

export function createEnemySpawnStats(minute: number, elite: boolean): EnemySpawnStats {
  const fast = minute > 1.5 && Math.random() < Math.min(0.46, 0.18 + minute * 0.035);
  const tank = minute > 3 && Math.random() < Math.min(0.34, 0.12 + minute * 0.025);
  const pressure = 1 + Math.max(0, minute - 3) * 0.11 + Math.max(0, minute - 7) * 0.16;
  let hp = (28 + minute * 11 + Math.max(0, minute - 5) * 9) * pressure;
  let speed = 60 + minute * 6;
  let radius = 14;
  let damage = 9 + Math.floor(minute * 0.9);
  let color = 0xcbd5e1;

  if (fast) {
    hp = (20 + minute * 8) * pressure;
    speed = 118 + minute * 5;
    radius = 11;
    color = 0xfacc15;
  }

  if (tank) {
    hp = (78 + minute * 24 + Math.max(0, minute - 6) * 20) * pressure;
    speed = 44 + minute * 1.5;
    radius = 19;
    damage = 14 + Math.floor(minute * 1.2);
    color = 0xa78bfa;
  }

  if (elite) {
    hp = (260 + minute * 90 + Math.max(0, minute - 5) * 80) * pressure;
    speed = 50 + minute * 1.5;
    radius = 25;
    damage = 22 + Math.floor(minute * 1.8);
    color = 0xfb7185;
  }

  return { hp: Math.floor(hp), speed, radius, damage, color };
}
