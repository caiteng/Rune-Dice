import Phaser from 'phaser';
import { Layout } from '../ui/Layout';
import { Button } from '../ui/Button';
import { DiceView } from '../ui/DiceView';
import { StatusPanel } from '../ui/StatusPanel';
import { BattleLogView } from '../ui/BattleLogView';
import { createEnemy, createState } from '../core/GameState';
import { Random } from '../core/Random';
import { rollAll, toggleLock, resetDiceTurn } from '../core/DiceRoller';
import { resolveRunes } from '../core/CombatResolver';
import { advanceEnemyIntent, enemyAct } from '../core/EnemyAI';
import { ENEMY_ORDER } from '../data/enemies';
import { applyReward, generateRewards } from '../core/RewardGenerator';
import { RUNE_NAME } from '../data/runes';
import { RELICS } from '../data/relics';
import { SaveManager, applySaveData } from '../save/SaveManager';

const SAVE_SLOT = 'default';
type BattleStartMode = 'new' | 'continue';

export class BattleScene extends Phaser.Scene {
  state = createState(Date.now());
  rng = new Random(this.state.seed);
  layout = new Layout();
  diceViews: DiceView[] = [];
  status!: StatusPanel;
  log!: BattleLogView;
  enemyText!: Phaser.GameObjects.Text;
  hintText!: Phaser.GameObjects.Text;
  rerollBtn!: Button;
  settleBtn!: Button;
  rewardBtns: Button[] = [];
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
    this.isAnimating = false;
    this.startMode = data.mode ?? 'continue';
  }

  create() {
    this.add.rectangle(195, 422, 390, 844, 0x0b1020);
    const rects = this.layout.rects();
    this.enemyText = this.add.text(rects.enemy.x, rects.enemy.y, '', { fontSize: '22px', color: '#fff', lineSpacing: 5 });
    this.hintText = this.add.text(195, 336, '', { fontSize: '16px', color: '#fde68a', align: 'center', wordWrap: { width: 340 } }).setOrigin(0.5);
    this.status = new StatusPanel(this, rects.status.x, rects.status.y);
    this.log = new BattleLogView(this, rects.status.x, rects.status.y + 88);

    this.state.dice.forEach((die, index) => {
      const x = 55 + (index % 5) * 68;
      const y = 260;
      const view = new DiceView(this, die, x, y, () => this.onDieClick(index));
      this.diceViews.push(view);
    });

    this.rerollBtn = new Button(this, 110, 560, 150, 54, '重掷', () => void this.onLeftAction());
    this.settleBtn = new Button(this, 280, 560, 150, 54, '结算', () => void this.onRightAction());
    this.renderAll();
    void this.bootstrap();
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
  }

  pushLog(text: string, shouldSave = true) {
    this.state.log.push(text);
    console.log(text);
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
      const rune = this.state.pendingDieUpgrade.rune;
      die.faces[0] = rune;
      die.value = rune;
      this.pushLog(`已将第 ${index + 1} 个骰子的一个面改造成${RUNE_NAME[rune]}。`);
      this.state.pendingDieUpgrade = null;
      this.startNextBattle();
      return;
    }
    if (this.state.phase !== 'battle') return;
    const before = die.locked;
    toggleLock(die);
    if (die.locked !== before) {
      this.diceViews[index].playLockPulse();
      this.pushLog(die.locked ? `锁定了${RUNE_NAME[die.value]}骰。` : `解锁了${RUNE_NAME[die.value]}骰。`);
    }
    this.renderAll();
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
    resolveRunes(this.state.dice.map((die) => die.value), this.state.player, this.state.enemy, (text) => this.pushLog(text, false));
    if (this.state.enemy.hp <= 0) {
      this.onEnemyDead();
      await this.saveGame();
      return;
    }
    enemyAct(this.state.enemy, this.state.player, this.state.dice, this.rng, (text) => this.pushLog(text, false));
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
    this.state.pendingRewards.forEach((reward, index) => {
      const button = new Button(this, 195, 246 + index * 84, 330, 68, `${reward.name}\n${reward.desc}`, () => {
        if (reward.kind === 'dieface') {
          this.state.phase = 'upgrade';
          this.state.pendingDieUpgrade = { rune: reward.data?.rune ?? 'fire' };
          this.clearRewardButtons();
          this.pushLog(`选择一个目标骰子，将一个面改造成${RUNE_NAME[this.state.pendingDieUpgrade.rune]}。`);
          this.renderAll();
          return;
        }
        applyReward(this.state, reward);
        this.pushLog(`选择奖励：${reward.name}。`);
        this.startNextBattle();
      });
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
    this.pushLog(`下一场战斗：${this.state.enemy.name}。`, false);
    void this.startPlayerTurn(true).then(() => this.saveGame());
  }

  private async startPlayerTurn(opening = false) {
    resetDiceTurn(this.state.dice);
    this.state.player.rerollsLeft = this.state.player.rerollMax;
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
    rollAll(this.state.dice, this.rng);
    const finalRunes = this.state.dice.map((die) => die.value);
    await Promise.all(this.diceViews.map((view, index) => view.playRoll(finalRunes[index], index * 40)));
    this.isAnimating = false;
    this.renderAll();
  }

  private clearRewardButtons() {
    this.rewardBtns.forEach((button) => button.destroy());
    this.rewardBtns = [];
  }

  private rollableDiceCount() {
    return this.state.dice.filter((die) => !die.locked && !die.blocked && !die.forced).length;
  }

  renderAll() {
    const enemy = this.state.enemy;
    if (this.state.phase === 'victory') {
      this.enemyText.setText('胜利！');
    } else if (this.state.phase === 'defeat') {
      this.enemyText.setText('失败！');
    } else {
      this.enemyText.setText(`${enemy?.name}\n生命 ${enemy?.hp}/${enemy?.maxHp}  护甲 ${enemy?.armor}\n意图：${enemy?.intent}`);
    }

    this.hintText.setText(this.state.phase === 'upgrade' ? '选择一个骰子作为改造目标' : '');
    const relics = this.state.player.relics.map((id) => RELICS.find((relic) => relic.id === id)?.name ?? id).join('、') || '无';
    this.status.set(`生命 ${this.state.player.hp}/${this.state.player.maxHp}  护甲 ${this.state.player.armor}  金币 ${this.state.player.gold}\n重掷 ${this.state.player.rerollsLeft}/${this.state.player.rerollMax}\n遗物：${relics}`);
    this.log.set(this.state.log);
    this.diceViews.forEach((view) => view.render());
    const isFinished = this.state.phase === 'victory' || this.state.phase === 'defeat';
    this.rerollBtn.setLabel(isFinished ? '回首页' : '重掷');
    this.settleBtn.setLabel(isFinished ? '再来一局' : '结算');
    this.rerollBtn.setEnabled(isFinished || (this.state.phase === 'battle' && this.state.player.rerollsLeft > 0 && this.rollableDiceCount() > 0 && !this.isAnimating));
    this.settleBtn.setEnabled(isFinished || (this.state.phase === 'battle' && !this.isAnimating));
  }
}
