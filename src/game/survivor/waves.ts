export type EnemySpawnStats = {
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  color: number;
};

export function spawnIntervalForMinute(minute: number): number {
  return Math.max(0.2, Math.min(0.82, 0.82 - minute * 0.1));
}

export function spawnCountForMinute(minute: number): number {
  return 1 + Math.floor(minute * 0.9);
}

export function createEnemySpawnStats(minute: number, elite: boolean): EnemySpawnStats {
  const fast = minute > 2 && Math.random() < 0.28;
  const tank = minute > 3 && Math.random() < 0.2;
  let hp = 28 + minute * 8;
  let speed = 58 + minute * 5;
  let radius = 14;
  let damage = 9;
  let color = 0xcbd5e1;

  if (fast) {
    hp = 18 + minute * 6;
    speed = 112 + minute * 4;
    radius = 11;
    color = 0xfacc15;
  }

  if (tank) {
    hp = 68 + minute * 15;
    speed = 42;
    radius = 19;
    damage = 14;
    color = 0xa78bfa;
  }

  if (elite) {
    hp = 220 + minute * 55;
    speed = 48;
    radius = 25;
    damage = 22;
    color = 0xfb7185;
  }

  return { hp, speed, radius, damage, color };
}
