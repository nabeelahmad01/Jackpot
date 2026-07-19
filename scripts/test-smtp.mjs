/**
 * Diagnose the OTP email transport. First verifies the SMTP connection/auth
 * (no email sent). If an arg email is given, also sends a real test message.
 *
 * Usage:
 *   node scripts/test-smtp.mjs                 # verify only
 *   node scripts/test-smtp.mjs you@email.com   # verify + send test email
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
for (const line of raw.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^'(.*)'$/, '$1');
}

const to = (process.argv[2] || '').trim();
const port = Number(process.env.SMTP_PORT || 465);

console.log(`Host: ${process.env.SMTP_HOST}  Port: ${port}  User: ${process.env.SMTP_USER}`);
console.log(`Pass length: ${(process.env.SMTP_PASS || '').length} chars`);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

try {
  await transporter.verify();
  console.log('\n✅ SMTP verify OK — connection + login succeeded.');
} catch (e) {
  console.log('\n❌ SMTP verify FAILED:');
  console.log(`   ${e.message}`);
  console.log(`   code=${e.code} responseCode=${e.responseCode}`);
  process.exit(1);
}

if (to) {
  try {
    const info = await transporter.sendMail({
      from: `"Jackpot Royals" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Jackpot Royals — SMTP test',
      text: 'This is a test email. If you received it, OTP sending works.'
    });
    console.log(`\n✅ Test email sent to ${to}. messageId=${info.messageId}`);
  } catch (e) {
    console.log(`\n❌ Send failed: ${e.message}`);
  }
}
