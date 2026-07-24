import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { notifyStaffAndDistributorAsync } from '../../../lib/pushNotifications';
import { typeBExclusionFilter } from '../../../lib/typeBDistributors';

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
      baseQuery = await typeBExclusionFilter(db);
    }

    if (email) {
      // Return full conversation history for a specific player
      const skip = (page - 1) * limit;
      const emailKey = email.toLowerCase().trim();

      // Distributor may open a chat even if the player never messaged yet
      if (adminDistributorId) {
        const owner = await db.collection('users').findOne(
          { email: emailKey },
          { projection: { email: 1, name: 1, distributorId: 1, role: 1 } }
        );
        if (!owner || owner.distributorId !== adminDistributorId || (owner.role && owner.role !== 'user')) {
          return NextResponse.json({
            success: false,
            message: 'Player not found under your distributor account.',
            messages: [],
            playerName: ''
          }, { status: 404 });
        }
      }

      // Full thread by email (do not require distributorId on each message)
      const messages = await supportCollection
        .find({ userEmail: emailKey })
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

    // Admin / distributor conversation list — group by player so unread chats
    // are never dropped just because other threads filled a raw message limit.
    const skip = (page - 1) * limit;

    // Treat missing/empty distributorType as non-B (guest + normal players)
    const listMatch = adminDistributorId
      ? { distributorId: adminDistributorId }
      : {
          $or: [
            { distributorType: { $exists: false } },
            { distributorType: null },
            { distributorType: '' },
            { distributorType: { $nin: ['B'] } }
          ]
        };

    const unreadMatch = {
      ...listMatch,
      senderType: 'player',
      read: false
    };

    const [grouped, unreadEmails, totalConversations] = await Promise.all([
      supportCollection
        .aggregate([
          { $match: listMatch },
          { $sort: { timestamp: -1 } },
          {
            $group: {
              _id: { $toLower: { $ifNull: ['$userEmail', ''] } },
              userEmail: { $first: '$userEmail' },
              userName: { $first: '$userName' },
              lastMessage: { $first: '$message' },
              lastAttachment: { $first: '$attachment' },
              timestamp: { $first: '$timestamp' },
              senderType: { $first: '$senderType' },
              unread: {
                $max: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$senderType', 'player'] },
                        { $eq: ['$read', false] }
                      ]
                    },
                    true,
                    false
                  ]
                }
              },
              playerMsgName: {
                $first: {
                  $cond: [{ $eq: ['$senderType', 'player'] }, '$userName', null]
                }
              }
            }
          },
          { $match: { _id: { $ne: '' } } },
          {
            $addFields: {
              unreadRank: { $cond: ['$unread', 0, 1] }
            }
          },
          { $sort: { unreadRank: 1, timestamp: -1 } },
          { $skip: skip },
          { $limit: limit }
        ])
        .toArray(),
      supportCollection.distinct('userEmail', unreadMatch),
      supportCollection
        .aggregate([
          { $match: listMatch },
          { $group: { _id: { $toLower: { $ifNull: ['$userEmail', ''] } } } },
          { $match: { _id: { $ne: '' } } },
          { $count: 'total' }
        ])
        .toArray()
    ]);

    // If an unread thread fell outside this page window, still surface it on page 1
    if (page === 1 && unreadEmails.length > 0) {
      const present = new Set(grouped.map((g) => String(g._id || '').toLowerCase()));
      const missingUnread = unreadEmails
        .map((e) => String(e || '').toLowerCase().trim())
        .filter((e) => e && !present.has(e));

      if (missingUnread.length > 0) {
        const extras = await supportCollection
          .aggregate([
            { $match: { ...listMatch, userEmail: { $in: missingUnread } } },
            { $sort: { timestamp: -1 } },
            {
              $group: {
                _id: { $toLower: { $ifNull: ['$userEmail', ''] } },
                userEmail: { $first: '$userEmail' },
                userName: { $first: '$userName' },
                lastMessage: { $first: '$message' },
                lastAttachment: { $first: '$attachment' },
                timestamp: { $first: '$timestamp' },
                senderType: { $first: '$senderType' },
                unread: { $literal: true },
                playerMsgName: {
                  $first: {
                    $cond: [{ $eq: ['$senderType', 'player'] }, '$userName', null]
                  }
                }
              }
            }
          ])
          .toArray();

        grouped.unshift(...extras);
        grouped.sort((a, b) => {
          if (a.unread && !b.unread) return -1;
          if (!a.unread && b.unread) return 1;
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        });
      }
    }

    const emails = Array.from(
      new Set(grouped.map((g) => String(g.userEmail || '').toLowerCase().trim()).filter(Boolean))
    );

    const nameByEmail = {};
    if (emails.length > 0) {
      const users = await db
        .collection('users')
        .find({ email: { $in: emails } })
        .project({ email: 1, name: 1 })
        .toArray();
      users.forEach((u) => {
        if (u.email) nameByEmail[u.email.toLowerCase().trim()] = (u.name || '').trim();
      });
    }

    const resolvePlayerName = (emailKey, fallbackName) => {
      if (!emailKey) return 'Guest';
      if (emailKey.includes('@jackpotguest.com') || emailKey.startsWith('guest_')) return 'Guest';
      if (nameByEmail[emailKey]) return nameByEmail[emailKey];
      const raw = String(fallbackName || '').trim();
      if (raw && !/^support\s*agent$/i.test(raw) && !/^player$/i.test(raw)) {
        return /^guest(\s*#?\d+)?$/i.test(raw) ? 'Guest' : raw;
      }
      return emailKey.split('@')[0] || 'Guest';
    };

    const conversations = grouped.map((g) => {
      const emailKey = String(g.userEmail || '').toLowerCase().trim();
      const playerName = resolvePlayerName(emailKey, g.playerMsgName || g.userName);
      const preview =
        (g.lastMessage && String(g.lastMessage).trim()) ||
        (g.lastAttachment ? '[Image]' : '');
      return {
        email: emailKey,
        userEmail: emailKey,
        name: playerName,
        playerName,
        lastMessage: preview,
        timestamp: g.timestamp,
        unread: !!g.unread
      };
    });

    // Keep legacy `messages` shape so older clients still group something
    const messages = conversations.map((c) => ({
      id: `conv-${c.email}`,
      userEmail: c.email,
      userName: c.name,
      playerName: c.name,
      message: c.lastMessage,
      timestamp: c.timestamp,
      senderType: c.unread ? 'player' : 'admin',
      read: !c.unread
    }));

    return NextResponse.json({
      success: true,
      conversations,
      messages,
      totalConversations: totalConversations[0]?.total || conversations.length,
      unreadCount: unreadEmails.length
    });
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
      notifyStaffAndDistributorAsync(db, {
        title: 'New Support Message',
        body: `${userName || userEmail}: ${(message || 'Attachment').slice(0, 100)}`,
        url: '/admin',
        tag: `support-${newMsg.id}`,
        alertKind: 'support'
      }, distId);
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

