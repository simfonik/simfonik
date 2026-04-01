export type DJ = {
  name: string;
  slug: string;
  link?: boolean;
  aka?: { name: string; slug: string }[];
};

export type TapeImages = {
  cover?: string;
};

export type AudioLink = {
  label: string;
  url: string;
};

export type Track = {
  artist: string;
  title: string;
  duration?: string;
  discogs_url?: string;
};

export type Side = {
  position: string;
  title?: string;
  djs?: DJ[];
  audio_links: AudioLink[];
  image?: string;
  tracks?: Track[];
};

export type Tape = {
  id: string;
  title: string;
  released: string; // recommend YYYY-MM-DD in sample data for consistent sorting
  djs: DJ[];
  images?: TapeImages;
  sides: Side[];
  source?: string; // Name of person/entity who contributed the tape
  source_url?: string; // URL for the source (e.g. YouTube channel, website)
  created_date?: string; // ISO datetime when the tape was added to the archive (YYYY-MM-DDTHH:MM:SS)
  last_updated?: string; // ISO datetime when tape data was significantly edited
};

/** Lightweight subset of Tape used to prevent massive 230KB JSON RSC payloads to client components */
export type TapeListSubset = Pick<Tape, 'id' | 'title' | 'released' | 'djs'> & { images?: TapeImages };

export type ArchivedComment = {
  author: string;
  date: string; // YYYY-MM-DD
  content: string;
  source_post?: string; // For consolidated tapes (circa-92, circa-94)
  source_title?: string; // Original WordPress post title
};
