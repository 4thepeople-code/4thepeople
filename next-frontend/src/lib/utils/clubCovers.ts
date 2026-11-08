// Curated Unsplash Demo Cover Images & Metadata for Campus Clubs

export interface DemoClubImage {
  key: string;
  name: string;
  subtitle: string;
  category: string;
  description: string;
  coverUrl: string;
  altCoverUrl: string;
  logoUrl: string;
}

export const CLUB_DEMO_IMAGES: Record<string, DemoClubImage> = {
  spoorthi: {
    key: 'spoorthi',
    name: 'Spoorthi',
    subtitle: 'Literature & Communication Skills Club',
    category: 'Literature & Public Speaking',
    description: 'Literature, public speaking, creative writing, debating, and communication skills club.',
    coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop',
    altCoverUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1200&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=400&auto=format&fit=crop',
  },
  kruthi: {
    key: 'kruthi',
    name: 'Kruthi',
    subtitle: 'Dance, Singing & Instruments Club',
    category: 'Cultural & Performing Arts',
    description: 'Dance, vocal & instrumental music, stage performances, and creative acoustic arts.',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    altCoverUrl: 'https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=1200&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=400&auto=format&fit=crop',
  },
  prakruthi: {
    key: 'prakruthi',
    name: 'Prakruthi',
    subtitle: 'Nature & Environment Club',
    category: 'Nature & Environmental Conservation',
    description: 'Environmental conservation, nature trails, tree plantation drives, forest walks, and eco-sustainability.',
    coverUrl: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=1200&auto=format&fit=crop',
    altCoverUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1200&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1511497584788-8767611136f6?q=80&w=400&auto=format&fit=crop',
  },
  acg: {
    key: 'acg',
    name: 'ACG',
    subtitle: 'Computer Science & Coding Club',
    category: 'Computer Science & Software',
    description: 'Computer science, competitive programming, web development, hackathons, and software engineering.',
    coverUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop',
    altCoverUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=400&auto=format&fit=crop',
  },
  saheli: {
    key: 'saheli',
    name: 'Saheli',
    subtitle: "Girls' Community & Empowerment Club",
    category: 'Women Empowerment & Leadership',
    description: "Women empowerment, leadership forums, wellness workshops, peer mentoring, and girls' community network.",
    coverUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1200&auto=format&fit=crop',
    altCoverUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1200&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=400&auto=format&fit=crop',
  },
  machine_learning: {
    key: 'machine_learning',
    name: 'Machine Learning Club',
    subtitle: 'Artificial Intelligence & Data Science Club',
    category: 'Artificial Intelligence & Machine Learning',
    description: 'Neural networks, computer vision, NLP, generative AI models, data analytics, and machine learning research.',
    coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop',
    altCoverUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?q=80&w=1200&auto=format&fit=crop',
    logoUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?q=80&w=400&auto=format&fit=crop',
  },
};

/**
 * Returns a high-res demo Unsplash cover image based on the club or club's name.
 */
export const getClubCoverImage = (club: { name?: string; coverImage?: { url?: string | null } | null; coverUrl?: string | null; bannerUrl?: string | null; logoUrl?: string | null; logo?: { url?: string | null } | null } | string | null | undefined): string => {
  const clubName = typeof club === 'string' ? club : club?.name;
  const rawCover = typeof club === 'object' && club !== null
    ? (club.coverImage?.url || club.coverUrl || club.bannerUrl || club.logoUrl || club.logo?.url)
    : null;

  // If a real custom Cloudinary upload exists, use it
  if (typeof rawCover === 'string' && rawCover.includes('cloudinary.com')) {
    return rawCover;
  }

  // Always match by club name for curated demo imagery
  if (clubName) {
    const lower = clubName.toLowerCase().trim();

    if (lower.includes('prakruthi') || lower.includes('nature') || lower.includes('environ') || lower.includes('eco')) {
      return CLUB_DEMO_IMAGES.prakruthi.coverUrl;
    }
    if (lower.includes('kruthi') || lower.includes('dance') || lower.includes('sing') || lower.includes('instrument') || lower.includes('music')) {
      return CLUB_DEMO_IMAGES.kruthi.coverUrl;
    }
    if (lower.includes('spoorthi') || lower.includes('literat') || lower.includes('communicat')) {
      return CLUB_DEMO_IMAGES.spoorthi.coverUrl;
    }
    if (lower.includes('acg') || lower.includes('computer') || lower.includes('code') || lower.includes('software')) {
      return CLUB_DEMO_IMAGES.acg.coverUrl;
    }
    if (lower.includes('saheli') || lower.includes('girl') || lower.includes('women')) {
      return CLUB_DEMO_IMAGES.saheli.coverUrl;
    }
    if (lower.includes('machine learning') || lower.includes('ml') || lower.includes('ai') || lower.includes('intelligence')) {
      return CLUB_DEMO_IMAGES.machine_learning.coverUrl;
    }
  }

  if (typeof rawCover === 'string' && rawCover.startsWith('http')) {
    return rawCover;
  }

  return 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=1200&auto=format&fit=crop';
};

export default getClubCoverImage;

