import Phaser from 'phaser';export class PreloadScene extends Phaser.Scene{constructor(){super('Preload')}create(){this.scene.start('Home')}}
