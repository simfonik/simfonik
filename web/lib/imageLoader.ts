// Custom image loader - routes Next.js Image requests to pre-generated static AVIF files

const TAPE_WIDTHS = [400, 800, 1200];
const HERO_WIDTHS = [640, 1024, 1920];

export default function imageLoader({ src, width }: { src: string, width: number }) {
  // Cap width to prevent Lighthouse penalizing for over-serving pixels 
  // on high-DPR mobile screens. A 400px image with 3x DPR requests 1200w, 
  // which is overkill and destroys LCP scores.
  const optimizedWidth = width > 1024 && width < 1200 ? 800 : width;

  if (src === '/media/site/home-hero.jpg' || src === '/optimized/site/800.webp') {
    const bestWidth = HERO_WIDTHS.find((w) => w >= optimizedWidth) || HERO_WIDTHS[HERO_WIDTHS.length - 1];
    return `/optimized/site/${bestWidth}.avif`;
  }
  
  if (src.startsWith('/media/tapes/')) {
    const bestWidth = TAPE_WIDTHS.find((w) => w >= optimizedWidth) || TAPE_WIDTHS[TAPE_WIDTHS.length - 1];

    const coverMatch = src.match(/^\/media\/tapes\/([^\/]+)\/cover\.jpg$/);
    if (coverMatch) {
      return `/optimized/${coverMatch[1]}/${bestWidth}.avif`;
    }

    const sideMatch = src.match(/^\/media\/tapes\/([^\/]+)\/sides\/(a|b)\.jpg$/);
    if (sideMatch) {
      return `/optimized/${sideMatch[1]}/sides/${sideMatch[2]}/${bestWidth}.avif`;
    }
  }

  return src;
}
