/**
 * PM2 process file — keep a SINGLE Node instance.
 * Loads /var/www/Jackpot/.env.local into process env so SMTP/Mongo
 * always match the file (Next won't get stale PM2 env overriding it).
 *
 * Usage on VPS:
 *   cd /var/www/Jackpot
 *   pm2 delete jackpot
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
const fs = require('fs');
const path = require('path');

const cwd = '/var/www/Jackpot';
const envFromFile = {};

try {
  const raw = fs.readFileSync(path.join(cwd, '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip wrapping quotes from nano/paste
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    envFromFile[key] = val;
  }
} catch (err) {
  console.warn('[ecosystem] could not read .env.local:', err.message);
}

module.exports = {
  apps: [
    {
      name: 'jackpot',
      cwd,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '750M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ...envFromFile
      }
    }
  ]
};
