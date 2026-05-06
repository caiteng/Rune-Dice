import Phaser from 'phaser';
import type { PlayerState } from '../core/types';
import { addFitImage } from './ImageFit';

export class StatusPanel {
  txt: Phaser.GameObjects.Text;
  private readonly healthFill: Phaser.GameObjects.Image;
  private readonly armorFill: Phaser.GameObjects.Image;
  private readonly energyFill: Phaser.GameObjects.Image;
  private readonly healthFillWidth = 150;
  private readonly armorFillWidth = 150;
  private readonly energyFillWidth = 150;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    scene.add.image(x + 175, y + 58, 'panel_vertical_common').setDisplaySize(350, 116);
    addFitImage(scene, x + 38, y + 18, 'icon_health', 22, 20);
    addFitImage(scene, x + 38, y + 46, 'icon_armor', 22, 22);
    addFitImage(scene, x + 38, y + 74, 'icon_reroll', 22, 22);
    addFitImage(scene, x + 224, y + 18, 'icon_gold', 22, 22);
    scene.add.image(x + 112, y + 18, 'bar_health_empty').setDisplaySize(168, 24);
    scene.add.image(x + 112, y + 46, 'bar_armor_empty').setDisplaySize(168, 24);
    scene.add.image(x + 112, y + 74, 'bar_energy_empty').setDisplaySize(168, 24);
    this.healthFill = scene.add.image(x + 38, y + 18, 'bar_health_full').setOrigin(0, 0.5).setDisplaySize(this.healthFillWidth, 18);
    this.armorFill = scene.add.image(x + 38, y + 46, 'bar_armor_full').setOrigin(0, 0.5).setDisplaySize(this.armorFillWidth, 18);
    this.energyFill = scene.add.image(x + 38, y + 74, 'bar_energy_full').setOrigin(0, 0.5).setDisplaySize(this.energyFillWidth, 18);
    this.txt = scene.add.text(x + 62, y + 6, '', { fontSize: '13px', color: '#fff', lineSpacing: 4, wordWrap: { width: 264 } });
  }

  set(t: string) {
    this.txt.setText(t);
  }

  setStats(player: PlayerState, relicText: string) {
    const relicSummary = relicText.length > 18 ? `${relicText.slice(0, 17)}...` : relicText;
    this.setBar(this.healthFill, this.healthFillWidth, player.hp / player.maxHp);
    this.setBar(this.armorFill, this.armorFillWidth, player.armor / Math.max(12, player.maxHp));
    this.setBar(this.energyFill, this.energyFillWidth, player.rerollsLeft / Math.max(1, player.rerollMax));
    this.txt.setText(
      `${player.hp}/${player.maxHp}      金币 ${player.gold}\n` +
      `${player.armor} 护甲      暗能 ${player.darkEnergy}\n` +
      `${player.rerollsLeft}/${player.rerollMax} 重掷\n` +
      `遗物：${relicSummary}`,
    );
  }

  private setBar(image: Phaser.GameObjects.Image, fullWidth: number, ratio: number) {
    image.setDisplaySize(Math.max(8, fullWidth * Phaser.Math.Clamp(ratio, 0, 1)), 18);
  }
}
