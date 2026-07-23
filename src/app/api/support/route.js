import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { notifyStaffAsync } from '../../../lib/pushNotifications';

// GET support chat messages
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = await getDb();
    const supportCollection = db.collection('supportMessages');

    const adminDistributorId = searchParams.get('adminDistributorId');

    let baseQuery = {};
    if (adminDistributorId) {
      baseQuery.distributorId = adminDistributorId;
    } else if (!email) {
      // Exclude chats belonging to Type B distributors ONLY for generic admin views
      // If email is present, player is querying their own chat, so don't exclude!
      baseQuery.distributorType = { $ne: 'B' };
    }

    if (email) {
      // Return full conversation history for a specific player (usually small, but paginated/limited to protect DB)
      const skip = (page - 1) * limit;
      const emailKey = email.toLowerCase().trim();
      const messages = await supportCollection
        .find({ ...baseQuery, userEmail: emailKey })
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const isGuest =
        emailKey.includes('@jackpotguest.com') || emailKey.startsWith('guest_');
      let playerName = isGuest ? 'Guest' : '';
      if (!isGuest) {
        const userDoc = await db.collection('users').findOne(
          { email: emailKey },
          { projection: { name: 1 } }
        );
        playerName = (userDoc?.name || '').trim();
        if (!playerName) {
          const fromMsg = [...messages].reverse().find((m) => {
            const raw = String(m.userName || '').trim();
            return raw && !/^support\s*agent$/i.test(raw) && !/^player$/i.test(raw);
          });
          const raw = String(fromMsg?.userName || '').trim();
          playerName = raw
            ? (/^guest(\s*#?\d+)?$/i.test(raw) ? 'Guest' : raw)
            : emailKey.split('@')[0] || 'Guest';
        }
      }
      messages.forEach((m) => {
        m.playerName = playerName;
      });

      return NextResponse.json({ success: true, messages, playerName });
    }

    // Admin view: recent messages for conversation list
    const skip = (page - 1) * limit;
    const messages = await supportCollection
      .find(baseQuery)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Enrich with real player names so list never sticks on "Support Agent"
    const emails = Array.from(
      new Set(messages.map((m) => (m.userEmail || '').toLowerCase().trim()).filter(Boolean))
    );
    if (emails.length > 0) {
      const users = await db
        .collection('users')
        .find({ email: { $in: emails } })
        .project({ email: 1, name: 1 })
        .toArray();
      const nameByEmail = {};
      users.forEach((u) => {
        if (u.email) nameByEmail[u.email.toLowerCase().trim()] = (u.name || '').trim();
      });

      for (const msg of messages) {
        const emailKey = (msg.userEmail || '').toLowerCase().trim();
        const isGuest =
          emailKey.includes('@jackpotguest.com') || emailKey.startsWith('guest_');
        if (isGuest) {
          msg.playerName = 'Guest';
          continue;
        }
        const fromDb = nameByEmail[emailKey];
        if (fromDb) {
          msg.playerName = fromDb;
          continue;
        }
        const raw = String(msg.userName || '').trim();
        if (raw && !/^support\s*agent$/i.test(raw) && !/^player$/i.test(raw)) {
          msg.playerName = /^guest(\s*#?\d+)?$/i.test(raw) ? 'Guest' : raw;
        } else {
          msg.playerName = emailKey.split('@')[0] || 'Guest';
        }
      }
    }

    return NextResponse.json({ success: true, messages });
  } catch (err) {
    console.error('Fetch Support Messages Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST new support message (Player or Admin reply)
export async function POST(req) {
  try {
    const { userEmail, userName, message, attachment, senderType, senderEmail } = await req.json();

    if (!userEmail || !senderType) {
      return NextResponse.json({ success: false, message: 'User email and sender type are required.' }, { status: 400 });
    }

    const db = await getDb();
    const supportCollection = db.collection('supportMessages');

    // Look up the player to tag their distributor settings
    const userDoc = await db.collection('users').findOne({ email: userEmail.toLowerCase().trim() });
    const distId = userDoc ? (userDoc.distributorId || '') : '';
    let distType = '';
    let distName = '';

    if (distId) {
      const distributor = await db.collection('distributors').findOne({ id: distId });
      if (distributor) {
        distType = distributor.type || 'A';
        distName = distributor.name || '';
      }
    }

    const newMsg = {
      id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
      userEmail: userEmail.toLowerCase().trim(),
      // Thread identity = player/guest name (never "Support Agent" on admin replies)
      userName: (() => {
        const emailLower = userEmail.toLowerCase().trim();
        const isGuestEmail =
          emailLower.includes('@jackpotguest.com') || emailLower.startsWith('guest_');
        if (isGuestEmail) return 'Guest';
        if (senderType === 'admin') {
          return (userDoc?.name || userName || 'Player').trim() || 'Player';
        }
        const cleaned = String(userName || '').trim();
        if (!cleaned || /^support\s*agent$/i.test(cleaned)) {
          return userDoc?.name || 'Player';
        }
        if (/^guest(\s*#?\d+)?$/i.test(cleaned)) return 'Guest';
        return cleaned;
      })(),
      message: message ? message.trim() : '',
      attachment: attachment || '',
      senderType, // 'player' | 'admin'
      senderEmail: senderEmail ? senderEmail.toLowerCase().trim() : '',
      read: senderType === 'admin', // default to read if admin, unread if player
      timestamp: new Date().toISOString(),
      distributorId: distId,
      distributorType: distType,
      distributorName: distName
    };

    await supportCollection.insertOne(newMsg);

    // Invalidate stats cache
    cache.del('admin_stats');

    if (senderType === 'player') {
      notifyStaffAsync(db, {
        title: 'New Support Message',
        body: `${userName || userEmail}: ${(message || 'Attachment').slice(0, 100)}`,
        url: '/admin',
        tag: `support-${newMsg.id}`
      });
    }

    return NextResponse.json({ success: true, message: newMsg });
  } catch (err) {
    console.error('Create Support Message Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT mark support messages as read
export async function PUT(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, message: 'User email is required.' }, { status: 400 });
    }

    const db = await getDb();
    const supportCollection = db.collection('supportMessages');

    // Update all player messages for this email to read: true
    await supportCollection.updateMany(
      { userEmail: email.toLowerCase().trim(), senderType: 'player', read: false },
      { $set: { read: true } }
    );

    // Invalidate stats cache
    cache.del('admin_stats');

    return NextResponse.json({ success: true, message: 'Messages marked as read.' });
  } catch (err) {
    console.error('Update Support Messages Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

