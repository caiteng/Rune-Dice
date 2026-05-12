import Phaser from 'phaser';
import type { PlayerState } from '../core/types';
import { addFitImage } from './ImageFit';

export class StatusPanel {
  txt: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly darkText: Phaser.GameObjects.Text;
  private readonly relicText: Phaser.GameObjects.Text;
  private readonly healthFill: Phaser.GameObjects.Image;
  private readonly armorFill: Phaser.GameObjects.Image;
  private readonly energyFill: Phaser.GameObjects.Image;
  private readonly healthFillWidth = 132;
  private readonly armorFillWidth = 132;
  private readonly energyFillWidth = 132;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    scene.add.rectangle(x + 175, y + 58, 350, 116, 0x111827, 0.92).setStrokeStyle(1, 0x334155, 0.85);
    scene.add.text(x + 12, y + 8, '人物', { fontSize: '13px', color: '#93c5fd' });
    addFitImage(scene, x + 34, y + 32, 'icon_health', 20, 18);
    addFitImage(scene, x + 34, y + 58, 'icon_armor', 20, 20);
    addFitImage(scene, x + 34, y + 84, 'icon_reroll', 20, 20);
    addFitImage(scene, x + 218, y + 30, 'icon_gold', 20, 20);
    scene.add.image(x + 102, y + 32, 'bar_health_empty').setDisplaySize(148, 22);
    scene.add.image(x + 102, y + 58, 'bar_armor_empty').setDisplaySize(148, 22);
    scene.add.image(x + 102, y + 84, 'bar_energy_empty').setDisplaySize(148, 22);
    this.healthFill = scene.add.image(x + 36, y + 32, 'bar_health_full').setOrigin(0, 0.5).setDisplaySize(this.healthFillWidth, 16);
    this.armorFill = scene.add.image(x + 36, y + 58, 'bar_armor_full').setOrigin(0, 0.5).setDisplaySize(this.armorFillWidth, 16);
    this.energyFill = scene.add.image(x + 36, y + 84, 'bar_energy_full').setOrigin(0, 0.5).setDisplaySize(this.energyFillWidth, 16);
    this.txt = scene.add.text(x + 56, y + 22, '', {
      fontSize: '12px',
      color: '#fff',
      lineSpacing: 4,
      fixedWidth: 136,
      wordWrap: { width: 136 },
    });
    this.goldText = scene.add.text(x + 236, y + 22, '', { fontSize: '12px', color: '#fff', fixedWidth: 112 });
    this.darkText = scene.add.text(x + 236, y + 50, '', { fontSize: '12px', color: '#c4b5fd', fixedWidth: 112 });
    this.relicText = scene.add.text(x + 218, y + 78, '', {
      fontSize: '11px',
      color: '#e5e7eb',
      fixedWidth: 118,
      fixedHeight: 28,
      wordWrap: { width: 118, useAdvancedWrap: true },
    });
  }

  set(t: string) {
    this.txt.setText(t);
  }

  setStats(player: PlayerState, relicText: string) {
    const relicSummary = relicText.length > 14 ? `${relicText.slice(0, 13)}...` : relicText;
    this.setBar(this.healthFill, this.healthFillWidth, player.hp / player.maxHp);
    this.setBar(this.armorFill, this.armorFillWidth, player.armor / Math.max(12, player.maxHp));
    this.setBar(this.energyFill, this.energyFillWidth, player.rerollsLeft / Math.max(1, player.rerollMax));
    this.txt.setText(`${player.hp}/${player.maxHp}\n${player.armor} 护甲\n${player.rerollsLeft}/${player.rerollMax} 重掷`);
    this.goldText.setText(`金币 ${player.gold}`);
    this.darkText.setText(`暗能 ${player.darkEnergy}`);
    this.relicText.setText(`遗物：${relicSummary}`);
  }

  private setBar(image: Phaser.GameObjects.Image, fullWidth: number, ratio: number) {
    image.setDisplaySize(Math.max(8, fullWidth * Phaser.Math.Clamp(ratio, 0, 1)), 16);
  }
}
