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

export interface MockGig {
  day: string;
  date?: string;
  venue: string;
  doors: string;
}

export interface MockBandProfile {
  id: string;
  name: string;
  color: string;
  members: MockMember[];
  tracks: MockTrack[];
  gigs: MockGig[];
}

export const mockBands: Record<string, MockBandProfile> = {
  "a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "The Skylarks",
    color: "#6c63ff",
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
    gigs: [
      { day: "FRI", date: "May 2", venue: "Fox & Firkin", doors: "7pm" },
      { day: "SAT", date: "May 16", venue: "The Lexington", doors: "8pm" },
    ],
  },
  "f47ac10b-58cc-4372-a567-0e02b2c3d479": {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Night Owls",
    color: "#ff6b6b",
    members: [
      { id: 4, name: "Jordan Miles" },
      { id: 5, name: "Casey Park" },
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
    ],
    gigs: [
      { day: "SAT", date: "May 2", venue: "The Lexington", doors: "8pm" },
      { day: "THU", date: "May 22", venue: "The Windmill", doors: "7:30pm" },
      { day: "FRI", date: "Jun 6", venue: "Fox & Firkin", doors: "9pm" },
    ],
  },
  "9c6d1e2a-3b4f-5a68-87c9-d0e1f2a3b4c5": {
    id: "9c6d1e2a-3b4f-5a68-87c9-d0e1f2a3b4c5",
    name: "Velvet Rum",
    color: "#4caf50",
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
    gigs: [
      {
        day: "WED",
        date: "May 7",
        venue: "The Dublin Castle",
        doors: "7:30pm",
      },
    ],
  },
};
