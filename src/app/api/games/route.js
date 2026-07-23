import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { jsonOk } from '../../../lib/apiResponse';
import { isGameImageProxyUrl, toPublicGames, toPublicGameImage } from '../../../lib/gameImages';

// GET all games
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const distributorId = searchParams.get('distributorId');

    if (!distributorId) {
      const cachedGames = cache.get('games_all');
      if (cachedGames) {
        // Memory keeps full docs (with data URLs); clients get slim proxy URLs.
        return jsonOk(
          { success: true, games: toPublicGames(cachedGames) },
          { cacheSeconds: 120, scope: 'public' }
        );
      }
    }

    const db = await getDb();
    const gamesCollection = db.collection('games');
    const games = await gamesCollection.find({}, { projection: { _id: 0 } }).toArray();
    
    if (distributorId) {
      const distGames = await db.collection('distributorGames').find({ distributorId }).toArray();
      const distGamesMap = {};
      distGames.forEach(dg => {
        distGamesMap[dg.gameId] = dg;
      });

      const mappedGames = games.map(game => {
        const dg = distGamesMap[game.id];
        return {
          ...game,
          availableCoins: dg ? (dg.availableCoins || 0) : 0,
          usedCoins: dg ? (dg.usedCoins || 0) : 0,
          openPanelLink: dg ? (dg.openPanelLink || game.openPanelLink || game.link) : (game.openPanelLink || game.link)
        };
      });
      return jsonOk(
        { success: true, games: toPublicGames(mappedGames) },
        { cacheSeconds: 60, scope: 'public' }
      );
    }

    // Cache FULL documents so /api/games/image can serve without another DB round-trip.
    cache.set('games_all', games, 300);
    return jsonOk(
      { success: true, games: toPublicGames(games) },
      { cacheSeconds: 120, scope: 'public' }
    );
  } catch (err) {
    console.error('Fetch Games API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST new game (Admin action)
export async function POST(req) {
  try {
    const game = await req.json();
    if (!game.title || !game.link) {
      return NextResponse.json({ success: false, message: 'Title and link are required fields.' }, { status: 400 });
    }

    const db = await getDb();
    const gamesCollection = db.collection('games');

    const newGame = {
      id: game.id || Date.now().toString(),
      title: game.title,
      badge: game.badge || 'none',
      image: game.image || 'placeholder_1',
      link: game.link,
      openPanelLink: game.openPanelLink || '',
      availableCoins: Number(game.availableCoins || 0),
      usedCoins: 0
    };

    await gamesCollection.insertOne(newGame);
    
    // Invalidate caches
    cache.del('games_all');
    cache.del(`game_image_${newGame.id}`);
    
    return NextResponse.json({ success: true, game: { ...newGame, image: toPublicGameImage(newGame) }, message: 'Game added successfully!' });
  } catch (err) {
    console.error('Create Game API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT (update) game (Admin action)
export async function PUT(req) {
  try {
    const game = await req.json();
    if (!game.id) {
      return NextResponse.json({ success: false, message: 'Game ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const gamesCollection = db.collection('games');

    if (game.distributorId) {
      const updateDoc = {
        distributorId: game.distributorId,
        gameId: game.id,
        availableCoins: game.availableCoins !== undefined ? Number(game.availableCoins) : 0,
        openPanelLink: game.openPanelLink || ''
      };
      if (game.resetUsedCoins) {
        updateDoc.usedCoins = 0;
      }
      await db.collection('distributorGames').updateOne(
        { distributorId: game.distributorId, gameId: game.id },
        { $set: updateDoc },
        { upsert: true }
      );
      return NextResponse.json({ success: true, message: 'Distributor game pool updated successfully!' });
    }

    const updateFields = {
      title: game.title,
      badge: game.badge,
      image: game.image,
      link: game.link,
      openPanelLink: game.openPanelLink,
      availableCoins: game.availableCoins !== undefined ? Number(game.availableCoins) : undefined
    };

    if (game.resetUsedCoins) {
      updateFields.usedCoins = 0;
    }

    // Admin edit form may send the public proxy URL if the cover was not re-uploaded.
    // Never persist that URL over the real base64 / file path in Mongo.
    if (isGameImageProxyUrl(updateFields.image)) {
      delete updateFields.image;
    }

    // Clean undefined fields
    Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);

    await gamesCollection.updateOne({ id: game.id }, { $set: updateFields });
    
    // Invalidate caches
    cache.del('games_all');
    cache.del(`game_image_${game.id}`);

    return NextResponse.json({ success: true, message: 'Game updated successfully!' });
  } catch (err) {
    console.error('Update Game API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE game (Admin action)
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Game ID parameter is required.' }, { status: 400 });
    }

    const db = await getDb();
    const gamesCollection = db.collection('games');

    await gamesCollection.deleteOne({ id });
    
    // Invalidate caches
    cache.del('games_all');
    cache.del(`game_image_${id}`);

    return NextResponse.json({ success: true, message: 'Game deleted successfully!' });
  } catch (err) {
    console.error('Delete Game API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

