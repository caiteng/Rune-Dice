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
