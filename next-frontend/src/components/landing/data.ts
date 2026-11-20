export interface CollegeInfo {
  slug: string;
  name: string;
  shortName: string;
  city: string;
  status: 'live' | 'demo';
  homepageUrl: string;
  tagline: string;
  description?: string;
}

export interface EventInfo {
  id: string;
  title: string;
  category: 'Tech' | 'Cultural' | 'Sports';
  college: CollegeInfo;
  weekday: string;
  month: string;
  day: string;
  time: string;
  location: string;
  capacity: number;
  attendees: number;
  seatsLeft: number;
}

export const COLLEGES: CollegeInfo[] = [
  {
    slug: 'lbrce',
    name: 'LBRCE',
    shortName: 'LBRCE',
    city: 'Mylavaram',
    status: 'live',
    homepageUrl: '/college/lbrce',
    tagline: 'Live on 4 the people — events, registrations and QR check-ins.',
    description: 'The live LBRCE portal walked end to end — public, student and staff views, no login.',
  },
  {
    slug: 'northwood',
    name: 'Northwood University',
    shortName: 'Northwood',
    city: 'Northwood',
    status: 'demo',
    homepageUrl: '/demo/northwood',
    tagline: 'Demo college — explore how 4 the people looks on your campus.',
    description: 'Robotics, music, dance and debate clubs share one calendar.',
  },
  {
    slug: 'crestview',
    name: 'Crestview College',
    shortName: 'Crestview',
    city: 'Crestview',
    status: 'demo',
    homepageUrl: '/demo/crestview',
    tagline: 'Demo college — explore how 4 the people looks on your campus.',
    description: 'Poetry slams, synth nights and generative art jams.',
  },
  {
    slug: 'bellavista',
    name: 'Bellavista Institute',
    shortName: 'Bellavista',
    city: 'Bellavista',
    status: 'demo',
    homepageUrl: '/demo/bellavista',
    tagline: 'Demo college — explore how 4 the people looks on your campus.',
    description: 'Game jams, synth builds and street-dance fusion.',
  },
  {
    slug: 'westbrook',
    name: 'Westbrook University',
    shortName: 'Westbrook',
    city: 'Westbrook',
    status: 'demo',
    homepageUrl: '/demo/westbrook',
    tagline: 'Demo college — explore how 4 the people looks on your campus.',
    description: 'Rivalry games, skate sessions and summit hikes.',
  },
];

const collegeBySlug = Object.fromEntries(COLLEGES.map((c) => [c.slug, c]));

export const FEATURED_EVENTS: EventInfo[] = [
  {
    id: 'northwood-e1',
    title: 'RoboRush: Build-a-Bot Finals',
    category: 'Tech',
    college: collegeBySlug['northwood'],
    weekday: 'Sat',
    month: 'NOV',
    day: '14',
    time: '10:00 AM',
    location: 'Innovation Lab 2',
    capacity: 200,
    attendees: 186,
    seatsLeft: 14,
  },
  {
    id: 'crestview-e1',
    title: 'Poetry & Ink: Campus Slam',
    category: 'Cultural',
    college: collegeBySlug['crestview'],
    weekday: 'Fri',
    month: 'NOV',
    day: '20',
    time: '7:00 PM',
    location: 'The Black Box',
    capacity: 210,
    attendees: 210,
    seatsLeft: 0,
  },
  {
    id: 'bellavista-e1',
    title: 'Bellavista Game Jam 48',
    category: 'Tech',
    college: collegeBySlug['bellavista'],
    weekday: 'Fri',
    month: 'NOV',
    day: '27',
    time: '5:00 PM',
    location: 'Lab 3 & Discord',
    capacity: 100,
    attendees: 96,
    seatsLeft: 4,
  },
  {
    id: 'westbrook-e1',
    title: 'West Hoops Rivalry Match',
    category: 'Sports',
    college: collegeBySlug['westbrook'],
    weekday: 'Sat',
    month: 'NOV',
    day: '21',
    time: '6:00 PM',
    location: 'University Arena',
    capacity: 450,
    attendees: 421,
    seatsLeft: 29,
  },
  {
    id: 'northwood-e2',
    title: 'Midnight Melody: Fall Concert',
    category: 'Cultural',
    college: collegeBySlug['northwood'],
    weekday: 'Sat',
    month: 'NOV',
    day: '21',
    time: '7:30 PM',
    location: 'Open-Air Amphitheatre',
    capacity: 342,
    attendees: 342,
    seatsLeft: 0,
  },
  {
    id: 'crestview-e2',
    title: 'Synthwave & Generative Art',
    category: 'Cultural',
    college: collegeBySlug['crestview'],
    weekday: 'Thu',
    month: 'NOV',
    day: '26',
    time: '6:30 PM',
    location: 'Studio 4B',
    capacity: 200,
    attendees: 188,
    seatsLeft: 12,
  },
  {
    id: 'northwood-e6',
    title: 'HackNorth: 36-Hour Makers Marathon',
    category: 'Tech',
    college: collegeBySlug['northwood'],
    weekday: 'Sat',
    month: 'DEC',
    day: '12',
    time: '4:00 PM',
    location: 'Innovation Lab',
    capacity: 200,
    attendees: 154,
    seatsLeft: 46,
  },
  {
    id: 'bellavista-e2',
    title: 'Circuit Benders & Modular Synth',
    category: 'Tech',
    college: collegeBySlug['bellavista'],
    weekday: 'Wed',
    month: 'NOV',
    day: '18',
    time: '4:30 PM',
    location: 'Hardware Loft',
    capacity: 50,
    attendees: 44,
    seatsLeft: 6,
  },
  {
    id: 'westbrook-e2',
    title: 'Twilight Skate & Track Meet',
    category: 'Sports',
    college: collegeBySlug['westbrook'],
    weekday: 'Sun',
    month: 'NOV',
    day: '22',
    time: '4:00 PM',
    location: 'Outdoor Bowl',
    capacity: 80,
    attendees: 73,
    seatsLeft: 7,
  },
  {
    id: 'westbrook-e3',
    title: 'Peak District Trail Summit',
    category: 'Sports',
    college: collegeBySlug['westbrook'],
    weekday: 'Sat',
    month: 'DEC',
    day: '05',
    time: '7:00 AM',
    location: 'Base Camp Bus Bay',
    capacity: 40,
    attendees: 34,
    seatsLeft: 6,
  },
];
