import Phaser from 'phaser';

export type ButtonVariant = 'primary' | 'secondary' | 'reward' | 'danger';

const BUTTON_TEXTURE: Record<ButtonVariant, string> = {
  primary: 'button_primary_blue',
  secondary: 'button_secondary_green',
  reward: 'button_reward_purple',
  danger: 'button_danger_red',
};

export class Button {
  bg: Phaser.GameObjects.Image;
  txt: Phaser.GameObjects.Text;
  enabled = true;
  private readonly variant: ButtonVariant;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, cb: () => void, variant: ButtonVariant = 'primary') {
    this.variant = variant;
    this.bg = scene.add.image(x, y, BUTTON_TEXTURE[variant]).setDisplaySize(w, Math.max(44, h)).setInteractive();
    this.txt = scene.add.text(x, y, label, { fontSize: this.fontSize(label, h), color: '#fff', align: 'center', lineSpacing: 3, wordWrap: { width: w - 18 } }).setOrigin(0.5);
    this.bg.on('pointerdown', () => this.enabled && cb());
  }

  setLabel(text: string) {
    this.txt.setText(text);
    this.txt.setFontSize(this.fontSize(text, this.bg.displayHeight));
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    this.bg.setTexture(BUTTON_TEXTURE[this.variant]);
    this.bg.setTint(value ? 0xffffff : 0x6b7280);
    this.bg.setAlpha(value ? 1 : 0.65);
    this.txt.setAlpha(value ? 1 : 0.65);
  }

  destroy() {
    this.bg.destroy();
    this.txt.destroy();
  }

  private fontSize(label: string, height: number) {
    if (label.includes('\n')) return '14px';
    if (height <= 44) return '16px';
    return label.length > 5 ? '18px' : '20px';
  }
}
