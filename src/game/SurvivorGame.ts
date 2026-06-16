import Phaser from 'phaser';
import { createUpgradeOptions, getUpgradeableWeapons, upgradeWeapon, WEAPON_NAMES } from './survivor/upgrades';
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
  type Projectile,
  type Stats,
  type Upgrade,
} from './survivor/types';
import { createEnemySpawnStats, spawnCountForMinute, spawnIntervalForMinute } from './survivor/waves';
import { INPUT_TUNING, PICKUP_TUNING, PLAYER_TUNING } from './survivor/tuning';

const WIDTH = GAME_WIDTH;
const HEIGHT = GAME_HEIGHT;
const MATCH_TIME = MATCH_TIME_SECONDS;
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

class SurvivorScene extends Phaser.Scene {
  private mode: GameMode = 'start';
  private elapsed = 0;
  private kills = 0;
  private enemyId = 1;
  private spawnTimer = 0;
  private eliteTimer = 55;
  private laserTimer = 0;
  private clawTimer = 0;
  private yarnAngle = 0;
  private player = { x: WIDTH / 2, y: HEIGHT / 2, radius: 17, hurtCooldown: 0 };
  private lastMove = new Phaser.Math.Vector2(0, -1);
  private stats: Stats = createBaseStats();
  private enemies: Enemy[] = [];
  private gems: Gem[] = [];
  private chests: Chest[] = [];
  private projectiles: Projectile[] = [];
  private texts: FloatingText[] = [];
  private upgrades: Upgrade[] = [];
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
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

  create() {
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.graphics = this.add.graphics();
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

  private startGame() {
    this.mode = 'playing';
    this.elapsed = 0;
    this.kills = 0;
    this.enemyId = 1;
    this.spawnTimer = 0;
    this.eliteTimer = 55;
    this.laserTimer = 0.25;
    this.clawTimer = 0.8;
    this.yarnAngle = 0;
    this.player = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, radius: 17, hurtCooldown: 0 };
    this.lastMove.set(0, -1);
    this.stats = createBaseStats();
    this.enemies = [];
    this.gems = [];
    this.chests = [];
    this.projectiles = [];
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
    this.updatePlayer(delta);
    this.updateWeapons(delta);
    this.updateProjectiles(delta);
    this.updateEnemies(delta);
    this.updateGems(delta);
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
      this.player.x += input.x * this.stats.speed * delta;
      this.player.y += input.y * this.stats.speed * delta;
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
    this.yarnAngle += delta * (2.7 + yarnLevel * 0.18);
    this.laserTimer -= delta;
    this.clawTimer -= delta;
    if (laserLevel > 0 && this.laserTimer <= 0) {
      this.fireAtNearest((22 + laserLevel * 7) * this.stats.damage, 440, 0x7dd3fc, laserLevel >= 4 ? 2 : 1);
      this.laserTimer = Math.max(0.14, (0.74 - laserLevel * 0.06) * attackScale);
    }
    if (clawLevel > 0 && this.clawTimer <= 0) {
      const count = Math.min(5, 1 + Math.floor((clawLevel - 1) / 2) + Math.max(0, this.stats.projectiles - 1));
      const baseAngle = this.lastMove.angle();
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (i - (count - 1) / 2) * 0.32;
        this.projectiles.push({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * 330,
          vy: Math.sin(angle) * 330,
          radius: 7,
          damage: (13 + clawLevel * 5) * this.stats.damage,
          life: 1,
          color: 0xffa366,
          pierce: clawLevel >= 4 ? 2 : 1,
          hit: new Set(),
        });
      }
      this.clawTimer = Math.max(0.24, (1.1 - clawLevel * 0.05) * attackScale);
    }
    const auraRadius = 42 + purrLevel * 17 + this.stats.aura * 5;
    const auraDamage = (6 + purrLevel * 4 + this.stats.aura) * this.stats.damage * delta;
    for (const enemy of this.enemies) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) < auraRadius + enemy.radius) {
        this.hurtEnemy(enemy, auraDamage, '#bae6fd');
      }
    }
    if (yarnLevel > 0) {
      const count = Math.min(5, 1 + Math.floor((yarnLevel + 1) / 2));
      const orbit = 62 + yarnLevel * 9;
      const damage = (10 + yarnLevel * 4) * this.stats.damage;
      for (let i = 0; i < count; i++) {
        const angle = this.yarnAngle + (Math.PI * 2 * i) / count;
        const x = this.player.x + Math.cos(angle) * orbit;
        const y = this.player.y + Math.sin(angle) * orbit;
        for (const enemy of this.enemies) {
          if (enemy.yarnCooldown > this.elapsed) continue;
          if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= 14 + enemy.radius) {
            this.hurtEnemy(enemy, damage, '#fde68a');
            enemy.yarnCooldown = this.elapsed + 0.28;
          }
        }
      }
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
      radius: 5,
      damage,
      life: 1.2,
      color,
      pierce,
      hit: new Set(),
    });
  }

  private updateProjectiles(delta: number) {
    for (const projectile of this.projectiles) {
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
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0);
  }

  private updateEnemies(delta: number) {
    for (const enemy of this.enemies) {
      enemy.hurtFlash = Math.max(0, enemy.hurtFlash - delta);
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      enemy.x += Math.cos(angle) * enemy.speed * delta;
      enemy.y += Math.sin(angle) * enemy.speed * delta;
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
      this.gems.push({ x: enemy.x, y: enemy.y, value: enemy.elite ? 8 : 1, radius: enemy.elite ? 8 : 5 });
      if (enemy.elite) {
        this.chests.push({ x: enemy.x, y: enemy.y, radius: 15 });
        this.addText(enemy.x, enemy.y - 20, '宝箱掉落', '#fde68a');
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
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

  private openChest(chest: Chest) {
    const rolls = this.chestRollCount();
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
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 25);
      this.addText(chest.x, chest.y - 24, '恢复生命', '#bbf7d0');
      return;
    }
    this.addText(chest.x, chest.y - 18, applied >= 5 ? '五连宝箱！' : applied >= 3 ? '三连宝箱！' : '宝箱强化', '#fde68a');
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
      this.stats.nextExp = Math.floor(8 + this.stats.level * 5.5);
      this.startUpgrade();
    }
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
    const bg = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 344, 408, 0x111827, 0.98).setStrokeStyle(2, 0xfacc15, 0.9);
    const title = this.add.text(WIDTH / 2, 254, '选择强化', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      color: '#fef3c7',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.upgradePanel.push(bg, title);
    this.upgrades.forEach((upgrade, index) => {
      const y = 330 + index * 92;
      const card = this.add.rectangle(WIDTH / 2, y, 292, 72, 0x1f2a44, 1).setStrokeStyle(1, 0x93c5fd, 0.55).setInteractive();
      const name = this.add.text(68, y - 22, upgrade.title, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      const desc = this.add.text(68, y + 5, upgrade.desc, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#cbd5e1',
        wordWrap: { width: 252 },
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
    const panel = this.add.rectangle(WIDTH / 2, 392, 332, 356, 0x0f172a, 0.97)
      .setStrokeStyle(2, won ? 0xfacc15 : 0xfb7185, 0.9)
      .setDepth(20);
    const eyebrow = this.add.text(WIDTH / 2, 250, won ? '守夜完成' : '仍需再试', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: won ? '#fde68a' : '#fecaca',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
    this.titleText
      .setText(won ? '天亮了' : '守夜失败')
      .setPosition(WIDTH / 2, 296)
      .setDepth(21)
      .setVisible(true);
    this.hintText
      .setText(won ? '猫猫守住了夜晚房间。' : '猫猫被梦魇包围了。')
      .setPosition(WIDTH / 2, 336)
      .setDepth(21)
      .setVisible(true);

    const rows = [
      ['存活时间', this.timeText(this.elapsed)],
      ['清理怪物', `${this.kills}`],
      ['最终等级', `Lv.${this.stats.level}`],
      ['剩余生命', `${Math.max(0, Math.ceil(this.stats.hp))}/${this.stats.maxHp}`],
      ['伤害倍率', `x${this.stats.damage.toFixed(2)}`],
    ];

    rows.forEach(([label, value], index) => {
      const y = 386 + index * 38;
      const rowBg = this.add.rectangle(WIDTH / 2, y, 268, 30, 0x1f2937, 0.72).setDepth(21);
      const labelText = this.add.text(78, y, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#cbd5e1',
      }).setOrigin(0, 0.5).setDepth(22);
      const valueText = this.add.text(312, y, value, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5).setDepth(22);
      this.resultPanel.push(rowBg, labelText, valueText);
    });

    this.buttonBg.setPosition(WIDTH / 2, 594).setDepth(22);
    this.buttonText.setPosition(WIDTH / 2, 594).setDepth(23);
    this.resultPanel.push(panel, eyebrow);
  }

  private clearResultPanel() {
    for (const item of this.resultPanel) item.destroy();
    this.resultPanel = [];
    this.titleText?.setPosition(WIDTH / 2, 260).setDepth(0);
    this.hintText?.setPosition(WIDTH / 2, 330).setDepth(0);
    this.buttonBg?.setPosition(WIDTH / 2, 520).setDepth(0);
    this.buttonText?.setPosition(WIDTH / 2, 520).setDepth(0);
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
    this.drawHud();
    if (this.mode === 'playing') this.drawJoystick();
    if (this.mode === 'gameover') {
      this.graphics.fillStyle(0x030712, 0.54).fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  private drawBackground() {
    this.graphics.fillStyle(0x111827, 1).fillRect(0, 0, WIDTH, HEIGHT);
    this.graphics.lineStyle(1, 0xffffff, 0.035);
    const offsetX = -((this.cameraX() % 44) + 44) % 44;
    const offsetY = -((this.cameraY() % 44) + 44) % 44;
    for (let x = offsetX; x < WIDTH + 44; x += 44) {
      this.graphics.lineBetween(x, 0, x, HEIGHT);
    }
    for (let y = offsetY; y < HEIGHT + 44; y += 44) {
      this.graphics.lineBetween(0, y, WIDTH, y);
    }
  }

  private drawStartScene() {
    this.graphics.fillStyle(0x0f172a, 0.92).fillRoundedRect(26, 212, 338, 410, 8);
    this.graphics.lineStyle(1, 0xfacc15, 0.45).strokeRoundedRect(26, 212, 338, 410, 8);
    this.titleText.setVisible(true);
    this.hintText.setVisible(true);
    this.versionText.setVisible(true);
    this.buttonBg.setVisible(true);
    this.buttonText.setVisible(true);
  }

  private drawWorld() {
    const auraRadius = 42 + this.stats.weapons.purr * 17 + this.stats.aura * 5;
    const playerX = this.screenX(this.player.x);
    const playerY = this.screenY(this.player.y);
    this.graphics.fillStyle(0x7dd3fc, 0.1).fillCircle(playerX, playerY, auraRadius);
    this.graphics.lineStyle(2, 0x7dd3fc, 0.46).strokeCircle(playerX, playerY, auraRadius);
    this.drawYarnOrbits();
    for (const gem of this.gems) {
      this.graphics.fillStyle(gem.value > 1 ? 0xc084fc : 0x67e8f9, 1).fillCircle(this.screenX(gem.x), this.screenY(gem.y), gem.radius);
    }
    for (const chest of this.chests) {
      const x = this.screenX(chest.x);
      const y = this.screenY(chest.y);
      this.graphics.fillStyle(0x7c2d12, 1).fillRoundedRect(x - 14, y - 10, 28, 20, 3);
      this.graphics.fillStyle(0xfacc15, 1).fillRect(x - 3, y - 10, 6, 20);
      this.graphics.lineStyle(2, 0xfde68a, 0.95).strokeRoundedRect(x - 14, y - 10, 28, 20, 3);
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
    this.graphics.fillStyle(0x020617, 0.68).fillRoundedRect(12, 12, WIDTH - 24, 108, 6);
    this.graphics.fillStyle(0x3f1d2a, 1).fillRect(24, 30, 150, 9);
    this.graphics.fillStyle(0xfb7185, 1).fillRect(24, 30, 150 * Phaser.Math.Clamp(this.stats.hp / this.stats.maxHp, 0, 1), 9);
    this.graphics.fillStyle(0x164e63, 1).fillRect(24, 48, 150, 8);
    this.graphics.fillStyle(0x67e8f9, 1).fillRect(24, 48, 150 * Phaser.Math.Clamp(this.stats.exp / this.stats.nextExp, 0, 1), 8);
    this.hudText.setText([
      `Lv.${this.stats.level}   击败 ${this.kills}`,
      `生命 ${Math.ceil(this.stats.hp)}/${this.stats.maxHp}`,
      `时间 ${this.timeText(MATCH_TIME - this.elapsed)}`,
      `武器 光${this.stats.weapons.laser} 爪${this.stats.weapons.claw} 呼${this.stats.weapons.purr} 线${this.stats.weapons.yarn}`,
      `伤害 x${this.stats.damage.toFixed(2)}  攻速 x${this.stats.attackSpeed.toFixed(2)}`,
    ].join('\n'));
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
    const count = Math.min(5, 1 + Math.floor((level + 1) / 2));
    const orbit = 62 + level * 9;
    const playerX = this.screenX(this.player.x);
    const playerY = this.screenY(this.player.y);
    this.graphics.lineStyle(1, 0xfde68a, 0.24).strokeCircle(playerX, playerY, orbit);
    for (let i = 0; i < count; i++) {
      const angle = this.yarnAngle + (Math.PI * 2 * i) / count;
      this.graphics.fillStyle(0xfacc15, 1).fillCircle(playerX + Math.cos(angle) * orbit, playerY + Math.sin(angle) * orbit, 12);
    }
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
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [SurvivorScene],
    });
  }
}
