import sharp from 'sharp';

/**
 * Shrink large data-URL images before Mongo write.
 * Only touches oversized payloads — small proofs pass through unchanged.
 */
export async function compressDataUrlIfNeeded(dataUrl, options = {}) {
  const {
    maxChars = 220_000, // ~165KB binary; above this we recompress
    maxSize = 1280,
    quality = 72
  } = options;

  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
  if (!dataUrl.startsWith('data:image')) return dataUrl;
  if (dataUrl.length <= maxChars) return dataUrl;

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl;

  try {
    const inputBuf = Buffer.from(dataUrl.slice(commaIdx + 1), 'base64');
    const outBuf = await sharp(inputBuf)
      .rotate()
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    const next = `data:image/webp;base64,${outBuf.toString('base64')}`;
    return next.length < dataUrl.length ? next : dataUrl;
  } catch (err) {
    console.error('compressDataUrlIfNeeded failed:', err?.message || err);
    return dataUrl;
  }
}
