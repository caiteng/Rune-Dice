import Phaser from 'phaser';

type SizedImage = Phaser.GameObjects.Image;

export function fitImage(image: SizedImage, maxWidth: number, maxHeight: number) {
  const width = image.width;
  const height = image.height;
  if (width <= 0 || height <= 0) {
    image.setDisplaySize(maxWidth, maxHeight);
    return image;
  }

  const scale = Math.min(maxWidth / width, maxHeight / height);
  image.setDisplaySize(Math.round(width * scale), Math.round(height * scale));
  return image;
}

export function addFitImage(scene: Phaser.Scene, x: number, y: number, texture: string, maxWidth: number, maxHeight: number) {
  return fitImage(scene.add.image(x, y, texture), maxWidth, maxHeight);
}

export function fitImageHeight(image: SizedImage, height: number) {
  const sourceHeight = image.height;
  if (sourceHeight <= 0) {
    image.setDisplaySize(image.displayWidth, height);
    return image;
  }

  image.setScale(height / sourceHeight);
  return image;
}

export function addHeightImage(scene: Phaser.Scene, x: number, y: number, texture: string, height: number) {
  return fitImageHeight(scene.add.image(x, y, texture), height);
}
