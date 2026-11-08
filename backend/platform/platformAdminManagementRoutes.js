const express = require('express');
const router = express.Router();
const {
  listAdmins,
  createAdmin,
  updateAdmin,
  resetAdminTotp,
  enrollOwnTotp,
} = require('./platformAdminManagementController');
const { authenticatePlatformToken } = require('./platformAuthMiddleware');

// All routes require an authenticated platform super-admin session
router.use(authenticatePlatformToken);

// GET  /api/platform/admins          — list all super-admins
router.get('/', listAdmins);

// POST /api/platform/admins          — create new super-admin
router.post('/', createAdmin);

// PATCH /api/platform/admins/:id     — update name / isActive
router.patch('/:id', updateAdmin);

// POST /api/platform/admins/:id/totp/reset  — clear TOTP for another admin
router.post('/:id/totp/reset', resetAdminTotp);

module.exports = router;

