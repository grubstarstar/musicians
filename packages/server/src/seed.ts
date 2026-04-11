import bcrypt from 'bcrypt';
import { sqlite } from './db.js';

// Seed admin user
const username = 'admin';
const password = 'password123';
const hash = await bcrypt.hash(password, 12);

const userResult = sqlite
  .prepare('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)')
  .run(username, hash);

if (userResult.changes > 0) {
  console.log(`Created user: ${username} / ${password}`);
} else {
  console.log(`User '${username}' already exists — skipped.`);
}

// Seed band images
const bands = sqlite.prepare('SELECT id, name FROM bands').all() as { id: number; name: string }[];

for (const band of bands) {
  const slug = band.name.toLowerCase().replace(/\s+/g, '-');
  const imageUrl = `https://picsum.photos/seed/${slug}/600/400`;
  sqlite.prepare('UPDATE bands SET imageUrl = ? WHERE id = ? AND imageUrl IS NULL').run(imageUrl, band.id);
  console.log(`Set image for band: ${band.name}`);
}

// Seed audio tracks (SoundHelix MP3s)
const trackPool = [
  { title: 'Song One', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'Song Two', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: 'Song Three', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: 'Song Four', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { title: 'Song Five', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
];

const insertTrack = sqlite.prepare(
  'INSERT INTO band_tracks (band_id, title, url, position) VALUES (?, ?, ?, ?)'
);
const existingTracks = sqlite.prepare('SELECT COUNT(*) as count FROM band_tracks WHERE band_id = ?');

for (let i = 0; i < bands.length; i++) {
  const band = bands[i];
  const { count } = existingTracks.get(band.id) as { count: number };
  if (count > 0) {
    console.log(`Band '${band.name}' already has tracks — skipped.`);
    continue;
  }
  const track1 = trackPool[i % trackPool.length];
  const track2 = trackPool[(i + 1) % trackPool.length];
  insertTrack.run(band.id, track1.title, track1.url, 0);
  insertTrack.run(band.id, track2.title, track2.url, 1);
  console.log(`Seeded 2 tracks for band: ${band.name}`);
}
