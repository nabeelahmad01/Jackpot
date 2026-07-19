import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { cache } from '../../../../lib/cache';

// POST — a player claims a promotion offer.
//   - 'deposit_bonus' promos arm a pending bonus on the user so their NEXT
//     approved deposit uses the promo bonus % (and any bundled freeplay is
//     auto-granted after that deposit). This is the only server-side claim;
//     'freeplay' promos are submitted directly as a freeplay transaction by the
//     lobby (exactly like the normal freeplay flow), and 'message' promos have
//     nothing to claim.
export async function POST(req) {
  try {
    const { email, promoId } = await req.json();

    if (!email || !promoId) {
      return NextResponse.json({ success: false, message: 'Email and promotion id are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();

    const promo = await db.collection('promotions').findOne({ id: promoId });
    if (!promo) {
      return NextResponse.json({ success: false, message: 'Promotion not found.' }, { status: 404 });
    }

    if (promo.promoType !== 'deposit_bonus') {
      return NextResponse.json({ success: false, message: 'This offer cannot be claimed here.' }, { status: 400 });
    }

    const user = await db.collection('users').findOne({ email: cleanEmail });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const percent = Math.max(0, parseFloat(promo.bonusPercent) || 0);

    await db.collection('users').updateOne(
      { email: cleanEmail },
      {
        $set: {
          pendingDepositBonusPercent: percent,
          pendingBonusPromoId: promo.id,
          pendingBonusPromoTitle: promo.title || ''
        },
        // Clear any legacy bundled freeplay from an older offer.
        $unset: { pendingBonusFreeplay: '' }
      }
    );

    cache.del('admin_stats');

    return NextResponse.json({
      success: true,
      armed: true,
      bonusPercent: percent,
      message: `Bonus armed! Make a deposit to receive ${percent}% bonus coins.`
    });
  } catch (err) {
    console.error('Claim promotion error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
