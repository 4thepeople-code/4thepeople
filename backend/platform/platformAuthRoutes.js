const express = require('express');
const router = express.Router();
const {
  platformLogin,
  platformLogout,
  getPlatformMe,
} = require('./platformAuthController');
const { authenticatePlatformToken } = require('./platformAuthMiddleware');
const { loginLimiter } = require('../middleware/rateLimiters');

// POST /api/platform/auth/login
router.post('/login', loginLimiter, platformLogin);

// POST /api/platform/auth/logout
router.post('/logout', platformLogout);

// GET /api/platform/auth/me
router.get('/me', authenticatePlatformToken, getPlatformMe);

module.exports = router;
