import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';
import { healOrphanedDistributorPlayer } from '../../../../lib/orphanDistributorPlayer';
import crypto from 'crypto';

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export async function POST(req) {
  try {
    const { email, name, referredBy, distributorId, agentCode, campaign, deviceId, deviceFingerprint } = await req.json();

    if (!email || !name) {
      return NextResponse.json(
        { success: false, message: 'Google account details missing.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
    const cleanFingerprint = typeof deviceFingerprint === 'string' ? deviceFingerprint.trim() : '';

    const db = await getDb();
    const usersCollection = db.collection('users');

    let matchedUser = await usersCollection.findOne({ email: cleanEmail });
    let isNewUser = false;

    if (matchedUser && matchedUser.status === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, message: 'Your account has been suspended. Please contact customer support.' },
        { status: 403 }
      );
    }

    if (!matchedUser) {
      // Check Device Multi-Account Enforcement for NEW Google registrations
      const settingsDoc = await db.collection('settings').findOne({ id: 'global_settings' });
      const enforceDeviceLock = settingsDoc?.preventDuplicateDeviceAccounts !== false;

      if (enforceDeviceLock && (cleanDeviceId || cleanFingerprint)) {
        const deviceConditions = [];
        if (cleanDeviceId) deviceConditions.push({ deviceId: cleanDeviceId });
        if (cleanFingerprint) deviceConditions.push({ deviceFingerprint: cleanFingerprint });

        if (deviceConditions.length > 0) {
          const existingDeviceAccount = await usersCollection.findOne({
            role: { $in: ['user', 'player', '', null] },
            $or: deviceConditions
          });

          if (existingDeviceAccount) {
            return NextResponse.json(
              {
                success: false,
                deviceRegistered: true,
                existingEmail: existingDeviceAccount.email,
                existingName: existingDeviceAccount.name || '',
                message: 'You already have an account from this device.'
              },
              { status: 400 }
            );
          }
        }
      }

      // Generate a unique referral code
      let referralCode = generateReferralCode();
      while (await usersCollection.findOne({ referralCode })) {
        referralCode = generateReferralCode();
      }

      // Resolve the referrer by referralCode and inherit distributorId/agentCode
      let resolvedReferrer = '';
      let inheritedDistributorId = '';
      let inheritedAgentCode = '';
      if (referredBy && referredBy !== 'null' && referredBy !== 'undefined') {
        const referrer = await usersCollection.findOne({ referralCode: referredBy.trim() });
        if (referrer) {
          resolvedReferrer = referrer.email;
          if (referrer.distributorId) {
            inheritedDistributorId = referrer.distributorId;
          }
          if (referrer.agentCode) {
            inheritedAgentCode = referrer.agentCode;
          }
        }
      }

      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                       req.headers.get('x-real-ip') ||
                       req.headers.get('cf-connecting-ip') ||
                       'unknown';
      const userAgent = req.headers.get('user-agent') || '';

      // Automatically register brand-new Google users
      matchedUser = {
        name: name.trim(),
        email: cleanEmail,
        password: 'OAuth-Google-Login',
        role: 'user',
        coins: 100,
        referralCode,
        referredBy: resolvedReferrer,
        distributorId: (distributorId && distributorId !== 'null' && distributorId !== 'undefined') ? distributorId : (inheritedDistributorId || ''),
        agentCode: (agentCode && agentCode !== 'null' && agentCode !== 'undefined') ? agentCode : (inheritedAgentCode || ''),
        campaign: campaign || 'organic',
        deviceId: cleanDeviceId,
        deviceFingerprint: cleanFingerprint,
        registrationIp: clientIp,
        registrationUserAgent: userAgent,
        createdAt: new Date().toISOString()
      };
      const result = await usersCollection.insertOne(matchedUser);
      matchedUser._id = result.insertedId;
      isNewUser = true;
    } else {
      // Existing user logging in: update deviceId if empty
      if (cleanDeviceId && !matchedUser.deviceId) {
        await usersCollection.updateOne(
          { _id: matchedUser._id },
          { $set: { deviceId: cleanDeviceId, ...(cleanFingerprint ? { deviceFingerprint: cleanFingerprint } : {}) } }
        );
      }
    }

    // Deleted distributor → player stays, but game accounts reset so they can re-request.
    if (!isNewUser) {
      matchedUser = await healOrphanedDistributorPlayer(db, matchedUser);
    }

    return NextResponse.json({
      success: true,
      message: isNewUser ? 'Google account registered successfully!' : 'Welcome back!',
      isNewUser,
      user: { name: matchedUser.name, email: matchedUser.email, role: matchedUser.role, coins: matchedUser.coins || 100, referralCode: matchedUser.referralCode || '', isSubscribed: matchedUser.isSubscribed || false }
    });
  } catch (err) {
    console.error('Google OAuth API Error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error during Google authentication: ' + err.message },
      { status: 500 }
    );
  }
}
