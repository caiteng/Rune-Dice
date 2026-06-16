import Phaser from 'phaser';

export class BattleLogView {
  private readonly scene: Phaser.Scene;
  private readonly tab: Phaser.GameObjects.Container;
  private readonly drawer: Phaser.GameObjects.Container;
  private readonly scrim: Phaser.GameObjects.Rectangle;
  private readonly txt: Phaser.GameObjects.Text;
  private lines: string[] = [];
  private isOpen = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const tabBg = scene.add.rectangle(382, 548, 26, 112, 0x1d4ed8, 0.9).setStrokeStyle(1, 0x93c5fd, 0.8);
    const tabText = scene.add.text(382, 548, '日志', {
      fontSize: '13px',
      color: '#fff',
      align: 'center',
      fixedWidth: 20,
      wordWrap: { width: 18, useAdvancedWrap: true },
    }).setOrigin(0.5);
    this.tab = scene.add.container(0, 0, [tabBg, tabText]).setDepth(45).setSize(26, 112).setInteractive(
      new Phaser.Geom.Rectangle(369, 492, 26, 112),
      Phaser.Geom.Rectangle.Contains,
    );
    this.tab.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.open();
    });

    this.scrim = scene.add.rectangle(195, 422, 390, 844, 0x000000, 0.18).setDepth(48).setInteractive().setVisible(false);
    this.scrim.on('pointerdown', () => this.close());

    const bg = scene.add.rectangle(214, 548, 330, 270, 0x0f172a, 0.98).setStrokeStyle(2, 0x60a5fa, 0.9);
    const title = scene.add.text(66, 426, '战斗日志', { fontSize: '17px', color: '#fff' });
    const closeBg = scene.add.rectangle(352, 430, 38, 34, 0x7f1d1d, 0.95).setStrokeStyle(1, 0xfca5a5, 0.8);
    const closeText = scene.add.text(352, 430, '×', { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
    this.txt = scene.add.text(66, 462, '', {
      fontSize: '13px',
      color: '#dbeafe',
      lineSpacing: 5,
      wordWrap: { width: 292, useAdvancedWrap: true },
    });
    this.drawer = scene.add.container(0, 0, [bg, title, closeBg, closeText, this.txt]).setDepth(50).setVisible(false);
    closeBg.setInteractive();
    closeBg.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.close();
    });
    this.drawer.setInteractive(new Phaser.Geom.Rectangle(49, 413, 330, 270), Phaser.Geom.Rectangle.Contains);
    this.drawer.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
    });
  }

  set(lines: string[]) {
    this.lines = lines;
    this.txt.setText(lines.slice(-8).join('\n'));
  }

  close() {
    this.isOpen = false;
    this.scrim.setVisible(false);
    this.drawer.setVisible(false);
    this.tab.setVisible(true);
  }

  private open() {
    this.isOpen = true;
    this.txt.setText(this.lines.slice(-8).join('\n'));
    this.scrim.setVisible(true);
    this.drawer.setVisible(true);
    this.tab.setVisible(false);
  }
}
