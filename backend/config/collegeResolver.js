const { prisma } = require('./internalClient');

// In-memory cache for resolved college records: slug -> { isNegative, college, cachedAt }
const collegeCache = new Map();
const POSITIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL for valid colleges
const NEGATIVE_CACHE_TTL_MS = 60 * 1000; // 60 seconds negative-cache TTL for unknown slugs

/**
 * Checks whether a slug is currently present in memory cache (positive or negative)
 * and has not expired.
 *
 * @param {string} slug
 * @returns {boolean} true if cache hit (no DB lookup needed), false if DB query needed.
 */
function isSlugCached(slug) {
  if (!slug || typeof slug !== 'string') return false;
  const normalizedSlug = slug.trim().toLowerCase();
  const entry = collegeCache.get(normalizedSlug);
  if (!entry) return false;

  const ttl = entry.isNegative ? NEGATIVE_CACHE_TTL_MS : POSITIVE_CACHE_TTL_MS;
  return Date.now() - entry.cachedAt < ttl;
}

/**
 * Resolves a college record by its unique slug.
 * Since the colleges table is a platform directory table without RLS,
 * app_user can read it directly.
 *
 * Implements negative caching for unknown slugs (~60s TTL) to prevent
 * repeated database lookups for non-existent colleges.
 *
 * @param {string} slug - The normalized college slug (e.g. 'lbrce', 'vrsec').
 * @returns {Promise<object|null>} The college record or null if not found.
 */
async function getCollegeBySlug(slug) {
  if (!slug || typeof slug !== 'string') return null;

  const normalizedSlug = slug.trim().toLowerCase();
  const cached = collegeCache.get(normalizedSlug);

  if (cached) {
    const ttl = cached.isNegative ? NEGATIVE_CACHE_TTL_MS : POSITIVE_CACHE_TTL_MS;
    if (Date.now() - cached.cachedAt < ttl) {
      return cached.college; // returns null for negative cache hit
    }
  }

  // Not in cache or expired: perform database query
  const college = await prisma.college.findUnique({
    where: { slug: normalizedSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (college) {
    collegeCache.set(normalizedSlug, {
      isNegative: false,
      college,
      cachedAt: Date.now(),
    });
  } else {
    // Negative cache: store unknown slug for ~60s
    collegeCache.set(normalizedSlug, {
      isNegative: true,
      college: null,
      cachedAt: Date.now(),
    });
  }

  return college;
}

/**
 * Resolves a college record by its UUID.
 *
 * @param {string} collegeId - Valid UUID string.
 * @returns {Promise<object|null>}
 */
async function getCollegeById(collegeId) {
  if (!collegeId || typeof collegeId !== 'string') return null;

  for (const entry of collegeCache.values()) {
    if (
      !entry.isNegative &&
      entry.college &&
      entry.college.id === collegeId &&
      Date.now() - entry.cachedAt < POSITIVE_CACHE_TTL_MS
    ) {
      return entry.college;
    }
  }

  const college = await prisma.college.findUnique({
    where: { id: collegeId },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (college) {
    collegeCache.set(college.slug, {
      isNegative: false,
      college,
      cachedAt: Date.now(),
    });
  }

  return college;
}

/**
 * Clears the in-memory college cache (useful for tests and updates).
 */
function clearCollegeCache() {
  collegeCache.clear();
}

/**
 * Returns cache entry metadata (for tests and verification).
 */
function getCollegeCacheEntry(slug) {
  if (!slug) return null;
  return collegeCache.get(slug.trim().toLowerCase()) || null;
}

module.exports = {
  getCollegeBySlug,
  getCollegeById,
  isSlugCached,
  clearCollegeCache,
  getCollegeCacheEntry,
  POSITIVE_CACHE_TTL_MS,
  NEGATIVE_CACHE_TTL_MS,
};
