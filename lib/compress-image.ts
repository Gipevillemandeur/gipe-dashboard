'use client';

/*
 * Réduit une photo dans le navigateur avant l'envoi :
 * les photos de téléphone (5–12 Mo) deviennent un JPEG
 * d'environ 0,5–1,5 Mo, assez net pour Facebook, et qui
 * passe sous la limite d'envoi du serveur (4 Mo).
 */

const MAX_SIDE = 2048;
const TARGET_SIZE = 3.5 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Cette photo ne peut pas être lue. Essaie une photo JPG ou PNG.'));
    };
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier choisi n’est pas une photo.');
  }

  // GIF animé ou petite image : envoyée telle quelle.
  if (file.type === 'image/gif' || file.size <= 1024 * 1024) {
    return file;
  }

  const image = await loadImage(file);
  const ratio = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return file;

  // Fond blanc (les PNG transparents deviendraient noirs en JPEG).
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  for (const quality of [0.85, 0.75, 0.6]) {
    const blob = await toBlob(canvas, quality);
    if (blob && (blob.size <= TARGET_SIZE || quality === 0.6)) {
      const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
      return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
    }
  }

  return file;
}
