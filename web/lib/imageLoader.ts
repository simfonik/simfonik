// Custom image loader - routes Next.js Image requests to pre-generated static AVIF files

import manifest from './asset-manifest.json';

const TAPE_WIDTHS = [400, 800, 1200];
const HERO_WIDTHS = [640, 1024, 1920];

// Fallback cache-bust version. Used only when an asset isn't in the
// manifest yet (e.g. dev session before the bake/optimize scripts have
// run). Bumping ASSET_CACHE_VERSION will invalidate every fallback URL
// at once. Surgical invalidation flows through the manifest's
// per-source hashes — bumps shouldn't normally be needed.
export const ASSET_CACHE_VERSION = 4;
const FALLBACK_V = `?v=${ASSET_CACHE_VERSION}`;

const m = manifest as Record<string, string>;

function v(key: string): string {
  const hash = m[key];
  return hash ? `?v=${hash}` : FALLBACK_V;
}

export default function imageLoader({ src, width }: { src: string, width: number }) {
  // Cap width to prevent Lighthouse penalizing for over-serving pixels
  // on high-DPR mobile screens. A 400px image with 3x DPR requests 1200w,
  // which is overkill and destroys LCP scores.
  const optimizedWidth = width > 1024 && width < 1200 ? 800 : width;

  if (src === '/media/site/home-hero.jpg' || src === '/optimized/site/800.webp') {
    const bestWidth = HERO_WIDTHS.find((w) => w >= optimizedWidth) || HERO_WIDTHS[HERO_WIDTHS.length - 1];
    return `/optimized/site/${bestWidth}.avif${v('site/home-hero')}`;
  }

  if (src === '/media/site/recording-setup-cropped.jpg') {
    const bestWidth = TAPE_WIDTHS.find((w) => w >= optimizedWidth) || TAPE_WIDTHS[TAPE_WIDTHS.length - 1];
    return `/optimized/site/about/${bestWidth}.avif${v('site/about')}`;
  }

  if (src.startsWith('/media/tapes/')) {
    const bestWidth = TAPE_WIDTHS.find((w) => w >= optimizedWidth) || TAPE_WIDTHS[TAPE_WIDTHS.length - 1];

    const coverMatch = src.match(/^\/media\/tapes\/([^\/]+)\/cover\.(jpg|jpeg|png)$/i);
    if (coverMatch) {
      const id = coverMatch[1];
      return `/optimized/${id}/${bestWidth}.avif${v(`tapes/${id}/cover`)}`;
    }

    const sideMatch = src.match(/^\/media\/tapes\/([^\/]+)\/sides\/(a|b)\.(jpg|jpeg|png)$/i);
    if (sideMatch) {
      const [, id, ab] = sideMatch;
      return `/optimized/${id}/sides/${ab}/${bestWidth}.avif${v(`tapes/${id}/sides/${ab}`)}`;
    }
  }

  // /generated/ assets (placeholder cassettes, etc.) — manifest key
  // strips the leading slash and file extension.
  if (src.startsWith('/generated/')) {
    const key = src.slice(1).replace(/\.[^./]+$/, '');
    return `${src}${v(key)}`;
  }

  return src;
}
