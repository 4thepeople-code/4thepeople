/**
 * Prisma select structure for club department relationships.
 * Scoped by Row-Level Security (RLS) under withTenant().
 */
const clubDepartmentsSelect = {
  select: {
    department: {
      select: {
        id: true,
        name: true,
        shortCode: true,
        collegeId: true,
      },
    },
  },
};

/**
 * Extracts and formats the active departments associated with a club.
 * Central clubs cannot be linked to departments and return an empty array.
 *
 * @param {Object} club - Club object (with clubType and optional departments relation)
 * @returns {Array<{id: string, name: string, shortCode: string}>}
 */
const getClubDepartments = (club) => {
  if (!club) return [];
  const isCentral = club.clubType === 'CENTRAL' || club.isCentral === true;
  if (isCentral) {
    return [];
  }

  if (!club.departments || !Array.isArray(club.departments)) {
    return [];
  }

  return club.departments
    .map((item) => item.department)
    .filter(Boolean)
    .map(({ id, name, shortCode }) => ({ id, name, shortCode }));
};

/**
 * Serializes a Club database record into the established frontend response shape:
 * - logo: { url, publicId } | null
 * - coverImage: { url, publicId } | null
 * - isCentral: boolean (derived from clubType === 'CENTRAL')
 * - clubType: 'DEPARTMENTAL' | 'CENTRAL'
 * - departments: formatted array of { id, name, shortCode }
 *
 * @param {Object} club - Raw database club record
 * @returns {Object|null} Serialized club object
 */
function serializeClub(club) {
  if (!club) return null;

  const isCentral = club.clubType === 'CENTRAL' || club.isCentral === true;
  const clubType = club.clubType || (isCentral ? 'CENTRAL' : 'DEPARTMENTAL');

  const logo = club.logoUrl
    ? { url: club.logoUrl, publicId: club.logoPublicId || null }
    : null;

  const coverImage = club.coverImageUrl
    ? { url: club.coverImageUrl, publicId: club.coverImagePublicId || null }
    : null;

  const serialized = {
    ...club,
    isCentral,
    clubType,
    logo,
    coverImage,
  };

  if (club.departments) {
    serialized.departments = getClubDepartments(club);
  }

  return serialized;
}

module.exports = {
  clubDepartmentsSelect,
  getClubDepartments,
  serializeClub,
};
