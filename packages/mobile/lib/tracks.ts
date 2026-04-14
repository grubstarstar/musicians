export const GENRES = ['Jazz', 'Rock', 'Classical', 'Electronic'] as const;
export type Genre = (typeof GENRES)[number];

export type Track = {
  id: string;
  genre: Genre;
  title: string;
  artist: string;
  album: string;
  year: number;
  durationSec: number;
  plays: number;
  rating: number;
  tags: string[];
};

const TITLE_WORDS = [
  'Blue',
  'Midnight',
  'Echoes',
  'Shadows',
  'Golden',
  'Quiet',
  'Silver',
  'Velvet',
  'Hollow',
  'Drifting',
  'Neon',
  'Crimson',
  'Distant',
  'Fragile',
  'Wandering',
];

const ARTIST_FIRST = [
  'Lena',
  'Marcus',
  'Isla',
  'Kenji',
  'Naomi',
  'Otis',
  'Priya',
  'Soren',
  'Theo',
  'Yara',
];

const ARTIST_LAST = [
  'Rowe',
  'Okafor',
  'Fields',
  'Nakamura',
  'Delgado',
  'Byrne',
  'Kapoor',
  'Hollis',
  'Sinclair',
  'Aguilar',
];

const TAG_POOL: Record<Genre, string[]> = {
  Jazz: ['bebop', 'fusion', 'cool', 'modal', 'big band', 'latin', 'vocal'],
  Rock: ['indie', 'garage', 'stadium', 'prog', 'punk', 'grunge', 'psych'],
  Classical: ['baroque', 'romantic', 'chamber', 'solo', 'choral', 'minimal'],
  Electronic: ['ambient', 'techno', 'house', 'idm', 'dnb', 'downtempo'],
};

export const TRACKS_PER_GENRE = 240;

function buildDataset(): Track[] {
  const out: Track[] = [];
  for (const genre of GENRES) {
    const tags = TAG_POOL[genre];
    for (let i = 0; i < TRACKS_PER_GENRE; i++) {
      const title = `${TITLE_WORDS[i % TITLE_WORDS.length]} ${TITLE_WORDS[(i * 3 + 1) % TITLE_WORDS.length]}`;
      const artist = `${ARTIST_FIRST[i % ARTIST_FIRST.length]} ${ARTIST_LAST[(i * 7 + 2) % ARTIST_LAST.length]}`;
      const album = `${TITLE_WORDS[(i * 5 + 4) % TITLE_WORDS.length]} Sessions`;
      out.push({
        id: `${genre}-${i}`,
        genre,
        title,
        artist,
        album,
        year: 1960 + ((i * 13) % 60),
        durationSec: 120 + ((i * 11) % 360),
        plays: 100 + ((i * 173) % 9000),
        rating: 3 + ((i * 17) % 20) / 10,
        tags: [tags[i % tags.length], tags[(i + 1) % tags.length]],
      });
    }
  }
  return out;
}

export const DATASET: Track[] = buildDataset();

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
