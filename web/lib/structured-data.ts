import type { Tape, DJ } from '../types/tape';

const BASE_URL = 'https://simfonik.com';

// Helper to generate Person object for a DJ
function generatePersonObject(dj: DJ) {
  // Unknown DJ: name only
  if (dj.slug === 'unknown' || dj.link === false) {
    return {
      '@type': 'Person',
      name: dj.name,
    };
  }
  
  // DJ with page: include @id and url
  return {
    '@type': 'Person',
    '@id': `${BASE_URL}/djs/${dj.slug}#person`,
    name: dj.name,
    url: `${BASE_URL}/djs/${dj.slug}`,
  };
}

// Helper to get MIME type from audio URL
function getEncodingFormat(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'aac':
      return 'audio/aac';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
      return 'audio/mp4';
    default:
      return 'audio/mpeg'; // default fallback
  }
}

export function generateTapeSchema(tape: Tape) {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'MusicPlaylist',
    '@id': `${BASE_URL}/tapes/${tape.id}#playlist`,
    name: tape.title,
    url: `${BASE_URL}/tapes/${tape.id}`,
    mainEntityOfPage: `${BASE_URL}/tapes/${tape.id}`,
    creator: tape.djs.map(generatePersonObject),
    hasPart: tape.sides.map((side, index) => {
      const sidePosition = side.position.toLowerCase();
      const sideNumber = index + 1;
      const audioUrl = side.audio_links[0]?.url; // Use first audio link
      
      const musicRecording: any = {
        '@type': 'MusicRecording',
        '@id': `${BASE_URL}/tapes/${tape.id}#side-${sidePosition}`,
        name: `${tape.title} (Side ${side.position})`,
        position: sideNumber,
        isPartOf: { '@id': `${BASE_URL}/tapes/${tape.id}#playlist` },
        byArtist: (side.djs || tape.djs).map(generatePersonObject),
      };

      // Add audio object
      if (audioUrl) {
        musicRecording.audio = {
          '@type': 'AudioObject',
          contentUrl: audioUrl,
          encodingFormat: getEncodingFormat(audioUrl),
        };
      }

      // Add tracklist if exists for this side
      if (side.tracks && side.tracks.length > 0) {
        musicRecording.track = {
          '@type': 'ItemList',
          itemListOrder: 'ItemListOrderAscending',
          numberOfItems: side.tracks.length,
          itemListElement: side.tracks.map((track, trackIndex) => ({
            '@type': 'ListItem',
            position: trackIndex + 1,
            item: {
              '@type': 'MusicRecording',
              name: `${track.artist} - ${track.title}`,
            },
          })),
        };
      }

      return musicRecording;
    }),
  };

  // Add datePublished if released year exists
  if (tape.released) {
    schema.datePublished = tape.released;
  }

  // Add cover image if exists
  if (tape.images?.cover) {
    schema.image = `${BASE_URL}${tape.images.cover}`;
  }

  // Add description from source if exists
  if (tape.source) {
    schema.description = `Tape source: ${tape.source}`;
  }

  return schema;
}

export function generateDJSchema(dj: { name: string; slug: string }, bio?: string, links?: string[]) {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${BASE_URL}/djs/${dj.slug}#person`,
    name: dj.name,
    url: `${BASE_URL}/djs/${dj.slug}`,
    mainEntityOfPage: `${BASE_URL}/djs/${dj.slug}`,
  };

  // Add bio if exists
  if (bio) {
    schema.description = bio;
  }

  // Add external links if exist
  if (links && links.length > 0) {
    schema.sameAs = links;
  }

  return schema;
}

export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}#website`,
    name: 'simfonik',
    url: BASE_URL,
  };
}
