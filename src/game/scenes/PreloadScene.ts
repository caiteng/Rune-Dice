import Phaser from 'phaser';
import { ALL_IMAGE_ASSETS } from '../assets/RuneDiceAssets';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    ALL_IMAGE_ASSETS.forEach(([key, path]) => this.load.image(key, path));
  }

  create() {
    ALL_IMAGE_ASSETS.forEach(([key]) => this.textures.get(key)?.setFilter(Phaser.Textures.FilterMode.LINEAR));
    this.scene.start('Home');
  }
}
