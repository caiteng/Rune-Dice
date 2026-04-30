import Phaser from 'phaser';
import type { Die, RuneType } from '../core/types';
import { RUNE_EMOJI, RUNE_NAME } from '../data/runes';

export class DiceView {
  rect: Phaser.GameObjects.Rectangle;
  txt: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
  private rolling = false;

  constructor(private readonly scene: Phaser.Scene, public die: Die, x: number, y: number, cb: () => void) {
    this.rect = scene.add.rectangle(x, y, 62, 62, 0x1f2937).setStrokeStyle(2, 0x9ca3af).setInteractive();
    this.txt = scene.add.text(x, y - 2, '', { fontSize: '28px', color: '#fff' }).setOrigin(0.5);
    this.tag = scene.add.text(x, y + 28, '', { fontSize: '12px', color: '#fff' }).setOrigin(0.5);
    this.rect.on('pointerdown', cb);
  }

  render() {
    this.txt.setText(RUNE_EMOJI[this.die.value]);
    this.tag.setText(this.label());
    const fill = this.fillColor();
    const stroke = this.die.forced ? 0xc084fc : this.die.blocked ? 0xf97316 : this.die.locked ? 0x22c55e : 0x9ca3af;
    this.rect.setFillStyle(fill);
    this.rect.setStrokeStyle(this.die.locked || this.die.blocked || this.die.forced ? 4 : 2, stroke);
  }

  setRolling(isRolling: boolean) {
    this.rolling = isRolling;
    this.rect.setAlpha(isRolling ? 0.92 : 1);
  }

  playRoll(finalRune: RuneType, delay: number): Promise<void> {
    if (this.die.locked || this.die.blocked || this.die.forced) {
      this.render();
      return Promise.resolve();
    }
    this.setRolling(true);
    const faces = this.die.faces;
    return new Promise((resolve) => {
      let ticks = 0;
      this.scene.time.delayedCall(delay, () => {
        const timer = this.scene.time.addEvent({
          delay: 48,
          repeat: 9,
          callback: () => {
            ticks++;
            this.txt.setText(RUNE_EMOJI[faces[Math.floor(Math.random() * faces.length)]]);
            this.rect.setRotation((Math.random() - 0.5) * 0.18);
            this.rect.setScale(1 + (ticks % 2) * 0.08);
          },
        });
        this.scene.time.delayedCall(560, () => {
          timer.remove(false);
          this.die.value = finalRune;
          this.rect.setRotation(0);
          this.rect.setScale(1);
          this.setRolling(false);
          this.render();
          resolve();
        });
      });
    });
  }

  playLockPulse() {
    this.scene.tweens.add({
      targets: [this.rect, this.txt],
      scale: 1.12,
      yoyo: true,
      duration: 90,
      ease: 'Sine.easeOut',
    });
  }

  private fillColor() {
    if (this.rolling) return 0x334155;
    if (this.die.value === 'curse' || this.die.forced) return 0x5b123f;
    if (this.die.blocked) return 0x3b1d12;
    return 0x1f2937;
  }

  private label() {
    if (this.die.blocked) return '封印';
    if (this.die.forced) return '诅咒';
    if (this.die.locked) return '已锁定';
    return RUNE_NAME[this.die.value];
  }
}
