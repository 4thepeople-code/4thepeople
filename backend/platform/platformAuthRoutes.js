const express = require('express');
const router = express.Router();
const {
  platformLogin,
  platformLogout,
  getPlatformMe,
  getPlatformSetupStatus,
  setupInitialPlatformAdmin,
} = require('./platformAuthController');
const { enrollOwnTotp } = require('./platformAdminManagementController');
const { authenticatePlatformToken } = require('./platformAuthMiddleware');
const { loginLimiter } = require('../middleware/rateLimiters');

// GET /api/platform/auth/setup-status
router.get('/setup-status', getPlatformSetupStatus);

// POST /api/platform/auth/setup-initial
router.post('/setup-initial', setupInitialPlatformAdmin);

// POST /api/platform/auth/login
router.post('/login', loginLimiter, platformLogin);

// POST /api/platform/auth/logout
router.post('/logout', platformLogout);

// GET /api/platform/auth/me
router.get('/me', authenticatePlatformToken, getPlatformMe);

// POST /api/platform/auth/totp/enroll
router.post('/totp/enroll', authenticatePlatformToken, enrollOwnTotp);

module.exports = router;
