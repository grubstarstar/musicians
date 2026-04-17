export interface MockMember {
  id: number;
  name: string;
}

export interface MockTrack {
  id: number;
  title: string;
  url: string;
  position: number;
}

export interface MockEvent {
  type: "gig" | "rehearsal";
  datetime: Date;
  venue: string;
  doors?: string;
}

export interface MockBandProfile {
  id: string;
  name: string;
  color: string;
  image: string;
  members: MockMember[];
  tracks: MockTrack[];
  events: MockEvent[];
}

export const mockBands: Record<string, MockBandProfile> = {
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "The Skylarks",
    color: "#6c63ff",
    image: "https://picsum.photos/seed/skylarks/800/400",
    members: [
      { id: 1, name: "Rich Garner" },
      { id: 2, name: "Alex Chen" },
      { id: 3, name: "Sam Taylor" },
      { id: 4, name: "Bob Monkhouse" },
      { id: 5, name: "Curtis Mayfield" },
    ],
    tracks: [
      {
        id: 1,
        title: "Morning Light",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        position: 1,
      },
      {
        id: 2,
        title: "Cascade",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        position: 2,
      },
      {
        id: 3,
        title: "Driftwood",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        position: 3,
      },
    ],
    events: [
      { type: "rehearsal", datetime: new Date(2026, 3, 27), venue: "Wicks" },
      { type: "gig", datetime: new Date(2026, 4, 1), venue: "Fox & Firkin", doors: "7pm" },
      { type: "rehearsal", datetime: new Date(2026, 4, 11), venue: "Wicks" },
      { type: "gig", datetime: new Date(2026, 4, 16), venue: "The Lexington", doors: "8pm" },
    ],
  },
  "f47ac10b-58cc-4372-a567-0e02b2c3d479": {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Night Owls",
    color: "#ff6b6b",
    image: "https://picsum.photos/seed/nightowls/800/400",
    members: [
      { id: 4, name: "Jordan Miles" },
      { id: 5, name: "Casey Park" },
      { id: 10, name: "Frankie Valli" },
      { id: 11, name: "Morgan Hayes" },
      { id: 12, name: "Suki Waterhouse" },
      { id: 13, name: "Theo Banks" },
      { id: 14, name: "Nina Kovac" },
    ],
    tracks: [
      {
        id: 4,
        title: "After Hours",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        position: 1,
      },
      {
        id: 5,
        title: "Neon Signs",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
        position: 2,
      },
      {
        id: 10,
        title: "Midnight Static",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
        position: 3,
      },
    ],
    events: [
      { type: "gig", datetime: new Date(2026, 4, 2), venue: "The Lexington", doors: "8pm" },
      { type: "rehearsal", datetime: new Date(2026, 4, 14), venue: "Bakehouse" },
      { type: "gig", datetime: new Date(2026, 4, 21), venue: "The Windmill", doors: "7:30pm" },
      { type: "rehearsal", datetime: new Date(2026, 4, 28), venue: "Bakehouse" },
      { type: "gig", datetime: new Date(2026, 5, 5), venue: "Fox & Firkin", doors: "9pm" },
      { type: "gig", datetime: new Date(2026, 5, 20), venue: "The Dublin Castle", doors: "8pm" },
      { type: "gig", datetime: new Date(2026, 6, 3), venue: "The Shacklewell Arms", doors: "7:30pm" },
      { type: "gig", datetime: new Date(2026, 6, 18), venue: "The Victoria", doors: "9pm" },
    ],
  },
  "9c6d1e2a-3b4f-5a68-87c9-d0e1f2a3b4c5": {
    id: "9c6d1e2a-3b4f-5a68-87c9-d0e1f2a3b4c5",
    name: "Velvet Rum",
    color: "#4caf50",
    image: "https://picsum.photos/seed/velvetrum/800/400",
    members: [
      { id: 6, name: "Robin Lee" },
      { id: 7, name: "Dana Cruz" },
      { id: 8, name: "Rich Garner" },
      { id: 9, name: "Pat Quinn" },
    ],
    tracks: [
      {
        id: 6,
        title: "Slow Burn",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
        position: 1,
      },
      {
        id: 7,
        title: "Copper Wire",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
        position: 2,
      },
      {
        id: 8,
        title: "Last Call",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
        position: 3,
      },
      {
        id: 9,
        title: "Undertow",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
        position: 4,
      },
    ],
    events: [
      { type: "rehearsal", datetime: new Date(2026, 4, 4), venue: "Wicks" },
      { type: "gig", datetime: new Date(2026, 4, 6), venue: "The Dublin Castle", doors: "7:30pm" },
    ],
  },
  "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a": {
    id: "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
    name: "Solar Flare",
    color: "#ff9800",
    image: "https://picsum.photos/seed/solarflare/800/400",
    members: [
      { id: 15, name: "Rich Garner" },
      { id: 16, name: "Lena Okafor" },
      { id: 17, name: "Raj Patel" },
    ],
    tracks: [
      {
        id: 11,
        title: "Heatwave",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
        position: 1,
      },
      {
        id: 12,
        title: "Corona",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3",
        position: 2,
      },
    ],
    events: [
      { type: "rehearsal", datetime: new Date(2026, 4, 7), venue: "Bakehouse" },
      { type: "gig", datetime: new Date(2026, 4, 10), venue: "The Garage", doors: "8pm" },
      { type: "gig", datetime: new Date(2026, 5, 14), venue: "Village Underground", doors: "7:30pm" },
    ],
  },
  "e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b": {
    id: "e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b",
    name: "Pale Blue",
    color: "#03a9f4",
    image: "https://picsum.photos/seed/sunshine42/800/400",
    members: [
      { id: 18, name: "Rich Garner" },
      { id: 19, name: "Yuki Tanaka" },
    ],
    tracks: [
      {
        id: 13,
        title: "Stratosphere",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3",
        position: 1,
      },
    ],
    events: [
      { type: "rehearsal", datetime: new Date(2026, 5, 22), venue: "Wicks" },
      { type: "gig", datetime: new Date(2026, 5, 28), venue: "Moth Club", doors: "8pm" },
    ],
  },
  "f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c": {
    id: "f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c",
    name: "Rust & Bone",
    color: "#8d6e63",
    image: "https://picsum.photos/seed/rustbone/800/400",
    members: [
      { id: 20, name: "Rich Garner" },
      { id: 21, name: "Arlo Finch" },
      { id: 22, name: "Mae Colvin" },
      { id: 23, name: "Jesse Byrd" },
    ],
    tracks: [
      {
        id: 14,
        title: "Iron Lung",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3",
        position: 1,
      },
      {
        id: 15,
        title: "Scrapyard",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3",
        position: 2,
      },
      {
        id: 16,
        title: "Marrow",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3",
        position: 3,
      },
    ],
    events: [
      { type: "gig", datetime: new Date(2026, 4, 24), venue: "The Windmill", doors: "9pm" },
      { type: "rehearsal", datetime: new Date(2026, 5, 29), venue: "Bakehouse" },
      { type: "gig", datetime: new Date(2026, 6, 11), venue: "The Shacklewell Arms", doors: "8pm" },
    ],
  },
  "a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d": {
    id: "a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d",
    name: "Lit. Allusions",
    color: "#c2185b",
    image: "https://picsum.photos/seed/90sindie/800/400",
    members: [
      { id: 24, name: "Tina" },
      { id: 25, name: "Baz" },
      { id: 26, name: "Derek" },
      { id: 27, name: "Andrea" },
      { id: 28, name: "Rich Garner" },
    ],
    tracks: [
      {
        id: 17,
        title: "Paperback Fury",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        position: 1,
      },
      {
        id: 18,
        title: "Footnote",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        position: 2,
      },
      {
        id: 19,
        title: "Dog-Eared",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
        position: 3,
      },
      {
        id: 20,
        title: "Unreliable Narrator",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
        position: 4,
      },
      {
        id: 21,
        title: "Remainder",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
        position: 5,
      },
    ],
    events: [
      { type: "gig", datetime: new Date(2026, 4, 9), venue: "The Montague Arms", doors: "8pm" },
      { type: "rehearsal", datetime: new Date(2026, 4, 18), venue: "Wicks" },
      { type: "gig", datetime: new Date(2026, 4, 30), venue: "The Windmill", doors: "7:30pm" },
      { type: "rehearsal", datetime: new Date(2026, 5, 8), venue: "Wicks" },
      { type: "gig", datetime: new Date(2026, 5, 14), venue: "Rough Trade East", doors: "7pm" },
      { type: "gig", datetime: new Date(2026, 6, 26), venue: "The Lexington", doors: "8:30pm" },
    ],
  },
};
