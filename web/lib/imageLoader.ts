// Custom image loader - routes Next.js Image requests to pre-generated static AVIF files

const TAPE_WIDTHS = [300, 400, 600, 800, 1200];
const HERO_WIDTHS = [400, 640, 800, 1024, 1280, 1920];

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
    const match = src.match(/^\/media\/tapes\/([^\/]+)\/(cover|side-[ab])\.jpg$/);
    if (match) {
      const tapeId = match[1];
      const type = match[2];
      
      // For tape grids, aggressively cap the width since they are small elements
      const maxTapeWidth = optimizedWidth > 640 ? 600 : optimizedWidth;
      const bestWidth = TAPE_WIDTHS.find((w) => w >= maxTapeWidth) || TAPE_WIDTHS[TAPE_WIDTHS.length - 1];
      
      if (type === 'cover') {
        return `/optimized/${tapeId}/${bestWidth}.avif`;
      } else {
        const sidePosition = type === 'side-a' ? 'a' : 'b';
        return `/optimized/${tapeId}/sides/${sidePosition}/${bestWidth}.avif`;
      }
    }
  }

  return src;
}
