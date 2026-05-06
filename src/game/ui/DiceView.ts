import Phaser from 'phaser';
import type { Die, RuneType } from '../core/types';
import { RUNE_NAME } from '../data/runes';
import { RUNE_FACE_ASSET } from '../assets/RuneDiceAssets';

export class DiceView {
  rect: Phaser.GameObjects.Rectangle;
  body: Phaser.GameObjects.Image;
  face: Phaser.GameObjects.Image;
  lockedBadge: Phaser.GameObjects.Image;
  sealedBadge: Phaser.GameObjects.Image;
  empoweredBadge: Phaser.GameObjects.Image;
  selectedHighlight: Phaser.GameObjects.Image;
  txt: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
  private rolling = false;
  private selected = false;
  private assigned = false;

  constructor(private readonly scene: Phaser.Scene, public die: Die, x: number, y: number, cb: () => void) {
    this.selectedHighlight = scene.add.image(x, y, 'state_selected_highlight').setDisplaySize(78, 82).setAlpha(0);
    this.body = scene.add.image(x, y, 'dice_common_body').setDisplaySize(66, 72);
    this.face = scene.add.image(x, y - 2, RUNE_FACE_ASSET[die.value]).setDisplaySize(40, 44);
    this.lockedBadge = scene.add.image(x + 22, y - 24, 'state_locked_badge').setDisplaySize(26, 26).setVisible(false);
    this.sealedBadge = scene.add.image(x, y, 'state_sealed_badge').setDisplaySize(70, 70).setAlpha(0.82).setVisible(false);
    this.empoweredBadge = scene.add.image(x, y, 'state_empowered_badge').setDisplaySize(74, 74).setAlpha(0.76).setVisible(false);
    this.rect = scene.add.rectangle(x, y, 70, 76, 0xffffff, 0.001).setInteractive();
    this.txt = scene.add.text(x, y - 2, '', { fontSize: '22px', color: '#fff' }).setOrigin(0.5).setVisible(false);
    this.tag = scene.add.text(x, y + 39, '', { fontSize: '12px', color: '#f8fafc' }).setOrigin(0.5);
    this.rect.on('pointerdown', cb);
    this.rect.on('pointerover', () => this.selectedHighlight.setAlpha(0.75));
    this.rect.on('pointerout', () => this.render());
  }

  render() {
    this.face.setTexture(RUNE_FACE_ASSET[this.die.value]);
    this.tag.setText(this.label());
    this.body.setTexture(this.bodyTexture());
    this.body.setTint(this.rolling ? 0xcbd5e1 : this.assigned ? 0xdbeafe : 0xffffff);
    this.lockedBadge.setVisible(this.die.locked || this.assigned);
    this.sealedBadge.setVisible(this.die.blocked);
    this.empoweredBadge.setVisible(this.die.forced);
    this.selectedHighlight.setAlpha(this.selected ? 0.85 : this.die.locked || this.assigned ? 0.45 : 0);
  }

  setStateMarkers(selected: boolean, assigned: boolean) {
    this.selected = selected;
    this.assigned = assigned;
  }

  setRolling(isRolling: boolean) {
    this.rolling = isRolling;
    this.body.setAlpha(isRolling ? 0.92 : 1);
    this.face.setAlpha(isRolling ? 0.92 : 1);
  }

  playRoll(finalRune: RuneType, delay: number, canAnimate = true): Promise<void> {
    if (!canAnimate || this.die.locked || this.die.blocked || this.die.forced) {
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
            this.face.setTexture(RUNE_FACE_ASSET[faces[Math.floor(Math.random() * faces.length)]]);
            [this.body, this.face, this.rect].forEach((target) => target.setRotation((Math.random() - 0.5) * 0.18));
            [this.body, this.face].forEach((target) => target.setScale(1 + (ticks % 2) * 0.08));
          },
        });
        this.scene.time.delayedCall(560, () => {
          timer.remove(false);
          this.die.value = finalRune;
          [this.body, this.face, this.rect].forEach((target) => target.setRotation(0));
          this.body.setDisplaySize(66, 72);
          this.face.setDisplaySize(40, 44);
          this.setRolling(false);
          this.render();
          resolve();
        });
      });
    });
  }

  playLockPulse() {
    this.scene.tweens.add({
      targets: [this.body, this.face, this.lockedBadge],
      scale: 1.12,
      yoyo: true,
      duration: 90,
      ease: 'Sine.easeOut',
    });
  }

  private bodyTexture() {
    if (this.die.forced) return 'dice_rare_body';
    if (this.die.value === 'curse') return 'dice_cursed_body';
    if (this.die.faces.includes('wild')) return 'dice_boss_body';
    return 'dice_common_body';
  }

  private label() {
    if (this.assigned) return '已分配';
    if (this.die.blocked) return '封印';
    if (this.die.forced) return '诅咒';
    if (this.die.locked) return '已锁定';
    return RUNE_NAME[this.die.value];
  }
}
