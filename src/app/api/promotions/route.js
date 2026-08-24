import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { sendPromotionPush } from '../../../lib/pushNotifications';

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
    const { title, message, targetGroup, dispatchChannel = 'all', image, promoType, freeplayAmount, bonusPercent } = body;

    if (!title || !message || !targetGroup) {
      return NextResponse.json({ success: false, message: 'Title, message, and target group are required.' }, { status: 400 });
    }

    const channel = ['all', 'push', 'email', 'website'].includes(dispatchChannel) ? dispatchChannel : 'all';

    // Offer type: 'message' (plain announcement, no claim button),
    // 'freeplay' (user picks a game and requests freeplay), or
    // 'deposit_bonus' (arms a bonus % applied to the user's next deposit).
    const type = ['freeplay', 'deposit_bonus'].includes(promoType) ? promoType : 'message';
    const fpAmount = Math.max(0, parseFloat(freeplayAmount) || 0);
    const bPercent = Math.max(0, parseFloat(bonusPercent) || 0);

    if (type === 'freeplay' && fpAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Freeplay offers need a freeplay amount greater than 0.' }, { status: 400 });
    }
    if (type === 'deposit_bonus' && bPercent <= 0) {
      return NextResponse.json({ success: false, message: 'Deposit bonus offers need a bonus percentage greater than 0.' }, { status: 400 });
    }

    const db = await getDb();
    const promotionsCollection = db.collection('promotions');

    const promoObject = {
      id: (Date.now() + Math.floor(Math.random() * 100)).toString(),
      title: title.trim(),
      message: message.trim(),
      targetGroup, // 'all' | 'subscribed' | 'unsubscribed' | 'active'
      dispatchChannel: channel,
      image: image || '',
      promoType: type,
      freeplayAmount: fpAmount,
      bonusPercent: bPercent,
      timestamp: new Date().toISOString()
    };

    // Save to website promo banners collection if channel includes website or all
    if (channel === 'all' || channel === 'website') {
      await promotionsCollection.insertOne(promoObject);
    }

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

    const targetUsers = await db.collection('users').find(userQuery).project({ email: 1 }).toArray();
    const emails = targetUsers.map(u => u.email).filter(Boolean);
    let pushResult = { sent: 0, failed: 0, skipped: true };

    // Send push notification if channel includes push or all
    if (channel === 'all' || channel === 'push') {
      try {
        pushResult = await sendPromotionPush(db, promoObject, emails);
      } catch (pushError) {
        console.error('Promotion push broadcast error:', pushError);
      }
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // Send email broadcast if channel includes email or all
    if ((channel === 'all' || channel === 'email') && emails.length > 0) {
      if (smtpUser && smtpPass) {
        const smtpHost = process.env.SMTP_HOST;
        const transporter = smtpHost
          ? nodemailer.createTransport({
              host: smtpHost,
              port: Number(process.env.SMTP_PORT || 465),
              secure: Number(process.env.SMTP_PORT || 465) === 465,
              auth: { user: smtpUser, pass: smtpPass },
              pool: true,
              maxConnections: 5,
              maxMessages: 100
            })
          : nodemailer.createTransport({
              service: 'gmail',
              auth: { user: smtpUser, pass: smtpPass }
            });

        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://jackpotroyals.com').replace(/\/$/, '');
        let imageHtml = '';
        if (image) {
          if (image.startsWith('data:') || image.startsWith('http')) {
            imageHtml = `<div style="text-align: center; margin-bottom: 25px;"><img src="${image}" alt="Special Promotion Flyer" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid rgba(255,215,0,0.3); box-shadow: 0 8px 25px rgba(0,0,0,0.5);" /></div>`;
          } else {
            const imgSrc = `${siteUrl}${image.startsWith('/') ? '' : '/'}${image}`;
            imageHtml = `<div style="text-align: center; margin-bottom: 25px;"><img src="${imgSrc}" alt="Special Promotion Flyer" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid rgba(255,215,0,0.3); box-shadow: 0 8px 25px rgba(0,0,0,0.5);" /></div>`;
          }
        }

        // Smart plain-text to HTML formatter
        const renderMessageHtml = (rawMessage) => {
          if (!rawMessage) return '';
          const paragraphs = rawMessage.trim().split(/\n\n+/);
          return paragraphs.map(p => {
            const lines = p.split('\n');
            const isList = lines.length > 1 && lines.every(line => /^\s*[\-\*\•\d\.]\s+/.test(line));
            if (isList) {
              const listItems = lines.map(line => {
                const cleanLine = line.replace(/^\s*[\-\*\•\d\.]\s+/, '');
                return `<li style="margin-bottom: 10px; color: #e2e8f0; font-size: 15px; line-height: 1.6;">${cleanLine}</li>`;
              }).join('');
              return `<ul style="background: #121829; border: 1px solid rgba(255, 215, 0, 0.2); border-radius: 12px; padding: 18px 20px 18px 36px; margin: 20px 0;">${listItems}</ul>`;
            } else {
              const formattedText = p.replace(/\n/g, '<br/>');
              return `<p style="margin: 0 0 18px 0; color: #cbd5e1; font-size: 16px; line-height: 1.7;">${formattedText}</p>`;
            }
          }).join('');
        };

        const formattedMessageHtml = renderMessageHtml(message);

        let buttonText = '🚀 CLAIM VIP BONUS & PLAY NOW';
        if (type === 'freeplay' && fpAmount > 0) {
          buttonText = `🚀 CLAIM $${fpAmount} FREEPLAY NOW`;
        } else if (type === 'deposit_bonus' && bPercent > 0) {
          buttonText = `🚀 CLAIM ${bPercent}% DEPOSIT BONUS`;
        }

        const htmlContent = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
              body {
                background-color: #060812;
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
              }
              .wrapper {
                width: 100%;
                background-color: #060812;
                padding: 30px 10px;
              }
              .email-container {
                max-width: 580px;
                margin: 0 auto;
                background: linear-gradient(180deg, #0f1526 0%, #090c17 100%);
                border: 1px solid rgba(255, 215, 0, 0.3);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 50px rgba(0,0,0,0.8);
              }
              .email-header {
                background: linear-gradient(180deg, #141b30 0%, #0f1526 100%);
                padding: 32px 20px 24px 20px;
                text-align: center;
                border-bottom: 1px solid rgba(255, 215, 0, 0.15);
              }
              .brand-crown {
                font-size: 34px;
                line-height: 1;
                display: block;
                margin-bottom: 6px;
              }
              .brand-name {
                color: #ffd700;
                font-size: 28px;
                font-weight: 900;
                letter-spacing: 3px;
                text-transform: uppercase;
                margin: 0;
                text-shadow: 0 0 15px rgba(255, 215, 0, 0.35);
              }
              .brand-tagline {
                color: #94a3b8;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 2px;
                text-transform: uppercase;
                margin: 6px 0 18px 0;
              }
              .vip-badge {
                display: inline-block;
                background: rgba(255, 215, 0, 0.1);
                border: 1px solid #ffd700;
                border-radius: 50px;
                padding: 6px 20px;
                color: #ffd700;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 1.5px;
                text-transform: uppercase;
              }
              .email-body {
                padding: 35px 28px;
              }
              .headline {
                color: #ffffff;
                font-size: 24px;
                font-weight: 800;
                text-align: center;
                margin: 0 0 22px 0;
                line-height: 1.35;
              }
              .cta-container {
                text-align: center;
                margin: 32px 0 16px 0;
              }
              .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #ff9900 0%, #ff5500 100%);
                background-color: #ff8c00;
                color: #000000 !important;
                font-size: 16px;
                font-weight: 900;
                text-decoration: none;
                padding: 16px 36px;
                border-radius: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                box-shadow: 0 8px 25px rgba(255, 140, 0, 0.45);
                border: none;
              }
              .security-badge {
                text-align: center;
                color: #94a3b8;
                font-size: 12px;
                margin-top: 14px;
              }
              .email-footer {
                background-color: #080a14;
                padding: 24px;
                text-align: center;
                font-size: 12px;
                color: #64748b;
                line-height: 1.6;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
              }
              .footer-link {
                color: #94a3b8;
                text-decoration: underline;
              }
            </style>
          </head>
          <body>
            <div class="wrapper">
              <div class="email-container">
                <!-- HEADER -->
                <div class="email-header">
                  <span class="brand-crown">👑</span>
                  <h1 class="brand-name">JACKPOT ROYALS</h1>
                  <div class="brand-tagline">CELESTIAL VEGAS CASINO &amp; INSTANT CASHOUTS</div>
                  <div class="vip-badge">⭐ OFFICIAL VIP INVITATION ⭐</div>
                </div>

                <!-- BODY -->
                <div class="email-body">
                  ${imageHtml}
                  
                  <h2 class="headline">${title}</h2>
                  
                  <div class="message-container">
                    ${formattedMessageHtml}
                  </div>

                  <!-- CTA BUTTON -->
                  <div class="cta-container">
                    <a href="${siteUrl}" class="cta-button">${buttonText}</a>
                    <div class="security-badge">🔒 100% Safe, Secure &amp; Instant Access • No Download Required</div>
                  </div>
                </div>

                <!-- FOOTER -->
                <div class="email-footer">
                  You are receiving this invitation as a valued gamer. To opt out, reply "Unsubscribe".<br/><br/>
                  &copy; 2026 Jackpot Royals Casino • <a href="${siteUrl}" class="footer-link">jackpotroyals.com</a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        // Asynchronous background email delivery loop to all player inboxes
        (async () => {
          let emailSentCount = 0;
          let emailFailCount = 0;

          for (const recipientEmail of emails) {
            try {
              await transporter.sendMail({
                from: `"Jackpot Royals" <${smtpUser}>`,
                to: recipientEmail,
                subject: `🔥 Special Offer: ${title}`,
                html: htmlContent
              });
              emailSentCount++;
            } catch (err) {
              console.error(`Failed to send promo email to ${recipientEmail}:`, err.message);
              emailFailCount++;
            }
          }

          if (transporter.close) transporter.close();
          console.log(`[PROMO EMAIL BROADCAST COMPLETE] Delivered: ${emailSentCount}, Failed: ${emailFailCount}`);
        })();
      } else {
        console.log(`[SMTP SIMULATOR] Broadcasting promo "${title}" to ${emails.length} players:`, emails);
      }
    }

    return NextResponse.json({ success: true, promotion: promoObject, push: pushResult });
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
