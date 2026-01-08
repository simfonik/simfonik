export type DJ = {
    name: string;
    slug: string;
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
  };
  