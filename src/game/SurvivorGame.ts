import Phaser from 'phaser';
import { createUpgradeOptions, evolveWeapon, EVOLVED_WEAPON_NAMES, getEvolvableWeapons, getUpgradeableWeapons, upgradeWeapon, WEAPON_NAMES } from './survivor/upgrades';
import {
  type Chest,
  createBaseStats,
  GAME_HEIGHT,
  GAME_WIDTH,
  MATCH_TIME_SECONDS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Enemy,
  type FloatingText,
  type GameMode,
  type Gem,
  type Obstacle,
  type Pickup,
  type PickupKind,
  type Projectile,
  type Stats,
  type Upgrade,
  type Zone,
} from './survivor/types';
import { createEnemySpawnStats, spawnCountForMinute, spawnIntervalForMinute } from './survivor/waves';
import { INPUT_TUNING, PICKUP_TUNING, PLAYER_TUNING } from './survivor/tuning';

let WIDTH = GAME_WIDTH;
let HEIGHT = GAME_HEIGHT;
const MATCH_TIME = MATCH_TIME_SECONDS;
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const FLOOR_TEXTURE_SIZE = 1254;
const FLOOR_TILE_SIZE = 176;
const FLOOR_TILE_SCALE = FLOOR_TILE_SIZE / FLOOR_TEXTURE_SIZE;

class SurvivorScene extends Phaser.Scene {
  private mode: GameMode = 'start';
  private elapsed = 0;
  private kills = 0;
  private enemyId = 1;
  private spawnTimer = 0;
  private eliteTimer = 55;
  private laserTimer = 0;
  private clawTimer = 0;
  private dropletTimer = 0;
  private crescentTimer = 0;
  private yarnAngle = 0;
  private player = { x: WIDTH / 2, y: HEIGHT / 2, radius: 17, hurtCooldown: 0 };
  private lastMove = new Phaser.Math.Vector2(0, -1);
  private stats: Stats = createBaseStats();
  private enemies: Enemy[] = [];
  private gems: Gem[] = [];
  private chests: Chest[] = [];
  private obstacles: Obstacle[] = [];
  private pickups: Pickup[] = [];
  private projectiles: Projectile[] = [];
  private zones: Zone[] = [];
  private texts: FloatingText[] = [];
  private upgrades: Upgrade[] = [];
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private floorTile!: Phaser.GameObjects.TileSprite;
  private freezeTimer = 0;
  private joystick = {
    active: false,
    pointerId: -1,
    cx: 0,
    cy: 0,
    kx: 0,
    ky: 0,
    vx: 0,
    vy: 0,
  };

  private graphics!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private versionText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private buttonText!: Phaser.GameObjects.Text;
  private buttonBg!: Phaser.GameObjects.Rectangle;
  private upgradePanel: Phaser.GameObjects.GameObject[] = [];
  private resultPanel: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Survivor');
  }

  preload() {
    this.load.image('floor_tileset', '/assets/survivor/map/floor_tileset.png');
  }

  create() {
    this.updateViewSize();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.floorTile = this.add.tileSprite(0, 0, WIDTH, HEIGHT, 'floor_tileset').setOrigin(0).setDepth(-10);
    this.floorTile.setTileScale(FLOOR_TILE_SCALE, FLOOR_TILE_SCALE);
    this.graphics = this.add.graphics();
    this.obstacles = this.createObstacles();
    this.titleText = this.add.text(WIDTH / 2, 260, '猫猫守夜', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '42px',
      color: '#fff7d6',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hintText = this.add.text(WIDTH / 2, 330, '拖动下半屏移动，武器会自动攻击。', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#dbeafe',
      align: 'center',
      wordWrap: { width: 310 },
    }).setOrigin(0.5);
    this.versionText = this.add.text(WIDTH - 10, HEIGHT - 10, `v${VERSION}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#94a3b8',
    }).setOrigin(1, 1);
    this.buttonBg = this.add.rectangle(WIDTH / 2, 520, 210, 54, 0xfacc15, 1).setInteractive();
    this.buttonText = this.add.text(WIDTH / 2, 520, '开始守夜', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#1f2937',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hudText = this.add.text(18, 16, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#f8fafc',
      lineSpacing: 3,
    });

    this.buttonBg.on('pointerdown', () => this.handlePrimaryAction());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer));
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer));
    this.scale.on('resize', this.onResize, this);
    this.layoutHomeUi();
  }

  update(_time: number, deltaMs: number) {
    const delta = Math.min(deltaMs / 1000, 0.033);
    const pressedAction = Boolean(
      (this.keys?.SPACE && Phaser.Input.Keyboard.JustDown(this.keys.SPACE))
      || (this.keys?.ENTER && Phaser.Input.Keyboard.JustDown(this.keys.ENTER)),
    );
    if (pressedAction) {
      this.handlePrimaryAction();
    }
    if (this.mode === 'playing') {
      this.updatePlaying(delta);
    }
    this.draw();
  }

  private handlePrimaryAction() {
    if (this.mode === 'start' || this.mode === 'gameover') {
      this.startGame();
    }
  }

  private updateViewSize() {
    WIDTH = Math.max(320, Math.round(this.scale.width || GAME_WIDTH));
    HEIGHT = Math.max(568, Math.round(this.scale.height || GAME_HEIGHT));
  }

  private onResize() {
    this.updateViewSize();
    this.floorTile?.setSize(WIDTH, HEIGHT);
    this.layoutHomeUi();
    if (this.mode === 'upgrade') this.showUpgradePanel();
    if (this.mode === 'gameover') this.showResultPanel(this.stats.hp > 0 && this.elapsed >= MATCH_TIME);
  }

  private layoutHomeUi() {
    this.titleText?.setPosition(WIDTH / 2, HEIGHT * 0.3);
    this.hintText?.setPosition(WIDTH / 2, HEIGHT * 0.39);
    this.versionText?.setPosition(WIDTH - this.uiMargin(), HEIGHT - this.uiMargin());
    this.buttonBg?.setPosition(WIDTH / 2, HEIGHT * 0.62);
    this.buttonText?.setPosition(WIDTH / 2, HEIGHT * 0.62);
  }

  private startGame() {
    this.mode = 'playing';
    this.elapsed = 0;
    this.kills = 0;
    this.enemyId = 1;
    this.spawnTimer = 0;
    this.eliteTimer = 55;
    this.laserTimer = 0.25;
    this.clawTimer = 0.8;
    this.dropletTimer = 1.2;
    this.crescentTimer = 1.6;
    this.yarnAngle = 0;
    this.player = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, radius: 17, hurtCooldown: 0 };
    this.lastMove.set(0, -1);
    this.stats = createBaseStats();
    this.enemies = [];
    this.gems = [];
    this.chests = [];
    this.obstacles = this.createObstacles();
    this.pickups = [];
    this.projectiles = [];
    this.zones = [];
    this.texts = [];
    this.upgrades = [];
    this.joystick.active = false;
    this.clearUpgradePanel();
    this.clearResultPanel();
    this.titleText.setVisible(false);
    this.hintText.setVisible(false);
    this.versionText.setVisible(false);
    this.buttonBg.setVisible(false);
    this.buttonText.setVisible(false);
  }

  private updatePlaying(delta: number) {
    this.elapsed += delta;
    this.player.hurtCooldown = Math.max(0, this.player.hurtCooldown - delta);
    this.freezeTimer = Math.max(0, this.freezeTimer - delta);
    if (this.stats.regen > 0 && this.stats.hp < this.stats.maxHp) {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.regen * delta);
    }
    this.updatePlayer(delta);
    this.updateWeapons(delta);
    this.updateProjectiles(delta);
    this.updateZones(delta);
    this.updateObstacles(delta);
    this.updateEnemies(delta);
    this.updateGems(delta);
    this.updatePickups();
    this.updateChests();
    this.updateTexts(delta);
    this.spawnEnemies(delta);

    if (this.stats.hp <= 0) {
      this.endGame(false);
      return;
    }
    if (this.elapsed >= MATCH_TIME) {
      this.endGame(true);
    }
  }

  private updatePlayer(delta: number) {
    const input = this.inputVector();
    if (input.lengthSq() > 0) {
      input.normalize();
      this.lastMove.copy(input);
      this.moveCircleWithObstacles(this.player, input.x * this.stats.speed * delta, input.y * this.stats.speed * delta);
    }
    this.player.x = Phaser.Math.Clamp(this.player.x, PLAYER_TUNING.margin, WORLD_WIDTH - PLAYER_TUNING.margin);
    this.player.y = Phaser.Math.Clamp(this.player.y, PLAYER_TUNING.margin, WORLD_HEIGHT - PLAYER_TUNING.margin);
  }

  private inputVector() {
    const vector = new Phaser.Math.Vector2(this.joystick.vx, this.joystick.vy);
    if (this.cursors?.left.isDown || this.keys?.A.isDown) vector.x -= 1;
    if (this.cursors?.right.isDown || this.keys?.D.isDown) vector.x += 1;
    if (this.cursors?.up.isDown || this.keys?.W.isDown) vector.y -= 1;
    if (this.cursors?.down.isDown || this.keys?.S.isDown) vector.y += 1;
    return vector;
  }

  private updateWeapons(delta: number) {
    const attackScale = 1 / this.stats.attackSpeed;
    const laserLevel = this.stats.weapons.laser;
    const clawLevel = this.stats.weapons.claw;
    const purrLevel = this.stats.weapons.purr;
    const yarnLevel = this.stats.weapons.yarn;
    const dropletLevel = this.stats.weapons.droplet;
    const crescentLevel = this.stats.weapons.crescent;
    this.yarnAngle += delta * (2.7 + yarnLevel * 0.18);
    this.laserTimer -= delta;
    this.clawTimer -= delta;
    this.dropletTimer -= delta;
    this.crescentTimer -= delta;
    if (laserLevel > 0 && this.laserTimer <= 0) {
      const evolved = this.stats.evolved.laser;
      const shots = evolved ? 2 : 1;
      for (let i = 0; i < shots; i++) {
        this.fireAtNearest(
          (22 + laserLevel * 7) * this.stats.damage * (evolved ? 1.35 : 1),
          (440 + i * 40) * this.stats.projectileSpeed,
          evolved ? 0xa5f3fc : 0x7dd3fc,
          evolved ? 4 : laserLevel >= 4 ? 2 : 1,
        );
      }
      this.laserTimer = Math.max(evolved ? 0.08 : 0.1, (0.74 - laserLevel * 0.06) * attackScale * (evolved ? 0.46 : 1));
    }
    if (clawLevel > 0 && this.clawTimer <= 0) {
      const evolved = this.stats.evolved.claw;
      const count = Math.min(evolved ? 6 : 5, 1 + Math.floor((clawLevel - 1) / 2) + Math.max(0, this.stats.projectiles - 1) + (evolved ? 2 : 0));
      const baseAngle = this.lastMove.angle();
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (i - (count - 1) / 2) * (evolved ? 0.06 : 0.32);
        this.projectiles.push({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * (evolved ? 520 : 330) * this.stats.projectileSpeed,
          vy: Math.sin(angle) * (evolved ? 520 : 330) * this.stats.projectileSpeed,
          gravity: 0,
          radius: 7,
          damage: (13 + clawLevel * 5) * this.stats.damage * (evolved ? 1.12 : 1),
          life: evolved ? 1.2 : 1,
          color: evolved ? 0xfde68a : 0xffa366,
          pierce: evolved ? 8 : clawLevel >= 4 ? 2 : 1,
          hit: new Set(),
        });
      }
      this.clawTimer = evolved ? Math.max(0.08, 0.16 * attackScale) : Math.max(0.24, (1.1 - clawLevel * 0.05) * attackScale);
    }
    if (purrLevel > 0) {
      const purrEvolved = this.stats.evolved.purr;
      const auraRadius = 42 + purrLevel * 17 + this.stats.aura * 5 + (purrEvolved ? 32 : 0);
      const auraDamage = (6 + purrLevel * 4 + this.stats.aura) * this.stats.damage * delta * (purrEvolved ? 1.65 : 1);
      for (const enemy of this.enemies) {
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) < auraRadius + enemy.radius) {
          this.hurtEnemy(enemy, auraDamage, '#bae6fd');
        }
      }
      this.damageBreakableObstaclesInCircle(this.player.x, this.player.y, auraRadius, auraDamage);
    }
    if (yarnLevel > 0) {
      const evolved = this.stats.evolved.yarn;
      const count = Math.min(evolved ? 7 : 5, 1 + Math.floor((yarnLevel + 1) / 2) + (evolved ? 2 : 0));
      const orbit = 62 + yarnLevel * 9 + (evolved ? 24 : 0);
      const damage = (10 + yarnLevel * 4) * this.stats.damage * (evolved ? 1.45 : 1);
      const hitCooldown = (evolved ? 0.2 : 0.32) / this.stats.duration;
      for (let i = 0; i < count; i++) {
        const angle = this.yarnAngle + (Math.PI * 2 * i) / count;
        const x = this.player.x + Math.cos(angle) * orbit;
        const y = this.player.y + Math.sin(angle) * orbit;
        for (const enemy of this.enemies) {
          if (enemy.yarnCooldown > this.elapsed) continue;
          if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= 14 + enemy.radius) {
            this.hurtEnemy(enemy, damage, '#fde68a');
            enemy.yarnCooldown = this.elapsed + hitCooldown;
          }
        }
        this.damageBreakableObstaclesInCircle(x, y, 14, damage);
      }
    }
    if (dropletLevel > 0 && this.dropletTimer <= 0) {
      const evolved = this.stats.evolved.droplet;
      const drops = Math.min(evolved ? 4 : 3, 1 + Math.floor((dropletLevel - 1) / 3) + (evolved ? 2 : 0));
      for (let i = 0; i < drops; i++) {
        this.spawnDropletZone(dropletLevel, evolved);
      }
      this.dropletTimer = Math.max(0.55, (2.05 - dropletLevel * 0.1) * attackScale * (evolved ? 0.7 : 1));
    }
    if (crescentLevel > 0 && this.crescentTimer <= 0) {
      const evolved = this.stats.evolved.crescent;
      if (evolved) {
        this.fireCrescentSpiral(crescentLevel);
      } else {
        this.fireCrescentArc(crescentLevel);
      }
      this.crescentTimer = Math.max(evolved ? 1.15 : 1.35, (2.45 - crescentLevel * 0.11) * attackScale * (evolved ? 0.82 : 1));
    }
  }

  private fireAtNearest(damage: number, speed: number, color: number, pierce: number) {
    const target = this.nearestEnemy();
    if (!target) return;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    this.projectiles.push({
      x: this.player.x,
      y: this.player.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0,
      radius: 5,
      damage,
      life: 1.2,
      color,
      pierce,
      hit: new Set(),
    });
  }

  private spawnDropletZone(level: number, evolved: boolean) {
    const target = this.nearestEnemy();
    const spread = evolved ? 110 : 150;
    const x = target ? target.x + Phaser.Math.Between(-spread, spread) : this.player.x + Phaser.Math.Between(-180, 180);
    const y = target ? target.y + Phaser.Math.Between(-spread, spread) : this.player.y + Phaser.Math.Between(-180, 180);
    this.zones.push({
      x: Phaser.Math.Clamp(x, 24, WORLD_WIDTH - 24),
      y: Phaser.Math.Clamp(y, 24, WORLD_HEIGHT - 24),
      radius: (34 + level * 5 + this.stats.aura * 4) * (evolved ? 1.3 : 1),
      damage: (5 + level * 2.3) * this.stats.damage * (evolved ? 1.42 : 1),
      life: (2.2 + level * 0.13) * this.stats.duration * (evolved ? 1.55 : 1),
      color: evolved ? 0x67e8f9 : 0x38bdf8,
    });
  }

  private fireCrescentArc(level: number) {
    const count = Math.min(4, 1 + Math.floor((level - 1) / 2));
    const baseSpeed = 250 * this.stats.projectileSpeed;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * 0.26;
      this.projectiles.push({
        x: this.player.x,
        y: this.player.y - 8,
        vx: Math.sin(offset) * baseSpeed,
        vy: -baseSpeed * (1.18 - Math.abs(offset) * 0.25),
        gravity: 430,
        radius: 10 + this.stats.aura * 1.4,
        damage: (18 + level * 6) * this.stats.damage,
        life: (1.8 + level * 0.08) * this.stats.duration,
        color: 0xc4b5fd,
        pierce: level >= 5 ? 2 : 1,
        hit: new Set(),
      });
    }
  }

  private fireCrescentSpiral(level: number) {
    const count = 10;
    const speed = 285 * this.stats.projectileSpeed;
    const phase = this.elapsed * 1.8;
    for (let i = 0; i < count; i++) {
      const angle = phase + (Math.PI * 2 * i) / count;
      this.projectiles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0,
        radius: 11 + this.stats.aura * 1.8,
        damage: (18 + level * 6) * this.stats.damage * 1.35,
        life: 1.8 * this.stats.duration,
        color: 0xf0abfc,
        pierce: 4,
        hit: new Set(),
      });
    }
  }

  private updateZones(delta: number) {
    for (const zone of this.zones) {
      zone.life -= delta;
      for (const enemy of this.enemies) {
        if (Phaser.Math.Distance.Between(zone.x, zone.y, enemy.x, enemy.y) <= zone.radius + enemy.radius) {
          this.hurtEnemy(enemy, zone.damage * delta, '#e0f2fe');
        }
      }
      this.damageBreakableObstaclesInCircle(zone.x, zone.y, zone.radius, zone.damage * delta);
    }
    this.zones = this.zones.filter((zone) => zone.life > 0);
  }

  private updateProjectiles(delta: number) {
    for (const projectile of this.projectiles) {
      projectile.vy += projectile.gravity * delta;
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
      projectile.life -= delta;
      for (const enemy of this.enemies) {
        if (projectile.hit.has(enemy.id)) continue;
        const distance = Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y);
        if (distance <= projectile.radius + enemy.radius) {
          projectile.hit.add(enemy.id);
          this.hurtEnemy(enemy, projectile.damage, '#ffffff');
          if (projectile.pierce > 0) {
            projectile.pierce--;
          } else {
            projectile.life = 0;
          }
          break;
        }
      }
      if (projectile.life <= 0) continue;
      for (const obstacle of this.obstacles) {
        if (!this.circleHitsObstacle(projectile.x, projectile.y, projectile.radius, obstacle)) continue;
        if (obstacle.destructible) {
          this.hurtObstacle(obstacle, projectile.damage);
          if (projectile.pierce > 0) {
            projectile.pierce--;
          } else {
            projectile.life = 0;
          }
        } else {
          projectile.life = 0;
        }
        break;
      }
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0);
  }

  private updateEnemies(delta: number) {
    for (const enemy of this.enemies) {
      enemy.hurtFlash = Math.max(0, enemy.hurtFlash - delta);
      if (this.freezeTimer <= 0) {
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        this.moveCircleWithObstacles(enemy, Math.cos(angle) * enemy.speed * delta, Math.sin(angle) * enemy.speed * delta);
      }
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      if (distance <= enemy.radius + this.player.radius && this.player.hurtCooldown <= 0) {
        this.stats.hp -= enemy.damage;
        this.player.hurtCooldown = 0.55;
        this.addText(this.player.x, this.player.y - 28, `-${enemy.damage}`, '#fecaca');
      }
    }

    const dead = this.enemies.filter((enemy) => enemy.hp <= 0);
    for (const enemy of dead) {
      this.kills++;
      this.gems.push(this.createExpGem(enemy));
      if (this.stats.evolved.purr && this.isEnemyInPurrAura(enemy)) {
        this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 1);
        if (Math.random() < 0.35) this.addText(this.player.x, this.player.y - 46, '+1', '#bbf7d0');
      }
      if (enemy.elite) {
        this.chests.push({ x: enemy.x, y: enemy.y, radius: 15 });
        this.addText(enemy.x, enemy.y - 20, '宝箱掉落', '#fde68a');
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
  }

  private createExpGem(enemy: Enemy): Gem {
    if (enemy.elite) {
      return { x: enemy.x, y: enemy.y, value: this.elapsed >= 360 ? 15 : 8, radius: 8 };
    }

    const minute = this.elapsed / 60;
    const roll = Math.random();
    if (minute >= 7 && roll < 0.1) return { x: enemy.x, y: enemy.y, value: 5, radius: 7 };
    if (minute >= 3 && roll < 0.26) return { x: enemy.x, y: enemy.y, value: 2, radius: 6 };
    return { x: enemy.x, y: enemy.y, value: 1, radius: 5 };
  }

  private updateObstacles(delta: number) {
    for (const obstacle of this.obstacles) {
      obstacle.hurtFlash = Math.max(0, obstacle.hurtFlash - delta);
    }

    const broken = this.obstacles.filter((obstacle) => obstacle.destructible && obstacle.hp <= 0);
    for (const obstacle of broken) {
      this.spawnObstacleReward(obstacle);
      this.addText(obstacle.x, obstacle.y - 24, '打碎', '#fef3c7');
    }
    this.obstacles = this.obstacles.filter((obstacle) => !obstacle.destructible || obstacle.hp > 0);
  }

  private spawnObstacleReward(obstacle: Obstacle) {
    const roll = Math.random();
    let kind: PickupKind | null = null;
    if (roll < 0.15) kind = 'fish';
    else if (roll < 0.23) kind = 'heal';
    else if (roll < 0.28) kind = 'magnet';
    else if (roll < 0.3) kind = 'freeze';
    if (!kind) return;
    this.pickups.push({ x: obstacle.x, y: obstacle.y, radius: 11, kind });
  }

  private isEnemyInPurrAura(enemy: Enemy) {
    const auraRadius = 42 + this.stats.weapons.purr * 17 + this.stats.aura * 5 + (this.stats.evolved.purr ? 32 : 0);
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) < auraRadius + enemy.radius;
  }

  private updateGems(delta: number) {
    const pickupRadius = PICKUP_TUNING.baseRadius * this.stats.pickup;
    for (const gem of this.gems) {
      const distance = Phaser.Math.Distance.Between(gem.x, gem.y, this.player.x, this.player.y);
      if (distance < pickupRadius) {
        const angle = Phaser.Math.Angle.Between(gem.x, gem.y, this.player.x, this.player.y);
        const pull = 1 - distance / pickupRadius;
        const speed = Phaser.Math.Linear(PICKUP_TUNING.minMagnetSpeed, PICKUP_TUNING.maxMagnetSpeed, pull);
        gem.x += Math.cos(angle) * speed * delta;
        gem.y += Math.sin(angle) * speed * delta;
      }
      if (distance <= gem.radius + this.player.radius + 4) {
        this.gainExp(gem.value);
        gem.value = 0;
      }
    }
    this.gems = this.gems.filter((gem) => gem.value > 0);
  }

  private updatePickups() {
    for (const pickup of this.pickups) {
      if (Phaser.Math.Distance.Between(pickup.x, pickup.y, this.player.x, this.player.y) <= pickup.radius + this.player.radius + 6) {
        this.applyPickup(pickup);
        pickup.radius = 0;
      }
    }
    this.pickups = this.pickups.filter((pickup) => pickup.radius > 0);
  }

  private applyPickup(pickup: Pickup) {
    if (pickup.kind === 'heal') {
      const amount = 30;
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
      this.addText(this.player.x, this.player.y - 42, `恢复 ${amount}`, '#bbf7d0');
      return;
    }
    if (pickup.kind === 'freeze') {
      this.freezeTimer = 4;
      this.addText(this.player.x, this.player.y - 42, '静止', '#bfdbfe');
      return;
    }
    if (pickup.kind === 'magnet') {
      for (const gem of this.gems) {
        this.gainExp(gem.value);
        gem.value = 0;
      }
      this.addText(this.player.x, this.player.y - 42, '吸收经验', '#67e8f9');
      return;
    }
    this.stats.fish += 15;
    this.addText(this.player.x, this.player.y - 42, '小鱼干 +15', '#fde68a');
  }

  private updateChests() {
    for (const chest of this.chests) {
      const distance = Phaser.Math.Distance.Between(chest.x, chest.y, this.player.x, this.player.y);
      if (distance <= chest.radius + this.player.radius + 8) {
        this.openChest(chest);
        chest.radius = 0;
      }
    }
    this.chests = this.chests.filter((chest) => chest.radius > 0);
  }

  private updateTexts(delta: number) {
    for (const text of this.texts) {
      text.y -= 24 * delta;
      text.life -= delta;
    }
    this.texts = this.texts.filter((text) => text.life > 0);
  }

  private spawnEnemies(delta: number) {
    this.spawnTimer -= delta;
    this.eliteTimer -= delta;
    const minute = this.elapsed / 60;
    if (this.spawnTimer <= 0) {
      const count = spawnCountForMinute(minute);
      for (let i = 0; i < count; i++) this.spawnEnemy(false);
      this.spawnTimer = spawnIntervalForMinute(minute);
    }
    if (this.eliteTimer <= 0) {
      this.spawnEnemy(true);
      this.eliteTimer = 60;
    }
  }

  private spawnEnemy(elite: boolean) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const radiusFromPlayer = Math.max(WIDTH, HEIGHT) * 0.68;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * radiusFromPlayer, 12, WORLD_WIDTH - 12);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * radiusFromPlayer, 12, WORLD_HEIGHT - 12);

    const minute = this.elapsed / 60;
    const { hp, speed, radius, damage, color } = createEnemySpawnStats(minute, elite);
    this.enemies.push({
      id: this.enemyId++,
      x,
      y,
      hp,
      maxHp: hp,
      speed,
      radius,
      damage,
      color,
      elite,
      hurtFlash: 0,
      yarnCooldown: 0,
    });
  }

  private createObstacles(): Obstacle[] {
    const placements: Array<[number, number, number, number, Obstacle['kind'], boolean]> = [
      [760, 820, 86, 54, 'furniture', false],
      [1630, 900, 78, 58, 'furniture', false],
      [720, 1640, 96, 48, 'furniture', false],
      [1690, 1580, 72, 64, 'furniture', false],
      [1020, 630, 58, 48, 'box', true],
      [1390, 720, 58, 48, 'pillow', true],
      [620, 1180, 58, 48, 'box', true],
      [1810, 1210, 58, 48, 'pillow', true],
      [980, 1800, 58, 48, 'pillow', true],
      [1450, 1760, 58, 48, 'box', true],
    ];
    return placements.map(([x, y, width, height, kind, destructible]) => ({
      x,
      y,
      width,
      height,
      kind,
      destructible,
      hp: destructible ? 55 : Number.POSITIVE_INFINITY,
      maxHp: destructible ? 55 : Number.POSITIVE_INFINITY,
      hurtFlash: 0,
    }));
  }

  private moveCircleWithObstacles(body: { x: number; y: number; radius: number }, dx: number, dy: number) {
    body.x += dx;
    for (const obstacle of this.obstacles) {
      this.resolveCircleRect(body, obstacle);
    }
    body.y += dy;
    for (const obstacle of this.obstacles) {
      this.resolveCircleRect(body, obstacle);
    }
  }

  private resolveCircleRect(body: { x: number; y: number; radius: number }, obstacle: Obstacle) {
    const left = obstacle.x - obstacle.width / 2;
    const right = obstacle.x + obstacle.width / 2;
    const top = obstacle.y - obstacle.height / 2;
    const bottom = obstacle.y + obstacle.height / 2;
    const nearestX = Phaser.Math.Clamp(body.x, left, right);
    const nearestY = Phaser.Math.Clamp(body.y, top, bottom);
    const diffX = body.x - nearestX;
    const diffY = body.y - nearestY;
    const distanceSq = diffX * diffX + diffY * diffY;
    const minDistance = body.radius;
    if (distanceSq >= minDistance * minDistance) return;

    if (distanceSq > 0.0001) {
      const distance = Math.sqrt(distanceSq);
      const push = minDistance - distance;
      body.x += (diffX / distance) * push;
      body.y += (diffY / distance) * push;
      return;
    }

    const distances = [
      { axis: 'x', value: left - body.x - minDistance },
      { axis: 'x', value: right - body.x + minDistance },
      { axis: 'y', value: top - body.y - minDistance },
      { axis: 'y', value: bottom - body.y + minDistance },
    ];
    distances.sort((a, b) => Math.abs(a.value) - Math.abs(b.value));
    const best = distances[0];
    if (best.axis === 'x') body.x += best.value;
    else body.y += best.value;
  }

  private damageBreakableObstaclesInCircle(x: number, y: number, radius: number, damage: number) {
    for (const obstacle of this.obstacles) {
      if (!obstacle.destructible) continue;
      if (this.circleHitsObstacle(x, y, radius, obstacle)) {
        this.hurtObstacle(obstacle, damage);
      }
    }
  }

  private circleHitsObstacle(x: number, y: number, radius: number, obstacle: Obstacle) {
    const left = obstacle.x - obstacle.width / 2;
    const right = obstacle.x + obstacle.width / 2;
    const top = obstacle.y - obstacle.height / 2;
    const bottom = obstacle.y + obstacle.height / 2;
    const nearestX = Phaser.Math.Clamp(x, left, right);
    const nearestY = Phaser.Math.Clamp(y, top, bottom);
    return Phaser.Math.Distance.Between(x, y, nearestX, nearestY) <= radius;
  }

  private hurtObstacle(obstacle: Obstacle, amount: number) {
    if (!obstacle.destructible || obstacle.hp <= 0) return;
    obstacle.hp -= amount;
    obstacle.hurtFlash = 0.08;
  }

  private openChest(chest: Chest) {
    const evolvable = getEvolvableWeapons(this.stats);
    if (evolvable.length > 0) {
      const id = Phaser.Utils.Array.GetRandom(evolvable);
      evolveWeapon(this.stats, id);
      this.addText(chest.x, chest.y - 22, `${EVOLVED_WEAPON_NAMES[id]}！`, '#fef08a');
      return;
    }

    const rolls = this.chestRollCount();
    if (this.tryChestUtilityReward(chest, rolls)) return;

    let applied = 0;
    for (let i = 0; i < rolls; i++) {
      const options = getUpgradeableWeapons(this.stats);
      if (options.length === 0) break;
      const id = Phaser.Utils.Array.GetRandom(options);
      if (upgradeWeapon(this.stats, id)) {
        applied++;
        this.addText(chest.x, chest.y - 30 - applied * 16, `${WEAPON_NAMES[id]} +1`, '#fef3c7');
      }
    }
    if (applied === 0) {
      this.gainFish(chest, 20 + rolls * 10);
      return;
    }
    this.addText(chest.x, chest.y - 18, applied >= 5 ? '五连宝箱！' : applied >= 3 ? '三连宝箱！' : '宝箱强化', '#fde68a');
  }

  private tryChestUtilityReward(chest: Chest, rolls: number) {
    const hasUpgradeableWeapon = getUpgradeableWeapons(this.stats).length > 0;
    const hpRatio = this.stats.hp / this.stats.maxHp;
    const roll = Math.random();

    if (hpRatio < 0.65 && roll < 0.35) {
      const amount = rolls >= 5 ? 60 : rolls >= 3 ? 45 : 30;
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
      this.addText(chest.x, chest.y - 24, `恢复 ${amount}`, '#bbf7d0');
      return true;
    }

    if (!hasUpgradeableWeapon || roll > 0.72) {
      this.gainFish(chest, rolls >= 5 ? 90 : rolls >= 3 ? 55 : 25);
      return true;
    }

    return false;
  }

  private gainFish(chest: Chest, amount: number) {
    this.stats.fish += amount;
    this.addText(chest.x, chest.y - 24, `小鱼干 +${amount}`, '#fde68a');
  }

  private chestRollCount() {
    const roll = Math.random();
    if (roll < 0.05) return 5;
    if (roll < 0.25) return 3;
    return 1;
  }

  private gainExp(value: number) {
    this.stats.exp += value;
    while (this.stats.exp >= this.stats.nextExp) {
      this.stats.exp -= this.stats.nextExp;
      this.stats.level++;
      this.stats.nextExp = this.expForLevel(this.stats.level);
      this.startUpgrade();
    }
  }

  private expForLevel(level: number) {
    const earlyCurve = [0, 2, 5, 9, 14, 20];
    if (level < earlyCurve.length) return earlyCurve[level];
    if (level < 20) return Math.floor(6 + level * 4.2);
    if (level < 40) return Math.floor(34 + level * 5.8);
    return Math.floor(72 + level * 8.4);
  }

  private startUpgrade() {
    this.mode = 'upgrade';
    this.joystick.active = false;
    this.joystick.vx = 0;
    this.joystick.vy = 0;
    this.upgrades = createUpgradeOptions(this.stats);
    this.showUpgradePanel();
  }

  private showUpgradePanel() {
    this.clearUpgradePanel();
    const margin = this.uiMargin();
    const panelWidth = Math.min(344, WIDTH - margin * 2);
    const cardWidth = panelWidth - 52;
    const panelHeight = Math.min(408, HEIGHT - margin * 8);
    const panelTop = (HEIGHT - panelHeight) / 2;
    const bg = this.add.rectangle(WIDTH / 2, HEIGHT / 2, panelWidth, panelHeight, 0x111827, 0.98).setStrokeStyle(2, 0xfacc15, 0.9);
    const title = this.add.text(WIDTH / 2, panelTop + 42, '选择强化', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      color: '#fef3c7',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.upgradePanel.push(bg, title);
    this.upgrades.forEach((upgrade, index) => {
      const y = panelTop + 118 + index * Math.min(92, panelHeight * 0.225);
      const card = this.add.rectangle(WIDTH / 2, y, cardWidth, 72, 0x1f2a44, 1).setStrokeStyle(1, 0x93c5fd, 0.55).setInteractive();
      const textX = WIDTH / 2 - cardWidth / 2 + 18;
      const name = this.add.text(textX, y - 22, upgrade.title, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      const desc = this.add.text(textX, y + 5, upgrade.desc, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#cbd5e1',
        wordWrap: { width: cardWidth - 40 },
      });
      card.on('pointerdown', () => this.pickUpgrade(index));
      this.upgradePanel.push(card, name, desc);
    });
  }

  private pickUpgrade(index: number) {
    const upgrade = this.upgrades[index];
    if (!upgrade) return;
    upgrade.apply(this.stats);
    this.addText(this.player.x, this.player.y - 36, upgrade.title, '#fde68a');
    this.clearUpgradePanel();
    this.mode = 'playing';
  }

  private clearUpgradePanel() {
    for (const item of this.upgradePanel) item.destroy();
    this.upgradePanel = [];
  }

  private hurtEnemy(enemy: Enemy, amount: number, color: string) {
    enemy.hp -= amount;
    enemy.hurtFlash = 0.08;
    if (amount >= 18 || Math.random() < 0.12) {
      this.addText(enemy.x, enemy.y - enemy.radius, String(Math.ceil(amount)), color);
    }
  }

  private nearestEnemy() {
    let best: Enemy | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (distance < bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }
    return best;
  }

  private addText(x: number, y: number, text: string, color: string) {
    this.texts.push({ x, y, text, color, life: 0.72 });
  }

  private endGame(won: boolean) {
    this.mode = 'gameover';
    this.clearUpgradePanel();
    this.showResultPanel(won);
    this.buttonText.setText('再来一局');
    this.buttonBg.setVisible(true);
    this.buttonText.setVisible(true);
  }

  private showResultPanel(won: boolean) {
    this.clearResultPanel();
    const margin = this.uiMargin();
    const panelWidth = Math.min(332, WIDTH - margin * 2);
    const panelHeight = Math.min(356, HEIGHT - margin * 10);
    const panelY = HEIGHT / 2;
    const panelTop = panelY - panelHeight / 2;
    const panel = this.add.rectangle(WIDTH / 2, panelY, panelWidth, panelHeight, 0x0f172a, 0.97)
      .setStrokeStyle(2, won ? 0xfacc15 : 0xfb7185, 0.9)
      .setDepth(20);
    const eyebrow = this.add.text(WIDTH / 2, panelTop + 34, won ? '守夜完成' : '仍需再试', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: won ? '#fde68a' : '#fecaca',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
    this.titleText
      .setText(won ? '天亮了' : '守夜失败')
      .setPosition(WIDTH / 2, panelTop + 80)
      .setDepth(21)
      .setVisible(true);
    this.hintText
      .setText(won ? '猫猫守住了夜晚房间。' : '猫猫被梦魇包围了。')
      .setPosition(WIDTH / 2, panelTop + 120)
      .setDepth(21)
      .setVisible(true);

    const rows = [
      ['存活时间', this.timeText(this.elapsed)],
      ['清理怪物', `${this.kills}`],
      ['最终等级', `Lv.${this.stats.level}`],
      ['小鱼干', `${this.stats.fish}`],
      ['剩余生命', `${Math.max(0, Math.ceil(this.stats.hp))}/${this.stats.maxHp}`],
      ['伤害倍率', `x${this.stats.damage.toFixed(2)}`],
    ];

    rows.forEach(([label, value], index) => {
      const y = panelTop + 170 + index * 34;
      const rowWidth = panelWidth - 64;
      const rowBg = this.add.rectangle(WIDTH / 2, y, rowWidth, 28, 0x1f2937, 0.72).setDepth(21);
      const labelText = this.add.text(WIDTH / 2 - rowWidth / 2 + 12, y, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#cbd5e1',
      }).setOrigin(0, 0.5).setDepth(22);
      const valueText = this.add.text(WIDTH / 2 + rowWidth / 2 - 12, y, value, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5).setDepth(22);
      this.resultPanel.push(rowBg, labelText, valueText);
    });

    this.buttonBg.setPosition(WIDTH / 2, panelTop + panelHeight - 38).setDepth(22);
    this.buttonText.setPosition(WIDTH / 2, panelTop + panelHeight - 38).setDepth(23);
    this.resultPanel.push(panel, eyebrow);
  }

  private clearResultPanel() {
    for (const item of this.resultPanel) item.destroy();
    this.resultPanel = [];
    this.titleText?.setDepth(0);
    this.hintText?.setDepth(0);
    this.buttonBg?.setDepth(0);
    this.buttonText?.setDepth(0);
    this.layoutHomeUi();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.mode !== 'playing') return;
    if (pointer.y < HEIGHT * INPUT_TUNING.joystickStartYRatio) return;
    this.joystick.active = true;
    this.joystick.pointerId = pointer.id;
    this.joystick.cx = pointer.x;
    this.joystick.cy = pointer.y;
    this.joystick.kx = pointer.x;
    this.joystick.ky = pointer.y;
    this.joystick.vx = 0;
    this.joystick.vy = 0;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.joystick.active || pointer.id !== this.joystick.pointerId) return;
    const dx = pointer.x - this.joystick.cx;
    const dy = pointer.y - this.joystick.cy;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const radius = INPUT_TUNING.joystickRadius;
    const scale = Math.min(radius, distance) / distance;
    const ox = dx * scale;
    const oy = dy * scale;
    this.joystick.kx = this.joystick.cx + ox;
    this.joystick.ky = this.joystick.cy + oy;
    this.joystick.vx = Math.abs(ox) > INPUT_TUNING.joystickDeadzone ? ox / radius : 0;
    this.joystick.vy = Math.abs(oy) > INPUT_TUNING.joystickDeadzone ? oy / radius : 0;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.joystick.pointerId) return;
    this.joystick.active = false;
    this.joystick.pointerId = -1;
    this.joystick.vx = 0;
    this.joystick.vy = 0;
  }

  private draw() {
    this.graphics.clear();
    this.drawBackground();
    if (this.mode === 'start') {
      this.drawStartScene();
      return;
    }
    this.drawWorld();
    this.drawWorldEdgeShadow();
    this.drawHud();
    if (this.mode === 'playing') this.drawJoystick();
    if (this.mode === 'gameover') {
      this.graphics.fillStyle(0x030712, 0.54).fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  private drawBackground() {
    this.floorTile.setTilePosition(Math.round(this.cameraX()) / FLOOR_TILE_SCALE, Math.round(this.cameraY()) / FLOOR_TILE_SCALE);
  }

  private drawStartScene() {
    const margin = this.uiMargin();
    const panelWidth = Math.min(338, WIDTH - margin * 2);
    const panelHeight = Math.min(410, HEIGHT * 0.5);
    const panelX = (WIDTH - panelWidth) / 2;
    const panelY = Math.max(margin * 4, HEIGHT * 0.25);
    this.graphics.fillStyle(0x0f172a, 0.92).fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    this.graphics.lineStyle(1, 0xfacc15, 0.45).strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    this.titleText.setVisible(true);
    this.hintText.setVisible(true);
    this.versionText.setVisible(true);
    this.buttonBg.setVisible(true);
    this.buttonText.setVisible(true);
  }

  private drawWorld() {
    const playerX = this.screenX(this.player.x);
    const playerY = this.screenY(this.player.y);
    if (this.stats.weapons.purr > 0) {
      const auraRadius = 42 + this.stats.weapons.purr * 17 + this.stats.aura * 5 + (this.stats.evolved.purr ? 32 : 0);
      this.graphics.fillStyle(this.stats.evolved.purr ? 0x111827 : 0x7dd3fc, this.stats.evolved.purr ? 0.26 : 0.1).fillCircle(playerX, playerY, auraRadius);
      this.graphics.lineStyle(this.stats.evolved.purr ? 3 : 2, this.stats.evolved.purr ? 0x312e81 : 0x7dd3fc, this.stats.evolved.purr ? 0.72 : 0.46).strokeCircle(playerX, playerY, auraRadius);
    }
    this.drawYarnOrbits();
    this.drawObstacles();
    for (const gem of this.gems) {
      this.graphics.fillStyle(this.gemColor(gem.value), 1).fillCircle(this.screenX(gem.x), this.screenY(gem.y), gem.radius);
    }
    for (const pickup of this.pickups) {
      this.drawPickup(pickup);
    }
    for (const chest of this.chests) {
      const x = this.screenX(chest.x);
      const y = this.screenY(chest.y);
      this.graphics.fillStyle(0x7c2d12, 1).fillRoundedRect(x - 14, y - 10, 28, 20, 3);
      this.graphics.fillStyle(0xfacc15, 1).fillRect(x - 3, y - 10, 6, 20);
      this.graphics.lineStyle(2, 0xfde68a, 0.95).strokeRoundedRect(x - 14, y - 10, 28, 20, 3);
    }
    for (const zone of this.zones) {
      const alpha = Phaser.Math.Clamp(zone.life / 2.4, 0.16, 0.48);
      this.graphics.fillStyle(zone.color, alpha).fillCircle(this.screenX(zone.x), this.screenY(zone.y), zone.radius);
      this.graphics.lineStyle(2, zone.color, alpha + 0.18).strokeCircle(this.screenX(zone.x), this.screenY(zone.y), zone.radius);
    }
    for (const projectile of this.projectiles) {
      this.graphics.fillStyle(projectile.color, 1).fillCircle(this.screenX(projectile.x), this.screenY(projectile.y), projectile.radius);
    }
    for (const enemy of this.enemies) {
      const x = this.screenX(enemy.x);
      const y = this.screenY(enemy.y);
      this.graphics.fillStyle(enemy.hurtFlash > 0 ? 0xffffff : enemy.color, 1).fillCircle(x, y, enemy.radius);
      this.graphics.fillStyle(0x000000, 0.38).fillRect(x - enemy.radius, y - enemy.radius - 8, enemy.radius * 2, 3);
      this.graphics.fillStyle(0xfb7185, 1).fillRect(x - enemy.radius, y - enemy.radius - 8, enemy.radius * 2 * Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1), 3);
      if (enemy.elite) this.graphics.lineStyle(2, 0xfacc15, 0.95).strokeCircle(x, y, enemy.radius + 5);
    }
    this.graphics.fillStyle(this.player.hurtCooldown > 0 ? 0xffffff : 0xf5d0a9, 1).fillCircle(playerX, playerY, this.player.radius);
    this.graphics.fillStyle(0x0f172a, 1).fillCircle(playerX - 6, playerY - 4, 2.2);
    this.graphics.fillCircle(playerX + 6, playerY - 4, 2.2);
    this.graphics.fillStyle(0xf5d0a9, 1);
    this.graphics.fillTriangle(playerX - 13, playerY - 12, playerX - 8, playerY - 28, playerX, playerY - 14);
    this.graphics.fillTriangle(playerX + 13, playerY - 12, playerX + 8, playerY - 28, playerX, playerY - 14);

    for (const item of this.texts) {
      const text = this.add.text(this.screenX(item.x), this.screenY(item.y), item.text, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: item.color,
        stroke: '#020617',
        strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(Math.max(0, item.life / 0.72));
      this.time.delayedCall(16, () => text.destroy());
    }
  }

  private drawHud() {
    const margin = this.uiMargin();
    const width = this.hudWidth();
    const barWidth = width - 32;
    const x = margin;
    const y = margin;
    this.hudText.setPosition(x + 6, y + 4);
    this.graphics.fillStyle(0x020617, 0.38).fillRoundedRect(x, y, width, 58, 6);
    this.graphics.fillStyle(0x3f1d2a, 0.86).fillRect(x + 12, y + 22, barWidth, 7);
    this.graphics.fillStyle(0xfb7185, 0.95).fillRect(x + 12, y + 22, barWidth * Phaser.Math.Clamp(this.stats.hp / this.stats.maxHp, 0, 1), 7);
    this.graphics.fillStyle(0x164e63, 0.86).fillRect(x + 12, y + 35, barWidth, 6);
    this.graphics.fillStyle(0x67e8f9, 0.95).fillRect(x + 12, y + 35, barWidth * Phaser.Math.Clamp(this.stats.exp / this.stats.nextExp, 0, 1), 6);
    this.hudText.setText([
      `Lv.${this.stats.level}  ${this.timeText(MATCH_TIME - this.elapsed)}  击败 ${this.kills}`,
      `生命 ${Math.ceil(this.stats.hp)}/${this.stats.maxHp}`,
    ].join('\n'));
    this.drawWeaponHud();
  }

  private drawWeaponHud() {
    const weapons: Array<['laser' | 'claw' | 'purr' | 'yarn' | 'droplet' | 'crescent', string]> = [
      ['laser', '光'],
      ['claw', '爪'],
      ['purr', '呼'],
      ['yarn', '线'],
      ['droplet', '露'],
      ['crescent', '月'],
    ];
    const margin = this.uiMargin();
    const width = Math.min(136, WIDTH - this.hudWidth() - margin * 3);
    const x = WIDTH - width - margin;
    const y = margin;
    if (width < 112) return;
    this.graphics.fillStyle(0x020617, 0.32).fillRoundedRect(x, y, width, 48, 6);
    weapons.forEach(([id, label], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const colWidth = (width - 20) / 3;
      const px = x + 10 + col * colWidth;
      const py = y + 10 + row * 19;
      const active = this.stats.weapons[id] > 0;
      this.graphics.fillStyle(active ? 0xfef3c7 : 0x94a3b8, active ? 0.95 : 0.42).fillCircle(px, py + 3, 6);
      this.addHudText(px + 10, py - 5, `${label}${this.weaponLabel(id)}`, active ? '#fef3c7' : '#94a3b8');
    });
  }

  private addHudText(x: number, y: number, text: string, color: string) {
    const item = this.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color,
      stroke: '#020617',
      strokeThickness: 2,
    });
    this.time.delayedCall(16, () => item.destroy());
  }

  private uiMargin() {
    return Math.max(10, Math.round(Math.min(WIDTH, HEIGHT) * 0.03));
  }

  private hudWidth() {
    return Math.min(184, Math.max(164, Math.round(WIDTH * 0.47)));
  }

  private drawObstacles() {
    for (const obstacle of this.obstacles) {
      const x = this.screenX(obstacle.x);
      const y = this.screenY(obstacle.y);
      if (x < -90 || x > WIDTH + 90 || y < -90 || y > HEIGHT + 90) continue;
      this.drawObstacle(obstacle, x, y);
    }
  }

  private drawObstacle(obstacle: Obstacle, x: number, y: number) {
    const flash = obstacle.hurtFlash > 0;
    this.graphics.fillStyle(0x000000, 0.18).fillEllipse(x + 3, y + obstacle.height * 0.32, obstacle.width * 0.96, obstacle.height * 0.34);

    if (obstacle.kind === 'furniture') {
      const color = flash ? 0xffffff : 0x6b4f3a;
      this.graphics.fillStyle(color, 1).fillRoundedRect(x - obstacle.width / 2, y - obstacle.height / 2, obstacle.width, obstacle.height, 6);
      this.graphics.fillStyle(flash ? 0xffffff : 0x8b6f54, 1).fillRoundedRect(x - obstacle.width / 2 + 8, y - obstacle.height / 2 + 7, obstacle.width - 16, obstacle.height - 14, 4);
      this.graphics.lineStyle(2, 0x3f2d20, 0.8).strokeRoundedRect(x - obstacle.width / 2, y - obstacle.height / 2, obstacle.width, obstacle.height, 6);
      this.graphics.fillStyle(0xfacc15, 0.9).fillCircle(x + obstacle.width * 0.28, y, 3);
      return;
    }

    if (obstacle.kind === 'box') {
      const color = flash ? 0xffffff : 0xb7793b;
      this.graphics.fillStyle(color, 1).fillRoundedRect(x - obstacle.width / 2, y - obstacle.height / 2, obstacle.width, obstacle.height, 5);
      this.graphics.lineStyle(2, 0x7c4a23, 0.86).strokeRoundedRect(x - obstacle.width / 2, y - obstacle.height / 2, obstacle.width, obstacle.height, 5);
      this.graphics.lineStyle(2, 0x8a572c, 0.6).lineBetween(x - obstacle.width / 2 + 8, y, x + obstacle.width / 2 - 8, y);
      this.graphics.lineBetween(x, y - obstacle.height / 2 + 6, x, y + obstacle.height / 2 - 6);
    } else {
      const color = flash ? 0xffffff : 0xc084fc;
      this.graphics.fillStyle(color, 1).fillRoundedRect(x - obstacle.width / 2, y - obstacle.height / 2, obstacle.width, obstacle.height, 12);
      this.graphics.lineStyle(2, 0x7e22ce, 0.72).strokeRoundedRect(x - obstacle.width / 2, y - obstacle.height / 2, obstacle.width, obstacle.height, 12);
      this.graphics.fillStyle(0xfef3c7, 0.85).fillCircle(x - 11, y - 5, 3);
      this.graphics.fillCircle(x + 10, y + 7, 2.5);
    }

    if (obstacle.destructible && obstacle.hp < obstacle.maxHp) {
      const ratio = Phaser.Math.Clamp(obstacle.hp / obstacle.maxHp, 0, 1);
      this.graphics.fillStyle(0x020617, 0.55).fillRect(x - 22, y - obstacle.height / 2 - 8, 44, 4);
      this.graphics.fillStyle(0xfbbf24, 1).fillRect(x - 22, y - obstacle.height / 2 - 8, 44 * ratio, 4);
    }
  }

  private drawPickup(pickup: Pickup) {
    const x = this.screenX(pickup.x);
    const y = this.screenY(pickup.y);
    if (pickup.kind === 'heal') {
      this.graphics.fillStyle(0xbbf7d0, 1).fillCircle(x, y, pickup.radius);
      this.graphics.fillStyle(0x166534, 1).fillRect(x - 2, y - 7, 4, 14).fillRect(x - 7, y - 2, 14, 4);
      return;
    }
    if (pickup.kind === 'freeze') {
      this.graphics.fillStyle(0xbfdbfe, 1).fillCircle(x, y, pickup.radius);
      this.graphics.lineStyle(2, 0x2563eb, 0.9).strokeCircle(x, y, pickup.radius - 3);
      return;
    }
    if (pickup.kind === 'magnet') {
      this.graphics.fillStyle(0x67e8f9, 1).fillCircle(x, y, pickup.radius);
      this.graphics.lineStyle(3, 0x0e7490, 0.95).beginPath().arc(x, y, 6, Math.PI * 0.18, Math.PI * 1.82).strokePath();
      return;
    }
    this.graphics.fillStyle(0xfde68a, 1).fillEllipse(x, y, pickup.radius * 1.3, pickup.radius);
    this.graphics.fillStyle(0x92400e, 1).fillCircle(x - 4, y, 1.6);
  }

  private drawWorldEdgeShadow() {
    const fade = 120;
    const steps = 10;
    const maxAlpha = 0.62;
    const left = this.screenX(0);
    const right = this.screenX(WORLD_WIDTH);
    const top = this.screenY(0);
    const bottom = this.screenY(WORLD_HEIGHT);

    if (left > 0) {
      this.graphics.fillStyle(0x020617, maxAlpha).fillRect(0, 0, left, HEIGHT);
      for (let i = 0; i < steps; i++) {
        const alpha = maxAlpha * (1 - i / steps) * 0.55;
        this.graphics.fillStyle(0x020617, alpha).fillRect(left + (fade / steps) * i, 0, fade / steps + 1, HEIGHT);
      }
    } else if (left > -fade) {
      const visible = left + fade;
      for (let i = 0; i < steps; i++) {
        const x = Math.max(0, left + (visible / steps) * i);
        const alpha = maxAlpha * (1 - i / steps) * 0.38;
        this.graphics.fillStyle(0x020617, alpha).fillRect(x, 0, visible / steps + 1, HEIGHT);
      }
    }

    if (right < WIDTH) {
      this.graphics.fillStyle(0x020617, maxAlpha).fillRect(right, 0, WIDTH - right, HEIGHT);
      for (let i = 0; i < steps; i++) {
        const alpha = maxAlpha * (1 - i / steps) * 0.55;
        this.graphics.fillStyle(0x020617, alpha).fillRect(right - (fade / steps) * (i + 1), 0, fade / steps + 1, HEIGHT);
      }
    } else if (right < WIDTH + fade) {
      const visible = WIDTH + fade - right;
      for (let i = 0; i < steps; i++) {
        const x = Math.min(WIDTH, right - (visible / steps) * (i + 1));
        const alpha = maxAlpha * (1 - i / steps) * 0.38;
        this.graphics.fillStyle(0x020617, alpha).fillRect(x, 0, visible / steps + 1, HEIGHT);
      }
    }

    if (top > 0) {
      this.graphics.fillStyle(0x020617, maxAlpha).fillRect(0, 0, WIDTH, top);
      for (let i = 0; i < steps; i++) {
        const alpha = maxAlpha * (1 - i / steps) * 0.55;
        this.graphics.fillStyle(0x020617, alpha).fillRect(0, top + (fade / steps) * i, WIDTH, fade / steps + 1);
      }
    } else if (top > -fade) {
      const visible = top + fade;
      for (let i = 0; i < steps; i++) {
        const y = Math.max(0, top + (visible / steps) * i);
        const alpha = maxAlpha * (1 - i / steps) * 0.38;
        this.graphics.fillStyle(0x020617, alpha).fillRect(0, y, WIDTH, visible / steps + 1);
      }
    }

    if (bottom < HEIGHT) {
      this.graphics.fillStyle(0x020617, maxAlpha).fillRect(0, bottom, WIDTH, HEIGHT - bottom);
      for (let i = 0; i < steps; i++) {
        const alpha = maxAlpha * (1 - i / steps) * 0.55;
        this.graphics.fillStyle(0x020617, alpha).fillRect(0, bottom - (fade / steps) * (i + 1), WIDTH, fade / steps + 1);
      }
    } else if (bottom < HEIGHT + fade) {
      const visible = HEIGHT + fade - bottom;
      for (let i = 0; i < steps; i++) {
        const y = Math.min(HEIGHT, bottom - (visible / steps) * (i + 1));
        const alpha = maxAlpha * (1 - i / steps) * 0.38;
        this.graphics.fillStyle(0x020617, alpha).fillRect(0, y, WIDTH, visible / steps + 1);
      }
    }
  }

  private gemColor(value: number) {
    if (value >= 10) return 0xf87171;
    if (value >= 5) return 0xc084fc;
    if (value >= 2) return 0x22c55e;
    return 0x67e8f9;
  }

  private drawJoystick() {
    if (!this.joystick.active) return;
    this.graphics.fillStyle(0xffffff, 0.12).fillCircle(this.joystick.cx, this.joystick.cy, INPUT_TUNING.joystickRadius);
    this.graphics.lineStyle(2, 0xffffff, 0.35).strokeCircle(this.joystick.cx, this.joystick.cy, INPUT_TUNING.joystickRadius);
    this.graphics.fillStyle(0xfacc15, 0.9).fillCircle(this.joystick.kx, this.joystick.ky, 20);
  }

  private drawYarnOrbits() {
    const level = this.stats.weapons.yarn;
    if (level <= 0) return;
    const evolved = this.stats.evolved.yarn;
    const count = Math.min(evolved ? 7 : 5, 1 + Math.floor((level + 1) / 2) + (evolved ? 2 : 0));
    const orbit = 62 + level * 9 + (evolved ? 24 : 0);
    const playerX = this.screenX(this.player.x);
    const playerY = this.screenY(this.player.y);
    this.graphics.lineStyle(1, 0xfde68a, 0.24).strokeCircle(playerX, playerY, orbit);
    for (let i = 0; i < count; i++) {
      const angle = this.yarnAngle + (Math.PI * 2 * i) / count;
      this.graphics.fillStyle(evolved ? 0xfef08a : 0xfacc15, 1).fillCircle(playerX + Math.cos(angle) * orbit, playerY + Math.sin(angle) * orbit, evolved ? 14 : 12);
    }
  }

  private weaponLabel(id: 'laser' | 'claw' | 'purr' | 'yarn' | 'droplet' | 'crescent') {
    return `${this.stats.weapons[id]}${this.stats.evolved[id] ? '★' : ''}`;
  }

  private cameraX() {
    return this.player.x - WIDTH / 2;
  }

  private cameraY() {
    return this.player.y - HEIGHT / 2;
  }

  private screenX(x: number) {
    return x - this.cameraX();
  }

  private screenY(y: number) {
    return y - this.cameraY();
  }

  private timeText(value: number) {
    const safe = Math.max(0, Math.ceil(value));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
  }
}

export class SurvivorGame {
  readonly game: Phaser.Game;

  constructor(parent: string) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: '#111827',
      render: { antialias: true, antialiasGL: true, roundPixels: false },
      scale: { mode: Phaser.Scale.RESIZE },
      scene: [SurvivorScene],
    });
  }
}
