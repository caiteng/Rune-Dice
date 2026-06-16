import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { DiceView } from '../ui/DiceView';
import { StatusPanel } from '../ui/StatusPanel';
import { BattleLogView } from '../ui/BattleLogView';
import { addHeightImage, fitImage } from '../ui/ImageFit';
import { createEnemy, createState, emptySlots } from '../core/GameState';
import { Random } from '../core/Random';
import { rollAll, resetDiceTurn, toggleLock } from '../core/DiceRoller';
import { advanceEnemyIntent, enemyAct } from '../core/EnemyAI';
import { ENEMY_ORDER } from '../data/enemies';
import { applyReward, generateRewards } from '../core/RewardGenerator';
import { RUNE_EMOJI, RUNE_NAME } from '../data/runes';
import { RELICS } from '../data/relics';
import { SaveManager, applySaveData } from '../save/SaveManager';
import { ENEMY_PORTRAIT_ASSET, ENEMY_SPRITE_ASSET, RUNE_EFFECT_ASSET, RUNE_FACE_ASSET } from '../assets/RuneDiceAssets';
import { assignedSlot, isFullyAssigned, previewAssignment, resolveAssignment, slotCapacity } from '../core/SlotResolver';
import type { Reward, RuneType, SlotPreview, SlotType } from '../core/types';

const SAVE_SLOT = 'default';
type BattleStartMode = 'new' | 'continue';

type SlotCell = {
  slot: SlotType;
  index: number;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

const SLOT_LABEL: Record<SlotType, string> = {
  attack: '攻击槽',
  defense: '防御槽',
  tactic: '战术槽',
  discard: '弃骰区',
};

const SLOT_COLOR: Record<SlotType, number> = {
  attack: 0x7f1d1d,
  defense: 0x1d4ed8,
  tactic: 0x6d28d9,
  discard: 0x4c1d95,
};

export class BattleScene extends Phaser.Scene {
  state = createState(Date.now());
  rng = new Random(this.state.seed);
  diceViews: DiceView[] = [];
  status!: StatusPanel;
  log!: BattleLogView;
  enemyText!: Phaser.GameObjects.Text;
  hintText!: Phaser.GameObjects.Text;
  previewText!: Phaser.GameObjects.Text;
  enemySprite!: Phaser.GameObjects.Image;
  enemyPortrait!: Phaser.GameObjects.Image;
  enemyHpFill!: Phaser.GameObjects.Image;
  enemyArmorFill!: Phaser.GameObjects.Image;
  rerollBtn!: Button;
  settleBtn!: Button;
  rewardBtns: Button[] = [];
  rewardDecor: Phaser.GameObjects.GameObject[] = [];
  upgradePanel: Phaser.GameObjects.GameObject[] = [];
  slotCells: SlotCell[] = [];
  isAnimating = false;
  private readonly saveManager = new SaveManager();
  private startMode: BattleStartMode = 'continue';

  constructor() {
    super('Battle');
  }

  init(data: { mode?: BattleStartMode } = {}) {
    this.state = createState(Date.now());
    this.rng = new Random(this.state.seed);
    this.diceViews = [];
    this.rewardBtns = [];
    this.rewardDecor = [];
    this.slotCells = [];
    this.upgradePanel = [];
    this.isAnimating = false;
    this.startMode = data.mode ?? 'continue';
  }

  create() {
    this.add.rectangle(195, 422, 390, 844, 0x0b1020);
    this.add.rectangle(195, 92, 368, 170, 0x111827, 0.94).setStrokeStyle(2, 0x475569, 0.9);
    this.add.rectangle(286, 92, 116, 132, 0x0b1020, 0.28).setStrokeStyle(1, 0x334155, 0.7);
    this.enemySprite = fitImage(this.add.image(286, 94, 'enemy_slime_sprite'), 96, 96);
    this.enemyPortrait = fitImage(this.add.image(52, 34, 'enemy_slime_portrait'), 42, 46);
    this.add.image(142, 40, 'bar_health_empty').setDisplaySize(164, 22);
    this.add.image(142, 68, 'bar_armor_empty').setDisplaySize(164, 22);
    this.enemyHpFill = this.add.image(68, 40, 'bar_health_full').setOrigin(0, 0.5).setDisplaySize(148, 16);
    this.enemyArmorFill = this.add.image(68, 68, 'bar_armor_full').setOrigin(0, 0.5).setDisplaySize(148, 16);
    this.enemyText = this.add.text(30, 90, '', {
      fontSize: '12px',
      color: '#fff',
      lineSpacing: 2,
      fixedWidth: 190,
      fixedHeight: 76,
      wordWrap: { width: 190, useAdvancedWrap: true },
    });

    this.add.rectangle(195, 178, 326, 2, 0x334155, 0.9);
    this.hintText = this.add.text(195, 197, '', {
      fontSize: '12px',
      color: '#fde68a',
      align: 'center',
      lineSpacing: 1,
      fixedWidth: 330,
      fixedHeight: 34,
      wordWrap: { width: 330, useAdvancedWrap: true },
    }).setOrigin(0.5);
    this.add.rectangle(195, 260, 358, 96, 0x111827, 0.52).setStrokeStyle(1, 0x334155);
    this.add.text(26, 218, '骰子', { fontSize: '13px', color: '#93c5fd' });
    this.state.dice.forEach((die, index) => {
      const x = 55 + (index % 5) * 68;
      const view = new DiceView(this, die, x, 260, () => this.onDieClick(index));
      this.diceViews.push(view);
    });

    this.add.rectangle(137, 426, 234, 210, 0x0f172a, 0.72).setStrokeStyle(1, 0x334155);
    this.add.text(28, 330, '分配槽', { fontSize: '13px', color: '#93c5fd' });
    this.createSlotUi();
    this.add.rectangle(315, 426, 112, 210, 0x111827, 0.92).setStrokeStyle(1, 0x475569);
    this.add.text(264, 330, '结算预览', { fontSize: '13px', color: '#93c5fd' });
    this.previewText = this.add.text(264, 352, '', {
      fontSize: '10px',
      color: '#dbeafe',
      lineSpacing: 2,
      fixedWidth: 100,
      fixedHeight: 160,
      wordWrap: { width: 100, useAdvancedWrap: true },
    });

    this.status = new StatusPanel(this, 20, 562);
    this.rerollBtn = new Button(this, 126, 742, 132, 52, '重掷', () => void this.onLeftAction(), 'secondary');
    this.settleBtn = new Button(this, 264, 742, 132, 52, '结算', () => void this.onRightAction(), 'primary');
    this.log = new BattleLogView(this);

    this.renderAll();
    void this.bootstrap();
  }

  private createSlotUi() {
    const slotRows: Array<{ slot: SlotType; y: number }> = [
      { slot: 'attack', y: 360 },
      { slot: 'defense', y: 404 },
      { slot: 'tactic', y: 448 },
      { slot: 'discard', y: 496 },
    ];
    slotRows.forEach(({ slot, y }) => {
      this.add.text(28, y - 14, SLOT_LABEL[slot], { fontSize: '13px', color: '#fff' });
      const cells = slot === 'discard' ? 5 : slotCapacity(slot);
      for (let index = 0; index < cells; index++) {
        const width = slot === 'discard' ? 24 : 42;
        const spacing = slot === 'discard' ? 27 : 46;
        const rect = this.add.rectangle(94 + index * spacing, y, width, 34, SLOT_COLOR[slot], 0.45).setStrokeStyle(2, 0xf8fafc, 0.5).setInteractive();
        const label = this.add.text(rect.x, rect.y, '', {
          fontSize: slot === 'discard' ? '10px' : '11px',
          color: '#fff',
          align: 'center',
          fixedWidth: width,
          wordWrap: { width },
        }).setOrigin(0.5);
        rect.on('pointerdown', () => this.onSlotClick(slot, index));
        this.slotCells.push({ slot, index, rect, label });
      }
    });
  }

  private async bootstrap() {
    const saved = this.startMode === 'continue' ? await this.saveManager.load(SAVE_SLOT) : null;
    if (saved) {
      this.state = applySaveData(saved);
      this.rng = new Random(this.state.seed);
      this.bindDiceViews();
      this.pushLog('已读取本地存档。', false);
      this.restorePhaseUI();
      this.renderAll();
      return;
    }
    if (this.state.enemy) this.pushLog(`机制：${this.state.enemy.mechanism}`, false);
    await this.rollDiceWithAnimation('开局');
    await this.saveGame();
  }

  private bindDiceViews() {
    this.diceViews.forEach((view, index) => {
      view.die = this.state.dice[index];
    });
  }

  private restorePhaseUI() {
    if (this.state.phase === 'reward') this.showRewards();
    if (this.state.phase === 'upgrade' && this.state.pendingDieUpgrade?.dieIndex !== undefined) this.showUpgradeFacePanel(this.state.pendingDieUpgrade.dieIndex);
  }

  pushLog(text: string, shouldSave = true) {
    this.state.log.push(text);
    if (shouldSave) void this.saveGame();
  }

  private async saveGame() {
    this.state.seed = this.rng.getSeed();
    await this.saveManager.save(SAVE_SLOT, this.state);
  }

  private onDieClick(index: number) {
    const die = this.state.dice[index];
    if (this.isAnimating) return;
    if (this.state.phase === 'upgrade' && this.state.pendingDieUpgrade) {
      this.state.pendingDieUpgrade.dieIndex = index;
      this.showUpgradeFacePanel(index);
      this.renderAll();
      return;
    }
    if (this.state.phase !== 'battle') return;

    const slot = assignedSlot(this.state.slots, index);
    if (slot) {
      this.removeDieFromSlots(index);
      this.state.selectedDieIndex = null;
      this.pushLog(`第 ${index + 1} 个骰子已移回骰子区。`);
      this.renderAll();
      return;
    }

    if (this.state.selectedDieIndex === index) {
      const before = die.locked;
      toggleLock(die);
      if (die.locked !== before) this.pushLog(die.locked ? `锁定了${RUNE_NAME[die.value]}骰。` : `解锁了${RUNE_NAME[die.value]}骰。`);
      this.state.selectedDieIndex = null;
    } else {
      this.state.selectedDieIndex = index;
    }
    this.renderAll();
  }

  private onSlotClick(slot: SlotType, cellIndex: number) {
    if (this.state.phase !== 'battle' || this.isAnimating) return;
    const existing = this.state.slots[slot][cellIndex];
    if (existing !== undefined) {
      this.removeDieFromSlots(existing);
      this.pushLog(`第 ${existing + 1} 个骰子已从${SLOT_LABEL[slot]}移回。`);
      this.renderAll();
      return;
    }
    const selected = this.state.selectedDieIndex;
    if (selected === null) {
      this.pushLog('先点击一个未分配的骰子，再点击槽位。');
      return;
    }
    if (this.state.slots[slot].length >= slotCapacity(slot)) {
      this.pushLog(`${SLOT_LABEL[slot]}已满。`);
      return;
    }
    this.removeDieFromSlots(selected);
    if (slot === 'discard') this.state.slots.discard.push(selected);
    else this.state.slots[slot].push(selected);
    this.state.selectedDieIndex = null;
    this.pushLog(`${RUNE_NAME[this.state.dice[selected].value]}骰放入${SLOT_LABEL[slot]}。`);
    this.flashSlot(slot);
    this.renderAll();
  }

  private removeDieFromSlots(index: number) {
    this.state.slots.attack = this.state.slots.attack.filter((value) => value !== index);
    this.state.slots.defense = this.state.slots.defense.filter((value) => value !== index);
    this.state.slots.tactic = this.state.slots.tactic.filter((value) => value !== index);
    this.state.slots.discard = (this.state.slots.discard ?? []).filter((value) => value !== index);
  }

  private async onLeftAction() {
    if (this.state.phase === 'victory' || this.state.phase === 'defeat') {
      this.scene.start('Home');
      return;
    }
    await this.onReroll();
  }

  private async onRightAction() {
    if (this.state.phase === 'victory' || this.state.phase === 'defeat') {
      await this.saveManager.remove(SAVE_SLOT);
      this.scene.start('Battle', { mode: 'new' });
      return;
    }
    await this.onSettle();
  }

  private async onReroll() {
    if (this.state.player.rerollsLeft <= 0 || this.state.phase !== 'battle' || this.isAnimating || this.rollableDiceCount() <= 0) return;
    this.state.player.rerollsLeft--;
    await this.rollDiceWithAnimation('重掷');
    await this.saveGame();
  }

  private async onSettle() {
    if (this.state.phase !== 'battle' || !this.state.enemy || this.isAnimating) return;
    if (!isFullyAssigned(this.state)) {
      this.pushLog('必须先把 5 个骰子全部分配到槽位。');
      return;
    }
    const runeValues = this.state.dice.map((die) => die.value);
    const enemyHpBefore = this.state.enemy.hp;
    const enemyArmorBefore = this.state.enemy.armor;
    const playerHpBefore = this.state.player.hp;
    const playerArmorBefore = this.state.player.armor;
    const preview = resolveAssignment(this.state, (text) => this.pushLog(text, false));
    await this.playSlotResolutionFeedback(preview);
    this.playRuneEffects(runeValues);
    this.playDeltaPopups(enemyHpBefore, enemyArmorBefore, playerHpBefore, playerArmorBefore);
    if (this.state.enemy.hp <= 0) {
      this.onEnemyDead();
      await this.saveGame();
      return;
    }
    const hpBeforeEnemyAct = this.state.player.hp;
    enemyAct(this.state.enemy, this.state.player, this.state.dice, this.rng, (text) => this.pushLog(text, false), { slots: this.state.slots, preview });
    this.playEnemyIntentEffect(hpBeforeEnemyAct);
    if (this.state.player.hp <= 0) {
      this.state.phase = 'defeat';
      this.pushLog('你被击败了。', false);
      this.renderAll();
      await this.saveGame();
      return;
    }
    advanceEnemyIntent(this.state.enemy);
    await this.startPlayerTurn();
    await this.saveGame();
  }

  private onEnemyDead() {
    this.pushLog(`${this.state.enemy?.name} 被击败。`, false);
    this.state.battleIndex++;
    if (this.state.battleIndex >= ENEMY_ORDER.length) {
      this.state.phase = 'victory';
      this.renderAll();
      return;
    }
    this.state.phase = 'reward';
    this.state.pendingRewards = generateRewards(this.state, this.rng);
    this.showRewards();
    this.renderAll();
  }

  private showRewards() {
    this.clearRewardButtons();
    this.rewardDecor.push(this.add.rectangle(195, 342, 356, 412, 0x111827, 0.96).setStrokeStyle(2, 0xfbbf24, 0.65));
    this.rewardDecor.push(addHeightImage(this, 195, 150, 'tab_gold', 48));
    this.rewardDecor.push(this.add.rectangle(195, 190, 240, 2, 0xfbbf24, 0.75));
    this.state.pendingRewards.forEach((reward, index) => {
      const y = 238 + index * 102;
      this.rewardDecor.push(fitImage(this.add.image(56, y, this.rewardCardFrame(reward)), 58, 76));
      this.rewardDecor.push(fitImage(this.add.image(56, y, this.rewardIcon(reward)), 30, 30));
      const button = new Button(this, 210, y - 16, 260, 46, reward.name, () => {
        if (reward.kind === 'dieface') {
          this.state.phase = 'upgrade';
          this.state.pendingDieUpgrade = { rune: reward.data?.rune ?? 'fire' };
          this.clearRewardButtons();
          this.pushLog(`选择一个目标骰子，再选择具体骰面改造成${RUNE_NAME[this.state.pendingDieUpgrade.rune]}。`);
          this.renderAll();
          return;
        }
        applyReward(this.state, reward);
        this.pushLog(`选择奖励：${reward.name}。`);
        this.startNextBattle();
      }, 'reward');
      this.rewardDecor.push(this.add.text(88, y + 12, reward.desc, {
        fontSize: '12px',
        color: '#e5e7eb',
        lineSpacing: 2,
        wordWrap: { width: 246, useAdvancedWrap: true },
      }));
      this.rewardBtns.push(button);
    });
  }

  private startNextBattle() {
    this.clearRewardButtons();
    this.state.enemy = createEnemy(this.state.battleIndex);
    this.state.phase = 'battle';
    this.state.pendingRewards = [];
    this.state.player.rerollsLeft = this.state.player.rerollMax;
    this.state.player.armor = 0;
    this.state.player.battleFlags.firstCurseDiscardUsed = false;
    this.pushLog(`下一场战斗：${this.state.enemy.name}。`, false);
    this.pushLog(`机制：${this.state.enemy.mechanism}`, false);
    void this.startPlayerTurn(true).then(() => this.saveGame());
  }

  private async startPlayerTurn(opening = false) {
    resetDiceTurn(this.state.dice);
    this.state.slots = emptySlots();
    this.state.selectedDieIndex = null;
    if (this.state.player.nextTurnArmor > 0) {
      this.state.player.armor += this.state.player.nextTurnArmor;
      this.pushLog(`战术延迟：获得 ${this.state.player.nextTurnArmor} 点护甲。`, false);
      this.state.player.nextTurnArmor = 0;
    }
    if (this.state.player.nextTurnAttackMultiplierBonus > 0) {
      this.pushLog(`蓄势：本回合攻击槽伤害 +${Math.round(this.state.player.nextTurnAttackMultiplierBonus * 100)}%。`, false);
    }
    const extraReroll = this.state.player.nextTurnExtraReroll;
    this.state.player.nextTurnExtraReroll = 0;
    this.state.player.rerollsLeft = this.state.player.rerollMax + extraReroll;
    if (extraReroll > 0) this.pushLog(`战术延迟：本回合额外获得 ${extraReroll} 次重掷。`, false);
    await this.rollDiceWithAnimation(opening ? '开局' : '新回合');
  }

  private async rollDiceWithAnimation(reason: '开局' | '重掷' | '新回合') {
    if (this.isAnimating) return;
    const count = this.rollableDiceCount();
    if (reason === '重掷') this.pushLog(`重掷 ${count} 个骰子。`, false);
    if (reason === '开局') this.pushLog('开局掷骰。', false);
    if (reason === '新回合') this.pushLog('新回合掷骰。', false);

    this.isAnimating = true;
    this.renderAll();
    const canRoll = (index: number) => this.canRollDie(index);
    rollAll(this.state.dice, this.rng, canRoll);
    const finalRunes = this.state.dice.map((die) => die.value);
    await Promise.all(this.diceViews.map((view, index) => view.playRoll(finalRunes[index], index * 40, canRoll(index))));
    this.isAnimating = false;
    this.renderAll();
  }

  private clearRewardButtons() {
    this.rewardBtns.forEach((button) => button.destroy());
    this.rewardBtns = [];
    this.rewardDecor.forEach((item) => item.destroy());
    this.rewardDecor = [];
  }

  private showUpgradeFacePanel(dieIndex: number) {
    this.clearUpgradePanel();
    const upgrade = this.state.pendingDieUpgrade;
    const die = this.state.dice[dieIndex];
    if (!upgrade || !die) return;
    this.upgradePanel.push(this.add.rectangle(195, 420, 344, 230, 0x111827, 0.98).setStrokeStyle(2, 0xfbbf24, 0.75).setDepth(30));
    this.upgradePanel.push(addHeightImage(this, 195, 326, 'tab_gold', 44).setDepth(31));
    this.upgradePanel.push(this.add.text(195, 326, '选择要替换的骰面', { fontSize: '20px', color: '#fff', align: 'center' }).setOrigin(0.5).setDepth(32));
    this.upgradePanel.push(this.add.text(195, 364, `目标：${RUNE_NAME[upgrade.rune]}    骰子：${dieIndex + 1}`, { fontSize: '15px', color: '#fde68a', align: 'center' }).setOrigin(0.5).setDepth(32));

    die.faces.forEach((face, faceIndex) => {
      const x = 72 + (faceIndex % 3) * 122;
      const y = 414 + Math.floor(faceIndex / 3) * 64;
      const rect = this.add.rectangle(x, y, 96, 48, 0x111827, 0.92).setStrokeStyle(2, 0xfbbf24, 0.75).setInteractive().setDepth(31);
      const icon = fitImage(this.add.image(x - 26, y, this.safeTexture(RUNE_FACE_ASSET[face], 'rune_fire_face')), 28, 28).setDepth(32);
      const label = this.add.text(x + 14, y, `${faceIndex + 1}. ${RUNE_NAME[face]}`, {
        fontSize: '13px',
        color: '#fff',
        align: 'center',
        fixedWidth: 54,
      }).setOrigin(0.5).setDepth(32);
      rect.on('pointerdown', () => this.applyFaceUpgrade(dieIndex, faceIndex));
      this.upgradePanel.push(rect, icon, label);
    });
  }

  private applyFaceUpgrade(dieIndex: number, faceIndex: number) {
    const upgrade = this.state.pendingDieUpgrade;
    const die = this.state.dice[dieIndex];
    if (!upgrade || !die) return;
    const before = die.faces[faceIndex];
    die.faces[faceIndex] = upgrade.rune;
    die.value = upgrade.rune;
    this.pushLog(`已将第 ${dieIndex + 1} 个骰子的第 ${faceIndex + 1} 个面从${RUNE_NAME[before]}改造成${RUNE_NAME[upgrade.rune]}。`);
    this.state.pendingDieUpgrade = null;
    this.clearUpgradePanel();
    this.startNextBattle();
  }

  private clearUpgradePanel() {
    this.upgradePanel.forEach((item) => item.destroy());
    this.upgradePanel = [];
  }

  private canRollDie(index: number) {
    const die = this.state.dice[index];
    return !die.locked && !die.blocked && !die.forced && assignedSlot(this.state.slots, index) === null;
  }

  private rollableDiceCount() {
    return this.state.dice.filter((_die, index) => this.canRollDie(index)).length;
  }

  private async playSlotResolutionFeedback(preview: SlotPreview) {
    await this.flashSlotStep('attack');
    if (preview.rawDamage > 0 || preview.enemyArmorBreak > 0) {
      this.shakeEnemy(preview.hpDamage > 0 ? 10 : 6);
      this.playSlash(274, 92);
      this.playEffect('effect_slash_impact', 274, 92, 0.3);
      this.playPopup('popup_red_frame', `${preview.hpDamage}`, 282, 64, 'large');
      this.cameras.main.shake(120, 0.0045);
      await this.delay(180);
    }
    await this.flashSlotStep('defense');
    if (preview.armor > 0 || preview.heal > 0) {
      this.playEffect(preview.heal > 0 ? 'effect_heal_burst' : 'effect_shield_flare', 104, 684, 0.26);
      this.playRing(104, 684, preview.heal > 0 ? 0x86efac : 0x93c5fd);
      await this.delay(160);
    }
    await this.flashSlotStep('tactic');
    if (preview.gold !== 0 || preview.darkEnergyGain > 0 || preview.nextTurnExtraReroll > 0) {
      this.playEffect(preview.gold !== 0 ? 'effect_coin_burst' : 'effect_rainbow_burst', 250, 684, 0.24);
      this.playRing(250, 684, preview.gold !== 0 ? 0xfbbf24 : 0xc084fc);
      await this.delay(160);
    }
    await this.flashSlotStep('discard');
    if (preview.discardRunes.length > 0) {
      this.playEffect('effect_dark_blast', 195, 456, 0.22);
      this.cameras.main.shake(100, 0.0025);
      await this.delay(140);
    }
  }

  private flashSlot(slot: SlotType) {
    const targets = this.slotCells.filter((cell) => cell.slot === slot).flatMap((cell) => [cell.rect, cell.label]);
    this.tweens.add({
      targets,
      alpha: 0.85,
      scale: 1.06,
      yoyo: true,
      repeat: 1,
      duration: 90,
      ease: 'Sine.easeOut',
    });
  }

  private async flashSlotStep(slot: SlotType) {
    this.flashSlot(slot);
    await this.delay(90);
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => this.time.delayedCall(ms, () => resolve()));
  }

  renderAll() {
    const enemy = this.state.enemy;
    if (this.state.phase === 'victory') {
      this.enemyText.setText('胜利！');
      fitImage(this.enemySprite.setTexture(this.safeTexture('enemy_fate_dealer_portrait', 'enemy_slime_portrait')), 110, 110);
    } else if (this.state.phase === 'defeat') {
      this.enemyText.setText('失败！');
    } else {
      this.enemyText.setText(this.enemySummary());
      if (enemy) {
        fitImage(this.enemySprite.setTexture(this.safeTexture(ENEMY_SPRITE_ASSET[enemy.id] ?? '', 'enemy_slime_sprite')), enemy.id === 'fatedealer' ? 106 : 96, enemy.id === 'fatedealer' ? 124 : 96);
        fitImage(this.enemyPortrait.setTexture(this.safeTexture(ENEMY_PORTRAIT_ASSET[enemy.id] ?? '', 'enemy_slime_portrait')), 48, 52);
        this.setBar(this.enemyHpFill, 148, enemy.hp / enemy.maxHp);
        this.setBar(this.enemyArmorFill, 148, enemy.armor / Math.max(12, enemy.maxHp));
      }
    }

    this.hintText.setText(this.hintMessage());
    const relics = this.state.player.relics.map((id) => RELICS.find((relic) => relic.id === id)?.name ?? id).join('、') || '无';
    this.status.setStats(this.state.player, relics);
    this.log.set(this.state.log);
    this.renderSlots();
    this.renderPreview();
    this.diceViews.forEach((view, index) => {
      view.setStateMarkers(this.state.selectedDieIndex === index, assignedSlot(this.state.slots, index) !== null);
      view.render();
    });
    const isFinished = this.state.phase === 'victory' || this.state.phase === 'defeat';
    this.rerollBtn.setLabel(isFinished ? '回首页' : `重掷 ${this.state.player.rerollsLeft}`);
    this.settleBtn.setLabel(isFinished ? '再来一局' : '结算');
    this.rerollBtn.setEnabled(isFinished || (this.state.phase === 'battle' && this.state.player.rerollsLeft > 0 && this.rollableDiceCount() > 0 && !this.isAnimating));
    this.settleBtn.setEnabled(isFinished || (this.state.phase === 'battle' && isFullyAssigned(this.state) && !this.isAnimating));
  }

  private renderSlots() {
    for (const cell of this.slotCells) {
      const dieIndex = this.state.slots[cell.slot][cell.index];
      const rune = dieIndex === undefined ? null : this.state.dice[dieIndex]?.value;
      cell.label.setText(rune ? `${dieIndex + 1}${RUNE_EMOJI[rune]}` : '+');
      cell.rect.setFillStyle(SLOT_COLOR[cell.slot], rune ? 0.78 : 0.38);
    }
  }

  private renderPreview() {
    if (this.state.phase !== 'battle') {
      this.previewText.setText('');
      return;
    }
    const preview = previewAssignment(this.state);
    this.previewText.setText(this.previewSummary(preview));
  }

  private enemySummary() {
    const enemy = this.state.enemy;
    if (!enemy) return '';
    return [
      enemy.name,
      `生命 ${enemy.hp}/${enemy.maxHp}  护甲 ${enemy.armor}`,
      `意图：${this.compact(enemy.intent, 10)}`,
      `机制：${this.compact(enemy.mechanism ?? '无', 12)}`,
    ].join('\n');
  }

  private previewSummary(preview: SlotPreview) {
    return [
      `伤害 ${preview.hpDamage}`,
      `破甲 ${preview.enemyArmorBreak}`,
      `护甲 +${preview.armor}`,
      `治疗 +${preview.heal}`,
      `金币 ${this.signed(preview.gold)}`,
      `暗能 +${preview.darkEnergyGain}`,
      `下回甲 +${preview.nextTurnArmor}`,
      `自伤 ${preview.selfDamage}`,
    ].join('\n');
  }

  private compact(text: string, maxLength: number) {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  }

  private signed(value: number) {
    return value >= 0 ? `+${value}` : String(value);
  }

  private hintMessage() {
    if (this.state.phase === 'upgrade') return '选择一个骰子作为改造目标';
    if (this.state.phase !== 'battle') return '';
    if (this.state.selectedDieIndex !== null) return `已选第 ${this.state.selectedDieIndex + 1} 个骰子：点槽位分配，再点骰子锁定。`;
    if (!isFullyAssigned(this.state)) return '将 5 个骰子分配到攻击、防御、战术或弃骰区；点槽位可移回。';
    return '骰子已全部分配，可以结算；也可点槽位移回后继续重掷。';
  }

  private playRuneEffects(runes: RuneType[]) {
    const counts = new Map<RuneType, number>();
    runes.forEach((rune) => counts.set(rune, (counts.get(rune) ?? 0) + 1));
    Array.from(counts.entries()).forEach(([rune, count], index) => {
      this.playEffect(RUNE_EFFECT_ASSET[rune], 260 + (index % 2) * 28, 132 + Math.floor(index / 2) * 18, 0.34 + count * 0.035);
      this.playRuneAccent(rune, count, index);
    });
    if (Array.from(counts.values()).some((count) => count >= 2)) {
      this.playEffect('effect_critical_starburst', 270, 102, 0.42);
      this.cameras.main.flash(90, 255, 246, 180, false);
      this.cameras.main.shake(140, 0.0035);
    }
  }

  private playDeltaPopups(enemyHpBefore: number, enemyArmorBefore: number, playerHpBefore: number, playerArmorBefore: number) {
    const enemy = this.state.enemy;
    if (!enemy) return;
    if (enemy.hp < enemyHpBefore) this.playPopup('popup_red_frame', `${enemyHpBefore - enemy.hp}`, 282, 64);
    if (enemy.armor > enemyArmorBefore) this.playPopup('popup_blue_frame', `+${enemy.armor - enemyArmorBefore}`, 282, 92);
    if (this.state.player.hp > playerHpBefore) this.playPopup('popup_green_frame', `+${this.state.player.hp - playerHpBefore}`, 98, 632);
    if (this.state.player.armor > playerArmorBefore) this.playEffect('effect_shield_flare', 90, 676, 0.26);
  }

  private playEnemyIntentEffect(hpBeforeEnemyAct: number) {
    const enemy = this.state.enemy;
    if (!enemy) return;
    if (this.state.player.hp < hpBeforeEnemyAct) this.playEffect('effect_slash_impact', 104, 708, 0.32);
    if (enemy.traits?.includes('stone_armor')) this.playEffect('effect_stone_impact', 270, 120, 0.28);
    if (enemy.traits?.includes('curse_mage')) this.playEffect('effect_curse_cloud', 195, 260, 0.32);
  }

  private playEffect(key: string, x: number, y: number, scale: number) {
    const image = this.add.image(x, y, this.safeTexture(key, 'effect_critical_starburst')).setScale(scale).setAlpha(0.92);
    fitImage(image, image.width * scale, image.height * scale);
    image.setDepth(20);
    this.tweens.add({
      targets: image,
      scale: scale * 1.28,
      alpha: 0,
      duration: 520,
      ease: 'Sine.easeOut',
      onComplete: () => image.destroy(),
    });
  }

  private playPopup(key: string, text: string, x: number, y: number, size: 'normal' | 'large' = 'normal') {
    const frameWidth = size === 'large' ? 92 : 76;
    const frameHeight = size === 'large' ? 50 : 42;
    const frame = this.add.image(x, y, this.safeTexture(key, 'popup_red_frame')).setDisplaySize(frameWidth, frameHeight).setDepth(21).setScale(0.82);
    const label = this.add.text(x, y - 1, text, {
      fontSize: size === 'large' ? '26px' : '20px',
      color: '#fff',
      fontStyle: 'bold',
      stroke: '#0f172a',
      strokeThickness: size === 'large' ? 4 : 3,
    }).setOrigin(0.5).setDepth(22).setScale(0.82);
    this.tweens.add({
      targets: [frame, label],
      scale: 1.08,
      duration: 110,
      ease: 'Back.easeOut',
      yoyo: true,
    });
    this.tweens.add({
      targets: [frame, label],
      y: y - 34,
      alpha: 0,
      duration: 720,
      ease: 'Sine.easeOut',
      onComplete: () => {
        frame.destroy();
        label.destroy();
      },
    });
  }

  private rewardCardFrame(reward: Reward) {
    if (reward.kind === 'dieface') return 'card_gold_frame';
    if (reward.kind === 'relic') return 'card_curse_frame';
    if (reward.kind === 'attack_training') return 'card_danger_frame';
    if (reward.kind === 'defense_training') return 'card_common_frame';
    return 'card_gold_frame';
  }

  private rewardIcon(reward: Reward) {
    if (reward.kind === 'reroll') return 'mini_reroll_icon';
    if (reward.kind === 'attack_training') return 'mini_attack_icon';
    if (reward.kind === 'defense_training') return 'mini_defense_icon';
    if (reward.kind === 'tactic_training' || reward.kind === 'dieface') return 'mini_gold_icon';
    return 'mini_relic_icon';
  }

  private setBar(image: Phaser.GameObjects.Image, fullWidth: number, ratio: number) {
    image.setDisplaySize(Math.max(8, fullWidth * Phaser.Math.Clamp(ratio, 0, 1)), 18);
  }

  private shakeEnemy(distance: number) {
    this.enemySprite.setTint(0xffe4e6);
    this.tweens.add({
      targets: this.enemySprite,
      x: this.enemySprite.x + distance,
      duration: 42,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.enemySprite.clearTint();
        this.enemySprite.setX(276);
      },
    });
  }

  private playSlash(x: number, y: number) {
    const slash = this.add.graphics().setDepth(23);
    slash.lineStyle(5, 0xffffff, 0.85);
    slash.beginPath();
    slash.moveTo(x - 44, y - 24);
    slash.lineTo(x + 36, y + 22);
    slash.strokePath();
    slash.lineStyle(2, 0xfca5a5, 0.9);
    slash.beginPath();
    slash.moveTo(x - 38, y - 18);
    slash.lineTo(x + 42, y + 28);
    slash.strokePath();
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.35,
      scaleY: 1.15,
      duration: 180,
      ease: 'Sine.easeOut',
      onComplete: () => slash.destroy(),
    });
  }

  private playRing(x: number, y: number, color: number) {
    const ring = this.add.circle(x, y, 8).setStrokeStyle(3, color, 0.85).setDepth(23);
    this.tweens.add({
      targets: ring,
      radius: 34,
      alpha: 0,
      duration: 340,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private playRuneAccent(rune: RuneType, count: number, index: number) {
    const delay = index * 35;
    if (rune === 'thunder') {
      this.time.delayedCall(delay, () => {
        this.cameras.main.flash(55, 147, 197, 253, false);
        this.cameras.main.shake(80, 0.0025 + count * 0.0005);
      });
      return;
    }
    if (rune === 'fire') {
      this.time.delayedCall(delay, () => this.cameras.main.flash(55, 248, 113, 113, false));
      return;
    }
    if (rune === 'stone') {
      this.time.delayedCall(delay, () => this.cameras.main.shake(90, 0.002 + count * 0.0004));
      return;
    }
    if (rune === 'water') {
      this.time.delayedCall(delay, () => this.playRing(104, 684, 0x67e8f9));
      return;
    }
    if (rune === 'gold') {
      this.time.delayedCall(delay, () => this.playRing(250, 684, 0xfacc15));
      return;
    }
    if (rune === 'dark' || rune === 'curse') {
      this.time.delayedCall(delay, () => this.cameras.main.shake(95, 0.0018 + count * 0.00035));
    }
  }

  private safeTexture(key: string, fallback: string) {
    if (key && this.textures.exists(key)) return key;
    return this.textures.exists(fallback) ? fallback : '__DEFAULT';
  }
}
