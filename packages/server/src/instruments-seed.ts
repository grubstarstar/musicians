// MUS-68: canonical instruments taxonomy.
//
// Inlined as a constant here rather than a JSON file so the build pipeline
// doesn't need to bundle a separate asset. The seed script and the
// migration backfill both read from this list — keeping one source of
// truth prevents drift between the two.
//
// Naming rules (be opinionated to minimise taxonomy fragmentation):
//   - Use the most common Australian/international name for each instrument.
//   - Prefer one-word names where natural ("Drums", "Guitar") and qualified
//     names only where disambiguation matters ("Bass Guitar" vs. "Double
//     Bass", "Electric Guitar" only as needed — "Guitar" implicitly covers
//     acoustic + electric for this slice).
//   - Categories are free-text strings (not an enum) so new groupings can
//     be added by seed without a migration.
//
// Every row has a non-null category EXCEPT the canonical "Other" row, which
// deliberately has a null category — it's the catch-all for inputs the
// client can't resolve against the taxonomy, not a real instrument.

export interface InstrumentSeedRow {
  name: string;
  category: string | null;
}

export const OTHER_INSTRUMENT_NAME = 'Other';

export const instrumentSeed: InstrumentSeedRow[] = [
  // --- Strings ---
  { name: 'Guitar', category: 'strings' },
  { name: 'Acoustic Guitar', category: 'strings' },
  { name: 'Electric Guitar', category: 'strings' },
  { name: 'Classical Guitar', category: 'strings' },
  { name: '12-String Guitar', category: 'strings' },
  { name: 'Bass Guitar', category: 'strings' },
  { name: 'Double Bass', category: 'strings' },
  { name: 'Violin', category: 'strings' },
  { name: 'Viola', category: 'strings' },
  { name: 'Cello', category: 'strings' },
  { name: 'Banjo', category: 'strings' },
  { name: 'Mandolin', category: 'strings' },
  { name: 'Ukulele', category: 'strings' },
  { name: 'Harp', category: 'strings' },
  { name: 'Lap Steel Guitar', category: 'strings' },
  { name: 'Pedal Steel Guitar', category: 'strings' },
  { name: 'Dobro', category: 'strings' },
  { name: 'Resonator Guitar', category: 'strings' },
  { name: 'Sitar', category: 'strings' },
  { name: 'Bouzouki', category: 'strings' },
  { name: 'Balalaika', category: 'strings' },
  { name: 'Oud', category: 'strings' },
  { name: 'Lute', category: 'strings' },
  { name: 'Harpsichord', category: 'strings' },
  { name: 'Hammered Dulcimer', category: 'strings' },
  { name: 'Appalachian Dulcimer', category: 'strings' },
  { name: 'Autoharp', category: 'strings' },
  { name: 'Charango', category: 'strings' },
  { name: 'Erhu', category: 'strings' },
  { name: 'Koto', category: 'strings' },
  { name: 'Shamisen', category: 'strings' },
  { name: 'Saz', category: 'strings' },
  { name: 'Pipa', category: 'strings' },
  { name: 'Nyckelharpa', category: 'strings' },

  // --- Keyboards (grouped under keyboards for taxonomy clarity) ---
  { name: 'Piano', category: 'keyboards' },
  { name: 'Keyboard', category: 'keyboards' },
  { name: 'Electric Piano', category: 'keyboards' },
  { name: 'Synthesizer', category: 'keyboards' },
  { name: 'Organ', category: 'keyboards' },
  { name: 'Hammond Organ', category: 'keyboards' },
  { name: 'Pipe Organ', category: 'keyboards' },
  { name: 'Accordion', category: 'keyboards' },
  { name: 'Melodica', category: 'keyboards' },
  { name: 'Rhodes', category: 'keyboards' },
  { name: 'Wurlitzer', category: 'keyboards' },
  { name: 'Mellotron', category: 'keyboards' },
  { name: 'Clavinet', category: 'keyboards' },
  { name: 'Harmonium', category: 'keyboards' },

  // --- Percussion ---
  { name: 'Drums', category: 'percussion' },
  { name: 'Snare Drum', category: 'percussion' },
  { name: 'Bass Drum', category: 'percussion' },
  { name: 'Bongos', category: 'percussion' },
  { name: 'Congas', category: 'percussion' },
  { name: 'Cajón', category: 'percussion' },
  { name: 'Djembe', category: 'percussion' },
  { name: 'Tambourine', category: 'percussion' },
  { name: 'Cymbals', category: 'percussion' },
  { name: 'Hi-Hat', category: 'percussion' },
  { name: 'Ride Cymbal', category: 'percussion' },
  { name: 'Crash Cymbal', category: 'percussion' },
  { name: 'Timpani', category: 'percussion' },
  { name: 'Xylophone', category: 'percussion' },
  { name: 'Marimba', category: 'percussion' },
  { name: 'Vibraphone', category: 'percussion' },
  { name: 'Glockenspiel', category: 'percussion' },
  { name: 'Triangle', category: 'percussion' },
  { name: 'Cowbell', category: 'percussion' },
  { name: 'Maracas', category: 'percussion' },
  { name: 'Shaker', category: 'percussion' },
  { name: 'Claves', category: 'percussion' },
  { name: 'Castanets', category: 'percussion' },
  { name: 'Tabla', category: 'percussion' },
  { name: 'Darbuka', category: 'percussion' },
  { name: 'Frame Drum', category: 'percussion' },
  { name: 'Bodhrán', category: 'percussion' },
  { name: 'Wood Block', category: 'percussion' },
  { name: 'Steel Pan', category: 'percussion' },
  { name: 'Hang Drum', category: 'percussion' },
  { name: 'Udu', category: 'percussion' },
  { name: 'Taiko', category: 'percussion' },

  // --- Wind (woodwind) ---
  { name: 'Saxophone', category: 'wind' },
  { name: 'Alto Saxophone', category: 'wind' },
  { name: 'Tenor Saxophone', category: 'wind' },
  { name: 'Soprano Saxophone', category: 'wind' },
  { name: 'Baritone Saxophone', category: 'wind' },
  { name: 'Flute', category: 'wind' },
  { name: 'Piccolo', category: 'wind' },
  { name: 'Clarinet', category: 'wind' },
  { name: 'Bass Clarinet', category: 'wind' },
  { name: 'Oboe', category: 'wind' },
  { name: 'English Horn', category: 'wind' },
  { name: 'Bassoon', category: 'wind' },
  { name: 'Contrabassoon', category: 'wind' },
  { name: 'Recorder', category: 'wind' },
  { name: 'Tin Whistle', category: 'wind' },
  { name: 'Harmonica', category: 'wind' },
  { name: 'Bagpipes', category: 'wind' },
  { name: 'Didgeridoo', category: 'wind' },
  { name: 'Pan Flute', category: 'wind' },
  { name: 'Ocarina', category: 'wind' },
  { name: 'Shakuhachi', category: 'wind' },
  { name: 'Duduk', category: 'wind' },
  { name: 'Kaval', category: 'wind' },
  { name: 'Launeddas', category: 'wind' },

  // --- Brass ---
  { name: 'Trumpet', category: 'brass' },
  { name: 'Cornet', category: 'brass' },
  { name: 'Flugelhorn', category: 'brass' },
  { name: 'Trombone', category: 'brass' },
  { name: 'Bass Trombone', category: 'brass' },
  { name: 'French Horn', category: 'brass' },
  { name: 'Tuba', category: 'brass' },
  { name: 'Euphonium', category: 'brass' },
  { name: 'Sousaphone', category: 'brass' },
  { name: 'Baritone Horn', category: 'brass' },
  { name: 'Mellophone', category: 'brass' },
  { name: 'Bugle', category: 'brass' },
  { name: 'Alphorn', category: 'brass' },
  { name: 'Shofar', category: 'brass' },

  // --- Voice ---
  { name: 'Vocals', category: 'voice' },
  { name: 'Lead Vocals', category: 'voice' },
  { name: 'Backing Vocals', category: 'voice' },
  { name: 'Soprano', category: 'voice' },
  { name: 'Mezzo-Soprano', category: 'voice' },
  { name: 'Alto', category: 'voice' },
  { name: 'Tenor', category: 'voice' },
  { name: 'Baritone', category: 'voice' },
  { name: 'Bass', category: 'voice' },
  { name: 'Beatbox', category: 'voice' },
  { name: 'Rap', category: 'voice' },
  { name: 'MC', category: 'voice' },
  { name: 'Spoken Word', category: 'voice' },
  { name: 'Throat Singing', category: 'voice' },
  { name: 'Yodel', category: 'voice' },

  // --- Electronic / production ---
  { name: 'DJ', category: 'electronic' },
  { name: 'Turntables', category: 'electronic' },
  { name: 'Sampler', category: 'electronic' },
  { name: 'Drum Machine', category: 'electronic' },
  { name: 'Modular Synthesizer', category: 'electronic' },
  { name: 'Analog Synthesizer', category: 'electronic' },
  { name: 'Digital Synthesizer', category: 'electronic' },
  { name: 'Sequencer', category: 'electronic' },
  { name: 'Launchpad', category: 'electronic' },
  { name: 'MPC', category: 'electronic' },
  { name: 'Theremin', category: 'electronic' },
  { name: 'Vocoder', category: 'electronic' },
  { name: 'Talkbox', category: 'electronic' },
  { name: 'Laptop', category: 'electronic' },
  { name: 'Ableton Live', category: 'electronic' },
  { name: 'Loop Station', category: 'electronic' },
  { name: 'Granular Synth', category: 'electronic' },

  // --- Catch-all. Must stay with a null category — production code detects
  // the "Other" row by its unique name (see `getOtherInstrumentId`).
  { name: OTHER_INSTRUMENT_NAME, category: null },
];
