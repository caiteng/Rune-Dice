import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { SaveManager } from '../save/SaveManager';

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
    this.add.rectangle(195, 112, 330, 150, 0x111827).setStrokeStyle(2, 0x334155);
    this.add.text(195, 76, '符文骰子', { fontSize: '42px', color: '#fff', align: 'center' }).setOrigin(0.5);
    this.add.text(195, 126, 'Rune Dice', { fontSize: '18px', color: '#93c5fd', align: 'center' }).setOrigin(0.5);
    this.add.text(195, 160, '竖屏符文骰子 Roguelike', { fontSize: '16px', color: '#cbd5e1', align: 'center' }).setOrigin(0.5);

    new Button(this, 195, 280, 250, 58, '开始游戏', () => void this.startNewGame());
    this.continueBtn = new Button(this, 195, 356, 250, 58, '继续游戏', () => this.scene.start('Battle', { mode: 'continue' }));
    this.continueBtn.setEnabled(false);
    new Button(this, 195, 432, 250, 58, '设置', () => this.showSettings());
    new Button(this, 195, 508, 250, 58, '鸣谢', () => this.showCredits());
    new Button(this, 316, 716, 92, 44, '同步', () => this.showSync());

    this.messageText = this.add.text(195, 650, '', {
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
    const label = this.add.text(195, 314, this.volumeLabel(), { fontSize: '22px', color: '#fff', align: 'center' }).setOrigin(0.5);
    const down = new Button(this, 120, 382, 92, 48, '音量 -', () => {
      this.setVolume(Math.max(0, this.volume - 0.1));
      label.setText(this.volumeLabel());
    });
    const up = new Button(this, 270, 382, 92, 48, '音量 +', () => {
      this.setVolume(Math.min(1, this.volume + 0.1));
      label.setText(this.volumeLabel());
    });
    this.panelItems.push(label, down.bg, down.txt, up.bg, up.txt);
  }

  private showCredits() {
    this.openPanel('鸣谢');
    const text = this.add.text(195, 338, '感谢游玩与测试。\n制作：Rune Dice Project', {
      fontSize: '18px',
      color: '#e5e7eb',
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 280 },
    }).setOrigin(0.5);
    this.panelItems.push(text);
  }

  private showSync() {
    this.openPanel('存档同步');
    const sync = new Button(this, 195, 336, 240, 52, '同步存档', () => void this.syncRemote());
    const upload = new Button(this, 195, 404, 240, 52, '上传存档', () => void this.uploadLocal());
    const note = this.add.text(195, 476, '远程数据后续用于成就和排行榜；这里保留手动存档同步入口。', {
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
    const bg = this.add.rectangle(195, 386, 330, 320, 0x111827).setStrokeStyle(2, 0x64748b);
    const titleText = this.add.text(195, 252, title, { fontSize: '24px', color: '#fff', align: 'center' }).setOrigin(0.5);
    const close = new Button(this, 326, 252, 46, 40, '×', () => this.closePanel());
    this.panelItems.push(bg, titleText, close.bg, close.txt);
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
