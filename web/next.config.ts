import type { NextConfig } from "next";
import redirectsData from './data/redirects.json';

const nextConfig: NextConfig = {
  experimental: {
    turbo: {
      // Disable Turbopack for production builds
      enabled: false,
    },
  },
  
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
