import { MetadataRoute } from 'next';
import { getAllTapes, getAllDJs } from '../lib/data';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://simfonik.com';
  const tapes = getAllTapes();
  const djs = getAllDJs();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/djs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/rights`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Tape pages
  const tapePages: MetadataRoute.Sitemap = tapes.map((tape) => ({
    url: `${baseUrl}/tapes/${tape.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // DJ pages
  const djPages: MetadataRoute.Sitemap = djs.map((dj) => ({
    url: `${baseUrl}/djs/${dj.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...tapePages, ...djPages];
}
