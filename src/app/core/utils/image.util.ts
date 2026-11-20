// src/app/core/utils/image.util.ts

/** Lado mayor máximo de la foto de perfil (px). Suficiente para un avatar, incluso en pantallas retina. */
export const AVATAR_MAX_SIZE_PX = 512;
/** Calidad JPEG (0-1). 0.8 da ~40-80 KB para 512 px sin pérdida visible en un avatar. */
export const AVATAR_JPEG_QUALITY = 0.8;

/**
 * Reduce una imagen (archivo elegido por el usuario o data URL ya existente)
 * a un JPEG de máximo `maxSize` px por lado y la devuelve como data URL.
 *
 * POR QUÉ: la foto original de la cámara (2-5 MB, ~4-7 MB en base64) viajaba
 * completa dentro del snapshot de SecureStoragePlugin y en /patient/update.
 * En Android ese plugin cifra con RSA-2048 en bloques de 245 bytes, así que
 * cada MB extra son ~4,300 operaciones RSA al leer (ver
 * MedicalRecordStorageService). Con este resize, la foto pesa unos KB.
 *
 * - Respeta la orientación EXIF (los WebView modernos la aplican al dibujar).
 * - Rellena de blanco antes de dibujar, para que PNG con transparencia no
 *   quede negro al pasar a JPEG.
 * - No amplía imágenes pequeñas.
 */
export function resizeImageToJpegDataUrl(
  source: Blob | string,
  maxSize: number = AVATAR_MAX_SIZE_PX,
  quality: number = AVATAR_JPEG_QUALITY,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
    const release = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };

    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (!width || !height) throw new Error('La imagen no tiene dimensiones válidas.');

        const scale = Math.min(1, maxSize / Math.max(width, height));
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D no disponible.');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      } finally {
        release();
      }
    };
    img.onerror = () => {
      release();
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = objectUrl ?? (source as string);
  });
}
