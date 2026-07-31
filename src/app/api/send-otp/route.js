import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req) {
  try {
    const { email, otp, name } = await req.json();

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // Check if real SMTP configurations are provided
    if (!smtpUser || !smtpPass) {
      console.log(`[SMTP SIMULATOR] Dispatching verification code ${otp} to ${email}`);
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'SMTP credentials not configured. Verification code logged in server console.'
      });
    }

    const smtpHost = process.env.SMTP_HOST;
    const transporter = smtpHost
      ? nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || 465),
          secure: Number(process.env.SMTP_PORT || 465) === 465,
          auth: { user: smtpUser, pass: smtpPass }
        })
      : nodemailer.createTransport({
          service: 'gmail',
          auth: { user: smtpUser, pass: smtpPass }
        });

    // Premium dark-gold themed HTML template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Jackpot Royals Verification Code</title>
        <style>
          body {
            background-color: #030409;
            color: #ffffff;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          .email-container {
            max-width: 500px;
            margin: 40px auto;
            background-color: #0b0c16;
            border: 1px solid #ffd700;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
          }
          .email-header {
            background: linear-gradient(135deg, #111320 0%, #030409 100%);
            padding: 30px;
            text-align: center;
            border-bottom: 1px solid rgba(255, 215, 0, 0.15);
          }
          .logo-text {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: 2px;
            margin: 0;
          }
          .gold-1 { color: #ffd700; }
          .gold-2 { color: #ffa500; }
          .email-body {
            padding: 40px 30px;
            line-height: 1.6;
          }
          .welcome-title {
            font-size: 20px;
            font-weight: 700;
            margin-top: 0;
            color: #ffffff;
          }
          .intro-text {
            color: #b3b4bd;
            font-size: 14px;
            margin-bottom: 30px;
          }
          .otp-card {
            background-color: #030409;
            border: 1px dashed rgba(255, 215, 0, 0.4);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-code {
            font-size: 36px;
            font-weight: 900;
            letter-spacing: 6px;
            color: #ffd700;
            margin: 0;
            font-family: monospace;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.2);
          }
          .warning-text {
            font-size: 11px;
            color: #ef4444;
            margin-top: 10px;
            font-weight: 600;
          }
          .footer-text {
            color: #64748b;
            font-size: 12px;
            text-align: center;
            margin-top: 30px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="email-header">
            <h1 class="logo-text">
              <span class="gold-1">JACKPOT</span><span class="gold-2">ROYALS</span>
            </h1>
          </div>
          <div class="email-body">
            <h2 class="welcome-title">Security Verification Code</h2>
            <p class="intro-text">Hello ${name || 'Player'},<br/><br/>To complete your registration or verify your account, please enter the 6-digit verification code below. This code is valid for 10 minutes.</p>
            
            <div class="otp-card">
              <h3 class="otp-code">${otp}</h3>
              <p class="warning-text">Do not share this code with anyone, including support staff.</p>
            </div>

            <p class="intro-text" style="font-size: 13px;">If you did not request this verification code, please ignore this email or contact support.</p>
            
            <div class="footer-text">
              © 2026 JackpotRoyals.com. All rights reserved.<br/>
              Play Smarter. Cashout Faster.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"Jackpot Royals" <${smtpUser}>`,
      to: email,
      subject: `${otp} is your verification code`,
      text: `Hello ${name || 'Player'},\n\nYour security verification code is: ${otp}\n\nThis code is valid for 10 minutes. Please do not share this code with anyone.\n\nThank you,\nJackpot Royals Team`,
      html: htmlTemplate,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email inbox!'
    });
  } catch (error) {
    console.error('SMTP Email dispatch error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to send verification code. ' + error.message
    }, { status: 500 });
  }
}
