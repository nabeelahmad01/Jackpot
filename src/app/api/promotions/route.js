import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

// GET active promotions for user or all promotions for admin
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    const db = await getDb();
    const promotionsCollection = db.collection('promotions');

    if (!email) {
      // Admin request — return all promotions
      const promos = await promotionsCollection.find({}).sort({ timestamp: -1 }).toArray();
      return NextResponse.json({ success: true, promotions: promos });
    }

    // Player request — filter target promotions
    const cleanEmail = email.toLowerCase().trim();
    const user = await db.collection('users').findOne({ email: cleanEmail });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const allPromos = await promotionsCollection.find({}).sort({ timestamp: -1 }).toArray();

    // Check if player has successful deposits
    const depositCount = await db.collection('transactions').countDocuments({
      userEmail: cleanEmail,
      type: 'DEPOSIT',
      status: 'SUCCESS'
    });
    const isActivePlayer = depositCount > 0;

    const filtered = allPromos.filter(promo => {
      const tg = (promo.targetGroup || '').toLowerCase();
      if (tg === 'all') return true;
      if (tg === 'subscribed') return !!user.isSubscribed;
      if (tg === 'unsubscribed') return !user.isSubscribed;
      if (tg === 'active') return isActivePlayer;
      return false;
    });

    return NextResponse.json({ success: true, promotions: filtered });
  } catch (err) {
    console.error('Fetch promotions error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

import nodemailer from 'nodemailer';

// POST create/broadcast a promotion
export async function POST(req) {
  try {
    const body = await req.json();
    const { title, message, targetGroup, image } = body;

    if (!title || !message || !targetGroup) {
      return NextResponse.json({ success: false, message: 'Title, message, and target group are required.' }, { status: 400 });
    }

    const db = await getDb();
    const promotionsCollection = db.collection('promotions');

    const promoObject = {
      id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
      title: title.trim(),
      message: message.trim(),
      targetGroup, // 'all' | 'subscribed' | 'unsubscribed' | 'active'
      image: image || '',
      timestamp: new Date().toISOString()
    };

    await promotionsCollection.insertOne(promoObject);

    // Get matching player emails based on the targetGroup
    // Exclude staff/admin roles — only these roles are excluded, everyone else gets the email
    const staffRoles = ['admin', 'operation_admin', 'financial_admin', 'coins_admin', 'support_admin', 'distributor_staff', 'distributor'];
    let userQuery = { role: { $nin: staffRoles } }; // ALL players regardless of subscription or activity

    if (targetGroup === 'subscribed') {
      userQuery.isSubscribed = true;
    } else if (targetGroup === 'unsubscribed') {
      userQuery.isSubscribed = { $ne: true };
    } else if (targetGroup === 'active') {
      const txs = await db.collection('transactions').find({
        type: 'DEPOSIT',
        status: 'SUCCESS'
      }).project({ userEmail: 1 }).toArray();
      const activeEmails = Array.from(new Set(txs.map(t => t.userEmail.toLowerCase().trim())));
      userQuery.email = { $in: activeEmails };
    }
    // When targetGroup === 'all' → NO extra filter → ALL registered players get the email

    const targetUsers = await db.collection('users').find(userQuery).project({ email: 1 }).toArray();
    const emails = targetUsers.map(u => u.email).filter(Boolean);

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (emails.length > 0) {
      if (smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://jackpotroyals.com').replace(/\/$/, '');
        const attachments = [];
        let imageHtml = '';
        if (image) {
          if (image.startsWith('data:')) {
            const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
            if (match) {
              attachments.push({
                filename: 'promo-flyer.png',
                content: Buffer.from(match[2], 'base64'),
                cid: 'promo-flyer',
                contentType: match[1]
              });
              imageHtml = '<img class="promo-image" src="cid:promo-flyer" alt="Special Promotion Flyer" />';
            }
          } else {
            const imgSrc = image.startsWith('http') ? image : `${siteUrl}${image.startsWith('/') ? '' : '/'}${image}`;
            imageHtml = `<img class="promo-image" src="${imgSrc}" alt="Special Promotion Flyer" />`;
          }
        }

        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <style>
              body {
                background-color: #030409;
                color: #ffffff;
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 0;
              }
              .email-container {
                max-width: 600px;
                margin: 40px auto;
                background-color: #0b0c16;
                border: 1px solid #ffd700;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
              }
              .email-header {
                background: linear-gradient(135deg, #ffd700 0%, #b8860b 100%);
                padding: 30px;
                text-align: center;
              }
              .email-header h1 {
                color: #000000;
                margin: 0;
                font-size: 24px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 2px;
              }
              .email-body {
                padding: 40px 30px;
                line-height: 1.6;
                font-size: 16px;
                color: #e2e8f0;
              }
              .promo-image {
                width: 100%;
                max-width: 100%;
                border-radius: 8px;
                margin-bottom: 25px;
                border: 1px solid rgba(255,215,0,0.2);
              }
              .email-body p {
                margin: 0 0 20px 0;
              }
              .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #ffd700 0%, #b8860b 100%);
                color: #000000 !important;
                font-weight: bold;
                text-decoration: none;
                padding: 14px 35px;
                border-radius: 8px;
                text-align: center;
                font-size: 16px;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin: 20px 0;
              }
              .email-footer {
                background-color: #05060b;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #718096;
                border-top: 1px solid rgba(255,255,255,0.05);
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="email-header">
                <h1>JACKPOT ROYALS</h1>
              </div>
              <div class="email-body">
                ${imageHtml}
                <p>Hello Player,</p>
                <h2 style="color: #ffd700; margin-top: 0;">${title}</h2>
                <p style="white-space: pre-wrap;">${message}</p>
                <div style="text-align: center;">
                  <a href="${siteUrl}" class="cta-button">Play Now</a>
                </div>
              </div>
              <div class="email-footer">
                &copy; 2026 Jackpot Royals. All Rights Reserved.<br>
                You received this email because you are a registered player.
              </div>
            </div>
          </body>
          </html>
        `;

        const mailOptions = {
          from: `"Jackpot Royals" <${smtpUser}>`,
          to: smtpUser,
          bcc: emails,
          subject: `🔥 Special Offer: ${title}`,
          html: htmlContent,
          attachments
        };

        transporter.sendMail(mailOptions).catch(err => {
          console.error('Nodemailer promo broadcast error:', err);
        });
      } else {
        console.log(`[SMTP SIMULATOR] Broadcasting promo "${title}" to ${emails.length} players:`, emails);
      }
    }

    return NextResponse.json({ success: true, promotion: promoObject });
  } catch (err) {
    console.error('Create promotion error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE delete a promotion campaign
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Promotion ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const promotionsCollection = db.collection('promotions');

    await promotionsCollection.deleteOne({ id });
    return NextResponse.json({ success: true, message: 'Promotion deleted successfully.' });
  } catch (err) {
    console.error('Delete promotion error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
