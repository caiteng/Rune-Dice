import Phaser from 'phaser';

export class Button {
  bg: Phaser.GameObjects.Rectangle;
  txt: Phaser.GameObjects.Text;
  enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, cb: () => void) {
    this.bg = scene.add.rectangle(x, y, w, Math.max(44, h), 0x2f6fed).setStrokeStyle(2, 0xffffff).setInteractive();
    this.txt = scene.add.text(x, y, label, { fontSize: '20px', color: '#fff', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5);
    this.bg.on('pointerdown', () => this.enabled && cb());
  }

  setLabel(text: string) {
    this.txt.setText(text);
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    this.bg.setFillStyle(value ? 0x2f6fed : 0x555555);
    this.bg.setAlpha(value ? 1 : 0.7);
  }

  destroy() {
    this.bg.destroy();
    this.txt.destroy();
  }
}
