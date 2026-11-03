const { prisma } = require('./internalClient');

// In-memory cache for resolved college records: slug -> { college, cachedAt }
const collegeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

/**
 * Resolves a college record by its unique slug.
 * Since the colleges table is a platform directory table without RLS,
 * app_user can read it directly.
 *
 * @param {string} slug - The normalized college slug (e.g. 'lbrce', 'vrsec').
 * @returns {Promise<object|null>} The college record or null if not found.
 */
async function getCollegeBySlug(slug) {
  if (!slug || typeof slug !== 'string') return null;

  const normalizedSlug = slug.trim().toLowerCase();
  const cached = collegeCache.get(normalizedSlug);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.college;
  }

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
    collegeCache.set(normalizedSlug, { college, cachedAt: Date.now() });
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

  // Check cache values
  for (const entry of collegeCache.values()) {
    if (entry.college.id === collegeId && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
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
    collegeCache.set(college.slug, { college, cachedAt: Date.now() });
  }

  return college;
}

/**
 * Clears the in-memory college cache (useful for tests and updates).
 */
function clearCollegeCache() {
  collegeCache.clear();
}

module.exports = {
  getCollegeBySlug,
  getCollegeById,
  clearCollegeCache,
};
