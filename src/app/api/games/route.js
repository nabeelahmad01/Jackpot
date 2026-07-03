import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

// GET all games
export async function GET() {
  try {
    const db = await getDb();
    const gamesCollection = db.collection('games');
    const games = await gamesCollection.find().toArray();
    return NextResponse.json({ success: true, games });
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
      availableCoins: Number(game.availableCoins || 0)
    };

    await gamesCollection.insertOne(newGame);
    return NextResponse.json({ success: true, game: newGame, message: 'Game added successfully!' });
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

    const updateFields = {
      title: game.title,
      badge: game.badge,
      image: game.image,
      link: game.link,
      availableCoins: game.availableCoins !== undefined ? Number(game.availableCoins) : undefined
    };

    // Clean undefined fields
    Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);

    await gamesCollection.updateOne({ id: game.id }, { $set: updateFields });
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
    return NextResponse.json({ success: true, message: 'Game deleted successfully!' });
  } catch (err) {
    console.error('Delete Game API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
