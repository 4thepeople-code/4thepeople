const { DEFAULT_COLLEGE_ID } = require('../config/college');

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

const getClubDepartments = (club) => {
  if (club.isCentral === true) {
    return [];
  }

  return club.departments
    .map(({ department }) => department)
    .filter((department) => department.collegeId === DEFAULT_COLLEGE_ID)
    .map(({ id, name, shortCode }) => ({ id, name, shortCode }));
};

module.exports = { clubDepartmentsSelect, getClubDepartments };
