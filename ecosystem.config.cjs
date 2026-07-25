/**
 * PM2 process file — keep a SINGLE Node instance.
 * In-process SSE (adminEvents) + memory cache only work correctly with instances: 1.
 *
 * Usage on VPS:
 *   cd /var/www/Jackpot
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'jackpot',
      cwd: '/var/www/Jackpot',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '750M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
