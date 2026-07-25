'use client';

/**
 * Compress and resize an image File into a small data URL.
 *
 * @param {File} file - The image file selected by the user.
 * @param {Object} [options]
 * @param {number} [options.maxSize=512] - Max width/height in pixels.
 * @param {number} [options.quality=0.72] - Output quality (0-1).
 * @param {number} [options.maxChars] - Soft cap on data-URL length; re-encodes harder if over.
 * @returns {Promise<string>} A compressed data URL (webp when supported, else jpeg).
 */
export function compressImageFile(file, options = {}) {
  const { maxSize = 512, quality = 0.72, maxChars } = options;

  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Not an image file.'));
      return;
    }

    // GIFs would lose animation through canvas — keep them as-is unless capped.
    if (file.type === 'image/gif' && maxChars == null) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read image.'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image.'));
    reader.onloadend = () => {
      compressDataUrl(reader.result, { maxSize, quality, maxChars })
        .then(resolve)
        .catch(reject);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Re-encode an existing data URL. Used for deposit proofs so PUT bodies
 * stay under nginx limits (large phone screenshots used to hang "Proof uploading…").
 */
export function compressDataUrl(dataUrl, options = {}) {
  const {
    maxSize = 900,
    quality = 0.58,
    maxChars
  } = options;

  return new Promise((resolve, reject) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      reject(new Error('Not an image data URL.'));
      return;
    }

    // Already small enough — skip canvas work.
    if (typeof maxChars === 'number' && dataUrl.length <= maxChars) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onerror = () => reject(new Error('Failed to decode image.'));
    img.onload = () => {
      try {
        let size = maxSize;
        let q = quality;
        let best = dataUrl;
        const maxAttempts = typeof maxChars === 'number' ? 6 : 1;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          let { width, height } = img;
          if (width > size || height > size) {
            if (width >= height) {
              height = Math.round((height * size) / width);
              width = size;
            } else {
              width = Math.round((width * size) / height);
              height = size;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(best !== dataUrl && best.length < dataUrl.length ? best : dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          let out = '';
          try {
            out = canvas.toDataURL('image/webp', q);
          } catch {
            out = '';
          }
          if (!out || !out.startsWith('data:image/webp')) {
            out = canvas.toDataURL('image/jpeg', q);
          }

          if (out && out.length < best.length) best = out;

          if (typeof maxChars === 'number') {
            if (out && out.length <= maxChars) {
              resolve(out);
              return;
            }
            size = Math.max(480, Math.round(size * 0.82));
            q = Math.max(0.38, q - 0.08);
          } else {
            // No char cap: prefer smaller encode, else original (legacy game-cover behavior)
            resolve(out && out.length < dataUrl.length ? out : dataUrl);
            return;
          }
        }

        // Prefer compressed best-effort over a multi-MB original (nginx rejects huge bodies).
        resolve(best.length < dataUrl.length ? best : dataUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.src = dataUrl;
  });
}
