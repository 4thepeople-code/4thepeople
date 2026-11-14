export type EventStatus = "upcoming" | "live" | "past";

export interface Club {
  id: string;
  name: string;
  category: string;
  tagline: string;
  members: number;
  color: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  clubId: string;
  month: string;
  day: string;
  weekday: string;
  time: string;
  location: string;
  status: EventStatus;
  attendees: number;
  description: string;
  /** ISO start timestamp — drives "Next up" ordering and poster date badges. */
  startAt?: string;
  /** Poster artwork URL. Events without one fall back to a typographic poster. */
  posterUrl?: string;
  posterAlt?: string;
  /** Set by club leads/admins to pin this event into the hero. */
  pinned?: boolean;
  cancelled?: boolean;
}

export interface CollegeStats {
  value: string;
  label: string;
}

export interface College {
  slug: string;
  name: string;
  shortName: string;
  city: string;
  status: "live" | "demo";
  homepageUrl: string;
  tagline: string;
  headline: string;
  season: string;
  accent: string;
  accentSoft: string;
  ink: string;
  stats?: CollegeStats[];
  clubs: Club[];
  events: CampusEvent[];
}

export const colleges: College[] = [
  {
    slug: "lbrce",
    name: "LBRCE",
    shortName: "LBRCE",
    city: "Mylavaram",
    status: "live",
    homepageUrl: "/college/lbrce",
    tagline: "Live on 4 the people — events, registrations and QR check-ins.",
    headline: "THE STUDENTS ARE OUT.",
    season: "Fall 2026",
    accent: "#ff5a3c",
    accentSoft: "#ffe4de",
    ink: "#1c0603",
    clubs: [
      { id: "roborangers", name: "RoboRangers", category: "Robotics", tagline: "Battle bots & midnight builds", members: 128, color: "#ff7a18" },
      { id: "soundline", name: "Soundline", category: "Music", tagline: "Live bands, open mics, vinyl nights", members: 86, color: "#ff4a3d" },
      { id: "debateforge", name: "Debate Forge", category: "Debate", tagline: "Policy, philosophy, loud opinions", members: 64, color: "#7c3aed" },
      { id: "neonmotion", name: "Neon Motion", category: "Dance", tagline: "Hip-hop labs & showcase season", members: 142, color: "#ff4da6" },
      { id: "filmcellar", name: "Film Cellar", category: "Cinema", tagline: "Midnight movies & short-form fests", members: 54, color: "#38bdf8" },
      { id: "hacknorth", name: "HackNorth", category: "Hackathon", tagline: "Makers marathons & demo nights", members: 97, color: "#facc15" },
    ],
    events: [
      { id: "e1", title: "RoboRush: Build-a-Bot Finals", clubId: "roborangers", month: "NOV", day: "14", weekday: "Sat", time: "10:00 AM", location: "Innovation Lab 2", status: "upcoming", attendees: 186, description: "Six teams. One arena. Zero mercy.", startAt: "2026-11-14T10:00:00", posterUrl: "/landing/posters/roborush.svg" },
      { id: "e2", title: "Midnight Melody: Fall Concert", clubId: "soundline", month: "NOV", day: "21", weekday: "Sat", time: "7:30 PM", location: "Open-Air Amphitheatre", status: "upcoming", attendees: 342, description: "Live bands + open mic finale under the stars.", startAt: "2026-11-21T19:30:00" },
      { id: "e3", title: "Debate Forge: AI & Ethics", clubId: "debateforge", month: "NOV", day: "18", weekday: "Wed", time: "6:00 PM", location: "Humanities Hall A", status: "upcoming", attendees: 74, description: "Fast, loud, and gloriously unresolved.", startAt: "2026-11-18T18:00:00" },
      { id: "e4", title: "Neon Nights: Fall Dance Fest", clubId: "neonmotion", month: "DEC", day: "05", weekday: "Fri", time: "9:00 PM", location: "Student Gym", status: "upcoming", attendees: 298, description: "Three hours of choreography, lights and bass.", startAt: "2026-12-05T21:00:00" },
      { id: "e5", title: "Film Cellar: Campus Noir Night", clubId: "filmcellar", month: "NOV", day: "28", weekday: "Sat", time: "8:30 PM", location: "The Black Box", status: "upcoming", attendees: 67, description: "Cult classics, audience voting, zero chill.", startAt: "2026-11-28T20:30:00" },
      { id: "e6", title: "HackNorth: 36-Hour Makers Marathon", clubId: "hacknorth", month: "DEC", day: "12", weekday: "Sat", time: "4:00 PM", location: "Innovation Lab", status: "upcoming", attendees: 154, description: "Build, break, ship — demos at sunrise.", startAt: "2026-12-12T16:00:00" },
    ],
  },
  {
    slug: "northwood",
    name: "Northwood University",
    shortName: "Northwood",
    city: "Northwood",
    status: "demo",
    homepageUrl: "/demo/northwood",
    tagline: "Demo college — explore how 4 the people looks on your campus.",
    headline: "THE STUDENTS ARE OUT.",
    season: "Fall 2026",
    accent: "#ff5a3c",
    accentSoft: "#ffe4de",
    ink: "#1c0603",
    clubs: [
      { id: "roborangers", name: "RoboRangers", category: "Robotics", tagline: "Battle bots & midnight builds", members: 128, color: "#ff7a18" },
      { id: "soundline", name: "Soundline", category: "Music", tagline: "Live bands, open mics, vinyl nights", members: 86, color: "#ff4a3d" },
      { id: "debateforge", name: "Debate Forge", category: "Debate", tagline: "Policy, philosophy, loud opinions", members: 64, color: "#7c3aed" },
      { id: "neonmotion", name: "Neon Motion", category: "Dance", tagline: "Hip-hop labs & showcase season", members: 142, color: "#ff4da6" },
      { id: "filmcellar", name: "Film Cellar", category: "Cinema", tagline: "Midnight movies & short-form fests", members: 54, color: "#38bdf8" },
      { id: "hacknorth", name: "HackNorth", category: "Hackathon", tagline: "Makers marathons & demo nights", members: 97, color: "#facc15" },
    ],
    events: [
      { id: "e1", title: "RoboRush: Build-a-Bot Finals", clubId: "roborangers", month: "NOV", day: "14", weekday: "Sat", time: "10:00 AM", location: "Innovation Lab 2", status: "upcoming", attendees: 186, description: "Six teams. One arena. Zero mercy.", startAt: "2026-11-14T10:00:00", posterUrl: "/landing/posters/roborush.svg" },
      { id: "e2", title: "Midnight Melody: Fall Concert", clubId: "soundline", month: "NOV", day: "21", weekday: "Sat", time: "7:30 PM", location: "Open-Air Amphitheatre", status: "upcoming", attendees: 342, description: "Live bands + open mic finale under the stars.", startAt: "2026-11-21T19:30:00" },
      { id: "e3", title: "Debate Forge: AI & Ethics", clubId: "debateforge", month: "NOV", day: "18", weekday: "Wed", time: "6:00 PM", location: "Humanities Hall A", status: "upcoming", attendees: 74, description: "Fast, loud, and gloriously unresolved.", startAt: "2026-11-18T18:00:00" },
      { id: "e4", title: "Neon Nights: Fall Dance Fest", clubId: "neonmotion", month: "DEC", day: "05", weekday: "Fri", time: "9:00 PM", location: "Student Gym", status: "upcoming", attendees: 298, description: "Three hours of choreography, lights and bass.", startAt: "2026-12-05T21:00:00" },
    ],
  },
  {
    slug: "crestview",
    name: "Crestview College",
    shortName: "Crestview",
    city: "Crestview",
    status: "demo",
    homepageUrl: "/demo/crestview",
    tagline: "Demo college — explore how 4 the people looks on your campus.",
    headline: "WHERE CULTURE LIVES.",
    season: "Fall 2026",
    accent: "#8b5cf6",
    accentSoft: "#eee7fd",
    ink: "#150b2e",
    clubs: [
      { id: "poetryink", name: "Poetry & Ink", category: "Literary", tagline: "Slam nights & zine making", members: 41, color: "#8b5cf6" },
      { id: "synthwave", name: "Synthwave Society", category: "Music", tagline: "Synth nights & production labs", members: 73, color: "#38bdf8" },
      { id: "canvascode", name: "Canvas & Code", category: "Arts", tagline: "Generative art & creative coding", members: 58, color: "#ec4899" },
      { id: "freefolk", name: "Free Speech Forum", category: "Debate", tagline: "Civil argument, maximum volume", members: 39, color: "#facc15" },
      { id: "jazzcollective", name: "Jazz Collective", category: "Music", tagline: "Jam sessions & big band nights", members: 47, color: "#d8ff3e" },
      { id: "theatre", name: "Theatre Guild", category: "Performing", tagline: "Festival theatre & improv", members: 66, color: "#fb923c" },
    ],
    events: [
      { id: "e1", title: "Poetry & Ink: National Slam Qualifier", clubId: "poetryink", month: "NOV", day: "20", weekday: "Tue", time: "7:00 PM", location: "The Black Box", status: "upcoming", attendees: 210, description: "Regional qualifiers + open slam finals.", startAt: "2026-11-20T19:00:00" },
      { id: "e2", title: "Synthwave: Neon Arcade Night", clubId: "synthwave", month: "NOV", day: "27", weekday: "Tue", time: "8:00 PM", location: "Student Union Atrium", status: "upcoming", attendees: 188, description: "Analog synths, arcade cabinets, VHS loops.", startAt: "2026-11-27T20:00:00" },
      { id: "e3", title: "Canvas & Code: Generative Art Jam", clubId: "canvascode", month: "DEC", day: "03", weekday: "Fri", time: "6:00 PM", location: "Art Annex", status: "upcoming", attendees: 52, description: "Algorithms + paint. All mediums welcome.", startAt: "2026-12-03T18:00:00" },
      { id: "e4", title: "Free Speech Forum: Campus Issues", clubId: "freefolk", month: "NOV", day: "25", weekday: "Tue", time: "6:30 PM", location: "Lecture Hall 4", status: "upcoming", attendees: 133, description: "Structured, civil, and surprisingly fun.", startAt: "2026-11-25T18:30:00" },
    ],
  },
  {
    slug: "bellavista",
    name: "Bellavista Institute",
    shortName: "Bellavista",
    city: "Bellavista",
    status: "demo",
    homepageUrl: "/demo/bellavista",
    tagline: "Demo college — explore how 4 the people looks on your campus.",
    headline: "MAKE. MOVE. MAGIC.",
    season: "Fall 2026",
    accent: "#c8f542",
    accentSoft: "#f0fbd0",
    ink: "#131806",
    clubs: [
      { id: "signallab", name: "Signal Lab", category: "Robotics", tagline: "Hardware hacking & drone club", members: 84, color: "#38bdf8" },
      { id: "motionbloom", name: "Motion Bloom", category: "Dance", tagline: "Contemporary & street fusion", members: 59, color: "#ff4da6" },
      { id: "pixelunion", name: "Pixel Union", category: "Gaming", tagline: "Game jams & indie nights", members: 71, color: "#a78bfa" },
      { id: "circuit", name: "Circuit Club", category: "STEM", tagline: "Arduino, electronics & fabrication", members: 93, color: "#facc15" },
      { id: "vocal", name: "Vocal Ink", category: "Music", tagline: "A cappella & beat-making rooms", members: 48, color: "#fb7185" },
      { id: "offset", name: "Offset Press", category: "Art", tagline: "Zines, risograph & print fests", members: 37, color: "#4ade80" },
    ],
    events: [
      { id: "e1", title: "Bellavista Game Jam: 48-Hour Wonder", clubId: "pixelunion", month: "NOV", day: "13", weekday: "Mon", time: "6:00 PM", location: "Maker Space", status: "upcoming", attendees: 96, description: "Theme reveal at dusk. Sleep optional. Dreams guaranteed.", startAt: "2026-11-13T18:00:00", pinned: true },
      { id: "e2", title: "Circuit Club: Soldering & Synth Build", clubId: "circuit", month: "NOV", day: "21", weekday: "Tue", time: "7:00 PM", location: "Workshop 3", status: "upcoming", attendees: 44, description: "Build a pocket synth from scratch.", startAt: "2026-11-21T19:00:00" },
      { id: "e3", title: "Motion Bloom: Fusion Showcase", clubId: "motionbloom", month: "DEC", day: "04", weekday: "Fri", time: "7:00 PM", location: "Performance Hall", status: "upcoming", attendees: 176, description: "Two years of movement, ten minutes of magic.", startAt: "2026-12-04T19:00:00" },
      { id: "e4", title: "Signal Lab: Drone & Robotics Demo", clubId: "signallab", month: "DEC", day: "12", weekday: "Thu", time: "5:30 PM", location: "Lab 2", status: "upcoming", attendees: 88, description: "Fly day + payload workshop.", startAt: "2026-12-12T17:30:00" },
    ],
  },
  {
    slug: "westbrook",
    name: "Westbrook University",
    shortName: "Westbrook",
    city: "Westbrook",
    status: "demo",
    homepageUrl: "/demo/westbrook",
    tagline: "Demo college — explore how 4 the people looks on your campus.",
    headline: "THE WEEKEND HAS OPINIONS.",
    season: "Fall 2026",
    accent: "#ff7a18",
    accentSoft: "#ffede0",
    ink: "#1d0d02",
    clubs: [
      { id: "westhoops", name: "West Hoops", category: "Sports", tagline: "Pickup runs & league play", members: 112, color: "#ff4a3d" },
      { id: "skatecrew", name: "Skate Crew", category: "Sports", tagline: "Park sessions & demo builds", members: 67, color: "#facc15" },
      { id: "trailmix", name: "Trail Mix", category: "Outdoors", tagline: "Hikes, camping & summit nights", members: 39, color: "#4ade80" },
      { id: "nightowl", name: "Night Owl Radio", category: "Media", tagline: "Campus radio & live events", members: 45, color: "#38bdf8" },
      { id: "storyfolk", name: "Storyfolk", category: "Literary", tagline: "Open mics & storytelling circles", members: 28, color: "#fb7185" },
      { id: "beatsquad", name: "Beat Squad", category: "Music", tagline: "Producer cypher & beat battles", members: 52, color: "#a78bfa" },
    ],
    events: [
      { id: "e1", title: "West Hoops: Rivalry Game Night", clubId: "westhoops", month: "NOV", day: "14", weekday: "Sat", time: "7:00 PM", location: "Riverside Arena", status: "upcoming", attendees: 421, description: "Sellout energy expected. Jerseys required.", startAt: "2026-11-14T19:00:00", posterUrl: "/landing/posters/rivalry-night.svg" },
      { id: "e2", title: "Skate Crew: Night Session", clubId: "skatecrew", month: "NOV", day: "20", weekday: "Fri", time: "9:00 PM", location: "Foundry Skate Park", status: "upcoming", attendees: 73, description: "Watches, sessions, demo pileups.", startAt: "2026-11-20T21:00:00" },
      { id: "e3", title: "Beat Squad: Producer Cypher", clubId: "beatsquad", month: "DEC", day: "06", weekday: "Sat", time: "8:00 PM", location: "Studio B", status: "upcoming", attendees: 34, description: "Beat swap cypher — three producers enter, one beat leaves.", startAt: "2026-12-06T20:00:00" },
      { id: "e4", title: "Trail Mix: Summit Night Hike", clubId: "trailmix", month: "DEC", day: "19", weekday: "Sat", time: "6:00 AM", location: "Ridge Trailhead", status: "upcoming", attendees: 58, description: "12km summit push. Hot cocoa at the top.", startAt: "2026-12-19T06:00:00" },
    ],
  },
];

export function getCollege(slug: string): College | undefined {
  return colleges.find((c) => c.slug === slug);
}

export function getClub(college: College, clubId: string): Club | undefined {
  return college.clubs.find((c) => c.id === clubId);
}
