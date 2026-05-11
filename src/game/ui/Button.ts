import Phaser from 'phaser';

export type ButtonVariant = 'primary' | 'secondary' | 'reward' | 'danger';

const BUTTON_COLOR: Record<ButtonVariant, number> = {
  primary: 0x1d4ed8,
  secondary: 0x047857,
  reward: 0x7c3aed,
  danger: 0xb91c1c,
};

const BUTTON_STROKE: Record<ButtonVariant, number> = {
  primary: 0x93c5fd,
  secondary: 0x86efac,
  reward: 0xc4b5fd,
  danger: 0xfca5a5,
};

export class Button {
  bg: Phaser.GameObjects.Rectangle;
  txt: Phaser.GameObjects.Text;
  enabled = true;
  private readonly variant: ButtonVariant;
  private readonly width: number;
  private readonly height: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, cb: () => void, variant: ButtonVariant = 'primary') {
    this.variant = variant;
    this.width = w;
    this.height = Math.max(44, h);
    this.bg = scene.add.rectangle(x, y, w, this.height, BUTTON_COLOR[variant], 0.94).setStrokeStyle(2, BUTTON_STROKE[variant], 0.9).setInteractive();
    this.txt = scene.add.text(x, y, label, this.textStyle(label)).setOrigin(0.5);
    this.bg.on('pointerdown', () => this.enabled && cb());
  }

  setLabel(text: string) {
    this.txt.setText(text);
    this.txt.setStyle(this.textStyle(text));
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    this.bg.setFillStyle(value ? BUTTON_COLOR[this.variant] : 0x4b5563, value ? 0.94 : 0.65);
    this.bg.setStrokeStyle(2, value ? BUTTON_STROKE[this.variant] : 0x6b7280, value ? 0.9 : 0.55);
    this.bg.setAlpha(value ? 1 : 0.65);
    this.txt.setAlpha(value ? 1 : 0.65);
  }

  destroy() {
    this.bg.destroy();
    this.txt.destroy();
  }

  private fontSize(label: string, height: number) {
    if (label.includes('\n')) return height <= 52 ? '13px' : '14px';
    if (height <= 44) return label.length > 4 ? '14px' : '16px';
    if (label.length > 8) return '15px';
    return label.length > 5 ? '17px' : '20px';
  }

  private textStyle(label: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontSize: this.fontSize(label, this.height),
      color: '#fff',
      align: 'center',
      lineSpacing: label.includes('\n') ? 2 : 0,
      wordWrap: { width: Math.max(28, this.width - 20), useAdvancedWrap: true },
      fixedWidth: this.width - 16,
    };
  }
}
