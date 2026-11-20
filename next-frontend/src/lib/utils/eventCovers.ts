// Curated Cover Images & Fallbacks for Campus Events

export const EVENT_CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  technology: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop',
  cultural: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1200&auto=format&fit=crop',
  arts: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=1200&auto=format&fit=crop',
  literary: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop',
  social: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=1200&auto=format&fit=crop',
  default: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=1200&auto=format&fit=crop',
};

export function getEventCoverImage(event: {
  title?: string | null;
  category?: string | null;
  coverImage?: { url?: string | null } | null;
  coverImageUrl?: string | null;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  club?: { name?: string | null; coverImageUrl?: string | null; coverUrl?: string | null; bannerUrl?: string | null; logoUrl?: string | null } | null;
} | null | undefined): string {
  if (!event) return EVENT_CATEGORY_FALLBACK_IMAGES.default;

  const rawCover = event.coverImage?.url || event.coverImageUrl || event.coverUrl || event.bannerUrl;
  if (typeof rawCover === 'string' && rawCover.trim() !== '') {
    return rawCover.trim();
  }

  const title = (event.title || '').toLowerCase();
  const cat = (event.category || '').toLowerCase();
  const club = (event.club?.name || '').toLowerCase();

  if (title.includes('hack') || title.includes('code') || title.includes('dev') || cat.includes('tech') || club.includes('code') || club.includes('acg') || club.includes('robot')) {
    return EVENT_CATEGORY_FALLBACK_IMAGES.technology;
  }
  if (title.includes('dance') || title.includes('music') || title.includes('sing') || title.includes('fest') || cat.includes('cultur') || club.includes('dance') || club.includes('kruthi')) {
    return EVENT_CATEGORY_FALLBACK_IMAGES.cultural;
  }
  if (title.includes('sport') || title.includes('cricket') || title.includes('badminton') || title.includes('football') || cat.includes('sport')) {
    return EVENT_CATEGORY_FALLBACK_IMAGES.sports;
  }
  if (title.includes('art') || title.includes('photo') || title.includes('design') || cat.includes('art')) {
    return EVENT_CATEGORY_FALLBACK_IMAGES.arts;
  }
  if (title.includes('speak') || title.includes('debate') || title.includes('lit') || cat.includes('liter') || club.includes('spoorthi')) {
    return EVENT_CATEGORY_FALLBACK_IMAGES.literary;
  }
  if (title.includes('eco') || title.includes('nature') || title.includes('tree') || cat.includes('social') || club.includes('prakruthi')) {
    return EVENT_CATEGORY_FALLBACK_IMAGES.social;
  }

  return EVENT_CATEGORY_FALLBACK_IMAGES.default;
}

export default getEventCoverImage;
