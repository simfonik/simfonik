import { MetadataRoute } from 'next';
import { getAllTapes, getAllDJs } from '../lib/data';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://simfonik.com';
  const tapes = getAllTapes();
  const djs = getAllDJs();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl },
    { url: `${baseUrl}/djs` },
    { url: `${baseUrl}/contribute` },
    { url: `${baseUrl}/about` },
    { url: `${baseUrl}/rights` },
  ];

  // Tape pages
  const tapePages: MetadataRoute.Sitemap = tapes.map((tape) => {
    const modDate = tape.last_updated || tape.created_date;
    return {
      url: `${baseUrl}/tapes/${tape.id}`,
      ...(modDate && { lastModified: new Date(modDate).toISOString() }),
    };
  });

  // DJ pages
  const djPages: MetadataRoute.Sitemap = djs.map((dj) => {
    const dates = dj.tapes
      .map((t) => {
        const fullTape = tapes.find((x) => x.id === t.id);
        const modDate = fullTape?.last_updated || fullTape?.created_date;
        return modDate ? new Date(modDate).getTime() : 0;
      })
      .filter((d) => d > 0);

    const lastModified = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : undefined;

    return {
      url: `${baseUrl}/djs/${dj.slug}`,
      ...(lastModified && { lastModified }),
    };
  });

  return [...staticPages, ...tapePages, ...djPages];
}
