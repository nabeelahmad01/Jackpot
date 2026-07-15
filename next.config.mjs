/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // Legacy landing path only — all other routes use real App Router pages
      {
        source: '/agent-player-login',
        destination: '/',
      },
    ];
  }
};

export default nextConfig;
