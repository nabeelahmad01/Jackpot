/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  // output: 'export',
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // Lobby routes rewrite to '/'
      {
        source: '/lobby',
        destination: '/',
      },
      {
        source: '/lobby/referrals',
        destination: '/',
      },
      {
        source: '/lobby/game/:title',
        destination: '/',
      },
      {
        source: '/login',
        destination: '/',
      },
      {
        source: '/register',
        destination: '/',
      },
      {
        source: '/forgot',
        destination: '/',
      },
      // Admin dashboard sub-routes rewrite to '/admin'
      {
        source: '/admin/:tab',
        destination: '/admin',
      },
      // Distributor dashboard sub-routes rewrite to '/distributor'
      {
        source: '/distributor/:tab',
        destination: '/distributor',
      },
      // Affiliate agent portal sub-routes rewrite to '/affiliate'
      {
        source: '/affiliate/:tab',
        destination: '/affiliate',
      },
      // Agent player login landing
      {
        source: '/agent-player-login',
        destination: '/',
      },
      // Staff dashboards
      {
        source: '/boss/:tab',
        destination: '/boss',
      },
      {
        source: '/coins-staff/:tab',
        destination: '/coins-staff',
      },
      {
        source: '/finance/:tab',
        destination: '/finance',
      },
      {
        source: '/operations/:tab',
        destination: '/operations',
      },
      {
        source: '/support-staff/:tab',
        destination: '/support-staff',
      },
    ];
  }
};

export default nextConfig;
