import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { isSessionRevoked, isProtectedSuperAdminEmail } from '../../../../lib/sessionRevoke';

/**
 * Lightweight live-session check. Clients poll this while logged in;
 * if the account was deleted/suspended, they must clear local session.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = String(searchParams.get('email') || '').toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ success: false, valid: false, message: 'Email required.' }, { status: 400 });
    }

    // Env / legacy super admin is not a DB user — never treat as missing/deleted.
    if (isProtectedSuperAdminEmail(email)) {
      return NextResponse.json({ success: true, valid: true, role: 'admin' });
    }

    if (isSessionRevoked(email)) {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: 'revoked'
      });
    }

    const db = await getDb();

    const deleted = await db.collection('deletedUsers').findOne(
      { email },
      { projection: { email: 1 } }
    );
    if (deleted) {
      return NextResponse.json({ success: true, valid: false, reason: 'deleted' });
    }

    const user = await db.collection('users').findOne(
      { email },
      { projection: { email: 1, role: 1, status: 1 } }
    );

    if (user) {
      if (String(user.status || '').toUpperCase() === 'SUSPENDED') {
        return NextResponse.json({ success: true, valid: false, reason: 'suspended' });
      }
      return NextResponse.json({ success: true, valid: true, role: user.role || 'user' });
    }

    // Distributor owner accounts live in `distributors`, not `users`
    const distributor = await db.collection('distributors').findOne(
      { email },
      { projection: { email: 1, status: 1 } }
    );
    if (distributor) {
      if (String(distributor.status || '').toUpperCase() === 'SUSPENDED') {
        return NextResponse.json({ success: true, valid: false, reason: 'suspended' });
      }
      return NextResponse.json({ success: true, valid: true, role: 'distributor' });
    }

    // Affiliate / agent accounts live in `agents`
    const agent = await db.collection('agents').findOne(
      { email },
      { projection: { email: 1, status: 1 } }
    );
    if (agent) {
      if (String(agent.status || '').toUpperCase() === 'SUSPENDED') {
        return NextResponse.json({ success: true, valid: false, reason: 'suspended' });
      }
      return NextResponse.json({ success: true, valid: true, role: 'agent' });
    }

    return NextResponse.json({ success: true, valid: false, reason: 'missing' });
  } catch (err) {
    console.error('Session status API Error:', err);
    // Fail open on transient errors so a DB blip does not mass-logout staff
    return NextResponse.json({ success: false, valid: true, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
