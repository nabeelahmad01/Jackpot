/**
 * Game cover helpers: keep large base64 images out of /api/games JSON.
 * Lobby cards load covers via /api/games/image (browser-cacheable).
 */

export function isGameImageProxyUrl(image) {
  return typeof image === 'string' && image.includes('/api/games/image');
}

export function isEmbeddedGameImage(image) {
  return typeof image === 'string' && image.startsWith('data:image');
}

/** Rewrite embedded data-URLs to a cacheable image endpoint for API clients. */
export function toPublicGameImage(game) {
  const img = game?.image || '';
  if (!isEmbeddedGameImage(img)) return img;
  const v = img.length;
  return `/api/games/image?id=${encodeURIComponent(game.id)}&v=${v}`;
}

export function toPublicGames(games) {
  return (games || []).map((game) => ({
    ...game,
    image: toPublicGameImage(game),
  }));
}

/** Parse a data-URL into bytes + mime for the image route. */
export function parseDataUrlImage(dataUrl) {
  if (!isEmbeddedGameImage(dataUrl)) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const meta = dataUrl.slice(5, commaIdx); // image/webp;base64
  const mime = meta.split(';')[0] || 'image/webp';
  const base64 = dataUrl.slice(commaIdx + 1);
  try {
    return { mime, buffer: Buffer.from(base64, 'base64') };
  } catch {
    return null;
  }
}
