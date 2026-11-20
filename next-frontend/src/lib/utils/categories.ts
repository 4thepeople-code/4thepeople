// Universal Category Resolution & Classification for Clubs and Events

export type CategoryKey = 'ALL' | 'TECHNOLOGY' | 'CULTURAL' | 'SPORTS' | 'ARTS' | 'LITERARY' | 'SOCIAL';

export const DIRECTORY_CATEGORIES: CategoryKey[] = [
  'ALL',
  'TECHNOLOGY',
  'CULTURAL',
  'SPORTS',
  'ARTS',
  'LITERARY',
  'SOCIAL',
];

export const VALID_CATEGORIES: Array<Exclude<CategoryKey, 'ALL'>> = [
  'TECHNOLOGY',
  'CULTURAL',
  'SPORTS',
  'ARTS',
  'LITERARY',
  'SOCIAL',
];

/**
 * Normalizes and infers the primary category of a club based on its explicit category,
 * name, description, and assigned departmental links.
 */
export function getClubCategory(
  club: {
    name?: string | null;
    description?: string | null;
    category?: string | null;
    clubType?: string | null;
    departments?: Array<{ name?: string | null; shortCode?: string | null }> | null;
  } | null | undefined
): Exclude<CategoryKey, 'ALL'> {
  if (!club) return 'TECHNOLOGY';

  // 1. Explicit Category String Matching
  if (club.category) {
    const raw = club.category.toUpperCase().trim();
    for (const cat of VALID_CATEGORIES) {
      if (raw.includes(cat)) return cat;
    }
  }

  const name = (club.name || '').toLowerCase();
  const desc = (club.description || '').toLowerCase();
  const text = `${name} ${desc}`;

  // 2. Keyword matching for known clubs and patterns
  if (
    text.includes('spoorthi') ||
    text.includes('litera') ||
    text.includes('communicat') ||
    text.includes('speak') ||
    text.includes('debate') ||
    text.includes('toastmaster') ||
    text.includes('english') ||
    text.includes('poetry')
  ) {
    return 'LITERARY';
  }

  if (
    text.includes('kruthi') ||
    text.includes('dance') ||
    text.includes('sing') ||
    text.includes('music') ||
    text.includes('instrument') ||
    text.includes('cultur') ||
    text.includes('drama') ||
    text.includes('theatre') ||
    text.includes('band') ||
    text.includes('acoustic')
  ) {
    return 'CULTURAL';
  }

  if (
    text.includes('sport') ||
    text.includes('cricket') ||
    text.includes('football') ||
    text.includes('badminton') ||
    text.includes('basketball') ||
    text.includes('athletics') ||
    text.includes('chess') ||
    text.includes('fitness') ||
    text.includes('kabaddi') ||
    text.includes('gym')
  ) {
    return 'SPORTS';
  }

  if (
    text.includes('art') ||
    text.includes('design') ||
    text.includes('photo') ||
    text.includes('camera') ||
    text.includes('film') ||
    text.includes('media') ||
    text.includes('paint') ||
    text.includes('sketch') ||
    text.includes('drawing')
  ) {
    return 'ARTS';
  }

  if (
    text.includes('prakruthi') ||
    text.includes('saheli') ||
    text.includes('social') ||
    text.includes('nature') ||
    text.includes('environ') ||
    text.includes('eco') ||
    text.includes('women') ||
    text.includes('girl') ||
    text.includes('empower') ||
    text.includes('nss') ||
    text.includes('ncc') ||
    text.includes('community') ||
    text.includes('volunteer') ||
    text.includes('charity') ||
    text.includes('green')
  ) {
    return 'SOCIAL';
  }

  if (
    text.includes('acg') ||
    text.includes('machine learning') ||
    text.includes('code') ||
    text.includes('coding') ||
    text.includes('computer') ||
    text.includes('tech') ||
    text.includes('software') ||
    text.includes('robot') ||
    text.includes('ai') ||
    text.includes('web') ||
    text.includes('data') ||
    text.includes('hack') ||
    text.includes('cloud') ||
    text.includes('iot') ||
    (club.departments && club.departments.length > 0)
  ) {
    return 'TECHNOLOGY';
  }

  return 'TECHNOLOGY';
}

/**
 * Normalizes and infers the category of an event based on its explicit category,
 * title, description, venue/location, and host club.
 */
export function getEventCategory(
  event: {
    title?: string | null;
    description?: string | null;
    category?: string | null;
    venue?: string | null;
    location?: string | null;
    club?: {
      name?: string | null;
      description?: string | null;
      category?: string | null;
    } | null;
  } | null | undefined
): Exclude<CategoryKey, 'ALL'> {
  if (!event) return 'TECHNOLOGY';

  // 1. Explicit Category String Matching
  if (event.category) {
    const raw = event.category.toUpperCase().trim();
    for (const cat of VALID_CATEGORIES) {
      if (raw.includes(cat)) return cat;
    }
  }

  // 2. If event has associated club, check club category
  if (event.club) {
    const clubCat = getClubCategory(event.club);
    const title = (event.title || '').toLowerCase();
    // If club is Cultural, Literary, or Sports, prefer that unless event is strictly a tech workshop
    if (clubCat !== 'TECHNOLOGY') {
      if (!title.includes('hack') && !title.includes('coding')) {
        return clubCat;
      }
    }
  }

  const title = (event.title || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  const loc = (event.location || event.venue || '').toLowerCase();
  const text = `${title} ${desc} ${loc}`;

  if (
    text.includes('dance') ||
    text.includes('music') ||
    text.includes('sing') ||
    text.includes('fest') ||
    text.includes('concert') ||
    text.includes('cultural') ||
    text.includes('drama') ||
    text.includes('kruthi') ||
    text.includes('theatre') ||
    text.includes('dj') ||
    text.includes('stage')
  ) {
    return 'CULTURAL';
  }

  if (
    text.includes('sport') ||
    text.includes('cricket') ||
    text.includes('badminton') ||
    text.includes('football') ||
    text.includes('tournament') ||
    text.includes('match') ||
    text.includes('chess') ||
    text.includes('athletic') ||
    text.includes('marathon')
  ) {
    return 'SPORTS';
  }

  if (
    text.includes('debate') ||
    text.includes('speak') ||
    text.includes('lit') ||
    text.includes('quiz') ||
    text.includes('essay') ||
    text.includes('spoorthi') ||
    text.includes('poetry') ||
    text.includes('symposium') ||
    text.includes('elocution')
  ) {
    return 'LITERARY';
  }

  if (
    text.includes('art') ||
    text.includes('photo') ||
    text.includes('design') ||
    text.includes('exhibition') ||
    text.includes('painting') ||
    text.includes('film') ||
    text.includes('media')
  ) {
    return 'ARTS';
  }

  if (
    text.includes('eco') ||
    text.includes('nature') ||
    text.includes('tree') ||
    text.includes('social') ||
    text.includes('clean') ||
    text.includes('prakruthi') ||
    text.includes('saheli') ||
    text.includes('women') ||
    text.includes('drive') ||
    text.includes('blood') ||
    text.includes('charity')
  ) {
    return 'SOCIAL';
  }

  if (
    text.includes('hack') ||
    text.includes('code') ||
    text.includes('dev') ||
    text.includes('tech') ||
    text.includes('workshop') ||
    text.includes('robot') ||
    text.includes('ai') ||
    text.includes('ml') ||
    text.includes('web') ||
    text.includes('cloud') ||
    text.includes('cyber') ||
    text.includes('data') ||
    text.includes('acg')
  ) {
    return 'TECHNOLOGY';
  }

  if (event.club) {
    return getClubCategory(event.club);
  }

  return 'TECHNOLOGY';
}
