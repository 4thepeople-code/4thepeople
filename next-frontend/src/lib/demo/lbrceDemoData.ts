export interface DemoDepartment {
  id: string;
  name: string;
  shortCode: string;
  studentCount: number;
  clubCount: number;
  description: string;
  associatedClubs: string[];
}

export interface DemoStudentProfile {
  name: string;
  email: string;
  rollNumber: string;
  department: string;
  year: string;
  section: string;
  college: string;
  status: string;
  joinedDate: string;
}

export interface DemoTicket {
  ticketId: string;
  eventId: string;
  eventTitle: string;
  clubName: string;
  date: string;
  time: string;
  venue: string;
  status: "CONFIRMED" | "CANCELLED";
  registeredAt: string;
}

export interface DemoManagerClub {
  id: string;
  name: string;
  category: string;
  tagline: string;
  members: number;
  role: string;
  color: string;
  nextEvent: string;
  activeProposals: number;
}

export interface DemoMemberRoster {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  role: "Lead" | "Vice Lead" | "Event Coordinator" | "Core Member" | "Member";
  clubId: string;
  joinedDate: string;
}

export interface DemoAdminOverview {
  totalStudents: number;
  activeClubs: number;
  clubManagers: number;
  eventsThisSemester: number;
  totalRegistrations: number;
  verifiedCheckIns: number;
}

export const LBRCE_DEPARTMENTS: DemoDepartment[] = [
  {
    id: "dept-cse",
    name: "Computer Science & Engineering",
    shortCode: "CSE",
    studentCount: 1240,
    clubCount: 4,
    description: "Centres on software engineering, algorithms, AI/ML, cloud systems and full-stack architecture.",
    associatedClubs: ["RoboRangers", "HackNorth", "Debate Forge"],
  },
  {
    id: "dept-ece",
    name: "Electronics & Communication Engineering",
    shortCode: "ECE",
    studentCount: 960,
    clubCount: 3,
    description: "Hardware synthesis, embedded IoT systems, VLSI signal processing and antenna systems.",
    associatedClubs: ["RoboRangers", "Soundline"],
  },
  {
    id: "dept-aids",
    name: "Artificial Intelligence & Data Science",
    shortCode: "AI & DS",
    studentCount: 420,
    clubCount: 2,
    description: "Predictive analytics, deep neural networks, computer vision and automated intelligence pipelines.",
    associatedClubs: ["HackNorth", "Debate Forge"],
  },
  {
    id: "dept-it",
    name: "Information Technology",
    shortCode: "IT",
    studentCount: 580,
    clubCount: 2,
    description: "Information security, web scaling, enterprise networks and distributed data storage.",
    associatedClubs: ["HackNorth", "Film Cellar"],
  },
  {
    id: "dept-mech",
    name: "Mechanical Engineering",
    shortCode: "MECH",
    studentCount: 520,
    clubCount: 2,
    description: "Thermodynamics, CAD/CAM prototyping, automotive robotics and kinetic machinery.",
    associatedClubs: ["RoboRangers"],
  },
  {
    id: "dept-eee",
    name: "Electrical & Electronics Engineering",
    shortCode: "EEE",
    studentCount: 490,
    clubCount: 2,
    description: "Power grids, electrical drives, green renewable infrastructure and microelectronics.",
    associatedClubs: ["RoboRangers", "Soundline"],
  },
];

export const DEMO_STUDENT_PROFILE: DemoStudentProfile = {
  name: "Priya Sharma",
  email: "priya.s@lbrce.ac.in",
  rollNumber: "22761A0582",
  department: "Computer Science & Engineering",
  year: "3rd Year (B.Tech)",
  section: "CSE - Section B",
  college: "Lakireddy Bali Reddy College of Engineering",
  status: "Enrolled · Active Student",
  joinedDate: "August 2022",
};

export const INITIAL_DEMO_TICKETS: DemoTicket[] = [
  {
    ticketId: "TKT-LBRCE-8921",
    eventId: "e1",
    eventTitle: "RoboRush: Build-a-Bot Finals",
    clubName: "RoboRangers",
    date: "Sat, Nov 14, 2026",
    time: "10:00 AM",
    venue: "Innovation Lab 2",
    status: "CONFIRMED",
    registeredAt: "Nov 02, 2026, 04:12 PM",
  },
  {
    ticketId: "TKT-LBRCE-4412",
    eventId: "e2",
    eventTitle: "Midnight Melody: Fall Concert",
    clubName: "Soundline",
    date: "Sat, Nov 21, 2026",
    time: "7:30 PM",
    venue: "Open-Air Amphitheatre",
    status: "CONFIRMED",
    registeredAt: "Nov 04, 2026, 11:30 AM",
  },
  {
    ticketId: "TKT-LBRCE-3108",
    eventId: "e3",
    eventTitle: "Debate Forge: AI & Ethics",
    clubName: "Debate Forge",
    date: "Wed, Nov 18, 2026",
    time: "6:00 PM",
    venue: "Humanities Hall A",
    status: "CONFIRMED",
    registeredAt: "Nov 06, 2026, 02:45 PM",
  },
];

export const DEMO_MANAGER_CLUBS: DemoManagerClub[] = [
  {
    id: "roborangers",
    name: "RoboRangers",
    category: "Robotics",
    tagline: "Battle bots & midnight builds",
    members: 128,
    role: "Lead Student Organizer",
    color: "#ff7a18",
    nextEvent: "RoboRush: Build-a-Bot Finals",
    activeProposals: 2,
  },
  {
    id: "hacknorth",
    name: "HackNorth",
    category: "Hackathon",
    tagline: "Makers marathons & demo nights",
    members: 97,
    role: "Co-Lead",
    color: "#facc15",
    nextEvent: "HackNorth: 36-Hour Makers Marathon",
    activeProposals: 1,
  },
];

export const DEMO_CLUB_ROSTER: DemoMemberRoster[] = [
  { id: "m1", name: "Rahul Varma", rollNumber: "21761A0540", department: "CSE", role: "Lead", clubId: "roborangers", joinedDate: "Sep 2023" },
  { id: "m2", name: "Ananya Reddy", rollNumber: "22761A0412", department: "ECE", role: "Vice Lead", clubId: "roborangers", joinedDate: "Jan 2024" },
  { id: "m3", name: "Karthik Naidu", rollNumber: "22761A0567", department: "CSE", role: "Event Coordinator", clubId: "roborangers", joinedDate: "Aug 2024" },
  { id: "m4", name: "Suresh Babu", rollNumber: "23761A0304", department: "MECH", role: "Core Member", clubId: "roborangers", joinedDate: "Nov 2024" },
  { id: "m5", name: "Divya Teja", rollNumber: "23761A5421", department: "AI & DS", role: "Member", clubId: "roborangers", joinedDate: "Jan 2025" },
  { id: "m6", name: "Manoj Kumar", rollNumber: "21761A0579", department: "IT", role: "Lead", clubId: "hacknorth", joinedDate: "Aug 2023" },
  { id: "m7", name: "Pooja Sri", rollNumber: "22761A05A1", department: "CSE", role: "Vice Lead", clubId: "hacknorth", joinedDate: "Feb 2024" },
  { id: "m8", name: "Vamsi Krishna", rollNumber: "23761A5418", department: "AI & DS", role: "Event Coordinator", clubId: "hacknorth", joinedDate: "Sep 2024" },
];

export const DEMO_ADMIN_OVERVIEW: DemoAdminOverview = {
  totalStudents: 3420,
  activeClubs: 16,
  clubManagers: 32,
  eventsThisSemester: 28,
  totalRegistrations: 1480,
  verifiedCheckIns: 1120,
};

export const DEMO_AUDIT_LOG = [
  { id: "log-1", text: "Soundline scheduled 'Midnight Melody: Fall Concert' for Nov 21", time: "1 hour ago", type: "event" },
  { id: "log-2", text: "Admin issued manager invite to faculty.advisor@lbrce.ac.in", time: "4 hours ago", type: "invite" },
  { id: "log-3", text: "RoboRangers published roster update (4 new student members verified)", time: "Yesterday", type: "roster" },
  { id: "log-4", text: "HackNorth opened registration queue for '36-Hour Makers Marathon'", time: "2 days ago", type: "event" },
  { id: "log-5", text: "Department of AI & DS affiliated with HackNorth club charter", time: "3 days ago", type: "system" },
];

