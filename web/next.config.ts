import type { NextConfig } from "next";
import redirectsData from './data/redirects.json';

const nextConfig: NextConfig = {
  // Disable Turbopack for builds (fixes Next.js 16.1.1 deployment issue)
  turbo: false,
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  async redirects() {
    return redirectsData;
  },
};

export default nextConfig;
