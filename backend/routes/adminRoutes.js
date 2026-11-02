const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { inviteLimiter, destructiveLimiter, uploadLimiter } = require('../middleware/rateLimiters');
const {
  idParams, clubParams, managerInviteBody, createClubBody, updateClubBody,
  departmentParams, createDepartmentBody, updateDepartmentBody, clubIdsBody, departmentIdsBody,
  membershipBody, existingManagerBody, deletionVerificationBody,
} = require('../validators/schemas');
const {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  replaceDepartmentClubs,
  replaceClubDepartments,
} = require('../controllers/departmentController');
const {
  createManager,
  resendInvite,
  createClub,
  updateClub,
  updateMembership,
  deleteMembership,
  getClubManagers,
  inviteManagerToClub,
  addExistingManagerToClub,
  listClubs,
  getClub,
  viewUser,
  viewAllUsers,
  viewClub,
  viewAllClubs,
  deleteUser,
  deleteClub,
  requestUserDeletionCode,
  requestClubDeletionCode,
  getAdminProfile,
  updateAdminProfile,
  uploadAdminAvatar,
  deleteAdminAvatar,
} = require('../controllers/adminController');
const { singleImage } = require('../middleware/uploadMiddleware');

// All routes in this router require ADMIN permissions
router.use(requireAdmin);

// Admin Profile routes
router.get('/profile', getAdminProfile);
router.patch('/profile', updateAdminProfile);
router.post('/profile/avatar', uploadLimiter, singleImage('avatar'), uploadAdminAvatar);
router.delete('/profile/avatar', uploadLimiter, deleteAdminAvatar);

// Manager invitation routes
// POST /admin/managers
router.post('/managers', inviteLimiter, validate({ body: managerInviteBody }), createManager);

// POST /admin/managers/:userId/resend-invite
router.post('/managers/:userId/resend-invite', inviteLimiter, validate({ params: idParams('userId') }), resendInvite);

// User management routes
router.get('/viewAllUsers', viewAllUsers);
router.get('/viewUser/:id', validate({ params: idParams('id') }), viewUser);
router.post('/users/:userId/delete/request-code', destructiveLimiter, validate({ params: idParams('userId') }), requestUserDeletionCode);
router.delete('/users/:userId', destructiveLimiter, validate({ params: idParams('userId'), body: deletionVerificationBody }), (req, res, next) => {
  req.params.id = req.params.userId;
  return deleteUser(req, res, next);
});
router.delete('/deleteUser/:id', destructiveLimiter, validate({ params: idParams('id'), body: deletionVerificationBody }), deleteUser);

// Club management routes
// POST /admin/clubs
router.post('/create-club', validate({ body: createClubBody }), createClub);

// PATCH /admin/clubs/:clubId
router.patch('/clubs/:clubId', validate({ params: clubParams, body: updateClubBody }), updateClub);

// Department management and club/department assignments
router.post('/departments', validate({ body: createDepartmentBody }), createDepartment);
router.patch('/departments/:departmentId', validate({ params: departmentParams, body: updateDepartmentBody }), updateDepartment);
router.delete('/departments/:departmentId', validate({ params: departmentParams }), deleteDepartment);
router.put('/departments/:departmentId/clubs', validate({ params: departmentParams, body: clubIdsBody }), replaceDepartmentClubs);
router.put('/clubs/:clubId/departments', validate({ params: clubParams, body: departmentIdsBody }), replaceClubDepartments);

// PATCH /admin/memberships/:membershipId
router.patch('/memberships/:membershipId', validate({ params: idParams('membershipId'), body: membershipBody }), updateMembership);

// DELETE /admin/memberships/:membershipId
router.delete('/memberships/:membershipId', destructiveLimiter, validate({ params: idParams('membershipId') }), deleteMembership);

// GET /admin/clubs/:clubId/managers
router.get('/clubs/:clubId/managers', validate({ params: clubParams }), getClubManagers);

// POST /admin/clubs/:clubId/managers
router.post('/clubs/:clubId/managers', inviteLimiter, validate({ params: clubParams, body: managerInviteBody }), inviteManagerToClub);

// POST /admin/clubs/:clubId/managers/existing
router.post('/clubs/:clubId/managers/existing', validate({ params: clubParams, body: existingManagerBody }), addExistingManagerToClub);

// GET /admin/clubs
router.get('/clubs', listClubs);

// GET /admin/clubs/:clubId
router.get('/clubs/:clubId', validate({ params: clubParams }), getClub);

// DELETE /admin/clubs/:clubId
router.post('/clubs/:clubId/delete/request-code', destructiveLimiter, validate({ params: clubParams }), requestClubDeletionCode);
router.delete('/clubs/:clubId', destructiveLimiter, validate({ params: clubParams, body: deletionVerificationBody }), deleteClub);

router.get('/viewAllClubs', viewAllClubs);
router.get('/viewClub/:id', validate({ params: idParams('id') }), viewClub);
router.delete('/deleteClub/:id', destructiveLimiter, validate({ params: idParams('id'), body: deletionVerificationBody }), deleteClub);

// Verify token route (used by frontend ProtectedRoute)
router.get('/verify', (req, res) => {
  res.json({ success: true, message: 'Admin token is valid', user: req.user });
});

module.exports = router;
