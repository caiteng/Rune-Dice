import Phaser from 'phaser';

export class BattleLogView {
  txt: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    scene.add.rectangle(x + 161, y + 38, 322, 76, 0x111827, 0.9).setStrokeStyle(1, 0x334155, 0.8);
    scene.add.text(x + 2, y - 12, '战斗日志', { fontSize: '13px', color: '#93c5fd' });
    this.txt = scene.add.text(x, y + 8, '', { fontSize: '13px', color: '#cbd5e1', lineSpacing: 3, wordWrap: { width: 322 } });
  }

  set(lines: string[]) {
    this.txt.setText(lines.slice(-3).join('\n'));
  }
}
