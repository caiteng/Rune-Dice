import Phaser from 'phaser';

const WIDTH = 390;
const HEIGHT = 844;
const MATCH_TIME = 360;

type Mode = 'start' | 'playing' | 'upgrade' | 'gameover';

type Enemy = {
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
};

type Gem = {
  x: number;
  y: number;
  value: number;
  radius: number;
};

type Projectile = {
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

type FloatingText = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
};

type Upgrade = {
  title: string;
  desc: string;
  apply: () => void;
};

type Stats = {
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
};

class SurvivorScene extends Phaser.Scene {
  private mode: Mode = 'start';
  private elapsed = 0;
  private kills = 0;
  private enemyId = 1;
  private spawnTimer = 0;
  private eliteTimer = 55;
  private laserTimer = 0;
  private clawTimer = 0;
  private player = { x: WIDTH / 2, y: HEIGHT / 2, radius: 17, hurtCooldown: 0 };
  private stats: Stats = this.createStats();
  private enemies: Enemy[] = [];
  private gems: Gem[] = [];
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
  private hudText!: Phaser.GameObjects.Text;
  private buttonText!: Phaser.GameObjects.Text;
  private buttonBg!: Phaser.GameObjects.Rectangle;
  private upgradePanel: Phaser.GameObjects.GameObject[] = [];

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
    this.player = { x: WIDTH / 2, y: HEIGHT / 2, radius: 17, hurtCooldown: 0 };
    this.stats = this.createStats();
    this.enemies = [];
    this.gems = [];
    this.projectiles = [];
    this.texts = [];
    this.upgrades = [];
    this.joystick.active = false;
    this.clearUpgradePanel();
    this.titleText.setVisible(false);
    this.hintText.setVisible(false);
    this.buttonBg.setVisible(false);
    this.buttonText.setVisible(false);
  }

  private createStats(): Stats {
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
    };
  }

  private updatePlaying(delta: number) {
    this.elapsed += delta;
    this.player.hurtCooldown = Math.max(0, this.player.hurtCooldown - delta);
    this.updatePlayer(delta);
    this.updateWeapons(delta);
    this.updateProjectiles(delta);
    this.updateEnemies(delta);
    this.updateGems(delta);
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
      this.player.x += input.x * this.stats.speed * delta;
      this.player.y += input.y * this.stats.speed * delta;
    }
    this.player.x = Phaser.Math.Clamp(this.player.x, 24, WIDTH - 24);
    this.player.y = Phaser.Math.Clamp(this.player.y, 116, HEIGHT - 24);
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
    this.laserTimer -= delta;
    this.clawTimer -= delta;
    if (this.laserTimer <= 0) {
      this.fireAtNearest(30 * this.stats.damage, 440, 0x7dd3fc, 1);
      this.laserTimer = Math.max(0.16, 0.62 * attackScale);
    }
    if (this.clawTimer <= 0) {
      const count = this.stats.projectiles;
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.32;
        this.projectiles.push({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * 330,
          vy: Math.sin(angle) * 330,
          radius: 7,
          damage: 20 * this.stats.damage,
          life: 1,
          color: 0xffa366,
          pierce: 1,
          hit: new Set(),
        });
      }
      this.clawTimer = Math.max(0.26, 1.05 * attackScale);
    }
    const auraRadius = 46 + this.stats.aura * 15;
    const auraDamage = (8 + this.stats.aura * 3) * this.stats.damage * delta;
    for (const enemy of this.enemies) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) < auraRadius + enemy.radius) {
        this.hurtEnemy(enemy, auraDamage, '#bae6fd');
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
      if (enemy.elite) this.addText(enemy.x, enemy.y - 20, '精英倒下', '#fde68a');
    }
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
  }

  private updateGems(delta: number) {
    const pickupRadius = 44 * this.stats.pickup;
    for (const gem of this.gems) {
      const distance = Phaser.Math.Distance.Between(gem.x, gem.y, this.player.x, this.player.y);
      if (distance < pickupRadius) {
        const angle = Phaser.Math.Angle.Between(gem.x, gem.y, this.player.x, this.player.y);
        gem.x += Math.cos(angle) * 420 * delta;
        gem.y += Math.sin(angle) * 420 * delta;
      }
      if (distance <= gem.radius + this.player.radius + 4) {
        this.gainExp(gem.value);
        gem.value = 0;
      }
    }
    this.gems = this.gems.filter((gem) => gem.value > 0);
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
      const count = 1 + Math.floor(minute * 0.9);
      for (let i = 0; i < count; i++) this.spawnEnemy(false);
      this.spawnTimer = Phaser.Math.Clamp(0.82 - minute * 0.1, 0.2, 0.82);
    }
    if (this.eliteTimer <= 0) {
      this.spawnEnemy(true);
      this.eliteTimer = 60;
    }
  }

  private spawnEnemy(elite: boolean) {
    const side = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;
    if (side === 0) {
      x = Phaser.Math.Between(-30, WIDTH + 30);
      y = -30;
    } else if (side === 1) {
      x = WIDTH + 30;
      y = Phaser.Math.Between(90, HEIGHT + 30);
    } else if (side === 2) {
      x = Phaser.Math.Between(-30, WIDTH + 30);
      y = HEIGHT + 30;
    } else {
      x = -30;
      y = Phaser.Math.Between(90, HEIGHT + 30);
    }

    const minute = this.elapsed / 60;
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
    });
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
    this.upgrades = this.createUpgrades();
    this.showUpgradePanel();
  }

  private createUpgrades(): Upgrade[] {
    const pool: Upgrade[] = [
      {
        title: '猫爪更锋利',
        desc: '所有武器伤害 +18%。',
        apply: () => {
          this.stats.damage *= 1.18;
        },
      },
      {
        title: '追光更快',
        desc: '自动攻击频率 +16%。',
        apply: () => {
          this.stats.attackSpeed *= 1.16;
        },
      },
      {
        title: '多重爪印',
        desc: '猫爪飞镖数量 +1。',
        apply: () => {
          this.stats.projectiles = Math.min(5, this.stats.projectiles + 1);
        },
      },
      {
        title: '呼噜圈扩大',
        desc: '身边持续伤害范围和强度提升。',
        apply: () => {
          this.stats.aura++;
        },
      },
      {
        title: '灵巧脚步',
        desc: '移动速度 +12%。',
        apply: () => {
          this.stats.speed *= 1.12;
        },
      },
      {
        title: '小鱼干磁力',
        desc: '经验拾取范围 +25%。',
        apply: () => {
          this.stats.pickup *= 1.25;
        },
      },
      {
        title: '软垫护身',
        desc: '最大生命 +20，并恢复 20 点。',
        apply: () => {
          this.stats.maxHp += 20;
          this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + 20);
        },
      },
    ];
    Phaser.Utils.Array.Shuffle(pool);
    return pool.slice(0, 3);
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
    upgrade.apply();
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
    this.titleText.setText(won ? '天亮了' : '守夜失败').setVisible(true);
    this.hintText.setText(`坚持 ${this.timeText(this.elapsed)}，清理 ${this.kills} 个怪物，达到 Lv.${this.stats.level}。`).setVisible(true);
    this.buttonText.setText('再来一局');
    this.buttonBg.setVisible(true);
    this.buttonText.setVisible(true);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.mode !== 'playing') return;
    if (pointer.y < HEIGHT * 0.48) return;
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
    const radius = 48;
    const scale = Math.min(radius, distance) / distance;
    const ox = dx * scale;
    const oy = dy * scale;
    this.joystick.kx = this.joystick.cx + ox;
    this.joystick.ky = this.joystick.cy + oy;
    this.joystick.vx = Math.abs(ox) > 4 ? ox / radius : 0;
    this.joystick.vy = Math.abs(oy) > 4 ? oy / radius : 0;
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
    const offset = (this.elapsed * 12) % 44;
    for (let x = -44 + offset; x < WIDTH + 44; x += 44) {
      this.graphics.lineBetween(x, 0, x, HEIGHT);
    }
    for (let y = -44 + offset; y < HEIGHT + 44; y += 44) {
      this.graphics.lineBetween(0, y, WIDTH, y);
    }
  }

  private drawStartScene() {
    this.graphics.fillStyle(0x0f172a, 0.92).fillRoundedRect(26, 212, 338, 410, 8);
    this.graphics.lineStyle(1, 0xfacc15, 0.45).strokeRoundedRect(26, 212, 338, 410, 8);
    this.titleText.setVisible(true);
    this.hintText.setVisible(true);
    this.buttonBg.setVisible(true);
    this.buttonText.setVisible(true);
  }

  private drawWorld() {
    const auraRadius = 46 + this.stats.aura * 15;
    this.graphics.fillStyle(0x7dd3fc, 0.1).fillCircle(this.player.x, this.player.y, auraRadius);
    this.graphics.lineStyle(2, 0x7dd3fc, 0.46).strokeCircle(this.player.x, this.player.y, auraRadius);
    for (const gem of this.gems) {
      this.graphics.fillStyle(gem.value > 1 ? 0xc084fc : 0x67e8f9, 1).fillCircle(gem.x, gem.y, gem.radius);
    }
    for (const projectile of this.projectiles) {
      this.graphics.fillStyle(projectile.color, 1).fillCircle(projectile.x, projectile.y, projectile.radius);
    }
    for (const enemy of this.enemies) {
      this.graphics.fillStyle(enemy.hurtFlash > 0 ? 0xffffff : enemy.color, 1).fillCircle(enemy.x, enemy.y, enemy.radius);
      this.graphics.fillStyle(0x000000, 0.38).fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2, 3);
      this.graphics.fillStyle(0xfb7185, 1).fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2 * Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1), 3);
      if (enemy.elite) this.graphics.lineStyle(2, 0xfacc15, 0.95).strokeCircle(enemy.x, enemy.y, enemy.radius + 5);
    }
    this.graphics.fillStyle(this.player.hurtCooldown > 0 ? 0xffffff : 0xf5d0a9, 1).fillCircle(this.player.x, this.player.y, this.player.radius);
    this.graphics.fillStyle(0x0f172a, 1).fillCircle(this.player.x - 6, this.player.y - 4, 2.2);
    this.graphics.fillCircle(this.player.x + 6, this.player.y - 4, 2.2);
    this.graphics.fillStyle(0xf5d0a9, 1);
    this.graphics.fillTriangle(this.player.x - 13, this.player.y - 12, this.player.x - 8, this.player.y - 28, this.player.x, this.player.y - 14);
    this.graphics.fillTriangle(this.player.x + 13, this.player.y - 12, this.player.x + 8, this.player.y - 28, this.player.x, this.player.y - 14);

    for (const item of this.texts) {
      const text = this.add.text(item.x, item.y, item.text, {
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
    this.graphics.fillStyle(0x020617, 0.68).fillRoundedRect(12, 12, WIDTH - 24, 90, 6);
    this.graphics.fillStyle(0x3f1d2a, 1).fillRect(24, 30, 150, 9);
    this.graphics.fillStyle(0xfb7185, 1).fillRect(24, 30, 150 * Phaser.Math.Clamp(this.stats.hp / this.stats.maxHp, 0, 1), 9);
    this.graphics.fillStyle(0x164e63, 1).fillRect(24, 48, 150, 8);
    this.graphics.fillStyle(0x67e8f9, 1).fillRect(24, 48, 150 * Phaser.Math.Clamp(this.stats.exp / this.stats.nextExp, 0, 1), 8);
    this.hudText.setText([
      `Lv.${this.stats.level}   击败 ${this.kills}`,
      `生命 ${Math.ceil(this.stats.hp)}/${this.stats.maxHp}`,
      `时间 ${this.timeText(MATCH_TIME - this.elapsed)}`,
      `伤害 x${this.stats.damage.toFixed(2)}  攻速 x${this.stats.attackSpeed.toFixed(2)}`,
    ].join('\n'));
  }

  private drawJoystick() {
    if (!this.joystick.active) return;
    this.graphics.fillStyle(0xffffff, 0.12).fillCircle(this.joystick.cx, this.joystick.cy, 48);
    this.graphics.lineStyle(2, 0xffffff, 0.35).strokeCircle(this.joystick.cx, this.joystick.cy, 48);
    this.graphics.fillStyle(0xfacc15, 0.9).fillCircle(this.joystick.kx, this.joystick.ky, 20);
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
