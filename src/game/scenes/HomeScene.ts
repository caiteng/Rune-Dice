import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { SaveManager } from '../save/SaveManager';
import { addFitImage, addHeightImage } from '../ui/ImageFit';

const SAVE_SLOT = 'default';
const VOLUME_KEY = 'rune-dice-volume';

export class HomeScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private panelItems: Phaser.GameObjects.GameObject[] = [];
  private continueBtn!: Button;
  private messageText!: Phaser.GameObjects.Text;
  private volume = 1;

  constructor() {
    super('Home');
  }

  create() {
    this.volume = this.loadVolume();
    this.sound.volume = this.volume;

    this.add.rectangle(195, 422, 390, 844, 0x0b1020);
    this.add.rectangle(195, 118, 342, 178, 0x111827, 0.92).setStrokeStyle(1, 0x334155, 0.9);
    addHeightImage(this, 92, 52, 'tab_common', 28);
    addHeightImage(this, 195, 52, 'tab_gold', 30);
    addHeightImage(this, 298, 52, 'tab_dark', 28);
    addHeightImage(this, 195, 186, 'divider_gold', 22);
    this.add.text(195, 88, 'Rune Dice', { fontSize: '34px', color: '#fff', align: 'center' }).setOrigin(0.5);
    this.add.text(195, 128, '符文骰子', { fontSize: '20px', color: '#fde68a', align: 'center' }).setOrigin(0.5);
    this.add.text(195, 156, '回合制骰子冒险', { fontSize: '14px', color: '#cbd5e1', align: 'center' }).setOrigin(0.5);

    new Button(this, 195, 284, 270, 56, '开始游戏', () => void this.startNewGame(), 'primary');
    this.continueBtn = new Button(this, 195, 364, 270, 56, '继续游戏', () => this.scene.start('Battle', { mode: 'continue' }), 'secondary');
    this.continueBtn.setEnabled(false);
    new Button(this, 195, 444, 270, 56, '设置', () => this.showSettings(), 'secondary');
    new Button(this, 195, 524, 270, 56, '鸣谢', () => this.showCredits(), 'reward');
    this.add.rectangle(195, 724, 330, 76, 0x111827, 0.82).setStrokeStyle(1, 0x334155);
    new Button(this, 302, 724, 96, 44, '同步', () => this.showSync(), 'primary');
    addFitImage(this, 74, 724, 'marker_blue', 28, 40);
    addFitImage(this, 116, 724, 'mini_defense_icon', 28, 28);
    this.add.text(154, 724, '存档', { fontSize: '16px', color: '#cbd5e1', align: 'center' }).setOrigin(0.5);

    this.messageText = this.add.text(195, 632, '', {
      fontSize: '16px',
      color: '#fde68a',
      align: 'center',
      wordWrap: { width: 320 },
    }).setOrigin(0.5);

    void this.refreshContinueState();
  }

  private async startNewGame() {
    await this.saveManager.remove(SAVE_SLOT);
    this.scene.start('Battle', { mode: 'new' });
  }

  private async refreshContinueState() {
    this.continueBtn.setEnabled(await this.saveManager.hasLocal(SAVE_SLOT));
  }

  private showSettings() {
    this.openPanel('设置');
    this.panelItems.push(addHeightImage(this, 100, 274, 'marker_gold', 38));
    const label = this.add.text(195, 334, this.volumeLabel(), { fontSize: '22px', color: '#fff', align: 'center' }).setOrigin(0.5);
    const down = new Button(this, 120, 414, 96, 48, '音量 -', () => {
      this.setVolume(Math.max(0, this.volume - 0.1));
      label.setText(this.volumeLabel());
    }, 'secondary');
    const up = new Button(this, 270, 414, 96, 48, '音量 +', () => {
      this.setVolume(Math.min(1, this.volume + 0.1));
      label.setText(this.volumeLabel());
    }, 'secondary');
    this.panelItems.push(label, down.bg, down.txt, up.bg, up.txt);
  }

  private showCredits() {
    this.openPanel('鸣谢');
    const text = this.add.text(195, 350, '感谢游玩与测试。\n制作：Rune Dice Project', {
      fontSize: '18px',
      color: '#e5e7eb',
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 280 },
    }).setOrigin(0.5);
    const sheets = ['dice_sheet', 'enemies_sheet', 'effects_sheet', 'ui_sheet'].map((key, index) =>
      addFitImage(this, 82 + index * 74, 482, key, 58, 58),
    );
    this.panelItems.push(text, ...sheets);
  }

  private showSync() {
    this.openPanel('存档同步');
    const sync = new Button(this, 195, 342, 248, 52, '同步存档', () => void this.syncRemote(), 'primary');
    const upload = new Button(this, 195, 420, 248, 52, '上传存档', () => void this.uploadLocal(), 'reward');
    const note = this.add.text(195, 506, '远程数据后续用于成就和排行榜；这里保留手动存档同步入口。', {
      fontSize: '15px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 280 },
    }).setOrigin(0.5);
    this.panelItems.push(sync.bg, sync.txt, upload.bg, upload.txt, note);
  }

  private async syncRemote() {
    const ok = await this.saveManager.syncRemoteToLocal(SAVE_SLOT);
    this.setMessage(ok ? '已同步远程存档到本地。' : '没有可同步的远程存档，或远程服务不可用。');
    await this.refreshContinueState();
  }

  private async uploadLocal() {
    const ok = await this.saveManager.uploadLocal(SAVE_SLOT);
    this.setMessage(ok ? '已上传本地存档。' : '没有本地存档，或远程服务不可用。');
  }

  private openPanel(title: string) {
    this.closePanel();
    const bg = this.add.rectangle(195, 404, 338, 348, 0x111827, 0.96).setStrokeStyle(2, 0x475569, 0.85);
    const tab = addHeightImage(this, 195, 244, title === '设置' ? 'tab_common' : title === '鸣谢' ? 'tab_gold' : 'tab_danger', 48);
    const titleText = this.add.text(195, 244, title, { fontSize: '24px', color: '#fff', align: 'center' }).setOrigin(0.5);
    const close = new Button(this, 326, 244, 46, 40, '×', () => this.closePanel(), 'danger');
    this.panelItems.push(bg, tab, titleText, close.bg, close.txt);
  }

  private closePanel() {
    this.panelItems.forEach((item) => item.destroy());
    this.panelItems = [];
  }

  private setVolume(value: number) {
    this.volume = Number(value.toFixed(1));
    this.sound.volume = this.volume;
    localStorage.setItem(VOLUME_KEY, String(this.volume));
  }

  private loadVolume() {
    const saved = Number.parseFloat(localStorage.getItem(VOLUME_KEY) ?? '1');
    return Number.isFinite(saved) ? Phaser.Math.Clamp(saved, 0, 1) : 1;
  }

  private volumeLabel() {
    return `音量 ${Math.round(this.volume * 100)}%`;
  }

  private setMessage(text: string) {
    this.messageText.setText(text);
    this.time.delayedCall(3000, () => {
      if (this.messageText.text === text) this.messageText.setText('');
    });
  }
}
