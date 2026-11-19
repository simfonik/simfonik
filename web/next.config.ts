import type { NextConfig } from "next";
import redirectsData from './data/redirects.json';

// PROTOTYPE (SIM-37). A preview of this branch (lab.simfonik.com is one) is for the Trainspotter pages and
// nothing else: it is a whole copy of the site otherwise, with the live site's database behind it. So on a
// preview every other address goes to the live site, where that page really is, and nothing on the preview
// is for a search engine. What Trainspotter itself is made of (the app's own files, the icons) stays.
const preview = process.env.VERCEL_ENV === 'preview';
const LIVE = 'https://simfonik.com';
const elsewhere = '(?!spot(?:/|$)|proto/trainspotter(?:/|$)|_next/|favicon\\.ico|icon\\.svg|apple-icon\\.png)';
const toLive = preview
  ? [
      { source: '/', destination: `${LIVE}/`, permanent: false },
      // The other experiments on this branch have no page on the live site to go to: its front page, then.
      { source: '/proto/:rest((?!trainspotter(?:/|$)).*)', destination: `${LIVE}/`, permanent: false },
      { source: `/:first(${elsewhere}[^/]+)/:rest*`, destination: `${LIVE}/:first/:rest*`, permanent: false },
    ]
  : [];

const nextConfig: NextConfig = {
  // Read by components/SiteLink.tsx, in the browser as well as on the server.
  env: { NEXT_PUBLIC_LIVE_SITE: preview ? LIVE : '' },
  images: {
    loader: 'custom',
    loaderFile: './lib/imageLoader.ts',
    deviceSizes: [384, 480, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  async headers() {
    return [
      ...(preview ? [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }] : []),
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
      {
        source: '/optimized/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/media/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/generated/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [...toLive, ...redirectsData];
  },
};

export default nextConfig;
