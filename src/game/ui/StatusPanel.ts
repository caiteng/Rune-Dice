import Phaser from 'phaser';
import type { PlayerState } from '../core/types';
import { addFitImage } from './ImageFit';

export class StatusPanel {
  txt: Phaser.GameObjects.Text;
  private readonly healthFill: Phaser.GameObjects.Image;
  private readonly armorFill: Phaser.GameObjects.Image;
  private readonly energyFill: Phaser.GameObjects.Image;
  private readonly healthFillWidth = 164;
  private readonly armorFillWidth = 164;
  private readonly energyFillWidth = 164;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    scene.add.image(x + 175, y + 92, 'panel_vertical_common').setDisplaySize(350, 196);
    addFitImage(scene, x + 42, y + 24, 'icon_health', 28, 26);
    addFitImage(scene, x + 42, y + 66, 'icon_armor', 28, 28);
    addFitImage(scene, x + 42, y + 108, 'icon_reroll', 28, 28);
    addFitImage(scene, x + 228, y + 24, 'icon_gold', 28, 28);
    scene.add.image(x + 118, y + 24, 'bar_health_empty').setDisplaySize(182, 34);
    scene.add.image(x + 118, y + 66, 'bar_armor_empty').setDisplaySize(182, 34);
    scene.add.image(x + 118, y + 108, 'bar_energy_empty').setDisplaySize(182, 34);
    this.healthFill = scene.add.image(x + 36, y + 24, 'bar_health_full').setOrigin(0, 0.5).setDisplaySize(this.healthFillWidth, 26);
    this.armorFill = scene.add.image(x + 36, y + 66, 'bar_armor_full').setOrigin(0, 0.5).setDisplaySize(this.armorFillWidth, 26);
    this.energyFill = scene.add.image(x + 36, y + 108, 'bar_energy_full').setOrigin(0, 0.5).setDisplaySize(this.energyFillWidth, 26);
    this.txt = scene.add.text(x + 64, y + 10, '', { fontSize: '16px', color: '#fff', lineSpacing: 13, wordWrap: { width: 250 } });
  }

  set(t: string) {
    this.txt.setText(t);
  }

  setStats(player: PlayerState, relicText: string) {
    this.setBar(this.healthFill, this.healthFillWidth, player.hp / player.maxHp);
    this.setBar(this.armorFill, this.armorFillWidth, player.armor / Math.max(12, player.maxHp));
    this.setBar(this.energyFill, this.energyFillWidth, player.rerollsLeft / Math.max(1, player.rerollMax));
    this.txt.setText(
      `${player.hp}/${player.maxHp}      金币 ${player.gold}\n` +
      `${player.armor} 护甲      暗能 ${player.darkEnergy}\n` +
      `${player.rerollsLeft}/${player.rerollMax} 重掷\n` +
      `遗物：${relicText}`,
    );
  }

  private setBar(image: Phaser.GameObjects.Image, fullWidth: number, ratio: number) {
    image.setDisplaySize(Math.max(8, fullWidth * Phaser.Math.Clamp(ratio, 0, 1)), 26);
  }
}
