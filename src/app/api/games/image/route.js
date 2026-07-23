import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';
import { parseDataUrlImage } from '../../../../lib/gameImages';

/**
 * Serve a single game cover as binary (not base64 JSON).
 * Enables parallel image loads + long browser cache without bloating /api/games.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'Game id required.' }, { status: 400 });
    }

    let image = null;

    const cachedGames = cache.get('games_all');
    if (Array.isArray(cachedGames)) {
      const hit = cachedGames.find((g) => g.id === id);
      if (hit?.image) image = hit.image;
    }

    if (!image) {
      const perKey = `game_image_${id}`;
      const perCached = cache.get(perKey);
      if (perCached) {
        image = perCached;
      } else {
        const db = await getDb();
        const game = await db.collection('games').findOne(
          { id },
          { projection: { _id: 0, image: 1 } }
        );
        image = game?.image || null;
        if (image) cache.set(perKey, image, 300);
      }
    }

    if (!image) {
      return NextResponse.json({ success: false, message: 'Image not found.' }, { status: 404 });
    }

    // Static filename / absolute URL — redirect so <img> still works.
    if (!image.startsWith('data:')) {
      if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
        return NextResponse.redirect(new URL(image, req.url), 302);
      }
      return NextResponse.redirect(new URL('/' + image.replace(/^\//, ''), req.url), 302);
    }

    const parsed = parseDataUrlImage(image);
    if (!parsed) {
      return NextResponse.json({ success: false, message: 'Invalid image data.' }, { status: 500 });
    }

    return new NextResponse(parsed.buffer, {
      status: 200,
      headers: {
        'Content-Type': parsed.mime,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err) {
    console.error('Game image API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
