'use client';

/**
 * Compress and resize an image File into a small data URL.
 *
 * Game cover images were previously stored as raw base64 data URLs (up to 2MB
 * each) inside the games collection. Returning all of them inline in
 * /api/games made the lobby load very slowly. Compressing on upload keeps the
 * payload tiny while preserving visual quality for the small cards.
 *
 * @param {File} file - The image file selected by the user.
 * @param {Object} [options]
 * @param {number} [options.maxSize=512] - Max width/height in pixels.
 * @param {number} [options.quality=0.72] - Output quality (0-1).
 * @returns {Promise<string>} A compressed data URL (webp when supported, else jpeg).
 */
export function compressImageFile(file, options = {}) {
  const { maxSize = 512, quality = 0.72 } = options;

  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Not an image file.'));
      return;
    }

    // GIFs would lose animation through canvas — keep them as-is.
    if (file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read image.'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image.'));
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let out = '';
        try {
          out = canvas.toDataURL('image/webp', quality);
        } catch {
          out = '';
        }
        // Fallback if webp unsupported or bigger than original.
        if (!out || !out.startsWith('data:image/webp')) {
          out = canvas.toDataURL('image/jpeg', quality);
        }

        // If somehow the compressed version is larger than the original, keep original.
        resolve(out && out.length < reader.result.length ? out : reader.result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
